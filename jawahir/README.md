# Jawahir al-Maâni — lecteur mobile (iOS + Android)

Application Expo / React Native (TypeScript) pour lire *Perles des significations et exaucement des souhaits*, Tomes I et II
(Sidi Ali Harazem Berrada, traduction du Pr Ahmed Skiredj). Le texte est intégré : tout fonctionne hors connexion.

## Fonctions
- **Par chapitre** (avec filtre Tout / Tome I / Tome II) : 27 sections de lecture (avant-propos, chapitres I à VI avec leurs parties, conclusion), durée estimée, progression.
- **Par thème** : 17 thèmes (dhikr, Salat al-Fatih, maître/disciple, gnose, Coran, hadiths, jurisprudence, au-delà…), chaque thème
  listant les passages concernés (ordre du livre ou pertinence).
- Tome I : pages 3–297 ; Tome II : pages 298–549 (même PDF).
- **Lecteur** : reprise automatique, plan de la section, saut à un numéro de page (1–549), signets, notes de bas de page,
  versets/hadiths en gras comme dans le livre, taille de police, police serif/sans, thèmes clair / sépia / sombre / auto.
- **Notes de bas de page** : regroupées dans une section « Notes » à la fin de chaque partie, avec appels cliquables dans le texte
  (aller) et « ↩ Retour au texte » depuis chaque note (retour). Accessible aussi depuis le menu « Aller à… ».
- **Recherche** plein texte dans tout le livre (insensible aux accents), avec surlignage dans le lecteur.

## Lancer l'app pour la tester
```bash
npm install
npx expo start
```
Scannez le QR code avec **Expo Go** (iOS ou Android). Pour le navigateur : `npx expo start --web`.

## Obtenir de vraies applications installables (EAS)
```bash
npx eas-cli@latest login
npx eas-cli@latest build -p android --profile preview      # fichier .apk à installer directement
npx eas-cli@latest build -p android --profile production   # .aab pour Google Play (compte développeur 25 $, une fois)
npx eas-cli@latest build -p ios --profile production       # nécessite un compte Apple Developer (99 $/an), puis TestFlight / App Store
```
Identifiants à adapter si besoin dans `app.json` : `com.jawahir.maani` (iOS `bundleIdentifier` et Android `package`).

## Organisation
- `src/app/` : écrans (expo-router) — `(tabs)/` Chapitres, Thèmes, Recherche, Signets, Réglages ; `lire/[unit].tsx` lecteur ; `theme/[id].tsx`.
- `src/content/` : contenu généré à partir du PDF (`units/*.json`, `themes_*.json`, `toc.json`).
- `src/lib/` : accès au contenu, stockage local (progression, signets, réglages), thèmes visuels, recherche.
- `tools/` : scripts Python qui ont extrait le PDF (pdfplumber) et généré `src/content/` (`build_blocks.py` → `make_blocks.py` → `build_units.py`).

## À savoir
- L'index par thèmes est établi automatiquement (mots-clés) : un passage peut être approximatif. Les thèmes se règlent dans `tools/build_units.py` (liste `THEMES`).
- Les numéros de page affichés sont ceux du PDF fourni (557 pages ; le corps du texte va de 3 à 556).

## Déployer gratuitement la version web
```bash
npm run build:web        # génère dist/ (site + manifeste d'installation + règle de redirection)
```
Déposez le contenu de `dist/` sur Netlify (glisser-déposer sur app.netlify.com/drop), Cloudflare Pages ou Vercel.
`public/_redirects` gère les liens directs (Netlify / Cloudflare Pages). Sur Vercel, ajoutez un `vercel.json` avec
`{ "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }`.
Sur téléphone : ouvrir le lien puis « Ajouter à l'écran d'accueil ».

### Mode hors connexion (web)
`npm run build:web` génère aussi `dist/sw.js` (service worker) : à la première visite, tout le livre est mis en cache
dans le navigateur ; les ouvertures suivantes n'ont plus besoin de connexion. À chaque nouveau déploiement, la version
du cache change et le navigateur se met à jour au prochain chargement.

## Générer l'APK Android (gratuit)

**Option A – GitHub (sans compte Expo)** : créez un dépôt GitHub, envoyez-y le projet (`git push`), puis onglet **Actions → « Construire l'APK Android » → Run workflow**. Au bout de 10–15 min, téléchargez l'artefact `jawahir-apk` (zip contenant `app-release.apk`), copiez l'APK sur le téléphone et ouvrez-le (autoriser « sources inconnues »).

**Option B – EAS** : `npm i -g eas-cli && eas login && eas build -p android --profile preview` renvoie un lien de téléchargement de l'APK.
