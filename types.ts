export interface Point {
  x: number;
  y: number;
}

export enum ToolMode {
  SELECT = 'SELECT',
  CALIBRATE = 'CALIBRATE',
  DRAW = 'DRAW',
}

export type GeometryType = 'linear' | 'area' | 'point';

export type MaterialCategory = 'wall' | 'floor' | 'structure' | 'finish' | 'roof' | 'measure';

export interface Material {
  id: string;
  name: string;
  category: MaterialCategory;
  type: GeometryType;
  width?: number; // Width in meters (for walls/beams)
  color: string;
  opacity?: number;
  height?: number; // Optional default height in meters
}

export interface Shape {
  id: string;
  materialId: string; // Reference to the material used
  points: Point[];
  closed: boolean;
  geometryType: GeometryType;
  hidden?: boolean;
}

export interface Sheet {
  id: string;
  name: string;
  shapes: Shape[];
}

export interface ImageState {
  url: string;
  width: number;
  height: number;
}

export interface CalibrationState {
  pixelsPerMeter: number | null;
  referenceLineId: string | null;
}