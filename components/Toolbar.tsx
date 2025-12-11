import React, { useState } from 'react';
import { MousePointer2, Ruler, Eraser, Trash2, Upload, ChevronLeft, ChevronRight, BrickWall, Layers, Box, FileDown, Magnet, Tent, PaintRoller, PencilRuler } from 'lucide-react';
import { ToolMode, Material, MaterialCategory } from '../types';

interface ToolbarProps {
  mode: ToolMode;
  setMode: (mode: ToolMode) => void;
  materials: Material[];
  selectedMaterial: Material;
  onSelectMaterial: (material: Material) => void;
  onClearLast: () => void;
  onClearAll: () => void;
  onExportPDF: () => void;
  scale: number | null;
  onUploadClick: () => void;
  isCollapsed: boolean;
  toggleCollapse: () => void;
  isSnappingEnabled: boolean;
  onToggleSnapping: () => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({ 
  mode, 
  setMode, 
  materials,
  selectedMaterial,
  onSelectMaterial,
  onClearLast, 
  onClearAll,
  onExportPDF,
  scale,
  onUploadClick,
  isCollapsed,
  toggleCollapse,
  isSnappingEnabled,
  onToggleSnapping
}) => {

  // Default open: measure to emphasize the new tools or wall
  const [openCategory, setOpenCategory] = useState<MaterialCategory | null>('measure');

  const toggleCategory = (cat: MaterialCategory) => {
    setOpenCategory(openCategory === cat ? null : cat);
  };
  
  const getButtonClass = (isActive: boolean) => 
    `w-full flex items-center ${isCollapsed ? 'justify-center px-2' : 'px-4'} gap-3 py-2.5 rounded-lg transition-all duration-200 mb-1.5 font-medium relative group ${
      isActive 
        ? 'bg-blue-600 text-white shadow-md' 
        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
    }`;

  // Tooltip component
  const Tooltip = ({ text }: { text: string }) => (
    isCollapsed ? (
      <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap z-50 pointer-events-none transition-opacity">
        {text}
      </div>
    ) : null
  );

  const renderMaterialButton = (m: Material) => {
     const isSelected = mode === ToolMode.DRAW && selectedMaterial.id === m.id;
     return (
        <button
            key={m.id}
            onClick={() => {
                onSelectMaterial(m);
                setMode(ToolMode.DRAW);
            }}
            disabled={!scale}
            className={`w-full flex items-center gap-2 py-2 px-3 rounded-md text-sm transition-colors mb-1 ${
                isSelected ? 'bg-blue-50 border border-blue-200 text-blue-800' : 'hover:bg-gray-50 text-gray-600 border border-transparent'
            } ${!scale ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
            <div 
                className="w-3 h-3 rounded-full border border-gray-300 shadow-sm" 
                style={{ backgroundColor: m.color }} 
            />
            {!isCollapsed && (
                <div className="flex flex-col items-start">
                    <span className="font-medium leading-none">{m.name}</span>
                    {m.width && <span className="text-[10px] text-gray-400 mt-1">{Math.round(m.width * 100)} cm</span>}
                </div>
            )}
            {isCollapsed && <Tooltip text={m.name} />}
        </button>
     )
  }

  const renderCategory = (category: MaterialCategory, title: string, Icon: React.ElementType) => {
      const catMaterials = materials.filter(m => m.category === category);
      if (catMaterials.length === 0) return null;

      const isOpen = openCategory === category;
      const isActiveInCat = mode === ToolMode.DRAW && selectedMaterial.category === category;

      if (isCollapsed) {
          // In collapsed mode, we just show one icon for the category if active, or generic
          return (
             <div className="relative group mb-2">
                 <button 
                    onClick={() => {
                        setOpenCategory(category);
                        toggleCollapse(); // Expand on click to select specific material
                    }}
                    className={`w-full flex justify-center py-2.5 rounded-lg transition-colors ${isActiveInCat ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`}
                 >
                    <Icon size={20} />
                 </button>
                 <Tooltip text={title} />
             </div>
          )
      }

      return (
        <div className="mb-2">
            <button 
                onClick={() => toggleCategory(category)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors ${isActiveInCat ? 'text-blue-700 bg-blue-50/50' : 'text-gray-700 hover:bg-gray-100'}`}
            >
                <div className="flex items-center gap-2">
                    <Icon size={18} className={isActiveInCat ? 'text-blue-600' : 'text-gray-500'} />
                    {title}
                </div>
                <ChevronRight size={14} className={`transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`} />
            </button>
            
            {isOpen && (
                <div className="pl-4 pr-1 mt-1 border-l-2 border-gray-100 ml-3 space-y-1 animate-in slide-in-from-left-1 duration-200">
                    {catMaterials.map(renderMaterialButton)}
                </div>
            )}
        </div>
      );
  }

  return (
    <div className={`${isCollapsed ? 'w-16' : 'w-64'} bg-white border-r border-gray-200 flex flex-col h-full transition-all duration-300 z-20 shadow-sm relative`}>
      
      {/* Header / Logo */}
      <div className={`p-4 border-b border-gray-200 flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'}`}>
        {!isCollapsed && (
          <div>
             <h1 className="font-bold text-gray-800 flex items-center gap-2 text-lg">
                <Ruler className="text-blue-600" size={20} />
                ProTakeoff
            </h1>
          </div>
        )}
        {isCollapsed && <Ruler className="text-blue-600" size={24} />}
      </div>

      <div className="flex-1 overflow-y-auto py-4 px-3 flex flex-col gap-4 custom-scrollbar">
        
        {/* Project Section */}
        <div className="flex flex-col gap-1">
          {!isCollapsed && <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 ml-1">Projeto</label>}
          <button 
            onClick={onUploadClick}
            className={`flex items-center ${isCollapsed ? 'justify-center' : ''} gap-2 px-3 py-2.5 rounded-lg border border-dashed border-gray-300 text-gray-600 hover:border-blue-500 hover:text-blue-600 hover:bg-blue-50 transition-colors group relative`}
          >
            <Upload size={20} strokeWidth={1.5} />
            {!isCollapsed && <span className="text-sm font-medium">Carregar</span>}
            <Tooltip text="Carregar Planta" />
          </button>
        </div>

        {/* Core Tools */}
        <div className="flex flex-col gap-1">
           {!isCollapsed && <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 ml-1">Ferramentas</label>}
          
          <button onClick={() => setMode(ToolMode.SELECT)} className={getButtonClass(mode === ToolMode.SELECT)}>
            <MousePointer2 size={20} strokeWidth={1.5} />
            {!isCollapsed && <span className="text-sm">Mover / Zoom</span>}
            <Tooltip text="Mover & Selecionar" />
          </button>

          <button onClick={() => setMode(ToolMode.CALIBRATE)} className={getButtonClass(mode === ToolMode.CALIBRATE)}>
            <Ruler size={20} strokeWidth={1.5} />
            {!isCollapsed && <span className="text-sm">Calibrar Escala</span>}
            <Tooltip text="Calibrar Escala" />
          </button>
          
           {/* Snapping Toggle */}
           <button 
                onClick={onToggleSnapping} 
                className={`w-full flex items-center ${isCollapsed ? 'justify-center px-2' : 'px-4'} gap-3 py-2.5 rounded-lg transition-all duration-200 mb-1.5 font-medium relative group ${
                    isSnappingEnabled 
                        ? 'bg-green-100 text-green-700 shadow-sm border border-green-200' 
                        : 'text-gray-500 hover:bg-gray-100'
                }`}
            >
                <Magnet size={20} strokeWidth={isSnappingEnabled ? 2 : 1.5} />
                {!isCollapsed && <span className="text-sm">Imã {isSnappingEnabled ? 'ON' : 'OFF'}</span>}
                <Tooltip text={`Imã ${isSnappingEnabled ? 'Ligado' : 'Desligado'}`} />
            </button>

           {/* Scale Indicator */}
           <div className={`mt-1 p-2 rounded text-xs border ${!scale ? 'border-red-100 bg-red-50 text-red-600' : 'border-green-100 bg-green-50 text-green-700'} ${isCollapsed ? 'flex justify-center' : ''}`}>
             {!isCollapsed ? (
                scale 
                  ? <span className="font-mono flex items-center gap-2">✅ {(scale).toFixed(2)} px/m</span>
                  : <span className="flex items-center gap-1">⚠️ Sem Escala</span>
             ) : (
                <div className={`w-2 h-2 rounded-full ${scale ? 'bg-green-500' : 'bg-red-500'}`} title={scale ? `Escala: ${scale.toFixed(2)}` : "Não calibrado"} />
             )}
          </div>
        </div>

        {/* Materials Catalog */}
        <div className="flex flex-col gap-1 mt-2">
           {!isCollapsed && <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 ml-1">Materiais</label>}
           
           {renderCategory('measure', 'Medições', PencilRuler)}
           {renderCategory('wall', 'Paredes', BrickWall)}
           {renderCategory('finish', 'Acabamentos', PaintRoller)}
           {renderCategory('floor', 'Pisos & Áreas', Layers)}
           {renderCategory('structure', 'Estrutura', Box)}
           {renderCategory('roof', 'Cobertura', Tent)}
        </div>

        {/* Actions Section */}
        <div className="mt-auto flex flex-col gap-1 pt-4 border-t border-gray-100">
           {!isCollapsed && <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 ml-1">Ações</label>}
           
            <button onClick={onExportPDF} className={`w-full flex items-center ${isCollapsed ? 'justify-center' : 'px-4'} gap-3 px-4 py-2 text-sm text-gray-600 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition-colors group relative`}>
             <FileDown size={20} strokeWidth={1.5} />
             {!isCollapsed && <span>Exportar PDF</span>}
             <Tooltip text="Exportar Relatório" />
           </button>

           <button onClick={onClearLast} className={`w-full flex items-center ${isCollapsed ? 'justify-center' : 'px-4'} gap-3 px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 hover:text-gray-900 rounded-lg transition-colors group relative`}>
             <Eraser size={20} strokeWidth={1.5} />
             {!isCollapsed && <span>Desfazer</span>}
             <Tooltip text="Desfazer Último" />
           </button>

           <button onClick={onClearAll} className={`w-full flex items-center ${isCollapsed ? 'justify-center' : 'px-4'} gap-3 px-4 py-2 text-sm text-gray-600 hover:bg-red-50 hover:text-red-600 rounded-lg transition-colors group relative`}>
             <Trash2 size={20} strokeWidth={1.5} />
             {!isCollapsed && <span>Limpar Tudo</span>}
             <Tooltip text="Limpar Tudo" />
           </button>
        </div>
      </div>

      {/* Collapse Toggle */}
      <button 
        onClick={toggleCollapse}
        className="absolute -right-3 top-1/2 -translate-y-1/2 bg-white border border-gray-200 rounded-full p-1 shadow-md hover:bg-gray-50 text-gray-500 z-50"
      >
        {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
      </button>

    </div>
  );
};