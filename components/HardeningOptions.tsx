
import React from 'react';
import type { SelectedOptions, HardeningOption } from '../types';

interface HardeningOptionsProps {
  title: string;
  description:string;
  options: HardeningOption[];
  selectedOptions: SelectedOptions;
  onOptionChange: (id: string) => void;
  improvedPromptIds: Set<string>;
}

const HardeningOptionItem: React.FC<{
  option: HardeningOption;
  selectedOptions: SelectedOptions;
  onOptionChange: (id: string) => void;
  improvedPromptIds: Set<string>;
}> = ({ option, selectedOptions, onOptionChange, improvedPromptIds }) => {
  return (
    <div>
      <div className="flex items-start">
        <div className="flex items-center h-5">
          <input
            id={option.id}
            name={option.id}
            type="checkbox"
            checked={selectedOptions[option.id] || false}
            onChange={() => onOptionChange(option.id)}
            className="focus:ring-blue-500 h-4 w-4 text-blue-600 bg-gray-700 border-gray-600 rounded"
          />
        </div>
        <div className="ml-3 text-sm">
          <label htmlFor={option.id} className="font-medium text-gray-200 cursor-pointer flex items-center gap-2">
            {option.label}
            {improvedPromptIds.has(option.id) && (
              <span className="text-xs bg-green-500/20 text-green-300 px-2 py-0.5 rounded-full" title="This prompt has been improved based on your feedback.">
                ✨ Improved
              </span>
            )}
          </label>
          <p className="text-gray-400">{option.description}</p>
        </div>
      </div>
      {option.subOptions && (
        <div className="ml-5 pl-4 border-l border-gray-700 mt-3 space-y-3">
          {option.subOptions.map(subOpt => (
            <HardeningOptionItem
              key={subOpt.id}
              option={subOpt}
              selectedOptions={selectedOptions}
              onOptionChange={onOptionChange}
              improvedPromptIds={improvedPromptIds}
            />
          ))}
        </div>
      )}
    </div>
  );
};


const HardeningOptions: React.FC<HardeningOptionsProps> = ({ title, description, options, selectedOptions, onOptionChange, improvedPromptIds }) => {
  return (
    <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
      <h2 className="text-lg font-semibold mb-1 text-gray-100">{title}</h2>
      <p className="text-sm text-gray-400 mb-4">{description}</p>
      <div className="space-y-3">
        {options.map((option) => (
          <HardeningOptionItem
            key={option.id}
            option={option}
            selectedOptions={selectedOptions}
            onOptionChange={onOptionChange}
            improvedPromptIds={improvedPromptIds}
          />
        ))}
      </div>
    </div>
  );
};

export default HardeningOptions;
