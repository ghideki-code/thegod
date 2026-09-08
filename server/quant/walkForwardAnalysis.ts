import type { HistoricalBacktestOptions, HistoricalBacktestResult } from '../backtest/historicalBacktest.js';
import { runHistoricalBacktest } from '../backtest/historicalBacktest.js';
import { selectRobustParameters } from './robustParameterSelection.js';
import type { Candle } from '../../src/types.js';

export interface WalkForwardWindow {
  index: number;
  trainStart: string;
  trainEnd: string;
  testStart: string;
  testEnd: string;
  trainTrades: number;
  testTrades: number;
  trainExpectancyR: number;
  testExpectancyR: number;
  trainNetProfitPercent: number;
  testNetProfitPercent: number;
  testProfitFactor: number;
  testMaxDrawdownPercent: number;
  selectedParameters: { minScore: number; minConfidence: number; atrStopMultiple: number; rewardRisk: number; maxHoldingBars: number } | null;
  status: 'PASS' | 'FAIL' | 'INSUFFICIENT_DATA';
}

export interface WalkForwardAnalysisResult {
  windows: WalkForwardWindow[];
  trainBars: number;
  testBars: number;
  stepBars: number;
  adaptive: boolean;
  outOfSampleTrades: number;
  outOfSampleExpectancyR: number;
  outOfSampleNetProfitPercent: number;
  outOfSampleWinRatePercent: number;
  outOfSampleProfitFactor: number;
  outOfSampleMaxDrawdownPercent: number;
  passedWindows: number;
  consistencyPercent: number;
  grade: 'ROBUST' | 'PROMISING' | 'FRAGILE' | 'INSUFFICIENT_DATA';
  warnings: string[];
}

const round = (v: number, d = 4) => Number((Number.isFinite(v) ? v : 0).toFixed(d));
type BacktestParams = Omit<HistoricalBacktestOptions, 'symbol' | 'candles'>;

function runWindow(symbol: string, candles: Candle[], base: BacktestParams): HistoricalBacktestResult {
  return runHistoricalBacktest({ ...base, symbol, candles });
}

function calculateOosMetrics(trades: HistoricalBacktestResult['trades'], riskPerTradePercent: number) {
  let equity = 100;
  let peak = equity;
  let maxDrawdownPercent = 0;
  const riskFraction = Math.max(0.0001, riskPerTradePercent) / 100;
  for (const trade of trades) {
    equity *= Math.max(0, 1 + trade.pnlR * riskFraction);
    peak = Math.max(peak, equity);
    if (peak > 0) maxDrawdownPercent = Math.max(maxDrawdownPercent, (peak - equity) / peak * 100);
  }
  const wins = trades.filter(t => t.pnlR > 0).reduce((a, t) => a + t.pnlR, 0);
  const losses = Math.abs(trades.filter(t => t.pnlR < 0).reduce((a, t) => a + t.pnlR, 0));
  return { netProfitPercent: equity - 100, maxDrawdownPercent, profitFactor: losses > 0 ? wins / losses : wins > 0 ? Infinity : 0 };
}

/** Adaptive rolling walk-forward: each train window selects robust parameters and only then applies them to the following test window. */
export function runWalkForwardAnalysis(symbol: string, candles: Candle[], baseOptions: BacktestParams = {}, trainBars = 2_000, testBars = 500, stepBars = 500): WalkForwardAnalysisResult {
  const sorted = [...candles].sort((a, b) => a.timestamp - b.timestamp);
  const windows: WalkForwardWindow[] = [];
  const allTestTrades: HistoricalBacktestResult['trades'] = [];
  let windowIndex = 0;

  for (let trainStart = 0; trainStart + trainBars + testBars <= sorted.length; trainStart += stepBars) {
    const train = sorted.slice(trainStart, trainStart + trainBars);
    const test = sorted.slice(trainStart + trainBars, trainStart + trainBars + testBars);
    const selection = selectRobustParameters(symbol, train, baseOptions);
    const selected = selection.selected;
    const trainResult = selected
      ? runWindow(symbol, train, { ...baseOptions, minScore: selected.minScore, minConfidence: selected.minConfidence, atrStopMultiple: selected.atrStopMultiple, rewardRisk: selected.rewardRisk, maxHoldingBars: selected.maxHoldingBars })
      : runWindow(symbol, train, baseOptions);
    const testResult = selected
      ? runWindow(symbol, test, { ...baseOptions, minScore: selected.minScore, minConfidence: selected.minConfidence, atrStopMultiple: selected.atrStopMultiple, rewardRisk: selected.rewardRisk, maxHoldingBars: selected.maxHoldingBars })
      : runWindow(symbol, test, baseOptions);
    const enough = !!selected && trainResult.totalTrades >= 20 && testResult.totalTrades >= 10;
    const pass = enough && testResult.expectancyR > 0 && testResult.profitFactor > 1;
    windows.push({
      index: windowIndex++, trainStart: trainResult.startDate, trainEnd: trainResult.endDate, testStart: testResult.startDate, testEnd: testResult.endDate,
      trainTrades: trainResult.totalTrades, testTrades: testResult.totalTrades, trainExpectancyR: round(trainResult.expectancyR), testExpectancyR: round(testResult.expectancyR),
      trainNetProfitPercent: round(trainResult.netProfitPercent, 2), testNetProfitPercent: round(testResult.netProfitPercent, 2), testProfitFactor: round(testResult.profitFactor),
      testMaxDrawdownPercent: round(testResult.maxDrawdownPercent, 2),
      selectedParameters: selected ? { minScore: selected.minScore, minConfidence: selected.minConfidence, atrStopMultiple: selected.atrStopMultiple, rewardRisk: selected.rewardRisk, maxHoldingBars: selected.maxHoldingBars } : null,
      status: !enough ? 'INSUFFICIENT_DATA' : pass ? 'PASS' : 'FAIL',
    });
    allTestTrades.push(...testResult.trades);
  }

  const wins = allTestTrades.filter(t => t.pnlR > 0);
  const losses = allTestTrades.filter(t => t.pnlR < 0);
  const grossWin = wins.reduce((a, t) => a + t.pnlR, 0);
  const grossLoss = Math.abs(losses.reduce((a, t) => a + t.pnlR, 0));
  const oosExpectancy = allTestTrades.length ? allTestTrades.reduce((a, t) => a + t.pnlR, 0) / allTestTrades.length : 0;
  const passed = windows.filter(w => w.status === 'PASS').length;
  const evaluated = windows.filter(w => w.status !== 'INSUFFICIENT_DATA').length;
  const oosMetrics = calculateOosMetrics(allTestTrades, baseOptions.riskPerTradePercent ?? 1);
  const consistency = evaluated ? passed / evaluated * 100 : 0;
  const warnings: string[] = [];
  if (windows.length < 3) warnings.push('Menos de três janelas walk-forward disponíveis.');
  if (allTestTrades.length < 30) warnings.push(`Amostra OOS pequena: ${allTestTrades.length} trades.`);
  if (evaluated && consistency < 60) warnings.push('Menos de 60% das janelas adaptativas foram positivas.');
  if (oosExpectancy <= 0) warnings.push('Expectancy agregada OOS não é positiva.');
  if (windows.some(w => w.selectedParameters === null)) warnings.push('Uma ou mais janelas não encontraram parâmetros robustos no treino.');
  const grade = allTestTrades.length < 30 || evaluated < 3 ? 'INSUFFICIENT_DATA' : consistency >= 75 && oosExpectancy > 0 ? 'ROBUST' : consistency >= 60 && oosExpectancy > 0 ? 'PROMISING' : 'FRAGILE';

  return { windows, trainBars, testBars, stepBars, adaptive: true, outOfSampleTrades: allTestTrades.length, outOfSampleExpectancyR: round(oosExpectancy), outOfSampleNetProfitPercent: round(oosMetrics.netProfitPercent, 2), outOfSampleWinRatePercent: round(allTestTrades.length ? wins.length / allTestTrades.length * 100 : 0, 2), outOfSampleProfitFactor: round(grossLoss > 0 ? grossWin / grossLoss : grossWin > 0 ? Infinity : 0), outOfSampleMaxDrawdownPercent: round(oosMetrics.maxDrawdownPercent, 2), passedWindows: passed, consistencyPercent: round(consistency, 2), grade, warnings };
}
