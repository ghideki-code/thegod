# TheGod API

Backend API for the TheGod crypto quantitative trading platform.

## Safety

The API is explicitly **PAPER_ONLY**. It does not submit real exchange orders and does not require exchange trading keys.

## Endpoints

- `GET /api/health`
- `GET /api/config`
- `GET /api/market/candles/:symbol`
- `GET /api/paper/status`
- `POST /api/paper/start`
- `POST /api/paper/stop`
- `POST /api/paper/reset`
- `GET /api/quant/lab`
- `GET /api/quant/validate`
- `POST /api/ai-analysis`

## Run

```bash
npm install
npm run typecheck
npm run dev
```
