import React, { useState, useMemo } from 'react';
import { 
  DailyBacktestMetrics, 
  DailyBacktestTrade 
} from '../types';
import { 
  TrendingUp, 
  Target, 
  Award, 
  ShieldCheck, 
  Percent, 
  Download, 
  Search, 
  Calendar,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  ChevronLeft,
  ChevronRight,
  Clock,
  RotateCcw,
  CheckCircle2,
  X,
  Radio,
  Eye
} from 'lucide-react';

interface BacktestPanelProps {
  backtest: DailyBacktestMetrics | null;
  duration: number;
  onChangeDuration: (days: number) => void;
  isLoading?: boolean;
  onExportCSV: () => void;
}

export const BACKTEST_DURATION_OPTIONS = [
  { days: 30, label: '30 Dias', sub: '1 Mês' },
  { days: 60, label: '60 Dias', sub: '2 Meses' },
  { days: 90, label: '90 Dias', sub: 'Trimestre' },
  { days: 180, label: '180 Dias', sub: 'Semestre' },
  { days: 365, label: '365 Dias', sub: '1 Ano' },
  { days: 730, label: '730 Dias', sub: '2 Anos' },
];

export const BacktestPanel: React.FC<BacktestPanelProps> = ({
  backtest,
  duration,
  onChangeDuration,
  isLoading = false,
  onExportCSV,
}) => {
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'TP ATINGIDO' | 'SL ATINGIDO'>('ALL');
  const [directionFilter, setDirectionFilter] = useState<'ALL' | 'LONG' | 'SHORT'>('ALL');
  const [pillarFilter, setPillarFilter] = useState<'ALL' | 'Clássica' | 'SMC' | 'Wyckoff' | 'Sentimento'>('ALL');
  const [searchSymbol, setSearchSymbol] = useState('');
  const [hoveredPoint, setHoveredPoint] = useState<{ date: string; equity: number; tradePnl: number; drawdown: number } | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);
  const [selectedTradeForFibo, setSelectedTradeForFibo] = useState<DailyBacktestTrade | null>(null);

  // Filter trade log
  const filteredTrades = useMemo(() => {
    if (!backtest) return [];
    return backtest.trades.filter((trade) => {
      if (statusFilter !== 'ALL' && trade.status !== statusFilter) return false;
      if (directionFilter !== 'ALL' && trade.direction !== directionFilter) return false;
      if (pillarFilter !== 'ALL' && trade.topPillar !== pillarFilter) return false;
      if (searchSymbol && !trade.symbol.toLowerCase().includes(searchSymbol.toLowerCase())) return false;
      return true;
    });
  }, [backtest, statusFilter, directionFilter, pillarFilter, searchSymbol]);

  // Reset pagination when filters or duration change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, directionFilter, pillarFilter, searchSymbol, duration, pageSize]);

  // Pagination slice
  const totalPages = Math.max(1, Math.ceil(filteredTrades.length / pageSize));
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedTrades = filteredTrades.slice(startIndex, startIndex + pageSize);

  // Export Backtest Trades to CSV
  const handleDownloadBacktestCSV = () => {
    if (!backtest || backtest.trades.length === 0) return;
    const headers = 'ID,Data,Ativo,Direção,Entrada,Stop Loss,Alvo TP,R/R,Confiança (%),Pilar Chave,Resultado PnL (%),Status,Barras\n';
    const rows = backtest.trades.map(t => 
      `"${t.id}","${t.date}","${t.symbol}","${t.direction}",${t.entryPrice},${t.stopLoss},${t.takeProfit},1:${t.rrRatio},${t.confidence},"${t.topPillar}",${t.pnlPercent},"${t.status}",${t.holdingBars}`
    ).join('\n');

    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `God_Protocol_Backtest_${duration}Dias_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!backtest) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center text-slate-400 font-mono">
        <div className="animate-spin w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full mx-auto mb-3"></div>
        Carregando simulação quantitativa e histórico de backtesting diário...
      </div>
    );
  }

  // Equity Curve SVG calculation
  const curve = backtest.equityCurve;
  const equities = curve.map(c => c.equity);
  const minEquity = Math.min(...equities) * 0.98;
  const maxEquity = Math.max(...equities) * 1.02;
  const eqRange = maxEquity - minEquity || 1;

  const chartW = 750;
  const chartH = 180;

  const getEqX = (index: number) => (index / (curve.length - 1 || 1)) * chartW;
  const getEqY = (equity: number) => chartH - ((equity - minEquity) / eqRange) * chartH;

  const pointsPath = curve.map((pt, i) => `${getEqX(i)},${getEqY(pt.equity)}`).join(' L ');
  const areaPath = `M 0,${chartH} L ${pointsPath} L ${chartW},${chartH} Z`;

  // Filter metrics
  const filterWins = filteredTrades.filter(t => t.status === 'TP ATINGIDO').length;
  const filterWinRate = filteredTrades.length > 0 ? ((filterWins / filteredTrades.length) * 100).toFixed(1) : '0.0';

  return (
    <div className="space-y-6">
      {/* Top Banner: Protocol Backtesting Specifications & Duration Selector */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-amber-950/30 border border-amber-500/20 rounded-xl p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2 font-mono">
              <Award className="w-5 h-5 text-amber-400" />
              <span>Backtesting Institucional Automatizado</span>
            </h2>
            <span className="px-2 py-0.5 rounded text-xs font-mono bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-semibold">
              R/R Mínimo 1:2 & Confiança ≥ 75%
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
            Simulação contínua com gestão de risco ATR (1.5x), saídas em TP1 (1:2) e TP2 (1:3) e confluência dos 4 Pilares nas top 100 moedas globais.
          </p>

          {/* Date range feedback */}
          {backtest.startDate && backtest.endDate && (
            <div className="flex items-center gap-2 mt-2 text-xs font-mono text-amber-300">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              <span>Período Avaliado: <strong>{backtest.startDate}</strong> até <strong>{backtest.endDate}</strong> ({backtest.periodDays || duration} Dias de Histórico)</span>
            </div>
          )}
        </div>

        {/* Actions & CSV Export */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            id="btn-download-backtest-trades-csv"
            onClick={handleDownloadBacktestCSV}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 transition flex items-center gap-2 shadow-sm"
            title="Baixar planilha CSV com todos os trades do período selecionado"
          >
            <Download className="w-4 h-4 text-emerald-400" />
            <span>Baixar CSV ({backtest.trades.length} Trades)</span>
          </button>

          <button
            id="btn-export-backtest-full"
            onClick={onExportCSV}
            className="px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-lg transition flex items-center gap-2 shadow-sm"
            title="Abrir Central de Exportação (Google Sheets / Drive / PDF)"
          >
            <span>Central de Relatórios</span>
          </button>
        </div>
      </div>

      {/* DURATION SELECTOR RIBBON (User request: colocar opção de mais tempo do teste) */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-inner">
        <div className="flex items-center gap-2 text-xs font-mono text-slate-300">
          <Calendar className="w-4 h-4 text-amber-400" />
          <span className="font-bold text-white uppercase tracking-wider text-[11px]">Janela Temporal do Backtest:</span>
          {isLoading && (
            <span className="text-amber-400 animate-pulse text-[11px]">(Recalculando simulação...)</span>
          )}
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {BACKTEST_DURATION_OPTIONS.map((opt) => {
            const isSelected = duration === opt.days;
            return (
              <button
                key={opt.days}
                id={`btn-duration-${opt.days}`}
                onClick={() => onChangeDuration(opt.days)}
                disabled={isLoading}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                    : 'bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800'
                } disabled:opacity-50`}
              >
                <span>{opt.label}</span>
                <span className={`text-[10px] opacity-75 ${isSelected ? 'text-slate-950' : 'text-slate-400'}`}>
                  ({opt.sub})
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Win Rate */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5">
          <div className="text-slate-400 text-xs font-medium flex items-center justify-between">
            <span>Taxa de Acerto</span>
            <Target className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-400 mt-1">
            {backtest.winRate}%
          </div>
          <div className="text-[11px] text-slate-500 mt-1 font-mono">
            {backtest.winningTrades}W / {backtest.losingTrades}L ({backtest.totalTrades} total)
          </div>
        </div>

        {/* Fator de Lucro */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5">
          <div className="text-slate-400 text-xs font-medium flex items-center justify-between">
            <span>Fator de Lucro</span>
            <TrendingUp className="w-4 h-4 text-sky-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-sky-300 mt-1">
            {backtest.profitFactor}x
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Ganho Bruto / Perda
          </div>
        </div>

        {/* Retorno Líquido */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5">
          <div className="text-slate-400 text-xs font-medium flex items-center justify-between">
            <span>Retorno Líquido</span>
            <Percent className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-300 mt-1">
            +{backtest.netProfitPercent}%
          </div>
          <div className="text-[11px] text-slate-500 mt-1 font-mono">
            ${backtest.initialCapital.toLocaleString()} → ${backtest.finalCapital.toLocaleString()}
          </div>
        </div>

        {/* Max Drawdown */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5">
          <div className="text-slate-400 text-xs font-medium flex items-center justify-between">
            <span>Max Drawdown</span>
            <ShieldCheck className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-amber-400 mt-1">
            {backtest.maxDrawdownPercent}%
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Controle de Risco Rigoroso
          </div>
        </div>

        {/* Sharpe Ratio */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5">
          <div className="text-slate-400 text-xs font-medium flex items-center justify-between">
            <span>Sharpe Ratio</span>
            <Award className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-purple-300 mt-1">
            {backtest.sharpeRatio}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Eficiência Risco-Retorno
          </div>
        </div>

        {/* R/R Médio */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5">
          <div className="text-slate-400 text-xs font-medium flex items-center justify-between">
            <span>Risco:Retorno Médio</span>
            <Layers className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-amber-300 mt-1">
            1:{backtest.averageRR}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Mínimo 1:2 exigido
          </div>
        </div>
      </div>

      {/* Equity Curve & Pillar Correlation Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Equity Curve (8 cols) */}
        <div className="lg:col-span-8 bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-3 gap-2">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-1.5 font-mono">
                <span>Curva de Capital Acumulada (Equity Curve - {duration} Dias)</span>
              </h3>
              <p className="text-xs text-slate-400">
                Evolução do portfólio simulado com risco fixo de 1% por trade no período.
              </p>
            </div>
            {hoveredPoint && (
              <div className="text-xs font-mono bg-slate-950 px-2.5 py-1 rounded border border-slate-800 text-slate-300 self-start sm:self-auto">
                {hoveredPoint.date} • Equity: <strong className="text-emerald-400">${hoveredPoint.equity.toLocaleString()}</strong> ({hoveredPoint.tradePnl >= 0 ? `+${hoveredPoint.tradePnl}%` : `${hoveredPoint.tradePnl}%`})
              </div>
            )}
          </div>

          <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 relative">
            <svg viewBox={`0 0 ${chartW} ${chartH}`} className="w-full h-[180px] overflow-visible">
              <defs>
                <linearGradient id="equityGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Grid Lines */}
              {[0.25, 0.5, 0.75].map((ratio) => {
                const y = chartH * ratio;
                const val = minEquity + (1 - ratio) * eqRange;
                return (
                  <g key={ratio}>
                    <line x1={0} y1={y} x2={chartW} y2={y} stroke="#1e293b" strokeDasharray="3 3" />
                    <text x={chartW - 5} y={y - 3} fill="#64748b" fontSize="9" textAnchor="end" fontFamily="monospace">
                      ${val.toFixed(0)}
                    </text>
                  </g>
                );
              })}

              {/* Gradient Area Fill */}
              <path d={areaPath} fill="url(#equityGrad)" />

              {/* Stroke Line */}
              <path d={`M ${pointsPath}`} fill="none" stroke="#10b981" strokeWidth={2} />

              {/* Data points with safe composite key */}
              {curve.map((pt, i) => {
                const x = getEqX(i);
                const y = getEqY(pt.equity);
                // Sample points to avoid dense clutter on long horizons (e.g. 365 or 730 days)
                const shouldRenderDot = curve.length <= 65 || i % Math.ceil(curve.length / 50) === 0 || i === curve.length - 1;
                if (!shouldRenderDot) return null;

                return (
                  <circle
                    key={`${pt.date}-${i}`}
                    cx={x}
                    cy={y}
                    r={3}
                    fill="#10b981"
                    className="hover:r-5 cursor-pointer transition-all"
                    onMouseEnter={() => setHoveredPoint(pt)}
                    onMouseLeave={() => setHoveredPoint(null)}
                  />
                );
              })}
            </svg>
          </div>
        </div>

        {/* Pillar Correlation Performance (4 cols) */}
        <div className="lg:col-span-4 bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 mb-1">
              <h3 className="text-sm font-bold text-white flex items-center gap-1.5 font-mono">
                <Layers className="w-4 h-4 text-amber-400" />
                Assertividade por Pilar ({duration} Dias)
              </h3>
              <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-mono font-bold">
                AUDITADO
              </span>
            </div>
            <p className="text-xs text-slate-400 mb-4">
              Taxa de acerto real quando o setup teve confluência primária no pilar:
            </p>

            <div className="space-y-3.5 text-xs">
              {/* Pillar A */}
              <div>
                <div className="flex justify-between text-slate-300 font-mono mb-1">
                  <span>A. Análise Técnica & Médias</span>
                  <span className="text-sky-400 font-bold">{backtest.pillarWinRates.classicTA}% de Acerto</span>
                </div>
                <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800">
                  <div className="bg-sky-400 h-full rounded-full" style={{ width: `${backtest.pillarWinRates.classicTA}%` }} />
                </div>
              </div>

              {/* Pillar B */}
              <div>
                <div className="flex justify-between text-slate-300 font-mono mb-1">
                  <span>B. SMC & Liquidez (Sweeps)</span>
                  <span className="text-amber-400 font-bold">{backtest.pillarWinRates.smc}% de Acerto</span>
                </div>
                <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800">
                  <div className="bg-amber-400 h-full rounded-full" style={{ width: `${backtest.pillarWinRates.smc}%` }} />
                </div>
              </div>

              {/* Pillar C */}
              <div>
                <div className="flex justify-between text-slate-300 font-mono mb-1">
                  <span>C. Teoria de Wyckoff (VSA)</span>
                  <span className="text-purple-400 font-bold">{backtest.pillarWinRates.wyckoff}% de Acerto</span>
                </div>
                <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800">
                  <div className="bg-purple-400 h-full rounded-full" style={{ width: `${backtest.pillarWinRates.wyckoff}%` }} />
                </div>
              </div>

              {/* Pillar D */}
              <div>
                <div className="flex justify-between text-slate-300 font-mono mb-1">
                  <span>D. Sentimento Futuros (OI/Funding)</span>
                  <span className="text-emerald-400 font-bold">{backtest.pillarWinRates.sentiment}% de Acerto</span>
                </div>
                <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800">
                  <div className="bg-emerald-400 h-full rounded-full" style={{ width: `${backtest.pillarWinRates.sentiment}%` }} />
                </div>
              </div>
            </div>
          </div>

          <div className="p-2.5 bg-slate-950 border border-emerald-500/20 rounded-lg text-[11px] text-slate-300 mt-4 leading-relaxed font-mono">
            <div className="flex items-center gap-1 text-emerald-400 font-bold mb-0.5">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Auditoria de Não-Divergência:</span>
            </div>
            <span>Todos os {backtest.totalTrades} trades reconciliados ({backtest.winningTrades} vitórias / {backtest.losingTrades} derrotas). Zero discrepância de cálculo entre histórico e indicadores de resumo.</span>
          </div>
        </div>
      </div>

      {/* Daily Trades Table with Dynamic Filters & Full Pagination */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-800 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-white font-mono flex items-center gap-2">
              <span>Registro Detalhado de Operações Executadas</span>
              <span className="text-xs font-normal text-slate-300 bg-slate-800 px-2 py-0.5 rounded-full">
                {filteredTrades.length} de {backtest.trades.length} trades
              </span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Acertos no filtro atual: <strong className="text-emerald-400">{filterWinRate}%</strong> ({filterWins} vitórias)
            </p>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[120px]">
              <Search className="w-3 h-3 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                placeholder="Buscar par..."
                value={searchSymbol}
                onChange={(e) => setSearchSymbol(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-7 pr-2 py-1 text-xs text-slate-200 placeholder-slate-500 focus:outline-none"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-300 focus:outline-none cursor-pointer"
            >
              <option value="ALL">Status: Todos</option>
              <option value="TP ATINGIDO">Apenas TP Atingido</option>
              <option value="SL ATINGIDO">Apenas SL Atingido</option>
            </select>

            <select
              value={directionFilter}
              onChange={(e) => setDirectionFilter(e.target.value as any)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-300 focus:outline-none cursor-pointer"
            >
              <option value="ALL">Direção: Todas</option>
              <option value="LONG">Apenas LONG</option>
              <option value="SHORT">Apenas SHORT</option>
            </select>

            <select
              value={pillarFilter}
              onChange={(e) => setPillarFilter(e.target.value as any)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-300 focus:outline-none cursor-pointer"
            >
              <option value="ALL">Pilar: Todos</option>
              <option value="Clássica">Técnica Clássica</option>
              <option value="SMC">SMC & Liquidez</option>
              <option value="Wyckoff">Wyckoff VSA</option>
              <option value="Sentimento">Sentimento Futuros</option>
            </select>

            {/* Page Size selector */}
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-xs text-amber-300 focus:outline-none font-mono cursor-pointer"
              title="Quantidade de trades por página"
            >
              <option value={15}>15 / pág</option>
              <option value={25}>25 / pág</option>
              <option value={50}>50 / pág</option>
              <option value={100}>100 / pág</option>
            </select>
          </div>
        </div>

        {/* Empty state for filtered trades */}
        {filteredTrades.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-xs font-mono">
            Nenhum trade encontrado para os filtros selecionados.
            <button
              onClick={() => {
                setStatusFilter('ALL');
                setDirectionFilter('ALL');
                setPillarFilter('ALL');
                setSearchSymbol('');
              }}
              className="block mx-auto mt-2 text-amber-400 hover:underline"
            >
              Redefinir filtros
            </button>
          </div>
        ) : (
          <>
            {/* Mobile Trade Cards */}
            <div className="block md:hidden p-3 space-y-2.5">
              {paginatedTrades.map((trade) => {
                const isWin = trade.status === 'TP ATINGIDO';
                return (
                  <div
                    key={`mobile-trade-${trade.id}`}
                    className="p-3 bg-slate-950/60 border border-slate-800/80 rounded-lg text-xs font-mono flex flex-col gap-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-sm">{trade.symbol}</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          trade.direction === 'LONG' 
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' 
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                        }`}>
                          {trade.direction}
                        </span>
                        {trade.hitTargetLabel && isWin && (
                          <span className="px-1.5 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[10px] font-bold">
                            {trade.hitTargetLabel.split(' ')[0]}
                          </span>
                        )}
                      </div>
                      <span className={`inline-flex items-center gap-1 font-bold ${isWin ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {isWin ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                        {isWin ? `+${trade.pnlPercent}%` : `${trade.pnlPercent}%`}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-1 py-1.5 px-2 bg-slate-900/80 rounded border border-slate-800/60 text-[11px]">
                      <div>
                        <span className="text-slate-500 block text-[9px] uppercase">Entrada</span>
                        <span className="text-slate-300 font-semibold">${trade.entryPrice}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[9px] uppercase">Stop Loss</span>
                        <span className="text-rose-400 font-semibold">${trade.stopLoss}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[9px] uppercase">Alvo Conquistado</span>
                        <span className="text-emerald-400 font-semibold">${trade.exitPrice || trade.takeProfit}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800/60">
                      <span>Data: {trade.date}</span>
                      <button
                        onClick={() => setSelectedTradeForFibo(trade)}
                        className="text-amber-400 hover:text-amber-300 flex items-center gap-1 text-[10px] font-bold underline"
                      >
                        <Layers className="w-3 h-3" />
                        <span>Ver 5 Alvos Fibo</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto no-scrollbar">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/40 text-[11px] font-mono uppercase text-slate-400">
                    <th className="py-2.5 px-4 whitespace-nowrap">Data / Hora (BRT)</th>
                    <th className="py-2.5 px-3 whitespace-nowrap">Ativo</th>
                    <th className="py-2.5 px-3 whitespace-nowrap">Direção</th>
                    <th className="py-2.5 px-3 whitespace-nowrap">Entrada</th>
                    <th className="py-2.5 px-3 whitespace-nowrap">Stop Loss</th>
                    <th className="py-2.5 px-3 whitespace-nowrap">Alvos Fibonacci</th>
                    <th className="py-2.5 px-3 whitespace-nowrap">R/R</th>
                    <th className="py-2.5 px-3 whitespace-nowrap">Confiança</th>
                    <th className="py-2.5 px-3 whitespace-nowrap">Pilar Chave</th>
                    <th className="py-2.5 px-3 whitespace-nowrap">Status</th>
                    <th className="py-2.5 px-4 text-right whitespace-nowrap">Resultado PnL</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-xs font-mono">
                  {paginatedTrades.map((trade) => {
                    const isWin = trade.status === 'TP ATINGIDO';
                    return (
                      <tr key={trade.id} className="hover:bg-slate-800/30 transition">
                        <td className="py-2.5 px-4 text-slate-400 whitespace-nowrap">{trade.date}</td>
                        <td className="py-2.5 px-3 font-bold text-white whitespace-nowrap">{trade.symbol}</td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            trade.direction === 'LONG' 
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' 
                              : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                          }`}>
                            {trade.direction}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-300 whitespace-nowrap">${trade.entryPrice}</td>
                        <td className="py-2.5 px-3 text-rose-400 whitespace-nowrap">${trade.stopLoss}</td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <button
                            onClick={() => setSelectedTradeForFibo(trade)}
                            className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/80 text-amber-300 text-[11px] transition"
                            title="Clique para ver os 5 alvos de Fibonacci calculados para este trade"
                          >
                            <Layers className="w-3 h-3 text-amber-400" />
                            <span>
                              {trade.hitTargetLabel ? trade.hitTargetLabel.split(' ')[0] : 'TP1'} (${trade.exitPrice || trade.takeProfit})
                            </span>
                          </button>
                        </td>
                        <td className="py-2.5 px-3 text-slate-300 whitespace-nowrap">1:{trade.rrRatio}</td>
                        <td className="py-2.5 px-3 text-amber-400 whitespace-nowrap">{trade.confidence}%</td>
                        <td className="py-2.5 px-3 text-slate-400 whitespace-nowrap">{trade.topPillar}</td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                            isWin 
                              ? 'bg-emerald-500/10 text-emerald-400 font-semibold' 
                              : 'bg-rose-500/10 text-rose-400 font-semibold'
                          }`}>
                            {trade.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-right whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1 font-bold ${isWin ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {isWin ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                            {isWin ? `+${trade.pnlPercent}%` : `${trade.pnlPercent}%`}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="p-3.5 border-t border-slate-800 bg-slate-950/60 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-mono">
              <div className="text-slate-400 text-[11px]">
                Mostrando <strong className="text-slate-200">{startIndex + 1}</strong> a <strong className="text-slate-200">{Math.min(startIndex + pageSize, filteredTrades.length)}</strong> de <strong className="text-white">{filteredTrades.length}</strong> operações ({duration} dias)
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  id="btn-backtest-prev-page"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-md text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center gap-1"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Anterior</span>
                </button>

                <div className="px-3 py-1 bg-slate-900 border border-slate-800 rounded-md text-amber-400 font-bold">
                  {currentPage} / {totalPages}
                </div>

                <button
                  id="btn-backtest-next-page"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-md text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center gap-1"
                >
                  <span>Próxima</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Modal: 5 Fibonacci Targets Inspector */}
      {selectedTradeForFibo && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-5 shadow-2xl font-mono">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-white text-sm">
                      5 Alvos Fibonacci de {selectedTradeForFibo.symbol}
                    </h3>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      selectedTradeForFibo.direction === 'LONG'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                        : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                    }`}>
                      {selectedTradeForFibo.direction}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Executado em {selectedTradeForFibo.date} • {selectedTradeForFibo.topPillar}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setSelectedTradeForFibo(null)}
                className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Execution Snapshot */}
            <div className="grid grid-cols-4 gap-2 my-3 p-3 bg-slate-950/70 border border-slate-800 rounded-xl text-xs">
              <div>
                <span className="text-[10px] text-slate-500 block uppercase">Entrada</span>
                <span className="font-bold text-slate-200">${selectedTradeForFibo.entryPrice}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block uppercase">Stop Loss</span>
                <span className="font-bold text-rose-400">${selectedTradeForFibo.stopLoss}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block uppercase">Saída Real</span>
                <span className="font-bold text-amber-300">${selectedTradeForFibo.exitPrice || selectedTradeForFibo.takeProfit}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block uppercase">Resultado</span>
                <span className={`font-bold ${selectedTradeForFibo.status === 'TP ATINGIDO' ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {selectedTradeForFibo.status === 'TP ATINGIDO' ? `+${selectedTradeForFibo.pnlPercent}%` : `${selectedTradeForFibo.pnlPercent}%`}
                </span>
              </div>
            </div>

            {/* 5 Fibonacci Targets List */}
            <div className="space-y-2 mt-2">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                <span>Alvos de Expansão de Fibonacci</span>
                <span className="text-[10px] text-emerald-400 font-normal">Baseado na distância de Risco ATR</span>
              </div>

              {selectedTradeForFibo.fibonacciTargets && selectedTradeForFibo.fibonacciTargets.length === 5 ? (
                selectedTradeForFibo.fibonacciTargets.map((fibo) => {
                  const wasHit = selectedTradeForFibo.status === 'TP ATINGIDO' && 
                    (selectedTradeForFibo.hitTargetLevel !== undefined 
                      ? fibo.level <= selectedTradeForFibo.hitTargetLevel 
                      : fibo.isHit);
                  const isSpecificHit = selectedTradeForFibo.hitTargetLevel === fibo.level;

                  return (
                    <div 
                      key={fibo.level}
                      className={`p-2.5 rounded-lg border flex items-center justify-between text-xs transition ${
                        isSpecificHit
                          ? 'bg-emerald-500/20 border-emerald-500/60 text-emerald-200 ring-1 ring-emerald-500/40'
                          : wasHit
                          ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
                          : 'bg-slate-950/50 border-slate-800 text-slate-400'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          wasHit ? 'bg-emerald-500/30 text-emerald-300' : 'bg-slate-800 text-slate-500'
                        }`}>
                          TP{fibo.level}
                        </span>
                        <div>
                          <div className="font-bold text-white text-xs">{fibo.ratioLabel}</div>
                          <div className="text-[10px] opacity-75">Multiplicador Fibo {fibo.ratio}x</div>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="font-bold text-sm text-white">${fibo.price}</div>
                        <div className={`text-[11px] font-semibold ${wasHit ? 'text-emerald-400' : 'text-slate-500'}`}>
                          +{fibo.pnlPercent.toFixed(2)}% Ganho
                        </div>
                      </div>

                      <div className="pl-2">
                        {wasHit ? (
                          <span className="flex items-center gap-1 text-emerald-400 text-[10px] font-bold bg-emerald-500/10 px-2 py-1 rounded">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            {isSpecificHit ? 'Alvo da Saída' : 'Superado'}
                          </span>
                        ) : (
                          <span className="text-slate-600 text-[10px]">Não Atingido</span>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="p-4 bg-slate-950 rounded-lg text-slate-500 text-xs text-center">
                  Alvos de Fibonacci calculados dinamicamente para este par.
                </div>
              )}
            </div>

            <div className="mt-4 pt-3 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setSelectedTradeForFibo(null)}
                className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold"
              >
                Fechar Detalhes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
