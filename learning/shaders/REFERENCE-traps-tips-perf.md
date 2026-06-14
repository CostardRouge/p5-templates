# Référence — pièges, astuces, perf & bonus

> À lire en transversal, pas d'un coup. C'est ton aide-mémoire pour écrire des shaders
> **corrects** (sans bugs sournois), **rapides**, et avec quelques tours dans la manche.
> Ancré sur ton contexte : **WebGL1 / GLSL ES 1.00** (`gl_FragColor`, `varying`), `noise-grid`,
> raymarching, et tes exports en boucle pour les réseaux.

---

## 1. Pièges (les bugs qui ne préviennent pas)

### Types : `float` ≠ `int`
- `1` est un **int**, `1.0` un **float**. GLSL ES 1.00 ne convertit **pas** implicitement.
  `float x = 1;` → **erreur**. `vec2(1, 0)` → erreur. Écris `vec2(1.0, 0.0)`.
- Pas d'opérateur `%` sur les int, pas de bitwise (`&`, `|`, `<<`) en ES 1.00. Pour le modulo,
  utilise `mod()` (sur des float).

### `mod()` n'est pas le `%` de JS
- `mod(x, y) = x - y*floor(x/y)` → le résultat a **le signe de `y`** (positif si `y>0`),
  même pour `x` négatif. En JS, `%` garde le signe du **dividende**. Sur des coordonnées qui
  passent en négatif (origine centrée), c'est une source de discontinuités. Pense-y pour la
  répétition de domaine.

### `pow(base_négative, n)` est **indéfini**
- D'où le choix de ton repo d'écrire les easings polynomiaux en multiplications (`x*x*x`)
  plutôt que `pow(x, 3.0)` : `mappers.fn` passe des entrées non bornées (donc parfois < 0).
- Idem : `sqrt(négatif)`, `log(≤0)`, `pow(0.0, 0.0)` → NaN/indéfini.

### NaN / Inf qui « mangent » l'écran
- `normalize(vec3(0.0))` → **NaN** (division par 0). Garde-toi des vecteurs nuls (rayon de
  caméra, normale d'un point pile au centre…).
- Division par 0, `1.0/length` quand `length==0` → Inf. Un seul NaN se propage et peut noircir
  tout un pixel. En cas d'écran noir/blanc inexpliqué, suspecte un NaN.
- `dot(ba, ba)` vaut 0 si `a==b` dans `segmentDistance` → division par 0. (Au M3, `a==b` donnait
  un disque « par chance » car `h=clamp(NaN)` ; en vrai, protège avec un `max(dot(ba,ba), 1e-6)`.)

### `smoothstep(e0, e1, x)` avec `e0 >= e1`
- Si `e0 == e1`, comportement indéfini (souvent un `step` dur). Garde `e1 > e0`. Pour un bord de
  1px : `smoothstep(r-1.0, r+1.0, d)`.

### Précision : `mediump` vs `highp`
- Dans le **fragment**, `highp` n'est **pas garanti** sur tout GPU mobile (il l'est sur desktop).
  `mediump` a une plage/précision réduite → **banding**, scintillement, bruit qui « bave » sur de
  grandes coordonnées.
- Ton moteur met `precision highp float; precision highp int;` exprès pour le Perlin (les indices
  de table montent haut, cf. le clamp `MAX_OCTAVES = 12` : au-delà, les indices entiers perdent
  la précision float). **Garde highp dès qu'il y a de grandes valeurs** (temps qui s'accumule,
  indices, coordonnées monde). Le temps `uTime` qui grandit indéfiniment finit par saccader en
  mediump → préfère `fract(uTime*...)` ou un temps qui boucle.

### Géométrie / repère
- **Aspect ratio oublié** → cercles ovales. `p.x *= uResolution.x/uResolution.y;` dès qu'il y a
  une distance (M1).
- **Y inversé** : `vUv` est origine **bas-gauche** (y monte) ; p5 2D est **haut-gauche** (y
  descend). Ton moteur **flippe `vUv.y`** quand il passe en pixels pour coller à p5. Quand tu
  transposes playground → repo (ou inverses une image), pense au flip.
- **Couleurs en 0..1**, pas 0..255. Et **clampe** avant la sortie (`clamp(col, 0.0, 1.0)`) : tes
  palettes le font déjà — sans ça, un canal > 1 peut donner des artefacts au blending/encodage.

### WebGL1 : ce qui est interdit
- **Boucles** : la borne doit être une **constante** (`for (int i=0;i<64;i++)`). Pas de borne
  par uniform. Tu peux `break` tôt sous condition (c'est ce que fait le raymarch et le port Perlin
  avec `if (o >= uOctaves) break;`).
- **Indexation dynamique** d'`array`/`sampler` par une variable : très restreinte → évite.
- **Dérivées** (`dFdx`, `fwidth`) : nécessitent `#extension GL_OES_standard_derivatives : enable`
  en tête de fragment (sinon erreur de compilation).
- `texture2DLod` seulement dans le **vertex** ; dans le fragment, pas de choix de mip explicite
  sans extension.

### Branches & dérivées
- Échantillonner une texture (`texture2D`) sous un `if` qui diverge entre pixels voisins fausse
  le calcul de mip (dérivées). Pour du bruit en texture comme le tien, ça compte si tu mets des
  branches autour des lookups.

---

## 2. Astuces (écrire mieux, plus court)

### Anti-aliasing indépendant de la résolution : `fwidth`
Au lieu d'un `±1.0` fixe (qui suppose des pixels), la largeur du bord = la taille d'un pixel dans
**ton** espace (UV, monde…) :
```glsl
#extension GL_OES_standard_derivatives : enable
// ...
float aa = fwidth(d);                  // ~1px exprimé dans l'unité de d
float mask = 1.0 - smoothstep(r - aa, r + aa, d);
```
→ formes nettes quel que soit le zoom/la densité de la grille. Idéal pour M2–M4 en coords 0..1.

### Compare des distances **au carré**
`sqrt` coûte. Pour « est-ce que je suis à moins de r ? », compare `dot(p,p)` à `r*r` plutôt que
`length(p)` à `r`. (Garde `length` quand tu as besoin de la vraie distance pour un bord doux.)

### Remplace les `if` par `step`/`mix`/`clamp`
```glsl
// au lieu de : if (x > seuil) col = A; else col = B;
col = mix(B, A, step(seuil, x));
```
Pas de divergence de branche (cf. perf §3), et souvent plus court.

### Coordonnées polaires (radial, kaléidoscope, secteurs)
```glsl
float r = length(p);
float a = atan(p.y, p.x);          // angle -PI..PI
// répéter en N secteurs (mandala) :
float N = 6.0;
a = mod(a, TAU/N) - (TAU/N)*0.5;
vec2 q = vec2(cos(a), sin(a)) * r;
```

### Rotation 2D propre
```glsl
vec2 rot(vec2 v, float a){ float c=cos(a), s=sin(a); return mat2(c,-s,s,c)*v; }
```
(Ton `rotateAroundCenter` fait ça autour de `uCenter`.)

### Hash sans `sin` (plus stable d'un GPU à l'autre)
`fract(sin(...)*43758.5)` varie selon le `sin` du driver. Plus robuste :
```glsl
float hash(vec2 p){ vec3 p3 = fract(vec3(p.xyx)*0.1031); p3 += dot(p3, p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
```

### Opérations SDF utiles (prolonge M2/M10)
```glsl
float opRound(float d, float r){ return d - r; }          // arrondit les angles
float opAnnular(float d, float w){ return abs(d) - w; }    // creuse un anneau/coque
// fusion douce (déjà au M10) :
float smin(float a,float b,float k){ float h=clamp(0.5+0.5*(b-a)/k,0.0,1.0); return mix(b,a,h)-k*h*(1.0-h); }
```

### `sign`, `abs`, `step` pour la symétrie
`abs(p)` replie l'espace → tu ne dessines qu'un quart et tu obtiens 4 symétries gratuites.

---

## 3. Perf (faire tenir le temps réel)

### Le coût se mesure **par pixel × nombre de pixels**
Un fragment full-screen en 1080p = ~2M exécutions/frame. Tout ce que tu ajoutes dans `main` est
multiplié par ça. Les leviers, du plus rentable au moins :

| Levier | Pourquoi | Comment |
|---|---|---|
| **Résolution / DPR** | coût ∝ nb de pixels | plafonne le devicePixelRatio (le playground le cap à 2) ; rends dans un buffer plus petit puis upscale |
| **Moins de branches divergentes** | le GPU exécute par groupes (SIMD) : si des pixels voisins prennent des chemins différents, il fait **les deux** | `mix`/`step` au lieu de `if`; sors tôt **uniformément** |
| **Moins de pas de raymarch** | la boucle domine | baisse le nb d'itérations, augmente l'epsilon de hit, borne la distance max, ajoute un *bounding* |
| **Moins d'octaves de bruit** | chaque octave = un tour de boucle + lookups | `uOctaves` au minimum visuellement acceptable (ton moteur clampe à 12) |
| **Moins de lookups texture** | la mémoire est lente | regroupe, évite les lookups sous branche, mets en cache dans une variable |
| **Moins de `sin/cos/pow/exp`** | fonctions transcendantes coûteuses | sors-les des boucles, pré-calcule, ou approxime |
| **Moins d'overdraw (instancing)** | redessiner le même pixel N fois | en mode quads, limite la taille des instances ; trie/évite les gros recouvrements |

### Full-screen fragment vs instancing : choisir selon la densité
Ton moteur a les deux (`createNoiseFieldRenderer` vs `createInstancedFieldRenderer`) :
- **Full-screen** : coût ≈ constant = pixels × travail/pixel. Excellent si **dense** (champ qui
  remplit l'écran). Le scan 3×3 de `v12` multiplie le travail/pixel par 9 → à réserver aux cas où
  le débordement compte.
- **Instanced** : coût ≈ cellules × (sommets + leur overdraw). Excellent si **épars** (peu de
  formes, ou formes qui se chevauchent et qu'on veut blender dans l'ordre). Devient cher si la
  grille est énorme (beaucoup de quads + overdraw).
- Règle de poche : **champ plein → full-screen ; éléments comptés/chevauchants → instanced.**

### Rendre plus petit, composer plus grand
Tu rends déjà le champ dans un buffer WebGL off-screen puis tu le composites sur le canvas 2D.
Tu peux **réduire la taille du buffer** (ex. 0.75×) pour les effets doux (bruit, halos) : le coût
chute quadratiquement, et l'upscale se voit peu. Garde la pleine résolution pour les bords nets.

### Évite `discard`
`discard` (jeter un fragment) casse l'optimisation early-z du GPU. Pour de la transparence,
préfère écrire un **alpha** et laisser le blending faire — comme tes masques `discMask`/`ringMask`
qui renvoient une couverture.

### `const` et hissage hors boucle
Marque les constantes `const` (le compilateur les plie). Sors des boucles tout ce qui ne dépend
pas de l'itération (un `cos(uTime)` calculé une fois, pas à chaque tour).

### Minimise les `varying`
Chaque `varying` est interpolé pour chaque fragment. Pour la 3D (M9), ne passe que le nécessaire
(souvent une couleur et/ou une normale).

### LUT (look-up table)
Une palette/courbe coûteuse peut être pré-calculée dans une petite texture 1D et lue d'un
`texture2D` — c'est exactement l'esprit de ta table de permutation Perlin packée en texture.

---

## 4. Bonus (les petits trucs qui en jettent)

### Boucles **parfaitement** seamless (crucial pour tes exports réseaux)
Pour qu'une animation boucle sans couture, **tout doit être périodique sur la durée**. Pilote
l'animation par un angle qui fait un tour complet, pas par `uTime` brut :
```glsl
// progression 0..1 sur la durée du sketch  →  angle 0..TAU
float a = TAU * uProgress;          // = ton animation.angle (utils/animation.js)
float v = sin(a);                   // boucle parfaite
float w = perlinNoise(vec3(p, cos(a)*R + sin(a)*R)); // bruit qui boucle via un CERCLE en Z
```
Le truc du bruit qui boucle : échantillonne la 3e dimension du bruit sur un **cercle**
(`cos(a), sin(a)`) au lieu d'une ligne → la fin rejoint le début. Tes uniforms `uProgress`/angle
existent déjà côté moteur.

### Vignette / finition plein écran (post)
```glsl
col *= smoothstep(1.2, 0.3, length(vUv - 0.5));   // assombrit les bords
```

### Grain / dithering (casse le banding mediump)
```glsl
float n = (hash(gl_FragCoord.xy) - 0.5) / 255.0;
col += n;   // bruit ±1 niveau : tue le banding des dégradés
```

### Aberration chromatique (échantillonne R/G/B décalés)
Décale légèrement l'échantillonnage par canal autour du centre → effet « lentille » stylé sur les
rendus à base de texture.

### Palette cosinus paramétrique (rappel M7)
`a + b*cos(TAU*(c*t + d))` : 4 `vec3` et tu as n'importe quel dégradé. Anime `d` avec l'angle de
boucle pour un cycle de teinte seamless.

### Kaléidoscope express
Combine §2 (polaire + `mod` sur l'angle) avec un de tes champs → symétrie mandala instantanée.

### Interactivité quasi gratuite
`uMouse` (ou un uniform d'audio/temps) en entrée d'un `remap`/`fn` (M5) suffit à rendre un sketch
réactif sans rien recoder de la structure. C'est là que les shaders battent ta 2D/3D CPU :
l'interactivité temps réel ne coûte presque rien.

---

## Mini check-list « avant de publier »
- [ ] Aspect ratio corrigé (pas d'ovales) ?
- [ ] Couleurs clampées 0..1 ?
- [ ] `highp` là où il y a de grandes valeurs (temps/indices) ?
- [ ] Pas de `normalize`/division sur un vecteur potentiellement nul ?
- [ ] La boucle (raymarch/octaves) a-t-elle une borne raisonnable ?
- [ ] L'animation **boucle** proprement (pilotée par l'angle, pas `uTime` brut) ?
- [ ] DPR plafonné / résolution adaptée à la cible ?
