
import React from 'react';
import { useState, useEffect } from 'react';
import DancingDuck from './DancingDuck';

interface ScriptDisplayProps {
  script: string;
  isLoading: boolean;
  error: string | null;
  loadingMessage: string;
  currentStep?: number;
  totalSteps?: number;
  placeholder?: React.ReactNode;
  isRebootRecommended?: boolean;
}

const ScriptDisplay: React.FC<ScriptDisplayProps> = ({ script, isLoading, error, loadingMessage, placeholder, currentStep = 0, totalSteps = 0, isRebootRecommended = false }) => {
  const [copyButtonText, setCopyButtonText] = useState('Copy');

  useEffect(() => {
    if (copyButtonText === 'Copied!') {
      const timer = setTimeout(() => setCopyButtonText('Copy'), 2000);
      return () => clearTimeout(timer);
    }
  }, [copyButtonText]);

  const handleCopy = () => {
    if (script) {
      navigator.clipboard.writeText(script);
      setCopyButtonText('Copied!');
    }
  };
  
  const handleDownload = () => {
    if (!script) return;
    const blob = new Blob([script], { type: 'text/bash' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'fedora_hardening.sh';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };


  const renderContent = () => {
    if (isLoading) {
      const progress = totalSteps > 0 ? (currentStep / totalSteps) * 100 : 0;
      return (
        <div className="flex flex-col items-center justify-center h-full p-8 text-gray-400">
          <DancingDuck />
          <div className="w-full bg-gray-700 rounded-full h-2.5 my-4">
            <div
              className="bg-blue-600 h-2.5 rounded-full transition-all duration-300 ease-linear"
              style={{ width: `${progress}%` }}
              role="progressbar"
              aria-valuenow={currentStep}
              aria-valuemin={0}
              aria-valuemax={totalSteps}
            ></div>
          </div>
          <p className="text-sm font-semibold text-center whitespace-pre-line">{loadingMessage}</p>
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

    if (!script) {
      if (placeholder) {
        return <>{placeholder}</>;
      }
      return (
        <div className="flex flex-col items-center justify-center h-full p-8 text-gray-400">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mb-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2-2z" />
            </svg>
            <h3 className="text-lg font-semibold">Your script will appear here</h3>
            <p className="text-center">The generated or corrected script will be displayed in this panel.</p>
        </div>
      );
    }

    return (
      <pre className="h-full w-full whitespace-pre-wrap break-words">
        <code className="language-bash font-mono text-sm">{script}</code>
      </pre>
    );
  };

  return (
    <div className="relative h-full min-h-[400px] lg:min-h-0 bg-gray-800 rounded-lg border border-gray-700 flex flex-col">
      {script && !isLoading && !error && (
        <div className="absolute top-2 right-2 z-10 flex gap-2">
          <button
            onClick={handleDownload}
            className="px-3 py-1.5 text-xs font-medium text-gray-200 bg-gray-700 rounded-md hover:bg-gray-600 transition-colors"
            title="Download as fedora_hardening.sh"
          >
            Download
          </button>
          <button
            onClick={handleCopy}
            className="px-3 py-1.5 text-xs font-medium text-gray-200 bg-gray-700 rounded-md hover:bg-gray-600 transition-colors"
          >
            {copyButtonText}
          </button>
        </div>
      )}
      <div className="flex-grow p-4 overflow-auto">
        {renderContent()}
      </div>
       {script && !isLoading && !error && isRebootRecommended && (
        <div className="border-t border-yellow-500/30 bg-yellow-500/10 p-3 text-sm text-yellow-200 flex items-start gap-3">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mt-0.5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            <div>
                <strong className="font-semibold">Reboot Recommended</strong>
                <p className="text-yellow-300/80">Some selected changes (e.g., kernel, SELinux, GRUB) require a system reboot to be fully applied.</p>
            </div>
        </div>
      )}
    </div>
  );
};

export default ScriptDisplay;
