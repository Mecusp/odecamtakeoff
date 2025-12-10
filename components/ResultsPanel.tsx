import React, { useMemo } from 'react';
import { Shape, ToolType } from '../types';
import { getPolylineLength, getPolygonArea, formatMeters, formatSquareMeters } from '../utils/math';
import { BrickWall, BoxSelect, Sigma, ChevronDown, ChevronUp, Maximize2, Minimize2 } from 'lucide-react';

interface ResultsPanelProps {
  shapes: Shape[];
  scale: number | null;
  isCollapsed: boolean;
  toggleCollapse: () => void;
}

export const ResultsPanel: React.FC<ResultsPanelProps> = ({ shapes, scale, isCollapsed, toggleCollapse }) => {
  
  const wallData = useMemo(() => {
    if (!scale) return { items: [], total: 0 };
    
    const walls = shapes.filter(s => s.type === ToolType.WALL);
    const items = walls.map((wall, idx) => {
      const pxLen = getPolylineLength(wall.points);
      const realLen = pxLen / scale;
      return { id: idx + 1, len: realLen };
    });
    
    const total = items.reduce((acc, curr) => acc + curr.len, 0);
    return { items, total };
  }, [shapes, scale]);

  const areaData = useMemo(() => {
    if (!scale) return { items: [], total: 0 };

    const areas = shapes.filter(s => s.type === ToolType.AREA);
    const items = areas.map((area, idx) => {
      const pxArea = getPolygonArea(area.points);
      const realArea = pxArea / (scale * scale);
      return { id: idx + 1, area: realArea };
    });

    const total = items.reduce((acc, curr) => acc + curr.area, 0);
    return { items, total };
  }, [shapes, scale]);

  return (
    <div 
      className={`bg-white border-t border-gray-200 flex flex-col transition-all duration-300 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-30`}
      style={{ height: isCollapsed ? '48px' : '280px' }}
    >
      {/* Header / Toggle Bar */}
      <div 
        className="h-12 bg-gray-50 border-b border-gray-200 flex items-center justify-between px-6 cursor-pointer hover:bg-gray-100 transition-colors"
        onClick={toggleCollapse}
      >
        <div className="flex items-center gap-8">
          <span className="text-sm font-bold text-gray-700 uppercase tracking-wide flex items-center gap-2">
            <Sigma size={18} className="text-gray-500" />
            Quantitativos
          </span>

          {/* Mini Summary when collapsed or expanded */}
          <div className="flex items-center gap-6 text-sm">
             <div className="flex items-center gap-2 text-gray-600 bg-white px-3 py-1 rounded border border-gray-200 shadow-sm">
                <BrickWall size={14} className="text-red-500" />
                <span className="font-semibold">{formatMeters(wallData.total)}</span>
             </div>
             <div className="flex items-center gap-2 text-gray-600 bg-white px-3 py-1 rounded border border-gray-200 shadow-sm">
                <BoxSelect size={14} className="text-blue-500" />
                <span className="font-semibold">{formatSquareMeters(areaData.total)}</span>
             </div>
          </div>
        </div>

        <button className="text-gray-400 hover:text-gray-600">
           {isCollapsed ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </button>
      </div>

      {/* Content Area */}
      <div className={`flex-1 flex flex-row overflow-hidden ${isCollapsed ? 'opacity-0' : 'opacity-100'} transition-opacity duration-200`}>
        
        {/* Walls Table */}
        <div className="flex-1 border-r border-gray-200 flex flex-col min-w-[300px]">
          <div className="p-3 bg-white border-b border-gray-100 flex items-center justify-between sticky top-0">
            <div className="flex items-center gap-2 font-medium text-gray-700 text-sm">
              <span className="w-2 h-2 rounded-full bg-red-500"></span>
              Paredes Lineares
            </div>
          </div>
          <div className="overflow-y-auto flex-1 p-0 custom-scrollbar">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-gray-400 uppercase bg-gray-50/50 sticky top-0">
                <tr>
                  <th className="px-6 py-2 font-medium">Item</th>
                  <th className="px-6 py-2 text-right font-medium">Comp.</th>
                </tr>
              </thead>
              <tbody>
                {wallData.items.length === 0 ? (
                  <tr><td colSpan={2} className="px-6 py-8 text-center text-gray-400 text-xs">Nenhuma medição realizada</td></tr>
                ) : (
                  wallData.items.map((item) => (
                    <tr key={item.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-2 font-mono text-gray-500 text-xs">#{item.id}</td>
                      <td className="px-6 py-2 text-right font-medium text-gray-700">{formatMeters(item.len)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Areas Table */}
        <div className="flex-1 flex flex-col min-w-[300px]">
          <div className="p-3 bg-white border-b border-gray-100 flex items-center justify-between sticky top-0">
            <div className="flex items-center gap-2 font-medium text-gray-700 text-sm">
              <span className="w-2 h-2 rounded-full bg-blue-500"></span>
              Áreas Poligonais
            </div>
          </div>
          <div className="overflow-y-auto flex-1 p-0 custom-scrollbar">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-gray-400 uppercase bg-gray-50/50 sticky top-0">
                <tr>
                  <th className="px-6 py-2 font-medium">Item</th>
                  <th className="px-6 py-2 text-right font-medium">Área</th>
                </tr>
              </thead>
              <tbody>
                {areaData.items.length === 0 ? (
                  <tr><td colSpan={2} className="px-6 py-8 text-center text-gray-400 text-xs">Nenhuma medição realizada</td></tr>
                ) : (
                  areaData.items.map((item) => (
                    <tr key={item.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-2 font-mono text-gray-500 text-xs">#{item.id}</td>
                      <td className="px-6 py-2 text-right font-medium text-gray-700">{formatSquareMeters(item.area)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};