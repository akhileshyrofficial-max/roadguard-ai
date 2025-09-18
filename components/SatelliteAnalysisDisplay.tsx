import React from 'react';
import type { SatelliteAnalysisResult } from '../types';
import { SatelliteIcon, TrendingDownIcon, ShieldAlertIcon, DropletsIcon } from './IconComponents';

interface SatelliteAnalysisDisplayProps {
    analysis: SatelliteAnalysisResult;
}

const MetricCard: React.FC<{ icon: React.ReactNode, title: string, value: string, description: string, colorClass: string }> = ({ icon, title, value, description, colorClass }) => (
    <div className="bg-slate-800/70 p-4 rounded-lg border border-slate-700 flex flex-col justify-between">
        <div>
            <div className="flex items-center space-x-3 mb-2">
                <div className={`p-2 rounded-full ${colorClass.replace('text-', 'bg-')}/20`}>
                    {icon}
                </div>
                <p className="text-md font-semibold text-slate-300">{title}</p>
            </div>
            <p className={`text-3xl font-bold ${colorClass}`}>{value}</p>
        </div>
        <p className="text-xs text-slate-400 mt-2">{description}</p>
    </div>
);

export const SatelliteAnalysisDisplay: React.FC<SatelliteAnalysisDisplayProps> = ({ analysis }) => {
    const riskStyles = {
        Low: { text: 'text-green-400', icon: <DropletsIcon className="w-6 h-6 text-green-400"/> },
        Medium: { text: 'text-yellow-400', icon: <DropletsIcon className="w-6 h-6 text-yellow-400"/> },
        High: { text: 'text-red-400', icon: <DropletsIcon className="w-6 h-6 text-red-400"/> },
    };
    const riskInfo = riskStyles[analysis.subsurfaceMoistureRisk] || riskStyles['Medium'];

    return (
        <div className="mt-8 space-y-8">
            <div>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4 border-b-2 border-slate-700 pb-2">
                    <div className="flex items-center gap-3">
                        <SatelliteIcon className="w-7 h-7 text-indigo-400"/>
                        <h3 className="text-2xl font-bold text-indigo-400">Satellite Analysis Results</h3>
                    </div>
                </div>
                <div className="p-4 bg-slate-800 rounded-lg border border-slate-700 mb-6">
                    <p className="font-semibold text-slate-300 mb-1">Analysis for: <span className="font-normal text-slate-400">{analysis.location_analyzed}</span></p>
                    <p className="text-slate-300 text-sm"><span className="font-semibold">Assessment Summary:</span> {analysis.assessmentSummary}</p>
                </div>
            </div>

            <div>
                <h4 className="text-xl font-bold text-slate-200 mb-3">Core Metrics</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <MetricCard 
                        icon={<TrendingDownIcon className="w-6 h-6 text-orange-400"/>}
                        title="Slab Settlement"
                        value={`${analysis.slabSettlement_mm_yr.toFixed(2)} mm/yr`}
                        description="Annual rate of pavement settling or warping. Negative values indicate subsidence."
                        colorClass="text-orange-400"
                    />
                     <MetricCard 
                        icon={<ShieldAlertIcon className="w-6 h-6 text-yellow-400"/>}
                        title="Deterioration Index"
                        value={`${analysis.deteriorationIndex.toFixed(1)} / 10.0`}
                        description="Overall pavement distress level. Higher values indicate more severe deterioration."
                        colorClass="text-yellow-400"
                    />
                    <MetricCard 
                        icon={riskInfo.icon}
                        title="Subsurface Moisture Risk"
                        value={analysis.subsurfaceMoistureRisk}
                        description="Likelihood of damaging moisture beneath pavement slabs."
                        colorClass={riskInfo.text}
                    />
                </div>
            </div>
        </div>
    );
};