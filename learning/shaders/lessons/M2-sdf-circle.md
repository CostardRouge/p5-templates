# M2 — Dessiner = SDF : le cercle (`discMask`)

> Pré-requis : M0–M1. Outil : `../playground/index.html`.
> Notion clé : une forme = une **fonction de distance** transformée en **couverture** (alpha 0..1).

---

## Concept

Souviens-toi du déclic (M0) : tu n'écris pas « dessine un cercle », tu écris un **test
par pixel**. La brique de base de ce test, c'est la **distance**.

- `length(v)` = distance du point `v` à l'origine.
- Pour un cercle de rayon `r` centré à l'origine : un pixel est **dedans** si
  `length(local) < r`, dehors sinon. (`local` = position du pixel par rapport au centre.)

Une **SDF** (Signed Distance Field, champ de distance signé) est une fonction qui, pour
une position, renvoie la distance au bord de la forme. Toute ta géométrie 2D peut s'exprimer
comme ça. Ton repo l'utilise déjà.

### Du « dedans/dehors » net au bord lissé

Le seuil net `step(r, d)` crée un bord crénelé (aliasing). Pour lisser sur ~1 pixel, on
utilise `smoothstep` :

- `step(edge, x)` → 0 si `x < edge`, sinon 1. **Cassant**.
- `smoothstep(e0, e1, x)` → transition douce de 0 à 1 entre `e0` et `e1`. **Anti-aliasé**.

C'est **exactement** ce que fait ta fonction. Ouvre `src/templates/p5/utils/noiseFieldGpu.js`,
section `SHAPES_GLSL` :

```glsl
// Disque plein (point p5 avec strokeWeight = 2*radius), bord anti-aliasé sur 1px.
float discMask(vec2 local, float radius) {
  return 1.0 - smoothstep(radius - 1.0, radius + 1.0, length(local));
}

// Anneau (circle(0,0,2*radius) avec strokeWeight) ; le trait chevauche le rayon.
float ringMask(vec2 local, float radius, float halfStroke) {
  float d = abs(length(local) - radius);
  return 1.0 - smoothstep(halfStroke - 1.0, halfStroke + 1.0, d);
}
```

Décortiquons `discMask` :
- `length(local)` : distance au centre, en **pixels**.
- `smoothstep(radius-1, radius+1, dist)` : vaut 0 à l'intérieur (dist < radius-1), 1 à
  l'extérieur (dist > radius+1), et fait une rampe douce sur 2px autour du rayon.
- `1.0 -` : on inverse, pour avoir **1 dedans, 0 dehors** → c'est la **couverture** (alpha).
- Le `±1.0` est la largeur d'anti-aliasing en **pixels** (parce qu'ici `local` et `radius`
  sont en pixels).

`ringMask` est le même principe mais sur `abs(distance - radius)` : la couverture est forte
**près du cercle de rayon r** (le contour) et nulle ailleurs → un anneau.

> ⚠️ Échelle : `discMask` raisonne en **pixels**. Dans le playground, `vUv` est en 0..1.
> Convertis : `vec2 local = (vUv - 0.5) * uResolution;` puis travaille en pixels. (Ou
> reste en 0..1 et mets un `radius` petit avec une largeur d'AA genre `0.005`.)

### Couverture ≠ distance signée

Note la nuance : `discMask`/`ringMask` renvoient une **couverture** (0..1, prête à mixer),
pas la distance signée brute. La SDF « pure » serait `length(local) - radius` (négatif
dedans, positif dehors). Les deux vues sont utiles : la distance pour combiner des formes,
la couverture pour colorer.

### Colorer une forme

Une couverture `mask` se compose avec `mix` (= lerp) :

```glsl
vec3 bg = vec3(0.05);
vec3 fg = vec3(1.0, 0.4, 0.1);
vec3 col = mix(bg, fg, mask);   // bg là où mask=0, fg là où mask=1
gl_FragColor = vec4(col, 1.0);
```

### Combiner plusieurs formes

Avec des **couvertures** (0..1) :
- **Union** : `max(maskA, maskB)`
- **Intersection** : `min(maskA, maskB)`
- **Soustraction** : `maskA * (1.0 - maskB)`

(Avec des **distances signées**, ce serait `min` pour l'union, `max` pour l'intersection —
attention à ne pas confondre les deux conventions.)

---

## Exercices (playground)

- **E1 — Disque.** Centre l'origine, passe en pixels (`local = (vUv-0.5)*uResolution`),
  écris `discMask` **de mémoire**, dessine un disque blanc rayon 120px sur fond sombre.
- **E2 — Anneau.** Ajoute un `ringMask` (rayon 200, halfStroke 6) par-dessus, en rouge.
- **E3 — Union.** Deux disques côte à côte, fusionnés via `max`.
- **E4 — Souris.** Un disque dont le centre suit la souris : `local = (vUv*uResolution) - uMouse*uResolution`.
- **E5 — Glow.** Un halo doux : au lieu d'un bord net, `float glow = radius / length(local);`
  (clampé). Observe la différence entre une *forme* et une *lueur*.

<details>
<summary>Corrigés</summary>

```glsl
// E1 + E2 + E3
precision highp float;
varying vec2 vUv;
uniform vec2 uResolution;

float discMask(vec2 local, float radius) {
  return 1.0 - smoothstep(radius - 1.0, radius + 1.0, length(local));
}
float ringMask(vec2 local, float radius, float halfStroke) {
  float d = abs(length(local) - radius);
  return 1.0 - smoothstep(halfStroke - 1.0, halfStroke + 1.0, d);
}

void main() {
  vec2 p = (vUv - 0.5) * uResolution;        // pixels, origine au centre
  float disc = discMask(p, 120.0);
  float ring = ringMask(p, 200.0, 6.0);

  // union de deux disques (E3) :
  float d2 = max(discMask(p - vec2(-150.0, 0.0), 80.0),
                 discMask(p - vec2( 150.0, 0.0), 80.0));

  vec3 col = vec3(0.05);
  col = mix(col, vec3(1.0),            disc);
  col = mix(col, vec3(1.0, 0.2, 0.2),  ring);
  col = mix(col, vec3(0.2, 0.8, 1.0),  d2);   // remplace/retire selon l'exo
  gl_FragColor = vec4(col, 1.0);
}
```
```glsl
// E4 — disque qui suit la souris
vec2 p = vUv * uResolution - uMouse * uResolution;
float disc = discMask(p, 90.0);
```
</details>

## Memory checks

1. Que renvoie `smoothstep(e0, e1, x)` quand `x < e0` ? quand `x > e1` ?
2. Pourquoi le `1.0 -` dans `discMask` ?
3. À quoi sert le `±1.0` et en quelle unité est-il ?
4. Différence entre `discMask` et `ringMask` (un seul terme change) ?
5. Couverture vs distance signée : laquelle vaut `length(local) - radius` ?
6. Union de deux **couvertures** : `min` ou `max` ?

<details>
<summary>Réponses</summary>

1. `0.0` puis `1.0`. 2. Pour inverser : avoir 1 **dedans**, 0 dehors (la couverture). 3. La
largeur d'anti-aliasing, en **pixels**. 4. `ringMask` applique la distance à `abs(length - radius)`
au lieu de `length`. 5. La **distance signée**. 6. `max`.
</details>

**Pont → M3** : un cercle, c'est `length(local)`. Une ligne, c'est la distance à un
**segment**. Même logique, autre distance.
