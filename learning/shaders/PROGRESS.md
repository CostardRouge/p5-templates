# Progression & répétition espacée

> **Pour une future session Claude** : c'est la mémoire du cours.
> - **Session de révision** (ex. déclenchée par un rappel programmé) : prends les
>   notions dont `Prochaine révision` ≤ date du jour, interroge l'élève dessus
>   (de mémoire, pas de copier-coller), puis recale la date selon l'intervalle de
>   répétition espacée ci-dessous. Ne révise QUE ce qui est dû, max ~4 notions.
> - **Session de cours** : commence par 1–2 révisions dues, puis enchaîne sur la
>   prochaine leçon non commencée.
> - Mets toujours ce fichier à jour à la fin de la session, et commit.

**Intervalles** (à partir de la date où la notion est jugée acquise) :
`1j → 3j → 7j → 16j → 35j → 70j`. Si l'élève sèche sur une révision, on repart à `1j`.

**Statuts** : `à voir` · `en cours` · `acquis` · `à réviser`

## État par module

| Module | Notion clé | Statut | Dernière révision | Prochaine révision |
|---|---|---|---|---|
| M0 | Mental model : 1 exécution par pixel, pas d'état, sortie = couleur | en cours | — | — |
| M1 | UV : repère 0..1, centrage, aspect ratio | en cours | — | — |
| M2 | SDF du cercle (`discMask`, `smoothstep`) | à voir | — | — |
| M3 | Segments (`segmentDistance`) | à voir | — | — |
| M4 | Répétition de domaine (`fract`, `mod`) | à voir | — | — |
| M5 | `remap` & easings GLSL | à voir | — | — |
| M6 | Perlin sur GPU | à voir | — | — |
| M7 | Palettes | à voir | — | — |
| M8 | Composition & blending | à voir | — | — |
| M9 | Vertex shader & matrices | à voir | — | — |
| M10 | Raymarching | à voir | — | — |

## Journal de session

| Date | Ce qui a été fait | Prochaine étape |
|---|---|---|
| 2026-06-07 | Mise en place du cours. Démarrage M0–M1 (lecture + exercices à faire). | L'élève fait les exos M0–M1 dans le playground ; corriger, puis M2. |

## Carnet d'erreurs récurrentes

_(à remplir au fil de l'eau : confusions fréquentes, pièges à re-tester en révision)_
