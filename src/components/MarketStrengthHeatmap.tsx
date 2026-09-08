import React, { useState, useMemo } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  Activity, 
  Flame, 
  Layers, 
  Target, 
  Grid3X3, 
  Table as TableIcon, 
  ArrowUpRight, 
  ArrowDownRight, 
  Zap, 
  Shield, 
  Compass, 
  ChevronDown, 
  ChevronUp, 
  SlidersHorizontal,
  Info,
  ExternalLink
} from 'lucide-react';
import { TradeSignal } from '../types';
import { 
  calculateMarketCorrelations, 
  AssetCorrelationData, 
  MacroTrendSummary, 
  calculatePearsonCorrelation, 
  normalizeToPercentage, 
  get7dPriceSeries 
} from '../utils/marketCorrelation';

interface MarketStrengthHeatmapProps {
  signals: TradeSignal[];
  selectedSymbol: string;
  onSelectSymbol: (symbol: string) => void;
  onOpenRiskCalc?: (signal: TradeSignal) => void;
}

export const MarketStrengthHeatmap: React.FC<MarketStrengthHeatmapProps> = ({
  signals,
  selectedSymbol,
  onSelectSymbol,
  onOpenRiskCalc
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(true);
  const [benchmarkType, setBenchmarkType] = useState<'BTC/USDT' | 'ETH/USDT' | 'TOP10_INDEX'>('BTC/USDT');
  const [assetFilter, setAssetFilter] = useState<'TOP10' | 'TOP20' | 'TOP50' | 'QUALIFIED' | 'LONGS' | 'SHORTS' | 'ALPHA_LEADERS' | 'ALL'>('TOP20');
  const [corrFilter, setCorrFilter] = useState<'ALL' | 'STRONG_POS' | 'DECORRELATED' | 'INVERSE'>('ALL');
  const [viewMode, setViewMode] = useState<'heatmap' | 'matrix' | 'table'>('heatmap');
  const [showInfoModal, setShowInfoModal] = useState<boolean>(false);

  // Calculate correlations and macro statistics based on current 7-day data
  const { assetCorrelations, macroSummary } = useMemo(() => {
    return calculateMarketCorrelations(signals, benchmarkType);
  }, [signals, benchmarkType]);

  // Filter assets based on UI selection
  const filteredAssets = useMemo(() => {
    let list = [...assetCorrelations];

    // Asset selection preset
    if (assetFilter === 'TOP10') {
      list = list.slice(0, 10);
    } else if (assetFilter === 'TOP20') {
      list = list.slice(0, 20);
    } else if (assetFilter === 'TOP50') {
      list = list.slice(0, 50);
    } else if (assetFilter === 'QUALIFIED') {
      list = list.filter(a => a.signal.passedFilter);
    } else if (assetFilter === 'LONGS') {
      list = list.filter(a => a.signal.decision === 'COMPRA');
    } else if (assetFilter === 'SHORTS') {
      list = list.filter(a => a.signal.decision === 'VENDA');
    } else if (assetFilter === 'ALPHA_LEADERS') {
      list = list.filter(a => a.alpha7d > 2.0 && a.change7d > 0);
    }

    // Correlation filter
    if (corrFilter === 'STRONG_POS') {
      list = list.filter(a => a.correlation >= 0.70);
    } else if (corrFilter === 'DECORRELATED') {
      list = list.filter(a => Math.abs(a.correlation) < 0.40);
    } else if (corrFilter === 'INVERSE') {
      list = list.filter(a => a.correlation <= -0.15);
    }

    return list;
  }, [assetCorrelations, assetFilter, corrFilter]);

  // Matrix assets: limit to top 10 or 12 for high clarity in the NxN grid
  const matrixAssets = useMemo(() => {
    return filteredAssets.slice(0, 10);
  }, [filteredAssets]);

  // Compute pairwise correlation matrix
  const correlationMatrix = useMemo(() => {
    if (viewMode !== 'matrix') return [];
    
    // Series for each matrix asset
    const seriesList = matrixAssets.map(a => normalizeToPercentage(a.sparkline7d));
    const matrix: { assetA: string; assetB: string; r: number }[][] = [];

    for (let i = 0; i < matrixAssets.length; i++) {
      const row: { assetA: string; assetB: string; r: number }[] = [];
      for (let j = 0; j < matrixAssets.length; j++) {
        if (i === j) {
          row.push({ assetA: matrixAssets[i].signal.symbol, assetB: matrixAssets[j].signal.symbol, r: 1.0 });
        } else {
          const r = calculatePearsonCorrelation(seriesList[i], seriesList[j]);
          row.push({ assetA: matrixAssets[i].signal.symbol, assetB: matrixAssets[j].signal.symbol, r });
        }
      }
      matrix.push(row);
    }
    return matrix;
  }, [matrixAssets, viewMode]);

  // Helper for heatmap cell background & styling based on 7D Alpha & Correlation
  const getCardStyle = (item: AssetCorrelationData, isSelected: boolean) => {
    const { alpha7d, change7d, correlation } = item;

    let baseBg = 'bg-slate-900/90';
    let borderColor = 'border-slate-800';
    let badgeBg = 'bg-slate-800 text-slate-300';

    if (alpha7d >= 5.0 && change7d > 0) {
      // Strong Outperformer (Alpha Leader)
      baseBg = 'bg-emerald-950/40 hover:bg-emerald-950/60';
      borderColor = 'border-emerald-500/40 hover:border-emerald-500/70';
      badgeBg = 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40';
    } else if (alpha7d > 0 && change7d > 0) {
      // Outperformer
      baseBg = 'bg-emerald-950/20 hover:bg-emerald-950/40';
      borderColor = 'border-emerald-500/30 hover:border-emerald-500/50';
      badgeBg = 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30';
    } else if (correlation <= -0.25) {
      // Inverse correlation / Natural hedge
      baseBg = 'bg-indigo-950/30 hover:bg-indigo-950/50';
      borderColor = 'border-indigo-500/40 hover:border-indigo-500/60';
      badgeBg = 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40';
    } else if (alpha7d <= -5.0) {
      // Severe Laggard
      baseBg = 'bg-rose-950/40 hover:bg-rose-950/60';
      borderColor = 'border-rose-500/40 hover:border-rose-500/70';
      badgeBg = 'bg-rose-500/20 text-rose-300 border border-rose-500/40';
    } else if (alpha7d < 0) {
      // Mild Laggard
      baseBg = 'bg-rose-950/20 hover:bg-rose-950/40';
      borderColor = 'border-rose-500/30 hover:border-rose-500/50';
      badgeBg = 'bg-rose-500/10 text-rose-400 border border-rose-500/30';
    } else {
      // Neutral
      baseBg = 'bg-slate-900/80 hover:bg-slate-900';
      borderColor = 'border-slate-800 hover:border-slate-700';
      badgeBg = 'bg-slate-800 text-slate-400 border border-slate-700';
    }

    if (isSelected) {
      borderColor = 'border-amber-400 ring-2 ring-amber-400/40 shadow-lg';
    }

    return { baseBg, borderColor, badgeBg };
  };

  // Helper for correlation value color
  const getCorrelationBadge = (r: number) => {
    if (r >= 0.75) {
      return { text: `Forte (+${r.toFixed(2)})`, color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' };
    }
    if (r >= 0.40) {
      return { text: `Moderada (+${r.toFixed(2)})`, color: 'text-sky-400 bg-sky-500/10 border-sky-500/30' };
    }
    if (r >= -0.20) {
      return { text: `Descorrel. (${r >= 0 ? '+' : ''}${r.toFixed(2)})`, color: 'text-amber-400 bg-amber-500/10 border-amber-500/30' };
    }
    return { text: `Inversa (${r.toFixed(2)})`, color: 'text-purple-400 bg-purple-500/10 border-purple-500/30' };
  };

  return (
    <section 
      id="market-strength-heatmap-section"
      className="bg-slate-900/95 border border-slate-800 rounded-xl overflow-hidden shadow-sm transition-all"
    >
      {/* Top Banner: Macro Trend & Toggle Controls */}
      <div className="p-4 border-b border-slate-800/80 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400">
            <Flame className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-white font-mono flex items-center gap-2">
                <span>Heatmap de Força de Mercado & Correlação Macro</span>
              </h3>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-amber-300">
                Últimos 7 Dias
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-slate-400">
              <span>Benchmark Macro: <strong className="text-slate-200">{macroSummary.benchmarkName}</strong></span>
              <span className="text-slate-600">•</span>
              <span className={`font-semibold font-mono ${macroSummary.change7d >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {macroSummary.change7d >= 0 ? `+${macroSummary.change7d}%` : `${macroSummary.change7d}%`} (7D)
              </span>
              <span className="text-slate-600">•</span>
              <span className="px-2 py-0.2 rounded text-[11px] font-mono font-semibold bg-slate-800 border border-slate-700 text-slate-300">
                Regime: <strong className={macroSummary.status.includes('ALTA') ? 'text-emerald-400' : macroSummary.status.includes('CORREÇÃO') ? 'text-rose-400' : 'text-amber-400'}>{macroSummary.status}</strong>
              </span>
            </div>
          </div>
        </div>

        {/* Right Side Status & Minimizer */}
        <div className="flex items-center gap-2 self-end md:self-auto">
          {/* Breadth Indicator */}
          <div className="hidden sm:flex flex-col items-end text-right mr-2">
            <span className="text-[10px] text-slate-400 uppercase font-mono">Market Breadth (7D)</span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <div className="w-16 h-1.5 bg-slate-800 rounded-full overflow-hidden border border-slate-700">
                <div 
                  className={`h-full rounded-full ${macroSummary.breadthScore >= 50 ? 'bg-emerald-400' : 'bg-rose-400'}`}
                  style={{ width: `${macroSummary.breadthScore}%` }}
                />
              </div>
              <span className="text-xs font-mono font-bold text-slate-200">
                {macroSummary.breadthScore}% em Alta
              </span>
            </div>
          </div>

          <button
            id="btn-heatmap-info-modal"
            onClick={() => setShowInfoModal(!showInfoModal)}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 border border-slate-700 transition"
            title="Como interpretar o Heatmap de Força e Correlação"
          >
            <Info className="w-4 h-4" />
          </button>

          <button
            id="btn-toggle-heatmap-expand"
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition flex items-center gap-1 text-xs font-mono"
            title={isExpanded ? 'Recolher Heatmap' : 'Expandir Heatmap'}
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            <span className="hidden sm:inline">{isExpanded ? 'Ocultar' : 'Expandir'}</span>
          </button>
        </div>
      </div>

      {/* Collapsible Content */}
      {isExpanded && (
        <div className="p-4 space-y-4">
          {/* Info Modal / Explanation Box */}
          {showInfoModal && (
            <div className="bg-slate-950 border border-amber-500/30 rounded-xl p-3.5 text-xs text-slate-300 space-y-2 animate-fadeIn">
              <div className="flex items-center justify-between">
                <span className="font-bold text-amber-400 flex items-center gap-1.5 font-mono">
                  <Compass className="w-4 h-4" />
                  Metodologia Quantitativa de Força de Mercado & Correlação
                </span>
                <button 
                  onClick={() => setShowInfoModal(false)}
                  className="text-slate-500 hover:text-slate-300 font-mono"
                >
                  ✕ Fechar
                </button>
              </div>
              <p className="text-slate-400 leading-relaxed">
                Este heatmap analisa a série temporal dos últimos <strong>7 dias</strong> para cada ativo selecionado, comparando-o contra o benchmark da <strong>Tendência Macro</strong> (Bitcoin ou Índice Ponderado).
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 font-mono text-[11px]">
                <div className="p-2 rounded bg-slate-900 border border-slate-800">
                  <span className="text-emerald-400 font-bold block mb-0.5">Alpha 7D (Força Relativa)</span>
                  <span className="text-slate-400">Diferença de retorno entre o ativo e o Macro. Alpha &gt; 0 indica que o ativo está superando o mercado.</span>
                </div>
                <div className="p-2 rounded bg-slate-900 border border-slate-800">
                  <span className="text-sky-400 font-bold block mb-0.5">Correlação de Pearson (r)</span>
                  <span className="text-slate-400">Varia de -1.0 a +1.0. Mede se o ativo se movimenta em uníssono com o Macro ou de forma descorrelacionada.</span>
                </div>
                <div className="p-2 rounded bg-slate-900 border border-slate-800">
                  <span className="text-purple-400 font-bold block mb-0.5">Hedge & Breakouts</span>
                  <span className="text-slate-400">Ativos com correlação próxima de 0 ou negativa oferecem proteção institucional contra choques macro.</span>
                </div>
              </div>
            </div>
          )}

          {/* Interactive Filters & Controls Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-950/80 border border-slate-800/80 rounded-xl text-xs font-mono">
            {/* Presets of Assets */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-slate-500 mr-1 hidden sm:inline">Seleção:</span>
              {(
                [
                  { id: 'TOP10', label: 'Top 10' },
                  { id: 'TOP20', label: 'Top 20' },
                  { id: 'TOP50', label: 'Top 50' },
                  { id: 'QUALIFIED', label: 'God Protocol (≥75%)' },
                  { id: 'ALPHA_LEADERS', label: 'Líderes de Alpha' },
                  { id: 'LONGS', label: 'Compras' },
                  { id: 'SHORTS', label: 'Vendas' },
                ] as const
              ).map((preset) => (
                <button
                  key={`preset-${preset.id}`}
                  onClick={() => setAssetFilter(preset.id)}
                  className={`px-2.5 py-1 rounded-lg transition text-[11px] font-medium border ${
                    assetFilter === preset.id
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 font-bold'
                      : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            {/* Benchmark Selector & View Mode Buttons */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Benchmark Selector */}
              <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-xs">
                <span className="text-slate-500 mr-1 text-[11px]">Macro:</span>
                <select
                  id="select-macro-benchmark"
                  value={benchmarkType}
                  onChange={(e) => setBenchmarkType(e.target.value as any)}
                  className="bg-transparent text-amber-300 font-mono text-[11px] focus:outline-none cursor-pointer"
                >
                  <option value="BTC/USDT" className="bg-slate-900 text-white">BTC/USDT (Líder Supremo)</option>
                  <option value="TOP10_INDEX" className="bg-slate-900 text-white">Índice Top 10 (Geral)</option>
                  <option value="ETH/USDT" className="bg-slate-900 text-white">ETH/USDT (Altcoins)</option>
                </select>
              </div>

              {/* Correlation Filter */}
              <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-xs">
                <span className="text-slate-500 mr-1 text-[11px]">Filtro r:</span>
                <select
                  id="select-corr-filter"
                  value={corrFilter}
                  onChange={(e) => setCorrFilter(e.target.value as any)}
                  className="bg-transparent text-slate-300 font-mono text-[11px] focus:outline-none cursor-pointer"
                >
                  <option value="ALL" className="bg-slate-900">Todos</option>
                  <option value="STRONG_POS" className="bg-slate-900">Alta Correlação (r ≥ 0.7)</option>
                  <option value="DECORRELATED" className="bg-slate-900">Descorrelacionados (|r| &lt; 0.4)</option>
                  <option value="INVERSE" className="bg-slate-900">Inversos / Hedge (r ≤ -0.15)</option>
                </select>
              </div>

              {/* View Mode Toggle: Cards Heatmap / NxN Matrix / Table */}
              <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-0.5 text-xs">
                <button
                  id="btn-view-heatmap-cards"
                  onClick={() => setViewMode('heatmap')}
                  className={`px-2 py-1 rounded transition text-[11px] flex items-center gap-1 ${
                    viewMode === 'heatmap' ? 'bg-slate-800 text-amber-400 font-bold' : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title="Grade Térmica (Cards com Sparklines e Força Relativa)"
                >
                  <Grid3X3 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Grade</span>
                </button>
                <button
                  id="btn-view-correlation-matrix"
                  onClick={() => setViewMode('matrix')}
                  className={`px-2 py-1 rounded transition text-[11px] flex items-center gap-1 ${
                    viewMode === 'matrix' ? 'bg-slate-800 text-amber-400 font-bold' : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title="Matriz Cruzada NxN de Correlação Pareada de Pearson"
                >
                  <Activity className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Matriz NxN</span>
                </button>
                <button
                  id="btn-view-heatmap-table"
                  onClick={() => setViewMode('table')}
                  className={`px-2 py-1 rounded transition text-[11px] flex items-center gap-1 ${
                    viewMode === 'table' ? 'bg-slate-800 text-amber-400 font-bold' : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title="Tabela Classificatória de Força e Alpha"
                >
                  <TableIcon className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Tabela</span>
                </button>
              </div>
            </div>
          </div>

          {/* VIEW 1: HEATMAP GRID (CARDS WITH 7D SPARKLINES & RELATIVE STRENGTH) */}
          {viewMode === 'heatmap' && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {filteredAssets.map((item) => {
                  const isSelected = selectedSymbol === item.signal.symbol;
                  const { baseBg, borderColor, badgeBg } = getCardStyle(item, isSelected);
                  const corrBadge = getCorrelationBadge(item.correlation);

                  // Generate SVG sparkline coordinates
                  const prices = item.sparkline7d;
                  const minP = Math.min(...prices) * 0.998;
                  const maxP = Math.max(...prices) * 1.002;
                  const range = maxP - minP || 1;

                  const width = 160;
                  const height = 36;
                  const points = prices.map((p, idx) => {
                    const x = (idx / (prices.length - 1 || 1)) * width;
                    const y = height - ((p - minP) / range) * height;
                    return `${x.toFixed(1)},${y.toFixed(1)}`;
                  }).join(' ');

                  return (
                    <div
                      key={`heatmap-card-${item.signal.symbol}`}
                      onClick={() => onSelectSymbol(item.signal.symbol)}
                      className={`p-3 rounded-xl border transition cursor-pointer flex flex-col justify-between gap-2 relative overflow-hidden ${baseBg} ${borderColor}`}
                    >
                      {/* Selected indicator badge */}
                      {isSelected && (
                        <div className="absolute top-2 right-2 flex items-center gap-1 bg-amber-500 text-slate-950 font-mono font-bold text-[9px] px-1.5 py-0.5 rounded shadow">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-950 animate-pulse" />
                          EM ANÁLISE
                        </div>
                      )}

                      {/* Header: Rank, Symbol, Name */}
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-bold">
                            #{item.signal.marketCapRank || '—'}
                          </span>
                          <span className="font-bold text-white font-mono text-sm">
                            {item.signal.symbol}
                          </span>
                          <span className="text-[11px] text-slate-400 truncate max-w-[70px]">
                            {item.signal.name}
                          </span>
                        </div>

                        {/* Price & 7D Performance */}
                        <div className="flex items-baseline justify-between mt-1">
                          <span className="text-xs font-mono font-bold text-slate-200">
                            ${item.signal.currentPrice >= 1 ? item.signal.currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 }) : item.signal.currentPrice.toFixed(item.signal.currentPrice < 0.001 ? 6 : 4)}
                          </span>
                          <div className={`text-xs font-mono font-bold flex items-center gap-0.5 ${item.change7d >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {item.change7d >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                            <span>{item.change7d >= 0 ? `+${item.change7d}%` : `${item.change7d}%`}</span>
                            <span className="text-[9px] text-slate-500 font-normal">7D</span>
                          </div>
                        </div>
                      </div>

                      {/* Mini 7D SVG Sparkline */}
                      <div className="bg-slate-950/70 border border-slate-800/60 rounded-lg p-1.5 flex flex-col justify-between">
                        <div className="flex items-center justify-between text-[9px] font-mono text-slate-500 mb-1">
                          <span>Trajetória 7 Dias</span>
                          <span className={item.alpha7d >= 0 ? 'text-emerald-400 font-semibold' : 'text-rose-400 font-semibold'}>
                            Alpha: {item.alpha7d >= 0 ? `+${item.alpha7d}%` : `${item.alpha7d}%`}
                          </span>
                        </div>
                        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-8 overflow-visible">
                          {/* Baseline grid */}
                          <line x1="0" y1={height / 2} x2={width} y2={height / 2} stroke="#334155" strokeWidth="0.5" strokeDasharray="2 2" />
                          
                          {/* Asset Price Curve */}
                          <polyline
                            fill="none"
                            stroke={item.change7d >= 0 ? '#10b981' : '#f43f5e'}
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            points={points}
                          />
                        </svg>
                      </div>

                      {/* Correlation with Macro & Archetype Tag */}
                      <div className="pt-1 border-t border-slate-800/60 flex items-center justify-between gap-1 text-[10px] font-mono">
                        <span className={`px-1.5 py-0.5 rounded border font-semibold truncate ${corrBadge.color}`}>
                          r: {item.correlation >= 0 ? `+${item.correlation.toFixed(2)}` : item.correlation.toFixed(2)}
                        </span>
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold truncate ${badgeBg}`}>
                          {item.archetype.split(' ')[0]}
                        </span>
                      </div>

                      {/* Signal & Decision Tag */}
                      <div className="flex items-center justify-between text-[10px] font-mono">
                        <span className="text-slate-500">
                          Sinal: <strong className={item.signal.decision === 'COMPRA' ? 'text-emerald-400' : item.signal.decision === 'VENDA' ? 'text-rose-400' : 'text-slate-400'}>{item.signal.decision}</strong>
                        </span>
                        <span className="text-amber-400 font-semibold">
                          {item.signal.confidence}% Conf.
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {filteredAssets.length === 0 && (
                <div className="py-8 text-center text-slate-500 font-mono text-xs">
                  Nenhum ativo corresponde aos filtros de seleção e correlação configurados.
                </div>
              )}
            </div>
          )}

          {/* VIEW 2: PAIRWISE CORRELATION MATRIX (NxN) */}
          {viewMode === 'matrix' && (
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 overflow-x-auto">
              <div className="mb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h4 className="text-xs font-bold text-white font-mono flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-amber-400" />
                    <span>Matriz de Correlação Pareada de Pearson (Top {matrixAssets.length} Ativos nos Últimos 7 Dias)</span>
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    Valores próximos a +1.00 (verde) indicam movimento sincronizado; valores próximos de 0 (cinza/âmbar) indicam descorrelação estatística.
                  </p>
                </div>
                <div className="text-[11px] font-mono text-slate-500 flex items-center gap-2">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-emerald-500" /> &ge; +0.70</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-sky-500" /> +0.30 a +0.69</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-slate-700" /> -0.20 a +0.29</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-purple-500" /> &le; -0.20</span>
                </div>
              </div>

              <div className="overflow-x-auto min-w-[600px]">
                <table className="w-full text-center text-xs font-mono border-collapse">
                  <thead>
                    <tr>
                      <th className="p-2 text-left text-slate-500 border-b border-slate-800 text-[11px]">Ativo</th>
                      <th className="p-2 text-amber-400 border-b border-slate-800 text-[11px] bg-amber-500/10">MACRO (BTC)</th>
                      {matrixAssets.map(a => (
                        <th 
                          key={`col-${a.signal.symbol}`} 
                          className={`p-2 border-b border-slate-800 text-[11px] font-bold ${selectedSymbol === a.signal.symbol ? 'text-amber-400 bg-amber-500/10' : 'text-slate-300'}`}
                        >
                          {a.signal.symbol.replace('/USDT', '')}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {matrixAssets.map((rowAsset, rowIdx) => {
                      const isRowSelected = selectedSymbol === rowAsset.signal.symbol;
                      return (
                        <tr key={`row-${rowAsset.signal.symbol}`} className="hover:bg-slate-900/50">
                          {/* Asset Name on Row */}
                          <td 
                            onClick={() => onSelectSymbol(rowAsset.signal.symbol)}
                            className={`p-2 text-left font-bold cursor-pointer transition border-b border-slate-800/80 flex items-center gap-1.5 ${
                              isRowSelected ? 'text-amber-400 bg-amber-500/10' : 'text-slate-200 hover:text-white'
                            }`}
                          >
                            <span>{rowAsset.signal.symbol.replace('/USDT', '')}</span>
                            <span className="text-[10px] text-slate-500 font-normal">#{rowAsset.signal.marketCapRank || ''}</span>
                          </td>

                          {/* Correlation with Macro Benchmark */}
                          <td className="p-2 border-b border-slate-800/80 font-bold bg-amber-500/5">
                            <span className={`px-2 py-0.5 rounded text-[11px] ${
                              rowAsset.correlation >= 0.7 
                                ? 'bg-emerald-500/20 text-emerald-300' 
                                : rowAsset.correlation >= 0.3 
                                ? 'bg-sky-500/20 text-sky-300' 
                                : rowAsset.correlation >= -0.2 
                                ? 'bg-slate-800 text-slate-300' 
                                : 'bg-purple-500/20 text-purple-300'
                            }`}>
                              {rowAsset.correlation >= 0 ? `+${rowAsset.correlation.toFixed(2)}` : rowAsset.correlation.toFixed(2)}
                            </span>
                          </td>

                          {/* Pairwise Cells */}
                          {matrixAssets.map((colAsset, colIdx) => {
                            const r = correlationMatrix[rowIdx]?.[colIdx]?.r ?? 1.0;
                            const isSelf = rowIdx === colIdx;

                            let cellBg = 'bg-slate-900/40 text-slate-400';
                            if (isSelf) {
                              cellBg = 'bg-slate-800/90 text-slate-500 font-normal';
                            } else if (r >= 0.80) {
                              cellBg = 'bg-emerald-500/30 text-emerald-200 font-bold';
                            } else if (r >= 0.50) {
                              cellBg = 'bg-emerald-500/15 text-emerald-300';
                            } else if (r >= 0.20) {
                              cellBg = 'bg-sky-500/15 text-sky-300';
                            } else if (r >= -0.15) {
                              cellBg = 'bg-slate-800/60 text-slate-300';
                            } else {
                              cellBg = 'bg-purple-500/20 text-purple-300 font-bold';
                            }

                            return (
                              <td 
                                key={`cell-${rowAsset.signal.symbol}-${colAsset.signal.symbol}`}
                                className={`p-2 border-b border-slate-800/80 text-[11px] transition hover:scale-105 ${cellBg}`}
                                title={`${rowAsset.signal.symbol} vs ${colAsset.signal.symbol}: r = ${r.toFixed(2)}`}
                              >
                                {isSelf ? '1.00' : (r >= 0 ? `+${r.toFixed(2)}` : r.toFixed(2))}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* VIEW 3: RELATIVE STRENGTH & ALPHA RANKING TABLE */}
          {viewMode === 'table' && (
            <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-x-auto">
              <table className="w-full text-left text-xs font-mono border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900/60 text-slate-400">
                    <th className="p-3">Rank & Ativo</th>
                    <th className="p-3">Preço Atual</th>
                    <th className="p-3">Variação 7D</th>
                    <th className="p-3">Alpha 7D vs Macro</th>
                    <th className="p-3">Correlação (r)</th>
                    <th className="p-3">Beta Estimado</th>
                    <th className="p-3">Arquétipo Quantitativo</th>
                    <th className="p-3">Sinal</th>
                    <th className="p-3 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredAssets.map((item) => {
                    const isSelected = selectedSymbol === item.signal.symbol;
                    const corrBadge = getCorrelationBadge(item.correlation);

                    return (
                      <tr 
                        key={`table-row-${item.signal.symbol}`}
                        className={`hover:bg-slate-900/60 transition ${isSelected ? 'bg-amber-500/10' : ''}`}
                      >
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-bold">
                              #{item.signal.marketCapRank || '—'}
                            </span>
                            <div>
                              <div className="font-bold text-white flex items-center gap-1.5">
                                <span>{item.signal.symbol}</span>
                                {isSelected && (
                                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                                )}
                              </div>
                              <div className="text-[11px] text-slate-400">{item.signal.name}</div>
                            </div>
                          </div>
                        </td>

                        <td className="p-3 font-bold text-slate-200">
                          ${item.signal.currentPrice >= 1 ? item.signal.currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : item.signal.currentPrice.toFixed(4)}
                        </td>

                        <td className="p-3">
                          <span className={`font-bold flex items-center gap-0.5 ${item.change7d >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {item.change7d >= 0 ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                            {item.change7d >= 0 ? `+${item.change7d}%` : `${item.change7d}%`}
                          </span>
                        </td>

                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded font-bold ${item.alpha7d >= 0 ? 'bg-emerald-500/15 text-emerald-300' : 'bg-rose-500/15 text-rose-300'}`}>
                            {item.alpha7d >= 0 ? `+${item.alpha7d}%` : `${item.alpha7d}%`}
                          </span>
                        </td>

                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded border text-[11px] ${corrBadge.color}`}>
                            {corrBadge.text}
                          </span>
                        </td>

                        <td className="p-3 text-slate-300">
                          {item.beta.toFixed(2)}x
                        </td>

                        <td className="p-3">
                          <span className="text-slate-300">
                            {item.archetype}
                          </span>
                        </td>

                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            item.signal.decision === 'COMPRA'
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                              : item.signal.decision === 'VENDA'
                              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                              : 'bg-slate-800 text-slate-400 border border-slate-700'
                          }`}>
                            {item.signal.decision} ({item.signal.confidence}%)
                          </span>
                        </td>

                        <td className="p-3 text-right">
                          <button
                            onClick={() => onSelectSymbol(item.signal.symbol)}
                            className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-amber-300 text-[11px] font-bold border border-slate-700 transition"
                          >
                            Analisar →
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Quick Leadership & Diversification Summary Bar */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 text-xs font-mono">
            {/* Top Leaders in Alpha */}
            <div className="bg-slate-950/80 border border-emerald-500/30 rounded-xl p-3">
              <div className="flex items-center justify-between text-emerald-400 font-bold mb-1.5">
                <span className="flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5" />
                  Top Líderes de Alpha (Força Relativa 7D)
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {macroSummary.topLeaders.map(s => (
                  <button
                    key={`top-leader-${s.symbol}`}
                    onClick={() => onSelectSymbol(s.symbol)}
                    className="px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20 transition flex items-center gap-1"
                  >
                    <span>{s.symbol.replace('/USDT', '')}</span>
                    <span className="text-[10px] text-emerald-400">({s.change7d ? `+${s.change7d}%` : `+${s.change24h}%`})</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Top Hedges / Descorrelated Assets */}
            <div className="bg-slate-950/80 border border-indigo-500/30 rounded-xl p-3">
              <div className="flex items-center justify-between text-indigo-400 font-bold mb-1.5">
                <span className="flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5" />
                  Oportunidades de Descorrelação & Hedge
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {macroSummary.hedges.length > 0 ? (
                  macroSummary.hedges.map(s => (
                    <button
                      key={`top-hedge-${s.symbol}`}
                      onClick={() => onSelectSymbol(s.symbol)}
                      className="px-2 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/20 transition"
                    >
                      {s.symbol.replace('/USDT', '')}
                    </button>
                  ))
                ) : (
                  <span className="text-slate-500 text-[11px]">Mercado em sincronia de alta generalizada</span>
                )}
              </div>
            </div>

            {/* Top Laggards */}
            <div className="bg-slate-950/80 border border-rose-500/30 rounded-xl p-3">
              <div className="flex items-center justify-between text-rose-400 font-bold mb-1.5">
                <span className="flex items-center gap-1.5">
                  <TrendingDown className="w-3.5 h-3.5" />
                  Subdesempenho / Laggards (Pressão Vendedora)
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {macroSummary.topLaggards.map(s => (
                  <button
                    key={`top-laggard-${s.symbol}`}
                    onClick={() => onSelectSymbol(s.symbol)}
                    className="px-2 py-0.5 rounded bg-rose-500/10 border border-rose-500/30 text-rose-300 hover:bg-rose-500/20 transition flex items-center gap-1"
                  >
                    <span>{s.symbol.replace('/USDT', '')}</span>
                    <span className="text-[10px] text-rose-400">({s.change7d ? `${s.change7d}%` : `${s.change24h}%`})</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
