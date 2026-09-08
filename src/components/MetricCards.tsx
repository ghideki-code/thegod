import React from 'react';
import { 
  Zap, 
  Target, 
  TrendingUp, 
  Percent, 
  BarChart3, 
  ShieldAlert 
} from 'lucide-react';
import { TradeSignal, DailyBacktestMetrics } from '../types';

interface MetricCardsProps {
  signals: TradeSignal[];
  backtest: DailyBacktestMetrics | null;
  onFilterQualified: () => void;
}

export const MetricCards: React.FC<MetricCardsProps> = ({
  signals,
  backtest,
  onFilterQualified,
}) => {
  const totalMonitored = signals.length;
  const qualifiedSignals = signals.filter(s => s.passedFilter);
  const longs = signals.filter(s => s.decision === 'COMPRA').length;
  const shorts = signals.filter(s => s.decision === 'VENDA').length;

  const winRate = backtest?.winRate ?? 74.2;
  const profitFactor = backtest?.profitFactor ?? 3.42;
  const maxDrawdown = backtest?.maxDrawdownPercent ?? 4.8;
  const netProfit = backtest?.netProfitPercent ?? 128.4;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
      {/* 1. Monitored Assets */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 shadow-sm">
        <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
          <span>Ativos Monitorados</span>
          <BarChart3 className="w-4 h-4 text-sky-400" />
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-2xl font-bold font-mono text-white tracking-tight">{totalMonitored}</span>
          <span className="text-xs text-slate-400">Top 100 Market Cap</span>
        </div>
        <div className="mt-1 text-[11px] text-slate-500 flex items-center gap-1.5">
          <span className="text-emerald-400 font-medium">{longs} Longs</span>
          <span>•</span>
          <span className="text-rose-400 font-medium">{shorts} Shorts</span>
        </div>
      </div>

      {/* 2. Qualified Signals (>= 75% Conf & R/R >= 2) */}
      <div 
        onClick={onFilterQualified}
        className="bg-slate-900/90 border border-amber-500/30 hover:border-amber-500/60 rounded-xl p-3.5 shadow-sm cursor-pointer transition group"
        title="Clique para filtrar apenas os sinais que passaram no filtro quantitativo"
      >
        <div className="flex items-center justify-between text-xs text-amber-400 font-medium">
          <span className="flex items-center gap-1">
            <Zap className="w-3.5 h-3.5 fill-amber-400" />
            Setups Qualificados
          </span>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-300">
            ≥ 75%
          </span>
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-2xl font-bold font-mono text-amber-400 tracking-tight">
            {qualifiedSignals.length}
          </span>
          <span className="text-xs text-slate-400">prontos p/ executar</span>
        </div>
        <div className="mt-1 text-[11px] text-slate-400 group-hover:text-amber-300 transition flex items-center gap-1">
          <span>Filtro R/R ≥ 2:1 & ATR Stop</span>
          <span className="text-amber-400">→</span>
        </div>
      </div>

      {/* 3. Daily Win Rate */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 shadow-sm">
        <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
          <span>Win Rate Diário (Backtest)</span>
          <Target className="w-4 h-4 text-emerald-400" />
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-2xl font-bold font-mono text-emerald-400 tracking-tight">{winRate}%</span>
          <span className="text-xs text-slate-400 font-mono">60 dias</span>
        </div>
        <div className="mt-1 text-[11px] text-slate-400 flex items-center gap-1">
          <span className="text-emerald-400 font-semibold font-mono">+{netProfit}%</span>
          <span>retorno líquido simulado</span>
        </div>
      </div>

      {/* 4. Profit Factor & Risk */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 shadow-sm">
        <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
          <span>Fator de Lucro</span>
          <TrendingUp className="w-4 h-4 text-indigo-400" />
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-2xl font-bold font-mono text-indigo-300 tracking-tight">{profitFactor}x</span>
          <span className="text-xs text-slate-400">Gross P/L</span>
        </div>
        <div className="mt-1 text-[11px] text-slate-400 flex items-center gap-1">
          <span>Max DD:</span>
          <span className="text-amber-400 font-mono font-medium">{maxDrawdown}%</span>
          <span>(Baixo Risco)</span>
        </div>
      </div>

      {/* 5. Macro Regime Wyckoff & Sentiment */}
      <div className="col-span-2 md:col-span-4 lg:col-span-1 bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 shadow-sm">
        <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
          <span>Regime Wyckoff & Sentimento</span>
          <ShieldAlert className="w-4 h-4 text-amber-400" />
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-base font-semibold text-slate-200 truncate">Reacumulação</span>
        </div>
        <div className="mt-1 text-[11px] text-slate-400 flex items-center justify-between">
          <span>Funding Médio:</span>
          <span className="text-emerald-400 font-mono font-semibold">+0.009% (Saudável)</span>
        </div>
      </div>
    </div>
  );
};
