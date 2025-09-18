
import React, { useRef, useEffect, useState } from 'react';
import { Spinner } from './Spinner';
import { CameraIcon, BackIcon } from './IconComponents';

interface CameraCaptureProps {
  onCapture: (file: File, scanType: 'camera') => void;
  onCancel: () => void;
}

export const CameraCapture: React.FC<CameraCaptureProps> = ({ onCapture, onCancel }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCapturing, setIsCapturing] = useState(false);

  useEffect(() => {
    let mediaStream: MediaStream | undefined;
    const enableStream = async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
            throw new Error("Camera API is not supported in this browser.");
        }
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' }, // Prefer rear camera
        });
        setStream(mediaStream);
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
      } catch (err) {
        console.error("Error accessing camera:", err);
        let message = "Could not access the camera. Please check permissions and try again.";
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
      // Cleanup: stop all tracks on unmount
      if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const handleCapture = () => {
    if (videoRef.current && canvasRef.current && stream && !isCapturing) {
      setIsCapturing(true);
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      
      if (context) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
        
        canvas.toBlob(blob => {
          if (blob) {
            const file = new File([blob], `capture-${Date.now()}.jpg`, { type: 'image/jpeg' });
            onCapture(file, 'camera');
            // No need to set isCapturing to false, as the component will unmount
          } else {
            setError("Failed to process the captured image.");
            setIsCapturing(false);
          }
        }, 'image/jpeg', 0.95);
      } else {
        setError("Failed to get canvas context to capture image.");
        setIsCapturing(false);
      }
    }
  };

  return (
    <div className="p-6 md:p-8">
      <h2 className="text-2xl md:text-3xl font-bold text-center text-cyan-400 mb-6">
        Capture Road Image
      </h2>
      <div className="relative aspect-video w-full bg-slate-900 rounded-lg overflow-hidden border-2 border-slate-700">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted // Important for autoplay on some browsers
          className={`w-full h-full object-cover transition-opacity duration-500 ${stream && !error ? 'opacity-100' : 'opacity-0'}`}
          onCanPlay={() => setIsLoading(false)}
        />
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-900/50">
            <Spinner size="lg" />
            <p className="ml-4 text-slate-300">Starting camera...</p>
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
          onClick={handleCapture}
          disabled={!stream || !!error || isLoading || isCapturing}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-lg shadow-lg transition-all duration-300 transform hover:scale-105 disabled:bg-slate-600 disabled:cursor-not-allowed"
        >
          {isCapturing ? <Spinner size="sm"/> : <CameraIcon className="w-5 h-5" />}
          {isCapturing ? 'Processing...' : 'Take Picture'}
        </button>
        <button
          onClick={onCancel}
          disabled={isCapturing}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3 bg-slate-600 hover:bg-slate-500 text-white font-bold rounded-lg shadow-lg transition-all duration-300 transform hover:scale-105 disabled:opacity-50"
        >
          <BackIcon className="w-5 h-5" />
          Back
        </button>
      </div>
    </div>
  );
};
