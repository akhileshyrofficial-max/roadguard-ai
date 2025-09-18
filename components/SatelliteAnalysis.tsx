import React, { useState } from 'react';
import { Spinner } from './Spinner';
import { SatelliteIcon, BackIcon } from './IconComponents';

interface SatelliteAnalysisProps {
  onAnalyze: (location: string) => Promise<void>;
  onCancel: () => void;
  isOnline: boolean;
}

export const SatelliteAnalysis: React.FC<SatelliteAnalysisProps> = ({ onAnalyze, onCancel, isOnline }) => {
  const [location, setLocation] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!location.trim() || isAnalyzing || !isOnline) return;

    setIsAnalyzing(true);
    await onAnalyze(location);
    setIsAnalyzing(false);
  };

  return (
    <div className="p-6 md:p-8">
      <h2 className="text-2xl md:text-3xl font-bold text-center text-indigo-400 mb-2">
        Satellite Signature Analysis
      </h2>
      <p className="text-center text-slate-400 text-sm mb-6">
        Enter a location for an advanced pavement assessment using simulated satellite data (PS-InSAR, SAR, TIR).
      </p>
      
      <form onSubmit={handleSubmit}>
        <div className="flex flex-col gap-4">
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="e.g., '1600 Amphitheatre Parkway, Mountain View, CA' or '40.7128, -74.0060'"
            disabled={isAnalyzing || !isOnline}
            className="w-full px-4 py-3 bg-slate-900/50 border-2 border-slate-600 rounded-lg text-slate-100 placeholder-slate-500 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors disabled:opacity-70"
            required
          />
           {!isOnline && <p className="text-center text-yellow-400 text-sm -mt-2">You are offline. Connection is required to initiate a scan.</p>}
          <div className="mt-2 flex flex-col sm:flex-row-reverse justify-center gap-4">
            <button
              type="submit"
              disabled={isAnalyzing || !location.trim() || !isOnline}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg shadow-lg transition-all duration-300 transform hover:scale-105 disabled:bg-slate-600 disabled:cursor-not-allowed"
            >
              {isAnalyzing ? <Spinner /> : <SatelliteIcon className="w-5 h-5" />}
              {isAnalyzing ? 'Analyzing...' : 'Initiate Scan'}
            </button>
            <button
              type="button"
              onClick={onCancel}
              disabled={isAnalyzing}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3 bg-slate-600 hover:bg-slate-500 text-white font-bold rounded-lg shadow-lg transition-all duration-300 transform hover:scale-105 disabled:opacity-50"
            >
              <BackIcon className="w-5 h-5" />
              Back
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};