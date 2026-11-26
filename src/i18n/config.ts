export const locales = ['fr', 'en'] as const
export type Locale = (typeof locales)[number]
export const defaultLocale: Locale = 'en'
export const LANG_KEY = 'base-planner-lang'
export const isLocale = (s: string): s is Locale => (locales as readonly string[]).includes(s)
export const LOCALE_LABEL: Record<Locale, string> = { fr: 'Français', en: 'English' }
