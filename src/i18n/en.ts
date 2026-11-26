import type { Dict } from './types'

const en: Dict = {
  title: 'Base planner',
  description: 'Plan your base before you build it.',
  language: 'Language',
  tools: { floor: 'Floor', wall: 'Wall', object: 'Object', eraser: 'Eraser', hand: 'Hand' },
  modes: { single: 'Cell', brush: 'Brush', line: 'Line', rect: 'Rectangle', fill: 'Fill' },
  wallKinds: { wall: 'Wall', door: 'Door', window: 'Window', clear: 'Erase wall' },
  items: { workbench: 'Workbench', chest: 'Chest', bed: 'Bed', campfire: 'Campfire', generator: 'Generator', shelf: 'Shelf', crop: 'Crop' },
  ui: {
    tool: 'Tool', mode: 'Mode', materialLevel: 'Material level', wallType: 'Wall type', object: 'Object',
    rotation: 'Rotation: {deg}°',
    rotate: 'Rotate (R)',
    hintFloor: 'An object can only be placed on a floor.',
    hintFloorMax: 'An object can only be placed on a floor, maximum {max}.',
    undo: 'Undo', redo: 'Redo', clearAll: 'Clear all', resetCamera: 'Reset camera',
    view45: '45° view',
    noObjects: 'No objects placed.',
    removeDebris: 'Remove debris?', yes: 'Yes', no: 'No',
  },
}
export default en
