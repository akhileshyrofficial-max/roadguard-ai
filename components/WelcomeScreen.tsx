
import React from 'react';
import { RoadIcon } from './IconComponents';

export const WelcomeScreen: React.FC = () => {
    return (
        <div className="text-center py-10 px-6 bg-slate-800/50 rounded-lg border border-slate-700 mt-6">
            <RoadIcon className="w-16 h-16 mx-auto text-cyan-500" />
            <h3 className="mt-4 text-2xl font-bold text-slate-100">Welcome to RoadGuard AI</h3>
            <p className="mt-2 text-slate-400 max-w-prose mx-auto">
                Begin by uploading an image of a road surface. Our AI will analyze it to detect potholes, cracks, and other distresses, providing a detailed report with dimensions and severity.
            </p>
        </div>
    );
};
