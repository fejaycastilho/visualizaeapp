import React, { useState, useCallback } from 'react';
import { Layer } from '../../types';

interface UseCanvasLayersParams {
    layers: Layer[];
    setLayers: React.Dispatch<React.SetStateAction<Layer[]>>;
}

export function useCanvasLayers({ layers, setLayers }: UseCanvasLayersParams) {
    const [selectedLayerIds, setSelectedLayerIds] = useState<string[]>([]);
    const [showLayerMenuMobile, setShowLayerMenuMobile] = useState(false);
    const [redoStack, setRedoStack] = useState<Layer[]>([]);

    const handleUndo = useCallback(() => {
        if (layers.length === 0) return;
        const [removed, ...remaining] = layers;
        setLayers(remaining);
        setRedoStack(prev => [removed, ...prev]);

        if (selectedLayerIds.includes(removed.id)) {
            setSelectedLayerIds(prev => prev.filter(x => x !== removed.id));
            setShowLayerMenuMobile(false);
        }
    }, [layers, setLayers, selectedLayerIds]);

    const handleRedo = useCallback(() => {
        if (redoStack.length === 0) return;
        const [restored, ...remainingStack] = redoStack;
        setRedoStack(remainingStack);
        setLayers(prev => [restored, ...prev]);
        setSelectedLayerIds([restored.id]);
    }, [redoStack, setLayers]);

    const handleUpdateLayer = useCallback((id: string, updates: Partial<Layer>) => {
        setLayers(prev => prev.map(l => l.id === id ? { ...l, ...updates } : l));
    }, [setLayers]);

    const handleDeleteLayer = useCallback((id: string) => {
        setLayers(prev => prev.filter(l => l.id !== id));
        if (selectedLayerIds.includes(id)) {
            setSelectedLayerIds(prev => prev.filter(x => x !== id));
            setShowLayerMenuMobile(false);
        }
        setRedoStack([]);
    }, [setLayers, selectedLayerIds]);

    const handleReorderLayers = useCallback((fromIndex: number, toIndex: number) => {
        setLayers(prev => {
            const newLayers = [...prev];
            const [movedItem] = newLayers.splice(fromIndex, 1);
            newLayers.splice(toIndex, 0, movedItem);
            return newLayers;
        });
    }, [setLayers]);

    const handleMoveLayer = useCallback((id: string, direction: 'up' | 'down') => {
        setLayers(prev => {
            const index = prev.findIndex(l => l.id === id);
            if (index === -1) return prev;

            const newLayers = [...prev];
            if (direction === 'up') {
                if (index === 0) return prev;
                const temp = newLayers[index];
                newLayers[index] = newLayers[index - 1];
                newLayers[index - 1] = temp;
            } else {
                if (index === prev.length - 1) return prev;
                const temp = newLayers[index];
                newLayers[index] = newLayers[index + 1];
                newLayers[index + 1] = temp;
            }
            return newLayers;
        });
    }, [setLayers]);

    const handleResetLayer = useCallback(() => {
        if (selectedLayerIds.length === 0) return;
        setLayers(prev => prev.map(l => {
            if (selectedLayerIds.includes(l.id) && l.initialX !== undefined) {
                return {
                    ...l,
                    x: l.initialX!,
                    y: l.initialY!,
                    width: l.initialWidth!,
                    height: l.initialHeight!,
                };
            }
            return l;
        }));
    }, [selectedLayerIds, setLayers]);

    const handleMobileLayerSelect = useCallback((id: string) => {
        if (selectedLayerIds.length === 1 && selectedLayerIds[0] === id) {
            setShowLayerMenuMobile(!showLayerMenuMobile);
        } else {
            setSelectedLayerIds([id]);
            setShowLayerMenuMobile(true);
        }
    }, [selectedLayerIds, showLayerMenuMobile]);

    const handleLayerSelect = useCallback((id: string, e: React.MouseEvent) => {
        if (e.ctrlKey || e.metaKey) {
            setSelectedLayerIds(prev =>
                prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
            );
        } else if (e.shiftKey) {
            const lastId = selectedLayerIds[selectedLayerIds.length - 1];
            const lastIdx = layers.findIndex(l => l.id === lastId);
            const currIdx = layers.findIndex(l => l.id === id);
            if (lastIdx >= 0 && currIdx >= 0) {
                const [start, end] = [Math.min(lastIdx, currIdx), Math.max(lastIdx, currIdx)];
                const rangeIds = layers.slice(start, end + 1).map(l => l.id);
                setSelectedLayerIds(prev => [...new Set([...prev, ...rangeIds])]);
            } else {
                setSelectedLayerIds([id]);
            }
        } else {
            setSelectedLayerIds([id]);
        }
    }, [selectedLayerIds, layers]);

    return {
        selectedLayerIds,
        setSelectedLayerIds,
        showLayerMenuMobile,
        setShowLayerMenuMobile,
        redoStack,
        setRedoStack,

        handleUndo,
        handleRedo,
        handleUpdateLayer,
        handleDeleteLayer,
        handleReorderLayers,
        handleMoveLayer,
        handleResetLayer,
        handleMobileLayerSelect,
        handleLayerSelect,
    };
}
