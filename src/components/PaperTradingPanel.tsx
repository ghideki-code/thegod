import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, BarChart3, Play, RotateCcw, Square, Target, TrendingDown, TrendingUp } from 'lucide-react';

type PaperPosition = {
  id: string;
  symbol: string;
  direction: 'LONG' | 'SHORT';
  entryPrice: number;
  stopLoss: number;
  takeProfits: { tp1: number; tp2: number; tp3: number };
  remainingQuantity: number;
  quantity: number;
  unrealizedPnl: number;
  tp1Hit: boolean;
  tp2Hit: boolean;
  breakevenActivated: boolean;
};

type PaperState = {
  account: {
    initialCapital: number;
    equity: number;
    realizedPnl: number;
    unrealizedPnl: number;
    feesPaid: number;
    slippagePaid: number;
    maxDrawdownPercent: number;
    halted: boolean;
    lastMarkPrice: number | null;
  };
  positions: PaperPosition[];
  history: Array<PaperPosition & { realizedPnl: number; closeReason: string | null }>;
  stats: {
    totalTrades: number;
    winningTrades: number;
    losingTrades: number;
    winRatePercent: number;
    profitFactor: number;
    netPnl: number;
    averageR: number;
    bestTradePnl: number;
    worstTradePnl: number;
    tp1HitRatePercent: number;
    tp2HitRatePercent: number;
  };
};

type PaperResponse = { success: boolean; running: boolean; lastError: string | null; state: PaperState };

const money = (v: number) => Number.isFinite(v) ? `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—';
const price = (v: number) => Number.isFinite(v) ? v.toLocaleString('en-US', { maximumFractionDigits: 2 }) : '—';

export function PaperTradingPanel() {
  const [data, setData] = useState<PaperResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/paper/status');
      if (res.ok) setData(await res.json());
    } catch { /* server unavailable while app is starting */ }
  }, []);

  useEffect(() => {
    refresh();
    const timer = window.setInterval(refresh, 3000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const command = async (path: string) => {
    setBusy(true);
    try {
      const res = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
      const next = await res.json();
      if (next.state) setData(next);
      else await refresh();
    } finally {
      setBusy(false);
    }
  };

  const state = data?.state;
  const account = state?.account;
  const position = state?.positions?.[0];
  const pnl = (account?.realizedPnl ?? 0) + (account?.unrealizedPnl ?? 0);
  const pnlPositive = pnl >= 0;
  const progress = useMemo(() => position ? Math.max(0, Math.min(100, position.quantity > 0 ? (1 - position.remainingQuantity / position.quantity) * 100 : 0)) : 0, [position]);

  return (
    <section className="fixed bottom-4 right-4 z-50 w-[min(440px,calc(100vw-2rem))] rounded-2xl border border-slate-700 bg-slate-950/95 shadow-2xl shadow-black/50 backdrop-blur-xl overflow-hidden font-mono">
      <header className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-900/90">
        <button onClick={() => setCollapsed(v => !v)} className="flex items-center gap-2 text-left">
          <span className={`h-2.5 w-2.5 rounded-full ${data?.running ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
          <span className="text-sm font-bold text-white">PAPER TRADING</span>
          <span className="text-[10px] text-slate-500">BTC/USDT • REAL OHLCV</span>
        </button>
        <span className={`text-[10px] px-2 py-1 rounded border ${account?.halted ? 'text-rose-300 border-rose-500/40 bg-rose-500/10' : data?.running ? 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10' : 'text-slate-400 border-slate-700'}`}>
          {account?.halted ? 'HALTED' : data?.running ? 'RUNNING' : 'STOPPED'}
        </span>
      </header>

      {!collapsed && (
        <div className="p-4 space-y-3 max-h-[70vh] overflow-y-auto">
          <div className="grid grid-cols-3 gap-2">
            <Metric label="EQUITY" value={money(account?.equity ?? 0)} />
            <Metric label="P&L" value={`${pnlPositive ? '+' : ''}${money(pnl)}`} positive={pnlPositive} />
            <Metric label="DD MAX" value={`${(account?.maxDrawdownPercent ?? 0).toFixed(2)}%`} />
          </div>

          <div className="grid grid-cols-3 gap-2 text-[10px]">
            <div className="rounded-lg bg-slate-900 border border-slate-800 p-2"><span className="text-slate-500 block">REALIZADO</span><b>{money(account?.realizedPnl ?? 0)}</b></div>
            <div className="rounded-lg bg-slate-900 border border-slate-800 p-2"><span className="text-slate-500 block">NÃO REAL.</span><b>{money(account?.unrealizedPnl ?? 0)}</b></div>
            <div className="rounded-lg bg-slate-900 border border-slate-800 p-2"><span className="text-slate-500 block">FEES+SLIP</span><b>{money((account?.feesPaid ?? 0) + (account?.slippagePaid ?? 0))}</b></div>
          </div>

          {position ? (
            <div className="rounded-xl border border-slate-700 bg-slate-900/70 p-3 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {position.direction === 'LONG' ? <TrendingUp className="w-4 h-4 text-emerald-400" /> : <TrendingDown className="w-4 h-4 text-rose-400" />}
                  <b className={position.direction === 'LONG' ? 'text-emerald-300' : 'text-rose-300'}>{position.direction}</b>
                  <span className="text-xs text-slate-400">{position.symbol}</span>
                </div>
                <span className="text-xs">{money(position.unrealizedPnl)}</span>
              </div>
              <div className="grid grid-cols-4 gap-2 text-[10px]">
                <Level label="ENTRY" value={position.entryPrice} />
                <Level label="SL" value={position.stopLoss} />
                <Level label="TP1" value={position.takeProfits.tp1} active={position.tp1Hit} />
                <Level label="TP2" value={position.takeProfits.tp2} active={position.tp2Hit} />
              </div>
              <div className="flex items-center justify-between text-[10px] text-slate-400"><span>TP3 {price(position.takeProfits.tp3)}</span><span>{position.breakevenActivated ? 'BREAKEVEN ATIVO' : 'BE aguardando TP1'}</span></div>
              <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden"><div className="h-full bg-emerald-400 transition-all" style={{ width: `${progress}%` }} /></div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-700 p-5 text-center text-xs text-slate-500">Nenhuma posição aberta. O motor aguarda um sinal válido.</div>
          )}

          <div className="grid grid-cols-4 gap-2">
            <Stat label="TRADES" value={state?.stats.totalTrades ?? 0} />
            <Stat label="WIN RATE" value={`${(state?.stats.winRatePercent ?? 0).toFixed(1)}%`} />
            <Stat label="PF" value={Number.isFinite(state?.stats.profitFactor ?? 0) ? (state?.stats.profitFactor ?? 0).toFixed(2) : '∞'} />
            <Stat label="AVG R" value={`${(state?.stats.averageR ?? 0).toFixed(2)}R`} />
          </div>

          <div className="flex gap-2">
            <button disabled={busy || !!account?.halted} onClick={() => command('/api/paper/start')} className="flex-1 px-3 py-2 rounded-lg bg-emerald-500 text-slate-950 font-bold text-xs disabled:opacity-40 flex items-center justify-center gap-1.5"><Play className="w-3.5 h-3.5" />INICIAR</button>
            <button disabled={busy} onClick={() => command('/api/paper/stop')} className="px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 font-bold text-xs disabled:opacity-40 flex items-center gap-1.5"><Square className="w-3.5 h-3.5" />PARAR</button>
            <button disabled={busy} onClick={() => command('/api/paper/reset')} className="px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 font-bold text-xs disabled:opacity-40 flex items-center gap-1.5"><RotateCcw className="w-3.5 h-3.5" />RESET</button>
          </div>

          <div className="flex items-center justify-between text-[10px] text-slate-500"><span className="flex items-center gap-1"><Activity className="w-3 h-3" />Mark {price(account?.lastMarkPrice ?? 0)}</span><span>TP1 {state?.stats.tp1HitRatePercent.toFixed(1)}% • TP2 {state?.stats.tp2HitRatePercent.toFixed(1)}%</span></div>
          {data?.lastError && <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-300 p-2 text-[10px]">Erro do loop: {data.lastError}</div>}
        </div>
      )}
    </section>
  );
}

function Metric({ label, value, positive }: { label: string; value: string; positive?: boolean }) {
  return <div className="rounded-xl bg-slate-900 border border-slate-800 p-2.5"><span className="block text-[9px] text-slate-500">{label}</span><b className={`text-xs ${positive === true ? 'text-emerald-300' : positive === false ? 'text-rose-300' : 'text-white'}`}>{value}</b></div>;
}
function Stat({ label, value }: { label: string; value: string | number }) { return <div className="text-center rounded-lg bg-slate-900/70 border border-slate-800 p-2"><div className="text-[9px] text-slate-500">{label}</div><div className="text-xs font-bold text-slate-200">{value}</div></div>; }
function Level({ label, value, active }: { label: string; value: number; active?: boolean }) { return <div className={`rounded-lg p-2 border ${active ? 'border-emerald-500/40 bg-emerald-500/10' : 'border-slate-800 bg-slate-950'}`}><span className="block text-slate-500">{label}</span><b className="text-slate-200">{price(value)}</b></div>; }
