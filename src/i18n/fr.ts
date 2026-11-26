import type { Dict } from './types'

const fr: Dict = {
  title: 'Planificateur de base',
  description: 'Planifie ta base avant de la construire.',
  language: 'Langue',
  tools: { floor: 'Sol', wall: 'Mur', object: 'Objet', eraser: 'Gomme', hand: 'Main' },
  modes: { single: 'Case', brush: 'Pinceau', line: 'Ligne', rect: 'Rectangle', fill: 'Remplir' },
  wallKinds: { wall: 'Mur', door: 'Porte', window: 'Fenêtre', clear: 'Effacer mur' },
  items: { workbench: 'Établi', chest: 'Coffre', bed: 'Lit', campfire: 'Feu de camp', generator: 'Générateur', shelf: 'Étagère', crop: 'Culture' },
  ui: {
    tool: 'Outil', mode: 'Mode', materialLevel: 'Niveau de matériau', wallType: 'Type de mur', object: 'Objet',
    rotation: 'Rotation : {deg}°',
    rotate: 'Pivoter (R)',
    hintFloor: 'Un objet se pose uniquement sur un sol.',
    hintFloorMax: 'Un objet se pose uniquement sur un sol, maximum {max}.',
    undo: 'Annuler', redo: 'Rétablir', clearAll: 'Tout effacer', resetCamera: 'Réinitialiser la caméra',
    noObjects: 'Aucun objet posé.',
    removeDebris: 'Supprimer les débris ?', yes: 'Oui', no: 'Non',
  },
}
export default fr
