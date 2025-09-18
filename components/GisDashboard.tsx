import React, { useMemo, useState, useEffect, useRef } from 'react';
import type { Defect } from '../types';
import { BackIcon, MapIcon } from './IconComponents';
import { Spinner } from './Spinner';

// Import ArcGIS types dynamically later
type MapView = import('@arcgis/core/views/MapView').default;

const StatCard: React.FC<{ title: string; value?: string | number; children?: React.ReactNode }> = ({ title, value, children }) => (
    <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
        <p className="text-sm font-semibold text-slate-400">{title}</p>
        {value !== undefined && <p className="text-3xl font-bold text-cyan-400">{value}</p>}
        {children}
    </div>
);

const GisMap: React.FC<{ defects: Defect[] }> = ({ defects }) => {
    const mapRef = useRef<HTMLDivElement>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const locatedDefects = useMemo(() => defects.filter(d => d.location), [defects]);
    const pointColorMap = useMemo(() => ({
        'Pothole': '#ef4444', 'Rutting': '#22c55e', 'Alligator Crack': '#3b82f6',
        'Longitudinal Crack': '#f97316', 'Transverse Crack': '#14b8a6', 'Block Crack': '#8b5cf6',
        'Roughness': '#eab308', 'Distress': '#6366f1',
    }), []);
    
    useEffect(() => {
        let view: MapView;

        if (mapRef.current && locatedDefects.length > 0) {
            import('@arcgis/core/Map.js')
            .then(({default: Map}) => import('@arcgis/core/views/MapView.js').then(({default: MapView}) => ({ Map, MapView })))
            .then(({ Map, MapView }) => import('@arcgis/core/layers/GraphicsLayer.js').then(({default: GraphicsLayer}) => ({ Map, MapView, GraphicsLayer })))
            .then(({ Map, MapView, GraphicsLayer }) => import('@arcgis/core/Graphic.js').then(({default: Graphic}) => ({ Map, MapView, GraphicsLayer, Graphic })))
            .then(({ Map, MapView, GraphicsLayer, Graphic }) => {
                
                const graphicsLayer = new GraphicsLayer();

                const graphics = locatedDefects.map(defect => {
                    const point = {
                        type: "point",
                        longitude: defect.location!.longitude,
                        latitude: defect.location!.latitude
                    };

                    const simpleMarkerSymbol = {
                        type: "simple-marker",
                        color: pointColorMap[defect.type] || '#ef4444',
                        outline: { color: [255, 255, 255], width: 1 }
                    };

                    const popupTemplate = {
                        title: "{type}",
                        content: `
                          <div style="font-family: sans-serif; color: #111827;">
                            {severity:formatString}
                            <p style="margin: 0; white-space: pre-wrap; word-wrap: break-word;">{description}</p>
                            <p style="margin-top: 8px; font-size: 0.8rem; color: #4b5563;">
                              Lat: {latitude}, Lng: {longitude}
                            </p>
                          </div>
                        `,
                        fieldInfos: [{
                          fieldName: "severity",
                          format: {
                            // Custom function to format severity, only showing if it exists
                            formatString: (value: string) => {
                               return value && value !== 'N/A' ? `<p style="margin: 0 0 4px;"><strong>Severity:</strong> ${value}</p>` : '';
                            }
                          }
                        }]
                    };

                    return new Graphic({
                        geometry: point as any,
                        symbol: simpleMarkerSymbol as any,
                        attributes: {
                            type: defect.type,
                            severity: defect.severity || 'N/A',
                            description: defect.description,
                            latitude: defect.location!.latitude.toFixed(5),
                            longitude: defect.location!.longitude.toFixed(5),
                        },
                        popupTemplate: popupTemplate
                    });
                });

                graphicsLayer.addMany(graphics);

                const map = new Map({
                    basemap: "dark-gray-vector",
                    layers: [graphicsLayer]
                });

                view = new MapView({
                    container: mapRef.current!,
                    map: map,
                });

                view.when(() => {
                    view.goTo(graphics).catch(err => console.error("Zoom failed:", err));
                    setIsLoading(false);
                });
                
            }).catch(err => {
                console.error("Failed to load ArcGIS modules", err);
                setError("Failed to load map components. Please check your network connection and refresh.");
                setIsLoading(false);
            });
        } else {
            setIsLoading(false); // No defects to show, not loading.
        }

        return () => {
            if (view) {
                // cleanup the view
                view.destroy();
            }
        };

    }, [locatedDefects, pointColorMap]);

    if (error) {
        return <div className="aspect-video w-full bg-slate-800 rounded-lg flex items-center justify-center text-red-400 p-4 text-center">{error}</div>;
    }

    if (locatedDefects.length === 0 && !isLoading) {
        return <div className="aspect-video w-full bg-slate-800 rounded-lg flex items-center justify-center text-slate-500">No location data to display on map.</div>;
    }

    return (
        <div className="aspect-video w-full bg-slate-800 rounded-lg relative">
            {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center z-10 bg-slate-800/80">
                    <Spinner />
                    <span className="ml-2 text-slate-300">Loading Map...</span>
                </div>
            )}
            <div ref={mapRef} className="w-full h-full rounded-lg" />
        </div>
    );
};

interface GisDashboardProps {
    defects: Defect[];
    onBack: () => void;
}

export const GisDashboard: React.FC<GisDashboardProps> = ({ defects, onBack }) => {

    const stats = useMemo(() => {
        const severityCounts = { Low: 0, Medium: 0, High: 0 };
        const typeCounts: { [key: string]: number } = {};

        defects.forEach(defect => {
            if (defect.severity) {
                severityCounts[defect.severity]++;
            }
            typeCounts[defect.type] = (typeCounts[defect.type] || 0) + 1;
        });

        return { severityCounts, typeCounts };
    }, [defects]);

    return (
        <div className="p-6 md:p-8 space-y-8">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <MapIcon className="w-8 h-8 text-cyan-400" />
                    <h2 className="text-2xl md:text-3xl font-bold text-cyan-400">GIS Session Dashboard</h2>
                </div>
                <button onClick={onBack} className="inline-flex items-center justify-center gap-2 px-6 py-2 bg-slate-600 hover:bg-slate-500 text-white font-bold rounded-lg shadow-lg">
                    <BackIcon className="w-5 h-5" />
                    Back to Analysis
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <StatCard title="Total Defects Detected" value={defects.length} />
                <StatCard title="Severity Breakdown">
                    <div className="flex justify-around mt-2">
                        <div className="text-center"><p className="font-bold text-lg text-green-400">{stats.severityCounts.Low}</p><p className="text-xs text-slate-400">Low</p></div>
                        <div className="text-center"><p className="font-bold text-lg text-yellow-400">{stats.severityCounts.Medium}</p><p className="text-xs text-slate-400">Medium</p></div>
                        <div className="text-center"><p className="font-bold text-lg text-red-400">{stats.severityCounts.High}</p><p className="text-xs text-slate-400">High</p></div>
                    </div>
                </StatCard>
                <StatCard title="Defect Types" value={Object.keys(stats.typeCounts).length} />
            </div>

            <div>
                <h3 className="text-xl font-bold text-slate-200 mb-3">Defect Location Map</h3>
                <GisMap defects={defects} />
            </div>

            <div>
                 <h3 className="text-xl font-bold text-slate-200 mb-3">Session Data Table</h3>
                 <div className="max-h-96 overflow-y-auto bg-slate-800/50 rounded-lg border border-slate-700">
                    <table className="w-full text-sm text-left text-slate-300">
                        <thead className="text-xs text-cyan-300 uppercase bg-slate-900/70 sticky top-0">
                            <tr>
                                <th scope="col" className="px-4 py-3">Type</th>
                                <th scope="col" className="px-4 py-3">Severity</th>
                                <th scope="col" className="px-4 py-3">Location (Lat, Lng)</th>
                                <th scope="col" className="px-4 py-3">Dimensions (m)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {defects.map((defect, index) => (
                                <tr key={index} className="border-b border-slate-700 hover:bg-slate-700/50">
                                    <td className="px-4 py-2 font-semibold">{defect.type}</td>
                                    <td className="px-4 py-2">{defect.severity || 'N/A'}</td>
                                    <td className="px-4 py-2">{defect.location ? `${defect.location.latitude.toFixed(5)}, ${defect.location.longitude.toFixed(5)}` : 'N/A'}</td>
                                    <td className="px-4 py-2">{defect.dimensions ? `${defect.dimensions.length_m.toFixed(2)} x ${defect.dimensions.width_m.toFixed(2)}` : 'N/A'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                 </div>
            </div>
        </div>
    );
};