import React from 'react';
import type { ResearchResult } from '../types';
import { WebSearchIcon, LinkIcon } from './IconComponents';

interface ResearchAnalysisDisplayProps {
    analysis: ResearchResult;
}

export const ResearchAnalysisDisplay: React.FC<ResearchAnalysisDisplayProps> = ({ analysis }) => {
    // A simple function to format the answer text
    const formatAnswer = (text: string) => {
        return text.split('\n').map((paragraph, index) => (
            <p key={index} className="mb-4 last:mb-0 text-slate-300">
                {paragraph}
            </p>
        ));
    };

    return (
        <div className="mt-8 space-y-8">
            <div>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4 border-b-2 border-slate-700 pb-2">
                    <div className="flex items-center gap-3">
                        <WebSearchIcon className="w-7 h-7 text-purple-400"/>
                        <h3 className="text-2xl font-bold text-purple-400">Research Results</h3>
                    </div>
                </div>
                <div className="p-6 bg-slate-800/60 rounded-lg border border-slate-700">
                    {formatAnswer(analysis.answer)}
                </div>
            </div>
            
            {analysis.sources && analysis.sources.length > 0 && (
                 <div>
                    <h4 className="text-xl font-bold text-slate-200 mb-3">Sources from the web</h4>
                    <ul className="space-y-3">
                        {/* FIX: Only render sources that have a web uri to avoid non-functional links */}
                        {analysis.sources.map((source, index) => source.web?.uri && (
                            <li key={index} className="bg-slate-800 p-3 rounded-lg border border-slate-700 hover:bg-slate-700/50 transition-colors">
                                <a
                                    href={source.web.uri}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-start gap-3 text-cyan-400 hover:text-cyan-300"
                                >
                                    <LinkIcon className="w-4 h-4 mt-1 flex-shrink-0" />
                                    <div className="flex-grow">
                                        <span className="font-semibold">{source.web.title}</span>
                                        <span className="block text-xs text-slate-500 truncate">{source.web.uri}</span>
                                    </div>
                                </a>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
};