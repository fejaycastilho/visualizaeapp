import { ref, uploadString, getDownloadURL, deleteObject, listAll } from 'firebase/storage';
import { storage } from '../lib/firebase';
import { Layer, ProjectHistoryEntry, ProjectLayerData, Scene, StudioSceneData } from '../types';

const HISTORY_KEY = 'visualizae_project_history';
const PROJECT_KEY_PREFIX = 'visualizae_project_';
const STUDIO_KEY_PREFIX = 'visualizae_studio_';
const MAX_PROJECTS = 10;

// ─── localStorage helpers ───────────────────────────────────────

function getHistoryList(): ProjectHistoryEntry[] {
    try {
        const raw = localStorage.getItem(HISTORY_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
}

function saveHistoryList(list: ProjectHistoryEntry[]) {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(list));
}

function getProjectLayers(projectId: string): ProjectLayerData[] | null {
    try {
        const raw = localStorage.getItem(PROJECT_KEY_PREFIX + projectId);
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

function saveProjectLayers(projectId: string, layers: ProjectLayerData[]) {
    localStorage.setItem(PROJECT_KEY_PREFIX + projectId, JSON.stringify(layers));
}

function deleteProjectLayers(projectId: string) {
    localStorage.removeItem(PROJECT_KEY_PREFIX + projectId);
    localStorage.removeItem(STUDIO_KEY_PREFIX + projectId);
}

function getStudioData(projectId: string): StudioSceneData[] | null {
    try {
        const raw = localStorage.getItem(STUDIO_KEY_PREFIX + projectId);
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

function saveStudioData(projectId: string, scenes: StudioSceneData[]) {
    localStorage.setItem(STUDIO_KEY_PREFIX + projectId, JSON.stringify(scenes));
}

// ─── Thumbnail generation ───────────────────────────────────────

export function generateThumbnailFromCanvas(
    _canvasEl: HTMLCanvasElement | null,
    _maxSize = 200
): string {
    // Stub: thumbnail is generated asynchronously via generateThumbnailFromLayers
    return '';
}

/**
 * Generate a thumbnail from the visible layers by compositing them onto a small canvas.
 */
export async function generateThumbnailFromLayers(
    layers: Array<{ src?: string; x: number; y: number; width: number; height: number; visible: boolean; type: string }>,
    maxSize = 200
): Promise<string> {
    const visibleLayers = layers.filter(l => l.visible && l.src && l.type !== 'video');
    if (visibleLayers.length === 0) return '';

    // Calculate bounding box
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    visibleLayers.forEach(l => {
        if (l.x < minX) minX = l.x;
        if (l.y < minY) minY = l.y;
        if (l.x + l.width > maxX) maxX = l.x + l.width;
        if (l.y + l.height > maxY) maxY = l.y + l.height;
    });

    const fullW = maxX - minX;
    const fullH = maxY - minY;
    if (fullW <= 0 || fullH <= 0) return '';

    const ratio = fullW / fullH;
    const thumbW = ratio >= 1 ? maxSize : Math.round(maxSize * ratio);
    const thumbH = ratio >= 1 ? Math.round(maxSize / ratio) : maxSize;
    const scale = thumbW / fullW;

    const canvas = document.createElement('canvas');
    canvas.width = thumbW;
    canvas.height = thumbH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    // Load and draw layers bottom-to-top
    const layersToDraw = [...visibleLayers].reverse();
    for (const layer of layersToDraw) {
        try {
            const img = await new Promise<HTMLImageElement>((resolve, reject) => {
                const el = new Image();
                el.crossOrigin = 'anonymous';
                el.onload = () => resolve(el);
                el.onerror = () => reject();
                el.src = layer.src!;
            });
            ctx.drawImage(
                img,
                (layer.x - minX) * scale,
                (layer.y - minY) * scale,
                layer.width * scale,
                layer.height * scale
            );
        } catch {
            // Skip failed images
        }
    }

    return canvas.toDataURL('image/jpeg', 0.6);
}

// ─── Firebase Storage helpers ───────────────────────────────────

async function uploadLayerImage(
    userId: string,
    projectId: string,
    layerId: string,
    dataUrl: string
): Promise<string> {
    const storagePath = `projects/${userId}/${projectId}/${layerId}`;
    const storageRef = ref(storage, storagePath);
    await uploadString(storageRef, dataUrl, 'data_url');
    return storagePath;
}

async function downloadLayerImage(storagePath: string): Promise<string> {
    const storageRef = ref(storage, storagePath);
    return await getDownloadURL(storageRef);
}

async function deleteProjectFromStorage(userId: string, projectId: string) {
    try {
        const folderRef = ref(storage, `projects/${userId}/${projectId}`);
        const result = await listAll(folderRef);
        await Promise.all(result.items.map(item => deleteObject(item)));
    } catch (error) {
        console.warn('Error cleaning up storage for project', projectId, error);
    }
}

// ─── Public API ─────────────────────────────────────────────────

/**
 * List all projects in history (most recent first).
 */
export function listProjects(): ProjectHistoryEntry[] {
    return getHistoryList().sort((a, b) => b.updatedAt - a.updatedAt);
}

/**
 * Save current canvas state as a project.
 * Phase 1 (instant): Save metadata + layer data to localStorage
 * Phase 2 (background): Upload images to Firebase Storage (fire-and-forget)
 */
export function saveProject(
    userId: string,
    layers: Layer[],
    thumbnail: string,
    canvasSize: { w: number; h: number },
    existingProjectId?: string,
    scenes?: Scene[],
    studioOrientation?: 'auto' | 'horizontal' | 'vertical'
): string {
    const history = getHistoryList();
    const now = Date.now();
    const projectId = existingProjectId || crypto.randomUUID();

    // Check if we're updating an existing project
    const existingIndex = history.findIndex(p => p.id === projectId);

    // Generate name for new project
    const name = existingIndex >= 0
        ? history[existingIndex].name
        : `Projeto ${new Date(now).toLocaleDateString('pt-BR')} ${new Date(now).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;

    // Phase 1: Save layer data to localStorage immediately (NO image upload blocking)
    const layerData: ProjectLayerData[] = layers.map((layer) => ({
        id: layer.id,
        name: layer.name,
        visible: layer.visible,
        locked: layer.locked,
        type: layer.type,
        storagePath: undefined, // Will be set by background upload
        thumbnail: layer.thumbnail,
        x: layer.x,
        y: layer.y,
        width: layer.width,
        height: layer.height,
        initialX: layer.initialX,
        initialY: layer.initialY,
        initialWidth: layer.initialWidth,
        initialHeight: layer.initialHeight,
        feather: layer.feather,
        renderMode: layer.renderMode,
        isPlaying: layer.isPlaying,
    }));

    saveProjectLayers(projectId, layerData);

    const entry: ProjectHistoryEntry = {
        id: projectId,
        name,
        thumbnail,
        createdAt: existingIndex >= 0 ? history[existingIndex].createdAt : now,
        updatedAt: now,
        userId,
        layerCount: layers.length,
        canvasSize,
        studioOrientation,
    };

    if (existingIndex >= 0) {
        history[existingIndex] = entry;
    } else {
        history.unshift(entry);
    }

    // FIFO: remove oldest if exceeding max
    while (history.length > MAX_PROJECTS) {
        const removed = history.pop()!;
        deleteProjectLayers(removed.id);
        deleteProjectFromStorage(userId, removed.id);
    }

    saveHistoryList(history);

    // Phase 2: Upload images to Firebase Storage in background (fire-and-forget)
    uploadLayerImagesInBackground(userId, projectId, layers);

    // Phase 3: Save Studio Mode data (scenes with frames)
    if (scenes && scenes.length > 0) {
        const studioData: StudioSceneData[] = scenes.map(scene => ({
            id: scene.id,
            shots: scene.shots,
            selectedVideoIndex: scene.selectedVideoIndex,
            variationCount: scene.variationCount,
            // Frames: save inline if they're base64 data URLs
            startFrameStoragePath: scene.startFrame && scene.startFrame.startsWith('data:') ? scene.startFrame : undefined,
            endFrameStoragePath: scene.endFrame && scene.endFrame.startsWith('data:') ? scene.endFrame : undefined,
            // Videos: save Firebase Storage URLs (permanent, not blob URLs)
            videoStoragePaths: scene.videos.filter(v => v.startsWith('https://')),
        }));
        saveStudioData(projectId, studioData);
    } else {
        // Clear studio data if no scenes
        localStorage.removeItem(STUDIO_KEY_PREFIX + projectId);
    }

    return projectId;
}

/**
 * Upload layer images to Firebase Storage in background.
 * Updates localStorage layer data with storage paths as uploads complete.
 */
async function uploadLayerImagesInBackground(userId: string, projectId: string, layers: Layer[]) {
    for (const layer of layers) {
        if (layer.src && (layer.type === 'image' || layer.type === 'generation') && layer.src.startsWith('data:')) {
            try {
                const storagePath = await uploadLayerImage(userId, projectId, layer.id, layer.src);

                // Update the saved layer data with the storage path
                const savedLayers = getProjectLayers(projectId);
                if (savedLayers) {
                    const idx = savedLayers.findIndex(l => l.id === layer.id);
                    if (idx >= 0) {
                        savedLayers[idx].storagePath = storagePath;
                        saveProjectLayers(projectId, savedLayers);
                    }
                }
            } catch (error) {
                console.warn('Background upload failed for layer:', layer.id, error);
            }
        }
    }
}

/**
 * Load a project's layers from localStorage + Firebase Storage.
 */
export async function loadProject(projectId: string): Promise<{ layers: Layer[], scenes: Scene[], studioOrientation: 'auto' | 'horizontal' | 'vertical' }> {
    const layerData = getProjectLayers(projectId);
    if (!layerData) throw new Error('Projeto não encontrado');

    const layers: Layer[] = await Promise.all(
        layerData.map(async (ld): Promise<Layer> => {
            let src: string | undefined;

            if (ld.storagePath) {
                try {
                    src = await downloadLayerImage(ld.storagePath);
                } catch (error) {
                    console.warn('Failed to load layer image:', ld.id, error);
                }
            }

            return {
                id: ld.id,
                name: ld.name,
                visible: ld.visible,
                locked: ld.locked,
                type: ld.type,
                src,
                thumbnail: ld.thumbnail,
                x: ld.x,
                y: ld.y,
                width: ld.width,
                height: ld.height,
                initialX: ld.initialX,
                initialY: ld.initialY,
                initialWidth: ld.initialWidth,
                initialHeight: ld.initialHeight,
                feather: ld.feather,
                renderMode: ld.renderMode,
                isPlaying: ld.isPlaying,
            };
        })
    );

    // Load studio data too
    const studioData = getStudioData(projectId);

    // Update "updatedAt" in history
    const history = getHistoryList();
    const idx = history.findIndex(p => p.id === projectId);
    let studioOrientation: 'auto' | 'horizontal' | 'vertical' = 'auto';
    if (idx >= 0) {
        history[idx].updatedAt = Date.now();
        studioOrientation = history[idx].studioOrientation || 'auto';
        saveHistoryList(history);
    }

    // Convert StudioSceneData back to Scene
    let scenes: Scene[] = [];
    if (studioData && studioData.length > 0) {
        scenes = studioData.map(sd => ({
            id: sd.id,
            startFrame: sd.startFrameStoragePath || null,
            endFrame: sd.endFrameStoragePath || null,
            shots: sd.shots,
            videos: sd.videoStoragePaths || [], // Permanent Firebase Storage URLs
            selectedVideoIndex: sd.videoStoragePaths && sd.videoStoragePaths.length > 0 ? (sd.selectedVideoIndex ?? 0) : -1,
            isGenerating: false,
            variationCount: sd.variationCount || 2,
        }));
    }

    return { layers, scenes, studioOrientation };
}

/**
 * Delete a project from history and storage.
 */
export async function deleteProject(projectId: string, userId: string) {
    const history = getHistoryList().filter(p => p.id !== projectId);
    saveHistoryList(history);
    deleteProjectLayers(projectId);
    await deleteProjectFromStorage(userId, projectId);
}

/**
 * Rename a project.
 */
export function renameProject(projectId: string, newName: string) {
    const history = getHistoryList();
    const idx = history.findIndex(p => p.id === projectId);
    if (idx >= 0) {
        history[idx].name = newName;
        saveHistoryList(history);
    }
}

/**
 * Get the current project ID if there is one active.
 */
export function getCurrentProjectId(): string | null {
    try {
        return localStorage.getItem('visualizae_current_project');
    } catch {
        return null;
    }
}

export function setCurrentProjectId(id: string | null) {
    if (id) {
        localStorage.setItem('visualizae_current_project', id);
    } else {
        localStorage.removeItem('visualizae_current_project');
    }
}
