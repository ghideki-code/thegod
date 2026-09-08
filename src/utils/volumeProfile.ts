import { Candle } from '../types';

export interface VolumeProfileBin {
  index: number;
  lowPrice: number;
  highPrice: number;
  midPrice: number;
  buyVolume: number;
  sellVolume: number;
  totalVolume: number;
  volumePercent: number;
  isPOC: boolean;
  isValueArea: boolean;
  nodeType: 'POC' | 'HVN' | 'LVN' | 'NORMAL';
  wyckoffInterpretation: string;
}

export interface VolumeProfileResult {
  bins: VolumeProfileBin[];
  pocPrice: number;
  pocVolume: number;
  pocPercent: number;
  vahPrice: number; // Value Area High (70%)
  valPrice: number; // Value Area Low (70%)
  totalVolume: number;
  hvnNodes: VolumeProfileBin[];
  lvnNodes: VolumeProfileBin[];
  currentPrice: number;
  currentPriceStatus: {
    zone: 'ABOVE_VAH' | 'NEAR_POC' | 'UPPER_VA' | 'LOWER_VA' | 'BELOW_VAL';
    label: string;
    description: string;
    wyckoffContext: string;
    color: string;
  };
}

/**
 * Computes a high-precision Volume Profile from candle data
 * with Wyckoff liquidity analysis (POC, VAH, VAL, HVN, LVN).
 */
export function calculateVolumeProfile(
  candles: Candle[],
  currentPrice: number,
  binsCount: number = 24
): VolumeProfileResult | null {
  if (!candles || candles.length === 0) return null;

  const lowPrices = candles.map((c) => c.low);
  const highPrices = candles.map((c) => c.high);

  const rawMin = Math.min(...lowPrices);
  const rawMax = Math.max(...highPrices);

  if (rawMin <= 0 || rawMax <= 0 || rawMin === rawMax) return null;

  // Add 0.3% padding
  const minPrice = rawMin * 0.997;
  const maxPrice = rawMax * 1.003;
  const priceRange = maxPrice - minPrice;
  const binHeight = priceRange / binsCount;

  // Initialize bins
  const bins: VolumeProfileBin[] = Array.from({ length: binsCount }, (_, i) => {
    const low = minPrice + i * binHeight;
    const high = low + binHeight;
    return {
      index: i,
      lowPrice: low,
      highPrice: high,
      midPrice: (low + high) / 2,
      buyVolume: 0,
      sellVolume: 0,
      totalVolume: 0,
      volumePercent: 0,
      isPOC: false,
      isValueArea: false,
      nodeType: 'NORMAL',
      wyckoffInterpretation: '',
    };
  });

  // Distribute candle volume across bins
  for (const candle of candles) {
    const cHigh = candle.high;
    const cLow = candle.low;
    const cVol = candle.volume || 1;
    const isBullish = candle.close >= candle.open;

    const span = Math.max(cHigh - cLow, 0.000001);

    for (let i = 0; i < binsCount; i++) {
      const bLow = bins[i].lowPrice;
      const bHigh = bins[i].highPrice;

      // Overlap between [cLow, cHigh] and [bLow, bHigh]
      const overlapStart = Math.max(cLow, bLow);
      const overlapEnd = Math.min(cHigh, bHigh);
      const overlap = Math.max(0, overlapEnd - overlapStart);

      if (overlap > 0) {
        const fraction = overlap / span;
        const allocatedVol = cVol * fraction;

        if (isBullish) {
          bins[i].buyVolume += allocatedVol * 0.65;
          bins[i].sellVolume += allocatedVol * 0.35;
        } else {
          bins[i].buyVolume += allocatedVol * 0.35;
          bins[i].sellVolume += allocatedVol * 0.65;
        }
        bins[i].totalVolume += allocatedVol;
      }
    }
  }

  const totalVolSum = bins.reduce((acc, b) => acc + b.totalVolume, 0) || 1;
  const avgVol = totalVolSum / binsCount;

  // Find POC
  let maxVol = 0;
  let pocIdx = 0;

  bins.forEach((b, idx) => {
    b.volumePercent = (b.totalVolume / totalVolSum) * 100;
    if (b.totalVolume > maxVol) {
      maxVol = b.totalVolume;
      pocIdx = idx;
    }
  });

  bins[pocIdx].isPOC = true;
  bins[pocIdx].nodeType = 'POC';

  // Value Area calculation (70% standard)
  const targetVol = totalVolSum * 0.7;
  let accumulatedVol = bins[pocIdx].totalVolume;
  bins[pocIdx].isValueArea = true;

  let upperIdx = pocIdx;
  let lowerIdx = pocIdx;

  while (accumulatedVol < targetVol && (upperIdx < binsCount - 1 || lowerIdx > 0)) {
    const nextUpperVol = upperIdx < binsCount - 1 ? bins[upperIdx + 1].totalVolume : -1;
    const nextLowerVol = lowerIdx > 0 ? bins[lowerIdx - 1].totalVolume : -1;

    if (nextUpperVol >= nextLowerVol && upperIdx < binsCount - 1) {
      upperIdx++;
      accumulatedVol += bins[upperIdx].totalVolume;
      bins[upperIdx].isValueArea = true;
    } else if (lowerIdx > 0) {
      lowerIdx--;
      accumulatedVol += bins[lowerIdx].totalVolume;
      bins[lowerIdx].isValueArea = true;
    } else if (upperIdx < binsCount - 1) {
      upperIdx++;
      accumulatedVol += bins[upperIdx].totalVolume;
      bins[upperIdx].isValueArea = true;
    } else {
      break;
    }
  }

  const vahPrice = bins[upperIdx].highPrice;
  const valPrice = bins[lowerIdx].lowPrice;
  const pocPrice = bins[pocIdx].midPrice;

  // Classify HVN vs LVN
  const hvnNodes: VolumeProfileBin[] = [];
  const lvnNodes: VolumeProfileBin[] = [];

  bins.forEach((b, idx) => {
    if (b.isPOC) {
      b.wyckoffInterpretation = 'Point of Control (POC): Nível de máxima acumulação e aceitação de valor institucional.';
      return;
    }

    if (b.totalVolume >= avgVol * 1.35) {
      b.nodeType = 'HVN';
      b.wyckoffInterpretation = 'High Volume Node (HVN): Forte liquidez institucional e zona de suporte/resistência por absorção.';
      hvnNodes.push(b);
    } else if (b.totalVolume <= avgVol * 0.45 && idx > 0 && idx < binsCount - 1) {
      b.nodeType = 'LVN';
      b.wyckoffInterpretation = 'Low Volume Node (LVN): Vácuo de liquidez / Rejeição Wyckoff. Preço se desloca com baixa fricção.';
      lvnNodes.push(b);
    } else {
      b.nodeType = 'NORMAL';
      b.wyckoffInterpretation = 'Zona de transição e equilíbrio de ordens secundárias.';
    }
  });

  // Current Price Wyckoff Diagnosis
  const pocTolerance = (vahPrice - valPrice) * 0.08 || currentPrice * 0.005;
  const isNearPOC = Math.abs(currentPrice - pocPrice) <= pocTolerance;

  let zone: 'ABOVE_VAH' | 'NEAR_POC' | 'UPPER_VA' | 'LOWER_VA' | 'BELOW_VAL';
  let label: string;
  let description: string;
  let wyckoffContext: string;
  let color: string;

  if (isNearPOC) {
    zone = 'NEAR_POC';
    label = 'Em Teste no POC';
    description = `Preço negociando a ${((currentPrice - pocPrice) / pocPrice * 100).toFixed(2)}% do POC ($${pocPrice >= 1 ? pocPrice.toFixed(2) : pocPrice.toFixed(4)}).`;
    wyckoffContext = 'Fase de Teste / Absorção Ativa: Alta concentração de liquidez. Operadores institucionais defendem este patamar.';
    color = 'text-amber-400';
  } else if (currentPrice > vahPrice) {
    zone = 'ABOVE_VAH';
    label = 'Acima da Value Area (VAH)';
    description = `Preço rompeu a fronteira superior de valor ($${vahPrice >= 1 ? vahPrice.toFixed(2) : vahPrice.toFixed(4)}).`;
    wyckoffContext = 'Fase de Expansão / Markup: Busca por nova liquidez externa ou potencial rejeição em Upthrust (UTAD).';
    color = 'text-emerald-400';
  } else if (currentPrice < valPrice) {
    zone = 'BELOW_VAL';
    label = 'Abaixo da Value Area (VAL)';
    description = `Preço testando patamares abaixo da Value Area ($${valPrice >= 1 ? valPrice.toFixed(2) : valPrice.toFixed(4)}).`;
    wyckoffContext = 'Zona de Liquidity Sweep / Spring: Monitorar reação rápida de absorção (Spring Wyckoff) ou continuidade de queda.';
    color = 'text-rose-400';
  } else if (currentPrice > pocPrice) {
    zone = 'UPPER_VA';
    label = 'Metade Superior da Value Area';
    description = 'Preço entre o POC e o VAH, com estrutura compradora preservada.';
    wyckoffContext = 'Acumulação / Markup Inicial: O POC atua como ímã de suporte dinâmico para os testes intradiários.';
    color = 'text-sky-400';
  } else {
    zone = 'LOWER_VA';
    label = 'Metade Inferior da Value Area';
    description = 'Preço entre o VAL e o POC, testando o interesse dos compradores.';
    wyckoffContext = 'Teste de Absorção: O preço busca liquidez no VAL enquanto o POC age como resistência imediata.';
    color = 'text-purple-400';
  }

  return {
    bins,
    pocPrice,
    pocVolume: bins[pocIdx].totalVolume,
    pocPercent: bins[pocIdx].volumePercent,
    vahPrice,
    valPrice,
    totalVolume: totalVolSum,
    hvnNodes,
    lvnNodes,
    currentPrice,
    currentPriceStatus: {
      zone,
      label,
      description,
      wyckoffContext,
      color,
    },
  };
}
