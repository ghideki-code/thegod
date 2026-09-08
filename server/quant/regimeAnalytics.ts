import type { Candle } from '../../src/types.js';
import type { HistoricalBacktestTrade } from '../backtest/historicalBacktest.js';

export type MarketRegime = 'TREND_BULL' | 'TREND_BEAR' | 'RANGE' | 'HIGH_VOLATILITY' | 'LOW_VOLATILITY' | 'NEUTRAL';
export interface RegimeBucket { regime: MarketRegime; trades: number; wins: number; losses: number; winRatePercent: number; netR: number; expectancyR: number; profitFactor: number; maxDrawdownR: number; }
export interface RegimeAnalyticsResult { buckets: RegimeBucket[]; dominantRegime: MarketRegime; strongestRegime: MarketRegime | null; weakestRegime: MarketRegime | null; warnings: string[]; }
const mean = (values: number[]) => values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
const round = (value: number, digits = 4) => Number((Number.isFinite(value) ? value : 0).toFixed(digits));
function classifyRegime(candles: Candle[], index: number): MarketRegime { const start = Math.max(0, index - 49); const window = candles.slice(start, index + 1); if (window.length < 20) return 'NEUTRAL'; const closes = window.map(c => c.close); const returns = closes.slice(1).map((v, i) => v / closes[i] - 1); const meanReturn = mean(returns); const volatility = Math.sqrt(mean(returns.map(r => (r - meanReturn) ** 2))); const move = closes.at(-1)! / closes[0] - 1; const threshold = Math.max(volatility * 2, 0.0015); if (volatility > 0.008) return 'HIGH_VOLATILITY'; if (volatility < 0.0025) return 'LOW_VOLATILITY'; if (move > threshold * 2) return 'TREND_BULL'; if (move < -threshold * 2) return 'TREND_BEAR'; return 'RANGE'; }
function drawdownR(values: number[]): number { let equity = 0; let peak = 0; let max = 0; for (const value of values) { equity += value; peak = Math.max(peak, equity); max = Math.max(max, peak - equity); } return max; }
export function analyzeRegimes(candles: Candle[], trades: HistoricalBacktestTrade[]): RegimeAnalyticsResult {
  const buckets = new Map<MarketRegime, number[]>();
  for (const trade of trades) {
    let entryIndex = candles.findIndex(c => c.timestamp === trade.timestamp);
    if (entryIndex < 0) entryIndex = candles.findIndex(c => c.timestamp >= trade.timestamp);
    if (entryIndex <= 0) continue;
    // Trade timestamps represent the next candle's entry. Classify the regime
    // using the signal candle immediately before entry to avoid look-ahead.
    const regime = classifyRegime(candles, entryIndex - 1);
    buckets.set(regime, [...(buckets.get(regime) ?? []), trade.pnlR]);
  }
  const allRegimes: MarketRegime[] = ['TREND_BULL', 'TREND_BEAR', 'RANGE', 'HIGH_VOLATILITY', 'LOW_VOLATILITY', 'NEUTRAL'];
  const result = allRegimes.map(regime => { const values = buckets.get(regime) ?? []; const wins = values.filter(v => v > 0).length; const losses = values.filter(v => v < 0).length; const grossWin = values.filter(v => v > 0).reduce((a, b) => a + b, 0); const grossLoss = Math.abs(values.filter(v => v < 0).reduce((a, b) => a + b, 0)); return { regime, trades: values.length, wins, losses, winRatePercent: round(values.length ? wins / values.length * 100 : 0, 2), netR: round(values.reduce((a, b) => a + b, 0)), expectancyR: round(mean(values)), profitFactor: round(grossLoss > 0 ? grossWin / grossLoss : grossWin > 0 ? Infinity : 0), maxDrawdownR: round(drawdownR(values)) }; });
  const active = result.filter(x => x.trades > 0); const strongest = active.filter(x => x.trades >= 5).sort((a, b) => b.expectancyR - a.expectancyR)[0]?.regime ?? null; const weakest = active.filter(x => x.trades >= 5).sort((a, b) => a.expectancyR - b.expectancyR)[0]?.regime ?? null; const dominant = active.sort((a, b) => b.trades - a.trades)[0]?.regime ?? 'NEUTRAL'; const warnings: string[] = [];
  for (const bucket of active) { if (bucket.trades < 5) warnings.push(`${bucket.regime}: amostra pequena (${bucket.trades} trades).`); if (bucket.expectancyR < 0) warnings.push(`${bucket.regime}: expectancy negativa.`); }
  return { buckets: result, dominantRegime: dominant, strongestRegime: strongest, weakestRegime: weakest, warnings };
}
