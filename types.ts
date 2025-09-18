
export interface Location {
  latitude: number;
  longitude: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface BoundingBox {
  x_min: number;
  y_min: number;
  x_max: number;
  y_max: number;
}

export interface Dimensions {
  length_m: number; // in meters
  width_m: number; // in meters
  depth_m?: number; // Estimated depth for potholes, in meters
}

export interface Defect {
  type: 'Pothole' | 'Rutting' | 'Alligator Crack' | 'Roughness' | 'Distress' | 'Longitudinal Crack' | 'Transverse Crack' | 'Block Crack';
  boundingBox: BoundingBox;
  segmentationPolygon?: Point[]; // Added for Deep Segmentation
  centerlinePath?: Point[]; // Added for Crack Path Analysis
  dimensions?: Dimensions;
  area_sq_m?: number; // in square meters
  volume_m3?: number; // Volume in cubic meters
  severity?: 'Low' | 'Medium' | 'High';
  description: string;
  confidence?: number;
  location?: Location;
  perimeter_m?: number; // For high-fidelity segmentation, in meters
  circularity?: number; // For high-fidelity segmentation
  instanceId?: number; // For Instance Segmentation
}

export interface GroundTruthDefect {
  type: string;
  boundingBox: BoundingBox;
}

export interface ClassMetrics {
    tp: number;
    fp: number;
    fn: number;
    precision: number;
    recall: number;
    f1Score: number;
    totalGroundTruth: number;
}

export interface ValidationMetrics {
  matches: number; // True Positives
  misses: number; // False Negatives
  falsePositives: number; // False Positives
  averageIou: number;
  precision: number;
  recall: number;
  f1Score: number;
  perClassMetrics: Record<string, ClassMetrics>;
}


export interface AnalysisResult {
  defects: Defect[];
  location?: Location;
  pothole_count?: number; // For instance segmentation
  pothole_density_sq_m?: number; // For instance segmentation
  groundTruth?: GroundTruthDefect[];
  validationMetrics?: ValidationMetrics;
}

export interface AreaHealthAssessment extends AnalysisResult {
  pciScore: number; // Pavement Condition Index (0-100)
  summary: string;
  potentialCauses: string[];
  recommendations: string[];
}

export interface SatelliteAnalysisResult {
  location_analyzed: string;
  assessmentSummary: string;
  slabSettlement_mm_yr: number;
  deteriorationIndex: number; // Score out of 10
  subsurfaceMoistureRisk: 'Low' | 'Medium' | 'High';
}

export interface VideoDefect extends Defect {
  timestamp: number; // in seconds from video start
}

export interface GpxPoint {
  lat: number;
  lon: number;
  time: Date;
}

// FIX: Added ResearchSource and ResearchResult types for the research feature.
export interface ResearchSource {
  web?: {
    uri: string;
    title: string;
  };
}

export interface ResearchResult {
  answer: string;
  sources: ResearchSource[];
}
