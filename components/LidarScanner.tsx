
import React, { useRef, useEffect, useState } from 'react';
import { Spinner } from './Spinner';
import { LidarIcon, BackIcon } from './IconComponents';

interface LidarScannerProps {
  onCapture: (file: File, scanType: 'lidar') => void;
  onCancel: () => void;
}

export const LidarScanner: React.FC<LidarScannerProps> = ({ onCapture, onCancel }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isScanning, setIsScanning] = useState(false);

  useEffect(() => {
    let mediaStream: MediaStream | undefined;
    const enableStream = async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
            throw new Error("Camera API is not supported in this browser.");
        }
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        });
        setStream(mediaStream);
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
      } catch (err) {
        console.error("Error accessing camera for LIDAR:", err);
        let message = "Could not access the camera. Please check permissions.";
        if (err instanceof Error && err.name === "NotAllowedError") {
            message = "Camera access was denied. Please grant permission in your browser settings.";
        }
        setError(message);
      } finally {
        setIsLoading(false);
      }
    };

    enableStream();

    return () => {
      if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const handleCapture = () => {
    if (videoRef.current && canvasRef.current && stream) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      
      if (context) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
        
        canvas.toBlob(blob => {
          if (blob) {
            const file = new File([blob], `lidar-capture-${Date.now()}.jpg`, { type: 'image/jpeg' });
            onCapture(file, 'lidar');
          }
        }, 'image/jpeg', 0.95);
      }
    }
  };
  
  const toggleScan = () => {
    if(isScanning) {
        setIsScanning(false);
        handleCapture();
    } else {
        setIsScanning(true);
    }
  };

  return (
    <div className="p-6 md:p-8">
      <h2 className="text-2xl md:text-3xl font-bold text-center text-cyan-400 mb-2">
        LIDAR Depth Scan
      </h2>
      <p className="text-center text-slate-400 text-sm mb-4">
        {isScanning ? "Move your device slowly over the defect." : "Point camera at the defect and start scan."}
      </p>
      <div className="relative aspect-video w-full bg-slate-900 rounded-lg overflow-hidden border-2 border-slate-700">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`w-full h-full object-cover transition-opacity duration-500 ${stream && !error ? 'opacity-100' : 'opacity-0'}`}
          onCanPlay={() => setIsLoading(false)}
        />
        {isScanning && (
            <div className="absolute inset-0 overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-cyan-400 shadow-[0_0_15px_5px_rgba(0,255,255,0.7)] animate-[scan-y_4s_ease-in-out_infinite]"></div>
            </div>
        )}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-900/50">
            <Spinner size="lg" />
            <p className="ml-4 text-slate-300">Initializing LIDAR...</p>
          </div>
        )}
        {error && !isLoading && (
            <div className="absolute inset-0 flex items-center justify-center p-4">
                <p className="text-center text-red-400">{error}</p>
            </div>
        )}
        <canvas ref={canvasRef} className="hidden" />
      </div>
      <div className="mt-6 flex flex-col sm:flex-row-reverse justify-center gap-4">
        <button
          onClick={toggleScan}
          disabled={!stream || !!error || isLoading}
          className={`w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3 text-white font-bold rounded-lg shadow-lg transition-all duration-300 transform hover:scale-105 disabled:bg-slate-600 disabled:cursor-not-allowed ${isScanning ? 'bg-red-600 hover:bg-red-500' : 'bg-cyan-600 hover:bg-cyan-500'}`}
        >
          <LidarIcon className="w-5 h-5" />
          {isScanning ? 'Stop Scan & Capture' : 'Start Scan'}
        </button>
        <button
          onClick={onCancel}
          disabled={isScanning}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3 bg-slate-600 hover:bg-slate-500 text-white font-bold rounded-lg shadow-lg transition-all duration-300 transform hover:scale-105 disabled:opacity-50"
        >
          <BackIcon className="w-5 h-5" />
          Back
        </button>
      </div>
      <style>{`
        @keyframes scan-y {
            0% { transform: translateY(-0.25rem); }
            50% { transform: translateY(100%); }
            100% { transform: translateY(-0.25rem); }
        }
      `}</style>
    </div>
  );
};
