import React, { useRef, useEffect, useState, useMemo } from 'react';
import { Spinner } from './Spinner';
import { BackIcon, PauseIcon, PlayIcon, RecordIcon, StopIcon, ConfidenceIcon, DownloadIcon } from './IconComponents';
import { analyzeRoadImage } from '../services/geminiService';
import type { Defect, Location } from '../types';
import { DEFECT_COLORS } from '../constants';
import { requestLocation } from '../utils/locationUtils';
import { exportToCSV, exportSessionToPDF } from '../utils/exportUtils';


interface RealTimeDetectorProps {
  onClose: (sessionData?: Defect[]) => void;
  isOnline: boolean;
}

type SessionState = 'initializing_camera' | 'acquiring_gps' | 'running' | 'paused' | 'finished' | 'error';

export const RealTimeDetector: React.FC<RealTimeDetectorProps> = ({ onClose, isOnline }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isMounted = useRef(true);
  const isAnalyzing = useRef(false);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const recordedChunks = useRef<Blob[]>([]);
  const locationInterval = useRef<number | null>(null);

  const [sessionState, setSessionState] = useState<SessionState>('initializing_camera');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [liveDefects, setLiveDefects] = useState<Defect[]>([]);
  const [sessionDefects, setSessionDefects] = useState<Defect[]>([]);
  const [videoDimensions, setVideoDimensions] = useState({ width: 0, height: 0 });
  const [isRecording, setIsRecording] = useState(false);
  const [recordedVideoUrl, setRecordedVideoUrl] = useState<string | null>(null);
  const [currentLocation, setCurrentLocation] = useState<Location | null>(null);
  const [isExporting, setIsExporting] = useState(false);


  useEffect(() => {
    isMounted.current = true;
    let mediaStream: MediaStream | undefined;

    const enableStream = async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error("Camera API is not supported.");
        }
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        });
        if (!isMounted.current) {
            mediaStream.getTracks().forEach(track => track.stop());
            return;
        }
        setStream(mediaStream);
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
        setSessionState('acquiring_gps');
      } catch (err) {
        let message = "Could not access the camera.";
        if (err instanceof Error && err.name === "NotAllowedError") {
          message = "Camera access was denied.";
        }
        setError(message);
        setSessionState('error');
      }
    };

    enableStream();

    return () => {
      isMounted.current = false;
      if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
      }
      if (mediaRecorder.current && mediaRecorder.current.state === 'recording') {
        mediaRecorder.current.stop();
      }
      if (locationInterval.current) {
        clearInterval(locationInterval.current);
      }
    };
  }, []);

  // Effect to handle network status changes
  useEffect(() => {
      if (!isOnline && sessionState === 'running') {
          setSessionState('paused');
          setError('Network connection lost. Analysis paused.');
      }
      if (isOnline && sessionState === 'paused' && error === 'Network connection lost. Analysis paused.') {
          setSessionState('running');
          setError(null);
      }
  }, [isOnline, sessionState, error]);


  // Effect for initial GPS lock
  useEffect(() => {
    if (sessionState !== 'acquiring_gps' || !isMounted.current) return;
    if (!isOnline) {
      setError("You are offline. Cannot get GPS signal.");
      setSessionState('error');
      return;
    }

    const getInitialLocation = async () => {
      try {
        const loc = await requestLocation();
        if (isMounted.current) {
          setCurrentLocation(loc);
          setError(null); // Clear any previous location-related errors.
          setSessionState('running'); // SUCCESS: Proceed to running state
        }
      } catch (err) {
        if (isMounted.current) {
            const message = err instanceof Error ? err.message : "Could not get initial GPS signal.";
            console.error("Initial GPS lock failed:", message);
            setError(message); // Display the critical error message.
            setSessionState('error'); // Halt progress by setting state to error.
        }
      }
    };

    getInitialLocation();
  }, [sessionState, isOnline]);

  // Effect for periodic location updates
  useEffect(() => {
    const fetchLocation = async () => {
      try {
        const loc = await requestLocation();
        if (isMounted.current) setCurrentLocation(loc);
      } catch (err) {
        console.warn("Could not get location:", err instanceof Error ? err.message : err);
      }
    };

    if (sessionState === 'running' && isOnline) {
      // Start periodic updates after the initial lock is acquired.
      locationInterval.current = window.setInterval(fetchLocation, 5000); // Every 5 seconds
    } else {
      if (locationInterval.current) {
        clearInterval(locationInterval.current);
        locationInterval.current = null;
      }
    }
  }, [sessionState, isOnline]);

  useEffect(() => {
    if (sessionState !== 'running' || !stream) return;

    const analysisLoop = async () => {
      while (isMounted.current && sessionState === 'running') {
        if (!isAnalyzing.current) {
          isAnalyzing.current = true;

          try {
            const canvas = canvasRef.current;
            const video = videoRef.current;
            if (!canvas || !video || video.readyState < 2) continue;

            const context = canvas.getContext('2d');
            if (!context) continue;

            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            context.drawImage(video, 0, 0, canvas.width, canvas.height);

            const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
            const base64 = dataUrl.split(',')[1];
            if (!base64) continue;
            
            const result = await analyzeRoadImage(base64, 'image/jpeg', false, false, false, false, true);
            
            if (isMounted.current && sessionState === 'running') {
              const defectsWithLocation = result.defects.map(defect => ({
                ...defect,
                location: currentLocation,
              }));
              setLiveDefects(defectsWithLocation);
              setSessionDefects(prev => [...prev, ...defectsWithLocation]);
            }
          } catch (err) {
            console.error("Real-time analysis failed:", err);
            if (isMounted.current) {
              setLiveDefects([]); // Clear transient defects on error
              if (err instanceof Error && err.message.toLowerCase().includes('network error')) {
                setError(err.message);
                setSessionState('paused'); // Pause on network error
              }
            }
          } finally {
            await new Promise(resolve => setTimeout(resolve, 4000)); // Rate limit to 1 call every 4s (15 RPM)
            isAnalyzing.current = false;
          }
        } else {
           await new Promise(resolve => setTimeout(resolve, 50));
        }
      }
    };

    analysisLoop();
  }, [stream, sessionState, currentLocation]);

  const handlePauseResume = () => {
    if (sessionState === 'running') {
      setSessionState('paused');
      mediaRecorder.current?.pause();
    } else if (sessionState === 'paused') {
      if (!isOnline) {
          setError('Cannot resume. You are offline.');
          return;
      }
      setSessionState('running');
      mediaRecorder.current?.resume();
    }
  };

  const handleToggleRecording = () => {
    if (isRecording) {
      mediaRecorder.current?.stop();
      setIsRecording(false);
    } else if (stream) {
      recordedChunks.current = [];
      const options = { mimeType: 'video/webm' };
      try {
        mediaRecorder.current = new MediaRecorder(stream, options);
        mediaRecorder.current.ondataavailable = (e) => {
          if (e.data.size > 0) recordedChunks.current.push(e.data);
        };
        mediaRecorder.current.onstop = () => {
          const blob = new Blob(recordedChunks.current, { type: 'video/webm' });
          const url = URL.createObjectURL(blob);
          if (isMounted.current) setRecordedVideoUrl(url);
        };
        mediaRecorder.current.start();
        setIsRecording(true);
      } catch (e) {
        console.error("Recording failed to start:", e);
        setError("Recording is not supported on this device/browser.");
      }
    }
  };

  const handleFinishSession = () => {
    if (mediaRecorder.current?.state === 'recording') {
      mediaRecorder.current.stop();
    }
    stream?.getTracks().forEach(track => track.stop());
    setStream(null);
    setSessionState('finished');
  };
  
  const handleExportCSV = () => {
    exportToCSV(sessionDefects);
  };

  const handleExportPDF = async () => {
    setIsExporting(true);
    try {
        await exportSessionToPDF(sessionDefects);
    } catch (e) {
        console.error("Session PDF export failed", e);
        alert("Sorry, there was an error creating the PDF report.");
    } finally {
        if(isMounted.current) setIsExporting(false);
    }
  };

  const sessionSummary = useMemo(() => {
    if (sessionState !== 'finished') return null;
    
    const summary = new Map<Defect['type'], { count: number; confidenceSum: number }>();
    sessionDefects.forEach(defect => {
      const existing = summary.get(defect.type) || { count: 0, confidenceSum: 0 };
      summary.set(defect.type, {
        count: existing.count + 1,
        confidenceSum: existing.confidenceSum + (defect.confidence || 0),
      });
    });
    return Array.from(summary.entries()).map(([type, data]) => ({
      type,
      count: data.count,
      avgConfidence: data.count > 0 ? (data.confidenceSum / data.count) * 100 : 0,
    }));
  }, [sessionState, sessionDefects]);

  if (sessionState === 'finished') {
    return (
      <div className="p-6 md:p-8">
        <h2 className="text-2xl md:text-3xl font-bold text-center text-rose-400 mb-4">
          Session Summary
        </h2>
        <div className="space-y-6">
          {recordedVideoUrl && (
            <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
              <h3 className="text-lg font-bold text-slate-200 mb-2">Session Recording</h3>
              <video src={recordedVideoUrl} controls className="w-full rounded-md" />
              <a 
                href={recordedVideoUrl}
                download={`roadguard-session-${Date.now()}.webm`}
                className="mt-3 w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-lg shadow-lg"
              >
                <DownloadIcon className="w-4 h-4" /> Download Video
              </a>
            </div>
          )}
          <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
            <h3 className="text-lg font-bold text-slate-200 mb-2">Aggregated Detections</h3>
            {sessionSummary && sessionSummary.length > 0 ? (
              <ul className="space-y-2">
                {sessionSummary.map(({ type, count, avgConfidence }) => (
                  <li key={type} className="flex justify-between items-center bg-slate-700/50 p-3 rounded-md">
                    <span className={`font-semibold ${DEFECT_COLORS[type]?.text || 'text-slate-300'}`}>{type}</span>
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-slate-400">Count: <span className="font-bold text-slate-200">{count}</span></span>
                      <div className="flex items-center gap-1.5 text-sm text-slate-400">
                        <ConfidenceIcon className="w-4 h-4" />
                        <span>~{(avgConfidence).toFixed(1)}%</span>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : <p className="text-slate-400">No defects were detected during this session.</p>}
          </div>
           {sessionDefects.length > 0 && (
             <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
                <h3 className="text-lg font-bold text-slate-200 mb-3">Export Full Report</h3>
                <div className="flex flex-col sm:flex-row justify-center gap-4">
                    <button
                        onClick={handleExportCSV}
                        disabled={isExporting}
                        className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 font-semibold rounded-lg shadow-md transition-all duration-300 disabled:opacity-50"
                    >
                        <DownloadIcon className="w-4 h-4" />
                        Export CSV
                    </button>
                    <button
                        onClick={handleExportPDF}
                        disabled={isExporting}
                        className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-lg shadow-lg transition-all duration-300 disabled:opacity-50"
                    >
                        {isExporting ? <Spinner size="sm" /> : <DownloadIcon className="w-4 h-4" />}
                        {isExporting ? 'Generating PDF...' : 'Export PDF'}
                    </button>
                </div>
             </div>
           )}
          <div className="text-center pt-4">
            <button onClick={() => onClose(sessionDefects)} className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3 bg-slate-600 hover:bg-slate-500 text-white font-bold rounded-lg shadow-lg">
                <BackIcon className="w-5 h-5" /> Back to Menu
            </button>
          </div>
        </div>
      </div>
    );
  }

  const getStatusIndicator = () => {
    switch(sessionState) {
        case 'initializing_camera': return <><Spinner size="sm"/> <span className="ml-2">Starting camera...</span></>;
        case 'acquiring_gps': return <><Spinner size="sm"/> <span className="ml-2">Getting GPS signal...</span></>;
        case 'running': return <><span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span><span className="ml-2">Analyzing</span></>;
        case 'paused': return <><span className="w-2 h-2 bg-yellow-400 rounded-full"></span><span className="ml-2">Paused</span></>;
        case 'error': return <><span className="w-2 h-2 bg-red-500 rounded-full"></span><span className="ml-2">Error</span></>;
        default: return null;
    }
  };

  return (
    <div className="p-6 md:p-8">
      <h2 className="text-2xl md:text-3xl font-bold text-center text-rose-400 mb-4">
        Real-Time Detection
      </h2>
      <div className="relative aspect-video w-full bg-slate-900 rounded-lg overflow-hidden border-2 border-slate-700">
        <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" onLoadedMetadata={(e) => setVideoDimensions({ width: e.currentTarget.videoWidth, height: e.currentTarget.videoHeight })} />
        <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
          <svg className="w-full h-full" viewBox={`0 0 ${videoDimensions.width || 1} ${videoDimensions.height || 1}`} preserveAspectRatio="xMidYMid slice">
            {liveDefects.map((defect, index) => {
              const { x_min, y_min, x_max, y_max } = defect.boundingBox;
              const colorInfo = DEFECT_COLORS[defect.type] || DEFECT_COLORS['Distress'];
              const color = colorInfo.border.includes('red') ? '#ef4444' :
                            colorInfo.border.includes('yellow') ? '#facc15' :
                            colorInfo.border.includes('orange') ? '#f97316' :
                            '#22d3ee'; // default cyan
              return (
                <g key={index}>
                  <rect x={x_min * videoDimensions.width} y={y_min * videoDimensions.height} width={(x_max - x_min) * videoDimensions.width} height={(y_max - y_min) * videoDimensions.height} style={{ stroke: color, strokeWidth: 4, fill: 'rgba(255,255,255,0.1)' }} />
                  <text x={x_min * videoDimensions.width + 5} y={y_min * videoDimensions.height + 20} style={{ fill: 'white', fontSize: '16px', fontWeight: 'bold', paintOrder: 'stroke', stroke: 'black', strokeWidth: '0.5px' }}>
                    {defect.type} {defect.confidence?.toFixed(2)}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
        {(sessionState === 'initializing_camera' || sessionState === 'acquiring_gps' || sessionState === 'error') && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80 p-4">
            {sessionState === 'error' ? (
                <p className="text-center text-red-400">{error}</p>
            ) : (
                <>
                    <Spinner size="lg" />
                    <p className="ml-4 text-slate-300">
                        {sessionState === 'initializing_camera' ? 'Starting camera...' : 'Getting GPS signal...'}
                    </p>
                </>
            )}
          </div>
        )}
        <div className="absolute top-2 left-2 bg-slate-900/70 text-slate-100 text-sm font-semibold px-3 py-1 rounded-full flex items-center">
          {getStatusIndicator()}
        </div>
        {isRecording && <div className="absolute top-2 right-2 flex items-center gap-2 bg-red-600/80 text-white font-bold px-3 py-1 rounded-full"><RecordIcon className="w-3 h-3 animate-pulse" /> REC</div>}
        <canvas ref={canvasRef} className="hidden" />
      </div>
      <p className="text-center text-xs text-slate-500 mt-2">To prevent exceeding API rate limits, analysis is performed every 4 seconds.</p>
      {error && sessionState !== 'error' && <p className="text-center text-sm text-yellow-400 mt-2">{error}</p>}
      <div className="mt-4 flex flex-col sm:flex-row justify-center items-center gap-4 flex-wrap">
        <button onClick={() => onClose(sessionDefects)} className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3 bg-slate-600 hover:bg-slate-500 text-white font-bold rounded-lg shadow-lg">
            <BackIcon className="w-5 h-5" /> Back to Menu
        </button>
        <button onClick={handlePauseResume} disabled={sessionState !== 'running' && sessionState !== 'paused'} className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 bg-yellow-600 hover:bg-yellow-500 text-white font-bold rounded-lg shadow-lg disabled:bg-slate-600 disabled:cursor-not-allowed">
          {sessionState === 'running' ? <><PauseIcon className="w-5 h-5"/> Pause</> : <><PlayIcon className="w-5 h-5"/> Resume</>}
        </button>
        <button onClick={handleToggleRecording} disabled={sessionState !== 'running' && sessionState !== 'paused'} className={`w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 font-bold rounded-lg shadow-lg text-white disabled:bg-slate-600 disabled:cursor-not-allowed ${isRecording ? 'bg-rose-700 hover:bg-rose-600' : 'bg-slate-700 hover:bg-slate-600'}`}>
          {isRecording ? <><StopIcon className="w-5 h-5"/> Stop Rec</> : <><RecordIcon className="w-5 h-5"/> Record</>}
        </button>
        <button onClick={handleFinishSession} disabled={sessionState === 'initializing_camera' || sessionState === 'acquiring_gps' || sessionState === 'error'} className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-lg shadow-lg disabled:bg-slate-600">
          Finish Session
        </button>
      </div>
    </div>
  );
};