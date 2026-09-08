import type { HistoricalBacktestTrade } from '../backtest/historicalBacktest.js';

export interface RobustnessAnalysisResult {
  sampleSize: number;
  positiveExpectancy: boolean;
  profitFactorAboveOne: boolean;
  bootstrapExpectancy95: { low: number; high: number } | null;
  stabilityScore: number;
  grade: 'ROBUST' | 'MODERATE' | 'FRAGILE' | 'INSUFFICIENT_DATA';
  checks: string[];
  warnings: string[];
}

const round = (v: number, d = 4) => Number((Number.isFinite(v) ? v : 0).toFixed(d));

function mean(values: number[]): number {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
}

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function bootstrap(values: number[], iterations = 2000, seed = 20260908): { low: number; high: number } | null {
  if (values.length < 30) return null;
  const random = seededRandom(seed + values.length);
  const samples = new Array<number>(iterations);
  for (let i = 0; i < iterations; i++) {
    let total = 0;
    for (let j = 0; j < values.length; j++) total += values[Math.floor(random() * values.length)];
    samples[i] = total / values.length;
  }
  samples.sort((a, b) => a - b);
  return { low: samples[Math.floor(iterations * 0.025)], high: samples[Math.floor(iterations * 0.975)] };
}

export function analyzeRobustness(trades: HistoricalBacktestTrade[]): RobustnessAnalysisResult {
  const values = trades.map(t => t.pnlR).filter(Number.isFinite);
  if (values.length < 30) {
    return {
      sampleSize: values.length,
      positiveExpectancy: mean(values) > 0,
      profitFactorAboveOne: false,
      bootstrapExpectancy95: null,
      stabilityScore: 0,
      grade: 'INSUFFICIENT_DATA',
      checks: [],
      warnings: ['São necessários pelo menos 30 trades para a análise de robustez.'],
    };
  }
  const wins = values.filter(v => v > 0).reduce((a, b) => a + b, 0);
  const losses = Math.abs(values.filter(v => v < 0).reduce((a, b) => a + b, 0));
  const pf = losses > 0 ? wins / losses : Infinity;
  const expectancy = mean(values);
  const bootstrapCi = bootstrap(values);
  const checks: string[] = [];
  const warnings: string[] = [];
  let score = 0;
  if (expectancy > 0) { score += 25; checks.push('Expectancy histórica positiva.'); } else warnings.push('Expectancy histórica negativa.');
  if (pf > 1.2) { score += 25; checks.push('Profit Factor acima de 1.20.'); } else warnings.push('Profit Factor não supera 1.20.');
  if (bootstrapCi && bootstrapCi.low > 0) { score += 30; checks.push('Bootstrap 95% da expectancy permanece acima de zero.'); } else warnings.push('Bootstrap 95% ainda inclui expectancy não positiva.');
  const median = [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
  if (Math.sign(expectancy) === Math.sign(median) && median > 0) { score += 10; checks.push('Mediana e média possuem sinal positivo.'); } else warnings.push('Distribuição não confirma claramente a vantagem pela mediana.');
  const firstHalf = mean(values.slice(0, Math.floor(values.length / 2)));
  const secondHalf = mean(values.slice(Math.floor(values.length / 2)));
  if (firstHalf > 0 && secondHalf > 0) { score += 10; checks.push('Expectancy positiva nas duas metades da amostra.'); } else warnings.push('Uma das metades da amostra apresenta expectancy não positiva.');
  const grade = score >= 80 ? 'ROBUST' : score >= 55 ? 'MODERATE' : 'FRAGILE';
  return {
    sampleSize: values.length,
    positiveExpectancy: expectancy > 0,
    profitFactorAboveOne: pf > 1,
    bootstrapExpectancy95: bootstrapCi ? { low: round(bootstrapCi.low), high: round(bootstrapCi.high) } : null,
    stabilityScore: score,
    grade,
    checks,
    warnings,
  };
}
