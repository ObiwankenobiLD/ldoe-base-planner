'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { LANG_KEY, LOCALE_LABEL, locales } from '@/i18n/config'
import type { Locale } from '@/i18n/config'
import { fmt } from '@/i18n/dictionaries'
import type { Dict } from '@/i18n/dictionaries'
import { CATALOG, FLOOR_COLORS, FLOOR_IMAGES, WALL_COLORS, canPlace, RULES, pruneAround, edgeBlocked, edgeLine, edgeRect, edgeViolation, eIdx, fillCells, fp, inB, inE, isHole, itemOf, lineCells, nbGroup, nbKey, nearestEdge, newPlan, objAt, objViolation, rectCells, vertOk } from '@/lib/plan'
import type { EdgeRef, Item, Kind, Plan, Pt, Rot, Rule, Violation } from '@/lib/plan'

type Tool = 'floor' | 'wall' | 'object' | 'eraser' | 'hand'
type UiTool = 'building' | 'object' | 'eraser' | 'hand' // « Building / Structure » regroupe les outils internes floor (fondations) et wall (murs, portes, fenêtres)
type Cat = 'foundation' | 'wall' | 'door' | 'window'
type Mode = 'single' | 'brush' | 'line' | 'rect' | 'fill'
type WKind = Kind | 'clear'
type Shape = { cells?: Pt[]; edges?: EdgeRef[] }
const WALL_W = 5 // épaisseur des murs sur le plan (en px, 8 = ancienne valeur)
const OPEN_PAD = 11, OPEN_T = 3.5 // porte et fenêtre : marge de chaque côté (plus grand = plus court) et épaisseur du rectangle
const OPEN_FILL = { door: '#4fbf5f', window: '#8fd3ee' } // intérieur : vert pour la porte, bleu pour la fenêtre
/** Porte / fenêtre : même rectangle à contour blanc, seul l'intérieur change de couleur. Repère local : x le long du côté (0 à 40), y en travers, centré sur le mur. */
function drawOpening(g: CanvasRenderingContext2D, x0: number, y0: number, vertical: boolean, kind: 'door' | 'window') {
  const len = 40 - 2 * OPEN_PAD
  g.save(); g.translate(x0, y0); if (vertical) g.rotate(Math.PI / 2); g.lineCap = 'butt'
  g.fillStyle = OPEN_FILL[kind]; g.fillRect(OPEN_PAD, -OPEN_T / 2, len, OPEN_T) // intérieur
  g.strokeStyle = '#ffffff'; g.lineWidth = 1; g.strokeRect(OPEN_PAD, -OPEN_T / 2, len, OPEN_T) // contour blanc
  g.restore()
}
const CS = 40, KEY = 'base-planner-v3', HIDE_KEY = 'base-planner-hidden-warnings', GW = 21, GH = 18 // taille de grille fixe (largeur x hauteur)
const MODES: Record<Tool, Mode[]> = { floor: ['single', 'brush', 'line', 'rect', 'fill'], wall: ['single', 'line', 'rect'], object: ['single', 'brush', 'line', 'rect'], eraser: ['single', 'brush', 'rect'], hand: [] }
const UI_TOOLS: UiTool[] = ['building', 'object'] // Gomme et Main sont dans la barre du haut
/** Image (ou emoji) affichée devant chaque outil du cadre « Outil ». Pour changer : déposer l'image dans public/assets/ et mettre son chemin ici. */
const TOOL_VISUAL: Record<'building' | 'object', { img?: string; emoji?: string }> = { building: { img: '/assets/building-foundation.png' }, object: { emoji: '📦' } }
const CATS: Cat[] = ['foundation', 'wall', 'door', 'window']
/** Catégories de l'outil « Établis » (même principe que Fondations / Murs / Portes / Fenêtres pour Structure).
 *  Pour ajouter une catégorie : l'ajouter ici, puis ranger les objets dedans avec ITEM_CAT. */
type ObjCat = 'storage'
const OBJ_CATS: { key: ObjCat; fr: string; emoji: string }[] = [{ key: 'storage', fr: 'Entrepôt', emoji: '📦' }]
const ITEM_CAT: Partial<Record<string, ObjCat>> = {} // catégorie de chaque objet (id → catégorie) ; un objet absent d'ici va dans « Entrepôt »
const CAT_IMG: Record<Cat, string> = { foundation: '/assets/building-foundation.png', wall: '/assets/building-wall.png', door: '/assets/building-door.png', window: '/assets/building-window.png' }
/** Icônes des sols dans la LISTE du menu (index = niveau 1 à 5). Les textures de la CARTE restent FLOOR_IMAGES (plan.ts). */
const FLOOR_ICONS = ['', '/assets/building-floor1.png', '/assets/building-floor2.png', '/assets/building-floor3.png', '/assets/building-floor4.png', '/assets/building-floor5.png']
/** Icônes des murs, portes et fenêtres dans la LISTE du menu (index = niveau 1 à 5).
 *  Chemin dans public/assets/. Si le fichier n'existe pas, la liste retombe sur la couleur du mur. */
const WALL_IMAGES: Record<'wall' | 'door' | 'window', string[]> = {
  wall:   ['', '/assets/building-wall1.png',   '/assets/building-wall2.png',   '/assets/building-wall3.png',   '/assets/building-wall4.png',   '/assets/building-wall5.png'],
  door:   ['', '/assets/building-door1.png',   '/assets/building-door2.png',   '/assets/building-door3.png',   '/assets/building-door4.png',   '/assets/building-door5.png'],
  window: ['', '/assets/building-window1.png', '/assets/building-window2.png', '/assets/building-window3.png', '/assets/building-window4.png', '/assets/building-window5.png'],
}
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
  paintTint(g, cw, ch, hole, nb, gw)
  return c
}
/** Teinte par-dessus l'herbe : zone constructible claire, zone neutre, vert « hors carte ». */
function paintTint(g: CanvasRenderingContext2D, cw: number, ch: number, hole?: boolean[], nb?: boolean[], gw = 0) {
  for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
    const inside = x >= M && x < cw - M && y >= M && y < ch - M
    const near = x >= M - BAND && x < cw - M + BAND && y >= M - BAND && y < ch - M + BAND
    const removed = inside && !!(hole?.[(y - M) * gw + (x - M)] || nb?.[(y - M) * gw + (x - M)]) // ni zone claire sous les zones rouges ni sur les cases retirées
    g.fillStyle = inside && !removed ? 'rgba(255,255,255,.12)' : near ? BAND_TINT : 'rgba(70,205,30,.5)'; g.fillRect(x * CS, y * CS, CS, CS)
  }
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
/** Résultat d'une action : `plan` est le MÊME objet que l'entrée si rien n'a changé (pas d'entrée d'historique inutile) ; `bad` liste les règles de construction refusées. */
type Applied = { plan: Plan; bad: Violation[] }
function applyCells(p: Plan, cells: Pt[], tool: Tool, level: number, it: Item, rot: Rot): Applied {
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
function applyEdges(p: Plan, es: EdgeRef[], kind: WKind, level: number): Applied {
  const n = structuredClone(p), bad: Violation[] = []; let changed = false
  for (const e of es) {
    if (!inE(n, e) || edgeBlocked(n, e)) continue
    if (kind !== 'clear') { const v = edgeViolation(n, e, level); if (v) { bad.push(v); continue } }
    (e.o === 'h' ? n.hw : n.vw)[eIdx(n, e)] = kind === 'clear' ? null : { k: kind, l: level }; changed = true
  }
  return { plan: changed ? n : p, bad }
}
/** Murs / portes / fenêtres en « Ligne » ou « Rectangle » : on glisse d'un sommet à l'autre (aperçu pendant le glissé, pose au relâchement), ou on clique départ puis arrivée. */
const PV_OK = 'rgba(255,255,255,.92)', PV_BAD = 'rgba(235,70,70,.95)', PV_YEL = '#f7c81b' // aperçu valide / refusé par les règles, couleur des repères jaunes
const wallEdges = (m: Mode, a: Pt, b: Pt) => m === 'rect' ? edgeRect(a, b) : edgeLine(a, b)
/** Sommet d'arrivée réel : une ligne est alignée sur l'axe dominant (comme edgeLine), un rectangle va jusqu'à b. */
const wallEnd = (m: Mode, a: Pt, b: Pt): Pt => m === 'rect' ? b : Math.abs(b.x - a.x) >= Math.abs(b.y - a.y) ? { x: b.x, y: a.y } : { x: a.x, y: b.y }
type Opt = { key: string; label: string; sub?: string; img?: string; bg?: string; emoji?: string }
/** Miniature : l'image si elle existe, sinon un carré de couleur (avec emoji éventuel). */
function Thumb({ o }: { o: Opt }) {
  const [bad, setBad] = useState<string | null>(null) // chemin de l'image qui a échoué (et non un simple booléen) : le repli couleur ne vaut que pour CETTE image
  if (o.img && bad !== o.img) return <img className="il-th" src={asset(o.img)} alt="" draggable={false} onError={() => setBad(o.img!)} />
  return <span className="il-th" style={{ background: o.bg }}>{o.emoji}</span>
}
/** Liste verticale : miniature à gauche, nom en gras, petite ligne grise dessous. La ligne choisie est surlignée. */
function ItemList({ options, value, onPick }: { options: Opt[]; value: string | null; onPick: (k: string) => void }) {
  return (
    <div className="il">{options.map(o => (
      <button key={o.key} className="il-row" aria-pressed={o.key === value} onClick={() => onPick(o.key)}>
        <Thumb o={o} />
        <span className="il-tx"><b>{o.label}</b>{o.sub && <small>{o.sub}</small>}</span>
      </button>
    ))}</div>
  )
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
  const [objCat, setObjCat] = useState<ObjCat>('storage')
  const tr = (fr: string, other: string) => locale === 'fr' ? fr : other // textes français écrits ici ; les autres langues gardent le dictionnaire
  const [ask, setAsk] = useState<Pt | null>(null) // carré rouge en attente de confirmation de suppression
  const [pv, setPv] = useState<Shape | null>(null)
  const [warn, setWarn] = useState<Violation | null>(null) // règle de construction refusée : popup d'information
  const [hidden, setHidden] = useState<Rule[]>([]) // règles dont le joueur a coché « ne plus afficher » (le refus reste actif, seule la popup disparaît)
  const [dontShow, setDontShow] = useState(false)
  const [anchor, setAnchor] = useState<Pt | null>(null) // 1er point choisi (gros rond jaune), en attente du 2e
  const [hov, setHov] = useState<Pt | null>(null) // sommet sous la souris
  const [dv, setDv] = useState<Pt | null>(null) // sommet de départ d'un glisser
  const wallFlow = tool === 'wall' && mode !== 'single'
  useEffect(() => { setAnchor(null); setHov(null) }, [tool, mode]) // changer d'outil / de mode abandonne le tracé en cours
  const [tick, setTick] = useState(0)
  const cv = useRef<HTMLCanvasElement>(null)
  const undo = useRef<Plan[]>([]), redo = useRef<Plan[]>([])
  const drag = useRef<{ a: Tgt; path: Pt[] } | null>(null)
  const imgs = useRef(new Map<string, HTMLImageElement>())
  const loaded = useRef(false)
  const view = useRef<HTMLElement>(null)
  const pan = useRef<{ sx: number; sy: number; x: number; y: number } | null>(null)
  const [size, setSize] = useState({ w: 0, h: 0, dpr: 1 }) // taille de la vue (px CSS) et résolution de l'écran : le canvas est redessiné à la résolution réelle
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
  const vDown = (e: React.PointerEvent) => { if (tool === 'hand' || e.button === 1 || e.target !== cv.current || !inWorld(e)) { pan.current = { sx: e.clientX, sy: e.clientY, x: cam.x, y: cam.y }; view.current!.setPointerCapture(e.pointerId) } }
  const vMove = (e: React.PointerEvent) => { const p = pan.current; if (p) setCam(c => ({ ...c, x: p.x + e.clientX - p.sx, y: p.y + e.clientY - p.sy })) }
  const vUp = () => { pan.current = null }
  useEffect(() => { fit() }, [])
  useEffect(() => {
    const v = view.current; if (!v) return
    const upd = () => setSize({ w: v.clientWidth, h: v.clientHeight, dpr: window.devicePixelRatio || 1 })
    upd(); const ro = new ResizeObserver(upd); ro.observe(v); window.addEventListener('resize', upd)
    return () => { ro.disconnect(); window.removeEventListener('resize', upd) }
  }, [])
  const grass = useRef<HTMLImageElement | null>(null)
  const terrain = useRef<{ k: string; c: HTMLCanvasElement } | null>(null)
  type Tgt = { cell: Pt; vert: Pt; edge: EdgeRef; vd: number } // vd = distance (en cases) au sommet le plus proche
  const it = itemOf(itemId)

  useEffect(() => { try { const s = localStorage.getItem(KEY); if (s) { const d = JSON.parse(s); if (d.w === GW && d.h === GH) setPlan(withHoles({ ...d, nb: d.nb ?? Array(GW * GH).fill(false), ng: d.ng ?? Array(GW * GH).fill(0), hole: [] })) } } catch {} try { const h = JSON.parse(localStorage.getItem(HIDE_KEY) ?? '[]'); if (Array.isArray(h)) setHidden(h.filter((r: string): r is Rule => (RULES as readonly string[]).includes(r))) } catch {} loaded.current = true }, [])
  useEffect(() => { if (loaded.current) try { localStorage.setItem(KEY, JSON.stringify(plan)) } catch {} }, [plan])

  const closeWarn = () => {
    if (warn && dontShow && !hidden.includes(warn.rule)) { const h = [...hidden, warn.rule]; setHidden(h); try { localStorage.setItem(HIDE_KEY, JSON.stringify(h)) } catch {} }
    setWarn(null); setDontShow(false)
  }
  const commit = (n: Plan) => { undo.current.push(plan); if (undo.current.length > 100) undo.current.shift(); redo.current = []; setPlan(n) }
  const doUndo = () => { const p = undo.current.pop(); if (p) { redo.current.push(plan); setPlan(p) } }
  const doRedo = () => { const p = redo.current.pop(); if (p) { undo.current.push(plan); setPlan(p) } }
  /** Enregistre le résultat d'une action et affiche la popup de la première règle refusée (sauf règles masquées). */
  const finish = (n: Plan, bad: Violation[]) => {
    if (n !== plan) commit(n)
    const v = RULES.map(r => bad.find(b => b.rule === r)).find(b => b && !hidden.includes(b.rule))
    if (v) { setDontShow(false); setWarn(v) }
  }
  /** Pose les murs / portes / fenêtres entre deux sommets, tout de suite (pas d'étape de validation). */
  const applyWall = (a: Pt, b: Pt) => { const r = applyEdges(plan, wallEdges(mode, a, b), wk, level); finish(r.plan, r.bad) }
  const pickTool = (t: Tool) => { setTool(t); if (!MODES[t].includes(mode)) setMode('single') }
  const cat: Cat | null = tool === 'floor' ? 'foundation' : tool === 'wall' && wk !== 'clear' ? wk : null
  const pickCat = (c: Cat) => { if (c === 'foundation') pickTool('floor'); else { pickTool('wall'); setWk(c) } }
  const pickUi = (u: UiTool) => { if (u === 'building') { if (tool !== 'floor' && tool !== 'wall') pickTool('wall') } else pickTool(u) }

  useEffect(() => {
    const f = (e: KeyboardEvent) => {
      if (warn) { e.preventDefault(); if (e.key === 'Enter' || e.key === 'Escape') closeWarn(); return } // popup d'information : Entrée / Échap = OK
      if (ask) { e.preventDefault(); return } // popup ouverte : tout est bloqué tant qu'on n'a pas répondu Oui / Non
      if (e.key === 'Escape' && anchor) setAnchor(null)
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? doRedo() : doUndo() }
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); doRedo() }
      else if (e.key.toLowerCase() === 'r' && it.rotatable) setRot(r => ((r + 90) % 360) as Rot)
    }
    window.addEventListener('keydown', f); return () => window.removeEventListener('keydown', f)
  })

  // Point du plan sous la souris, en annulant le déplacement, la rotation et le zoom de la caméra.
  const world = (e: React.PointerEvent) => {
    const vr = view.current!.getBoundingClientRect(), r = cam.a * Math.PI / 180, co = Math.cos(r), si = Math.sin(r)
    const dx = e.clientX - vr.left - cam.x, dy = e.clientY - vr.top - cam.y
    return { px: (dx * co + dy * si) / cam.z, py: (-dx * si + dy * co) / cam.z }
  }
  const inWorld = (e: React.PointerEvent) => { const { px, py } = world(e); return px >= 0 && py >= 0 && px < (GW + 2 * M) * CS && py < (GH + 2 * M) * CS }
  const target = (e: React.PointerEvent): Tgt => {
    const { px, py } = world(e)
    const fx = px / CS - M, fy = py / CS - M
    return { cell: { x: Math.floor(fx), y: Math.floor(fy) }, vert: { x: Math.round(fx), y: Math.round(fy) }, edge: nearestEdge(fx, fy), vd: Math.hypot(fx - Math.round(fx), fy - Math.round(fy)) }
  }
  const shape = (a: Tgt, b: Tgt): Shape => {
    if (tool === 'wall') return mode === 'single' ? { edges: [a.edge] } : mode === 'line' ? { edges: edgeLine(a.vert, b.vert) } : { edges: edgeRect(a.vert, b.vert) }
    if (mode === 'brush') return { cells: drag.current?.path ?? [] }
    if (mode === 'line') return { cells: lineCells(a.cell, b.cell) }
    if (mode === 'rect') return { cells: rectCells(a.cell, b.cell) }
    if (mode === 'fill') return { cells: fillCells(plan, a.cell, level) }
    return { cells: [a.cell] }
  }
  const down = (e: React.PointerEvent) => {
    if (e.button !== 0 || tool === 'hand' || !inWorld(e)) return
    const t = target(e); drag.current = { a: t, path: [t.cell] }; cv.current!.setPointerCapture(e.pointerId)
    if (wallFlow) { setDv(t.vert); setHov(t.vert) } else setPv(shape(t, t))
  }
  const move = (e: React.PointerEvent) => {
    const t = target(e)
    if (wallFlow) setHov(h => h && h.x === t.vert.x && h.y === t.vert.y ? h : t.vert)
    const d = drag.current; if (!d) return
    const l = d.path[d.path.length - 1]
    if (mode === 'brush' && (l.x !== t.cell.x || l.y !== t.cell.y)) d.path.push(t.cell)
    if (!wallFlow) setPv(shape(d.a, t))
  }
  const up = (e: React.PointerEvent) => {
    const d = drag.current; if (!d) return
    const end = target(e), s = shape(d.a, end); drag.current = null; setPv(null); setDv(null)
    // Simple clic sur une zone rouge : popup de suppression. Avec l'outil Mur (mode Case), un clic près d'un côté collé au blanc pose un mur à la place ;
    // en Ligne / Rectangle, un clic près d'un sommet (point rond) sert à tracer, pas à supprimer.
    const same = d.a.cell.x === end.cell.x && d.a.cell.y === end.cell.y
    const redWanted = tool !== 'wall' || (mode === 'single' ? edgeBlocked(plan, d.a.edge) : end.vd > .35)
    if (same && d.path.length === 1 && tool !== 'hand' && redWanted && inB(plan, end.cell.x, end.cell.y) && plan.nb[end.cell.y * plan.w + end.cell.x]) { setAsk(end.cell); return }
    if (wallFlow) {
      const a = d.a.vert, b = end.vert, eq = (p: Pt | null, q: Pt) => !!p && p.x === q.x && p.y === q.y
      if (!eq(a, b)) { setAnchor(null); applyWall(a, b) } // glisser de a vers b : le relâchement pose directement
      else if (anchor && !eq(anchor, b)) { setAnchor(null); applyWall(anchor, b) } // variante en 2 clics : le 2e clic pose directement
      else if (anchor) setAnchor(null) // re-clic sur le point de départ : annule
      else if (vertOk(plan, b.x, b.y)) setAnchor(b) // 1er clic
      return
    }
    let n = plan; const bad: Violation[] = []
    if (s.cells) { const r = applyCells(n, s.cells, tool, level, it, rot); n = r.plan; bad.push(...r.bad) }
    if (s.edges) { const r = applyEdges(n, s.edges, wk, level); n = r.plan; bad.push(...r.bad) }
    finish(n, bad)
  }

  // Tracé affiché : un glisser en cours, sinon « point de départ → sommet survolé » (variante en 2 clics).
  const wp = wallFlow ? (dv && hov ? { a: dv, b: hov } : anchor ? { a: anchor, b: hov ?? anchor } : null) : null
  useEffect(() => {
    const c = cv.current; if (!c) return
    const g = c.getContext('2d')!, cwu = (plan.w + 2 * M) * CS, chu = (plan.h + 2 * M) * CS
    const bw = Math.max(1, Math.round(size.w * size.dpr)), bh = Math.max(1, Math.round(size.h * size.dpr))
    c.width = bw; c.height = bh // (redimensionner efface le canvas : tout est redessiné ci-dessous)
    g.setTransform(size.dpr, 0, 0, size.dpr, 0, 0)
    g.translate(cam.x, cam.y); g.rotate(cam.a * Math.PI / 180); g.scale(cam.z, cam.z) // caméra appliquée au dessin : net à tout zoom
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high'
    if (!grass.current) { const im = new Image(); im.onload = () => setTick(t => t + 1); im.src = asset('/assets/grass.png'); grass.current = im }
    const ok = grass.current.complete && grass.current.naturalWidth > 0
    if (ok) { // herbe en motif redessiné à chaque image : reste nette au zoom
      g.fillStyle = g.createPattern(grass.current, 'repeat')!; g.fillRect(0, 0, cwu, chu)
      paintTint(g, plan.w + 2 * M, plan.h + 2 * M, plan.hole, plan.nb, plan.w)
    } else { // repli sans image : herbe procédurale mise en cache
      const k = `${plan.w}x${plan.h}p${plan.hole.map((h, i) => h ? 1 : plan.nb[i] ? 2 : 0).join('')}`
      if (terrain.current?.k !== k) terrain.current = { k, c: makeTerrain(plan.w + 2 * M, plan.h + 2 * M, undefined, plan.hole, plan.nb, plan.w) }
      g.drawImage(terrain.current.c, 0, 0)
    }
    g.translate(M * CS, M * CS)
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
    const hasWall = (e: EdgeRef) => inE(plan, e) && !!(e.o === 'h' ? plan.hw : plan.vw)[eIdx(plan, e)]
    const wallAt = (x: number, y: number) => hasWall({ o: 'h', x: x - 1, y }) || hasWall({ o: 'h', x, y }) || hasWall({ o: 'v', x, y: y - 1 }) || hasWall({ o: 'v', x, y }) // un mur touche ce sommet
    if (!wallFlow) for (let y = 0; y <= plan.h; y++) for (let x = 0; x <= plan.w; x++) {
      if (wallAt(x, y)) continue // pas de croix sous / autour d'un mur : leurs branches dépasseraient du trait
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
      stroke(e, WALL_COLORS[w.l], WALL_W, 'square')
      if (w.k !== 'wall') drawOpening(g, seg(e)[0], seg(e)[1], o === 'v', w.k)
    })
    walls(plan.hw, 'h', plan.w); walls(plan.vw, 'v', plan.w + 1)
    if (pv?.cells) { g.fillStyle = 'rgba(255,255,255,.4)'; for (const p of pv.cells) if (!isHole(plan, p.x, p.y)) g.fillRect(p.x * CS, p.y * CS, CS, CS) }
    if (wallFlow) {
      const k = Math.min(1.6, Math.max(1, 1 / cam.z)) // repères jamais plus petits que leur taille naturelle quand on dézoome
      const ring = (x: number, y: number, r: number) => { g.beginPath(); g.arc(x * CS, y * CS, r, 0, Math.PI * 2) }
      // points ronds gris avec un « + » sur chaque sommet constructible ; le sommet visé s'entoure de jaune
      for (let y = 0; y <= plan.h; y++) for (let x = 0; x <= plan.w; x++) {
        if (!vertOk(plan, x, y)) continue
        ring(x, y, 3.5 * k); g.fillStyle = 'rgba(205,210,215,.55)'; g.fill()
        g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = 1.2; g.lineCap = 'butt'; g.beginPath()
        g.moveTo(x * CS - 2 * k, y * CS); g.lineTo(x * CS + 2 * k, y * CS); g.moveTo(x * CS, y * CS - 2 * k); g.lineTo(x * CS, y * CS + 2 * k); g.stroke()
      }
      if (hov && vertOk(plan, hov.x, hov.y) && !(anchor && hov.x === anchor.x && hov.y === anchor.y)) { ring(hov.x, hov.y, 5.5 * k); g.fillStyle = 'rgba(247,200,27,.25)'; g.fill(); g.strokeStyle = PV_YEL; g.lineWidth = 2.2 * k; g.stroke() }
      if (wp) {
        const end = wallEnd(mode, wp.a, wp.b), es = wallEdges(mode, wp.a, wp.b).filter(e => inE(plan, e) && !edgeBlocked(plan, e))
        const col = (e: EdgeRef) => wk !== 'clear' && edgeViolation(plan, e, level) ? PV_BAD : PV_OK // rouge = refusé par les règles de construction
        for (const e of es) stroke(e, 'rgba(0,0,0,.55)', WALL_W + 3, 'round')
        for (const e of es) stroke(e, col(e), WALL_W - 1, 'round')
        const vs = new Map<string, Pt>()
        for (const e of es) { const p0 = { x: e.x, y: e.y }, p1 = e.o === 'h' ? { x: e.x + 1, y: e.y } : { x: e.x, y: e.y + 1 }; vs.set(`${p0.x},${p0.y}`, p0); vs.set(`${p1.x},${p1.y}`, p1) }
        for (const v of vs.values()) { ring(v.x, v.y, 3 * k); g.fillStyle = '#1d2226'; g.fill(); g.strokeStyle = PV_OK; g.lineWidth = 1.4; g.stroke() }
        if (end.x !== wp.a.x || end.y !== wp.a.y) { ring(end.x, end.y, 4 * k); g.fillStyle = '#1d2226'; g.fill(); g.strokeStyle = PV_YEL; g.lineWidth = 2.2 * k; g.stroke() } // arrivée : rond creux
        ring(wp.a.x, wp.a.y, 5.5 * k); g.fillStyle = PV_YEL; g.fill(); g.strokeStyle = '#1a1a1a'; g.lineWidth = 2.6 * k; g.stroke() // départ : gros rond jaune
        // pastille de longueur (nombre de murs) ou de dimensions (largeur×hauteur) au milieu du tracé
        const n = wallEdges(mode, wp.a, wp.b).length
        if (n > 0) {
          const txt = mode === 'rect' ? `${Math.abs(wp.b.x - wp.a.x)}×${Math.abs(wp.b.y - wp.a.y)}` : String(n)
          const cx = (mode === 'rect' ? (wp.a.x + wp.b.x) / 2 : (wp.a.x + end.x) / 2) * CS, cy = (mode === 'rect' ? (wp.a.y + wp.b.y) / 2 : (wp.a.y + end.y) / 2) * CS
          g.save(); g.translate(cx, cy); g.rotate(-cam.a * Math.PI / 180) // reste droite même en vue 45°
          g.font = `bold ${12 * k}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'
          const bw = g.measureText(txt).width + 14 * k, bh = 18 * k
          g.beginPath(); g.roundRect(-bw / 2, -bh / 2, bw, bh, bh / 2); g.fillStyle = '#161a1d'; g.fill(); g.strokeStyle = PV_YEL; g.lineWidth = 1.6; g.stroke()
          g.fillStyle = '#fff'; g.fillText(txt, 0, 1); g.restore()
        }
      } else if (anchor) { ring(anchor.x, anchor.y, 5.5 * k); g.fillStyle = PV_YEL; g.fill(); g.strokeStyle = '#1a1a1a'; g.lineWidth = 2.6 * k; g.stroke() }
    }
    if (pv?.edges) for (const e of pv.edges) if (inE(plan, e) && !edgeBlocked(plan, e)) stroke(e, tool === 'wall' && wk !== 'clear' && edgeViolation(plan, e, level) ? 'rgba(255,90,90,.85)' : 'rgba(255,255,255,.85)', WALL_W, 'square') // rouge = refusé par les règles de construction
  }, [plan, pv, tick, cam, size, hov, anchor, dv, tool, mode, wk, level])

  const counts = plan.objs.reduce<Record<string, number>>((a, o) => (a[o.t] = (a[o.t] || 0) + 1, a), {})
  const wallCat = wk === 'clear' ? 'wall' : wk // catégorie de mur dont on affiche les matériaux
  const matOpts: Opt[] = [1, 2, 3, 4, 5].map(l => ({
    key: String(l), label: (tool === 'floor' ? dict.floorNames : dict.wallNames)[l - 1], sub: fmt(ui.levelN, { n: l }),
    img: tool === 'floor' ? FLOOR_ICONS[l] : WALL_IMAGES[wallCat][l],
    bg: tool === 'wall' ? WALL_COLORS[l] : FLOOR_COLORS[l],
  }))
  const lv = <ItemList options={matOpts} value={String(level)} onPick={k => { setLevel(Number(k)); if (wk === 'clear') setWk('wall') }} />
  return (
    <div className="app">
      <aside className="side">
        <h1>{dict.title}</h1>
        <div className="blk"><h2>{ui.tool}</h2>
          <ItemList options={UI_TOOLS.map(k => ({ key: k, label: k === 'object' ? tr('Établis', dict.tools[k]) : dict.tools[k], ...TOOL_VISUAL[k as keyof typeof TOOL_VISUAL] }))} value={tool === 'floor' || tool === 'wall' ? 'building' : tool === 'object' ? 'object' : null} onPick={k => pickUi(k as UiTool)} />
        </div>
        {(tool === 'floor' || tool === 'wall') && <div className="blk"><h2>{ui.category}</h2>
          <ItemList options={CATS.map(c => ({ key: c, label: dict.categories[c], img: CAT_IMG[c] }))} value={cat} onPick={k => pickCat(k as Cat)} />
        </div>}
        {tool === 'object' && <div className="blk"><h2>{tr('Établis', ui.category)}</h2>
          <ItemList options={OBJ_CATS.map(c => ({ key: c.key, label: c.fr, emoji: c.emoji }))} value={objCat} onPick={k => setObjCat(k as ObjCat)} />
        </div>}
        <div className="blk"><h2>{ui.mode}</h2>
          <div className="row">{MODES[tool].map(m => <button key={m} aria-pressed={mode === m} onClick={() => setMode(m)}>{dict.modes[m]}</button>)}
            {tool === 'wall' && <button aria-pressed={wk === 'clear'} onClick={() => setWk('clear')}>{dict.wallKinds.clear}</button>}
          </div>
        </div>
        {(tool === 'floor' || tool === 'wall') && <div className="blk"><h2>{ui.materialLevel}</h2>{lv}</div>}
        {tool === 'object' && <>
          <div className="blk"><h2>{OBJ_CATS.find(c => c.key === objCat)?.fr}</h2>
          <ItemList options={CATALOG.filter(i => (ITEM_CAT[i.id] ?? 'storage') === objCat).map(i => ({ key: i.id, label: dict.items[i.id], emoji: i.icon, bg: i.color, sub: `${i.w}x${i.h} · ${ui.onFloor} · ${counts[i.id] || 0}${i.max ? '/' + i.max : ''}` }))} value={itemId} onPick={k => setItemId(k as typeof itemId)} />
          </div>
          <div className="blk"><h2>{fmt(ui.rotation, { deg: rot })}</h2>
            <button disabled={!it.rotatable} onClick={() => setRot(r => ((r + 90) % 360) as Rot)}>{ui.rotate}</button>
            <p className="mu" style={{ margin: '8px 0 0' }}>{it.max ? fmt(ui.hintFloorMax, { max: it.max }) : ui.hintFloor}</p>
          </div>
        </>}
      </aside>
      <section className="stage" ref={view} style={{ cursor: tool === 'hand' ? 'grab' : undefined }} onPointerDown={vDown} onPointerMove={vMove} onPointerUp={vUp} onPointerCancel={vUp} onWheel={wheel}>
        <canvas ref={cv} style={{ width: size.w, height: size.h }} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={() => { drag.current = null; setPv(null); setDv(null) }} onPointerLeave={() => { if (!drag.current) setHov(null) }} onContextMenu={e => { if (anchor) { e.preventDefault(); setAnchor(null) } }} />
        <div className="float" onPointerDown={e => e.stopPropagation()}>
          <button disabled={!undo.current.length} onClick={doUndo}>{ui.undo}</button>
          <button disabled={!redo.current.length} onClick={doRedo}>{ui.redo}</button>
          <button onClick={() => commit(freshPlan())}>{ui.clearAll}</button>
          <button onClick={() => zoomCenter(1 / 1.2)}>−</button><span className="mu">{Math.round(cam.z * 100)} %</span><button onClick={() => zoomCenter(1.2)}>+</button>
          <button onClick={() => fit(0)}>{ui.resetCamera}</button>
          <button aria-pressed={cam.a === -45} onClick={() => fit(cam.a === -45 ? 0 : -45)}>{ui.view45}</button>
          {(['eraser', 'hand'] as const).map(k => <button key={k} aria-pressed={tool === k} onClick={() => pickTool(k)}>{dict.tools[k]}</button>)}
          <select aria-label={dict.language} value={locale} onChange={e => changeLang(e.target.value as Locale)} style={{ marginLeft: 'auto' }}>{locales.map(l => <option key={l} value={l}>{LOCALE_LABEL[l]}</option>)}</select>
        </div>
        <p className="foot mu">{CATALOG.filter(i => counts[i.id]).map(i => `${dict.items[i.id]} : ${counts[i.id]}`).join(' · ') || ui.noObjects}</p>
      </section>
      {warn && (
        <div className="modal" onPointerDown={e => e.stopPropagation()} onWheel={e => e.stopPropagation()}>
          <div className="pn warn" role="alertdialog" aria-modal="true">
            <p style={{ margin: '0 0 12px' }}>{fmt(ui.warnings[warn.rule], { wall: warn.wall ?? '', floor: warn.floor ?? '' })}</p>
            <label className="chk"><input type="checkbox" checked={dontShow} onChange={e => setDontShow(e.target.checked)} />{ui.dontShowAgain}</label>
            <div className="row"><button autoFocus onClick={closeWarn}>{ui.ok}</button></div>
          </div>
        </div>
      )}
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
