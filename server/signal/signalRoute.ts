import { Router } from 'express';
import { analyzeMarket } from '../confluence/marketAnalysisService.js';
import { fetchRealCandles } from '../market/candleService.js';
import { generateTradeSignal } from './signalEngine.js';

export const signalRouter = Router();

signalRouter.get('/api/signal/:symbol', async (req, res) => {
  try {
    const symbol = decodeURIComponent(String(req.params.symbol || 'BTC/USDT')).toUpperCase().replace('-', '/');
    const riskPercent = Number(req.query.riskPercent ?? 1);
    const analysis = await analyzeMarket(symbol, req.query.refresh === 'true');
    const series = await fetchRealCandles(symbol, '15m', 500);
    const signal = generateTradeSignal(analysis, series.candles, Number.isFinite(riskPercent) ? riskPercent : 1);

    return res.json({
      success: true,
      source: 'Binance/OKX real OHLCV + quantitative signal engine',
      signal,
      generatedAt: Date.now(),
    });
  } catch (error) {
    return res.status(502).json({
      success: false,
      error: error instanceof Error ? error.message : 'Falha ao gerar sinal',
    });
  }
});
