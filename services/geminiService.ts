import { GoogleGenerativeAI } from "@google/generative-ai";
import type { AnalysisResult, SatelliteAnalysisResult, AreaHealthAssessment, Defect } from '../types';

if (!process.env.API_KEY) {
  throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * A wrapper for the Gemini API call that includes a retry mechanism with exponential backoff.
 * This helps gracefully handle 429 rate limit errors.
 * @param params The parameters for the generateContent call.
 * @param maxRetries The maximum number of times to retry the request.
 * @param initialDelay The initial delay in milliseconds before the first retry.
 * @returns The response from the AI model.
 */
async function generateContentWithRetry(
    params: any,
    maxRetries = 3,
    initialDelay = 2000 // Start with a 2-second delay
) {
    let attempt = 0;
    while (attempt <= maxRetries) {
        try {
            const response = await ai.models.generateContent(params);
            return response;
        } catch (error: any) {
            // The @google/genai SDK often includes the status code in the error's string representation.
            const isRateLimitError = error.toString().includes('429');

            if (isRateLimitError && attempt < maxRetries) {
                attempt++;
                // Exponential backoff with jitter to prevent multiple clients from retrying simultaneously
                const delay = initialDelay * Math.pow(2, attempt - 1) + Math.random() * 1000;
                console.warn(`Gemini API rate limit hit. Retrying in ${Math.round(delay)}ms... (Attempt ${attempt}/${maxRetries})`);
                await new Promise(resolve => setTimeout(resolve, delay));
            } else {
                if (isRateLimitError) {
                     console.error(`Gemini API rate limit exceeded. Final attempt failed.`, error);
                     throw new Error("API rate limit exceeded. The application made too many requests. Please wait a moment and try again.");
                }
                // Not a rate limit error, or max retries reached, re-throw it.
                throw error;
            }
        }
    }
    // This part should be unreachable, but it satisfies TypeScript's requirement for a return path.
    throw new Error("Failed to get a response from the AI model after multiple retries.");
}


const getResponseSchema = (
    isDeepScan: boolean, 
    isCrackPathAnalysis: boolean, 
    isHealthAnalysis: boolean, 
    isRealTime: boolean,
    isFidelitySegmentation: boolean,
    isInstanceSegmentation: boolean
) => {
    
    const dimensionsProperties: any = {
        length_m: { type: Type.NUMBER, description: "Estimated real-world length in meters." },
        width_m: { type: Type.NUMBER, description: "Estimated real-world width in meters." },
        depth_m: { 
            type: Type.NUMBER,
            description: "Estimated real-world depth in meters. This value is an estimation from visual cues."
        }
    };
    
    const defectProperties: any = {
        type: {
            type: Type.STRING,
            description: "The type of defect.",
            enum: ['Pothole', 'Rutting', 'Alligator Crack', 'Roughness', 'Distress', 'Longitudinal Crack', 'Transverse Crack', 'Block Crack']
        },
        confidence: {
            type: Type.NUMBER,
            description: "The model's confidence score for this detection, from 0.0 to 1.0."
        },
        boundingBox: {
            type: Type.OBJECT,
            description: "Bounding box coordinates as percentages of image dimensions.",
            properties: {
                x_min: { type: Type.NUMBER },
                y_min: { type: Type.NUMBER },
                x_max: { type: Type.NUMBER },
                y_max: { type: Type.NUMBER }
            },
            required: ["x_min", "y_min", "x_max", "y_max"]
        },
        dimensions: {
            type: Type.OBJECT,
            description: "Estimated real-world dimensions in meters. For Potholes, this includes length, width, and depth. For Cracks, this is total length and average width.",
            properties: dimensionsProperties
        },
        area_sq_m: {
            type: Type.NUMBER,
            description: "Calculated area in square meters. Primarily for Potholes."
        },
        volume_m3: {
            type: Type.NUMBER,
            description: "Calculated volume in cubic meters (m³). This value is an estimation from visual cues."
        },
        severity: {
            type: Type.STRING,
            description: "Severity classification for Potholes and Cracks.",
            enum: ['Low', 'Medium', 'High']
        },
        description: {
            type: Type.STRING,
            description: "A brief description of the detected defect."
        },
        instanceId: {
            type: Type.NUMBER,
            description: "A unique identifier for each instance of a countable object ('thing')."
        }
    };
    
    // In real-time, we want most of the data, but segmentation and crack path are too slow.
    if (isRealTime) {
        return {
             type: Type.OBJECT,
             properties: {
                 defects: {
                     type: Type.ARRAY,
                     description: "A list of all detected road defects in the video frame.",
                     items: {
                         type: Type.OBJECT,
                         properties: defectProperties,
                         // Make detailed analysis optional for the model to prioritize speed if needed, but the prompt will ask for it.
                         required: ["type", "boundingBox", "description", "confidence"]
                     }
                 }
             },
             required: ["defects"]
        };
    }

    if (isInstanceSegmentation) {
        return {
            type: Type.OBJECT,
            properties: {
                defects: { // These are the "things"
                    type: Type.ARRAY,
                    description: "A list of all detected countable road defects ('things'). Each must have an instanceId.",
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            ...defectProperties,
                            segmentationPolygon: { // Instance always requires segmentation
                                type: Type.ARRAY,
                                description: "An array of {x, y} points representing the precise polygon outline of the defect.",
                                items: {
                                    type: Type.OBJECT,
                                    properties: { x: { type: Type.NUMBER }, y: { type: Type.NUMBER } },
                                    required: ["x", "y"]
                                }
                            }
                        },
                        required: ["type", "boundingBox", "description", "confidence", "segmentationPolygon", "instanceId"]
                    }
                },
                pothole_count: { type: Type.NUMBER, description: "Total number of individual pothole instances detected in the image." },
                pothole_density_sq_m: { type: Type.NUMBER, description: "Estimated number of potholes per square meter of the visible road surface." },
            },
            required: ["defects", "pothole_count", "pothole_density_sq_m"]
        };
    }


    if (isDeepScan || isFidelitySegmentation) {
        defectProperties.segmentationPolygon = {
            type: Type.ARRAY,
            description: "An array of {x, y} points representing the precise polygon outline of the defect. Coordinates are percentages (0.0 to 1.0) of image dimensions.",
            items: {
                type: Type.OBJECT,
                properties: {
                    x: { type: Type.NUMBER, description: "X-coordinate as a percentage (0.0 to 1.0)" },
                    y: { type: Type.NUMBER, description: "Y-coordinate as a percentage (0.0 to 1.0)" }
                },
                required: ["x", "y"]
            }
        };
    }

    if (isCrackPathAnalysis) {
        defectProperties.centerlinePath = {
            type: Type.ARRAY,
            description: "An array of {x, y} points representing the simplified centerline/skeleton of a crack. Coordinates are percentages (0.0 to 1.0) of image dimensions.",
            items: {
                type: Type.OBJECT,
                properties: {
                    x: { type: Type.NUMBER, description: "X-coordinate as a percentage (0.0 to 1.0)" },
                    y: { type: Type.NUMBER, description: "Y-coordinate as a percentage (0.0 to 1.0)" }
                },
                required: ["x", "y"]
            }
        };
    }

    const defectRequiredFields = ["type", "boundingBox", "description", "confidence"];
    if (isDeepScan || isFidelitySegmentation) {
        defectRequiredFields.push("segmentationPolygon");
    }

    const schemaProperties: any = {
        defects: {
            type: Type.ARRAY,
            description: "A list of all detected road defects.",
            items: {
                type: Type.OBJECT,
                properties: defectProperties,
                required: defectRequiredFields
            }
        }
    };
    
    const rootRequiredFields = ["defects"];

    if (isHealthAnalysis) {
        schemaProperties.pciScore = { type: Type.NUMBER, description: "Estimated Pavement Condition Index (PCI) score from 0 (failed) to 100 (excellent)." };
        schemaProperties.summary = { type: Type.STRING, description: "A concise, expert summary of the overall pavement condition." };
        schemaProperties.potentialCauses = { type: Type.ARRAY, items: { type: Type.STRING }, description: "A list of potential root causes for the observed distresses." };
        schemaProperties.recommendations = { type: Type.ARRAY, items: { type: Type.STRING }, description: "A list of recommended maintenance or repair actions." };
        rootRequiredFields.push("pciScore", "summary", "potentialCauses", "recommendations");
    }

    return {
        type: Type.OBJECT,
        properties: schemaProperties,
        required: rootRequiredFields
    };
};


export async function analyzeRoadImage(
    base64Image: string, 
    mimeType: string, 
    isDeepScan: boolean, 
    isCrackPathAnalysis: boolean, 
    isHealthAnalysis: boolean,
    isRealTime: boolean = false,
    isFidelitySegmentation: boolean = false,
    isInstanceSegmentation: boolean = false,
    targetDefects?: string[]
): Promise<AnalysisResult | AreaHealthAssessment> {

    const realTimePromptAddition = `
        IMPORTANT: You are in Video Frame Analysis mode. Your primary goal is maximum precision and detail.
        Analyze this single video frame as if you were a meticulous on-site inspector.
        For each detected defect, you MUST provide a comprehensive set of data:
        - A precise bounding box.
        - A confidence score.
        - A clear, descriptive text of the defect.
        - Estimated real-world dimensions (length, width, depth in m), area (sq_m), and volume (m³) where applicable.
        - A severity classification ('Low', 'Medium', 'High').
        Do NOT prioritize speed over accuracy; thoroughness is paramount. Base your estimations for depth and volume on visual cues like shadows and perspective.
    `;
    
    const detailedAnalysisPromptAddition = `
        IMPORTANT: You are in Detailed Analysis mode. Your analysis must be highly comprehensive.
        - For EVERY detected defect, you MUST provide a 'segmentationPolygon'. This polygon must be precise, tracing the exact pixel-level boundary.
        - ADDITIONALLY, for each defect identified as a crack ('Alligator Crack', 'Longitudinal Crack', 'Transverse Crack', 'Block Crack'), you MUST also provide a 'centerlinePath', which is a simplified line representing the main path of the crack.
        - For all defects, provide standard analysis like boundingBox, dimensions, and severity.
    `;

    const fidelitySegmentationPromptAddition = `
        IMPORTANT: You are in High-Fidelity Pothole Segmentation mode.
        Your primary task is to act as a highly specialized U-Net computer vision model trained exclusively for pothole segmentation.
        - You MUST focus ONLY on defects of type 'Pothole'. Ignore all other defect types like cracks or rutting.
        - For each detected pothole, you MUST provide a 'segmentationPolygon'. This polygon must be extremely precise, tracing the exact pixel-level boundary of the pothole, similar to the output of a U-Net model.
        - Provide a standard 'boundingBox' as well.
        - Your response must be highly accurate and focused.
    `;

    const crackPathPromptAddition = `
        IMPORTANT: You are in Crack Path Analysis mode.
        For each defect identified as a crack ('Alligator Crack', 'Longitudinal Crack', 'Transverse Crack', 'Block Crack'), you MUST provide a 'centerlinePath'.
        The 'centerlinePath' is an array of {x, y} point objects that trace the skeleton or centerline of the crack. This should be a simplified line representing the main path of the crack, not its full outline.
        The coordinates must be percentages of the image's dimensions (from 0.0 to 1.0).
        For non-crack defects like 'Pothole', this 'centerlinePath' field should be omitted.
    `;
    
    const healthPromptAddition = `
        IMPORTANT: You are in Area Health Assessment mode.
        In addition to identifying individual defects, you MUST provide a holistic assessment of the entire road section shown in the image.
        Provide the following in the root of the JSON object:
        - "pciScore": An estimated Pavement Condition Index score from 0 (failed) to 100 (excellent).
        - "summary": A concise, expert summary of the overall pavement condition.
        - "potentialCauses": A list of potential root causes for the observed distress (e.g., "Sub-base failure due to moisture", "Material fatigue").
        - "recommendations": A list of recommended maintenance or repair actions (e.g., "Mill and overlay", "Full-depth patching", "Crack sealing").
    `;

    const instancePromptAddition = `
        IMPORTANT: You must perform an INSTANCE SEGMENTATION of the road defects.
        Your task is to identify and outline every individual instance of a defect.
        
        The final JSON output MUST contain a 'defects' array and root-level keys for pothole statistics.

        1.  "defects" array: This is for countable objects ("things").
            - The "thing" classes are: 'Pothole', 'Rutting', 'Alligator Crack', 'Longitudinal Crack', 'Transverse Crack', 'Block Crack', 'Roughness', 'Distress'.
            - For EACH detected instance, you MUST provide:
                - A precise 'segmentationPolygon'.
                - A unique 'instanceId' (integer, e.g., 1, 2, 3...).
                - A 'boundingBox', 'type', 'description', and 'confidence'.
        
        2. "Pothole Statistics" (at the root of the JSON):
            - "pothole_count": The total number of individual pothole instances detected.
            - "pothole_density_sq_m": An estimation of the number of potholes per square meter of visible road surface in the image.

        Do NOT identify or segment amorphous background regions like 'Road' or 'Sky'. Focus only on the defect instances.
    `;

    const targetDefectsPromptAddition = (targetDefects && targetDefects.length > 0)
    ? `
IMPORTANT: Focus your analysis ONLY on the following defect types: ${targetDefects.join(', ')}. Ignore all other types of road distress.`
    : '';

    let modeSpecificPrompt = "";
    if (isInstanceSegmentation) {
        modeSpecificPrompt = instancePromptAddition;
    } else if (isFidelitySegmentation && isCrackPathAnalysis) {
        modeSpecificPrompt = detailedAnalysisPromptAddition;
    } else if (isFidelitySegmentation) {
        modeSpecificPrompt = fidelitySegmentationPromptAddition;
    } else if (isCrackPathAnalysis) {
        modeSpecificPrompt = crackPathPromptAddition;
    }
    
    if (isHealthAnalysis) {
        modeSpecificPrompt += `\n${healthPromptAddition}`;
    }

    const basePrompt = `
        You are an expert civil engineer specializing in road infrastructure assessment using advanced computer vision techniques.
        Analyze the provided image of a road surface. Your task is to identify and locate all instances of road distress and segment the entire scene.
        For every defect you identify, you MUST provide a 'confidence' score between 0.0 and 1.0, representing your certainty in the detection.
        ${targetDefectsPromptAddition}
        ${isRealTime ? realTimePromptAddition : modeSpecificPrompt}
        
        ${!isRealTime ? `
            For defects of type 'Pothole', you MUST also provide:
            - Estimated real-world dimensions (length_m, width_m, depth_m).
            - Calculated area_sq_m.
            - Calculated volume_m3 (in cubic meters).
            - A severity classification.
            Base your estimations for depth and volume on visual cues like shadows and perspective.

            For defect types 'Alligator Crack', 'Longitudinal Crack', 'Transverse Crack', and 'Block Crack', you MUST also provide estimated real-world dimensions (total length, average width) in meters and a severity classification.
            For other defect types, these measurement fields can be omitted.
        ` : ""}
        
        The defect types to identify are: 'Pothole', 'Rutting', 'Alligator Crack', 'Longitudinal Crack', 'Transverse Crack', 'Block Crack', 'Roughness', 'Distress'.
        
        Return your findings as a structured JSON object according to the provided schema. Bounding boxes are always required for all defects.
    `;

    const config: any = {
        responseMimeType: "application/json",
        responseSchema: getResponseSchema(isDeepScan, isCrackPathAnalysis, isHealthAnalysis, isRealTime, isFidelitySegmentation, isInstanceSegmentation),
    };

    if (isRealTime) {
        config.thinkingConfig = { thinkingBudget: 0 };
    }

    try {
        const response = await generateContentWithRetry({
            model: 'gemini-2.5-flash',
            contents: {
                parts: [
                    { inlineData: { data: base64Image, mimeType: mimeType } },
                    { text: basePrompt }
                ]
            },
            config: config
        });

        const jsonText = response.text.trim();
        const result: AnalysisResult | AreaHealthAssessment = JSON.parse(jsonText);
        
        if (isFidelitySegmentation && result.defects) {
            for (const defect of result.defects) {
                if (defect.segmentationPolygon && defect.segmentationPolygon.length > 2 && defect.dimensions && defect.area_sq_m) {
                    const { length_m, width_m } = defect.dimensions;
                    const { x_min, y_min, x_max, y_max } = defect.boundingBox;
        
                    const bbox_w_pct = x_max - x_min;
                    const bbox_h_pct = y_max - y_min;
        
                    if (bbox_w_pct > 0 && bbox_h_pct > 0) {
                        const scale_x = length_m / bbox_w_pct;
                        const scale_y = width_m / bbox_h_pct;
        
                        let perimeter_m = 0;
                        for (let i = 0; i < defect.segmentationPolygon.length; i++) {
                            const p1 = defect.segmentationPolygon[i];
                            const p2 = defect.segmentationPolygon[(i + 1) % defect.segmentationPolygon.length]; 
        
                            const dx_m = (p2.x - p1.x) * scale_x;
                            const dy_m = (p2.y - p1.y) * scale_y;
        
                            perimeter_m += Math.sqrt(dx_m * dx_m + dy_m * dy_m);
                        }
        
                        defect.perimeter_m = perimeter_m;
                        
                        if (perimeter_m > 0) {
                            const circularity = (4 * Math.PI * defect.area_sq_m) / (perimeter_m * perimeter_m);
                            defect.circularity = Math.max(0, Math.min(1, circularity));
                        }
                    }
                }
            }
        }
        
        if (isInstanceSegmentation) {
             if (!result.defects || !Array.isArray(result.defects) || typeof result.pothole_count !== 'number') {
                throw new Error("Invalid response for Instance Segmentation. 'defects' array or 'pothole_count' not found.");
            }
        } else if (isHealthAnalysis) {
             const healthResult = result as AreaHealthAssessment;
             if (typeof healthResult.pciScore !== 'number' || !healthResult.summary || !Array.isArray(healthResult.defects)) {
                 throw new Error("Invalid response format for Health Assessment.");
             }
             return healthResult;
        } else if (!isHealthAnalysis && (!result.defects || !Array.isArray(result.defects))) {
            throw new Error("Invalid response format from AI. 'defects' array not found.");
        }

        return result as AnalysisResult;

    } catch (error) {
        console.error("Error during Gemini API call or processing:", error);
        if (error instanceof Error) {
            // Check for network errors, which are separate from API errors
            if (error.message.toLowerCase().includes('failed to fetch')) {
              throw new Error("Network error. Please check your internet connection and try again.");
            }
            // Rethrow API errors (including our custom rate limit error)
            throw error;
        }
        // Fallback for non-Error objects
        throw new Error("An unexpected error occurred during analysis.");
    }
}

const satelliteResponseSchema = {
    type: Type.OBJECT,
    properties: {
        location_analyzed: {
            type: Type.STRING,
            description: "The location that was analyzed, based on user input."
        },
        assessmentSummary: {
            type: Type.STRING,
            description: "A detailed assessment summary based on simulated satellite data (PS-InSAR, SAR, TIR, multispectral). This should explain the findings for slab settlement, deterioration, and moisture risk."
        },
        slabSettlement_mm_yr: {
            type: Type.NUMBER,
            description: "The consistent annual slab settlement rate in mm/year. Negative values indicate subsidence."
        },
        deteriorationIndex: {
            type: Type.NUMBER,
            description: "A score from 0.0 to 10.0 quantifying the pavement's distress level. Higher values mean more severe deterioration."
        },
        subsurfaceMoistureRisk: {
            type: Type.STRING,
            description: "The classified risk ('Low', 'Medium', 'High') of damaging moisture beneath the pavement slabs.",
            enum: ['Low', 'Medium', 'High']
        }
    },
    required: ["location_analyzed", "assessmentSummary", "slabSettlement_mm_yr", "deteriorationIndex", "subsurfaceMoistureRisk"]
};


export async function analyzeSatelliteData(location: string): Promise<SatelliteAnalysisResult> {
    const prompt = `
        You are an expert in remote sensing and civil engineering, specializing in advanced pavement analysis for rigid pavements using satellite data.
        Based on the provided location: "${location}", your task is to simulate a detailed assessment using advanced sensors like PS-InSAR, SAR, TIR, and multispectral data.

        Your response must provide the following key metrics and a detailed summary:
        - "assessmentSummary": A detailed summary explaining the findings. Mention the data sources (PS-InSAR, SAR, TIR, Multispectral) and what they indicate about slab settlement, surface degradation (cracking/spalling), and subsurface moisture.
        - "slabSettlement_mm_yr": The consistent annual slab settlement rate in mm/year. A typical value might be around -1.50. Negative values indicate subsidence. This is derived from simulated PS-InSAR data.
        - "deteriorationIndex": A score from 0.0 to 10.0 quantifying the pavement's distress. A typical value for moderate distress could be 6.2. This is derived from temporal coherence analysis of SAR data.
        - "subsurfaceMoistureRisk": Classify the likelihood ('Low', 'Medium', or 'High') of damaging moisture beneath the pavement, particularly at joints. This is derived from combined SAR and TIR analysis.

        Generate a plausible but simulated report based on these advanced techniques. Return the data in a structured JSON object according to the provided schema.
    `;
    
    try {
        const response = await generateContentWithRetry({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: satelliteResponseSchema,
            }
        });

        const jsonText = response.text.trim();
        const result = JSON.parse(jsonText);
        
        if (typeof result.slabSettlement_mm_yr !== 'number' || typeof result.deteriorationIndex !== 'number' || !result.subsurfaceMoistureRisk) {
            throw new Error("Invalid response format from AI. Key satellite metrics are missing.");
        }

        return result as SatelliteAnalysisResult;

    } catch (error) {
        console.error("Error calling Gemini API for satellite analysis:", error);
         if (error instanceof Error) {
            if (error.message.toLowerCase().includes('failed to fetch')) {
                throw new Error("Network error. Please check your internet connection and try again.");
            }
            throw error;
        }
        throw new Error("Failed to get a valid analysis from the AI model.");
    }
}
