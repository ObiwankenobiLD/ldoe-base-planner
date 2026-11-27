import type { Dict } from './types'

const en: Dict = {
  title: 'Base planner',
  description: 'Plan your base before you build it.',
  language: 'Language',
  tools: { building: 'Building', object: 'Workbenches', eraser: 'Eraser', hand: 'Hand' },
  categories: { foundation: 'Foundations', wall: 'Walls', door: 'Doors', window: 'Windows' },
  floorNames: ['Wood floor', 'Plank floor', 'Stone floor', 'Iron floor', 'Reinforced floor'],
  wallNames: ['Wood wall', 'Plank wall', 'Stone wall', 'Iron wall', 'Reinforced wall'],
  modes: { single: 'Cell', brush: 'Brush', line: 'Line', rect: 'Rectangle', fill: 'Fill' },
  wallKinds: { wall: 'Wall', door: 'Door', window: 'Window', clear: 'Erase wall' },
  items: { workbench: 'Workbench', chest: 'Chest', bed: 'Bed', campfire: 'Campfire', generator: 'Generator', shelf: 'Shelf', crop: 'Crop' },
  ui: {
    tool: 'Tool', category: 'Building', levelN: 'Level {n}', onFloor: 'Floor', mode: 'Mode', materialLevel: 'Material level', wallType: 'Wall type', object: 'Object',
    rotation: 'Rotation: {deg}°',
    rotate: 'Rotate (R)',
    hintFloor: 'An object can only be placed on a floor.',
    hintFloorMax: 'An object can only be placed on a floor, maximum {max}.',
    undo: 'Undo', redo: 'Redo', clearAll: 'Clear all', resetCamera: 'Reset camera',
    view45: '45° view',
    noObjects: 'No objects placed.',
    removeDebris: 'Remove debris?', yes: 'Yes', no: 'No',
    warnings: {
      wallNoFloor: 'You can\'t build here: place a floor first before adding a wall, door or window.',
      wallTier: 'Not allowed: tier T{wall} is higher than the floor (T{floor}). A wall, door or window can\'t exceed the floor\'s tier.',
      objNoFloor: 'You can\'t place this object here: objects can only be placed on a floor.',
    },
    dontShowAgain: 'Got it, don\'t show this message again', ok: 'OK',
  },
}
export default en
