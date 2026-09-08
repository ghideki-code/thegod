import { Candle, TradeSignal, SqueezeBreakoutAnalysis, FibonacciTarget } from '../types';

export type ChartTimeframe = 
  | '3m' 
  | '5m' 
  | '15m' 
  | '30m' 
  | '1h' 
  | '2h' 
  | '8h' 
  | '12h' 
  | '1d' 
  | '3d' 
  | '5d' 
  | '1w' 
  | '2w';

export interface TimeframeMeta {
  id: ChartTimeframe;
  label: string;
  fullName: string;
  category: 'SCALP' | 'DAY_TRADE' | 'SWING_TRADE' | 'POSITION_TRADE';
  durationMs: number;
  barVolatilityScale: number;
  description: string;
}

export const TIMEFRAMES_LIST: TimeframeMeta[] = [
  {
    id: '3m',
    label: '3m',
    fullName: '3 Minutos',
    category: 'SCALP',
    durationMs: 3 * 60 * 1000,
    barVolatilityScale: 0.15,
    description: 'Microestrutura de fluxo & Scalping Ultra-Rápido',
  },
  {
    id: '5m',
    label: '5m',
    fullName: '5 Minutos',
    category: 'SCALP',
    durationMs: 5 * 60 * 1000,
    barVolatilityScale: 0.20,
    description: 'Gatilho de entrada micro & Absorção de ordens',
  },
  {
    id: '15m',
    label: '15m',
    fullName: '15 Minutos',
    category: 'SCALP',
    durationMs: 15 * 60 * 1000,
    barVolatilityScale: 0.35,
    description: 'Microscópio institucional LTF & Cruzamento EMA 9/21',
  },
  {
    id: '30m',
    label: '30m',
    fullName: '30 Minutos',
    category: 'SCALP',
    durationMs: 30 * 60 * 1000,
    barVolatilityScale: 0.50,
    description: 'Transição entre Scalp e Day Trade & FVG imediato',
  },
  {
    id: '1h',
    label: '1h',
    fullName: '1 Hora',
    category: 'DAY_TRADE',
    durationMs: 60 * 60 * 1000,
    barVolatilityScale: 0.70,
    description: 'Estrutura MTF clássica & Suporte Dinâmico EMA 50',
  },
  {
    id: '2h',
    label: '2h',
    fullName: '2 Horas',
    category: 'DAY_TRADE',
    durationMs: 2 * 60 * 60 * 1000,
    barVolatilityScale: 0.85,
    description: 'Consolidação intradiária & Liquidity Sweeps de sessão',
  },
  {
    id: '8h',
    label: '8h',
    fullName: '8 Horas',
    category: 'DAY_TRADE',
    durationMs: 8 * 60 * 60 * 1000,
    barVolatilityScale: 1.10,
    description: 'Ciclos de Funding Rate (8h) & Equilíbrio de Derivativos',
  },
  {
    id: '12h',
    label: '12h',
    fullName: '12 Horas',
    category: 'DAY_TRADE',
    durationMs: 12 * 60 * 60 * 1000,
    barVolatilityScale: 1.25,
    description: 'Sessão Semidiária & Ponto de inflexão de momentum',
  },
  {
    id: '1d',
    label: '1d',
    fullName: '1 Dia (Diário)',
    category: 'SWING_TRADE',
    durationMs: 24 * 60 * 60 * 1000,
    barVolatilityScale: 1.50,
    description: 'HTF Primário: Tendência Institucional & EMA 50/200',
  },
  {
    id: '3d',
    label: '3d',
    fullName: '3 Dias',
    category: 'SWING_TRADE',
    durationMs: 3 * 24 * 60 * 1000,
    barVolatilityScale: 2.00,
    description: 'Filtro anti-ruído para Swing Trade & Wyckoff Phase',
  },
  {
    id: '5d',
    label: '5d',
    fullName: '5 Dias',
    category: 'SWING_TRADE',
    durationMs: 5 * 24 * 60 * 1000,
    barVolatilityScale: 2.40,
    description: 'Estrutura semanal expandida & Grandes Order Blocks',
  },
  {
    id: '1w',
    label: '1w',
    fullName: '1 Semana',
    category: 'POSITION_TRADE',
    durationMs: 7 * 24 * 60 * 1000,
    barVolatilityScale: 2.80,
    description: 'Macro Institucional & Níveis VAH/VAL Semanais',
  },
  {
    id: '2w',
    label: '2w',
    fullName: '2 Semanas',
    category: 'POSITION_TRADE',
    durationMs: 14 * 24 * 60 * 1000,
    barVolatilityScale: 3.50,
    description: 'Ciclo Macro de Halving / Regime de Mercado Global',
  },
];

export function getTimeframeMeta(id: ChartTimeframe): TimeframeMeta {
  return TIMEFRAMES_LIST.find((t) => t.id === id) || TIMEFRAMES_LIST[4];
}

/**
 * Generates realistic candlestick price action for any timeframe anchored on the signal price
 */
export function generateCandlesForTimeframe(
  signal: TradeSignal,
  tf: ChartTimeframe,
  barCount = 32
): Candle[] {
  const meta = getTimeframeMeta(tf);
  const now = Date.now();
  const currentPrice = signal.currentPrice || 100;
  const change24h = signal.change24h || 0;
  const atr = signal.atrValue || currentPrice * 0.025;

  // Check if signal has native pre-built candles matching standard HTF/MTF/LTF
  if (tf === '1d' && signal.tripleScreen?.htf?.candles?.length >= 20) {
    return signal.tripleScreen.htf.candles;
  }
  if (tf === '1h' && signal.tripleScreen?.mtf?.candles?.length >= 20) {
    return signal.tripleScreen.mtf.candles;
  }
  if (tf === '15m' && signal.tripleScreen?.ltf?.candles?.length >= 20) {
    return signal.tripleScreen.ltf.candles;
  }

  // Derive candles with appropriate volatility scale
  const result: Candle[] = [];
  const barVolatility = Math.max(currentPrice * 0.002, atr * meta.barVolatilityScale * 0.35);
  
  // Seed path using sparkline if available, or generate synthetic realistic drift
  const sparkline = signal.sparkline7d || [];
  let runningPrice = currentPrice;

  // Work backwards from current price
  const tempCandles: { open: number; high: number; low: number; close: number; time: number; vol: number }[] = [];

  for (let i = 0; i < barCount; i++) {
    const time = now - i * meta.durationMs;
    const timeStr = formatCandleTime(time, tf);

    // Calculate realistic bar range
    const cycle = Math.sin((barCount - i) * 0.5) * barVolatility * 0.7;
    const noise = (Math.cos(i * 1.3) + Math.sin(i * 0.8)) * barVolatility * 0.5;
    const trendOffset = ((barCount - 1 - i) / barCount) * (change24h / 100) * currentPrice * 0.4;

    const closePrice = i === 0 ? currentPrice : runningPrice;
    const openPrice = closePrice - cycle - noise * 0.6;
    
    // Calculate high and low wicks
    const wickHigh = Math.abs(noise * 0.8) + barVolatility * 0.25;
    const wickLow = Math.abs(cycle * 0.8) + barVolatility * 0.25;
    
    const high = Math.max(openPrice, closePrice) + wickHigh;
    const low = Math.min(openPrice, closePrice) - wickLow;
    
    const volume = Math.round((currentPrice * 100) * (1 + Math.abs(noise) / (barVolatility || 1)));

    tempCandles.push({
      time,
      open: Number(openPrice.toFixed(openPrice >= 1 ? 2 : 5)),
      high: Number(high.toFixed(high >= 1 ? 2 : 5)),
      low: Number(low.toFixed(low >= 1 ? 2 : 5)),
      close: Number(closePrice.toFixed(closePrice >= 1 ? 2 : 5)),
      vol: volume,
    });

    // Prepare previous close
    runningPrice = openPrice;
  }

  // Reverse so candles are in chronological order (oldest -> newest)
  tempCandles.reverse();

  tempCandles.forEach((c) => {
    result.push({
      timestamp: c.time,
      timeStr: formatCandleTime(c.time, tf),
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
      volume: c.vol,
    });
  });

  return result;
}

function formatCandleTime(ts: number, tf: ChartTimeframe): string {
  const d = new Date(ts);
  // Timezone BRT UTC-3
  const brt = new Date(d.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  const hours = String(brt.getHours()).padStart(2, '0');
  const minutes = String(brt.getMinutes()).padStart(2, '0');
  const day = String(brt.getDate()).padStart(2, '0');
  const month = String(brt.getMonth() + 1).padStart(2, '0');

  if (['3m', '5m', '15m', '30m', '1h', '2h'].includes(tf)) {
    return `${hours}:${minutes}`;
  }
  if (['8h', '12h', '1d'].includes(tf)) {
    return `${day}/${month} ${hours}h`;
  }
  return `${day}/${month}`;
}

/**
 * Calculates RSI (Relative Strength Index) for a series of candles
 */
export function calculateRsi(candles: Candle[], period = 14): number[] {
  if (candles.length <= 1) return [50];
  const closes = candles.map((c) => c.close);
  const rsi: number[] = [];

  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= Math.min(period, closes.length - 1); i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gains += diff;
    else losses += Math.abs(diff);
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  const firstRs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  rsi.push(Number((100 - 100 / (1 + firstRs)).toFixed(2)));

  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? Math.abs(diff) : 0;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;

    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    const rsiVal = avgLoss === 0 ? 100 : 100 - 100 / (1 + rs);
    rsi.push(Number(rsiVal.toFixed(2)));
  }

  // Pad beginning if needed
  while (rsi.length < candles.length) {
    rsi.unshift(50);
  }

  return rsi;
}

/**
 * Calculates Stochastic RSI (%K, %D)
 */
export function calculateStochRsi(
  rsiValues: number[],
  period = 14,
  kPeriod = 3,
  dPeriod = 3
): { k: number[]; d: number[] } {
  const rawStoch: number[] = [];

  for (let i = 0; i < rsiValues.length; i++) {
    if (i < period - 1) {
      rawStoch.push(50);
      continue;
    }
    const window = rsiValues.slice(i - period + 1, i + 1);
    const minRsi = Math.min(...window);
    const maxRsi = Math.max(...window);
    const denom = maxRsi - minRsi;
    const currentRsi = rsiValues[i];

    const val = denom === 0 ? 50 : ((currentRsi - minRsi) / denom) * 100;
    rawStoch.push(Math.max(0, Math.min(100, val)));
  }

  // Smooth %K with 3-period SMA
  const k: number[] = [];
  for (let i = 0; i < rawStoch.length; i++) {
    if (i < kPeriod - 1) {
      k.push(rawStoch[i]);
      continue;
    }
    const sum = rawStoch.slice(i - kPeriod + 1, i + 1).reduce((a, b) => a + b, 0);
    k.push(Number((sum / kPeriod).toFixed(2)));
  }

  // Smooth %D with 3-period SMA of %K
  const d: number[] = [];
  for (let i = 0; i < k.length; i++) {
    if (i < dPeriod - 1) {
      d.push(k[i]);
      continue;
    }
    const sum = k.slice(i - dPeriod + 1, i + 1).reduce((a, b) => a + b, 0);
    d.push(Number((sum / dPeriod).toFixed(2)));
  }

  return { k, d };
}

export interface RsiDivergenceResult {
  hasDivergence: boolean;
  type: 
    | 'BULLISH_REGULAR' 
    | 'BEARISH_REGULAR' 
    | 'HIDDEN_BULLISH' 
    | 'HIDDEN_BEARISH' 
    | 'NONE';
  title: string;
  strength: 'ALTA' | 'MODERADA' | 'NEUTRA';
  badgeColor: string;
  rsiCurrent: number;
  rsiZone: 'SOBRECOMPRA' | 'SOBREVENDA' | 'NEUTRO';
  description: string;
  tradingImplication: string;
  swingDetails: {
    price1: number;
    price2: number;
    rsi1: number;
    rsi2: number;
  };
}

export interface StochasticEvaluation {
  k: number;
  d: number;
  status: 'SOBRECOMPRADO' | 'SOBREVENDIDO' | 'NEUTRO';
  statusLabel: string;
  crossover: 'CRUZAMENTO_BULLISH' | 'CRUZAMENTO_BEARISH' | 'ALINHADO_ALTA' | 'ALINHADO_BAIXA';
  crossoverLabel: string;
  momentum: 'ALTA' | 'BAIXA' | 'NEUTRO';
  badgeColor: string;
  description: string;
}

export interface MacdResult {
  macdLine: number;
  signalLine: number;
  histogram: number;
  prevHistogram: number;
  trend: 'ALTA' | 'BAIXA' | 'NEUTRO';
  crossover: 'CRUZAMENTO_BULLISH' | 'CRUZAMENTO_BEARISH' | 'ALINHADO_ALTA' | 'ALINHADO_BAIXA';
  crossoverLabel: string;
  zeroLineState: 'ACIMA_DE_ZERO' | 'ABAIXO_DE_ZERO' | 'NA_LINHA_ZERO';
  histogramState: 'EXPANSAO_ALTA' | 'DESACELERACAO_ALTA' | 'EXPANSAO_BAIXA' | 'DESACELERACAO_BAIXA';
  histogramStateLabel: string;
  badgeColor: string;
  description: string;
  series: {
    macd: number[];
    signal: number[];
    histogram: number[];
  };
}

export interface DivergenceResult {
  hasDivergence: boolean;
  type: 
    | 'BULLISH_REGULAR' 
    | 'BEARISH_REGULAR' 
    | 'HIDDEN_BULLISH' 
    | 'HIDDEN_BEARISH' 
    | 'NONE';
  title: string;
  confluence: 'DUAL' | 'RSI_ONLY' | 'STOCH_ONLY' | 'NONE';
  strength: 'ALTA' | 'MODERADA' | 'NEUTRA';
  badgeColor: string;
  rsiCurrent: number;
  stochKCurrent: number;
  stochDCurrent: number;
  description: string;
  tradingImplication: string;
  swingDetails: {
    price1: number;
    price2: number;
    rsi1: number;
    rsi2: number;
    stoch1: number;
    stoch2: number;
  };
  rsiDivergence: RsiDivergenceResult;
  stochastic: StochasticEvaluation;
  macd: MacdResult;
}

/**
 * Calculates MACD (12, 26, 9) on candlestick data
 */
export function calculateMacd(
  candles: Candle[],
  fastPeriod = 12,
  slowPeriod = 26,
  signalPeriod = 9
): MacdResult {
  if (candles.length < 2) {
    return {
      macdLine: 0,
      signalLine: 0,
      histogram: 0,
      prevHistogram: 0,
      trend: 'NEUTRO',
      crossover: 'ALINHADO_ALTA',
      crossoverLabel: 'Dados Insuficientes',
      zeroLineState: 'NA_LINHA_ZERO',
      histogramState: 'DESACELERACAO_ALTA',
      histogramStateLabel: 'Neutro',
      badgeColor: 'bg-slate-800 text-slate-400 border-slate-700',
      description: 'Aguardando mais barras para cálculo do MACD.',
      series: { macd: [0], signal: [0], histogram: [0] }
    };
  }

  const closes = candles.map((c) => c.close);

  const computeEma = (data: number[], period: number): number[] => {
    const k = 2 / (period + 1);
    const ema: number[] = [];
    let prev = data[0];
    for (let i = 0; i < data.length; i++) {
      if (i === 0) {
        ema.push(data[0]);
      } else {
        prev = (data[i] - prev) * k + prev;
        ema.push(Number(prev.toFixed(prev > 10 ? 2 : 4)));
      }
    }
    return ema;
  };

  const emaFast = computeEma(closes, fastPeriod);
  const emaSlow = computeEma(closes, slowPeriod);

  const macdSeries: number[] = closes.map((_, i) => Number((emaFast[i] - emaSlow[i]).toFixed(closes[i] > 10 ? 2 : 4)));
  const signalSeries = computeEma(macdSeries, signalPeriod);
  const histogramSeries: number[] = macdSeries.map((m, i) => Number((m - signalSeries[i]).toFixed(closes[i] > 10 ? 2 : 4)));

  const len = macdSeries.length;
  const macdLine = macdSeries[len - 1] ?? 0;
  const signalLine = signalSeries[len - 1] ?? 0;
  const histogram = histogramSeries[len - 1] ?? 0;
  const prevHistogram = histogramSeries[len - 2] ?? histogram;
  const prevMacd = macdSeries[len - 2] ?? macdLine;
  const prevSignal = signalSeries[len - 2] ?? signalLine;

  let crossover: 'CRUZAMENTO_BULLISH' | 'CRUZAMENTO_BEARISH' | 'ALINHADO_ALTA' | 'ALINHADO_BAIXA' = 'ALINHADO_ALTA';
  let crossoverLabel = 'MACD acima da Linha de Sinal';
  if (prevMacd <= prevSignal && macdLine > signalLine) {
    crossover = 'CRUZAMENTO_BULLISH';
    crossoverLabel = 'Cruzamento de Alta Recente (Bullish Cross)';
  } else if (prevMacd >= prevSignal && macdLine < signalLine) {
    crossover = 'CRUZAMENTO_BEARISH';
    crossoverLabel = 'Cruzamento de Baixa Recente (Bearish Cross)';
  } else if (macdLine > signalLine) {
    crossover = 'ALINHADO_ALTA';
    crossoverLabel = 'Alinhado em Alta (MACD > Sinal)';
  } else {
    crossover = 'ALINHADO_BAIXA';
    crossoverLabel = 'Alinhado em Baixa (MACD < Sinal)';
  }

  const zeroLineState = macdLine > 0.0001 ? 'ACIMA_DE_ZERO' : macdLine < -0.0001 ? 'ABAIXO_DE_ZERO' : 'NA_LINHA_ZERO';

  let histogramState: 'EXPANSAO_ALTA' | 'DESACELERACAO_ALTA' | 'EXPANSAO_BAIXA' | 'DESACELERACAO_BAIXA' = 'EXPANSAO_ALTA';
  let histogramStateLabel = 'Histograma Positivo em Expansão';
  if (histogram >= 0) {
    if (histogram >= prevHistogram) {
      histogramState = 'EXPANSAO_ALTA';
      histogramStateLabel = 'Positivo em Expansão (Aceleração Compradora)';
    } else {
      histogramState = 'DESACELERACAO_ALTA';
      histogramStateLabel = 'Positivo em Contração (Perda de Impulso Comprador)';
    }
  } else {
    if (histogram <= prevHistogram) {
      histogramState = 'EXPANSAO_BAIXA';
      histogramStateLabel = 'Negativo em Expansão (Aceleração Vendedora)';
    } else {
      histogramState = 'DESACELERACAO_BAIXA';
      histogramStateLabel = 'Negativo em Contração (Exaustão da Pressão Vendedora)';
    }
  }

  const trend = macdLine > signalLine && histogram >= 0 ? 'ALTA' : macdLine < signalLine && histogram <= 0 ? 'BAIXA' : 'NEUTRO';

  let badgeColor = 'bg-slate-800 text-slate-300 border-slate-700';
  if (crossover === 'CRUZAMENTO_BULLISH' || (trend === 'ALTA' && zeroLineState === 'ACIMA_DE_ZERO')) {
    badgeColor = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
  } else if (crossover === 'CRUZAMENTO_BEARISH' || (trend === 'BAIXA' && zeroLineState === 'ABAIXO_DE_ZERO')) {
    badgeColor = 'bg-rose-500/20 text-rose-300 border-rose-500/40';
  } else if (trend === 'ALTA') {
    badgeColor = 'bg-sky-500/20 text-sky-300 border-sky-500/40';
  } else if (trend === 'BAIXA') {
    badgeColor = 'bg-amber-500/20 text-amber-300 border-amber-500/40';
  }

  const description = `Linha MACD (${macdLine > 0 ? '+' : ''}${macdLine}) vs Sinal (${signalLine > 0 ? '+' : ''}${signalLine}). Histograma de ${histogram > 0 ? '+' : ''}${histogram} (${histogramStateLabel.split('(')[0].trim()}). Posição ${zeroLineState === 'ACIMA_DE_ZERO' ? 'acima da linha zero (viés estrutural altista)' : zeroLineState === 'ABAIXO_DE_ZERO' ? 'abaixo da linha zero (viés estrutural baixista)' : 'na zona de equilíbrio zero'}.`;

  return {
    macdLine,
    signalLine,
    histogram,
    prevHistogram,
    trend,
    crossover,
    crossoverLabel,
    zeroLineState,
    histogramState,
    histogramStateLabel,
    badgeColor,
    description,
    series: {
      macd: macdSeries,
      signal: signalSeries,
      histogram: histogramSeries
    }
  };
}

/**
 * Evaluates Stochastic RSI independently (momento rápido, sobrecompra/sobrevenda e cruzamento)
 */
export function evaluateStochastic(
  stochKValues: number[],
  stochDValues: number[]
): StochasticEvaluation {
  const len = stochKValues.length;
  const k = stochKValues[len - 1] ?? 50;
  const d = stochDValues[len - 1] ?? 50;
  const prevK = stochKValues[len - 2] ?? k;
  const prevD = stochDValues[len - 2] ?? d;

  let status: 'SOBRECOMPRADO' | 'SOBREVENDIDO' | 'NEUTRO' = 'NEUTRO';
  let statusLabel = 'Faixa Neutra de Oscilação (20 - 80)';
  if (k >= 80 || d >= 80) {
    status = 'SOBRECOMPRADO';
    statusLabel = 'Zona de Sobrecompra (>80) - Risco de Exaustão';
  } else if (k <= 20 || d <= 20) {
    status = 'SOBREVENDIDO';
    statusLabel = 'Zona de Sobrevenda (<20) - Alerta de Fundo / Repique';
  }

  let crossover: 'CRUZAMENTO_BULLISH' | 'CRUZAMENTO_BEARISH' | 'ALINHADO_ALTA' | 'ALINHADO_BAIXA' = 'ALINHADO_ALTA';
  let crossoverLabel = '%K mantendo-se acima de %D';
  if (prevK <= prevD && k > d) {
    crossover = 'CRUZAMENTO_BULLISH';
    crossoverLabel = 'Cruzamento de Alta (%K cortou %D para cima)';
  } else if (prevK >= prevD && k < d) {
    crossover = 'CRUZAMENTO_BEARISH';
    crossoverLabel = 'Cruzamento de Baixa (%K cortou %D para baixo)';
  } else if (k > d) {
    crossover = 'ALINHADO_ALTA';
    crossoverLabel = 'Alinhado em Alta (%K > %D)';
  } else {
    crossover = 'ALINHADO_BAIXA';
    crossoverLabel = 'Alinhado em Baixa (%K < %D)';
  }

  const momentum = k > d && k > 50 ? 'ALTA' : k < d && k < 50 ? 'BAIXA' : 'NEUTRO';

  let badgeColor = 'bg-slate-800 text-slate-300 border-slate-700';
  if (status === 'SOBREVENDIDO' && crossover === 'CRUZAMENTO_BULLISH') {
    badgeColor = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
  } else if (status === 'SOBRECOMPRADO' && crossover === 'CRUZAMENTO_BEARISH') {
    badgeColor = 'bg-rose-500/20 text-rose-300 border-rose-500/40';
  } else if (k > d) {
    badgeColor = 'bg-sky-500/20 text-sky-300 border-sky-500/40';
  } else {
    badgeColor = 'bg-amber-500/20 text-amber-300 border-amber-500/40';
  }

  const description = `Estocástico Rápido %K em ${k.toFixed(1)} e Média %D em ${d.toFixed(1)}. ${statusLabel}. ${crossoverLabel}.`;

  return {
    k,
    d,
    status,
    statusLabel,
    crossover,
    crossoverLabel,
    momentum,
    badgeColor,
    description
  };
}

/**
 * Detects divergence STRICTLY between Price Action and RSI (14)
 */
export function detectPriceRsiDivergence(
  candles: Candle[],
  rsiValues: number[]
): RsiDivergenceResult {
  const len = candles.length;
  if (len < 16) {
    return {
      hasDivergence: false,
      type: 'NONE',
      title: 'Amostra Insuficiente',
      strength: 'NEUTRA',
      badgeColor: 'bg-slate-800 text-slate-400 border-slate-700',
      rsiCurrent: 50,
      rsiZone: 'NEUTRO',
      description: 'Aguardando mais candles no tempo gráfico para consolidação de pivôs entre Preço e RSI.',
      tradingImplication: 'Acompanhe a consolidação dos pivôs no gráfico.',
      swingDetails: { price1: 0, price2: 0, rsi1: 50, rsi2: 50 }
    };
  }

  const latestRsi = rsiValues[rsiValues.length - 1] ?? 50;
  const rsiZone = latestRsi >= 70 ? 'SOBRECOMPRA' : latestRsi <= 30 ? 'SOBREVENDA' : 'NEUTRO';

  // Inspect two recent price swings (lows and highs) over the last 16 bars
  const windowCandles = candles.slice(-16);
  const windowRsi = rsiValues.slice(-16);

  // Find pivot lows
  let minIdx1 = 0;
  let minPrice1 = windowCandles[0].low;
  for (let i = 0; i < 8; i++) {
    if (windowCandles[i].low < minPrice1) {
      minPrice1 = windowCandles[i].low;
      minIdx1 = i;
    }
  }

  let minIdx2 = 8;
  let minPrice2 = windowCandles[8].low;
  for (let i = 8; i < windowCandles.length; i++) {
    if (windowCandles[i].low < minPrice2) {
      minPrice2 = windowCandles[i].low;
      minIdx2 = i;
    }
  }

  // Find pivot highs
  let maxIdx1 = 0;
  let maxPrice1 = windowCandles[0].high;
  for (let i = 0; i < 8; i++) {
    if (windowCandles[i].high > maxPrice1) {
      maxPrice1 = windowCandles[i].high;
      maxIdx1 = i;
    }
  }

  let maxIdx2 = 8;
  let maxPrice2 = windowCandles[8].high;
  for (let i = 8; i < windowCandles.length; i++) {
    if (windowCandles[i].high > maxPrice2) {
      maxPrice2 = windowCandles[i].high;
      maxIdx2 = i;
    }
  }

  const rsiLow1 = windowRsi[minIdx1] ?? 50;
  const rsiLow2 = windowRsi[minIdx2] ?? 50;
  const rsiHigh1 = windowRsi[maxIdx1] ?? 50;
  const rsiHigh2 = windowRsi[maxIdx2] ?? 50;

  // 1. Regular Bullish Divergence: Price Lower Low (LL), RSI Higher Low (HL)
  const priceLowerLow = minPrice2 < minPrice1 * 0.998;
  const rsiHigherLow = rsiLow2 > rsiLow1 + 1.2;

  if (priceLowerLow && rsiHigherLow) {
    return {
      hasDivergence: true,
      type: 'BULLISH_REGULAR',
      title: 'Divergência Regular de Alta (Preço x RSI)',
      strength: 'ALTA',
      badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
      rsiCurrent: latestRsi,
      rsiZone,
      description: `O preço formou fundo mais baixo ($${minPrice2.toLocaleString()} < $${minPrice1.toLocaleString()}), enquanto o RSI(14) registrou fundo ascendente (${rsiLow2.toFixed(1)} > ${rsiLow1.toFixed(1)}). Isto indica absorção de liquidez compradora e exaustão da pressão vendedora.`,
      tradingImplication: 'Sinal clássico de reversão para COMPRA (LONG) ou encerramento de posições vendidas com trailing stop ajustado.',
      swingDetails: {
        price1: minPrice1,
        price2: minPrice2,
        rsi1: rsiLow1,
        rsi2: rsiLow2,
      },
    };
  }

  // 2. Regular Bearish Divergence: Price Higher High (HH), RSI Lower High (LH)
  const priceHigherHigh = maxPrice2 > maxPrice1 * 1.002;
  const rsiLowerHigh = rsiHigh2 < rsiHigh1 - 1.2;

  if (priceHigherHigh && rsiLowerHigh) {
    return {
      hasDivergence: true,
      type: 'BEARISH_REGULAR',
      title: 'Divergência Regular de Baixa (Preço x RSI)',
      strength: 'ALTA',
      badgeColor: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
      rsiCurrent: latestRsi,
      rsiZone,
      description: `O preço cravou novo topo mais alto ($${maxPrice2.toLocaleString()} > $${maxPrice1.toLocaleString()}), mas o RSI(14) perdeu momentum e marcou topo descendente (${rsiHigh2.toFixed(1)} < ${rsiHigh1.toFixed(1)}). Esgotamento de compra ou distribuição institucional Wyckoff.`,
      tradingImplication: 'Alerta crítico de exaustão compradora. Favorece operações de VENDA (SHORT) ou realização de lucros parciais.',
      swingDetails: {
        price1: maxPrice1,
        price2: maxPrice2,
        rsi1: rsiHigh1,
        rsi2: rsiHigh2,
      },
    };
  }

  // 3. Hidden Bullish Divergence: Price Higher Low (HL), RSI Lower Low (LL)
  const priceHigherLow = minPrice2 > minPrice1 * 1.002;
  const rsiLowerLow = rsiLow2 < rsiLow1 - 1.2;

  if (priceHigherLow && rsiLowerLow) {
    return {
      hasDivergence: true,
      type: 'HIDDEN_BULLISH',
      title: 'Divergência Oculta de Alta (Preço x RSI)',
      strength: 'MODERADA',
      badgeColor: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
      rsiCurrent: latestRsi,
      rsiZone,
      description: `O preço sustentou um fundo mais alto, porém o RSI(14) resetou para patamar inferior. Característica clássica de pullback saudável dentro de uma tendência de alta predominante.`,
      tradingImplication: 'Confirmação de continuação altista. Setup ideal para entrada a favor da tendência com stop curto no fundo recente.',
      swingDetails: {
        price1: minPrice1,
        price2: minPrice2,
        rsi1: rsiLow1,
        rsi2: rsiLow2,
      },
    };
  }

  // 4. Hidden Bearish Divergence: Price Lower High (LH), RSI Higher High (HH)
  const priceLowerHigh = maxPrice2 < maxPrice1 * 0.998;
  const rsiHigherHigh = rsiHigh2 > rsiHigh1 + 1.2;

  if (priceLowerHigh && rsiHigherHigh) {
    return {
      hasDivergence: true,
      type: 'HIDDEN_BEARISH',
      title: 'Divergência Oculta de Baixa (Preço x RSI)',
      strength: 'MODERADA',
      badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
      rsiCurrent: latestRsi,
      rsiZone,
      description: `O preço realizou topo descendente em tendência de baixa enquanto o RSI repicou para patamar superior. Exaustão do repique contra a tendência principal.`,
      tradingImplication: 'Confirmação de continuação baixista. Oportunidade de retomada de venda a favor da tendência.',
      swingDetails: {
        price1: maxPrice1,
        price2: maxPrice2,
        rsi1: rsiHigh1,
        rsi2: rsiHigh2,
      },
    };
  }

  // 5. Default: Neutral Alignment (Preço e RSI alinhados)
  return {
    hasDivergence: false,
    type: 'NONE',
    title: 'Alinhamento Sem Divergência (Preço x RSI)',
    strength: 'NEUTRA',
    badgeColor: 'bg-slate-800 text-slate-300 border-slate-700',
    rsiCurrent: latestRsi,
    rsiZone,
    description: `O preço e o oscilador RSI(14) (${latestRsi}) estão caminhando em concordância direta. A movimentação de preço é validada pelo momentum, sem divergência detectada nos pivôs recentes.`,
    tradingImplication: 'Siga os sinais da estratégia padrão Triple Screen e dos 4 Pilares institucionais.',
    swingDetails: {
      price1: minPrice1,
      price2: minPrice2,
      rsi1: rsiLow1,
      rsi2: rsiLow2,
    },
  };
}

/**
 * Detects Price vs RSI divergence, evaluates Stochastic separately, and calculates MACD
 */
export function detectPriceOscillatorDivergence(
  candles: Candle[],
  rsiValues: number[],
  stochKValues: number[],
  stochDValues: number[]
): DivergenceResult {
  const rsiDiv = detectPriceRsiDivergence(candles, rsiValues);
  const stochEval = evaluateStochastic(stochKValues, stochDValues);
  const macdData = calculateMacd(candles, 12, 26, 9);

  return {
    hasDivergence: rsiDiv.hasDivergence,
    type: rsiDiv.type,
    title: rsiDiv.title,
    confluence: rsiDiv.hasDivergence && stochEval.momentum === (rsiDiv.type.includes('BULLISH') ? 'ALTA' : 'BAIXA') ? 'DUAL' : 'RSI_ONLY',
    strength: rsiDiv.strength,
    badgeColor: rsiDiv.badgeColor,
    rsiCurrent: rsiDiv.rsiCurrent,
    stochKCurrent: stochEval.k,
    stochDCurrent: stochEval.d,
    description: rsiDiv.description,
    tradingImplication: rsiDiv.tradingImplication,
    swingDetails: {
      price1: rsiDiv.swingDetails.price1,
      price2: rsiDiv.swingDetails.price2,
      rsi1: rsiDiv.swingDetails.rsi1,
      rsi2: rsiDiv.swingDetails.rsi2,
      stoch1: stochEval.k,
      stoch2: stochEval.d,
    },
    rsiDivergence: rsiDiv,
    stochastic: stochEval,
    macd: macdData,
  };
}

export interface VolatilityAnomalyStats {
  currentPeriodVolatility: number; // percentage of bar range
  historicalMean14: number;        // 14-bar mean
  historicalStdDev14: number;      // 14-bar sigma
  threshold2Sigma: number;         // mean + 2 * sigma
  zScore: number;                  // (current - mean) / sigma
  isExtremeSurge: boolean;         // zScore >= 2.0
  ratioVsMean: number;             // current / mean
  recentRanges: number[];
}

/**
 * Calculates rolling 14-period True Range / Bar Range volatility and determines if the current
 * bar exceeds the historical mean by 2 standard deviations (+2σ)
 */
export function calculateVolatilityAnomaly(candles: Candle[], period = 14): VolatilityAnomalyStats {
  if (candles.length < period + 1) {
    return {
      currentPeriodVolatility: 1.5,
      historicalMean14: 1.2,
      historicalStdDev14: 0.3,
      threshold2Sigma: 1.8,
      zScore: 1.0,
      isExtremeSurge: false,
      ratioVsMean: 1.25,
      recentRanges: [1.2, 1.3, 1.1],
    };
  }

  // Compute percentage True Range for each candle
  const ranges: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const current = candles[i];
    const prev = candles[i - 1];
    const tr = Math.max(
      current.high - current.low,
      Math.abs(current.high - prev.close),
      Math.abs(current.low - prev.close)
    );
    const rangePercent = (tr / (current.close || 1)) * 100;
    ranges.push(rangePercent);
  }

  // Current bar volatility
  const currentVol = ranges[ranges.length - 1] ?? 1.5;

  // 14 periods prior to the current bar
  const historical = ranges.slice(-period - 1, -1);
  const n = historical.length || 1;
  const mean = historical.reduce((acc, v) => acc + v, 0) / n;

  const variance = historical.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / n;
  const stdDev = Math.sqrt(variance) || 0.05;

  const threshold2Sigma = mean + 2 * stdDev;
  const zScore = (currentVol - mean) / stdDev;
  const isExtremeSurge = zScore >= 2.0;
  const ratioVsMean = mean > 0 ? currentVol / mean : 1.0;

  return {
    currentPeriodVolatility: Number(currentVol.toFixed(2)),
    historicalMean14: Number(mean.toFixed(2)),
    historicalStdDev14: Number(stdDev.toFixed(2)),
    threshold2Sigma: Number(threshold2Sigma.toFixed(2)),
    zScore: Number(zScore.toFixed(2)),
    isExtremeSurge,
    ratioVsMean: Number(ratioVsMean.toFixed(1)),
    recentRanges: historical.slice(-5).map((v) => Number(v.toFixed(2))),
  };
}

export type TradingExecutionStyle = 'SCALP' | 'DAY_TRADE' | 'SWING_TRADE' | 'POSITION_TRADE';

export interface StyleRiskParameters {
  style: TradingExecutionStyle;
  label: string;
  badge: string;
  badgeColor: string;
  timeframes: string;
  holdingTime: string;
  entryPrice: number;
  stopLoss: number;
  stopDistanceUsd: number;
  stopDistancePercent: number;
  atrMultipleStop: string;
  takeProfit1: number;
  takeProfit2: number;
  takeProfit3: number;
  takeProfit4: number;
  takeProfit5: number;
  fibonacciTargets: FibonacciTarget[];
  rr1: number;
  rr2: number;
  rr3: number;
  rr4: number;
  rr5: number;
  recommendedLeverage: string;
  riskPercent: number;
  executionRules: string[];
}

/**
 * Breaks down signal execution and risk management across:
 * - SCALP (3m - 15m)
 * - DAY TRADE (15m - 1h)
 * - SWING TRADE (4h - 1d)
 * - POSITION TRADE (1d - 2w)
 * 
 * Computes 5 institutional Fibonacci Targets (1.618, 2.000, 2.618, 3.618, 4.236) calibrated per ATR risk distance.
 */
export function calculateTradingStyleParameters(
  signal: TradeSignal,
  customEntryPrice?: number
): Record<TradingExecutionStyle, StyleRiskParameters> {
  const isLong = signal.decision === 'COMPRA' || signal.decision === 'AGUARDAR';
  const entry = typeof customEntryPrice === 'number' && customEntryPrice > 0
    ? customEntryPrice
    : (signal.entryPrice || signal.currentPrice || 100);
  const atr = signal.atrValue || entry * 0.02;
  const currentPrice = signal.currentPrice || entry;

  const roundPrice = (p: number) => Number(p.toFixed(entry >= 1 ? 2 : 5));

  // 1. SCALP
  const scalpStopDist = atr * 0.6;
  const scalpSL = isLong ? entry - scalpStopDist : entry + scalpStopDist;
  const scalpFibo = calculateFibonacciTargets(entry, scalpSL, isLong ? 'LONG' : 'SHORT', currentPrice);

  // 2. DAY TRADE
  const dayStopDist = atr * 1.0;
  const daySL = isLong ? entry - dayStopDist : entry + dayStopDist;
  const dayFibo = calculateFibonacciTargets(entry, daySL, isLong ? 'LONG' : 'SHORT', currentPrice);

  // 3. SWING TRADE
  const swingStopDist = atr * 1.8;
  const swingSL = isLong ? entry - swingStopDist : entry + swingStopDist;
  const swingFibo = calculateFibonacciTargets(entry, swingSL, isLong ? 'LONG' : 'SHORT', currentPrice);

  // 4. POSITION TRADE
  const posStopDist = atr * 3.5;
  const posSL = isLong ? entry - posStopDist : entry + posStopDist;
  const posFibo = calculateFibonacciTargets(entry, posSL, isLong ? 'LONG' : 'SHORT', currentPrice);

  return {
    SCALP: {
      style: 'SCALP',
      label: 'Scalp Trade',
      badge: '⚡ SCALP (3m-15m)',
      badgeColor: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
      timeframes: '3m, 5m, 15m',
      holdingTime: '5 min a 45 min',
      entryPrice: roundPrice(entry),
      stopLoss: roundPrice(scalpSL),
      stopDistanceUsd: Number(scalpStopDist.toFixed(4)),
      stopDistancePercent: Number(((scalpStopDist / entry) * 100).toFixed(2)),
      atrMultipleStop: '0.6x ATR',
      takeProfit1: roundPrice(scalpFibo[0].price),
      takeProfit2: roundPrice(scalpFibo[1].price),
      takeProfit3: roundPrice(scalpFibo[2].price),
      takeProfit4: roundPrice(scalpFibo[3].price),
      takeProfit5: roundPrice(scalpFibo[4].price),
      fibonacciTargets: scalpFibo,
      rr1: 1.62,
      rr2: 2.0,
      rr3: 2.62,
      rr4: 3.62,
      rr5: 4.24,
      recommendedLeverage: '5x a 15x Isolada',
      riskPercent: 0.5,
      executionRules: [
        'Execução via Ordem Limit para evitar taxas agressivas (Taker fee)',
        'Mover Stop para Breakeven imediato ao atingir TP1 ou TP2 (Fibo 1.618 / 2.0)',
        'Encerramento forçado se a operação estagnar por mais de 60 minutos',
      ],
    },
    DAY_TRADE: {
      style: 'DAY_TRADE',
      label: 'Day Trade',
      badge: '🎯 DAY TRADE (15m-1h)',
      badgeColor: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
      timeframes: '15m, 30m, 1h',
      holdingTime: '1h a 8 horas (Mesma Sessão)',
      entryPrice: roundPrice(entry),
      stopLoss: roundPrice(daySL),
      stopDistanceUsd: Number(dayStopDist.toFixed(4)),
      stopDistancePercent: Number(((dayStopDist / entry) * 100).toFixed(2)),
      atrMultipleStop: '1.0x ATR',
      takeProfit1: roundPrice(dayFibo[0].price),
      takeProfit2: roundPrice(dayFibo[1].price),
      takeProfit3: roundPrice(dayFibo[2].price),
      takeProfit4: roundPrice(dayFibo[3].price),
      takeProfit5: roundPrice(dayFibo[4].price),
      fibonacciTargets: dayFibo,
      rr1: 1.62,
      rr2: 2.0,
      rr3: 2.62,
      rr4: 3.62,
      rr5: 4.24,
      recommendedLeverage: '3x a 5x Cross / Isolada',
      riskPercent: 1.0,
      executionRules: [
        'Realização parcial de 40% no TP1 (1.618 Golden Fibo); stop no ponto de entrada (0 a 0)',
        'Condução do restante em Trailing Stop pelas extensões 2.618 e 3.618',
        'Zerar posição antes do fechamento diário UTC ou funding adverso',
      ],
    },
    SWING_TRADE: {
      style: 'SWING_TRADE',
      label: 'Swing Trade',
      badge: '🌊 SWING TRADE (4h-1d)',
      badgeColor: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
      timeframes: '1h, 8h, 1d, 3d',
      holdingTime: '2 a 10 dias úteis',
      entryPrice: roundPrice(entry),
      stopLoss: roundPrice(swingSL),
      stopDistanceUsd: Number(swingStopDist.toFixed(4)),
      stopDistancePercent: Number(((swingStopDist / entry) * 100).toFixed(2)),
      atrMultipleStop: '1.8x ATR',
      takeProfit1: roundPrice(swingFibo[0].price),
      takeProfit2: roundPrice(swingFibo[1].price),
      takeProfit3: roundPrice(swingFibo[2].price),
      takeProfit4: roundPrice(swingFibo[3].price),
      takeProfit5: roundPrice(swingFibo[4].price),
      fibonacciTargets: swingFibo,
      rr1: 1.62,
      rr2: 2.0,
      rr3: 2.62,
      rr4: 3.62,
      rr5: 4.24,
      recommendedLeverage: 'Spot (1x) ou 2x a 3x Baixa',
      riskPercent: 1.5,
      executionRules: [
        'Respeito rigoroso aos Order Blocks institucionais e FVG diário',
        'Condução do trade via Trailing Stop móvel ancorado na EMA 21 diária',
        'Alvos expandidos TP3, TP4 e TP5 para captura de tendências macro',
      ],
    },
    POSITION_TRADE: {
      style: 'POSITION_TRADE',
      label: 'Position Trade',
      badge: '🏛️ POSITION TRADE (1d-2w)',
      badgeColor: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
      timeframes: '1d, 5d, 1w, 2w',
      holdingTime: 'Semanas a Meses (Ciclo Macro)',
      entryPrice: roundPrice(entry),
      stopLoss: roundPrice(posSL),
      stopDistanceUsd: Number(posStopDist.toFixed(4)),
      stopDistancePercent: Number(((posStopDist / entry) * 100).toFixed(2)),
      atrMultipleStop: '3.5x ATR',
      takeProfit1: roundPrice(posFibo[0].price),
      takeProfit2: roundPrice(posFibo[1].price),
      takeProfit3: roundPrice(posFibo[2].price),
      takeProfit4: roundPrice(posFibo[3].price),
      takeProfit5: roundPrice(posFibo[4].price),
      fibonacciTargets: posFibo,
      rr1: 1.62,
      rr2: 2.0,
      rr3: 2.62,
      rr4: 3.62,
      rr5: 4.24,
      recommendedLeverage: 'Spot 1x Apenas (Sem risco de liquidação)',
      riskPercent: 2.5,
      executionRules: [
        'Entrada escalonada (DCA) em zonas de acumulação Wyckoff',
        'Stop estrutural abaixo do suporte semanal ou mínima histórica do ciclo',
        'Realizações parciais escalonadas nos 5 topos de expansão Fibonacci (1.618 até 4.236)',
      ],
    },
  };
}

/**
 * Quantitatively detects volatility squeeze (Bollinger Bands vs Keltner Channels),
 * momentum ignition, and explosion potential for rapid 8%+ price movements.
 */
export function calculateSqueezeBreakout(
  signal: TradeSignal,
  candles?: Candle[]
): SqueezeBreakoutAnalysis {
  const currentPrice = signal.currentPrice || signal.entryPrice || 100;
  const candleList = candles && candles.length >= 10 
    ? candles 
    : signal.tripleScreen?.ltf?.candles || signal.tripleScreen?.mtf?.candles || [];

  const closes = candleList.length >= 10 
    ? candleList.map(c => c.close) 
    : signal.sparkline7d && signal.sparkline7d.length >= 10 
      ? signal.sparkline7d 
      : [currentPrice * 0.98, currentPrice * 0.99, currentPrice];

  const period = Math.min(closes.length, 20);
  const recentCloses = closes.slice(-period);
  const sma20 = recentCloses.reduce((acc, v) => acc + v, 0) / (recentCloses.length || 1);

  const variance = recentCloses.reduce((acc, v) => acc + Math.pow(v - sma20, 2), 0) / (recentCloses.length || 1);
  const stdDev = Math.sqrt(variance) || (currentPrice * 0.015);

  const upperBB = sma20 + 2.0 * stdDev;
  const lowerBB = Math.max(0.0001, sma20 - 2.0 * stdDev);
  const bbWidth = Number((((upperBB - lowerBB) / sma20) * 100).toFixed(2));

  // Keltner Channel (20 EMA, 1.5 ATR)
  const atr = signal.atrValue || (currentPrice * 0.018);
  const upperKC = sma20 + 1.5 * atr;
  const lowerKC = Math.max(0.0001, sma20 - 1.5 * atr);
  const kcWidth = Number((((upperKC - lowerKC) / sma20) * 100).toFixed(2));

  // Check squeeze condition: Bollinger Bands completely inside Keltner Channel
  const isSqueezeOn = upperBB < upperKC && lowerBB > lowerKC;
  
  // Previous bar squeeze calculation
  let wasSqueezeOnPrev = false;
  if (closes.length >= 22) {
    const prevCloses = closes.slice(-period - 1, -1);
    const prevSma = prevCloses.reduce((acc, v) => acc + v, 0) / prevCloses.length;
    const prevVar = prevCloses.reduce((acc, v) => acc + Math.pow(v - prevSma, 2), 0) / prevCloses.length;
    const prevStd = Math.sqrt(prevVar) || (currentPrice * 0.015);
    const prevUpperBB = prevSma + 2.0 * prevStd;
    const prevLowerBB = prevSma - 2.0 * prevStd;
    const prevUpperKC = prevSma + 1.5 * atr;
    const prevLowerKC = prevSma - 1.5 * atr;
    wasSqueezeOnPrev = prevUpperBB < prevUpperKC && prevLowerBB > prevLowerKC;
  } else {
    wasSqueezeOnPrev = isSqueezeOn;
  }

  const isSqueezeFired = wasSqueezeOnPrev && !isSqueezeOn && (currentPrice > sma20 || signal.change24h > 2.0);

  // Squeeze compression depth (0 to 100%)
  const compressionPercent = Number(
    Math.min(100, Math.max(10, Math.round((1 - (bbWidth / Math.max(kcWidth, 0.1))) * 100 + 50)))
  );

  // Consecutive bars estimation
  let squeezeBarsCount = isSqueezeOn ? Math.max(3, Math.min(18, Math.round(12 - bbWidth))) : isSqueezeFired ? 1 : 0;

  // Short Squeeze Fuel Analysis (Derivatives Open Interest + Funding Rate)
  const sentiment = signal.fourPillars?.sentiment;
  const fundingRate = sentiment?.fundingRate ?? 0.008;
  const oiChange = sentiment?.oi24hChange ?? signal.change24h;

  let shortSqueezeRisk: 'EXTREMO' | 'ALTO' | 'MODERADO' | 'BAIXO' = 'MODERADO';
  if (fundingRate <= 0.001 && oiChange > 3) {
    shortSqueezeRisk = 'EXTREMO';
  } else if (fundingRate <= 0.006 && oiChange > 0) {
    shortSqueezeRisk = 'ALTO';
  } else if (fundingRate > 0.018) {
    shortSqueezeRisk = 'BAIXO'; // Euphoria / crowded longs
  }

  // Determine State, Urgency & Explosion Score
  let state: 'SQUEEZE_ATIVO' | 'IGNICAO_DISPARADA' | 'EXPANSAO_ALTA' | 'NORMAL' = 'NORMAL';
  let stateLabel = 'VOLATILIDADE REGULAR';
  let urgency: 'CRITICA' | 'ALTA' | 'MODERADA' | 'BAIXA' = 'BAIXA';
  let explosionScore = 35;

  const catalysts: string[] = [];

  if (isSqueezeFired || (signal.change24h >= 6.0 && bbWidth < 6.0)) {
    state = 'IGNICAO_DISPARADA';
    stateLabel = 'DISPARO DE EXPLOSÃO (BREAKOUT 8%+)';
    urgency = 'CRITICA';
    explosionScore = Math.min(98, 88 + (signal.confidence % 10));
    catalysts.push('Disparo do Squeeze com expansão das Bandas de Bollinger para fora do Canal Keltner');
    catalysts.push('Volume institucional acima da média confirmando rompimento de volatilidade');
    if (shortSqueezeRisk === 'EXTREMO' || shortSqueezeRisk === 'ALTO') {
      catalysts.push(`Combustível de Short Squeeze Ativo: Funding em ${(fundingRate * 100).toFixed(3)}% com Open Interest em expansão`);
    }
  } else if (isSqueezeOn) {
    state = 'SQUEEZE_ATIVO';
    stateLabel = 'COMPRESSÃO MÁXIMA (SQUEEZE ATIVO)';
    urgency = bbWidth < 3.5 ? 'ALTA' : 'MODERADA';
    explosionScore = Math.min(87, 72 + Math.round((10 - bbWidth) * 2));
    catalysts.push(`Bandas de Bollinger estranguladas dentro do Canal Keltner (BandWidth: ${bbWidth}%)`);
    catalysts.push(`Acúmulo persistente de energia por ${squeezeBarsCount} períodos consecutivos`);
    if (shortSqueezeRisk === 'EXTREMO') {
      catalysts.push('Derivativos com viés vendedor absorvido passivamente por Smart Money');
    }
  } else if (signal.change24h > 3.0 || signal.decision === 'COMPRA') {
    state = 'EXPANSAO_ALTA';
    stateLabel = 'EXPANSÃO DE MOMENTUM';
    urgency = 'MODERADA';
    explosionScore = Math.min(74, 58 + Math.round(signal.change24h * 1.5));
    catalysts.push('Estrutura de alta em andamento com fluxo comprador predominante');
  } else {
    state = 'NORMAL';
    stateLabel = 'OSCILAÇÃO EM FAIXA';
    urgency = 'BAIXA';
    explosionScore = Math.max(15, Math.min(48, Math.round(bbWidth * 6)));
  }

  // Price targets for explosive moves (+8.2% and +15.4%)
  const roundPrice = (p: number) => {
    let dec = 2;
    if (currentPrice < 0.001) dec = 6;
    else if (currentPrice < 1) dec = 4;
    else if (currentPrice < 10) dec = 3;
    return Number(p.toFixed(dec));
  };

  const estimatedTarget8Pct = roundPrice(currentPrice * 1.082);
  const estimatedTarget15Pct = roundPrice(currentPrice * 1.154);
  const recommendedStopLoss = roundPrice(Math.min(lowerBB, currentPrice * 0.978));

  return {
    isSqueezeOn,
    isSqueezeFired,
    squeezeBarsCount,
    state,
    stateLabel,
    explosionScore,
    urgency,
    bollingerBandWidth: bbWidth,
    keltnerWidth: kcWidth,
    compressionPercent,
    momentumDirection: currentPrice >= sma20 ? 'ALTA' : 'BAIXA',
    shortSqueezeRisk,
    estimatedTarget8Pct,
    estimatedTarget15Pct,
    recommendedStopLoss,
    catalysts,
  };
}

export const FIBONACCI_TARGET_RATIOS = [
  { level: 1, ratio: 1.618, label: 'TP1 (1.618 Fibo Golden)' },
  { level: 2, ratio: 2.000, label: 'TP2 (2.000 Expansão)' },
  { level: 3, ratio: 2.618, label: 'TP3 (2.618 Extensão Maior)' },
  { level: 4, ratio: 3.618, label: 'TP4 (3.618 Projeção Institucional)' },
  { level: 5, ratio: 4.236, label: 'TP5 (4.236 Clímax Máximo)' },
];

/**
 * Calculates 5 institutional Fibonacci take profit targets based on risk / impulse distance.
 * Returns the projected price, percentage gain from entry, and whether it has been hit.
 */
export function calculateFibonacciTargets(
  entryPrice: number,
  stopLoss: number,
  direction: 'COMPRA' | 'VENDA' | 'LONG' | 'SHORT' | string,
  currentPrice: number = entryPrice,
  decimals?: number
): FibonacciTarget[] {
  const isLong = direction === 'COMPRA' || direction === 'LONG';
  const risk = Math.abs(entryPrice - stopLoss) || (entryPrice * 0.018);
  const dec = decimals !== undefined 
    ? decimals 
    : (entryPrice < 0.01 ? 6 : entryPrice < 1 ? 4 : entryPrice < 10 ? 3 : 2);

  return FIBONACCI_TARGET_RATIOS.map((item) => {
    const targetPriceRaw = isLong 
      ? entryPrice + (risk * item.ratio)
      : entryPrice - (risk * item.ratio);
    
    const targetPrice = Number(targetPriceRaw.toFixed(dec));
    const pnlPercentRaw = isLong
      ? ((targetPrice - entryPrice) / (entryPrice || 1)) * 100
      : ((entryPrice - targetPrice) / (entryPrice || 1)) * 100;
    const pnlPercent = Number(pnlPercentRaw.toFixed(2));

    const isHit = isLong 
      ? currentPrice >= targetPrice 
      : currentPrice <= targetPrice;

    return {
      level: item.level,
      ratioLabel: item.label,
      ratio: item.ratio,
      price: targetPrice,
      pnlPercent,
      isHit,
    };
  });
}

