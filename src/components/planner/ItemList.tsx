'use client'
import { useState } from 'react'
import { asset } from './config'

export type Opt = { key: string; label: string; sub?: string; img?: string; bg?: string; emoji?: string }
/** Miniature : l'image si elle existe, sinon un carré de couleur (avec emoji éventuel). */
export function Thumb({ o }: { o: Opt }) {
  const [bad, setBad] = useState<string | null>(null) // chemin de l'image qui a échoué (et non un simple booléen) : le repli couleur ne vaut que pour CETTE image
  if (o.img && bad !== o.img) return <img className="il-th" src={asset(o.img)} alt="" draggable={false} onError={() => setBad(o.img!)} />
  return <span className="il-th" style={{ background: o.bg }}>{o.emoji}</span>
}
/** Liste verticale : miniature à gauche, nom en gras, petite ligne grise dessous. La ligne choisie est surlignée. */
export function ItemList({ options, value, onPick }: { options: Opt[]; value: string | null; onPick: (k: string) => void }) {
  return (
    <div className="il">{options.map(o => (
      <button key={o.key} className="il-row" aria-pressed={o.key === value} onClick={() => onPick(o.key)}>
        <Thumb o={o} />
        <span className="il-tx"><b>{o.label}</b>{o.sub && <small>{o.sub}</small>}</span>
      </button>
    ))}</div>
  )
}
