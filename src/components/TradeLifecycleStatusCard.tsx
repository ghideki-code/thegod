import React from 'react';
import { 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  Target, 
  ShieldCheck, 
  XCircle, 
  Activity, 
  TrendingUp, 
  TrendingDown, 
  Zap, 
  ArrowRight,
  Sparkles
} from 'lucide-react';
import { TradeSignal } from '../types';

export type TradeLifecycleStatus = 
  | 'VALIDO_AGUARDANDO' 
  | 'EM_ANDAMENTO' 
  | 'TP_ATINGIDO' 
  | 'INVALIDADO_STOP' 
  | 'INVALIDADO_ESTRUTURA';

interface TradeLifecycleStatusCardProps {
  signal: TradeSignal;
  onOpenRiskCalc?: () => void;
}

export const TradeLifecycleStatusCard: React.FC<TradeLifecycleStatusCardProps> = ({
  signal,
  onOpenRiskCalc,
}) => {
  const currentPrice = signal.currentPrice ?? 0;
  const entryPrice = signal.entryPrice ?? (currentPrice || 1);
  const stopLoss = signal.stopLoss ?? (currentPrice ? currentPrice * 0.98 : 0);
  const takeProfit1 = signal.takeProfit1 ?? (currentPrice ? currentPrice * 1.04 : 0);
  const decision = signal.decision;
  const passedFilter = signal.passedFilter ?? false;

  const isLong = decision === 'COMPRA';
  const isShort = decision === 'VENDA';

  const formatPriceVal = (val: number | undefined | null): string => {
    if (val === undefined || val === null || isNaN(val)) return '0.00';
    return val >= 1 ? val.toFixed(2) : val.toFixed(4);
  };

  // Determine current lifecycle state
  let status: TradeLifecycleStatus = 'VALIDO_AGUARDANDO';
  let statusTitle = 'VÁLIDO (AGUARDANDO GATILHO)';
  let statusDescription = '';
  let badgeColor = 'bg-amber-500/10 border-amber-500/40 text-amber-300';
  let pnlPercent = 0;
  let progressPercent = 0;

  if (!passedFilter || decision === 'AGUARDAR') {
    status = 'INVALIDADO_ESTRUTURA';
    statusTitle = 'INVALIDADO (SEM CONFLUÊNCIA)';
    statusDescription = 'O ativo não atende simultaneamente aos 4 pilares institucionais ou apresenta conflito entre tempos gráficos.';
    badgeColor = 'bg-slate-800 text-slate-400 border-slate-700';
  } else if (isLong) {
    if (takeProfit1 > 0 && currentPrice >= takeProfit1) {
      status = 'TP_ATINGIDO';
      statusTitle = 'ATINGIU TAKE PROFIT (LUCRO CONCLUÍDO)';
      pnlPercent = entryPrice > 0 ? ((currentPrice - entryPrice) / entryPrice) * 100 : 0;
      progressPercent = 100;
      statusDescription = `O preço atingiu o Alvo 1 ($${takeProfit1.toLocaleString()}) com lucro de +${pnlPercent.toFixed(2)}%. Operação concluída ou com trailing stop ativado.`;
      badgeColor = 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300';
    } else if (stopLoss > 0 && currentPrice <= stopLoss) {
      status = 'INVALIDADO_STOP';
      statusTitle = 'INVALIDADO (STOP LOSS ATINGIDO)';
      pnlPercent = entryPrice > 0 ? ((currentPrice - entryPrice) / entryPrice) * 100 : 0;
      progressPercent = 0;
      statusDescription = `O preço rompeu abaixo do Stop Loss técnico em $${stopLoss.toLocaleString()}. A tese compradora foi invalidada e a perda foi estritamente contida no risco fixo.`;
      badgeColor = 'bg-rose-500/20 border-rose-500/50 text-rose-300';
    } else if (currentPrice >= entryPrice) {
      status = 'EM_ANDAMENTO';
      statusTitle = 'EM ANDAMENTO (ATIVO NO MERCADO)';
      pnlPercent = entryPrice > 0 ? ((currentPrice - entryPrice) / entryPrice) * 100 : 0;
      const totalRange = takeProfit1 - entryPrice || 1;
      progressPercent = Math.min(99, Math.max(5, Math.round(((currentPrice - entryPrice) / totalRange) * 100)));
      statusDescription = `Ordem de COMPRA acionada a $${entryPrice.toLocaleString()}! Operação em andamento com ${progressPercent}% do trajeto percorrido até o TP1 ($${takeProfit1.toLocaleString()}).`;
      badgeColor = 'bg-sky-500/20 border-sky-500/50 text-sky-300';
    } else {
      status = 'VALIDO_AGUARDANDO';
      statusTitle = 'VÁLIDO (AGUARDANDO GATILHO)';
      const distPercent = entryPrice > 0 ? Math.max(0, ((entryPrice - currentPrice) / entryPrice) * 100) : 0;
      progressPercent = 0;
      statusDescription = `Setup 100% qualificado pelos 4 pilares. Aguardando rompimento/confirmação do gatilho em $${entryPrice.toLocaleString()} (a ${distPercent.toFixed(2)}% do preço atual).`;
      badgeColor = 'bg-amber-500/20 border-amber-500/50 text-amber-300';
    }
  } else if (isShort) {
    if (takeProfit1 > 0 && currentPrice <= takeProfit1) {
      status = 'TP_ATINGIDO';
      statusTitle = 'ATINGIU TAKE PROFIT (LUCRO CONCLUÍDO)';
      pnlPercent = entryPrice > 0 ? ((entryPrice - currentPrice) / entryPrice) * 100 : 0;
      progressPercent = 100;
      statusDescription = `O preço atingiu o Alvo 1 de VENDA ($${takeProfit1.toLocaleString()}) com lucro de +${pnlPercent.toFixed(2)}%. Operação vencedora finalizada.`;
      badgeColor = 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300';
    } else if (stopLoss > 0 && currentPrice >= stopLoss) {
      status = 'INVALIDADO_STOP';
      statusTitle = 'INVALIDADO (STOP LOSS ATINGIDO)';
      pnlPercent = entryPrice > 0 ? -((currentPrice - entryPrice) / entryPrice) * 100 : 0;
      progressPercent = 0;
      statusDescription = `O preço rompeu acima do Stop Loss de proteção em $${stopLoss.toLocaleString()}. A tese vendedora foi invalidada.`;
      badgeColor = 'bg-rose-500/20 border-rose-500/50 text-rose-300';
    } else if (currentPrice <= entryPrice) {
      status = 'EM_ANDAMENTO';
      statusTitle = 'EM ANDAMENTO (ATIVO NO MERCADO)';
      pnlPercent = entryPrice > 0 ? ((entryPrice - currentPrice) / entryPrice) * 100 : 0;
      const totalRange = entryPrice - takeProfit1 || 1;
      progressPercent = Math.min(99, Math.max(5, Math.round(((entryPrice - currentPrice) / totalRange) * 100)));
      statusDescription = `Ordem de VENDA acionada a $${entryPrice.toLocaleString()}! Operação em andamento com ${progressPercent}% do trajeto até o TP1 ($${takeProfit1.toLocaleString()}).`;
      badgeColor = 'bg-sky-500/20 border-sky-500/50 text-sky-300';
    } else {
      status = 'VALIDO_AGUARDANDO';
      statusTitle = 'VÁLIDO (AGUARDANDO GATILHO)';
      const distPercent = entryPrice > 0 ? Math.max(0, ((currentPrice - entryPrice) / entryPrice) * 100) : 0;
      progressPercent = 0;
      statusDescription = `Setup vendedora 100% qualificado. Aguardando perda do suporte/gatilho em $${entryPrice.toLocaleString()} (a ${distPercent.toFixed(2)}% do preço atual).`;
      badgeColor = 'bg-amber-500/20 border-amber-500/50 text-amber-300';
    }
  }

  const safePnl = isNaN(pnlPercent) || !isFinite(pnlPercent) ? 0 : pnlPercent;

  return (
    <div 
      id="trade-lifecycle-status-card"
      className="bg-slate-900/95 border border-slate-800 rounded-xl p-4 shadow-md font-mono"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800/80">
        <div className="flex items-center gap-2.5">
          <div className={`p-2 rounded-lg border ${badgeColor}`}>
            {status === 'TP_ATINGIDO' && <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
            {status === 'EM_ANDAMENTO' && <Zap className="w-5 h-5 text-sky-400 animate-pulse" />}
            {status === 'VALIDO_AGUARDANDO' && <Clock className="w-5 h-5 text-amber-400" />}
            {(status === 'INVALIDADO_STOP' || status === 'INVALIDADO_ESTRUTURA') && (
              <XCircle className="w-5 h-5 text-rose-400" />
            )}
          </div>

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`px-2 py-0.5 rounded-full text-xs font-bold border ${badgeColor}`}>
                {statusTitle}
              </span>
              <span className="text-white font-bold text-xs">
                {signal.symbol} ({signal.name})
              </span>
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5 font-sans">
              Monitoramento dinâmico de validade de trade em tempo real
            </div>
          </div>
        </div>

        {/* Live PnL or Distance */}
        <div className="flex items-center gap-3">
          {status === 'EM_ANDAMENTO' && (
            <div className="text-right">
              <div className="text-[10px] text-slate-400 uppercase">PnL em Andamento</div>
              <div className={`text-sm font-bold ${safePnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {safePnl >= 0 ? `+${safePnl.toFixed(2)}%` : `${safePnl.toFixed(2)}%`}
              </div>
            </div>
          )}

          {status === 'TP_ATINGIDO' && (
            <div className="text-right">
              <div className="text-[10px] text-emerald-400 uppercase font-bold">Ganho Realizado</div>
              <div className="text-sm font-bold text-emerald-400">
                +{safePnl.toFixed(2)}%
              </div>
            </div>
          )}

          {status === 'VALIDO_AGUARDANDO' && (
            <div className="text-right">
              <div className="text-[10px] text-amber-400 uppercase font-bold">Status do Gatilho</div>
              <div className="text-xs font-bold text-amber-300">
                Aguardando Entrada
              </div>
            </div>
          )}

          {onOpenRiskCalc && (
            <button
              onClick={onOpenRiskCalc}
              className="px-2.5 py-1 rounded bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-medium transition"
            >
              Calculadora
            </button>
          )}
        </div>
      </div>

      {/* Description */}
      <div className="mt-3 text-xs text-slate-300 font-sans leading-relaxed bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/60">
        {statusDescription}
      </div>

      {/* Execution Stepper / Progress */}
      <div className="mt-3.5">
        <div className="flex items-center justify-between text-[11px] font-mono mb-1.5">
          <span className="text-slate-400 flex items-center gap-1">
            <span className="text-rose-400 font-bold">Stop:</span>
            <span>${formatPriceVal(stopLoss)}</span>
          </span>

          <span className="text-slate-300 flex items-center gap-1 font-bold">
            <span className="text-sky-400">Entrada:</span>
            <span>${formatPriceVal(entryPrice)}</span>
          </span>

          <span className="text-slate-400 flex items-center gap-1">
            <span className="text-emerald-400 font-bold">TP1:</span>
            <span>${formatPriceVal(takeProfit1)}</span>
          </span>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-slate-950 h-2.5 rounded-full overflow-hidden border border-slate-800 relative">
          <div 
            className={`h-full transition-all duration-500 rounded-full ${
              status === 'TP_ATINGIDO' 
                ? 'bg-emerald-400' 
                : status === 'INVALIDADO_STOP' 
                ? 'bg-rose-500' 
                : status === 'EM_ANDAMENTO' 
                ? 'bg-sky-400' 
                : 'bg-amber-400/50'
            }`}
            style={{ width: `${Math.max(5, progressPercent)}%` }}
          />
        </div>

        {/* Four-stage stepper */}
        <div className="grid grid-cols-4 gap-1.5 mt-2.5 text-[10px] font-mono text-center">
          <div className={`p-1 rounded border ${passedFilter ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300 font-semibold' : 'bg-slate-950 border-slate-800 text-slate-500'}`}>
            1. Confluência 4P
          </div>
          <div className={`p-1 rounded border ${status !== 'INVALIDADO_ESTRUTURA' ? 'bg-amber-500/10 border-amber-500/30 text-amber-300 font-semibold' : 'bg-slate-950 border-slate-800 text-slate-500'}`}>
            2. Gatilho Armado
          </div>
          <div className={`p-1 rounded border ${status === 'EM_ANDAMENTO' || status === 'TP_ATINGIDO' ? 'bg-sky-500/10 border-sky-500/30 text-sky-300 font-semibold' : 'bg-slate-950 border-slate-800 text-slate-500'}`}>
            3. Em Andamento
          </div>
          <div className={`p-1 rounded border ${status === 'TP_ATINGIDO' ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300 font-bold' : status === 'INVALIDADO_STOP' ? 'bg-rose-500/20 border-rose-500/40 text-rose-300 font-bold' : 'bg-slate-950 border-slate-800 text-slate-500'}`}>
            4. {status === 'TP_ATINGIDO' ? 'Lucro TP1' : status === 'INVALIDADO_STOP' ? 'Stop Contido' : 'Conclusão'}
          </div>
        </div>
      </div>
    </div>
  );
};
