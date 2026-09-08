import type { Candle } from '../../src/types.js';
import { detectSwings, type SwingPoint } from './swingDetection.js';

export type StructureTrend = 'bullish' | 'bearish' | 'neutral';
export type StructureEventType = 'BOS' | 'CHoCH';
export type SweepType = 'high' | 'low';

export interface StructureEvent {
  type: StructureEventType;
  direction: 'bullish' | 'bearish';
  index: number;
  timestamp: number;
  level: number;
  swingIndex: number;
}

export interface LiquiditySweep {
  type: SweepType;
  index: number;
  timestamp: number;
  level: number;
  wickExtreme: number;
  close: number;
  swingIndex: number;
}

export interface EqualLevel {
  type: SweepType;
  price: number;
  swingIndices: number[];
  tolerance: number;
}

export interface MarketStructureSnapshot {
  trend: StructureTrend;
  swings: SwingPoint[];
  events: StructureEvent[];
  sweeps: LiquiditySweep[];
  equalLevels: EqualLevel[];
  latestEvent: StructureEvent | null;
  latestSweep: LiquiditySweep | null;
}

function inferTrend(events: StructureEvent[]): StructureTrend {
  return events.at(-1)?.direction ?? 'neutral';
}

function detectStructureEvents(candles: Candle[], swings: SwingPoint[]): StructureEvent[] {
  const events: StructureEvent[] = [];
  let trend: StructureTrend = 'neutral';
  const broken = new Set<number>();
  let highCursor = 0;
  let lowCursor = 0;

  for (let i = 0; i < candles.length; i += 1) {
    while (highCursor < swings.length && swings[highCursor].index < i) highCursor += 1;
    while (lowCursor < swings.length && swings[lowCursor].index < i) lowCursor += 1;

    const priorHighs = swings.slice(0, highCursor).filter(s => s.type === 'high' && !broken.has(s.index));
    const priorLows = swings.slice(0, lowCursor).filter(s => s.type === 'low' && !broken.has(s.index));
    const high = priorHighs.at(-1);
    const low = priorLows.at(-1);
    const candle = candles[i];

    if (high && candle.close > high.price) {
      const direction = 'bullish' as const;
      events.push({ type: trend === 'bearish' ? 'CHoCH' : 'BOS', direction, index: i, timestamp: candle.timestamp, level: high.price, swingIndex: high.index });
      trend = direction;
      broken.add(high.index);
    } else if (low && candle.close < low.price) {
      const direction = 'bearish' as const;
      events.push({ type: trend === 'bullish' ? 'CHoCH' : 'BOS', direction, index: i, timestamp: candle.timestamp, level: low.price, swingIndex: low.index });
      trend = direction;
      broken.add(low.index);
    }
  }
  return events;
}

function detectSweeps(candles: Candle[], swings: SwingPoint[], lookback = 80): LiquiditySweep[] {
  const sweeps: LiquiditySweep[] = [];
  for (let i = 0; i < candles.length; i += 1) {
    const candle = candles[i];
    const high = [...swings].reverse().find(s => s.type === 'high' && s.index < i && i - s.index <= lookback);
    const low = [...swings].reverse().find(s => s.type === 'low' && s.index < i && i - s.index <= lookback);

    if (high && candle.high > high.price && candle.close < high.price) {
      sweeps.push({ type: 'high', index: i, timestamp: candle.timestamp, level: high.price, wickExtreme: candle.high, close: candle.close, swingIndex: high.index });
    }
    if (low && candle.low < low.price && candle.close > low.price) {
      sweeps.push({ type: 'low', index: i, timestamp: candle.timestamp, level: low.price, wickExtreme: candle.low, close: candle.close, swingIndex: low.index });
    }
  }
  return sweeps;
}

function detectEqualLevels(swings: SwingPoint[], tolerancePercent = 0.0015): EqualLevel[] {
  const result: EqualLevel[] = [];
  for (let i = 0; i < swings.length; i += 1) {
    const base = swings[i];
    const matches = swings.slice(i + 1).filter(s => s.type === base.type && Math.abs(s.price - base.price) / base.price <= tolerancePercent);
    if (!matches.length) continue;
    const all = [base, ...matches];
    const price = all.reduce((sum, s) => sum + s.price, 0) / all.length;
    const swingIndices = all.map(s => s.index);
    if (!result.some(level => level.type === base.type && level.swingIndices.some(idx => swingIndices.includes(idx)))) {
      result.push({ type: base.type, price, swingIndices, tolerance: price * tolerancePercent });
    }
  }
  return result;
}

export function analyzeMarketStructure(candles: Candle[]): MarketStructureSnapshot {
  const swings = detectSwings(candles, { leftBars: 3, rightBars: 3 });
  const events = detectStructureEvents(candles, swings);
  const sweeps = detectSweeps(candles, swings);
  const equalLevels = detectEqualLevels(swings);
  return {
    trend: inferTrend(events),
    swings,
    events,
    sweeps,
    equalLevels,
    latestEvent: events.at(-1) ?? null,
    latestSweep: sweeps.at(-1) ?? null,
  };
}
