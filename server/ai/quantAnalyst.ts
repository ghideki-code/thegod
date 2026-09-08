import type { MarketAnalysis } from '../confluence/marketAnalysisService.js';
import type { TradeSignal } from '../signal/signalEngine.js';

export type QuantAnalystDecision = 'CONFIRM' | 'WEAKEN' | 'REJECT';

export interface QuantAnalystInput { analysis: MarketAnalysis; signal: TradeSignal; }
export interface QuantAnalystResult { decision: QuantAnalystDecision; rationale: string; riskFlags: string[]; model: string; }

function compactAnalysis(analysis: MarketAnalysis, signal: TradeSignal): string {
  const timeframes = analysis.timeframes.map(tf => ({
    timeframe: tf.timeframe,
    trend: tf.structure.trend,
    rsi: tf.indicators.rsi14,
    atr: tf.indicators.atr14,
    structure: tf.structure.events.slice(-4),
    smcBias: tf.smc.bias,
    latestFvg: tf.smc.fairValueGaps.at(-1) ?? null,
    latestOrderBlock: tf.smc.orderBlocks.at(-1) ?? null,
    divergence: tf.divergences.latest,
    gann: tf.gann,
    wyckoff: tf.wyckoff,
  }));
  return JSON.stringify({ symbol: analysis.symbol, fetchedAt: analysis.fetchedAt, confluence: analysis.confluence, derivatives: analysis.derivatives, signal, timeframes });
}

export function buildQuantAnalystPrompt(input: QuantAnalystInput): string {
  return `Você é o Quant Analyst de um sistema profissional de trading de criptomoedas.\n\nSua função é auditar um sinal quantitativo já calculado. NÃO invente preços, indicadores, níveis, eventos ou dados ausentes. NÃO substitua os cálculos determinísticos.\n\nRegras:\n1. Use somente os dados JSON fornecidos.\n2. Avalie alinhamento entre 15m, 1H, 4H e 1D.\n3. Dê peso especial à estrutura, SMC, Wyckoff, divergências e derivativos quando disponíveis.\n4. Procure conflitos, baixa qualidade, divergências contra a direção, ausência de confirmação e risco de contexto.\n5. A decisão deve ser exatamente uma de: CONFIRM, WEAKEN ou REJECT.\n6. CONFIRM apoia o sinal. WEAKEN indica conflitos relevantes. REJECT indica conflito estrutural ou dados insuficientes.\n7. Seja objetivo e não forneça promessa de lucro.\n\nResponda SOMENTE em JSON válido: {"decision":"CONFIRM|WEAKEN|REJECT","rationale":"...","riskFlags":["..."]}\n\nDADOS:\n${compactAnalysis(input.analysis, input.signal)}`;
}

export function parseQuantAnalystResponse(text: string, model: string): QuantAnalystResult {
  const fallback: QuantAnalystResult = { decision: 'WEAKEN', rationale: 'A resposta do modelo não pôde ser validada como JSON estruturado.', riskFlags: ['ai_response_invalid'], model };
  try {
    const parsed = JSON.parse(text) as Partial<QuantAnalystResult>;
    if (!['CONFIRM', 'WEAKEN', 'REJECT'].includes(String(parsed.decision))) return fallback;
    return {
      decision: parsed.decision as QuantAnalystDecision,
      rationale: typeof parsed.rationale === 'string' ? parsed.rationale : 'Sem justificativa estruturada.',
      riskFlags: Array.isArray(parsed.riskFlags) ? parsed.riskFlags.filter((flag): flag is string => typeof flag === 'string').slice(0, 10) : [],
      model,
    };
  } catch { return fallback; }
}
