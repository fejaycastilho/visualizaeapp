
import React, { useState } from 'react';
import { ModelType, Layer } from '../../types';
import { generateImageContent } from '../../services/geminiService';
import { compositeLayers } from './studioUtils';
import { Upload, Wand2, ImagePlus, X, Check, Layers, Merge, Loader2 } from 'lucide-react';

interface FrameSlotProps {
    label: string;
    image: string | null;
    setImage: (img: string | null) => void;
    orientation: 'auto' | 'horizontal' | 'vertical';
    canvasLayers: Layer[];
}

const FrameSlot: React.FC<FrameSlotProps> = ({ label, image, setImage, orientation, canvasLayers }) => {
    const [mode, setMode] = useState<'initial' | 'generate' | 'select_layer'>('initial');
    const [prompt, setPrompt] = useState('');
    const [refImage, setRefImage] = useState<string | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [selectedLayerIds, setSelectedLayerIds] = useState<string[]>([]);

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, isRef: boolean = false) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            const result = ev.target?.result as string;
            if (isRef) setRefImage(result);
            else {
                setImage(result);
                setMode('initial');
            }
        };
        reader.readAsDataURL(file);
        e.target.value = '';
    };

    const handleGenerate = async () => {
        if (!prompt.trim()) return;
        setIsGenerating(true);
        try {
            let detectedAspect = '16:9';
            if (refImage) {
                try {
                    const img = new Image();
                    await new Promise<void>((resolve, reject) => {
                        img.onload = () => resolve();
                        img.onerror = () => reject();
                        img.src = refImage;
                    });
                    detectedAspect = img.naturalHeight > img.naturalWidth ? '9:16' : '16:9';
                    console.log(`FrameSlot auto-detected aspect: ${detectedAspect} (${img.naturalWidth}x${img.naturalHeight})`);
                } catch { /* fallback to 16:9 */ }
            }
            const refs = refImage ? [refImage] : [];
            const generated = await generateImageContent(
                ModelType.NANO_BANANA_2,
                prompt,
                detectedAspect,
                '2K',
                refs,
                !!refImage
            );
            if (generated) {
                setImage(generated);
                setMode('initial');
                setPrompt('');
                setRefImage(null);
            }
        } catch (error: any) {
            console.error(error);
            const msg = error?.message || '';
            if (msg.toLowerCase().includes('créditos insuficientes') || msg.toLowerCase().includes('insufficient') || error?.code === 'functions/resource-exhausted') {
                alert("⚡ Créditos insuficientes!\n\nVocê não possui créditos suficientes para renderizar.\nAdquira mais créditos para continuar gerando imagens e vídeos.");
            } else {
                alert("Erro ao gerar frame.");
            }
        } finally {
            setIsGenerating(false);
        }
    };

    const handleConfirmLayers = async () => {
        if (selectedLayerIds.length === 0) return;
        const selectedLayers = canvasLayers.filter(l => selectedLayerIds.includes(l.id));
        const composite = await compositeLayers(selectedLayers);
        if (composite) {
            setImage(composite);
            setMode('initial');
            setSelectedLayerIds([]);
        } else {
            alert("Erro ao compor camadas.");
        }
    };

    const toggleLayerSelection = (id: string) => {
        setSelectedLayerIds(prev =>
            prev.includes(id) ? prev.filter(lid => lid !== id) : [...prev, id]
        );
    };

    const handleClear = () => {
        setImage(null);
        setMode('initial');
        setPrompt('');
        setRefImage(null);
        setSelectedLayerIds([]);
    };

    const containerClass = 'w-64 h-48';

    return (
        <div className={`relative ${containerClass}`}>

            {/* 1. View Mode (Image Exists) */}
            {image && mode === 'initial' && (
                <div className="relative group w-full h-full">
                    <div className="border-2 border-white/10 rounded-xl flex items-center justify-center bg-[#121215] overflow-hidden shadow-lg w-full h-full">
                        <img src={image} alt={label} className="w-full h-full object-cover" />
                    </div>
                    <div className="absolute top-2 left-2 bg-black/60 px-2 py-1 rounded text-[9px] text-white font-medium uppercase tracking-wider backdrop-blur-sm pointer-events-none">
                        {label}
                    </div>
                    <button
                        onClick={handleClear}
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1.5 shadow-lg hover:bg-red-400 opacity-0 group-hover:opacity-100 transition-opacity transform hover:scale-110 z-10"
                        title="Remover Frame"
                    >
                        <X size={12} strokeWidth={3} />
                    </button>
                </div>
            )}

            {/* 2. Initial Mode (Empty) */}
            {!image && mode === 'initial' && (
                <div className="w-full h-full border-2 border-dashed border-white/10 rounded-xl flex flex-col items-center justify-center bg-[#121215] gap-2 transition-all hover:border-white/20">
                    <span className="text-[9px] text-gray-600 font-bold uppercase tracking-widest">{label}</span>

                    <div className="flex gap-1.5">
                        <label className="flex items-center justify-center w-8 h-8 bg-[#1f1f23] rounded border border-white/5 cursor-pointer hover:bg-white/5 hover:border-purple-500/50 transition-all text-gray-500 hover:text-purple-400" title="Upload PC">
                            <Upload size={14} />
                            <input type="file" className="hidden" onChange={(e) => handleFileUpload(e)} accept="image/*" />
                        </label>

                        <button
                            onClick={() => setMode('generate')}
                            className="flex items-center justify-center w-8 h-8 bg-[#1f1f23] rounded border border-white/5 hover:bg-white/5 hover:border-purple-500/50 transition-all text-gray-500 hover:text-purple-400"
                            title="Gerar (Nano)"
                        >
                            <Wand2 size={14} />
                        </button>

                        <button
                            onClick={() => setMode('select_layer')}
                            className="flex items-center justify-center w-8 h-8 bg-[#1f1f23] rounded border border-white/5 hover:bg-white/5 hover:border-blue-500/50 transition-all text-gray-500 hover:text-blue-400"
                            title="Usar Camadas"
                        >
                            <Layers size={14} />
                        </button>
                    </div>
                </div>
            )}

            {/* 3. Select Layer Mode (Expanded Popover) */}
            {mode === 'select_layer' && (
                <div className="absolute top-0 left-0 z-50 w-80 bg-[#1f1f23] border-2 border-blue-500/30 rounded-xl shadow-2xl p-3 flex flex-col gap-2 max-h-96">
                    <div className="flex justify-between items-center pb-2 border-b border-white/10 shrink-0">
                        <span className="text-xs uppercase font-bold text-blue-400 flex items-center gap-2">
                            <Layers size={14} /> Selecionar Camadas
                        </span>
                        <button onClick={() => setMode('initial')} className="text-gray-500 hover:text-gray-300 bg-white/5 p-1 rounded-full">
                            <X size={14} />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar min-h-[150px]">
                        {canvasLayers.filter(l => l.type !== 'video').length === 0 ? (
                            <div className="text-xs text-gray-500 text-center mt-10">
                                Nenhuma imagem disponível no Canvas.
                            </div>
                        ) : (
                            canvasLayers.filter(l => l.type !== 'video').map(layer => {
                                const isSelected = selectedLayerIds.includes(layer.id);
                                return (
                                    <div
                                        key={layer.id}
                                        onClick={() => toggleLayerSelection(layer.id)}
                                        className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer border transition-all ${isSelected ? 'bg-blue-500/20 border-blue-500/50' : 'bg-[#18181b] hover:bg-white/5 border-white/5'}`}
                                    >
                                        <div className="w-10 h-10 rounded overflow-hidden bg-black shrink-0 border border-white/10">
                                            <img src={layer.src} className="w-full h-full object-cover" alt="" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className={`text-xs truncate font-medium ${isSelected ? 'text-blue-200' : 'text-gray-300'}`}>{layer.name}</p>
                                            <p className="text-[10px] text-gray-600">Imagem</p>
                                        </div>
                                        {isSelected && <div className="bg-blue-500 rounded-full p-0.5"><Check size={10} className="text-white" /></div>}
                                    </div>
                                );
                            })
                        )}
                    </div>

                    <button
                        onClick={handleConfirmLayers}
                        disabled={selectedLayerIds.length === 0}
                        className={`w-full py-2 text-xs font-bold rounded-lg flex items-center justify-center gap-2 transition-colors ${selectedLayerIds.length > 0
                            ? 'bg-blue-600 text-white hover:bg-blue-500 shadow-lg'
                            : 'bg-gray-800 text-gray-600 cursor-not-allowed'
                            }`}
                    >
                        <Merge size={14} />
                        {selectedLayerIds.length > 0 ? `Compor ${selectedLayerIds.length} Camadas` : 'Selecione...'}
                    </button>
                </div>
            )}

            {/* 4. Generate Mode Form (Expanded Popover) */}
            {mode === 'generate' && (
                <div className="absolute top-0 left-0 z-50 w-72 bg-[#1f1f23] border-2 border-purple-500/30 rounded-xl shadow-2xl p-3 flex flex-col gap-3">
                    <div className="flex justify-between items-center pb-1">
                        <span className="text-xs uppercase font-bold text-purple-400 flex items-center gap-2">
                            <Wand2 size={14} /> Gerar Frame
                        </span>
                        <button onClick={() => setMode('initial')} className="text-gray-500 hover:text-gray-300 bg-white/5 p-1 rounded-full">
                            <X size={14} />
                        </button>
                    </div>

                    <textarea
                        className="w-full bg-[#121215] text-xs text-white p-3 rounded-lg border border-white/10 focus:border-purple-500 outline-none resize-none h-24 placeholder:text-gray-600"
                        placeholder={`Descreva o frame...`}
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                    />

                    <div className="flex gap-2">
                        <label className={`flex-1 flex items-center justify-center gap-2 bg-[#121215] border border-white/10 rounded-lg p-2 cursor-pointer hover:bg-white/5 transition-colors text-xs font-medium ${refImage ? 'border-green-500/50 text-green-400' : 'text-gray-400'}`} title="Referência">
                            {refImage ? <Check size={14} /> : <ImagePlus size={14} />}
                            {refImage ? 'Ref Anexada' : 'Anexar Ref'}
                            <input type="file" className="hidden" onChange={(e) => handleFileUpload(e, true)} accept="image/*" />
                        </label>
                    </div>

                    <button
                        onClick={handleGenerate}
                        disabled={isGenerating || !prompt}
                        className={`w-full py-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-colors ${isGenerating || !prompt ? 'bg-gray-800 text-gray-500' : 'bg-purple-600 text-white hover:bg-purple-500 shadow-lg'}`}
                    >
                        {isGenerating ? <Loader2 size={14} className="animate-spin" /> : 'Gerar com Nano Banana'}
                    </button>
                </div>
            )}
        </div>
    );
};

export default FrameSlot;
