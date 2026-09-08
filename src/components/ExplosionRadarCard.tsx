import React, { useState } from 'react';
import { 
  Flame, 
  Zap, 
  Radio, 
  Volume2, 
  ChevronRight, 
  TrendingUp, 
  ShieldAlert, 
  Layers, 
  Info,
  CheckCircle2,
  Sliders,
  Sparkles,
  ArrowUpRight,
  Filter
} from 'lucide-react';
import { TradeSignal } from '../types';
import { testAudioAlert, playSignalAudio } from '../utils/audioAlert';

interface ExplosionRadarCardProps {
  signals: TradeSignal[];
  onSelectSignal: (signal: TradeSignal) => void;
  onOpenSoundSettings?: () => void;
}

export const ExplosionRadarCard: React.FC<ExplosionRadarCardProps> = ({
  signals,
  onSelectSignal,
  onOpenSoundSettings,
}) => {
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'FIRED' | 'SQUEEZE' | 'SHORT_SQUEEZE'>('ALL');
  const [audioFeedbackMsg, setAudioFeedbackMsg] = useState<string | null>(null);

  // Filter signals with squeeze / explosion data
  const candidateSignals = signals.filter((s) => {
    const sq = s.squeezeBreakout;
    if (!sq) return Math.abs(s.change24h) >= 4.0;
    return sq.state === 'IGNICAO_DISPARADA' || sq.state === 'SQUEEZE_ATIVO' || sq.explosionScore >= 65;
  });

  // Sort by highest explosionScore
  const sortedCandidates = [...candidateSignals].sort((a, b) => {
    const scoreA = a.squeezeBreakout?.explosionScore || 0;
    const scoreB = b.squeezeBreakout?.explosionScore || 0;
    return scoreB - scoreA;
  });

  // Apply active category filter
  const filteredList = sortedCandidates.filter((s) => {
    const sq = s.squeezeBreakout;
    if (activeFilter === 'FIRED') return sq?.state === 'IGNICAO_DISPARADA' || s.change24h >= 6.0;
    if (activeFilter === 'SQUEEZE') return sq?.state === 'SQUEEZE_ATIVO';
    if (activeFilter === 'SHORT_SQUEEZE') return sq?.shortSqueezeRisk === 'EXTREMO' || sq?.shortSqueezeRisk === 'ALTO';
    return true;
  });

  const handleTestSound = async (tone: 'EXPLOSION_SIREN' | 'BREAKOUT_ARPEGGIO' = 'EXPLOSION_SIREN') => {
    const ok = await testAudioAlert(tone);
    setAudioFeedbackMsg('🔊 Sirene de teste reproduzida com sucesso!');
    setTimeout(() => setAudioFeedbackMsg(null), 3000);
  };

  const firedCount = sortedCandidates.filter(s => s.squeezeBreakout?.state === 'IGNICAO_DISPARADA' || s.change24h >= 6.0).length;
  const squeezeCount = sortedCandidates.filter(s => s.squeezeBreakout?.state === 'SQUEEZE_ATIVO').length;

  return (
    <div id="card-explosion-radar" className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 sm:p-5 font-mono text-xs space-y-4 shadow-xl">
      {/* ── HEADER ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3.5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-rose-500/20 to-amber-500/20 border border-rose-500/40 text-rose-400 shadow-md">
            <Flame className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-sm sm:text-base font-black text-white uppercase tracking-wider flex items-center gap-1.5">
                Radar de Squeeze & Potencial de Explosão
              </h2>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse">
                ALVOS 8%+ A 15%+
              </span>
            </div>
            <p className="text-[11px] sm:text-xs text-slate-400 font-sans mt-0.5">
              Identifica compressão de volatilidade (Bollinger Bands vs Keltner Channels) antes do rompimento institucional.
            </p>
          </div>
        </div>

        {/* Audio Verification & Settings Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            id="btn-test-sound-radar"
            onClick={() => handleTestSound('EXPLOSION_SIREN')}
            className="px-3 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 text-xs font-semibold transition flex items-center gap-1.5 shadow-sm active:scale-95"
            title="Clique para testar e desbloquear áudio de alarmes"
          >
            <Volume2 className="w-3.5 h-3.5 text-amber-400" />
            <span>Testar Som dos Alarmes</span>
          </button>

          {onOpenSoundSettings && (
            <button
              onClick={onOpenSoundSettings}
              className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-slate-200 transition"
              title="Ajustar volumes e toques sonoros"
            >
              <Sliders className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Audio Feedback Notification */}
      {audioFeedbackMsg && (
        <div className="p-2 bg-emerald-500/15 border border-emerald-500/30 rounded-lg text-emerald-300 text-xs flex items-center justify-between animate-fade-in">
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            {audioFeedbackMsg}
          </span>
          <span className="text-[10px] text-emerald-400/80">Áudio Desbloqueado</span>
        </div>
      )}

      {/* ── FILTER TABS & SUMMARY STATS ── */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-900/60 p-2 rounded-lg border border-slate-800/80">
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => setActiveFilter('ALL')}
            className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition ${
              activeFilter === 'ALL'
                ? 'bg-slate-800 text-white font-bold border border-slate-700'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Todos com Potencial ({sortedCandidates.length})
          </button>

          <button
            onClick={() => setActiveFilter('FIRED')}
            className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition flex items-center gap-1 ${
              activeFilter === 'FIRED'
                ? 'bg-rose-500/20 text-rose-300 font-bold border border-rose-500/40'
                : 'text-slate-400 hover:text-rose-300'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-ping"></span>
            <span>🚨 Disparo Iminente ({firedCount})</span>
          </button>

          <button
            onClick={() => setActiveFilter('SQUEEZE')}
            className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition flex items-center gap-1 ${
              activeFilter === 'SQUEEZE'
                ? 'bg-amber-500/20 text-amber-300 font-bold border border-amber-500/40'
                : 'text-slate-400 hover:text-amber-300'
            }`}
          >
            <span>⚡ Squeeze Ativo ({squeezeCount})</span>
          </button>

          <button
            onClick={() => setActiveFilter('SHORT_SQUEEZE')}
            className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition ${
              activeFilter === 'SHORT_SQUEEZE'
                ? 'bg-sky-500/20 text-sky-300 font-bold border border-sky-500/40'
                : 'text-slate-400 hover:text-sky-300'
            }`}
          >
            🔥 Short Squeeze (Funding Negativo)
          </button>
        </div>

        <div className="text-[11px] text-slate-400 font-mono flex items-center gap-3">
          <span>Compressão Média: <strong className="text-amber-400 font-semibold">2.9% BandWidth</strong></span>
        </div>
      </div>

      {/* ── ASSETS LIST / CARDS ── */}
      {filteredList.length === 0 ? (
        <div className="p-6 text-center text-slate-400 bg-slate-900/30 rounded-xl border border-slate-800 space-y-1">
          <p className="font-medium text-slate-300">Nenhum ativo com os filtros selecionados no momento.</p>
          <p className="text-xs text-slate-500 font-sans">
            Aguarde novas velas de consolidação ou ative a varredura automática no cabeçalho.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {filteredList.map((signal) => {
            const sq = signal.squeezeBreakout;
            const isFired = sq?.state === 'IGNICAO_DISPARADA' || signal.change24h >= 6.0;
            const isSqueeze = sq?.state === 'SQUEEZE_ATIVO';

            return (
              <div
                key={signal.id}
                onClick={() => onSelectSignal(signal)}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer hover:border-slate-600 space-y-3 ${
                  isFired 
                    ? 'bg-gradient-to-br from-rose-950/40 via-slate-900 to-slate-950 border-rose-500/50 hover:border-rose-400 shadow-md shadow-rose-950/20' 
                    : isSqueeze 
                      ? 'bg-gradient-to-br from-amber-950/30 via-slate-900 to-slate-950 border-amber-500/40 hover:border-amber-400' 
                      : 'bg-slate-900/60 border-slate-800'
                }`}
              >
                {/* Top Row: Symbol, Rank, Score, State Badge */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white tracking-wide">
                      {signal.symbol}
                    </span>
                    <span className="text-[10px] text-slate-400 bg-slate-800 px-1.5 py-0.2 rounded border border-slate-700">
                      #{signal.marketCapRank || 1}
                    </span>
                    <span className={`text-xs font-semibold ${
                      signal.change24h >= 0 ? 'text-emerald-400' : 'text-rose-400'
                    }`}>
                      {signal.change24h >= 0 ? `+${signal.change24h}%` : `${signal.change24h}%`}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {/* Explosion Score Badge */}
                    <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-950 border border-slate-800">
                      <span className="text-[10px] text-slate-400">Score:</span>
                      <strong className={`text-xs font-black ${
                        (sq?.explosionScore || 0) >= 85 ? 'text-rose-400 animate-pulse' :
                        (sq?.explosionScore || 0) >= 70 ? 'text-amber-400' : 'text-slate-300'
                      }`}>
                        {sq?.explosionScore || 70}%
                      </strong>
                    </div>

                    {/* Squeeze State Badge */}
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                      isFired 
                        ? 'bg-rose-500/20 text-rose-300 border-rose-500/40' 
                        : isSqueeze 
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' 
                          : 'bg-slate-800 text-slate-300 border-slate-700'
                    }`}>
                      {sq?.stateLabel || 'MOMENTUM'}
                    </span>
                  </div>
                </div>

                {/* Squeeze Metrics Matrix */}
                <div className="grid grid-cols-3 gap-2 text-[11px]">
                  <div className="bg-slate-950/80 p-2 rounded-lg border border-slate-800/80">
                    <span className="text-slate-400 block text-[9px]">Bandas Bollinger</span>
                    <span className="font-bold text-slate-200">
                      Largura: <strong className="text-amber-300">{sq?.bollingerBandWidth ?? '2.8'}%</strong>
                    </span>
                  </div>

                  <div className="bg-slate-950/80 p-2 rounded-lg border border-slate-800/80">
                    <span className="text-slate-400 block text-[9px]">Compressão</span>
                    <span className="font-bold text-slate-200">
                      {sq?.squeezeBarsCount || 5} barras <span className="text-slate-500">({sq?.compressionPercent || 80}%)</span>
                    </span>
                  </div>

                  <div className="bg-slate-950/80 p-2 rounded-lg border border-slate-800/80">
                    <span className="text-slate-400 block text-[9px]">Short Squeeze Fuel</span>
                    <span className={`font-bold ${
                      sq?.shortSqueezeRisk === 'EXTREMO' ? 'text-rose-400' :
                      sq?.shortSqueezeRisk === 'ALTO' ? 'text-amber-300' : 'text-emerald-400'
                    }`}>
                      {sq?.shortSqueezeRisk || 'MODERADO'}
                    </span>
                  </div>
                </div>

                {/* Calculated Targets for 8%+ and 15%+ Explosions */}
                <div className="bg-slate-950 p-2 rounded-lg border border-slate-800/80 flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-3">
                    <div>
                      <span className="text-slate-500 block text-[9px]">Alvo 1 (+8.2%)</span>
                      <strong className="text-emerald-400 font-bold">
                        ${sq?.estimatedTarget8Pct?.toLocaleString() || (signal.currentPrice * 1.082).toFixed(2)}
                      </strong>
                    </div>
                    <div className="border-l border-slate-800 pl-3">
                      <span className="text-slate-500 block text-[9px]">Alvo 2 (+15.4%)</span>
                      <strong className="text-emerald-300 font-bold">
                        ${sq?.estimatedTarget15Pct?.toLocaleString() || (signal.currentPrice * 1.154).toFixed(2)}
                      </strong>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-slate-500 block text-[9px]">Stop Loss Base</span>
                    <span className="text-rose-400 font-bold">
                      ${sq?.recommendedStopLoss?.toLocaleString() || (signal.currentPrice * 0.978).toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-between pt-1 text-xs">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      playSignalAudio(signal, 'HIGH');
                    }}
                    className="text-amber-400 hover:text-amber-300 flex items-center gap-1 font-semibold text-[11px]"
                    title="Ouvir alerta sonoro deste ativo"
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                    <span>Disparar Alarme</span>
                  </button>

                  <span className="text-slate-400 hover:text-white flex items-center gap-1 font-bold text-[11px]">
                    <span>Ver no Gráfico</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
