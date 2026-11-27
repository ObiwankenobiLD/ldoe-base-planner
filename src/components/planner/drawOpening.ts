import { OPEN_PAD, OPEN_T, OPEN_FILL } from './config'

/** Porte / fenêtre : même rectangle à contour blanc, seul l'intérieur change de couleur. Repère local : x le long du côté (0 à 40), y en travers, centré sur le mur. */
export function drawOpening(g: CanvasRenderingContext2D, x0: number, y0: number, vertical: boolean, kind: 'door' | 'window') {
  const len = 40 - 2 * OPEN_PAD
  g.save(); g.translate(x0, y0); if (vertical) g.rotate(Math.PI / 2); g.lineCap = 'butt'
  g.fillStyle = OPEN_FILL[kind]; g.fillRect(OPEN_PAD, -OPEN_T / 2, len, OPEN_T) // intérieur
  g.strokeStyle = '#ffffff'; g.lineWidth = 1; g.strokeRect(OPEN_PAD, -OPEN_T / 2, len, OPEN_T) // contour blanc
  g.restore()
}
