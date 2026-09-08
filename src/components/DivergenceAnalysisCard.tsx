import React from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  AlertCircle, 
  Activity, 
  Layers, 
  Zap, 
  ShieldCheck, 
  Info,
  Sliders,
  BarChart2,
  CheckCircle2,
  ArrowUpRight,
  ArrowDownRight,
  Split,
  Compass
} from 'lucide-react';
import { 
  DivergenceResult, 
  ChartTimeframe, 
  getTimeframeMeta 
} from '../utils/technicalAnalysis';

interface DivergenceAnalysisCardProps {
  divergence: DivergenceResult;
  symbol: string;
  timeframe: ChartTimeframe;
}

export const DivergenceAnalysisCard: React.FC<DivergenceAnalysisCardProps> = ({
  divergence,
  symbol,
  timeframe,
}) => {
  const meta = getTimeframeMeta(timeframe);

  // Extract decoupled modules with safe fallbacks
  const rsiDiv = divergence.rsiDivergence || {
    hasDivergence: divergence.hasDivergence,
    type: divergence.type,
    title: divergence.title,
    strength: divergence.strength,
    badgeColor: divergence.badgeColor,
    rsiCurrent: divergence.rsiCurrent,
    rsiZone: divergence.rsiCurrent >= 70 ? 'SOBRECOMPRA' : divergence.rsiCurrent <= 30 ? 'SOBREVENDA' : 'NEUTRO',
    description: divergence.description,
    tradingImplication: divergence.tradingImplication,
    swingDetails: {
      price1: divergence.swingDetails?.price1 || 0,
      price2: divergence.swingDetails?.price2 || 0,
      rsi1: divergence.swingDetails?.rsi1 || 50,
      rsi2: divergence.swingDetails?.rsi2 || 50,
    }
  };

  const stoch = divergence.stochastic || {
    k: divergence.stochKCurrent ?? 50,
    d: divergence.stochDCurrent ?? 50,
    status: (divergence.stochKCurrent >= 80 ? 'SOBRECOMPRADO' : divergence.stochKCurrent <= 20 ? 'SOBREVENDIDO' : 'NEUTRO'),
    statusLabel: (divergence.stochKCurrent >= 80 ? 'Sobrecompra (>80)' : divergence.stochKCurrent <= 20 ? 'Sobrevenda (<20)' : 'Faixa Neutra (20-80)'),
    crossover: (divergence.stochKCurrent >= divergence.stochDCurrent ? 'ALINHADO_ALTA' : 'ALINHADO_BAIXA'),
    crossoverLabel: (divergence.stochKCurrent >= divergence.stochDCurrent ? '%K acima de %D' : '%K abaixo de %D'),
    momentum: (divergence.stochKCurrent > divergence.stochDCurrent ? 'ALTA' : 'BAIXA'),
    badgeColor: 'bg-slate-800 text-slate-300 border-slate-700',
    description: `Estocástico %K: ${divergence.stochKCurrent}, %D: ${divergence.stochDCurrent}.`
  };

  const macd = divergence.macd || {
    macdLine: 0,
    signalLine: 0,
    histogram: 0,
    prevHistogram: 0,
    trend: 'NEUTRO',
    crossover: 'ALINHADO_ALTA',
    crossoverLabel: 'Alinhado',
    zeroLineState: 'NA_LINHA_ZERO',
    histogramState: 'EXPANSAO_ALTA',
    histogramStateLabel: 'Neutro',
    badgeColor: 'bg-slate-800 text-slate-300 border-slate-700',
    description: 'Linha MACD em conformidade.',
    series: { macd: [], signal: [], histogram: [] }
  };

  const getDivergenceIcon = () => {
    switch (rsiDiv.type) {
      case 'BULLISH_REGULAR':
      case 'HIDDEN_BULLISH':
        return <TrendingUp className="w-4 h-4 text-emerald-400" />;
      case 'BEARISH_REGULAR':
      case 'HIDDEN_BEARISH':
        return <TrendingDown className="w-4 h-4 text-rose-400" />;
      default:
        return <Activity className="w-4 h-4 text-slate-400" />;
    }
  };

  // Histogram sparkline bars (last 14 bars)
  const histSlice = macd.series?.histogram?.slice(-14) || [];
  const maxAbsHist = Math.max(0.0001, ...histSlice.map((v) => Math.abs(v)));

  // Overall confluence evaluation
  const isConfluentBullish = 
    (rsiDiv.type.includes('BULLISH') || rsiDiv.rsiZone === 'SOBREVENDA') &&
    (stoch.status === 'SOBREVENDIDO' || stoch.crossover === 'CRUZAMENTO_BULLISH' || stoch.k > stoch.d) &&
    (macd.histogram >= 0 || macd.crossover === 'CRUZAMENTO_BULLISH');

  const isConfluentBearish = 
    (rsiDiv.type.includes('BEARISH') || rsiDiv.rsiZone === 'SOBRECOMPRA') &&
    (stoch.status === 'SOBRECOMPRADO' || stoch.crossover === 'CRUZAMENTO_BEARISH' || stoch.k < stoch.d) &&
    (macd.histogram < 0 || macd.crossover === 'CRUZAMENTO_BEARISH');

  return (
    <div id="card-divergence-analysis" className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 sm:p-4 font-mono text-xs space-y-4">
      
      {/* ── CARD HEADER ── */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400">
            {getDivergenceIcon()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-white uppercase tracking-wider text-xs sm:text-sm">
                Divergência: Preço x RSI (14)
              </span>
              <span className="text-[10px] text-amber-300 bg-amber-500/15 px-1.5 py-0.5 rounded border border-amber-500/30 font-bold">
                {meta.label}
              </span>
            </div>
            <span className="text-[11px] text-slate-400 font-sans block mt-0.5">
              Divergência estrita entre Preço e RSI • Estocástico e MACD avaliados em módulos independentes
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className={`px-2.5 py-1 rounded text-xs font-bold border ${rsiDiv.badgeColor} flex items-center gap-1.5 shadow-sm`}>
            {rsiDiv.title}
          </span>
          {rsiDiv.hasDivergence && (
            <span className="px-2 py-1 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse">
              ALERTA DE PIVÔ
            </span>
          )}
        </div>
      </div>

      {/* ── MODULE 1: DIVERGÊNCIA PREÇO X RSI (14) ── */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-200">
            <span className="w-1.5 h-3 bg-amber-400 rounded-full inline-block"></span>
            <span>1. ANÁLISE DE DIVERGÊNCIA: PREÇO X RSI (14)</span>
          </div>
          <span className="text-[10px] text-slate-400 font-sans">
            Mapeamento de Exaustão de Tendência
          </span>
        </div>

        {/* RSI & Divergence Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {/* RSI Actual */}
          <div className="p-2 bg-slate-950 rounded-lg border border-slate-800">
            <span className="text-slate-400 block text-[10px]">RSI (14) Atual</span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className={`text-base font-bold ${
                rsiDiv.rsiCurrent >= 70 ? 'text-rose-400' :
                rsiDiv.rsiCurrent <= 30 ? 'text-emerald-400' : 'text-amber-300'
              }`}>
                {rsiDiv.rsiCurrent}
              </span>
              <span className={`text-[9px] px-1 py-0.2 rounded font-semibold ${
                rsiDiv.rsiZone === 'SOBRECOMPRA' ? 'bg-rose-500/20 text-rose-300' :
                rsiDiv.rsiZone === 'SOBREVENDA' ? 'bg-emerald-500/20 text-emerald-300' :
                'text-slate-500'
              }`}>
                {rsiDiv.rsiZone === 'SOBRECOMPRA' ? 'Sobrecompra' : rsiDiv.rsiZone === 'SOBREVENDA' ? 'Sobrevenda' : 'Neutro'}
              </span>
            </div>
          </div>

          {/* Divergence Status */}
          <div className="p-2 bg-slate-950 rounded-lg border border-slate-800">
            <span className="text-slate-400 block text-[10px]">Divergência Preço x RSI</span>
            <div className="flex items-baseline gap-1.5 mt-0.5 truncate">
              <span className={`text-xs font-bold ${
                rsiDiv.type.includes('BULLISH') ? 'text-emerald-400' :
                rsiDiv.type.includes('BEARISH') ? 'text-rose-400' : 'text-slate-300'
              }`}>
                {rsiDiv.hasDivergence ? rsiDiv.type.replace('_', ' ') : 'SEM DIVERGÊNCIA'}
              </span>
            </div>
          </div>

          {/* Price Pivots */}
          <div className="p-2 bg-slate-950 rounded-lg border border-slate-800">
            <span className="text-slate-400 block text-[10px]">Pivôs Preço (P1 → P2)</span>
            <div className="mt-0.5 text-xs text-slate-200">
              {rsiDiv.swingDetails.price1 > 0 ? (
                <span>
                  ${rsiDiv.swingDetails.price1.toLocaleString()} → <strong className="text-amber-300">${rsiDiv.swingDetails.price2.toLocaleString()}</strong>
                </span>
              ) : (
                <span className="text-slate-500">Aguardando pivôs</span>
              )}
            </div>
          </div>

          {/* RSI Pivots */}
          <div className="p-2 bg-slate-950 rounded-lg border border-slate-800">
            <span className="text-slate-400 block text-[10px]">Pivôs RSI (R1 → R2)</span>
            <div className="mt-0.5 text-xs text-slate-200">
              {rsiDiv.swingDetails.price1 > 0 ? (
                <span>
                  {rsiDiv.swingDetails.rsi1} → <strong className="text-sky-300">{rsiDiv.swingDetails.rsi2}</strong>
                </span>
              ) : (
                <span className="text-slate-500">Calculando swings</span>
              )}
            </div>
          </div>
        </div>

        {/* RSI Description & Tactical Implication */}
        <div className="bg-slate-950 rounded-lg p-2.5 border border-slate-800/80 space-y-1.5">
          <p className="text-[11px] text-slate-300 font-sans leading-relaxed">
            {rsiDiv.description}
          </p>
          <div className="pt-1.5 border-t border-slate-800 flex items-start gap-1.5 text-[11px]">
            <span className="text-amber-400 font-bold shrink-0">Implicação Tática:</span>
            <span className="text-slate-200 font-sans">{rsiDiv.tradingImplication}</span>
          </div>
        </div>
      </div>

      {/* ── MODULE 2: ESTOCÁSTICO RSI (AVALIADO À PARTE) ── */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-200">
            <span className="w-1.5 h-3 bg-sky-400 rounded-full inline-block"></span>
            <Sliders className="w-3.5 h-3.5 text-sky-400" />
            <span>2. ESTOCÁSTICO RSI (%K, %D)</span>
            <span className="ml-1.5 text-[9px] px-1.5 py-0.2 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30 uppercase">
              Avaliação À Parte
            </span>
          </div>
          <span className="text-[10px] text-slate-400 font-sans">
            Momento rápido & cruzamento de gatilho
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {/* Estocástico %K */}
          <div className="p-2 bg-slate-950 rounded-lg border border-slate-800">
            <span className="text-slate-400 block text-[10px]">Estocástico %K (Fast 3)</span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className={`text-base font-bold ${
                stoch.k >= 80 ? 'text-rose-400' :
                stoch.k <= 20 ? 'text-emerald-400' : 'text-sky-300'
              }`}>
                {stoch.k}
              </span>
              <span className="text-[9px] text-slate-500">Linha Rápida</span>
            </div>
          </div>

          {/* Estocástico %D */}
          <div className="p-2 bg-slate-950 rounded-lg border border-slate-800">
            <span className="text-slate-400 block text-[10px]">Estocástico %D (Média 3)</span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-base font-bold text-slate-200">
                {stoch.d}
              </span>
              <span className="text-[9px] text-slate-500">Linha Sinal</span>
            </div>
          </div>

          {/* Cruzamento %K x %D */}
          <div className="p-2 bg-slate-950 rounded-lg border border-slate-800">
            <span className="text-slate-400 block text-[10px]">Cruzamento %K x %D</span>
            <div className="flex items-center gap-1 mt-0.5">
              {stoch.k >= stoch.d ? (
                <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              ) : (
                <ArrowDownRight className="w-3.5 h-3.5 text-rose-400 shrink-0" />
              )}
              <span className={`text-xs font-bold truncate ${
                stoch.k >= stoch.d ? 'text-emerald-400' : 'text-rose-400'
              }`}>
                {stoch.k >= stoch.d ? '%K > %D (Alta)' : '%K < %D (Baixa)'}
              </span>
            </div>
          </div>

          {/* Estado de Oscilação */}
          <div className="p-2 bg-slate-950 rounded-lg border border-slate-800">
            <span className="text-slate-400 block text-[10px]">Região do Estocástico</span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className={`text-xs font-bold ${
                stoch.status === 'SOBRECOMPRADO' ? 'text-rose-400' :
                stoch.status === 'SOBREVENDIDO' ? 'text-emerald-400' : 'text-slate-300'
              }`}>
                {stoch.status === 'SOBRECOMPRADO' ? 'SOBRECOMPRA' :
                 stoch.status === 'SOBREVENDIDO' ? 'SOBREVENDA' : 'ZONA NEUTRA'}
              </span>
            </div>
          </div>
        </div>

        {/* Visual Stochastic 0-100 Gauge Bar */}
        <div className="bg-slate-950 rounded-lg p-2 border border-slate-800/80 space-y-1.5">
          <div className="flex items-center justify-between text-[10px] text-slate-400">
            <span className="text-emerald-400 font-semibold">0 Sobrevenda (20)</span>
            <span className="text-slate-500">Faixa Neutra de Oscilação</span>
            <span className="text-rose-400 font-semibold">(80) Sobrecompra 100</span>
          </div>
          <div className="w-full h-2.5 bg-slate-900 rounded-full relative overflow-hidden border border-slate-800">
            {/* 0-20 Oversold zone */}
            <div className="absolute left-0 top-0 bottom-0 w-[20%] bg-emerald-500/20 border-r border-emerald-500/30"></div>
            {/* 80-100 Overbought zone */}
            <div className="absolute right-0 top-0 bottom-0 w-[20%] bg-rose-500/20 border-l border-rose-500/30"></div>
            {/* %D marker (amber) */}
            <div 
              className="absolute top-0 bottom-0 w-1 bg-amber-400 z-10" 
              style={{ left: `${Math.min(99, Math.max(1, stoch.d))}%` }} 
              title={`%D: ${stoch.d}`}
            />
            {/* %K marker (sky) */}
            <div 
              className="absolute top-0 bottom-0 w-1.5 bg-sky-400 z-20 shadow-sm" 
              style={{ left: `${Math.min(99, Math.max(1, stoch.k))}%` }} 
              title={`%K: ${stoch.k}`}
            />
          </div>
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-slate-400 font-sans text-[11px] leading-tight">
              {stoch.description}
            </span>
            <div className="flex items-center gap-2 shrink-0 ml-2">
              <span className="flex items-center gap-1 text-[10px] text-sky-400">
                <span className="w-2 h-2 rounded-full bg-sky-400"></span> %K: {stoch.k}
              </span>
              <span className="flex items-center gap-1 text-[10px] text-amber-400">
                <span className="w-2 h-2 rounded-full bg-amber-400"></span> %D: {stoch.d}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── MODULE 3: MOMENTUM MACD (12, 26, 9) (NOVO) ── */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-200">
            <span className="w-1.5 h-3 bg-purple-400 rounded-full inline-block"></span>
            <BarChart2 className="w-3.5 h-3.5 text-purple-400" />
            <span>3. MOMENTUM MACD (12, 26, 9)</span>
            <span className="ml-1.5 text-[9px] px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 uppercase">
              Módulo Integrado
            </span>
          </div>
          <span className="text-[10px] text-slate-400 font-sans">
            Convergência / Divergência de Médias & Histograma
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {/* Linha MACD */}
          <div className="p-2 bg-slate-950 rounded-lg border border-slate-800">
            <span className="text-slate-400 block text-[10px]">Linha MACD (12, 26)</span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className={`text-base font-bold ${
                macd.macdLine >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}>
                {macd.macdLine > 0 ? `+${macd.macdLine}` : macd.macdLine}
              </span>
              <span className="text-[9px] text-slate-500">EMA12 - EMA26</span>
            </div>
          </div>

          {/* Linha de Sinal */}
          <div className="p-2 bg-slate-950 rounded-lg border border-slate-800">
            <span className="text-slate-400 block text-[10px]">Linha de Sinal (9)</span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-base font-bold text-slate-200">
                {macd.signalLine > 0 ? `+${macd.signalLine}` : macd.signalLine}
              </span>
              <span className="text-[9px] text-slate-500">EMA 9 do MACD</span>
            </div>
          </div>

          {/* Histograma MACD */}
          <div className="p-2 bg-slate-950 rounded-lg border border-slate-800">
            <span className="text-slate-400 block text-[10px]">Histograma MACD</span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className={`text-base font-bold ${
                macd.histogram >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}>
                {macd.histogram > 0 ? `+${macd.histogram}` : macd.histogram}
              </span>
              <span className={`text-[9px] font-semibold ${
                macd.histogramState.includes('EXPANSAO') ? 'text-amber-300' : 'text-slate-500'
              }`}>
                {macd.histogram >= 0 ? 'Positivo' : 'Negativo'}
              </span>
            </div>
          </div>

          {/* Cruzamento / Zero Line */}
          <div className="p-2 bg-slate-950 rounded-lg border border-slate-800">
            <span className="text-slate-400 block text-[10px]">Posição Zero & Sinal</span>
            <div className="flex items-center gap-1 mt-0.5">
              <span className={`text-xs font-bold truncate ${
                macd.zeroLineState === 'ACIMA_DE_ZERO' ? 'text-emerald-400' :
                macd.zeroLineState === 'ABAIXO_DE_ZERO' ? 'text-rose-400' : 'text-slate-300'
              }`}>
                {macd.zeroLineState === 'ACIMA_DE_ZERO' ? 'Acima de Zero' :
                 macd.zeroLineState === 'ABAIXO_DE_ZERO' ? 'Abaixo de Zero' : 'Linha Zero'}
              </span>
            </div>
          </div>
        </div>

        {/* Visual MACD Histogram Sparkline & Explanation */}
        <div className="bg-slate-950 rounded-lg p-2.5 border border-slate-800/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="space-y-1 flex-1">
            <div className="flex items-center gap-2">
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${macd.badgeColor}`}>
                {macd.crossoverLabel}
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                {macd.histogramStateLabel}
              </span>
            </div>
            <p className="text-[11px] text-slate-300 font-sans leading-relaxed">
              {macd.description}
            </p>
          </div>

          {/* Mini SVG Histogram Canvas */}
          {histSlice.length > 0 && (
            <div className="bg-slate-900/80 p-1.5 rounded-lg border border-slate-800 shrink-0">
              <div className="text-[9px] text-slate-500 text-center mb-0.5">Hist. 14p</div>
              <svg width="140" height="34" className="overflow-visible">
                {/* Zero line */}
                <line x1="0" y1="17" x2="140" y2="17" stroke="#475569" strokeWidth="1" strokeDasharray="2 2" />
                {histSlice.map((val, idx) => {
                  const barWidth = 7;
                  const x = idx * 10 + 2;
                  const barHeight = Math.max(2, (Math.abs(val) / maxAbsHist) * 14);
                  const isPositive = val >= 0;
                  const y = isPositive ? 17 - barHeight : 17;
                  return (
                    <rect
                      key={idx}
                      x={x}
                      y={y}
                      width={barWidth}
                      height={barHeight}
                      rx="1"
                      fill={isPositive ? '#34d399' : '#f43f5e'}
                      opacity={idx === histSlice.length - 1 ? '1' : '0.75'}
                    />
                  );
                })}
              </svg>
            </div>
          )}
        </div>
      </div>

      {/* ── MODULE 4: SÍNTESE DE CONFLUÊNCIA TÁTICA (PREÇO x RSI + ESTOCÁSTICO + MACD) ── */}
      <div className="bg-slate-900/80 rounded-xl p-3 border border-slate-800 flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-400">
            <Compass className="w-4 h-4" />
          </div>
          <div>
            <span className="text-xs font-bold text-white block">
              Confluência dos 3 Indicadores de Momentum
            </span>
            <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
              <span>RSI: <strong className={rsiDiv.type.includes('BULLISH') ? 'text-emerald-400' : rsiDiv.type.includes('BEARISH') ? 'text-rose-400' : 'text-slate-300'}>
                {rsiDiv.hasDivergence ? rsiDiv.title : 'Alinhado'}
              </strong></span>
              <span>•</span>
              <span>Estocástico: <strong className={stoch.k > stoch.d ? 'text-emerald-400' : 'text-rose-400'}>
                {stoch.k > stoch.d ? '%K > %D' : '%K < %D'} ({stoch.status})
              </strong></span>
              <span>•</span>
              <span>MACD: <strong className={macd.histogram >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                {macd.histogram >= 0 ? 'Hist +' : 'Hist -'}
              </strong></span>
            </div>
          </div>
        </div>

        <div>
          {isConfluentBullish ? (
            <span className="px-2.5 py-1 rounded text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              CONFLUÊNCIA DE COMPRA (ALTA)
            </span>
          ) : isConfluentBearish ? (
            <span className="px-2.5 py-1 rounded text-xs font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40 flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
              CONFLUÊNCIA DE VENDA (BAIXA)
            </span>
          ) : (
            <span className="px-2.5 py-1 rounded text-xs font-bold bg-slate-800 text-slate-300 border border-slate-700 flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-slate-400" />
              MOMENTUM CONCORDANTE / NEUTRO
            </span>
          )}
        </div>
      </div>

    </div>
  );
};
