import { Layer, ModelType, Resolution } from '../../types';
import { getCanvasSnapshot } from './useCanvasGeneration';

/**
 * Downloads the canvas content as a PNG.
 * If a selection exists, downloads only the selected area.
 * Otherwise, downloads all visible layers composited.
 */
export async function handleDownload(
    selection: { x: number; y: number; w: number; h: number } | null,
    layers: Layer[]
): Promise<void> {
    // If there's a selection, download just the selected area
    if (selection) {
        const snapshot = await getCanvasSnapshot(selection, layers);
        if (!snapshot) {
            alert('Nenhum conteúdo na área selecionada.');
            return;
        }
        const link = document.createElement('a');
        link.download = `visualizae-crop-${Date.now()}.png`;
        link.href = snapshot;
        link.click();
        return;
    }

    // No selection: download full composition
    if (layers.length === 0) return;

    const visibleLayers = layers.filter(l => l.visible);
    if (visibleLayers.length === 0) {
        alert('Nenhuma camada visível para baixar.');
        return;
    }

    // Calculate Bounding Box
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    visibleLayers.forEach(layer => {
        if (layer.x < minX) minX = layer.x;
        if (layer.y < minY) minY = layer.y;
        if (layer.x + layer.width > maxX) maxX = layer.x + layer.width;
        if (layer.y + layer.height > maxY) maxY = layer.y + layer.height;
    });

    const width = maxX - minX;
    const height = maxY - minY;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Draw bottom-up
    const layersToDraw = [...visibleLayers].reverse();

    const loadPromises = layersToDraw.map(layer => {
        return new Promise<{ img: HTMLImageElement; layer: Layer } | null>((resolve) => {
            if (layer.type === 'video') {
                resolve(null);
            } else {
                const img = new Image();
                img.crossOrigin = 'anonymous';
                img.onload = () => resolve({ img, layer });
                img.onerror = () => resolve(null);
                img.src = layer.src || '';
            }
        });
    });

    const loadedImages = await Promise.all(loadPromises);

    loadedImages.forEach(item => {
        if (!item) return;
        const { img, layer } = item;
        ctx.drawImage(img, layer.x - minX, layer.y - minY, layer.width, layer.height);
    });

    const link = document.createElement('a');
    link.download = `visualizae-art-${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
}

/**
 * Fits the canvas view to show all layers or resets to default.
 */
export function handleFitScreen(
    layers: Layer[],
    initialZoom: number,
    CANVAS_SIZE: number,
    setZoom: (z: number) => void,
    setCanvasOffset: (o: { x: number; y: number }) => void
): void {
    if (layers.length === 0) {
        const newZoom = initialZoom;
        const newOffset = {
            x: window.innerWidth / 2 - (CANVAS_SIZE / 2) * newZoom,
            y: window.innerHeight / 2 - (CANVAS_SIZE / 2) * newZoom,
        };
        setZoom(newZoom);
        setCanvasOffset(newOffset);
        return;
    }

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    layers.forEach(layer => {
        if (!layer.visible) return;
        if (layer.x < minX) minX = layer.x;
        if (layer.y < minY) minY = layer.y;
        if (layer.x + layer.width > maxX) maxX = layer.x + layer.width;
        if (layer.y + layer.height > maxY) maxY = layer.y + layer.height;
    });

    if (minX === Infinity) return;

    const contentW = maxX - minX;
    const contentH = maxY - minY;
    const padding = 100;

    const scaleX = window.innerWidth / (contentW + padding * 2);
    const scaleY = window.innerHeight / (contentH + padding * 2);
    const newZoom = Math.min(Math.min(scaleX, scaleY), 1.5);

    const centerX = minX + contentW / 2;
    const centerY = minY + contentH / 2;

    const newOffset = {
        x: window.innerWidth / 2 - centerX * newZoom,
        y: window.innerHeight / 2 - centerY * newZoom,
    };

    setZoom(newZoom);
    setCanvasOffset(newOffset);
}

/**
 * Finds the closest resolution match for the current selection.
 */
export function getCurrentResolutionMatch(
    selection: { x: number; y: number; w: number; h: number } | null,
    availableResolutions: Resolution[] | undefined
): Resolution | null {
    if (!selection) return null;
    return availableResolutions?.find(r =>
        Math.abs(r.ratio - selection.w / selection.h) < 0.02
    ) || null;
}

/**
 * Returns the resolution status (ok or warning) for the current selection.
 */
export function getResolutionStatus(
    selection: { x: number; y: number; w: number; h: number } | null,
    currentMatch: Resolution | null,
    activeModel: ModelType
): { status: string; msg: string } {
    if (!selection || !currentMatch) return { status: 'ok', msg: '' };

    let maxW = currentMatch.w;
    let maxH = currentMatch.h;

    if (activeModel === ModelType.NANO_BANANA_2) {
        const scale = Math.max(maxW, maxH) <= 2048 ? 2 : 1;
        maxW = maxW * scale;
        maxH = maxH * scale;
    }

    if (selection.w > maxW + 2 || selection.h > maxH + 2) {
        return {
            status: 'warning',
            msg: `Resolução máxima excedida (${maxW}x${maxH})`,
        };
    }

    return { status: 'ok', msg: '' };
}
