import type { HistoricalBacktestOptions, HistoricalBacktestResult } from '../backtest/historicalBacktest.js';
import type { Candle } from '../../src/types.js';
import { runHistoricalBacktest } from '../backtest/historicalBacktest.js';

export interface ParameterCandidate { id: string; minScore: number; minConfidence: number; atrStopMultiple: number; rewardRisk: number; maxHoldingBars: number; trades: number; expectancyR: number; profitFactor: number; netProfitPercent: number; maxDrawdownPercent: number; stabilityScore: number; rankScore: number; }
export interface RobustParameterSelectionResult { candidates: ParameterCandidate[]; selected: ParameterCandidate | null; baseline: ParameterCandidate | null; stableRegion: { minScore: number[]; minConfidence: number[]; atrStopMultiple: number[]; rewardRisk: number[]; maxHoldingBars: number[] }; grade: 'ROBUST' | 'PROMISING' | 'FRAGILE' | 'INSUFFICIENT_DATA'; warnings: string[]; }
const round = (v: number, d = 4) => Number((Number.isFinite(v) ? v : 0).toFixed(d));
const pf = (r: HistoricalBacktestResult) => Number.isFinite(r.profitFactor) ? r.profitFactor : r.profitFactor > 0 ? 99 : 0;
function score(r: HistoricalBacktestResult): number { if (r.totalTrades < 20) return 0; const expectancy = Math.max(-1, Math.min(2, r.expectancyR)); const profitFactor = Math.max(0, Math.min(3, pf(r))); const ddPenalty = Math.max(0, Math.min(1, r.maxDrawdownPercent / 20)); const sampleBonus = Math.min(1, r.totalTrades / 100); return round(Math.max(0, expectancy / 2) * 35 + Math.min(1, profitFactor / 2) * 30 + (1 - ddPenalty) * 20 + sampleBonus * 15, 2); }
function candidate(id: string, options: Omit<HistoricalBacktestOptions, 'symbol' | 'candles'>, r: HistoricalBacktestResult): ParameterCandidate { const rankScore = score(r); return { id, minScore: options.minScore ?? 35, minConfidence: options.minConfidence ?? 50, atrStopMultiple: options.atrStopMultiple ?? 1.5, rewardRisk: options.rewardRisk ?? 2, maxHoldingBars: options.maxHoldingBars ?? 32, trades: r.totalTrades, expectancyR: round(r.expectancyR), profitFactor: round(pf(r)), netProfitPercent: round(r.netProfitPercent, 2), maxDrawdownPercent: round(r.maxDrawdownPercent, 2), stabilityScore: rankScore, rankScore }; }
function configKey(config: [number, number, number, number, number]) { return config.join('-'); }

/** Bounded local search: 15 strategically spaced configurations instead of the previous 31 full backtests. */
export function selectRobustParameters(symbol: string, candles: Candle[], baseOptions: Omit<HistoricalBacktestOptions, 'symbol' | 'candles'> = {}): RobustParameterSelectionResult {
  const base: [number, number, number, number, number] = [baseOptions.minScore ?? 35, baseOptions.minConfidence ?? 50, baseOptions.atrStopMultiple ?? 1.5, baseOptions.rewardRisk ?? 2, baseOptions.maxHoldingBars ?? 32];
  const configs: Array<[number, number, number, number, number]> = [base];
  const add = (config: [number, number, number, number, number]) => { if (!configs.some(existing => configKey(existing) === configKey(config))) configs.push(config); };
  add([30, base[1], base[2], base[3], base[4]]); add([40, base[1], base[2], base[3], base[4]]);
  add([base[0], 45, base[2], base[3], base[4]]); add([base[0], 55, base[2], base[3], base[4]]);
  add([base[0], base[1], 1.25, base[3], base[4]]); add([base[0], base[1], 1.75, base[3], base[4]]);
  add([base[0], base[1], base[2], 1.75, base[4]]); add([base[0], base[1], base[2], 2.25, base[4]]);
  add([base[0], base[1], base[2], base[3], 24]); add([base[0], base[1], base[2], base[3], 40]);
  add([30, 45, 1.25, 1.75, 24]); add([40, 55, 1.75, 2.25, 40]); add([30, 55, 1.75, 2.25, 32]); add([40, 45, 1.25, 2, 40]);

  const candidates: ParameterCandidate[] = [];
  for (const [s, c, a, r, h] of configs) {
    const options = { ...baseOptions, minScore: s, minConfidence: c, atrStopMultiple: a, rewardRisk: r, maxHoldingBars: h };
    candidates.push(candidate(`${s}-${c}-${a}-${r}-${h}`, options, runHistoricalBacktest({ ...options, symbol, candles })));
  }
  const baseline = candidates.find(c => c.minScore === base[0] && c.minConfidence === base[1] && c.atrStopMultiple === base[2] && c.rewardRisk === base[3] && c.maxHoldingBars === base[4]) ?? null;
  for (const c of candidates) {
    const nearby = candidates.filter(n => { const distance = Math.abs(n.minScore - c.minScore) / 10 + Math.abs(n.minConfidence - c.minConfidence) / 10 + Math.abs(n.atrStopMultiple - c.atrStopMultiple) / 0.25 + Math.abs(n.rewardRisk - c.rewardRisk) / 0.25 + Math.abs(n.maxHoldingBars - c.maxHoldingBars) / 8; return distance <= 2.01 && n.trades >= 30; });
    const viable = nearby.filter(n => n.expectancyR > 0 && n.profitFactor > 1).length;
    c.stabilityScore = round(c.rankScore * 0.7 + (nearby.length ? viable / nearby.length * 100 : 0) * 0.3, 2);
  }
  const eligible = candidates.filter(c => c.trades >= 30 && c.expectancyR > 0 && c.profitFactor > 1);
  eligible.sort((a, b) => b.stabilityScore - a.stabilityScore || b.rankScore - a.rankScore || b.trades - a.trades);
  const selected = eligible[0] ?? null;
  const stable = candidates.filter(c => selected && Math.abs(c.stabilityScore - selected.stabilityScore) <= 8 && c.trades >= 30 && c.expectancyR > 0 && c.profitFactor > 1);
  const warnings: string[] = [];
  if (selected && baseline && selected.id !== baseline.id) warnings.push('A configuração selecionada difere do baseline. Validar em OOS antes de qualquer uso operacional.');
  if (candles.length < 1500) warnings.push('Histórico curto para otimização robusta; aumentar a janela antes de concluir sobre parâmetros.');
  if (!selected) warnings.push('Nenhuma configuração atingiu os critérios mínimos de robustez.');
  warnings.push('Busca compacta de parâmetros: validação OOS e estabilidade regional continuam obrigatórias.');
  const grade = selected === null ? 'INSUFFICIENT_DATA' : stable.length >= 7 ? 'ROBUST' : stable.length >= 3 ? 'PROMISING' : 'FRAGILE';
  return { candidates: candidates.sort((a, b) => b.stabilityScore - a.stabilityScore).slice(0, 30), selected, baseline, stableRegion: { minScore: [...new Set(stable.map(c => c.minScore))].sort((a, b) => a - b), minConfidence: [...new Set(stable.map(c => c.minConfidence))].sort((a, b) => a - b), atrStopMultiple: [...new Set(stable.map(c => c.atrStopMultiple))].sort((a, b) => a - b), rewardRisk: [...new Set(stable.map(c => c.rewardRisk))].sort((a, b) => a - b), maxHoldingBars: [...new Set(stable.map(c => c.maxHoldingBars))].sort((a, b) => a - b) }, grade, warnings };
}
