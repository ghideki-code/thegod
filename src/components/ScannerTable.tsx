import React, { useState, useMemo } from 'react';
import { 
  Search, 
  Filter, 
  ArrowUpRight, 
  ArrowDownRight, 
  Eye, 
  Calculator, 
  CheckCircle2, 
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Layers,
  Award, 
  Target, 
  LayoutGrid, 
  List,
  ShieldCheck,
  Zap,
  Flame
} from 'lucide-react';
import { TradeSignal, SignalDecision, TradingExecutionStyle } from '../types';
import { formatMarketCap } from '../utils/timeFormat';

function getSignalExecutionStyle(signal: TradeSignal): 'SCALP' | 'DAY_TRADE' | 'SWING_TRADE' | 'POSITION' {
  if (signal.style) return signal.style;
  const tf = signal.timeframe;
  if (tf && ['3m', '5m', '15m', '30m'].includes(tf)) return 'SCALP';
  if (tf && ['1h', '2h'].includes(tf)) return 'DAY_TRADE';
  if (tf && ['4h', '8h', '12h', '1d'].includes(tf)) return 'SWING_TRADE';
  if (tf && ['3d', '5d', '1w', '2w'].includes(tf)) return 'POSITION';
  if (Math.abs(signal.change24h) >= 7) return 'SCALP';
  if (signal.riskReward >= 2.5) return 'SWING_TRADE';
  return 'DAY_TRADE';
}

/**
 * Real-time market quotation badge with trend indicator arrow (green/red)
 * displayed right beside the asset title for instantaneous volatility reading.
 */
export const AssetLiveQuoteBadge: React.FC<{ price: number; change24h: number }> = ({ price, change24h }) => {
  const safeChange = change24h ?? 0;
  const safePrice = price ?? 0;
  const isPositive = safeChange >= 0;
  let formattedPrice = '';
  if (safePrice >= 100) {
    formattedPrice = safePrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  } else if (safePrice >= 1) {
    formattedPrice = safePrice.toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 4 });
  } else {
    formattedPrice = safePrice.toFixed(safePrice < 0.001 ? 6 : 4);
  }

  return (
    <span 
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[11px] font-mono font-bold transition-all shadow-xs ${
        isPositive 
          ? 'bg-emerald-500/15 border border-emerald-500/40 text-emerald-300' 
          : 'bg-rose-500/15 border border-rose-500/40 text-rose-300'
      }`}
      title={`Cotação de mercado em tempo real: $${formattedPrice} (${isPositive ? '+' : ''}${safeChange}% em 24h)`}
    >
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 animate-pulse ${isPositive ? 'bg-emerald-400' : 'bg-rose-400'}`} />
      <span>${formattedPrice}</span>
      <span className="text-[10px] leading-none">
        {isPositive ? '▲' : '▼'}
      </span>
      <span className="text-[10px] opacity-90 font-medium">
        {isPositive ? `+${safeChange}%` : `${safeChange}%`}
      </span>
    </span>
  );
};

interface ScannerTableProps {
  signals: TradeSignal[];
  selectedSymbol: string;
  onSelectSymbol: (symbol: string) => void;
  onOpenRiskCalc: (signal: TradeSignal) => void;
  filterOnlyQualified: boolean;
  setFilterOnlyQualified: (val: boolean) => void;
}

export const ScannerTable: React.FC<ScannerTableProps> = ({
  signals,
  selectedSymbol,
  onSelectSymbol,
  onOpenRiskCalc,
  filterOnlyQualified,
  setFilterOnlyQualified,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [decisionFilter, setDecisionFilter] = useState<'ALL' | SignalDecision>('ALL');
  const [minRiskReward, setMinRiskReward] = useState<number>(0);
  const [mcapPreset, setMcapPreset] = useState<'ALL' | 'TOP10' | 'TOP50' | 'TOP100'>('ALL');
  const [sortBy, setSortBy] = useState<'mcap_rank' | 'confidence' | 'rr' | 'change' | 'symbol'>('mcap_rank');
  const [antiClutter, setAntiClutter] = useState<boolean>(false);
  const [styleFilter, setStyleFilter] = useState<'ALL' | 'SCALP' | 'DAY_TRADE' | 'SWING_TRADE' | 'POSITION'>('ALL');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);
  const [viewLayout, setViewLayout] = useState<'auto' | 'table' | 'cards'>('auto');

  // Filter and Sort logic
  const filteredSignals = useMemo(() => {
    return signals
      .filter((signal) => {
        // Search filter
        if (searchTerm && !signal.symbol.toLowerCase().includes(searchTerm.toLowerCase()) && !signal.name.toLowerCase().includes(searchTerm.toLowerCase())) {
          return false;
        }
        // Only qualified toggle
        if (filterOnlyQualified && !signal.passedFilter) {
          return false;
        }
        // Anti-Encavalamento / Anti-Ruído filter (>=80% confidence, R/R >= 2.0, non-waiting)
        if (antiClutter) {
          if (!signal.passedFilter) return false;
          if (signal.confidence < 80) return false;
          if (signal.riskReward < 2.0) return false;
          if (signal.decision === 'AGUARDAR') return false;
        }
        // Execution Style filter
        if (styleFilter !== 'ALL') {
          const style = getSignalExecutionStyle(signal);
          if (style !== styleFilter) return false;
        }
        // Market Cap Presets
        if (mcapPreset === 'TOP10' && (signal.marketCapRank || 999) > 10) {
          return false;
        }
        if (mcapPreset === 'TOP50' && (signal.marketCapRank || 999) > 50) {
          return false;
        }
        if (mcapPreset === 'TOP100' && (signal.marketCapRank || 999) > 100) {
          return false;
        }
        // Decision filter
        if (decisionFilter !== 'ALL' && signal.decision !== decisionFilter) {
          return false;
        }
        // Adjustable Risk/Reward (R/R) filter
        if (minRiskReward > 0 && signal.riskReward < minRiskReward) {
          return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'mcap_rank') {
          return (a.marketCapRank || 999) - (b.marketCapRank || 999);
        }
        if (sortBy === 'confidence') return b.confidence - a.confidence;
        if (sortBy === 'rr') return b.riskReward - a.riskReward;
        if (sortBy === 'change') return Math.abs(b.change24h) - Math.abs(a.change24h);
        return a.symbol.localeCompare(b.symbol);
      });
  }, [signals, searchTerm, filterOnlyQualified, antiClutter, styleFilter, mcapPreset, decisionFilter, minRiskReward, sortBy]);

  // Reset page when filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterOnlyQualified, antiClutter, styleFilter, mcapPreset, decisionFilter, minRiskReward, sortBy, pageSize]);

  // Pagination calculation
  const totalPages = Math.max(1, Math.ceil(filteredSignals.length / pageSize));
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedSignals = filteredSignals.slice(startIndex, startIndex + pageSize);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
      {/* Header & Controls Bar */}
      <div className="p-4 border-b border-slate-800 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <span>Scanner Quantitativo: Top 100 Criptomoedas</span>
            </h2>
            <span className="text-xs font-mono text-amber-400 bg-amber-400/10 border border-amber-400/30 px-2 py-0.5 rounded-full font-semibold">
              Ranking Market Cap
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Monitorando {signals.length} maiores criptos globais com confluência das 4 escolas e execução Triple Screen.
          </p>
        </div>

        {/* Dynamic Filters Bar */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Market Cap Presets */}
          <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg p-0.5 text-xs font-mono">
            <button
              onClick={() => setMcapPreset('ALL')}
              className={`px-2 py-1 rounded transition ${mcapPreset === 'ALL' ? 'bg-slate-800 text-white font-bold' : 'text-slate-400 hover:text-slate-200'}`}
              title="Todas as 100 maiores criptos"
            >
              Top 100
            </button>
            <button
              onClick={() => setMcapPreset('TOP50')}
              className={`px-2 py-1 rounded transition ${mcapPreset === 'TOP50' ? 'bg-slate-800 text-white font-bold' : 'text-slate-400 hover:text-slate-200'}`}
              title="Top 50 Maiores"
            >
              Top 50
            </button>
            <button
              onClick={() => setMcapPreset('TOP10')}
              className={`px-2 py-1 rounded transition ${mcapPreset === 'TOP10' ? 'bg-slate-800 text-white font-bold' : 'text-slate-400 hover:text-slate-200'}`}
              title="Top 10 Maiores"
            >
              Top 10
            </button>
          </div>

          {/* Search Input */}
          <div className="relative min-w-[150px]">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              id="input-search-symbol"
              type="text"
              placeholder="Buscar (ex: BTC, SOL, ADA)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500/50"
            />
          </div>

          {/* Quick Filter: Only Qualified Toggle */}
          <button
            id="btn-filter-qualified-toggle"
            onClick={() => setFilterOnlyQualified(!filterOnlyQualified)}
            className={`px-2.5 py-1.5 text-xs rounded-lg font-medium border transition flex items-center gap-1.5 ${
              filterOnlyQualified
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm'
                : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
            }`}
          >
            <CheckCircle2 className={`w-3.5 h-3.5 ${filterOnlyQualified ? 'text-amber-400' : 'text-slate-500'}`} />
            <span>Filtro God Protocol (≥75%)</span>
          </button>

          {/* Anti-Encavalamento / Anti-Ruído Toggle (Directly resolves user request) */}
          <button
            id="btn-anti-clutter-toggle"
            onClick={() => {
              const next = !antiClutter;
              setAntiClutter(next);
              if (next) setFilterOnlyQualified(true);
            }}
            className={`px-2.5 py-1.5 text-xs rounded-lg font-medium border transition flex items-center gap-1.5 ${
              antiClutter
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-sm font-bold'
                : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
            }`}
            title="Modo Anti-Encavalamento: elimina sinais incertos e ruído de mercado, mostrando apenas confluências comprovadas (≥80% e R/R ≥1:2.0)"
          >
            <ShieldCheck className={`w-3.5 h-3.5 ${antiClutter ? 'text-emerald-400' : 'text-slate-500'}`} />
            <span>Anti-Encavalamento (≥80%)</span>
          </button>

          {/* Divisão por Estilo Operacional: SCALP, DAY TRADE, SWING TRADE, POSITION */}
          <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-xs">
            <span className="text-slate-500 mr-1">Estilo:</span>
            <select
              id="select-style-filter"
              value={styleFilter}
              onChange={(e) => setStyleFilter(e.target.value as any)}
              className="bg-transparent text-slate-300 focus:outline-none cursor-pointer"
            >
              <option value="ALL" className="bg-slate-900">Todos os Estilos</option>
              <option value="SCALP" className="bg-slate-900 text-amber-300">SCALP (3m-30m)</option>
              <option value="DAY_TRADE" className="bg-slate-900 text-sky-300">DAY TRADE (1h-2h)</option>
              <option value="SWING_TRADE" className="bg-slate-900 text-purple-300">SWING TRADE (4h-1d)</option>
              <option value="POSITION" className="bg-slate-900 text-emerald-300">POSITION TRADE (3d-2w)</option>
            </select>
          </div>

          {/* Decision Dropdown */}
          <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-xs">
            <span className="text-slate-500 mr-1">Sinal:</span>
            <select
              id="select-decision-filter"
              value={decisionFilter}
              onChange={(e) => setDecisionFilter(e.target.value as any)}
              className="bg-transparent text-slate-300 focus:outline-none cursor-pointer"
            >
              <option value="ALL" className="bg-slate-900">Todos</option>
              <option value="COMPRA" className="bg-slate-900 text-emerald-400">COMPRA (LONG)</option>
              <option value="VENDA" className="bg-slate-900 text-rose-400">VENDA (SHORT)</option>
              <option value="AGUARDAR" className="bg-slate-900 text-slate-400">AGUARDAR</option>
            </select>
          </div>

          {/* Adjustable Risk/Reward (R/R) Filter */}
          <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-xs font-mono">
            <span className="text-slate-500 mr-1 flex items-center gap-1">
              <Target className="w-3 h-3 text-amber-400" />
              R/R Mín:
            </span>
            <select
              id="select-min-rr-filter"
              value={minRiskReward}
              onChange={(e) => setMinRiskReward(Number(e.target.value))}
              className="bg-transparent text-amber-300 font-mono focus:outline-none cursor-pointer"
            >
              <option value={0} className="bg-slate-900 text-white">Todos</option>
              <option value={1.5} className="bg-slate-900 text-white">≥ 1:1.5</option>
              <option value={2.0} className="bg-slate-900 text-white">≥ 1:2.0</option>
              <option value={2.5} className="bg-slate-900 text-white">≥ 1:2.5</option>
              <option value={3.0} className="bg-slate-900 text-amber-300 font-bold">≥ 1:3.0</option>
              <option value={4.0} className="bg-slate-900 text-amber-300 font-bold">≥ 1:4.0</option>
              <option value={5.0} className="bg-slate-900 text-emerald-400 font-bold">≥ 1:5.0 (Alta Assimetria)</option>
              <option value={6.0} className="bg-slate-900 text-emerald-400 font-bold">≥ 1:6.0 (Institucional)</option>
              <option value={8.0} className="bg-slate-900 text-purple-400 font-bold">≥ 1:8.0 (Alavancado)</option>
              <option value={10.0} className="bg-slate-900 text-rose-400 font-bold">≥ 1:10.0 (Super Assimetria)</option>
            </select>
          </div>

          {/* Sort By Dropdown */}
          <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-xs">
            <span className="text-slate-500 mr-1">Ordem:</span>
            <select
              id="select-sort-by"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-transparent text-slate-300 focus:outline-none cursor-pointer"
            >
              <option value="mcap_rank" className="bg-slate-900">Rank Market Cap (#1-#100)</option>
              <option value="confidence" className="bg-slate-900">Maior Confiança</option>
              <option value="rr" className="bg-slate-900">Maior Risco/Retorno</option>
              <option value="change" className="bg-slate-900">Maior Volatilidade</option>
              <option value="symbol" className="bg-slate-900">Alfabético</option>
            </select>
          </div>

          {/* View Layout Toggle (Auto / Cards / Table) */}
          <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg p-0.5 text-xs font-mono">
            <button
              id="btn-layout-auto"
              onClick={() => setViewLayout('auto')}
              className={`px-2 py-1 rounded transition text-[11px] ${
                viewLayout === 'auto' ? 'bg-slate-800 text-amber-400 font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Modo Responsivo Automático (Cards no Celular, Tabela no Desktop)"
            >
              Auto
            </button>
            <button
              id="btn-layout-cards"
              onClick={() => setViewLayout('cards')}
              className={`p-1.5 rounded transition ${
                viewLayout === 'cards' ? 'bg-slate-800 text-amber-400' : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Visualização em Cards"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button
              id="btn-layout-table"
              onClick={() => setViewLayout('table')}
              className={`p-1.5 rounded transition ${
                viewLayout === 'table' ? 'bg-slate-800 text-amber-400' : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Visualização em Tabela Completa"
            >
              <List className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Anti-Encavalamento Active Feedback Banner */}
      {antiClutter && (
        <div className="mx-4 mt-3.5 p-3 bg-emerald-950/40 border border-emerald-500/30 rounded-lg flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs font-mono text-emerald-300">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              <strong>Modo Anti-Encavalamento Ativo:</strong> Exibindo {filteredSignals.length} operações de altíssima convicção institucional (Confluência ≥ 80%, R/R ≥ 1:2.0 e Gatilho Imediato). Ruído secundário filtrado.
            </span>
          </div>
          <button
            onClick={() => setAntiClutter(false)}
            className="text-[11px] underline text-emerald-400 hover:text-white font-medium self-start sm:self-auto"
          >
            Desativar Filtro
          </button>
        </div>
      )}

      {/* Empty State */}
      {paginatedSignals.length === 0 ? (
        <div className="py-12 px-4 text-center text-slate-500">
          <div className="flex flex-col items-center justify-center gap-2">
            <AlertCircle className="w-8 h-8 text-slate-600" />
            <span className="font-semibold text-slate-400">Nenhum ativo corresponde aos filtros selecionados.</span>
            <button
              onClick={() => {
                setSearchTerm('');
                setFilterOnlyQualified(false);
                setDecisionFilter('ALL');
                setMinRiskReward(0);
                setMcapPreset('ALL');
                setSortBy('mcap_rank');
              }}
              className="mt-1 text-xs text-amber-400 hover:underline"
            >
              Redefinir filtros do Top 100
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Responsive Mobile Card View (shown when layout is 'cards', or 'auto' on screens < md) */}
          <div className={`${viewLayout === 'table' ? 'hidden' : viewLayout === 'cards' ? 'block' : 'block md:hidden'} p-3 space-y-3`}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {paginatedSignals.map((signal) => {
                const isSelected = selectedSymbol === signal.symbol;
                const isLong = signal.decision === 'COMPRA';
                const isShort = signal.decision === 'VENDA';

                const priceVal = signal.currentPrice ?? 0;
                let formattedPrice = '';
                if (priceVal >= 100) {
                  formattedPrice = priceVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                } else if (priceVal >= 1) {
                  formattedPrice = priceVal.toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 4 });
                } else {
                  formattedPrice = priceVal.toFixed(priceVal < 0.001 ? 6 : 4);
                }

                return (
                  <div
                    key={`card-${signal.id}`}
                    onClick={() => onSelectSymbol(signal.symbol)}
                    className={`p-3.5 rounded-xl border transition flex flex-col justify-between gap-3 cursor-pointer ${
                      isSelected
                        ? 'bg-amber-500/10 border-amber-500 shadow-md ring-1 ring-amber-500/30'
                        : 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700 hover:bg-slate-900/50'
                    }`}
                  >
                    {/* Header: Rank, Symbol, Name & Price */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-400/10 border border-amber-400/30 text-amber-400 font-bold">
                          #{signal.marketCapRank || '—'}
                        </span>
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-white font-mono text-sm">{signal.symbol}</span>
                            <AssetLiveQuoteBadge price={signal.currentPrice} change24h={signal.change24h} />
                            <span className="text-xs text-slate-400 font-normal">({signal.name})</span>
                          </div>
                          <div className="text-[11px] text-slate-500 font-mono">
                            MCap: {formatMarketCap(signal.marketCap)}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col items-end">
                        <div className="font-mono font-bold text-white text-sm">
                          ${formattedPrice}
                        </div>
                        <div className={`text-[11px] font-mono font-semibold flex items-center gap-0.5 ${signal.change24h >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {signal.change24h >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                          {signal.change24h >= 0 ? `+${signal.change24h}%` : `${signal.change24h}%`}
                        </div>
                      </div>
                    </div>

                    {/* Decision & AI Confidence */}
                    <div className="bg-slate-900/80 border border-slate-800/80 rounded-lg p-2 flex items-center justify-between gap-2">
                      <div>
                        <div className="text-[10px] uppercase font-mono text-slate-500">Decisão</div>
                        <div className="mt-0.5">
                          {isLong && (
                            <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[11px] font-bold font-mono inline-flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                              COMPRA
                            </span>
                          )}
                          {isShort && (
                            <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[11px] font-bold font-mono inline-flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />
                              VENDA
                            </span>
                          )}
                          {!isLong && !isShort && (
                            <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700 text-[11px] font-medium font-mono">
                              AGUARDAR
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-[10px] uppercase font-mono text-slate-500">Confiança IA</div>
                        <div className="flex items-center gap-1.5 justify-end mt-0.5">
                          <div className="w-14 bg-slate-800 h-1.5 rounded-full overflow-hidden border border-slate-700">
                            <div
                              className={`h-full rounded-full ${signal.confidence >= 75 ? 'bg-emerald-400' : 'bg-amber-400'}`}
                              style={{ width: `${signal.confidence}%` }}
                            />
                          </div>
                          <span className={`text-xs font-bold font-mono ${signal.confidence >= 75 ? 'text-emerald-400' : 'text-amber-400'}`}>
                            {signal.confidence}%
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Triple Screen & R/R Info */}
                    <div className="space-y-1.5 text-xs font-mono">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-400">Triple Screen:</span>
                        <div className="flex items-center gap-1">
                          <span className={`px-1.5 py-0.2 rounded border text-[10px] ${
                            signal.tripleScreen.htf.trend.includes('ALTA')
                              ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                              : signal.tripleScreen.htf.trend.includes('BAIXA')
                              ? 'bg-rose-500/10 text-rose-300 border-rose-500/30'
                              : 'bg-slate-900 border-slate-800 text-slate-300'
                          }`}>
                            1D: {signal.tripleScreen.htf.trend.includes('ALTA') ? 'ALTA' : signal.tripleScreen.htf.trend.includes('BAIXA') ? 'BAIXA' : 'LAT'}
                          </span>
                          <span className="px-1.5 py-0.2 rounded bg-slate-900 border border-slate-800 text-slate-300 text-[10px]">
                            1H: {signal.tripleScreen.mtf.dynamicSupportResistance.includes('Suporte') ? 'SUP' : 'RES'}
                          </span>
                          <span className="px-1.5 py-0.2 rounded bg-slate-900 border border-slate-800 text-slate-300 text-[10px]">
                            15m: {signal.tripleScreen.ltf.emaCross.includes('Alta') ? '9>21' : '9<21'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-400">Risco/Retorno & Stop:</span>
                        <span className="text-slate-200">
                          <strong className="text-amber-400 font-bold">1:{signal.riskReward}</strong>
                          {' • '}
                          <span className="text-rose-400">${signal.stopLoss}</span>
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="pt-2 border-t border-slate-800/80 flex items-center gap-2">
                      <button
                        onClick={() => onSelectSymbol(signal.symbol)}
                        className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-medium border transition flex items-center justify-center gap-1.5 ${
                          isSelected
                            ? 'bg-amber-500 text-slate-950 font-bold border-amber-400'
                            : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                        }`}
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>{isSelected ? 'Em Foco' : 'Ver Análise'}</span>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenRiskCalc(signal);
                        }}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
                        title="Calcular Risco e Lote"
                      >
                        <Calculator className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Desktop Table View (shown when layout is 'table', or 'auto' on screens >= md) */}
          <div className={`${viewLayout === 'cards' ? 'hidden' : viewLayout === 'table' ? 'block' : 'hidden md:block'} overflow-x-auto no-scrollbar`}>
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800/80 bg-slate-950/50 text-[11px] font-mono uppercase tracking-wider text-slate-400">
                  <th className="py-3 px-4">Rank / Ativo</th>
                  <th className="py-3 px-3">Preço / 24h</th>
                  <th className="py-3 px-3">Market Cap</th>
                  <th className="py-3 px-3">Triple Screen (1D • 1H • 15m)</th>
                  <th className="py-3 px-3">4 Pilares (TA • SMC • Wyck • Sent)</th>
                  <th className="py-3 px-3">Confiança IA</th>
                  <th className="py-3 px-3">R/R Mín</th>
                  <th className="py-3 px-3">Stop ATR</th>
                  <th className="py-3 px-3">Decisão</th>
                  <th className="py-3 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-xs">
                {paginatedSignals.map((signal) => {
                  const isSelected = selectedSymbol === signal.symbol;
                  const isLong = signal.decision === 'COMPRA';
                  const isShort = signal.decision === 'VENDA';

                  const priceVal = signal.currentPrice ?? 0;
                  let formattedPrice = '';
                  if (priceVal >= 100) {
                    formattedPrice = priceVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                  } else if (priceVal >= 1) {
                    formattedPrice = priceVal.toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 4 });
                  } else {
                    formattedPrice = priceVal.toFixed(priceVal < 0.001 ? 6 : 4);
                  }

                  return (
                    <tr
                      key={signal.id}
                      onClick={() => onSelectSymbol(signal.symbol)}
                      className={`transition cursor-pointer ${
                        isSelected 
                          ? 'bg-amber-500/10 border-l-4 border-amber-500' 
                          : 'hover:bg-slate-800/50'
                      }`}
                    >
                      {/* Ativo e Rank */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex flex-col items-center justify-center shrink-0">
                            <span className="text-[10px] font-mono font-bold text-amber-400">
                              #{signal.marketCapRank || '—'}
                            </span>
                          </div>
                          <div>
                            <div className="font-bold text-white font-mono flex items-center gap-1.5 flex-wrap">
                              <span>{signal.symbol}</span>
                              <AssetLiveQuoteBadge price={signal.currentPrice} change24h={signal.change24h} />
                              {signal.passedFilter && (
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-semibold">
                                  QUALIFICADO
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400 truncate max-w-[120px]">{signal.name}</div>
                          </div>
                        </div>
                      </td>

                      {/* Preço & 24h */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="font-mono text-slate-200 font-medium">
                          ${formattedPrice}
                        </div>
                        <div className={`text-[11px] font-mono flex items-center gap-0.5 ${signal.change24h >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {signal.change24h >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                          {signal.change24h >= 0 ? `+${signal.change24h}%` : `${signal.change24h}%`}
                        </div>
                      </td>

                      {/* Market Cap */}
                      <td className="py-3 px-3 font-mono text-xs text-slate-300 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-slate-200 font-semibold">
                          {formatMarketCap(signal.marketCap)}
                        </span>
                      </td>

                      {/* Triple Screen (1D • 1H • 15m) */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="flex items-center gap-1 font-mono text-[10px]">
                          {/* 1D */}
                          <span 
                            className={`px-1.5 py-0.5 rounded border ${
                              signal.tripleScreen.htf.trend.includes('ALTA') 
                                ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30' 
                                : signal.tripleScreen.htf.trend.includes('BAIXA')
                                ? 'bg-rose-500/10 text-rose-300 border-rose-500/30'
                                : 'bg-slate-800 text-slate-400 border-slate-700'
                            }`}
                            title={`HTF Diário: ${signal.tripleScreen.htf.trend}`}
                          >
                            1D: {signal.tripleScreen.htf.trend.includes('ALTA') ? 'ALTA' : signal.tripleScreen.htf.trend.includes('BAIXA') ? 'BAIXA' : 'LAT'}
                          </span>

                          {/* 1H */}
                          <span 
                            className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 truncate max-w-[85px]"
                            title={`MTF 1H: ${signal.tripleScreen.mtf.pattern} • ${signal.tripleScreen.mtf.dynamicSupportResistance}`}
                          >
                            1H: {signal.tripleScreen.mtf.dynamicSupportResistance.includes('Suporte') ? 'SUP' : 'RES'}
                          </span>

                          {/* 15m */}
                          <span 
                            className={`px-1.5 py-0.5 rounded border ${
                              signal.tripleScreen.ltf.emaCross.includes('Alta')
                                ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                                : signal.tripleScreen.ltf.emaCross.includes('Baixa')
                                ? 'bg-rose-500/10 text-rose-300 border-rose-500/30'
                                : 'bg-slate-800 text-slate-400 border-slate-700'
                            }`}
                            title={`LTF 15m: ${signal.tripleScreen.ltf.emaCross} • RSI: ${signal.tripleScreen.ltf.rsi}`}
                          >
                            15m: {signal.tripleScreen.ltf.emaCross.includes('Alta') ? '9>21' : '9<21'}
                          </span>
                        </div>
                      </td>

                      {/* 4 Pilares Mini Scores */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="flex items-center gap-1 font-mono text-[10px]">
                          <span 
                            className="px-1 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700" 
                            title={`Técnica Clássica: ${signal.fourPillars.classicTA.score}%`}
                          >
                            TA:{signal.fourPillars.classicTA.score}
                          </span>
                          <span 
                            className="px-1 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700"
                            title={`SMC & Liquidez: ${signal.fourPillars.smc.score}%`}
                          >
                            SMC:{signal.fourPillars.smc.score}
                          </span>
                          <span 
                            className="px-1 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700"
                            title={`Wyckoff: ${signal.fourPillars.wyckoff.score}%`}
                          >
                            WYK:{signal.fourPillars.wyckoff.score}
                          </span>
                          <span 
                            className="px-1 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700"
                            title={`Sentimento Futuros: ${signal.fourPillars.sentiment.score}%`}
                          >
                            SEN:{signal.fourPillars.sentiment.score}
                          </span>
                        </div>
                      </td>

                      {/* Confiança IA */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="w-14 bg-slate-800 rounded-full h-2 overflow-hidden border border-slate-700">
                            <div 
                              className={`h-full rounded-full transition-all ${
                                signal.confidence >= 75 
                                  ? 'bg-gradient-to-r from-amber-400 to-emerald-400' 
                                  : signal.confidence >= 60 
                                  ? 'bg-amber-400' 
                                  : 'bg-slate-500'
                              }`}
                              style={{ width: `${signal.confidence}%` }}
                            />
                          </div>
                          <span className={`font-mono font-bold text-xs ${
                            signal.confidence >= 75 ? 'text-emerald-400' : 'text-slate-400'
                          }`}>
                            {signal.confidence}%
                          </span>
                        </div>
                      </td>

                      {/* R/R */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className={`font-mono text-xs font-semibold px-2 py-0.5 rounded border ${
                          signal.riskReward >= 2.0 
                            ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30' 
                            : 'bg-slate-800 text-slate-400 border-slate-700'
                        }`}>
                          1:{signal.riskReward}
                        </span>
                      </td>

                      {/* Stop Loss ATR */}
                      <td className="py-3 px-3 font-mono text-xs text-slate-300 whitespace-nowrap">
                        <div>${signal.stopLoss}</div>
                        <div className="text-[10px] text-slate-500">ATR: {signal.atrValue}</div>
                      </td>

                      {/* Decisão Protocolo */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        {isLong && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                            COMPRA
                          </span>
                        )}
                        {isShort && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold font-mono bg-rose-500/20 text-rose-300 border border-rose-500/40 shadow-sm">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse"></span>
                            VENDA
                          </span>
                        )}
                        {!isLong && !isShort && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-mono bg-slate-800 text-slate-400 border border-slate-700">
                            AGUARDAR
                          </span>
                        )}
                      </td>

                      {/* Ações */}
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            id={`btn-view-analysis-${signal.symbol}`}
                            onClick={() => onSelectSymbol(signal.symbol)}
                            className={`px-2.5 py-1 text-xs rounded-lg font-medium border transition flex items-center gap-1 ${
                              isSelected 
                                ? 'bg-amber-500 text-slate-950 font-bold border-amber-400' 
                                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                            }`}
                            title="Examinar Análise Triple Screen & 4 Pilares"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>{isSelected ? 'Em Foco' : 'Ver Análise'}</span>
                          </button>

                          <button
                            id={`btn-calc-risk-${signal.symbol}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenRiskCalc(signal);
                            }}
                            className="p-1 text-xs rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
                            title="Calcular dimensionamento de posição e risco"
                          >
                            <Calculator className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Pagination & Summary Footer */}
      <div className="p-3 border-t border-slate-800 bg-slate-950/70 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs">
        <div className="text-slate-400 font-mono">
          Exibindo <span className="text-white font-bold">{Math.min(startIndex + 1, filteredSignals.length)}</span> a{' '}
          <span className="text-white font-bold">{Math.min(startIndex + pageSize, filteredSignals.length)}</span> de{' '}
          <span className="text-amber-400 font-bold">{filteredSignals.length}</span> criptomoedas filtradas (Total de {signals.length})
        </div>

        <div className="flex items-center gap-3">
          {/* Page size selector */}
          <div className="flex items-center gap-1.5 text-slate-400">
            <span>Por página:</span>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="bg-slate-900 border border-slate-800 text-slate-300 rounded px-2 py-0.5 text-xs focus:outline-none cursor-pointer"
            >
              <option value={20}>20</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100 (Todos)</option>
            </select>
          </div>

          {/* Page navigation buttons */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-1 rounded bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition"
              title="Página Anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-2 font-mono text-slate-300">
              {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-1 rounded bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition"
              title="Próxima Página"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
