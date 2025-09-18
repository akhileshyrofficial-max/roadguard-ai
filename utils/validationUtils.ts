import type { Defect, GroundTruthDefect, ValidationMetrics, BoundingBox, ClassMetrics } from '../types';

/**
 * Calculates the Intersection over Union (IoU) of two bounding boxes.
 * Bounding boxes are expected to be in percentage coordinates (0.0 to 1.0).
 */
function calculateIou(boxA: BoundingBox, boxB: BoundingBox): number {
    const xA = Math.max(boxA.x_min, boxB.x_min);
    const yA = Math.max(boxA.y_min, boxB.y_min);
    const xB = Math.min(boxA.x_max, boxB.x_max);
    const yB = Math.min(boxA.y_max, boxB.y_max);

    const interWidth = xB - xA;
    const interHeight = yB - yA;

    if (interWidth <= 0 || interHeight <= 0) {
        return 0;
    }

    const interArea = interWidth * interHeight;
    const boxAArea = (boxA.x_max - boxA.x_min) * (boxA.y_max - boxA.y_min);
    const boxBArea = (boxB.x_max - boxB.x_min) * (boxB.y_max - boxB.y_min);

    const iou = interArea / (boxAArea + boxBArea - interArea);
    return iou;
}

/**
 * Normalizes AI defect types for comparison with simpler ground truth labels.
 * E.g., 'Alligator Crack' becomes 'Crack'.
 */
function normalizeAiType(type: Defect['type']): string {
    const lowerType = type.toLowerCase();
    if (lowerType.includes('crack')) return 'Crack';
    if (lowerType.includes('pothole')) return 'Pothole';
    // Add other normalizations if needed
    return type;
}

/**
 * Helper to calculate precision, recall, and F1-score.
 */
const calculatePrf = (tp: number, fp: number, fn: number) => {
    const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
    const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
    const f1Score = precision + recall > 0 ? 2 * (precision * recall) / (precision + recall) : 0;
    return { precision, recall, f1Score };
};

/**
 * Compares AI detections with ground truth annotations to calculate validation metrics.
 * @param aiDefects - Array of defects detected by the AI.
 * @param gtDefects - Array of ground truth defects from annotations.
 * @param iouThreshold - The IoU threshold to consider a detection a match.
 * @returns A ValidationMetrics object.
 */
export function compareDetections(
    aiDefects: Defect[], 
    gtDefects: GroundTruthDefect[], 
    iouThreshold = 0.5
): ValidationMetrics {
    const matchedGtIndices = new Set<number>();
    const perClassData: Record<string, {
        tp: number;
        fp: number;
        fn: number;
        iouSum: number;
        totalGroundTruth: number;
    }> = {};

    // Get all unique classes from both ground truth and AI predictions
    // Normalize GT types for consistent grouping (e.g., 'pothole' -> 'Pothole')
    const gtClasses = new Set(gtDefects.map(d => d.type.charAt(0).toUpperCase() + d.type.slice(1).toLowerCase()));
    const aiClasses = new Set(aiDefects.map(d => normalizeAiType(d.type)));
    const allClasses = new Set([...gtClasses, ...aiClasses]);

    // Initialize per-class data
    for (const className of allClasses) {
        perClassData[className] = {
            tp: 0,
            fp: 0,
            fn: 0,
            iouSum: 0,
            totalGroundTruth: gtDefects.filter(d => d.type.charAt(0).toUpperCase() + d.type.slice(1).toLowerCase() === className).length
        };
    }
    
    // Calculate True Positives and False Positives
    aiDefects.forEach(aiDefect => {
        const aiType = normalizeAiType(aiDefect.type);
        let bestMatch = { iou: -1, gtIndex: -1 };

        gtDefects.forEach((gtDefect, gtIndex) => {
            const gtType = gtDefect.type.charAt(0).toUpperCase() + gtDefect.type.slice(1).toLowerCase();
            // Check if this GT defect has been matched, and if types match
            if (!matchedGtIndices.has(gtIndex) && gtType === aiType) {
                const iou = calculateIou(aiDefect.boundingBox, gtDefect.boundingBox);
                if (iou > bestMatch.iou) {
                    bestMatch = { iou, gtIndex };
                }
            }
        });

        if (bestMatch.iou >= iouThreshold) {
            // This is a True Positive for this class
            perClassData[aiType].tp++;
            perClassData[aiType].iouSum += bestMatch.iou;
            matchedGtIndices.add(bestMatch.gtIndex);
        } else {
            // This is a False Positive for this class
            if(perClassData[aiType]) { // It's possible AI detected a class not in GT
                 perClassData[aiType].fp++;
            }
        }
    });

    // Calculate False Negatives for each class by checking unmatched ground truth items
    gtDefects.forEach((gtDefect, gtIndex) => {
        if (!matchedGtIndices.has(gtIndex)) {
            const gtType = gtDefect.type.charAt(0).toUpperCase() + gtDefect.type.slice(1).toLowerCase();
            if (perClassData[gtType]) {
                perClassData[gtType].fn++;
            }
        }
    });


    // Calculate metrics for each class and overall totals
    const perClassMetrics: Record<string, ClassMetrics> = {};
    let totalTp = 0;
    let totalFp = 0;
    let totalFn = 0;
    let totalIouSum = 0;

    for (const className of allClasses) {
        const { tp, fp, fn, iouSum, totalGroundTruth } = perClassData[className];
        const { precision, recall, f1Score } = calculatePrf(tp, fp, fn);
        
        perClassMetrics[className] = { tp, fp, fn, precision, recall, f1Score, totalGroundTruth };
        
        totalTp += tp;
        totalFp += fp;
        totalFn += fn;
        totalIouSum += iouSum;
    }
    
    const overallMetrics = calculatePrf(totalTp, totalFp, totalFn);
    
    return {
        matches: totalTp,
        misses: totalFn,
        falsePositives: totalFp,
        averageIou: totalTp > 0 ? totalIouSum / totalTp : 0,
        precision: overallMetrics.precision,
        recall: overallMetrics.recall,
        f1Score: overallMetrics.f1Score,
        perClassMetrics,
    };
}
