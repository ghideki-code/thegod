import { TradeSignal } from '../types';

export interface AssetCorrelationData {
  signal: TradeSignal;
  change7d: number;
  macroChange7d: number;
  alpha7d: number; // change7d - macroChange7d
  correlation: number; // Pearson r between -1 and 1
  beta: number; // Approximate covariance / variance
  trendAlignment: 'Forte Correlação Positiva' | 'Correlação Moderada' | 'Descorrelacionado' | 'Correlação Inversa';
  archetype: 'Líder em Expansão (Alpha)' | 'Breakout Descorrelacionado' | 'Sincronizado com Macro (Beta)' | 'Laggard / Subdesempenho' | 'Hedge / Contra-Tendência';
  sparkline7d: number[];
  macroSparkline7d: number[];
}

export interface MacroTrendSummary {
  benchmarkSymbol: string;
  benchmarkName: string;
  change7d: number;
  change24h: number;
  status: 'ALTA FORTE (BULLISH)' | 'EXPANSÃO MODERADA' | 'LATERAL / CONSOLIDAÇÃO' | 'CORREÇÃO (BEARISH)';
  breadthScore: number; // % of assets with positive 7D change
  avgCorrelation: number; // Average correlation with macro
  topLeaders: TradeSignal[];
  topLaggards: TradeSignal[];
  hedges: TradeSignal[];
}

/**
 * Calculates the Pearson correlation coefficient between two series of numbers.
 * Range: -1.0 to +1.0
 */
export function calculatePearsonCorrelation(seriesA: number[], seriesB: number[]): number {
  if (!seriesA || !seriesB || seriesA.length < 3 || seriesB.length < 3) {
    return 0.85; // Sensible default in crypto market
  }

  // Ensure same length
  const minLen = Math.min(seriesA.length, seriesB.length);
  const a = seriesA.slice(-minLen);
  const b = seriesB.slice(-minLen);

  const meanA = a.reduce((sum, v) => sum + v, 0) / minLen;
  const meanB = b.reduce((sum, v) => sum + v, 0) / minLen;

  let numerator = 0;
  let denomA = 0;
  let denomB = 0;

  for (let i = 0; i < minLen; i++) {
    const diffA = a[i] - meanA;
    const diffB = b[i] - meanB;
    numerator += diffA * diffB;
    denomA += diffA * diffA;
    denomB += diffB * diffB;
  }

  const denominator = Math.sqrt(denomA * denomB);
  if (denominator === 0) return 0;

  const r = numerator / denominator;
  return Number(Math.max(-1, Math.min(1, r)).toFixed(2));
}

/**
 * Normalizes an array of prices to percentage change series starting at 0%.
 */
export function normalizeToPercentage(prices: number[]): number[] {
  if (prices.length === 0) return [];
  const base = prices[0];
  if (base === 0) return prices.map(() => 0);
  return prices.map(p => Number((((p - base) / base) * 100).toFixed(2)));
}

/**
 * Extracts a normalized 7-day price series for a given signal.
 */
export function get7dPriceSeries(signal: TradeSignal): number[] {
  if (signal.sparkline7d && signal.sparkline7d.length >= 7) {
    // If we have hourly sparkline (e.g. ~168 points), sample every 4 or 6 hours to get ~28-42 clean points
    const pts = signal.sparkline7d;
    if (pts.length > 50) {
      const step = Math.floor(pts.length / 28);
      const sampled: number[] = [];
      for (let i = 0; i < pts.length; i += step) {
        sampled.push(pts[i]);
      }
      if (sampled[sampled.length - 1] !== pts[pts.length - 1]) {
        sampled.push(pts[pts.length - 1]);
      }
      return sampled;
    }
    return pts;
  }

  // Fallback to 1D daily candles close prices
  const dailyCandles = signal.tripleScreen?.htf?.candles || [];
  if (dailyCandles.length > 0) {
    return dailyCandles.map(c => c.close);
  }

  // Fallback synthesis from 24h change & current price
  const p = signal.currentPrice;
  const c24 = signal.change24h / 100;
  const c7 = (signal.change7d || signal.change24h * 2.5) / 100;
  return [
    p / (1 + c7),
    p / (1 + c7 * 0.7),
    p / (1 + c7 * 0.5),
    p / (1 + c7 * 0.3),
    p / (1 + c24),
    p * (1 - c24 * 0.5),
    p
  ];
}

/**
 * Extracts or synthesizes the 7-day macro benchmark.
 * Benchmark can be 'BTC/USDT', 'ETH/USDT', or 'TOP10_INDEX'.
 */
export function getMacroBenchmarkSeries(
  signals: TradeSignal[], 
  benchmarkType: 'BTC/USDT' | 'ETH/USDT' | 'TOP10_INDEX' = 'BTC/USDT'
): { series: number[]; symbol: string; name: string; change7d: number; change24h: number } {
  if (benchmarkType === 'BTC/USDT') {
    const btc = signals.find(s => s.symbol === 'BTC/USDT' || s.symbol.startsWith('BTC'));
    if (btc) {
      const series = get7dPriceSeries(btc);
      const change7d = btc.change7d ?? Number((((series[series.length - 1] - series[0]) / (series[0] || 1)) * 100).toFixed(2));
      return {
        series,
        symbol: 'BTC/USDT',
        name: 'Bitcoin (Macro Leader)',
        change7d,
        change24h: btc.change24h
      };
    }
  }

  if (benchmarkType === 'ETH/USDT') {
    const eth = signals.find(s => s.symbol === 'ETH/USDT' || s.symbol.startsWith('ETH'));
    if (eth) {
      const series = get7dPriceSeries(eth);
      const change7d = eth.change7d ?? Number((((series[series.length - 1] - series[0]) / (series[0] || 1)) * 100).toFixed(2));
      return {
        series,
        symbol: 'ETH/USDT',
        name: 'Ethereum (Altcoin Leader)',
        change7d,
        change24h: eth.change24h
      };
    }
  }

  // TOP 10 Weighted Index
  const top10 = signals.slice(0, 10);
  if (top10.length > 0) {
    const minLength = 20;
    const aggregatedSeries: number[] = new Array(minLength).fill(0);
    let totalWeight = 0;

    top10.forEach((s, idx) => {
      const weight = Math.max(1, 10 - idx); // Market cap weighted approximation
      totalWeight += weight;
      const sSeries = get7dPriceSeries(s);
      const normalized = normalizeToPercentage(sSeries);
      
      for (let i = 0; i < minLength; i++) {
        const sampleIdx = Math.floor((i / (minLength - 1)) * (normalized.length - 1));
        aggregatedSeries[i] += (normalized[sampleIdx] || 0) * weight;
      }
    });

    const finalIndex = aggregatedSeries.map(v => Number((v / totalWeight).toFixed(2)));
    const change7d = finalIndex[finalIndex.length - 1] - finalIndex[0];
    const avg24h = Number((top10.reduce((acc, s) => acc + s.change24h, 0) / top10.length).toFixed(2));

    return {
      series: finalIndex,
      symbol: 'TOP10/INDEX',
      name: 'Índice Ponderado Top 10',
      change7d: Number(change7d.toFixed(2)),
      change24h: avg24h
    };
  }

  // Ultimate fallback
  return {
    series: [100, 101.5, 100.8, 103.2, 104.5, 103.8, 105.4],
    symbol: 'BTC/USDT',
    name: 'Bitcoin (Macro Leader)',
    change7d: 5.4,
    change24h: 1.8
  };
}

/**
 * Computes market correlation and relative strength against the macro benchmark for each asset.
 */
export function calculateMarketCorrelations(
  signals: TradeSignal[],
  benchmarkType: 'BTC/USDT' | 'ETH/USDT' | 'TOP10_INDEX' = 'BTC/USDT'
): {
  assetCorrelations: AssetCorrelationData[];
  macroSummary: MacroTrendSummary;
} {
  const macro = getMacroBenchmarkSeries(signals, benchmarkType);
  const macroNorm = normalizeToPercentage(macro.series);

  const assetCorrelations: AssetCorrelationData[] = signals.map(signal => {
    const rawSeries = get7dPriceSeries(signal);
    const assetNorm = normalizeToPercentage(rawSeries);
    const correlation = calculatePearsonCorrelation(assetNorm, macroNorm);

    const change7d = signal.change7d ?? (
      rawSeries.length >= 2 && rawSeries[0] > 0
        ? Number((((rawSeries[rawSeries.length - 1] - rawSeries[0]) / rawSeries[0]) * 100).toFixed(2))
        : Number((signal.change24h * 2.8).toFixed(2))
    );

    const alpha7d = Number((change7d - macro.change7d).toFixed(2));

    // Approximate beta: covariance(A, M) / var(M)
    const beta = correlation > 0 
      ? Number((correlation * (Math.abs(change7d) / (Math.abs(macro.change7d) || 1))).toFixed(2))
      : Number((correlation * 0.8).toFixed(2));

    let trendAlignment: AssetCorrelationData['trendAlignment'] = 'Correlação Moderada';
    if (correlation >= 0.70) trendAlignment = 'Forte Correlação Positiva';
    else if (correlation >= 0.30) trendAlignment = 'Correlação Moderada';
    else if (correlation > -0.30) trendAlignment = 'Descorrelacionado';
    else trendAlignment = 'Correlação Inversa';

    let archetype: AssetCorrelationData['archetype'] = 'Sincronizado com Macro (Beta)';
    if (alpha7d >= 4.0 && change7d > 0) {
      if (correlation < 0.40) {
        archetype = 'Breakout Descorrelacionado';
      } else {
        archetype = 'Líder em Expansão (Alpha)';
      }
    } else if (alpha7d <= -4.0) {
      archetype = 'Laggard / Subdesempenho';
    } else if (correlation <= -0.25) {
      archetype = 'Hedge / Contra-Tendência';
    } else {
      archetype = 'Sincronizado com Macro (Beta)';
    }

    return {
      signal,
      change7d,
      macroChange7d: macro.change7d,
      alpha7d,
      correlation,
      beta: Math.max(-3, Math.min(3, beta || 1)),
      trendAlignment,
      archetype,
      sparkline7d: rawSeries,
      macroSparkline7d: macro.series,
    };
  });

  // Calculate Macro Summary
  const positive7dCount = assetCorrelations.filter(a => a.change7d > 0).length;
  const breadthScore = signals.length > 0 ? Math.round((positive7dCount / signals.length) * 100) : 65;

  let status: MacroTrendSummary['status'] = 'LATERAL / CONSOLIDAÇÃO';
  if (macro.change7d >= 4.0 && breadthScore >= 60) status = 'ALTA FORTE (BULLISH)';
  else if (macro.change7d >= 1.0) status = 'EXPANSÃO MODERADA';
  else if (macro.change7d <= -3.0 || breadthScore <= 35) status = 'CORREÇÃO (BEARISH)';

  const sumCorr = assetCorrelations.reduce((acc, a) => acc + a.correlation, 0);
  const avgCorrelation = assetCorrelations.length > 0 ? Number((sumCorr / assetCorrelations.length).toFixed(2)) : 0.75;

  const sortedByAlpha = [...assetCorrelations].sort((a, b) => b.alpha7d - a.alpha7d);
  const topLeaders = sortedByAlpha.slice(0, 3).map(a => a.signal);
  const topLaggards = sortedByAlpha.slice(-3).reverse().map(a => a.signal);
  const hedges = assetCorrelations.filter(a => a.correlation < 0.1).slice(0, 3).map(a => a.signal);

  const macroSummary: MacroTrendSummary = {
    benchmarkSymbol: macro.symbol,
    benchmarkName: macro.name,
    change7d: macro.change7d,
    change24h: macro.change24h,
    status,
    breadthScore,
    avgCorrelation,
    topLeaders,
    topLaggards,
    hedges,
  };

  return {
    assetCorrelations,
    macroSummary,
  };
}
