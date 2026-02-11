import React, { useState } from 'react';
import { Layer } from '../types';
import { Image as ImageIcon, Wand2, GripVertical, Film } from 'lucide-react';
import LayerMenu from './LayerMenu';

interface LayerPanelProps {
  layers: Layer[];
  onToggleVisibility: (id: string) => void;
  onDelete: (id: string) => void;
  selectedLayerIds: string[];
  onSelect: (id: string, e: React.MouseEvent) => void;
  onUpdateLayer: (id: string, updates: Partial<Layer>) => void;
  isOpen: boolean;
  onClose: () => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
  onMoveLayer: (id: string, direction: 'up' | 'down') => void;
  onUseAsReference: (layer: Layer) => void;
}

const LayerPanel: React.FC<LayerPanelProps> = ({
  layers,
  onToggleVisibility,
  onDelete,
  selectedLayerIds,
  onSelect,
  onUpdateLayer,
  isOpen,
  onClose,
  onReorder,
  onMoveLayer,
  onUseAsReference
}) => {
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    e.dataTransfer.setData('text/plain', index.toString());
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    e.preventDefault(); // Necessary to allow dropping
    setDragOverIndex(index);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>, dropIndex: number) => {
    e.preventDefault();
    const dragIndexStr = e.dataTransfer.getData('text/plain');
    if (dragIndexStr !== '') {
      const dragIndex = parseInt(dragIndexStr, 10);
      if (dragIndex !== dropIndex) {
        onReorder(dragIndex, dropIndex);
      }
    }
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDragOverIndex(null);
  };

  return (
    <>
      <div
        className={`
                bg-[#1f1f23] border-l border-white/5 flex flex-col 
                fixed right-0 top-0 h-full z-50 pt-16
                transition-transform duration-300 ease-in-out
                w-full md:w-72
                ${isOpen ? 'translate-x-0' : 'translate-x-full'}
                md:translate-x-0 md:relative md:pt-0 md:h-full
            `}
        style={{ transform: isOpen ? 'translate3d(0,0,0)' : 'translate3d(100%,0,0)' }}
      >
        <div className="hidden md:flex px-4 py-3 border-b border-white/5 bg-[#18181b] justify-between items-center">
          <h3 className="text-sm font-semibold text-gray-200">Camadas</h3>
          <span className="text-[10px] text-gray-500">Arraste para mover</span>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-2">
          {layers.length === 0 && (
            <div className="text-center text-xs text-gray-500 mt-10">
              Sem camadas
            </div>
          )}

          {layers.map((layer, index) => {
            const isSelected = selectedLayerIds.includes(layer.id);
            const isDragOver = dragOverIndex === index;

            return (
              <div
                key={layer.id}
                className={`flex flex-col transition-all duration-200 ${isDragOver ? 'border-t-2 border-purple-500 mt-1' : ''}`}
                onDragOver={(e) => handleDragOver(e, index)}
                onDrop={(e) => handleDrop(e, index)}
                onDragEnd={handleDragEnd}
              >
                <div
                  onClick={(e) => onSelect(layer.id, e)}
                  className={`group flex items-center p-2 rounded-md cursor-pointer transition-colors border border-transparent select-none ${isSelected
                    ? 'bg-purple-500/10 border-purple-500/30'
                    : 'hover:bg-white/5'
                    }`}
                >
                  {/* Drag Handle */}
                  <div
                    className="mr-2 text-gray-600 cursor-grab active:cursor-grabbing hover:text-gray-400"
                    draggable
                    onDragStart={(e) => handleDragStart(e, index)}
                  >
                    <GripVertical size={14} />
                  </div>

                  {/* Thumbnail Placeholder */}
                  <div className="w-10 h-10 bg-gray-800 rounded flex items-center justify-center mr-3 overflow-hidden border border-white/5 flex-shrink-0 relative">
                    {layer.src && layer.type !== 'video' ? (
                      <img src={layer.src} className="w-full h-full object-cover pointer-events-none" alt="layer" />
                    ) : layer.type === 'video' ? (
                      <div className="w-full h-full flex items-center justify-center bg-black/50">
                        <Film size={16} className="text-teal-400" />
                      </div>
                    ) : (
                      layer.type === 'generation' ? <Wand2 size={16} className="text-purple-400" /> : <ImageIcon size={16} className="text-gray-400" />
                    )}
                    {!layer.visible && (
                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                        <div className="w-full h-px bg-white/50 -rotate-45"></div>
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className={`text-sm truncate ${isSelected ? 'text-purple-100 font-medium' : 'text-gray-300'}`}>
                      {layer.name}
                    </p>
                    <div className="flex items-center gap-2">
                      <p className="text-[10px] text-gray-500 uppercase">{layer.type}</p>
                      {layer.feather && layer.feather > 0 ? (
                        <span className="text-[9px] px-1 rounded bg-purple-500/20 text-purple-300">
                          Soft {layer.feather}px
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>

                {/* Desktop Inline Menu for Selected Layer */}
                {isSelected && selectedLayerIds.length === 1 && (
                  <div className="mt-1 ml-2 mr-2 mb-2">
                    <LayerMenu
                      layer={layer}
                      onUpdate={(updates) => onUpdateLayer(layer.id, updates)}
                      onDelete={() => onDelete(layer.id)}
                      onMove={(dir) => onMoveLayer(layer.id, dir)}
                      onUseAsReference={() => onUseAsReference(layer)}
                      isFirst={index === 0}
                      isLast={index === layers.length - 1}
                      className="w-full bg-[#121215]"
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Background Layer Status */}
        <div className="p-4 border-t border-white/5 bg-[#18181b]">
          <div className="flex items-center opacity-50">
            <div className="w-8 h-8 bg-[#2d2d35] rounded mr-3 border border-white/5"></div>
            <div>
              <p className="text-xs text-gray-400 font-medium">Fundo</p>
              <p className="text-[10px] text-gray-600">Bloqueado</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default LayerPanel;