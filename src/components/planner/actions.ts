import { canPlace, pruneAround, edgeBlocked, edgeLine, edgeRect, edgeViolation, eIdx, fp, inB, inE, itemOf, newPlan, objAt, objViolation } from '@/lib/plan'
import type { EdgeRef, Item, Plan, Pt, Rot, Violation } from '@/lib/plan'
import { GW, GH, DEFAULT_NOBUILD, DEFAULT_REMOVED } from './config'
import type { Tool, Mode, WKind } from './config'

export function withHoles(p: Plan): Plan {
  const n = structuredClone(p)
  n.hole = Array(n.w * n.h).fill(false)
  for (const r of DEFAULT_REMOVED) for (let y = r.y; y < r.y + (r.h ?? 1); y++) for (let x = r.x; x < r.x + (r.w ?? 1); x++) {
    if (!inB(n, x, y)) continue
    const i = y * n.w + x; n.hole[i] = true; n.nb[i] = false; n.ng[i] = 0; n.floor[i] = 0
  }
  n.objs = n.objs.filter(o => { const f = fp(itemOf(o.t), o.r); for (let j = 0; j < f.h; j++) for (let i = 0; i < f.w; i++) if (n.hole[(o.y + j) * n.w + o.x + i]) return false; return true })
  for (const e of ['h', 'v'] as const) { const a = e === 'h' ? n.hw : n.vw, cols = e === 'h' ? n.w : n.w + 1; a.forEach((w, i) => { if (w && edgeBlocked(n, { o: e, x: i % cols, y: Math.floor(i / cols) })) a[i] = null }) }
  return n
}
export function withDefaults(p: Plan): Plan {
  const n = structuredClone(p)
  for (const r of DEFAULT_NOBUILD) { const gid = n.next++; for (let y = r.y; y < r.y + (r.h ?? 1); y++) for (let x = r.x; x < r.x + (r.w ?? 1); x++) {
    if (!inB(n, x, y)) continue
    const i = y * n.w + x; n.nb[i] = true; n.ng[i] = gid; n.floor[i] = 0
    const o = objAt(n, x, y); if (o) n.objs = n.objs.filter(q => q !== o)
  } }
  for (const e of ['h', 'v'] as const) { const a = e === 'h' ? n.hw : n.vw, cols = e === 'h' ? n.w : n.w + 1; a.forEach((w, i) => { if (w && edgeBlocked(n, { o: e, x: i % cols, y: Math.floor(i / cols) })) a[i] = null }) }
  return n
}
export const freshPlan = () => withHoles(withDefaults(newPlan(GW, GH)))
/** Résultat d'une action : `plan` est le MÊME objet que l'entrée si rien n'a changé (pas d'entrée d'historique inutile) ; `bad` liste les règles de construction refusées. */
export type Applied = { plan: Plan; bad: Violation[] }
export function applyCells(p: Plan, cells: Pt[], tool: Tool, level: number, it: Item, rot: Rot): Applied {
  const n = structuredClone(p), bad: Violation[] = [], floored: Pt[] = []; let changed = false // floored = cases dont le sol a changé
  for (const c of cells) {
    if (!inB(n, c.x, c.y)) continue
    const i = c.y * n.w + c.x
    if (tool === 'floor') { if (!n.nb[i] && !n.hole[i] && n.floor[i] !== level) { n.floor[i] = level; changed = true; floored.push(c) } }
    else if (tool === 'eraser') { const o = objAt(n, c.x, c.y); if (o) { n.objs = n.objs.filter(q => q !== o); changed = true } else if (n.floor[i]) { n.floor[i] = 0; changed = true; floored.push(c) } }
    else if (canPlace(n, it, c.x, c.y, rot)) { n.objs.push({ id: n.next++, t: it.id, x: c.x, y: c.y, r: rot }); changed = true }
    else { const v = objViolation(n, it, c.x, c.y, rot); if (v) bad.push(v) }
  }
  if (floored.length) pruneAround(n, floored) // un sol retiré ou abaissé emporte les murs qui n'ont plus le droit d'exister (annulable d'un seul Ctrl+Z)
  return { plan: changed ? n : p, bad }
}
export function applyEdges(p: Plan, es: EdgeRef[], kind: WKind, level: number): Applied {
  const n = structuredClone(p), bad: Violation[] = []; let changed = false
  for (const e of es) {
    if (!inE(n, e) || edgeBlocked(n, e)) continue
    if (kind !== 'clear') { const v = edgeViolation(n, e, level); if (v) { bad.push(v); continue } }
    (e.o === 'h' ? n.hw : n.vw)[eIdx(n, e)] = kind === 'clear' ? null : { k: kind, l: level }; changed = true
  }
  return { plan: changed ? n : p, bad }
}
/** Murs / portes / fenêtres en « Ligne » ou « Rectangle » : on glisse d'un sommet à l'autre (aperçu pendant le glissé, pose au relâchement), ou on clique départ puis arrivée. */
export const wallEdges = (m: Mode, a: Pt, b: Pt) => m === 'rect' ? edgeRect(a, b) : edgeLine(a, b)
/** Sommet d'arrivée réel : une ligne est alignée sur l'axe dominant (comme edgeLine), un rectangle va jusqu'à b. */
export const wallEnd = (m: Mode, a: Pt, b: Pt): Pt => m === 'rect' ? b : Math.abs(b.x - a.x) >= Math.abs(b.y - a.y) ? { x: b.x, y: a.y } : { x: a.x, y: b.y }
