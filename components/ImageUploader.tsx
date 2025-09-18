import React, { useRef } from 'react';
import { UploadIcon, CameraIcon, SatelliteIcon, VideoIcon, MapIcon } from './IconComponents';

interface ImageUploaderProps {
  onImageUpload: (file: File) => void;
  onUseCamera: () => void;
  onUseSatellite: () => void;
  onUseRealTime: () => void;
  onUseVideoAnalysis: () => void;
  onOpenGisDashboard: () => void;
  hasSessionData: boolean;
  disabled: boolean;
  // FIX: Add isOnline to the props interface to match its usage in App.tsx
  isOnline: boolean;
}

export const ImageUploader: React.FC<ImageUploaderProps> = ({ onImageUpload, onUseCamera, onUseSatellite, onUseRealTime, onUseVideoAnalysis, onOpenGisDashboard, hasSessionData, disabled }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onImageUpload(file);
    }
  };

  const handleClick = () => {
    if (!disabled) {
        fileInputRef.current?.click();
    }
  };

  return (
    <>
      <div
        onClick={handleClick}
        className={`relative block w-full rounded-lg border-2 border-dashed border-slate-600 p-8 text-center transition-colors duration-300 ${disabled ? 'cursor-not-allowed bg-slate-700/50 opacity-60' : 'cursor-pointer bg-slate-800 hover:border-cyan-500'}`}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          className="hidden"
          accept="image/png, image/jpeg, image/webp"
          disabled={disabled}
        />
        <div className="flex flex-col items-center">
          <UploadIcon className="mx-auto h-12 w-12 text-slate-500" />
          <span className="mt-2 block text-sm font-semibold text-slate-300">
            Click to upload or drag and drop
          </span>
          <span className="mt-1 block text-xs text-slate-500">
            PNG, JPG, WEBP up to 10MB
          </span>
        </div>
      </div>
      
      <div className="my-4 flex items-center justify-center">
        <span className="h-px bg-slate-600 flex-grow"></span>
        <span className="px-3 text-slate-500 font-semibold text-sm">OR USE</span>
        <span className="h-px bg-slate-600 flex-grow"></span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <button
          onClick={onUseCamera}
          disabled={disabled}
          className="inline-flex w-full items-center justify-center gap-2 px-6 py-3 bg-slate-700 hover:bg-slate-600 text-slate-200 font-semibold rounded-lg shadow-md transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <CameraIcon className="w-5 h-5" />
          Take Picture
        </button>
         <button
          onClick={onUseRealTime}
          disabled={disabled}
          className="inline-flex w-full items-center justify-center gap-2 px-6 py-3 bg-rose-700 hover:bg-rose-600 text-rose-100 font-semibold rounded-lg shadow-md transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <VideoIcon className="w-5 h-5" />
          Real-Time Detection
        </button>
         <button
          onClick={onUseVideoAnalysis}
          disabled={disabled}
          className="inline-flex w-full items-center justify-center gap-2 px-6 py-3 bg-fuchsia-700 hover:bg-fuchsia-600 text-fuchsia-100 font-semibold rounded-lg shadow-md transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <VideoIcon className="w-5 h-5" />
          Analyze Uploaded Video
        </button>
        <button
          onClick={onUseSatellite}
          disabled={disabled}
          className="inline-flex w-full items-center justify-center gap-2 px-6 py-3 bg-indigo-700 hover:bg-indigo-600 text-indigo-100 font-semibold rounded-lg shadow-md transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <SatelliteIcon className="w-5 h-5" />
          Satellite Analysis
        </button>
      </div>
      {hasSessionData && (
        <div className="mt-4 pt-4 border-t-2 border-slate-700">
            <button
                onClick={onOpenGisDashboard}
                disabled={disabled}
                className="inline-flex w-full items-center justify-center gap-2 px-6 py-3 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-lg shadow-lg transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
            >
                <MapIcon className="w-5 h-5" />
                View Session GIS Dashboard
            </button>
        </div>
      )}
    </>
  );
};