import React, { useMemo, useState } from 'react';
import { Shape, Material } from '../types';
import { getPolylineLength, getPolygonArea, formatMeters, formatSquareMeters } from '../utils/math';
import { Sigma, ChevronDown, ChevronUp, ChevronRight, Trash2, Eye, EyeOff } from 'lucide-react';

interface ResultsPanelProps {
  shapes: Shape[];
  materials: Material[];
  scale: number | null;
  isCollapsed: boolean;
  toggleCollapse: () => void;
  onDeleteShape: (id: string) => void;
  onDeleteMaterialGroup: (materialId: string) => void;
  onSelectShape: (id: string | null) => void;
  selectedShapeId: string | null;
  onToggleShapeVisibility?: (shapeId: string) => void;
  onToggleMaterialVisibility?: (materialId: string) => void;
  onUpdateHeight?: (materialId: string, height: number) => void;
}

export const ResultsPanel: React.FC<ResultsPanelProps> = ({ 
    shapes, 
    materials, 
    scale, 
    isCollapsed, 
    toggleCollapse,
    onDeleteShape,
    onDeleteMaterialGroup,
    onSelectShape,
    selectedShapeId,
    onToggleShapeVisibility,
    onToggleMaterialVisibility,
    onUpdateHeight
}) => {
  
  const [expandedMaterialIds, setExpandedMaterialIds] = useState<Set<string>>(new Set());

  const toggleExpand = (id: string) => {
      const newSet = new Set(expandedMaterialIds);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      setExpandedMaterialIds(newSet);
  }

  const groupedData = useMemo(() => {
    if (!scale) return [];

    // Group shapes by material ID
    const groups: Record<string, { material: Material, count: number, totalValue: number, items: { id: string, value: number, hidden?: boolean }[] }> = {};

    shapes.forEach(shape => {
        const mat = materials.find(m => m.id === shape.materialId);
        // Excluir medições temporárias ('measure') da tabela de resultados
        if (!mat || mat.category === 'measure') return;

        if (!groups[mat.id]) {
            groups[mat.id] = { material: mat, count: 0, totalValue: 0, items: [] };
        }

        groups[mat.id].count += 1;
        
        let val = 0;
        if (mat.type === 'linear') {
            val = getPolylineLength(shape.points) / scale;
        } else if (mat.type === 'area') {
            val = getPolygonArea(shape.points) / (scale * scale);
        } else if (mat.type === 'point') {
            val = 1;
        }

        groups[mat.id].totalValue += val;
        groups[mat.id].items.push({ id: shape.id, value: val, hidden: shape.hidden });
    });

    return Object.values(groups);
  }, [shapes, materials, scale]);

  const getCategoryLabel = (cat: string) => {
      switch(cat) {
          case 'wall': return 'Paredes';
          case 'floor': return 'Pisos';
          case 'structure': return 'Estrutura';
          case 'finish': return 'Acabamentos';
          case 'roof': return 'Cobertura';
          case 'measure': return 'Medições';
          default: return cat;
      }
  }

  return (
    <div 
      className={`bg-white border-t border-gray-200 flex flex-col transition-all duration-300 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-30`}
      style={{ height: isCollapsed ? '48px' : '320px' }}
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

          {/* Mini Summary */}
          <div className="flex items-center gap-4 text-xs text-gray-500">
             <span>{shapes.filter(s => {
                 const m = materials.find(mat => mat.id === s.materialId);
                 return m && m.category !== 'measure';
             }).length} itens medidos</span>
          </div>
        </div>

        <button className="text-gray-400 hover:text-gray-600">
           {isCollapsed ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </button>
      </div>

      {/* Content Area */}
      <div className={`flex-1 overflow-y-auto p-0 custom-scrollbar ${isCollapsed ? 'opacity-0' : 'opacity-100'} transition-opacity duration-200`}>
        <table className="w-full text-sm text-left border-collapse">
            <thead className="text-xs text-gray-400 uppercase bg-gray-50/50 sticky top-0 z-10 shadow-sm">
            <tr>
                <th className="px-6 py-3 font-medium w-1/4">Material</th>
                <th className="px-6 py-3 font-medium">Categoria</th>
                <th className="px-6 py-3 font-medium text-right w-24">Altura (m)</th>
                <th className="px-6 py-3 text-right font-medium">Qtd / Comp</th>
                <th className="px-6 py-3 text-right font-medium">Área Vert (m²)</th>
                <th className="px-4 py-3"></th>
            </tr>
            </thead>
            <tbody>
            {groupedData.length === 0 ? (
                <tr><td colSpan={6} className="px-6 py-12 text-center text-gray-400">Nenhum levantamento realizado ainda.</td></tr>
            ) : (
                groupedData.map((row) => {
                    const isExpanded = expandedMaterialIds.has(row.material.id);
                    const allHidden = row.items.every(i => i.hidden);
                    const canHaveHeight = row.material.type === 'linear';
                    const areaVertical = canHaveHeight && row.material.height ? row.totalValue * row.material.height : 0;

                    return (
                        <React.Fragment key={row.material.id}>
                            <tr 
                                className={`border-b border-gray-50 hover:bg-gray-50 transition-colors cursor-pointer ${isExpanded ? 'bg-gray-50' : ''}`}
                                onClick={() => toggleExpand(row.material.id)}
                            >
                                <td className="px-6 py-3 font-medium text-gray-800 flex items-center gap-2">
                                    <ChevronRight size={16} className={`text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                                    <div className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: row.material.color }} />
                                    {row.material.name}
                                </td>
                                <td className="px-6 py-3 text-gray-500 capitalize">
                                    {getCategoryLabel(row.material.category)}
                                </td>
                                <td className="px-6 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                                    {canHaveHeight ? (
                                        <input 
                                            type="number" 
                                            step="0.1" 
                                            min="0"
                                            className="w-16 px-1 py-1 text-right text-gray-700 bg-transparent hover:bg-white border border-transparent hover:border-gray-200 rounded focus:border-blue-400 focus:bg-white focus:outline-none transition-all"
                                            value={row.material.height || 0}
                                            onChange={(e) => onUpdateHeight?.(row.material.id, parseFloat(e.target.value))}
                                        />
                                    ) : <span className="text-gray-300">-</span>}
                                </td>
                                <td className="px-6 py-3 text-right font-bold text-gray-800">
                                    {row.material.type === 'linear' ? formatMeters(row.totalValue) :
                                    row.material.type === 'area' ? formatSquareMeters(row.totalValue) :
                                    `${row.totalValue} un.`}
                                </td>
                                <td className="px-6 py-3 text-right font-bold text-blue-700">
                                    {canHaveHeight && row.material.height ? formatSquareMeters(areaVertical) : <span className="text-gray-300">-</span>}
                                </td>
                                <td className="px-4 py-3 text-right">
                                    <div className="flex items-center justify-end gap-2">
                                        <button 
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onToggleMaterialVisibility?.(row.material.id);
                                            }}
                                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                            title={allHidden ? "Mostrar todos" : "Ocultar todos"}
                                        >
                                           {allHidden ? <EyeOff size={16} /> : <Eye size={16} />}
                                        </button>
                                        <button 
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onDeleteMaterialGroup(row.material.id);
                                            }}
                                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                            title="Apagar todos itens deste material"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                            
                            {/* Expanded Details Row */}
                            {isExpanded && (
                                <tr className="bg-gray-50/50 border-b border-gray-100 shadow-inner">
                                    <td colSpan={6} className="p-0">
                                        <div className="max-h-60 overflow-y-auto px-6 py-2 bg-gray-50/30">
                                            <table className="w-full text-xs">
                                                <tbody>
                                                    {row.items.map((item, idx) => {
                                                        const isSelected = selectedShapeId === item.id;
                                                        return (
                                                            <tr 
                                                                key={item.id} 
                                                                className={`border-b border-gray-100 last:border-0 transition-colors cursor-pointer ${isSelected ? 'bg-blue-100' : 'hover:bg-gray-100/80'}`}
                                                                onClick={() => onSelectShape(item.id)}
                                                            >
                                                                <td className="py-2 pl-8 text-gray-500 font-medium w-1/3">
                                                                    Item {idx + 1}
                                                                </td>
                                                                <td className="py-2 text-right text-gray-700 font-mono">
                                                                     {row.material.type === 'linear' ? formatMeters(item.value) :
                                                                      row.material.type === 'area' ? formatSquareMeters(item.value) :
                                                                      `${item.value} un.`}
                                                                </td>
                                                                <td className="py-2 pr-2 text-right w-24">
                                                                    <div className="flex items-center justify-end gap-1">
                                                                        <button 
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                onToggleShapeVisibility?.(item.id);
                                                                            }}
                                                                            className="text-gray-400 hover:text-blue-500 p-2 rounded hover:bg-blue-50 transition-colors"
                                                                            title={item.hidden ? "Mostrar" : "Ocultar"}
                                                                        >
                                                                            {item.hidden ? <EyeOff size={14} /> : <Eye size={14} />}
                                                                        </button>
                                                                        <button 
                                                                            onClick={(e) => {
                                                                                e.stopPropagation(); // Stop row click (select)
                                                                                onDeleteShape(item.id);
                                                                            }}
                                                                            className="text-gray-400 hover:text-red-500 p-2 rounded hover:bg-red-50 transition-colors"
                                                                            title="Apagar este item"
                                                                        >
                                                                            <Trash2 size={14} />
                                                                        </button>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </React.Fragment>
                    );
                })
            )}
            </tbody>
        </table>
      </div>
    </div>
  );
};