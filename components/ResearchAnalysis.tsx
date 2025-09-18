import React, { useState } from 'react';
import { Spinner } from './Spinner';
import { WebSearchIcon, BackIcon } from './IconComponents';

interface ResearchAnalysisProps {
  onAnalyze: (query: string) => Promise<void>;
  onCancel: () => void;
  isOnline: boolean;
}

export const ResearchAnalysis: React.FC<ResearchAnalysisProps> = ({ onAnalyze, onCancel, isOnline }) => {
  const [query, setQuery] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || isAnalyzing || !isOnline) return;

    setIsAnalyzing(true);
    await onAnalyze(query);
    // Let App.tsx handle setting isAnalyzing to false
  };

  return (
    <div className="p-6 md:p-8">
      <h2 className="text-2xl md:text-3xl font-bold text-center text-purple-400 mb-2">
        AI-Powered Research
      </h2>
      <p className="text-center text-slate-400 text-sm mb-6">
        Ask a question to get a comprehensive answer sourced from the web.
      </p>
      
      <form onSubmit={handleSubmit}>
        <div className="flex flex-col gap-4">
          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g., 'What are the latest innovations in durable road materials?'"
            disabled={isAnalyzing || !isOnline}
            className="w-full px-4 py-3 bg-slate-900/50 border-2 border-slate-600 rounded-lg text-slate-100 placeholder-slate-500 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors resize-none disabled:opacity-70"
            rows={3}
            required
          />
          {!isOnline && <p className="text-center text-yellow-400 text-sm -mt-2">You are offline. An internet connection is required for research.</p>}
          <div className="mt-2 flex flex-col sm:flex-row-reverse justify-center gap-4">
            <button
              type="submit"
              disabled={isAnalyzing || !query.trim() || !isOnline}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-lg shadow-lg transition-all duration-300 transform hover:scale-105 disabled:bg-slate-600 disabled:cursor-not-allowed"
            >
              {isAnalyzing ? <Spinner /> : <WebSearchIcon className="w-5 h-5" />}
              {isAnalyzing ? 'Researching...' : 'Ask AI'}
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