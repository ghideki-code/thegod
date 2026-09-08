import React from 'react';
import { 
  Activity, 
  RefreshCw, 
  Bell, 
  Download, 
  Volume2, 
  VolumeX, 
  Sliders,
  Cpu, 
  ShieldCheck, 
  Layers
} from 'lucide-react';
import { testAudioAlert } from '../utils/audioAlert';

interface HeaderProps {
  autoScan: boolean;
  onToggleAutoScan: () => void;
  scanInterval: number;
  onChangeInterval: (seconds: number) => void;
  isScanning: boolean;
  onManualScan: () => void;
  unreadNotifications: number;
  onOpenNotifications: () => void;
  onOpenExport: () => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
  onOpenSoundSettings?: () => void;
  lastUpdated: string;
  dataSource?: string;
  onOpenGoogleWorkspace?: () => void;
  isGoogleConnected?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  autoScan,
  onToggleAutoScan,
  scanInterval,
  onChangeInterval,
  isScanning,
  onManualScan,
  unreadNotifications,
  onOpenNotifications,
  onOpenExport,
  soundEnabled,
  onToggleSound,
  onOpenSoundSettings,
  lastUpdated,
  dataSource,
  onOpenGoogleWorkspace,
  isGoogleConnected,
}) => {
  return (
    <header id="god-protocol-header" className="bg-slate-900 border-b border-slate-800 text-slate-100 sticky top-0 z-40 w-full overflow-x-hidden">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between py-2.5 sm:py-3 gap-2.5 sm:gap-3">
          {/* Logo & Brand */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 sm:gap-3">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-gradient-to-br from-amber-500/20 to-emerald-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 font-bold tracking-wider shadow-inner shrink-0">
                <Layers className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                  <h1 className="text-base sm:text-lg font-bold tracking-tight text-white flex items-center gap-1.5">
                    THE GOD PROTOCOL
                  </h1>
                  <span className="text-amber-400 font-mono text-[10px] sm:text-xs px-1.5 py-0.5 rounded bg-amber-400/10 border border-amber-400/30">
                    v2026 • Top 100
                  </span>
                </div>
                <p className="text-[11px] sm:text-xs text-slate-400 flex items-center gap-1.5 flex-wrap">
                  <span className="hidden xs:inline">Agente Quantitativo Multi-Timeframe</span>
                  <span className="text-emerald-400 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    4 Pilares
                  </span>
                  <span className="text-slate-600 lg:hidden">•</span>
                  <span className="text-amber-300 font-mono text-[10px] lg:hidden">
                    {lastUpdated || 'BRT'}
                  </span>
                </p>
              </div>
            </div>

            {/* Mobile notification & sound shortcut */}
            <div className="flex md:hidden items-center gap-1.5">
              <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg p-0.5">
                <button
                  onClick={onToggleSound}
                  className={`p-1.5 rounded text-xs transition ${
                    soundEnabled 
                      ? 'bg-amber-500/15 text-amber-400' 
                      : 'text-slate-500'
                  }`}
                  title={soundEnabled ? 'Alertas sonoros ativados (Clique para silenciar)' : 'Silenciado (Clique para ativar)'}
                >
                  {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
                </button>
                {onOpenSoundSettings && (
                  <button
                    onClick={onOpenSoundSettings}
                    className="p-1.5 text-slate-400 hover:text-amber-400 transition border-l border-slate-800"
                    title="Configurar sons por tipo de sinal"
                  >
                    <Sliders className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <button
                onClick={onOpenNotifications}
                className="relative p-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-slate-200 transition"
                title="Avisos do sistema"
              >
                <Bell className="w-4 h-4" />
                {unreadNotifications > 0 && (
                  <span className="absolute -top-1 -right-1 px-1.5 py-0.2 bg-rose-500 text-white font-mono text-[9px] font-bold rounded-full">
                    {unreadNotifications}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Cloud Infra & SLA Status - Desktop */}
          <div className="hidden lg:flex items-center gap-3 text-xs font-mono bg-slate-950/70 px-3 py-1.5 rounded-lg border border-slate-800/80">
            <div className="flex items-center gap-1.5 text-emerald-400" title={dataSource || 'Top 100 Criptomoedas por Market Cap'}>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="font-semibold text-emerald-300">Tempo Real: Top 100 Criptos</span>
            </div>
            <span className="text-slate-700">|</span>
            <div className="flex items-center gap-1.5 text-slate-300">
              <Cpu className="w-3.5 h-3.5 text-sky-400" />
              <span>Cloud Run</span>
            </div>
            <span className="text-slate-700">|</span>
            <div className="flex items-center gap-1.5 text-amber-300" title="Horário de Brasília (BRT / UTC-3)">
              <Activity className="w-3.5 h-3.5 text-amber-400" />
              <span>{lastUpdated ? `${lastUpdated} (Brasília)` : 'Sincronizando...'}</span>
            </div>
          </div>

          {/* Action Buttons & Controls */}
          <div className="flex items-center flex-wrap gap-1.5 sm:gap-2">
            {/* Auto-Scan Controls */}
            <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg p-0.5 sm:p-1 text-xs">
              <button
                id="btn-toggle-autoscan"
                onClick={onToggleAutoScan}
                className={`px-2 sm:px-2.5 py-1 rounded font-medium transition-colors flex items-center gap-1 sm:gap-1.5 text-[11px] sm:text-xs ${
                  autoScan 
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' 
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Ativar/Desativar varredura automática"
              >
                <span className={`w-1.5 h-1.5 rounded-full ${autoScan ? 'bg-emerald-400 animate-ping' : 'bg-slate-500'}`}></span>
                <span>{autoScan ? 'Auto-Scan' : 'Pausado'}</span>
              </button>

              {autoScan && (
                <select
                  id="select-scan-interval"
                  value={scanInterval}
                  onChange={(e) => onChangeInterval(Number(e.target.value))}
                  className="bg-transparent text-slate-300 text-[11px] sm:text-xs px-1.5 sm:px-2 py-0.5 border-l border-slate-800 focus:outline-none cursor-pointer"
                  title="Frequência de varredura do mercado"
                >
                  <option value={30} className="bg-slate-900">30s (Rápido)</option>
                  <option value={60} className="bg-slate-900">60s (1 min • Recomendado)</option>
                  <option value={120} className="bg-slate-900">2 min (Estável)</option>
                  <option value={300} className="bg-slate-900">5 min (Sem Ruído)</option>
                  <option value={900} className="bg-slate-900">15 min (Swing Trade)</option>
                </select>
              )}
            </div>

            {/* Manual Scan Trigger */}
            <button
              id="btn-manual-scan"
              onClick={onManualScan}
              disabled={isScanning}
              className="px-2.5 sm:px-3 py-1 sm:py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] sm:text-xs font-medium rounded-lg border border-slate-700 transition flex items-center gap-1.5 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin text-amber-400' : 'text-slate-300'}`} />
              <span>Varredura</span>
            </button>

            {/* Sound Controls Group */}
            <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg p-0.5">
              <button
                id="btn-toggle-sound"
                onClick={onToggleSound}
                className={`px-2 py-1 rounded-md text-xs transition flex items-center gap-1.5 ${
                  soundEnabled 
                    ? 'bg-amber-500/15 text-amber-400 font-semibold' 
                    : 'bg-rose-500/15 text-rose-400 font-semibold animate-pulse'
                }`}
                title={soundEnabled ? 'Alertas sonoros ativos (Clique para mutar)' : 'Alertas sonoros mudos (Clique para ativar)'}
              >
                {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
                <span className="hidden sm:inline text-[11px]">{soundEnabled ? 'Som Ativo' : 'Ativar Som'}</span>
              </button>

              {/* Instant Test Sound Chime Button */}
              <button
                id="btn-quick-sound-test"
                onClick={(e) => {
                  e.stopPropagation();
                  testAudioAlert('EXPLOSION_SIREN');
                }}
                className="p-1 px-1.5 rounded-md text-[10px] text-amber-300 hover:text-amber-200 hover:bg-slate-800/80 transition border-l border-slate-800/80 font-mono"
                title="Testar e reproduzir sirene agora"
              >
                Testar
              </button>

              {onOpenSoundSettings && (
                <button
                  id="btn-open-sound-settings"
                  onClick={onOpenSoundSettings}
                  className="p-1.5 rounded-md text-slate-400 hover:text-amber-400 hover:bg-slate-800/80 transition border-l border-slate-800/80"
                  title="Configurar sons por tipo de sinal (Breakout, Explosão, Reversão)"
                >
                  <Sliders className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Critical Notifications - Desktop */}
            <button
              id="btn-open-notifications"
              onClick={onOpenNotifications}
              className="hidden md:flex relative p-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-slate-200 transition"
              title="Notificações críticas do sistema"
            >
              <Bell className="w-4 h-4" />
              {unreadNotifications > 0 && (
                <span className="absolute -top-1 -right-1 px-1.5 py-0.2 bg-rose-500 text-white font-mono text-[10px] font-bold rounded-full animate-bounce shadow-md">
                  {unreadNotifications}
                </span>
              )}
            </button>

            {/* Google Workspace Button */}
            {onOpenGoogleWorkspace && (
              <button
                id="btn-open-workspace"
                onClick={onOpenGoogleWorkspace}
                className={`px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-lg border text-[11px] sm:text-xs font-medium transition flex items-center gap-1 sm:gap-1.5 ${
                  isGoogleConnected
                    ? 'bg-sky-500/15 border-sky-500/40 text-sky-300'
                    : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300'
                }`}
                title="Google Drive & Google Sheets"
              >
                <span className={`w-1.5 sm:w-2 h-1.5 sm:h-2 rounded-full ${isGoogleConnected ? 'bg-emerald-400' : 'bg-slate-500'}`} />
                <span>Drive & Sheets</span>
              </button>
            )}

            {/* Export Report */}
            <button
              id="btn-open-export"
              onClick={onOpenExport}
              className="px-2.5 sm:px-3 py-1 sm:py-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-semibold text-[11px] sm:text-xs rounded-lg shadow-sm transition flex items-center gap-1 sm:gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Relatório</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
