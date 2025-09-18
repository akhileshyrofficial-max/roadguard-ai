
import type { GpxPoint } from '../types';

export function parseGpx(gpxContent: string): GpxPoint[] {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(gpxContent, "application/xml");

    const errorNode = xmlDoc.querySelector("parsererror");
    if (errorNode) {
        throw new Error("Failed to parse GPX file. Please ensure it is a valid XML file.");
    }

    const trackPoints = xmlDoc.querySelectorAll("trkpt");
    if (trackPoints.length === 0) {
        throw new Error("No track points (<trkpt>) found in the GPX file.");
    }

    const points: GpxPoint[] = [];
    trackPoints.forEach(pt => {
        const lat = pt.getAttribute("lat");
        const lon = pt.getAttribute("lon");
        const timeEl = pt.querySelector("time");
        
        if (lat && lon && timeEl?.textContent) {
            try {
                points.push({
                    lat: parseFloat(lat),
                    lon: parseFloat(lon),
                    time: new Date(timeEl.textContent),
                });
            } catch (e) {
                console.warn("Skipping invalid track point:", pt);
            }
        }
    });

    if (points.length === 0) {
        throw new Error("Could not parse any valid track points from the GPX file.");
    }
    
    // Sort points by time just in case they are out of order
    points.sort((a, b) => a.time.getTime() - b.time.getTime());

    return points;
}
