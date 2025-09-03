// Fix: Resolve TypeScript errors related to Jest by explicitly importing globals.
// This makes test utilities available without relying on ambient type declarations,
// which can be unreliable in some environments.
import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

/**
 * @jest-environment node
 */

// This comment is for the AI Studio environment.
// The following test suite is written for a Jest environment.
// To run these tests, you would typically use a command like `jest`.
// It requires jest, @types/jest, and ts-jest to be installed.

// Mock the entire @google/genai module
jest.mock('@google/genai', () => ({
  GoogleGenAI: jest.fn().mockImplementation(() => ({
    models: {
      generateContent: jest.fn(),
    },
  })),
  Type: { // Mock the Type enum used in analyzeScriptOutput
    OBJECT: 'OBJECT',
    STRING: 'STRING',
    NUMBER: 'NUMBER',
    ARRAY: 'ARRAY',
  }
}));

import { GoogleGenAI } from '@google/genai';
// FIX: The function `generateHardenScript` was refactored into three separate functions.
// Update imports to reflect the new modular structure.
import { generateScriptHeaderAndHelpers, generateScriptSection, generateScriptFooter, analyzeScriptOutput, runShellcheckAndLearn } from './geminiService';
import { PARANOIA_LEVELS } from '../constants';
import type { AnalysisResult, ImprovementResult } from '../types';

// Get a typed mock for the constructor and its methods
const mockGoogleGenAI = GoogleGenAI as jest.Mock;
// FIX: Type the mock function to prevent TypeScript from inferring `never` for its parameters.
// Use a single function type argument to be compatible with the version of Jest types being used.
const mockGenerateContent = jest.fn<(args: { contents: string; [key: string]: any; }) => Promise<{ text: string }>>();

describe('geminiService', () => {
  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
    mockGoogleGenAI.mockImplementation(() => ({
      models: {
        generateContent: mockGenerateContent,
      },
    }));
    // Mock the environment variable for the API key
    process.env.API_KEY = 'test-api-key';
  });

  afterEach(() => {
    delete process.env.API_KEY;
  });

  // FIX: The `generateHardenScript` function was removed. Tests are updated to target
  // the new, more modular functions: `generateScriptHeaderAndHelpers`, `generateScriptSection`,
  // and `generateScriptFooter`.
  describe('generateScriptHeaderAndHelpers', () => {
    it('should generate a script header and clean the output', async () => {
      const mockHeader = '#!/bin/bash\n# Header';
      mockGenerateContent.mockResolvedValue({ text: `\`\`\`bash\n${mockHeader}\n\`\`\`` });
      
      const header = await generateScriptHeaderAndHelpers();

      expect(mockGenerateContent).toHaveBeenCalledTimes(1);
      const calledPrompt = mockGenerateContent.mock.calls[0][0].contents;
      expect(calledPrompt).toContain('generate the header and utility functions');
      expect(header).toBe(mockHeader);
    });

    it('should throw a user-friendly error for an invalid API key', async () => {
      mockGenerateContent.mockRejectedValue(new Error('API key not valid'));
      await expect(generateScriptHeaderAndHelpers()).rejects.toThrow('Authentication Error: The API key is invalid or missing. Please ensure it is configured correctly.');
    });

    it('should throw a user-friendly error for a network failure', async () => {
        mockGenerateContent.mockRejectedValue(new Error('fetch failed'));
        await expect(generateScriptHeaderAndHelpers()).rejects.toThrow('Network Error: Could not connect to the API. Please check your internet connection.');
    });

    it('should throw a user-friendly error for a rate limit issue', async () => {
        mockGenerateContent.mockRejectedValue(new Error('rate limit exceeded'));
        await expect(generateScriptHeaderAndHelpers()).rejects.toThrow('Rate Limit Exceeded: Too many requests sent. Please wait a while before trying again.');
    });

    it('should throw a user-friendly error for a generic API failure', async () => {
        mockGenerateContent.mockRejectedValue(new Error('Internal server error'));
        await expect(generateScriptHeaderAndHelpers()).rejects.toThrow('An unexpected API error occurred during script generation. Check the console for details.');
    });

    it('should throw a configuration error if API_KEY is not set', async () => {
      delete process.env.API_KEY;
      await expect(generateScriptHeaderAndHelpers()).rejects.toThrow('Configuration Error: The API_KEY environment variable is not set.');
    });
  });

  describe('generateScriptSection', () => {
    it('should generate a script section for a given option', async () => {
        const mockSection = '# SSH Hardening Section';
        mockGenerateContent.mockResolvedValue({ text: `\`\`\`bash\n${mockSection}\n\`\`\`` });

        const option = PARANOIA_LEVELS[0].options[2]; // SSH Hardening
        const section = await generateScriptSection(option);

        expect(mockGenerateContent).toHaveBeenCalledTimes(1);
        const calledPrompt = mockGenerateContent.mock.calls[0][0].contents;
        expect(calledPrompt).toContain(option.label);
        expect(calledPrompt).toContain(option.prompt);
        expect(section).toBe(mockSection);
    });

    it('should throw an error if the API call fails', async () => {
        mockGenerateContent.mockRejectedValue(new Error('API Error'));
        const option = PARANOIA_LEVELS[0].options[0];
        await expect(generateScriptSection(option)).rejects.toThrow('An unexpected API error occurred during script generation. Check the console for details.');
    });
  });

  describe('generateScriptFooter', () => {
    it('should generate a script footer', async () => {
        const mockFooter = '# Hardening complete.';
        mockGenerateContent.mockResolvedValue({ text: `\`\`\`bash\n${mockFooter}\n\`\`\`` });
        
        const footer = await generateScriptFooter();

        expect(mockGenerateContent).toHaveBeenCalledTimes(1);
        const calledPrompt = mockGenerateContent.mock.calls[0][0].contents;
        expect(calledPrompt).toContain('generating the final section (the footer)');
        expect(footer).toBe(mockFooter);
    });

    it('should throw an error if the API call fails', async () => {
        mockGenerateContent.mockRejectedValue(new Error('API Error'));
        await expect(generateScriptFooter()).rejects.toThrow('An unexpected API error occurred during script generation. Check the console for details.');
    });
  });

  describe('analyzeScriptOutput', () => {
    it('should return a valid analysis result and score on successful analysis', async () => {
      const mockResponse: AnalysisResult = {
        analysisText: 'System looks well-hardened.',
        securityScore: 95
      };
      mockGenerateContent.mockResolvedValue({ text: JSON.stringify(mockResponse) });

      const result = await analyzeScriptOutput('...script output...');
      expect(result).toEqual(mockResponse);
      expect(mockGenerateContent).toHaveBeenCalledTimes(1);
    });

    it('should clamp the security score to 100 if the API returns a higher value', async () => {
      const mockResponse = { analysisText: 'Perfect!', securityScore: 150 };
      mockGenerateContent.mockResolvedValue({ text: JSON.stringify(mockResponse) });
      const result = await analyzeScriptOutput('...');
      expect(result.securityScore).toBe(100);
    });

    it('should clamp the security score to 0 if the API returns a negative value', async () => {
      const mockResponse = { analysisText: 'Something is wrong', securityScore: -10 };
      mockGenerateContent.mockResolvedValue({ text: JSON.stringify(mockResponse) });
      const result = await analyzeScriptOutput('...');
      expect(result.securityScore).toBe(0);
    });

    it('should throw an error for an invalid JSON response from the API', async () => {
      mockGenerateContent.mockResolvedValue({ text: 'This is not a valid JSON.' });
      await expect(analyzeScriptOutput('...')).rejects.toThrow('Invalid Response: The analysis data from the API was malformed and could not be parsed.');
    });
    
    it('should throw a user-friendly error for an invalid API key', async () => {
        mockGenerateContent.mockRejectedValue(new Error('API key not valid'));
        await expect(analyzeScriptOutput('...')).rejects.toThrow('Authentication Error: The API key is invalid or missing. Please ensure it is configured correctly.');
    });

    it('should throw a configuration error if API_KEY is not set for analysis', async () => {
      delete process.env.API_KEY;
      await expect(analyzeScriptOutput('')).rejects.toThrow('Configuration Error: The API_KEY environment variable is not set.');
    });
  });
  
  describe('runShellcheckAndLearn', () => {
    it('should return a corrected script and refined prompts', async () => {
        // Fix: Add the missing `improvementSummary` property to the mock `ImprovementResult`
        // to satisfy the type definition and prevent a TypeScript error.
        const mockResponse: ImprovementResult = {
            correctedScript: 'echo "Corrected Script"',
            refinedPrompts: [{ id: 'ssh', newPrompt: 'A better SSH prompt' }],
            improvementSummary: ['Quoted variables to prevent word splitting.'],
        };
        mockGenerateContent.mockResolvedValue({ text: JSON.stringify(mockResponse) });

        const originalScript = 'echo "Original Script"';
        const activeOptions = [PARANOIA_LEVELS[0].options[2]]; // SSH Hardening

        const result = await runShellcheckAndLearn(originalScript, activeOptions);

        expect(result.correctedScript).toBe(mockResponse.correctedScript);
        expect(result.refinedPrompts).toEqual(mockResponse.refinedPrompts);

        const calledPrompt = mockGenerateContent.mock.calls[0][0].contents;
        expect(calledPrompt).toContain(originalScript);
        expect(calledPrompt).toContain(JSON.stringify([{id: 'ssh', prompt: activeOptions[0].prompt}]));
    });

    it('should throw an error for an invalid JSON response from the API', async () => {
      mockGenerateContent.mockResolvedValue({ text: 'This is not valid JSON.' });
      await expect(runShellcheckAndLearn('script', [])).rejects.toThrow('Invalid Response: The script improvement data from the API was malformed and could not be parsed.');
    });

    it('should throw a user-friendly error for an invalid API key', async () => {
        mockGenerateContent.mockRejectedValue(new Error('API key not valid'));
        await expect(runShellcheckAndLearn('script', [])).rejects.toThrow('Authentication Error: The API key is invalid or missing. Please ensure it is configured correctly.');
    });
  });
});