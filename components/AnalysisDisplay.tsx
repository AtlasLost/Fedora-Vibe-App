import React, { useState, useEffect } from 'react';
import type { AnalysisResult } from '../types';

interface AnalysisDisplayProps {
  result: AnalysisResult | null;
  isLoading: boolean;
  error: string | null;
}

const ANALYSIS_MESSAGES = [
  "Parsing script output log...",
  "Cross-referencing with security benchmarks...",
  "Identifying potential warnings and errors...",
  "Calculating security score...",
  "Formulating actionable recommendations...",
  "Compiling the final analysis report...",
];


const ScoreIndicator: React.FC<{ score: number }> = ({ score }) => {
    const getScoreColor = (s: number) => {
        if (s < 50) return 'bg-red-600';
        if (s < 80) return 'bg-yellow-500';
        return 'bg-green-500';
    };

    const colorClass = getScoreColor(score);

    return (
        <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-200 mb-2">Hardening Score</h3>
            <div className="w-full bg-gray-700 rounded-full h-6" title={`Hardening Score: ${score}%`}>
                <div
                    className={`h-6 rounded-full ${colorClass} transition-all duration-1000 ease-out flex items-center justify-center text-white font-bold text-sm`}
                    style={{ width: `${score}%` }}
                    role="progressbar"
                    aria-valuenow={score}
                    aria-valuemin={0}
                    aria-valuemax={100}
                >
                   {score > 10 ? `${score}%` : ''}
                </div>
            </div>
            <p className="text-sm text-gray-400 mt-2">
                This score represents an AI-driven assessment of your system's security posture based on the script's output.
            </p>
        </div>
    );
};


const AnalysisDisplay: React.FC<AnalysisDisplayProps> = ({ result, isLoading, error }) => {
  const [loadingMessage, setLoadingMessage] = useState(ANALYSIS_MESSAGES[0]);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let messageInterval: ReturnType<typeof setInterval> | undefined;
    let progressInterval: ReturnType<typeof setInterval> | undefined;

    if (isLoading) {
      setLoadingMessage(ANALYSIS_MESSAGES[0]);
      setProgress(0);
      let messageIndex = 0;
      
      messageInterval = setInterval(() => {
        messageIndex = (messageIndex + 1) % ANALYSIS_MESSAGES.length;
        setLoadingMessage(ANALYSIS_MESSAGES[messageIndex]);
      }, 2200);

      progressInterval = setInterval(() => {
        setProgress(prev => Math.min(prev + Math.random() * 15, 95));
      }, 800);

    } else {
        setProgress(result ? 100 : 0);
    }
    
    return () => {
      clearInterval(messageInterval);
      clearInterval(progressInterval);
    };
  }, [isLoading, result]);

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex flex-col items-center justify-center h-full p-8 text-gray-400">
          <div className="w-full bg-gray-700 rounded-full h-2.5 mb-4">
            <div
              className="bg-blue-600 h-2.5 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
              role="progressbar"
              aria-valuenow={progress}
              aria-valuemin={0}
              aria-valuemax={100}
            ></div>
          </div>
          <p className="text-lg font-semibold">Analyzing your script output...</p>
          <p className="text-sm text-center mt-2 h-4 transition-opacity duration-500 ease-in-out">{loadingMessage}</p>
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex items-center justify-center h-full p-8 text-red-400">
          <div className="text-center">
            <h3 className="text-xl font-bold mb-2">An Error Occurred</h3>
            <p>{error}</p>
          </div>
        </div>
      );
    }

    if (!result) {
      return (
        <div className="flex flex-col items-center justify-center h-full p-8 text-gray-400">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mb-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
          <h3 className="text-lg font-semibold">Analysis will appear here</h3>
          <p className="text-center">Paste your script output above and click "Analyze Output".</p>
        </div>
      );
    }

    return (
      <div>
        <ScoreIndicator score={result.securityScore} />
        <h3 className="text-lg font-semibold text-gray-200 mb-2 border-t border-gray-700 pt-4">Detailed Analysis</h3>
        <pre className="w-full whitespace-pre-wrap break-words font-sans text-sm leading-relaxed">
            {result.analysisText}
        </pre>
      </div>
    );
  };

  return (
    <div role="log" aria-live="polite" className="relative h-full min-h-[400px] bg-gray-800 rounded-lg border border-gray-700 flex flex-col">
      <div className="flex-grow p-6 overflow-auto">
        {renderContent()}
      </div>
    </div>
  );
};

export default AnalysisDisplay;
