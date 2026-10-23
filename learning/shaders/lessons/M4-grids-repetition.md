# M4 — Grilles & répétition SANS boucle (`fract`, `mod`)

> Pré-requis : M2–M3. **C'est la leçon qui remplace tes doubles `for`.** Notion clé :
> la **répétition de domaine** — diviser l'espace en cellules identiques, gratuitement.

---

## Le superpouvoir

En p5, pour faire une grille tu écris :

```js
for (let y = 0; y < rows; y++)
  for (let x = 0; x < cols; x++)
    circle(x * cell, y * cell, d);   // CPU : cols×rows itérations
```

En shader, **il n'y a pas de boucle** : chaque pixel sait déjà où il est. On lui demande
juste « dans quelle cellule suis-je, et où **dans** cette cellule ? ». Deux fonctions suffisent :

- `floor(x)` = partie entière → **l'identifiant** de la cellule.
- `fract(x)` = `x - floor(x)` → partie fractionnaire, 0..1 → la **position locale** dans la cellule.

```glsl
vec2 g    = vUv * N;        // N = nombre de cellules par axe (ex. vec2(8.0, 6.0))
vec2 id   = floor(g);       // indice entier de la cellule (0,0), (1,0), ...
vec2 cell = fract(g);       // coord locale 0..1 dans la cellule
```

`cell` repart de 0 à 1 **dans chaque case** : un motif dessiné avec `cell` se répète
automatiquement partout. C'est ça, la **répétition de domaine**.

### Une grille de points (sans boucle)

On recentre la cellule (`cell - 0.5`) et on dessine un disque dedans, comme au M2 :

```glsl
vec2 g    = vUv * vec2(uColumns, uRows);
vec2 cell = fract(g) - 0.5;          // -0.5..0.5, origine au centre de la case
float d   = length(cell);
float dot = 1.0 - smoothstep(0.18, 0.20, d);  // rayon ~0.19 en unités de cellule
```

Tu viens de dessiner `uColumns × uRows` points d'un coup. **Zéro boucle.** C'est le squelette
de ta famille `noise-grid` (il ne manque que le bruit, M6).

### Varier chaque cellule avec `id`

`id` est constant dans toute une cellule → parfait pour faire varier taille, couleur, phase
**par case** :

```glsl
float r = 0.1 + 0.15 * fract(sin(dot(id, vec2(12.9, 78.2))) * 43758.5); // pseudo-aléa par case
```

(`id` sera bientôt l'entrée de `perlinNoise` au M6 : un angle/une couleur par cellule.)

### `mod` : l'autre outil de répétition

`mod(x, m)` ramène `x` dans `[0, m)`. Utile pour un damier :

```glsl
float checker = mod(id.x + id.y, 2.0);   // 0 ou 1 en damier
```

### Pointillés = répétition 1D

Le long d'un axe (ou d'un segment via le `h` du M3) :

```glsl
float t = vUv.x * 20.0;        // 20 tirets
float dash = step(0.5, fract(t)); // trait / vide alterné
```

### Le piège des bords (important)

Une forme proche du bord d'une cellule est **coupée** : le pixel voisin appartient à la case
d'à côté et ne « voit » pas ce qui déborde. Tant que tes formes tiennent dans leur cellule,
tout va bien. Pour des formes qui débordent (gros points, halos), il faut **regarder les
cellules voisines** — c'est le M8 (et c'est exactement pourquoi `noise-grid-v12` scanne un
voisinage 3×3).

### Aspect ratio

`fract(vUv * N)` donne des cellules carrées en **UV**, donc rectangulaires à l'écran si le
canvas n'est pas carré. Choisis `N = vec2(cols, rows)` proportionnel au format, ou corrige
en pixels comme aux M2–M3.

---

## Exercices (playground)

- **E1 — Grille de points.** 8×6 points (méthode ci-dessus), **de mémoire**.
- **E2 — Taille par cellule.** Fais varier le rayon des points avec `id` (pseudo-aléa, ou
  `0.1 + 0.1*sin(id.x + id.y)`).
- **E3 — Damier.** Colore en damier avec `mod(id.x + id.y, 2.0)`.
- **E4 — Pointillés.** Une ligne pointillée horizontale au centre de l'écran.
- **E5 — Grille de cercles (anneaux).** Remplace le disque par un `ringMask` adapté en unités
  de cellule (ou repasse en pixels).
- **E6 — Vague.** Décale chaque point verticalement selon sa colonne : `cell.y += 0.2*sin(id.x + uTime)`.

<details>
<summary>Corrigés</summary>

```glsl
precision highp float;
varying vec2 vUv;
uniform float uTime;

float rand(vec2 p){ return fract(sin(dot(p, vec2(12.9, 78.2))) * 43758.5); }

void main() {
  vec2 N    = vec2(8.0, 6.0);
  vec2 g    = vUv * N;
  vec2 id   = floor(g);
  vec2 cell = fract(g) - 0.5;

  cell.y += 0.2 * sin(id.x + uTime);          // E6 (retire pour E1)

  float r   = 0.10 + 0.12 * rand(id);          // E2
  float dot = 1.0 - smoothstep(r - 0.01, r + 0.01, length(cell));

  float checker = mod(id.x + id.y, 2.0);       // E3
  vec3 bg = mix(vec3(0.04), vec3(0.10), checker);

  gl_FragColor = vec4(mix(bg, vec3(1.0), dot), 1.0);
}
```
```glsl
// E4 — pointillés
float band = 1.0 - smoothstep(0.02, 0.03, abs(vUv.y - 0.5)); // bande centrale
float dash = step(0.5, fract(vUv.x * 30.0));
gl_FragColor = vec4(vec3(band * dash), 1.0);
```
</details>

## Memory checks

1. Que renvoient `floor(vUv*N)` et `fract(vUv*N)`, et à quoi sert chacun ?
2. Combien de boucles écris-tu pour dessiner une grille 100×100 en shader ?
3. Pourquoi `id` est-il idéal pour varier une propriété par cellule ?
4. Quel est le piège quand une forme déborde de sa cellule, et quelle leçon le résout ?
5. Comment ferais-tu un damier ?

<details>
<summary>Réponses</summary>

1. `floor` = indice (entier) de la cellule ; `fract` = position locale 0..1 dedans. 2. **Zéro**.
3. Il est constant dans toute la cellule → une valeur unique par case. 4. La forme est coupée
au bord (le voisin ne la voit pas) ; résolu au M8 par l'échantillonnage des cellules voisines.
5. `mod(id.x + id.y, 2.0)`.
</details>

**Pont → M5** : tu fais des grilles. Pour les **animer** proprement (tailles, opacités,
courbes), il te faut `remap` et les easings — tes outils habituels, en GLSL.
