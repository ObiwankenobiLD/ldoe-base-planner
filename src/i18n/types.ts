import type { ItemId, Rule } from '@/lib/plan'

export type Dict = {
  title: string
  description: string
  language: string
  tools: Record<'building' | 'object' | 'eraser' | 'hand', string>
  categories: Record<'foundation' | 'wall' | 'door' | 'window', string>
  floorNames: string[] // 5 niveaux de sol
  wallNames: string[] // 5 niveaux de mur
  modes: Record<'single' | 'brush' | 'line' | 'rect' | 'fill', string>
  wallKinds: Record<'wall' | 'door' | 'window' | 'clear', string>
  items: Record<ItemId, string>
  ui: {
    tool: string; category: string; levelN: string /* {n} */; onFloor: string; mode: string; materialLevel: string; wallType: string; object: string
    rotation: string // {deg}
    rotate: string
    hintFloor: string; hintFloorMax: string // {max}
    undo: string; redo: string; clearAll: string; resetCamera: string
    view45: string
    noObjects: string
    removeDebris: string; yes: string; no: string
    warnings: Record<Rule, string> // {wall} / {floor} = niveaux de matériau
    dontShowAgain: string; ok: string
  }
}
