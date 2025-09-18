import type { Defect, AnalysisResult, VideoDefect } from '../types';

// Declare globals from CDN scripts to satisfy TypeScript
declare global {
  interface Window {
    jspdf: any;
    html2canvas: any;
  }
}

const escapeCSV = (str: string | undefined | null): string => {
  if (str === undefined || str === null) return '';
  let result = str.toString();
  if (result.includes(',') || result.includes('"') || result.includes('\n')) {
    result = result.replace(/"/g, '""');
    return `"${result}"`;
  }
  return result;
};

export const exportToCSV = (defects: Defect[]) => {
  const headers = ['Type', 'Severity', 'Description', 'Latitude', 'Longitude', 'Confidence', 'Length (m)', 'Width (m)', 'Depth (m)', 'Area (sq_m)', 'Volume (m³)'];
  const rows = defects.map(d => [
    escapeCSV(d.type),
    escapeCSV(d.severity),
    escapeCSV(d.description),
    d.location?.latitude.toFixed(6) ?? '',
    d.location?.longitude.toFixed(6) ?? '',
    typeof d.confidence === 'number' ? d.confidence.toFixed(2) : '',
    d.dimensions?.length_m?.toFixed(2) ?? '',
    d.dimensions?.width_m?.toFixed(2) ?? '',
    d.dimensions?.depth_m?.toFixed(2) ?? '',
    d.area_sq_m?.toFixed(2) ?? '',
    d.volume_m3?.toFixed(4) ?? '',
  ].join(','));

  const csvContent = [headers.join(','), ...rows].join('\n');
  
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', 'road_analysis_results.csv');
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const exportToPDF = async (analysis: AnalysisResult) => {
    if (!window.jspdf || !window.html2canvas) {
        alert("PDF generation library is not loaded. Please try again in a moment.");
        console.error("jsPDF or html2canvas not found on window object.");
        return;
    }
    
    const { defects, location } = analysis;
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });

    // === Report Header ===
    doc.setFontSize(22);
    doc.text("RoadGuard AI - Analysis Report", 105, 20, { align: 'center' });
    doc.setFontSize(11);
    doc.setTextColor(150);
    doc.text(`Report generated on: ${new Date().toLocaleDateString()}`, 105, 27, { align: 'center' });

    let nextYPosition = 40;
    if (location) {
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(50);
        doc.text("Overall Location Data", 105, 35, { align: 'center' });

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100);
        const latText = `Latitude: ${location.latitude.toFixed(6)}`;
        const lonText = `Longitude: ${location.longitude.toFixed(6)}`;
        doc.text(`${latText} / ${lonText}`, 105, 41, { align: 'center' });
        nextYPosition = 52; 
    }

    // === Analyzed Image Section ===
    const imageSectionYStart = nextYPosition;
    const imageContainer = document.getElementById('analysis-image-container');
    if (imageContainer) {
        doc.setFontSize(16);
        doc.setTextColor(0);
        doc.text("Analyzed Image", 14, imageSectionYStart);
        const canvas = await window.html2canvas(imageContainer, { useCORS: true, scale: 2 });
        const imgData = canvas.toDataURL('image/png');
        const imgProps = doc.getImageProperties(imgData);
        const pdfWidth = 180;
        const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
        
        const imageY = imageSectionYStart + 5;
        doc.addImage(imgData, 'PNG', 14, imageY, pdfWidth, pdfHeight);
    }
    
    // === Defect Details Section ===
    doc.addPage();
    doc.setFontSize(16);
    doc.text("Defect Details", 14, 20);
    let y = 30;

    for (const [index, defect] of defects.entries()) {
        const lines: {label: string, value: string}[] = [];
        if (defect.severity) lines.push({ label: 'Severity:', value: defect.severity });
        if (defect.location) lines.push({ label: 'GPS Coordinates:', value: `${defect.location.latitude.toFixed(6)} (Lat), ${defect.location.longitude.toFixed(6)} (Lng)` });
        if (defect.dimensions) {
            let dimText = `${defect.dimensions.length_m.toFixed(2)}m (L) x ${defect.dimensions.width_m.toFixed(2)}m (W)`;
            if (defect.dimensions.depth_m) dimText += ` x ${defect.dimensions.depth_m.toFixed(2)}m (D)`;
            lines.push({ label: 'Dimensions:', value: dimText });
        }
        if (defect.area_sq_m) lines.push({ label: 'Area:', value: `${defect.area_sq_m.toFixed(2)} m²` });
        if (defect.volume_m3) lines.push({ label: 'Volume:', value: `${defect.volume_m3.toFixed(4)} m³` });
        
        const descriptionLines = doc.splitTextToSize(defect.description, 140);
        // Estimate block height: title + padding + lines + description + padding
        const blockHeight = 12 + (lines.length * 6) + (descriptionLines.length * 5) + 5;

        if (y + blockHeight > 280 && index > 0) { // Page break check
            doc.addPage();
            y = 20;
            doc.setFontSize(16);
            doc.text("Defect Details (continued)", 14, y);
            y = 30;
        }

        const blockStartY = y;
        let contentY = blockStartY + 12;

        // Title
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text(`Defect #${index + 1}: ${defect.type}`, 20, contentY - 5);
        doc.setLineWidth(0.2);
        doc.line(20, contentY - 2, 190, contentY-2);

        doc.setFontSize(9);
        
        lines.forEach(line => {
            doc.setFont('helvetica', 'bold');
            doc.text(line.label, 22, contentY);
            doc.setFont('helvetica', 'normal');
            doc.text(line.value, 55, contentY);
            contentY += 6;
        });

        doc.setFont('helvetica', 'bold');
        doc.text("Description:", 22, contentY);
        doc.setFont('helvetica', 'normal');
        doc.text(descriptionLines, 55, contentY);
        contentY += descriptionLines.length * 5;

        const finalBlockHeight = contentY - blockStartY + 2;
        doc.setDrawColor(200); // Light gray border
        doc.roundedRect(16, blockStartY, 180, finalBlockHeight, 3, 3);
        
        y = blockStartY + finalBlockHeight + 5; // Update y for next block
    }

    doc.save('road_analysis_report.pdf');
};


export const exportSessionToPDF = async (defects: Defect[]) => {
    if (!window.jspdf) {
        alert("PDF generation library is not loaded. Please try again in a moment.");
        console.error("jsPDF not found on window object.");
        return;
    }
    
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });

    // === Report Header ===
    doc.setFontSize(22);
    doc.text("RoadGuard AI - Real-Time Session Report", 105, 20, { align: 'center' });
    doc.setFontSize(11);
    doc.setTextColor(150);
    doc.text(`Report generated on: ${new Date().toLocaleString()}`, 105, 27, { align: 'center' });
    doc.setFontSize(12);
    doc.setTextColor(50);
    doc.text(`Total Defects Detected: ${defects.length}`, 105, 35, { align: 'center' });
    
    // === Defect Details Section ===
    doc.setFontSize(16);
    doc.setTextColor(0);
    doc.text("Detected Defect Details", 14, 50);
    let y = 60;

    for (const [index, defect] of defects.entries()) {
        const lines: {label: string, value: string}[] = [];
        if (defect.severity) lines.push({ label: 'Severity:', value: defect.severity });
        if (defect.location) lines.push({ label: 'GPS:', value: `${defect.location.latitude.toFixed(6)}, ${defect.location.longitude.toFixed(6)}` });
        if (defect.dimensions) {
            let dimText = `${defect.dimensions.length_m?.toFixed(2) ?? '?'}m (L) x ${defect.dimensions.width_m?.toFixed(2) ?? '?'}m (W)`;
            if (defect.dimensions.depth_m) dimText += ` x ${defect.dimensions.depth_m.toFixed(2)}m (D)`;
            lines.push({ label: 'Dimensions:', value: dimText });
        }
        if (defect.area_sq_m) lines.push({ label: 'Area:', value: `${defect.area_sq_m.toFixed(2)} m²` });
        if (defect.volume_m3) lines.push({ label: 'Volume:', value: `${defect.volume_m3.toFixed(4)} m³` });
        if (typeof defect.confidence === 'number') lines.push({ label: 'Confidence:', value: `${(defect.confidence * 100).toFixed(1)}%` });
        
        const descriptionLines = doc.splitTextToSize(defect.description || 'No description provided.', 140);
        // Estimate block height
        const blockHeight = 12 + (lines.length * 6) + (descriptionLines.length * 5) + 5;

        if (y + blockHeight > 280 && index > 0) { // Page break check
            doc.addPage();
            y = 20;
            doc.setFontSize(16);
            doc.text("Defect Details (continued)", 14, y);
            y = 30;
        }

        const blockStartY = y;
        let contentY = blockStartY + 12;

        // Title
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text(`Defect #${index + 1}: ${defect.type}`, 20, contentY - 5);
        doc.setLineWidth(0.2);
        doc.line(20, contentY - 2, 190, contentY-2);

        doc.setFontSize(9);
        
        lines.forEach(line => {
            doc.setFont('helvetica', 'bold');
            doc.text(line.label, 22, contentY);
            doc.setFont('helvetica', 'normal');
            doc.text(line.value, 55, contentY);
            contentY += 6;
        });

        doc.setFont('helvetica', 'bold');
        doc.text("Description:", 22, contentY);
        doc.setFont('helvetica', 'normal');
        doc.text(descriptionLines, 55, contentY);
        contentY += descriptionLines.length * 5;

        const finalBlockHeight = contentY - blockStartY + 2;
        doc.setDrawColor(200); // Light gray border
        doc.roundedRect(16, blockStartY, 180, finalBlockHeight, 3, 3);
        
        y = blockStartY + finalBlockHeight + 5; // Update y for next block
    }

    doc.save('road_session_report.pdf');
};

export const exportVideoReportToCSV = (defects: VideoDefect[]) => {
  const headers = ['Timestamp (s)', 'Type', 'Severity', 'Description', 'Latitude', 'Longitude', 'Confidence', 'Length (m)', 'Width (m)', 'Depth (m)', 'Area (sq_m)', 'Volume (m³)'];
  const rows = defects.map(d => [
    d.timestamp.toFixed(2),
    escapeCSV(d.type),
    escapeCSV(d.severity),
    escapeCSV(d.description),
    d.location?.latitude.toFixed(6) ?? '',
    d.location?.longitude.toFixed(6) ?? '',
    typeof d.confidence === 'number' ? d.confidence.toFixed(2) : '',
    d.dimensions?.length_m?.toFixed(2) ?? '',
    d.dimensions?.width_m?.toFixed(2) ?? '',
    d.dimensions?.depth_m?.toFixed(2) ?? '',
    d.area_sq_m?.toFixed(2) ?? '',
    d.volume_m3?.toFixed(4) ?? '',
  ].join(','));

  const csvContent = [headers.join(','), ...rows].join('\n');
  
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', 'road_video_analysis_report.csv');
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};


export const exportVideoReportToPDF = async (defects: VideoDefect[], videoFileName: string) => {
    if (!window.jspdf) {
        alert("PDF generation library is not loaded. Please try again in a moment.");
        return;
    }
    
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });

    doc.setFontSize(22);
    doc.text("RoadGuard AI - Video Analysis Report", 105, 20, { align: 'center' });
    doc.setFontSize(11);
    doc.setTextColor(150);
    doc.text(`Report generated on: ${new Date().toLocaleString()}`, 105, 27, { align: 'center' });
    doc.setFontSize(12);
    doc.setTextColor(50);
    doc.text(`Analyzed Video: ${videoFileName}`, 105, 35, { align: 'center' });
    doc.text(`Total Defects Detected: ${defects.length}`, 105, 42, { align: 'center' });
    
    doc.setFontSize(16);
    doc.setTextColor(0);
    doc.text("Detected Defect Details", 14, 55);
    let y = 65;

    for (const [index, defect] of defects.entries()) {
        const lines: {label: string, value: string}[] = [];
        lines.push({ label: 'Timestamp:', value: `${defect.timestamp.toFixed(2)}s` });
        if (defect.severity) lines.push({ label: 'Severity:', value: defect.severity });
        if (defect.location) lines.push({ label: 'GPS:', value: `${defect.location.latitude.toFixed(6)}, ${defect.location.longitude.toFixed(6)}` });
        if (defect.dimensions) {
            let dimText = `${defect.dimensions.length_m?.toFixed(2) ?? '?'}m (L) x ${defect.dimensions.width_m?.toFixed(2) ?? '?'}m (W)`;
            if (defect.dimensions.depth_m) dimText += ` x ${defect.dimensions.depth_m.toFixed(2)}m (D)`;
            lines.push({ label: 'Dimensions:', value: dimText });
        }
        if (defect.area_sq_m) lines.push({ label: 'Area:', value: `${defect.area_sq_m.toFixed(2)} m²` });
        if (defect.volume_m3) lines.push({ label: 'Volume:', value: `${defect.volume_m3.toFixed(4)} m³` });
        if (typeof defect.confidence === 'number') lines.push({ label: 'Confidence:', value: `${(defect.confidence * 100).toFixed(1)}%` });
        
        const descriptionLines = doc.splitTextToSize(defect.description || 'No description provided.', 140);
        const blockHeight = 12 + (lines.length * 6) + (descriptionLines.length * 5) + 5;

        if (y + blockHeight > 280 && index > 0) {
            doc.addPage();
            y = 20;
            doc.setFontSize(16);
            doc.text("Defect Details (continued)", 14, y);
            y = 30;
        }

        const blockStartY = y;
        let contentY = blockStartY + 12;

        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text(`Defect #${index + 1}: ${defect.type}`, 20, contentY - 5);
        doc.setLineWidth(0.2);
        doc.line(20, contentY - 2, 190, contentY-2);

        doc.setFontSize(9);
        
        lines.forEach(line => {
            doc.setFont('helvetica', 'bold');
            doc.text(line.label, 22, contentY);
            doc.setFont('helvetica', 'normal');
            doc.text(line.value, 55, contentY);
            contentY += 6;
        });

        doc.setFont('helvetica', 'bold');
        doc.text("Description:", 22, contentY);
        doc.setFont('helvetica', 'normal');
        doc.text(descriptionLines, 55, contentY);
        contentY += descriptionLines.length * 5;

        const finalBlockHeight = contentY - blockStartY + 2;
        doc.setDrawColor(200);
        doc.roundedRect(16, blockStartY, 180, finalBlockHeight, 3, 3);
        
        y = blockStartY + finalBlockHeight + 5;
    }

    doc.save('road_video_analysis_report.pdf');
};