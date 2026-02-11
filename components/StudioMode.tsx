
import React, { useState } from 'react';
import { ModelType, Layer, Scene } from '../types';
import SceneRow from './studio/SceneRow';
import { useStudioExport } from './studio/useStudioExport';
import { Loader2, Film, Clapperboard, Plus } from 'lucide-react';

// --- Main Studio Mode ---

interface StudioModeProps {
    canvasLayers: Layer[];
    scenes: Scene[];
    setScenes: React.Dispatch<React.SetStateAction<Scene[]>>;
    orientation: 'auto' | 'horizontal' | 'vertical';
    setOrientation: React.Dispatch<React.SetStateAction<'auto' | 'horizontal' | 'vertical'>>;
}

const StudioMode: React.FC<StudioModeProps> = ({ canvasLayers, scenes, setScenes, orientation, setOrientation }) => {
    const [activeModel, setActiveModel] = useState<ModelType>(ModelType.KLING_PRO);
    const [generateAudio, setGenerateAudio] = useState(true);

    const { isExporting, exportStatus, handleExportFullMovie } = useStudioExport({ scenes });

    const handleAddScene = () => {
        const lastScene = scenes[scenes.length - 1];
        const newStartFrame = lastScene ? (lastScene.endFrame || lastScene.startFrame) : null;

        const newScene: Scene = {
            id: Date.now().toString(),
            startFrame: newStartFrame,
            endFrame: null,
            shots: [{ prompt: '', duration: '5' }],
            videos: [],
            selectedVideoIndex: -1,
            isGenerating: false,
            variationCount: 1
        };
        setScenes(prev => [...prev, newScene]);
    };

    const handleUpdateScene = (id: string, updates: Partial<Scene>) => {
        setScenes(prev => prev.map(s => {
            if (s.id === id) {
                return { ...s, ...updates };
            }
            return s;
        }));
    };

    const handleDeleteScene = (id: string) => {
        if (scenes.length <= 1) return;
        setScenes(prev => prev.filter(s => s.id !== id));
    };

    return (
        <div className="flex flex-col h-full bg-[#18181b] p-4 overflow-y-auto custom-scrollbar">

            {/* Header / Config */}
            <div className="flex items-center justify-between mb-6 bg-[#1f1f23] px-5 py-3 rounded-xl border border-white/5 shadow-lg max-w-6xl mx-auto w-full sticky top-0 z-50">
                <h2 className="text-white font-bold text-lg flex items-center gap-2 tracking-tight">
                    <Clapperboard className="text-blue-500" size={22} /> KLING STORYBOARD
                </h2>

                <div className="flex items-center gap-3">
                    <div className="flex items-center bg-[#121215] rounded-lg border border-white/5 overflow-hidden">
                        {[
                            { value: 'auto' as const, label: 'AUTO DETECT ORIENTAÇÃO' },
                            { value: 'horizontal' as const, label: '16:9' },
                            { value: 'vertical' as const, label: '9:16' },
                        ].map(opt => (
                            <button
                                key={opt.value}
                                onClick={() => setOrientation(opt.value)}
                                className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-all ${orientation === opt.value
                                    ? 'bg-indigo-600/30 text-indigo-300 border-indigo-500/30'
                                    : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
                                    }`}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>
                    <div className="bg-[#121215] px-3 py-1.5 rounded-lg border border-white/5">
                        <span className="text-[10px] font-bold text-indigo-400">KLING 3.0 PRO</span>
                    </div>
                </div>
            </div>

            {/* Kling Controls */}
            <div className="flex items-center justify-center gap-4 mb-6 max-w-6xl mx-auto w-full">
                <button
                    onClick={() => setGenerateAudio(!generateAudio)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all text-xs font-bold ${generateAudio
                        ? 'bg-emerald-600/20 border-emerald-500/30 text-emerald-400'
                        : 'bg-[#1f1f23] border-white/5 text-gray-500'
                        }`}
                >
                    {generateAudio ? '🔊 Áudio ON' : '🔇 Áudio OFF'}
                </button>
            </div>

            {/* Scenes List */}
            <div className="max-w-6xl mx-auto w-full space-y-8 pb-32">
                {scenes.map((scene, index) => (
                    <div key={scene.id} className="relative">
                        {index > 0 && (
                            <div className="absolute -top-6 left-1/2 -translate-x-1/2 h-8 w-px bg-gradient-to-b from-transparent via-blue-500/50 to-transparent z-0"></div>
                        )}
                        <SceneRow
                            scene={scene}
                            index={index}
                            orientation={orientation}
                            canvasLayers={canvasLayers}
                            onUpdate={handleUpdateScene}
                            onDelete={handleDeleteScene}
                            generateAudio={generateAudio}
                            onChainNextScene={(lastFrameDataUrl) => {
                                const nextSceneIndex = index + 1;
                                if (nextSceneIndex < scenes.length) {
                                    const nextScene = scenes[nextSceneIndex];
                                    handleUpdateScene(nextScene.id, { startFrame: lastFrameDataUrl });
                                    console.log(`🔗 Chained last frame → Scene ${nextSceneIndex + 1}`);
                                } else {
                                    const newScene: Scene = {
                                        id: Date.now().toString(),
                                        startFrame: lastFrameDataUrl,
                                        endFrame: null,
                                        shots: [{ prompt: '', duration: '5' }],
                                        videos: [],
                                        selectedVideoIndex: -1,
                                        isGenerating: false,
                                        variationCount: 1
                                    };
                                    setScenes(prev => [...prev, newScene]);
                                    console.log(`🔗 Auto-created Scene ${nextSceneIndex + 1} with last frame`);
                                }
                            }}
                        />
                    </div>
                ))}

                {/* Add Scene Button */}
                <button
                    onClick={handleAddScene}
                    className="w-full py-4 border-2 border-dashed border-white/10 rounded-2xl flex flex-col items-center justify-center text-gray-500 hover:text-white hover:border-purple-500/50 hover:bg-white/5 transition-all group"
                >
                    <Plus size={32} className="mb-2 group-hover:scale-110 transition-transform" />
                    <span className="text-sm font-bold uppercase tracking-widest">Adicionar Nova Cena</span>
                </button>
            </div>

            {/* Footer Actions (Export) */}
            <div className="fixed bottom-0 left-0 w-full bg-[#18181b]/90 backdrop-blur border-t border-white/10 p-4 z-[60]">
                <div className="max-w-6xl mx-auto flex items-center justify-between">
                    <div className="text-xs text-gray-500 font-mono">
                        CENAS: <span className="text-white">{scenes.length}</span>
                        <span className="mx-2">•</span>
                        SHOTS: <span className="text-white">{scenes.reduce((s, sc) => s + sc.shots.length, 0)}</span>
                        {exportStatus && <span className="ml-4 text-blue-400 animate-pulse">{exportStatus}</span>}
                    </div>

                    <button
                        onClick={handleExportFullMovie}
                        disabled={isExporting || !scenes.some(s => s.videos.length > 0)}
                        className={`px-6 py-3 rounded-lg font-bold flex items-center gap-2 transition-all ${isExporting || !scenes.some(s => s.videos.length > 0)
                            ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                            : 'bg-green-600 hover:bg-green-500 text-white shadow-xl hover:shadow-green-500/20'
                            }`}
                    >
                        {isExporting ? <Loader2 className="animate-spin" /> : <Film />}
                        {isExporting ? 'Processando...' : '🎬 Exportar Filme'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default StudioMode;
