import React from 'react';

export const OfflineBanner: React.FC = () => {
    return (
        <div 
            className="fixed bottom-0 left-0 right-0 bg-yellow-600 text-slate-900 text-center p-2 z-50 text-sm font-semibold shadow-lg"
            role="status"
            aria-live="polite"
        >
            You are currently offline. An internet connection is required for AI analysis.
        </div>
    );
};
