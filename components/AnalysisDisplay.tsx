
import React, { useState } from 'react';
import type { AnalysisResult, AreaHealthAssessment, ValidationMetrics } from '../types';
import { ResultCard } from './ResultCard';
import { DEFECT_COLORS, SEGMENT_COLORS } from '../constants';
import { exportToCSV, exportToPDF } from '../utils/exportUtils';
import { DownloadIcon, LocationIcon, PathIcon, SegmentIcon, HeartPulseIcon, GridIcon, LayersIcon, BenchmarkIcon } from './IconComponents';
import { AreaHealthDisplay } from './AreaHealthDisplay';

interface AnalysisDisplayProps {
  imageUrl: string;
  analysis: AnalysisResult;
  areaHealth: AreaHealthAssessment | null;
  isCrackPathAnalysis: boolean;
  isFidelitySegmentation: boolean;
  isInstanceAnalysis: boolean;
}

const ValidationReport: React.FC<{ metrics: ValidationMetrics }> = ({ metrics }) => {
    const formatPercent = (n: number) => `${(n * 100).toFixed(1)}%`;
    const sortedClasses = Object.keys(metrics.perClassMetrics).sort();

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3 mb-2 border-b-2 border-slate-700 pb-2">
                <BenchmarkIcon className="w-7 h-7 text-teal-400"/>
                <h3 className="text-2xl font-bold text-teal-400">Validation Report</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                <div className="bg-slate-800 p-3 rounded-lg border border-slate-700">
                    <p className="text-sm font-semibold text-slate-400">Precision</p>
                    <p className="text-3xl font-bold text-cyan-400">{formatPercent(metrics.precision)}</p>
                </div>
                <div className="bg-slate-800 p-3 rounded-lg border border-slate-700">
                    <p className="text-sm font-semibold text-slate-400">Recall</p>
                    <p className="text-3xl font-bold text-violet-400">{formatPercent(metrics.recall)}</p>
                </div>
                <div className="bg-slate-800 p-3 rounded-lg border border-slate-700">
                    <p className="text-sm font-semibold text-slate-400">F1-Score</p>
                    <p className="text-3xl font-bold text-teal-400">{formatPercent(metrics.f1Score)}</p>
                </div>
            </div>

            <div>
                <h4 className="text-lg font-bold text-slate-200 mb-3">Per-Class Metrics</h4>
                <div className="overflow-x-auto bg-slate-800/50 rounded-lg border border-slate-700">
                    <table className="w-full text-sm text-left text-slate-300">
                        <thead className="text-xs text-cyan-300 uppercase bg-slate-900/70">
                            <tr>
                                <th className="px-4 py-3">Class</th>
                                <th className="px-4 py-3 text-center">Ground Truth</th>
                                <th className="px-4 py-3 text-center">TP</th>
                                <th className="px-4 py-3 text-center">FP</th>
                                <th className="px-4 py-3 text-center">FN</th>
                                <th className="px-4 py-3 text-right">Precision</th>
                                <th className="px-4 py-3 text-right">Recall</th>
                                <th className="px-4 py-3 text-right">F1-Score</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedClasses.map(className => {
                                const m = metrics.perClassMetrics[className];
                                return (
                                    <tr key={className} className="border-b border-slate-700 last:border-b-0 hover:bg-slate-700/50">
                                        <td className="px-4 py-2 font-semibold">{className}</td>
                                        <td className="px-4 py-2 text-center font-mono">{m.totalGroundTruth}</td>
                                        <td className="px-4 py-2 text-center font-mono text-green-400">{m.tp}</td>
                                        <td className="px-4 py-2 text-center font-mono text-yellow-400">{m.fp}</td>
                                        <td className="px-4 py-2 text-center font-mono text-red-400">{m.fn}</td>
                                        <td className="px-4 py-2 text-right font-mono">{formatPercent(m.precision)}</td>
                                        <td className="px-4 py-2 text-right font-mono">{formatPercent(m.recall)}</td>
                                        <td className="px-4 py-2 text-right font-mono font-bold">{formatPercent(m.f1Score)}</td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};


export const AnalysisDisplay: React.FC<AnalysisDisplayProps> = ({ imageUrl, analysis, areaHealth, isCrackPathAnalysis, isFidelitySegmentation, isInstanceAnalysis }) => {
  const [isExporting, setIsExporting] = useState(false);
  const isDetailedAnalysis = isFidelitySegmentation && isCrackPathAnalysis;

  const handleExportCSV = () => {
    exportToCSV(analysis.defects);
  };

  const handleExportPDF = async () => {
    setIsExporting(true);
    try {
        await exportToPDF(analysis);
    } catch (e) {
        console.error("PDF export failed", e);
        alert("Sorry, there was an error creating the PDF report.");
    } finally {
        setIsExporting(false);
    }
  };

  const colorMap: Record<string, { fill: string; stroke: string }> = {
      'border-red-500': { fill: 'rgba(239, 68, 68, 0.4)', stroke: 'rgb(239, 68, 68)'},
      'border-green-500': { fill: 'rgba(34, 197, 94, 0.4)', stroke: 'rgb(34, 197, 94)'},
      'border-blue-500': { fill: 'rgba(59, 130, 246, 0.4)', stroke: 'rgb(59, 130, 246)'},
      'border-orange-500': { fill: 'rgba(249, 115, 22, 0.4)', stroke: 'rgb(249, 115, 22)'},
      'border-teal-500': { fill: 'rgba(20, 184, 166, 0.4)', stroke: 'rgb(20, 184, 166)'},
      'border-purple-500': { fill: 'rgba(139, 92, 246, 0.4)', stroke: 'rgb(139, 92, 246)'},
      'border-yellow-500': { fill: 'rgba(234, 179, 8, 0.4)', stroke: 'rgb(234, 179, 8)'},
      'border-yellow-400': { fill: 'rgba(250, 204, 21, 0.5)', stroke: 'rgb(250, 204, 21)'},
      'border-indigo-500': { fill: 'rgba(99, 102, 241, 0.4)', stroke: 'rgb(99, 102, 241)'},
      // New colors for Panoptic 'stuff'
      'border-gray-500': { fill: 'rgba(107, 114, 128, 0.5)', stroke: 'rgb(107, 114, 128)' },
      'border-stone-500': { fill: 'rgba(120, 113, 108, 0.5)', stroke: 'rgb(120, 113, 108)' },
      'border-slate-400': { fill: 'rgba(148, 163, 184, 0.5)', stroke: 'rgb(148, 163, 184)' },
      'border-emerald-500': { fill: 'rgba(16, 185, 129, 0.5)', stroke: 'rgb(16, 185, 129)' },
      'border-amber-500': { fill: 'rgba(245, 158, 11, 0.5)', stroke: 'rgb(245, 158, 11)' },
      'border-sky-500': { fill: 'rgba(14, 165, 233, 0.5)', stroke: 'rgb(14, 165, 233)' },
      'border-rose-500': { fill: 'rgba(244, 63, 94, 0.5)', stroke: 'rgb(244, 63, 94)' },
      'border-yellow-300': { fill: 'rgba(253, 224, 71, 0.6)', stroke: 'rgb(253, 224, 71)' },
  };

  return (
    <div className="mt-8 space-y-8">
      {analysis.validationMetrics && <ValidationReport metrics={analysis.validationMetrics} />}

      {areaHealth && <AreaHealthDisplay assessment={areaHealth} />}
      <div>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4 border-b-2 border-slate-700 pb-2">
            <div className="flex items-center flex-wrap gap-x-3 gap-y-2">
              <h3 className="text-2xl font-bold text-cyan-400">Detection Results</h3>
               {areaHealth && (
                 <span className="flex items-center gap-1.5 bg-green-500/20 text-green-300 text-xs font-bold px-2 py-1 rounded-full">
                  <HeartPulseIcon className="w-4 h-4" />
                  Health Assessment
                </span>
              )}
               {isDetailedAnalysis && (
                 <span className="flex items-center gap-1.5 bg-teal-500/20 text-teal-300 text-xs font-bold px-2 py-1 rounded-full">
                  <GridIcon className="w-4 h-4" />
                  Detailed Analysis
                </span>
              )}
               {isInstanceAnalysis && (
                 <span className="flex items-center gap-1.5 bg-pink-500/20 text-pink-300 text-xs font-bold px-2 py-1 rounded-full">
                  <LayersIcon className="w-4 h-4" />
                  Instance Segmentation
                </span>
              )}
            </div>
            {analysis.location && (
                <div className="flex items-center gap-2 text-sm text-slate-400 bg-slate-800 px-3 py-1 rounded-full flex-shrink-0">
                    <LocationIcon className="w-4 h-4 text-cyan-400" />
                    <span>Lat: {analysis.location.latitude.toFixed(5)}, Long: {analysis.location.longitude.toFixed(5)}</span>
                </div>
            )}
        </div>

        {(isInstanceAnalysis) && (typeof analysis.pothole_count === 'number' || typeof analysis.pothole_density_sq_m === 'number') && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4 text-center">
                 {typeof analysis.pothole_count === 'number' && (
                    <div className="bg-slate-800 p-3 rounded-lg border border-slate-700">
                        <p className="text-sm font-semibold text-slate-400">Pothole Count</p>
                        <p className="text-2xl font-bold text-pink-400">{analysis.pothole_count}</p>
                    </div>
                )}
                 {typeof analysis.pothole_density_sq_m === 'number' && (
                    <div className="bg-slate-800 p-3 rounded-lg border border-slate-700">
                        <p className="text-sm font-semibold text-slate-400">Pothole Density</p>
                        <p className="text-2xl font-bold text-pink-400">{analysis.pothole_density_sq_m.toFixed(2)} <span className="text-lg">/ m²</span></p>
                    </div>
                )}
            </div>
        )}

        <div id="analysis-image-container" className="relative w-full max-w-2xl mx-auto rounded-lg overflow-hidden border-2 border-slate-700">
          <img src={imageUrl} alt="Road surface analysis" className="w-full h-auto" />
          
          {(isFidelitySegmentation || isInstanceAnalysis) && (
            <svg className="absolute top-0 left-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
              {analysis.defects.map((defect, index) => {
                if (!defect.segmentationPolygon) return null;
                const colorInfo = DEFECT_COLORS[defect.type] || DEFECT_COLORS['Distress'];
                const fillStroke = colorMap[colorInfo.border] || colorMap['border-indigo-500'];
                const points = defect.segmentationPolygon.map(p => `${p.x * 100},${p.y * 100}`).join(' ');

                return (
                  <g key={`poly-group-${index}`}>
                    {/* Casing for visibility + Fill area */}
                    <polygon
                        points={points}
                        style={{
                            fill: fillStroke.fill,
                            stroke: 'rgba(0, 0, 0, 0.7)', // Dark, semi-transparent casing for contrast
                            strokeWidth: 0.8,
                            strokeLinejoin: 'round',
                        }}
                    />
                    {/* Main colored stroke on top */}
                    <polygon
                        points={points}
                        style={{
                            fill: 'none', // No fill for this layer
                            stroke: fillStroke.stroke,
                            strokeWidth: 0.5,
                            strokeLinejoin: 'round',
                        }}
                    />
                  </g>
                );
              })}
            </svg>
          )}

          {isCrackPathAnalysis && (
            <svg className="absolute top-0 left-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
              {analysis.defects.map((defect, index) => {
                if (!defect.centerlinePath) return null;
                const points = defect.centerlinePath.map(p => `${p.x * 100},${p.y * 100}`).join(' ');

                return (
                  <polyline
                    key={`path-${index}`}
                    points={points}
                    style={{
                      fill: 'none',
                      stroke: '#f97316', // orange-500
                      strokeWidth: 3,
                      strokeLinecap: 'round',
                      strokeLinejoin: 'round',
                    }}
                  />
                );
              })}
            </svg>
          )}

          {analysis.groundTruth && analysis.groundTruth.map((defect, index) => {
              const { x_min, y_min, x_max, y_max } = defect.boundingBox;
              const width = (x_max - x_min) * 100;
              const height = (y_max - y_min) * 100;
              const left = x_min * 100;
              const top = y_min * 100;
              return (
                  <div
                      key={`gt-${index}`}
                      className="absolute border-2 border-dashed border-green-400 rounded-sm pointer-events-none"
                      style={{ left: `${left}%`, top: `${top}%`, width: `${width}%`, height: `${height}%` }}
                  >
                      <span className="absolute -bottom-6 left-0 text-xs font-bold px-1.5 py-0.5 rounded-sm bg-green-500/80 text-green-100 whitespace-nowrap">
                          {defect.type} (Truth)
                      </span>
                  </div>
              );
          })}


          {analysis.defects.map((defect, index) => {
            const { x_min, y_min, x_max, y_max } = defect.boundingBox;
            const colorInfo = DEFECT_COLORS[defect.type] || DEFECT_COLORS['Distress'];
            const width = (x_max - x_min) * 100;
            const height = (y_max - y_min) * 100;
            const left = x_min * 100;
            const top = y_min * 100;
            
            const boxClass = !isCrackPathAnalysis && !isFidelitySegmentation && !isInstanceAnalysis
              ? `${colorInfo.border} border-2 rounded-sm backdrop-brightness-75`
              : 'pointer-events-none'; // Invisible container for label positioning

            return (
              <div
                key={index}
                className={`absolute ${boxClass}`}
                style={{
                  left: `${left}%`,
                  top: `${top}%`,
                  width: `${width}%`,
                  height: `${height}%`,
                }}
              >
                <span className={`absolute -top-6 left-0 text-xs font-bold px-1.5 py-0.5 rounded-sm whitespace-nowrap ${colorInfo.bg.replace('/20', '/80')} ${colorInfo.text.replace('400', '100')}`}>
                  {isInstanceAnalysis && typeof defect.instanceId === 'number'
                      ? `${defect.type} #${defect.instanceId}`
                      : `${defect.type} ${typeof defect.confidence === 'number' ? `(${(defect.confidence * 100).toFixed(0)}%)` : ''}`
                  }
                </span>
              </div>
            );
          })}

          {analysis.validationMetrics && !isInstanceAnalysis && (
              <div className="absolute top-2 right-2 bg-slate-900/70 p-2 rounded-md text-xs text-slate-300 pointer-events-none">
                  <h4 className="font-bold mb-1">Legend</h4>
                  <div className="flex items-center gap-2">
                      <div className="w-4 h-2 border-2 border-cyan-400 rounded-sm"></div>
                      <span>AI Detection (Solid)</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                      <div className="w-4 h-2 border-2 border-dashed border-green-400 rounded-sm"></div>
                      <span>Ground Truth (Dashed)</span>
                  </div>
              </div>
          )}
        </div>
      </div>

      <div>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4 pb-2 border-b-2 border-slate-700">
            <h3 className="text-2xl font-bold text-cyan-400">Analysis Details</h3>
            {analysis.defects.length > 0 && (
                <div className="flex items-center gap-3">
                    <button
                        onClick={handleExportCSV}
                        disabled={isExporting}
                        className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 font-semibold rounded-lg shadow-md transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <DownloadIcon className="w-4 h-4" />
                        Export CSV
                    </button>
                    <button
                        onClick={handleExportPDF}
                        disabled={isExporting}
                        className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-lg shadow-lg transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                       <DownloadIcon className="w-4 h-4" />
                       {isExporting ? 'Generating...' : 'Export PDF'}
                    </button>
                </div>
            )}
        </div>
        {analysis.defects.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {analysis.defects.map((defect, index) => (
              <ResultCard key={index} defect={defect} />
            ))}
          </div>
        ) : (
          <div className="text-center py-10 px-6 bg-slate-800 rounded-lg">
            <p className="text-slate-400">No defects were detected in the provided image.</p>
          </div>
        )}
      </div>
    </div>
  );
};
