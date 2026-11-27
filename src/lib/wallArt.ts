import type { Kind } from './plan'
import { WALL_COLORS } from './plan'

/**
 * Murs / portes / fenêtres : aplat de couleur + UN détail discret par niveau (aucune image à fournir).
 * Un sprite = un côté de case : 40 px de long + 4 px de chaque côté (bouts « carrés »), 8 px d'épaisseur.
 * Les détails sont périodiques sur 40 px : deux côtés voisins se raccordent sans couture.
 * Dessiné en 4x pour rester net quand on zoome.
 */
const S = 4, W = 48, H = 8
const cache = new Map<string, HTMLCanvasElement>()
type G = CanvasRenderingContext2D

const dot = (g: G, x: number, y: number, r: number, fill: string) => { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fillStyle = fill; g.fill() }
const vline = (g: G, x: number, col: string, w = .7) => { g.fillStyle = col; g.fillRect(x - w / 2, 0, w, H) }
const hline = (g: G, y: number, col: string, w = .7) => { g.fillStyle = col; g.fillRect(-4, y - w / 2, W, w) }
const DARK = 'rgba(0,0,0,.3)', LIGHT = 'rgba(255,255,255,.35)'

/** Détail propre à chaque niveau (index = niveau 1 à 5). */
const DETAIL: ((g: G) => void)[] = [
  () => {},
  g => { for (let x = -20; x <= 60; x += 20) vline(g, x, DARK) },                                     // 1 bois : jonction des rondins
  g => { hline(g, H / 2, DARK) },                                                                      // 2 planche : joint de planches
  g => { for (let x = -10; x <= 50; x += 10) vline(g, x, DARK, .6) },                                  // 3 pierre : joints de briques
  g => { for (let x = -5; x <= 50; x += 10) dot(g, x, H / 2, .75, LIGHT) },                            // 4 fer : rivets
  g => { hline(g, H / 2, DARK, .8); for (let x = -5; x <= 50; x += 10) dot(g, x, H / 2, .75, LIGHT) }, // 5 renforcé : bande + rivets
]

function body(g: G, l: number) {
  g.fillStyle = WALL_COLORS[l]; g.fillRect(-4, 0, W, H)
  DETAIL[l](g)
  g.fillStyle = LIGHT; g.fillRect(-4, 0, W, .5)           // arête claire
  g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(-4, H - .6, W, .6) // arête sombre
}

function door(g: G) {
  g.fillStyle = '#e9d9a8'; g.fillRect(5, .5, 30, H - 1)
  g.strokeStyle = 'rgba(0,0,0,.6)'; g.lineWidth = .7; g.strokeRect(5, .5, 30, H - 1)
  dot(g, 30.5, 4, 1, '#8a6a2a') // poignée
}

function windowArt(g: G) {
  g.fillStyle = '#8fd3ee'; g.fillRect(7, .5, 26, H - 1)
  g.strokeStyle = 'rgba(0,0,0,.6)'; g.lineWidth = .7; g.strokeRect(7, .5, 26, H - 1)
}

/** Sprite d'un côté de case (null côté serveur ou niveau inconnu). Dessiner avec drawImage(sp, -4, -4, CS + 8, 8) après translate au début du côté (+ rotate 90° si vertical). */
export function wallSprite(kind: Kind, level: number): HTMLCanvasElement | null {
  if (typeof document === 'undefined' || level < 1 || level >= DETAIL.length) return null
  const key = kind + level
  let c = cache.get(key)
  if (c) return c
  c = document.createElement('canvas'); c.width = W * S; c.height = H * S
  const g = c.getContext('2d'); if (!g) return null
  g.scale(S, S); g.translate(4, 0)
  g.beginPath(); g.rect(-4, 0, W, H); g.clip()
  body(g, level)
  if (kind === 'door') door(g); else if (kind === 'window') windowArt(g)
  cache.set(key, c)
  return c
}
