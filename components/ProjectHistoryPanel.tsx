import React, { useState, useEffect } from 'react';
import { History, Trash2, FolderOpen, Pencil, Check, X, Clock, Layers as LayersIcon, Loader2, Plus } from 'lucide-react';
import { ProjectHistoryEntry, Scene } from '../types';
import { listProjects, deleteProject, renameProject, loadProject } from '../services/projectHistory';
import type { Layer } from '../types';

interface ProjectHistoryPanelProps {
    isOpen: boolean;
    onClose: () => void;
    userId: string;
    onLoadProject: (layers: Layer[], projectId: string, scenes?: Scene[], studioOrientation?: 'auto' | 'horizontal' | 'vertical') => void;
    onNewCanvas: () => void;
}

const ProjectHistoryPanel: React.FC<ProjectHistoryPanelProps> = ({
    isOpen,
    onClose,
    userId,
    onLoadProject,
    onNewCanvas,
}) => {
    const [projects, setProjects] = useState<ProjectHistoryEntry[]>([]);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');
    const [loadingId, setLoadingId] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            setProjects(listProjects());
        }
    }, [isOpen]);

    const handleOpen = async (project: ProjectHistoryEntry) => {
        setLoadingId(project.id);
        try {
            const result = await loadProject(project.id);
            onLoadProject(result.layers, project.id, result.scenes, result.studioOrientation);
            onClose();
        } catch (error) {
            console.error('Erro ao carregar projeto:', error);
            alert('Erro ao carregar projeto. Tente novamente.');
        } finally {
            setLoadingId(null);
        }
    };

    const handleDelete = async (project: ProjectHistoryEntry) => {
        if (!confirm(`Excluir "${project.name}"?`)) return;
        setDeletingId(project.id);
        try {
            await deleteProject(project.id, userId);
            setProjects(listProjects());
        } catch (error) {
            console.error('Erro ao excluir projeto:', error);
        } finally {
            setDeletingId(null);
        }
    };

    const handleStartRename = (project: ProjectHistoryEntry) => {
        setEditingId(project.id);
        setEditName(project.name);
    };

    const handleSaveRename = (projectId: string) => {
        if (editName.trim()) {
            renameProject(projectId, editName.trim());
            setProjects(listProjects());
        }
        setEditingId(null);
    };

    const handleCancelRename = () => {
        setEditingId(null);
        setEditName('');
    };

    const formatDate = (ts: number) => {
        const d = new Date(ts);
        return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    };

    const timeAgo = (ts: number) => {
        const diff = Date.now() - ts;
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return 'agora';
        if (mins < 60) return `${mins}min atrás`;
        const hours = Math.floor(mins / 60);
        if (hours < 24) return `${hours}h atrás`;
        const days = Math.floor(hours / 24);
        return `${days}d atrás`;
    };

    if (!isOpen) return null;

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9998]"
                onClick={onClose}
            />

            {/* Panel */}
            <div className="fixed right-0 top-0 h-full w-[420px] max-w-[90vw] bg-[#1a1a1f] border-l border-white/10 z-[9999] flex flex-col shadow-2xl animate-slide-in">

                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
                    <div className="flex items-center gap-2.5">
                        <History size={18} className="text-purple-400" />
                        <h2 className="text-base font-semibold text-white">Projetos Recentes</h2>
                        <span className="text-xs text-gray-500 bg-white/5 px-2 py-0.5 rounded-full">
                            {projects.length}/10
                        </span>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* New Canvas Button */}
                <div className="px-3 pt-3 pb-2">
                    <button
                        onClick={() => {
                            onNewCanvas();
                            onClose();
                        }}
                        className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-purple-600/20 to-indigo-600/20 hover:from-purple-600/30 hover:to-indigo-600/30 border border-purple-500/30 hover:border-purple-500/50 rounded-xl text-sm font-semibold text-purple-300 hover:text-purple-200 transition-all"
                    >
                        <Plus size={16} />
                        Novo Canvas em Branco
                    </button>
                </div>

                {/* Project List */}
                <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
                    {projects.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-gray-500 gap-3">
                            <History size={40} className="opacity-30" />
                            <p className="text-sm">Nenhum projeto salvo ainda</p>
                            <p className="text-xs text-gray-600 text-center px-8">
                                Seus projetos serão salvos automaticamente quando você gerar imagens ou clicar em salvar.
                            </p>
                        </div>
                    ) : (
                        projects.map(project => (
                            <div
                                key={project.id}
                                className="group bg-[#22222a] hover:bg-[#2a2a35] rounded-xl border border-white/5 hover:border-purple-500/30 transition-all overflow-hidden"
                            >
                                <div className="flex gap-3 p-3">
                                    {/* Thumbnail */}
                                    <div className="w-[72px] h-[72px] rounded-lg overflow-hidden bg-[#0f0f12] shrink-0 flex items-center justify-center">
                                        {project.thumbnail ? (
                                            <img
                                                src={project.thumbnail}
                                                alt={project.name}
                                                className="w-full h-full object-cover"
                                            />
                                        ) : (
                                            <LayersIcon size={24} className="text-gray-600" />
                                        )}
                                    </div>

                                    {/* Info */}
                                    <div className="flex-1 min-w-0 flex flex-col justify-between">
                                        {/* Name */}
                                        {editingId === project.id ? (
                                            <div className="flex items-center gap-1">
                                                <input
                                                    type="text"
                                                    value={editName}
                                                    onChange={(e) => setEditName(e.target.value)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') handleSaveRename(project.id);
                                                        if (e.key === 'Escape') handleCancelRename();
                                                    }}
                                                    className="flex-1 bg-black/30 border border-purple-500/50 rounded px-2 py-0.5 text-sm text-white outline-none"
                                                    autoFocus
                                                />
                                                <button
                                                    onClick={() => handleSaveRename(project.id)}
                                                    className="p-1 text-green-400 hover:text-green-300"
                                                >
                                                    <Check size={14} />
                                                </button>
                                                <button
                                                    onClick={handleCancelRename}
                                                    className="p-1 text-gray-400 hover:text-gray-300"
                                                >
                                                    <X size={14} />
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-sm font-medium text-white truncate">
                                                    {project.name}
                                                </span>
                                                <button
                                                    onClick={() => handleStartRename(project)}
                                                    className="p-0.5 text-gray-500 hover:text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity"
                                                >
                                                    <Pencil size={12} />
                                                </button>
                                            </div>
                                        )}

                                        {/* Meta info */}
                                        <div className="flex items-center gap-3 text-[11px] text-gray-500">
                                            <span className="flex items-center gap-1">
                                                <Clock size={10} />
                                                {timeAgo(project.updatedAt)}
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <LayersIcon size={10} />
                                                {project.layerCount} layer{project.layerCount !== 1 ? 's' : ''}
                                            </span>
                                        </div>

                                        {/* Actions */}
                                        <div className="flex items-center gap-1.5 mt-1">
                                            <button
                                                onClick={() => handleOpen(project)}
                                                disabled={loadingId === project.id}
                                                className="flex items-center gap-1.5 px-3 py-1 bg-purple-600/20 hover:bg-purple-600/40 text-purple-300 hover:text-purple-200 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                                            >
                                                {loadingId === project.id ? (
                                                    <Loader2 size={12} className="animate-spin" />
                                                ) : (
                                                    <FolderOpen size={12} />
                                                )}
                                                Abrir
                                            </button>
                                            <button
                                                onClick={() => handleDelete(project)}
                                                disabled={deletingId === project.id}
                                                className="flex items-center gap-1 px-2 py-1 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg text-xs transition-colors disabled:opacity-50"
                                            >
                                                {deletingId === project.id ? (
                                                    <Loader2 size={12} className="animate-spin" />
                                                ) : (
                                                    <Trash2 size={12} />
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* Date tooltip */}
                                <div className="px-3 pb-2 text-[10px] text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity">
                                    Criado: {formatDate(project.createdAt)} · Atualizado: {formatDate(project.updatedAt)}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Slide-in animation */}
            <style>{`
        @keyframes slideIn {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        .animate-slide-in {
          animation: slideIn 0.25s ease-out;
        }
      `}</style>
        </>
    );
};

export default ProjectHistoryPanel;
