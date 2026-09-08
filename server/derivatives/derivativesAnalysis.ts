import type { DerivativesSnapshot } from './derivativesClient.js';

export type DerivativesBias = 'bullish' | 'bearish' | 'neutral';

export interface DerivativesAnalysis {
  bias: DerivativesBias;
  score: number;
  fundingState: 'positive' | 'negative' | 'neutral' | 'unavailable';
  positioningState: 'long-heavy' | 'short-heavy' | 'balanced' | 'unavailable';
  reasons: string[];
}

export function analyzeDerivatives(data: DerivativesSnapshot): DerivativesAnalysis {
  let score = 0;
  const reasons: string[] = [];

  if (data.fundingRate === null) {
    reasons.push('Funding indisponível');
  } else if (data.fundingRate > 0.0003) {
    score -= 1;
    reasons.push('Funding positivo elevado, favorece risco de longs congestionados');
  } else if (data.fundingRate < -0.0003) {
    score += 1;
    reasons.push('Funding negativo elevado, favorece risco de shorts congestionados');
  } else {
    reasons.push('Funding próximo do neutro');
  }

  if (data.longShortRatio === null) {
    reasons.push('Long/Short indisponível');
  } else if (data.longShortRatio > 1.2) {
    score -= 1;
    reasons.push('Contas posicionadas majoritariamente em long');
  } else if (data.longShortRatio < 0.83) {
    score += 1;
    reasons.push('Contas posicionadas majoritariamente em short');
  } else {
    reasons.push('Posicionamento Long/Short equilibrado');
  }

  const bias: DerivativesBias = score > 0 ? 'bullish' : score < 0 ? 'bearish' : 'neutral';
  const fundingState = data.fundingRate === null ? 'unavailable' : data.fundingRate > 0.0001 ? 'positive' : data.fundingRate < -0.0001 ? 'negative' : 'neutral';
  const positioningState = data.longShortRatio === null ? 'unavailable' : data.longShortRatio > 1.2 ? 'long-heavy' : data.longShortRatio < 0.83 ? 'short-heavy' : 'balanced';

  return { bias, score, fundingState, positioningState, reasons };
}
