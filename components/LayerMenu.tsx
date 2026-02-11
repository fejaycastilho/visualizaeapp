
import React, { useState } from 'react';
import { Eye, EyeOff, Trash2, ArrowUp, ArrowDown, Download, Play, Pause, ImagePlus, RotateCcw, Type } from 'lucide-react';
import { Layer } from '../types';
import { rerenderDecorLayer } from './canvas/useDecorZones';

interface LayerMenuProps {
    layer: Layer;
    onUpdate: (updates: Partial<Layer>) => void;
    onDelete: () => void;
    onMove?: (direction: 'up' | 'down') => void;
    onUseAsReference?: () => void;
    onResetPosition?: () => void;
    className?: string;
    isFirst?: boolean;
    isLast?: boolean;
}

const LayerMenu: React.FC<LayerMenuProps> = ({
    layer,
    onUpdate,
    onDelete,
    onMove,
    onUseAsReference,
    onResetPosition,
    className = '',
    isFirst = false,
    isLast = false
}) => {
    const [decorLabel, setDecorLabel] = useState(layer.decorData?.label || '');

    const handleDownload = (e: React.MouseEvent) => {
        e.stopPropagation();
        const link = document.createElement('a');
        link.href = layer.src || '';
        link.download = `${layer.name.replace(/\s+/g, '_')}.${layer.type === 'video' ? 'mp4' : 'png'}`;
        link.click();
    };

    const handleDecorLabelChange = (newLabel: string) => {
        setDecorLabel(newLabel);
        if (!layer.decorData) return;
        const updates = rerenderDecorLayer(layer.decorData, { label: newLabel });
        if (updates) onUpdate(updates);
    };

    const handleDecorFontSizeChange = (newSize: number) => {
        if (!layer.decorData) return;
        const updates = rerenderDecorLayer(layer.decorData, { fontSize: newSize });
        if (updates) onUpdate(updates);
    };

    return (
        <div className={`bg-[#18181b] border border-white/10 rounded-lg p-3 shadow-xl w-64 ${className}`} onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
            {/* Quick Actions */}
            <div className="flex items-center justify-between mb-3 bg-[#121215] p-2 rounded-md border border-white/5">
                <div className="flex gap-0.5">
                    <button
                        onClick={(e) => { e.stopPropagation(); onUpdate({ visible: !layer.visible }); }}
                        className={`p-1.5 rounded hover:bg-white/10 transition-colors ${layer.visible ? 'text-gray-300' : 'text-gray-600'}`}
                        title={layer.visible ? "Ocultar" : "Mostrar"}
                    >
                        {layer.visible ? <Eye size={18} /> : <EyeOff size={18} />}
                    </button>

                    {/* Use as Reference Button */}
                    {onUseAsReference && layer.type !== 'video' && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onUseAsReference(); }}
                            className="p-1.5 rounded hover:bg-white/10 transition-colors text-gray-300 hover:text-green-400"
                            title="Usar como Referência"
                        >
                            <ImagePlus size={18} />
                        </button>
                    )}

                    {/* Reset Position Button */}
                    {onResetPosition && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onResetPosition(); }}
                            className="p-1.5 rounded hover:bg-white/10 transition-colors text-gray-300 hover:text-yellow-400"
                            title="Resetar Posição Original"
                        >
                            <RotateCcw size={18} />
                        </button>
                    )}

                    {/* Video Controls */}
                    {layer.type === 'video' && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onUpdate({ isPlaying: !layer.isPlaying }); }}
                            className={`p-1.5 rounded hover:bg-white/10 transition-colors ${layer.isPlaying ? 'text-green-400' : 'text-gray-400'}`}
                            title={layer.isPlaying ? "Pausar Vídeo" : "Reproduzir Vídeo"}
                        >
                            {layer.isPlaying ? <Pause size={18} /> : <Play size={18} />}
                        </button>
                    )}
                </div>

                <div className="flex items-center">
                    {/* Reorder Buttons */}
                    {onMove && (
                        <div className="flex gap-0.5 border-l border-white/5 pl-1 mx-1">
                            <button
                                onClick={(e) => { e.stopPropagation(); onMove('up'); }}
                                disabled={isFirst}
                                className={`p-1.5 rounded hover:bg-white/10 transition-colors ${isFirst ? 'text-gray-700 cursor-not-allowed' : 'text-gray-300 hover:text-purple-400'}`}
                                title="Trazer para Frente"
                            >
                                <ArrowUp size={18} />
                            </button>
                            <button
                                onClick={(e) => { e.stopPropagation(); onMove('down'); }}
                                disabled={isLast}
                                className={`p-1.5 rounded hover:bg-white/10 transition-colors ${isLast ? 'text-gray-700 cursor-not-allowed' : 'text-gray-300 hover:text-purple-400'}`}
                                title="Enviar para Trás"
                            >
                                <ArrowDown size={18} />
                            </button>
                        </div>
                    )}

                    {/* Download Button */}
                    <button
                        onClick={handleDownload}
                        className="p-1.5 rounded hover:bg-white/10 text-gray-400 hover:text-blue-400 transition-colors border-l border-white/5 pl-1 ml-0.5"
                        title="Baixar Camada"
                    >
                        <Download size={18} />
                    </button>

                    {/* Delete Button */}
                    <button
                        onClick={(e) => { e.stopPropagation(); onDelete(); }}
                        className="p-1.5 rounded hover:bg-red-500/10 text-gray-400 hover:text-red-400 transition-colors border-l border-white/5 pl-1 ml-0.5"
                        title="Excluir Camada"
                    >
                        <Trash2 size={18} />
                    </button>
                </div>
            </div>

            {/* Decor Editing Controls */}
            {layer.decorData && (
                <div className="space-y-3 px-1 mb-3">
                    {/* Label edit */}
                    <div>
                        <div className="flex justify-between text-xs text-gray-400 mb-2 font-medium">
                            <span className="flex items-center gap-1"><Type size={12} /> Nome</span>
                        </div>
                        <textarea
                            rows={Math.min(4, Math.max(1, decorLabel.split('\n').length))}
                            value={decorLabel}
                            onChange={(e) => handleDecorLabelChange(e.target.value)}
                            className="w-full bg-[#121215] border border-emerald-500/30 rounded-md px-3 py-1.5 text-sm text-white focus:border-emerald-500 focus:outline-none transition-all placeholder:text-gray-600 resize-none"
                            placeholder="Ex: Sofá, Mesa..."
                            onClick={(e) => e.stopPropagation()}
                            onMouseDown={(e) => e.stopPropagation()}
                            onKeyDown={(e) => e.stopPropagation()}
                        />
                    </div>
                    {/* Font size */}
                    <div>
                        <div className="flex justify-between text-xs text-gray-400 mb-2 font-medium">
                            <span>Tamanho da Letra</span>
                            <span className="text-emerald-400">{layer.decorData.fontSize}px</span>
                        </div>
                        <input
                            type="range"
                            min="10"
                            max="80"
                            step="1"
                            value={layer.decorData.fontSize}
                            onChange={(e) => handleDecorFontSizeChange(parseInt(e.target.value))}
                            className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-emerald-500 hover:accent-emerald-400"
                            onClick={(e) => e.stopPropagation()}
                            onMouseDown={(e) => e.stopPropagation()}
                        />
                    </div>
                </div>
            )}

            {/* Sliders */}
            <div className="space-y-3 px-1">
                <div>
                    <div className="flex justify-between text-xs text-gray-400 mb-2 font-medium">
                        <span>Suavização (Bordas)</span>
                        <span className="text-purple-400">{layer.feather || 0}px</span>
                    </div>
                    <input
                        type="range"
                        min="0"
                        max="100"
                        step="1"
                        value={layer.feather || 0}
                        onChange={(e) => onUpdate({ feather: parseInt(e.target.value) })}
                        className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500 hover:accent-purple-400"
                        onClick={(e) => e.stopPropagation()}
                        onMouseDown={(e) => e.stopPropagation()}
                    />
                </div>
            </div>
        </div>
    );
};

export default LayerMenu;
