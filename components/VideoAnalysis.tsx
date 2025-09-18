
import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { VideoDefect, GpxPoint, Defect } from '../types';
import { analyzeRoadImage } from '../services/geminiService';
import { parseGpx } from '../utils/gpxParser';
import { exportVideoReportToCSV, exportVideoReportToPDF } from '../utils/exportUtils';
import { BackIcon, DownloadIcon, GpxIcon, VideoIcon, FullscreenIcon, ExitFullscreenIcon } from './IconComponents';
import { Spinner } from './Spinner';
import { ErrorMessage } from './ErrorMessage';
import { DEFECT_COLORS, DEFECT_TYPES } from '../constants';

interface VideoAnalysisProps {
    onClose: (sessionData?: Defect[]) => void;
    isOnline: boolean;
}

// A custom hook for managing the analysis process in a cancellable way
function useCancellableProcess() {
    const isCancelledRef = useRef(false);

    useEffect(() => {
        // Ensure we cancel on unmount
        return () => {
            isCancelledRef.current = true;
        };
    }, []);

    const run = useCallback(async (process: (isCancelled: () => boolean) => Promise<void>) => {
        isCancelledRef.current = false;
        await process(() => isCancelledRef.current);
    }, []);

    const cancel = useCallback(() => {
        isCancelledRef.current = true;
    }, []);

    return { run, cancel };
}

export const VideoAnalysis: React.FC<VideoAnalysisProps> = ({ onClose, isOnline }) => {
    const [videoFile, setVideoFile] = useState<File | null>(null);
    const [gpxFile, setGpxFile] = useState<File | null>(null);
    const [videoUrl, setVideoUrl] = useState<string>('');
    const [status, setStatus] = useState<'idle' | 'processing' | 'done' | 'error'>('idle');
    const [progress, setProgress] = useState({ current: 0, total: 100, message: '', elapsedTime: '00:00', etr: '00:00' });
    const [error, setError] = useState<string | null>(null);
    const [results, setResults] = useState<VideoDefect[]>([]);
    const [isExporting, setIsExporting] = useState(false);
    const [isRendering, setIsRendering] = useState(false);
    const [renderProgress, setRenderProgress] = useState(0);
    const [isFullscreen, setIsFullscreen] = useState(false);

    // Advanced options state
    const [analysisRate, setAnalysisRate] = useState(5); // Default: 1 frame per 5 seconds
    const [selectedDefects, setSelectedDefects] = useState<string[]>(DEFECT_TYPES);
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [allDefectsSelected, setAllDefectsSelected] = useState(true);

    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const hiddenVideoRef = useRef<HTMLVideoElement>(null); // For processing
    const videoContainerRef = useRef<HTMLDivElement>(null);
    const renderLoopId = useRef<number | null>(null);
    const { run: runProcess, cancel: cancelProcess } = useCancellableProcess();

    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
        };
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => {
             if (videoUrl) URL.revokeObjectURL(videoUrl);
            cancelProcess();
            document.removeEventListener('fullscreenchange', handleFullscreenChange);
        };
    }, [videoUrl, cancelProcess]);

    const handleVideoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setVideoFile(file);
            if (videoUrl) URL.revokeObjectURL(videoUrl);
            setVideoUrl(URL.createObjectURL(file));
            setError(null);
            setResults([]);
            setStatus('idle');
        }
    };
    
    const handleGpxFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) {
            setGpxFile(file);
        }
    };

    const interpolateLocation = (timestamp: number, track: GpxPoint[], videoStartTime: number): { latitude: number, longitude: number } | null => {
        if (track.length === 0) return null;
        const targetTime = videoStartTime + (timestamp * 1000);
        
        let p1: GpxPoint | null = null;
        let p2: GpxPoint | null = null;

        for (let i = 0; i < track.length - 1; i++) {
            if (track[i].time.getTime() <= targetTime && track[i + 1].time.getTime() >= targetTime) {
                p1 = track[i];
                p2 = track[i + 1];
                break;
            }
        }

        if (!p1 || !p2) {
            if (targetTime < track[0].time.getTime()) return { latitude: track[0].lat, longitude: track[0].lon };
            return { latitude: track[track.length - 1].lat, longitude: track[track.length - 1].lon };
        }

        const timeDiff = p2.time.getTime() - p1.time.getTime();
        if (timeDiff === 0) return { latitude: p1.lat, longitude: p1.lon };
        
        const factor = (targetTime - p1.time.getTime()) / timeDiff;
        const lat = p1.lat + (p2.lat - p1.lat) * factor;
        const lon = p1.lon + (p2.lon - p1.lon) * factor;

        return { latitude: lat, longitude: lon };
    };

    const handleAnalyze = async () => {
        if (!videoFile) return;
        if (!isOnline) {
            setError("You are offline. An internet connection is required for video analysis.");
            setStatus('error');
            return;
        }

        setStatus('processing');
        setError(null);
        setResults([]);
        setProgress({ current: 0, total: 100, message: 'Starting analysis...', elapsedTime: '00:00', etr: 'Calculating...' });

        const process = async (isCancelled: () => boolean) => {
            let gpxTrack: GpxPoint[] = [];
            let videoStartTime: number = 0;
            const analysisStartTime = Date.now();

            try {
                if(gpxFile) {
                    setProgress(p => ({ ...p, message: 'Reading GPX data...' }));
                    const gpxContent = await gpxFile.text();
                    if (isCancelled()) return;
                    gpxTrack = parseGpx(gpxContent);
                    if (gpxTrack.length > 0) videoStartTime = gpxTrack[0].time.getTime();
                }

                const video = hiddenVideoRef.current;
                if (!video) throw new Error("Video element not ready.");

                await new Promise<void>((resolve, reject) => {
                    video.onloadedmetadata = () => resolve();
                    video.onerror = () => reject(new Error("Failed to load video metadata. The video file may be corrupt or in an unsupported format."));
                    video.src = URL.createObjectURL(videoFile);
                });

                if (isCancelled()) return;
                
                const duration = video.duration;
                if (!duration || !isFinite(duration)) throw new Error("Could not determine video duration.");
                
                const ANALYSIS_FPS = 1 / analysisRate;
                const totalFrames = Math.floor(duration * ANALYSIS_FPS);
                setProgress({ current: 0, total: totalFrames, message: 'Starting frame analysis...', elapsedTime: '00:00', etr: 'Calculating...' });
                
                const allDefects: VideoDefect[] = [];

                for (let i = 0; i < totalFrames; i++) {
                    if (isCancelled()) return;
                    const timestamp = i * analysisRate;
                    
                    const elapsedSeconds = Math.round((Date.now() - analysisStartTime) / 1000);
                    const timePerFrame = i > 0 ? elapsedSeconds / i : 0;
                    const framesRemaining = totalFrames - i;
                    const etrSeconds = Math.round(timePerFrame * framesRemaining);

                    const formatTime = (s: number) => {
                        if (!isFinite(s) || s < 0) return '--:--';
                        const minutes = Math.floor(s / 60).toString().padStart(2, '0');
                        const seconds = (s % 60).toString().padStart(2, '0');
                        return `${minutes}:${seconds}`;
                    };

                    setProgress({ 
                        current: i, 
                        total: totalFrames, 
                        message: `Analyzing frame ${i + 1}/${totalFrames} at ${timestamp.toFixed(1)}s`,
                        elapsedTime: formatTime(elapsedSeconds),
                        etr: i > 1 ? formatTime(etrSeconds) : 'Calculating...'
                    });

                    await new Promise<void>((resolve, reject) => {
                        video.onseeked = () => resolve();
                        video.onerror = () => reject(new Error(`Failed to seek video to ${timestamp}s.`));
                        video.currentTime = timestamp;
                    });
                    
                    const canvas = document.createElement('canvas');
                    canvas.width = video.videoWidth;
                    canvas.height = video.videoHeight;
                    const ctx = canvas.getContext('2d');
                    if (!ctx) continue;
                    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

                    const base64 = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
                    if (!base64) continue;
                    
                    // FIX: Corrected arguments for analyzeRoadImage call to match function signature.
                    const analysisResult = await analyzeRoadImage(base64, 'image/jpeg', false, false, false, false, true, false, selectedDefects);
                    const location = gpxTrack.length > 0 ? interpolateLocation(timestamp, gpxTrack, videoStartTime) : null;

                    const newDefects = analysisResult.defects.map(d => ({...d, timestamp, location: location || undefined }));
                    allDefects.push(...newDefects);
                    if(isCancelled()) return;
                    setResults(prev => [...prev, ...newDefects]);
                }
                setResults(allDefects.sort((a,b) => a.timestamp - b.timestamp));
                setStatus('done');
            } catch (err) {
                if (isCancelled()) return;
                console.error("Analysis failed:", err);
                setError(err instanceof Error ? err.message : "An unknown error occurred.");
                setStatus('error');
            }
        };
        await runProcess(process);
    };

    const drawOverlays = useCallback((ctx: CanvasRenderingContext2D, currentTime: number, width: number, height: number) => {
        ctx.clearRect(0, 0, width, height);
        const currentDefects = results.filter(d => Math.abs(d.timestamp - currentTime) < analysisRate);

        currentDefects.forEach(defect => {
            const { x_min, y_min, x_max, y_max } = defect.boundingBox;
            const colorInfo = DEFECT_COLORS[defect.type] || DEFECT_COLORS['Distress'];

            const x = x_min * width;
            const y = y_min * height;
            const w = (x_max - x_min) * width;
            const h = (y_max - y_min) * height;

            ctx.strokeStyle = colorInfo.border.includes('red-500') ? '#ef4444' : colorInfo.border.includes('green-500') ? '#22c55e' : colorInfo.border.includes('blue-500') ? '#3b82f6' : '#6366f1';
            ctx.lineWidth = 3;
            ctx.strokeRect(x, y, w, h);

            ctx.font = 'bold 14px sans-serif';
            const label = `${defect.type} (${(defect.confidence ?? 0).toFixed(2)})`;
            const textMetrics = ctx.measureText(label);
            const textX = Math.max(0, x);
            const textY = Math.max(20, y);
            
            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            ctx.fillRect(textX, textY - 16, textMetrics.width + 10, 20);
            
            ctx.fillStyle = 'white';
            ctx.fillText(label, textX + 5, textY - 2);
        });
    }, [results, analysisRate]);

    const handleTimeUpdate = () => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas || results.length === 0) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const rect = video.getBoundingClientRect();
        if (canvas.width !== rect.width || canvas.height !== rect.height) {
            canvas.width = rect.width;
            canvas.height = rect.height;
        }
        drawOverlays(ctx, video.currentTime, canvas.width, canvas.height);
    };
    
    const handleRowClick = (timestamp: number) => {
        if (videoRef.current) {
            videoRef.current.currentTime = timestamp;
            if (videoRef.current.paused) videoRef.current.play();
            videoRef.current.focus();
        }
    };
    
    const handleExport = async (format: 'csv' | 'pdf') => {
        if (!videoFile) return;
        setIsExporting(true);
        try {
            if (format === 'csv') exportVideoReportToCSV(results);
            else await exportVideoReportToPDF(results, videoFile.name);
        } catch (e) {
            setError(`Failed to export ${format} report.`);
        } finally {
            setIsExporting(false);
        }
    };

    const handleCancel = () => {
        cancelProcess();
        setStatus('idle');
        setError(null);
        setResults([]);
    };

    const handleRenderVideo = async () => {
        const video = videoRef.current;
        if (!video) return;

        setIsRendering(true);
        setRenderProgress(0);

        const renderCanvas = document.createElement('canvas');
        renderCanvas.width = video.videoWidth;
        renderCanvas.height = video.videoHeight;
        const ctx = renderCanvas.getContext('2d');
        if (!ctx) {
            setError("Could not create rendering context.");
            setIsRendering(false);
            return;
        }

        const stream = renderCanvas.captureStream();
        const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
        const chunks: Blob[] = [];
        recorder.ondataavailable = (e) => chunks.push(e.data);
        
        recorder.onstop = () => {
            const blob = new Blob(chunks, { type: 'video/webm' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${videoFile?.name.replace(/\.[^/.]+$/, "") || 'video'}_annotated.webm`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            setIsRendering(false);
            if (renderLoopId.current) cancelAnimationFrame(renderLoopId.current);
            video.muted = false;
        };

        recorder.start();
        video.currentTime = 0;
        video.muted = true;
        await video.play();

        const renderLoop = () => {
            if (video.paused || video.ended) {
                if (recorder.state === "recording") recorder.stop();
                return;
            }
            ctx.drawImage(video, 0, 0, renderCanvas.width, renderCanvas.height);
            drawOverlays(ctx, video.currentTime, renderCanvas.width, renderCanvas.height);
            setRenderProgress(Math.round((video.currentTime / video.duration) * 100));
            renderLoopId.current = requestAnimationFrame(renderLoop);
        };
        renderLoopId.current = requestAnimationFrame(renderLoop);
    };
    
    const handleToggleFullscreen = () => {
        if (!document.fullscreenElement) {
            videoContainerRef.current?.requestFullscreen();
        } else {
            document.exitFullscreen();
        }
    };

    const handleDefectSelectionChange = (defectType: string) => {
        setSelectedDefects(prev => {
            const newSelection = prev.includes(defectType)
                ? prev.filter(d => d !== defectType)
                : [...prev, defectType];
            setAllDefectsSelected(newSelection.length === DEFECT_TYPES.length);
            return newSelection;
        });
    };

    const handleSelectAllDefects = () => {
        if (allDefectsSelected) {
            setSelectedDefects([]);
            setAllDefectsSelected(false);
        } else {
            setSelectedDefects(DEFECT_TYPES);
            setAllDefectsSelected(true);
        }
    };
    
    const renderIdle = () => (
        <div className="p-6 md:p-8">
            <h2 className="text-2xl md:text-3xl font-bold text-center text-fuchsia-400 mb-4">Road Video Analysis</h2>
            <p className="text-center text-slate-400 mb-6 max-w-lg mx-auto">Upload a video and an optional GPX track file. Use the advanced options to refine the analysis for your specific needs.</p>
            <div className="space-y-4 max-w-lg mx-auto">
                 <label className={`flex items-center gap-4 w-full p-4 rounded-lg border-2 border-dashed transition-colors cursor-pointer ${videoFile ? 'border-green-500 bg-green-500/10' : 'border-slate-600 hover:border-fuchsia-500'}`}>
                    <VideoIcon className={`w-8 h-8 flex-shrink-0 ${videoFile ? 'text-green-400' : 'text-slate-500'}`} />
                    <div className="flex-grow overflow-hidden">
                        <span className="font-semibold text-slate-300">1. Upload Video File</span>
                        <p className="text-xs text-slate-400 truncate">{videoFile ? videoFile.name : 'MP4, WEBM, MOV'}</p>
                    </div>
                    <input type="file" className="hidden" accept="video/*" onChange={handleVideoFileChange} />
                </label>
                <label className={`flex items-center gap-4 w-full p-4 rounded-lg border-2 border-dashed transition-colors cursor-pointer ${gpxFile ? 'border-green-500 bg-green-500/10' : 'border-slate-600 hover:border-fuchsia-500'}`}>
                    <GpxIcon className={`w-8 h-8 flex-shrink-0 ${gpxFile ? 'text-green-400' : 'text-slate-500'}`} />
                    <div className="flex-grow overflow-hidden">
                        <span className="font-semibold text-slate-300">2. Upload GPX Track (Optional)</span>
                         <p className="text-xs text-slate-400 truncate">{gpxFile ? gpxFile.name : 'Provides geolocation for detections'}</p>
                    </div>
                    <input type="file" className="hidden" accept=".gpx" onChange={handleGpxFileChange} />
                </label>
            </div>
            <div className="max-w-lg mx-auto mt-6">
                <button onClick={() => setShowAdvanced(!showAdvanced)} className="w-full text-left text-sm font-semibold text-cyan-400 hover:text-cyan-300 p-2 rounded-md hover:bg-slate-700/50">
                    {showAdvanced ? '▼ Hide' : '► Show'} Advanced Options
                </button>
                {showAdvanced && (
                    <div className="mt-2 p-4 bg-slate-900/50 rounded-lg border border-slate-700 space-y-6">
                        <div>
                            <label htmlFor="analysisRate" className="block text-sm font-medium text-slate-300 mb-2">Analysis Rate</label>
                            <div className="flex items-center gap-4">
                                <span className="text-xs text-slate-400">Thorough</span>
                                <input id="analysisRate" type="range" min="2" max="10" step="1" value={analysisRate} onChange={(e) => setAnalysisRate(Number(e.target.value))} className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer" />
                                <span className="text-xs text-slate-400">Fast</span>
                            </div>
                            <p className="text-center text-xs text-slate-500 mt-1">1 frame per {analysisRate} seconds</p>
                        </div>
                        <div>
                            <div className="flex justify-between items-center mb-2">
                                <label className="block text-sm font-medium text-slate-300">Target Defect Types</label>
                                <button onClick={handleSelectAllDefects} className="text-xs font-semibold text-cyan-400 hover:underline">{allDefectsSelected ? 'Deselect All' : 'Select All'}</button>
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                {DEFECT_TYPES.map(type => (
                                    <label key={type} className="flex items-center space-x-2 cursor-pointer text-sm text-slate-300">
                                        <input type="checkbox" checked={selectedDefects.includes(type)} onChange={() => handleDefectSelectionChange(type)} className="w-4 h-4 text-fuchsia-600 bg-slate-700 border-slate-500 rounded focus:ring-fuchsia-500" />
                                        <span>{type}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>
             <div className="mt-6 flex flex-col sm:flex-row-reverse justify-center gap-4">
                <button onClick={handleAnalyze} disabled={!videoFile || !isOnline || selectedDefects.length === 0} className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3 bg-fuchsia-600 hover:bg-fuchsia-500 text-white font-bold rounded-lg shadow-lg disabled:bg-slate-600 disabled:cursor-not-allowed">
                    {selectedDefects.length === 0 ? "Select a defect type" : "Analyze Video"}
                </button>
                <button onClick={() => onClose()} className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3 bg-slate-600 hover:bg-slate-500 text-white font-bold rounded-lg">
                    <BackIcon className="w-5 h-5"/> Back
                </button>
            </div>
        </div>
    );
    
    const renderProcessing = () => (
         <div className="p-6 md:p-8 text-center">
            <h2 className="text-2xl md:text-3xl font-bold text-center text-fuchsia-400 mb-4">Analysis in Progress...</h2>
            <div className="w-full max-w-md mx-auto bg-slate-700 rounded-full h-4 my-2 overflow-hidden border border-slate-600">
                <div className="bg-fuchsia-500 h-full rounded-full transition-all duration-300" style={{ width: `${(progress.current / (progress.total || 1)) * 100}%` }}></div>
            </div>
            <div className="flex justify-between text-sm text-slate-400 max-w-md mx-auto mt-2 font-mono">
                <span>Time Elapsed: {progress.elapsedTime}</span>
                <span>ETR: {progress.etr}</span>
            </div>
            <p className="text-slate-300 my-4 h-6">{progress.message}</p>
            <div className="inline-block"><Spinner size="lg" /></div>
            <div className="mt-6">
                 <button onClick={handleCancel} className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-3 bg-red-600 hover:bg-red-500 text-white font-bold rounded-lg shadow-lg">
                    Cancel Analysis
                </button>
            </div>
        </div>
    );
    
    const renderDone = () => (
        <div className="p-6 md:p-8 space-y-8">
            <h2 className="text-2xl md:text-3xl font-bold text-center text-fuchsia-400">Analysis Complete</h2>
            <div ref={videoContainerRef} className="relative w-full max-w-3xl mx-auto group bg-black">
                <video ref={videoRef} controls onTimeUpdate={handleTimeUpdate} className="w-full rounded-lg border-2 border-slate-700 aspect-video">
                    <source src={videoUrl} type={videoFile?.type} />
                </video>
                <canvas ref={canvasRef} className="absolute top-0 left-0 w-full h-full pointer-events-none" />
                <button onClick={handleToggleFullscreen} className="absolute bottom-4 right-4 bg-black/50 p-2 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity">
                    {isFullscreen ? <ExitFullscreenIcon className="w-5 h-5"/> : <FullscreenIcon className="w-5 h-5"/>}
                </button>
            </div>
             <p className="text-center text-xs text-slate-500 -mt-6">Hint: Use the fullscreen button on the video player for the best viewing experience with overlays.</p>
            <div>
                 <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-4">
                    <h3 className="text-xl font-bold text-slate-200">Distress Report ({results.length})</h3>
                    {results.length > 0 && (
                        <div className="flex items-center gap-3 flex-wrap justify-center">
                            <button onClick={() => handleExport('csv')} disabled={isExporting || isRendering} className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-slate-700 hover:bg-slate-600 rounded-lg disabled:opacity-50">
                                <DownloadIcon className="w-4 h-4" /> Export CSV
                            </button>
                             <button onClick={() => handleExport('pdf')} disabled={isExporting || isRendering} className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-lg disabled:opacity-50">
                                {isExporting ? <Spinner size="sm" /> : <DownloadIcon className="w-4 h-4" />} {isExporting ? 'Exporting...' : 'Export PDF'}
                            </button>
                            <button onClick={handleRenderVideo} disabled={isRendering || isExporting} className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-lg disabled:opacity-50">
                                {isRendering ? <Spinner size="sm" /> : <VideoIcon className="w-4 h-4" />} {isRendering ? `Rendering ${renderProgress}%` : 'Render & Download Video'}
                            </button>
                        </div>
                    )}
                </div>
                {results.length > 0 ? (
                    <div className="max-h-96 overflow-y-auto bg-slate-800/50 rounded-lg border border-slate-700">
                        <table className="w-full text-sm text-left text-slate-300">
                            <thead className="text-xs text-cyan-300 uppercase bg-slate-900/70 sticky top-0 backdrop-blur-sm">
                                <tr>
                                    <th className="px-4 py-3">Timestamp</th>
                                    <th className="px-4 py-3">Type</th>
                                    <th className="px-4 py-3">Severity</th>
                                    <th className="px-4 py-3">Confidence</th>
                                    <th className="px-4 py-3">Location (Lat, Lng)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {results.map((defect, index) => (
                                    <tr key={index} onClick={() => handleRowClick(defect.timestamp)} className="border-b border-slate-700 hover:bg-slate-700/50 cursor-pointer">
                                        <td className="px-4 py-2 font-mono">{defect.timestamp.toFixed(2)}s</td>
                                        <td className="px-4 py-2 font-semibold">{defect.type}</td>
                                        <td className="px-4 py-2">{defect.severity || 'N/A'}</td>
                                        <td className="px-4 py-2 font-mono">{typeof defect.confidence === 'number' ? `${(defect.confidence * 100).toFixed(1)}%` : 'N/A'}</td>
                                        <td className="px-4 py-2 font-mono">
                                             {defect.location ? (
                                                <a 
                                                    href={`https://www.google.com/maps?q=${defect.location.latitude},${defect.location.longitude}`} 
                                                    target="_blank" 
                                                    rel="noopener noreferrer"
                                                    className="text-cyan-400 hover:text-cyan-300 hover:underline"
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    {`${defect.location.latitude.toFixed(5)}, ${defect.location.longitude.toFixed(5)}`}
                                                </a>
                                            ) : 'N/A'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <p className="text-center text-slate-400 py-8 bg-slate-800/50 rounded-lg">No defects found in the video.</p>
                )}
            </div>
            <div className="text-center pt-4">
                <button onClick={() => onClose(results)} className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3 bg-slate-600 hover:bg-slate-500 text-white font-bold rounded-lg shadow-lg">
                    <BackIcon className="w-5 h-5" /> Back to Menu
                </button>
            </div>
        </div>
    );

    return (
        <div>
            {status === 'idle' && renderIdle()}
            {status === 'processing' && renderProcessing()}
            {status === 'done' && renderDone()}
            {status === 'error' && (
                <div className="p-6 md:p-8">
                    {error && <ErrorMessage message={error} />}
                    <div className="mt-4 text-center">
                         <button onClick={() => setStatus('idle')} className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3 bg-slate-600 hover:bg-slate-500 text-white font-bold rounded-lg">
                            <BackIcon className="w-5 h-5"/> Try Again
                        </button>
                    </div>
                </div>
            )}
            <video ref={hiddenVideoRef} className="hidden" muted playsInline />
        </div>
    );
};
