import React, { useState, useRef, useMemo } from 'react';
import { Toolbar } from './components/Toolbar';
import { ResultsPanel } from './components/ResultsPanel';
import { TakeoffCanvas } from './components/TakeoffCanvas';
import { ImageState, Shape, ToolMode, Material, Sheet } from './types';
import { Ruler, Loader2, Plus, X } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getPolylineLength, getPolygonArea, formatMeters, formatSquareMeters } from './utils/math';

// Configurar worker do PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://esm.sh/pdfjs-dist@4.0.379/build/pdf.worker.min.mjs`;

const App: React.FC = () => {
  // --- STATE DE MATERIAIS (Agora dentro do componente para permitir edição) ---
  const [materials, setMaterials] = useState<Material[]>([
     // --- MEDIÇÕES GENÉRICAS ---
    { id: 'meas-linear', name: 'Medição Linear', category: 'measure', type: 'linear', width: 0.05, color: '#ec4899' }, // Pink
    { id: 'meas-area', name: 'Medição de Área', category: 'measure', type: 'area', color: '#ec4899', opacity: 0.2 },   // Pink

    // --- PAREDES ---
    { id: 'wall-int', name: 'Parede Interna', category: 'wall', type: 'linear', width: 0.15, height: 2.80, color: '#ef4444' }, // Red (Standard)
    { id: 'wall-ext', name: 'Parede Externa', category: 'wall', type: 'linear', width: 0.15, height: 2.80, color: '#f97316' }, // Orange
    { id: 'wall-int-high', name: 'Parede Interna Alta', category: 'wall', type: 'linear', width: 0.15, height: 5.60, color: '#991b1b' }, // Dark Red
    { id: 'wall-ext-high', name: 'Parede Externa Alta', category: 'wall', type: 'linear', width: 0.15, height: 5.60, color: '#c2410c' }, // Dark Orange
    
    // --- ACABAMENTOS (Itens lineares que geram área vertical) ---
    { id: 'fin-paint-int', name: 'Pintura Interna', category: 'finish', type: 'linear', width: 0.02, height: 2.80, color: '#38bdf8' }, // Light Blue
    { id: 'fin-paint-ext', name: 'Pintura Externa', category: 'finish', type: 'linear', width: 0.02, height: 2.80, color: '#0ea5e9' }, // Sky Blue
    { id: 'fin-ceramic', name: 'Revest. Cerâmico Parede', category: 'finish', type: 'linear', width: 0.04, height: 2.80, color: '#0284c7' }, // Blue
    { id: 'fin-facade', name: 'Fachada', category: 'finish', type: 'linear', width: 0.05, height: 6.00, color: '#0369a1' }, // Dark Blue

    // --- ESTRUTURA ---
    // Pontuais
    { id: 'struct-pile', name: 'Estaca', category: 'structure', type: 'point', width: 0.25, color: '#4c1d95' }, 
    { id: 'struct-footing', name: 'Sapata', category: 'structure', type: 'point', width: 0.60, color: '#5b21b6' }, 
    { id: 'struct-col', name: 'Pilar Padrão', category: 'structure', type: 'point', width: 0.30, color: '#7c3aed' }, 
    // Lineares
    { id: 'struct-gbeam', name: 'Viga Baldrame', category: 'structure', type: 'linear', width: 0.20, color: '#a78bfa' }, 
    { id: 'struct-beam', name: 'Viga Aérea', category: 'structure', type: 'linear', width: 0.15, color: '#c4b5fd' },
    // Áreas
    { id: 'struct-slab', name: 'Laje (m²)', category: 'structure', type: 'area', color: '#6d28d9', opacity: 0.2 },

    // --- PISOS ---
    { id: 'floor-porc', name: 'Porcelanato', category: 'floor', type: 'area', color: '#f59e0b', opacity: 0.3 }, 
    { id: 'floor-lam', name: 'Laminado', category: 'floor', type: 'area', color: '#d97706', opacity: 0.3 }, 
    { id: 'floor-vinyl', name: 'Vinílico', category: 'floor', type: 'area', color: '#b45309', opacity: 0.3 },
    { id: 'floor-baseboard', name: 'Rodapé (ml)', category: 'floor', type: 'linear', width: 0.05, color: '#78350f' }, 

    // --- COBERTURA ---
    { id: 'roof-fibro', name: 'Telha Fibrocimento', category: 'roof', type: 'area', color: '#64748b', opacity: 0.4 }, 
    { id: 'roof-thermo', name: 'Telha Termoacústica', category: 'roof', type: 'area', color: '#94a3b8', opacity: 0.4 }, 
    { id: 'roof-ceramic-no-ceil', name: 'Telha Cerâmica s/ Forro', category: 'roof', type: 'area', color: '#ea580c', opacity: 0.4 }, 
    { id: 'roof-ceramic-ceil', name: 'Telha Cerâmica c/ Forro', category: 'roof', type: 'area', color: '#c2410c', opacity: 0.4 }, 
    { id: 'roof-waterproof', name: 'Impermeabilização', category: 'roof', type: 'area', color: '#334155', opacity: 0.5 }, 
  ]);

  const [mode, setMode] = useState<ToolMode>(ToolMode.SELECT);
  const [selectedMaterial, setSelectedMaterial] = useState<Material>(materials[0]); // Default to first (measurement)
  
  const [imageState, setImageState] = useState<ImageState | null>(null);
  const [scale, setScale] = useState<number | null>(null);
  
  // Snapping State
  const [isSnappingEnabled, setIsSnappingEnabled] = useState(true);
  
  // Sheet Management
  const [sheets, setSheets] = useState<Sheet[]>([
    { id: 'sheet-1', name: 'Folha 1', shapes: [] }
  ]);
  const [activeSheetId, setActiveSheetId] = useState<string>('sheet-1');

  const [selectedShapeId, setSelectedShapeId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  // Ephemeral Measurement State
  const [tempMeasureShape, setTempMeasureShape] = useState<Shape | null>(null);
  
  // UI State
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isBottomPanelCollapsed, setIsBottomPanelCollapsed] = useState(false);
  
  // Calibration Modal State
  const [showCalibrationModal, setShowCalibrationModal] = useState(false);
  const [calibrationPx, setCalibrationPx] = useState<number>(0);
  const [realWorldLength, setRealWorldLength] = useState<string>('');
  
  // Tab Renaming
  const [editingSheetId, setEditingSheetId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Helper to get active sheet data
  const activeSheet = useMemo(() => sheets.find(s => s.id === activeSheetId)!, [sheets, activeSheetId]);

  // Consolidate all shapes for reporting
  const allShapes = useMemo(() => sheets.flatMap(s => s.shapes), [sheets]);

  const handleUpdateMaterialHeight = (id: string, newHeight: number) => {
      setMaterials(prev => prev.map(m => m.id === id ? { ...m, height: newHeight } : m));
  };

  const handleAddSheet = () => {
    const newId = `sheet-${Date.now()}`;
    const newSheet: Sheet = {
      id: newId,
      name: `Folha ${sheets.length + 1}`,
      shapes: []
    };
    setSheets([...sheets, newSheet]);
    setActiveSheetId(newId);
    setMode(ToolMode.SELECT);
  };

  const handleRemoveSheet = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (sheets.length <= 1) return;
    if (confirm('Tem certeza que deseja excluir esta folha e seus desenhos?')) {
      const newSheets = sheets.filter(s => s.id !== id);
      setSheets(newSheets);
      if (activeSheetId === id) {
        setActiveSheetId(newSheets[0].id);
      }
    }
  };

  const startRenamingSheet = (sheet: Sheet) => {
    setEditingSheetId(sheet.id);
    setEditingName(sheet.name);
  };

  const saveSheetName = () => {
    if (editingSheetId && editingName.trim()) {
      setSheets(sheets.map(s => s.id === editingSheetId ? { ...s, name: editingName.trim() } : s));
    }
    setEditingSheetId(null);
  };

  const updateActiveSheetShapes = (newShapes: Shape[]) => {
    setSheets(prev => prev.map(s => s.id === activeSheetId ? { ...s, shapes: newShapes } : s));
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const processFile = async (file: File) => {
    setIsLoading(true);
    try {
      let imageUrl = '';
      
      if (file.type === 'application/pdf') {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const page = await pdf.getPage(1); // Render first page only for MVP
        
        const viewport = page.getViewport({ scale: 2.0 }); // High res
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        
        if (!context) throw new Error('Canvas context not supported');
        
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        
        await page.render({
          canvasContext: context,
          viewport: viewport
        } as any).promise;
        
        imageUrl = canvas.toDataURL('image/png');
      } else {
        imageUrl = URL.createObjectURL(file);
      }

      const img = new Image();
      img.src = imageUrl;
      img.onload = () => {
        setImageState({
          url: imageUrl,
          width: img.width,
          height: img.height
        });
        // Reset everything on new file
        setScale(null);
        setSheets([{ id: 'sheet-1', name: 'Folha 1', shapes: [] }]);
        setActiveSheetId('sheet-1');
        setMode(ToolMode.CALIBRATE);
        setIsLoading(false);
      };
    } catch (error) {
      console.error("Error processing file:", error);
      alert("Erro ao processar arquivo. Tente novamente.");
      setIsLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processFile(file);
  };

  const handleCalibrationFinish = (pixels: number) => {
    setCalibrationPx(pixels);
    setShowCalibrationModal(true);
    setMode(ToolMode.SELECT); // Stop drawing temporarily
  };

  const confirmCalibration = () => {
    // Replace comma with dot for PT-BR support
    const meters = parseFloat(realWorldLength.replace(',', '.'));
    if (!isNaN(meters) && meters > 0) {
      setScale(calibrationPx / meters);
      setShowCalibrationModal(false);
      setRealWorldLength('');
      setMode(ToolMode.SELECT);
    }
  };

  const handleShapeAdd = (shape: Shape) => {
    updateActiveSheetShapes([...activeSheet.shapes, shape]);
    setSelectedShapeId(shape.id);
  };

  // Improved Selection Logic: Switches Sheet if needed
  const handleSmartSelectShape = (id: string | null) => {
    setSelectedShapeId(id);
    if (id) {
        // Find which sheet contains this shape
        const sheetWithShape = sheets.find(s => s.shapes.some(shape => shape.id === id));
        // If found and not currently active, switch to it
        if (sheetWithShape && sheetWithShape.id !== activeSheetId) {
            setActiveSheetId(sheetWithShape.id);
        }
        // Force SELECT mode so user can see/move item immediately
        setMode(ToolMode.SELECT);
    }
  };

  const handleShapeRemove = (id: string) => {
    // Remove shape from whichever sheet it belongs to
    setSheets(prevSheets => prevSheets.map(sheet => ({
      ...sheet,
      shapes: sheet.shapes.filter(s => s.id !== id)
    })));

    if (selectedShapeId === id) {
      setSelectedShapeId(null);
    }
  };

  const handleBulkRemoveShapes = (materialId: string) => {
     if (confirm(`Tem certeza que deseja excluir TODOS os itens deste tipo?`)) {
         setSheets(prevSheets => prevSheets.map(sheet => ({
             ...sheet,
             shapes: sheet.shapes.filter(s => s.materialId !== materialId)
         })));
         setSelectedShapeId(null);
     }
  }

  const handleToggleShapeVisibility = (shapeId: string) => {
    setSheets(prevSheets => prevSheets.map(sheet => ({
        ...sheet,
        shapes: sheet.shapes.map(s => s.id === shapeId ? { ...s, hidden: !s.hidden } : s)
    })));
  };

  const handleToggleMaterialVisibility = (materialId: string) => {
      // Check if all are hidden to decide toggle direction
      const allHidden = allShapes.filter(s => s.materialId === materialId).every(s => s.hidden);
      
      setSheets(prevSheets => prevSheets.map(sheet => ({
          ...sheet,
          shapes: sheet.shapes.map(s => s.materialId === materialId ? { ...s, hidden: !allHidden } : s)
      })));
  }

  const handleClearLast = () => {
    updateActiveSheetShapes(activeSheet.shapes.slice(0, -1));
  };

  const handleClearAll = () => {
    if (window.confirm("Tem certeza que deseja apagar todas as medidas desta folha?")) {
      updateActiveSheetShapes([]);
      setSelectedShapeId(null);
    }
  };

  const handleExportPDF = async () => {
    if (!scale) {
      alert("É necessário calibrar a escala antes de exportar.");
      return;
    }
    
    setIsLoading(true);
    
    const doc = new jsPDF();
    const today = new Date().toLocaleDateString('pt-BR');

    // Header
    doc.setFontSize(18);
    doc.text("Relatório de Levantamento de Quantitativos", 14, 20);
    
    doc.setFontSize(10);
    doc.text(`Data: ${today}`, 14, 28);
    doc.text(`Arquivo: ${fileInputRef.current?.files?.[0]?.name || 'Planta importada'}`, 14, 33);

    // Prepare Data from ALL sheets
    const groups: Record<string, { material: Material, count: number, value: number, areaVertical?: number }> = {};
    
    allShapes.forEach(shape => {
      const mat = materials.find(m => m.id === shape.materialId);
      // Skip ephemeral measurements from PDF
      if (!mat || mat.category === 'measure') return;
      
      if (!groups[mat.id]) groups[mat.id] = { material: mat, count: 0, value: 0, areaVertical: 0 };
      
      groups[mat.id].count += 1;
      let val = 0;
      if (mat.type === 'linear') {
        val = getPolylineLength(shape.points) / scale;
        groups[mat.id].value += val;
        // Calc vertical area if height exists
        if (mat.height) {
             groups[mat.id].areaVertical = (groups[mat.id].areaVertical || 0) + (val * mat.height);
        }
      } else if (mat.type === 'area') {
        groups[mat.id].value += getPolygonArea(shape.points) / (scale * scale);
      } else if (mat.type === 'point') {
        groups[mat.id].value += 1;
      }
    });

    const tableData = Object.values(groups).map(row => {
        let categoryName = '';
        switch(row.material.category) {
            case 'wall': categoryName = 'Paredes'; break;
            case 'floor': categoryName = 'Pisos'; break;
            case 'structure': categoryName = 'Estrutura'; break;
            case 'finish': categoryName = 'Acabamentos'; break;
            case 'roof': categoryName = 'Cobertura'; break;
            case 'measure': categoryName = 'Medições'; break;
        }

        const totalStr = row.material.type === 'linear' ? formatMeters(row.value) :
                         row.material.type === 'area' ? formatSquareMeters(row.value) : `${row.value} un.`;
        
        const areaVertStr = row.material.height ? formatSquareMeters(row.areaVertical || 0) : '-';

        return [
          row.material.name,
          categoryName,
          row.count,
          totalStr,
          areaVertStr
        ]
    });

    // Table
    autoTable(doc, {
      startY: 40,
      head: [['Material', 'Categoria', 'Qtd', 'Total Linear/Área', 'Área Vertical (m²)']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [37, 99, 235] }
    });
    
    doc.save(`ProTakeoff_Relatorio_${Date.now()}.pdf`);
    setIsLoading(false);
  };

  return (
    <div className="flex flex-row h-screen w-screen bg-gray-50 overflow-hidden font-sans text-gray-800">
      {/* Hidden File Input */}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        accept="image/png, image/jpeg, image/jpg, application/pdf" 
        className="hidden" 
      />

      {/* Sidebar Toolbar */}
      <Toolbar 
        mode={mode}
        setMode={setMode}
        materials={materials}
        selectedMaterial={selectedMaterial}
        onSelectMaterial={setSelectedMaterial}
        onClearLast={handleClearLast}
        onClearAll={handleClearAll}
        onExportPDF={handleExportPDF}
        scale={scale}
        onUploadClick={handleUploadClick}
        isCollapsed={isSidebarCollapsed}
        toggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        isSnappingEnabled={isSnappingEnabled}
        onToggleSnapping={() => setIsSnappingEnabled(!isSnappingEnabled)}
      />

      {/* Main Content Area */}
      <div className="flex flex-col flex-1 min-w-0 h-full relative">
        
        {/* SHEET BAR (TABS) */}
        <div className="flex items-center bg-gray-200 border-b border-gray-300 pt-2 px-2 gap-1 overflow-x-auto select-none z-10 h-12">
          {sheets.map(sheet => (
             <div 
               key={sheet.id}
               onClick={() => {
                 setActiveSheetId(sheet.id);
                 setMode(ToolMode.SELECT);
                 if (editingSheetId && editingSheetId !== sheet.id) saveSheetName();
               }}
               onDoubleClick={() => startRenamingSheet(sheet)}
               className={`
                  flex items-center gap-2 px-4 py-1.5 text-sm font-medium rounded-t-lg cursor-pointer min-w-[120px] justify-between border-t border-r border-l border-transparent
                  ${activeSheetId === sheet.id 
                    ? 'bg-white text-blue-700 border-gray-300 relative top-[1px] shadow-sm' 
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-50 border-gray-200'}
               `}
             >
               {editingSheetId === sheet.id ? (
                 <input 
                    type="text" 
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onBlur={saveSheetName}
                    onKeyDown={(e) => e.key === 'Enter' && saveSheetName()}
                    autoFocus
                    className="w-24 px-1 py-0.5 text-xs bg-white text-black border border-blue-400 rounded outline-none"
                    onClick={(e) => e.stopPropagation()}
                 />
               ) : (
                 <span className="truncate max-w-[100px]">{sheet.name}</span>
               )}
               
               {sheets.length > 1 && !editingSheetId && (
                 <button 
                  onClick={(e) => handleRemoveSheet(e, sheet.id)}
                  className="p-0.5 rounded-full hover:bg-gray-200 text-gray-400 hover:text-red-500 transition-colors"
                 >
                   <X size={12} />
                 </button>
               )}
             </div>
          ))}
          <button 
            onClick={handleAddSheet}
            className="flex items-center justify-center p-1.5 mb-1 ml-1 rounded hover:bg-gray-300 text-gray-600 transition-colors"
            title="Adicionar nova folha"
          >
            <Plus size={18} />
          </button>
        </div>

        {/* Canvas Area */}
        <div className="flex-1 relative bg-[#e5e5e5] overflow-hidden">
          {isLoading && (
            <div className="absolute inset-0 z-50 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center">
              <Loader2 className="animate-spin text-blue-600 mb-3" size={48} />
              <p className="text-gray-700 font-semibold text-lg">Processando arquivo...</p>
              <p className="text-gray-500 text-sm">Convertendo e otimizando para web...</p>
            </div>
          )}
          
          <TakeoffCanvas 
            imageState={imageState}
            mode={mode}
            selectedMaterial={selectedMaterial}
            shapes={activeSheet.shapes}
            onShapeAdd={handleShapeAdd}
            scale={scale}
            onCalibrationFinish={handleCalibrationFinish}
            selectedShapeId={selectedShapeId}
            onSelectShape={handleSmartSelectShape}
            onRemoveShape={handleShapeRemove}
            isSnappingEnabled={isSnappingEnabled}
            tempMeasureShape={tempMeasureShape}
            setTempMeasureShape={setTempMeasureShape}
            materials={materials}
          />
        </div>

        {/* Bottom Panel */}
        <ResultsPanel 
          shapes={allShapes} 
          materials={materials}
          scale={scale} 
          isCollapsed={isBottomPanelCollapsed}
          toggleCollapse={() => setIsBottomPanelCollapsed(!isBottomPanelCollapsed)}
          onDeleteShape={handleShapeRemove}
          onDeleteMaterialGroup={handleBulkRemoveShapes}
          onSelectShape={handleSmartSelectShape}
          selectedShapeId={selectedShapeId}
          onToggleShapeVisibility={handleToggleShapeVisibility}
          onToggleMaterialVisibility={handleToggleMaterialVisibility}
          onUpdateHeight={handleUpdateMaterialHeight}
        />
      </div>

      {/* Calibration Modal */}
      {showCalibrationModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center animate-in fade-in duration-200">
          <div className="bg-white p-8 rounded-xl shadow-2xl w-[400px] border border-gray-100">
            <h3 className="text-xl font-bold mb-2 flex items-center gap-2 text-gray-800">
              <div className="bg-blue-100 p-2 rounded-lg">
                <Ruler className="text-blue-600" size={24} />
              </div>
              Calibrar Escala
            </h3>
            <p className="text-gray-600 mb-6 leading-relaxed text-sm">
              Você definiu uma linha de referência. Por favor, informe qual a distância real representada por essa linha.
            </p>
            
            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-700 mb-2">Distância Real (em Metros)</label>
              <div className="relative">
                <input
                  type="text"
                  inputMode="decimal"
                  value={realWorldLength}
                  onChange={(e) => setRealWorldLength(e.target.value)}
                  placeholder="ex: 3.50"
                  className="w-full bg-white text-gray-900 font-bold border border-gray-300 rounded-lg px-4 py-3 pl-4 pr-12 text-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all placeholder:text-gray-400"
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && confirmCalibration()}
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 font-medium">m</span>
              </div>
            </div>
            
            <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
              <button 
                onClick={() => setShowCalibrationModal(false)}
                className="px-5 py-2.5 text-gray-600 hover:bg-gray-100 hover:text-gray-900 rounded-lg font-medium transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={confirmCalibration}
                className="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium shadow-lg shadow-blue-600/20 disabled:opacity-50 disabled:shadow-none transition-all active:scale-95"
                disabled={!realWorldLength}
              >
                Confirmar Escala
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;