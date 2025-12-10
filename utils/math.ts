import { Point } from '../types';

export const getDistance = (p1: Point, p2: Point): number => {
  return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
};

export const getPolylineLength = (points: Point[]): number => {
  let length = 0;
  for (let i = 0; i < points.length - 1; i++) {
    length += getDistance(points[i], points[i + 1]);
  }
  return length;
};

// Shoelace formula for polygon area
export const getPolygonArea = (points: Point[]): number => {
  if (points.length < 3) return 0;
  let area = 0;
  const n = points.length;
  
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += points[i].x * points[j].y;
    area -= points[j].x * points[i].y;
  }
  
  return Math.abs(area) / 2;
};

export const formatMeters = (value: number): string => {
  return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' m';
};

export const formatSquareMeters = (value: number): string => {
  return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' m²';
};