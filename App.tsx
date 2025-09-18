
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Header } from './components/Header';
import { ImageUploader } from './components/ImageUploader';
import { AnalysisDisplay } from './components/AnalysisDisplay';
import { Spinner } from './components/Spinner';
import { ErrorMessage } from './components/ErrorMessage';
import { WelcomeScreen } from './components/WelcomeScreen';
import type { AnalysisResult, Location, SatelliteAnalysisResult, AreaHealthAssessment, Defect, GroundTruthDefect, ValidationMetrics } from './types';
import { analyzeRoadImage, analyzeSatelliteData } from './services/geminiService';
import { fileToBase64 } from './utils/fileUtils';
import { parsePascalVoc } from './utils/xmlParser';
import { compareDetections } from './utils/validationUtils';
import { CameraCapture } from './components/CameraCapture';
import { SatelliteAnalysis } from './components/SatelliteAnalysis';
import { SatelliteAnalysisDisplay } from './components/SatelliteAnalysisDisplay';
// FIX: Imported missing BenchmarkIcon and MapIcon components.
import { PathIcon, SegmentIcon, HeartPulseIcon, GridIcon, LayersIcon, BenchmarkIcon, MapIcon } from './components/IconComponents';
import { RealTimeDetector } from './components/RealTimeDetector';
import { requestLocation } from './utils/locationUtils';
import { GisDashboard } from './components/GisDashboard';
import { VideoAnalysis } from './components/VideoAnalysis';
import { OfflineBanner } from './components/OfflineBanner';


export default function App() {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isFetchingLocation, setIsFetchingLocation] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isCameraOpen, setIsCameraOpen] = useState<boolean>(false);
  const [location, setLocation] = useState<Location | null>(null);
  const [isCrackPathAnalysis, setIsCrackPathAnalysis] = useState<boolean>(false);
  const [isHealthAnalysis, setIsHealthAnalysis] = useState<boolean>(false);
  const [isFidelitySegmentation, setIsFidelitySegmentation] = useState<boolean>(false);
  const [isInstanceAnalysis, setIsInstanceAnalysis] = useState<boolean>(false);
  const [areaHealth, setAreaHealth] = useState<AreaHealthAssessment | null>(null);
  const [isRealTimeOpen, setIsRealTimeOpen] = useState<boolean>(false);

  // State for AI Validation
  const [groundTruthFile, setGroundTruthFile] = useState<File | null>(null);

  // New state for Satellite Analysis
  const [satelliteAnalysis, setSatelliteAnalysis] = useState<SatelliteAnalysisResult | null>(null);
  const [isSatelliteViewOpen, setIsSatelliteViewOpen] = useState<boolean>(false);

  // New state for GIS Dashboard
  const [sessionDefects, setSessionDefects] = useState<Defect[]>([]);
  const [isGisDashboardOpen, setIsGisDashboardOpen] = useState<boolean>(false);

  // New state for Video Analysis
  const [isVideoAnalysisOpen, setIsVideoAnalysisOpen] = useState<boolean>(false);
  
  // State for network connectivity
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);


  const handleImageProvided = async (file: File, scanType?: 'camera') => {
    setImageFile(file);
    setImageUrl(URL.createObjectURL(file));
    setAnalysis(null);
    setError(null); // Clear previous errors first
    setIsCameraOpen(false);
    setLocation(null);

    // Reset validation state on new image upload
    setGroundTruthFile(null);
    
    // Only fetch location for camera scans
    if (scanType === 'camera') {
      if (!isOnline) {
        setError("You are offline. Cannot fetch GPS location.");
        return;
      }
      setIsFetchingLocation(true); // Start fetching location
      try {
          const userLocation = await requestLocation();
          setLocation(userLocation);
      } catch (err) {
          if (err instanceof Error) {
              setError(err.message); // Display user-friendly error
          } else {
              setError("An unexpected error occurred while fetching location.");
          }
      } finally {
          setIsFetchingLocation(false); // Done fetching location
      }
    } else {
      // For standard file uploads, ensure location state is clear and we are not fetching.
      setIsFetchingLocation(false);
      setLocation(null);
    }
  };

  const handleClear = () => {
    setImageFile(null);
    setImageUrl(null);
    setAnalysis(null);
    setError(null);
    setIsLoading(false);
    setIsFetchingLocation(false);
    setIsCameraOpen(false);
    setLocation(null);
    setSatelliteAnalysis(null);
    setIsSatelliteViewOpen(false);
    setIsCrackPathAnalysis(false);
    setIsHealthAnalysis(false);
    setIsFidelitySegmentation(false);
    setIsInstanceAnalysis(false);
    setAreaHealth(null);
    setIsRealTimeOpen(false);
    setIsVideoAnalysisOpen(false);
    setGroundTruthFile(null);
    // Do NOT clear session defects, so the GIS dashboard remains accessible.
    setIsGisDashboardOpen(false);
  }

  const handleGroundTruthFileSelect = (file: File | null) => {
    setGroundTruthFile(file);
  };

  const handleAnalyze = useCallback(async (
      analysisType: 'standard' | 'detailed' | 'health' | 'instance',
      isValidationRun: boolean = false
  ) => {
    if (!imageFile) {
      setError("Please upload an image first.");
      return;
    }
    if (!isOnline) {
      setError("You are currently offline. An internet connection is required to perform an analysis.");
      return;
    }
    if (isValidationRun && !groundTruthFile) {
        setError("Please select a ground truth annotation file to run validation.");
        return;
    }
    
    const isDeepScan = analysisType === 'detailed';
    const isDetailed = analysisType === 'detailed';
    const isHealth = analysisType === 'health';
    const isInstance = analysisType === 'instance';
    
    setIsCrackPathAnalysis(isDetailed);
    setIsHealthAnalysis(isHealth);
    setIsFidelitySegmentation(isDetailed);
    setIsInstanceAnalysis(isInstance);
    setIsLoading(true);
    setAnalysis(null);
    setAreaHealth(null);
    // Don't clear error here, so location error can persist until a successful analysis.

    try {
      const base64Image = await fileToBase64(imageFile);
      const mimeType = imageFile.type;
      const result = await analyzeRoadImage(base64Image, mimeType, isDeepScan, isDetailed, isHealth, false, isDetailed, isInstance);
      
      let groundTruth: GroundTruthDefect[] | undefined;
      let validationMetrics: ValidationMetrics | undefined;

      if (isValidationRun && imageUrl && groundTruthFile) {
          try {
              const image = new Image();
              image.src = imageUrl;
              await image.decode();
              const { naturalWidth: width, naturalHeight: height } = image;
              
              const xmlContent = await groundTruthFile.text();
              groundTruth = parsePascalVoc(xmlContent, width, height);
              validationMetrics = compareDetections(result.defects, groundTruth);
          } catch (validationError) {
              console.error("Validation failed:", validationError);
              const validationErrorMessage = validationError instanceof Error ? `Ground Truth Validation Failed: ${validationError.message}` : "Failed to process ground truth file.";
              setError(prevError => prevError ? `${prevError} \n${validationErrorMessage}` : validationErrorMessage);
          }
      }

      const defectsWithLocation = result.defects.map(defect => ({
          ...defect,
          location: location,
      }));

      setSessionDefects(prev => [...prev, ...defectsWithLocation]);
      
      if (isHealth) {
          const healthResult = result as AreaHealthAssessment;
          const finalResult: AreaHealthAssessment = {
              ...healthResult,
              defects: defectsWithLocation,
              location: location,
              groundTruth,
              validationMetrics
          };
          setAreaHealth(finalResult);
          setAnalysis({ defects: finalResult.defects, location: finalResult.location, groundTruth, validationMetrics });
      } else {
          const standardResult = result as AnalysisResult;
          const finalResult: AnalysisResult = {
              ...standardResult,
              defects: defectsWithLocation,
              location: location,
              groundTruth,
              validationMetrics
          };
          setAnalysis(finalResult);
      }
      
      // Clear analysis-specific errors on success, but preserve validation error if it occurred
      if (!error?.includes("Validation Failed")) {
          setError(error); // Keep the validation error if it exists
      }

    } catch (err) {
        if (err instanceof Error) {
            setError(`Analysis failed: ${err.message}.`);
        } else {
            setError("An unknown error occurred during analysis.");
        }
    } finally {
      setIsLoading(false);
    }
  }, [imageFile, location, isOnline, imageUrl, groundTruthFile, error]);

  const handleSatelliteAnalyze = async (locationInput: string) => {
    setIsLoading(true);
    setError(null);
    setSatelliteAnalysis(null);
    try {
        const result = await analyzeSatelliteData(locationInput);
        setSatelliteAnalysis(result);
        setIsSatelliteViewOpen(false); // Close input view, show results
    } catch (err) {
        if (err instanceof Error) {
            setError(`Satellite analysis failed: ${err.message}.`);
        } else {
            setError("An unknown error occurred during satellite analysis.");
        }
    } finally {
        setIsLoading(false);
    }
  };

  const handleRealTimeClose = (sessionData?: Defect[]) => {
    if (sessionData && sessionData.length > 0) {
        setSessionDefects(prev => [...prev, ...sessionData]);
    }
    setIsRealTimeOpen(false);
  };

  const handleVideoAnalysisClose = (sessionData?: Defect[]) => {
    if (sessionData && sessionData.length > 0) {
        setSessionDefects(prev => [...prev, ...sessionData]);
    }
    setIsVideoAnalysisOpen(false);
  };
  
  const renderContent = () => {
    if (isGisDashboardOpen) {
      return <GisDashboard defects={sessionDefects} onBack={() => setIsGisDashboardOpen(false)} />;
    }
    if (isVideoAnalysisOpen) {
      return <VideoAnalysis onClose={handleVideoAnalysisClose} isOnline={isOnline} />;
    }
    if (isRealTimeOpen) {
      return <RealTimeDetector onClose={handleRealTimeClose} isOnline={isOnline} />;
    }
    if (isSatelliteViewOpen) {
        return <SatelliteAnalysis onAnalyze={handleSatelliteAnalyze} onCancel={() => setIsSatelliteViewOpen(false)} isOnline={isOnline} />;
    }
    if (isCameraOpen) {
      return <CameraCapture onCapture={handleImageProvided} onCancel={() => setIsCameraOpen(false)} />;
    }
    return (
      <>
        <div className="p-6 md:p-8">
          <h2 className="text-2xl md:text-3xl font-bold text-center text-cyan-400 mb-6">
            {imageUrl ? "Image Ready for Analysis" : "Select Analysis Method"}
          </h2>
          
          {!imageUrl && !satelliteAnalysis ? (
              <ImageUploader 
                  onImageUpload={handleImageProvided} 
                  onUseCamera={() => setIsCameraOpen(true)}
                  onUseSatellite={() => setIsSatelliteViewOpen(true)}
                  onUseRealTime={() => setIsRealTimeOpen(true)}
                  onUseVideoAnalysis={() => setIsVideoAnalysisOpen(true)}
                  onOpenGisDashboard={() => setIsGisDashboardOpen(true)}
                  hasSessionData={sessionDefects.length > 0}
                  disabled={isLoading || !isOnline}
                  isOnline={isOnline}
              />
          ) : imageUrl && (
              <div className="mt-4 border-2 border-dashed border-slate-600 rounded-lg p-4">
                  <img src={imageUrl} alt="Uploaded road surface" className="max-h-80 w-auto mx-auto rounded-md shadow-lg" />
              </div>
          )}

          {imageUrl && !analysis && (
            <>
                <div className="mt-6 border-2 border-dashed border-slate-700 rounded-lg p-4 bg-slate-800/50">
                    <div className="flex items-center gap-3 mb-3">
                        <BenchmarkIcon className="w-6 h-6 text-teal-400"/>
                        <h3 className="text-xl font-bold text-teal-400">AI Validation</h3>
                    </div>
                    <p className="text-sm text-slate-400 mb-4">
                        Upload a PASCAL VOC XML annotation file to compare the AI's performance against a ground truth dataset.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-4 items-center">
                        <label className="relative w-full sm:flex-1 h-12 flex items-center justify-center px-4 bg-slate-700 hover:bg-slate-600 text-slate-200 font-semibold rounded-lg shadow-md transition-colors duration-300 cursor-pointer">
                            <input
                                type="file"
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                accept=".xml, text/xml"
                                onChange={(e) => handleGroundTruthFileSelect(e.target.files?.[0] || null)}
                                disabled={isLoading}
                            />
                            <span className="truncate">{groundTruthFile ? groundTruthFile.name : 'Select Annotation File (.xml)'}</span>
                        </label>
                        <button
                            onClick={() => handleAnalyze('standard', true)}
                            disabled={!groundTruthFile || isLoading || isFetchingLocation || !isOnline}
                            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3 bg-teal-600 hover:bg-teal-500 text-white font-bold rounded-lg shadow-lg transition-all duration-300 transform hover:scale-105 disabled:bg-slate-600 disabled:cursor-not-allowed"
                        >
                            {isLoading && groundTruthFile ? <Spinner /> : <BenchmarkIcon className="w-5 h-5"/>}
                            {isLoading && groundTruthFile ? 'Validating...' : 'Run Validation'}
                        </button>
                    </div>
                </div>
                
                <div className="my-4 flex items-center justify-center">
                    <span className="h-px bg-slate-600 flex-grow"></span>
                    <span className="px-3 text-slate-500 font-semibold text-sm">OR PERFORM</span>
                    <span className="h-px bg-slate-600 flex-grow"></span>
                </div>
            </>
          )}

          {(imageUrl || satelliteAnalysis) && (
              <div className="mt-6 flex flex-col sm:flex-row flex-wrap justify-center gap-4">
                  {imageUrl && !analysis && (
                    <>
                      <button
                          onClick={() => handleAnalyze('standard')}
                          disabled={isLoading || isFetchingLocation || !isOnline}
                          className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-3 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-lg shadow-lg transition-all duration-300 transform hover:scale-105 disabled:bg-slate-600 disabled:cursor-not-allowed disabled:scale-100"
                      >
                          {isFetchingLocation && !isLoading ? (
                              <>
                                  <Spinner size="sm" />
                                  <span className="ml-2">Getting Location...</span>
                              </>
                          ) : isLoading && !isCrackPathAnalysis && !isHealthAnalysis ? (
                              <Spinner />
                          ) : (
                              'Analyze Image'
                          )}
                      </button>
                      <button
                          onClick={() => handleAnalyze('detailed')}
                          disabled={isLoading || isFetchingLocation || !isOnline}
                          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3 bg-teal-600 hover:bg-teal-500 text-white font-bold rounded-lg shadow-lg transition-all duration-300 transform hover:scale-105 disabled:bg-slate-600 disabled:cursor-not-allowed disabled:scale-100"
                      >
                           {isLoading && isFidelitySegmentation ? <Spinner /> : <GridIcon className="w-5 h-5"/>}
                           {isLoading && isFidelitySegmentation ? 'Analyzing...' : 'Detailed Analysis'}
                      </button>
                      <button
                          onClick={() => handleAnalyze('instance')}
                          disabled={isLoading || isFetchingLocation || !isOnline}
                          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3 bg-pink-600 hover:bg-pink-500 text-white font-bold rounded-lg shadow-lg transition-all duration-300 transform hover:scale-105 disabled:bg-slate-600 disabled:cursor-not-allowed disabled:scale-100"
                      >
                           {isLoading && isInstanceAnalysis ? <Spinner /> : <LayersIcon className="w-5 h-5"/>}
                           {isLoading && isInstanceAnalysis ? 'Analyzing...' : 'Instance Segmentation'}
                      </button>
                       <button
                          onClick={() => handleAnalyze('health')}
                          disabled={isLoading || isFetchingLocation || !isOnline}
                          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3 bg-green-600 hover:bg-green-500 text-white font-bold rounded-lg shadow-lg transition-all duration-300 transform hover:scale-105 disabled:bg-slate-600 disabled:cursor-not-allowed disabled:scale-100"
                      >
                           {isLoading && isHealthAnalysis ? <Spinner /> : <HeartPulseIcon className="w-5 h-5"/>}
                           {isLoading && isHealthAnalysis ? 'Assessing...' : 'Area Health Assessment'}
                      </button>
                    </>
                  )}
                  {sessionDefects.length > 0 && (
                       <button
                          onClick={() => setIsGisDashboardOpen(true)}
                          disabled={isLoading}
                          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-lg shadow-lg transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                          <MapIcon className="w-5 h-5" />
                          View Session GIS Dashboard
                      </button>
                  )}
                  <button
                      onClick={handleClear}
                      disabled={isLoading}
                      className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-3 bg-slate-600 hover:bg-slate-500 text-white font-bold rounded-lg shadow-lg transition-all duration-300 transform hover:scale-105 disabled:bg-slate-500 disabled:cursor-not-allowed"
                  >
                     Clear Analysis
                  </button>
              </div>
          )}
        </div>

        <div className="px-6 md:px-8 pb-8">
          {isLoading && (
              <div className="text-center p-8">
                  <div className="inline-block"><Spinner size="lg"/></div>
                  <p className="mt-4 text-lg text-cyan-300 animate-pulse">
                      {groundTruthFile ? 'Validating AI performance...' : 'Analyzing... Please wait.'}
                  </p>
                  {!isOnline && <p className="text-sm text-yellow-400 mt-2">Warning: Your network connection is unstable.</p>}
              </div>
          )}

          {error && <ErrorMessage message={error} />}

          {!isLoading && !error && !analysis && !imageUrl && !satelliteAnalysis && <WelcomeScreen />}

          {analysis && imageUrl && <AnalysisDisplay imageUrl={imageUrl} analysis={analysis} areaHealth={areaHealth} isCrackPathAnalysis={isCrackPathAnalysis} isFidelitySegmentation={isFidelitySegmentation} isInstanceAnalysis={isInstanceAnalysis} />}

          {satelliteAnalysis && <SatelliteAnalysisDisplay analysis={satelliteAnalysis} />}

        </div>
      </>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans">
      <Header />
      <main className="container mx-auto px-4 py-8 md:py-12">
        <div className="max-w-4xl mx-auto bg-slate-800/50 rounded-2xl shadow-2xl shadow-slate-950/50 backdrop-blur-sm border border-slate-700">
          {renderContent()}
        </div>
      </main>
      <footer className="text-center py-6 text-slate-500 text-sm">
        <p>Powered by Gemini AI. Created for advanced infrastructure assessment.</p>
      </footer>
      {!isOnline && <OfflineBanner />}
    </div>
  );
}
