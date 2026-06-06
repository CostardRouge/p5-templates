# blog/ — pipeline d'idées d'articles

Ce dossier transforme le travail réalisé sur le projet (refactos, optimisations,
fixes, choix techniques) en **backlog d'articles de blog**, mis à jour
régulièrement par une *loop* d'agent.

## Fichiers

- [`BACKLOG.md`](./BACKLOG.md) — la liste curatée des articles candidats, groupés
  par thème, avec pour chacun : angle, matière disponible, et **sources**
  (commits / PRs / docs) pour pouvoir rédiger sans re-fouiller l'historique.

## Fonctionnement de la loop (étape 1 : lister les milestones)

À chaque passage, l'agent :

1. lit le **commit de référence** noté en tête de `BACKLOG.md` (dernier HEAD scanné) ;
2. `git log <ref>..HEAD` pour ne regarder que le nouveau travail ;
3. classe les commits (`feat` / `refactor` / `perf` / `fix` + diffs significatifs) ;
4. **ajoute** de nouvelles entrées ou enrichit les existantes — sans dupliquer
   ce qui est déjà listé (le statut de chaque entrée évite les doublons) ;
5. met à jour la date de scan et le commit de référence en tête de `BACKLOG.md`.

### Cycle de vie d'une entrée

`🟡 idée` → `🔵 prêt à rédiger` → `✍️ en cours` → `✅ publié`

## Étapes suivantes (au-delà du listing)

- **Étape 2 :** générer un *brouillon* d'article à partir d'une entrée 🔵
  (intro + plan + extraits de diff + chiffres déjà mesurés).
- **Étape 3 :** export vers le format du blog (Markdown/MDX) + assets (captures,
  schémas avant/après).
