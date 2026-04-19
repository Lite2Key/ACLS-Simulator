import type { SimMode } from '../types/case';

export interface ModeConfig {
  mode: SimMode;
  timingMultiplier: number;
  hintIntervalSeconds: number;
  maxAutoHints: number;
}

const MODE_CONFIGS: Record<SimMode, ModeConfig> = {
  guided: {
    mode: 'guided',
    timingMultiplier: 0.8,
    hintIntervalSeconds: 45,
    maxAutoHints: 6,
  },
  realistic: {
    mode: 'realistic',
    timingMultiplier: 1,
    hintIntervalSeconds: 70,
    maxAutoHints: 4,
  },
  instructor: {
    mode: 'instructor',
    timingMultiplier: 1.15,
    hintIntervalSeconds: 95,
    maxAutoHints: 2,
  },
};

export function getModeConfig(mode: SimMode): ModeConfig {
  return MODE_CONFIGS[mode];
}