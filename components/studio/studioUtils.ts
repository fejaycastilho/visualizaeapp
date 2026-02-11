import { Layer } from '../../types';

/**
 * Composites multiple layers into a single image.
 * Calculates the bounding box of all visible image layers and draws them bottom-to-top.
 */
export const compositeLayers = async (layers: Layer[]): Promise<string | null> => {
    if (layers.length === 0) return null;
    if (layers.length === 1 && layers[0].src) return layers[0].src;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    const imageLayers = layers.filter(l => l.type !== 'video' && l.visible);
    if (imageLayers.length === 0) return null;

    imageLayers.forEach(layer => {
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
    if (!ctx) return null;

    const layersToDraw = [...imageLayers].reverse();

    const loadPromises = layersToDraw.map(layer => {
        return new Promise<{ img: HTMLImageElement, layer: Layer } | null>((resolve) => {
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.onload = () => resolve({ img, layer });
            img.onerror = () => resolve(null);
            img.src = layer.src || '';
        });
    });

    const loadedImages = await Promise.all(loadPromises);

    loadedImages.forEach(item => {
        if (!item) return;
        const { img, layer } = item;
        ctx.drawImage(img, layer.x - minX, layer.y - minY, layer.width, layer.height);
    });

    return canvas.toDataURL('image/png');
};

/**
 * Crops/resizes an image to a target aspect ratio using cover-fit.
 * Prevents black bars by filling the entire target area.
 */
export const cropImageToRatio = async (base64Str: string, targetWidth: number, targetHeight: number): Promise<string> => {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = targetWidth;
            canvas.height = targetHeight;
            const ctx = canvas.getContext('2d');
            if (!ctx) { resolve(base64Str); return; }

            const scale = Math.max(targetWidth / img.width, targetHeight / img.height);
            const w = img.width * scale;
            const h = img.height * scale;

            const x = (targetWidth - w) / 2;
            const y = (targetHeight - h) / 2;

            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, x, y, w, h);

            resolve(canvas.toDataURL('image/png', 1.0));
        };
        img.src = base64Str;
    });
};

/**
 * Extracts the last frame from a video blob URL as a data URL.
 */
export const extractLastFrame = (videoUrl: string): Promise<string | null> => {
    return new Promise((resolve) => {
        const video = document.createElement('video');
        video.crossOrigin = 'anonymous';
        video.muted = true;
        video.preload = 'auto';
        video.src = videoUrl;

        video.onloadedmetadata = () => {
            video.currentTime = Math.max(0, video.duration - 0.05);
        };

        video.onseeked = () => {
            try {
                const canvas = document.createElement('canvas');
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.drawImage(video, 0, 0);
                    const dataUrl = canvas.toDataURL('image/png');
                    console.log(`🎬 Extracted last frame: ${video.videoWidth}x${video.videoHeight}`);
                    resolve(dataUrl);
                } else {
                    resolve(null);
                }
            } catch {
                console.warn('Could not extract last frame');
                resolve(null);
            }
        };

        video.onerror = () => resolve(null);
        setTimeout(() => resolve(null), 10000);
    });
};
