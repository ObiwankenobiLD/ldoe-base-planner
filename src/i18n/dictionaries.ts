import type { Locale } from './config'
import type { Dict } from './types'
import fr from './fr'
import en from './en'

export type { Dict }

const dictionaries: Record<Locale, Dict> = { fr, en }
export const getDictionary = (l: Locale): Dict => dictionaries[l]
export const fmt = (s: string, v: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k) => String(v[k]))
