import type { Dict } from './types'

const fr: Dict = {
  title: 'Planificateur de base',
  description: 'Planifie ta base avant de la construire.',
  language: 'Langue',
  tools: { building: 'Structure', object: 'Établis', eraser: 'Gomme', hand: 'Main' },
  categories: { foundation: 'Fondations', wall: 'Murs', door: 'Portes', window: 'Fenêtres' },
  floorNames: ['Sol en bois', 'Sol en planche', 'Sol en pierre', 'Sol en fer', 'Sol renforcé'],
  wallNames: ['Mur en bois', 'Mur en planche', 'Mur en pierre', 'Mur en fer', 'Mur renforcé'],
  modes: { single: 'Case', brush: 'Pinceau', line: 'Ligne', rect: 'Rectangle', fill: 'Remplir' },
  wallKinds: { wall: 'Mur', door: 'Porte', window: 'Fenêtre', clear: 'Effacer mur' },
  items: { workbench: 'Établi', chest: 'Coffre', bed: 'Lit', campfire: 'Feu de camp', generator: 'Générateur', shelf: 'Étagère', crop: 'Culture' },
  ui: {
    tool: 'Outil', category: 'Structure', levelN: 'Niveau {n}', onFloor: 'Sol', mode: 'Mode', materialLevel: 'Niveau de matériau', wallType: 'Type de mur', object: 'Objet',
    rotation: 'Rotation : {deg}°',
    rotate: 'Pivoter (R)',
    hintFloor: 'Un objet se pose uniquement sur un sol.',
    hintFloorMax: 'Un objet se pose uniquement sur un sol, maximum {max}.',
    undo: 'Annuler', redo: 'Rétablir', clearAll: 'Tout effacer', resetCamera: 'Réinitialiser la caméra',
    view45: 'Vue 45°',
    noObjects: 'Aucun objet posé.',
    removeDebris: 'Supprimer les débris ?', yes: 'Oui', no: 'Non',
    warnings: {
      wallNoFloor: 'Impossible de construire ici : il faut d\'abord poser un sol avant de placer un mur, une porte ou une fenêtre.',
      wallTier: 'Impossible : le niveau T{wall} est supérieur à celui du sol (T{floor}). Un mur, une porte ou une fenêtre ne peut pas dépasser le niveau du sol.',
      objNoFloor: 'Impossible de poser cet objet ici : un objet se pose uniquement sur un sol.',
    },
    dontShowAgain: 'Compris, ne plus m\'afficher ce message', ok: 'OK',
  },
}
export default fr
