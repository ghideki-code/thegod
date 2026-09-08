# The God API

The API surface is defined in `api/openapi.yaml`.

## Modules

- Market data: real OHLCV snapshots, real-time scanner and price refresh.
- Analysis: quantitative confluence, indicators, structure, SMC, divergences, Gann and Wyckoff.
- Signals: deterministic quantitative trade signals.
- AI: Gemini Quant Analyst with deterministic fallback.
- Backtest: historical candles plus funding costs.
- Quant Lab: walk-forward, Monte Carlo and stress testing.
- OOS Validation: train/holdout validation, significance, overfitting guard and regime validation.
- Paper Trading: start, stop, tick, reset, status and manual close.

## Safety boundary

This API intentionally contains **no real order execution endpoint**. Paper Trading is simulated only. Exchange API keys must never be accepted by public analysis endpoints.

## Symbol format

Use `BTC/USDT`, `ETH/USDT`, etc.

## Intended architecture

The API layer should sit in front of the market, quantitative and paper-trading engines. Keep the frontend independent from exchange-specific implementations so Binance/OKX providers can be changed without changing the API contract.
