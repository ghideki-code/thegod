import React, { useState } from 'react';
import { 
  X, 
  Volume2, 
  VolumeX, 
  Volume1, 
  Play, 
  RotateCcw, 
  Check, 
  Sliders, 
  Zap, 
  TrendingUp, 
  RotateCw, 
  AlertTriangle, 
  Radio, 
  Info,
  Sparkles,
  ShieldCheck,
  Flame
} from 'lucide-react';
import { 
  AppAudioSettings, 
  SoundToneId, 
  TONE_OPTIONS, 
  playTone, 
  saveAudioSettings, 
  resetAudioSettings,
  testAudioAlert 
} from '../utils/audioAlert';

interface SoundSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  audioSettings: AppAudioSettings;
  onUpdateAudioSettings: (newSettings: AppAudioSettings) => void;
}

export const SoundSettingsModal: React.FC<SoundSettingsModalProps> = ({
  isOpen,
  onClose,
  audioSettings,
  onUpdateAudioSettings,
}) => {
  const [settings, setSettings] = useState<AppAudioSettings>(audioSettings);
  const [activePreviewTone, setActivePreviewTone] = useState<SoundToneId | null>(null);
  const [showSavedNotification, setShowSavedNotification] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleUpdate = (updated: AppAudioSettings) => {
    setSettings(updated);
    onUpdateAudioSettings(updated);
    saveAudioSettings(updated);
  };

  const handlePreviewTone = (toneId: SoundToneId, volumeLevel: number = 1.0) => {
    setActivePreviewTone(toneId);
    playTone(toneId, settings.masterVolume * volumeLevel);
    setTimeout(() => {
      setActivePreviewTone(null);
    }, 600);
  };

  const handleResetDefaults = () => {
    const defaults = resetAudioSettings();
    setSettings(defaults);
    onUpdateAudioSettings(defaults);
    setShowSavedNotification(true);
    setTimeout(() => setShowSavedNotification(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div 
        className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] text-slate-100 animate-fadeIn"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800/80 bg-slate-950/90 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-white font-mono">
                  Sons & Alertas Institucionais
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-semibold">
                  Web Audio Synthesizer
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Personalize timbres e frequências para cada tipo de sinal e nível de prioridade.
              </p>
            </div>
          </div>

          <button
            id="btn-close-sound-modal"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 text-xs">
          {/* Master Audio & Volume Control Card */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
              <div className="flex items-center gap-2.5">
                <button
                  id="btn-toggle-master-sound"
                  onClick={() => handleUpdate({ ...settings, masterEnabled: !settings.masterEnabled })}
                  className={`p-2 rounded-lg border transition ${
                    settings.masterEnabled
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                      : 'bg-slate-800 text-slate-500 border-slate-700'
                  }`}
                  title={settings.masterEnabled ? 'Desativar som geral' : 'Ativar som geral'}
                >
                  {settings.masterEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
                </button>
                <div>
                  <div className="font-mono font-bold text-white flex items-center gap-2">
                    <span>Sistema de Áudio do Terminal</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${settings.masterEnabled ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                      {settings.masterEnabled ? 'ATIVO' : 'MUTADO'}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400">
                    Controla a emissão de bips sonoros e sinos harmônicos em tempo real.
                  </span>
                </div>
              </div>

              {/* Master Volume Slider */}
              <div className="flex items-center gap-2.5 sm:w-60">
                <Volume1 className="w-4 h-4 text-slate-400 shrink-0" />
                <input
                  type="range"
                  min="0.05"
                  max="1.0"
                  step="0.05"
                  disabled={!settings.masterEnabled}
                  value={settings.masterVolume}
                  onChange={(e) => handleUpdate({ ...settings, masterVolume: parseFloat(e.target.value) })}
                  className="w-full accent-amber-400 cursor-pointer disabled:opacity-40"
                />
                <span className="font-mono text-slate-300 w-10 text-right">
                  {Math.round(settings.masterVolume * 100)}%
                </span>
              </div>
            </div>

            {/* Direct Instant Audio Test Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-2 p-2.5 bg-slate-900/90 rounded-lg border border-amber-500/30">
              <span className="text-[11px] text-slate-300 font-sans flex items-center gap-1.5">
                <Volume2 className="w-4 h-4 text-amber-400 shrink-0 animate-pulse" />
                <span>O navegador bloqueia som até o primeiro clique. Teste e desbloqueie aqui:</span>
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => testAudioAlert('EXPLOSION_SIREN')}
                  className="px-3 py-1 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 rounded-md font-mono text-[11px] font-bold transition flex items-center gap-1.5 active:scale-95 shadow-sm"
                >
                  <Flame className="w-3.5 h-3.5 text-rose-400" />
                  <span>Sirene de Explosão</span>
                </button>
                <button
                  type="button"
                  onClick={() => testAudioAlert('BREAKOUT_ARPEGGIO')}
                  className="px-3 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-md font-mono text-[11px] font-bold transition flex items-center gap-1.5 active:scale-95 shadow-sm"
                >
                  <Zap className="w-3.5 h-3.5 text-amber-400" />
                  <span>Arpejo Breakout</span>
                </button>
              </div>
            </div>

            {/* High Priority vs Informative Volume Split */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              {/* High Priority Volume */}
              <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-amber-400 flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5" />
                    Ganho de Alta Prioridade
                  </span>
                  <span className="font-mono font-bold text-slate-200">
                    {Math.round(settings.highPriorityVolume * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="1.0"
                  step="0.05"
                  disabled={!settings.masterEnabled}
                  value={settings.highPriorityVolume}
                  onChange={(e) => handleUpdate({ ...settings, highPriorityVolume: parseFloat(e.target.value) })}
                  className="w-full accent-amber-400 cursor-pointer disabled:opacity-40"
                />
                <p className="text-[10px] text-slate-400 leading-tight">
                  Aplicado para setups qualificados God Protocol (≥75% confluência) e rompimentos institucionais.
                </p>
              </div>

              {/* Informative Volume */}
              <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-sky-400 flex items-center gap-1.5">
                    <Radio className="w-3.5 h-3.5" />
                    Ganho de Alertas Informativos
                  </span>
                  <span className="font-mono font-bold text-slate-200">
                    {Math.round(settings.infoVolume * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0.05"
                  max="1.0"
                  step="0.05"
                  disabled={!settings.masterEnabled}
                  value={settings.infoVolume}
                  onChange={(e) => handleUpdate({ ...settings, infoVolume: parseFloat(e.target.value) })}
                  className="w-full accent-sky-400 cursor-pointer disabled:opacity-40"
                />
                <p className="text-[10px] text-slate-400 leading-tight">
                  Aplicado para avisos de rotina, varredura periódica e setups em formação.
                </p>
              </div>
            </div>
          </div>

          {/* SIGNAL TYPES CONFIGURATION SECTION */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-white font-mono uppercase tracking-wider flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Configuração de Tons por Tipo de Sinal</span>
              </h4>
              <span className="text-[11px] text-slate-400 font-mono">
                6 Categorias de Mercado
              </span>
            </div>

            {/* 0. DISPARO DE EXPLOSÃO (BREAKOUT 8%+ & SQUEEZE) */}
            <div className="bg-slate-950 border border-rose-500/50 rounded-xl p-4 space-y-3 shadow-lg shadow-rose-950/30">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-800/80">
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 rounded-lg bg-rose-500/20 text-rose-400 border border-rose-500/40 animate-pulse">
                    <Flame className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-mono font-bold text-white flex items-center gap-2">
                      <span>Disparo de Explosão 8%+ & Squeeze</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 font-mono font-black animate-pulse">
                        🚨 MÁXIMA URGÊNCIA
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-400">
                      Rompimento violento de compressão Keltner/Bollinger e gatilho de ignição para ganhos rápidos.
                    </span>
                  </div>
                </div>

                <label className="flex items-center gap-2 cursor-pointer select-none self-end sm:self-center">
                  <input
                    type="checkbox"
                    checked={settings.explosion?.enabled ?? true}
                    onChange={(e) => handleUpdate({
                      ...settings,
                      explosion: { ...settings.explosion, enabled: e.target.checked }
                    })}
                    className="rounded border-slate-700 bg-slate-900 text-rose-400 focus:ring-0"
                  />
                  <span className={(settings.explosion?.enabled ?? true) ? 'text-rose-300 font-semibold' : 'text-slate-500'}>
                    {(settings.explosion?.enabled ?? true) ? 'Habilitado' : 'Mudo'}
                  </span>
                </label>
              </div>

              {(settings.explosion?.enabled ?? true) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  {/* High Priority Explosion Tone */}
                  <div className="bg-slate-900/70 border border-rose-500/30 rounded-lg p-3 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-rose-400 font-mono font-bold text-[11px] flex items-center gap-1">
                        <Flame className="w-3.5 h-3.5" />
                        Disparo Confirmado (Ignição 8%+)
                      </span>
                      <button
                        onClick={() => handlePreviewTone(settings.explosion?.highPriorityTone || 'EXPLOSION_SIREN', settings.highPriorityVolume)}
                        className={`p-1 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 transition flex items-center gap-1 text-[10px] ${
                          activePreviewTone === settings.explosion?.highPriorityTone ? 'ring-2 ring-rose-400' : ''
                        }`}
                        title="Ouvir sirene"
                      >
                        <Play className="w-3 h-3 fill-current" />
                        <span>Ouvir</span>
                      </button>
                    </div>

                    <select
                      value={settings.explosion?.highPriorityTone || 'EXPLOSION_SIREN'}
                      onChange={(e) => handleUpdate({
                        ...settings,
                        explosion: { ...settings.explosion, highPriorityTone: e.target.value as SoundToneId }
                      })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-rose-400"
                    >
                      {TONE_OPTIONS.map(opt => (
                        <option key={`explosion-high-${opt.id}`} value={opt.id} className="bg-slate-900 text-white">
                          {opt.name} ({opt.badge})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Informative Squeeze Tone */}
                  <div className="bg-slate-900/70 border border-amber-500/20 rounded-lg p-3 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-amber-400 font-mono font-bold text-[11px] flex items-center gap-1">
                        <Zap className="w-3.5 h-3.5" />
                        Compressão Squeeze Ativa
                      </span>
                      <button
                        onClick={() => handlePreviewTone(settings.explosion?.infoTone || 'VOLATILITY_ALERT', settings.infoVolume)}
                        className={`p-1 rounded bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 transition flex items-center gap-1 text-[10px] ${
                          activePreviewTone === settings.explosion?.infoTone ? 'ring-2 ring-amber-400' : ''
                        }`}
                        title="Ouvir tom"
                      >
                        <Play className="w-3 h-3 fill-current" />
                        <span>Ouvir</span>
                      </button>
                    </div>

                    <select
                      value={settings.explosion?.infoTone || 'VOLATILITY_ALERT'}
                      onChange={(e) => handleUpdate({
                        ...settings,
                        explosion: { ...settings.explosion, infoTone: e.target.value as SoundToneId }
                      })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-amber-400"
                    >
                      {TONE_OPTIONS.map(opt => (
                        <option key={`explosion-info-${opt.id}`} value={opt.id} className="bg-slate-900 text-white">
                          {opt.name} ({opt.badge})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>

            {/* 1. BREAKOUT / ROMPIMENTO */}
            <div className="bg-slate-950 border border-slate-800/90 rounded-xl p-4 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-800/80">
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                    <Zap className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-mono font-bold text-white flex items-center gap-2">
                      <span>Rompimento / Breakout</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-mono">
                        Expansão de Volatilidade
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-400">
                      Rompimento de resistências/suportes, figuras de compressão (triângulos/bandeiras) e canais.
                    </span>
                  </div>
                </div>

                <label className="flex items-center gap-2 cursor-pointer self-start sm:self-auto font-mono text-xs">
                  <input
                    type="checkbox"
                    checked={settings.breakout.enabled}
                    onChange={(e) => handleUpdate({
                      ...settings,
                      breakout: { ...settings.breakout, enabled: e.target.checked }
                    })}
                    className="rounded border-slate-700 bg-slate-900 text-amber-400 focus:ring-0"
                  />
                  <span className={settings.breakout.enabled ? 'text-slate-200 font-semibold' : 'text-slate-500'}>
                    {settings.breakout.enabled ? 'Habilitado' : 'Mudo'}
                  </span>
                </label>
              </div>

              {settings.breakout.enabled && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  {/* High Priority Tone */}
                  <div className="bg-slate-900/70 border border-amber-500/20 rounded-lg p-3 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-amber-400 font-mono font-bold text-[11px]">
                        Alta Prioridade (Breakout Confirmado ≥75%)
                      </span>
                      <button
                        onClick={() => handlePreviewTone(settings.breakout.highPriorityTone, settings.highPriorityVolume)}
                        className={`p-1 rounded bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 transition flex items-center gap-1 text-[10px] ${
                          activePreviewTone === settings.breakout.highPriorityTone ? 'ring-2 ring-amber-400' : ''
                        }`}
                        title="Ouvir tom"
                      >
                        <Play className="w-3 h-3 fill-current" />
                        <span>Ouvir</span>
                      </button>
                    </div>

                    <select
                      value={settings.breakout.highPriorityTone}
                      onChange={(e) => handleUpdate({
                        ...settings,
                        breakout: { ...settings.breakout, highPriorityTone: e.target.value as SoundToneId }
                      })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-amber-400"
                    >
                      {TONE_OPTIONS.map(opt => (
                        <option key={`breakout-high-${opt.id}`} value={opt.id} className="bg-slate-900 text-white">
                          {opt.name} ({opt.badge})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Informative Tone */}
                  <div className="bg-slate-900/70 border border-slate-800 rounded-lg p-3 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-sky-400 font-mono font-bold text-[11px]">
                        Informativo (Tentativa / Compressão)
                      </span>
                      <button
                        onClick={() => handlePreviewTone(settings.breakout.infoTone, settings.infoVolume)}
                        className={`p-1 rounded bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 border border-sky-500/30 transition flex items-center gap-1 text-[10px] ${
                          activePreviewTone === settings.breakout.infoTone ? 'ring-2 ring-sky-400' : ''
                        }`}
                        title="Ouvir tom"
                      >
                        <Play className="w-3 h-3 fill-current" />
                        <span>Ouvir</span>
                      </button>
                    </div>

                    <select
                      value={settings.breakout.infoTone}
                      onChange={(e) => handleUpdate({
                        ...settings,
                        breakout: { ...settings.breakout, infoTone: e.target.value as SoundToneId }
                      })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-sky-400"
                    >
                      {TONE_OPTIONS.map(opt => (
                        <option key={`breakout-info-${opt.id}`} value={opt.id} className="bg-slate-900 text-white">
                          {opt.name} ({opt.badge})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>

            {/* 2. REVERSÃO / INVERSÃO DE TENDÊNCIA */}
            <div className="bg-slate-950 border border-slate-800/90 rounded-xl p-4 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-800/80">
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/30">
                    <RotateCw className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-mono font-bold text-white flex items-center gap-2">
                      <span>Reversão / Inversão de Tendência</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 font-mono">
                        SMC Sweep & Wyckoff
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-400">
                      Capturas de liquidez (BSL/SSL), Fundo/Topo Duplo, OCO e fases Spring/UTAD de Wyckoff.
                    </span>
                  </div>
                </div>

                <label className="flex items-center gap-2 cursor-pointer self-start sm:self-auto font-mono text-xs">
                  <input
                    type="checkbox"
                    checked={settings.reversal.enabled}
                    onChange={(e) => handleUpdate({
                      ...settings,
                      reversal: { ...settings.reversal, enabled: e.target.checked }
                    })}
                    className="rounded border-slate-700 bg-slate-900 text-amber-400 focus:ring-0"
                  />
                  <span className={settings.reversal.enabled ? 'text-slate-200 font-semibold' : 'text-slate-500'}>
                    {settings.reversal.enabled ? 'Habilitado' : 'Mudo'}
                  </span>
                </label>
              </div>

              {settings.reversal.enabled && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  {/* High Priority Tone */}
                  <div className="bg-slate-900/70 border border-amber-500/20 rounded-lg p-3 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-amber-400 font-mono font-bold text-[11px]">
                        Alta Prioridade (Reversão Institucional ≥75%)
                      </span>
                      <button
                        onClick={() => handlePreviewTone(settings.reversal.highPriorityTone, settings.highPriorityVolume)}
                        className={`p-1 rounded bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 transition flex items-center gap-1 text-[10px] ${
                          activePreviewTone === settings.reversal.highPriorityTone ? 'ring-2 ring-amber-400' : ''
                        }`}
                        title="Ouvir tom"
                      >
                        <Play className="w-3 h-3 fill-current" />
                        <span>Ouvir</span>
                      </button>
                    </div>

                    <select
                      value={settings.reversal.highPriorityTone}
                      onChange={(e) => handleUpdate({
                        ...settings,
                        reversal: { ...settings.reversal, highPriorityTone: e.target.value as SoundToneId }
                      })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-amber-400"
                    >
                      {TONE_OPTIONS.map(opt => (
                        <option key={`reversal-high-${opt.id}`} value={opt.id} className="bg-slate-900 text-white">
                          {opt.name} ({opt.badge})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Informative Tone */}
                  <div className="bg-slate-900/70 border border-slate-800 rounded-lg p-3 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-sky-400 font-mono font-bold text-[11px]">
                        Informativo (Sweep Preliminar)
                      </span>
                      <button
                        onClick={() => handlePreviewTone(settings.reversal.infoTone, settings.infoVolume)}
                        className={`p-1 rounded bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 border border-sky-500/30 transition flex items-center gap-1 text-[10px] ${
                          activePreviewTone === settings.reversal.infoTone ? 'ring-2 ring-sky-400' : ''
                        }`}
                        title="Ouvir tom"
                      >
                        <Play className="w-3 h-3 fill-current" />
                        <span>Ouvir</span>
                      </button>
                    </div>

                    <select
                      value={settings.reversal.infoTone}
                      onChange={(e) => handleUpdate({
                        ...settings,
                        reversal: { ...settings.reversal, infoTone: e.target.value as SoundToneId }
                      })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-sky-400"
                    >
                      {TONE_OPTIONS.map(opt => (
                        <option key={`reversal-info-${opt.id}`} value={opt.id} className="bg-slate-900 text-white">
                          {opt.name} ({opt.badge})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>

            {/* 3. CONTINUAÇÃO DE TENDÊNCIA */}
            <div className="bg-slate-950 border border-slate-800/90 rounded-xl p-4 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-800/80">
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/30">
                    <TrendingUp className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-mono font-bold text-white flex items-center gap-2">
                      <span>Continuação de Tendência</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-sky-500/10 text-sky-400 border border-sky-500/30 font-mono">
                        Trend Following & Pullback
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-400">
                      Rejeição dinâmica na EMA 50, alinhamento de médias (9&gt;21&gt;50&gt;200) e expansão em Markup/Markdown.
                    </span>
                  </div>
                </div>

                <label className="flex items-center gap-2 cursor-pointer self-start sm:self-auto font-mono text-xs">
                  <input
                    type="checkbox"
                    checked={settings.continuation.enabled}
                    onChange={(e) => handleUpdate({
                      ...settings,
                      continuation: { ...settings.continuation, enabled: e.target.checked }
                    })}
                    className="rounded border-slate-700 bg-slate-900 text-amber-400 focus:ring-0"
                  />
                  <span className={settings.continuation.enabled ? 'text-slate-200 font-semibold' : 'text-slate-500'}>
                    {settings.continuation.enabled ? 'Habilitado' : 'Mudo'}
                  </span>
                </label>
              </div>

              {settings.continuation.enabled && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  {/* High Priority Tone */}
                  <div className="bg-slate-900/70 border border-amber-500/20 rounded-lg p-3 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-amber-400 font-mono font-bold text-[11px]">
                        Alta Prioridade (Pullback Alinhado ≥75%)
                      </span>
                      <button
                        onClick={() => handlePreviewTone(settings.continuation.highPriorityTone, settings.highPriorityVolume)}
                        className={`p-1 rounded bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 transition flex items-center gap-1 text-[10px] ${
                          activePreviewTone === settings.continuation.highPriorityTone ? 'ring-2 ring-amber-400' : ''
                        }`}
                        title="Ouvir tom"
                      >
                        <Play className="w-3 h-3 fill-current" />
                        <span>Ouvir</span>
                      </button>
                    </div>

                    <select
                      value={settings.continuation.highPriorityTone}
                      onChange={(e) => handleUpdate({
                        ...settings,
                        continuation: { ...settings.continuation, highPriorityTone: e.target.value as SoundToneId }
                      })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-amber-400"
                    >
                      {TONE_OPTIONS.map(opt => (
                        <option key={`continuation-high-${opt.id}`} value={opt.id} className="bg-slate-900 text-white">
                          {opt.name} ({opt.badge})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Informative Tone */}
                  <div className="bg-slate-900/70 border border-slate-800 rounded-lg p-3 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-sky-400 font-mono font-bold text-[11px]">
                        Informativo (Alinhamento de Momentum)
                      </span>
                      <button
                        onClick={() => handlePreviewTone(settings.continuation.infoTone, settings.infoVolume)}
                        className={`p-1 rounded bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 border border-sky-500/30 transition flex items-center gap-1 text-[10px] ${
                          activePreviewTone === settings.continuation.infoTone ? 'ring-2 ring-sky-400' : ''
                        }`}
                        title="Ouvir tom"
                      >
                        <Play className="w-3 h-3 fill-current" />
                        <span>Ouvir</span>
                      </button>
                    </div>

                    <select
                      value={settings.continuation.infoTone}
                      onChange={(e) => handleUpdate({
                        ...settings,
                        continuation: { ...settings.continuation, infoTone: e.target.value as SoundToneId }
                      })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-sky-400"
                    >
                      {TONE_OPTIONS.map(opt => (
                        <option key={`continuation-info-${opt.id}`} value={opt.id} className="bg-slate-900 text-white">
                          {opt.name} ({opt.badge})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>

            {/* 4. SENTINELA DE VOLATILIDADE & RISCO */}
            <div className="bg-slate-950 border border-slate-800/90 rounded-xl p-4 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-800/80">
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/30">
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-mono font-bold text-white flex items-center gap-2">
                      <span>Sentinela de Volatilidade & Risco</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-rose-500/10 text-rose-400 border border-rose-500/30 font-mono">
                        Stop Hunt & Funding Extremo
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-400">
                      Variações atípicas acima de 6% nas 24h ou distorções severas de taxa de financiamento.
                    </span>
                  </div>
                </div>

                <label className="flex items-center gap-2 cursor-pointer self-start sm:self-auto font-mono text-xs">
                  <input
                    type="checkbox"
                    checked={settings.volatility.enabled}
                    onChange={(e) => handleUpdate({
                      ...settings,
                      volatility: { ...settings.volatility, enabled: e.target.checked }
                    })}
                    className="rounded border-slate-700 bg-slate-900 text-amber-400 focus:ring-0"
                  />
                  <span className={settings.volatility.enabled ? 'text-slate-200 font-semibold' : 'text-slate-500'}>
                    {settings.volatility.enabled ? 'Habilitado' : 'Mudo'}
                  </span>
                </label>
              </div>

              {settings.volatility.enabled && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  {/* High Priority Tone */}
                  <div className="bg-slate-900/70 border border-rose-500/20 rounded-lg p-3 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-rose-400 font-mono font-bold text-[11px]">
                        Alta Prioridade (Choque de Mercado)
                      </span>
                      <button
                        onClick={() => handlePreviewTone(settings.volatility.highPriorityTone, settings.highPriorityVolume)}
                        className={`p-1 rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 transition flex items-center gap-1 text-[10px] ${
                          activePreviewTone === settings.volatility.highPriorityTone ? 'ring-2 ring-rose-400' : ''
                        }`}
                        title="Ouvir tom"
                      >
                        <Play className="w-3 h-3 fill-current" />
                        <span>Ouvir</span>
                      </button>
                    </div>

                    <select
                      value={settings.volatility.highPriorityTone}
                      onChange={(e) => handleUpdate({
                        ...settings,
                        volatility: { ...settings.volatility, highPriorityTone: e.target.value as SoundToneId }
                      })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-rose-400"
                    >
                      {TONE_OPTIONS.map(opt => (
                        <option key={`volatility-high-${opt.id}`} value={opt.id} className="bg-slate-900 text-white">
                          {opt.name} ({opt.badge})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Informative Tone */}
                  <div className="bg-slate-900/70 border border-slate-800 rounded-lg p-3 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-sky-400 font-mono font-bold text-[11px]">
                        Informativo (Alerta Normal)
                      </span>
                      <button
                        onClick={() => handlePreviewTone(settings.volatility.infoTone, settings.infoVolume)}
                        className={`p-1 rounded bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 border border-sky-500/30 transition flex items-center gap-1 text-[10px] ${
                          activePreviewTone === settings.volatility.infoTone ? 'ring-2 ring-sky-400' : ''
                        }`}
                        title="Ouvir tom"
                      >
                        <Play className="w-3 h-3 fill-current" />
                        <span>Ouvir</span>
                      </button>
                    </div>

                    <select
                      value={settings.volatility.infoTone}
                      onChange={(e) => handleUpdate({
                        ...settings,
                        volatility: { ...settings.volatility, infoTone: e.target.value as SoundToneId }
                      })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-sky-400"
                    >
                      {TONE_OPTIONS.map(opt => (
                        <option key={`volatility-info-${opt.id}`} value={opt.id} className="bg-slate-900 text-white">
                          {opt.name} ({opt.badge})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>

            {/* 5. STATUS DO SISTEMA & VARREDURA */}
            <div className="bg-slate-950 border border-slate-800/90 rounded-xl p-4 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-800/80">
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/30">
                    <Radio className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-mono font-bold text-white flex items-center gap-2">
                      <span>Status do Sistema & Varredura</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30 font-mono">
                        Infraestrutura & Heartbeat
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-400">
                      Ciclos concluídos da varredura periódica do Top 100 e sincronização da nuvem.
                    </span>
                  </div>
                </div>

                <label className="flex items-center gap-2 cursor-pointer self-start sm:self-auto font-mono text-xs">
                  <input
                    type="checkbox"
                    checked={settings.systemStatus.enabled}
                    onChange={(e) => handleUpdate({
                      ...settings,
                      systemStatus: { ...settings.systemStatus, enabled: e.target.checked }
                    })}
                    className="rounded border-slate-700 bg-slate-900 text-amber-400 focus:ring-0"
                  />
                  <span className={settings.systemStatus.enabled ? 'text-slate-200 font-semibold' : 'text-slate-500'}>
                    {settings.systemStatus.enabled ? 'Habilitado' : 'Mudo'}
                  </span>
                </label>
              </div>

              {settings.systemStatus.enabled && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  {/* High Priority Tone */}
                  <div className="bg-slate-900/70 border border-amber-500/20 rounded-lg p-3 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-amber-400 font-mono font-bold text-[11px]">
                        Alta Prioridade (Alerta Crítico de Conexão)
                      </span>
                      <button
                        onClick={() => handlePreviewTone(settings.systemStatus.highPriorityTone, settings.highPriorityVolume)}
                        className={`p-1 rounded bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 transition flex items-center gap-1 text-[10px] ${
                          activePreviewTone === settings.systemStatus.highPriorityTone ? 'ring-2 ring-amber-400' : ''
                        }`}
                        title="Ouvir tom"
                      >
                        <Play className="w-3 h-3 fill-current" />
                        <span>Ouvir</span>
                      </button>
                    </div>

                    <select
                      value={settings.systemStatus.highPriorityTone}
                      onChange={(e) => handleUpdate({
                        ...settings,
                        systemStatus: { ...settings.systemStatus, highPriorityTone: e.target.value as SoundToneId }
                      })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-amber-400"
                    >
                      {TONE_OPTIONS.map(opt => (
                        <option key={`status-high-${opt.id}`} value={opt.id} className="bg-slate-900 text-white">
                          {opt.name} ({opt.badge})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Informative Tone */}
                  <div className="bg-slate-900/70 border border-slate-800 rounded-lg p-3 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-sky-400 font-mono font-bold text-[11px]">
                        Informativo (Varredura Concluída)
                      </span>
                      <button
                        onClick={() => handlePreviewTone(settings.systemStatus.infoTone, settings.infoVolume)}
                        className={`p-1 rounded bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 border border-sky-500/30 transition flex items-center gap-1 text-[10px] ${
                          activePreviewTone === settings.systemStatus.infoTone ? 'ring-2 ring-sky-400' : ''
                        }`}
                        title="Ouvir tom"
                      >
                        <Play className="w-3 h-3 fill-current" />
                        <span>Ouvir</span>
                      </button>
                    </div>

                    <select
                      value={settings.systemStatus.infoTone}
                      onChange={(e) => handleUpdate({
                        ...settings,
                        systemStatus: { ...settings.systemStatus, infoTone: e.target.value as SoundToneId }
                      })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-sky-400"
                    >
                      {TONE_OPTIONS.map(opt => (
                        <option key={`status-info-${opt.id}`} value={opt.id} className="bg-slate-900 text-white">
                          {opt.name} ({opt.badge})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* QUICK TEST BENCH */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-mono font-bold text-slate-300 flex items-center gap-1.5">
                <Radio className="w-4 h-4 text-amber-400" />
                Bancada de Teste Instantâneo de Áudio
              </span>
              <span className="text-[10px] text-slate-500 font-mono">Simulação de Eventos</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 font-mono">
              <button
                onClick={() => handlePreviewTone(settings.breakout.highPriorityTone, settings.highPriorityVolume)}
                className="p-2 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 transition text-center flex flex-col items-center gap-1"
              >
                <Zap className="w-4 h-4 text-emerald-400" />
                <span className="text-[10px] font-bold">Testar Breakout (Alta)</span>
              </button>

              <button
                onClick={() => handlePreviewTone(settings.reversal.highPriorityTone, settings.highPriorityVolume)}
                className="p-2 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 transition text-center flex flex-col items-center gap-1"
              >
                <RotateCw className="w-4 h-4 text-indigo-400" />
                <span className="text-[10px] font-bold">Testar Reversão (Alta)</span>
              </button>

              <button
                onClick={() => handlePreviewTone(settings.continuation.highPriorityTone, settings.highPriorityVolume)}
                className="p-2 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 border border-sky-500/30 transition text-center flex flex-col items-center gap-1"
              >
                <TrendingUp className="w-4 h-4 text-sky-400" />
                <span className="text-[10px] font-bold">Testar Continuação</span>
              </button>

              <button
                onClick={() => handlePreviewTone(settings.systemStatus.infoTone, settings.infoVolume)}
                className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition text-center flex flex-col items-center gap-1"
              >
                <Radio className="w-4 h-4 text-amber-400" />
                <span className="text-[10px] font-bold">Testar Informativo</span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800/80 bg-slate-950/90 flex flex-col sm:flex-row items-center justify-between gap-3 font-mono">
          <div className="flex items-center gap-2">
            <button
              id="btn-reset-audio-defaults"
              onClick={handleResetDefaults}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition text-xs flex items-center gap-1.5"
              title="Restaurar valores de fábrica"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Restaurar Padrões</span>
            </button>

            {showSavedNotification && (
              <span className="text-emerald-400 text-xs flex items-center gap-1">
                <Check className="w-3.5 h-3.5" />
                Configurações restauradas!
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              id="btn-confirm-sound-settings"
              onClick={onClose}
              className="w-full sm:w-auto px-5 py-2 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold transition flex items-center justify-center gap-2 shadow-sm"
            >
              <Check className="w-4 h-4" />
              <span>Salvar e Fechar</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
