
import React, { useState } from 'react';
import { ModelType, Layer, ToolType, User, Resolution } from '../types';
import { MODEL_2_RESOLUTIONS } from '../constants';
import LayerPanel from './LayerPanel';
import Toolbar from './Toolbar';
import LayerMenu from './LayerMenu';
import { Loader2, BoxSelect, Check, ArrowRight, Sparkles, AlertTriangle, Film, Clapperboard, Paperclip, X, Maximize2 } from 'lucide-react';

// Modularized hooks & helpers
import { useCanvasInteraction } from './canvas/useCanvasInteraction';
import { useCanvasGeneration } from './canvas/useCanvasGeneration';
import { useCanvasLayers } from './canvas/useCanvasLayers';
import { useCanvasUpload } from './canvas/useCanvasUpload';
import { handleDownload, handleFitScreen, getCurrentResolutionMatch, getResolutionStatus } from './canvas/canvasUtils';

interface CanvasModeProps {
    user: User;
    layers: Layer[];
    setLayers: React.Dispatch<React.SetStateAction<Layer[]>>;
    registerCanvasRef?: (el: HTMLCanvasElement | null) => void;
    onAutoSave?: () => void;
}

const CanvasMode: React.FC<CanvasModeProps> = ({ user, layers, setLayers, registerCanvasRef, onAutoSave }) => {
    // --- Local State ---
    const [activeModel, setActiveModel] = useState<ModelType>(ModelType.NANO_BANANA_2);
    const [selectedTool, setSelectedTool] = useState<ToolType>('select');
    const [prompt, setPrompt] = useState('');
    const [variationCount, setVariationCount] = useState<number>(1);
    const [isGeneratingState, setIsGeneratingState] = useState(false);
    const [generatingEffectState, setGeneratingEffectState] = useState<string>('');

    // Resolutions based on active model
    const availableResolutions = MODEL_2_RESOLUTIONS;

    // --- Layers Hook ---
    const {
        selectedLayerIds, setSelectedLayerIds,
        showLayerMenuMobile, setShowLayerMenuMobile,
        redoStack, setRedoStack,
        handleUndo, handleRedo,
        handleUpdateLayer, handleDeleteLayer,
        handleReorderLayers, handleMoveLayer,
        handleResetLayer,
        handleMobileLayerSelect, handleLayerSelect,
    } = useCanvasLayers({ layers, setLayers });

    // --- Interaction Hook ---
    const {
        selection, setSelection,
        isDragging, dragStart,
        zoom, setZoom,
        canvasOffset, setCanvasOffset,
        canvasRef,
        CANVAS_SIZE, initialZoom,
        handleMouseDown, handleMouseMove, handleMouseUp,
        handleDoubleClick,
        handleTouchStart, handleTouchMove, handleTouchEnd,
        handleWheel,
    } = useCanvasInteraction({
        selectedTool,
        layers,
        setLayers,
        availableResolutions,
        isGenerating: isGeneratingState,
        showLayerMenuMobile,
        setShowLayerMenuMobile,
        setSelectedLayerIds,
        setRedoStack,
    });

    // --- Upload Hook ---
    const {
        referenceImages, setReferenceImages,
        promptInputRef,
        handleImageUpload,
        handleReferenceUpload,
        handleRemoveReference,
        handleUseLayerAsReference,
    } = useCanvasUpload({
        layers,
        setLayers,
        setSelectedLayerIds,
        setRedoStack,
        canvasOffset,
        zoom,
    });

    // --- Generation Hook ---
    const {
        isGenerating,
        generatingEffect,
        handleGenerate,
        handleMagicFill,
        handleUpscale4K,
    } = useCanvasGeneration({
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
        isGenerating: isGeneratingState,
        setIsGenerating: setIsGeneratingState,
        generatingEffect: generatingEffectState,
        setGeneratingEffect: setGeneratingEffectState,
        onAutoSave,
    });

    // --- Derived State ---
    const currentMatch = getCurrentResolutionMatch(selection, availableResolutions);
    const resStatus = getResolutionStatus(selection, currentMatch, activeModel);
    const isWarning = resStatus.status === 'warning';
    const visualScale = 1 / zoom;
    const isVideoMode = activeModel === ModelType.KLING_PRO;

    const activeLayer = selectedLayerIds.length === 1 ? layers.find(l => l.id === selectedLayerIds[0]) : null;
    const activeLayerIndex = activeLayer ? layers.findIndex(l => l.id === activeLayer.id) : -1;

    // --- Render ---
    return (
        <div className="flex-1 flex flex-col h-full relative">
            {/* Top Bar */}
            <div
                className="h-14 border-b border-white/5 bg-[#1f1f23] flex items-center px-4 justify-between z-40 relative shadow-sm shrink-0"
                style={{ transform: 'translateZ(0)' }}
            >
                {/* Left: Spacer */}
                <div className="flex items-center gap-2 shrink-0 z-10 w-24" />

                {/* Center: Model Selector */}
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
                    <div className="flex bg-[#121215] rounded-lg p-1 border border-white/5 gap-1">
                        <button
                            onClick={() => setActiveModel(ModelType.NANO_BANANA_2)}
                            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1 ${activeModel === ModelType.NANO_BANANA_2 ? 'bg-emerald-600 text-white shadow-lg' : 'text-gray-400 hover:text-gray-200'}`}
                        >
                            Nano
                            <span className="bg-black/20 px-1 rounded text-[9px] border border-white/10">PRO</span>
                        </button>
                        <button
                            onClick={() => setActiveModel(ModelType.KLING_PRO)}
                            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1 ${activeModel === ModelType.KLING_PRO ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-400 hover:text-gray-200'}`}
                            title="Kling 3.0 Pro (1080p)"
                        >
                            Kling Pro
                            <span className="bg-black/20 px-1 rounded text-[9px] border border-white/10"><Clapperboard size={8} /></span>
                        </button>
                    </div>
                </div>

                {/* Right: Layers & Avatar */}
                <div className="flex items-center gap-2 z-10 flex-1 justify-end md:flex-none">
                    <div className="flex items-center overflow-x-auto gap-2 no-scrollbar md:hidden mask-linear h-8 max-w-[120px]">
                        {[...layers].reverse().map(layer => (
                            <div key={layer.id} className="relative shrink-0">
                                <button
                                    onClick={() => handleMobileLayerSelect(layer.id)}
                                    className={`relative w-8 h-8 rounded-md overflow-hidden border-2 shrink-0 transition-all ${selectedLayerIds.includes(layer.id) ? 'border-purple-500 scale-110 z-10' : 'border-white/10 opacity-70 grayscale'}`}
                                >
                                    {layer.type === 'video' ? (
                                        <div className="w-full h-full bg-black flex items-center justify-center">
                                            <Film size={12} className="text-teal-400" />
                                        </div>
                                    ) : (
                                        <img src={layer.src} className="w-full h-full object-cover" alt="layer" />
                                    )}
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {showLayerMenuMobile && activeLayer && (
                <div
                    className="fixed inset-0 z-[60] flex items-start justify-center pt-20 bg-black/50 backdrop-blur-sm md:hidden"
                    onClick={() => setShowLayerMenuMobile(false)}
                    style={{ touchAction: 'none' }}
                >
                    <div onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
                        <LayerMenu
                            layer={activeLayer}
                            onUpdate={(updates) => handleUpdateLayer(activeLayer.id, updates)}
                            onDelete={() => handleDeleteLayer(activeLayer.id)}
                            onMove={(dir) => handleMoveLayer(activeLayer.id, dir)}
                            onUseAsReference={() => handleUseLayerAsReference(activeLayer)}
                            onResetPosition={activeLayer.initialX !== undefined ? handleResetLayer : undefined}
                            isFirst={activeLayerIndex === 0}
                            isLast={activeLayerIndex === layers.length - 1}
                            className="w-80 shadow-2xl border-purple-500/20"
                        />
                    </div>
                </div>
            )}

            {/* Main Layout Area */}
            <div className="flex-1 flex overflow-hidden relative">

                {/* Canvas Wrapper */}
                <div className="flex-1 relative bg-[#0f0f12] overflow-hidden touch-none overscroll-none min-w-0"
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                    onTouchStart={handleTouchStart}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                    onWheel={handleWheel}
                    onDoubleClick={handleDoubleClick}
                >

                    <Toolbar
                        selectedTool={selectedTool}
                        onSelectTool={setSelectedTool}
                        canUndo={layers.length > 0}
                        canRedo={redoStack.length > 0}
                        onUndo={handleUndo}
                        onRedo={handleRedo}
                        onUploadImage={handleImageUpload}
                        onFitScreen={() => handleFitScreen(layers, initialZoom, CANVAS_SIZE, setZoom, setCanvasOffset)}
                        onDownload={() => handleDownload(selection, layers)}
                    />

                    <div
                        ref={canvasRef}
                        className={`absolute inset-0 origin-top-left ${selectedTool === 'hand' ? 'cursor-grab active:cursor-grabbing' : selectedTool === 'move' ? 'cursor-move' : selectedTool === 'eraser' ? 'cursor-not-allowed' : 'pointer-events-auto cursor-crosshair'}`}
                    >
                        <div style={{
                            transform: `translate3d(${canvasOffset.x}px, ${canvasOffset.y}px, 0) scale(${zoom})`,
                            transformOrigin: '0 0',
                            width: `${CANVAS_SIZE}px`,
                            height: `${CANVAS_SIZE}px`,
                            willChange: 'transform',
                            backfaceVisibility: 'hidden'
                        }}>
                            <div className="absolute inset-0 w-[4000px] h-[4000px] pointer-events-none opacity-20"
                                style={{
                                    backgroundImage: 'radial-gradient(#3f3f46 1px, transparent 1px)',
                                    backgroundSize: '20px 20px'
                                }}>
                            </div>

                            {[...layers].reverse().map(layer => {
                                if (!layer.visible) return null;
                                const maskStyle: React.CSSProperties = layer.feather ? {
                                    maskImage: `linear-gradient(to right, transparent, black ${layer.feather}px, black calc(100% - ${layer.feather}px), transparent), linear-gradient(to bottom, transparent, black ${layer.feather}px, black calc(100% - ${layer.feather}px), transparent)`,
                                    WebkitMaskImage: `linear-gradient(to right, transparent, black ${layer.feather}px, black calc(100% - ${layer.feather}px), transparent), linear-gradient(to bottom, transparent, black ${layer.feather}px, black calc(100% - ${layer.feather}px), transparent)`,
                                    maskComposite: 'intersect',
                                    WebkitMaskComposite: 'source-in'
                                } : {};

                                const renderMode = layer.renderMode || 'cover';
                                const objectFitClass = `object-${renderMode}`;

                                return (
                                    <div
                                        key={layer.id}
                                        className={`absolute ${selectedTool === 'move' ? 'pointer-events-auto' : 'pointer-events-none'}`}
                                        style={{
                                            left: layer.x,
                                            top: layer.y,
                                            width: layer.width,
                                            height: layer.height,
                                            ...maskStyle
                                        }}
                                    >
                                        {layer.type === 'video' ? (
                                            <video
                                                ref={(el) => {
                                                    if (el) {
                                                        if (layer.isPlaying !== false) {
                                                            el.play().catch(() => { });
                                                        } else {
                                                            el.pause();
                                                        }
                                                    }
                                                }}
                                                src={layer.src}
                                                className="w-full h-full object-cover select-none"
                                                loop
                                                playsInline
                                            />
                                        ) : (
                                            <img
                                                src={layer.src}
                                                alt={layer.name}
                                                className={`w-full h-full ${objectFitClass} select-none`}
                                                draggable={false}
                                            />
                                        )}
                                    </div>
                                );
                            })}

                            {selection && (
                                <div
                                    className={`absolute bg-transparent z-10 flex flex-col justify-end transition-colors shadow-[0_0_15px_rgba(0,0,0,0.5)] pointer-events-auto cursor-move`}
                                    style={{
                                        left: selection.x,
                                        top: selection.y,
                                        width: selection.w,
                                        height: selection.h,
                                        borderWidth: `${2 * visualScale}px`,
                                        borderStyle: 'solid',
                                        borderColor: isWarning ? '#facc15' : isVideoMode ? '#2563eb' : '#9333ea'
                                    }}
                                >
                                    {isGeneratingState && (
                                        <div className="absolute inset-0 w-full h-full pointer-events-none overflow-hidden rounded-sm">
                                            <div className={`absolute inset-0 ${generatingEffectState} opacity-30 blur-xl`}></div>
                                            <div className="absolute inset-0 animate-pulse-border z-30"></div>
                                        </div>
                                    )}

                                    <div
                                        className={`absolute ${isWarning ? 'bg-yellow-400 text-black' : isVideoMode ? 'bg-blue-600 text-white' : 'bg-purple-600 text-white'} text-xs font-bold px-3 py-1.5 rounded-md shadow-xl font-mono whitespace-nowrap flex items-center gap-2 transition-colors border border-white/20 z-50`}
                                        style={{
                                            transform: `scale(${visualScale})`,
                                            transformOrigin: 'bottom left',
                                            bottom: `calc(100% + ${5 * visualScale}px)`,
                                            left: 0
                                        }}
                                    >
                                        <BoxSelect size={14} />
                                        {Math.round(selection.w)} x {Math.round(selection.h)}

                                        {currentMatch && !isWarning && (
                                            <span className="flex items-center gap-1 ml-1 font-extrabold border-l border-white/20 pl-2">
                                                <Check size={12} strokeWidth={3} /> Valid
                                            </span>
                                        )}

                                        {isWarning && (
                                            <span className="flex items-center gap-1 ml-1 font-extrabold border-l border-black/20 pl-2">
                                                <AlertTriangle size={12} strokeWidth={3} /> Qualidade Reduzida
                                            </span>
                                        )}
                                    </div>

                                    {isWarning && (
                                        <div
                                            className="absolute bg-yellow-400 text-black font-bold text-xs px-3 py-2 rounded-md shadow-xl w-max max-w-xs border-2 border-white/20 z-50"
                                            style={{
                                                transform: `scale(${visualScale})`,
                                                transformOrigin: 'top left',
                                                top: `calc(100% + ${5 * visualScale}px)`,
                                                left: 0
                                            }}
                                        >
                                            {resStatus.msg}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Floating Reference Tray */}
                    {referenceImages.length > 0 && (
                        <div
                            className="absolute bottom-[72px] left-4 bg-[#1f1f23] border border-white/10 p-2 rounded-xl shadow-2xl flex gap-2 z-50 max-w-[calc(100%-32px)] overflow-x-auto"
                            onMouseDown={(e) => e.stopPropagation()}
                            onClick={(e) => e.stopPropagation()}
                        >
                            {referenceImages.map((img, idx) => (
                                <div key={idx} className="w-12 h-12 rounded overflow-hidden border border-white/20 relative shrink-0 group">
                                    <img src={img} alt="Ref" className="w-full h-full object-cover" />
                                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity cursor-pointer"
                                        onClick={() => handleRemoveReference(idx)}>
                                        <X size={14} className="text-white hover:text-red-400" />
                                    </div>
                                </div>
                            ))}
                            <div className="flex items-center justify-center px-2">
                                <span className="text-[10px] text-gray-500 font-bold uppercase">{referenceImages.length}/10 Refs</span>
                            </div>
                        </div>
                    )}

                    {/* Bottom Prompt Bar */}
                    <div
                        className="absolute bottom-0 left-0 w-full p-1 md:p-2 bg-[#1f1f23] border-t border-white/10 z-50 flex gap-1 md:gap-2 shadow-[0_-5px_15px_rgba(0,0,0,0.3)] items-center min-h-[56px] md:min-h-[64px] pb-[env(safe-area-inset-bottom)]"
                        onMouseDown={(e) => e.stopPropagation()}
                        onTouchStart={(e) => e.stopPropagation()}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Reference Image Trigger */}
                        <label className={`p-2 md:p-3 rounded-lg font-bold transition-all flex items-center justify-center aspect-square cursor-pointer h-9 w-9 md:h-10 md:w-10 ${referenceImages.length > 0 ? 'bg-purple-500/20 text-purple-400 border border-purple-500/50' : 'bg-gray-800 text-gray-500 hover:bg-white/5'}`} title="Anexar Referência">
                            <Paperclip size={18} className="md:w-5 md:h-5" />
                            <input
                                type="file"
                                className="hidden"
                                accept="image/*"
                                onChange={handleReferenceUpload}
                            />
                        </label>

                        {/* Input Area */}
                        <div className="flex-1 relative flex flex-col justify-center min-w-0">
                            <input
                                ref={promptInputRef}
                                type="text"
                                placeholder={isVideoMode ? "Descreva o vídeo..." : referenceImages.length > 0 ? "Descreva como usar as referências..." : "Descreva a imagem..."}
                                className="w-full bg-[#121215] border border-white/10 rounded-lg px-3 md:px-4 h-9 md:h-10 text-sm md:text-base text-white focus:border-purple-500 focus:outline-none transition-all placeholder:text-gray-600"
                                value={prompt}
                                onChange={(e) => setPrompt(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
                            />
                        </div>

                        {/* Variation Count Selector */}
                        {!isVideoMode && (
                            <div className="hidden md:flex flex-col gap-0.5 justify-center">
                                <div className="flex items-center bg-gray-800 rounded-lg border border-white/5 h-10 px-1">
                                    <span className="text-[9px] text-gray-500 font-bold uppercase mr-1">VARS</span>
                                    <select
                                        value={variationCount}
                                        onChange={(e) => setVariationCount(parseInt(e.target.value))}
                                        className="bg-transparent text-white font-bold text-sm outline-none cursor-pointer text-center"
                                        title="Quantidade de Variações"
                                    >
                                        <option value={1} className="bg-[#1f1f23] text-white">1</option>
                                        <option value={2} className="bg-[#1f1f23] text-white">2</option>
                                        <option value={3} className="bg-[#1f1f23] text-white">3</option>
                                        <option value={4} className="bg-[#1f1f23] text-white">4</option>
                                        <option value={5} className="bg-[#1f1f23] text-white">5</option>
                                    </select>
                                </div>
                            </div>
                        )}

                        <button
                            onClick={handleMagicFill}
                            disabled={isGeneratingState || !selection || isVideoMode}
                            className={`rounded-lg font-bold transition-all flex items-center justify-center h-9 w-9 md:h-10 md:w-10 md:w-auto md:px-4 gap-2 ${!selection || isVideoMode ? 'bg-gray-800 text-gray-500 cursor-not-allowed' :
                                'bg-teal-600 text-white hover:bg-teal-500 shadow-lg'
                                }`}
                            title="Preencher Vazio"
                        >
                            <Sparkles size={18} className="md:w-5 md:h-5" />
                            <span className="hidden md:inline">Preencher</span>
                        </button>

                        <button
                            onClick={handleUpscale4K}
                            disabled={isGeneratingState || !selection || isVideoMode}
                            className={`rounded-lg font-extrabold transition-all flex items-center justify-center h-9 w-9 md:h-10 md:w-auto md:px-4 gap-2 text-xs ${isGeneratingState || !selection || isVideoMode ? 'bg-gray-800 text-gray-500 cursor-not-allowed' :
                                'bg-amber-600 text-white hover:bg-amber-500 shadow-lg'
                                }`}
                            title="Upscale 4K - Restaurar e aumentar resolução"
                        >
                            <Maximize2 size={18} className="md:w-5 md:h-5" />
                            <span className="hidden md:inline">4K</span>
                        </button>

                        <button
                            onClick={handleGenerate}
                            disabled={isGeneratingState || !selection}
                            className={`rounded-lg font-bold transition-all flex items-center justify-center h-9 w-9 md:h-10 md:w-10 md:w-auto md:px-6 gap-2 ${isGeneratingState ? 'bg-purple-900 text-purple-300' :
                                !selection ? 'bg-gray-800 text-gray-500 cursor-not-allowed' :
                                    isVideoMode ? 'bg-blue-600 text-white hover:bg-blue-500 shadow-lg' :
                                        'bg-purple-600 text-white hover:bg-purple-500 shadow-lg'
                                }`}
                        >
                            {isGeneratingState ? <Loader2 className="animate-spin md:w-6 md:h-6" size={18} /> : <ArrowRight size={18} className="md:w-6 md:h-6" />}
                            <span className="hidden md:inline">{isGeneratingState ? 'Gerando...' : 'Gerar'}</span>
                        </button>
                    </div>
                </div>

                {/* Right Sidebar (Desktop Only) */}
                <div className="hidden md:block w-72 bg-[#1f1f23] border-l border-white/5 z-50 relative shrink-0">
                    <LayerPanel
                        layers={layers}
                        selectedLayerIds={selectedLayerIds}
                        onSelect={handleLayerSelect}
                        onToggleVisibility={(id) => handleUpdateLayer(id, { visible: !layers.find(l => l.id === id)?.visible })}
                        onDelete={handleDeleteLayer}
                        onUpdateLayer={handleUpdateLayer}
                        isOpen={true}
                        onClose={() => { }}
                        onReorder={handleReorderLayers}
                        onMoveLayer={handleMoveLayer}
                        onUseAsReference={handleUseLayerAsReference}
                    />
                </div>
            </div>
        </div>
    );
};

export default CanvasMode;
