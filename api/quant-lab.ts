import { fetchHistoricalBinanceCandles } from '../server/backtest/historicalDataService.js';
import { fetchHistoricalBinanceFunding } from '../server/derivatives/historicalFundingService.js';
import { runHistoricalBacktest } from '../server/backtest/historicalBacktest.js';
import { paperTradingLoop } from '../server/paper/paperTradingLoop.js';
import { buildQuantitativeLab } from '../server/quant/quantitativeLab.js';

export default async function handler(req: any, res: any) {
  try {
    const symbol = String(req.query?.symbol || 'BTC/USDT').toUpperCase();
    const requestedDays = Number.parseInt(String(req.query?.days || '30'), 10);
    const days = Number.isFinite(requestedDays) ? Math.max(7, Math.min(requestedDays, 90)) : 30;
    if (!/^[A-Z0-9]+\/[A-Z0-9]+$/.test(symbol)) {
      return res.status(400).json({ success: false, error: 'Símbolo inválido. Use o formato BTC/USDT.' });
    }

    const endTime = Date.now();
    const startTime = endTime - days * 86_400_000;
    const [candles, historicalFunding] = await Promise.all([
      fetchHistoricalBinanceCandles(symbol, '15m', startTime, endTime),
      fetchHistoricalBinanceFunding(symbol, startTime, endTime),
    ]);

    if (candles.length < 300) {
      return res.status(422).json({ success: false, error: `Histórico insuficiente: ${candles.length} candles.` });
    }

    const options = {
      symbol,
      candles,
      initialCapital: 10_000,
      riskPerTradePercent: 1,
      minScore: 35,
      minConfidence: 50,
      atrStopMultiple: 1.5,
      rewardRisk: 2,
      maxHoldingBars: 32,
      warmupBars: 220,
      historicalFunding,
    } as const;

    const backtest = runHistoricalBacktest(options);
    const paperState = paperTradingLoop.getEngine().getState();
    const lab = buildQuantitativeLab(backtest, paperState, candles);

    return res.status(200).json({
      success: true,
      source: 'Binance real OHLCV + Binance Futures historical funding • Quant Lab completo',
      parameters: { symbol, timeframe: '15m', days, candles: candles.length, fundingEvents: historicalFunding.length, riskPerTradePercent: 1, rewardRisk: 2, maxHoldingBars: 32 },
      ...lab,
    });
  } catch (error: any) {
    console.error('Quantitative lab error:', error);
    return res.status(502).json({ success: false, error: error?.message || 'Falha ao executar Quant Lab.' });
  }
}
