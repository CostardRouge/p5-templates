# blog/ — pipeline d'idées d'articles

Ce dossier transforme le travail réalisé sur le projet (refactos, optimisations,
fixes, choix techniques) en **backlog d'articles de blog**, mis à jour
régulièrement par une *loop* d'agent.

## Fichiers

- [`BACKLOG.md`](./BACKLOG.md) — la liste curatée des articles candidats, groupés
  par thème, avec pour chacun : angle, matière disponible, et **sources**
  (commits / PRs / docs) pour pouvoir rédiger sans re-fouiller l'historique.
- `INBOX.md` — milestones **bruts** détectés automatiquement, en attente de tri vers
  `BACKLOG.md`. Généré par la CI (voir ci-dessous) ; éphémère.
- `.last-scan` — curseur : SHA du dernier commit scanné.

## Détection automatique (GitHub Action)

La détection fiable des nouveaux milestones tourne **dans l'infra GitHub**, pas dans
une session Claude (le conteneur web est éphémère et le polling en arrière-plan n'y
est pas fiable).

- `.github/workflows/blog-scan.yml` se déclenche à chaque **push sur `main`**.
- Il lance `scripts/scan-blog-milestones.mjs`, qui compare `HEAD` au curseur
  `blog/.last-scan`, classe les **nouveaux commits de code** (ignore previews,
  thumbnails, `metadata.json` et sa propre machinerie) par type
  (`perf` / `refactor` / `feat` / `fix` / autres), et les écrit dans `blog/INBOX.md`.
- S'il y a de la matière, une **PR roulante** « 🤖 Blog — nouveaux milestones à trier »
  est ouverte/mise à jour. Son merge fait avancer le curseur.
- Déterministe, **aucune clé d'API requise**.

Lancement manuel possible via `workflow_dispatch` (avec un `since` optionnel), ou en
local : `node scripts/scan-blog-milestones.mjs` (override `SCAN_HEAD=<ref>` pour cibler
une autre tête).

## Du brut au curaté (le tri, fait par un humain ou Claude)

À partir des entrées de `INBOX.md`, on rédige des entrées de `BACKLOG.md` :

### Cycle de vie d'une entrée

`🟡 idée` → `🔵 prêt à rédiger` → `✍️ en cours` → `✅ publié`

## Étapes suivantes (au-delà du listing)

- **Étape 2 :** générer un *brouillon* d'article à partir d'une entrée 🔵
  (intro + plan + extraits de diff + chiffres déjà mesurés).
- **Étape 3 :** export vers le format du blog (Markdown/MDX) + assets (captures,
  schémas avant/après).
