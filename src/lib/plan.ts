export type Rot = 0 | 90 | 180 | 270
export type Kind = 'wall' | 'door' | 'window'
export type Edge = { k: Kind; l: number }
export type Obj = { id: number; t: string; x: number; y: number; r: Rot }
export type Plan = { w: number; h: number; floor: number[]; hw: (Edge | null)[]; vw: (Edge | null)[]; objs: Obj[]; next: number; nb: boolean[]; ng: number[]; hole: boolean[] }
export type Pt = { x: number; y: number }
export type EdgeRef = { o: 'h' | 'v'; x: number; y: number }
/** image: chemin dans /public (ex. '/assets/etabli.png'). Sans image, un aplat de couleur + icône est dessiné. */
export type ItemId = 'workbench' | 'chest' | 'bed' | 'campfire' | 'generator' | 'shelf' | 'crop'
export type Item = { id: ItemId; w: number; h: number; color: string; icon: string; rotatable: boolean; max?: number; image?: string }

export const FLOOR_COLORS = ['', '#8a6a4a', '#a8845a', '#9aa0a6', '#6b7c93', '#5a4a58']
/** Texture de chaque niveau de sol (index = niveau 1 à 5), dessinée sur chaque case. Chemin dans /public.
 *  Niveau sans image (undefined) = repli sur la couleur de FLOOR_COLORS. Pour ajouter un sol : déposer
 *  `main-floorN.webp` dans public/assets/ puis renseigner son chemin ici. */
export const FLOOR_IMAGES: (string | undefined)[] = [
  '',
  '/assets/main-floor1.webp',
  '/assets/main-floor2.webp',
  '/assets/main-floor3.webp',
  '/assets/main-floor4.webp',
  '/assets/main-floor5.webp',
]
export const WALL_COLORS = ['', '#7a4a2a', '#c9822b', '#b8bdc1', '#3f5266', '#7b3a32']
export const CATALOG: Item[] = [
  { id: 'workbench', w: 2, h: 1, color: '#7a5c3a', icon: '🔨', rotatable: true },
  { id: 'chest', w: 1, h: 1, color: '#8a6d2f', icon: '📦', rotatable: false },
  { id: 'bed', w: 1, h: 2, color: '#6d5a8a', icon: '🛏️', rotatable: true, max: 4 },
  { id: 'campfire', w: 1, h: 1, color: '#9a4a2a', icon: '🔥', rotatable: false, max: 2 },
  { id: 'generator', w: 2, h: 2, color: '#4a6a7a', icon: '⚡', rotatable: true, max: 1 },
  { id: 'shelf', w: 2, h: 1, color: '#6a5a4a', icon: '🗄️', rotatable: true },
  { id: 'crop', w: 2, h: 2, color: '#4a7a3a', icon: '🌱', rotatable: false },
]
export const newPlan = (w = 24, h = 16): Plan => ({ w, h, floor: Array(w * h).fill(0), hw: Array((h + 1) * w).fill(null), vw: Array(h * (w + 1)).fill(null), objs: [], next: 1, nb: Array(w * h).fill(false), ng: Array(w * h).fill(0), hole: Array(w * h).fill(false) })
export const itemOf = (id: string) => CATALOG.find(i => i.id === id)!
export const fp = (i: Item, r: Rot) => (r % 180 ? { w: i.h, h: i.w } : { w: i.w, h: i.h })
export const inB = (p: Plan, x: number, y: number) => x >= 0 && y >= 0 && x < p.w && y < p.h
export const objAt = (p: Plan, x: number, y: number) => p.objs.find(o => { const f = fp(itemOf(o.t), o.r); return x >= o.x && x < o.x + f.w && y >= o.y && y < o.y + f.h })
export function canPlace(p: Plan, it: Item, x: number, y: number, r: Rot) {
  if (it.max && p.objs.filter(o => o.t === it.id).length >= it.max) return false
  const f = fp(it, r)
  for (let j = 0; j < f.h; j++) for (let i = 0; i < f.w; i++) {
    if (!inB(p, x + i, y + j) || !p.floor[(y + j) * p.w + x + i] || p.nb[(y + j) * p.w + x + i] || p.hole[(y + j) * p.w + x + i] || objAt(p, x + i, y + j)) return false
  }
  return true
}
export const inE = (p: Plan, e: EdgeRef) => e.o === 'h' ? e.x >= 0 && e.x < p.w && e.y >= 0 && e.y <= p.h : e.x >= 0 && e.x <= p.w && e.y >= 0 && e.y < p.h
/** Case retirée de la carte (aucune grille, rien ne s'y pose) : elle se comporte comme l'extérieur de la grille. */
export const isHole = (p: Plan, x: number, y: number) => !inB(p, x, y) || !!p.hole[y * p.w + x]
/** Une arête est interdite sauf si elle touche au moins une case constructible (blanche). Une arête rouge/blanc est donc permise, rouge/rouge, rouge/vide ou vide/vide non. */
export const edgeBlocked = (p: Plan, e: EdgeRef) => {
  const c: Pt[] = e.o === 'h' ? [{ x: e.x, y: e.y - 1 }, { x: e.x, y: e.y }] : [{ x: e.x - 1, y: e.y }, { x: e.x, y: e.y }]
  return !c.some(q => !isHole(p, q.x, q.y) && !p.nb[q.y * p.w + q.x])
}
export const eIdx = (p: Plan, e: EdgeRef) => e.o === 'h' ? e.y * p.w + e.x : e.y * (p.w + 1) + e.x

export function lineCells(a: Pt, b: Pt): Pt[] {
  const out: Pt[] = []; let { x, y } = a
  const dx = Math.abs(b.x - a.x), dy = Math.abs(b.y - a.y), sx = a.x < b.x ? 1 : -1, sy = a.y < b.y ? 1 : -1
  let err = dx - dy
  for (;;) {
    out.push({ x, y }); if (x === b.x && y === b.y) break
    const e2 = 2 * err
    if (e2 > -dy) { err -= dy; x += sx }
    if (e2 < dx) { err += dx; y += sy }
  }
  return out
}
export function rectCells(a: Pt, b: Pt): Pt[] {
  const out: Pt[] = []
  for (let y = Math.min(a.y, b.y); y <= Math.max(a.y, b.y); y++) for (let x = Math.min(a.x, b.x); x <= Math.max(a.x, b.x); x++) out.push({ x, y })
  return out
}
export function fillCells(p: Plan, s: Pt, level: number): Pt[] {
  if (!inB(p, s.x, s.y) || p.hole[s.y * p.w + s.x]) return []
  const from = p.floor[s.y * p.w + s.x]; if (from === level) return []
  const seen = new Set<number>([s.y * p.w + s.x]), q = [s], out: Pt[] = []
  while (q.length && out.length < 5000) {
    const c = q.pop()!; out.push(c)
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const x = c.x + dx, y = c.y + dy, k = y * p.w + x
      if (inB(p, x, y) && !p.hole[k] && !seen.has(k) && p.floor[k] === from) { seen.add(k); q.push({ x, y }) }
    }
  }
  return out
}
/** Murs entre deux sommets de la grille, alignés sur l'axe dominant. */
export function edgeLine(a: Pt, b: Pt): EdgeRef[] {
  const out: EdgeRef[] = []
  if (Math.abs(b.x - a.x) >= Math.abs(b.y - a.y)) for (let x = Math.min(a.x, b.x); x < Math.max(a.x, b.x); x++) out.push({ o: 'h', x, y: a.y })
  else for (let y = Math.min(a.y, b.y); y < Math.max(a.y, b.y); y++) out.push({ o: 'v', x: a.x, y })
  return out
}
export function edgeRect(a: Pt, b: Pt): EdgeRef[] {
  const x0 = Math.min(a.x, b.x), x1 = Math.max(a.x, b.x), y0 = Math.min(a.y, b.y), y1 = Math.max(a.y, b.y)
  return [...edgeLine({ x: x0, y: y0 }, { x: x1, y: y0 }), ...edgeLine({ x: x0, y: y1 }, { x: x1, y: y1 }), ...edgeLine({ x: x0, y: y0 }, { x: x0, y: y1 }), ...edgeLine({ x: x1, y: y0 }, { x: x1, y: y1 })]
}
export function nearestEdge(fx: number, fy: number): EdgeRef {
  const cx = Math.floor(fx), cy = Math.floor(fy)
  const d = [fy - cy, cy + 1 - fy, fx - cx, cx + 1 - fx], m = d.indexOf(Math.min(...d))
  return [{ o: 'h', x: cx, y: cy }, { o: 'h', x: cx, y: cy + 1 }, { o: 'v', x: cx, y: cy }, { o: 'v', x: cx + 1, y: cy }][m] as EdgeRef
}
/** Identifiant de groupe d'une case rouge : les cases posées ensemble (ex. un 2x2) forment un seul bloc. 0 = case isolée (anciennes sauvegardes). */
export const nbKey = (p: Plan, i: number) => p.ng[i] || -(i + 1)
/** Toutes les cases du bloc rouge qui contient la case (x, y). */
export function nbGroup(p: Plan, x: number, y: number): Pt[] {
  const i = y * p.w + x; if (!inB(p, x, y) || !p.nb[i]) return []
  const k = nbKey(p, i), out: Pt[] = []
  for (let j = 0; j < p.nb.length; j++) if (p.nb[j] && nbKey(p, j) === k) out.push({ x: j % p.w, y: Math.floor(j / p.w) })
  return out
}
