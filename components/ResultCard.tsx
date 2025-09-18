import React from 'react';
import type { Defect } from '../types';
import { DEFECT_COLORS } from '../constants';
import { RulerIcon, AreaIcon, AlertIcon, InfoIcon, DepthIcon, VolumeIcon, LocationIcon, SegmentIcon, ConfidenceIcon, PathIcon, PerimeterIcon, CircularityIcon, LayersIcon } from './IconComponents';

interface ResultCardProps {
  defect: Defect;
}

const SeverityBadge: React.FC<{ severity: 'Low' | 'Medium' | 'High' }> = ({ severity }) => {
    const severityStyles = {
        Low: 'bg-green-500/20 text-green-300',
        Medium: 'bg-yellow-500/20 text-yellow-300',
        High: 'bg-red-500/20 text-red-400',
    };
    return (
        <span className={`px-2 py-1 text-xs font-bold rounded ${severityStyles[severity]}`}>
            {severity}
        </span>
    );
};


export const ResultCard: React.FC<ResultCardProps> = ({ defect }) => {
  const colorInfo = DEFECT_COLORS[defect.type] || DEFECT_COLORS['Distress'];

  return (
    <div className={`rounded-xl overflow-hidden bg-slate-800/70 border ${colorInfo.border} shadow-lg transition-all duration-300 hover:shadow-cyan-500/20 hover:-translate-y-1`}>
      <div className={`p-4 border-b-2 ${colorInfo.border}`}>
        <h4 className={`text-xl font-bold ${colorInfo.text}`}>{defect.type}</h4>
      </div>
      <div className="p-4 space-y-4 text-sm">
        <div className="flex items-start space-x-3">
            <InfoIcon className="w-5 h-5 text-slate-400 mt-0.5 flex-shrink-0" />
            <p className="text-slate-300"><span className="font-semibold text-slate-400">Description:</span> {defect.description}</p>
        </div>

        {typeof defect.instanceId === 'number' && (
             <div className="flex items-center space-x-3">
                <LayersIcon className="w-5 h-5 text-slate-400 flex-shrink-0"/>
                <p className="text-slate-300">
                    <span className="font-semibold text-slate-400">Instance ID:</span> #{defect.instanceId}
                </p>
            </div>
        )}

        {typeof defect.confidence === 'number' && (
             <div className="flex items-center space-x-3">
                <ConfidenceIcon className="w-5 h-5 text-slate-400 flex-shrink-0"/>
                <p className="text-slate-300">
                    <span className="font-semibold text-slate-400">Confidence:</span> {(defect.confidence * 100).toFixed(1)}%
                </p>
            </div>
        )}

        {defect.severity && (
            <div className="flex items-center space-x-3">
                <AlertIcon className="w-5 h-5 text-slate-400 flex-shrink-0"/>
                <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-400">Severity:</span>
                    <SeverityBadge severity={defect.severity} />
                </div>
            </div>
        )}

        {defect.location && (
            <div className="flex items-center space-x-3">
                 <LocationIcon className="w-5 h-5 text-slate-400 flex-shrink-0"/>
                <p className="text-slate-300">
                    <span className="font-semibold text-slate-400">Location:</span> {defect.location.latitude.toFixed(5)}, {defect.location.longitude.toFixed(5)}
                </p>
            </div>
        )}

        {defect.segmentationPolygon && !defect.perimeter_m && (
            <div className="flex items-center space-x-3">
                <SegmentIcon className="w-5 h-5 text-slate-400 flex-shrink-0" />
                <p className="text-slate-300">
                    <span className="font-semibold text-slate-400">Segmentation:</span> High-precision outline
                </p>
            </div>
        )}

        {defect.centerlinePath && (
            <div className="flex items-center space-x-3">
                <PathIcon className="w-5 h-5 text-slate-400 flex-shrink-0" />
                <p className="text-slate-300">
                    <span className="font-semibold text-slate-400">Analysis:</span> Crack path generated
                </p>
            </div>
        )}

        {defect.dimensions && (
            <div className="flex items-center space-x-3">
                 <RulerIcon className="w-5 h-5 text-slate-400 flex-shrink-0"/>
                <p className="text-slate-300">
                    <span className="font-semibold text-slate-400">Dimensions:</span> {defect.dimensions.length_m.toFixed(2)} m x {defect.dimensions.width_m.toFixed(2)} m
                </p>
            </div>
        )}

        {typeof defect.dimensions?.depth_m === 'number' && (
            <div className="flex items-center space-x-3">
                 <DepthIcon className="w-5 h-5 text-slate-400 flex-shrink-0"/>
                <p className="text-slate-300">
                    <span className="font-semibold text-slate-400">Depth:</span> {defect.dimensions.depth_m.toFixed(2)} m
                </p>
            </div>
        )}

        {typeof defect.area_sq_m === 'number' && (
            <div className="flex items-center space-x-3">
                 <AreaIcon className="w-5 h-5 text-slate-400 flex-shrink-0"/>
                <p className="text-slate-300">
                    <span className="font-semibold text-slate-400">Area:</span> {defect.area_sq_m.toFixed(2)} m²
                </p>
            </div>
        )}

        {typeof defect.volume_m3 === 'number' && (
            <div className="flex items-center space-x-3">
                 <VolumeIcon className="w-5 h-5 text-slate-400 flex-shrink-0"/>
                <p className="text-slate-300">
                    <span className="font-semibold text-slate-400">Volume:</span> {defect.volume_m3.toFixed(4)} m³
                </p>
            </div>
        )}
        
        {typeof defect.perimeter_m === 'number' && (
            <div className="border-t border-slate-700 mt-4 pt-4 space-y-3">
                <h5 className="font-bold text-slate-400 text-xs uppercase tracking-wider">Segmentation Metrics</h5>
                <div className="flex items-center space-x-3">
                     <PerimeterIcon className="w-5 h-5 text-slate-400 flex-shrink-0"/>
                    <p className="text-slate-300">
                        <span className="font-semibold text-slate-400">Perimeter:</span> {defect.perimeter_m.toFixed(2)} m
                    </p>
                </div>
                {typeof defect.circularity === 'number' && (
                    <div className="flex items-center space-x-3">
                         <CircularityIcon className="w-5 h-5 text-slate-400 flex-shrink-0"/>
                        <p className="text-slate-300">
                            <span className="font-semibold text-slate-400">Circularity:</span> {defect.circularity.toFixed(3)}
                        </p>
                    </div>
                )}
            </div>
        )}
      </div>
    </div>
  );
};