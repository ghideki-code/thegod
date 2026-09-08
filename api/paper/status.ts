import { paperTradingLoop } from '../../server/paper/paperTradingLoop.js';

export default function handler(_req: any, res: any) {
  return res.status(200).json({
    success: true,
    ...paperTradingLoop.getStatus(),
    state: paperTradingLoop.getEngine().getState(),
  });
}
