# Apprendre les shaders — orienté p5-templates

Un cours progressif pour passer du dessin 2D/3D en p5.js (CPU) aux **shaders** (GPU),
construit autour de **ton propre code**. Le but final : pouvoir démarrer un sketch
directement en shader.

## Comment ça marche

Chaque leçon suit toujours le même rituel — c'est lui qui crée la mémorisation :

1. **Concept** — l'intuition, courte.
2. **Lecture de ton code** — la version CPU que tu connais, puis sa version GPU
   déjà présente dans le repo.
3. **Exercice** — tu codes, dans le playground.
4. **Memory check** — tu réécris de mémoire la fonction clé, ou un mini-quiz.
5. **Révision espacée** — chaque session rejoue 1–2 notions passées avant d'avancer.

> Mes sessions sont **éphémères** : rien n'est gardé entre deux discussions. C'est
> pourquoi tout vit ici, dans le repo. `PROGRESS.md` est la mémoire du cours :
> n'importe quelle future session le lit pour savoir où on en est et quoi te faire réviser.

## La pierre de Rosette

Pour presque chaque outil p5 que tu connais, il existe son jumeau GPU déjà écrit dans
ton repo. Garde ces fichiers ouverts pendant le cours :

| p5 (CPU) | Shader (GPU) | Fichier |
|---|---|---|
| `circle()` | `discMask()` (SDF) | `src/templates/p5/utils/noiseFieldGpu.js` |
| stroke circle | `ringMask()` | idem |
| `line()` | `segmentDistance()` (capsule SDF) | idem |
| grille (`for`) | `fract(uv*N)` (répétition de domaine) | à comparer à `utils/grid.js` |
| `map()` | `remap()` / `remapClamp()` | `utils/mappers.js` → MAPPERS_GLSL |
| easings | `ease*` GLSL | `utils/easing.js` → MAPPERS_GLSL |
| `noise()` | `perlinNoise()` | COMMON_GLSL dans noiseFieldGpu.js |
| `rainbow()`… | `paletteRainbow()`… | `utils/colors.js` → PALETTES_GLSL |
| sphère/cône 3D | vertex shader + `mat4` + instancing | `sketches/peaks/peaks-cone/index.js` |

## Le programme

**Piste A — Fragment / 2D** (la majorité de tes sketchs)
- **M0** Le mental model — chaque pixel se pose une question
- **M1** L'espace du pixel — les UV (= l'équivalent de translate/scale)
- **M2** Dessiner = SDF : le cercle (`discMask`)
- **M3** Lignes & segments (`segmentDistance`)
- **M4** Grilles & répétition SANS boucle (`fract`, `mod`)
- **M5** map & easing en GLSL
- **M6** Le bruit de Perlin sur GPU (cœur de `noise-grid`)
- **M7** Couleur & palettes
- **M8** Composition, ordre de dessin, blending

**Piste B — 3D / Vertex**
- **M9** Vertex shader & matrices (dissection de `peaks-cone`)
- **M10** Raymarching (avancé, optionnel)

## Le playground

`playground/index.html` — un éditeur de fragment shader **en direct**. Ouvre-le dans
un navigateur (double-clic suffit, aucune dépendance, aucun serveur). Tu édites le
shader à gauche, le résultat s'affiche à droite, les erreurs de compilation aussi.

Uniforms disponibles dans tes shaders :
- `vUv` — coordonnée du pixel, de `(0,0)` en bas-gauche à `(1,1)` en haut-droite
- `uResolution` — taille du canvas en pixels (`vec2`)
- `uTime` — secondes écoulées (`float`)
- `uMouse` — position souris normalisée 0..1 (`vec2`)

Le vertex shader est fixe et identique à celui de ton repo (`VERT_SRC` dans
`noiseFieldGpu.js`), pour que ce que tu apprends ici se transpose tel quel.
