import React from 'react';
import type { AreaHealthAssessment } from '../types';
import { HeartPulseIcon, InfoIcon, LightbulbIcon, WrenchIcon } from './IconComponents';

interface AreaHealthDisplayProps {
    assessment: AreaHealthAssessment;
}

const PCIGauge: React.FC<{ score: number }> = ({ score }) => {
    const getPciInfo = (s: number) => {
        if (s > 85) return { label: 'Excellent', color: 'text-green-400', stroke: '#4ade80' };
        if (s > 70) return { label: 'Very Good', color: 'text-lime-400', stroke: '#a3e635' };
        if (s > 55) return { label: 'Good', color: 'text-yellow-400', stroke: '#facc15' };
        if (s > 40) return { label: 'Fair', color: 'text-orange-400', stroke: '#fb923c' };
        if (s > 25) return { label: 'Poor', color: 'text-red-400', stroke: '#f87171' };
        if (s > 10) return { label: 'Very Poor', color: 'text-red-500', stroke: '#ef4444' };
        return { label: 'Failed', color: 'text-rose-600', stroke: '#e11d48' };
    };

    const { label, color, stroke } = getPciInfo(score);
    const circumference = 2 * Math.PI * 45; // r=45
    const arcLength = (score / 100) * circumference;
    const rotation = -90;

    return (
        <div className="relative flex flex-col items-center justify-center w-48 h-48 mx-auto">
            <svg className="w-full h-full" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="45" fill="none" strokeWidth="10" className="text-slate-700" />
                <circle
                    cx="50"
                    cy="50"
                    r="45"
                    fill="none"
                    strokeWidth="10"
                    stroke={stroke}
                    strokeLinecap="round"
                    strokeDasharray={`${arcLength} ${circumference}`}
                    transform={`rotate(${rotation} 50 50)`}
                    className="transition-all duration-1000 ease-out"
                />
            </svg>
            <div className="absolute flex flex-col items-center">
                <span className={`text-4xl font-bold ${color}`}>{score.toFixed(0)}</span>
                <span className="text-sm font-semibold text-slate-300">PCI Score</span>
                <span className={`text-xs font-bold ${color}`}>{label}</span>
            </div>
        </div>
    );
};

const InfoSection: React.FC<{ icon: React.ReactNode; title: string; children: React.ReactNode; }> = ({ icon, title, children }) => (
    <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
        <div className="flex items-center gap-3 mb-3">
            {icon}
            <h4 className="text-lg font-bold text-slate-200">{title}</h4>
        </div>
        <div className="text-slate-300 text-sm pl-8 space-y-2">
            {children}
        </div>
    </div>
);


export const AreaHealthDisplay: React.FC<AreaHealthDisplayProps> = ({ assessment }) => {
    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-4 border-b-2 border-slate-700 pb-2">
                <div className="flex items-center gap-3">
                    <HeartPulseIcon className="w-7 h-7 text-green-400" />
                    <h3 className="text-2xl font-bold text-green-400">Area Health Assessment</h3>
                </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center bg-slate-800 p-4 rounded-lg border border-slate-700">
                <div className="md:col-span-1">
                    <PCIGauge score={assessment.pciScore} />
                </div>
                <div className="md:col-span-2">
                    <InfoSection icon={<InfoIcon className="w-5 h-5 text-cyan-400"/>} title="Assessment Summary">
                        <p>{assessment.summary}</p>
                    </InfoSection>
                </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <InfoSection icon={<LightbulbIcon className="w-5 h-5 text-yellow-400" />} title="Potential Causes">
                    <ul className="list-disc list-inside">
                        {assessment.potentialCauses.map((cause, i) => <li key={i}>{cause}</li>)}
                    </ul>
                </InfoSection>
                <InfoSection icon={<WrenchIcon className="w-5 h-5 text-orange-400" />} title="Recommendations">
                     <ul className="list-disc list-inside">
                        {assessment.recommendations.map((rec, i) => <li key={i}>{rec}</li>)}
                    </ul>
                </InfoSection>
            </div>
        </div>
    );
};