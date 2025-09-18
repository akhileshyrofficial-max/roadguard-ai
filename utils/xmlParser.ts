import type { GroundTruthDefect, BoundingBox } from '../types';

/**
 * Parses a PASCAL VOC XML string to extract ground truth defect annotations.
 * @param xmlString The string content of the XML file.
 * @param imageWidth The natural width of the corresponding image.
 * @param imageHeight The natural height of the corresponding image.
 * @returns An array of GroundTruthDefect objects with coordinates as percentages.
 */
export function parsePascalVoc(xmlString: string, imageWidth: number, imageHeight: number): GroundTruthDefect[] {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlString, "application/xml");

    const errorNode = xmlDoc.querySelector("parsererror");
    if (errorNode) {
        throw new Error("Failed to parse XML file. Please ensure it's valid PASCAL VOC format.");
    }

    if (imageWidth === 0 || imageHeight === 0) {
        throw new Error("Image dimensions must be greater than zero for coordinate conversion.");
    }

    const objects = xmlDoc.querySelectorAll("object");
    const defects: GroundTruthDefect[] = [];

    objects.forEach(obj => {
        const nameNode = obj.querySelector("name");
        const bndboxNode = obj.querySelector("bndbox");

        if (nameNode?.textContent && bndboxNode) {
            const xminNode = bndboxNode.querySelector("xmin");
            const yminNode = bndboxNode.querySelector("ymin");
            const xmaxNode = bndboxNode.querySelector("xmax");
            const ymaxNode = bndboxNode.querySelector("ymax");

            if (xminNode?.textContent && yminNode?.textContent && xmaxNode?.textContent && ymaxNode?.textContent) {
                const xmin = parseInt(xminNode.textContent, 10);
                const ymin = parseInt(yminNode.textContent, 10);
                const xmax = parseInt(xmaxNode.textContent, 10);
                const ymax = parseInt(ymaxNode.textContent, 10);

                const boundingBox: BoundingBox = {
                    x_min: xmin / imageWidth,
                    y_min: ymin / imageHeight,
                    x_max: xmax / imageWidth,
                    y_max: ymax / imageHeight,
                };
                
                // Capitalize the first letter of the type to match app's convention
                const type = nameNode.textContent.charAt(0).toUpperCase() + nameNode.textContent.slice(1).toLowerCase();

                defects.push({ type, boundingBox });
            }
        }
    });

    return defects;
}
