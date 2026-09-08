import React, { useState, useMemo, useEffect } from 'react';
import { 
  TradeSignal, 
  Candle 
} from '../types';
import { 
  Layers, 
  Cpu, 
  ShieldCheck, 
  TrendingUp, 
  TrendingDown, 
  Zap, 
  BarChart2, 
  BarChart3,
  Target,
  Maximize2, 
  RefreshCw, 
  DollarSign, 
  Compass, 
  Sparkles,
  AlertTriangle,
  ArrowRight,
  Volume2,
  BellRing,
  Activity,
  ShieldAlert,
  HelpCircle
} from 'lucide-react';
import { calculateVolumeProfile } from '../utils/volumeProfile';
import { VolumeProfilePanel } from './VolumeProfilePanel';
import { detectSignalSetupType, getSetupDetails, playSignalAudio, playTone } from '../utils/audioAlert';
import { 
  ChartTimeframe, 
  TIMEFRAMES_LIST, 
  getTimeframeMeta, 
  generateCandlesForTimeframe, 
  calculateRsi, 
  calculateStochRsi, 
  detectPriceOscillatorDivergence, 
  calculateVolatilityAnomaly, 
  TradingExecutionStyle 
} from '../utils/technicalAnalysis';
import { VolatilityAlertModal } from './VolatilityAlertModal';
import { DivergenceAnalysisCard } from './DivergenceAnalysisCard';
import { TradingStyleRiskCard } from './TradingStyleRiskCard';
import { TradeLifecycleStatusCard } from './TradeLifecycleStatusCard';

interface TripleScreenViewerProps {
  signal: TradeSignal;
  signals?: TradeSignal[];
  onSelectSymbol?: (symbol: string) => void;
  onOpenRiskCalc: (signal: TradeSignal, defaultStyle?: TradingExecutionStyle) => void;
  onRefreshAI: (symbol: string) => Promise<void>;
  isAiLoading: boolean;
  onRefreshPrices?: () => Promise<void> | void;
}

export const TripleScreenViewer: React.FC<TripleScreenViewerProps> = ({
  signal,
  signals,
  onSelectSymbol,
  onOpenRiskCalc,
  onRefreshAI,
  isAiLoading,
  onRefreshPrices,
}) => {
  // 13 Timeframes supported: 3m, 5m, 15m, 30m, 1h, 2h, 8h, 12h, 1d, 3d, 5d, 1w, 2w
  const [activeTf, setActiveTf] = useState<ChartTimeframe>('1h');
  const [hoveredCandle, setHoveredCandle] = useState<Candle | null>(null);
  const [showVolumeProfile, setShowVolumeProfile] = useState<boolean>(true);

  // Volatility Anomaly (+2σ) Pop-up and Monitoring State
  const [volatilityAlertEnabled, setVolatilityAlertEnabled] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('god_protocol_volatility_alert_enabled');
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });
  const [showVolatilityModal, setShowVolatilityModal] = useState<boolean>(false);
  const [snoozedSymbols, setSnoozedSymbols] = useState<Set<string>>(new Set());
  const [triggeredAlerts, setTriggeredAlerts] = useState<Record<string, boolean>>({});
  const [wyckoffPerspective, setWyckoffPerspective] = useState<'MACRO' | 'MICRO'>('MACRO');
  const [sentimentPerspective, setSentimentPerspective] = useState<'MACRO' | 'MICRO'>('MACRO');

  // Toggle Volatility Monitoring
  const handleToggleVolatilityAlert = () => {
    const nextState = !volatilityAlertEnabled;
    setVolatilityAlertEnabled(nextState);
    try {
      localStorage.setItem('god_protocol_volatility_alert_enabled', String(nextState));
    } catch (e) {
      console.error(e);
    }
  };

  // Snooze symbol for session
  const handleSnoozeSymbol = (sym: string) => {
    setSnoozedSymbols((prev) => new Set([...prev, sym]));
  };

  // Generate realistic candles for the selected timeframe
  const candles = useMemo(() => {
    return generateCandlesForTimeframe(signal, activeTf);
  }, [signal, activeTf]);

  const activeMeta = useMemo(() => {
    return getTimeframeMeta(activeTf);
  }, [activeTf]);

  // Technical Indicators: RSI(14), Stochastic RSI (%K, %D)
  const rsiValues = useMemo(() => {
    return calculateRsi(candles, 14);
  }, [candles]);

  const stochRsi = useMemo(() => {
    return calculateStochRsi(rsiValues, 14, 3, 3);
  }, [rsiValues]);

  // Divergence Engine (Price vs RSI & Stochastic RSI)
  const divergence = useMemo(() => {
    return detectPriceOscillatorDivergence(candles, rsiValues, stochRsi.k, stochRsi.d);
  }, [candles, rsiValues, stochRsi]);

  // 14-period Volatility & 2-Sigma Anomaly Detection
  const volatilityStats = useMemo(() => {
    return calculateVolatilityAnomaly(candles, 14);
  }, [candles]);

  // Trigger pop-up warning automatically when volatility exceeds +2σ and alert is ON
  useEffect(() => {
    const alertKey = `${signal.symbol}_${activeTf}`;
    if (
      volatilityAlertEnabled &&
      volatilityStats.isExtremeSurge &&
      !snoozedSymbols.has(signal.symbol) &&
      !triggeredAlerts[alertKey]
    ) {
      setShowVolatilityModal(true);
      setTriggeredAlerts((prev) => ({ ...prev, [alertKey]: true }));
      try {
        playTone('VOLATILITY_ALERT');
      } catch (e) {
        console.error(e);
      }
    }
  }, [volatilityAlertEnabled, volatilityStats.isExtremeSurge, signal.symbol, activeTf, snoozedSymbols, triggeredAlerts]);

  // Calculate Volume Profile & Wyckoff Liquidity Nodes (POC, VAH, VAL, HVN, LVN)
  const vpData = useMemo(() => {
    return calculateVolumeProfile(candles, signal.currentPrice, 22);
  }, [candles, signal.currentPrice]);

  // Chart min/max scaling calculations
  const prices = candles.flatMap((c) => [c.high, c.low]);
  const minPrice = Math.min(...prices) * 0.995;
  const maxPrice = Math.max(...prices) * 1.005;
  const priceRange = maxPrice - minPrice || 1;

  const chartHeight = 220;
  const chartWidth = 650;
  const candleWidth = Math.max(5, (chartWidth / (candles.length || 1)) * 0.65);
  const candleGap = chartWidth / (candles.length || 1);

  const getY = (price: number) => {
    return chartHeight - ((price - minPrice) / priceRange) * chartHeight;
  };

  // EMA Lines calculations (EMA 9, 21, 50)
  const ema9Series = useMemo(() => {
    const closes = candles.map((c) => c.close);
    const k = 2 / (9 + 1);
    let ema = closes[0] || 1;
    return closes.map((c, i) => {
      ema = i === 0 ? c : c * k + ema * (1 - k);
      return ema;
    });
  }, [candles]);

  const ema21Series = useMemo(() => {
    const closes = candles.map((c) => c.close);
    const k = 2 / (21 + 1);
    let ema = closes[0] || 1;
    return closes.map((c, i) => {
      ema = i === 0 ? c : c * k + ema * (1 - k);
      return ema;
    });
  }, [candles]);

  const ema50Series = useMemo(() => {
    const closes = candles.map((c) => c.close);
    const k = 2 / (50 + 1);
    let ema = closes[0] || 1;
    return closes.map((c, i) => {
      ema = i === 0 ? c : c * k + ema * (1 - k);
      return ema;
    });
  }, [candles]);

  const buildEmaPath = (series: number[]) => {
    return series
      .map((val, idx) => {
        const x = idx * candleGap + candleGap / 2;
        const y = getY(val);
        return `${idx === 0 ? 'M' : 'L'} ${x} ${y}`;
      })
      .join(' ');
  };

  // Grouped timeframes for the selector ribbon
  const tfGroups = [
    { name: 'SCALP', tfs: ['3m', '5m', '15m', '30m'] as ChartTimeframe[] },
    { name: 'DAY TRADE', tfs: ['1h', '2h', '8h', '12h'] as ChartTimeframe[] },
    { name: 'SWING & POSITION', tfs: ['1d', '3d', '5d', '1w', '2w'] as ChartTimeframe[] },
  ];

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
      {/* Top Header */}
      <div className="p-4 sm:p-6 border-b border-slate-800 bg-slate-950/40 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-lg font-mono text-white shadow-inner">
            {signal.symbol.slice(0, 3)}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-bold font-mono text-white tracking-tight">
                {signal.symbol}
              </h2>
              <span className="text-xs text-slate-400">({signal.name})</span>
              {signal.marketCapRank && (
                <span className="px-1.5 py-0.5 rounded text-[11px] font-mono bg-amber-400/10 border border-amber-400/30 text-amber-400 font-bold">
                  Rank #{signal.marketCapRank}
                </span>
              )}
              {signal.passedFilter ? (
                <span className="px-2 py-0.5 rounded-full text-xs font-mono bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-semibold flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Confluência Aprovada
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-xs font-mono bg-amber-500/10 border border-amber-500/30 text-amber-300">
                  Aguardando Confluência Total
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-1 text-xs text-slate-400 font-mono">
              <span>Preço: <strong className="text-white">${signal.currentPrice.toLocaleString()}</strong></span>
              <span>•</span>
              <span className={signal.change24h >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                24h: {signal.change24h >= 0 ? `+${signal.change24h}%` : `${signal.change24h}%`}
              </span>
              <span>•</span>
              <span>ATR: <strong className="text-slate-300">{signal.atrValue}</strong></span>
              <span>•</span>
              <span className="text-amber-300">
                TF Atual: <strong>{activeMeta.fullName}</strong>
              </span>
            </div>

            {/* Signal Setup Archetype & Audio Preview */}
            {(() => {
              const setup = getSetupDetails(detectSignalSetupType(signal));
              return (
                <div className="flex items-center gap-1.5 mt-1.5">
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${setup.color}`}>
                    Setup: {setup.label}
                  </span>
                  <button
                    id={`btn-sound-preview-${signal.symbol}`}
                    onClick={() => playSignalAudio(signal, 'HIGH')}
                    className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-400 hover:text-amber-400 hover:border-amber-500/50 transition flex items-center gap-1 text-[10px] font-mono"
                    title={`Ouvir som personalizado para ${setup.label}`}
                  >
                    <Volume2 className="w-3 h-3 text-amber-400" />
                    <span>Ouvir Alerta</span>
                  </button>
                </div>
              );
            })()}
          </div>
        </div>

        {/* Header Controls: Volatility Anomaly Switch + Coin Switcher + AI Confidence */}
        <div className="flex items-center gap-2.5 flex-wrap justify-between sm:justify-end">
          {/* Volatility Alert (+2σ) Control Switch */}
          <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl p-1.5 gap-1.5">
            <button
              id="btn-toggle-volatility-alert-switch"
              onClick={handleToggleVolatilityAlert}
              className={`px-2 py-1 rounded-lg text-xs font-mono font-medium transition flex items-center gap-1.5 border ${
                volatilityAlertEnabled
                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                  : 'bg-slate-900 text-slate-400 border-slate-700 hover:text-slate-300'
              }`}
              title="Ligar ou desligar o alerta visual automático de volatilidade extrema (+2σ)"
            >
              <Zap className={`w-3.5 h-3.5 ${volatilityAlertEnabled ? 'text-emerald-400' : 'text-slate-500'}`} />
              <span>Alerta 2σ: {volatilityAlertEnabled ? 'LIGADO' : 'DESLIGADO'}</span>
            </button>

            {/* Z-Score Badge */}
            <span 
              className={`px-2 py-1 rounded-lg text-[10px] font-mono font-bold border ${
                volatilityStats.isExtremeSurge
                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse'
                  : 'bg-slate-900 text-slate-400 border-slate-800'
              }`}
              title={`Volatilidade Atual: ${volatilityStats.currentPeriodVolatility}% | Média: ${volatilityStats.historicalMean14}% | Limiar 2σ: ${volatilityStats.threshold2Sigma}%`}
            >
              {volatilityStats.isExtremeSurge ? '⚠️ ' : ''}+{volatilityStats.zScore}σ
            </span>

            {/* Test Trigger Button */}
            <button
              id="btn-force-open-volatility-popup"
              onClick={() => setShowVolatilityModal(true)}
              className="p-1 rounded text-slate-400 hover:text-amber-400 hover:bg-slate-900 transition"
              title="Abrir pop-up de advertência de volatilidade para visualização"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
            </button>
          </div>

          {signals && onSelectSymbol && (
            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-2 flex flex-col items-start gap-1 text-xs font-mono">
              <span className="text-[10px] text-slate-400 uppercase font-semibold">Selecionar Moeda:</span>
              <select
                id="select-coin-triplescreen"
                value={signal.symbol}
                onChange={(e) => onSelectSymbol(e.target.value)}
                className="bg-slate-900 border border-slate-700 text-white rounded px-2 py-1 text-xs font-mono focus:outline-none focus:border-amber-500"
              >
                {signals.map((s) => (
                  <option key={s.symbol} value={s.symbol}>
                    {s.symbol} ({s.decision} - {s.confidence}%)
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="bg-slate-950 border border-slate-800 rounded-xl p-2 sm:p-2.5 text-center min-w-[85px] sm:min-w-[100px]">
            <div className="text-[10px] font-mono text-slate-500 uppercase">Confiança IA</div>
            <div className={`text-lg sm:text-xl font-bold font-mono ${signal.confidence >= 75 ? 'text-emerald-400' : 'text-amber-400'}`}>
              {signal.confidence}%
            </div>
            <div className="text-[9px] font-mono text-slate-400">Meta: ≥ 75%</div>
          </div>
        </div>
      </div>

      {/* Real-Time Trade Lifecycle Status Card (Válido, Em Andamento, TP Atingido, Invalidado) */}
      <div className="px-4 sm:px-6 pt-3">
        <TradeLifecycleStatusCard 
          signal={signal} 
          onOpenRiskCalc={() => onOpenRiskCalc(signal)} 
        />
      </div>

      {/* Grid: Triple Screen Interactive Chart + 4 Pillars Panel */}
      <div className="p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Triple Screen Interactive Chart & Technical Modules (7 cols) */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          {/* Timeframe Selector Ribbon (13 Timeframes) */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-2.5 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <BarChart2 className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-xs font-mono font-bold text-white uppercase tracking-wider">
                  Tempos Gráficos (13 Intervalos):
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  id="btn-toggle-volume-profile"
                  onClick={() => setShowVolumeProfile(!showVolumeProfile)}
                  className={`px-2 py-0.5 rounded text-[11px] font-mono font-medium transition flex items-center gap-1 border ${
                    showVolumeProfile 
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' 
                      : 'bg-slate-900 text-slate-400 border-slate-700 hover:text-slate-200'
                  }`}
                  title="Exibir ou ocultar Volume Profile e POC de Wyckoff no gráfico"
                >
                  <BarChart3 className="w-3 h-3" />
                  <span>POC: {showVolumeProfile ? 'Ativo' : 'Oculto'}</span>
                </button>
              </div>
            </div>

            {/* Timeframe Buttons Ribbon */}
            <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-800/80">
              {tfGroups.map((grp) => (
                <div key={grp.name} className="flex items-center gap-1 bg-slate-900/60 p-1 rounded-lg border border-slate-800/80">
                  <span className="text-[9px] font-mono text-slate-500 uppercase px-1 font-bold">
                    {grp.name}:
                  </span>
                  {grp.tfs.map((tf) => {
                    const isSelected = activeTf === tf;
                    return (
                      <button
                        key={tf}
                        id={`btn-tf-${tf}`}
                        onClick={() => setActiveTf(tf)}
                        className={`px-2 py-0.5 text-xs font-mono font-medium rounded transition ${
                          isSelected
                            ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                            : 'text-slate-400 hover:text-white hover:bg-slate-800'
                        }`}
                        title={getTimeframeMeta(tf).description}
                      >
                        {tf}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>

            {/* Selected Timeframe Details Subtitle */}
            <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 pt-0.5">
              <span className="text-slate-300">
                Visualizando: <strong className="text-amber-400">{activeMeta.fullName}</strong> — {activeMeta.description}
              </span>
              <span className="text-slate-500">
                {candles.length} candles processados
              </span>
            </div>
          </div>

          {/* Candlestick & Indicators SVG Chart */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 relative select-none overflow-hidden">
            {/* Legend */}
            <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 pb-2 border-b border-slate-800/60 mb-2 overflow-x-auto no-scrollbar">
              <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-0.5 bg-sky-400"></span>
                  EMA 9
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-0.5 bg-amber-400"></span>
                  EMA 21
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-0.5 bg-purple-400"></span>
                  EMA 50
                </span>
                {showVolumeProfile && vpData && (
                  <span className="flex items-center gap-1 text-amber-400 font-bold bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/30">
                    <Target className="w-3 h-3" />
                    POC: ${(vpData.pocPrice ?? 0) >= 1 ? (vpData.pocPrice ?? 0).toFixed(2) : (vpData.pocPrice ?? 0).toFixed(4)}
                  </span>
                )}
              </div>
              <div className="text-[10px] text-slate-500">
                {hoveredCandle ? `O:${hoveredCandle.open} H:${hoveredCandle.high} L:${hoveredCandle.low} C:${hoveredCandle.close}` : 'Passe o cursor sobre os candles'}
              </div>
            </div>

            {/* SVG Canvas */}
            <svg 
              viewBox={`0 0 ${chartWidth} ${chartHeight}`} 
              className="w-full h-[220px] overflow-visible"
            >
              {/* Horizontal Price Grids */}
              {[0.2, 0.4, 0.6, 0.8].map((ratio) => {
                const y = chartHeight * ratio;
                const p = minPrice + (1 - ratio) * priceRange;
                const safeP = isNaN(p) || !isFinite(p) ? 0 : p;
                return (
                  <g key={ratio}>
                    <line x1={0} y1={y} x2={chartWidth} y2={y} stroke="#1e293b" strokeDasharray="3 3" />
                    <text x={chartWidth - 5} y={y - 3} fill="#64748b" fontSize="9" textAnchor="end" fontFamily="monospace">
                      ${safeP.toFixed((signal.currentPrice ?? 0) > 100 ? 1 : 3)}
                    </text>
                  </g>
                );
              })}

              {/* Volume Profile Wyckoff Overlay (Histogram Bars) */}
              {showVolumeProfile && vpData && (
                <g className="volume-profile-histogram opacity-75">
                  {vpData.bins.map((bin) => {
                    const yTop = getY(bin.highPrice);
                    const yBottom = getY(bin.lowPrice);
                    const barHeight = Math.max(2, Math.abs(yBottom - yTop) - 0.5);
                    const maxVol = Math.max(...vpData.bins.map((b) => b.totalVolume)) || 1;
                    const barWidth = (bin.totalVolume / maxVol) * 135;
                    const xStart = chartWidth - barWidth;

                    const buyShare = bin.totalVolume > 0 ? bin.buyVolume / bin.totalVolume : 0.5;
                    const buyWidth = barWidth * buyShare;
                    const sellWidth = barWidth - buyWidth;

                    return (
                      <g key={`chart-vp-bin-${bin.index}`}>
                        <rect
                          x={xStart}
                          y={yTop}
                          width={buyWidth}
                          height={barHeight}
                          fill={bin.isPOC ? '#f59e0b' : '#10b981'}
                          fillOpacity={bin.isPOC ? 0.75 : bin.isValueArea ? 0.4 : 0.2}
                        />
                        <rect
                          x={xStart + buyWidth}
                          y={yTop}
                          width={sellWidth}
                          height={barHeight}
                          fill={bin.isPOC ? '#d97706' : '#f43f5e'}
                          fillOpacity={bin.isPOC ? 0.85 : bin.isValueArea ? 0.4 : 0.2}
                        />
                      </g>
                    );
                  })}
                </g>
              )}

              {/* EMA Indicator Curves */}
              <path d={buildEmaPath(ema9Series)} fill="none" stroke="#38bdf8" strokeWidth="1.2" opacity="0.85" />
              <path d={buildEmaPath(ema21Series)} fill="none" stroke="#f59e0b" strokeWidth="1.4" opacity="0.85" />
              <path d={buildEmaPath(ema50Series)} fill="none" stroke="#a855f7" strokeWidth="1.5" opacity="0.8" />

              {/* Candlesticks */}
              {candles.map((candle, idx) => {
                const x = idx * candleGap + candleGap / 2;
                const isGreen = candle.close >= candle.open;
                const candleColor = isGreen ? '#10b981' : '#f43f5e';
                const yHigh = getY(candle.high);
                const yLow = getY(candle.low);
                const yOpen = getY(candle.open);
                const yClose = getY(candle.close);
                const bodyTop = Math.min(yOpen, yClose);
                const bodyHeight = Math.max(2, Math.abs(yClose - yOpen));

                // If this is the latest candle and volatility is surging (+2σ), highlight with glowing aura
                const isLatest = idx === candles.length - 1;
                const isSurging = isLatest && volatilityStats.isExtremeSurge;

                return (
                  <g 
                    key={candle.timestamp}
                    onMouseEnter={() => setHoveredCandle(candle)}
                    onMouseLeave={() => setHoveredCandle(null)}
                    className="cursor-crosshair group"
                  >
                    {isSurging && (
                      <circle
                        cx={x}
                        cy={(yHigh + yLow) / 2}
                        r={candleWidth * 2.2}
                        fill="#f43f5e"
                        fillOpacity="0.2"
                        className="animate-pulse"
                      />
                    )}
                    {/* Wick */}
                    <line 
                      x1={x} 
                      y1={yHigh} 
                      x2={x} 
                      y2={yLow} 
                      stroke={isSurging ? '#fb7185' : candleColor} 
                      strokeWidth={isSurging ? 2 : 1.2} 
                    />
                    {/* Body */}
                    <rect
                      x={x - candleWidth / 2}
                      y={bodyTop}
                      width={candleWidth}
                      height={bodyHeight}
                      fill={isSurging ? '#f43f5e' : candleColor}
                      rx={1}
                      stroke={isSurging ? '#ffffff' : undefined}
                      strokeWidth={isSurging ? 1 : 0}
                    />
                  </g>
                );
              })}

              {/* Entry, Stop Loss, Take Profit lines if signal passed */}
              {signal.passedFilter && (
                <>
                  <line 
                    x1={0} 
                    y1={getY(signal.entryPrice)} 
                    x2={chartWidth} 
                    y2={getY(signal.entryPrice)} 
                    stroke="#38bdf8" 
                    strokeWidth={1.5} 
                    strokeDasharray="4 2" 
                  />
                  <line 
                    x1={0} 
                    y1={getY(signal.stopLoss)} 
                    x2={chartWidth} 
                    y2={getY(signal.stopLoss)} 
                    stroke="#f43f5e" 
                    strokeWidth={1.5} 
                  />
                  <line 
                    x1={0} 
                    y1={getY(signal.takeProfit1)} 
                    x2={chartWidth} 
                    y2={getY(signal.takeProfit1)} 
                    stroke="#10b981" 
                    strokeWidth={1.5} 
                  />
                </>
              )}

              {/* Volume Profile Wyckoff POC & Value Area Lines */}
              {showVolumeProfile && vpData && (
                <g className="volume-profile-key-levels">
                  <line 
                    x1={0} 
                    y1={getY(vpData.vahPrice)} 
                    x2={chartWidth - 90} 
                    y2={getY(vpData.vahPrice)} 
                    stroke="#38bdf8" 
                    strokeWidth={1.2} 
                    strokeDasharray="4 2" 
                    opacity={0.8}
                  />
                  <text 
                    x={chartWidth - 95} 
                    y={getY(vpData.vahPrice) - 3} 
                    fill="#38bdf8" 
                    fontSize="8" 
                    textAnchor="end" 
                    fontFamily="monospace"
                  >
                    VAH (70%): ${(vpData.vahPrice ?? 0) >= 1 ? (vpData.vahPrice ?? 0).toFixed(2) : (vpData.vahPrice ?? 0).toFixed(4)}
                  </text>

                  <line 
                    x1={0} 
                    y1={getY(vpData.valPrice)} 
                    x2={chartWidth - 90} 
                    y2={getY(vpData.valPrice)} 
                    stroke="#10b981" 
                    strokeWidth={1.2} 
                    strokeDasharray="4 2" 
                    opacity={0.8}
                  />
                  <text 
                    x={chartWidth - 95} 
                    y={getY(vpData.valPrice) + 9} 
                    fill="#10b981" 
                    fontSize="8" 
                    textAnchor="end" 
                    fontFamily="monospace"
                  >
                    VAL (70%): ${(vpData.valPrice ?? 0) >= 1 ? (vpData.valPrice ?? 0).toFixed(2) : (vpData.valPrice ?? 0).toFixed(4)}
                  </text>

                  <line 
                    x1={0} 
                    y1={getY(vpData.pocPrice)} 
                    x2={chartWidth} 
                    y2={getY(vpData.pocPrice)} 
                    stroke="#f59e0b" 
                    strokeWidth={1.8} 
                  />
                  <rect
                    x={chartWidth - 112}
                    y={getY(vpData.pocPrice) - 8}
                    width={108}
                    height={16}
                    rx={3}
                    fill="#f59e0b"
                  />
                  <text
                    x={chartWidth - 58}
                    y={getY(vpData.pocPrice) + 4}
                    fill="#020617"
                    fontSize="9"
                    fontWeight="bold"
                    textAnchor="middle"
                    fontFamily="monospace"
                  >
                    POC: ${(vpData.pocPrice ?? 0) >= 1 ? (vpData.pocPrice ?? 0).toFixed(2) : (vpData.pocPrice ?? 0).toFixed(4)}
                  </text>
                </g>
              )}
            </svg>

            {/* Timeframe Specific Diagnosis Box */}
            <div className="mt-3 p-2.5 bg-slate-900 border border-slate-800 rounded-lg text-xs font-mono flex flex-wrap items-center justify-between gap-2">
              <div className="text-slate-300">
                Intervalo: <strong className="text-amber-400">{activeMeta.fullName}</strong> ({activeMeta.category})
              </div>
              <div className="text-slate-400 flex items-center gap-2 sm:gap-3 flex-wrap">
                <span>RSI(14): <strong className="text-sky-300">{divergence.rsiCurrent}</strong></span>
                <span>•</span>
                <span>Estocástico: <strong className="text-amber-300">{divergence.stochKCurrent} / {divergence.stochDCurrent}</strong></span>
                <span>•</span>
                <span>MACD Hist: <strong className={divergence.macd.histogram >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                  {divergence.macd.histogram > 0 ? `+${divergence.macd.histogram}` : divergence.macd.histogram}
                </strong></span>
                <span>•</span>
                <span>
                  Volatilidade 14p: <strong className={volatilityStats.isExtremeSurge ? 'text-rose-400' : 'text-emerald-400'}>
                    +{volatilityStats.zScore}σ
                  </strong>
                </span>
              </div>
            </div>
          </div>

          {/* Module: Divergence Analysis Card (Price vs RSI & Stochastic RSI) */}
          <DivergenceAnalysisCard 
            divergence={divergence} 
            symbol={signal.symbol} 
            timeframe={activeTf} 
          />

          {/* Module: Quantitative Risk Execution Card (Divided by SCALP, DAY TRADE, SWING TRADE, POSITION TRADE) */}
          <TradingStyleRiskCard 
            signal={signal} 
            onOpenRiskCalc={onOpenRiskCalc} 
            onRefreshPrices={onRefreshPrices}
          />

          {/* Wyckoff Volume Profile & Liquidity Zones Panel */}
          <VolumeProfilePanel 
            vpData={vpData} 
            symbol={signal.symbol} 
            timeframeName={activeMeta.fullName} 
            currentPrice={signal.currentPrice} 
          />
        </div>

        {/* Right Column: The 4 Pillars Confluence + AI Thesis (5 cols) */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-amber-400" />
              Os Quatro Pilares de Confluência
            </h3>
            <span className="text-xs font-mono text-emerald-400 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30">
              Confluência: {signal.fourPillars.confluenceAverage}%
            </span>
          </div>

          {/* Pillar 1: Clássica & Médias */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs">
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-sky-400"></span>
                A. Análise Técnica & Médias
              </span>
              <span className="font-mono text-xs text-sky-400 font-bold">
                {signal.fourPillars.classicTA.score}%
              </span>
            </div>
            <div className="text-slate-400 text-[11px] leading-relaxed">
              Alinhamento: <strong className="text-slate-200">{signal.fourPillars.classicTA.emaAlignment}</strong>. Padrão MTF: <strong className="text-slate-200">{signal.fourPillars.classicTA.patternDetected}</strong>. {signal.fourPillars.classicTA.rsiInterpretation}.
            </div>
          </div>

          {/* Pillar 2: Smart Money Concepts & Liquidez */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs">
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                B. Smart Money Concepts (SMC) & Liquidez
              </span>
              <span className="font-mono text-xs text-amber-400 font-bold">
                {signal.fourPillars.smc.score}%
              </span>
            </div>
            <div className="text-slate-400 text-[11px] leading-relaxed">
              Sweep: <strong className="text-amber-300">{signal.fourPillars.smc.liquiditySweep.type}</strong>. Imbalance FVG: <strong className="text-slate-200">{signal.fourPillars.smc.imbalanceFVG.zone}</strong>. Order Block: <strong className="text-slate-200">{signal.fourPillars.smc.orderBlock.zone}</strong>.
            </div>
          </div>

          {/* Pillar 3: Wyckoff & Volume Profile */}
          <div id="wyckoff-regime-card" className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-purple-400"></span>
                C. Teoria de Wyckoff, VSA & Volume Profile
              </span>
              <span className="font-mono text-xs text-purple-400 font-bold">
                {signal.fourPillars.wyckoff.score}%
              </span>
            </div>

            {/* Asset Identifier & Macro/Micro Toggle */}
            <div className="flex items-center justify-between gap-2 p-1.5 bg-slate-900/90 rounded-lg border border-purple-500/20 mb-2 font-mono">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-slate-400 uppercase">Ativo Analisado:</span>
                <span className="text-white font-bold text-xs bg-purple-500/20 text-purple-200 px-2 py-0.5 rounded border border-purple-500/40">
                  {signal.symbol}
                </span>
                <span className="text-[10px] text-slate-400 hidden sm:inline">({signal.name})</span>
              </div>

              {/* Macro / Micro Selector */}
              <div className="flex items-center bg-slate-950 p-0.5 rounded-md border border-slate-800 text-[10px]">
                <button
                  id="btn-wyckoff-perspective-macro"
                  onClick={() => setWyckoffPerspective('MACRO')}
                  className={`px-2 py-0.5 rounded font-bold transition flex items-center gap-1 ${
                    wyckoffPerspective === 'MACRO'
                      ? 'bg-purple-600 text-white shadow-xs'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title="Visão Macro: Gráficos Diário (1D) e 4 Horas (4H)"
                >
                  <span>🌐 Macro (1D/4H)</span>
                </button>
                <button
                  id="btn-wyckoff-perspective-micro"
                  onClick={() => setWyckoffPerspective('MICRO')}
                  className={`px-2 py-0.5 rounded font-bold transition flex items-center gap-1 ${
                    wyckoffPerspective === 'MICRO'
                      ? 'bg-purple-600 text-white shadow-xs'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title="Visão Micro: Gráficos de 15 Minutos (15m) e 1 Hora (1H)"
                >
                  <span>⚡ Micro (15m/1H)</span>
                </button>
              </div>
            </div>

            {/* Dynamic content depending on Macro vs Micro */}
            {wyckoffPerspective === 'MACRO' ? (
              <div className="space-y-1 text-slate-400 text-[11px] leading-relaxed">
                <div>
                  Ciclo Macro (1D/4H): <strong className="text-purple-300">{signal.fourPillars.wyckoff.currentPhase}</strong>.
                </div>
                <div>
                  Esforço vs Resultado: <strong className="text-slate-200">{signal.fourPillars.wyckoff.effortVsResult}</strong>.
                </div>
                <div className="text-[10px] text-slate-400">
                  Estrutura institucional dominante mapeada com absorção em ranges consolidados pluridividuais.
                </div>
              </div>
            ) : (
              <div className="space-y-1 text-slate-400 text-[11px] leading-relaxed">
                <div>
                  Ciclo Micro (15m/1H): <strong className="text-purple-300">
                    {signal.decision === 'COMPRA' 
                      ? 'Fase C (Spring / Shakeout Intraday): Varredura rápida de liquidez no Order Block em 15m' 
                      : signal.decision === 'VENDA'
                      ? 'Fase C (UTAD / Upthrust Intraday): Rejeição violenta na resistência em 15m'
                      : 'Fase B (Construção de Causa): Consolidação e teste de oferta local'}
                  </strong>.
                </div>
                <div>
                  Volume de Agressão Micro: <strong className="text-slate-200">
                    {signal.decision === 'COMPRA' 
                      ? 'Exaustão vendedora na mínima com absorção passiva no book' 
                      : 'Exaustão compradora na máxima com pressão de venda imediata'}
                  </strong>.
                </div>
                <div className="text-[10px] text-slate-400">
                  Gatilho de entrada sincronizado com teste de volume relativo (RVOL {((signal.fourPillars?.wyckoff?.volumeRatio ?? 1.35)).toFixed(2)}x).
                </div>
              </div>
            )}

            {vpData && (
              <div className="mt-2 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] font-mono">
                <span className="text-amber-400 font-bold flex items-center gap-1">
                  <Target className="w-3 h-3" /> POC {wyckoffPerspective}: ${(vpData.pocPrice ?? 0) >= 1 ? (vpData.pocPrice ?? 0).toFixed(2) : (vpData.pocPrice ?? 0).toFixed(4)}
                </span>
                <span className={`font-semibold ${vpData.currentPriceStatus?.color ?? 'text-slate-300'}`}>
                  {vpData.currentPriceStatus?.label ?? 'Neutro'}
                </span>
              </div>
            )}
          </div>

          {/* Pillar 4: Sentimento Futuros */}
          <div id="sentiment-futures-card" className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                D. Sentimento Futuros (OI & Funding)
              </span>
              <span className="font-mono text-xs text-emerald-400 font-bold">
                {signal.fourPillars?.sentiment?.score ?? 80}%
              </span>
            </div>

            {/* Asset Identifier & Macro/Micro Toggle */}
            <div className="flex items-center justify-between gap-2 p-1.5 bg-slate-900/90 rounded-lg border border-emerald-500/20 mb-2 font-mono">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-slate-400 uppercase">Ativo Analisado:</span>
                <span className="text-white font-bold text-xs bg-emerald-500/20 text-emerald-200 px-2 py-0.5 rounded border border-emerald-500/40">
                  {signal.symbol}
                </span>
                <span className="text-[10px] text-slate-400 hidden sm:inline">({signal.name})</span>
              </div>

              {/* Macro / Micro Selector */}
              <div className="flex items-center bg-slate-950 p-0.5 rounded-md border border-slate-800 text-[10px]">
                <button
                  id="btn-sentiment-perspective-macro"
                  onClick={() => setSentimentPerspective('MACRO')}
                  className={`px-2 py-0.5 rounded font-bold transition flex items-center gap-1 ${
                    sentimentPerspective === 'MACRO'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title="Visão Macro: Posições de Longo Prazo, Taxa de Financiamento 8h/24h e OI Diário"
                >
                  <span>🌐 Macro (1D/4H)</span>
                </button>
                <button
                  id="btn-sentiment-perspective-micro"
                  onClick={() => setSentimentPerspective('MICRO')}
                  className={`px-2 py-0.5 rounded font-bold transition flex items-center gap-1 ${
                    sentimentPerspective === 'MICRO'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title="Visão Micro: Fluxo Intraday (15m/1H), Delta de Agressão Imediato e Risco de Cascata"
                >
                  <span>⚡ Micro (15m/1H)</span>
                </button>
              </div>
            </div>

            {/* Dynamic content depending on Macro vs Micro */}
            {sentimentPerspective === 'MACRO' ? (
              <div className="space-y-1 text-slate-400 text-[11px] leading-relaxed">
                <div>
                  Funding Rate 24h Ponderado: <strong className="text-emerald-300">
                    {(((signal.fourPillars?.sentiment?.fundingRate ?? 0.0001) * 100)).toFixed(3)}% ({signal.fourPillars?.sentiment?.fundingSentiment ?? 'Neutro'})
                  </strong>.
                </div>
                <div>
                  OI Delta 24h: <strong className="text-slate-200">{signal.fourPillars?.sentiment?.oi24hChange ?? 0}%</strong>. Long/Short Global: <strong className="text-slate-200">{signal.fourPillars?.sentiment?.longShortRatio ?? 1.2}</strong>.
                </div>
                <div className="text-[10px] text-slate-400">
                  Alavancagem macro sustentável sem excesso de posições especulativas contra a tendência primária.
                </div>
              </div>
            ) : (
              <div className="space-y-1 text-slate-400 text-[11px] leading-relaxed">
                <div>
                  Delta de Agressão Micro (15m/1H): <strong className="text-emerald-300">
                    {signal.decision === 'COMPRA' ? '+58.4% Comprador (Absorção no Ask)' : '-62.1% Vendedor (Agressão no Bid)'}
                  </strong>.
                </div>
                <div>
                  Fluxo de Liquidação Instantâneo: <strong className="text-slate-200">
                    {signal.decision === 'COMPRA' ? 'Stop hunts de posições vendidas em andamento' : 'Longs alavancados sob pressão de liquidação'}
                  </strong>.
                </div>
                <div className="text-[10px] text-slate-400">
                  Funding Spot-Futuros instantâneo favorável para execução sem slippage severo.
                </div>
              </div>
            )}
          </div>

          {/* Institutional AI Thesis (Gemini / Groq / Quantitative Agent) */}
          <div className="bg-slate-950 border border-amber-500/30 rounded-xl p-4 relative overflow-hidden">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-400" />
                Tese do Agente Institucional IA
              </span>
              <button
                id="btn-refresh-gemini-ai"
                onClick={() => onRefreshAI(signal.symbol)}
                disabled={isAiLoading}
                className="px-2 py-0.5 text-[10px] font-medium bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded flex items-center gap-1 transition disabled:opacity-50"
                title="Consultar modelo Gemini 3.8 Flash no backend para validação institucional"
              >
                <RefreshCw className={`w-3 h-3 ${isAiLoading ? 'animate-spin' : ''}`} />
                <span>{isAiLoading ? 'Processando IA...' : 'Recalcular via IA'}</span>
              </button>
            </div>

            <div className="text-xs text-slate-300 leading-relaxed font-sans mb-3">
              "{signal.aiThesis.summary}"
            </div>

            <div className="space-y-2 text-[11px] border-t border-slate-800/80 pt-2 text-slate-400">
              <div>
                <span className="text-amber-400 font-semibold font-mono">Contexto Institucional: </span>
                {signal.aiThesis.institutionalContext}
              </div>
              <div>
                <span className="text-sky-400 font-semibold font-mono">Gatilho Primário: </span>
                {signal.aiThesis.primaryCatalyst}
              </div>
              <div className="flex items-start gap-1 text-rose-400/90">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>{signal.aiThesis.riskWarning}</span>
              </div>
            </div>

            <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] font-mono text-slate-500">
              <span>Motor: {signal.aiThesis.source}</span>
              <span className="font-bold text-amber-400">Veredito: {signal.aiThesis.verdict}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Volatility Anomaly Surge Warning Modal (+2σ) */}
      <VolatilityAlertModal
        isOpen={showVolatilityModal}
        onClose={() => setShowVolatilityModal(false)}
        symbol={signal.symbol}
        timeframe={activeTf}
        stats={volatilityStats}
        isAlertEnabled={volatilityAlertEnabled}
        onToggleAlertEnabled={handleToggleVolatilityAlert}
        onSnoozeSymbol={handleSnoozeSymbol}
      />
    </div>
  );
};
