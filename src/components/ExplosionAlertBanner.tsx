import React from 'react';
import { 
  Flame, 
  Zap, 
  Volume2, 
  ArrowUpRight, 
  X, 
  Radio, 
  AlertTriangle,
  ChevronRight,
  ShieldAlert,
  Percent
} from 'lucide-react';
import { TradeSignal } from '../types';
import { testAudioAlert, playSignalAlert } from '../utils/audioAlert';

interface ExplosionAlertBannerProps {
  explosiveSignals: TradeSignal[];
  onSelectSignal: (signal: TradeSignal) => void;
  onDismiss?: () => void;
}

export const ExplosionAlertBanner: React.FC<ExplosionAlertBannerProps> = ({
  explosiveSignals,
  onSelectSignal,
  onDismiss,
}) => {
  if (!explosiveSignals || explosiveSignals.length === 0) return null;

  // Pick top explosive asset
  const topSignal = explosiveSignals[0];
  const sq = topSignal.squeezeBreakout;
  const isFired = sq?.state === 'IGNICAO_DISPARADA' || topSignal.change24h >= 6.0;

  const handlePlayAlarm = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Directly test/play explosion siren
    testAudioAlert('EXPLOSION_SIREN');
  };

  return (
    <div 
      id="banner-explosion-alert"
      className={`relative overflow-hidden rounded-xl border-2 p-3 sm:p-4 shadow-xl transition-all ${
        isFired 
          ? 'bg-gradient-to-r from-rose-950 via-slate-950 to-amber-950/80 border-rose-500/80 shadow-rose-950/50' 
          : 'bg-gradient-to-r from-amber-950/90 via-slate-950 to-slate-900 border-amber-500/80 shadow-amber-950/40'
      }`}
    >
      {/* Background Animated Scanline Pulse */}
      <div className="absolute inset-0 bg-repeat bg-center opacity-10 pointer-events-none mix-blend-overlay"></div>
      <div className={`absolute top-0 left-0 right-0 h-1 ${isFired ? 'bg-rose-500 animate-pulse' : 'bg-amber-400'}`}></div>

      <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-3 font-mono">
        {/* Left: Icon & High-Impact Headline */}
        <div className="flex items-start sm:items-center gap-3">
          <div className={`p-2.5 rounded-xl border shadow-lg shrink-0 ${
            isFired 
              ? 'bg-rose-500/25 border-rose-400 text-rose-300 animate-bounce' 
              : 'bg-amber-500/25 border-amber-400 text-amber-300 animate-pulse'
          }`}>
            {isFired ? <Flame className="w-6 h-6" /> : <Zap className="w-6 h-6" />}
          </div>

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`px-2 py-0.5 rounded text-[11px] font-extrabold uppercase tracking-wider border shadow-sm ${
                isFired 
                  ? 'bg-rose-500 text-white border-rose-400 animate-pulse' 
                  : 'bg-amber-500 text-slate-950 border-amber-400 font-black'
              }`}>
                {isFired ? '🚨 ALERTA: DISPARO DE EXPLOSÃO 8%+' : '⚡ RADAR: COMPRESSÃO SQUEEZE MÁXIMA'}
              </span>

              <span className="text-white font-black text-sm sm:text-base tracking-wide flex items-center gap-1">
                {topSignal.symbol}
                <span className="text-[10px] text-slate-400 font-normal">
                  (#{topSignal.marketCapRank || 1})
                </span>
              </span>

              <span className="px-1.5 py-0.2 rounded bg-slate-800 text-emerald-400 text-[11px] font-bold border border-slate-700">
                Score: {sq?.explosionScore || 92}%
              </span>
            </div>

            <p className="text-xs text-slate-200 font-sans mt-1 leading-relaxed">
              {isFired ? (
                <span>
                  <strong className="text-rose-400 font-semibold">Bandas de Bollinger romperam o Canal Keltner!</strong> O ativo iniciou expansão institucional. Alvo projetado de <strong className="text-emerald-400 font-bold">+8.2%</strong> (${sq?.estimatedTarget8Pct?.toLocaleString()}) a <strong className="text-emerald-300 font-bold">+15.4%</strong> (${sq?.estimatedTarget15Pct?.toLocaleString()}).
                </span>
              ) : (
                <span>
                  <strong className="text-amber-400 font-semibold">Mola comprimida há {sq?.squeezeBarsCount || 6} barras.</strong> Volatilidade mínima histórica (BandWidth: {sq?.bollingerBandWidth || '2.8'}%). Combustível Short Squeeze: <strong className="text-sky-300">{sq?.shortSqueezeRisk || 'ALTO'}</strong>.
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Right: Quick Action Controls */}
        <div className="flex items-center gap-2 self-end md:self-center shrink-0 flex-wrap">
          {/* Sound Alarm Test/Trigger Button */}
          <button
            id="btn-trigger-explosion-audio"
            onClick={handlePlayAlarm}
            className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-amber-300 hover:text-amber-200 text-xs font-semibold transition flex items-center gap-1.5 shadow-sm active:scale-95"
            title="Tocar Sirene de Explosão / Testar Som"
          >
            <Volume2 className="w-4 h-4 text-amber-400 animate-pulse" />
            <span>Tocar Alarme Sonoro</span>
          </button>

          {/* Direct Graph Inspection Button */}
          <button
            id="btn-inspect-explosion-asset"
            onClick={() => onSelectSignal(topSignal)}
            className={`px-3.5 py-1.5 rounded-lg font-bold text-xs transition flex items-center gap-1.5 shadow-lg active:scale-95 ${
              isFired 
                ? 'bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-400 hover:to-rose-500 text-white' 
                : 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950'
            }`}
          >
            <span>Analisar Setup no Gráfico</span>
            <ChevronRight className="w-4 h-4" />
          </button>

          {onDismiss && (
            <button
              onClick={onDismiss}
              className="p-1 text-slate-500 hover:text-slate-300 transition rounded"
              title="Fechar alerta"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
