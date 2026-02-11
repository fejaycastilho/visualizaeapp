
import React from 'react';
import { ToolType } from '../types';
import { MousePointer2, Eraser, Hand, ImagePlus, Scan, Download, Move, Sofa } from 'lucide-react';

interface ToolbarProps {
  selectedTool: ToolType;
  onSelectTool: (tool: ToolType) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onUploadImage: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onFitScreen: () => void;
  onDownload: () => void;
}

const Toolbar: React.FC<ToolbarProps> = ({
  selectedTool,
  onSelectTool,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onUploadImage,
  onFitScreen,
  onDownload
}) => {
  const tools = [
    { id: 'select', icon: MousePointer2, label: 'Seleção' },
    { id: 'move', icon: Move, label: 'Mover' },
    { id: 'eraser', icon: Eraser, label: 'Borracha' },
    { id: 'hand', icon: Hand, label: 'Pan' },
    { id: 'decor', icon: Sofa, label: 'Decorar Ambiente' },
  ];

  return (
    <div
      className="absolute z-30 flex gap-1 md:gap-2 bottom-20 left-1/2 flex-row items-center justify-center w-full px-2 pointer-events-none"
      style={{ transform: 'translateX(-50%) translateZ(0)' }}
    >

      <div className="bg-[#1f1f23] rounded-lg border border-white/5 p-1 md:p-2 shadow-xl flex flex-row gap-1 md:gap-2 pointer-events-auto shrink-0 max-w-full flex-wrap justify-center">
        {tools.map((tool) => (
          <button
            key={tool.id}
            onClick={() => onSelectTool(tool.id as ToolType)}
            className={`p-2 md:p-3 rounded-md transition-all ${selectedTool === tool.id
              ? tool.id === 'decor' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/20' : 'bg-purple-600 text-white shadow-lg shadow-purple-900/20'
              : 'text-gray-400 hover:bg-white/5 hover:text-gray-100'
              } ${tool.id === 'hand' ? 'hidden md:block' : ''}`}
            title={tool.label}
          >
            <tool.icon size={18} className="md:w-5 md:h-5" />
          </button>
        ))}

        <div className="w-px h-6 bg-white/10 my-auto mx-0.5 md:mx-1"></div>

        <label className="p-2 md:p-3 rounded-md text-gray-400 hover:bg-white/5 hover:text-gray-100 cursor-pointer transition-colors" title="Adicionar Imagem">
          <ImagePlus size={18} className="md:w-5 md:h-5" />
          <input
            type="file"
            className="hidden"
            accept="image/png, image/jpeg, image/webp"
            onChange={onUploadImage}
          />
        </label>

        <button
          onClick={onFitScreen}
          className="p-2 md:p-3 rounded-md text-gray-400 hover:bg-white/5 hover:text-gray-100 transition-colors"
          title="Ajustar à Tela (Centralizar)"
        >
          <Scan size={18} className="md:w-5 md:h-5" />
        </button>

        <button
          onClick={onDownload}
          className="p-2 md:p-3 rounded-md text-gray-400 hover:bg-white/5 hover:text-gray-100 transition-colors"
          title="Baixar Composição"
        >
          <Download size={18} className="md:w-5 md:h-5" />
        </button>

        <div className="w-px h-6 bg-white/10 my-auto mx-0.5 md:mx-1"></div>

        <button
          onClick={onUndo}
          disabled={!canUndo}
          className={`p-2 md:p-3 rounded-md transition-all ${!canUndo ? 'text-gray-600 cursor-not-allowed' : 'text-gray-400 hover:bg-white/5 hover:text-gray-100'}`}
          title="Desfazer"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-undo-2 md:w-5 md:h-5"><path d="M9 14 4 9l5-5" /><path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5v0a5.5 5.5 0 0 1-5.5 5.5H11" /></svg>
        </button>
        <button
          onClick={onRedo}
          disabled={!canRedo}
          className={`p-2 md:p-3 rounded-md transition-all ${!canRedo ? 'text-gray-600 cursor-not-allowed' : 'text-gray-400 hover:bg-white/5 hover:text-gray-100'}`}
          title="Refazer"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-redo-2 md:w-5 md:h-5"><path d="m15 14 5-5-5-5" /><path d="M20 9H9.5A5.5 5.5 0 0 0 4 14.5v0A5.5 5.5 0 0 0 9.5 20H13" /></svg>
        </button>
      </div>
    </div>
  );
};

export default Toolbar;
