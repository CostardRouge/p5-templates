# M7 — Couleur & palettes

> Pré-requis : M0–M6. Notion clé : transformer un scalaire (angle, bruit, temps) en **couleur**,
> avec tes palettes existantes et la formule cosinus universelle.

---

## Le principe

Une palette = une fonction `float → vec3` : tu lui donnes un paramètre (souvent un angle, une
valeur de bruit, une position) et elle renvoie une couleur RGB (0..1). Tu en as déjà plusieurs.

## Tes palettes (`PALETTES_GLSL`)

Ouvre `noiseFieldGpu.js`. Tes palettes construisent chaque canal avec des `sin`/`cos`, façon
roue chromatique, puis divisent par `opacityFactor` (héritage du code p5 en espace 0..255) :

```glsl
vec3 paletteRainbow(float hueOffset, float hueIndex, float opacityFactor) {
  float a = hueOffset + hueIndex;
  float b = hueOffset - hueIndex;
  float red   = (sin(a) * 0.5 + 0.5) * 360.0 / opacityFactor;
  float green = (1.0 - cos(b)) * 0.5 * 360.0 / opacityFactor;
  float blue  = (1.0 - sin(a)) * 0.5 * 360.0 / opacityFactor;
  return clamp(vec3(red, green, blue) / 255.0, 0.0, 1.0);
}
```

Et un sélecteur runtime (comme l'option « palette » de tes sketchs) :

```glsl
vec3 paletteColor(int id, float hueOffset, float hueIndex, float opacityFactor);
// 0 = rainbow, 1 = purple, 2 = darkBlueYellow
```

Idée à retenir : chaque canal est une **onde** (`sin`/`cos`) du paramètre. Décaler les phases
des trois canaux donne tout le spectre.

## La formule universelle : palette cosinus (Inigo Quilez)

Au-delà de tes palettes, mémorise **celle-ci** — elle génère n'importe quel dégradé doux avec 4
vecteurs de contrôle :

```glsl
// t : 0..1   →   couleur
vec3 palette(float t) {
  vec3 a = vec3(0.5, 0.5, 0.5);  // moyenne (offset)
  vec3 b = vec3(0.5, 0.5, 0.5);  // amplitude
  vec3 c = vec3(1.0, 1.0, 1.0);  // fréquence par canal
  vec3 d = vec3(0.00, 0.33, 0.67); // phase par canal
  return a + b * cos(6.28318 * (c * t + d));
}
```

- `a` = couleur moyenne, `b` = contraste, `c` = combien de cycles, `d` = décalage de teinte
  par canal (c'est `d` qui « écarte » R, G, B pour créer l'arc-en-ciel).
- Change `d` pour explorer : `(0.0, 0.1, 0.2)` = chaud, `(0.3, 0.2, 0.2)` = pastel…

## Mélanger deux couleurs

Le plus simple des dégradés, c'est `mix` (M5) :

```glsl
vec3 col = mix(colA, colB, t);   // t de 0..1
```

## Brancher la couleur sur le reste

- Sur le **bruit** (M6) : `vec3 col = palette(fbm(vUv*4.0));`
- Sur l'**angle** d'un flow field : `palette(angle / TAU)`
- Sur le **temps** : `palette(fract(uTime*0.1))` pour un cycle de teinte
- Sur la **distance** (M2) : `palette(length(p)/maxR)` pour un dégradé radial coloré

> Note perceptuelle (bonus) : le mélange linéaire de couleurs en sRGB peut « ternir » au
> milieu. Pour des dégradés très propres, certains travaillent en espace linéaire
> (`pow(col, 2.2)` avant, `pow(col, 1.0/2.2)` après). Optionnel pour tes usages.

---

## Exercices (playground)

- **E1 — Palette cosinus.** Colorie l'écran avec `palette(vUv.x)`. Joue avec `d` pour 3 ambiances.
- **E2 — Champ coloré.** Reprends `fbm` (M6) et colorie-le avec `palette(fbm(...))`.
- **E3 — Flow coloré.** Reprends le flow field E3 du M6 ; colore chaque point selon son angle
  (`palette(angle/TAU)`).
- **E4 — Rainbow de mémoire.** Réécris `paletteRainbow` ; vérifie que des `hueIndex` croissants
  parcourent bien le spectre.
- **E5 — Cycle temporel.** Fais tourner la teinte de tout l'écran avec `uTime`.

<details>
<summary>Corrigés (E1–E2)</summary>

```glsl
precision highp float;
varying vec2 vUv;
uniform float uTime;

vec3 palette(float t){
  vec3 a=vec3(0.5), b=vec3(0.5), c=vec3(1.0), d=vec3(0.0,0.33,0.67);
  return a + b * cos(6.28318 * (c*t + d));
}
float hash(vec2 p){ p=fract(p*vec2(123.34,345.45)); p+=dot(p,p+34.345); return fract(p.x*p.y); }
float valueNoise(vec2 p){
  vec2 i=floor(p), f=fract(p), u=f*f*(3.0-2.0*f);
  float a=hash(i),b=hash(i+vec2(1,0)),c=hash(i+vec2(0,1)),d=hash(i+vec2(1,1));
  return mix(mix(a,b,u.x),mix(c,d,u.x),u.y);
}
float fbm(vec2 p){ float s=0.0,a=0.5; for(int i=0;i<5;i++){s+=a*valueNoise(p);p*=2.0;a*=0.5;} return s; }

void main(){
  float n = fbm(vUv*4.0 + uTime*0.15);
  gl_FragColor = vec4(palette(n + uTime*0.05), 1.0);  // E2 + E5
}
```
</details>

## Memory checks

1. Une palette, c'est une fonction de quel type vers quel type ?
2. Dans la palette cosinus `a + b*cos(TAU*(c*t+d))`, que contrôle `d` ?
3. Comment colorer un point d'un flow field selon sa direction ?
4. Quel outil pour un simple dégradé entre deux couleurs ?
5. Idée commune à toutes tes palettes (rainbow, purple…) ?

<details>
<summary>Réponses</summary>

1. `float → vec3` (scalaire → RGB). 2. La **phase par canal** → l'écart de teinte entre R/G/B.
3. `palette(angle / TAU)`. 4. `mix(colA, colB, t)`. 5. Chaque canal RGB est une onde sin/cos du
paramètre, avec des phases décalées.
</details>

**Pont → M8** : tu sais dessiner et colorer des formes. Quand elles se **superposent** (grilles
denses, calques), il faut maîtriser l'**ordre** et le **blending**.
