import React from 'react';
import { 
  AlertTriangle, 
  Zap, 
  X, 
  ShieldAlert, 
  Activity, 
  TrendingUp, 
  Volume2, 
  CheckCircle,
  BellOff,
  Sliders
} from 'lucide-react';
import { VolatilityAnomalyStats, ChartTimeframe, getTimeframeMeta } from '../utils/technicalAnalysis';

interface VolatilityAlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  symbol: string;
  timeframe: ChartTimeframe;
  stats: VolatilityAnomalyStats;
  isAlertEnabled: boolean;
  onToggleAlertEnabled: () => void;
  onSnoozeSymbol?: (symbol: string) => void;
}

export const VolatilityAlertModal: React.FC<VolatilityAlertModalProps> = ({
  isOpen,
  onClose,
  symbol,
  timeframe,
  stats,
  isAlertEnabled,
  onToggleAlertEnabled,
  onSnoozeSymbol,
}) => {
  if (!isOpen) return null;

  const tfMeta = getTimeframeMeta(timeframe);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div 
        id="volatility-surge-popup"
        className="bg-slate-900 border-2 border-rose-500/80 rounded-2xl max-w-xl w-full overflow-hidden shadow-2xl shadow-rose-950/40 relative"
      >
        {/* Top Warning Ribbon */}
        <div className="bg-gradient-to-r from-rose-600 via-rose-500 to-amber-500 px-4 py-2 text-slate-950 font-mono text-xs font-bold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-slate-950 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-slate-950"></span>
            </span>
            <span className="tracking-wide uppercase">Alerta Automático de Volatilidade Extrema (+2σ)</span>
          </div>
          <span className="bg-slate-950 text-rose-300 px-2 py-0.5 rounded text-[11px] font-bold">
            Z-Score: +{stats.zScore}σ
          </span>
        </div>

        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 bg-slate-950/70 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 shrink-0">
              <AlertTriangle className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold font-mono text-white flex items-center gap-2">
                <span>{symbol}</span>
                <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-amber-300 border border-slate-700 font-medium">
                  {tfMeta.label} ({tfMeta.fullName})
                </span>
              </h2>
              <p className="text-xs text-rose-300/90 font-mono mt-0.5">
                Range do candle superou a média histórica (14p) em +{stats.zScore} desvios padrão
              </p>
            </div>
          </div>

          <button
            id="btn-close-volatility-popup"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            title="Fechar aviso"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 space-y-4 font-mono text-xs">
          {/* Key Metrics Comparison Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
            <div className="p-2.5 bg-rose-950/30 border border-rose-500/40 rounded-xl">
              <span className="text-[10px] text-rose-400 block uppercase">Volatilidade Atual</span>
              <span className="text-base sm:text-lg font-bold text-rose-200">
                {stats.currentPeriodVolatility}%
              </span>
              <span className="text-[10px] text-rose-300 block">Range do candle</span>
            </div>

            <div className="p-2.5 bg-slate-950 border border-slate-800 rounded-xl">
              <span className="text-[10px] text-slate-400 block uppercase">Média Histórica (14p)</span>
              <span className="text-base sm:text-lg font-bold text-slate-200">
                {stats.historicalMean14}%
              </span>
              <span className="text-[10px] text-slate-500 block">μ (14 períodos)</span>
            </div>

            <div className="p-2.5 bg-slate-950 border border-slate-800 rounded-xl">
              <span className="text-[10px] text-slate-400 block uppercase">Desvio Padrão</span>
              <span className="text-base sm:text-lg font-bold text-amber-300">
                ±{stats.historicalStdDev14}%
              </span>
              <span className="text-[10px] text-slate-500 block">σ (Sigma)</span>
            </div>

            <div className="p-2.5 bg-slate-950 border border-slate-800 rounded-xl">
              <span className="text-[10px] text-slate-400 block uppercase">Gatilho Crítico 2σ</span>
              <span className="text-base sm:text-lg font-bold text-emerald-400">
                {stats.threshold2Sigma}%
              </span>
              <span className="text-[10px] text-slate-500 block">μ + 2σ</span>
            </div>
          </div>

          {/* Graphical Volatility Surge Bar Indicator */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-3">
            <div className="flex items-center justify-between text-[11px] mb-1.5">
              <span className="text-slate-400 flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-rose-400" />
                <span>Magnitude do Salto de Volatilidade:</span>
              </span>
              <span className="text-rose-400 font-bold">
                {stats.ratioVsMean}x acima da média
              </span>
            </div>
            <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden relative">
              <div 
                className="bg-gradient-to-r from-emerald-500 via-amber-500 to-rose-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, (stats.currentPeriodVolatility / (stats.threshold2Sigma * 1.5)) * 100)}%` }}
              />
              <div 
                className="absolute top-0 bottom-0 w-0.5 bg-white shadow"
                style={{ left: `${(stats.threshold2Sigma / (stats.threshold2Sigma * 1.5)) * 100}%` }}
                title="Linha do Limiar 2σ"
              />
            </div>
            <div className="flex justify-between text-[9px] text-slate-500 mt-1">
              <span>0% (Calmaria)</span>
              <span className="text-amber-400 font-semibold">Limiar 2σ ({stats.threshold2Sigma}%)</span>
              <span className="text-rose-400 font-semibold">Extremo (+2σ)</span>
            </div>
          </div>

          {/* Institutional Risk Warning Details */}
          <div className="bg-rose-950/20 border border-rose-500/30 rounded-xl p-3.5 text-xs font-sans text-slate-300 space-y-2">
            <div className="flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-rose-300 font-mono text-xs block">
                  Diretriz Quantitativa Institucional:
                </strong>
                <p className="text-[12px] text-slate-300 leading-relaxed mt-0.5">
                  A volatilidade excedeu 2 desvios padrão em relação aos 14 períodos anteriores. 
                  Momentos de expansão anormal aumentam o risco de <strong>slippage elevado</strong>, 
                  <strong>captura violenta de liquidez (stop-hunts)</strong> e <strong>alargamento de spread</strong> pelas corretoras.
                </p>
              </div>
            </div>

            <div className="pt-2 border-t border-rose-500/20 text-[11px] font-mono grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className="bg-slate-900/80 p-2 rounded border border-slate-800 text-slate-300">
                <span className="text-amber-400 font-bold block">1. Reduzir Alavancagem</span>
                Evite posições acima de 3x em derivativos durante o surto.
              </div>
              <div className="bg-slate-900/80 p-2 rounded border border-slate-800 text-slate-300">
                <span className="text-sky-400 font-bold block">2. Fechamento de Barra</span>
                Aguarde o fechamento do candle {tfMeta.label} antes de executar.
              </div>
              <div className="bg-slate-900/80 p-2 rounded border border-slate-800 text-slate-300">
                <span className="text-emerald-400 font-bold block">3. Ordens Limite</span>
                Nunca use ordens a mercado (Market Order) nesta faixa.
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer with Toggle & Actions */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex flex-col sm:flex-row items-center justify-between gap-3 font-mono text-xs">
          {/* Option to turn automatic alert ON / OFF */}
          <div className="flex items-center gap-2">
            <button
              id="btn-toggle-volatility-switch-modal"
              onClick={onToggleAlertEnabled}
              className={`px-2.5 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition ${
                isAlertEnabled
                  ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                  : 'bg-slate-800 border-slate-700 text-slate-400'
              }`}
            >
              <Zap className={`w-3.5 h-3.5 ${isAlertEnabled ? 'text-emerald-400' : 'text-slate-500'}`} />
              <span>Alerta Automático: {isAlertEnabled ? 'LIGADO' : 'DESLIGADO'}</span>
            </button>
            <span className="text-[10px] text-slate-500 hidden md:inline">
              (Configuração persistida)
            </span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            {onSnoozeSymbol && (
              <button
                id="btn-snooze-symbol-alert"
                onClick={() => {
                  onSnoozeSymbol(symbol);
                  onClose();
                }}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition flex items-center gap-1 text-xs"
              >
                <BellOff className="w-3.5 h-3.5 text-slate-400" />
                <span>Silenciar {symbol}</span>
              </button>
            )}

            <button
              id="btn-confirm-volatility-alert"
              onClick={onClose}
              className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg transition shadow-sm flex items-center gap-1 text-xs"
            >
              <CheckCircle className="w-3.5 h-3.5" />
              <span>Entendido (Fechar)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
