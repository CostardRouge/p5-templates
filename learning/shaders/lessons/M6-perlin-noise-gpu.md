# M6 — Le bruit de Perlin sur GPU (cœur de `noise-grid`)

> Pré-requis : M0–M5. Notion clé : le **bruit** transforme une grille régulière en champ
> organique. C'est l'âme de toute ta famille `noise-grid`.

---

## Pourquoi le bruit

`noise()` en p5 te donne une valeur **lisse et pseudo-aléatoire** : proche dans l'espace =
proche en valeur. C'est ce qui donne le côté « naturel » (flux, reliefs, fumée) plutôt que le
bruit blanc cassant de `random()`.

Le schéma de **tous** tes `noise-grid` est le même (lis le gros commentaire en tête de
`noiseFieldGpu.js`) :

> échantillonner Perlin sur une grille → en faire un **angle** → l'utiliser pour déplacer /
> tourner / colorer une primitive par cellule.

Sur CPU, faire ça par cellule à chaque frame était le goulot. Sur GPU, c'est gratuit.

## Ton port de `noise()`

Ton repo reproduit le Perlin de p5 **bit pour bit** : même graine (`noiseSeed`), même table de
permutation de 4096 entrées (envoyée en texture `uPerlin`), mêmes octaves (`uOctaves`,
`uFalloff`). Dans `COMMON_GLSL` :

```glsl
float perlinNoise(vec2 p);   // == p5 noise(x, y)
float perlinNoise(vec3 p);   // == p5 noise(x, y, z)
```

Sortie ≈ `[0, 1]` centrée autour de 0.5, comme p5. **Mais** `perlinNoise` dépend de la texture
`uPerlin` et des uniforms du moteur — donc **il ne tourne pas tel quel dans le playground**.

### Un bruit autonome pour le playground (hors-ligne)

Pour expérimenter sans le moteur, voici un **value noise** + **fbm** compacts à coller dans tes
shaders. Ce n'est pas le Perlin exact de p5, mais le **comportement et les usages sont
identiques** — c'est ce qui compte pour apprendre.

```glsl
float hash(vec2 p) {
  p = fract(p * vec2(123.34, 345.45));
  p += dot(p, p + 34.345);
  return fract(p.x * p.y);
}

float valueNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);            // lissage (smoothstep)
  float a = hash(i),               b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0,1.0)), d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

// fbm = somme d'octaves : l'équivalent de uOctaves / uFalloff de ton moteur.
float fbm(vec2 p) {
  float sum = 0.0, amp = 0.5;
  for (int i = 0; i < 5; i++) {                // borne CONSTANTE (obligatoire en WebGL1)
    sum += amp * valueNoise(p);
    p *= 2.0;       // fréquence ×2 (lacunarity)
    amp *= 0.5;     // amplitude ÷2 (= ton uFalloff)
  }
  return sum;
}
```

> **fbm = octaves.** Chaque octave ajoute du détail à fréquence double et amplitude moitié.
> C'est exactement le rôle de `uOctaves` (combien) et `uFalloff` (le ×0.5) dans ton moteur.

## Le pattern noise-grid (reproduction conceptuelle)

C'est la recette de `noise-grid-v1` / `v11`, version playground :

```glsl
vec2  N    = vec2(uColumnsEquivalent);     // densité de la grille
vec2  g    = vUv * N;
vec2  id   = floor(g);
vec2  cell = fract(g) - 0.5;

float n     = valueNoise(id * 0.15 + uTime * 0.1); // bruit par cellule (anime via le temps)
float angle = n * 6.2831853 * 1.0;                  // → un angle (× nb de cycles)
vec2  dir   = vec2(cos(angle), sin(angle));         // → une direction

// déplacer le point de la cellule le long de cette direction (flow field) :
cell -= dir * 0.25;
float dot = 1.0 - smoothstep(0.08, 0.10, length(cell));
```

Tu retrouves la chaîne complète : **grille (M4) → bruit (M6) → angle → direction → forme (M2)**.
Ajoute la couleur (M7) et tu as un vrai sketch.

> Note coordonnées : ton moteur calcule la position en **pixels avec origine en haut-gauche**
> (comme p5 2D), donc il **inverse `vUv.y`** au moment de passer en pixels. Le playground, lui,
> garde `vUv` origine bas-gauche. Détail à connaître quand tu transposeras vers le repo.

## Animer le bruit

- 2D + décalage : `valueNoise(p + uTime)` fait défiler le champ.
- 3D avec le temps en Z : `perlinNoise(vec3(p, uTime))` (dans le moteur) — le motif **évolue
  sur place** au lieu de défiler. C'est souvent plus joli.

## Domain warping (bonus, très « toi »)

Échantillonner le bruit à une position elle-même perturbée par du bruit → textures fluides,
marbrées :

```glsl
float w = fbm(p + fbm(p + uTime * 0.1));
```

---

## Exercices (playground)

- **E1 — Champ.** Affiche `fbm(vUv * 4.0)` en niveaux de gris. Fais-le défiler avec `uTime`.
- **E2 — Seuil.** Seuille le champ avec `smoothstep` pour obtenir des « continents » noir/blanc.
- **E3 — Flow field.** Grille de points (M4) déplacés par l'angle du bruit (pattern ci-dessus).
  **C'est ta reproduction de `noise-grid-v1`.**
- **E4 — Animation sur place.** Anime via un décalage temporel du bruit, pas via la position
  des points.
- **E5 — Octaves.** Compare `valueNoise(p)` seul vs `fbm(p)` : mesure ce qu'apportent les octaves.
- **E6 — Warp.** Applique le domain warping et observe.

<details>
<summary>Corrigés (E1–E3)</summary>

```glsl
precision highp float;
varying vec2 vUv;
uniform float uTime;
const float TAU = 6.2831853;

float hash(vec2 p){ p=fract(p*vec2(123.34,345.45)); p+=dot(p,p+34.345); return fract(p.x*p.y); }
float valueNoise(vec2 p){
  vec2 i=floor(p), f=fract(p), u=f*f*(3.0-2.0*f);
  float a=hash(i), b=hash(i+vec2(1,0)), c=hash(i+vec2(0,1)), d=hash(i+vec2(1,1));
  return mix(mix(a,b,u.x), mix(c,d,u.x), u.y);
}
float fbm(vec2 p){ float s=0.0,a=0.5; for(int i=0;i<5;i++){ s+=a*valueNoise(p); p*=2.0; a*=0.5;} return s; }

void main(){
  // E1 : gl_FragColor = vec4(vec3(fbm(vUv*4.0 + uTime*0.2)), 1.0);

  // E3 : flow field
  vec2 N=vec2(24.0,16.0), g=vUv*N, id=floor(g), cell=fract(g)-0.5;
  float n=valueNoise(id*0.15 + uTime*0.1);
  float ang=n*TAU;
  cell -= vec2(cos(ang),sin(ang))*0.25;
  float dot=1.0-smoothstep(0.08,0.10,length(cell));
  gl_FragColor=vec4(vec3(dot),1.0);
}
```
</details>

## Memory checks

1. Différence entre `noise()` et `random()` ?
2. Que veulent dire « octaves » et « falloff » (fbm) ?
3. La chaîne complète d'un sketch noise-grid (4–5 maillons) ?
4. Pourquoi `perlinNoise` du repo ne tourne pas tel quel dans le playground ?
5. Comment animer un champ « sur place » plutôt qu'en le faisant défiler ?

<details>
<summary>Réponses</summary>

1. `noise` est lisse et corrélé spatialement (organique) ; `random` est non corrélé (cassant).
2. octaves = nb de couches de bruit superposées (fréq ×2 à chaque fois) ; falloff = facteur
d'amplitude (×0.5) entre couches. 3. grille (`fract`) → bruit par cellule → angle → direction →
forme (déplacée/colorée). 4. Il dépend de la texture `uPerlin` et des uniforms du moteur,
absents du playground. 5. Bruit 3D avec le temps en Z (`perlinNoise(vec3(p, uTime))`).
</details>

**Pont → M7** : ton champ est en niveaux de gris. Donne-lui les couleurs de tes sketchs avec
les **palettes**.
