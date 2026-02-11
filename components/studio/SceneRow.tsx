
import React, { useRef } from 'react';
import { Layer, Scene } from '../../types';
import { generateVideo, generateVideoMultiShot } from '../../services/geminiService';
import { cropImageToRatio, extractLastFrame } from './studioUtils';
import FrameSlot from './FrameSlot';
import { ArrowRight, Loader2, Film, X, Merge, Plus, Trash2, RefreshCw, Download, Camera } from 'lucide-react';

interface SceneRowProps {
    scene: Scene;
    index: number;
    orientation: 'auto' | 'horizontal' | 'vertical';
    canvasLayers: Layer[];
    onUpdate: (id: string, updates: Partial<Scene>) => void;
    onDelete: (id: string) => void;
    generateAudio: boolean;
    onChainNextScene: (lastFrameDataUrl: string) => void;
}

const SceneRow: React.FC<SceneRowProps> = ({ scene, index, orientation, canvasLayers, onUpdate, onDelete, generateAudio, onChainNextScene }) => {

    const handleGenerate = async () => {
        if (!scene.startFrame) {
            alert("Frame inicial obrigatório.");
            return;
        }

        const validShots = scene.shots.filter(s => s.prompt.trim().length > 0);
        if (validShots.length === 0) {
            alert("Escreva pelo menos um prompt.");
            return;
        }

        if (validShots.length >= 2) {
            if (validShots.length > 6) {
                alert("Multi-shot suporta no máximo 6 shots.");
                return;
            }
            const totalDuration = validShots.reduce((sum, s) => sum + parseInt(s.duration || '5'), 0);
            if (totalDuration > 15) {
                alert(`Duração total ${totalDuration}s excede o máximo de 15s para multi-shot.\nReduca a duração de alguns shots.`);
                return;
            }
        }

        onUpdate(scene.id, { isGenerating: true });

        try {
            let finalOrientation: 'horizontal' | 'vertical' = 'horizontal';

            if (orientation === 'auto') {
                const img = new Image();
                img.src = scene.startFrame;
                await new Promise<void>((resolve) => {
                    if (img.complete && img.naturalWidth > 0) {
                        resolve();
                    } else {
                        img.onload = () => resolve();
                        img.onerror = () => resolve();
                    }
                });
                try { await img.decode(); } catch { /* ok */ }

                const w = img.naturalWidth;
                const h = img.naturalHeight;
                if (w > 0 && h > 0) {
                    finalOrientation = h > w ? 'vertical' : 'horizontal';
                }
                console.log(`🎯 Auto-detected: ${finalOrientation} (${w}x${h})`);
            } else {
                finalOrientation = orientation;
                console.log(`🎯 Manual orientation: ${finalOrientation}`);
            }

            const aspectRatio = finalOrientation === 'horizontal' ? '16:9' : '9:16';
            console.log(`📐 Final aspect ratio: ${aspectRatio}`);

            const targetW = finalOrientation === 'horizontal' ? 1920 : 1080;
            const targetH = finalOrientation === 'horizontal' ? 1080 : 1920;

            const cleanStart = await cropImageToRatio(scene.startFrame, targetW, targetH);
            const cleanEnd = scene.endFrame ? await cropImageToRatio(scene.endFrame, targetW, targetH) : undefined;

            for (let i = 0; i < scene.variationCount; i++) {
                let videoUrl: string | null = null;

                if (validShots.length === 1) {
                    videoUrl = await generateVideo(
                        validShots[0].prompt || "Smooth cinematic camera movement",
                        cleanStart,
                        cleanEnd,
                        aspectRatio,
                        validShots[0].duration || '5',
                        generateAudio
                    );
                } else {
                    const multiShotScenes = validShots.map(s => ({
                        prompt: s.prompt || "Smooth cinematic camera movement",
                        duration: s.duration || '5',
                    }));

                    videoUrl = await generateVideoMultiShot(
                        multiShotScenes,
                        cleanStart,
                        aspectRatio,
                        generateAudio
                    );
                }

                if (videoUrl) {
                    onUpdate(scene.id, {
                        videos: [...(scene.videos || []), videoUrl],
                        selectedVideoIndex: scene.selectedVideoIndex === -1 ? 0 : scene.selectedVideoIndex
                    });

                    const lastFrame = await extractLastFrame(videoUrl);
                    if (lastFrame) {
                        onChainNextScene(lastFrame);
                    }

                    await new Promise(r => setTimeout(r, 1000));
                }
            }
        } catch (error: any) {
            console.error("StudioMode generation error:", error);
            const msg = error?.message || '';
            if (msg.toLowerCase().includes('créditos insuficientes') || msg.toLowerCase().includes('insufficient') || error?.code === 'functions/resource-exhausted') {
                alert("⚡ Créditos insuficientes!\n\nVocê não possui créditos suficientes para renderizar.\nAdquira mais créditos para continuar gerando imagens e vídeos.");
            } else if (msg.startsWith('SAFETY_FILTER:')) {
                alert("⚠️ O vídeo foi bloqueado pelo filtro de segurança do Google.\n\nTente modificar o prompt ou a imagem e gerar novamente.");
            } else {
                alert(`Erro ao gerar cena: ${msg}`);
            }
        } finally {
            onUpdate(scene.id, { isGenerating: false });
        }
    };

    const handleSelectVariation = (idx: number) => {
        onUpdate(scene.id, { selectedVideoIndex: idx });
    };

    const videoRef = useRef<HTMLVideoElement>(null);

    const handleCaptureFrame = () => {
        const video = videoRef.current;
        if (!video) return;

        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.drawImage(video, 0, 0);
        const dataUrl = canvas.toDataURL('image/png');

        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = `cena_${index + 1}_frame_${Math.round(video.currentTime * 100) / 100}s.png`;
        link.click();
    };

    return (
        <div className="bg-[#1f1f23] rounded-2xl border border-white/5 p-5 relative group">
            {/* Header: Scene number + delete */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center">
                        <span className="text-[11px] font-bold text-blue-400">{index + 1}</span>
                    </div>
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Cena {index + 1}</span>
                </div>
                <button
                    onClick={() => onDelete(scene.id)}
                    className="text-gray-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-red-500/10"
                >
                    <Trash2 size={16} />
                </button>
            </div>

            {/* 1. Shots Area (multi-prompt) */}
            <div className="mb-5 space-y-2">
                {scene.shots.map((shot, shotIdx) => (
                    <div key={shotIdx} className="flex gap-2 items-start">
                        <div className="flex items-center bg-purple-600/20 border border-purple-500/30 rounded-lg px-2 py-2 shrink-0">
                            <span className="text-[10px] font-bold text-purple-400">S{shotIdx + 1}</span>
                        </div>
                        <textarea
                            value={shot.prompt}
                            onChange={(e) => {
                                const newShots = [...scene.shots];
                                newShots[shotIdx] = { ...newShots[shotIdx], prompt: e.target.value };
                                onUpdate(scene.id, { shots: newShots });
                            }}
                            placeholder={`Shot ${shotIdx + 1}: descreva a ação...`}
                            className="flex-1 bg-[#121215] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:border-purple-500 outline-none resize-none h-12 placeholder:text-gray-600"
                        />
                        <select
                            value={shot.duration}
                            onChange={(e) => {
                                const newShots = [...scene.shots];
                                newShots[shotIdx] = { ...newShots[shotIdx], duration: e.target.value };
                                onUpdate(scene.id, { shots: newShots });
                            }}
                            className="bg-[#121215] border border-white/10 rounded-lg px-2 py-2.5 text-xs font-bold text-white outline-none cursor-pointer shrink-0"
                            disabled={scene.isGenerating}
                        >
                            {['3', '4', '5', '6', '7', '8', '9', '10'].map(n => (
                                <option key={n} value={n} className="bg-[#1f1f23] text-white">{n}s</option>
                            ))}
                        </select>
                        {scene.shots.length > 1 && (
                            <button
                                onClick={() => {
                                    const newShots = scene.shots.filter((_, i) => i !== shotIdx);
                                    onUpdate(scene.id, { shots: newShots });
                                }}
                                className="text-gray-600 hover:text-red-500 p-2 rounded hover:bg-red-500/10 transition-colors shrink-0"
                            >
                                <X size={14} />
                            </button>
                        )}
                    </div>
                ))}
                {scene.shots.length < 6 && (
                    <button
                        onClick={() => {
                            onUpdate(scene.id, { shots: [...scene.shots, { prompt: '', duration: '5' }] });
                        }}
                        className="w-full py-2 border border-dashed border-purple-500/30 rounded-lg text-xs font-bold text-purple-400 hover:bg-purple-500/10 hover:border-purple-500/50 transition-all flex items-center justify-center gap-1"
                    >
                        <Plus size={12} /> Adicionar Shot
                    </button>
                )}
                {scene.shots.length >= 2 && (
                    <div className="text-[10px] text-purple-400/60 text-center font-mono">
                        MULTI-SHOT • {scene.shots.length} shots • {scene.shots.reduce((s, sh) => s + parseInt(sh.duration || '5'), 0)}s total (máx 15s)
                    </div>
                )}
            </div>

            {/* 2. Frames: Start → End (centered, larger) */}
            <div className="flex items-center justify-center gap-4 mb-5">
                <FrameSlot
                    label="INÍCIO"
                    image={scene.startFrame}
                    setImage={(img) => onUpdate(scene.id, { startFrame: img })}
                    orientation={orientation}
                    canvasLayers={canvasLayers}
                />

                <div className="flex flex-col items-center gap-1 shrink-0">
                    <ArrowRight size={24} className="text-blue-500/50" />
                    <span className="text-[9px] text-gray-600 uppercase">fluxo</span>
                </div>

                <FrameSlot
                    label="FIM (Opcional)"
                    image={scene.endFrame}
                    setImage={(img) => onUpdate(scene.id, { endFrame: img })}
                    orientation={orientation}
                    canvasLayers={canvasLayers}
                />
            </div>

            {/* 3. Generate Controls (bottom) */}
            <div className="flex gap-2">
                <div className="flex items-center bg-[#121215] border border-white/10 rounded-lg px-3 py-2" title="Quantidade de Variações">
                    <span className="text-[10px] text-gray-500 font-bold mr-1.5">VARS</span>
                    <select
                        value={scene.variationCount}
                        onChange={(e) => onUpdate(scene.id, { variationCount: parseInt(e.target.value) })}
                        className="bg-transparent text-white text-xs font-bold outline-none cursor-pointer"
                        disabled={scene.isGenerating}
                    >
                        {[1, 2, 3, 4, 5].map(n => (
                            <option key={n} value={n} className="bg-[#1f1f23] text-white">{n}x</option>
                        ))}
                    </select>
                </div>

                <button
                    onClick={handleGenerate}
                    disabled={scene.isGenerating || !scene.startFrame}
                    className={`flex-1 py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${scene.isGenerating
                        ? 'bg-gray-800 text-gray-500'
                        : scene.shots.filter(s => s.prompt.trim()).length >= 2
                            ? 'bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-500/20'
                            : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg'
                        }`}
                >
                    {scene.isGenerating ? <Loader2 className="animate-spin" size={16} /> : scene.shots.filter(s => s.prompt.trim()).length >= 2 ? <Merge size={16} /> : <Film size={16} />}
                    {scene.isGenerating ? 'Gerando...' : scene.shots.filter(s => s.prompt.trim()).length >= 2 ? '🎬 Gerar Multi-shot' : '🎬 Gerar Clipe'}
                </button>
            </div>

            {/* 4. Result Videos (Gallery) */}
            {scene.videos && scene.videos.length > 0 && (
                <div className="mt-4 pt-4 border-t border-white/5 flex flex-col items-center">
                    {/* Main Player */}
                    <div className="relative rounded-lg overflow-hidden border border-white/10 shadow-xl bg-black max-w-md w-full mb-3">
                        <video
                            ref={videoRef}
                            key={scene.videos[scene.selectedVideoIndex]}
                            src={scene.videos[scene.selectedVideoIndex]}
                            controls
                            autoPlay
                            loop
                            className="w-full h-auto max-h-[300px]"
                        />
                        <div className="absolute top-2 right-2 flex gap-1.5">
                            <button
                                onClick={handleCaptureFrame}
                                className="bg-black/50 hover:bg-black/80 text-white p-1.5 rounded-full backdrop-blur transition-colors"
                                title="Baixar frame atual"
                            >
                                <Camera size={14} />
                            </button>
                            <a href={scene.videos[scene.selectedVideoIndex]} download={`scene_${index + 1}_v${scene.selectedVideoIndex + 1}.mp4`} className="bg-black/50 hover:bg-black/80 text-white p-1.5 rounded-full backdrop-blur transition-colors">
                                <Download size={14} />
                            </a>
                        </div>
                    </div>

                    {/* Variation Thumbnails */}
                    {scene.videos.length > 0 && (
                        <div className="flex gap-2 justify-center flex-wrap">
                            {scene.videos.map((vid, vidIdx) => (
                                <button
                                    key={vidIdx}
                                    onClick={() => handleSelectVariation(vidIdx)}
                                    className={`w-16 h-10 rounded-md border-2 overflow-hidden relative flex items-center justify-center transition-all ${scene.selectedVideoIndex === vidIdx ? 'border-blue-500 scale-105 shadow-lg' : 'border-white/10 opacity-60 hover:opacity-100'
                                        }`}
                                >
                                    <div className="bg-black/80 w-full h-full absolute inset-0"></div>
                                    <span className={`relative z-10 text-[10px] font-bold ${scene.selectedVideoIndex === vidIdx ? 'text-blue-400' : 'text-gray-400'}`}>
                                        V{vidIdx + 1}
                                    </span>
                                </button>
                            ))}
                            <button
                                onClick={handleGenerate}
                                disabled={scene.isGenerating || !scene.startFrame}
                                className="w-16 h-10 rounded-md border border-dashed border-white/20 flex items-center justify-center text-gray-500 hover:text-white hover:bg-white/5 transition-colors"
                                title="Regenerar Variação"
                            >
                                <RefreshCw size={14} />
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default SceneRow;
