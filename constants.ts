
import type { Defect } from './types';

export const DEFECT_COLORS: Record<Defect['type'], { border: string; bg: string; text: string }> = {
  'Pothole': {
    border: 'border-orange-500',
    bg: 'bg-orange-500/20',
    text: 'text-orange-400'
  },
  'Rutting': {
    border: 'border-green-500',
    bg: 'bg-green-500/20',
    text: 'text-green-400'
  },
  'Alligator Crack': {
    border: 'border-blue-500',
    bg: 'bg-blue-500/20',
    text: 'text-blue-400'
  },
  'Longitudinal Crack': {
    border: 'border-orange-500',
    bg: 'bg-orange-500/20',
    text: 'text-orange-400'
  },
  'Transverse Crack': {
    border: 'border-teal-500',
    bg: 'bg-teal-500/20',
    text: 'text-teal-400'
  },
  'Block Crack': {
    border: 'border-purple-500',
    bg: 'bg-purple-500/20',
    text: 'text-purple-400'
  },
  'Roughness': {
    border: 'border-yellow-500',
    bg: 'bg-yellow-500/20',
    text: 'text-yellow-400'
  },
  'Distress': {
    border: 'border-indigo-500',
    bg: 'bg-indigo-500/20',
    text: 'text-indigo-400'
  }
};

export const SEGMENT_COLORS: Record<string, { border: string; bg: string; text: string }> = {
    ...DEFECT_COLORS,
};

export const DEFECT_TYPES = Object.keys(DEFECT_COLORS) as (keyof typeof DEFECT_COLORS)[];
