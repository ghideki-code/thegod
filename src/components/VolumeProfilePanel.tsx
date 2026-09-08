import React, { useState } from 'react';
import { 
  VolumeProfileResult, 
  VolumeProfileBin 
} from '../utils/volumeProfile';
import { 
  BarChart3, 
  Target, 
  Layers, 
  Info, 
  Zap, 
  Activity, 
  CheckCircle2, 
  TrendingUp, 
  TrendingDown,
  ArrowRight,
  ShieldAlert
} from 'lucide-react';

interface VolumeProfilePanelProps {
  vpData: VolumeProfileResult | null;
  symbol: string;
  timeframeName: string;
  currentPrice: number;
}

export const VolumeProfilePanel: React.FC<VolumeProfilePanelProps> = ({
  vpData,
  symbol,
  timeframeName,
  currentPrice,
}) => {
  const [hoveredBin, setHoveredBin] = useState<VolumeProfileBin | null>(null);
  const [filterType, setFilterType] = useState<'ALL' | 'KEY_NODES'>('ALL');

  if (!vpData) {
    return (
      <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 text-center text-xs font-mono text-slate-500">
        Dados insuficientes para calcular o Volume Profile deste ativo.
      </div>
    );
  }

  const {
    bins,
    pocPrice,
    pocPercent,
    vahPrice,
    valPrice,
    totalVolume,
    hvnNodes,
    lvnNodes,
    currentPriceStatus,
  } = vpData;

  const maxBinVol = Math.max(...bins.map((b) => b.totalVolume)) || 1;

  // Render price format helper
  const formatPrice = (p: number) => {
    if (p >= 1000) return `$${p.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 2 })}`;
    if (p >= 1) return `$${p.toFixed(3)}`;
    return `$${p.toFixed(6)}`;
  };

  const displayedBins = filterType === 'KEY_NODES' 
    ? bins.filter(b => b.isPOC || b.nodeType === 'HVN' || b.nodeType === 'LVN')
    : [...bins].reverse(); // from highest price to lowest price for natural top-to-bottom chart order

  return (
    <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-4 font-mono">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800/80">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400">
            <BarChart3 className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <span>Volume Profile & Zonas de Liquidez Wyckoff</span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                {timeframeName}
              </span>
            </h3>
            <p className="text-[11px] text-slate-400">
              Mapeamento de Point of Control (POC), Value Area (70%) e Vácuos de Liquidez
            </p>
          </div>
        </div>

        {/* Filter Toggle */}
        <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 p-1 rounded-lg text-xs self-start sm:self-auto">
          <button
            onClick={() => setFilterType('ALL')}
            className={`px-2 py-1 rounded transition text-[11px] ${
              filterType === 'ALL' 
                ? 'bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30' 
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Todos os Níveis
          </button>
          <button
            onClick={() => setFilterType('KEY_NODES')}
            className={`px-2 py-1 rounded transition text-[11px] ${
              filterType === 'KEY_NODES' 
                ? 'bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30' 
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Apenas POC / HVN / LVN
          </button>
        </div>
      </div>

      {/* Top Cards: Key Wyckoff Levels */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
        {/* POC Card */}
        <div className="p-3 bg-amber-500/5 border border-amber-500/30 rounded-lg relative overflow-hidden">
          <div className="flex items-center justify-between text-[10px] text-amber-400 font-bold uppercase mb-1">
            <span className="flex items-center gap-1">
              <Target className="w-3.5 h-3.5" />
              POC (Point of Control)
            </span>
            <span>{pocPercent.toFixed(1)}% Vol</span>
          </div>
          <div className="text-base font-bold text-amber-300">
            {formatPrice(pocPrice)}
          </div>
          <div className="text-[10px] text-slate-400 mt-1">
            Máxima liquidez e consenso institucional
          </div>
        </div>

        {/* VAH Card */}
        <div className="p-3 bg-slate-900 border border-sky-500/30 rounded-lg">
          <div className="flex items-center justify-between text-[10px] text-sky-400 font-bold uppercase mb-1">
            <span className="flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5" />
              VAH (Value Area High)
            </span>
            <span>Teto 70%</span>
          </div>
          <div className="text-base font-bold text-sky-300">
            {formatPrice(vahPrice)}
          </div>
          <div className="text-[10px] text-slate-400 mt-1">
            Resistência de valor / Breakout
          </div>
        </div>

        {/* VAL Card */}
        <div className="p-3 bg-slate-900 border border-emerald-500/30 rounded-lg">
          <div className="flex items-center justify-between text-[10px] text-emerald-400 font-bold uppercase mb-1">
            <span className="flex items-center gap-1">
              <TrendingDown className="w-3.5 h-3.5" />
              VAL (Value Area Low)
            </span>
            <span>Piso 70%</span>
          </div>
          <div className="text-base font-bold text-emerald-300">
            {formatPrice(valPrice)}
          </div>
          <div className="text-[10px] text-slate-400 mt-1">
            Suporte de valor / Zona de Spring
          </div>
        </div>

        {/* Wyckoff State Card */}
        <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg flex flex-col justify-between">
          <div className="text-[10px] text-slate-400 uppercase font-bold flex items-center gap-1">
            <Activity className="w-3.5 h-3.5 text-amber-400" />
            Posição do Preço Atual
          </div>
          <div>
            <div className={`text-xs font-bold ${currentPriceStatus.color}`}>
              {currentPriceStatus.label}
            </div>
            <div className="text-[10px] text-slate-400 truncate mt-0.5">
              Preço: {formatPrice(currentPrice)}
            </div>
          </div>
        </div>
      </div>

      {/* Wyckoff Contextual Guidance Banner */}
      <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-lg text-xs leading-relaxed flex items-start gap-2.5">
        <Zap className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold text-slate-200">Diagnóstico de Liquidez Wyckoff: </span>
          <span className="text-slate-300">{currentPriceStatus.description} </span>
          <span className="text-amber-300 font-medium">{currentPriceStatus.wyckoffContext}</span>
        </div>
      </div>

      {/* Visual Histogram Section */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
          <span className="flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-amber-400" />
            <span>Perfil de Volume por Faixa de Preço (Ordem Decrescente de Cotação)</span>
          </span>
          <div className="flex items-center gap-3 text-[10px]">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500/80"></span> Comprador
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-sm bg-rose-500/80"></span> Vendedor
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-sm bg-amber-400"></span> POC
            </span>
          </div>
        </div>

        {/* Histogram Bars Container */}
        <div className="bg-slate-900/90 border border-slate-800/80 rounded-lg p-2.5 space-y-1 max-h-[320px] overflow-y-auto no-scrollbar">
          {displayedBins.map((bin) => {
            const isHovered = hoveredBin?.index === bin.index;
            const isCurrentPriceInBin = currentPrice >= bin.lowPrice && currentPrice <= bin.highPrice;
            const barWidthPercent = Math.max(3, (bin.totalVolume / maxBinVol) * 100);
            const buyFraction = bin.totalVolume > 0 ? (bin.buyVolume / bin.totalVolume) * 100 : 50;
            const sellFraction = 100 - buyFraction;

            return (
              <div
                key={`vp-bin-${bin.index}`}
                onMouseEnter={() => setHoveredBin(bin)}
                onMouseLeave={() => setHoveredBin(null)}
                className={`flex items-center gap-2 py-1 px-2 rounded transition cursor-pointer text-[11px] ${
                  bin.isPOC 
                    ? 'bg-amber-500/15 border border-amber-500/50 shadow-sm' 
                    : isCurrentPriceInBin
                    ? 'bg-sky-500/10 border border-sky-500/40'
                    : isHovered
                    ? 'bg-slate-800 border border-slate-700'
                    : 'hover:bg-slate-800/50'
                }`}
              >
                {/* Price Label & Badge */}
                <div className="w-28 shrink-0 flex items-center justify-between">
                  <span className={`font-mono font-bold ${bin.isPOC ? 'text-amber-300' : isCurrentPriceInBin ? 'text-sky-300' : 'text-slate-300'}`}>
                    {formatPrice(bin.midPrice)}
                  </span>

                  {bin.isPOC && (
                    <span className="px-1.5 py-0.2 rounded bg-amber-400 text-slate-950 text-[9px] font-black tracking-wider">
                      POC
                    </span>
                  )}
                  {bin.nodeType === 'HVN' && (
                    <span className="px-1 py-0.2 rounded bg-sky-500/20 text-sky-300 border border-sky-500/40 text-[9px]">
                      HVN
                    </span>
                  )}
                  {bin.nodeType === 'LVN' && (
                    <span className="px-1 py-0.2 rounded bg-purple-500/20 text-purple-300 border border-purple-500/40 text-[9px]" title="Vácuo de Liquidez">
                      LVN
                    </span>
                  )}
                  {isCurrentPriceInBin && !bin.isPOC && (
                    <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-ping" title="Preço Atual"></span>
                  )}
                </div>

                {/* Horizontal Volume Bar */}
                <div className="flex-1 h-3.5 bg-slate-950 rounded overflow-hidden flex items-center relative">
                  <div 
                    className="h-full flex transition-all duration-300"
                    style={{ width: `${barWidthPercent}%` }}
                  >
                    {/* Buy Volume Segment */}
                    <div 
                      className={`h-full ${bin.isPOC ? 'bg-amber-400' : 'bg-emerald-500/80'}`}
                      style={{ width: `${buyFraction}%` }}
                    />
                    {/* Sell Volume Segment */}
                    <div 
                      className={`h-full ${bin.isPOC ? 'bg-amber-600' : 'bg-rose-500/80'}`}
                      style={{ width: `${sellFraction}%` }}
                    />
                  </div>

                  {/* Value Area Marker */}
                  {bin.isValueArea && (
                    <div className="absolute right-1 top-0 bottom-0 flex items-center">
                      <span className="text-[8px] text-slate-500 font-mono">VA</span>
                    </div>
                  )}
                </div>

                {/* Volume % Column */}
                <div className="w-12 text-right shrink-0 text-[10px] text-slate-400 font-mono">
                  {bin.volumePercent.toFixed(1)}%
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Hovered Bin Details Tooltip / Info Card */}
      {hoveredBin && (
        <div className="p-2.5 bg-slate-900 border border-amber-500/30 rounded-lg text-xs flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-amber-300 font-bold">Faixa: {formatPrice(hoveredBin.lowPrice)} - {formatPrice(hoveredBin.highPrice)}</span>
            <span className="text-slate-400">|</span>
            <span className="text-emerald-400">Compras: {((hoveredBin.buyVolume / hoveredBin.totalVolume) * 100).toFixed(0)}%</span>
            <span className="text-slate-400">/</span>
            <span className="text-rose-400">Vendas: {((hoveredBin.sellVolume / hoveredBin.totalVolume) * 100).toFixed(0)}%</span>
          </div>
          <div className="text-[11px] text-slate-300">
            {hoveredBin.wyckoffInterpretation}
          </div>
        </div>
      )}

      {/* Wyckoff Liquidity Education Footnote */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px] text-slate-400 pt-1 border-t border-slate-800/80">
        <div className="p-2 bg-slate-900/40 rounded border border-slate-800 flex items-start gap-1.5">
          <span className="text-sky-400 font-bold">HVN (Alta Liquidez):</span>
          <span>Zonas de grande acumulação de contratos onde os grandes operadores absorvem liquidez, gerando fortes suportes/resistências.</span>
        </div>
        <div className="p-2 bg-slate-900/40 rounded border border-slate-800 flex items-start gap-1.5">
          <span className="text-purple-400 font-bold">LVN (Baixa Liquidez):</span>
          <span>Vácuos de ordens (Imbalance). O preço tende a atravessar esses níveis com extrema velocidade (fases de Markup e Markdown).</span>
        </div>
      </div>
    </div>
  );
};
