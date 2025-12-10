import React, { useRef, useState, useEffect } from 'react';
import { Stage, Layer, Image as KonvaImage, Line, Circle, Group, Text, Rect } from 'react-konva';
import useImage from 'use-image';
import Konva from 'konva';
import { ImageState, Point, Shape, ToolType } from '../types';
import { getDistance, formatMeters } from '../utils/math';

interface TakeoffCanvasProps {
  imageState: ImageState | null;
  tool: ToolType;
  shapes: Shape[];
  onShapeAdd: (shape: Shape) => void;
  scale: number | null;
  onCalibrationFinish: (pixels: number) => void;
}

// Reduzido de 15 para 6 para ser mais sutil e preciso
const SNAP_THRESHOLD = 6; 

export const TakeoffCanvas: React.FC<TakeoffCanvasProps> = ({
  imageState,
  tool,
  shapes,
  onShapeAdd,
  scale,
  onCalibrationFinish,
}) => {
  const [image] = useImage(imageState?.url || '', 'anonymous');
  const stageRef = useRef<Konva.Stage>(null);
  const [currentPoints, setCurrentPoints] = useState<Point[]>([]);
  const [mousePos, setMousePos] = useState<Point | null>(null);
  const [snappedPos, setSnappedPos] = useState<Point | null>(null);
  
  // Reset current drawing when tool changes
  useEffect(() => {
    setCurrentPoints([]);
    setMousePos(null);
    setSnappedPos(null);
  }, [tool]);

  // Handle ESC key to cancel current drawing
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setCurrentPoints([]);
        setSnappedPos(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Helper to find nearest point to snap to
  const getNearestPoint = (pos: Point): Point | null => {
    let nearest: Point | null = null;
    let minDist = SNAP_THRESHOLD;

    // 1. Check points in the current shape (for closing polygons)
    if (currentPoints.length > 2 && tool === ToolType.AREA) {
      const startPoint = currentPoints[0];
      const dist = getDistance(pos, startPoint);
      if (dist < minDist) {
        minDist = dist;
        nearest = startPoint;
      }
    }

    // 2. Check points in existing shapes (to connect walls)
    // We only check endpoints of existing shapes to reduce complexity
    shapes.forEach(shape => {
      shape.points.forEach(p => {
        const dist = getDistance(pos, p);
        if (dist < minDist) {
          minDist = dist;
          nearest = p;
        }
      });
    });

    return nearest;
  };

  const handleStageClick = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (tool === ToolType.SELECT || !imageState) return;

    const stage = e.target.getStage();
    if (!stage) return;
    
    // Determine the actual point to use (snapped or raw)
    const effectivePos = snappedPos || getPointerPos(stage);

    // Handle Closing Polygons for Area
    if (tool === ToolType.AREA && currentPoints.length > 2) {
      const firstPoint = currentPoints[0];
      const dist = getDistance(effectivePos, firstPoint);
      
      // If we clicked on the start point (snapped or close enough), close it
      if (dist < SNAP_THRESHOLD || (snappedPos && snappedPos.x === firstPoint.x && snappedPos.y === firstPoint.y)) {
        finishShape(true);
        return;
      }
    }

    // Handle Calibration (2 points only)
    if (tool === ToolType.CALIBRATE && currentPoints.length === 1) {
      const newPoints = [...currentPoints, effectivePos];
      setCurrentPoints([]); // Clear visual temp line
      
      const distPx = getDistance(newPoints[0], newPoints[1]);
      onCalibrationFinish(distPx);
      return;
    }

    setCurrentPoints([...currentPoints, effectivePos]);
  };

  const getPointerPos = (stage: Konva.Stage) => {
    const transform = stage.getAbsoluteTransform().copy();
    transform.invert();
    return transform.point(stage.getPointerPosition() || { x: 0, y: 0 });
  };

  const handleMouseMove = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (tool === ToolType.SELECT) return;
    const stage = e.target.getStage();
    if (!stage) return;
    
    const rawPos = getPointerPos(stage);
    const snap = getNearestPoint(rawPos);

    setMousePos(rawPos);
    setSnappedPos(snap);
  };

  const handleDoubleClick = () => {
    if (tool === ToolType.WALL && currentPoints.length > 1) {
      finishShape(false);
    }
  };

  const finishShape = (closed: boolean) => {
    const newShape: Shape = {
      id: Date.now().toString(),
      type: tool,
      points: currentPoints,
      color: tool === ToolType.WALL ? '#ef4444' : '#3b82f6',
      closed: closed
    };
    onShapeAdd(newShape);
    setCurrentPoints([]);
    setSnappedPos(null);
  };

  // Render Logic
  const renderCurrentShape = () => {
    if (currentPoints.length === 0) return null;

    // Use snapped position for the "rubber band" line if available, otherwise raw mouse pos
    const endPoint = snappedPos || mousePos;
    if (!endPoint) return null;

    const pointsToDraw = [...currentPoints, endPoint];
    const flatPoints = pointsToDraw.flatMap(p => [p.x, p.y]);
    
    // Calculate live length
    const currentSegmentLength = scale 
        ? getDistance(currentPoints[currentPoints.length - 1], endPoint) / scale 
        : 0;
    
    // If closing polygon, show "FECHAR"
    const isClosing = tool === ToolType.AREA && snappedPos && currentPoints.length > 2 && snappedPos === currentPoints[0];

    return (
      <Group>
        <Line
          points={flatPoints}
          stroke={tool === ToolType.WALL ? '#ef4444' : tool === ToolType.AREA ? '#3b82f6' : '#f59e0b'}
          strokeWidth={2 / (stageRef.current?.scaleX() || 1)}
          dash={tool === ToolType.CALIBRATE ? [10, 5] : []}
          closed={false}
        />
        {pointsToDraw.map((p, i) => (
          <Circle
            key={i}
            x={p.x}
            y={p.y}
            radius={3 / (stageRef.current?.scaleX() || 1)}
            fill="white"
            stroke="black"
            strokeWidth={1}
          />
        ))}
        {/* Tooltip for current action */}
        {endPoint && (
            <Group x={endPoint.x + 10} y={endPoint.y + 10}>
                <Rect 
                    fill="rgba(0,0,0,0.8)" 
                    cornerRadius={4}
                    width={isClosing ? 60 : 60}
                    height={20}
                    offsetY={-5}
                />
                <Text 
                    text={isClosing ? "FECHAR" : scale ? formatMeters(currentSegmentLength) : "..."}
                    fontSize={12}
                    fill="white"
                    padding={4}
                />
            </Group>
        )}
      </Group>
    );
  };

  const renderSnapIndicator = () => {
    if (!snappedPos) return null;
    const r = 6 / (stageRef.current?.scaleX() || 1); // Raio menor para o indicador
    return (
        <Group>
            <Circle 
                x={snappedPos.x} 
                y={snappedPos.y} 
                radius={r} 
                stroke="#22c55e" 
                strokeWidth={1.5} 
                fillEnabled={false}
            />
             <Circle 
                x={snappedPos.x} 
                y={snappedPos.y} 
                radius={r/2} 
                fill="#22c55e" 
            />
        </Group>
    );
  };

  // ResizeObserver para manter o canvas ajustado
  const [size, setSize] = useState({ width: 0, height: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const checkSize = () => {
      if (containerRef.current) {
        setSize({
          width: containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight
        });
      }
    };
    
    // Initial check
    checkSize();
    
    const resizeObserver = new ResizeObserver(checkSize);
    if (containerRef.current) resizeObserver.observe(containerRef.current);
    
    return () => resizeObserver.disconnect();
  }, []);


  return (
    <div ref={containerRef} className="w-full h-full bg-[#e5e5e5] overflow-hidden relative cursor-crosshair">
      {!imageState ? (
         <div className="absolute inset-0 flex items-center justify-center text-gray-400">
           <div className="text-center p-8 bg-white/50 rounded-xl backdrop-blur-sm shadow-sm">
             <p className="mb-2 text-lg font-medium text-gray-600">Nenhuma Planta Carregada</p>
             <p className="text-sm">Carregue uma imagem ou PDF na barra lateral para começar.</p>
           </div>
         </div>
      ) : (
        <Stage
          ref={stageRef}
          width={size.width}
          height={size.height}
          draggable={tool === ToolType.SELECT}
          onMouseDown={handleStageClick}
          onMouseMove={handleMouseMove}
          onDblClick={handleDoubleClick}
          onWheel={(e) => {
            e.evt.preventDefault();
            const scaleBy = 1.1;
            const stage = e.target.getStage();
            if (!stage) return;
            const oldScale = stage.scaleX();
            const mousePointTo = {
              x: stage.getPointerPosition()!.x / oldScale - stage.x() / oldScale,
              y: stage.getPointerPosition()!.y / oldScale - stage.y() / oldScale,
            };

            const newScale = e.evt.deltaY < 0 ? oldScale * scaleBy : oldScale / scaleBy;
            stage.scale({ x: newScale, y: newScale });

            const newPos = {
              x: -(mousePointTo.x - stage.getPointerPosition()!.x / newScale) * newScale,
              y: -(mousePointTo.y - stage.getPointerPosition()!.y / newScale) * newScale,
            };
            stage.position(newPos);
          }}
        >
          <Layer>
            {image && <KonvaImage image={image} />}
          </Layer>
          <Layer>
            {/* Render Committed Shapes */}
            {shapes.map((shape) => (
              <Group key={shape.id}>
                {shape.type === ToolType.AREA ? (
                   // Areas as closed shapes
                   <Line
                    points={shape.points.flatMap(p => [p.x, p.y])}
                    fill={`${shape.color}40`} // Transparent fill
                    stroke={shape.color}
                    strokeWidth={2 / (stageRef.current?.scaleX() || 1)}
                    closed={true}
                   />
                ) : (
                   // Walls as polylines
                   <Line
                    points={shape.points.flatMap(p => [p.x, p.y])}
                    stroke={shape.color}
                    strokeWidth={4 / (stageRef.current?.scaleX() || 1)} // Thicker for walls
                    lineCap="round"
                    lineJoin="round"
                    closed={false}
                   />
                )}

                {/* Labels for Wall Segments */}
                {shape.type === ToolType.WALL && scale && (
                    shape.points.slice(0, -1).map((p, i) => {
                        const next = shape.points[i+1];
                        const midX = (p.x + next.x) / 2;
                        const midY = (p.y + next.y) / 2;
                        const len = getDistance(p, next) / scale;
                        return (
                            <Text 
                                key={`label-${shape.id}-${i}`}
                                x={midX}
                                y={midY}
                                text={formatMeters(len)}
                                fontSize={12 / (stageRef.current?.scaleX() || 1)}
                                fill="black"
                                stroke="white"
                                strokeWidth={3}
                                opacity={0.9}
                            />
                        )
                    })
                )}
                
                {/* Vertices for snapping visualization */}
                {shape.points.map((p, i) => (
                  <Circle
                    key={`v-${shape.id}-${i}`}
                    x={p.x}
                    y={p.y}
                    radius={3 / (stageRef.current?.scaleX() || 1)}
                    fill="white"
                    stroke={shape.color}
                    strokeWidth={1}
                  />
                ))}
              </Group>
            ))}
            
            {/* Render In-Progress Shape */}
            {renderCurrentShape()}
            
            {/* Render Snap Indicator (Magnet) */}
            {renderSnapIndicator()}

          </Layer>
        </Stage>
      )}
      
      {tool === ToolType.SELECT && imageState && (
          <div className="absolute top-4 right-4 bg-white/90 backdrop-blur border border-gray-200 shadow-sm px-3 py-1 rounded-md text-xs font-medium text-gray-600 pointer-events-none">
            Modo Navegação (Arraste e Zoom)
          </div>
      )}
      {tool !== ToolType.SELECT && imageState && (
        <div className="absolute top-4 right-4 bg-white shadow-lg border-l-4 border-blue-500 px-4 py-3 rounded-md text-sm pointer-events-none text-gray-700 animate-in fade-in slide-in-from-top-2">
           {tool === ToolType.CALIBRATE && (
             <div className="flex flex-col">
               <span className="font-bold text-gray-900">Calibração</span>
               <span className="text-xs">Clique no início e fim de uma medida conhecida.</span>
             </div>
           )}
           {tool === ToolType.WALL && (
             <div className="flex flex-col">
               <span className="font-bold text-gray-900">Medindo Paredes</span>
               <span className="text-xs mt-1">Clique para pontos. <span className="font-semibold text-blue-600">Duplo clique</span> para finalizar.</span>
               <span className="text-[10px] text-gray-400 mt-0.5">ESC para cancelar traço atual.</span>
             </div>
           )}
           {tool === ToolType.AREA && (
             <div className="flex flex-col">
               <span className="font-bold text-gray-900">Medindo Área</span>
               <span className="text-xs mt-1">Clique no <span className="font-semibold text-blue-600">Ponto Inicial</span> para fechar o polígono.</span>
               <span className="text-[10px] text-gray-400 mt-0.5">ESC para cancelar área atual.</span>
             </div>
           )}
        </div>
      )}
    </div>
  );
};