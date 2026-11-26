'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { LANG_KEY, LOCALE_LABEL, locales } from '@/i18n/config'
import type { Locale } from '@/i18n/config'
import { fmt } from '@/i18n/dictionaries'
import type { Dict } from '@/i18n/dictionaries'
import { CATALOG, FLOOR_COLORS, FLOOR_IMAGES, WALL_COLORS, canPlace, edgeBlocked, edgeLine, edgeRect, eIdx, fillCells, fp, inB, inE, isHole, itemOf, lineCells, nbGroup, nbKey, nearestEdge, newPlan, objAt, rectCells } from '@/lib/plan'
import type { EdgeRef, Item, Kind, Plan, Pt, Rot } from '@/lib/plan'

type Tool = 'floor' | 'wall' | 'object' | 'eraser' | 'hand'
type Mode = 'single' | 'brush' | 'line' | 'rect' | 'fill'
type WKind = Kind | 'clear'
type Shape = { cells?: Pt[]; edges?: EdgeRef[] }
const CS = 40, KEY = 'base-planner-v3', GW = 21, GH = 18 // taille de grille fixe (largeur x hauteur)
const MODES: Record<Tool, Mode[]> = { floor: ['single', 'brush', 'line', 'rect', 'fill'], wall: ['single', 'line', 'rect'], object: ['single', 'brush', 'line', 'rect'], eraser: ['single', 'brush', 'rect'], hand: [] }
const TOOLS = Object.keys(MODES) as Tool[]
const WKINDS: WKind[] = ['wall', 'door', 'window', 'clear']
const BAND = 2 // largeur (en cases) de la zone neutre entre la zone constructible et le vert
const BAND_TINT = 'rgba(0,0,0,0)' // teinte de cette zone : transparent = herbe naturelle (ex. 'rgba(255,255,255,.08)' pour l'éclaircir)
const M = BAND + 3 // marge totale autour de la zone constructible : zone neutre + vert « hors carte »
const hash = (x: number, y: number, s = 0) => { let h = Math.imul(x + 1, 374761393) ^ Math.imul(y + 1, 668265263) ^ Math.imul(s + 1, 144665); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967295 }
function makeTerrain(cw: number, ch: number, img?: HTMLImageElement, hole?: boolean[], nb?: boolean[], gw = 0): HTMLCanvasElement {
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
  for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
    const inside = x >= M && x < cw - M && y >= M && y < ch - M
    const near = x >= M - BAND && x < cw - M + BAND && y >= M - BAND && y < ch - M + BAND
    const removed = inside && !!(hole?.[(y - M) * gw + (x - M)] || nb?.[(y - M) * gw + (x - M)]) // ni zone claire sous les zones rouges ni sur les cases retirées
    g.fillStyle = inside && !removed ? 'rgba(255,255,255,.12)' : near ? BAND_TINT : 'rgba(70,205,30,.5)'; g.fillRect(x * CS, y * CS, CS, CS)
  }
  return c
}
const asset = (p: string) => (process.env.NEXT_PUBLIC_BASE_PATH || '') + p

// Carrés rouges (cases interdites) présents au lancement. x et y partent du coin haut-gauche (0).
// w et h sont facultatifs (1 par défaut) : { x: 3, y: 5 } = un seul carré ; { x: 0, y: 12, w: 5, h: 4 } = un bloc de carrés.
// Dans l'appli, un clic sur une zone rouge propose de la supprimer (popup Oui / Non). Il n'y a plus d'outil pour en ajouter.
const DEFAULT_NOBUILD: { x: number; y: number; w?: number; h?: number }[] = [
  { x: 15, y: 0, w: 2, h: 2 },
  { x: 17, y: 0, w: 2, h: 2 },
  { x: 19, y: 0, w: 2, h: 2 },
  { x: 15, y: 2, w: 2, h: 2 },
  { x: 17, y: 2, w: 2, h: 2 },
  { x: 19, y: 2, w: 2, h: 2 },
  { x: 15, y: 4, w: 2, h: 2 },
  { x: 17, y: 4, w: 2, h: 2 },
  { x: 19, y: 4, w: 2, h: 2 },
  { x: 15, y: 6, w: 2, h: 2 },
  { x: 17, y: 6, w: 2, h: 2 },
  { x: 19, y: 6, w: 2, h: 2 },
  { x: 15, y: 8, w: 2, h: 2 },
  { x: 17, y: 8, w: 2, h: 2 },
  { x: 19, y: 8, w: 2, h: 2 },
  { x: 15, y: 10, w: 2, h: 2 },
  { x: 17, y: 10, w: 2, h: 2 },
  { x: 19, y: 10, w: 2, h: 2 },
  { x: 15, y: 12, w: 2, h: 2 },
  { x: 17, y: 12, w: 2, h: 2 },
  { x: 19, y: 12, w: 2, h: 2 },
  { x: 15, y: 14, w: 2, h: 2 },
  { x: 17, y: 14, w: 2, h: 2 },
  { x: 19, y: 14, w: 2, h: 2 },
  { x: 15, y: 16, w: 2, h: 2 },
  { x: 17, y: 16, w: 2, h: 2 },
  { x: 19, y: 16, w: 2, h: 2 },
]
// Cases RETIRÉES de la carte : plus de grille, plus de zone claire, rien ne peut s'y poser (le joueur ne peut pas les remettre).
// Même format que ci-dessus : { x, y, w?, h? }. Modifier cette liste suffit : elle est ré-appliquée à chaque chargement de la page.
const DEFAULT_REMOVED: { x: number; y: number; w?: number; h?: number }[] = [
  { x: 0, y: 12, w: 5, h: 4 },
  // { x: 8, y: 0, w: 3 },
]
function withHoles(p: Plan): Plan {
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
function withDefaults(p: Plan): Plan {
  const n = structuredClone(p)
  for (const r of DEFAULT_NOBUILD) { const gid = n.next++; for (let y = r.y; y < r.y + (r.h ?? 1); y++) for (let x = r.x; x < r.x + (r.w ?? 1); x++) {
    if (!inB(n, x, y)) continue
    const i = y * n.w + x; n.nb[i] = true; n.ng[i] = gid; n.floor[i] = 0
    const o = objAt(n, x, y); if (o) n.objs = n.objs.filter(q => q !== o)
  } }
  for (const e of ['h', 'v'] as const) { const a = e === 'h' ? n.hw : n.vw, cols = e === 'h' ? n.w : n.w + 1; a.forEach((w, i) => { if (w && edgeBlocked(n, { o: e, x: i % cols, y: Math.floor(i / cols) })) a[i] = null }) }
  return n
}
const freshPlan = () => withHoles(withDefaults(newPlan(GW, GH)))
function applyCells(p: Plan, cells: Pt[], tool: Tool, level: number, it: Item, rot: Rot): Plan {
  const n = structuredClone(p)
  for (const c of cells) {
    if (!inB(n, c.x, c.y)) continue
    const i = c.y * n.w + c.x
    if (tool === 'floor') { if (!n.nb[i] && !n.hole[i]) n.floor[i] = level }
    else if (tool === 'eraser') { const o = objAt(n, c.x, c.y); if (o) n.objs = n.objs.filter(q => q !== o); else if (n.floor[i]) n.floor[i] = 0 }
    else if (canPlace(n, it, c.x, c.y, rot)) n.objs.push({ id: n.next++, t: it.id, x: c.x, y: c.y, r: rot })
  }
  return n
}
function applyEdges(p: Plan, es: EdgeRef[], kind: WKind, level: number): Plan {
  const n = structuredClone(p)
  for (const e of es) if (inE(n, e) && !edgeBlocked(n, e)) (e.o === 'h' ? n.hw : n.vw)[eIdx(n, e)] = kind === 'clear' ? null : { k: kind, l: level }
  return n
}
export default function Planner({ locale, dict }: { locale: Locale; dict: Dict }) {
  const router = useRouter()
  const ui = dict.ui
  const changeLang = (l: Locale) => { try { localStorage.setItem(LANG_KEY, l) } catch {} router.push(`/${l}/`) }
  const [plan, setPlan] = useState<Plan>(freshPlan)
  const [tool, setTool] = useState<Tool>('wall')
  const [mode, setMode] = useState<Mode>('line')
  const [level, setLevel] = useState(1)
  const [wk, setWk] = useState<WKind>('wall')
  const [itemId, setItemId] = useState(CATALOG[0].id)
  const [rot, setRot] = useState<Rot>(0)
  const [ask, setAsk] = useState<Pt | null>(null) // carré rouge en attente de confirmation de suppression
  const [pv, setPv] = useState<Shape | null>(null)
  const [tick, setTick] = useState(0)
  const cv = useRef<HTMLCanvasElement>(null)
  const undo = useRef<Plan[]>([]), redo = useRef<Plan[]>([])
  const drag = useRef<{ a: Tgt; path: Pt[] } | null>(null)
  const imgs = useRef(new Map<string, HTMLImageElement>())
  const loaded = useRef(false)
  const view = useRef<HTMLElement>(null)
  const pan = useRef<{ sx: number; sy: number; x: number; y: number } | null>(null)
  const [cam, setCam] = useState({ x: 0, y: 0, z: 1, a: 0 }) // a = angle de la vue en degrés (0 ou 45)
  // Cadre tout le plan dans la vue, avec la rotation demandée (0 = normal, 45 = vue en diagonale), centré.
  const fit = (a = 0) => {
    const v = view.current; if (!v) return
    const cw = (GW + 2 * M) * CS, ch = (GH + 2 * M) * CS, r = a * Math.PI / 180, co = Math.cos(r), si = Math.sin(r)
    const bw = cw * Math.abs(co) + ch * Math.abs(si), bh = cw * Math.abs(si) + ch * Math.abs(co)
    const z = Math.min(v.clientWidth / bw, v.clientHeight / bh) * .95
    // le centre du plan (cw/2, ch/2) doit tomber au centre de la vue
    const px = cw / 2 * z, py = ch / 2 * z
    setCam({ z, a, x: v.clientWidth / 2 - (px * co - py * si), y: v.clientHeight / 2 - (px * si + py * co) })
  }
  const zoomAt = (px: number, py: number, f: number) => setCam(c => { const z = Math.min(4, Math.max(.2, c.z * f)), k = z / c.z; return { ...c, z, x: px - (px - c.x) * k, y: py - (py - c.y) * k } })
  const zoomCenter = (f: number) => { const v = view.current; if (v) zoomAt(v.clientWidth / 2, v.clientHeight / 2, f) }
  const wheel = (e: React.WheelEvent) => { const r = view.current!.getBoundingClientRect(); zoomAt(e.clientX - r.left, e.clientY - r.top, e.deltaY < 0 ? 1.1 : 1 / 1.1) }
  const vDown = (e: React.PointerEvent) => { if (tool === 'hand' || e.button === 1 || e.target !== cv.current) { pan.current = { sx: e.clientX, sy: e.clientY, x: cam.x, y: cam.y }; view.current!.setPointerCapture(e.pointerId) } }
  const vMove = (e: React.PointerEvent) => { const p = pan.current; if (p) setCam(c => ({ ...c, x: p.x + e.clientX - p.sx, y: p.y + e.clientY - p.sy })) }
  const vUp = () => { pan.current = null }
  useEffect(() => { fit() }, [])
  const grass = useRef<HTMLImageElement | null>(null)
  const terrain = useRef<{ k: string; c: HTMLCanvasElement } | null>(null)
  type Tgt = { cell: Pt; vert: Pt; edge: EdgeRef }
  const it = itemOf(itemId)

  useEffect(() => { try { const s = localStorage.getItem(KEY); if (s) { const d = JSON.parse(s); if (d.w === GW && d.h === GH) setPlan(withHoles({ ...d, nb: d.nb ?? Array(GW * GH).fill(false), ng: d.ng ?? Array(GW * GH).fill(0), hole: [] })) } } catch {} loaded.current = true }, [])
  useEffect(() => { if (loaded.current) try { localStorage.setItem(KEY, JSON.stringify(plan)) } catch {} }, [plan])

  const commit = (n: Plan) => { undo.current.push(plan); if (undo.current.length > 100) undo.current.shift(); redo.current = []; setPlan(n) }
  const doUndo = () => { const p = undo.current.pop(); if (p) { redo.current.push(plan); setPlan(p) } }
  const doRedo = () => { const p = redo.current.pop(); if (p) { undo.current.push(plan); setPlan(p) } }
  const pickTool = (t: Tool) => { setTool(t); if (!MODES[t].includes(mode)) setMode('single') }

  useEffect(() => {
    const f = (e: KeyboardEvent) => {
      if (ask) { e.preventDefault(); return } // popup ouverte : tout est bloqué tant qu'on n'a pas répondu Oui / Non
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? doRedo() : doUndo() }
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); doRedo() }
      else if (e.key.toLowerCase() === 'r' && it.rotatable) setRot(r => ((r + 90) % 360) as Rot)
    }
    window.addEventListener('keydown', f); return () => window.removeEventListener('keydown', f)
  })

  const target = (e: React.PointerEvent): Tgt => {
    // On retrouve le point du plan sous la souris en annulant le déplacement, la rotation et le zoom de la caméra.
    const vr = view.current!.getBoundingClientRect(), r = cam.a * Math.PI / 180, co = Math.cos(r), si = Math.sin(r)
    const dx = e.clientX - vr.left - cam.x, dy = e.clientY - vr.top - cam.y
    const px = (dx * co + dy * si) / cam.z, py = (-dx * si + dy * co) / cam.z
    const fx = px / CS - M, fy = py / CS - M
    return { cell: { x: Math.floor(fx), y: Math.floor(fy) }, vert: { x: Math.round(fx), y: Math.round(fy) }, edge: nearestEdge(fx, fy) }
  }
  const shape = (a: Tgt, b: Tgt): Shape => {
    if (tool === 'wall') return mode === 'single' ? { edges: [a.edge] } : mode === 'line' ? { edges: edgeLine(a.vert, b.vert) } : { edges: edgeRect(a.vert, b.vert) }
    if (mode === 'brush') return { cells: drag.current?.path ?? [] }
    if (mode === 'line') return { cells: lineCells(a.cell, b.cell) }
    if (mode === 'rect') return { cells: rectCells(a.cell, b.cell) }
    if (mode === 'fill') return { cells: fillCells(plan, a.cell, level) }
    return { cells: [a.cell] }
  }
  const down = (e: React.PointerEvent) => { if (e.button !== 0 || tool === 'hand') return; const t = target(e); drag.current = { a: t, path: [t.cell] }; cv.current!.setPointerCapture(e.pointerId); setPv(shape(t, t)) }
  const move = (e: React.PointerEvent) => {
    const d = drag.current; if (!d) return
    const t = target(e), l = d.path[d.path.length - 1]
    if (mode === 'brush' && (l.x !== t.cell.x || l.y !== t.cell.y)) d.path.push(t.cell)
    setPv(shape(d.a, t))
  }
  const up = (e: React.PointerEvent) => {
    const d = drag.current; if (!d) return
    const end = target(e), s = shape(d.a, end); drag.current = null; setPv(null)
    // Simple clic sur une zone rouge : popup de suppression. Avec l'outil Mur, un clic près d'un côté collé au blanc pose un mur à la place.
    const same = d.a.cell.x === end.cell.x && d.a.cell.y === end.cell.y
    if (same && d.path.length === 1 && tool !== 'hand' && (tool !== 'wall' || mode !== 'single' || edgeBlocked(plan, d.a.edge)) && inB(plan, end.cell.x, end.cell.y) && plan.nb[end.cell.y * plan.w + end.cell.x]) { setAsk(end.cell); return }
    let n = plan
    if (s.cells) n = applyCells(n, s.cells, tool, level, it, rot)
    if (s.edges) n = applyEdges(n, s.edges, wk, level)
    commit(n)
  }

  useEffect(() => {
    const c = cv.current; if (!c) return
    const g = c.getContext('2d')!, W = plan.w * CS, H = plan.h * CS
    c.width = W + 2 * M * CS; c.height = H + 2 * M * CS
    if (!grass.current) { const im = new Image(); im.onload = () => setTick(t => t + 1); im.src = asset('/assets/grass.png'); grass.current = im }
    const ok = grass.current.complete && grass.current.naturalWidth > 0
    const k = `${plan.w}x${plan.h}${ok ? 'i' : 'p'}${plan.hole.map((h, i) => h ? 1 : plan.nb[i] ? 2 : 0).join('')}`
    if (terrain.current?.k !== k) terrain.current = { k, c: makeTerrain(plan.w + 2 * M, plan.h + 2 * M, ok ? grass.current : undefined, plan.hole, plan.nb, plan.w) }
    g.drawImage(terrain.current.c, 0, 0); g.translate(M * CS, M * CS)
    const floorImg = (l: number) => {
      const src = FLOOR_IMAGES[l]; if (!src) return undefined
      let im = imgs.current.get(src)
      if (!im) { im = new Image(); im.onload = () => setTick(t => t + 1); im.src = asset(src); imgs.current.set(src, im) }
      return im.complete && im.naturalWidth > 0 ? im : undefined
    }
    for (let y = 0; y < plan.h; y++) for (let x = 0; x < plan.w; x++) {
      const l = plan.floor[y * plan.w + x]; if (!l) continue
      const im = floorImg(l)
      if (im) g.drawImage(im, x * CS, y * CS, CS, CS)
      else { g.fillStyle = FLOOR_COLORS[l]; g.fillRect(x * CS, y * CS, CS, CS) }
    }
    // Zones interdites : simple teinte rouge transparente sur l'herbe (pas de zone claire dessous), avec de grandes croix rouges
    g.fillStyle = 'rgba(230,60,60,.32)'
    for (let y = 0; y < plan.h; y++) for (let x = 0; x < plan.w; x++) if (plan.nb[y * plan.w + x]) g.fillRect(x * CS, y * CS, CS, CS)
    // Grille : traits blancs partout sauf à l'intérieur des zones interdites, (les grandes croix rouges sont dessinées plus bas)
    const hl: [number, number, number, number][] = []
    const vis = (e: EdgeRef) => (e.o === 'h' ? [[e.x, e.y - 1], [e.x, e.y]] : [[e.x - 1, e.y], [e.x, e.y]]).some(([cx, cy]) => !isHole(plan, cx, cy)) // grille absente entre deux cases retirées
    for (let y = 0; y <= plan.h; y++) for (let x = 0; x < plan.w; x++) if (vis({ o: 'h', x, y }) && !edgeBlocked(plan, { o: 'h', x, y })) hl.push([x * CS, y * CS + .5, (x + 1) * CS, y * CS + .5])
    for (let x = 0; x <= plan.w; x++) for (let y = 0; y < plan.h; y++) if (vis({ o: 'v', x, y }) && !edgeBlocked(plan, { o: 'v', x, y })) hl.push([x * CS + .5, y * CS, x * CS + .5, (y + 1) * CS])
    g.lineWidth = 1
    g.strokeStyle = 'rgba(255,255,255,.32)'; g.beginPath(); for (const [x0, y0, x1, y1] of hl) { g.moveTo(x0, y0); g.lineTo(x1, y1) } g.stroke()
    // Petites croix blanches : uniquement aux sommets touchant au moins une case constructible (aucune croix rouge)
    g.fillStyle = 'rgba(255,255,255,.85)'
    for (let y = 0; y <= plan.h; y++) for (let x = 0; x <= plan.w; x++) {
      const around = [[x - 1, y - 1], [x, y - 1], [x - 1, y], [x, y]]
      if (!around.some(([cx, cy]) => !isHole(plan, cx, cy) && !plan.nb[cy * plan.w + cx])) continue
      g.fillRect(x * CS - 3, y * CS - .5, 7, 1.5); g.fillRect(x * CS - .5, y * CS - 3, 1.5, 7)
    }
    // Zones interdites : rayures diagonales rouge clair, contour rouge clair, coins plus foncés (style jeu)
    const zones = new Map<number, Pt[]>()
    plan.nb.forEach((v, i) => { if (v) { const k = nbKey(plan, i), l = zones.get(k) ?? []; l.push({ x: i % plan.w, y: Math.floor(i / plan.w) }); zones.set(k, l) } })
    const LIGHT = 'rgba(255,120,120,.9)', DARK = 'rgba(185,25,25,.95)' // contour clair / coins foncés
    const STRIPE = 'rgba(255,175,175,.32)', STRIPE_W = 7, STRIPE_GAP = 18 // rayures : couleur, épaisseur, espacement (px)
    const CORNER = 16, EDGE_W = 2, CORNER_W = 4 // longueur des coins, épaisseur du contour, épaisseur des coins
    const isNb = (x: number, y: number) => inB(plan, x, y) && plan.nb[y * plan.w + x]
    // bordure fine rouge autour de chaque case interdite (comme la grille blanche)
    g.strokeStyle = 'rgba(255,110,110,.55)'; g.lineWidth = 1; g.beginPath()
    plan.nb.forEach((v, i) => { if (v) g.rect((i % plan.w) * CS + .5, Math.floor(i / plan.w) * CS + .5, CS, CS) })
    g.stroke()
    for (const [zk, cells] of zones) {
      const inZ = (x: number, y: number) => isNb(x, y) && nbKey(plan, y * plan.w + x) === zk // même zone seulement : 2 zones voisines gardent chacune leur contour
      const x0 = Math.min(...cells.map(c => c.x)) * CS, x1 = (Math.max(...cells.map(c => c.x)) + 1) * CS
      const y0 = Math.min(...cells.map(c => c.y)) * CS, y1 = (Math.max(...cells.map(c => c.y)) + 1) * CS
      // rayures diagonales, limitées aux cases de la zone
      g.save(); g.beginPath(); for (const c of cells) g.rect(c.x * CS, c.y * CS, CS, CS); g.clip()
      g.strokeStyle = STRIPE; g.lineWidth = STRIPE_W; g.lineCap = 'butt'; g.beginPath()
      for (let d = x0 - (y1 - y0); d < x1; d += STRIPE_GAP) { g.moveTo(d, y1); g.lineTo(d + (y1 - y0), y0) }
      g.stroke(); g.restore()
      // contour clair (seulement les côtés extérieurs de la zone)
      g.strokeStyle = LIGHT; g.lineWidth = EDGE_W; g.lineCap = 'square'; g.beginPath()
      for (const { x, y } of cells) {
        const px = x * CS, py = y * CS
        if (!inZ(x, y - 1)) { g.moveTo(px, py); g.lineTo(px + CS, py) }
        if (!inZ(x, y + 1)) { g.moveTo(px, py + CS); g.lineTo(px + CS, py + CS) }
        if (!inZ(x - 1, y)) { g.moveTo(px, py); g.lineTo(px, py + CS) }
        if (!inZ(x + 1, y)) { g.moveTo(px + CS, py); g.lineTo(px + CS, py + CS) }
      }
      g.stroke()
      // coins foncés (angles extérieurs de la zone)
      g.strokeStyle = DARK; g.lineWidth = CORNER_W; g.lineCap = 'butt'; g.beginPath()
      for (const { x, y } of cells) {
        const px = x * CS, py = y * CS, t = !inZ(x, y - 1), bo = !inZ(x, y + 1), l = !inZ(x - 1, y), r = !inZ(x + 1, y)
        if (t && l) { g.moveTo(px, py + CORNER); g.lineTo(px, py); g.lineTo(px + CORNER, py) }
        if (t && r) { g.moveTo(px + CS - CORNER, py); g.lineTo(px + CS, py); g.lineTo(px + CS, py + CORNER) }
        if (bo && l) { g.moveTo(px, py + CS - CORNER); g.lineTo(px, py + CS); g.lineTo(px + CORNER, py + CS) }
        if (bo && r) { g.moveTo(px + CS - CORNER, py + CS); g.lineTo(px + CS, py + CS); g.lineTo(px + CS, py + CS - CORNER) }
      }
      g.stroke()
    }
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `${CS * .55}px sans-serif`
    for (const o of plan.objs) {
      const i = itemOf(o.t), f = fp(i, o.r), cx = (o.x + f.w / 2) * CS, cy = (o.y + f.h / 2) * CS
      let im = i.image ? imgs.current.get(i.image) : undefined
      if (i.image && !im) { im = new Image(); im.onload = () => setTick(t => t + 1); im.src = asset(i.image); imgs.current.set(i.image, im) }
      g.save(); g.translate(cx, cy)
      if (im?.complete && im.naturalWidth) { g.rotate(o.r * Math.PI / 180); g.drawImage(im, -i.w * CS / 2, -i.h * CS / 2, i.w * CS, i.h * CS) }
      else { g.fillStyle = i.color; g.fillRect(-f.w * CS / 2 + 2, -f.h * CS / 2 + 2, f.w * CS - 4, f.h * CS - 4); g.fillStyle = '#fff'; g.fillText(i.icon, 0, 1) }
      g.restore()
    }
    const seg = (e: EdgeRef): [number, number, number, number] => e.o === 'h' ? [e.x * CS, e.y * CS, (e.x + 1) * CS, e.y * CS] : [e.x * CS, e.y * CS, e.x * CS, (e.y + 1) * CS]
    const stroke = (e: EdgeRef, col: string, w: number, cap: CanvasLineCap) => { const [a, b, c2, d] = seg(e); g.strokeStyle = col; g.lineWidth = w; g.lineCap = cap; g.beginPath(); g.moveTo(a, b); g.lineTo(c2, d); g.stroke() }
    const walls = (arr: (typeof plan.hw), o: 'h' | 'v', cols: number) => arr.forEach((w, i) => {
      if (!w) return
      const e: EdgeRef = { o, x: i % cols, y: Math.floor(i / cols) }
      stroke(e, WALL_COLORS[w.l], 8, 'square')
      if (w.k === 'door') stroke(e, '#e9d9a8', 4, 'butt'); else if (w.k === 'window') stroke(e, '#8fd3ee', 4, 'butt')
    })
    walls(plan.hw, 'h', plan.w); walls(plan.vw, 'v', plan.w + 1)
    if (pv?.cells) { g.fillStyle = 'rgba(60,195,214,.35)'; for (const p of pv.cells) if (!isHole(plan, p.x, p.y)) g.fillRect(p.x * CS, p.y * CS, CS, CS) }
    if (pv?.edges) for (const e of pv.edges) if (inE(plan, e) && !edgeBlocked(plan, e)) stroke(e, 'rgba(60,195,214,.8)', 8, 'square')
  }, [plan, pv, tick])

  const counts = plan.objs.reduce<Record<string, number>>((a, o) => (a[o.t] = (a[o.t] || 0) + 1, a), {})
  const lv = (
    <div className="row">{[1, 2, 3, 4, 5].map(l => <button key={l} aria-pressed={level === l} onClick={() => setLevel(l)}><span className="sw" style={tool !== 'wall' && FLOOR_IMAGES[l] ? { background: `${FLOOR_COLORS[l]} url(${asset(FLOOR_IMAGES[l]!)}) center/cover` } : { background: tool === 'wall' ? WALL_COLORS[l] : FLOOR_COLORS[l] }} />{l}</button>)}</div>
  )
  return (
    <div className="app">
      <aside className="side">
        <h1>{dict.title}</h1>
        <h2>{ui.tool}</h2>
        <div className="row">{TOOLS.map(k => <button key={k} aria-pressed={tool === k} onClick={() => pickTool(k)}>{dict.tools[k]}</button>)}</div>
        <h2>{ui.mode}</h2>
        <div className="row">{MODES[tool].map(m => <button key={m} aria-pressed={mode === m} onClick={() => setMode(m)}>{dict.modes[m]}</button>)}</div>
        {(tool === 'floor' || tool === 'wall') && <><h2>{ui.materialLevel}</h2>{lv}</>}
        {tool === 'wall' && <><h2>{ui.wallType}</h2><div className="row">{WKINDS.map(k => <button key={k} aria-pressed={wk === k} onClick={() => setWk(k)}>{dict.wallKinds[k]}</button>)}</div></>}
        {tool === 'object' && <>
          <h2>{ui.object}</h2>
          <div className="row">{CATALOG.map(i => <button key={i.id} aria-pressed={itemId === i.id} onClick={() => setItemId(i.id)}>{i.icon} {dict.items[i.id]}</button>)}</div>
          <h2>{fmt(ui.rotation, { deg: rot })}</h2>
          <button disabled={!it.rotatable} onClick={() => setRot(r => ((r + 90) % 360) as Rot)}>{ui.rotate}</button>
          <p className="mu">{it.max ? fmt(ui.hintFloorMax, { max: it.max }) : ui.hintFloor}</p>
        </>}
      </aside>
      <section className="stage" ref={view} style={{ cursor: tool === 'hand' ? 'grab' : undefined }} onPointerDown={vDown} onPointerMove={vMove} onPointerUp={vUp} onPointerCancel={vUp} onWheel={wheel}>
        <canvas ref={cv} style={{ transform: `translate(${cam.x}px,${cam.y}px) rotate(${cam.a}deg) scale(${cam.z})` }} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={() => { drag.current = null; setPv(null) }} />
        <div className="float" onPointerDown={e => e.stopPropagation()}>
          <button disabled={!undo.current.length} onClick={doUndo}>{ui.undo}</button>
          <button disabled={!redo.current.length} onClick={doRedo}>{ui.redo}</button>
          <button onClick={() => commit(freshPlan())}>{ui.clearAll}</button>
          <button onClick={() => zoomCenter(1 / 1.2)}>−</button><span className="mu">{Math.round(cam.z * 100)} %</span><button onClick={() => zoomCenter(1.2)}>+</button>
          <button onClick={() => fit(0)}>{ui.resetCamera}</button>
          <button aria-pressed={cam.a === -45} onClick={() => fit(cam.a === -45 ? 0 : -45)}>{ui.view45}</button>
          <select aria-label={dict.language} value={locale} onChange={e => changeLang(e.target.value as Locale)} style={{ marginLeft: 'auto' }}>{locales.map(l => <option key={l} value={l}>{LOCALE_LABEL[l]}</option>)}</select>
        </div>
        <p className="foot mu">{CATALOG.filter(i => counts[i.id]).map(i => `${dict.items[i.id]} : ${counts[i.id]}`).join(' · ') || ui.noObjects}</p>
      </section>
      {ask && (
        <div className="modal" onPointerDown={e => e.stopPropagation()} onWheel={e => e.stopPropagation()}>
          <div className="pn">
            <p style={{ margin: '0 0 10px' }}>{ui.removeDebris}</p>
            <div className="row">
              <button onClick={() => { const n = structuredClone(plan); for (const c of nbGroup(plan, ask.x, ask.y)) { n.nb[c.y * n.w + c.x] = false; n.ng[c.y * n.w + c.x] = 0 } commit(n); setAsk(null) }}>{ui.yes}</button>
              <button onClick={() => setAsk(null)}>{ui.no}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
