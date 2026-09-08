import type { Candle } from '../../src/types.js';
import type { IndicatorSnapshot } from '../indicators/technicalIndicators.js';

export type DivergenceType = 'bullish-regular' | 'bearish-regular' | 'bullish-hidden' | 'bearish-hidden';

export interface DivergenceSignal {
  type: DivergenceType;
  firstIndex: number;
  secondIndex: number;
  firstTimestamp: number;
  secondTimestamp: number;
  priceFirst: number;
  priceSecond: number;
  rsiFirst: number;
  rsiSecond: number;
  strength: number;
  invalidation: number;
}

export interface DivergenceAnalysis {
  bullish: DivergenceSignal[];
  bearish: DivergenceSignal[];
  latest: DivergenceSignal | null;
}

interface Pivot { index: number; price: number; oscillator: number; timestamp: number; }

function localLow(values: number[], i: number, radius = 3): boolean {
  if (i < radius || i >= values.length - radius) return false;
  for (let j = 1; j <= radius; j++) if (values[i] >= values[i - j] || values[i] > values[i + j]) return false;
  return true;
}

function localHigh(values: number[], i: number, radius = 3): boolean {
  if (i < radius || i >= values.length - radius) return false;
  for (let j = 1; j <= radius; j++) if (values[i] <= values[i - j] || values[i] < values[i + j]) return false;
  return true;
}

function oscillatorSeries(candles: Candle[], fallback: number): number[] {
  const closes = candles.map(c => c.close);
  const result = closes.map(() => fallback);
  let gains = 0;
  let losses = 0;
  for (let i = 1; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1];
    gains = (gains * 13 + Math.max(change, 0)) / 14;
    losses = (losses * 13 + Math.max(-change, 0)) / 14;
    result[i] = losses === 0 ? 100 : 100 - (100 / (1 + gains / losses));
  }
  return result;
}

function buildPivots(candles: Candle[], rsi: number[], kind: 'low' | 'high'): Pivot[] {
  const values = candles.map(c => kind === 'low' ? c.low : c.high);
  const pivots: Pivot[] = [];
  for (let i = 3; i < candles.length - 3; i++) {
    const pivot = kind === 'low' ? localLow(values, i) : localHigh(values, i);
    if (pivot) pivots.push({ index: i, price: values[i], oscillator: rsi[i], timestamp: candles[i].timestamp });
  }
  return pivots;
}

export function detectDivergences(candles: Candle[], indicators?: IndicatorSnapshot): DivergenceAnalysis {
  if (candles.length < 30) return { bullish: [], bearish: [], latest: null };
  const fallbackRsi = indicators?.rsi14 ?? 50;
  const rsi = oscillatorSeries(candles, fallbackRsi);
  const lows = buildPivots(candles, rsi, 'low');
  const highs = buildPivots(candles, rsi, 'high');
  const bullish: DivergenceSignal[] = [];
  const bearish: DivergenceSignal[] = [];

  for (let i = 1; i < lows.length; i++) {
    const a = lows[i - 1], b = lows[i];
    const priceDelta = (b.price - a.price) / a.price;
    const rsiDelta = b.oscillator - a.oscillator;
    const regular = priceDelta < -0.001 && rsiDelta > 2;
    const hidden = priceDelta > 0.001 && rsiDelta < -2;
    if (regular || hidden) {
      const strength = Math.min(100, Math.round(Math.abs(priceDelta) * 2500 + Math.abs(rsiDelta) * 4));
      bullish.push({ type: regular ? 'bullish-regular' : 'bullish-hidden', firstIndex: a.index, secondIndex: b.index, firstTimestamp: a.timestamp, secondTimestamp: b.timestamp, priceFirst: a.price, priceSecond: b.price, rsiFirst: a.oscillator, rsiSecond: b.oscillator, strength, invalidation: b.price });
    }
  }

  for (let i = 1; i < highs.length; i++) {
    const a = highs[i - 1], b = highs[i];
    const priceDelta = (b.price - a.price) / a.price;
    const rsiDelta = b.oscillator - a.oscillator;
    const regular = priceDelta > 0.001 && rsiDelta < -2;
    const hidden = priceDelta < -0.001 && rsiDelta > 2;
    if (regular || hidden) {
      const strength = Math.min(100, Math.round(Math.abs(priceDelta) * 2500 + Math.abs(rsiDelta) * 4));
      bearish.push({ type: regular ? 'bearish-regular' : 'bearish-hidden', firstIndex: a.index, secondIndex: b.index, firstTimestamp: a.timestamp, secondTimestamp: b.timestamp, priceFirst: a.price, priceSecond: b.price, rsiFirst: a.oscillator, rsiSecond: b.oscillator, strength, invalidation: b.price });
    }
  }

  const all = [...bullish, ...bearish].sort((a, b) => b.secondTimestamp - a.secondTimestamp);
  return { bullish, bearish, latest: all[0] ?? null };
}
