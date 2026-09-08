import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

dotenv.config();
const app = express();
const PORT = Number(process.env.PORT || 3000);
app.use(cors());
app.use(express.json());

const genAI = process.env.GEMINI_API_KEY ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }) : null;

app.get('/api/health', (_req, res) => res.json({ success: true, service: 'thegod-api', mode: 'PAPER_ONLY', timestamp: Date.now() }));
app.get('/api/config', (_req, res) => res.json({ success: true, mode: 'PAPER_ONLY', execution: { realOrders: false, exchangeKeysRequired: false }, apiVersion: '1.0.0' }));
app.get('/api/market/candles/:symbol', async (req, res) => {
  const symbol = decodeURIComponent(req.params.symbol).toUpperCase();
  if (!/^[A-Z0-9]+\/[A-Z0-9]+$/.test(symbol)) return res.status(400).json({ success: false, error: 'Use BTC/USDT.' });
  try {
    const response = await fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol.replace('/', '')}&interval=15m&limit=500`);
    if (!response.ok) throw new Error(`Binance HTTP ${response.status}`);
    const raw = await response.json();
    return res.json({ success: true, source: 'Binance spot public API', symbol, timeframe: '15m', candles: raw });
  } catch (error) {
    return res.status(502).json({ success: false, error: error instanceof Error ? error.message : 'Market data unavailable' });
  }
});
app.get('/api/paper/status', (_req, res) => res.json({ success: true, mode: 'PAPER_ONLY', state: 'STOPPED', positions: [], equity: 10000, pnl: 0 }));
app.post('/api/paper/start', (_req, res) => res.json({ success: true, mode: 'PAPER_ONLY', state: 'RUNNING' }));
app.post('/api/paper/stop', (_req, res) => res.json({ success: true, mode: 'PAPER_ONLY', state: 'STOPPED' }));
app.post('/api/paper/reset', (_req, res) => res.json({ success: true, mode: 'PAPER_ONLY', state: 'STOPPED', equity: 10000, pnl: 0 }));
app.get('/api/quant/lab', (_req, res) => res.json({ success: true, mode: 'PAPER_ONLY', status: 'API_READY', warning: 'Connect quantitative engine before production use.' }));
app.get('/api/quant/validate', (_req, res) => res.json({ success: true, mode: 'PAPER_ONLY', status: 'API_READY', warning: 'Connect OOS engine before production use.' }));
app.post('/api/ai-analysis', async (req, res) => {
  if (!genAI) return res.json({ success: true, aiAvailable: false, analysis: { decision: 'WEAKEN', rationale: 'GEMINI_API_KEY not configured.' } });
  try {
    const prompt = String(req.body?.prompt || 'Analyze BTC/USDT market risk and setup quality. Return concise JSON.');
    const response = await genAI.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });
    return res.json({ success: true, aiAvailable: true, analysis: response.text || '' });
  } catch (error) {
    return res.status(502).json({ success: false, error: error instanceof Error ? error.message : 'AI unavailable' });
  }
});
app.listen(PORT, () => console.log(`thegod API listening on ${PORT}`));
