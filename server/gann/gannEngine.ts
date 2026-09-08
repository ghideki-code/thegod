import type { Candle } from '../../src/types.js';
import type { MarketStructureSnapshot } from '../structure/marketStructure.js';

export interface GannLevel {
  ratio: number;
  price: number;
  relation: 'support' | 'resistance';
}

export interface GannTimingWindow {
  bars: number;
  targetTimestamp: number;
}

export interface GannAnalysis {
  anchorLow: number | null;
  anchorHigh: number | null;
  range: number | null;
  levels: GannLevel[];
  timingWindows: GannTimingWindow[];
  bias: 'bullish' | 'bearish' | 'neutral';
  score: number;
  reasons: string[];
}

const RATIOS = [0.25, 0.382, 0.5, 0.618, 0.75, 1, 1.272, 1.618];
const TIMING_BARS = [9, 18, 27, 36, 45];

export function analyzeGann(candles: Candle[], structure: MarketStructureSnapshot): GannAnalysis {
  const swings = structure.swings;
  if (candles.length < 20 || swings.length < 2) {
    return { anchorLow: null, anchorHigh: null, range: null, levels: [], timingWindows: [], bias: 'neutral', score: 0, reasons: ['Dados insuficientes para análise Gann'] };
  }

  const highs = swings.filter(s => s.type === 'high');
  const lows = swings.filter(s => s.type === 'low');
  const anchorHigh = highs.length ? highs[highs.length - 1].price : Math.max(...candles.map(c => c.high));
  const anchorLow = lows.length ? lows[lows.length - 1].price : Math.min(...candles.map(c => c.low));
  const low = Math.min(anchorLow, anchorHigh);
  const high = Math.max(anchorLow, anchorHigh);
  const range = high - low;
  const price = candles[candles.length - 1].close;

  const levels = RATIOS.map(ratio => {
    const level = low + range * ratio;
    return { ratio, price: level, relation: level <= price ? 'support' : 'resistance' as 'support' | 'resistance' };
  });

  const interval = candles.length > 1 ? candles[candles.length - 1].timestamp - candles[candles.length - 2].timestamp : 0;
  const timingWindows = interval > 0 ? TIMING_BARS.map(bars => ({ bars, targetTimestamp: candles[candles.length - 1].timestamp + interval * bars })) : [];

  const midpoint = low + range * 0.5;
  let score = 0;
  const reasons: string[] = [];
  if (price > midpoint) { score += 1; reasons.push('Preço acima de 50% do range âncora'); }
  else if (price < midpoint) { score -= 1; reasons.push('Preço abaixo de 50% do range âncora'); }
  if (structure.trend === 'bullish') { score += 1; reasons.push('Estrutura confirma viés bullish'); }
  if (structure.trend === 'bearish') { score -= 1; reasons.push('Estrutura confirma viés bearish'); }

  return { anchorLow: low, anchorHigh: high, range, levels, timingWindows, bias: score > 0 ? 'bullish' : score < 0 ? 'bearish' : 'neutral', score, reasons };
}
