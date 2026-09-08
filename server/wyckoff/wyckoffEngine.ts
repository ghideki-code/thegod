import type { Candle } from '../../src/types.js';
import type { IndicatorSnapshot } from '../indicators/technicalIndicators.js';
import type { MarketStructureSnapshot } from '../structure/marketStructure.js';

export type WyckoffPhase =
  | 'accumulation'
  | 'markup'
  | 'distribution'
  | 'markdown'
  | 'neutral';

export type WyckoffEvent = 'SPRING' | 'TEST' | 'SOS' | 'UTAD' | 'SOW';

export interface WyckoffAnalysis {
  phase: WyckoffPhase;
  bias: 'bullish' | 'bearish' | 'neutral';
  score: number;
  volumeRatio: number;
  effortVsResult: 'absorption' | 'low-effort' | 'climax' | 'balanced';
  events: WyckoffEvent[];
  latestEvent: WyckoffEvent | null;
  rangeHigh: number | null;
  rangeLow: number | null;
  reasons: string[];
}

function average(values: number[]): number {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function body(candle: Candle): number {
  return Math.abs(candle.close - candle.open);
}

function range(candle: Candle): number {
  return Math.max(candle.high - candle.low, 0);
}

function detectEvents(candles: Candle[], rangeLow: number, rangeHigh: number, volumeAverage: number): WyckoffEvent[] {
  const events: WyckoffEvent[] = [];
  const start = Math.max(2, candles.length - 80);
  for (let i = start; i < candles.length; i += 1) {
    const c = candles[i];
    const previous = candles[i - 1];
    const previousPrevious = candles[i - 2];
    const volumeRatio = volumeAverage > 0 ? c.volume / volumeAverage : 1;
    const cRange = range(c);
    if (!cRange) continue;

    const spring = c.low < rangeLow && c.close > rangeLow && c.close > c.open && volumeRatio >= 1.15;
    const test = previous && previous.low < rangeLow && c.low >= previous.low && c.close > c.open && volumeRatio <= 1.1;
    const sos = c.close > rangeHigh && body(c) / cRange >= 0.55 && volumeRatio >= 1.2;
    const utad = c.high > rangeHigh && c.close < rangeHigh && c.close < c.open && volumeRatio >= 1.15;
    const sow = c.close < rangeLow && body(c) / cRange >= 0.55 && volumeRatio >= 1.2;

    if (spring) events.push('SPRING');
    if (test) events.push('TEST');
    if (sos) events.push('SOS');
    if (utad) events.push('UTAD');
    if (sow) events.push('SOW');
    void previousPrevious;
  }
  return events.slice(-10);
}

export function analyzeWyckoff(
  candles: Candle[],
  structure: MarketStructureSnapshot,
  indicators: IndicatorSnapshot,
): WyckoffAnalysis {
  if (candles.length < 40) {
    return {
      phase: 'neutral', bias: 'neutral', score: 0, volumeRatio: indicators.relativeVolume20,
      effortVsResult: 'balanced', events: [], latestEvent: null, rangeHigh: null, rangeLow: null,
      reasons: ['Dados insuficientes para análise Wyckoff'],
    };
  }

  const window = candles.slice(-60);
  const rangeHigh = Math.max(...window.map(c => c.high));
  const rangeLow = Math.min(...window.map(c => c.low));
  const latest = candles.at(-1)!;
  const averageVolume = average(window.map(c => c.volume));
  const volumeRatio = averageVolume > 0 ? latest.volume / averageVolume : 1;
  const latestRange = range(latest);
  const latestBody = body(latest);
  const effortResult = latestRange > 0 ? latestBody / latestRange : 0;

  const events = detectEvents(candles, rangeLow, rangeHigh, averageVolume);
  const latestEvent = events.at(-1) ?? null;
  let score = 0;
  const reasons: string[] = [];

  if (structure.trend === 'bullish') score += 1;
  if (structure.trend === 'bearish') score -= 1;

  if (latestEvent === 'SPRING' || latestEvent === 'TEST' || latestEvent === 'SOS') {
    score += latestEvent === 'SOS' ? 2 : 1;
    reasons.push(`Evento Wyckoff ${latestEvent}`);
  }
  if (latestEvent === 'UTAD' || latestEvent === 'SOW') {
    score -= latestEvent === 'SOW' ? 2 : 1;
    reasons.push(`Evento Wyckoff ${latestEvent}`);
  }

  const position = rangeHigh > rangeLow ? (latest.close - rangeLow) / (rangeHigh - rangeLow) : 0.5;
  let phase: WyckoffPhase = 'neutral';
  if (structure.trend === 'bullish' && position > 0.55) phase = 'markup';
  else if (structure.trend === 'bearish' && position < 0.45) phase = 'markdown';
  else if (latestEvent === 'SPRING' || latestEvent === 'TEST') phase = 'accumulation';
  else if (latestEvent === 'UTAD') phase = 'distribution';
  else if (position >= 0.4 && position <= 0.6) phase = score >= 0 ? 'accumulation' : 'distribution';

  if (phase === 'markup') reasons.push('Estrutura e posição no range sugerem markup');
  if (phase === 'markdown') reasons.push('Estrutura e posição no range sugerem markdown');
  if (phase === 'accumulation') reasons.push('Preço trabalhando a região inferior do range');
  if (phase === 'distribution') reasons.push('Preço trabalhando a região superior do range');

  let effortVsResult: WyckoffAnalysis['effortVsResult'] = 'balanced';
  if (volumeRatio >= 1.8) effortVsResult = 'climax';
  else if (volumeRatio >= 1.3 && effortResult < 0.45) effortVsResult = 'absorption';
  else if (volumeRatio <= 0.7 && effortResult >= 0.55) effortVsResult = 'low-effort';

  if (effortVsResult === 'absorption') reasons.push('Volume elevado com deslocamento relativamente pequeno, possível absorção');
  if (effortVsResult === 'climax') reasons.push('Volume em nível de clímax, exige confirmação posterior');
  if (effortVsResult === 'low-effort') reasons.push('Deslocamento com volume reduzido, falta de oposição aparente');

  const bias: WyckoffAnalysis['bias'] = score >= 2 ? 'bullish' : score <= -2 ? 'bearish' : 'neutral';
  return { phase, bias, score: Math.max(-3, Math.min(3, score)), volumeRatio, effortVsResult, events, latestEvent, rangeHigh, rangeLow, reasons };
}
