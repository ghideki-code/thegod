import type { Candle } from '../../src/types.js';

export type SwingType = 'high' | 'low';

export interface SwingPoint {
  index: number;
  timestamp: number;
  price: number;
  type: SwingType;
  strength: number;
}

export interface SwingDetectionOptions {
  leftBars?: number;
  rightBars?: number;
  minStrength?: number;
}

export function detectSwings(
  candles: Candle[],
  options: SwingDetectionOptions = {},
): SwingPoint[] {
  const leftBars = Math.max(1, options.leftBars ?? 3);
  const rightBars = Math.max(1, options.rightBars ?? 3);
  const minStrength = Math.max(0, options.minStrength ?? 0);
  const swings: SwingPoint[] = [];

  if (candles.length < leftBars + rightBars + 1) return swings;

  for (let i = leftBars; i < candles.length - rightBars; i += 1) {
    const candle = candles[i];
    let isHigh = true;
    let isLow = true;
    let highStrength = 0;
    let lowStrength = 0;

    for (let j = i - leftBars; j <= i + rightBars; j += 1) {
      if (j === i) continue;
      if (candles[j].high > candle.high) isHigh = false;
      if (candles[j].low < candle.low) isLow = false;
    }

    if (isHigh) {
      for (let j = i - leftBars; j <= i + rightBars; j += 1) {
        if (j !== i) highStrength += Math.max(0, candle.high - candles[j].high);
      }
      if (highStrength >= minStrength) {
        swings.push({ index: i, timestamp: candle.timestamp, price: candle.high, type: 'high', strength: highStrength });
      }
    }

    if (isLow) {
      for (let j = i - leftBars; j <= i + rightBars; j += 1) {
        if (j !== i) lowStrength += Math.max(0, candles[j].low - candle.low);
      }
      if (lowStrength >= minStrength) {
        swings.push({ index: i, timestamp: candle.timestamp, price: candle.low, type: 'low', strength: lowStrength });
      }
    }
  }

  return swings;
}
