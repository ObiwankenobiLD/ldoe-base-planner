import { LANG_KEY, defaultLocale, locales } from '@/i18n/config'

export const metadata = { title: 'Base planner' }

const base = process.env.NEXT_PUBLIC_BASE_PATH || ''
// Langue mémorisée si valide, sinon langue du navigateur si elle est gérée, sinon langue par défaut.
const script = `(function(){var b=${JSON.stringify(base)},L=${JSON.stringify(locales)},l=${JSON.stringify(defaultLocale)};try{var s=localStorage.getItem(${JSON.stringify(LANG_KEY)});var n=((navigator.language||'').slice(0,2)).toLowerCase();if(L.indexOf(s)>-1)l=s;else if(L.indexOf(n)>-1)l=n}catch(e){}location.replace(b+'/'+l+'/')})()`

export default function Page() {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: script }} />
      <noscript>
        <meta httpEquiv="refresh" content={`0;url=${base}/${defaultLocale}/`} />
        <p style={{ padding: 16 }}>{locales.map((l, i) => <span key={l}>{i > 0 && ' · '}<a href={`${base}/${l}/`}>{l}</a></span>)}</p>
      </noscript>
    </>
  )
}
