import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Layer } from '../../types';

interface UseCanvasUploadParams {
    layers: Layer[];
    setLayers: React.Dispatch<React.SetStateAction<Layer[]>>;
    setSelectedLayerIds: React.Dispatch<React.SetStateAction<string[]>>;
    setRedoStack: React.Dispatch<React.SetStateAction<Layer[]>>;
    canvasOffset: { x: number; y: number };
    zoom: number;
}

export function useCanvasUpload({
    layers,
    setLayers,
    setSelectedLayerIds,
    setRedoStack,
    canvasOffset,
    zoom,
}: UseCanvasUploadParams) {
    const [referenceImages, setReferenceImages] = useState<string[]>([]);
    const promptInputRef = useRef<HTMLInputElement>(null);

    const handleImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                const viewportCenterX = (window.innerWidth / 2 - canvasOffset.x) / zoom;
                const viewportCenterY = (window.innerHeight / 2 - canvasOffset.y) / zoom;

                const newLayer: Layer = {
                    id: Date.now().toString(),
                    name: file.name,
                    visible: true,
                    locked: false,
                    type: 'image',
                    src: event.target?.result as string,
                    x: viewportCenterX - img.width / 2,
                    y: viewportCenterY - img.height / 2,
                    width: img.width,
                    height: img.height,
                    initialX: viewportCenterX - img.width / 2,
                    initialY: viewportCenterY - img.height / 2,
                    initialWidth: img.width,
                    initialHeight: img.height,
                    feather: 0,
                    renderMode: 'fill',
                };
                setLayers(prev => [newLayer, ...prev]);
                setSelectedLayerIds([newLayer.id]);
                setRedoStack([]);
            };
            img.src = event.target?.result as string;
        };
        reader.readAsDataURL(file);
        e.target.value = '';
    }, [canvasOffset, zoom, setLayers, setSelectedLayerIds, setRedoStack]);

    const handleReferenceUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            if (event.target?.result && typeof event.target.result === 'string') {
                if (referenceImages.length < 10) {
                    setReferenceImages(prev => [...prev, event.target!.result as string]);
                } else {
                    alert('Limite de 10 referências atingido.');
                }
            }
        };
        reader.readAsDataURL(file);
        e.target.value = '';
    }, [referenceImages.length]);

    const handleRemoveReference = useCallback((index: number) => {
        setReferenceImages(prev => prev.filter((_, i) => i !== index));
    }, []);

    const handleUseLayerAsReference = useCallback((layer: Layer) => {
        if (layer.src && layer.type !== 'video') {
            if (referenceImages.length < 10) {
                setReferenceImages(prev => [...prev, layer.src!]);
            } else {
                alert('Limite de 10 referências atingido.');
            }
        }
    }, [referenceImages.length]);

    // Global paste handler
    useEffect(() => {
        const handleGlobalPaste = (e: ClipboardEvent) => {
            const items = e.clipboardData?.items;
            if (!items) return;

            for (const item of items) {
                if (item.type.indexOf('image') !== -1) {
                    const blob = item.getAsFile();
                    if (!blob) continue;

                    const reader = new FileReader();
                    reader.onload = (event) => {
                        if (event.target?.result && typeof event.target.result === 'string') {
                            const result = event.target.result;

                            // Check if pasting into Prompt Input
                            if (document.activeElement === promptInputRef.current) {
                                if (referenceImages.length < 10) {
                                    setReferenceImages(prev => [...prev, result]);
                                } else {
                                    alert('Limite de 10 referências atingido.');
                                }
                            } else {
                                // Paste into Canvas
                                const img = new Image();
                                img.onload = () => {
                                    const viewportCenterX = (window.innerWidth / 2 - canvasOffset.x) / zoom;
                                    const viewportCenterY = (window.innerHeight / 2 - canvasOffset.y) / zoom;

                                    const newLayer: Layer = {
                                        id: Date.now().toString(),
                                        name: 'Pasted Image',
                                        visible: true,
                                        locked: false,
                                        type: 'image',
                                        src: result,
                                        x: viewportCenterX - img.width / 2,
                                        y: viewportCenterY - img.height / 2,
                                        width: img.width,
                                        height: img.height,
                                        initialX: viewportCenterX - img.width / 2,
                                        initialY: viewportCenterY - img.height / 2,
                                        initialWidth: img.width,
                                        initialHeight: img.height,
                                        feather: 0,
                                        renderMode: 'fill',
                                    };
                                    setLayers(prev => [newLayer, ...prev]);
                                    setSelectedLayerIds([newLayer.id]);
                                    setRedoStack([]);
                                };
                                img.src = result;
                            }
                        }
                    };
                    reader.readAsDataURL(blob);
                }
            }
        };

        window.addEventListener('paste', handleGlobalPaste);
        return () => {
            window.removeEventListener('paste', handleGlobalPaste);
        };
    }, [canvasOffset, zoom, referenceImages, setLayers, setSelectedLayerIds, setRedoStack]);

    return {
        referenceImages,
        setReferenceImages,
        promptInputRef,
        handleImageUpload,
        handleReferenceUpload,
        handleRemoveReference,
        handleUseLayerAsReference,
    };
}
