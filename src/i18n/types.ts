import type { ItemId } from '@/lib/plan'

export type Dict = {
  title: string
  description: string
  language: string
  tools: Record<'floor' | 'wall' | 'object' | 'eraser' | 'hand', string>
  modes: Record<'single' | 'brush' | 'line' | 'rect' | 'fill', string>
  wallKinds: Record<'wall' | 'door' | 'window' | 'clear', string>
  items: Record<ItemId, string>
  ui: {
    tool: string; mode: string; materialLevel: string; wallType: string; object: string
    rotation: string // {deg}
    rotate: string
    hintFloor: string; hintFloorMax: string // {max}
    undo: string; redo: string; clearAll: string; resetCamera: string
    view45: string
    noObjects: string
    removeDebris: string; yes: string; no: string
  }
}
