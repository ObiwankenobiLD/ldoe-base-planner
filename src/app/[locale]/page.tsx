import { notFound } from 'next/navigation'
import Planner from '@/components/Planner'
import { isLocale } from '@/i18n/config'
import { getDictionary } from '@/i18n/dictionaries'

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  return <Planner locale={locale} dict={getDictionary(locale)} />
}
