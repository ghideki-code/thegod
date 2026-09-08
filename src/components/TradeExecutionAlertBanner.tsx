import React, { useState, useEffect, useRef } from 'react';
import { 
  Bell, 
  CheckCircle2, 
  AlertTriangle, 
  Zap, 
  Volume2, 
  VolumeX, 
  X, 
  ChevronRight, 
  Target, 
  ShieldAlert, 
  PlayCircle,
  Clock,
  Radio,
  TrendingUp,
  TrendingDown,
  Layers
} from 'lucide-react';
import { TradeSignal, FibonacciTarget } from '../types';
import { playTradeLifecycleAlarm, TradeExecutionAlarmType } from '../utils/audioAlert';
import { calculateFibonacciTargets, FIBONACCI_TARGET_RATIOS } from '../utils/technicalAnalysis';

export interface TradeExecutionEvent {
  id: string;
  type: TradeExecutionAlarmType;
  symbol: string;
  name: string;
  price: number;
  triggerPrice: number;
  targetPrice?: number;
  stopPrice?: number;
  direction: 'COMPRA' | 'VENDA';
  timestamp: number;
  pnlPercent?: number;
  message: string;
  targetLevel?: number; // 1, 2, 3, 4, 5
  targetRatioLabel?: string;
  distancePercent?: number;
  fibonacciTargets?: FibonacciTarget[];
}

interface TradeExecutionAlertBannerProps {
  signals: TradeSignal[];
  onSelectSymbol: (symbol: string) => void;
}

export const TradeExecutionAlertBanner: React.FC<TradeExecutionAlertBannerProps> = ({
  signals,
  onSelectSymbol,
}) => {
  const [activeEvent, setActiveEvent] = useState<TradeExecutionEvent | null>(null);
  const [eventHistory, setEventHistory] = useState<TradeExecutionEvent[]>([]);
  const [isMuted, setIsMuted] = useState<boolean>(() => {
    try {
      return localStorage.getItem('god_protocol_trade_alarm_muted') === 'true';
    } catch {
      return false;
    }
  });
  const [showHistoryModal, setShowHistoryModal] = useState<boolean>(false);
  const [showNearRadar, setShowNearRadar] = useState<boolean>(true);

  // Track state of each trade
  const tradeStateTracker = useRef<Map<string, 'PENDING' | 'TRIGGERED' | 'SL_HIT'>>(new Map());
  // Track highest Fibonacci target hit (0 to 5)
  const tradeHighestTpHit = useRef<Map<string, number>>(new Map());
  // Track near trigger notifications to prevent spam
  const nearTriggerNotified = useRef<Set<string>>(new Set());
  const hasInitialized = useRef<boolean>(false);

  // Identify trades that are near trigger (within 1.2% of entry price without having triggered)
  const nearTriggerTrades = React.useMemo(() => {
    if (!signals || signals.length === 0) return [];
    
    return signals
      .filter(s => {
        if (!s.passedFilter || s.decision === 'AGUARDAR' || s.decision === 'NEUTRO') return false;
        const entry = s.entryPrice || 0;
        const current = s.currentPrice || 0;
        if (entry <= 0 || current <= 0) return false;

        const isLong = s.decision === 'COMPRA';
        // Distance percentage from current to entry
        const distancePct = Math.abs((current - entry) / entry) * 100;

        // Is it approaching entry?
        const isApproaching = isLong
          ? (current <= entry && current >= entry * 0.985)
          : (current >= entry && current <= entry * 1.015);

        // Or if price is very close within 0.85%
        return (isApproaching && distancePct <= 1.2) || (distancePct <= 0.65 && distancePct > 0.01);
      })
      .map(s => {
        const entry = s.entryPrice || 1;
        const current = s.currentPrice || 1;
        const distancePct = Number((Math.abs((current - entry) / entry) * 100).toFixed(2));
        const fiboTargets = s.fibonacciTargets && s.fibonacciTargets.length === 5
          ? s.fibonacciTargets
          : calculateFibonacciTargets(s.entryPrice, s.stopLoss, s.decision, s.currentPrice);

        return {
          signal: s,
          distancePct,
          targets: fiboTargets,
        };
      })
      .sort((a, b) => a.distancePct - b.distancePct);
  }, [signals]);

  // Monitor signals for trade triggers, 5 Fibonacci TP hits, Stop Loss, and Near Trigger
  useEffect(() => {
    if (!signals || signals.length === 0) return;

    const qualified = signals.filter(s => s.passedFilter && s.decision !== 'NEUTRO' && s.decision !== 'AGUARDAR');

    // On initial mount, establish baseline states so we don't fire historical alarms immediately
    if (!hasInitialized.current) {
      qualified.forEach(s => {
        const targets = s.fibonacciTargets && s.fibonacciTargets.length === 5
          ? s.fibonacciTargets
          : calculateFibonacciTargets(s.entryPrice, s.stopLoss, s.decision, s.currentPrice);

        let initialHighestTp = 0;
        targets.forEach(t => {
          if (t.isHit && t.level > initialHighestTp) {
            initialHighestTp = t.level;
          }
        });
        tradeHighestTpHit.current.set(s.symbol, initialHighestTp);

        let state: 'PENDING' | 'TRIGGERED' | 'SL_HIT' = 'PENDING';
        if (s.decision === 'COMPRA') {
          if (s.currentPrice <= s.stopLoss) state = 'SL_HIT';
          else if (s.currentPrice >= s.entryPrice) state = 'TRIGGERED';
        } else if (s.decision === 'VENDA') {
          if (s.currentPrice >= s.stopLoss) state = 'SL_HIT';
          else if (s.currentPrice <= s.entryPrice) state = 'TRIGGERED';
        }
        tradeStateTracker.current.set(s.symbol, state);
      });
      hasInitialized.current = true;
      return;
    }

    // On subsequent updates, check for state transitions
    qualified.forEach(s => {
      const prevState = tradeStateTracker.current.get(s.symbol) || 'PENDING';
      const prevHighestTp = tradeHighestTpHit.current.get(s.symbol) || 0;
      let newState: 'PENDING' | 'TRIGGERED' | 'SL_HIT' = prevState;

      const targets = s.fibonacciTargets && s.fibonacciTargets.length === 5
        ? s.fibonacciTargets
        : calculateFibonacciTargets(s.entryPrice, s.stopLoss, s.decision, s.currentPrice);

      const isLong = s.decision === 'COMPRA';
      const entry = s.entryPrice > 0 ? s.entryPrice : s.currentPrice;

      // 1. Check Stop Loss
      if ((isLong && s.currentPrice <= s.stopLoss) || (!isLong && s.currentPrice >= s.stopLoss)) {
        newState = 'SL_HIT';
      } 
      // 2. Check Triggered
      else if ((isLong && s.currentPrice >= s.entryPrice) || (!isLong && s.currentPrice <= s.entryPrice)) {
        newState = 'TRIGGERED';
      }

      // Check which Fibonacci targets are hit right now
      let currentHighestTp = 0;
      targets.forEach(t => {
        const hit = isLong ? s.currentPrice >= t.price : s.currentPrice <= t.price;
        if (hit && t.level > currentHighestTp) {
          currentHighestTp = t.level;
        }
      });

      // A) Check for new Fibonacci Take Profit hits (from TP1 up to TP5)
      if (currentHighestTp > prevHighestTp && newState !== 'SL_HIT') {
        tradeHighestTpHit.current.set(s.symbol, currentHighestTp);
        const hitTarget = targets[currentHighestTp - 1] || targets[0];
        const pnl = hitTarget.pnlPercent;

        const newEvent: TradeExecutionEvent = {
          id: `evt-tp-${Date.now()}-${s.symbol}-${currentHighestTp}`,
          type: 'TAKE_PROFIT',
          symbol: s.symbol,
          name: s.name,
          price: s.currentPrice,
          triggerPrice: s.entryPrice,
          targetPrice: hitTarget.price,
          stopPrice: s.stopLoss,
          direction: s.decision as 'COMPRA' | 'VENDA',
          timestamp: Date.now(),
          pnlPercent: pnl,
          targetLevel: currentHighestTp,
          targetRatioLabel: hitTarget.ratioLabel,
          fibonacciTargets: targets,
          message: `${hitTarget.ratioLabel} alcançado a $${hitTarget.price}! Lucro de +${pnl.toFixed(2)}% conquistado`,
        };

        setActiveEvent(newEvent);
        setEventHistory(prev => [newEvent, ...prev.slice(0, 29)]);
        if (!isMuted) playTradeLifecycleAlarm('TAKE_PROFIT');
        return;
      }

      // B) Check for state changes (Triggered or Stop Loss)
      if (newState !== prevState) {
        tradeStateTracker.current.set(s.symbol, newState);

        if (newState === 'TRIGGERED' && prevState === 'PENDING') {
          const newEvent: TradeExecutionEvent = {
            id: `evt-trig-${Date.now()}-${s.symbol}`,
            type: 'TRADE_TRIGGERED',
            symbol: s.symbol,
            name: s.name,
            price: s.currentPrice,
            triggerPrice: s.entryPrice,
            targetPrice: targets[0]?.price,
            stopPrice: s.stopLoss,
            direction: s.decision as 'COMPRA' | 'VENDA',
            timestamp: Date.now(),
            fibonacciTargets: targets,
            message: `Gatilho de ${s.decision} acionado a $${s.currentPrice} (Alvo 1: $${targets[0]?.price || s.takeProfit1})`,
          };

          setActiveEvent(newEvent);
          setEventHistory(prev => [newEvent, ...prev.slice(0, 29)]);
          if (!isMuted) playTradeLifecycleAlarm('TRADE_TRIGGERED');
        } else if (newState === 'SL_HIT' && prevState !== 'SL_HIT') {
          const lossPnl = isLong 
            ? ((s.stopLoss - entry) / (entry || 1)) * 100 
            : ((entry - s.stopLoss) / (entry || 1)) * 100;

          const newEvent: TradeExecutionEvent = {
            id: `evt-sl-${Date.now()}-${s.symbol}`,
            type: 'STOP_LOSS',
            symbol: s.symbol,
            name: s.name,
            price: s.currentPrice,
            triggerPrice: s.entryPrice,
            stopPrice: s.stopLoss,
            direction: s.decision as 'COMPRA' | 'VENDA',
            timestamp: Date.now(),
            pnlPercent: Number(lossPnl.toFixed(2)),
            fibonacciTargets: targets,
            message: `Stop Loss de proteção acionado a $${s.stopLoss}. Capital preservado com risco de 1%`,
          };

          setActiveEvent(newEvent);
          setEventHistory(prev => [newEvent, ...prev.slice(0, 29)]);
          if (!isMuted) playTradeLifecycleAlarm('STOP_LOSS');
        }
      }

      // C) Check for Near Trigger entering critical approach zone (< 0.45% distance)
      const distPct = Math.abs((s.currentPrice - s.entryPrice) / (s.entryPrice || 1)) * 100;
      if (newState === 'PENDING' && distPct <= 0.45 && distPct > 0.02 && !nearTriggerNotified.current.has(s.symbol)) {
        nearTriggerNotified.current.add(s.symbol);

        const newEvent: TradeExecutionEvent = {
          id: `evt-near-${Date.now()}-${s.symbol}`,
          type: 'NEAR_TRIGGER',
          symbol: s.symbol,
          name: s.name,
          price: s.currentPrice,
          triggerPrice: s.entryPrice,
          targetPrice: targets[0]?.price,
          stopPrice: s.stopLoss,
          direction: s.decision as 'COMPRA' | 'VENDA',
          timestamp: Date.now(),
          distancePercent: Number(distPct.toFixed(2)),
          fibonacciTargets: targets,
          message: `Ativo na iminência do gatilho! Faltam apenas ${distPct.toFixed(2)}% para ativar a entrada em $${s.entryPrice}`,
        };

        setActiveEvent(newEvent);
        setEventHistory(prev => [newEvent, ...prev.slice(0, 29)]);
        if (!isMuted) playTradeLifecycleAlarm('NEAR_TRIGGER');
      }
    });
  }, [signals, isMuted]);

  // Handle Mute Toggle
  const toggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    try {
      localStorage.setItem('god_protocol_trade_alarm_muted', String(next));
    } catch (e) {
      console.error(e);
    }
  };

  // Manual Trigger for testing / demonstration
  const handleTestAlarm = (type: TradeExecutionAlarmType) => {
    const mockSymbol = type === 'TAKE_PROFIT' 
      ? 'SOL/USDT' 
      : type === 'TRADE_TRIGGERED' 
      ? 'BTC/USDT' 
      : type === 'NEAR_TRIGGER' 
      ? 'ETH/USDT' 
      : 'BNB/USDT';

    const match = signals.find(s => s.symbol === mockSymbol) || signals[0] || {
      symbol: 'BTC/USDT',
      name: 'Bitcoin',
      currentPrice: 87450,
      entryPrice: 87400,
      takeProfit1: 90200,
      takeProfit2: 92100,
      takeProfit3: 94800,
      stopLoss: 85900,
      decision: 'COMPRA' as const,
    };

    const targets = match.fibonacciTargets && match.fibonacciTargets.length === 5
      ? match.fibonacciTargets
      : calculateFibonacciTargets(match.entryPrice, match.stopLoss, match.decision, match.currentPrice);

    let msg = '';
    let pnl = 0;
    let targetLevel: number | undefined = undefined;
    let targetRatioLabel: string | undefined = undefined;
    let distancePercent: number | undefined = undefined;

    if (type === 'TRADE_TRIGGERED') {
      msg = `Gatilho de ${match.decision} acionado a $${match.currentPrice} (Alvo 1: $${targets[0]?.price || match.takeProfit1})`;
    } else if (type === 'TAKE_PROFIT') {
      targetLevel = 2;
      targetRatioLabel = targets[1]?.ratioLabel || 'TP2 (2.000 Expansão)';
      pnl = targets[1]?.pnlPercent || 4.35;
      msg = `${targetRatioLabel} alcançado com sucesso a $${targets[1]?.price}! Lucro de +${pnl.toFixed(2)}% conquistado`;
    } else if (type === 'NEAR_TRIGGER') {
      distancePercent = 0.35;
      msg = `Ativo na iminência do gatilho! Faltam apenas 0.35% para ativar a entrada em $${match.entryPrice}`;
    } else {
      pnl = -1.0;
      msg = `Stop Loss de proteção acionado a $${match.stopLoss}. Capital preservado com risco de 1%`;
    }

    const testEvt: TradeExecutionEvent = {
      id: `test-${Date.now()}`,
      type,
      symbol: match.symbol,
      name: match.name,
      price: match.currentPrice,
      triggerPrice: match.entryPrice,
      targetPrice: targets[0]?.price,
      stopPrice: match.stopLoss,
      direction: match.decision as 'COMPRA' | 'VENDA',
      timestamp: Date.now(),
      pnlPercent: pnl,
      targetLevel,
      targetRatioLabel,
      distancePercent,
      fibonacciTargets: targets,
      message: msg,
    };

    setActiveEvent(testEvt);
    setEventHistory(prev => [testEvt, ...prev.slice(0, 29)]);
    playTradeLifecycleAlarm(type);
  };

  return (
    <>
      {/* Top Banner when an event is active */}
      {activeEvent && (
        <div 
          id="trade-execution-live-banner"
          className={`w-full py-3 px-4 rounded-xl border transition-all duration-300 shadow-xl flex flex-col gap-2.5 animate-in fade-in slide-in-from-top-2 font-mono ${
            activeEvent.type === 'TAKE_PROFIT'
              ? 'bg-emerald-950/95 border-emerald-500/80 text-emerald-200 shadow-emerald-950/40'
              : activeEvent.type === 'STOP_LOSS'
              ? 'bg-rose-950/95 border-rose-500/80 text-rose-200 shadow-rose-950/40'
              : activeEvent.type === 'NEAR_TRIGGER'
              ? 'bg-sky-950/95 border-sky-500/80 text-sky-200 shadow-sky-950/40'
              : 'bg-amber-950/95 border-amber-500/80 text-amber-200 shadow-amber-950/40'
          }`}
        >
          {/* Main banner row */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            {/* Left info */}
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-xl border shrink-0 ${
                activeEvent.type === 'TAKE_PROFIT'
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 animate-pulse'
                  : activeEvent.type === 'STOP_LOSS'
                  ? 'bg-rose-500/20 text-rose-400 border-rose-500/40 animate-pulse'
                  : activeEvent.type === 'NEAR_TRIGGER'
                  ? 'bg-sky-500/20 text-sky-400 border-sky-500/40 animate-pulse'
                  : 'bg-amber-500/20 text-amber-400 border-amber-500/40 animate-pulse'
              }`}>
                {activeEvent.type === 'TAKE_PROFIT' && <Target className="w-5 h-5" />}
                {activeEvent.type === 'STOP_LOSS' && <ShieldAlert className="w-5 h-5" />}
                {activeEvent.type === 'NEAR_TRIGGER' && <Radio className="w-5 h-5" />}
                {activeEvent.type === 'TRADE_TRIGGERED' && <Zap className="w-5 h-5" />}
              </div>

              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-white text-[11px] uppercase px-2 py-0.5 rounded bg-black/50 border border-white/10">
                    {activeEvent.type === 'TAKE_PROFIT' && `🎯 ${activeEvent.targetRatioLabel || 'TAKE PROFIT'} ATINGIDO`}
                    {activeEvent.type === 'STOP_LOSS' && '🛡️ STOP LOSS ATINGIDO'}
                    {activeEvent.type === 'NEAR_TRIGGER' && '📡 PERTO DE ACIONAR (IMINENTE)'}
                    {activeEvent.type === 'TRADE_TRIGGERED' && '⚡ TRADE ACIONADO'}
                  </span>
                  <span className="font-bold text-white text-sm">
                    {activeEvent.symbol}
                  </span>
                  <span className="text-xs opacity-75">
                    ({activeEvent.name})
                  </span>
                  {activeEvent.pnlPercent !== undefined && activeEvent.pnlPercent !== null && activeEvent.type === 'TAKE_PROFIT' && (
                    <span className="text-xs font-bold text-emerald-300 bg-emerald-500/25 border border-emerald-500/40 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                      +{(activeEvent.pnlPercent ?? 0).toFixed(2)}% LUCRO
                    </span>
                  )}
                  {activeEvent.distancePercent !== undefined && activeEvent.type === 'NEAR_TRIGGER' && (
                    <span className="text-xs font-bold text-sky-300 bg-sky-500/25 border border-sky-500/40 px-2 py-0.5 rounded-full">
                      Distância: apenas {activeEvent.distancePercent.toFixed(2)}%
                    </span>
                  )}
                </div>

                <div className="text-xs mt-1 opacity-90 font-sans">
                  {activeEvent.message}
                </div>
              </div>
            </div>

            {/* Right actions */}
            <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
              <button
                onClick={() => {
                  onSelectSymbol(activeEvent.symbol);
                  setTimeout(() => {
                    const el = document.getElementById('coin-analysis-section');
                    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }, 50);
                }}
                className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition"
              >
                <span>Ver no Gráfico</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={toggleMute}
                className="p-1.5 rounded-lg bg-black/30 hover:bg-black/50 text-white/80 transition"
                title={isMuted ? 'Alarme silenciado. Clique para ativar som' : 'Alarme com som ativo. Clique para silenciar'}
              >
                {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
              </button>

              <button
                onClick={() => setActiveEvent(null)}
                className="p-1.5 rounded-lg bg-black/30 hover:bg-black/50 text-white/80 transition"
                title="Fechar aviso"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Fibonacci 5 Targets Progress Bar when targets exist */}
          {activeEvent.fibonacciTargets && activeEvent.fibonacciTargets.length === 5 && (
            <div className="pt-2 border-t border-white/10 flex items-center gap-2 overflow-x-auto text-[10px]">
              <span className="text-slate-400 shrink-0 font-bold uppercase tracking-wider text-[9px] flex items-center gap-1">
                <Layers className="w-3 h-3 text-cyan-400" />
                Alvos Fibonacci:
              </span>
              <div className="flex items-center gap-1.5 flex-wrap">
                {activeEvent.fibonacciTargets.map((fibo) => {
                  const isHit = activeEvent.targetLevel !== undefined 
                    ? fibo.level <= activeEvent.targetLevel 
                    : fibo.isHit;
                  const isCurrentHit = activeEvent.targetLevel === fibo.level;

                  return (
                    <div
                      key={fibo.level}
                      className={`px-2 py-0.5 rounded border transition flex items-center gap-1 ${
                        isCurrentHit
                          ? 'bg-emerald-500/30 border-emerald-400 text-emerald-200 font-bold ring-1 ring-emerald-400 animate-pulse'
                          : isHit
                          ? 'bg-emerald-950/60 border-emerald-600/50 text-emerald-300'
                          : 'bg-black/30 border-white/10 text-slate-400'
                      }`}
                    >
                      <span>{fibo.ratioLabel.split(' ')[0]}</span>
                      <span className="opacity-70">${fibo.price}</span>
                      <span className={`font-bold ${isHit ? 'text-emerald-400' : 'text-slate-500'}`}>
                        ({fibo.pnlPercent > 0 ? '+' : ''}{fibo.pnlPercent.toFixed(1)}%)
                      </span>
                      {isHit && <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Persistent Bar for Alarm Quick Controls & History Trigger */}
      <div 
        id="trade-alarm-control-bar"
        className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 flex flex-col gap-2.5 font-mono text-xs shadow-md"
      >
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-between sm:justify-start">
            <div className="flex items-center gap-2">
              <div className={`p-1.5 rounded-lg ${isMuted ? 'bg-slate-800 text-slate-500' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'}`}>
                <Bell className="w-4 h-4" />
              </div>
              <div>
                <span className="font-bold text-white">Alarme em Tempo Real:</span>
                <span className="text-slate-400 ml-1.5 hidden sm:inline">
                  5 Alvos Fibonacci, Execução Iminente e Gestão 1% de Risco.
                </span>
              </div>
            </div>

            <button
              id="btn-toggle-trade-alarm-mute"
              onClick={toggleMute}
              className={`px-2.5 py-1 rounded-lg border font-bold text-[11px] flex items-center gap-1.5 transition ${
                isMuted
                  ? 'bg-rose-500/10 border-rose-500/30 text-rose-400 hover:bg-rose-500/20'
                  : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'
              }`}
            >
              {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
              <span>{isMuted ? 'Mudo' : 'Som Ativo'}</span>
            </button>
          </div>

          {/* Test Alarms and History Buttons */}
          <div className="flex items-center gap-1.5 flex-wrap self-end sm:self-auto">
            <span className="text-[10px] text-slate-500 uppercase tracking-wider">Testar Alarme:</span>
            
            <button
              onClick={() => handleTestAlarm('NEAR_TRIGGER')}
              className="px-2 py-1 rounded bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/30 text-sky-300 text-[11px] flex items-center gap-1 transition"
              title="Simular alarme de Trade Perto de ser Acionado"
            >
              <Radio className="w-3 h-3 text-sky-400" />
              <span>Perto de Acionar</span>
            </button>

            <button
              onClick={() => handleTestAlarm('TRADE_TRIGGERED')}
              className="px-2 py-1 rounded bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 text-[11px] flex items-center gap-1 transition"
              title="Simular disparo de alarme de Trade Acionado"
            >
              <Zap className="w-3 h-3 text-amber-400" />
              <span>Acionado</span>
            </button>

            <button
              onClick={() => handleTestAlarm('TAKE_PROFIT')}
              className="px-2 py-1 rounded bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-[11px] flex items-center gap-1 transition"
              title="Simular disparo de Take Profit em Fibonacci com porcentagem de lucro"
            >
              <Target className="w-3 h-3 text-emerald-400" />
              <span>Take Profit Fibo</span>
            </button>

            <button
              onClick={() => handleTestAlarm('STOP_LOSS')}
              className="px-2 py-1 rounded bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 text-[11px] flex items-center gap-1 transition"
              title="Simular disparo de alarme de Stop Loss Atingido"
            >
              <ShieldAlert className="w-3 h-3 text-rose-400" />
              <span>Stop Loss</span>
            </button>

            {eventHistory.length > 0 && (
              <button
                onClick={() => setShowHistoryModal(true)}
                className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-[11px] flex items-center gap-1 transition ml-1"
              >
                <Clock className="w-3 h-3 text-sky-400" />
                <span>Histórico ({eventHistory.length})</span>
              </button>
            )}
          </div>
        </div>

        {/* Section: Radar of Trades Near Trigger */}
        {nearTriggerTrades.length > 0 && (
          <div className="pt-2.5 border-t border-slate-800/80">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-sky-500"></span>
                </span>
                <span className="font-bold text-sky-400 text-xs tracking-wide uppercase flex items-center gap-1">
                  <Radio className="w-3.5 h-3.5" />
                  Radar: Trades Próximos de Serem Acionados ({nearTriggerTrades.length})
                </span>
              </div>
              <button
                onClick={() => setShowNearRadar(prev => !prev)}
                className="text-[11px] text-slate-400 hover:text-white transition"
              >
                {showNearRadar ? 'Recolher' : 'Expandir'}
              </button>
            </div>

            {showNearRadar && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                {nearTriggerTrades.slice(0, 3).map(({ signal, distancePct, targets }) => {
                  const isLong = signal.decision === 'COMPRA';
                  return (
                    <div 
                      key={signal.id}
                      onClick={() => onSelectSymbol(signal.symbol)}
                      className="bg-slate-950/70 border border-sky-500/30 hover:border-sky-500/60 rounded-lg p-2.5 cursor-pointer transition flex flex-col justify-between gap-1.5 group"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            isLong ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                          }`}>
                            {signal.decision}
                          </span>
                          <span className="font-bold text-white text-xs group-hover:text-sky-300 transition">
                            {signal.symbol}
                          </span>
                        </div>
                        <div className="text-[11px] font-bold text-sky-400 bg-sky-500/15 border border-sky-500/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Radio className="w-3 h-3 text-sky-400 animate-pulse" />
                          <span>Faltam {distancePct}%</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-slate-400">
                        <span>Preço: <strong className="text-white">${signal.currentPrice}</strong></span>
                        <span>Gatilho: <strong className="text-amber-300">${signal.entryPrice}</strong></span>
                        <span>Stop: <strong className="text-rose-400">${signal.stopLoss}</strong></span>
                      </div>

                      {/* 5 Fibonacci Targets Pills */}
                      <div className="flex items-center gap-1 overflow-x-auto pt-1 border-t border-slate-800/60 text-[9px]">
                        <span className="text-slate-500 shrink-0">Alvos:</span>
                        {targets.map(t => (
                          <span 
                            key={t.level}
                            className={`px-1 rounded border ${
                              t.level === 1 
                                ? 'bg-amber-500/10 text-amber-300 border-amber-500/20 font-bold' 
                                : 'bg-slate-900 text-slate-400 border-slate-800'
                            }`}
                            title={`${t.ratioLabel}: $${t.price} (+${t.pnlPercent}%)`}
                          >
                            TP{t.level}: +{t.pnlPercent.toFixed(1)}%
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* History Modal */}
      {showHistoryModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-5 shadow-2xl font-mono">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Bell className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-white text-sm">
                  Histórico de Disparos de Alarme ({eventHistory.length})
                </h3>
              </div>
              <button
                onClick={() => setShowHistoryModal(false)}
                className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-3 max-h-80 overflow-y-auto space-y-2 pr-1 divide-y divide-slate-800/50">
              {eventHistory.map((evt) => (
                <div 
                  key={evt.id} 
                  className="pt-2 flex flex-col gap-1 text-xs hover:bg-slate-800/40 p-2 rounded cursor-pointer transition"
                  onClick={() => {
                    onSelectSymbol(evt.symbol);
                    setShowHistoryModal(false);
                    setTimeout(() => {
                      const el = document.getElementById('coin-analysis-section');
                      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }, 50);
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        evt.type === 'TAKE_PROFIT' 
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                          : evt.type === 'STOP_LOSS'
                          ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                          : evt.type === 'NEAR_TRIGGER'
                          ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
                          : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                      }`}>
                        {evt.type === 'TAKE_PROFIT' ? (evt.targetRatioLabel ? evt.targetRatioLabel.split(' ')[0] : 'TP') : evt.type === 'STOP_LOSS' ? 'SL' : evt.type === 'NEAR_TRIGGER' ? 'PERTO' : 'ENTRADA'}
                      </span>
                      <span className="font-bold text-white">{evt.symbol}</span>
                      {evt.pnlPercent !== undefined && evt.type === 'TAKE_PROFIT' && (
                        <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/15 px-1.5 py-0.2 rounded">
                          +{evt.pnlPercent.toFixed(2)}%
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-500 whitespace-nowrap">
                      {new Date(evt.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                  </div>
                  
                  <div className="text-[11px] text-slate-300 font-sans">
                    {evt.message}
                  </div>

                  {/* Target pills in history */}
                  {evt.fibonacciTargets && evt.fibonacciTargets.length === 5 && (
                    <div className="flex items-center gap-1 overflow-x-auto pt-1 text-[9px]">
                      {evt.fibonacciTargets.map(t => {
                        const hit = evt.targetLevel !== undefined ? t.level <= evt.targetLevel : t.isHit;
                        return (
                          <span
                            key={t.level}
                            className={`px-1 rounded border ${
                              hit 
                                ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300' 
                                : 'bg-black/30 border-slate-800 text-slate-500'
                            }`}
                          >
                            TP{t.level}: ${t.price} (+{t.pnlPercent.toFixed(1)}%)
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-4 pt-3 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setShowHistoryModal(false)}
                className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
