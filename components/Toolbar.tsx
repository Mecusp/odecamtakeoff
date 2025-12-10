import React from 'react';
import { MousePointer2, Ruler, BrickWall, Eraser, Trash2, Upload, BoxSelect, ChevronLeft, ChevronRight, FileText } from 'lucide-react';
import { ToolType } from '../types';

interface ToolbarProps {
  currentTool: ToolType;
  setTool: (tool: ToolType) => void;
  onClearLast: () => void;
  onClearAll: () => void;
  scale: number | null;
  onUploadClick: () => void;
  isCollapsed: boolean;
  toggleCollapse: () => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({ 
  currentTool, 
  setTool, 
  onClearLast, 
  onClearAll,
  scale,
  onUploadClick,
  isCollapsed,
  toggleCollapse
}) => {
  
  const getButtonClass = (tool: ToolType) => 
    `w-full flex items-center ${isCollapsed ? 'justify-center px-2' : 'px-4'} gap-3 py-2.5 rounded-lg transition-all duration-200 mb-1.5 font-medium relative group ${
      currentTool === tool 
        ? 'bg-blue-600 text-white shadow-md' 
        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
    }`;

  // Tooltip component for collapsed state
  const Tooltip = ({ text }: { text: string }) => (
    isCollapsed ? (
      <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap z-50 pointer-events-none transition-opacity">
        {text}
      </div>
    ) : null
  );

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

      <div className="flex-1 overflow-y-auto py-4 px-3 flex flex-col gap-6">
        
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

        {/* Tools Section */}
        <div className="flex flex-col gap-1">
           {!isCollapsed && <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 ml-1">Ferramentas</label>}
          
          <button onClick={() => setTool(ToolType.SELECT)} className={getButtonClass(ToolType.SELECT)}>
            <MousePointer2 size={20} strokeWidth={1.5} />
            {!isCollapsed && <span className="text-sm">Mover / Zoom</span>}
            <Tooltip text="Mover & Selecionar" />
          </button>

          <button onClick={() => setTool(ToolType.CALIBRATE)} className={getButtonClass(ToolType.CALIBRATE)}>
            <Ruler size={20} strokeWidth={1.5} />
            {!isCollapsed && <span className="text-sm">Calibrar Escala</span>}
            <Tooltip text="Calibrar Escala" />
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

        {/* Measurements Section */}
        <div className="flex flex-col gap-1">
           {!isCollapsed && <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 ml-1">Medição</label>}
           
           <button 
             onClick={() => setTool(ToolType.WALL)} 
             disabled={!scale}
             className={`${getButtonClass(ToolType.WALL)} ${!scale ? 'opacity-50 cursor-not-allowed group' : ''}`}
           >
            <BrickWall size={20} strokeWidth={1.5} />
            {!isCollapsed && <span className="text-sm">Parede (Linear)</span>}
            <Tooltip text="Paredes (Linear)" />
          </button>

          <button 
            onClick={() => setTool(ToolType.AREA)} 
            disabled={!scale}
            className={`${getButtonClass(ToolType.AREA)} ${!scale ? 'opacity-50 cursor-not-allowed group' : ''}`}
          >
            <BoxSelect size={20} strokeWidth={1.5} />
            {!isCollapsed && <span className="text-sm">Área (Polígonos)</span>}
            <Tooltip text="Áreas (m²)" />
          </button>
        </div>

        {/* Actions Section */}
        <div className="mt-auto flex flex-col gap-1">
           {!isCollapsed && <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 ml-1">Ações</label>}
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