# Planificateur de base

Planificateur de base interactif (Next.js + TypeScript, export statique), pensé pour GitHub Pages.

## Lancer en local
```
npm install
npm run dev
```

## Publier sur GitHub Pages
1. Envoie ce projet sur un dépôt GitHub (branche `main`).
2. **Settings → Pages → Build and deployment → Source : GitHub Actions**.
3. Chaque push sur `main` reconstruit et publie le site (`.github/workflows/main.yml`).

## Ajouter tes images
Mets-les dans `public/assets/`, puis renseigne `image: '/assets/mon-objet.png'` dans `CATALOG` (`src/lib/plan.ts`). Sans image, l'objet est dessiné en aplat de couleur avec une icône.

## Langues (i18n)
Le site est publié en `/fr/` et `/en/` (la racine `/` redirige vers la langue mémorisée, sinon celle du navigateur).
- `src/i18n/config.ts` : liste des langues et langue par défaut.
- `src/i18n/types.ts` : forme du dictionnaire (TypeScript refuse le build si une langue oublie une clé).
- `src/i18n/fr.ts`, `src/i18n/en.ts` : un fichier par langue.
- Nouvelle langue : copier `en.ts`, traduire, puis l'ajouter dans `config.ts` (`locales`, `LOCALE_LABEL`) et dans `dictionaries.ts`.
- Nouvel objet : l'ajouter dans `ItemId` (`src/lib/plan.ts`) puis dans `items` de chaque langue.

## Structure
- `src/lib/plan.ts` : modèle de données, catalogue, géométrie (lignes, rectangles, remplissage, murs).
- `src/components/Planner.tsx` : interface et dessin sur canvas.
