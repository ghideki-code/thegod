import React, { useState, useEffect } from 'react';
import { 
  Compass, 
  DollarSign, 
  Zap, 
  Target, 
  ShieldAlert, 
  Clock, 
  ArrowRight, 
  CheckCircle2, 
  TrendingUp, 
  Columns3, 
  Layers,
  RefreshCw,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  Gauge
} from 'lucide-react';
import { TradeSignal } from '../types';
import { 
  TradingExecutionStyle, 
  calculateTradingStyleParameters, 
  StyleRiskParameters 
} from '../utils/technicalAnalysis';

interface TradingStyleRiskCardProps {
  signal: TradeSignal;
  onOpenRiskCalc: (signal: TradeSignal, defaultStyle?: TradingExecutionStyle) => void;
  onRefreshPrices?: () => Promise<void> | void;
}

export const TradingStyleRiskCard: React.FC<TradingStyleRiskCardProps> = ({
  signal,
  onOpenRiskCalc,
  onRefreshPrices,
}) => {
  const [activeStyle, setActiveStyle] = useState<TradingExecutionStyle>('DAY_TRADE');
  const [viewMode, setViewMode] = useState<'TABS' | 'COMPARISON'>('TABS');
  const [entryBase, setEntryBase] = useState<'SETUP' | 'MARKET'>('SETUP');
  const [customEntryOverride, setCustomEntryOverride] = useState<number | null>(null);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [prevPrice, setPrevPrice] = useState<number>(signal.currentPrice);
  const [priceTick, setPriceTick] = useState<'UP' | 'DOWN' | null>(null);

  // Monitor price changes to trigger subtle tick color flash
  useEffect(() => {
    if (signal.currentPrice !== prevPrice) {
      if (signal.currentPrice > prevPrice) {
        setPriceTick('UP');
      } else if (signal.currentPrice < prevPrice) {
        setPriceTick('DOWN');
      }
      setPrevPrice(signal.currentPrice);
      const timer = setTimeout(() => setPriceTick(null), 1500);
      return () => clearTimeout(timer);
    }
  }, [signal.currentPrice, prevPrice]);

  // Reset manual override if signal symbol changes
  useEffect(() => {
    setCustomEntryOverride(null);
  }, [signal.symbol]);

  const currentPrice = signal.currentPrice || 100;
  const setupEntry = signal.entryPrice || currentPrice;
  
  // Decide effective entry price used for computing Stop Loss and 5 Fibonacci Targets
  const effectiveEntry = customEntryOverride !== null 
    ? customEntryOverride 
    : (entryBase === 'MARKET' ? currentPrice : setupEntry);

  const isLong = signal.decision === 'COMPRA' || signal.decision === 'AGUARDAR';

  // Calculate style risk parameters based on chosen effective entry
  const styleParams = calculateTradingStyleParameters(signal, effectiveEntry);
  const current = styleParams[activeStyle];

  const stylesList: TradingExecutionStyle[] = ['SCALP', 'DAY_TRADE', 'SWING_TRADE', 'POSITION_TRADE'];

  // Handle manual price refresh
  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      if (onRefreshPrices) {
        await onRefreshPrices();
      } else {
        await fetch('/api/market/refresh-prices', { method: 'POST' });
      }
    } catch (err) {
      console.warn('Erro ao atualizar cotação:', err);
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  // Sync entry price to current market price
  const handleSyncEntryToMarket = () => {
    setCustomEntryOverride(currentPrice);
    setEntryBase('MARKET');
  };

  // Distance from current market price to Stop Loss
  const slDistFromMarketUsd = Math.abs(currentPrice - current.stopLoss);
  const slDistFromMarketPct = isLong
    ? ((current.stopLoss - currentPrice) / currentPrice) * 100
    : ((currentPrice - current.stopLoss) / currentPrice) * 100;

  // Price discrepancy from setup entry to current market price
  const entryDiffUsd = currentPrice - setupEntry;
  const entryDiffPct = ((currentPrice - setupEntry) / setupEntry) * 100;

  // Formatting helper
  const formatPrice = (p: number) => {
    if (p < 0.0001) return p.toFixed(6);
    if (p < 1) return p.toFixed(4);
    if (p < 10) return p.toFixed(3);
    return p.toFixed(2);
  };

  return (
    <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 font-mono text-xs space-y-3.5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-800/80 pb-3">
        <div>
          <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
            <Compass className="w-4 h-4 text-amber-400" />
            <span>Gestão de Risco & Parâmetros de Execução</span>
          </h3>
          <p className="text-[11px] text-slate-400 font-sans mt-0.5">
            Setups quantitativos calibrados por ATR divididos por modalidade operacional
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* View Toggle */}
          <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-0.5">
            <button
              id="btn-risk-view-tabs"
              onClick={() => setViewMode('TABS')}
              className={`px-2 py-1 text-[10px] rounded transition ${
                viewMode === 'TABS'
                  ? 'bg-amber-500/20 text-amber-300 font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Abas
            </button>
            <button
              id="btn-risk-view-comparison"
              onClick={() => setViewMode('COMPARISON')}
              className={`px-2 py-1 text-[10px] rounded transition flex items-center gap-1 ${
                viewMode === 'COMPARISON'
                  ? 'bg-amber-500/20 text-amber-300 font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Columns3 className="w-3 h-3" />
              <span>Comparar 4</span>
            </button>
          </div>

          <button
            id="btn-open-position-sizer-main"
            onClick={() => onOpenRiskCalc(signal, activeStyle)}
            className="px-3 py-1.5 text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg transition flex items-center gap-1 shadow-sm shrink-0"
          >
            <DollarSign className="w-3.5 h-3.5" />
            <span>Dimensionar Lote</span>
          </button>
        </div>
      </div>

      {/* REAL-TIME LIVE PRICE & SYNCHRONIZATION BAR */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shadow-inner">
        {/* Left: Live Price & Market State */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <span className="text-[10px] font-bold tracking-wider text-emerald-400 uppercase bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded">
              AO VIVO • Binance.US
            </span>
          </div>

          <div className="flex items-baseline gap-1.5">
            <span className="text-slate-400 text-[11px] font-sans">Preço Atual:</span>
            <span 
              className={`font-mono text-base sm:text-lg font-bold transition-colors duration-300 ${
                priceTick === 'UP' 
                  ? 'text-emerald-400 bg-emerald-500/20 px-1 rounded' 
                  : priceTick === 'DOWN' 
                    ? 'text-rose-400 bg-rose-500/20 px-1 rounded' 
                    : 'text-white'
              }`}
            >
              ${formatPrice(currentPrice)}
            </span>
          </div>

          {/* Variance vs Setup Entry */}
          <div className="flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded bg-slate-950 border border-slate-800">
            <span className="text-slate-500">vs Entrada:</span>
            <span className={`font-bold flex items-center ${entryDiffPct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {entryDiffPct >= 0 ? <ArrowUpRight className="w-3 h-3 inline" /> : <ArrowDownRight className="w-3 h-3 inline" />}
              {entryDiffPct >= 0 ? '+' : ''}{entryDiffPct.toFixed(2)}%
            </span>
            <span className="text-slate-400 text-[9px]">
              ({entryDiffUsd >= 0 ? '+$' : '-$'}{formatPrice(Math.abs(entryDiffUsd))})
            </span>
          </div>

          <div className="text-[10px] text-slate-500 hidden xl:flex items-center gap-1">
            <Clock className="w-3 h-3" />
            <span>{signal.timeStr || 'Horário de Brasília'}</span>
          </div>
        </div>

        {/* Right: Refresh Button & Entry Mode Controls */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-between md:justify-end">
          {/* Base Selector Toggle */}
          <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg p-0.5 text-[10px]">
            <button
              id="btn-entry-base-setup"
              onClick={() => {
                setEntryBase('SETUP');
                setCustomEntryOverride(null);
              }}
              title="Calcular alvos a partir do Preço de Entrada do Setup planejado"
              className={`px-2 py-1 rounded transition ${
                entryBase === 'SETUP' && customEntryOverride === null
                  ? 'bg-amber-500/20 text-amber-300 font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Entrada Setup (${formatPrice(setupEntry)})
            </button>
            <button
              id="btn-entry-base-market"
              onClick={() => {
                setEntryBase('MARKET');
                setCustomEntryOverride(currentPrice);
              }}
              title="Calcular alvos e stop a partir do Preço de Mercado Atual"
              className={`px-2 py-1 rounded transition flex items-center gap-1 ${
                entryBase === 'MARKET' || customEntryOverride === currentPrice
                  ? 'bg-emerald-500/20 text-emerald-300 font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Zap className="w-2.5 h-2.5 text-emerald-400" />
              <span>Preço Atual (${formatPrice(currentPrice)})</span>
            </button>
          </div>

          {/* Quick Sync Button */}
          <button
            id="btn-sync-entry-market"
            onClick={handleSyncEntryToMarket}
            title="Sincronizar a entrada com a cotação de mercado deste segundo"
            className="px-2 py-1 text-[10px] font-bold text-sky-300 bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/30 rounded-lg transition flex items-center gap-1"
          >
            <Zap className="w-3 h-3 text-sky-400" />
            <span className="hidden sm:inline">Sincronizar</span>
          </button>

          {/* Refresh Price Button */}
          <button
            id="btn-refresh-live-price"
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            className="px-2.5 py-1 text-[10px] font-bold text-slate-200 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition flex items-center gap-1.5 shadow-sm active:scale-95 disabled:opacity-60"
            title="Atualizar cotação em tempo real da Binance.US"
          >
            <RefreshCw className={`w-3 h-3 text-amber-400 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>{isRefreshing ? 'Atualizando...' : 'Atualizar Preço'}</span>
          </button>
        </div>
      </div>

      {/* Style Selector Tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
        {stylesList.map((styleKey) => {
          const item = styleParams[styleKey];
          const isSelected = activeStyle === styleKey;
          return (
            <button
              key={styleKey}
              id={`btn-style-tab-${styleKey}`}
              onClick={() => {
                setActiveStyle(styleKey);
                if (viewMode === 'COMPARISON') setViewMode('TABS');
              }}
              className={`p-2 rounded-lg border text-left transition flex flex-col justify-between gap-1 ${
                isSelected
                  ? `${item.badgeColor} border-current ring-1 ring-amber-400/30`
                  : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:bg-slate-900 hover:text-slate-200'
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <span className="font-bold text-[11px] truncate">{item.badge}</span>
                {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>}
              </div>
              <div className="flex items-center justify-between text-[10px] text-slate-400 font-sans">
                <span>{item.atrMultipleStop}</span>
                <span className="font-mono text-slate-300">R:R 1:{item.rr1}</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Mode 1: Detailed Single Style View */}
      {viewMode === 'TABS' && (
        <div className="space-y-3 animate-in fade-in duration-150">
          {/* Main Entry and Stop Loss Numbers Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            {/* Entry Price Box */}
            <div className="p-2.5 bg-slate-900 rounded-lg border border-slate-800 flex flex-col justify-between">
              <div className="flex items-center justify-between text-[10px] text-slate-400">
                <span className="flex items-center gap-1">
                  <span>Preço de Entrada</span>
                  {effectiveEntry === currentPrice ? (
                    <span className="text-[9px] bg-emerald-500/20 text-emerald-300 px-1 rounded">Ao Vivo</span>
                  ) : (
                    <span className="text-[9px] bg-slate-800 text-slate-400 px-1 rounded">Setup</span>
                  )}
                </span>
                <span className="text-slate-500 font-sans">
                  {effectiveEntry === currentPrice ? 'Entrada a Mercado' : 'Ordem Limit'}
                </span>
              </div>
              <div className="my-1">
                <span className="text-white font-bold text-base sm:text-lg font-mono">
                  ${formatPrice(effectiveEntry)}
                </span>
              </div>
              <div className="flex items-center justify-between text-[10px] text-slate-500 border-t border-slate-800/80 pt-1">
                <span>Preço Mercado Atual:</span>
                <span className="font-mono text-slate-300">${formatPrice(currentPrice)}</span>
              </div>
            </div>

            {/* Stop Loss Box */}
            <div className="p-2.5 bg-slate-900 rounded-lg border border-rose-500/30 flex flex-col justify-between">
              <div className="flex items-center justify-between text-[10px] text-rose-400">
                <span className="flex items-center gap-1 font-bold">
                  <ShieldAlert className="w-3 h-3 text-rose-400" />
                  <span>Stop Loss ({current.atrMultipleStop})</span>
                </span>
                <span className="font-bold">-{current.stopDistancePercent}%</span>
              </div>
              <div className="my-1">
                <span className="text-rose-300 font-bold text-base sm:text-lg font-mono">
                  ${formatPrice(current.stopLoss)}
                </span>
              </div>
              <div className="flex items-center justify-between text-[10px] text-slate-500 border-t border-slate-800/80 pt-1">
                <span>Distância do Preço Atual:</span>
                <span className="font-mono text-rose-400 font-bold">
                  {slDistFromMarketPct >= 0 ? '+' : ''}{slDistFromMarketPct.toFixed(2)}% (${formatPrice(slDistFromMarketUsd)})
                </span>
              </div>
            </div>
          </div>

          {/* 5 Fibonacci Take Profit Targets Section */}
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between text-[11px]">
              <div className="flex items-center gap-1.5 font-bold text-white uppercase tracking-wider">
                <Target className="w-3.5 h-3.5 text-emerald-400" />
                <span>5 Alvos em Fibonacci</span>
                <span className="text-[10px] text-amber-300 font-mono font-normal lowercase bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded">
                  golden ratio & expansões
                </span>
              </div>
              <span className="text-[10px] text-slate-400 font-sans hidden sm:inline">
                Base de cálculo: <strong className="text-slate-200">${formatPrice(effectiveEntry)}</strong>
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 text-xs">
              {current.fibonacciTargets && current.fibonacciTargets.length === 5 ? (
                current.fibonacciTargets.map((fibo, idx) => {
                  const descriptions = [
                    '40% Parcial',
                    'Stop no 0 a 0',
                    'Trailing Stop',
                    'Tendência Forte',
                    'Realização Total'
                  ];
                  const desc = descriptions[idx] || 'Expansão Fibo';

                  // Real-time target hit detection
                  const isHitRealTime = isLong
                    ? currentPrice >= fibo.price
                    : currentPrice <= fibo.price;

                  // Remaining distance from current market price
                  const remainingUsd = Math.abs(fibo.price - currentPrice);
                  const remainingPct = isLong
                    ? ((fibo.price - currentPrice) / currentPrice) * 100
                    : ((currentPrice - fibo.price) / currentPrice) * 100;

                  return (
                    <div
                      key={fibo.level}
                      className={`p-2.5 rounded-lg border flex flex-col justify-between gap-1.5 transition ${
                        isHitRealTime 
                          ? 'bg-emerald-950/40 border-emerald-500/60 ring-1 ring-emerald-500/30' 
                          : 'bg-slate-900 border-emerald-500/30 hover:border-emerald-500/50'
                      }`}
                    >
                      {/* Top label & Fibonacci ratio */}
                      <div className="flex items-center justify-between text-[10px]">
                        <span className={`font-bold flex items-center gap-1 ${isHitRealTime ? 'text-emerald-300' : 'text-emerald-400'}`}>
                          <span>Alvo TP{fibo.level}</span>
                        </span>
                        <span className="text-[10px] font-mono text-slate-400">
                          1:{fibo.ratio}
                        </span>
                      </div>

                      {/* Target Price and PnL */}
                      <div className="my-0.5">
                        <div className="text-emerald-300 font-bold text-sm sm:text-base font-mono">
                          ${formatPrice(fibo.price)}
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-slate-400 mt-0.5">
                          <span className="text-emerald-400 font-bold font-mono">
                            +{fibo.pnlPercent}%
                          </span>
                          {isHitRealTime ? (
                            <span className="text-[9px] bg-emerald-500/20 text-emerald-300 font-bold px-1 py-0.5 rounded">
                              Atingido ✓
                            </span>
                          ) : (
                            <span className="text-[9px] text-slate-500">
                              Pendente
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Distance from current market price */}
                      <div className="text-[9px] font-mono bg-slate-950/80 px-1.5 py-1 rounded border border-slate-800 flex items-center justify-between">
                        <span className="text-slate-500">Do preço atual:</span>
                        {isHitRealTime ? (
                          <span className="text-emerald-400 font-bold">Atingido</span>
                        ) : (
                          <span className={`font-bold ${remainingPct > 0 ? 'text-amber-300' : 'text-slate-300'}`}>
                            {remainingPct > 0 ? '+' : ''}{remainingPct.toFixed(2)}%
                          </span>
                        )}
                      </div>

                      {/* Operational description footer */}
                      <div className="text-[10px] text-slate-400 border-t border-slate-800/80 pt-1 flex items-center justify-between">
                        <span className="truncate">{desc}</span>
                        <span className="text-[9px] text-slate-500 font-mono">Fibo {fibo.ratio}x</span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="col-span-full p-3 bg-slate-900 rounded-lg text-center text-slate-500">
                  Calculando alvos de Fibonacci...
                </div>
              )}
            </div>
          </div>

          {/* Operational Context & Rules */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 text-[11px]">
            <div className="p-2.5 bg-slate-900/80 rounded-lg border border-slate-800 space-y-1">
              <span className="text-slate-400 block text-[10px] uppercase">Parâmetros Operacionais</span>
              <div className="flex items-center justify-between text-slate-200">
                <span>Tempos Gráficos:</span>
                <strong className="text-amber-300">{current.timeframes}</strong>
              </div>
              <div className="flex items-center justify-between text-slate-200">
                <span>Duração Estimada:</span>
                <strong className="text-slate-300">{current.holdingTime}</strong>
              </div>
              <div className="flex items-center justify-between text-slate-200">
                <span>Alavancagem Máxima:</span>
                <strong className="text-sky-300">{current.recommendedLeverage}</strong>
              </div>
            </div>

            <div className="p-2.5 bg-slate-900/80 rounded-lg border border-slate-800 md:col-span-2 space-y-1.5">
              <span className="text-slate-400 block text-[10px] uppercase">Regras de Execução & Condução</span>
              <ul className="space-y-1 text-[11px] font-sans text-slate-300">
                {current.executionRules.map((rule, idx) => (
                  <li key={idx} className="flex items-start gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    <span>{rule}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Mode 2: Side-by-Side Comparison Matrix */}
      {viewMode === 'COMPARISON' && (
        <div className="overflow-x-auto no-scrollbar border border-slate-800 rounded-lg">
          <table className="w-full text-left text-[11px] font-mono">
            <thead className="bg-slate-900/90 text-slate-400 border-b border-slate-800">
              <tr>
                <th className="p-2 font-medium">Modalidade</th>
                <th className="p-2 font-medium">Tempos</th>
                <th className="p-2 font-medium">Stop Loss</th>
                <th className="p-2 font-medium">TP1 (1.618)</th>
                <th className="p-2 font-medium">TP2 (2.000)</th>
                <th className="p-2 font-medium">TP3 (2.618)</th>
                <th className="p-2 font-medium">TP4 (3.618)</th>
                <th className="p-2 font-medium">TP5 (4.236)</th>
                <th className="p-2 font-medium">Alavancagem</th>
                <th className="p-2 font-medium text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 bg-slate-950">
              {stylesList.map((st) => {
                const item = styleParams[st];
                return (
                  <tr key={st} className="hover:bg-slate-900/50 transition">
                    <td className="p-2 font-bold text-white whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded border text-[10px] ${item.badgeColor}`}>
                        {item.label}
                      </span>
                    </td>
                    <td className="p-2 text-slate-300 whitespace-nowrap">{item.timeframes}</td>
                    <td className="p-2 text-rose-300 font-semibold whitespace-nowrap">
                      ${formatPrice(item.stopLoss)} <span className="text-[10px] text-slate-500 font-normal">(-{item.stopDistancePercent}%)</span>
                    </td>
                    <td className="p-2 text-emerald-300 font-semibold whitespace-nowrap">
                      ${formatPrice(item.takeProfit1)}
                    </td>
                    <td className="p-2 text-emerald-300 font-semibold whitespace-nowrap">
                      ${formatPrice(item.takeProfit2)}
                    </td>
                    <td className="p-2 text-emerald-300 font-semibold whitespace-nowrap">
                      ${formatPrice(item.takeProfit3)}
                    </td>
                    <td className="p-2 text-emerald-300 font-semibold whitespace-nowrap">
                      ${formatPrice(item.takeProfit4)}
                    </td>
                    <td className="p-2 text-emerald-300 font-semibold whitespace-nowrap">
                      ${formatPrice(item.takeProfit5)}
                    </td>
                    <td className="p-2 text-sky-300 whitespace-nowrap">{item.recommendedLeverage}</td>
                    <td className="p-2 text-right whitespace-nowrap">
                      <button
                        id={`btn-select-style-${st}`}
                        onClick={() => onOpenRiskCalc(signal, st)}
                        className="px-2 py-0.5 text-[10px] font-bold bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded transition"
                      >
                        Aplicar
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
