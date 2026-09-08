import type { HistoricalBacktestOptions, HistoricalBacktestResult } from '../backtest/historicalBacktest.js';
import type { Candle } from '../../src/types.js';
import { runHistoricalBacktest } from '../backtest/historicalBacktest.js';
import { selectRobustParameters, type RobustParameterSelectionResult } from './robustParameterSelection.js';
import { analyzeMonteCarlo, type MonteCarloAnalysisResult } from './monteCarloAnalysis.js';
import { runStressTest, type StressTestResult } from './stressTest.js';
import { analyzeRegimes, type RegimeAnalyticsResult } from './regimeAnalytics.js';
import { validateMultiRegime, type MultiRegimeValidationResult } from './multiRegimeAnalytics.js';
import type { HistoricalFundingRate } from '../derivatives/historicalFundingService.js';

export interface OverfittingGuardResult { level: 'LOW' | 'MODERATE' | 'HIGH' | 'INSUFFICIENT_DATA'; score: number; trainExpectancyR: number; holdoutExpectancyR: number; expectancyRetentionPercent: number; trainProfitFactor: number; holdoutProfitFactor: number; profitFactorRetentionPercent: number; tradeCount: number; warnings: string[]; }
export interface OosSignificanceResult { sampleSize: number; meanR: number; bootstrapCi95R: { low: number; high: number } | null; probabilityPositiveExpectancyPercent: number; probabilityPositiveDeltaPercent: number; baselineDeltaCi95R: { low: number; high: number } | null; status: 'SIGNIFICANT' | 'WEAK' | 'INSUFFICIENT_DATA'; warnings: string[]; }
export interface RegimeValidationResult { coveredRegimes: number; evaluatedRegimes: number; positiveRegimes: number; coveragePercent: number; consistencyPercent: number; worstExpectancyR: number; status: 'ROBUST' | 'MIXED' | 'FRAGILE' | 'INSUFFICIENT_DATA'; warnings: string[]; buckets: RegimeAnalyticsResult['buckets']; }

export interface ParameterValidationResult {
  split: { trainCandles: number; holdoutCandles: number; trainPercent: number };
  optimization: RobustParameterSelectionResult;
  baselineHoldout: HistoricalBacktestResult;
  selectedHoldout: HistoricalBacktestResult | null;
  regimeWindow: HistoricalBacktestResult | null;
  monteCarlo: MonteCarloAnalysisResult | null;
  stressTest: StressTestResult | null;
  comparison: { expectancyDeltaR: number; netProfitDeltaPercent: number; drawdownDeltaPercent: number; selectedBeatsBaseline: boolean };
  overfittingGuard: OverfittingGuardResult;
  significance: OosSignificanceResult;
  regimeValidation: RegimeValidationResult;
  multiRegimeValidation: MultiRegimeValidationResult;
  verdict: 'PASS' | 'CAUTION' | 'REJECT' | 'INSUFFICIENT_DATA';
  warnings: string[];
}

const round = (v: number, d = 4) => Number((Number.isFinite(v) ? v : 0).toFixed(d));
const displayPf = (v: number) => Number.isFinite(v) ? v : v > 0 ? 99 : 0;

function assessOverfitting(trainResult: HistoricalBacktestResult, holdoutResult: HistoricalBacktestResult | null, selected: RobustParameterSelectionResult['selected']): OverfittingGuardResult {
  if (!holdoutResult || !selected || trainResult.totalTrades < 30 || holdoutResult.totalTrades < 30) return { level: 'INSUFFICIENT_DATA', score: 0, trainExpectancyR: round(trainResult.expectancyR), holdoutExpectancyR: round(holdoutResult?.expectancyR ?? 0), expectancyRetentionPercent: 0, trainProfitFactor: round(displayPf(trainResult.profitFactor)), holdoutProfitFactor: round(displayPf(holdoutResult?.profitFactor ?? 0)), profitFactorRetentionPercent: 0, tradeCount: holdoutResult?.totalTrades ?? 0, warnings: ['Amostra insuficiente para medir overfitting com confiança.'] };
  const trainExpectancy = trainResult.expectancyR; const holdoutExpectancy = holdoutResult.expectancyR; const trainPf = displayPf(trainResult.profitFactor); const holdoutPf = displayPf(holdoutResult.profitFactor);
  const expectancyRetention = trainExpectancy > 0 ? holdoutExpectancy / trainExpectancy * 100 : holdoutExpectancy > 0 ? 100 : 0; const pfRetention = trainPf > 0 ? holdoutPf / trainPf * 100 : 0;
  const stableBonus = selected.stabilityScore >= selected.rankScore * 0.85 ? 10 : selected.stabilityScore >= selected.rankScore * 0.7 ? 5 : 0; const samplePenalty = holdoutResult.totalTrades < 50 ? 10 : 0; const expectancyPenalty = expectancyRetention < 30 ? 45 : expectancyRetention < 50 ? 30 : expectancyRetention < 70 ? 15 : 0; const pfPenalty = pfRetention < 40 ? 25 : pfRetention < 60 ? 15 : pfRetention < 80 ? 5 : 0;
  const score = Math.max(0, Math.min(100, 100 + stableBonus - samplePenalty - expectancyPenalty - pfPenalty)); const level = score >= 75 ? 'LOW' : score >= 50 ? 'MODERATE' : 'HIGH'; const warnings: string[] = [];
  if (expectancyRetention < 70) warnings.push(`Retenção de expectancy treino→OOS em ${round(expectancyRetention, 1)}%.`); if (pfRetention < 80) warnings.push(`Retenção de Profit Factor treino→OOS em ${round(pfRetention, 1)}%.`); if (holdoutResult.totalTrades < 50) warnings.push('Holdout tem menos de 50 trades; risco estatístico maior.'); if (level === 'HIGH') warnings.push('Risco alto de overfitting: não liberar para uso operacional.');
  return { level, score: round(score, 1), trainExpectancyR: round(trainExpectancy), holdoutExpectancyR: round(holdoutExpectancy), expectancyRetentionPercent: round(expectancyRetention, 1), trainProfitFactor: round(trainPf), holdoutProfitFactor: round(holdoutPf), profitFactorRetentionPercent: round(pfRetention, 1), tradeCount: holdoutResult.totalTrades, warnings };
}

function bootstrapSignificance(values: number[], baselineValues: number[] | null, simulations = 3000): OosSignificanceResult {
  if (values.length < 30) return { sampleSize: values.length, meanR: round(values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0), bootstrapCi95R: null, probabilityPositiveExpectancyPercent: 0, probabilityPositiveDeltaPercent: 0, baselineDeltaCi95R: null, status: 'INSUFFICIENT_DATA', warnings: ['São necessários pelo menos 30 trades OOS.'] };
  let seed = 20260908 + values.length; const random = () => { seed = (1664525 * seed + 1013904223) >>> 0; return seed / 4294967296; };
  const means: number[] = []; const deltas: number[] = []; let positive = 0; let positiveDelta = 0; const observed = values.reduce((a, b) => a + b, 0) / values.length;
  for (let s = 0; s < simulations; s++) { let sum = 0; let deltaSum = 0; for (let i = 0; i < values.length; i++) { const idx = Math.floor(random() * values.length); const v = values[idx]; sum += v; if (baselineValues?.length) deltaSum += v - baselineValues[Math.floor(random() * baselineValues.length)]; } const m = sum / values.length; means.push(m); if (m > 0) positive++; if (baselineValues?.length) { const d = deltaSum / values.length; deltas.push(d); if (d > 0) positiveDelta++; } }
  means.sort((a, b) => a - b); deltas.sort((a, b) => a - b); const percentile = (arr: number[], p: number) => arr.length ? arr[Math.min(arr.length - 1, Math.max(0, Math.floor((arr.length - 1) * p)))] : 0;
  const ci = { low: percentile(means, 0.025), high: percentile(means, 0.975) }; const deltaCi = deltas.length ? { low: percentile(deltas, 0.025), high: percentile(deltas, 0.975) } : null; const pPositive = positive / simulations * 100; const pDelta = baselineValues?.length ? positiveDelta / simulations * 100 : 0; const significant = ci.low > 0 && (!deltaCi || deltaCi.low > 0) && pPositive >= 97.5;
  const warnings: string[] = []; if (ci.low <= 0) warnings.push('IC bootstrap 95% da expectancy inclui zero.'); if (deltaCi && deltaCi.low <= 0) warnings.push('IC bootstrap da vantagem contra baseline inclui zero.');
  return { sampleSize: values.length, meanR: round(observed), bootstrapCi95R: { low: round(ci.low), high: round(ci.high) }, probabilityPositiveExpectancyPercent: round(pPositive, 2), probabilityPositiveDeltaPercent: round(pDelta, 2), baselineDeltaCi95R: deltaCi ? { low: round(deltaCi.low), high: round(deltaCi.high) } : null, status: significant ? 'SIGNIFICANT' : 'WEAK', warnings };
}

function validateRegimes(candles: Candle[], trades: HistoricalBacktestResult['trades']): RegimeValidationResult {
  const analysis = analyzeRegimes(candles, trades); const evaluated = analysis.buckets.filter(b => b.trades >= 10); const positive = evaluated.filter(b => b.expectancyR > 0); const covered = analysis.buckets.filter(b => b.trades > 0).length; const coverage = covered / analysis.buckets.length * 100; const consistency = evaluated.length ? positive.length / evaluated.length * 100 : 0; const worst = evaluated.length ? Math.min(...evaluated.map(b => b.expectancyR)) : 0; const warnings = [...analysis.warnings]; if (covered < 3) warnings.push('Menos de três regimes tiveram operações na janela ampliada.'); if (evaluated.some(b => b.expectancyR <= 0)) warnings.push('Existe pelo menos um regime relevante com expectancy não positiva.'); const status = evaluated.length < 3 ? 'INSUFFICIENT_DATA' : consistency >= 75 && worst > 0 ? 'ROBUST' : consistency >= 50 ? 'MIXED' : 'FRAGILE'; return { coveredRegimes: covered, evaluatedRegimes: evaluated.length, positiveRegimes: positive.length, coveragePercent: round(coverage, 1), consistencyPercent: round(consistency, 1), worstExpectancyR: round(worst), status, warnings, buckets: analysis.buckets };
}

export function validateSelectedParameters(symbol: string, candles: Candle[], baseOptions: Omit<HistoricalBacktestOptions, 'symbol' | 'candles'> = {}, trainPercent = 70): ParameterValidationResult {
  const safePercent = Math.max(60, Math.min(80, trainPercent)); const splitIndex = Math.floor(candles.length * safePercent / 100); const train = candles.slice(0, splitIndex); const holdout = candles.slice(splitIndex); const optimization = selectRobustParameters(symbol, train, baseOptions);
  const baselineHoldout = runHistoricalBacktest({ ...baseOptions, symbol, candles: holdout });
  const selectedHoldout = optimization.selected ? runHistoricalBacktest({ ...baseOptions, symbol, candles: holdout, minScore: optimization.selected.minScore, minConfidence: optimization.selected.minConfidence, atrStopMultiple: optimization.selected.atrStopMultiple, rewardRisk: optimization.selected.rewardRisk, maxHoldingBars: optimization.selected.maxHoldingBars }) : null;
  const trainSelected = optimization.selected ? runHistoricalBacktest({ ...baseOptions, symbol, candles: train, minScore: optimization.selected.minScore, minConfidence: optimization.selected.minConfidence, atrStopMultiple: optimization.selected.atrStopMultiple, rewardRisk: optimization.selected.rewardRisk, maxHoldingBars: optimization.selected.maxHoldingBars }) : null;
  const regimeWindow = optimization.selected ? runHistoricalBacktest({ ...baseOptions, symbol, candles, minScore: optimization.selected.minScore, minConfidence: optimization.selected.minConfidence, atrStopMultiple: optimization.selected.atrStopMultiple, rewardRisk: optimization.selected.rewardRisk, maxHoldingBars: optimization.selected.maxHoldingBars }) : null;
  const monteCarlo = selectedHoldout && selectedHoldout.totalTrades >= 30 ? analyzeMonteCarlo(selectedHoldout.trades, 3000, baseOptions.riskPerTradePercent ?? 1) : null;
  const stressTest = selectedHoldout && selectedHoldout.totalTrades >= 30 ? runStressTest(symbol, holdout, { ...baseOptions, minScore: optimization.selected?.minScore, minConfidence: optimization.selected?.minConfidence, atrStopMultiple: optimization.selected?.atrStopMultiple, rewardRisk: optimization.selected?.rewardRisk, maxHoldingBars: optimization.selected?.maxHoldingBars }) : null;
  const expectancyDeltaR = round((selectedHoldout?.expectancyR ?? 0) - baselineHoldout.expectancyR); const netProfitDeltaPercent = round((selectedHoldout?.netProfitPercent ?? 0) - baselineHoldout.netProfitPercent, 2); const drawdownDeltaPercent = round((selectedHoldout?.maxDrawdownPercent ?? 0) - baselineHoldout.maxDrawdownPercent, 2); const selectedBeatsBaseline = !!selectedHoldout && selectedHoldout.totalTrades >= 30 && selectedHoldout.expectancyR > 0 && selectedHoldout.profitFactor > 1 && selectedHoldout.expectancyR >= baselineHoldout.expectancyR;
  const overfittingGuard = assessOverfitting(trainSelected ?? runHistoricalBacktest({ ...baseOptions, symbol, candles: train }), selectedHoldout, optimization.selected); const significance = bootstrapSignificance(selectedHoldout?.trades.map(t => t.pnlR).filter(Number.isFinite) ?? [], baselineHoldout.trades.map(t => t.pnlR).filter(Number.isFinite)); const regimeValidation = validateRegimes(candles, regimeWindow?.trades ?? []);
  const historicalFunding = (baseOptions.historicalFunding ?? []) as HistoricalFundingRate[];
  const multiRegimeValidation = validateMultiRegime(candles, regimeWindow?.trades ?? [], historicalFunding, 10);
  const warnings: string[] = [...overfittingGuard.warnings, ...significance.warnings, ...regimeValidation.warnings, ...multiRegimeValidation.warnings]; if (train.length < 3000 || holdout.length < 1500) warnings.push('Janela inferior à recomendada para validação multi-regime estendida.'); if (!optimization.selected) warnings.push('Nenhum parâmetro foi selecionado no treino.'); if (selectedHoldout && selectedHoldout.totalTrades < 30) warnings.push('O holdout selecionado tem menos de 30 trades.'); if (monteCarlo?.grade === 'FRAGILE') warnings.push('Monte Carlo classificou a distribuição como FRAGILE.'); if (stressTest?.grade === 'FRAGILE') warnings.push('Stress Test classificou a configuração como FRAGILE.');
  const enough = train.length >= 3000 && holdout.length >= 1500 && !!selectedHoldout && selectedHoldout.totalTrades >= 30; const riskChecksPass = !!monteCarlo && monteCarlo.grade !== 'FRAGILE' && !!stressTest && stressTest.grade !== 'FRAGILE'; const verdict = !enough ? 'INSUFFICIENT_DATA' : !selectedBeatsBaseline || overfittingGuard.level === 'HIGH' || significance.status !== 'SIGNIFICANT' || regimeValidation.status === 'FRAGILE' || regimeValidation.status === 'INSUFFICIENT_DATA' || multiRegimeValidation.status === 'FRAGILE' || multiRegimeValidation.status === 'INSUFFICIENT_DATA' ? 'REJECT' : selectedBeatsBaseline && riskChecksPass && overfittingGuard.level === 'LOW' && regimeValidation.status === 'ROBUST' && multiRegimeValidation.status === 'ROBUST' ? 'PASS' : 'CAUTION';
  return { split: { trainCandles: train.length, holdoutCandles: holdout.length, trainPercent: safePercent }, optimization, baselineHoldout, selectedHoldout, regimeWindow, monteCarlo, stressTest, comparison: { expectancyDeltaR, netProfitDeltaPercent, drawdownDeltaPercent, selectedBeatsBaseline }, overfittingGuard, significance, regimeValidation, multiRegimeValidation, verdict, warnings };
}
