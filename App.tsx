import React, { useState, useRef, useEffect } from 'react';
import { Toolbar } from './components/Toolbar';
import { ResultsPanel } from './components/ResultsPanel';
import { TakeoffCanvas } from './components/TakeoffCanvas';
import { ImageState, Shape, ToolType } from './types';
import { Ruler, Loader2 } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';

// Configurar worker do PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://esm.sh/pdfjs-dist@4.0.379/build/pdf.worker.min.mjs`;

const App: React.FC = () => {
  const [currentTool, setCurrentTool] = useState<ToolType>(ToolType.SELECT);
  const [imageState, setImageState] = useState<ImageState | null>(null);
  const [scale, setScale] = useState<number | null>(null);
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  // UI State
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isBottomPanelCollapsed, setIsBottomPanelCollapsed] = useState(false);
  
  // Calibration Modal State
  const [showCalibrationModal, setShowCalibrationModal] = useState(false);
  const [calibrationPx, setCalibrationPx] = useState<number>(0);
  const [realWorldLength, setRealWorldLength] = useState<string>('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

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
        }).promise;
        
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
        setShapes([]);
        setCurrentTool(ToolType.CALIBRATE);
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
    setCurrentTool(ToolType.SELECT); // Stop drawing temporarily
  };

  const confirmCalibration = () => {
    // Replace comma with dot for PT-BR support
    const meters = parseFloat(realWorldLength.replace(',', '.'));
    if (!isNaN(meters) && meters > 0) {
      setScale(calibrationPx / meters);
      setShowCalibrationModal(false);
      setRealWorldLength('');
      setCurrentTool(ToolType.SELECT);
    }
  };

  const handleClearLast = () => {
    setShapes(prev => prev.slice(0, -1));
  };

  const handleClearAll = () => {
    if (window.confirm("Tem certeza que deseja apagar todas as medidas?")) {
      setShapes([]);
    }
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
        currentTool={currentTool} 
        setTool={setCurrentTool}
        onClearLast={handleClearLast}
        onClearAll={handleClearAll}
        scale={scale}
        onUploadClick={handleUploadClick}
        isCollapsed={isSidebarCollapsed}
        toggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
      />

      {/* Main Content Area */}
      <div className="flex flex-col flex-1 min-w-0 h-full relative">
        
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
            tool={currentTool}
            shapes={shapes}
            onShapeAdd={(shape) => setShapes([...shapes, shape])}
            scale={scale}
            onCalibrationFinish={handleCalibrationFinish}
          />
        </div>

        {/* Bottom Panel */}
        <ResultsPanel 
          shapes={shapes} 
          scale={scale} 
          isCollapsed={isBottomPanelCollapsed}
          toggleCollapse={() => setIsBottomPanelCollapsed(!isBottomPanelCollapsed)}
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
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 pl-4 pr-12 text-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
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