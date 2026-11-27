'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { LANG_KEY, LOCALE_LABEL, locales } from '@/i18n/config'
import type { Locale } from '@/i18n/config'
import { fmt } from '@/i18n/dictionaries'
import type { Dict } from '@/i18n/dictionaries'
import { CATALOG, FLOOR_COLORS, WALL_COLORS, RULES, edgeBlocked, edgeLine, edgeRect, fillCells, inB, itemOf, lineCells, nbGroup, nearestEdge, rectCells, vertOk } from '@/lib/plan'
import type { Plan, Pt, Rot, Rule, Violation } from '@/lib/plan'
import { CS, KEY, HIDE_KEY, GW, GH, MODES, UI_TOOLS, TOOL_VISUAL, CATS, OBJ_CATS, ITEM_CAT, CAT_IMG, FLOOR_ICONS, WALL_IMAGES, M } from './planner/config'
import type { Tool, UiTool, Cat, Mode, WKind, Shape, ObjCat, Tgt } from './planner/config'
import { withHoles, freshPlan, applyCells, applyEdges, wallEdges } from './planner/actions'
import { ItemList } from './planner/ItemList'
import type { Opt } from './planner/ItemList'
import { drawPlan } from './planner/drawPlan'

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
    if (cv.current) drawPlan(cv.current, { plan, pv, cam, size, hov, anchor, tool, mode, wk, level, wp, wallFlow, imgs, grass, terrain, redraw: () => setTick(t => t + 1) })
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
