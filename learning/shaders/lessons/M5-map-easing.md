# M5 — `map` & easing en GLSL (`mappers` + `easing`)

> Pré-requis : M0–M4. Notion clé : remettre une valeur à l'échelle (`remap`) et lui donner
> une **courbe** (easing) — l'idiome central de l'animation dans tes sketchs.

---

## `remap` = ton `map()`

Ouvre `noiseFieldGpu.js`, section `MAPPERS_GLSL` :

```glsl
float remap(float v, float a, float b, float c, float d) {
  return c + (v - a) / (b - a) * (d - c);
}
float remapClamp(float v, float a, float b, float c, float d) {
  float t = clamp((v - a) / (b - a), 0.0, 1.0);
  return c + t * (d - c);
}
```

- `remap` = `p5.map(v, a, b, c, d)` **sans bornage**.
- `remapClamp` = `p5.map(..., true)` : borné à `[c,d]`.

Outils cousins, déjà natifs en GLSL :
- `mix(a, b, t)` = **lerp** = `a + (b-a)*t` (interpolation linéaire). `remap(v,0,1,a,b)` ≡ `mix(a,b,v)`.
- `clamp(x, lo, hi)` = borne.
- `smoothstep(e0, e1, x)` = `remapClamp` + une courbe en S (du M2).

## Les easings (= ton `easing.js`)

Toujours dans `MAPPERS_GLSL`, les courbes que tu connais, portées en GLSL :

```glsl
float easeInSine(float x)    { return 1.0 - cos((x * PI) / 2.0); }
float easeOutSine(float x)   { return sin((x * PI) / 2.0); }
float easeInOutSine(float x) { return -(cos(PI * x) - 1.0) / 2.0; }

float easeInQuad(float x)  { return x * x; }
float easeOutQuad(float x) { float u = 1.0 - x; return 1.0 - u * u; }
float easeInCubic(float x) { return x * x * x; }
float easeInOutCubic(float x) {
  if (x < 0.5) { return 4.0 * x * x * x; }
  float u = -2.0 * x + 2.0;
  return 1.0 - (u * u * u) / 2.0;
}
float easeInBack(float x) {  // léger dépassement avant d'arriver
  float c1 = 1.70158, c3 = c1 + 1.0;
  return c3 * x*x*x - c1 * x*x;
}
```

Un détail de pro à retenir (c'est commenté dans ton repo) : les easings polynomiaux utilisent
des **multiplications** (`x*x*x`) plutôt que `pow(x, 3.0)`. Raison : `pow(base_négative, n)`
est **indéfini** en GLSL, alors que `Math.pow` côté JS l'accepte. La multiplication reproduit
exactement le comportement JS, même quand l'entrée sort de `[0,1]`.

## L'idiome central : `mappers.fn`

Dans tes sketchs, l'animation type est : *prendre une valeur, la normaliser, lui appliquer une
courbe, la remettre dans une plage cible*. C'est `mappers.fn(v, min, max, a, b, ease)`, soit :

```glsl
// remap(ease(remap(v, min, max, 0,1)), 0,1, a, b)
float fn(float v, float mn, float mx, float a, float b) {
  float t = remapClamp(v, mn, mx, 0.0, 1.0);  // 1) normaliser en 0..1
  t = easeInOutCubic(t);                       // 2) courber
  return mix(a, b, t);                          // 3) projeter dans [a,b]
}
```

Mémorise ces **trois temps** : *normaliser → courber → projeter*. Presque toute ton animation
en découle (rayon, opacité, déplacement, couleur…).

## Animer avec le temps

`uTime` est en secondes. Pour une boucle 0→1 qui se répète : `fract(uTime / duree)`. Pour un
va-et-vient : `sin`/`cos` (déjà en 0-courbe), ou un easing sur un ping-pong.

```glsl
float t   = fract(uTime * 0.5);              // boucle de 2s
float k   = easeInOutSine(t);                // courbe
float r   = mix(40.0, 160.0, k);             // rayon qui respire
```

---

## Exercices (playground)

- **E1 — `remap` de mémoire.** Réécris `remap` et `remapClamp`. Vérifie : `remap(0.5,0,1,100,200)` doit valoir 150.
- **E2 — Respiration.** Un disque (M2) dont le rayon respire entre 40 et 160px via `easeInOutSine(fract(uTime*0.5))`.
- **E3 — Comparer les courbes.** Écran coupé en bandes verticales (M4) : dans chaque bande,
  un point monte/descend avec un easing différent en fonction de `uTime`. Observe `linear` vs
  `Quad` vs `Cubic` vs `Back`.
- **E4 — `fn` de mémoire.** Implémente l'idiome *normaliser→courber→projeter* et anime
  l'opacité d'une forme avec.
- **E5 — Vague de grille.** Reprends la grille du M4 ; mappe le rayon de chaque point avec
  `fn(sin(id.x*0.6 + uTime), -1, 1, 0.05, 0.25)`.

<details>
<summary>Corrigés</summary>

```glsl
precision highp float;
varying vec2 vUv;
uniform vec2  uResolution;
uniform float uTime;
const float PI = 3.14159265;

float remapClamp(float v, float a, float b, float c, float d){
  float t = clamp((v-a)/(b-a), 0.0, 1.0); return c + t*(d-c);
}
float easeInOutSine(float x){ return -(cos(PI*x)-1.0)/2.0; }

void main(){
  vec2 p = (vUv - 0.5) * uResolution;
  float k = easeInOutSine(fract(uTime * 0.5));   // E2
  float r = mix(40.0, 160.0, k);
  float disc = 1.0 - smoothstep(r-1.0, r+1.0, length(p));
  gl_FragColor = vec4(vec3(disc), 1.0);
}
```
</details>

## Memory checks

1. `remap` vs `remapClamp` : la différence ?
2. Écris `mix(a,b,t)` en clair (formule).
3. Pourquoi les easings polynomiaux évitent-ils `pow()` ?
4. Les **trois temps** de l'idiome `fn` ?
5. Comment fais-tu une boucle temporelle de 3 secondes ?

<details>
<summary>Réponses</summary>

1. `remapClamp` borne le résultat à `[c,d]` (clamp du facteur), `remap` non. 2. `a + (b-a)*t`.
3. `pow(base négative, n)` est indéfini en GLSL ; la multiplication reproduit `Math.pow`. 4.
normaliser (`remapClamp` en 0..1) → courber (easing) → projeter (`mix` dans `[a,b]`). 5.
`fract(uTime / 3.0)`.
</details>

**Pont → M6** : tu sais mettre en forme et animer des valeurs. Reste la source de toute la
richesse organique de tes sketchs : le **bruit de Perlin**.
