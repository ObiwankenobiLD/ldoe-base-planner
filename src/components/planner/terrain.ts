import { CS, BAND, BAND_TINT, M } from './config'

export const hash = (x: number, y: number, s = 0) => { let h = Math.imul(x + 1, 374761393) ^ Math.imul(y + 1, 668265263) ^ Math.imul(s + 1, 144665); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967295 }
export function makeTerrain(cw: number, ch: number, img?: HTMLImageElement, hole?: boolean[], nb?: boolean[], gw = 0): HTMLCanvasElement {
  const c = document.createElement('canvas'); c.width = cw * CS; c.height = ch * CS
  const g = c.getContext('2d')!
  if (img) { g.fillStyle = g.createPattern(img, 'repeat')!; g.fillRect(0, 0, c.width, c.height) }
  else for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
    const v = hash(x, y), px = x * CS, py = y * CS
    g.fillStyle = `rgb(${52 + v * 20 | 0},${66 + v * 24 | 0},${28 + v * 12 | 0})`; g.fillRect(px, py, CS, CS)
    for (let k = 0; k < 5; k++) {
      const a = hash(x, y, k + 1), b = hash(x, y, k + 9)
      g.fillStyle = a > .82 ? 'rgba(215,232,245,.28)' : 'rgba(28,42,14,.28)'
      g.beginPath(); g.ellipse(px + a * CS, py + b * CS, 3 + a * 8, 2 + b * 5, a * 3, 0, 7); g.fill()
    }
  }
  paintTint(g, cw, ch, hole, nb, gw)
  return c
}
/** Teinte par-dessus l'herbe : zone constructible claire, zone neutre, vert « hors carte ». */
export function paintTint(g: CanvasRenderingContext2D, cw: number, ch: number, hole?: boolean[], nb?: boolean[], gw = 0) {
  for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
    const inside = x >= M && x < cw - M && y >= M && y < ch - M
    const near = x >= M - BAND && x < cw - M + BAND && y >= M - BAND && y < ch - M + BAND
    const removed = inside && !!(hole?.[(y - M) * gw + (x - M)] || nb?.[(y - M) * gw + (x - M)]) // ni zone claire sous les zones rouges ni sur les cases retirées
    g.fillStyle = inside && !removed ? 'rgba(255,255,255,.12)' : near ? BAND_TINT : 'rgba(70,205,30,.5)'; g.fillRect(x * CS, y * CS, CS, CS)
  }
}
