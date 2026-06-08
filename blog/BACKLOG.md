# 📝 Blog backlog — milestones & idées d'articles

> Backlog d'articles techniques minés automatiquement depuis l'historique du projet
> (git log + diffs + dossier `docs/`). Voir [`README.md`](./README.md) pour le
> fonctionnement de la loop qui maintient ce fichier.

**Dernier scan :** 2026-06-08
**Commit de référence (HEAD scanné) :** `81d5178`
**Périmètre :** 233 commits · 45 PRs · ~70 notes dans `docs/`

Légende statut : 🟡 idée · 🔵 prêt à rédiger (matière abondante) · ✍️ en cours · ✅ publié

---

## 🎬 Série phare — L'évolution du pipeline d'enregistrement

C'est le récit le plus fort du projet : 4 architectures successives pour capturer
un sketch p5 en vidéo, chacune résolvant les limites de la précédente. Idéal en
série « build in public ».

### A1 — « Comment j'ai filmé du p5.js : 4 architectures, 3 ans de leçons » 🔵
- **Angle :** rétrospective de l'évolution complète, du naïf au streaming.
  1. **CCapture.js + tar dans le navigateur** → frames PNG en mémoire, archive `.tar`,
     download, désarchivage Node, encodage FFmpeg.
  2. **Capture server-side Playwright** → `noLoop()` + `redraw()` + `canvas.toDataURL()`,
     une frame à la fois sur disque, puis FFmpeg.
  3. **Streaming FFmpeg** → les frames ne touchent jamais le disque, pipées dans `stdin`.
  4. **Encodeur in-browser (Mediabunny / MediaRecorder)** → encodage WebM/MP4 côté client.
- **Chiffres clés (déjà mesurés) :** mémoire 500 MB → 50 MB (−90 %), temps 45 s → 30 s
  (−33 %), stabilité « crash > 1000 frames » → « testé jusqu'à 10 000 frames ».
- **Sources :** `docs/FRAME_CAPTURE_MIGRATION.md`, `docs/GLOBAL_RECORDING_API.md`,
  `docs/QUICK_START_SERVER_SIDE_CAPTURE.md`, `docs/STREAMING_MODE_TESTING.md`,
  commits `e94d12c` (suppression du disk-based), `f25b5b5` (UI streaming), PR #36/#38.

### A2 — « Pourquoi le temps de p5.js ment quand on enregistre frame par frame » 🔵
- **Angle :** problème subtil mais central — `millis()` ne marche plus sous `noLoop()`.
  Solution : un *recording mode* global qui calcule le temps depuis l'index de frame
  (`window.enableRecordingMode()` / `disableRecordingMode()`), garantissant un loop
  parfaitement bouclé.
- **Sources :** `docs/GLOBAL_RECORDING_API.md`, `src/templates/p5/utils/time.js`,
  commits `4ea4577`, `2373d98` (capturer le bon nombre de frames pour un loop complet).

### A3 — « Strategy pattern pour l'enregistrement : Realtime vs AsyncLoop » 🟡
- **Angle :** comment une abstraction `BaseRecorder` + stratégies interchangeables
  (`RealtimeRecorder`, `AsyncLoopRecorder`) + encodeurs pluggables (`MediabunnyEncoder`,
  `GifEncoder`) ont remplacé un script monolithique. Négociation de codec
  (vp9→vp8→webm, avc1→mp4) avec fallback `isTypeSupported`.
- **Sources :** `src/engines/recording/` (BaseRecorder, strategies/, encoders/, types.ts),
  commit `b387bda` (refactor recording: lifecycle hardening), PR #50.

---

## 🧩 Architecture & refactoring

### B1 — « Un système d'assets extensible par "kind" » 🔵
- **Angle :** passage d'un handling d'images en dur à un *registry* extensible
  (`registry.ts` + `kinds/images`, `kinds/videos`) ; extraction vers une lib
  engine-agnostic `@/lib/assets` réutilisable par p5 **et** gsap.
- **Sources :** `src/lib/assets/`, commits `188466b`/`954162e` (extraction lib),
  `78566c2`/`dfd5e31` (kind registry), `146925a` (video assets), PR #53/#58/#59.

### B2 — « Unifier les utilitaires p5 : anatomie d'un dossier utils/ qui ne fait pas peur » 🟡
- **Angle :** tour d'horizon de `src/templates/p5/utils/` (animation, easing, grid,
  mappers, iterators, colors, converters, shapes, time…) et du système `slides/`
  (layouts composables : free, grid, polaroid, split, strip + `drawSlide*`).
  Comment factoriser sans sur-abstraire.
- **Sources :** `src/templates/p5/utils/`, `src/templates/p5/shared/`,
  `docs/REFACTORING_SUMMARY.md`, `docs/DEVELOPER_GUIDE.md`.

### B3 — « Options réutilisables : DRY sur les champs de formulaire d'un générateur » 🔵
- **Angle :** refactor des options de sketch — fonts & blend modes partagés au lieu
  d'être redéclarés dans chaque sketch (−179 lignes sur un seul commit). Import/export
  des options, config de champs centralisée.
- **Sources :** commit `abedc8c`/`abd206e` (PR #67), `docs/OPTIONS_IMPORT_EXPORT.md`,
  `src/components/.../ContentItems/constants/field-config.ts`.

### B5 — « Un spatial hash pour un alpha-mask de grille : −510 lignes, prouvé pixel-identique » 🔵
- **Angle :** étude de cas perf **+** refacto, idéale pour un article technique pointu.
  - **Problème :** 8 sketches (`36days-of-type-2023`, `animated-text-points`) reconstruisaient
    un champ alpha par cellule en réduisant sur **tous** les points du contour de texte pour
    **chaque** cellule → O(cells × points), ~**1M appels `dist()`/frame**. Helper copié-collé
    en 2 variantes divergentes.
  - **Solution :** un seul `gridMask.field()` qui calcule le champ une fois par
    (grid, points, distance, mode), le **cache**, et accélère via un **uniform spatial hash**
    (bucket = distance, voisinage 3×3 par cellule).
  - **Le point fort de l'article :** la correction est **prouvée pixel-identique** à la
    réduction naïve — au-delà de `distance` un point contribue toujours le plancher d'alpha (0)
    au `max`, donc l'ignorer ne change jamais le résultat. Un test unitaire vérifie l'identité
    (pixel/falloff, normalized/falloff, normalized/boolean anisotrope).
  - **Bonus :** `string.textPointsSignature()` pour keyer les caches sur la même signature
    géométrique que `getTextPoints`, helper de morph `lerpField`, rayon de gridMask configurable,
    pilotage du switch de lettre par la progression du loop.
- **Sources :** `src/templates/p5/utils/gridMask.js` (+ son test), commits `7931e41` (fondateur),
  `15517a9`/`dd745c9` (extension per-letter), `fc64f4b` (rayon configurable),
  `8b70f7f` (loop-driven), PR #69. Répond directement au sujet « gridmasques ».

### B6 — « Une catégorie "background" : factoriser les techniques de fond réutilisables » 🟡
- **Angle :** util de background-pattern partagé (lignes fractionnaires, fix full-height)
  + une nouvelle catégorie `background` qui rassemble les techniques de fond réutilisables.
- **Sources :** commits `1661edd` (PR #78), `fc0a806`/`3527088` (PR #80).

### B4 — « Le système de titre & de "specs overlay" » 🟡
- **Angle :** rendu de titres riches paramétrables (`utils/title/`) et overlay
  technique animé affichant les réglages du sketch (`drawSlideSpecs`, `specsData`).
- **Sources :** `src/templates/p5/utils/title/`, commits `6ee0393`, `bdce4ff` (PR #56).

---

## ⚡ Performance & optimisation

### C1 — « Optimiser le LCP d'une galerie : WebP partout » 🔵
- **Angle :** pipeline de thumbnails qui émet directement du WebP (extraction de la
  première frame de la vidéo), variantes responsive (thumbnail / thumbnail-2x /
  preview-md 540×675), caching, fallback. Gains LCP mesurés + a11y.
- **Sources :** `docs/THUMBNAIL_CACHING.md`, `docs/THUMBNAIL_CAPTURE_FIX.md`,
  `docs/THUMBNAIL_FALLBACK.md`, commits `bbf5981`/`fd04e80` (PR #30), `51dfd7b`, `954d92c`.

### C2 — « Garantir le FPS cible dans une draw-loop p5 » 🔵
- **Angle :** bug de FPS divisé par 2 dû à des *animation chains* dupliquées au
  pause/resume ; désync de l'horloge au retour d'onglet ; RAF mis en idle quand caché.
  Bons exemples de debugging de boucle de rendu.
- **Sources :** commits `596edc6`/`088ad35` (PR #63), `2b3fa4b`/`6bc2a4e` (PR #62),
  `docs/TIMING_FIX.md`, `docs/TIMING_FIX_V2.md`.

### C3 — « Carousel performant : éviter le jank au resize et les ombres clippées » 🟡
- **Angle :** série de fixes UI sur la galerie (carousel horizontal par catégorie,
  previews lazy, toggle conditionnel, fade de fin de scroll, expand fluide).
- **Sources :** commits `f68a330`/`b06f4d8` (PR #56/#57), `6f8ef98`, `4170258`, `c460483`.

---

## 🖥️ GPU / WebGL (nouvel axe — scan 2026-06-08)

### G1 — « Porter une grille de bruit de Perlin sur le GPU : instanced rendering + GLSL » 🔵
- **Angle :** la story perf majeure de cette vague. Toute la famille `noise-grid`
  (CPU, une `dist()`/cellule) est portée sur un **moteur de champ de bruit partagé en GLSL**
  avec **rendu instancié** (un seul draw call pour des milliers de cellules). Migration
  faithful v1, v2, v5, v6, v7, v8, v10, v11, v12 — en gardant le rendu identique.
- **Pièges concrets à raconter :** pin de la précision `int` pour que le programme linke
  (`b154624`), renommer une variable GLSL qui tombait sur le mot réservé `packed` (`188d021`),
  clamp du poids easé pour rester borné (`09d6236`).
- **Sources :** commits `f21ed8e` (extraction du moteur GPU partagé), `1605cc2` (renderer
  instancié + v8), `f45c503`/`e32406b`/`56ae560` (ports v5/v6/v7/v8/v10/v12), `a3ffca9`/`87d30f1`
  (v11 GPU, PR #71), `81d5178` (fix easing GPU v2/v6/v8/v12, PR #81).

### G2 — « Charger N sketches sans tout bundler : un registre de literal-imports généré » 🔵
- **Angle :** perf de chargement — au lieu d'imports dynamiques opaques, **générer** un
  registre d'imports littéraux que le bundler peut analyser et code-splitter proprement.
- **Sources :** commits `50e758e`/`7aa7947` (PR #82), à croiser avec `scripts/` de génération.

## 🎨 Templates créatifs (angle « making-of »)

### D1 — « La famille noise-grid : 13 variations d'un même champ de bruit » 🟡
- **Angle :** étude de cas créative — pulse, easing, holes, stick, rotation, field
  distortion… comment une primitive (grille + Perlin noise) génère une famille entière.
- **Sources :** `src/templates/p5/sketches/noise-grid/`, commits `e31be6e` (PR #66),
  `df19572`, `9b0b125`.

### D2 — « Templates vidéo : echo, halftone, kaléidoscope, texte » 🟡
- **Angle :** traiter un asset vidéo comme texture p5 (graphics buffer, blend modes,
  object-fit anti-distorsion, drag-to-position). Runtime vidéo résilient.
- **Sources :** `src/templates/p5/sketches/video/`, `src/lib/assets/kinds/videos/`,
  commits `b458caf`, `3ef6ba6` (PR #65), `5a1f606` (buffered graphics), `146925a` (PR #59).

---

### D3 — « Splines lissées : corner-cutting de Chaikin sur des points » 🟡
- **Angle :** algo créatif simple et visuel — courbes arrondies par découpe de coins
  itérative (Chaikin) ; nouvelle catégorie `splines`, scale de taille générale.
- **Sources :** commits `17f52d7`/`e8e828e` (PR #72), `9d706b5`, `src/templates/p5/sketches/splines/`.

### D4 — « Splines pilotées par la caméra : face capture en groupes ordonnés » 🟡
- **Angle :** interaction temps réel — vision/MediaPipe qui capture les points du visage
  en **groupes ordonnés** pour alimenter des splines vivantes ; activation runtime de la vision.
- **Sources :** commits `aff6151`/`e7fcba3` (camera-driven splines), `d6b39f3`/`03c2bd1`
  (face capture ordered groups), `src/templates/p5/utils/mediapipe/`.

### D5 — « Templates photo GSAP : Grid Cascade, Coverflow 3D, Stack Shuffle » 🟡
- **Angle :** côté moteur GSAP (pas p5) — 3 templates animés sur une base de paramètres
  riche partagée ; astuce capture : **embarquer les images en data-URL** lors de la
  rastérisation pour l'enregistrement (`e68818e`).
- **Sources :** commits `53dcd7c`/`36089d3` (PR #73), `src/templates/gsap/sketches/`.

## 🛠️ Plateforme & outillage

### E1 — « PWA + push notifications pour un générateur créatif » 🟡
- **Sources :** `docs/PWA_IMPLEMENTATION_SUMMARY.md`, `docs/PUSH_NOTIFICATIONS.md`,
  `docs/NOTIFICATION_SETUP.md`, `scripts/generate-vapid-keys.mjs`, commit `87e9263` (PR #52).

### E2 — « Un système de progression qui reflète un pipeline de streaming » 🟡
- **Angle :** barre de progression par étapes (steps system) recalibrée pour le pipeline
  streaming (15/75/10), composant réutilisable, SSE de progression.
- **Sources :** `docs/PROGRESSION_STEPS_SYSTEM.md`, `docs/PROGRESS_BAR_COMPONENT.md`,
  `src/lib/progression/`, commit `f25b5b5`, `7dc17ff`.

### E3 — « Tester un générateur visuel : metadata regression + property-based » 🟡
- **Angle :** suite Jest qui vérifie la cohérence des métadonnées de sketch et du
  filesystem ; property tests avec `fast-check` ; CI sans ts-node via `jest.config.js`.
- **Sources :** `src/templates/__tests__/`, `src/utils/__tests__/`, commits `5a3d1cc` (PR #55),
  `a247bb8`, `d291370`, `docs/TESTING_GUIDE.md`.

### E4 — « Capture server-side comme job : BullMQ + Redis + Playwright headless » 🟡
- **Angle :** architecture de la file de rendu (workers, stalled job recovery, S3 upload).
- **Sources :** `docs/ARCHITECTURE.md`, `docs/STALLED_JOB_FIX.md`, `src/app/api/recordings/`,
  deps `bullmq` + `ioredis` + `@aws-sdk/client-s3`.

---

## 🧪 Pépites « quick win » (articles courts / TIL)

- **F1** — `noLoop()` + `redraw()` : piloter une animation p5 frame par frame depuis Node. 🟡
- **F2** — Négocier un codec vidéo dans le navigateur avec `MediaRecorder.isTypeSupported`. 🟡
- **F3** — `object-fit` + transform pour rendre une preview vidéo impossible à distordre (`99a5605`). 🟡
- **F4** — Idle d'un `requestAnimationFrame` quand l'onglet est caché (`6bc2a4e`). 🟡
- **F5** — Extraire un thumbnail WebP depuis la première frame d'une vidéo (`51dfd7b`). 🟡
- **F6** — Tracker les pageviews sur changement de route client-side dans le Next.js App Router (GA4 sans rechargement) — `3eca276`/`2b82093` (PR #68), `src/components/GoogleAnalyticsTracker.tsx`, `src/lib/analytics/gtag.ts`. 🟡
- **F7** — Quand une palette de couleurs fait planter la draw-loop : le fix `rainbowCrazy` (`6b8966c`, PR #77). 🟡

---

## 🔭 Pistes pour le prochain scan

À surveiller dans les futurs commits pour de nouveaux articles :
- finalisation de l'encodeur Mediabunny in-browser (remplace-t-il FFmpeg ?) ;
- nettoyage des libs legacy (`tar.js`, `CCapture`) — clôt la série A1 ;
- **branches non-mergées prometteuses** repérées au scan du 2026-06-08 (à miner une fois sur `main`) :
  `ephemeral-pr-deployments` (preview Vercel + NAS → article DevOps), `shader-learning-p5js`
  (cours shaders M0-M1 + playground), migration `p5.js v2`, `audio-instrument-recognition` (DSP) ;
- suite du portage GPU (section G) → métriques chiffrées avant/après ;
- nouveaux templates → alimente la section D.
