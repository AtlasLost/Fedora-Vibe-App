import React from 'react';

const DancingDuck: React.FC = () => {
  return (
    <div className="w-24 h-24" aria-label="Animated duck waiting for script generation">
      {/* 
        This image is the animated GIF provided by the user in the prompt.
        Using a hosted version for display.
      */}
      <img 
        src="https://media.tenor.com/c-S8cUwVVVEAAAAM/duck-dance.gif" 
        alt="An animated white duck dancing energetically from side to side." 
        className="w-full h-full object-contain"
      />
    </div>
  );
};

export default DancingDuck;
