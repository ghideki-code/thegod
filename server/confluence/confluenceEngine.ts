import type { IndicatorSnapshot } from '../indicators/technicalIndicators.js';
import type { MarketStructureSnapshot } from '../structure/marketStructure.js';
import type { SMCAnalysis } from '../structure/smc.js';
import type { DerivativesAnalysis } from '../derivatives/derivativesAnalysis.js';
import type { DivergenceAnalysis } from '../divergence/divergenceEngine.js';
import type { GannAnalysis } from '../gann/gannEngine.js';
import type { WyckoffAnalysis } from '../wyckoff/wyckoffEngine.js';

export type ConfluenceBias = 'bullish' | 'bearish' | 'neutral';

export interface TimeframeConfluence {
  timeframe: '15m' | '1h' | '4h' | '1d';
  bias: ConfluenceBias;
  score: number;
  reasons: string[];
}

export interface ConfluenceAnalysis {
  bias: ConfluenceBias;
  score: number;
  confidence: number;
  timeframes: TimeframeConfluence[];
  confirmations: string[];
  conflicts: string[];
  entryQuality: 'A+' | 'A' | 'B' | 'C' | 'avoid';
  derivatives: DerivativesAnalysis | null;
  divergenceScore: number;
  gannScore: number;
  wyckoffScore: number;
}

function signBias(bias: ConfluenceBias): number {
  return bias === 'bullish' ? 1 : bias === 'bearish' ? -1 : 0;
}

function indicatorBias(ind: IndicatorSnapshot): { bias: ConfluenceBias; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;
  if (ind.ema9 > ind.ema21) { score += 1; reasons.push('EMA9 acima da EMA21'); }
  else if (ind.ema9 < ind.ema21) { score -= 1; reasons.push('EMA9 abaixo da EMA21'); }
  if (ind.ema21 > ind.ema50) { score += 1; reasons.push('EMA21 acima da EMA50'); }
  else if (ind.ema21 < ind.ema50) { score -= 1; reasons.push('EMA21 abaixo da EMA50'); }
  if (ind.ema50 > ind.ema200) { score += 1; reasons.push('EMA50 acima da EMA200'); }
  else if (ind.ema50 < ind.ema200) { score -= 1; reasons.push('EMA50 abaixo da EMA200'); }
  if (ind.rsi14 >= 55 && ind.rsi14 <= 70) { score += 1; reasons.push('RSI em regime comprador'); }
  else if (ind.rsi14 <= 45 && ind.rsi14 >= 30) { score -= 1; reasons.push('RSI em regime vendedor'); }
  if (ind.relativeVolume20 >= 1.2) reasons.push('Volume relativo acima da média');
  return { bias: score > 0 ? 'bullish' : score < 0 ? 'bearish' : 'neutral', reasons };
}

export function calculateConfluence(
  inputs: Array<{ timeframe: '15m' | '1h' | '4h' | '1d'; indicators: IndicatorSnapshot; structure: MarketStructureSnapshot; smc: SMCAnalysis; divergences?: DivergenceAnalysis; gann?: GannAnalysis; wyckoff?: WyckoffAnalysis }>,
  derivatives: DerivativesAnalysis | null = null,
): ConfluenceAnalysis {
  const weights: Record<'15m' | '1h' | '4h' | '1d', number> = { '15m': 1, '1h': 2, '4h': 3, '1d': 4 };
  const timeframes: TimeframeConfluence[] = [];
  let weightedScore = 0;
  let totalWeight = 0;
  const confirmations: string[] = [];
  const conflicts: string[] = [];
  let divergenceScore = 0;
  let gannScore = 0;
  let wyckoffScore = 0;

  for (const input of inputs) {
    const ib = indicatorBias(input.indicators);
    let score = signBias(input.structure.trend) * 2 + signBias(input.smc.bias) * 2 + signBias(ib.bias);
    const reasons = [...ib.reasons];
    if (input.structure.latestEvent?.type === 'BOS') { score += signBias(input.structure.latestEvent.direction); reasons.push(`BOS ${input.structure.latestEvent.direction}`); }
    if (input.structure.latestEvent?.type === 'CHoCH') { score += signBias(input.structure.latestEvent.direction); reasons.push(`CHoCH ${input.structure.latestEvent.direction}`); }
    if (input.structure.latestSweep) { const sweepBias = input.structure.latestSweep.type === 'low' ? 1 : -1; score += sweepBias; reasons.push(input.structure.latestSweep.type === 'low' ? 'Sweep de sell-side liquidity' : 'Sweep de buy-side liquidity'); }
    if (input.smc.premiumDiscount?.zone === 'discount') score += 1;
    if (input.smc.premiumDiscount?.zone === 'premium') score -= 1;

    const latestDivergence = input.divergences?.latest;
    if (latestDivergence && latestDivergence.strength >= 25) {
      const dScore = latestDivergence.type.startsWith('bullish') ? 2 : -2;
      score += dScore;
      divergenceScore += dScore * weights[input.timeframe];
      reasons.push(`Divergência ${latestDivergence.type} (${latestDivergence.strength}/100)`);
    }
    if (input.gann) {
      const gScore = Math.max(-1, Math.min(1, input.gann.score));
      score += gScore;
      gannScore += gScore * weights[input.timeframe];
      if (gScore !== 0) reasons.push(`Gann ${input.gann.bias}`);
    }
    if (input.wyckoff) {
      const wScore = Math.max(-2, Math.min(2, input.wyckoff.score));
      score += wScore;
      wyckoffScore += wScore * weights[input.timeframe];
      if (input.wyckoff.latestEvent) reasons.push(`Wyckoff ${input.wyckoff.latestEvent}`);
      reasons.push(`Fase Wyckoff ${input.wyckoff.phase}`);
    }

    const bias: ConfluenceBias = score >= 2 ? 'bullish' : score <= -2 ? 'bearish' : 'neutral';
    const weight = weights[input.timeframe];
    weightedScore += score * weight;
    totalWeight += weight * 13;
    timeframes.push({ timeframe: input.timeframe, bias, score, reasons });
    if (score >= 5) confirmations.push(`${input.timeframe}: confluência bullish forte`);
    if (score <= -5) confirmations.push(`${input.timeframe}: confluência bearish forte`);
  }

  if (derivatives) {
    weightedScore += signBias(derivatives.bias) * 2;
    totalWeight += 2 * 13;
    if (derivatives.score > 0) confirmations.push('Derivativos favorecem cenário bullish');
    if (derivatives.score < 0) confirmations.push('Derivativos mostram excesso de posicionamento comprador');
    if (derivatives.score === 0) conflicts.push('Derivativos sem confirmação direcional');
  }

  const normalized = totalWeight ? weightedScore / totalWeight : 0;
  const score = Math.round(Math.max(-100, Math.min(100, normalized * 100)));
  const bias: ConfluenceBias = score >= 20 ? 'bullish' : score <= -20 ? 'bearish' : 'neutral';
  const confidence = Math.round(Math.min(99, Math.abs(score) + confirmations.length * 3));
  const bullishCount = timeframes.filter(t => t.bias === 'bullish').length;
  const bearishCount = timeframes.filter(t => t.bias === 'bearish').length;
  if (bullishCount > 0 && bearishCount > 0) conflicts.push('Timeframes apresentam conflito de direção');
  if (timeframes.some(t => t.timeframe === '1d' && t.bias !== bias)) conflicts.push('Daily não confirma o viés dominante');
  const entryQuality = confidence >= 80 && conflicts.length === 0 ? 'A+' : confidence >= 70 ? 'A' : confidence >= 55 ? 'B' : confidence >= 35 ? 'C' : 'avoid';
  return { bias, score, confidence, timeframes, confirmations, conflicts, entryQuality, derivatives, divergenceScore, gannScore, wyckoffScore };
}
