import type { Candle } from '../../src/types.js';
import type { MarketAnalysis, TimeframeMarketAnalysis } from '../confluence/marketAnalysisService.js';

export type SignalDirection = 'LONG' | 'SHORT' | 'NO TRADE';
export type SignalStrength = 'A+' | 'A' | 'B' | 'C' | 'NONE';

export interface TradeSignal {
  symbol: string;
  timestamp: number;
  direction: SignalDirection;
  strength: SignalStrength;
  score: number;
  confidence: number;
  entryZone: { low: number; high: number; reference: number } | null;
  stopLoss: number | null;
  invalidation: number | null;
  takeProfits: { tp1: number; tp2: number; tp3: number } | null;
  riskReward: { tp1: number; tp2: number; tp3: number } | null;
  riskPercent: number;
  positionRiskDistance: number | null;
  reasons: string[];
  warnings: string[];
}

function round(value: number, decimals = 2): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function finite(value: number | null | undefined): value is number {
  return value !== null && value !== undefined && Number.isFinite(value);
}

function noTrade(symbol: string, timestamp: number, reasons: string[], confidence = 0, score = 0, warnings: string[] = []): TradeSignal {
  return {
    symbol,
    timestamp,
    direction: 'NO TRADE',
    strength: 'NONE',
    score: round(score),
    confidence,
    entryZone: null,
    stopLoss: null,
    invalidation: null,
    takeProfits: null,
    riskReward: null,
    riskPercent: 0,
    positionRiskDistance: null,
    reasons,
    warnings,
  };
}

/**
 * Deterministic signal layer. It converts the structured market analysis into
 * a trade plan without placing orders. The 15m chart is the execution context;
 * higher timeframes provide directional confirmation.
 */
export function generateTradeSignal(analysis: MarketAnalysis, candles: Candle[], riskPercent = 1): TradeSignal {
  const latest = candles.at(-1);
  const primary = analysis.timeframes.find(tf => tf.timeframe === '15m') ?? analysis.timeframes.at(-1);

  if (!latest || !primary) {
    return noTrade(analysis.symbol, Date.now(), ['Dados insuficientes para gerar o plano.']);
  }

  const rawScore = analysis.confluence.score;
  const confidence = analysis.confluence.confidence;
  const absScore = Math.abs(rawScore);
  const direction: SignalDirection = rawScore >= 20 ? 'LONG' : rawScore <= -20 ? 'SHORT' : 'NO TRADE';
  const higher = analysis.timeframes.filter(tf => tf.timeframe !== primary.timeframe);
  const alignedHigher = countAligned(higher, direction);
  const conflicts = countConflicts(higher, direction);

  const warnings: string[] = [];
  if (conflicts > 0) warnings.push(`${conflicts} timeframe(s) superior(es) em conflito.`);
  if (analysis.confluence.conflicts.length > 0) warnings.push(...analysis.confluence.conflicts.slice(0, 3));
  if (confidence < 60) warnings.push('Confiança abaixo do nível operacional preferencial.');
  if (analysis.confluence.entryQuality === 'avoid') warnings.push('Confluência classificou a entrada como evitável.');

  if (direction === 'NO TRADE' || absScore < 20 || confidence < 50 || analysis.confluence.entryQuality === 'avoid') {
    return noTrade(
      analysis.symbol,
      latest.timestamp,
      ['Confluência insuficiente para um setup operacional de qualidade.'],
      confidence,
      rawScore,
      warnings,
    );
  }

  const atr = primary.indicators.atr14;
  if (!finite(atr) || atr <= 0 || latest.close <= 0) {
    return noTrade(analysis.symbol, latest.timestamp, ['ATR ou preço inválido.'], confidence, rawScore, warnings);
  }

  const reference = latest.close;
  const swings = primary.structure.swings;
  const swingLow = latestSwingPrice(swings, 'low');
  const swingHigh = latestSwingPrice(swings, 'high');

  const volatilityStop = direction === 'LONG' ? reference - atr * 1.5 : reference + atr * 1.5;
  const structureStop = direction === 'LONG'
    ? finite(swingLow) && swingLow < reference ? swingLow - atr * 0.15 : volatilityStop
    : finite(swingHigh) && swingHigh > reference ? swingHigh + atr * 0.15 : volatilityStop;
  const stopLoss = direction === 'LONG'
    ? Math.min(volatilityStop, structureStop)
    : Math.max(volatilityStop, structureStop);

  const distance = Math.abs(reference - stopLoss);
  if (!finite(distance) || distance <= 0 || distance > reference * 0.08) {
    return noTrade(analysis.symbol, latest.timestamp, ['Distância de stop fora do limite operacional.'], confidence, rawScore, warnings);
  }

  const entryBuffer = Math.min(atr * 0.25, reference * 0.0025);
  const entryZone = { low: reference - entryBuffer, high: reference + entryBuffer, reference };
  const tp1 = direction === 'LONG' ? reference + distance * 1.5 : reference - distance * 1.5;
  const tp2 = direction === 'LONG' ? reference + distance * 2.5 : reference - distance * 2.5;
  const tp3 = direction === 'LONG' ? reference + distance * 4 : reference - distance * 4;

  const strength: SignalStrength = absScore >= 70 && confidence >= 80 && alignedHigher >= 2 && conflicts === 0
    ? 'A+'
    : absScore >= 55 && confidence >= 70
      ? 'A'
      : absScore >= 40 && confidence >= 60
        ? 'B'
        : 'C';

  return {
    symbol: analysis.symbol,
    timestamp: latest.timestamp,
    direction,
    strength,
    score: round(rawScore),
    confidence,
    entryZone: { low: round(entryZone.low), high: round(entryZone.high), reference: round(reference) },
    stopLoss: round(stopLoss),
    invalidation: round(stopLoss),
    takeProfits: { tp1: round(tp1), tp2: round(tp2), tp3: round(tp3) },
    riskReward: { tp1: 1.5, tp2: 2.5, tp3: 4 },
    riskPercent: Math.max(0.1, Math.min(2, riskPercent)),
    positionRiskDistance: round(distance),
    reasons: buildReasons(direction, analysis, primary, alignedHigher),
    warnings,
  };
}

function latestSwingPrice(swings: TimeframeMarketAnalysis['structure']['swings'], type: 'high' | 'low'): number | null {
  for (let i = swings.length - 1; i >= 0; i -= 1) {
    if (swings[i].type === type && finite(swings[i].price)) return swings[i].price;
  }
  return null;
}

function countAligned(timeframes: TimeframeMarketAnalysis[], direction: SignalDirection): number {
  if (direction === 'LONG') return timeframes.filter(tf => tf.structure.trend === 'bullish').length;
  if (direction === 'SHORT') return timeframes.filter(tf => tf.structure.trend === 'bearish').length;
  return 0;
}

function countConflicts(timeframes: TimeframeMarketAnalysis[], direction: SignalDirection): number {
  if (direction === 'LONG') return timeframes.filter(tf => tf.structure.trend === 'bearish').length;
  if (direction === 'SHORT') return timeframes.filter(tf => tf.structure.trend === 'bullish').length;
  return 0;
}

function buildReasons(
  direction: SignalDirection,
  analysis: MarketAnalysis,
  primary: TimeframeMarketAnalysis,
  alignedHigher: number,
): string[] {
  const reasons: string[] = [
    `Confluência ${direction} com score ${round(Math.abs(analysis.confluence.score), 1)}.`,
    `Confiança estrutural em ${analysis.confluence.confidence}%.`,
  ];
  if (primary.structure.trend === (direction === 'LONG' ? 'bullish' : 'bearish')) {
    reasons.push(`Estrutura ${direction === 'LONG' ? 'bullish' : 'bearish'} no 15m.`);
  }
  const latestFvg = primary.smc.fairValueGaps.at(-1);
  const latestOrderBlock = primary.smc.orderBlocks.at(-1);
  if (latestFvg) reasons.push(`FVG ${latestFvg.type} no contexto.`);
  if (latestOrderBlock) reasons.push(`Order Block ${latestOrderBlock.type} identificado.`);
  if (primary.wyckoff.latestEvent) reasons.push(`Evento Wyckoff ${primary.wyckoff.latestEvent} detectado.`);
  if (primary.divergences.latest) reasons.push(`Divergência ${primary.divergences.latest.type} detectada.`);
  if (alignedHigher > 0) reasons.push(`${alignedHigher} timeframe(s) superior(es) alinhado(s).`);
  return reasons;
}
