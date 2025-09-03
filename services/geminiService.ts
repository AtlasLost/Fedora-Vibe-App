
import { GoogleGenAI, Type } from "@google/genai";
import type { HardeningOption, AnalysisResult, ImprovementResult, RefinedPrompt } from '../types';

/**
 * Handles errors from the Gemini API, returning a user-friendly error object.
 * @param error - The error caught from the API call.
 * @param context - A string describing the operation (e.g., 'generation', 'analysis').
 * @returns A new Error with a user-friendly message.
 */
const handleApiError = (error: unknown, context: string): Error => {
    console.error(`Error during API call for ${context}:`, error);
    if (error instanceof Error) {
        const message = error.message.toLowerCase();
        
        // Check for specific error messages from the API/fetch
        if (message.includes('api key not valid') || message.includes('permission denied')) {
            return new Error("Authentication Error: The API key is invalid or missing. Please ensure it is configured correctly.");
        }
        if (message.includes('fetch failed') || message.includes('network')) {
            return new Error("Network Error: Could not connect to the API. Please check your internet connection.");
        }
        if (message.includes('resource has been exhausted') || message.includes('rate limit')) {
            return new Error("Rate Limit Exceeded: Too many requests sent. Please wait a while before trying again.");
        }
        
        // Generic API error fallback
        return new Error(`An unexpected API error occurred during ${context}. Check the console for details.`);
    }
    // Fallback for non-Error objects being thrown
    return new Error(`An unknown error occurred during ${context}.`);
};


const cleanScriptOutput = (rawOutput: string): string => {
  // Remove markdown code block fences (```bash, ```) and trim whitespace
  const cleaned = rawOutput
    .replace(/^```(?:bash|sh)?\s*/, '')
    .replace(/```$/, '')
    .trim();
  return cleaned;
};

const callApi = async (prompt: string): Promise<string> => {
    if (!process.env.API_KEY) {
        throw new Error("Configuration Error: The API_KEY environment variable is not set.");
    }

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    try {
        const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        });
        
        const rawScript = response.text;
        return cleanScriptOutput(rawScript);
    } catch (error) {
        throw handleApiError(error, "script generation");
    }
}

export const generateScriptHeaderAndHelpers = async (): Promise<string> => {
    const prompt = `
You are a senior Linux security expert. Your task is to generate the header and utility functions for a bash hardening script for Fedora Linux.
The output MUST be only the bash script content.

Generate the following components in order:
1.  **Shebang**: \`#!/bin/bash\`
2.  **Root Check**: A function that checks if the script is run as root. If not, it prints a colorized error message and exits.
3.  **Color Variables**: Define ANSI color variables for GREEN, YELLOW, RED, BLUE, and NC (No Color).
4.  **Logging Setup**:
    *   Define a \`LOG_FILE\` variable set to "/var/log/hardening.log".
    *   Create helper functions (\`log_info\`, \`log_success\`, \`log_warning\`, \`log_error\`) that prepend a colored status indicator (e.g., [INFO], [SUCCESS]) and a timestamp. These functions must print to stdout and also append a non-colored version to the \`LOG_FILE\`.
5.  **Spinner for Tasks**:
    *   Create a function named \`run_with_spinner\` that executes a command in the background.
    *   It takes two arguments: a task description (string) and the command to execute (string).
    *   It must display an animated spinner, and after the command finishes, reprint the description with a colored "[DONE]" or "[FAILED]" status.
    *   All command output (stdout/stderr) should be redirected to the log file.
6.  **Initial Execution**:
    *   Call the root check function.
    *   Use \`log_info\` to print a welcome message and state where logs will be stored.
`;
    return callApi(prompt);
};

export const generateScriptSection = async (option: HardeningOption): Promise<string> => {
    const prompt = `
You are a senior Linux security expert. You are generating one modular section of a larger bash hardening script for Fedora Linux.
Assume that helper functions (\`log_info\`, \`log_success\`, \`run_with_spinner\`) and color variables are already defined and available.

Your task is to generate ONLY the bash code for the following hardening measure:
**${option.label}**: ${option.prompt}

Your generated code for this section MUST adhere to these strict rules:
1.  **Section Banner**: Start with a prominent, decorative banner using the \`log_info\` function (e.g., \`log_info "--- SSH Hardening ---"\`).
2.  **Use Helpers**: Use the provided helper functions for all actions. Use \`run_with_spinner\` for any command that might take more than a second. Use \`log_success\` or other log helpers for simple checks or confirmations.
3.  **Heavy Commenting**:
    *   Add a multi-line comment before the section banner explaining the goal of this section.
    *   Before every command or complex operation, add a comment explaining the *'why'* behind the action.
4.  **Idempotent & Non-Interactive**: All operations must be safe to re-run and require no user input (e.g., use \`-y\` flags).
5.  **Output**: Provide ONLY the bash script content for this specific section. Do not include shebangs, function definitions, or any other content that doesn't belong in this specific module.
`;
    return callApi(prompt);
};

export const generateScriptFooter = async (): Promise<string> => {
    const prompt = `
You are a senior Linux security expert. You are generating the final section (the footer) of a bash hardening script for Fedora Linux.
Assume all hardening steps have been completed.

Your task is to generate a concluding section for the script that does the following:
1.  Uses the pre-defined \`log_success\` helper function.
2.  Prints a prominent, decorative "Hardening Complete" message.
3.  Reminds the user to check the log file at /var/log/hardening.log for details.
4.  Strongly recommends rebooting the system for all changes to take effect.

The output MUST be ONLY the bash script content for this footer.
`;
    return callApi(prompt);
}


export const analyzeScriptOutput = async (
  output: string
): Promise<AnalysisResult> => {
  if (!process.env.API_KEY) {
    throw new Error("Configuration Error: The API_KEY environment variable is not set.");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const fullPrompt = `
You are a senior Linux security expert. A user has provided the output from a system hardening script they ran on their Fedora machine. Your task is to analyze this output and provide actionable feedback and a security score.

Analyze the following script output:
---
${output}
---

Your analysis should:
- Identify any errors, warnings, or unexpected messages (look for markers like [ERROR] or [FAILED]).
- For each issue, explain the potential security risk or problem.
- Provide a clear, step-by-step recommendation on how to fix the issue.
- If the output looks good (primarily [SUCCESS] and [DONE] messages), confirm that the hardening steps appear to have been successful and suggest next steps for monitoring.
- Format the analysis using markdown for readability (e.g., use headings, bullet points, and code blocks for commands).

Based on the successes and failures in the script output, calculate a "Security Score" from 0 to 100.
- A score of 100 means all hardening tasks completed successfully with no errors.
- A score of 0 means critical failures occurred across the board.
- Deduct points for errors, warnings, or failed steps. The more critical the failure, the more points should be deducted.
`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: fullPrompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            analysisText: {
              type: Type.STRING,
              description: "A detailed markdown-formatted analysis of the script output, identifying successes, failures, and recommendations.",
            },
            securityScore: {
              type: Type.NUMBER,
              description: "A numerical score from 0 to 100 representing the system's hardening level based on the script output.",
            },
          },
          required: ["analysisText", "securityScore"],
        },
      },
    });
    
    const jsonString = response.text;
    let result: AnalysisResult;

    try {
        result = JSON.parse(jsonString);
    } catch(e) {
        console.error("Failed to parse JSON response from Gemini:", jsonString);
        throw new Error("Invalid Response: The analysis data from the API was malformed and could not be parsed.");
    }
    
    if (typeof result.securityScore !== 'number' || result.securityScore < 0 || result.securityScore > 100) {
        result.securityScore = Math.max(0, Math.min(100, result.securityScore || 0));
    }

    return result;
  } catch (error) {
    throw handleApiError(error, "output analysis");
  }
};

export const runShellcheckAndLearn = async (
  originalScript: string,
  activeOptions: HardeningOption[]
): Promise<ImprovementResult> => {
  if (!process.env.API_KEY) {
    throw new Error("Configuration Error: The API_KEY environment variable is not set.");
  }
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const originalPrompts = activeOptions.map(opt => ({ id: opt.id, prompt: opt.prompt }));

  const fullPrompt = `
You are an expert system that learns from its own mistakes to improve its instructions.
You will receive:
1. An original bash script.
2. The list of original high-level prompts (with their IDs) that were used to generate the script.

Your task is to perform a four-step process and return the result as a single JSON object:
1.  **Analyze**: Act as the ShellCheck static analysis tool. Thoroughly review the script and identify all potential bugs, style issues, and portability problems.
2.  **Correct**: Based on your own analysis, rewrite the original script to fix all identified issues. The corrected script must maintain the original's intent, functionality, and output style.
3.  **Refine**: Analyze your own findings. For each original prompt that contributed to an error, rewrite it to be more specific and robust. The new prompt should guide an AI to generate code that avoids the identified issue in the future. Only return prompts that you have actually changed.
4.  **Summarize**: Create a concise list summarizing the main categories of corrections you made (e.g., 'Quoted variables to prevent word splitting', 'Used \`[[ ... ]]\` instead of \`[ ... ]\` for modern syntax', 'Removed deprecated backticks').

Here is the data:
**Original Script:**
---
${originalScript}
---
**Original Prompts:**
---
${JSON.stringify(originalPrompts)}
---

Your response MUST be a single, valid JSON object that adheres to the following schema.
`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: fullPrompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            correctedScript: {
              type: Type.STRING,
              description: 'The full, corrected bash script, with all identified issues addressed.',
            },
            refinedPrompts: {
              type: Type.ARRAY,
              description: 'A list of prompts that were identified as needing improvement and have been rewritten.',
              items: {
                type: Type.OBJECT,
                properties: {
                  id: {
                    type: Type.STRING,
                    description: 'The unique identifier (e.g., "ssh", "firewall") of the prompt that was refined.',
                  },
                  newPrompt: {
                    type: Type.STRING,
                    description: 'The new, improved prompt text that should be used in the future to avoid the original issue.',
                  },
                },
                required: ['id', 'newPrompt'],
              },
            },
            improvementSummary: {
              type: Type.ARRAY,
              description: 'A list of human-readable strings summarizing the main corrections made to the script.',
              items: {
                type: Type.STRING,
              },
            },
          },
          required: ['correctedScript', 'refinedPrompts', 'improvementSummary'],
        },
      },
    });

    const jsonString = response.text;
    let result: ImprovementResult;
    try {
        result = JSON.parse(jsonString);
        // Clean the script part of the JSON response
        result.correctedScript = cleanScriptOutput(result.correctedScript);
         // Ensure summary is an array
        if (!Array.isArray(result.improvementSummary)) {
            result.improvementSummary = [];
        }
    } catch (e) {
        console.error("Failed to parse JSON response from Gemini for improvement:", jsonString);
        throw new Error("Invalid Response: The script improvement data from the API was malformed and could not be parsed.");
    }
    
    return result;

  } catch (error) {
    throw handleApiError(error, "script improvement");
  }
};