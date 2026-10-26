import { CATEGORIES, type Category, type PlayerLine } from "./types";
import type { CategoryScores, ValuationResult } from "./value";

export interface TradeResult {
  sendValue: number;
  receiveValue: number;
  /**
   * Value of the roster spots the trade opens or closes. A 2-for-1 frees a
   * spot you can fill off waivers, so the side getting one player isn't
   * simply "losing" the second player's full value.
   */
  rosterAdjustment: number;
  /** Positive = the trade helps you. */
  net: number;
  /** Net change per category (category leagues). */
  categoryNet?: CategoryScores;
  verdict: "win" | "fair" | "lose";
}

/**
 * Evaluate a trade from your side: `send` leaves your roster, `receive` joins it.
 * `fairBand` is how close (as a share of what you send) still counts as even.
 */
export function evaluateTrade<P extends PlayerLine>(
  valuation: ValuationResult<P>,
  send: string[],
  receive: string[],
  fairBand = 0.1,
): TradeResult {
  const pick = (ids: string[]) => ids.map((id) => valuation.byId.get(id)).filter((p) => !!p);
  const out = pick(send);
  const inc = pick(receive);

  const sendValue = out.reduce((s, p) => s + p.value, 0);
  const receiveValue = inc.reduce((s, p) => s + p.value, 0);
  // Each spot freed gets filled with a replacement-level pickup; each extra
  // player received forces you to cut a replacement-level player.
  const spots = out.length - inc.length;
  const rosterAdjustment = spots * valuation.replacement;
  const net = receiveValue + rosterAdjustment - sendValue;

  let categoryNet: CategoryScores | undefined;
  if (inc.every((p) => p.z) && out.every((p) => p.z) && (inc.length || out.length)) {
    categoryNet = {} as CategoryScores;
    for (const c of CATEGORIES as readonly Category[]) {
      const gain = inc.reduce((s, p) => s + p.z![c], 0);
      const loss = out.reduce((s, p) => s + p.z![c], 0);
      categoryNet[c] = gain - loss + spots * (valuation.replacementZ?.[c] ?? 0);
    }
  }

  const scale = Math.max(Math.abs(sendValue), Math.abs(receiveValue), 1);
  const verdict = Math.abs(net) <= scale * fairBand ? "fair" : net > 0 ? "win" : "lose";
  return { sendValue, receiveValue, rosterAdjustment, net, categoryNet, verdict };
}
