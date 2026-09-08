import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  TradeSignal, 
  DailyBacktestMetrics, 
  SystemNotification 
} from './types';
import { Header } from './components/Header';
import { MetricCards } from './components/MetricCards';
import { ScannerTable } from './components/ScannerTable';
import { MarketStrengthHeatmap } from './components/MarketStrengthHeatmap';
import { TripleScreenViewer } from './components/TripleScreenViewer';
import { BacktestPanel } from './components/BacktestPanel';
import { NotificationDrawer } from './components/NotificationDrawer';
import { RiskCalculatorModal } from './components/RiskCalculatorModal';
import { ExportModal } from './components/ExportModal';
import { GoogleWorkspacePanel } from './components/GoogleWorkspacePanel';
import { SoundSettingsModal } from './components/SoundSettingsModal';
import { ExplosionAlertBanner } from './components/ExplosionAlertBanner';
import { ExplosionRadarCard } from './components/ExplosionRadarCard';
import { ExplosionHistoryCard } from './components/ExplosionHistoryCard';
import { TradeExecutionAlertBanner } from './components/TradeExecutionAlertBanner';
import { initAuth } from './services/googleAuth';
import { TradingExecutionStyle } from './utils/technicalAnalysis';
import { 
  getAudioSettings, 
  saveAudioSettings, 
  playSignalAudio, 
  playNotificationAudio, 
  playTone, 
  AppAudioSettings 
} from './utils/audioAlert';
import { formatBrasiliaTime } from './utils/timeFormat';
import { 
  Layers, 
  Activity, 
  TrendingUp, 
  BarChart3, 
  Target, 
  ShieldCheck, 
  Cpu, 
  Zap, 
  Award, 
  DollarSign, 
  SlidersHorizontal,
  HardDrive,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  Flame,
  Sparkles
} from 'lucide-react';

export default function App() {
  const [signals, setSignals] = useState<TradeSignal[]>([]);
  const [selectedSymbol, setSelectedSymbol] = useState<string>('BTC/USDT');
  const [backtest, setBacktest] = useState<DailyBacktestMetrics | null>(null);
  const [notifications, setNotifications] = useState<SystemNotification[]>([]);
  const [autoScan, setAutoScan] = useState<boolean>(true);
  const [scanInterval, setScanInterval] = useState<number>(15);
  const [backtestDuration, setBacktestDuration] = useState<number>(60);
  const [isLoadingBacktest, setIsLoadingBacktest] = useState<boolean>(false);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [audioSettings, setAudioSettings] = useState<AppAudioSettings>(getAudioSettings);
  const [isSoundSettingsOpen, setIsSoundSettingsOpen] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'scanner' | 'triplescreen' | 'backtest' | 'workspace'>('scanner');
  const [filterOnlyQualified, setFilterOnlyQualified] = useState<boolean>(false);
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const [dataSource, setDataSource] = useState<string>('Top 100 Criptomoedas por Market Cap (Tempo Real)');
  const [isGoogleConnected, setIsGoogleConnected] = useState<boolean>(false);

  // Auto-hide other tabs when high confidence (>=90%) signal is identified
  const [autoHideTabsOnHighConfidence, setAutoHideTabsOnHighConfidence] = useState<boolean>(() => {
    const saved = localStorage.getItem('auto_hide_tabs_high_conf');
    return saved !== null ? saved === 'true' : true; // Default true per user request
  });
  const [isTabsTemporarilyUnlocked, setIsTabsTemporarilyUnlocked] = useState<boolean>(false);
  const [isExplosionRadarOpen, setIsExplosionRadarOpen] = useState<boolean>(false);

  // Modals
  const [isRiskModalOpen, setIsRiskModalOpen] = useState<boolean>(false);
  const [riskModalSignal, setRiskModalSignal] = useState<TradeSignal | null>(null);
  const [riskModalStyle, setRiskModalStyle] = useState<TradingExecutionStyle>('DAY_TRADE');
  const [isNotificationDrawerOpen, setIsNotificationDrawerOpen] = useState<boolean>(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);
  const [isAiLoading, setIsAiLoading] = useState<boolean>(false);

  // Track previous signal count and notifications to trigger audio alerts on new arrivals
  const prevSignalCountRef = useRef<number>(0);
  const prevNotifCountRef = useRef<number>(0);

  // Toggle master sound
  const handleToggleSound = () => {
    const updated = { ...audioSettings, masterEnabled: !audioSettings.masterEnabled };
    setAudioSettings(updated);
    saveAudioSettings(updated);
  };

  // Update customized audio settings
  const handleUpdateAudioSettings = (newSettings: AppAudioSettings) => {
    setAudioSettings(newSettings);
    saveAudioSettings(newSettings);
  };

  // Auth listener for Google Workspace
  useEffect(() => {
    const unsub = initAuth(
      (_user, token) => {
        setIsGoogleConnected(!!token);
      },
      () => {
        setIsGoogleConnected(false);
      }
    );
    return () => unsub();
  }, []);

  // Fetch Signals
  const fetchSignals = useCallback(async (manual = false) => {
    try {
      if (manual) setIsScanning(true);
      const res = await fetch('/api/market/signals');
      if (!res.ok) throw new Error('Falha ao buscar sinais');
      const data = await res.json();
      
      const newSignals: TradeSignal[] = data.signals || [];
      setSignals(newSignals);
      if (data.dataSource) setDataSource(data.dataSource);
      setLastUpdated(formatBrasiliaTime(Date.now(), true));

      // Audio notification if new qualified setup appeared
      const qualified = newSignals.filter((s: TradeSignal) => s.passedFilter);
      if (manual || (prevSignalCountRef.current > 0 && qualified.length > prevSignalCountRef.current)) {
        if (audioSettings.masterEnabled) {
          if (qualified.length > 0) {
            // Find top confidence qualified setup to trigger its custom sound tone
            const topSignal = [...qualified].sort((a, b) => b.confidence - a.confidence)[0];
            playSignalAudio(topSignal, 'HIGH', audioSettings);
          } else if (manual) {
            // Informative completion chime
            playTone(audioSettings.systemStatus.infoTone, audioSettings.masterVolume * audioSettings.infoVolume);
          }
        }
      }
      prevSignalCountRef.current = qualified.length;

    } catch (err) {
      console.error('Error fetching market signals:', err);
    } finally {
      if (manual) {
        setTimeout(() => setIsScanning(false), 500);
      }
    }
  }, [audioSettings]);

  // Fetch Backtest with custom duration
  const fetchBacktest = useCallback(async (days: number = backtestDuration) => {
    setIsLoadingBacktest(true);
    try {
      const res = await fetch(`/api/backtest?days=${days}`);
      if (!res.ok) throw new Error('Falha ao buscar backtest');
      const data = await res.json();
      setBacktest(data);
    } catch (err) {
      console.error('Error fetching backtest:', err);
    } finally {
      setIsLoadingBacktest(false);
    }
  }, [backtestDuration]);

  const handleChangeBacktestDuration = (days: number) => {
    setBacktestDuration(days);
    fetchBacktest(days);
  };

  // Fetch Notifications
  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications');
      if (!res.ok) throw new Error('Falha ao buscar notificações');
      const data = await res.json();
      const notifs: SystemNotification[] = data.notifications || [];
      setNotifications(notifs);

      // Play sound for new incoming unread notifications
      const unread = notifs.filter(n => !n.read);
      if (prevNotifCountRef.current > 0 && unread.length > prevNotifCountRef.current) {
        if (audioSettings.masterEnabled && unread[0]) {
          playNotificationAudio(unread[0], audioSettings);
        }
      }
      prevNotifCountRef.current = unread.length;
    } catch (err) {
      console.error('Error fetching notifications:', err);
    }
  }, [audioSettings]);

  // Manual Trigger Scan
  const handleManualScan = async () => {
    setIsScanning(true);
    try {
      await fetch('/api/market/scan', { method: 'POST' });
      await Promise.all([fetchSignals(true), fetchNotifications()]);
    } catch (e) {
      console.error(e);
    } finally {
      setIsScanning(false);
    }
  };

  // High-frequency live prices refresh
  const handleRefreshPrices = useCallback(async () => {
    try {
      const res = await fetch('/api/market/refresh-prices', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        if (data.signals && data.signals.length > 0) {
          setSignals(data.signals);
          setLastUpdated(formatBrasiliaTime(Date.now(), true));
        }
      }
    } catch (err) {
      console.warn('Falha na atualização rápida de preços:', err);
    }
  }, []);

  // Deep AI Analysis Refresh via Gemini
  const handleRefreshAI = async (symbol: string) => {
    setIsAiLoading(true);
    try {
      const res = await fetch('/api/ai-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol }),
      });
      if (!res.ok) throw new Error('Falha ao consultar IA');
      const aiResult = await res.json();

      // Update signal in state with fresh AI response
      setSignals((prev) => 
        prev.map((s) => {
          if (s.symbol === symbol) {
            return {
              ...s,
              confidence: aiResult.confidence ?? s.confidence,
              decision: aiResult.decision ?? s.decision,
              aiThesis: {
                ...s.aiThesis,
                summary: aiResult.summary || s.aiThesis.summary,
                institutionalContext: aiResult.institutionalContext || s.aiThesis.institutionalContext,
                primaryCatalyst: aiResult.primaryCatalyst || s.aiThesis.primaryCatalyst,
                riskWarning: aiResult.riskWarning || s.aiThesis.riskWarning,
                verdict: aiResult.verdict || s.aiThesis.verdict,
                source: aiResult.source || s.aiThesis.source,
              },
            };
          }
          return s;
        })
      );
    } catch (err) {
      console.error('Error refreshing AI:', err);
    } finally {
      setIsAiLoading(false);
    }
  };

  // Initial Load & Auto-Refresh Interval
  useEffect(() => {
    fetchSignals();
    fetchBacktest();
    fetchNotifications();
  }, [fetchSignals, fetchBacktest, fetchNotifications]);

  useEffect(() => {
    if (!autoScan) return;
    const interval = setInterval(() => {
      fetchSignals();
      fetchNotifications();
    }, scanInterval * 1000);

    return () => clearInterval(interval);
  }, [autoScan, scanInterval, fetchSignals, fetchNotifications]);

  // High-frequency live ticker polling (every 8s) to keep price and Fibonacci targets live
  useEffect(() => {
    if (!autoScan) return;
    const liveTickerInterval = setInterval(() => {
      handleRefreshPrices();
    }, 8000);

    return () => clearInterval(liveTickerInterval);
  }, [autoScan, handleRefreshPrices]);

  // Notifications helpers
  const handleMarkAllRead = async () => {
    try {
      await fetch('/api/notifications/mark-read', { method: 'POST' });
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch (e) {
      console.error(e);
    }
  };

  const handleClearNotifications = async () => {
    try {
      await fetch('/api/notifications/clear', { method: 'POST' });
      setNotifications([]);
    } catch (e) {
      console.error(e);
    }
  };

  // Selected Signal for Deep Analysis
  const currentSignal = signals.find((s) => s.symbol === selectedSymbol) || signals[0];

  // Detect High-Confidence Signals (>= 90%)
  const highConfidenceSignals = React.useMemo(() => {
    return signals.filter((s) => s.confidence >= 90 && s.decision !== 'AGUARDAR');
  }, [signals]);

  const hasHighConfidenceSignal = highConfidenceSignals.length > 0;
  const areOtherTabsHidden = hasHighConfidenceSignal && autoHideTabsOnHighConfidence && !isTabsTemporarilyUnlocked;

  // Explosive Signals for Alert Banner
  const explosiveSignals = React.useMemo(() => {
    return signals.filter((s) => {
      const sq = s.squeezeBreakout;
      return sq?.state === 'IGNICAO_DISPARADA' || sq?.state === 'SQUEEZE_ATIVO' || (sq?.explosionScore || 0) >= 70;
    }).sort((a, b) => (b.squeezeBreakout?.explosionScore || 0) - (a.squeezeBreakout?.explosionScore || 0));
  }, [signals]);

  // Auto-switch to scanner if high confidence signal triggers and other tabs are hidden
  useEffect(() => {
    if (areOtherTabsHidden && activeTab !== 'scanner') {
      setActiveTab('scanner');
    }
  }, [areOtherTabsHidden, activeTab]);

  const handleToggleAutoHide = () => {
    setAutoHideTabsOnHighConfidence((prev) => {
      const next = !prev;
      localStorage.setItem('auto_hide_tabs_high_conf', String(next));
      if (!next) {
        setIsTabsTemporarilyUnlocked(false);
      }
      return next;
    });
  };

  // Quick Open Risk Calculator
  const handleOpenRiskCalculator = (signal: TradeSignal, defaultStyle: TradingExecutionStyle = 'DAY_TRADE') => {
    setRiskModalSignal(signal);
    setRiskModalStyle(defaultStyle);
    setIsRiskModalOpen(true);
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-amber-500 selection:text-slate-950 overflow-x-hidden w-full">
      {/* Top Header */}
      <Header
        autoScan={autoScan}
        onToggleAutoScan={() => setAutoScan(!autoScan)}
        scanInterval={scanInterval}
        onChangeInterval={(sec) => setScanInterval(sec)}
        isScanning={isScanning}
        onManualScan={handleManualScan}
        unreadNotifications={unreadCount}
        onOpenNotifications={() => setIsNotificationDrawerOpen(true)}
        onOpenExport={() => setIsExportModalOpen(true)}
        soundEnabled={audioSettings.masterEnabled}
        onToggleSound={handleToggleSound}
        onOpenSoundSettings={() => setIsSoundSettingsOpen(true)}
        lastUpdated={lastUpdated}
        dataSource={dataSource}
        onOpenGoogleWorkspace={() => setActiveTab('workspace')}
        isGoogleConnected={isGoogleConnected}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-5 space-y-4 sm:space-y-5 overflow-x-hidden">
        {/* Executive KPI Metrics Ribbon */}
        <MetricCards
          signals={signals}
          backtest={backtest}
          onFilterQualified={() => {
            setFilterOnlyQualified(true);
            setActiveTab('scanner');
          }}
        />

        {/* Real-time Trade Execution Lifecycle Alarms (Triggered, Take Profit, Stop Loss) */}
        <TradeExecutionAlertBanner 
          signals={signals} 
          onSelectSymbol={(sym) => {
            setSelectedSymbol(sym);
            setActiveTab('triplescreen');
            setTimeout(() => {
              const el = document.getElementById('coin-analysis-section');
              if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 50);
          }} 
        />

        {/* Navigation Tabs - with no-scrollbar for smooth responsive scrolling without horizontal bar */}
        <div className="border-b border-slate-800 flex items-center justify-between overflow-x-auto no-scrollbar pb-1 gap-2">
          <div className="flex items-center gap-1.5 min-w-max">
            {/* Tab 1: Scanner */}
            <button
              id="tab-scanner"
              onClick={() => setActiveTab('scanner')}
              className={`px-3 sm:px-4 py-2 text-xs font-mono font-medium rounded-lg transition flex items-center gap-2 ${
                activeTab === 'scanner'
                  ? 'bg-slate-800 text-amber-400 font-bold border border-slate-700 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Scanner & Matriz</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-950 border border-slate-700 text-slate-400">
                {signals.length}
              </span>
              {areOtherTabsHidden && (
                <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold animate-pulse flex items-center gap-1">
                  <Zap className="w-3 h-3 text-emerald-400" />
                  <span>Modo Foco (≥90%)</span>
                </span>
              )}
            </button>

            {/* Tab 2: Coin Analysis & Triple Screen - Automatically hidden when high confidence signal (>=90%) is identified */}
            {!areOtherTabsHidden && (
              <button
                id="tab-triplescreen"
                onClick={() => setActiveTab('triplescreen')}
                className={`px-3 sm:px-4 py-2 text-xs font-mono font-medium rounded-lg transition flex items-center gap-2 ${
                  activeTab === 'triplescreen'
                    ? 'bg-slate-800 text-amber-400 font-bold border border-slate-700 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Análise da Moeda (Triple Screen & IA)</span>
                {currentSignal && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/20 border border-amber-500/40 text-amber-300 font-bold">
                    {currentSignal.symbol}
                  </span>
                )}
              </button>
            )}

            {/* Tab 3: Backtest - Automatically hidden when high confidence signal (>=90%) is identified */}
            {!areOtherTabsHidden && (
              <button
                id="tab-backtest"
                onClick={() => setActiveTab('backtest')}
                className={`px-3 sm:px-4 py-2 text-xs font-mono font-medium rounded-lg transition flex items-center gap-2 ${
                  activeTab === 'backtest'
                    ? 'bg-slate-800 text-amber-400 font-bold border border-slate-700 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
              >
                <Award className="w-3.5 h-3.5" />
                <span>Backtest (60D)</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-semibold">
                  {backtest?.winRate ?? 74}% WR
                </span>
              </button>
            )}

            {/* Tab 4: Google Workspace (Drive & Sheets) - Automatically hidden when high confidence signal (>=90%) is identified */}
            {!areOtherTabsHidden && (
              <button
                id="tab-workspace"
                onClick={() => setActiveTab('workspace')}
                className={`px-3 sm:px-4 py-2 text-xs font-mono font-medium rounded-lg transition flex items-center gap-2 ${
                  activeTab === 'workspace'
                    ? 'bg-slate-800 text-sky-400 font-bold border border-slate-700 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
              >
                <HardDrive className="w-3.5 h-3.5" />
                <span>Google Sheets & Drive</span>
                <span className={`w-2 h-2 rounded-full ${isGoogleConnected ? 'bg-emerald-400' : 'bg-slate-600'}`} />
              </button>
            )}
          </div>

          {/* Controls on the right side of the Tab bar */}
          <div className="flex items-center gap-2 text-xs font-mono">
            {hasHighConfidenceSignal && areOtherTabsHidden && (
              <div className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-2.5 py-1 text-emerald-300 font-mono">
                <Lock className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="hidden sm:inline">Abas Ocultadas (Sinal ≥90%)</span>
                <button
                  id="btn-unlock-hidden-tabs"
                  onClick={() => setIsTabsTemporarilyUnlocked(true)}
                  className="ml-1 px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-bold text-[11px] border border-slate-700 transition"
                  title="Exibir temporariamente todas as abas"
                >
                  Exibir Abas
                </button>
              </div>
            )}

            {hasHighConfidenceSignal && !areOtherTabsHidden && (
              <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded-lg px-2 py-1">
                <button
                  id="btn-relock-hidden-tabs"
                  onClick={() => setIsTabsTemporarilyUnlocked(false)}
                  className="px-2 py-0.5 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-[11px] font-bold flex items-center gap-1 transition"
                  title="Ocultar abas secundárias e restaurar Modo Foco no Scanner"
                >
                  <Lock className="w-3 h-3 text-emerald-400" />
                  <span>Ocultar Abas (Foco ≥90%)</span>
                </button>
              </div>
            )}

            {/* Preference Toggle: Auto-Hide Tabs on >=90% */}
            <button
              id="btn-toggle-auto-hide-pref"
              onClick={handleToggleAutoHide}
              className={`px-2 py-1 rounded-lg border text-[11px] font-mono transition flex items-center gap-1.5 ${
                autoHideTabsOnHighConfidence 
                  ? 'bg-slate-900 text-amber-400 border-amber-500/30' 
                  : 'bg-slate-950 text-slate-500 border-slate-800 hover:text-slate-300'
              }`}
              title={autoHideTabsOnHighConfidence ? 'Auto-ocultar abas em sinais ≥90%: ATIVADO (Clique para desativar)' : 'Auto-ocultar abas em sinais ≥90%: DESATIVADO (Clique para ativar)'}
            >
              <Zap className="w-3 h-3" />
              <span className="hidden md:inline">Auto-Ocultar em ≥90%:</span>
              <span className="font-bold">{autoHideTabsOnHighConfidence ? 'LIGADO' : 'DESLIG'}</span>
            </button>
          </div>
        </div>

        {/* Active Tab View Content */}
        {activeTab === 'scanner' && (
          <div className="space-y-4">
            {/* Explosion Alert Banner (Squeeze & Breakout >= 8%) */}
            {explosiveSignals.length > 0 && (
              <ExplosionAlertBanner
                explosiveSignals={explosiveSignals}
                onSelectSignal={(s) => {
                  setSelectedSymbol(s.symbol);
                  setTimeout(() => {
                    const el = document.getElementById('coin-analysis-section');
                    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }, 50);
                }}
              />
            )}

            {/* High-Confidence Focus Alert Banner (>= 90%) */}
            {hasHighConfidenceSignal && (
              <div 
                id="banner-high-confidence-focus"
                className="bg-gradient-to-r from-emerald-950/90 via-slate-900 to-amber-950/80 border-2 border-emerald-500/70 rounded-xl p-3 sm:p-4 shadow-lg shadow-emerald-950/50 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs font-mono animate-fadeIn"
              >
                <div className="flex items-start sm:items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shrink-0 animate-pulse">
                    <Zap className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-white text-sm">
                        Sinal de Alta Confiança IA Detectado (≥ 90%)
                      </span>
                      <span className="px-2 py-0.5 rounded bg-emerald-500/25 text-emerald-300 border border-emerald-500/50 font-bold text-[11px] animate-pulse">
                        {highConfidenceSignals.length} ATIVO{highConfidenceSignals.length > 1 ? 'S' : ''} DISPONÍVEL
                      </span>
                      {areOtherTabsHidden && (
                        <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-bold">
                          🔒 Demais abas ocultadas automaticamente
                        </span>
                      )}
                    </div>
                    <p className="text-slate-300 mt-1 text-[11px] leading-relaxed">
                      {highConfidenceSignals.map(s => `${s.symbol} (${s.confidence}% • ${s.decision} • R/R 1:${s.riskReward})`).join('  |  ')}
                      <span className="text-slate-400 block sm:inline sm:ml-1 font-sans">
                        — A IA ativou o modo foco prioritário no Scanner para garantir execução imediata sem ruído.
                      </span>
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    id="btn-focus-top-signal"
                    onClick={() => {
                      setSelectedSymbol(highConfidenceSignals[0].symbol);
                      setTimeout(() => {
                        const el = document.getElementById('coin-analysis-section');
                        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      }, 50);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-emerald-500 text-slate-950 hover:bg-emerald-400 font-bold transition flex items-center gap-1.5 shadow-sm"
                  >
                    <Target className="w-3.5 h-3.5" />
                    <span>Focar {highConfidenceSignals[0].symbol}</span>
                  </button>

                  {areOtherTabsHidden ? (
                    <button
                      id="btn-banner-unlock-tabs"
                      onClick={() => setIsTabsTemporarilyUnlocked(true)}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition flex items-center gap-1.5"
                      title="Exibir temporariamente as abas de Análise, Backtest e Workspace"
                    >
                      <Eye className="w-3.5 h-3.5 text-slate-400" />
                      <span>Exibir Outras Abas</span>
                    </button>
                  ) : (
                    <button
                      id="btn-banner-lock-tabs"
                      onClick={() => setIsTabsTemporarilyUnlocked(false)}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 transition flex items-center gap-1.5"
                      title="Ocultar abas secundárias e manter foco total no Scanner"
                    >
                      <Lock className="w-3.5 h-3.5" />
                      <span>Ocultar Abas (Foco)</span>
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Optional Collapsible Explosion Radar Widget */}
            <div className="flex items-center justify-between px-1">
              <button
                id="btn-toggle-explosion-radar-card"
                onClick={() => setIsExplosionRadarOpen(!isExplosionRadarOpen)}
                className="px-2.5 py-1 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 text-xs font-mono font-bold flex items-center gap-1.5 transition"
              >
                <Flame className="w-3.5 h-3.5 text-rose-400" />
                <span>{isExplosionRadarOpen ? 'Fechar Radar de Explosão 8%+' : 'Ver Radar de Explosão 8%+ & Squeeze'}</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300">
                  {explosiveSignals.length}
                </span>
              </button>
            </div>

            {isExplosionRadarOpen && (
              <ExplosionRadarCard
                signals={signals}
                onSelectSignal={(s) => {
                  setSelectedSymbol(s.symbol);
                  setTimeout(() => {
                    const el = document.getElementById('coin-analysis-section');
                    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }, 50);
                }}
                onOpenSoundSettings={() => setIsSoundSettingsOpen(true)}
              />
            )}

            {/* Card 'Alerta de Explosão': Histórico dos últimos 5 ativos com volume anômalo > 3σ */}
            <ExplosionHistoryCard
              signals={signals}
              onSelectSignal={(s) => {
                setSelectedSymbol(s.symbol);
                setTimeout(() => {
                  const el = document.getElementById('coin-analysis-section');
                  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }, 50);
              }}
            />

            {/* Heatmap de Força de Mercado & Correlação Macro (7D) */}
            <MarketStrengthHeatmap
              signals={signals}
              selectedSymbol={selectedSymbol}
              onSelectSymbol={(sym) => {
                setSelectedSymbol(sym);
                setTimeout(() => {
                  const el = document.getElementById('coin-analysis-section');
                  if (el) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }
                }, 50);
              }}
              onOpenRiskCalc={handleOpenRiskCalculator}
            />

            <ScannerTable
              signals={signals}
              selectedSymbol={selectedSymbol}
              onSelectSymbol={(sym) => {
                setSelectedSymbol(sym);
                // Scroll smoothly to analysis section if on scanner view
                setTimeout(() => {
                  const el = document.getElementById('coin-analysis-section');
                  if (el) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }
                }, 50);
              }}
              onOpenRiskCalc={handleOpenRiskCalculator}
              filterOnlyQualified={filterOnlyQualified}
              setFilterOnlyQualified={setFilterOnlyQualified}
            />

            {/* Análise Técnica & IA Completa da Moeda Selecionada (Triple Screen & 4 Pilares) */}
            {currentSignal && (
              <section id="coin-analysis-section" className="space-y-3 pt-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-1 border-t border-slate-800/80 pt-4">
                  <div className="flex items-center gap-2.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
                    <h2 className="text-base sm:text-lg font-bold font-mono text-white flex flex-wrap items-center gap-2">
                      <span>Análise da Moeda em Foco:</span>
                      <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                        {currentSignal.symbol}
                      </span>
                      <span className="text-xs text-slate-400 font-normal">({currentSignal.name})</span>
                    </h2>
                  </div>

                  <div className="flex items-center gap-2 text-xs font-mono">
                    <span className="text-slate-400 hidden sm:inline">Rank #{currentSignal.marketCapRank || '—'}</span>
                    <button
                      onClick={() => {
                        setActiveTab('triplescreen');
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 font-semibold border border-slate-700 transition flex items-center gap-1.5"
                      title="Abrir em aba exclusiva"
                    >
                      <Layers className="w-3.5 h-3.5" />
                      <span>Ver em Aba Exclusiva →</span>
                    </button>
                  </div>
                </div>

                <TripleScreenViewer
                  signal={currentSignal}
                  signals={signals}
                  onSelectSymbol={setSelectedSymbol}
                  onOpenRiskCalc={handleOpenRiskCalculator}
                  onRefreshAI={handleRefreshAI}
                  isAiLoading={isAiLoading}
                />
              </section>
            )}
          </div>
        )}

        {activeTab === 'triplescreen' && currentSignal && (
          <div className="space-y-4">
            <div className="flex items-center justify-between px-1">
              <h2 className="text-sm sm:text-base font-bold font-mono text-slate-200 flex items-center gap-2">
                <Layers className="w-4 h-4 text-amber-400" />
                <span>Análise Completa Triple Screen & 4 Pilares de Confluência</span>
              </h2>
              <button
                onClick={() => setActiveTab('scanner')}
                className="text-xs font-mono text-slate-400 hover:text-amber-400 transition"
              >
                ← Voltar para a Matriz de 100 Moedas
              </button>
            </div>
            <TripleScreenViewer
              signal={currentSignal}
              signals={signals}
              onSelectSymbol={setSelectedSymbol}
              onOpenRiskCalc={handleOpenRiskCalculator}
              onRefreshAI={handleRefreshAI}
              isAiLoading={isAiLoading}
            />
          </div>
        )}

        {activeTab === 'backtest' && (
          <BacktestPanel
            backtest={backtest}
            duration={backtestDuration}
            onChangeDuration={handleChangeBacktestDuration}
            isLoading={isLoadingBacktest}
            onExportCSV={() => setIsExportModalOpen(true)}
          />
        )}

        {activeTab === 'workspace' && (
          <GoogleWorkspacePanel
            signals={signals}
            backtest={backtest}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-4 text-center text-xs text-slate-500 font-mono">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div>
            <span>The God Protocol v2026 (v4.0)</span>
            <span className="text-slate-700 mx-2">•</span>
            <span>Sistema Quantitativo Triple Screen & 4 Pilares de Confluência</span>
          </div>
          <div className="text-[11px] text-slate-600">
            Sempre utilize Stop Loss • Gestão de Risco Estrita 1%
          </div>
        </div>
      </footer>

      {/* Modals & Drawers */}
      <RiskCalculatorModal
        isOpen={isRiskModalOpen}
        onClose={() => setIsRiskModalOpen(false)}
        signal={riskModalSignal}
        initialStyle={riskModalStyle}
      />

      <NotificationDrawer
        isOpen={isNotificationDrawerOpen}
        onClose={() => setIsNotificationDrawerOpen(false)}
        notifications={notifications}
        onMarkAllRead={handleMarkAllRead}
        onClearAll={handleClearNotifications}
        onSelectSymbol={(sym) => {
          setSelectedSymbol(sym);
          setActiveTab('triplescreen');
        }}
        onOpenSoundSettings={() => {
          setIsNotificationDrawerOpen(false);
          setIsSoundSettingsOpen(true);
        }}
      />

      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        signals={signals}
        backtest={backtest}
        onOpenWorkspaceTab={() => setActiveTab('workspace')}
      />

      <SoundSettingsModal
        isOpen={isSoundSettingsOpen}
        onClose={() => setIsSoundSettingsOpen(false)}
        audioSettings={audioSettings}
        onUpdateAudioSettings={handleUpdateAudioSettings}
      />
    </div>
  );
}
