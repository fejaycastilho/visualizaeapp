import { useState, useCallback } from 'react';
import { Layer } from '../../types';

const ZONE_COLORS = [
    '#e91e8c',  // rosa
    '#2196f3',  // azul
    '#4caf50',  // verde
    '#ff9800',  // laranja
    '#9c27b0',  // roxo
    '#00bcd4',  // ciano
    '#f44336',  // vermelho
    '#ffc107',  // amarelo
];

const DEFAULT_LABELS = [
    'Sofá', 'Mesa', 'Poltrona', 'Estante', 'Tapete',
    'Cadeira', 'Luminária', 'Rack TV',
];

/** Compute centroid of polygon */
export function centroid(pts: { x: number; y: number }[]) {
    const n = pts.length;
    if (n === 0) return { x: 0, y: 0 };
    const sx = pts.reduce((s, p) => s + p.x, 0);
    const sy = pts.reduce((s, p) => s + p.y, 0);
    return { x: sx / n, y: sy / n };
}

/** Compute bounding box of polygon */
export function boundingBox(pts: { x: number; y: number }[]) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of pts) {
        if (p.x < minX) minX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.x > maxX) maxX = p.x;
        if (p.y > maxY) maxY = p.y;
    }
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

function renderPolygonPng(
    points: { x: number; y: number }[],
    label: string,
    color: string,
    fontSize: number,
    bb: { x: number; y: number; w: number; h: number },
): string | null {
    // Pre-measure text to compute required padding
    const measureCanvas = document.createElement('canvas');
    const measureCtx = measureCanvas.getContext('2d');
    if (!measureCtx) return null;
    measureCtx.font = `bold ${fontSize}px sans-serif`;

    const textLines = label.toUpperCase().split('\n').filter(l => l.length > 0);
    if (textLines.length === 0) textLines.push('');
    const lineHeight = fontSize * 1.3;
    let maxLineW = 0;
    for (const line of textLines) {
        const w = measureCtx.measureText(line).width;
        if (w > maxLineW) maxLineW = w;
    }
    const textPillW = maxLineW + 20;
    const textPillH = lineHeight * textLines.length + 14;

    // The label is centered at the centroid. Calculate how far it extends
    // beyond the polygon bounding box on each side.
    const c = centroid(points);
    const labelLeft = c.x - textPillW / 2;
    const labelRight = c.x + textPillW / 2;
    const labelTop = c.y - textPillH / 2;
    const labelBottom = c.y + textPillH / 2;

    const basePad = 20;
    const padLeft = Math.max(basePad, (bb.x - labelLeft) + basePad);
    const padRight = Math.max(basePad, (labelRight - (bb.x + bb.w)) + basePad);
    const padTop = Math.max(basePad, (bb.y - labelTop) + basePad);
    const padBottom = Math.max(basePad, (labelBottom - (bb.y + bb.h)) + basePad);

    const canvasW = Math.round(bb.w + padLeft + padRight);
    const canvasH = Math.round(bb.h + padTop + padBottom);

    const canvas = document.createElement('canvas');
    canvas.width = canvasW;
    canvas.height = canvasH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const offsetX = -bb.x + padLeft;
    const offsetY = -bb.y + padTop;

    // Polygon fill
    ctx.beginPath();
    ctx.moveTo(points[0].x + offsetX, points[0].y + offsetY);
    for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x + offsetX, points[i].y + offsetY);
    }
    ctx.closePath();
    ctx.fillStyle = color + '40';
    ctx.fill();

    // Border
    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.lineJoin = 'round';
    ctx.stroke();

    // Vertex dots
    for (const pt of points) {
        ctx.beginPath();
        ctx.arc(pt.x + offsetX, pt.y + offsetY, 5, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();
    }

    // Label at centroid
    const lx = c.x + offsetX;
    const ly = c.y + offsetY;
    ctx.font = `bold ${fontSize}px sans-serif`;
    ctx.fillStyle = color + 'DD';
    const rx = lx - textPillW / 2;
    const ry = ly - textPillH / 2;
    ctx.beginPath();
    ctx.roundRect(rx, ry, textPillW, textPillH, 8);
    ctx.fill();

    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const startY = ly - (textLines.length - 1) * lineHeight / 2;
    for (let i = 0; i < textLines.length; i++) {
        ctx.fillText(textLines[i], lx, startY + i * lineHeight);
    }

    return canvas.toDataURL('image/png');
}

/** Wrapper that returns src + layout info for layer positioning */
function renderPolygonWithLayout(
    points: { x: number; y: number }[],
    label: string,
    color: string,
    fontSize: number,
    bb: { x: number; y: number; w: number; h: number },
) {
    // Pre-measure text to get dynamic padding
    const measureCanvas = document.createElement('canvas');
    const measureCtx = measureCanvas.getContext('2d');
    if (!measureCtx) return null;
    measureCtx.font = `bold ${fontSize}px sans-serif`;

    const textLines = label.toUpperCase().split('\n').filter(l => l.length > 0);
    if (textLines.length === 0) textLines.push('');
    const lineHeight = fontSize * 1.3;
    let maxLineW = 0;
    for (const line of textLines) {
        const w = measureCtx.measureText(line).width;
        if (w > maxLineW) maxLineW = w;
    }
    const textPillW = maxLineW + 20;
    const textPillH = lineHeight * textLines.length + 14;

    const c = centroid(points);
    const labelLeft = c.x - textPillW / 2;
    const labelRight = c.x + textPillW / 2;
    const labelTop = c.y - textPillH / 2;
    const labelBottom = c.y + textPillH / 2;

    const basePad = 20;
    const padLeft = Math.max(basePad, (bb.x - labelLeft) + basePad);
    const padRight = Math.max(basePad, (labelRight - (bb.x + bb.w)) + basePad);
    const padTop = Math.max(basePad, (bb.y - labelTop) + basePad);
    const padBottom = Math.max(basePad, (labelBottom - (bb.y + bb.h)) + basePad);

    const canvasW = Math.round(bb.w + padLeft + padRight);
    const canvasH = Math.round(bb.h + padTop + padBottom);

    const src = renderPolygonPng(points, label, color, fontSize, bb);
    if (!src) return null;

    return { src, padLeft, padTop, canvasW, canvasH };
}

/**
 * Creates a new Layer from polygon points.
 * Stores decorData for later re-rendering when label/fontSize change.
 */
export function createLayerFromPolygon(
    points: { x: number; y: number }[],
    label: string,
    color: string,
    fontSize?: number,
): Layer | null {
    if (points.length < 3) return null;

    const bb = boundingBox(points);
    const fs = fontSize ?? Math.max(18, Math.min(bb.w / 5, bb.h / 3, 56));

    const result = renderPolygonWithLayout(points, label, color, fs, bb);
    if (!result) return null;

    return {
        id: `decor-${Date.now()}`,
        name: `🛋️ ${label}`,
        visible: true,
        locked: false,
        type: 'generation',
        src: result.src,
        x: bb.x - result.padLeft,
        y: bb.y - result.padTop,
        width: result.canvasW,
        height: result.canvasH,
        initialX: bb.x - result.padLeft,
        initialY: bb.y - result.padTop,
        initialWidth: result.canvasW,
        initialHeight: result.canvasH,
        feather: 0,
        renderMode: 'fill',
        decorData: { points, label, color, fontSize: fs },
    };
}

/**
 * Re-renders an existing decor layer with updated label/fontSize.
 * Returns a Partial<Layer> with the new src and updated decorData.
 */
export function rerenderDecorLayer(
    decorData: { points: { x: number; y: number }[]; label: string; color: string; fontSize: number },
    updates: { label?: string; fontSize?: number },
): Partial<Layer> | null {
    const newLabel = updates.label ?? decorData.label;
    const newFontSize = updates.fontSize ?? decorData.fontSize;
    const bb = boundingBox(decorData.points);
    const src = renderPolygonPng(decorData.points, newLabel, decorData.color, newFontSize, bb);
    if (!src) return null;

    return {
        name: `🛋️ ${newLabel}`,
        src,
        decorData: { ...decorData, label: newLabel, fontSize: newFontSize },
    };
}

export interface UseDecorZonesParams {
    onLayerCreated: (layer: Layer) => void;
}

export function useDecorZones({ onLayerCreated }: UseDecorZonesParams) {
    const [isDecorMode, setIsDecorMode] = useState(false);
    // Count of zones created (for color/label cycling)
    const [zoneCount, setZoneCount] = useState(0);

    // Points being drawn for the current polygon
    const [drawingPoints, setDrawingPoints] = useState<{ x: number; y: number }[]>([]);
    // Current mouse position for live preview line
    const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);

    const nextColor = ZONE_COLORS[zoneCount % ZONE_COLORS.length];
    const nextLabel = DEFAULT_LABELS[zoneCount % DEFAULT_LABELS.length];

    /** Finalize polygon → render to PNG → create layer */
    const commitPolygon = useCallback((pts: { x: number; y: number }[], label: string, color: string) => {
        const layer = createLayerFromPolygon(pts, label, color);
        if (layer) {
            onLayerCreated(layer);
            setZoneCount(prev => prev + 1);
        }
        setDrawingPoints([]);
        setCursorPos(null);
    }, [onLayerCreated]);

    /** Add a vertex to the current polygon */
    const addPoint = useCallback((x: number, y: number) => {
        // If clicking near the first point and we have >= 3 points, close
        if (drawingPoints.length >= 3) {
            const first = drawingPoints[0];
            const dist = Math.sqrt((x - first.x) ** 2 + (y - first.y) ** 2);
            if (dist < 15) {
                commitPolygon(drawingPoints, nextLabel, nextColor);
                return;
            }
        }
        setDrawingPoints(prev => [...prev, { x, y }]);
    }, [drawingPoints, nextColor, nextLabel, commitPolygon]);

    /** Close the polygon (Enter or double-click) */
    const closePolygon = useCallback(() => {
        if (drawingPoints.length < 3) {
            setDrawingPoints([]);
            setCursorPos(null);
            return;
        }
        commitPolygon(drawingPoints, nextLabel, nextColor);
    }, [drawingPoints, nextColor, nextLabel, commitPolygon]);

    /** Cancel drawing (Escape) */
    const cancelDrawing = useCallback(() => {
        setDrawingPoints([]);
        setCursorPos(null);
    }, []);

    /** Remove last vertex (Backspace / Ctrl+Z) */
    const undoLastPoint = useCallback(() => {
        setDrawingPoints(prev => prev.slice(0, -1));
    }, []);

    return {
        isDecorMode,
        setIsDecorMode,
        drawingPoints,
        cursorPos,
        setCursorPos,
        nextColor,
        nextLabel,
        addPoint,
        closePolygon,
        cancelDrawing,
        undoLastPoint,
        zoneCount,
    };
}
