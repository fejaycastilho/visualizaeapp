import React, { useState, useRef, useCallback } from 'react';
import { Layer, ToolType, Resolution } from '../../types';

interface UseCanvasInteractionParams {
    selectedTool: ToolType;
    layers: Layer[];
    setLayers: React.Dispatch<React.SetStateAction<Layer[]>>;
    availableResolutions: Resolution[];
    isGenerating: boolean;
    showLayerMenuMobile: boolean;
    setShowLayerMenuMobile: (v: boolean) => void;
    setSelectedLayerIds: React.Dispatch<React.SetStateAction<string[]>>;
    setRedoStack: React.Dispatch<React.SetStateAction<Layer[]>>;
}

const CANVAS_SIZE = 4000;
const INITIAL_VIEWPORT_WIDTH = 2500;

export function useCanvasInteraction({
    selectedTool,
    layers,
    setLayers,
    availableResolutions,
    isGenerating,
    showLayerMenuMobile,
    setShowLayerMenuMobile,
    setSelectedLayerIds,
    setRedoStack,
}: UseCanvasInteractionParams) {
    // Calculate initial zoom to fit ~2500px width on screen
    const initialZoom = typeof window !== 'undefined' ? Math.max(0.05, window.innerWidth / INITIAL_VIEWPORT_WIDTH) : 0.15;

    // --- State ---
    const [selection, setSelection] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
    const [draggingLayerId, setDraggingLayerId] = useState<string | null>(null);
    const [layerDragOffset, setLayerDragOffset] = useState<{ x: number; y: number } | null>(null);
    const [zoom, setZoom] = useState(initialZoom);
    const [canvasOffset, setCanvasOffset] = useState({
        x: (typeof window !== 'undefined' ? window.innerWidth : 1920) / 2 - (CANVAS_SIZE / 2) * initialZoom,
        y: (typeof window !== 'undefined' ? window.innerHeight : 1080) / 2 - (CANVAS_SIZE / 2) * initialZoom,
    });

    // --- Refs ---
    const canvasRef = useRef<HTMLDivElement>(null);
    const isMiddlePanning = useRef(false);
    const dragStartRef = useRef<{ x: number; y: number } | null>(null);
    const isDraggingRef = useRef(false);
    const layersRef = useRef<Layer[]>(layers);
    const isDraggingLayerRef = useRef(false);

    // Selection Drag Refs
    const isDraggingSelectionRef = useRef(false);
    const selectionDragStartRef = useRef<{ x: number; y: number } | null>(null);
    const initialSelectionPosRef = useRef<{ x: number; y: number } | null>(null);
    const dragAxisRef = useRef<'horizontal' | 'vertical' | null>(null);

    // Multitouch Refs
    const lastTouchDist = useRef<number | null>(null);
    const lastTouchCenter = useRef<{ x: number; y: number } | null>(null);

    // Sync ref
    layersRef.current = layers;

    // --- Touch helpers ---
    const getTouchDistance = (touches: React.TouchList) => {
        const dx = touches[0].clientX - touches[1].clientX;
        const dy = touches[0].clientY - touches[1].clientY;
        return Math.sqrt(dx * dx + dy * dy);
    };

    const getTouchCenter = (touches: React.TouchList) => ({
        x: (touches[0].clientX + touches[1].clientX) / 2,
        y: (touches[0].clientY + touches[1].clientY) / 2,
    });

    // --- Core Handlers ---

    const handleStart = useCallback((clientX: number, clientY: number, button: number = 0) => {
        if (!canvasRef.current) return;
        if (zoom <= 0.001) return;
        if (isGenerating) return;

        if (showLayerMenuMobile) setShowLayerMenuMobile(false);

        if (button === 1) {
            isMiddlePanning.current = true;
            isDraggingRef.current = true;
            setIsDragging(true);
            dragStartRef.current = { x: clientX, y: clientY };
            setDragStart({ x: clientX, y: clientY });
            return;
        }

        const rect = canvasRef.current.getBoundingClientRect();
        const x = (clientX - rect.left - canvasOffset.x) / zoom;
        const y = (clientY - rect.top - canvasOffset.y) / zoom;

        if (selectedTool === 'select') {
            if (selection &&
                x >= selection.x && x <= selection.x + selection.w &&
                y >= selection.y && y <= selection.y + selection.h) {
                isDraggingSelectionRef.current = true;
                selectionDragStartRef.current = { x, y };
                initialSelectionPosRef.current = { x: selection.x, y: selection.y };
                dragAxisRef.current = null;
                return;
            }

            isDraggingRef.current = true;
            setIsDragging(true);
            dragStartRef.current = { x, y };
            setDragStart({ x, y });
            setSelection(null);
        } else if (selectedTool === 'hand') {
            isDraggingRef.current = true;
            setIsDragging(true);
            dragStartRef.current = { x: clientX, y: clientY };
            setDragStart({ x: clientX, y: clientY });
        } else if (selectedTool === 'move') {
            const clickedLayer = [...layersRef.current].reverse().find(l =>
                x >= l.x && x <= l.x + l.width &&
                y >= l.y && y <= l.y + l.height &&
                l.visible && !l.locked
            );

            if (clickedLayer) {
                isDraggingLayerRef.current = true;
                setDraggingLayerId(clickedLayer.id);
                setSelectedLayerIds([clickedLayer.id]);
                setLayerDragOffset({ x: x - clickedLayer.x, y: y - clickedLayer.y });
            }
        } else if (selectedTool === 'eraser') {
            const clickedLayer = [...layersRef.current].reverse().find(l =>
                x >= l.x && x <= l.x + l.width &&
                y >= l.y && y <= l.y + l.height &&
                l.visible && !l.locked
            );
            if (clickedLayer) {
                setLayers(prev => prev.filter(l => l.id !== clickedLayer.id));
                setRedoStack([]);
            }
        }
    }, [zoom, isGenerating, showLayerMenuMobile, setShowLayerMenuMobile, selectedTool, selection, canvasOffset, setLayers, setSelectedLayerIds, setRedoStack]);

    const handleMove = useCallback((clientX: number, clientY: number) => {
        // Handle Layer Dragging
        if (selectedTool === 'move' && isDraggingLayerRef.current && draggingLayerId && layerDragOffset && canvasRef.current) {
            const rect = canvasRef.current.getBoundingClientRect();
            const currentX = (clientX - rect.left - canvasOffset.x) / zoom;
            const currentY = (clientY - rect.top - canvasOffset.y) / zoom;
            const newX = currentX - layerDragOffset.x;
            const newY = currentY - layerDragOffset.y;
            setLayers(prev => prev.map(l => l.id === draggingLayerId ? { ...l, x: newX, y: newY } : l));
            return;
        }

        // Handle Selection Dragging (Restricted Axis)
        if (isDraggingSelectionRef.current && selectionDragStartRef.current && initialSelectionPosRef.current && selection && canvasRef.current) {
            const rect = canvasRef.current.getBoundingClientRect();
            const currentX = (clientX - rect.left - canvasOffset.x) / zoom;
            const currentY = (clientY - rect.top - canvasOffset.y) / zoom;
            const dx = currentX - selectionDragStartRef.current.x;
            const dy = currentY - selectionDragStartRef.current.y;

            if (!dragAxisRef.current) {
                const threshold = 5;
                if (Math.abs(dx) > threshold || Math.abs(dy) > threshold) {
                    dragAxisRef.current = Math.abs(dx) > Math.abs(dy) ? 'horizontal' : 'vertical';
                }
            }

            if (dragAxisRef.current) {
                let newX = initialSelectionPosRef.current.x;
                let newY = initialSelectionPosRef.current.y;
                if (dragAxisRef.current === 'horizontal') newX += dx;
                else newY += dy;
                setSelection(prev => prev ? ({ ...prev, x: newX, y: newY }) : null);
            }
            return;
        }

        if (!isDraggingRef.current || !dragStartRef.current) return;

        if (isMiddlePanning.current || selectedTool === 'hand') {
            const dx = clientX - dragStartRef.current.x;
            const dy = clientY - dragStartRef.current.y;
            setCanvasOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }));
            dragStartRef.current = { x: clientX, y: clientY };
            return;
        }

        if (selectedTool === 'select') {
            if (!canvasRef.current) return;
            const rect = canvasRef.current.getBoundingClientRect();
            const currentX = (clientX - rect.left - canvasOffset.x) / zoom;
            const currentY = (clientY - rect.top - canvasOffset.y) / zoom;
            const startX = dragStartRef.current.x;
            const startY = dragStartRef.current.y;

            let rawW = Math.abs(currentX - startX);
            let rawH = Math.abs(currentY - startY);

            const resolutions = availableResolutions && availableResolutions.length > 0
                ? availableResolutions
                : [{ w: 1024, h: 1024, ratio: 1 }];

            const currentRatio = rawH === 0 ? 1 : rawW / rawH;

            let bestRes = resolutions[0];
            let minDiff = Number.MAX_VALUE;
            for (const res of resolutions) {
                const diff = Math.abs(res.ratio - currentRatio);
                if (diff < minDiff) { minDiff = diff; bestRes = res; }
            }

            let newW, newH;
            if (currentRatio > bestRes.ratio) {
                newH = rawH; newW = newH * bestRes.ratio;
            } else {
                newW = rawW; newH = newW / bestRes.ratio;
            }

            const isLeft = currentX < startX;
            const isUp = currentY < startY;
            let finalX = isLeft ? startX - newW : startX;
            let finalY = isUp ? startY - newH : startY;

            setSelection({ x: finalX, y: finalY, w: newW, h: newH });
        }
    }, [selectedTool, draggingLayerId, layerDragOffset, canvasOffset, zoom, selection, availableResolutions, setLayers]);

    const handleEnd = useCallback(() => {
        if (selectedTool === 'select') {
            setSelection(prev => {
                if (prev && (prev.w < 10 || prev.h < 10)) return null;
                return prev;
            });
        }
        isMiddlePanning.current = false;
        isDraggingRef.current = false;
        isDraggingLayerRef.current = false;
        setIsDragging(false);
        setDraggingLayerId(null);
        setLayerDragOffset(null);
        setDragStart(null);
        dragStartRef.current = null;
        lastTouchDist.current = null;
        lastTouchCenter.current = null;

        // Reset Selection Drag
        isDraggingSelectionRef.current = false;
        selectionDragStartRef.current = null;
        initialSelectionPosRef.current = null;
        dragAxisRef.current = null;
    }, [selectedTool]);

    // --- Event Wrappers ---

    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        handleStart(e.clientX, e.clientY, e.button);
    }, [handleStart]);

    const handleMouseMove = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        handleMove(e.clientX, e.clientY);
    }, [handleMove]);

    const handleMouseUp = useCallback(() => handleEnd(), [handleEnd]);

    const handleDoubleClick = useCallback((e: React.MouseEvent) => {
        if (!canvasRef.current) return;
        const rect = canvasRef.current.getBoundingClientRect();
        const x = (e.clientX - rect.left - canvasOffset.x) / zoom;
        const y = (e.clientY - rect.top - canvasOffset.y) / zoom;

        const clickedLayer = [...layersRef.current].reverse().find(l =>
            x >= l.x && x <= l.x + l.width &&
            y >= l.y && y <= l.y + l.height &&
            l.visible
        );

        if (clickedLayer) {
            setSelection({
                x: clickedLayer.x,
                y: clickedLayer.y,
                w: clickedLayer.width,
                h: clickedLayer.height,
            });
            setSelectedLayerIds([clickedLayer.id]);
        }
    }, [canvasOffset, zoom, setSelectedLayerIds]);

    const handleTouchStart = useCallback((e: React.TouchEvent) => {
        if (e.touches.length === 1) {
            handleStart(e.touches[0].clientX, e.touches[0].clientY, 0);
        } else if (e.touches.length === 2) {
            isDraggingRef.current = false;
            setIsDragging(false);
            setDragStart(null);
            dragStartRef.current = null;
            lastTouchDist.current = getTouchDistance(e.touches);
            lastTouchCenter.current = getTouchCenter(e.touches);
        }
    }, [handleStart]);

    const handleTouchMove = useCallback((e: React.TouchEvent) => {
        if (e.touches.length === 1) {
            handleMove(e.touches[0].clientX, e.touches[0].clientY);
        } else if (e.touches.length === 2 && lastTouchDist.current && lastTouchCenter.current && canvasRef.current) {
            const currentDist = getTouchDistance(e.touches);
            const currentCenter = getTouchCenter(e.touches);
            const scale = currentDist / lastTouchDist.current;
            const newZoom = Math.min(Math.max(0.05, zoom * scale), 5);

            const rect = canvasRef.current.getBoundingClientRect();
            const centerX = lastTouchCenter.current.x - rect.left;
            const centerY = lastTouchCenter.current.y - rect.top;
            const worldX = (centerX - canvasOffset.x) / zoom;
            const worldY = (centerY - canvasOffset.y) / zoom;
            const newOffsetX = currentCenter.x - rect.left - worldX * newZoom;
            const newOffsetY = currentCenter.y - rect.top - worldY * newZoom;

            setZoom(newZoom);
            setCanvasOffset({ x: newOffsetX, y: newOffsetY });
            lastTouchDist.current = currentDist;
            lastTouchCenter.current = currentCenter;
        }
    }, [handleMove, zoom, canvasOffset]);

    const handleTouchEnd = useCallback(() => handleEnd(), [handleEnd]);

    const handleWheel = useCallback((e: React.WheelEvent) => {
        if (!canvasRef.current) return;
        if (Math.abs(e.deltaY) < 0.001) return;

        const zoomIntensity = 0.001;
        const newZoom = Math.min(Math.max(0.05, zoom * Math.exp(-e.deltaY * zoomIntensity)), 5);

        const rect = canvasRef.current.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const worldX = (mouseX - canvasOffset.x) / zoom;
        const worldY = (mouseY - canvasOffset.y) / zoom;
        const newOffsetX = mouseX - worldX * newZoom;
        const newOffsetY = mouseY - worldY * newZoom;

        setZoom(newZoom);
        setCanvasOffset({ x: newOffsetX, y: newOffsetY });
    }, [zoom, canvasOffset]);

    return {
        // State
        selection,
        setSelection,
        isDragging,
        dragStart,
        zoom,
        setZoom,
        canvasOffset,
        setCanvasOffset,

        // Refs
        canvasRef,

        // Constants
        CANVAS_SIZE,
        initialZoom,

        // Event handlers
        handleMouseDown,
        handleMouseMove,
        handleMouseUp,
        handleDoubleClick,
        handleTouchStart,
        handleTouchMove,
        handleTouchEnd,
        handleWheel,
    };
}
