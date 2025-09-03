// Fix: Resolve TypeScript errors related to Jest by explicitly importing globals.
// This makes test utilities available without relying on ambient type declarations,
// which can be unreliable in some environments.
import { jest, describe, it, expect, beforeEach } from '@jest/globals';

/**
 * @jest-environment jsdom
 */

// This comment is for the AI Studio environment.
// The following test suite is written for Jest and React Testing Library.
// To run these tests, you need a testing setup with packages like jest,
// @testing-library/react, @testing-library/jest-dom, and ts-jest.

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

import App from '../App';
import * as geminiService from '../services/geminiService';
// FIX: Import PARANOIA_LEVELS to correctly calculate expected mock calls and find elements.
import { PARANOIA_LEVELS } from '../constants';
// Fix: Import HardeningOption type for strong typing of mocks.
import type { AnalysisResult, HardeningOption, ImprovementResult } from '../types';

// Mock the entire geminiService module
jest.mock('../services/geminiService');

// FIX: The `generateHardenScript` function was refactored. Mocks are updated to target the new
// modular functions: `generateScriptHeaderAndHelpers`, `generateScriptSection`, and `generateScriptFooter`.
const mockGenerateScriptHeaderAndHelpers = geminiService.generateScriptHeaderAndHelpers as jest.Mock<() => Promise<string>>;
const mockGenerateScriptSection = geminiService.generateScriptSection as jest.Mock<(option: HardeningOption) => Promise<string>>;
const mockGenerateScriptFooter = geminiService.generateScriptFooter as jest.Mock<() => Promise<string>>;
const mockAnalyzeScriptOutput = geminiService.analyzeScriptOutput as jest.Mock<(output: string) => Promise<AnalysisResult>>;
const mockRunShellcheckAndLearn = geminiService.runShellcheckAndLearn as jest.Mock<(script: string, options: HardeningOption[]) => Promise<ImprovementResult>>;


describe('<App /> Integration Tests', () => {
  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
    // FIX: Set default mocks for the new script generation functions.
    mockGenerateScriptHeaderAndHelpers.mockResolvedValue('#!/bin/bash\n# Header\n');
    mockGenerateScriptSection.mockImplementation(async (option: HardeningOption) => `# Section for ${option.label}\n`);
    mockGenerateScriptFooter.mockResolvedValue('# Footer\n');
  });

  it('should render the generate script tab with all options unchecked and generate button disabled', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: /Fedora Hardening Script Generator/i })).toBeInTheDocument();
    
    // Check that the button is disabled and has the correct text
    const generateButton = screen.getByRole('button', { name: /Make a Selection/i });
    expect(generateButton).toBeInTheDocument();
    expect(generateButton).toBeDisabled();
    
    // Check that one of the options is present but unchecked
    const firstOptionCheckbox = screen.getByLabelText(PARANOIA_LEVELS[0].options[0].label);
    expect(firstOptionCheckbox).toBeInTheDocument();
    expect(firstOptionCheckbox).not.toBeChecked();
  });

  // FIX: Test case updated to reflect the new, multi-step script generation process and initial state.
  it('should enable the generate button and handle the script generation flow correctly', async () => {
    const mockHeader = '#!/bin/bash\n# Header';
    const mockSection = '# A Section';
    const mockFooter = '# The End';
    mockGenerateScriptHeaderAndHelpers.mockResolvedValue(mockHeader);
    mockGenerateScriptSection.mockResolvedValue(mockSection);
    mockGenerateScriptFooter.mockResolvedValue(mockFooter);
    
    render(<App />);
    
    // Check initial disabled state
    const generateButton = screen.getByRole('button', { name: /Make a Selection/i });
    expect(generateButton).toBeDisabled();

    // Select an option to enable the button
    const optionToSelect = screen.getByLabelText(PARANOIA_LEVELS[0].options[0].label);
    fireEvent.click(optionToSelect);
    
    const enabledGenerateButton = await screen.findByRole('button', { name: /Generate Hardening Script/i });
    expect(enabledGenerateButton).not.toBeDisabled();

    fireEvent.click(enabledGenerateButton);

    // Check for loading state
    expect(await screen.findByText(/Generating.../i)).toBeInTheDocument();
    expect(enabledGenerateButton).toBeDisabled();

    // Check for progress messages
    await screen.findByText(/Step 1: Generating script header/);
    await screen.findByText(/Generating 'System Updates & Packages' section/);
    await screen.findByText(/Adding script footer/);

    // Wait for the final script to appear by checking for its constituent parts
    await waitFor(() => {
        const scriptDisplay = screen.getByRole('log'); // The parent container for the script
        expect(scriptDisplay).toHaveTextContent(mockHeader);
        expect(scriptDisplay).toHaveTextContent(mockSection);
        expect(scriptDisplay).toHaveTextContent(mockFooter);
    });

    // Verify copy button appears and loading state is gone
    expect(screen.getByRole('button', { name: /Copy/i })).toBeInTheDocument();
    expect(screen.queryByText(/Generating.../i)).not.toBeInTheDocument();
    expect(enabledGenerateButton).not.toBeDisabled();
    
    expect(mockGenerateScriptHeaderAndHelpers).toHaveBeenCalledTimes(1);
    // Only one option was selected.
    expect(mockGenerateScriptSection).toHaveBeenCalledTimes(1);
    expect(mockGenerateScriptFooter).toHaveBeenCalledTimes(1);
  });

  it('should switch to the advanced tab and handle the analysis flow', async () => {
    const analysisResult: AnalysisResult = {
      analysisText: 'Analysis complete.',
      securityScore: 88,
    };
    mockAnalyzeScriptOutput.mockResolvedValue(analysisResult);
    render(<App />);

    const advancedTabButton = screen.getByRole('button', { name: /Advanced/i });
    fireEvent.click(advancedTabButton);

    const textarea = screen.getByLabelText(/Paste Script Output Here/i);
    expect(textarea).toBeInTheDocument();
    
    const analyzeActionButton = screen.getByRole('button', { name: /Analyze Output/i });
    expect(analyzeActionButton).toBeDefined();

    const scriptOutput = 'SUCCESS: Firewall configured.';
    fireEvent.change(textarea, { target: { value: scriptOutput } });
    fireEvent.click(analyzeActionButton!);

    // Check for loading state
    expect(await screen.findByText(/Analyzing.../i)).toBeInTheDocument();
    expect(analyzeActionButton).toBeDisabled();

    // Wait for results to be displayed
    expect(await screen.findByText(/Hardening Score/i)).toBeInTheDocument();
    expect(screen.getByText(/88%/i)).toBeInTheDocument();
    expect(screen.getByText(analysisResult.analysisText)).toBeInTheDocument();

    expect(mockAnalyzeScriptOutput).toHaveBeenCalledWith(scriptOutput);
  });
  
  // FIX: This test no longer mocks `generateHardenScript` and instead uses the default
  // multi-step generation mocks to provide the initial script for the improvement flow.
  it('should switch to the shellcheck tab and handle the automated improvement flow', async () => {
    const initialScriptHeader = '#!/bin/bash\n# Header\n';
    // Fix: Add the missing `improvementSummary` property to the mock `ImprovementResult`
    // to satisfy the type definition and prevent a TypeScript error.
    const improvementResult: ImprovementResult = {
        correctedScript: '#!/bin/bash\necho "corrected script"',
        refinedPrompts: [{ id: 'ssh', newPrompt: 'Improved SSH prompt' }],
        improvementSummary: ['Used `[[ ... ]]` instead of `[ ... ]` for modern syntax.'],
    };
    mockRunShellcheckAndLearn.mockResolvedValue(improvementResult);
    
    render(<App />);
    
    // 1. Select an option and generate an initial script
    const optionToSelect = screen.getByLabelText(PARANOIA_LEVELS[0].options[2].label); // SSH Hardening
    fireEvent.click(optionToSelect);
    const generateButton = await screen.findByRole('button', { name: /Generate Hardening Script/i });
    fireEvent.click(generateButton);
    await screen.findByText(new RegExp(initialScriptHeader));
    
    // 2. Switch to the ShellCheck tab
    const shellcheckTab = screen.getByRole('button', { name: /ShellCheck/i });
    fireEvent.click(shellcheckTab);
    
    // 3. Verify the initial script is displayed
    const originalScriptDisplay = document.getElementById('original-script-display');
    expect(originalScriptDisplay).toHaveTextContent(initialScriptHeader);
    const improveButton = screen.getByRole('button', { name: /Run ShellCheck & Improve/i });
    expect(improveButton).not.toBeDisabled();

    // 4. Run the automated improvement
    fireEvent.click(improveButton);
    
    // Check loading state
    expect(await screen.findByText(/Analyzing & Refining.../i)).toBeInTheDocument();
    expect(improveButton).toBeDisabled();
    
    // 5. Wait for the corrected script to appear
    expect(await screen.findByText(improvementResult.correctedScript)).toBeInTheDocument();
    expect(mockRunShellcheckAndLearn).toHaveBeenCalledWith(expect.any(String), expect.any(Array));

    // 6. Check for success message and that loading is done
    expect(await screen.findByText(/Script refined and AI prompts have been improved/i)).toBeInTheDocument();
    expect(improveButton).not.toBeDisabled();
    
    // 7. Switch back to Generate tab and check for the "Improved" badge
    const generateTab = screen.getByRole('button', { name: /Generate Script/i });
    fireEvent.click(generateTab);
    expect(await screen.findByText('✨ Improved')).toBeInTheDocument();
  });
});