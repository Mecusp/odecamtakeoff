export interface Point {
  x: number;
  y: number;
}

export enum ToolType {
  SELECT = 'SELECT',
  CALIBRATE = 'CALIBRATE',
  WALL = 'WALL',
  AREA = 'AREA',
}

export interface Shape {
  id: string;
  type: ToolType;
  points: Point[];
  color: string;
  closed: boolean;
  name?: string;
  value?: number; // Pre-calculated value (pixels)
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