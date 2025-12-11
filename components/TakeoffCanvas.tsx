import React, { useRef, useState, useEffect } from 'react';
import { Stage, Layer, Image as KonvaImage, Line, Circle, Group, Text, Rect, Path } from 'react-konva';
import useImage from 'use-image';
import Konva from 'konva';
import { ImageState, Point, Shape, ToolMode, Material } from '../types';
import { getDistance, formatMeters, getPolylineLength, getPolygonArea, formatSquareMeters } from '../utils/math';

interface TakeoffCanvasProps {
  imageState: ImageState | null;
  mode: ToolMode;
  selectedMaterial: Material;
  shapes: Shape[];
  onShapeAdd: (shape: Shape) => void;
  scale: number | null;
  onCalibrationFinish: (pixels: number) => void;
  selectedShapeId: string | null;
  onSelectShape: (id: string | null) => void;
  onRemoveShape: (id: string) => void;
  isSnappingEnabled: boolean;
  
  // New props for ephemeral measurements
  tempMeasureShape: Shape | null;
  setTempMeasureShape: (shape: Shape | null) => void;

  // New: List of all materials to resolve colors
  materials: Material[];
}

const SNAP_THRESHOLD = 5; 

export const TakeoffCanvas: React.FC<TakeoffCanvasProps> = ({
  imageState,
  mode,
  selectedMaterial,
  shapes,
  onShapeAdd,
  scale,
  onCalibrationFinish,
  selectedShapeId,
  onSelectShape,
  onRemoveShape,
  isSnappingEnabled,
  tempMeasureShape,
  setTempMeasureShape,
  materials
}) => {
  const [image] = useImage(imageState?.url || '', 'anonymous');
  const stageRef = useRef<Konva.Stage>(null);
  const [currentPoints, setCurrentPoints] = useState<Point[]>([]);
  const [mousePos, setMousePos] = useState<Point | null>(null);
  const [snappedPos, setSnappedPos] = useState<Point | null>(null);
  
  // Reset current drawing when mode changes or tool changes
  useEffect(() => {
    setCurrentPoints([]);
    setMousePos(null);
    setSnappedPos(null);
    // Important: We also clear the ephemeral measurement result when changing tools
    if(tempMeasureShape) {
        setTempMeasureShape(null);
    }
  }, [mode, selectedMaterial]);

  // Handle Keys (ESC, DELETE, ENTER)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (currentPoints.length > 0) {
          setCurrentPoints([]);
          setSnappedPos(null);
        } else if (tempMeasureShape) {
          setTempMeasureShape(null);
        } else {
          onSelectShape(null);
        }
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedShapeId) {
        onRemoveShape(selectedShapeId);
      }
      if (e.key === 'Enter') {
         if (mode === ToolMode.DRAW && currentPoints.length > 0) {
             // Logic handling for generic finish...
             if (selectedMaterial.category !== 'measure') {
                if (selectedMaterial.type === 'linear' && currentPoints.length > 1) {
                    finishShape(false);
                } else if (selectedMaterial.type === 'area' && currentPoints.length > 2) {
                    finishShape(true);
                }
             } else {
                 // Manual enter finish for measure area
                 if (selectedMaterial.type === 'area' && currentPoints.length > 2) {
                     finishEphemeralShape(true);
                 }
             }
         }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedShapeId, currentPoints, mode, selectedMaterial, tempMeasureShape]);

  // Universal Snapping Logic
  const getNearestPoint = (pos: Point): Point | null => {
    let nearest: Point | null = null;
    let minDist = SNAP_THRESHOLD;

    // 1. Check start of current drawing (closing polygon)
    if (currentPoints.length > 0) {
        const startPoint = currentPoints[0];
        const dist = getDistance(pos, startPoint);
        if (dist < minDist) {
            minDist = dist;
            nearest = startPoint;
        }
    }

    // 2. Check all committed shapes
    shapes.forEach(shape => {
      if (shape.hidden) return; // Ignore hidden shapes for snapping
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
    const stage = e.target.getStage();
    if (!stage) return;
    
    // If clicking on empty space in SELECT mode, deselect
    if (mode === ToolMode.SELECT) {
       if (e.target instanceof Konva.Image) {
           onSelectShape(null);
       }
       return;
    }
    
    if (!imageState) return;

    const effectivePos = snappedPos || getPointerPos(stage);

    // --- LOGIC: EPHEMERAL MEASUREMENT (Transiente) ---
    if (mode === ToolMode.DRAW && selectedMaterial.category === 'measure') {
        
        // If there's already a result on screen, a new click clears it to start fresh
        if (tempMeasureShape) {
            setTempMeasureShape(null);
            setCurrentPoints([effectivePos]); // Start new immediately
            return;
        }

        // Linear Measure: 2 Points Rule
        if (selectedMaterial.type === 'linear') {
            if (currentPoints.length === 0) {
                // Point 1: Start
                setCurrentPoints([effectivePos]);
            } else {
                // Point 2: End (Finish immediately)
                const finalPoints = [currentPoints[0], effectivePos];
                finishEphemeralShape(false, finalPoints);
            }
            return;
        }

        // Area Measure: Polygon Logic
        if (selectedMaterial.type === 'area') {
             // Closing Logic
            if (currentPoints.length > 2) {
                const firstPoint = currentPoints[0];
                const dist = getDistance(effectivePos, firstPoint);
                if (dist < SNAP_THRESHOLD || (snappedPos && snappedPos.x === firstPoint.x && snappedPos.y === firstPoint.y)) {
                    finishEphemeralShape(true);
                    return;
                }
            }
            setCurrentPoints([...currentPoints, effectivePos]);
            return;
        }
    }

    // --- LOGIC: STANDARD TAKEOFF ---
    // POINT GEOMETRY
    if (mode === ToolMode.DRAW && selectedMaterial.type === 'point') {
        onShapeAdd({
            id: Date.now().toString(),
            materialId: selectedMaterial.id,
            points: [effectivePos],
            closed: true,
            geometryType: 'point'
        });
        return;
    }

    // LINEAR / AREA GEOMETRY (Standard)
    if (mode === ToolMode.DRAW || mode === ToolMode.CALIBRATE) {
        // Closing Logic for Areas
        if (selectedMaterial.type === 'area' && currentPoints.length > 2) {
            const firstPoint = currentPoints[0];
            const dist = getDistance(effectivePos, firstPoint);
            
            if (dist < SNAP_THRESHOLD || (snappedPos && snappedPos.x === firstPoint.x && snappedPos.y === firstPoint.y)) {
                finishShape(true);
                return;
            }
        }
        
        // Linear double click simulation
        if (selectedMaterial.type === 'linear' && currentPoints.length > 0) {
            const lastPoint = currentPoints[currentPoints.length - 1];
             if (getDistance(effectivePos, lastPoint) < 5) {
                 if (currentPoints.length > 1) finishShape(false);
                 return;
             }
        }

        // Calibration Logic
        if (mode === ToolMode.CALIBRATE && currentPoints.length === 1) {
            const newPoints = [...currentPoints, effectivePos];
            setCurrentPoints([]);
            const distPx = getDistance(newPoints[0], newPoints[1]);
            onCalibrationFinish(distPx);
            return;
        }

        setCurrentPoints([...currentPoints, effectivePos]);
    }
  };

  const getPointerPos = (stage: Konva.Stage) => {
    const transform = stage.getAbsoluteTransform().copy();
    transform.invert();
    return transform.point(stage.getPointerPosition() || { x: 0, y: 0 });
  };

  const handleMouseMove = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (mode === ToolMode.SELECT) return;
    const stage = e.target.getStage();
    if (!stage) return;
    
    const rawPos = getPointerPos(stage);
    const isCtrlPressed = e.evt.ctrlKey || e.evt.metaKey;
    const shouldSnap = isSnappingEnabled ? !isCtrlPressed : isCtrlPressed;

    let snap = null;
    if (shouldSnap) {
        snap = getNearestPoint(rawPos);
    }

    setMousePos(rawPos);
    setSnappedPos(snap);
  };

  const handleDoubleClick = (e: Konva.KonvaEventObject<MouseEvent>) => {
      e.cancelBubble = true; 
      
      // Standard Finish (not measure)
      if (mode === ToolMode.DRAW && selectedMaterial.category !== 'measure' && selectedMaterial.type === 'linear' && currentPoints.length > 1) {
          finishShape(false);
      }
  };

  const finishShape = (closed: boolean) => {
    const newShape: Shape = {
      id: Date.now().toString(),
      materialId: selectedMaterial.id,
      points: [...currentPoints],
      closed: closed,
      geometryType: selectedMaterial.type
    };
    onShapeAdd(newShape);
    setCurrentPoints([]);
    setSnappedPos(null);
  };

  const finishEphemeralShape = (closed: boolean, specificPoints?: Point[]) => {
      const pts = specificPoints || [...currentPoints];
      const newShape: Shape = {
          id: 'temp-measure',
          materialId: selectedMaterial.id,
          points: pts,
          closed: closed,
          geometryType: selectedMaterial.type
      };
      setTempMeasureShape(newShape);
      setCurrentPoints([]);
      setSnappedPos(null);
  }

  const getStrokeWidth = (material?: Material) => {
      const zoom = stageRef.current?.scaleX() || 1;
      const basePx = 2 / zoom; 

      if (!scale || !material || !material.width) return Math.max(basePx, 4 / zoom);
      return Math.max(basePx, material.width * scale);
  };
  
  const getShapeCenter = (shape: Shape): Point => {
      if (shape.geometryType === 'point') return shape.points[0];
      if (shape.geometryType === 'linear') {
          // Midpoint of the total line is hard, let's just use midpoint of first and last for simplicity or midpoint of segment
          const p1 = shape.points[0];
          const p2 = shape.points[shape.points.length - 1];
          return { x: (p1.x + p2.x)/2, y: (p1.y + p2.y)/2 };
      }
      
      let sx = 0, sy = 0;
      shape.points.forEach(p => { sx += p.x; sy += p.y; });
      return { x: sx / shape.points.length, y: sy / shape.points.length };
  };

  // --- RENDERING ---

  const renderCurrentShape = () => {
    if (currentPoints.length === 0) return null;
    const endPoint = snappedPos || mousePos;
    if (!endPoint) return null;

    const pointsToDraw = [...currentPoints, endPoint];
    const flatPoints = pointsToDraw.flatMap(p => [p.x, p.y]);
    
    const isClosing = selectedMaterial.type === 'area' && snappedPos && currentPoints.length > 2 && snappedPos === currentPoints[0];
    const strokeWidth = getStrokeWidth(selectedMaterial);
    const zoom = stageRef.current?.scaleX() || 1;
    
    // Different visual style for Measurement tool
    const isMeasureTool = selectedMaterial.category === 'measure';
    const strokeColor = isMeasureTool ? '#ec4899' : selectedMaterial.color;

    return (
      <Group>
        <Line
          points={flatPoints}
          stroke={mode === ToolMode.CALIBRATE ? '#f59e0b' : strokeColor}
          strokeWidth={strokeWidth}
          opacity={selectedMaterial.type === 'area' ? 0.7 : 1}
          dash={mode === ToolMode.CALIBRATE || isMeasureTool ? [10, 5] : []}
          closed={false}
          lineCap="round"
          lineJoin="round"
        />
        {pointsToDraw.map((p, i) => (
          <Circle
            key={i}
            x={p.x}
            y={p.y}
            radius={3 / zoom}
            fill="white"
            stroke="black"
            strokeWidth={1 / zoom}
          />
        ))}
        {endPoint && (
            <Group x={endPoint.x + 10 / zoom} y={endPoint.y + 10 / zoom}>
                <Rect 
                    fill="rgba(0,0,0,0.8)" 
                    cornerRadius={4 / zoom}
                    width={isClosing ? 60 / zoom : 90 / zoom}
                    height={24 / zoom}
                    offsetY={-5}
                />
                <Text 
                    text={isClosing ? "FECHAR" : selectedMaterial.type === 'linear' && isMeasureTool ? "Clique Final" : "..."}
                    fontSize={10 / zoom}
                    fill="white"
                    padding={4 / zoom}
                    align="center"
                    width={isClosing ? 60 / zoom : 90 / zoom}
                />
            </Group>
        )}
      </Group>
    );
  };

  const renderTempMeasureResult = () => {
      if (!tempMeasureShape || !scale) return null;
      
      const zoom = stageRef.current?.scaleX() || 1;
      const center = getShapeCenter(tempMeasureShape);
      
      let resultText = '';
      if (tempMeasureShape.geometryType === 'linear') {
          const len = getPolylineLength(tempMeasureShape.points) / scale;
          resultText = formatMeters(len);
      } else {
          const area = getPolygonArea(tempMeasureShape.points) / (scale * scale);
          resultText = formatSquareMeters(area);
      }

      // Calculate label box size roughly
      const textWidth = resultText.length * 9;
      
      return (
          <Group>
              {/* The Shape itself */}
              <Line 
                  points={tempMeasureShape.points.flatMap(p => [p.x, p.y])}
                  stroke="#ec4899"
                  strokeWidth={4 / zoom}
                  dash={[10, 5]}
                  closed={tempMeasureShape.closed}
                  fill={tempMeasureShape.geometryType === 'area' ? 'rgba(236, 72, 153, 0.2)' : undefined}
              />
               {/* Endpoints */}
               {tempMeasureShape.points.map((p, i) => (
                   <Circle key={i} x={p.x} y={p.y} radius={4/zoom} fill="#ec4899" stroke="white" strokeWidth={2/zoom} />
               ))}

              {/* The Floating Label */}
              <Group x={center.x} y={center.y}>
                   <Rect 
                       x={-(textWidth/zoom + 20/zoom)/2}
                       y={-(30/zoom)/2}
                       width={textWidth/zoom + 30/zoom}
                       height={30/zoom}
                       fill="#ec4899"
                       cornerRadius={8/zoom}
                       shadowColor="black"
                       shadowBlur={10}
                       shadowOpacity={0.4}
                       shadowOffsetY={5}
                   />
                   <Text 
                       text={resultText}
                       fontSize={14 / zoom}
                       fontStyle="bold"
                       fill="white"
                       align="center"
                       verticalAlign="middle"
                       x={-(textWidth/zoom + 20/zoom)/2}
                       y={-(30/zoom)/2}
                       width={textWidth/zoom + 30/zoom}
                       height={30/zoom}
                   />
              </Group>
          </Group>
      )
  }

  const renderSnapIndicator = () => {
    if (!snappedPos) return null;
    const zoom = stageRef.current?.scaleX() || 1;
    const r = 8 / zoom;
    return (
        <Group>
            <Circle 
                x={snappedPos.x} 
                y={snappedPos.y} 
                radius={r} 
                stroke="#22c55e" 
                strokeWidth={2 / zoom} 
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

  const renderDeleteButton = (shape: Shape, matProps: any, zoom: number) => {
      const center = getShapeCenter(shape);
      const btnSize = 16 / zoom;
      const offset = 15 / zoom;
      
      return (
          <Group 
            x={center.x + offset} 
            y={center.y - offset}
            onClick={(e) => {
                e.cancelBubble = true;
                onRemoveShape(shape.id);
            }}
            onTap={(e) => {
                e.cancelBubble = true;
                onRemoveShape(shape.id);
            }}
            onMouseEnter={(e) => {
                const container = e.target.getStage()?.container();
                if(container) container.style.cursor = 'pointer';
            }}
            onMouseLeave={(e) => {
                const container = e.target.getStage()?.container();
                if(container) container.style.cursor = 'default';
            }}
          >
              <Circle 
                radius={btnSize / 1.5}
                fill="#ef4444"
                stroke="white"
                strokeWidth={2/zoom}
                shadowColor="black"
                shadowBlur={4}
                shadowOpacity={0.3}
              />
               <Path
                  data="M -3 -3 L 3 3 M 3 -3 L -3 3"
                  x={0}
                  y={0}
                  stroke="white"
                  strokeWidth={2/zoom}
                  lineCap="round"
               />
          </Group>
      )
  }

  const [size, setSize] = useState({ width: 0, height: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const checkSize = () => {
      if (containerRef.current) {
        setSize({ width: containerRef.current.offsetWidth, height: containerRef.current.offsetHeight });
      }
    };
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
          draggable={mode === ToolMode.SELECT}
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
            {image && <KonvaImage image={image} name="bg-image" />}
          </Layer>
          <Layer>
            {shapes.map((shape) => {
               if (shape.hidden) return null;
               
               // Resolve dynamic properties from the material list instead of hardcoding
               const material = materials.find(m => m.id === shape.materialId);
               const matWidth = material?.width || 0.05;
               const matColor = material?.color || '#000000';
               const matOpacity = material?.opacity;

               const zoom = stageRef.current?.scaleX() || 1;
               const strokeWidth = Math.max(2 / zoom, (matWidth * (scale || 1)));
               const isSelected = selectedShapeId === shape.id;

               return (
                <Group 
                    key={shape.id}
                    onClick={(e) => {
                        if(mode === ToolMode.SELECT) {
                            e.cancelBubble = true;
                            onSelectShape(shape.id);
                        }
                    }}
                    onTap={(e) => {
                         if(mode === ToolMode.SELECT) {
                            e.cancelBubble = true;
                            onSelectShape(shape.id);
                        }
                    }}
                    onMouseEnter={(e) => {
                        if(mode === ToolMode.SELECT) {
                            const container = e.target.getStage()?.container();
                            if(container) container.style.cursor = 'pointer';
                        }
                    }}
                    onMouseLeave={(e) => {
                        const container = e.target.getStage()?.container();
                        if(container) container.style.cursor = mode === ToolMode.SELECT ? 'default' : 'crosshair';
                    }}
                >
                   {isSelected && shape.geometryType !== 'point' && (
                       <Line 
                            points={shape.points.flatMap(p => [p.x, p.y])}
                            stroke="#06b6d4" 
                            strokeWidth={strokeWidth + (4 / zoom)}
                            opacity={0.5}
                            closed={shape.geometryType === 'area'}
                            lineJoin="round"
                       />
                   )}

                   {shape.geometryType === 'point' ? (
                       <Group>
                           {shape.materialId === 'struct-pile' ? (
                                <Circle 
                                    x={shape.points[0].x}
                                    y={shape.points[0].y}
                                    radius={Math.max(10/zoom, (0.25 * (scale||1))) / 2} 
                                    fill={matColor}
                                    stroke={isSelected ? "#06b6d4" : "black"}
                                    strokeWidth={(isSelected ? 2 : 1) / zoom}
                                />
                           ) : shape.materialId === 'struct-footing' ? (
                               <Rect 
                                    x={shape.points[0].x - (Math.max(20/zoom, 0.60 * (scale||1)))/2}
                                    y={shape.points[0].y - (Math.max(20/zoom, 0.60 * (scale||1)))/2}
                                    width={Math.max(20/zoom, 0.60 * (scale||1))}
                                    height={Math.max(20/zoom, 0.60 * (scale||1))}
                                    fill={matColor}
                                    stroke={isSelected ? "#06b6d4" : "black"}
                                    strokeWidth={(isSelected ? 2 : 1) / zoom}
                               />
                           ) : (
                               <Rect 
                                    x={shape.points[0].x - (Math.max(10/zoom, (matWidth) * (scale||1)))/2}
                                    y={shape.points[0].y - (Math.max(10/zoom, (matWidth) * (scale||1)))/2}
                                    width={Math.max(10/zoom, (matWidth) * (scale||1))}
                                    height={Math.max(10/zoom, (matWidth) * (scale||1))}
                                    fill={matColor}
                                    stroke={isSelected ? "#06b6d4" : "black"}
                                    strokeWidth={(isSelected ? 2 : 1) / zoom}
                               />
                           )}
                       </Group>
                   ) : shape.geometryType === 'area' ? (
                       <Line
                        points={shape.points.flatMap(p => [p.x, p.y])}
                        fill={matOpacity ? `${matColor}${Math.floor(matOpacity * 255).toString(16).padStart(2,'0')}` : `${matColor}40`}
                        stroke={matColor}
                        strokeWidth={2 / zoom}
                        closed={true}
                       />
                   ) : (
                       <Line
                        points={shape.points.flatMap(p => [p.x, p.y])}
                        stroke={matColor}
                        strokeWidth={strokeWidth}
                        lineCap="butt"
                        lineJoin="miter"
                        closed={false}
                       />
                   )}

                   {scale && shape.geometryType === 'linear' && shape.points.slice(0, -1).map((p, i) => {
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
                                fontSize={10 / zoom}
                                fill="black"
                                stroke="white"
                                strokeWidth={2 / zoom}
                            />
                        )
                    })}
                    
                    {isSelected && mode === ToolMode.SELECT && renderDeleteButton(shape, {}, zoom)}
                </Group>
               )
            })}
            
            {renderCurrentShape()}
            {renderTempMeasureResult()}
            {renderSnapIndicator()}
          </Layer>
        </Stage>
      )}
      
      {/* HUD Info */}
      {mode !== ToolMode.SELECT && imageState && (
        <div className="absolute top-4 right-4 bg-white shadow-lg border-l-4 border-blue-500 px-4 py-3 rounded-md text-sm pointer-events-none text-gray-700 animate-in fade-in slide-in-from-top-2 z-20">
           {mode === ToolMode.CALIBRATE && <span className="font-bold">Modo Calibração</span>}
           {mode === ToolMode.DRAW && (
               <div>
                   <span className="font-bold block text-gray-900">{selectedMaterial.name}</span>
                   {selectedMaterial.category === 'measure' ? (
                       <span className="text-xs text-gray-500">
                           {selectedMaterial.type === 'linear' 
                             ? 'Clique em dois pontos para medir.' 
                             : 'Feche a forma para calcular a área.'}
                       </span>
                   ) : (
                        <span className="text-xs text-gray-500">
                            {selectedMaterial.type === 'point' ? 'Clique para posicionar' : 'Enter ou Duplo Clique p/ finalizar.'}
                        </span>
                   )}
               </div>
           )}
        </div>
      )}
    </div>
  );
};