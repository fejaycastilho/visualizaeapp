import React, { useCallback } from 'react';
import { ModelType, Layer } from '../../types';
import { generateImageContent, getClosestAspectRatio, generateVideo } from '../../services/geminiService';

interface UseCanvasGenerationParams {
    selection: { x: number; y: number; w: number; h: number } | null;
    setSelection: React.Dispatch<React.SetStateAction<{ x: number; y: number; w: number; h: number } | null>>;
    layers: Layer[];
    setLayers: React.Dispatch<React.SetStateAction<Layer[]>>;
    prompt: string;
    referenceImages: string[];
    activeModel: ModelType;
    variationCount: number;
    setSelectedLayerIds: React.Dispatch<React.SetStateAction<string[]>>;
    setRedoStack: React.Dispatch<React.SetStateAction<Layer[]>>;
    isGenerating: boolean;
    setIsGenerating: (v: boolean) => void;
    generatingEffect: string;
    setGeneratingEffect: (v: string) => void;
    onAutoSave?: () => void;
}

const ALL_EFFECTS = [
    { name: 'Rainbow Linear', class: 'effect-rainbow-linear' },
    { name: 'Rainbow Diagonal', class: 'effect-rainbow-diagonal' },
    { name: 'Rainbow Vertical', class: 'effect-rainbow-vertical' },
];

/**
 * Captures a snapshot of all visible layers within the given rect.
 */
export async function getCanvasSnapshot(
    rect: { x: number; y: number; w: number; h: number },
    layers: Layer[]
): Promise<string | null> {
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(rect.w);
    canvas.height = Math.round(rect.h);
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const layersToDraw = [...layers].reverse();

    const loadPromises = layersToDraw.map(layer => {
        if (!layer.visible) return Promise.resolve(null);
        if (layer.type === 'video') return Promise.resolve(null);

        return new Promise<{ img: HTMLImageElement; layer: Layer } | null>((resolve) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => resolve({ img, layer });
            img.onerror = () => resolve(null);
            img.src = layer.src || '';
        });
    });

    const loadedImages = await Promise.all(loadPromises);

    loadedImages.forEach(item => {
        if (!item) return;
        const { img, layer } = item;
        const drawX = layer.x - rect.x;
        const drawY = layer.y - rect.y;
        ctx.drawImage(img, drawX, drawY, layer.width, layer.height);
    });

    return canvas.toDataURL('image/png');
}

export function useCanvasGeneration({
    selection,
    setSelection,
    layers,
    setLayers,
    prompt,
    referenceImages,
    activeModel,
    variationCount,
    setSelectedLayerIds,
    setRedoStack,
    isGenerating,
    setIsGenerating,
    generatingEffect,
    setGeneratingEffect,
    onAutoSave,
}: UseCanvasGenerationParams) {

    const triggerGeneration = useCallback(async (promptText: string, options: { defaultFeather?: number } = {}) => {
        if (!selection) return;

        const randomEffect = ALL_EFFECTS[Math.floor(Math.random() * ALL_EFFECTS.length)].class;
        setGeneratingEffect(randomEffect);
        setIsGenerating(true);

        try {
            const ratio = selection.w / selection.h;
            const apiAspectRatio = getClosestAspectRatio(ratio);

            let imagesToSend: string[] = [];
            let finalPrompt = promptText;
            let layerRenderMode: 'cover' | 'fill' = 'cover';

            // CAPTURE SNAPSHOT FIRST (The Context)
            const snapshot = await getCanvasSnapshot(selection, layers);

            if (snapshot) {
                imagesToSend.push(snapshot);

                if (referenceImages.length > 0) {
                    imagesToSend.push(...referenceImages);
                    finalPrompt += ' . Blend the object from the reference image(s) naturally into the scene.';
                    layerRenderMode = 'fill';
                } else {
                    finalPrompt += ' . Maintain exact scale, perspective and position of original image elements.';
                    layerRenderMode = 'fill';
                }
            } else {
                if (referenceImages.length > 0) {
                    imagesToSend = referenceImages;
                    layerRenderMode = 'cover';
                } else {
                    layerRenderMode = 'fill';
                }
            }

            const isVideoModel = activeModel === ModelType.KLING_PRO;
            if (isVideoModel) layerRenderMode = 'cover';

            const loops = isVideoModel ? 1 : variationCount;

            for (let i = 0; i < loops; i++) {
                if (isVideoModel && imagesToSend.length > 0) {
                    const klingAspectRatio = selection.w >= selection.h ? '16:9' : '9:16';
                    const videoUrl = await generateVideo(finalPrompt, imagesToSend[0], undefined, klingAspectRatio, '5', true);
                    if (videoUrl) {
                        const newLayer: Layer = {
                            id: Date.now().toString() + i,
                            name: `Video: ${finalPrompt.slice(0, 10)}...`,
                            visible: true,
                            locked: false,
                            type: 'video',
                            src: videoUrl,
                            x: selection.x,
                            y: selection.y,
                            width: selection.w,
                            height: selection.h,
                            initialX: selection.x,
                            initialY: selection.y,
                            initialWidth: selection.w,
                            initialHeight: selection.h,
                            feather: 0,
                            isPlaying: true,
                            renderMode: 'cover',
                        };
                        setLayers(prev => [newLayer, ...prev]);
                        setSelectedLayerIds([newLayer.id]);
                    }
                } else {
                    let sizeLabel = '1K';
                    if (activeModel === ModelType.NANO_BANANA_2) {
                        if (selection.w > 3000 || selection.h > 3000) sizeLabel = '4K';
                        else if (selection.w > 2000 || selection.h > 2000) sizeLabel = '2K';
                    }

                    const base64Image = await generateImageContent(
                        activeModel,
                        finalPrompt,
                        apiAspectRatio,
                        sizeLabel,
                        imagesToSend,
                        referenceImages.length > 0 && !snapshot,
                    );

                    if (base64Image) {
                        const newLayer: Layer = {
                            id: Date.now().toString() + i,
                            name: `Gen ${i + 1}: ${finalPrompt.slice(0, 10)}...`,
                            visible: true,
                            locked: false,
                            type: 'generation',
                            src: base64Image,
                            x: selection.x,
                            y: selection.y,
                            width: selection.w,
                            height: selection.h,
                            initialX: selection.x,
                            initialY: selection.y,
                            initialWidth: selection.w,
                            initialHeight: selection.h,
                            feather: options.defaultFeather || 0,
                            renderMode: layerRenderMode,
                        };
                        setLayers(prev => [newLayer, ...prev]);
                        setSelectedLayerIds([newLayer.id]);
                    }
                }
            }

            setRedoStack([]);
        } catch (err: any) {
            console.error('Failed to generate', err);
            const msg = err?.message || '';
            if (msg.toLowerCase().includes('créditos insuficientes') || msg.toLowerCase().includes('insufficient') || err?.code === 'functions/resource-exhausted') {
                alert('⚡ Créditos insuficientes!\n\nVocê não possui créditos suficientes para renderizar.\nAdquira mais créditos para continuar gerando imagens e vídeos.');
            } else if (msg.startsWith('SAFETY_FILTER:')) {
                alert('⚠️ O vídeo foi bloqueado pelo filtro de segurança do Google.\n\nTente modificar o prompt e gerar novamente.');
            } else {
                alert('Erro na geração. Verifique o console ou a chave de API.');
            }
        } finally {
            setIsGenerating(false);
            setSelection(null);
            setGeneratingEffect('');
            if (onAutoSave) {
                setTimeout(() => onAutoSave(), 500);
            }
        }
    }, [selection, layers, referenceImages, activeModel, variationCount, setLayers, setSelectedLayerIds, setRedoStack, setIsGenerating, setSelection, setGeneratingEffect, onAutoSave]);

    const handleGenerate = useCallback(async () => {
        if (!prompt.trim()) return;
        triggerGeneration(prompt);
    }, [prompt, triggerGeneration]);

    const handleMagicFill = useCallback(async () => {
        const magicPrompt = `TASK: OUTPAINTING / EXTENSÃO DE IMAGEM.
INSTRUÇÃO: A imagem de entrada contém uma área visual válida e uma área vazia (preta/transparente).
OBJETIVO: Preencher APENAS a área vazia para estender a cena de forma invisível e contínua.
REGRAS RÍGIDAS:
1. NÃO ALTERE os pixels da imagem original visível.
2. Mantenha continuidade perfeita de linhas, iluminação, sombras, textura e perspectiva.
3. Se a imagem é uma paisagem, estenda a paisagem. Se é um objeto cortado, complete o objeto.
4. O resultado final deve parecer uma única imagem coesa.
5. Fazer a transição das bordas de forma imperceptível, evitando cortes abruptos.`;

        triggerGeneration(magicPrompt, { defaultFeather: 20 });
    }, [triggerGeneration]);

    const handleUpscale4K = useCallback(async () => {
        if (!selection) {
            alert('Desenhe um retângulo de seleção na área que deseja fazer upscale 4K.');
            return;
        }

        setIsGenerating(true);
        const randomEffect = ALL_EFFECTS[Math.floor(Math.random() * ALL_EFFECTS.length)].class;
        setGeneratingEffect(randomEffect);

        const selRect = { ...selection };

        try {
            const snapshot = await getCanvasSnapshot(selRect, layers);
            if (!snapshot) {
                alert('Nenhum conteúdo encontrado na seleção.');
                return;
            }

            const TARGET_PIXELS = 8_000_000;
            const MAX_SIDE = 4096;
            const ratio = selRect.w / selRect.h;
            let targetW = Math.round(Math.sqrt(TARGET_PIXELS * ratio));
            let targetH = Math.round(targetW / ratio);
            if (targetW > MAX_SIDE) { targetW = MAX_SIDE; targetH = Math.round(targetW / ratio); }
            if (targetH > MAX_SIDE) { targetH = MAX_SIDE; targetW = Math.round(targetH * ratio); }

            const upscaleCanvas = document.createElement('canvas');
            upscaleCanvas.width = targetW;
            upscaleCanvas.height = targetH;
            const ctx = upscaleCanvas.getContext('2d');
            if (!ctx) throw new Error('Canvas context failed');

            const img = new Image();
            img.crossOrigin = 'anonymous';
            await new Promise<void>((resolve, reject) => {
                img.onload = () => resolve();
                img.onerror = () => reject(new Error('Image load failed'));
                img.src = snapshot;
            });

            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, 0, 0, targetW, targetH);
            const upscaledBase64 = upscaleCanvas.toDataURL('image/png');

            const restorationPrompt = `Restore and enhance the provided image. Preserve original identity, facial structure, proportions and composition. High-fidelity photo restoration, ultra-realistic, natural skin texture, accurate details, professional photographic look. 4K output, sharp but natural focus, modern cinematic lighting, subtle volumetric lighting, professional color grading, depth of field, HDR. Shot on Arri Alexa, raw photo aesthetic, masterpiece.`;

            const apiRatio = getClosestAspectRatio(ratio);
            const result = await generateImageContent(
                ModelType.NANO_BANANA_2,
                restorationPrompt,
                apiRatio,
                '4K',
                [upscaledBase64],
                true,
            );

            if (result) {
                const newLayer: Layer = {
                    id: Date.now().toString(),
                    name: '4K Upscale',
                    visible: true,
                    locked: false,
                    type: 'generation',
                    src: result,
                    x: selRect.x,
                    y: selRect.y,
                    width: targetW,
                    height: targetH,
                    initialX: selRect.x,
                    initialY: selRect.y,
                    initialWidth: targetW,
                    initialHeight: targetH,
                    feather: 0,
                    renderMode: 'fill',
                };
                setLayers(prev => [newLayer, ...prev]);
                setSelectedLayerIds([newLayer.id]);
                setRedoStack([]);
            } else {
                alert('Upscale falhou. Tente novamente.');
            }
        } catch (err) {
            console.error('4K Upscale error:', err);
            alert('Erro no upscale 4K. Verifique o console.');
        } finally {
            setIsGenerating(false);
            setSelection(null);
            setGeneratingEffect('');
        }
    }, [selection, layers, setIsGenerating, setGeneratingEffect, setSelection, setLayers, setSelectedLayerIds, setRedoStack]);

    return {
        isGenerating,
        generatingEffect,
        handleGenerate,
        handleMagicFill,
        handleUpscale4K,
    };
}
