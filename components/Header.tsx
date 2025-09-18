
import React from 'react';
import { RoadIcon } from './IconComponents';

export const Header: React.FC = () => {
  return (
    <header className="bg-slate-900/80 backdrop-blur-sm border-b border-slate-700 sticky top-0 z-50">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-center">
          <RoadIcon className="w-8 h-8 text-cyan-400 mr-3" />
          <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
            RoadGuard <span className="text-cyan-400">AI</span>
          </h1>
        </div>
        <p className="text-center text-slate-400 mt-1">Pothole & Defect Analysis</p>
      </div>
    </header>
  );
};
