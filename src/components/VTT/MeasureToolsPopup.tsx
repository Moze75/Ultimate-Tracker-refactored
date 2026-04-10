import React from 'react';
import { Ruler, Circle, Triangle } from 'lucide-react';
import type { VTTActiveTool } from './VTTLeftToolbar';

interface MeasureToolsPopupProps {
  activeTool: VTTActiveTool;
  onToolChange: (tool: VTTActiveTool) => void;
  onClose: () => void;
}

export const MeasureToolsPopup = React.forwardRef<HTMLDivElement, MeasureToolsPopupProps>(
  function MeasureToolsPopup({ activeTool, onToolChange, onClose }, ref) {
    const tools: { tool: VTTActiveTool; icon: React.ReactNode; label: string; desc: string }[] = [
      {
        tool: 'measure',
        icon: <Ruler size={15} />,
        label: 'Distance',
        desc: 'Mesurer une distance en ligne droite',
      },
      {
        tool: 'measure-circle',
        icon: <Circle size={15} />,
        label: 'Cercle (rayon)',
        desc: 'Mesurer un rayon / zone circulaire',
      },
      {
        tool: 'measure-cone',
        icon: <Triangle size={15} />,
        label: 'Cône',
        desc: 'Mesurer une zone conique',
      },
    ];

    return (
      <div
        ref={ref}
        className="absolute left-14 top-0 z-50 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl p-2 w-56"
      >
        <div className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold px-2 py-1 mb-1">
          Outils de mesure
        </div>
        {tools.map(({ tool, icon, label, desc }) => {
          const isActive = activeTool === tool;
          return (
            <button
              key={tool}
              onClick={() => onToolChange(tool)}
              className={`w-full flex items-start gap-2.5 px-2.5 py-2 rounded-lg text-left transition-colors ${
                isActive
                  ? 'bg-amber-900/30 text-amber-300'
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white'
              }`}
            >
              <div className="mt-0.5 shrink-0">{icon}</div>
              <div>
                <div className="text-xs font-medium">{label}</div>
                <div className="text-[10px] text-gray-500 leading-tight">{desc}</div>
              </div>
            </button>
          );
        })}
      </div>
    );
  }
);