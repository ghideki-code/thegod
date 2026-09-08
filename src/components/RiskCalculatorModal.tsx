import React, { useState, useEffect } from 'react';
import { 
  TradeSignal 
} from '../types';
import { 
  X, 
  Calculator, 
  DollarSign, 
  Percent, 
  ShieldCheck, 
  ArrowUpRight, 
  Check,
  Zap
} from 'lucide-react';
import { 
  TradingExecutionStyle, 
  calculateTradingStyleParameters 
} from '../utils/technicalAnalysis';

interface RiskCalculatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  signal: TradeSignal | null;
  initialStyle?: TradingExecutionStyle;
}

export const RiskCalculatorModal: React.FC<RiskCalculatorModalProps> = ({
  isOpen,
  onClose,
  signal,
  initialStyle = 'DAY_TRADE',
}) => {
  const [activeStyle, setActiveStyle] = useState<TradingExecutionStyle>(initialStyle);
  const [equity, setEquity] = useState<number>(10000);
  const [riskPercent, setRiskPercent] = useState<number>(1.0); // 1% default
  const [entryPrice, setEntryPrice] = useState<number>(signal?.entryPrice || 100);
  const [stopLoss, setStopLoss] = useState<number>(signal?.stopLoss || 98);
  const [tp1, setTp1] = useState<number>(signal?.takeProfit1 || 104);
  const [tp2, setTp2] = useState<number>(signal?.takeProfit2 || 106);
  const [selectedFiboLevel, setSelectedFiboLevel] = useState<number>(1);

  useEffect(() => {
    if (signal) {
      const styles = calculateTradingStyleParameters(signal);
      const chosen = styles[activeStyle];
      setEntryPrice(chosen.entryPrice);
      setStopLoss(chosen.stopLoss);
      setTp1(chosen.takeProfit1);
      setTp2(chosen.takeProfit2);
      setRiskPercent(chosen.riskPercent);
      setSelectedFiboLevel(1);
    }
  }, [signal, activeStyle]);

  useEffect(() => {
    if (initialStyle) {
      setActiveStyle(initialStyle);
    }
  }, [initialStyle]);

  if (!isOpen || !signal) return null;

  const styleParams = calculateTradingStyleParameters(signal);
  const currentStyleData = styleParams[activeStyle];

  // Math
  const riskAmount = (equity * riskPercent) / 100;
  const stopDistance = Math.abs(entryPrice - stopLoss);
  const stopDistancePercent = entryPrice > 0 ? (stopDistance / entryPrice) * 100 : 0;
  const positionSizeUsd = stopDistancePercent > 0 ? (riskAmount / (stopDistancePercent / 100)) : 0;
  const positionUnits = entryPrice > 0 ? positionSizeUsd / entryPrice : 0;

  const rewardTP1 = Math.abs(tp1 - entryPrice);
  const rewardTP1Usd = positionUnits * rewardTP1;
  const rrTP1 = stopDistance > 0 ? (rewardTP1 / stopDistance).toFixed(2) : '0';

  const rewardTP2 = Math.abs(tp2 - entryPrice);
  const rewardTP2Usd = positionUnits * rewardTP2;
  const rrTP2 = stopDistance > 0 ? (rewardTP2 / stopDistance).toFixed(2) : '0';

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Calculator className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white font-mono flex items-center gap-1.5">
                Dimensionamento de Risco & Lote: {signal.symbol}
              </h3>
              <p className="text-[11px] text-slate-400">
                Regra Quantitativa: Stop calibrado pelo ATR • Risco máximo 1%
              </p>
            </div>
          </div>

          <button
            id="btn-close-risk-calc"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body Inputs */}
        <div className="p-5 space-y-4 text-xs font-mono">
          {/* Trading Style Quick Selectors */}
          <div>
            <span className="text-slate-400 block mb-1.5 text-[11px]">Modalidade Tática de Execução:</span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              {(['SCALP', 'DAY_TRADE', 'SWING_TRADE', 'POSITION_TRADE'] as TradingExecutionStyle[]).map((st) => {
                const item = styleParams[st];
                const isSelected = activeStyle === st;
                return (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setActiveStyle(st)}
                    className={`px-2 py-1.5 rounded-lg border text-left transition ${
                      isSelected
                        ? `${item.badgeColor} border-current ring-1 ring-amber-400/30`
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <div className="font-bold text-[10px] truncate">{item.badge}</div>
                    <div className="text-[9px] text-slate-400 mt-0.5">{item.atrMultipleStop} • {item.recommendedLeverage}</div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Equity */}
            <div>
              <label className="text-slate-400 block mb-1">Capital da Conta (USDT)</label>
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500">$</span>
                <input
                  type="number"
                  value={equity}
                  onChange={(e) => setEquity(Math.max(10, Number(e.target.value)))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-6 pr-3 py-1.5 text-slate-200 focus:outline-none focus:border-amber-500/50"
                />
              </div>
            </div>

            {/* Risk % */}
            <div>
              <label className="text-slate-400 block mb-1">Risco por Trade (%)</label>
              <div className="relative">
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500">%</span>
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  max="10"
                  value={riskPercent}
                  onChange={(e) => setRiskPercent(Math.max(0.1, Number(e.target.value)))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-3 pr-6 py-1.5 text-slate-200 focus:outline-none focus:border-amber-500/50"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-slate-400 block mb-1">Entrada</label>
              <input
                type="number"
                step="any"
                value={entryPrice}
                onChange={(e) => setEntryPrice(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-rose-400 block mb-1">Stop Loss (ATR)</label>
              <input
                type="number"
                step="any"
                value={stopLoss}
                onChange={(e) => setStopLoss(Number(e.target.value))}
                className="w-full bg-slate-950 border border-rose-500/30 rounded-lg px-2.5 py-1.5 text-rose-300 focus:outline-none"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-emerald-400 block">Alvo para Cálculo</label>
                <span className="text-[10px] text-amber-300">TP{selectedFiboLevel}</span>
              </div>
              <input
                type="number"
                step="any"
                value={tp1}
                onChange={(e) => setTp1(Number(e.target.value))}
                className="w-full bg-slate-950 border border-emerald-500/30 rounded-lg px-2.5 py-1.5 text-emerald-300 focus:outline-none"
              />
            </div>
          </div>

          {/* Quick Select 5 Fibonacci Targets */}
          {currentStyleData?.fibonacciTargets && currentStyleData.fibonacciTargets.length === 5 && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-slate-400 uppercase font-mono">
                  5 Alvos em Fibonacci (Projeções para Lote)
                </span>
                <span className="text-emerald-400 font-mono">Golden Ratio & Expansão</span>
              </div>
              <div className="grid grid-cols-5 gap-1.5">
                {currentStyleData.fibonacciTargets.map((fibo) => {
                  const isSelected = selectedFiboLevel === fibo.level;
                  return (
                    <button
                      key={fibo.level}
                      type="button"
                      onClick={() => {
                        setSelectedFiboLevel(fibo.level);
                        setTp1(fibo.price);
                      }}
                      className={`p-1.5 rounded-lg border text-center transition text-[10px] font-mono ${
                        isSelected
                          ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300 ring-1 ring-emerald-500/30 font-bold'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                      }`}
                    >
                      <div className="text-[9px] text-slate-500">TP{fibo.level} ({fibo.ratio}x)</div>
                      <div className="truncate font-bold text-slate-200">${fibo.price}</div>
                      <div className="text-[8px] text-emerald-400 font-semibold">+{fibo.pnlPercent}%</div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Results Card */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
              <span className="text-slate-400">Risco em Dinheiro:</span>
              <strong className="text-rose-400 font-bold">${riskAmount.toFixed(2)}</strong>
            </div>

            <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
              <span className="text-slate-400">Distância do Stop:</span>
              <strong className="text-slate-200">{stopDistancePercent.toFixed(2)}%</strong>
            </div>

            <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
              <span className="text-slate-400">Tamanho da Posição Sugerido:</span>
              <div className="text-right">
                <div className="text-amber-400 font-bold text-sm">
                  ${positionSizeUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </div>
                <div className="text-[10px] text-slate-500">
                  ≈ {positionUnits.toFixed(4)} {signal.symbol.split('/')[0]}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1 text-[11px]">
              <div className="p-2 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
                <span className="text-emerald-400 block">Lucro TP1 (1:{rrTP1})</span>
                <span className="text-emerald-300 font-bold text-xs">+${rewardTP1Usd.toFixed(2)}</span>
              </div>
              <div className="p-2 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
                <span className="text-emerald-400 block">Lucro TP2 (1:{rrTP2})</span>
                <span className="text-emerald-300 font-bold text-xs">+${rewardTP2Usd.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-lg transition"
          >
            Concluir Dimensionamento
          </button>
        </div>
      </div>
    </div>
  );
};
