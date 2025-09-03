
import React from 'react';
import { useState, useCallback, useEffect } from 'react';
import type { SelectedOptions, AnalysisResult, HardeningOption } from './types';
import { PARANOIA_LEVELS, SUGGESTED_PROMPTS, JOKES } from './constants';
import { generateScriptHeaderAndHelpers, generateScriptSection, generateScriptFooter, analyzeScriptOutput, runShellcheckAndLearn } from './services/geminiService';
import Header from './components/Header';
import HardeningOptions from './components/HardeningOptions';
import ScriptDisplay from './components/ScriptDisplay';
import AnalysisDisplay from './components/AnalysisDisplay';

const MAX_CUSTOM_PROMPT_LENGTH = 1000;

interface GenerationStatus {
  totalSteps: number;
  currentStep: number;
  message: string;
}

// --- Pre-computation for efficient option handling ---

const getAllOptionsRecursively = (options: HardeningOption[]): HardeningOption[] => {
    let all: HardeningOption[] = [];
    options.forEach(option => {
        all.push(option);
        if (option.subOptions) {
            all = all.concat(getAllOptionsRecursively(option.subOptions));
        }
    });
    return all;
};

// Create maps for quick lookups of options and their relationships
const idToOptionMap: Map<string, HardeningOption> = new Map();
const parentMap: Map<string, string> = new Map();

const buildLookups = (options: HardeningOption[], parentId: string | null = null) => {
    for (const option of options) {
        idToOptionMap.set(option.id, option);
        if (parentId) {
            parentMap.set(option.id, parentId);
        }
        if (option.subOptions) {
            buildLookups(option.subOptions, option.id);
        }
    }
};

PARANOIA_LEVELS.forEach(level => buildLookups(level.options));

const allOptionsFromLevels = Array.from(idToOptionMap.values());

const initialSelections = Array.from(idToOptionMap.keys()).reduce((acc, key) => {
    acc[key] = false;
    return acc;
}, {} as SelectedOptions);


const App: React.FC = () => {
  // State for script generation
  const [selectedOptions, setSelectedOptions] = useState<SelectedOptions>(initialSelections);
  const [customPrompt, setCustomPrompt] = useState<string>('');
  const [customExclusions, setCustomExclusions] = useState<string>('');
  const [generatedScript, setGeneratedScript] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [generationStatus, setGenerationStatus] = useState<GenerationStatus | null>(null);
  const [lastActiveOptions, setLastActiveOptions] = useState<HardeningOption[]>([]);
  const [isRebootRecommended, setIsRebootRecommended] = useState<boolean>(false);


  // State for output analysis
  const [activeTab, setActiveTab] = useState<'generate' | 'shellcheck' | 'advanced'>('generate');
  const [scriptOutput, setScriptOutput] = useState<string>('');
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  // State for ShellCheck & Learn
  const [isImproving, setIsImproving] = useState<boolean>(false);
  const [improvingError, setImprovingError] = useState<string | null>(null);
  const [improvedScript, setImprovedScript] = useState<string>('');
  const [improvementSummary, setImprovementSummary] = useState<string[]>([]);
  const [improvedPromptIds, setImprovedPromptIds] = useState<Set<string>>(new Set());
  const [showImprovementSuccess, setShowImprovementSuccess] = useState(false);


  const isPromptTooLong = customPrompt.length > MAX_CUSTOM_PROMPT_LENGTH;
  
  // Determine if the generate button should be enabled.
  // It's active if any checkbox is selected OR if there's text in the custom prompt.
  const isAnyOptionSelected = Object.values(selectedOptions).some(Boolean) || customPrompt.trim() !== '';
  
  // Effect to dismiss the improvement success message
  useEffect(() => {
    if (showImprovementSuccess) {
      const timer = setTimeout(() => setShowImprovementSuccess(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [showImprovementSuccess]);

  const handleOptionChange = useCallback((id: string) => {
    setSelectedOptions(prev => {
      const newSelections = { ...prev };

      // 1. Toggle the clicked option's state
      const isChecked = !prev[id];
      newSelections[id] = isChecked;

      const changedOption = idToOptionMap.get(id);

      // 2. Propagate changes downwards to all descendants
      if (changedOption?.subOptions) {
        const descendants = getAllOptionsRecursively(changedOption.subOptions);
        descendants.forEach(descendant => {
          newSelections[descendant.id] = isChecked;
        });
      }

      // 3. Propagate changes upwards to all ancestors
      let parentId = parentMap.get(id);
      while (parentId) {
        const parentOption = idToOptionMap.get(parentId);
        if (!parentOption?.subOptions) break;

        if (!isChecked) {
          // If a child is unchecked, its parent must also be unchecked.
          newSelections[parentId] = false;
        } else {
          // If a child is checked, check the parent only if all its children are now checked.
          const allChildrenChecked = parentOption.subOptions.every(
            sub => newSelections[sub.id]
          );
          newSelections[parentId] = allChildrenChecked;
        }
        
        // Move up the hierarchy
        parentId = parentMap.get(parentId);
      }
      
      return newSelections;
    });
  }, []);
  
  const handleSuggestedPromptClick = useCallback((promptText: string) => {
    setCustomPrompt(prev => {
        if (prev.trim() === '') return promptText;
        return `${prev.trim()}\n${promptText}`;
    });
  }, []);


  const handleGenerateScript = useCallback(async () => {
    if (isPromptTooLong || !isAnyOptionSelected) return;

    setIsLoading(true);
    setError(null);
    setGeneratedScript('');
    setImprovedScript('');
    setImprovementSummary([]);
    setIsRebootRecommended(false);

    const activeOptions = allOptionsFromLevels.filter(option => selectedOptions[option.id] && option.prompt);
    
    if (customPrompt.trim()) {
        let finalCustomPrompt = `*   **Custom Request**: ${customPrompt.trim()}`;
        if (customExclusions.trim()) {
            finalCustomPrompt += `\n    *   **IMPORTANT EXCLUSIONS**: The user has specified that the following items MUST be excluded from this custom task: \`${customExclusions.trim()}\`. For example, if the request is to "disable all services" and the exclusion is "sshd", your script must NOT disable the sshd service. Honor these exclusions strictly.`;
        }
        activeOptions.push({
            id: 'custom',
            label: 'Custom Requirement',
            description: 'User-defined custom prompt.',
            prompt: finalCustomPrompt,
        });
    }
    setLastActiveOptions(activeOptions);
    
    // Check for reboot requirement
    const rebootNeeded = activeOptions.some(option => {
        const fullOptionData = idToOptionMap.get(option.id);
        return fullOptionData?.rebootRequired;
    });
    setIsRebootRecommended(rebootNeeded);
    
    const totalSteps = activeOptions.length + 2; // header + footer
    let currentStep = 0;
    let fullScript = '';

    const updateProgress = (stepMessage: string) => {
        currentStep++;
        const randomJoke = JOKES[Math.floor(Math.random() * JOKES.length)];
        const message = `${stepMessage}\n\n"${randomJoke}"`;
        setGenerationStatus({ totalSteps, currentStep, message });
    };

    try {
        // Initial state
        setGenerationStatus({ totalSteps, currentStep: 0, message: "Initializing generation..." });
        
        // Step 1: Header
        updateProgress("Step 1: Generating script header and helpers...");
        const header = await generateScriptHeaderAndHelpers();
        fullScript += header + '\n\n';
        setGeneratedScript(fullScript);

        // Step 2...N: Sections
        for (const option of activeOptions) {
            updateProgress(`Step ${currentStep + 1}: Generating '${option.label}' section...`);
            const section = await generateScriptSection(option);
            fullScript += section + '\n\n';
            setGeneratedScript(fullScript);
        }

        // Final Step: Footer
        updateProgress(`Step ${totalSteps}: Adding script footer...`);
        const footer = await generateScriptFooter();
        fullScript += footer + '\n';
        setGeneratedScript(fullScript);

    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred during script generation.';
      setError(errorMessage);
      console.error(e);
      setGenerationStatus(null);
    } finally {
      setIsLoading(false);
      setGenerationStatus(null);
    }
  }, [selectedOptions, customPrompt, customExclusions, isPromptTooLong, isAnyOptionSelected]);
  
  const handleAnalyzeOutput = useCallback(async () => {
    if (!scriptOutput.trim()) {
      setAnalysisError("Please paste the script output before analyzing.");
      return;
    }
    setIsAnalyzing(true);
    setAnalysisError(null);
    setAnalysisResult(null);

    try {
      const result = await analyzeScriptOutput(scriptOutput);
      setAnalysisResult(result);
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred during analysis.';
      setAnalysisError(errorMessage);
      console.error(e);
    } finally {
      setIsAnalyzing(false);
    }
  }, [scriptOutput]);
  
  const handleRunShellcheck = useCallback(async () => {
    if (!generatedScript.trim() || !generatedScript.trim().startsWith('#!')) {
      setImprovingError("A valid script with a shebang (e.g., #!/bin/bash) must be generated on the first tab before running ShellCheck.");
      return;
    }
    setIsImproving(true);
    setImprovingError(null);
    setImprovedScript('');
    setImprovementSummary([]);

    try {
      // Filter out the custom prompt before sending to learn, as it's not a permanent option
      const learnableOptions = lastActiveOptions.filter(opt => opt.id !== 'custom');
      const result = await runShellcheckAndLearn(generatedScript, learnableOptions);
      setImprovedScript(result.correctedScript);
      setImprovementSummary(result.improvementSummary);
      
      const allModifiableOptions = PARANOIA_LEVELS.flatMap(l => l.options);

      // Apply learned prompt improvements
      if (result.refinedPrompts.length > 0) {
        setShowImprovementSuccess(true);
        const newImprovedIds = new Set(improvedPromptIds);

        result.refinedPrompts.forEach(refined => {
            const optionToUpdate = allOptionsFromLevels.find(opt => opt.id === refined.id);
            if(optionToUpdate) {
                optionToUpdate.prompt = refined.newPrompt;
                newImprovedIds.add(refined.id);
            }
        });

        setImprovedPromptIds(newImprovedIds);
      }
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred during script refinement.';
      setImprovingError(errorMessage);
      console.error(e);
    } finally {
      setIsImproving(false);
    }
  }, [generatedScript, lastActiveOptions, improvedPromptIds]);

  const TabButton: React.FC<{tabName: 'generate' | 'shellcheck' | 'advanced'; label: string}> = ({ tabName, label }) => (
    <button
      onClick={() => setActiveTab(tabName)}
      className={`${
        activeTab === tabName
          ? 'border-blue-500 text-blue-500'
          : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-500'
      } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors focus:outline-none`}
      aria-current={activeTab === tabName ? 'page' : undefined}
    >
      {label}
    </button>
  );

  return (
    <div className="min-h-screen bg-gray-900 text-gray-200 font-sans flex flex-col">
      <Header />
      <main className="flex-grow container mx-auto p-4 md:p-8 flex flex-col gap-6">
        <div className="border-b border-gray-700">
          <nav className="-mb-px flex space-x-8" aria-label="Tabs">
            <TabButton tabName="generate" label="Generate Script" />
            <TabButton tabName="shellcheck" label="ShellCheck" />
            <TabButton tabName="advanced" label="Advanced" />
          </nav>
        </div>

        {activeTab === 'generate' && (
          <div className="flex flex-col lg:flex-row gap-8 animate-fadeIn">
            <div className="lg:w-1/3 flex flex-col gap-6">
              {PARANOIA_LEVELS.map(level => (
                <HardeningOptions
                  key={level.level}
                  title={level.title}
                  description={level.description}
                  options={level.options}
                  selectedOptions={selectedOptions} 
                  onOptionChange={handleOptionChange}
                  improvedPromptIds={improvedPromptIds}
                />
              ))}
              
              <div>
                <label htmlFor="custom-prompt" className="block text-sm font-medium text-gray-400 mb-2">
                  Custom Requirements
                </label>
                <textarea
                  id="custom-prompt"
                  rows={4}
                  className="w-full bg-gray-800 border border-gray-700 rounded-md shadow-sm p-3 focus:ring-blue-500 focus:border-blue-500 transition"
                  placeholder="e.g., block traffic from a specific IP address..."
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  maxLength={MAX_CUSTOM_PROMPT_LENGTH}
                  aria-describedby="custom-prompt-char-count"
                />
                 <div id="custom-prompt-char-count" className="text-right text-sm mt-1">
                  <span className={isPromptTooLong ? 'text-red-500' : 'text-gray-400'}>
                    {customPrompt.length} / {MAX_CUSTOM_PROMPT_LENGTH}
                  </span>
                </div>
                <div className="mt-4">
                  <label htmlFor="custom-exclusions" className="block text-sm font-medium text-gray-400 mb-2">
                    Exclusions (optional, comma-separated)
                  </label>
                  <input
                    type="text"
                    id="custom-exclusions"
                    className="w-full bg-gray-800 border border-gray-700 rounded-md shadow-sm p-3 focus:ring-blue-500 focus:border-blue-500 transition"
                    placeholder="e.g., sshd, httpd, custom_service"
                    value={customExclusions}
                    onChange={(e) => setCustomExclusions(e.target.value)}
                  />
                </div>
                 <div className="mt-4">
                    <p className="text-xs text-gray-400 mb-2">Suggestions (click to add):</p>
                    <div className="flex flex-wrap gap-2">
                        {SUGGESTED_PROMPTS.map(p => (
                            <button 
                              key={p.label} 
                              onClick={() => handleSuggestedPromptClick(p.promptText)} 
                              className="px-2 py-1 text-xs font-medium text-blue-300 bg-blue-900/50 border border-blue-800 rounded-md hover:bg-blue-900/80 transition-colors"
                              title={p.promptText}
                            >
                                {p.label}
                            </button>
                        ))}
                    </div>
                </div>
              </div>

              <button
                onClick={handleGenerateScript}
                // The button is disabled while loading, if the prompt is too long,
                // or if no selections have been made.
                disabled={isLoading || isPromptTooLong || !isAnyOptionSelected}
                className="w-full flex justify-center items-center bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-4 rounded-md transition disabled:bg-gray-700 disabled:text-gray-400 disabled:cursor-not-allowed"
              >
                {/* The button text changes based on the loading state and whether any options are selected. */}
                {isLoading ? 'Generating...' : isAnyOptionSelected ? 'Generate Hardening Script' : 'Make a Selection'}
              </button>
            </div>
            <div className="lg:w-2/3">
               <ScriptDisplay 
                  script={generatedScript} 
                  isLoading={isLoading} 
                  error={error} 
                  loadingMessage={generationStatus?.message || "Generating your custom script..."}
                  currentStep={generationStatus?.currentStep || 0}
                  totalSteps={generationStatus?.totalSteps || 0}
                  isRebootRecommended={isRebootRecommended}
                />
            </div>
          </div>
        )}

        {activeTab === 'advanced' && (
          <div className="flex flex-col gap-6 animate-fadeIn">
             <div>
              <label htmlFor="script-output" className="block text-sm font-medium text-gray-400 mb-2">
                Paste Script Output Here
              </label>
              <textarea
                id="script-output"
                rows={15}
                className="w-full bg-gray-800 border border-gray-700 rounded-md shadow-sm p-3 focus:ring-blue-500 focus:border-blue-500 transition font-mono text-sm"
                placeholder="Paste the full terminal output after running the script..."
                value={scriptOutput}
                onChange={(e) => setScriptOutput(e.target.value)}
              />
            </div>
            <div className="flex justify-end">
              <button
                onClick={handleAnalyzeOutput}
                disabled={isAnalyzing}
                className="w-full md:w-auto flex justify-center items-center bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-6 rounded-md transition disabled:bg-gray-700 disabled:cursor-not-allowed"
              >
                {isAnalyzing ? 'Analyzing...' : 'Analyze Output'}
              </button>
            </div>
            <AnalysisDisplay result={analysisResult} isLoading={isAnalyzing} error={analysisError} />
          </div>
        )}

        {activeTab === 'shellcheck' && (
          <div className="animate-fadeIn space-y-6">
             {showImprovementSuccess && (
              <div className="bg-green-500/20 border border-green-500 text-green-300 px-4 py-3 rounded-md text-center animate-fadeIn" role="alert">
                <strong className="font-bold">Success!</strong>
                <span className="block sm:inline ml-2">Script refined and AI prompts have been improved for future generations.</span>
              </div>
            )}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="space-y-4">
                <h3 className="text-xl font-semibold">Automated ShellCheck &amp; Improvement</h3>
                <p className="text-gray-400">
                  This tool uses an AI to perform a static analysis inspired by{' '}
                  <a href="https://github.com/koalaman/shellcheck" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">ShellCheck</a>.
                  Click the button below to automatically find and fix issues in your last generated script, while also teaching the AI to avoid similar mistakes in the future.
                </p>
                 <div>
                    <label htmlFor="original-script-display" className="block text-sm font-medium text-gray-400 mb-2">
                      Last Generated Script (Read-only)
                    </label>
                    <div id="original-script-display" className="w-full h-72 bg-gray-800 border border-gray-700 rounded-md p-3 font-mono text-sm overflow-auto">
                        {generatedScript || <span className="text-gray-500">Generate a script on the first tab.</span>}
                    </div>
                </div>
                <button
                  onClick={handleRunShellcheck}
                  disabled={isImproving || !generatedScript}
                  className="w-full flex justify-center items-center bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-4 rounded-md transition disabled:bg-gray-700 disabled:cursor-not-allowed"
                >
                  {isImproving ? 'Analyzing & Refining...' : 'Run ShellCheck & Improve'}
                </button>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Corrected Script
                </label>
                 {improvementSummary.length > 0 && !isImproving && (
                    <div className="mb-4 bg-gray-800 p-4 rounded-lg border border-gray-700 animate-fadeIn">
                        <h4 className="text-md font-semibold text-gray-200 mb-2 flex items-center gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            Summary of Improvements
                        </h4>
                        <ul className="list-disc list-inside space-y-1 text-sm text-gray-300 pl-2">
                            {improvementSummary.map((item, index) => (
                                <li key={index}>{item}</li>
                            ))}
                        </ul>
                    </div>
                )}
                <ScriptDisplay script={improvedScript} isLoading={isImproving} error={improvingError} loadingMessage={"Refining script..."}/>
              </div>
            </div>
          </div>
        )}
      </main>
      <footer className="text-center p-4 text-gray-400 text-xs border-t border-gray-800">
        <p>Disclaimer: The generated script and analysis are provided as-is. Always review and test scripts in a non-production environment before execution.</p>
      </footer>
    </div>
  );
};

export default App;
