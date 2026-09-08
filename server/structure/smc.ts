import type { Candle } from '../../src/types.js';
import type { IndicatorSnapshot } from '../indicators/technicalIndicators.js';
import type { MarketStructureSnapshot } from './marketStructure.js';
import type { LiquiditySweep } from './marketStructure.js';
import type { SwingPoint } from './swingDetection.js';

export type SMCZoneType = 'bullish' | 'bearish';

export interface FairValueGap {
  type: SMCZoneType;
  index: number;
  timestamp: number;
  low: number;
  high: number;
  midpoint: number;
  sizePercent: number;
  filled: boolean;
  quality: number;
}

export interface OrderBlock {
  type: SMCZoneType;
  index: number;
  timestamp: number;
  low: number;
  high: number;
  midpoint: number;
  displacementPercent: number;
  mitigated: boolean;
  quality: number;
  sourceEvent: 'BOS' | 'CHoCH';
}

export interface BreakerBlock {
  type: SMCZoneType;
  sourceIndex: number;
  timestamp: number;
  low: number;
  high: number;
  midpoint: number;
}

export interface PremiumDiscount {
  swingHigh: number;
  swingLow: number;
  equilibrium: number;
  currentPrice: number;
  zone: 'premium' | 'discount' | 'equilibrium';
  positionPercent: number;
}

export interface LiquidityPool {
  type: 'buy-side' | 'sell-side';
  price: number;
  source: 'equal-highs' | 'equal-lows' | 'swing-high' | 'swing-low';
  strength: number;
}

export interface SMCAnalysis {
  fairValueGaps: FairValueGap[];
  orderBlocks: OrderBlock[];
  breakerBlocks: BreakerBlock[];
  premiumDiscount: PremiumDiscount | null;
  liquidityPools: LiquidityPool[];
  latestSweep: LiquiditySweep | null;
  bias: 'bullish' | 'bearish' | 'neutral';
}

function rangePercent(low: number, high: number): number {
  return low > 0 ? ((high - low) / low) * 100 : 0;
}

function displacementPercent(candle: Candle): number {
  const base = Math.max(Math.abs(candle.open), 1e-9);
  return Math.abs(candle.close - candle.open) / base * 100;
}

function detectFVGs(candles: Candle[], maxAge = 180): FairValueGap[] {
  const result: FairValueGap[] = [];
  const start = Math.max(2, candles.length - maxAge);
  for (let i = start; i < candles.length; i += 1) {
    const left = candles[i - 2];
    const middle = candles[i - 1];
    const right = candles[i];
    if (!left || !middle || !right) continue;

    if (right.low > left.high) {
      const low = left.high;
      const high = right.low;
      const gapSize = rangePercent(low, high);
      const filled = candles.slice(i + 1).some(c => c.low <= low);
      if (!filled && gapSize > 0) {
        result.push({
          type: 'bullish', index: i, timestamp: middle.timestamp, low, high,
          midpoint: (low + high) / 2, sizePercent: gapSize,
          filled, quality: Math.min(100, 35 + gapSize * 20),
        });
      }
    }

    if (right.high < left.low) {
      const low = right.high;
      const high = left.low;
      const gapSize = rangePercent(low, high);
      const filled = candles.slice(i + 1).some(c => c.high >= high);
      if (!filled && gapSize > 0) {
        result.push({
          type: 'bearish', index: i, timestamp: middle.timestamp, low, high,
          midpoint: (low + high) / 2, sizePercent: gapSize,
          filled, quality: Math.min(100, 35 + gapSize * 20),
        });
      }
    }
  }
  return result.slice(-20);
}

function detectOrderBlocks(candles: Candle[], structure: MarketStructureSnapshot, indicators: IndicatorSnapshot): OrderBlock[] {
  const result: OrderBlock[] = [];
  const atr = indicators.atr14;
  if (!Number.isFinite(atr) || atr <= 0) return result;

  for (const event of structure.events.slice(-30)) {
    if (event.type !== 'BOS' && event.type !== 'CHoCH') continue;
    const displacement = candles[event.index];
    if (!displacement) continue;
    const body = Math.abs(displacement.close - displacement.open);
    if (body < atr * 0.8) continue;

    let sourceIndex = -1;
    for (let i = event.index - 1; i >= Math.max(0, event.index - 8); i -= 1) {
      const c = candles[i];
      const opposite = event.direction === 'bullish' ? c.close < c.open : c.close > c.open;
      if (opposite) {
        sourceIndex = i;
        break;
      }
    }
    if (sourceIndex < 0) continue;

    const source = candles[sourceIndex];
    const low = source.low;
    const high = source.high;
    const mitigated = candles.slice(event.index + 1).some(c => c.low <= high && c.high >= low);
    if (mitigated) continue;

    const displacementAtr = body / atr;
    const quality = Math.min(100, Math.round(35 + displacementAtr * 18 + (event.type === 'CHoCH' ? 10 : 0)));
    result.push({
      type: event.direction,
      index: sourceIndex,
      timestamp: source.timestamp,
      low,
      high,
      midpoint: (low + high) / 2,
      displacementPercent: displacementPercent(displacement),
      mitigated: false,
      quality,
      sourceEvent: event.type,
    });
  }
  return result.filter((block, index, all) => all.findIndex(x => x.index === block.index && x.type === block.type) === index).slice(-15);
}

function detectBreakers(candles: Candle[], structure: MarketStructureSnapshot): BreakerBlock[] {
  return structure.events
    .filter(e => e.type === 'CHoCH')
    .slice(-10)
    .map(event => {
      const source = candles[event.swingIndex];
      return source ? {
        type: event.direction,
        sourceIndex: event.swingIndex,
        timestamp: source.timestamp,
        low: source.low,
        high: source.high,
        midpoint: (source.low + source.high) / 2,
      } : null;
    })
    .filter((x): x is BreakerBlock => x !== null);
}

function detectPremiumDiscount(candles: Candle[], swings: SwingPoint[]): PremiumDiscount | null {
  const recentHigh = [...swings].reverse().find(s => s.type === 'high');
  const recentLow = [...swings].reverse().find(s => s.type === 'low');
  const currentPrice = candles.at(-1)?.close ?? 0;
  if (!recentHigh || !recentLow || recentHigh.price <= recentLow.price || !currentPrice) return null;

  const equilibrium = (recentHigh.price + recentLow.price) / 2;
  const positionPercent = ((currentPrice - recentLow.price) / (recentHigh.price - recentLow.price)) * 100;
  return {
    swingHigh: recentHigh.price,
    swingLow: recentLow.price,
    equilibrium,
    currentPrice,
    zone: positionPercent > 55 ? 'premium' : positionPercent < 45 ? 'discount' : 'equilibrium',
    positionPercent,
  };
}

function detectLiquidityPools(structure: MarketStructureSnapshot): LiquidityPool[] {
  const pools: LiquidityPool[] = [];
  for (const level of structure.equalLevels) {
    pools.push({
      type: level.type === 'high' ? 'buy-side' : 'sell-side',
      price: level.price,
      source: level.type === 'high' ? 'equal-highs' : 'equal-lows',
      strength: level.swingIndices.length,
    });
  }
  for (const swing of structure.swings.slice(-20)) {
    pools.push({
      type: swing.type === 'high' ? 'buy-side' : 'sell-side',
      price: swing.price,
      source: swing.type === 'high' ? 'swing-high' : 'swing-low',
      strength: Math.max(1, swing.strength),
    });
  }
  return pools.slice(-30);
}

function inferBias(
  structure: MarketStructureSnapshot,
  pd: PremiumDiscount | null,
  fvg: FairValueGap[],
  blocks: OrderBlock[],
  latestSweep: LiquiditySweep | null,
): 'bullish' | 'bearish' | 'neutral' {
  let score = 0;
  if (structure.trend === 'bullish') score += 2;
  if (structure.trend === 'bearish') score -= 2;
  if (pd?.zone === 'discount') score += 1;
  if (pd?.zone === 'premium') score -= 1;
  if (fvg.at(-1)?.type === 'bullish') score += 1;
  if (fvg.at(-1)?.type === 'bearish') score -= 1;
  if (blocks.at(-1)?.type === 'bullish') score += 2;
  if (blocks.at(-1)?.type === 'bearish') score -= 2;
  if (latestSweep?.type === 'low') score += 1;
  if (latestSweep?.type === 'high') score -= 1;
  return score >= 2 ? 'bullish' : score <= -2 ? 'bearish' : 'neutral';
}

export function analyzeSMC(candles: Candle[], structure: MarketStructureSnapshot, indicators: IndicatorSnapshot): SMCAnalysis {
  const fairValueGaps = detectFVGs(candles);
  const orderBlocks = detectOrderBlocks(candles, structure, indicators);
  const breakerBlocks = detectBreakers(candles, structure);
  const premiumDiscount = detectPremiumDiscount(candles, structure.swings);
  const liquidityPools = detectLiquidityPools(structure);
  const latestSweep = structure.latestSweep;

  return {
    fairValueGaps,
    orderBlocks,
    breakerBlocks,
    premiumDiscount,
    liquidityPools,
    latestSweep,
    bias: inferBias(structure, premiumDiscount, fairValueGaps, orderBlocks, latestSweep),
  };
}
