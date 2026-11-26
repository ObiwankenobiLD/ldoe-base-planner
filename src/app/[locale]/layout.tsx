import '../globals.css'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { isLocale, locales } from '@/i18n/config'
import { getDictionary } from '@/i18n/dictionaries'

export const dynamicParams = false
export const generateStaticParams = () => locales.map(locale => ({ locale }))

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  if (!isLocale(locale)) return {}
  const d = getDictionary(locale)
  return { title: d.title, description: d.description }
}

export default async function LocaleLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  return <html lang={locale}><body>{children}</body></html>
}
