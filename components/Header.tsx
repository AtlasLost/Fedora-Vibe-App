
import React from 'react';

const Header: React.FC = () => {
  return (
    <header className="bg-gray-800/50 backdrop-blur-sm border-b border-gray-700 p-4 sticky top-0 z-10">
      <div className="container mx-auto text-center">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-100">
          Fedora Hardening Script Generator
        </h1>
        <p className="text-sm md:text-base text-gray-400 mt-1">
          Generate a security script for your Fedora system using AI
        </p>
      </div>
    </header>
  );
};

export default Header;
