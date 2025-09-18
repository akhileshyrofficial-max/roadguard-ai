import React from 'react';
import { Spinner } from './Spinner';
import { EditIcon } from './IconComponents';

interface AiEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (prompt: string) => void;
  isLoading: boolean;
  originalImageUrl: string;
}

export const AiEditModal: React.FC<AiEditModalProps> = ({ isOpen, onClose, onSubmit, isLoading, originalImageUrl }) => {
  const [prompt, setPrompt] = React.useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (prompt.trim()) {
      onSubmit(prompt);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true">
      <div className="bg-slate-800 border border-slate-700 rounded-lg shadow-xl w-full max-w-lg p-6 relative animate-fade-in">
        <button onClick={onClose} disabled={isLoading} className="absolute top-3 right-3 text-slate-500 hover:text-slate-300 transition-colors disabled:opacity-50">&times;</button>
        <h3 className="text-xl font-bold text-cyan-400 mb-4 flex items-center gap-2"><EditIcon className="w-6 h-6"/> AI Image Edit</h3>
        
        <div className="flex gap-4 mb-4">
            <img src={originalImageUrl} alt="Original to be edited" className="w-24 h-24 object-cover rounded-md border-2 border-slate-600"/>
            <p className="text-slate-400 text-sm">Describe how you want the AI to edit this image. For example: "Repair the large pothole in the center," or "Add safety cones around the cracks."</p>
        </div>

        <form onSubmit={handleSubmit}>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="e.g., Repair the pothole"
            disabled={isLoading}
            className="w-full h-20 p-2 bg-slate-700 border border-slate-600 rounded-md text-slate-200 focus:ring-2 focus:ring-cyan-500"
            required
          />
          <div className="mt-4 flex justify-end gap-4">
            <button type="button" onClick={onClose} disabled={isLoading} className="px-4 py-2 bg-slate-600 hover:bg-slate-500 font-semibold rounded-md disabled:opacity-50">
              Cancel
            </button>
            <button type="submit" disabled={isLoading || !prompt.trim()} className="px-6 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-md flex items-center gap-2 disabled:bg-slate-500 disabled:cursor-not-allowed">
              {isLoading ? <Spinner size="sm" /> : <EditIcon className="w-5 h-5"/>}
              {isLoading ? 'Generating...' : 'Generate Edit'}
            </button>
          </div>
        </form>
      </div>
      <style>{`
        @keyframes fade-in {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        .animate-fade-in {
          animation: fade-in 0.2s ease-out forwards;
        }
      `}</style>
    </div>
  );
};
