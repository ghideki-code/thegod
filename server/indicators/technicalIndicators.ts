import type { Candle } from '../../src/types.js';

export interface IndicatorSnapshot {
  ema9: number;
  ema21: number;
  ema50: number;
  ema200: number;
  rsi14: number;
  atr14: number;
  bollinger: {
    middle: number;
    upper: number;
    lower: number;
    widthPercent: number;
  };
  volumeSma20: number;
  relativeVolume20: number;
  momentumPercent: number;
}

function closes(candles: Candle[]): number[] {
  return candles.map(c => c.close).filter(Number.isFinite);
}

export function ema(values: number[], period: number): number {
  if (values.length === 0) return 0;
  const seed = values.slice(0, Math.min(period, values.length)).reduce((a, b) => a + b, 0) / Math.min(period, values.length);
  if (values.length <= period) return seed;
  const multiplier = 2 / (period + 1);
  let result = seed;
  for (let i = period; i < values.length; i++) result = (values[i] - result) * multiplier + result;
  return result;
}

export function rsi(values: number[], period = 14): number {
  if (values.length <= period) return 50;
  let gains = 0;
  let losses = 0;
  for (let i = 1; i <= period; i++) {
    const change = values[i] - values[i - 1];
    if (change >= 0) gains += change; else losses -= change;
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  for (let i = period + 1; i < values.length; i++) {
    const change = values[i] - values[i - 1];
    avgGain = (avgGain * (period - 1) + Math.max(change, 0)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(-change, 0)) / period;
  }
  if (avgLoss === 0) return 100;
  if (avgGain === 0) return 0;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

export function atr(candles: Candle[], period = 14): number {
  if (candles.length < 2) return 0;
  const ranges: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const c = candles[i];
    const prev = candles[i - 1].close;
    ranges.push(Math.max(c.high - c.low, Math.abs(c.high - prev), Math.abs(c.low - prev)));
  }
  const window = ranges.slice(-period);
  return window.length ? window.reduce((a, b) => a + b, 0) / window.length : 0;
}

export function bollinger(values: number[], period = 20, deviations = 2) {
  const window = values.slice(-period);
  if (!window.length) return { middle: 0, upper: 0, lower: 0, widthPercent: 0 };
  const middle = window.reduce((a, b) => a + b, 0) / window.length;
  const variance = window.reduce((sum, value) => sum + (value - middle) ** 2, 0) / window.length;
  const std = Math.sqrt(variance);
  const upper = middle + deviations * std;
  const lower = middle - deviations * std;
  return { middle, upper, lower, widthPercent: middle ? ((upper - lower) / middle) * 100 : 0 };
}

export function volumeSma(candles: Candle[], period = 20): number {
  const values = candles.slice(-period).map(c => c.volume).filter(Number.isFinite);
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
}

export function calculateIndicators(candles: Candle[]): IndicatorSnapshot {
  const values = closes(candles);
  const latest = values.at(-1) ?? 0;
  const previous = values.at(-2) ?? latest;
  const volumeAverage = volumeSma(candles, 20);
  const latestVolume = candles.at(-1)?.volume ?? 0;

  return {
    ema9: ema(values, 9),
    ema21: ema(values, 21),
    ema50: ema(values, 50),
    ema200: ema(values, 200),
    rsi14: rsi(values, 14),
    atr14: atr(candles, 14),
    bollinger: bollinger(values, 20, 2),
    volumeSma20: volumeAverage,
    relativeVolume20: volumeAverage > 0 ? latestVolume / volumeAverage : 0,
    momentumPercent: previous !== 0 ? ((latest - previous) / previous) * 100 : 0,
  };
}
