import type { Candle } from '../../src/types.js';
import type { HistoricalFundingRate } from '../derivatives/historicalFundingService.js';
import { calculateIndicators } from '../indicators/technicalIndicators.js';
import { analyzeMarketStructure } from '../structure/marketStructure.js';
import { analyzeSMC } from '../structure/smc.js';
import { detectDivergences } from '../divergence/divergenceEngine.js';
import { analyzeGann } from '../gann/gannEngine.js';
import { analyzeWyckoff } from '../wyckoff/wyckoffEngine.js';
import { calculateConfluence } from '../confluence/confluenceEngine.js';

export interface HistoricalBacktestOptions {
  symbol: string;
  candles: Candle[];
  initialCapital?: number;
  riskPerTradePercent?: number;
  minScore?: number;
  minConfidence?: number;
  atrStopMultiple?: number;
  rewardRisk?: number;
  maxHoldingBars?: number;
  warmupBars?: number;
  feeBpsPerSide?: number;
  slippageBpsPerSide?: number;
  latencySlippageBpsPerSide?: number;
  fundingRatePer8h?: number;
  historicalFunding?: HistoricalFundingRate[];
}

export interface HistoricalBacktestTrade {
  id: string; timestamp: number; date: string; symbol: string; direction: 'LONG' | 'SHORT'; entryPrice: number; exitPrice: number; stopLoss: number; takeProfit: number; rrRatio: number; confidence: number; score: number; grossPnlPercent: number; feePercent: number; slippagePercent: number; pnlPercent: number; pnlR: number; grossPnlR: number; feesR: number; fundingPercent: number; fundingR: number; status: 'TP ATINGIDO' | 'SL ATINGIDO' | 'TIMEOUT'; holdingBars: number;
}

export interface HistoricalBacktestResult {
  symbol: string; timeframe: string; startDate: string; endDate: string; periodDays: number; initialCapital: number; finalCapital: number; totalTrades: number; winningTrades: number; losingTrades: number; winRate: number; profitFactor: number; netProfitPercent: number; grossProfitPercent: number; totalFeesPercent: number; totalSlippagePercent: number; totalFundingPercent: number; maxDrawdownPercent: number; sharpeRatio: number; sortinoRatio: number; averageRR: number; expectancyR: number; grossExpectancyR: number; trades: HistoricalBacktestTrade[]; equityCurve: { date: string; equity: number; tradePnl: number; drawdown: number }[]; costModel: { feeBpsPerSide: number; slippageBpsPerSide: number; latencySlippageBpsPerSide: number; fundingRatePer8h: number; fundingIncluded: boolean; fundingSource: 'historical-binance' | 'proxy' | 'none' };
}

function mean(values: number[]): number { return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0; }
function std(values: number[]): number { if (values.length < 2) return 0; const m = mean(values); return Math.sqrt(mean(values.map(v => (v - m) ** 2))); }
function calculateRatio(values: number[], downsideOnly = false): number { if (values.length < 2) return 0; const filtered = downsideOnly ? values.filter(v => v < 0) : values; const denominator = std(filtered); return denominator === 0 ? 0 : mean(values) / denominator * Math.sqrt(values.length); }
function clampIndex(index: number, length: number): number { return Math.max(0, Math.min(index, length - 1)); }

function historicalFundingSum(funding: HistoricalFundingRate[], entryTimestamp: number, exitTimestamp: number): number {
  if (!funding.length) return 0;
  let total = 0;
  for (const row of funding) {
    if (row.timestamp >= entryTimestamp && row.timestamp <= exitTimestamp) total += row.fundingRate;
  }
  return total;
}

/** Historical simulation uses only candles available at the signal timestamp. */
export function runHistoricalBacktest(options: HistoricalBacktestOptions): HistoricalBacktestResult {
  const candles = [...options.candles].sort((a, b) => a.timestamp - b.timestamp);
  const initialCapital = options.initialCapital ?? 10_000;
  const riskPerTradePercent = options.riskPerTradePercent ?? 1;
  const minScore = options.minScore ?? 35;
  const minConfidence = options.minConfidence ?? 50;
  const atrStopMultiple = options.atrStopMultiple ?? 1.5;
  const rewardRisk = options.rewardRisk ?? 2;
  const maxHoldingBars = options.maxHoldingBars ?? 32;
  const warmupBars = Math.max(options.warmupBars ?? 220, 220);
  const feeBpsPerSide = Math.max(0, options.feeBpsPerSide ?? 5);
  const baseSlippageBpsPerSide = Math.max(0, options.slippageBpsPerSide ?? 2);
  const latencySlippageBpsPerSide = Math.max(0, options.latencySlippageBpsPerSide ?? 1);
  const effectiveSlippageBpsPerSide = baseSlippageBpsPerSide + latencySlippageBpsPerSide;
  const proxyFundingRatePer8h = options.fundingRatePer8h ?? 0.0001;
  const feeRate = feeBpsPerSide / 10_000;
  const slippageRate = effectiveSlippageBpsPerSide / 10_000;
  const fundingRate = Number.isFinite(proxyFundingRatePer8h) ? Math.max(-0.01, Math.min(0.01, proxyFundingRatePer8h)) : 0;
  const historicalFunding = [...(options.historicalFunding ?? [])].filter(r => Number.isFinite(r.timestamp) && Number.isFinite(r.fundingRate)).sort((a, b) => a.timestamp - b.timestamp);
  const hasHistoricalFunding = historicalFunding.length > 0;

  const trades: HistoricalBacktestTrade[] = [];
  const equityCurve: HistoricalBacktestResult['equityCurve'] = [];
  let equity = initialCapital; let peak = equity; let maxDrawdownPercent = 0; let totalFees = 0; let totalSlippage = 0; let totalFunding = 0; let grossProfit = 0; let nextFreeIndex = warmupBars;

  for (let i = warmupBars; i < candles.length - 2; i += 1) {
    if (i < nextFreeIndex) continue;
    const history = candles.slice(0, i + 1);
    const indicators = calculateIndicators(history); const structure = analyzeMarketStructure(history); const smc = analyzeSMC(history, structure, indicators); const divergences = detectDivergences(history, indicators); const gann = analyzeGann(history, structure); const wyckoff = analyzeWyckoff(history, structure, indicators); const confluence = calculateConfluence([{ timeframe: '15m', indicators, structure, smc, divergences, gann, wyckoff }], null);
    if (Math.abs(confluence.score) < minScore || confluence.confidence < minConfidence || confluence.entryQuality === 'avoid') continue;
    const direction: 'LONG' | 'SHORT' = confluence.bias === 'bullish' ? 'LONG' : 'SHORT'; if (confluence.bias === 'neutral') continue;
    const entryIndex = i + 1; const entry = candles[entryIndex]; const atr = indicators.atr14; if (!Number.isFinite(atr) || atr <= 0 || !Number.isFinite(entry.open)) continue;
    const stopDistance = atr * atrStopMultiple; const rawEntryPrice = entry.open; const entryPrice = direction === 'LONG' ? rawEntryPrice * (1 + slippageRate) : rawEntryPrice * (1 - slippageRate); const stopLoss = direction === 'LONG' ? entryPrice - stopDistance : entryPrice + stopDistance; const takeProfit = direction === 'LONG' ? entryPrice + stopDistance * rewardRisk : entryPrice - stopDistance * rewardRisk;
    const lastIndex = clampIndex(entryIndex + maxHoldingBars, candles.length - 1); let rawExitPrice = candles[lastIndex].close; let status: HistoricalBacktestTrade['status'] = 'TIMEOUT'; let exitIndex = lastIndex;
    for (let j = entryIndex; j <= lastIndex; j += 1) { const candle = candles[j]; const hitStop = direction === 'LONG' ? candle.low <= stopLoss : candle.high >= stopLoss; const hitTarget = direction === 'LONG' ? candle.high >= takeProfit : candle.low <= takeProfit; if (hitStop) { rawExitPrice = stopLoss; status = 'SL ATINGIDO'; exitIndex = j; break; } if (hitTarget) { rawExitPrice = takeProfit; status = 'TP ATINGIDO'; exitIndex = j; break; } }
    const exitPrice = direction === 'LONG' ? rawExitPrice * (1 - slippageRate) : rawExitPrice * (1 + slippageRate);
    const units = (equity * (riskPerTradePercent / 100)) / stopDistance; const notionalEntry = units * entryPrice; const notionalExit = units * exitPrice; const grossPnl = direction === 'LONG' ? units * (exitPrice - entryPrice) : units * (entryPrice - exitPrice); const fees = (notionalEntry + notionalExit) * feeRate;
    const slippageCost = units * Math.abs(entryPrice - rawEntryPrice) + units * Math.abs(exitPrice - rawExitPrice);
    const holdingBars = exitIndex - entryIndex + 1;
    const fundingRateApplied = hasHistoricalFunding ? historicalFundingSum(historicalFunding, entry.timestamp, candles[exitIndex].timestamp) : fundingRate * (holdingBars / 32);
    const fundingSignedCost = (direction === 'LONG' ? 1 : -1) * notionalEntry * fundingRateApplied;
    const netPnl = grossPnl - fees - fundingSignedCost;
    const grossPnlPercent = notionalEntry > 0 ? grossPnl / notionalEntry * 100 : 0; const feePercent = notionalEntry > 0 ? fees / notionalEntry * 100 : 0; const slippagePercent = notionalEntry > 0 ? slippageCost / notionalEntry * 100 : 0; const fundingPercent = notionalEntry > 0 ? fundingSignedCost / notionalEntry * 100 : 0; const pnlPercent = notionalEntry > 0 ? netPnl / notionalEntry * 100 : 0;
    const riskCapital = equity * (riskPerTradePercent / 100); const grossPnlR = riskCapital > 0 ? grossPnl / riskCapital : 0; const feesR = riskCapital > 0 ? fees / riskCapital : 0; const fundingR = riskCapital > 0 ? fundingSignedCost / riskCapital : 0; const pnlR = riskCapital > 0 ? netPnl / riskCapital : 0;
    let worstIntratradeEquity = equity; const entryFee = notionalEntry * feeRate;
    for (let j = entryIndex; j <= exitIndex; j += 1) { const candle = candles[j]; const adversePrice = direction === 'LONG' ? candle.low : candle.high; const unrealizedPnl = direction === 'LONG' ? units * (adversePrice - entryPrice) : units * (entryPrice - adversePrice); worstIntratradeEquity = Math.min(worstIntratradeEquity, equity + unrealizedPnl - entryFee); }
    if (peak > 0) maxDrawdownPercent = Math.max(maxDrawdownPercent, Math.max(0, (peak - worstIntratradeEquity) / peak * 100));
    equity += netPnl; totalFees += fees; totalSlippage += slippageCost; totalFunding += fundingSignedCost; if (grossPnl > 0) grossProfit += grossPnl; peak = Math.max(peak, equity); const drawdown = peak > 0 ? (peak - equity) / peak * 100 : 0; maxDrawdownPercent = Math.max(maxDrawdownPercent, drawdown);
    const date = new Date(entry.timestamp).toISOString().slice(0, 10); trades.push({ id: `${options.symbol.replace('/', '')}-${entry.timestamp}`, timestamp: entry.timestamp, date, symbol: options.symbol, direction, entryPrice, exitPrice, stopLoss, takeProfit, rrRatio: rewardRisk, confidence: confluence.confidence, score: confluence.score, grossPnlPercent, feePercent, slippagePercent, pnlPercent, pnlR, grossPnlR, feesR, fundingPercent, fundingR, status, holdingBars }); equityCurve.push({ date, equity, tradePnl: netPnl, drawdown }); nextFreeIndex = exitIndex + 1;
  }
  const rValues = trades.map(t => t.pnlR); const grossRValues = trades.map(t => t.grossPnlR); const wins = trades.filter(t => t.pnlR > 0); const losses = trades.filter(t => t.pnlR < 0); const netRProfit = wins.reduce((sum, t) => sum + t.pnlR, 0); const netRLoss = Math.abs(losses.reduce((sum, t) => sum + t.pnlR, 0)); const start = candles[0]?.timestamp ?? Date.now(); const end = candles[candles.length - 1]?.timestamp ?? start; const periodDays = Math.max(0, (end - start) / 86_400_000);
  return { symbol: options.symbol, timeframe: '15m', startDate: new Date(start).toISOString(), endDate: new Date(end).toISOString(), periodDays, initialCapital, finalCapital: equity, totalTrades: trades.length, winningTrades: wins.length, losingTrades: losses.length, winRate: trades.length ? wins.length / trades.length * 100 : 0, profitFactor: netRLoss > 0 ? netRProfit / netRLoss : netRProfit > 0 ? Infinity : 0, netProfitPercent: (equity - initialCapital) / initialCapital * 100, grossProfitPercent: initialCapital > 0 ? grossProfit / initialCapital * 100 : 0, totalFeesPercent: initialCapital > 0 ? totalFees / initialCapital * 100 : 0, totalSlippagePercent: initialCapital > 0 ? totalSlippage / initialCapital * 100 : 0, totalFundingPercent: initialCapital > 0 ? totalFunding / initialCapital * 100 : 0, maxDrawdownPercent, sharpeRatio: calculateRatio(rValues), sortinoRatio: calculateRatio(rValues, true), averageRR: mean(rValues), expectancyR: mean(rValues), grossExpectancyR: mean(grossRValues), trades, equityCurve, costModel: { feeBpsPerSide, slippageBpsPerSide: baseSlippageBpsPerSide, latencySlippageBpsPerSide, fundingRatePer8h: hasHistoricalFunding ? 0 : fundingRate, fundingIncluded: hasHistoricalFunding || fundingRate !== 0, fundingSource: hasHistoricalFunding ? 'historical-binance' : fundingRate !== 0 ? 'proxy' : 'none' } };
}
