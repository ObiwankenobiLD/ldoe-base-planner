import type { EdgeRef, Kind, Pt } from '@/lib/plan'

export type Tool = 'floor' | 'wall' | 'object' | 'eraser' | 'hand'
export type UiTool = 'building' | 'object' | 'eraser' | 'hand' // « Building / Structure » regroupe les outils internes floor (fondations) et wall (murs, portes, fenêtres)
export type Cat = 'foundation' | 'wall' | 'door' | 'window'
export type Mode = 'single' | 'brush' | 'line' | 'rect' | 'fill'
export type WKind = Kind | 'clear'
export type Shape = { cells?: Pt[]; edges?: EdgeRef[] }
export const WALL_W = 5 // épaisseur des murs sur le plan (en px, 8 = ancienne valeur)
export const OPEN_PAD = 11, OPEN_T = 3.5 // porte et fenêtre : marge de chaque côté (plus grand = plus court) et épaisseur du rectangle
export const OPEN_FILL = { door: '#4fbf5f', window: '#8fd3ee' } // intérieur : vert pour la porte, bleu pour la fenêtre
export const CS = 40, KEY = 'base-planner-v3', HIDE_KEY = 'base-planner-hidden-warnings', GW = 21, GH = 18 // taille de grille fixe (largeur x hauteur)
export const MODES: Record<Tool, Mode[]> = { floor: ['single', 'brush', 'line', 'rect', 'fill'], wall: ['single', 'line', 'rect'], object: ['single', 'brush', 'line', 'rect'], eraser: ['single', 'brush', 'rect'], hand: [] }
export const UI_TOOLS: UiTool[] = ['building', 'object'] // Gomme et Main sont dans la barre du haut
/** Image (ou emoji) affichée devant chaque outil du cadre « Outil ». Pour changer : déposer l'image dans public/assets/ et mettre son chemin ici. */
export const TOOL_VISUAL: Record<'building' | 'object', { img?: string; emoji?: string }> = { building: { img: '/assets/building-foundation.png' }, object: { emoji: '📦' } }
export const CATS: Cat[] = ['foundation', 'wall', 'door', 'window']
/** Catégories de l'outil « Établis » (même principe que Fondations / Murs / Portes / Fenêtres pour Structure).
 *  Pour ajouter une catégorie : l'ajouter ici, puis ranger les objets dedans avec ITEM_CAT. */
export type ObjCat = 'storage'
export const OBJ_CATS: { key: ObjCat; fr: string; emoji: string }[] = [{ key: 'storage', fr: 'Entrepôt', emoji: '📦' }]
export const ITEM_CAT: Partial<Record<string, ObjCat>> = {} // catégorie de chaque objet (id → catégorie) ; un objet absent d'ici va dans « Entrepôt »
export const CAT_IMG: Record<Cat, string> = { foundation: '/assets/building-foundation.png', wall: '/assets/building-wall.png', door: '/assets/building-door.png', window: '/assets/building-window.png' }
/** Icônes des sols dans la LISTE du menu (index = niveau 1 à 5). Les textures de la CARTE restent FLOOR_IMAGES (plan.ts). */
export const FLOOR_ICONS = ['', '/assets/building-floor1.png', '/assets/building-floor2.png', '/assets/building-floor3.png', '/assets/building-floor4.png', '/assets/building-floor5.png']
/** Icônes des murs, portes et fenêtres dans la LISTE du menu (index = niveau 1 à 5).
 *  Chemin dans public/assets/. Si le fichier n'existe pas, la liste retombe sur la couleur du mur. */
export const WALL_IMAGES: Record<'wall' | 'door' | 'window', string[]> = {
  wall:   ['', '/assets/building-wall1.png',   '/assets/building-wall2.png',   '/assets/building-wall3.png',   '/assets/building-wall4.png',   '/assets/building-wall5.png'],
  door:   ['', '/assets/building-door1.png',   '/assets/building-door2.png',   '/assets/building-door3.png',   '/assets/building-door4.png',   '/assets/building-door5.png'],
  window: ['', '/assets/building-window1.png', '/assets/building-window2.png', '/assets/building-window3.png', '/assets/building-window4.png', '/assets/building-window5.png'],
}
export const BAND = 2 // largeur (en cases) de la zone neutre entre la zone constructible et le vert
export const BAND_TINT = 'rgba(0,0,0,0)' // teinte de cette zone : transparent = herbe naturelle (ex. 'rgba(255,255,255,.08)' pour l'éclaircir)
export const M = BAND + 3 // marge totale autour de la zone constructible : zone neutre + vert « hors carte »
export const asset = (p: string) => (process.env.NEXT_PUBLIC_BASE_PATH || '') + p

// Carrés rouges (cases interdites) présents au lancement. x et y partent du coin haut-gauche (0).
// w et h sont facultatifs (1 par défaut) : { x: 3, y: 5 } = un seul carré ; { x: 0, y: 12, w: 5, h: 4 } = un bloc de carrés.
// Dans l'appli, un clic sur une zone rouge propose de la supprimer (popup Oui / Non). Il n'y a plus d'outil pour en ajouter.
export const DEFAULT_NOBUILD: { x: number; y: number; w?: number; h?: number }[] = [
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
export const DEFAULT_REMOVED: { x: number; y: number; w?: number; h?: number }[] = [
  { x: 0, y: 12, w: 5, h: 4 },
  // { x: 8, y: 0, w: 3 },
]
export const PV_OK = 'rgba(255,255,255,.92)', PV_BAD = 'rgba(235,70,70,.95)', PV_YEL = '#f7c81b' // aperçu valide / refusé par les règles, couleur des repères jaunes
export type Tgt = { cell: Pt; vert: Pt; edge: EdgeRef; vd: number } // vd = distance (en cases) au sommet le plus proche
