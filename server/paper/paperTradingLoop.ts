import { fetchRealCandles } from '../market/candleService.js';
import { analyzeMarket } from '../confluence/marketAnalysisService.js';
import { generateTradeSignal } from '../signal/signalEngine.js';
import { PaperTradingEngine } from './paperTradingEngine.js';

export interface PaperLoopStatus { running:boolean; symbol:string; intervalMs:number; lastTickAt:number|null; lastCandleTimestamp:number|null; lastError:string|null; }

export class PaperTradingLoop {
  private readonly engine: PaperTradingEngine;
  private readonly symbol: string;
  private readonly intervalMs: number;
  private timer: ReturnType<typeof setInterval>|null = null;
  private ticking = false;
  private lastCandleTimestamp:number|null = null;
  private lastTickAt:number|null = null;
  private lastError:string|null = null;

  constructor(engine=new PaperTradingEngine(),symbol='BTC/USDT',intervalMs=15_000){this.engine=engine;this.symbol=symbol;this.intervalMs=intervalMs;}
  getEngine(){return this.engine;}
  getStatus():PaperLoopStatus{return{running:this.timer!==null,symbol:this.symbol,intervalMs:this.intervalMs,lastTickAt:this.lastTickAt,lastCandleTimestamp:this.lastCandleTimestamp,lastError:this.lastError};}
  async tick(){if(this.ticking)return;this.ticking=true;try{const series=await fetchRealCandles(this.symbol,'15m',500);const candles=series.candles;if(candles.length<50)throw new Error('insufficient_closed_candles');const closed=candles.slice(0,-1);const candle=closed.at(-1);if(!candle)throw new Error('no_closed_candle');this.lastTickAt=Date.now();this.lastError=null;if(this.lastCandleTimestamp===candle.timestamp)return;this.engine.processCandle(candle);this.lastCandleTimestamp=candle.timestamp;if(this.engine.getState().positions.length===0&&!this.engine.getState().account.halted){const analysis=await analyzeMarket(this.symbol);const signal=generateTradeSignal(analysis,candles.slice(0,-1));if(signal.direction!=='NO TRADE')this.engine.openFromSignal(signal,Date.now());}}catch(error){this.lastError=error instanceof Error?error.message:'paper_loop_error';}finally{this.ticking=false;}}
  start(){if(this.timer)return;void this.tick();this.timer=setInterval(()=>void this.tick(),this.intervalMs);}
  stop(){if(this.timer){clearInterval(this.timer);this.timer=null;}}
}
export const paperTradingLoop=new PaperTradingLoop();
