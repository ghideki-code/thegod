import type { HistoricalBacktestOptions, HistoricalBacktestResult } from '../backtest/historicalBacktest.js';
import { runHistoricalBacktest } from '../backtest/historicalBacktest.js';
import type { Candle } from '../../src/types.js';

export interface StressScenario {
  name: string;
  feeBpsPerSide: number;
  slippageBpsPerSide: number;
  latencySlippageBpsPerSide: number;
  fundingRatePer8h: number;
  result: { trades: number; netProfitPercent: number; expectancyR: number; profitFactor: number; maxDrawdownPercent: number; winRatePercent: number };
  deltaFromBase: { netProfitPercent: number; expectancyR: number; maxDrawdownPercent: number };
  status: 'PASS' | 'DEGRADED' | 'FAIL' | 'INSUFFICIENT_DATA';
}

export interface StressTestResult {
  base: StressScenario;
  scenarios: StressScenario[];
  passedScenarios: number;
  grade: 'RESILIENT' | 'MODERATE' | 'FRAGILE' | 'INSUFFICIENT_DATA';
  warnings: string[];
}

const round = (v: number, d = 4) => Number((Number.isFinite(v) ? v : 0).toFixed(d));
const displayProfitFactor = (v: number) => Number.isFinite(v) ? round(v) : v > 0 ? 99 : 0;

function summarize(result: HistoricalBacktestResult, fee: number, slippage: number, latency: number, funding: number, base?: HistoricalBacktestResult): StressScenario {
  const netDelta = base ? result.netProfitPercent - base.netProfitPercent : 0;
  const expDelta = base ? result.expectancyR - base.expectancyR : 0;
  const ddDelta = base ? result.maxDrawdownPercent - base.maxDrawdownPercent : 0;
  const enough = result.totalTrades >= 30;
  const positive = result.expectancyR > 0 && result.profitFactor > 1;
  const baseExpectancy = base?.expectancyR ?? result.expectancyR;
  const expectancyThreshold = baseExpectancy > 0 ? baseExpectancy * 0.7 : 0;
  const status = !enough ? 'INSUFFICIENT_DATA' : !positive ? 'FAIL' : result.expectancyR >= expectancyThreshold ? 'PASS' : 'DEGRADED';
  return { name: `${fee}bps fee / ${slippage}bps slip / ${latency}bps latency / ${(funding * 100).toFixed(3)}% funding/8h`, feeBpsPerSide: fee, slippageBpsPerSide: slippage, latencySlippageBpsPerSide: latency, fundingRatePer8h: funding, result: { trades: result.totalTrades, netProfitPercent: round(result.netProfitPercent, 2), expectancyR: round(result.expectancyR), profitFactor: displayProfitFactor(result.profitFactor), maxDrawdownPercent: round(result.maxDrawdownPercent, 2), winRatePercent: round(result.winRate, 2) }, deltaFromBase: { netProfitPercent: round(netDelta, 2), expectancyR: round(expDelta), maxDrawdownPercent: round(ddDelta, 2) }, status };
}

export function runStressTest(symbol: string, candles: Candle[], baseOptions: Omit<HistoricalBacktestOptions, 'symbol' | 'candles' | 'feeBpsPerSide' | 'slippageBpsPerSide' | 'latencySlippageBpsPerSide' | 'fundingRatePer8h'> = {}): StressTestResult {
  const baseResult = runHistoricalBacktest({ ...baseOptions, symbol, candles, feeBpsPerSide: 5, slippageBpsPerSide: 2, latencySlippageBpsPerSide: 1, fundingRatePer8h: 0.0001 });
  const scenarios = [
    [7, 3, 1, 0.0001],
    [10, 5, 2, 0.0002],
    [15, 8, 3, 0.0003],
    [20, 10, 5, 0.0005],
  ].map(([fee, slippage, latency, funding]) => summarize(
    runHistoricalBacktest({ ...baseOptions, symbol, candles, feeBpsPerSide: fee, slippageBpsPerSide: slippage, latencySlippageBpsPerSide: latency, fundingRatePer8h: funding }),
    fee, slippage, latency, funding, baseResult,
  ));
  const base = summarize(baseResult, 5, 2, 1, 0.0001);
  const passed = scenarios.filter(s => s.status === 'PASS').length;
  const evaluated = scenarios.filter(s => s.status !== 'INSUFFICIENT_DATA').length;
  const warnings: string[] = [];
  if (base.result.trades < 30) warnings.push('Amostra base inferior a 30 trades.');
  if (evaluated < scenarios.length) warnings.push('Alguns cenários não possuem amostra suficiente.');
  if (scenarios.some(s => s.status === 'FAIL')) warnings.push('A estratégia perde expectancy positiva em pelo menos um cenário de custos.');
  if (scenarios.some(s => s.result.maxDrawdownPercent > 15)) warnings.push('Drawdown acima de 15% em cenário de stress.');
  const grade = base.result.trades < 30 ? 'INSUFFICIENT_DATA' : passed === scenarios.length ? 'RESILIENT' : passed >= 2 ? 'MODERATE' : 'FRAGILE';
  return { base, scenarios, passedScenarios: passed, grade, warnings };
}
