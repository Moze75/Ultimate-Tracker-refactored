import React, { useState, useEffect } from 'react';
import { Image as ImageIcon } from 'lucide-react';
import { CampaignVisual } from '../services/campaignVisualsService';

interface DraggableWindow {
  visual: CampaignVisual;
  position: { x: number; y: number };
  size: { width: number; height: number };
}

interface DraggableVisualWindowsProps {
  windows: DraggableWindow[];
  onClose: (index: number) => void;
  onUpdatePosition: (index: number, position: { x: number; y: number }) => void;
}

export function DraggableVisualWindows({ windows, onClose, onUpdatePosition }: DraggableVisualWindowsProps) {
  const [draggingWindow, setDraggingWindow] = useState<{ index: number; offsetX: number; offsetY: number } | null>(null);

  const getCategoryColor = (category: string) => {
    const colors = {
      character: 'bg-purple-500/20 border-purple-500/40 text-purple-300',
      location: 'bg-blue-500/20 border-blue-500/40 text-blue-300',
      item: 'bg-yellow-500/20 border-yellow-500/40 text-yellow-300',
      npc: 'bg-green-500/20 border-green-500/40 text-green-300',
      general: 'bg-gray-500/20 border-gray-500/40 text-gray-300'
    };
    return colors[category as keyof typeof colors] || colors.general;
  };

  const getCategoryLabel = (category: string) => {
    const labels = {
      character: 'Personnage',
      location: 'Lieu',
      item: 'Objet',
      npc: 'PNJ',
      general: 'Général'
    };
    return labels[category as keyof typeof labels] || category;
  };

  const handleMouseDown = (e: React.MouseEvent, index: number) => {
    if ((e.target as HTMLElement).closest('.window-content')) return;

    const window = windows[index];
    setDraggingWindow({
      index,
      offsetX: e.clientX - window.position.x,
      offsetY: e.clientY - window.position.y
    });
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!draggingWindow) return;

    onUpdatePosition(draggingWindow.index, {
      x: e.clientX - draggingWindow.offsetX,
      y: e.clientY - draggingWindow.offsetY
    });
  };

  const handleMouseUp = () => {
    setDraggingWindow(null);
  };

  useEffect(() => {
    if (draggingWindow) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [draggingWindow]);

  return (
    <>
      {windows.map((win, index) => (
        <div
          key={index}
          className="fixed z-[9999] bg-gray-900 rounded-lg shadow-2xl border border-gray-700 overflow-hidden"
          style={{
            left: `${win.position.x}px`,
            top: `${win.position.y}px`,
            width: `${win.size.width}px`,
            height: `${win.size.height}px`,
          }}
        >
          <div
            className="bg-gray-800 px-4 py-3 flex items-center justify-between cursor-move border-b border-gray-700"
            onMouseDown={(e) => handleMouseDown(e, index)}
          >
            <div className="flex items-center gap-2">
              <ImageIcon size={18} className="text-purple-400" />
              <h3 className="font-semibold text-white text-sm truncate max-w-[300px]">
                {win.visual.title}
              </h3>
              <span className={`px-2 py-0.5 rounded-full text-xs border ${getCategoryColor(win.visual.category)}`}>
                {getCategoryLabel(win.visual.category)}
              </span>
            </div>
            <button
              onClick={() => onClose(index)}
              className="p-1 hover:bg-gray-700 rounded transition-colors"
              title="Fermer"
            >
              <svg className="w-5 h-5 text-gray-400 hover:text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="window-content overflow-auto h-[calc(100%-3rem)] bg-gray-950 p-4">
            <img
              src={win.visual.image_url}
              alt={win.visual.title}
              className="w-full h-auto object-contain rounded"
            />
            {win.visual.description && (
              <div className="mt-4 p-3 bg-gray-800/50 rounded border border-gray-700">
                <p className="text-sm text-gray-300">{win.visual.description}</p>
              </div>
            )}
          </div>
        </div>
      ))}
    </>
  );
}

export interface DraggableWindowData {
  visual: CampaignVisual;
  position: { x: number; y: number };
  size: { width: number; height: number };
}
