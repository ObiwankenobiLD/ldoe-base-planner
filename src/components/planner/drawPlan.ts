import type { MutableRefObject } from 'react'
import { FLOOR_COLORS, FLOOR_IMAGES, WALL_COLORS, edgeBlocked, edgeViolation, eIdx, fp, inB, inE, isHole, itemOf, nbKey, vertOk } from '@/lib/plan'
import type { EdgeRef, Plan, Pt } from '@/lib/plan'
import { WALL_W, CS, M, asset, PV_OK, PV_BAD, PV_YEL } from './config'
import type { Tool, Mode, WKind, Shape } from './config'
import { makeTerrain, paintTint } from './terrain'
import { wallEdges, wallEnd } from './actions'
import { drawOpening } from './drawOpening'

type Scene = {
  plan: Plan; pv: Shape | null; cam: { x: number; y: number; z: number; a: number }; size: { w: number; h: number; dpr: number }
  hov: Pt | null; anchor: Pt | null; tool: Tool; mode: Mode; wk: WKind; level: number
  wp: { a: Pt; b: Pt } | null; wallFlow: boolean
  imgs: MutableRefObject<Map<string, HTMLImageElement>>
  grass: MutableRefObject<HTMLImageElement | null>
  terrain: MutableRefObject<{ k: string; c: HTMLCanvasElement } | null>
  redraw: () => void // redessine quand une image finit de charger
}

/** Dessine tout le plan sur le canvas (appelé à chaque changement). */
export function drawPlan(c: HTMLCanvasElement, s: Scene) {
  const { plan, pv, cam, size, hov, anchor, tool, mode, wk, level, wp, wallFlow, imgs, grass, terrain, redraw } = s
  const g = c.getContext('2d')!, cwu = (plan.w + 2 * M) * CS, chu = (plan.h + 2 * M) * CS
  const bw = Math.max(1, Math.round(size.w * size.dpr)), bh = Math.max(1, Math.round(size.h * size.dpr))
  c.width = bw; c.height = bh // (redimensionner efface le canvas : tout est redessiné ci-dessous)
  g.setTransform(size.dpr, 0, 0, size.dpr, 0, 0)
  g.translate(cam.x, cam.y); g.rotate(cam.a * Math.PI / 180); g.scale(cam.z, cam.z) // caméra appliquée au dessin : net à tout zoom
  g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high'
  if (!grass.current) { const im = new Image(); im.onload = () => redraw(); im.src = asset('/assets/grass.png'); grass.current = im }
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
    if (!im) { im = new Image(); im.onload = () => redraw(); im.src = asset(src); imgs.current.set(src, im) }
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
    if (i.image && !im) { im = new Image(); im.onload = () => redraw(); im.src = asset(i.image); imgs.current.set(i.image, im) }
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
}
