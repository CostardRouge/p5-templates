# M3 — Lignes & segments (`segmentDistance`)

> Pré-requis : M2. Notion clé : une ligne = la **distance à un segment** (capsule SDF),
> seuillée en couverture comme le disque.

---

## Concept

En p5, `line(x1,y1, x2,y2)` trace un trait avec, par défaut, des bouts arrondis (ROUND cap).
L'équivalent shader : pour chaque pixel, calculer **sa distance au segment** `a→b`, puis
appliquer le même `smoothstep` qu'au M2.

Ouvre `noiseFieldGpu.js`, section `SHAPES_GLSL` :

```glsl
// Distance du point p au segment a→b (bouts ronds = axe d'une capsule),
// correspond au strokeCap ROUND par défaut de line() en p5.
float segmentDistance(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h);
}
```

Comment ça marche, ligne par ligne :
- `pa = p - a` : vecteur du début du segment vers le pixel.
- `ba = b - a` : le segment lui-même (sa direction et sa longueur).
- `dot(pa, ba) / dot(ba, ba)` : **projection** de `p` sur la droite `(a,b)`, exprimée en
  fraction `h` de la longueur (0 = sur `a`, 1 = sur `b`, 0.5 = milieu).
- `clamp(..., 0.0, 1.0)` : on **borne** `h` à `[0,1]` → au-delà des extrémités, le point
  le plus proche redevient `a` ou `b`. C'est ce `clamp` qui crée les **bouts ronds**.
- `length(pa - ba*h)` : distance du pixel au point le plus proche **sur** le segment.

### Tracer la ligne

`segmentDistance` donne une distance ; on la transforme en couverture comme le disque, avec
la **demi-épaisseur** du trait (`halfWeight`) en seuil :

```glsl
float lineMask(vec2 p, vec2 a, vec2 b, float halfWeight) {
  float d = segmentDistance(p, a, b);
  return 1.0 - smoothstep(halfWeight - 1.0, halfWeight + 1.0, d);
}
```

Une ligne, c'est donc « la zone à moins de `halfWeight` pixels du segment ». Un strokeWeight
de 8px → `halfWeight = 4.0`.

### Polylignes, croix, grilles de lignes

- Une **polyligne** = plusieurs segments, unis par `max` de leurs masques (cf. M2).
- Une **croix** = deux segments perpendiculaires (`utils/shapes.js` a une `cross()` en CPU —
  voici son équivalent GPU).
- Une **grille de lignes** = des segments verticaux et horizontaux répétés (on le fera sans
  boucle au M4 avec `fract`).

### Pointillés (aperçu M4)

Pour des tirets, on coupe le trait le long du segment grâce au paramètre de projection `h`
(ou à la distance le long de l'axe). En gros : on ne garde le trait que là où
`fract(h * nbTirets) < 0.5`. Tu maîtriseras `fract` au M4 ; garde l'idée en tête.

---

## Exercices (playground)

Travaille en pixels (`vec2 p = (vUv - 0.5) * uResolution;`).

- **E1 — Segment.** Écris `segmentDistance` + `lineMask` **de mémoire**, trace un segment de
  `a=(-200,-100)` à `b=(200,100)`, épaisseur 8px.
- **E2 — Épaisseur animée.** Fais varier `halfWeight` avec `uTime` (`4.0 + 3.0*sin(uTime)`).
- **E3 — Bouts ronds.** Mets `a == b` (segment de longueur nulle) : tu obtiens… un disque.
  Comprends pourquoi (la capsule dégénère en cercle).
- **E4 — Croix.** Deux segments perpendiculaires unis par `max`.
- **E5 — Souris.** Un segment dont le point `b` suit la souris (`b = (uMouse-0.5)*uResolution`).

<details>
<summary>Corrigés</summary>

```glsl
precision highp float;
varying vec2 vUv;
uniform vec2  uResolution;
uniform float uTime;
uniform vec2  uMouse;

float segmentDistance(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h);
}
float lineMask(vec2 p, vec2 a, vec2 b, float hw) {
  return 1.0 - smoothstep(hw - 1.0, hw + 1.0, segmentDistance(p, a, b));
}

void main() {
  vec2 p = (vUv - 0.5) * uResolution;
  float hw = 4.0 + 3.0 * sin(uTime);            // E2

  float seg  = lineMask(p, vec2(-200.0,-100.0), vec2(200.0,100.0), hw);
  float vert = lineMask(p, vec2(0.0,-150.0), vec2(0.0,150.0), 4.0); // E4
  float hori = lineMask(p, vec2(-150.0,0.0), vec2(150.0,0.0), 4.0);
  float cross = max(vert, hori);

  vec3 col = vec3(0.05);
  col = mix(col, vec3(1.0),           seg);
  col = mix(col, vec3(0.3,1.0,0.6),   cross);
  gl_FragColor = vec4(col, 1.0);
}
```
</details>

## Memory checks

1. Que représente `h` dans `segmentDistance`, et pourquoi le `clamp(…,0,1)` ?
2. Qu'est-ce qui crée les **bouts arrondis** d'une ligne ?
3. Comment passe-t-on d'une distance à un trait visible d'épaisseur 8px ?
4. Que se passe-t-il si `a == b` ?
5. Comment unir deux segments en une seule forme ?

<details>
<summary>Réponses</summary>

1. La position projetée du pixel le long du segment (0=a, 1=b) ; le `clamp` empêche de
sortir du segment → c'est lui qui arrondit les extrémités. 2. Le `clamp` de `h`. 3. `1.0 -
smoothstep(hw-1, hw+1, d)` avec `hw = 4.0`. 4. La capsule dégénère : on obtient un disque.
5. `max` des deux masques.
</details>

**Pont → M4** : tu sais dessiner UNE forme. Maintenant, comment en faire **mille** (une
grille) **sans aucune boucle** ? La réponse tient en un mot : `fract`.
