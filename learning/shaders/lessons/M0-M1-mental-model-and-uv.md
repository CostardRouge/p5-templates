# M0 + M1 — Le mental model & l'espace du pixel (UV)

> Objectif : acquérir le déclic mental des shaders, et savoir te repérer dans
> l'espace du fragment shader (l'équivalent de `translate`/`scale` en p5).
> Outil : `../playground/index.html` (ouvre-le dans un navigateur).

---

## M0 — Le mental model

### Le déclic

En p5 2D, tu es **impératif** : tu donnes des ordres, dans l'ordre.

```js
translate(width/2, height/2);
fill(255, 0, 0);
circle(0, 0, 200);   // « va là, et dessine un cercle »
```

Un **fragment shader**, c'est l'inverse. Le GPU prend ta fonction `main()` et
l'exécute **une fois pour chaque pixel**, des millions de fois, **toutes en
parallèle**. Ta fonction ne dessine rien : pour le pixel courant, elle doit
**répondre à une seule question** — *« quelle est MA couleur ? »*.

```glsl
void main() {
  gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0); // « moi, pixel, je suis rouge »
}
```

Trois conséquences à graver :

1. **Pas de boucle pour parcourir l'écran.** Le parcours de tous les pixels, c'est
   le GPU qui le fait. Tu écris le corps de boucle, pas la boucle. (C'est aussi
   pourquoi c'est si rapide.)
2. **Pas d'état, pas de mémoire.** Un pixel ne peut PAS lire la couleur du pixel
   voisin, ni savoir ce qui a été « dessiné avant ». Chaque exécution est isolée.
   Ta fonction est **pure** : mêmes entrées → même sortie.
3. **Tu ne dessines pas une forme, tu écris un test.** « Suis-je dans le cercle ? »
   plutôt que « dessine un cercle ». On y revient au M2 — c'est exactement ce que
   fait ton `discMask()`.

### La syntaxe minimale (GLSL ES 1.00, comme ton repo)

Ton repo utilise `gl_FragColor` et `varying` → c'est la version GLSL ES **1.00**.
On apprend celle-là pour que tout se transpose directement.

```glsl
precision highp float;   // obligatoire : précision des float dans le fragment

varying vec2 vUv;        // donnée venue du vertex shader (voir M1)

void main() {
  gl_FragColor = vec4(R, G, B, A);   // la sortie : la couleur du pixel
}
```

- Les couleurs vont de **0.0 à 1.0** (pas 0–255 !). `vec4(1.0, 0.0, 0.0, 1.0)` = rouge opaque.
- Types : `float`, `vec2` (x,y), `vec3` (r,g,b ou x,y,z), `vec4`.
- `1.0` et `1` ne sont **pas** pareils : GLSL est strict, un `float` s'écrit avec un point.
- Swizzle : `v.xy`, `v.rgb`, `v.x`, et `vec3(v.x)` = `vec3(v.x, v.x, v.x)`.

### Lecture de ton code

Ouvre `src/templates/p5/utils/noiseFieldGpu.js`, cherche `VERT_SRC` puis un des
fragments. Tu reconnaîtras `precision highp float;`, des `varying`, et un `main()`
qui finit par écrire une couleur. C'est exactement ce squelette, en plus gros.

---

## M1 — L'espace du pixel (les UV)

Pour répondre « quelle est ma couleur ? », un pixel a besoin de savoir **où il est**.
C'est le rôle de `vUv`.

### Le repère

Le vertex shader (fixe, identique à ton `VERT_SRC`) fournit à chaque pixel une
coordonnée `vUv` :

```
(0,1) ┌───────────┐ (1,1)
      │           │
      │           │      vUv.x : 0 (gauche) → 1 (droite)
      │           │      vUv.y : 0 (bas)    → 1 (haut)
(0,0) └───────────┘ (1,0)
```

⚠️ Différence avec p5 : ici l'origine `(0,0)` est en **bas**-gauche et **y monte**.
En p5 2D, `(0,0)` est en haut-gauche et y descend.

### Premier shader : le dégradé (ton « hello world »)

```glsl
void main() {
  gl_FragColor = vec4(vUv.x, vUv.y, 0.0, 1.0);
}
```

Chaque pixel met du rouge proportionnel à sa position horizontale, du vert à sa
verticale. Tu obtiens le dégradé bicolore classique. C'est le shader par défaut du
playground.

### Recentrer l'origine (≈ `translate(width/2, height/2)`)

Souvent tu veux le `(0,0)` au centre. Deux gestes usuels :

```glsl
vec2 p = vUv - 0.5;        // centre en (0,0), bords à ±0.5
// ou, plage -1..1 :
vec2 p = vUv * 2.0 - 1.0;  // centre en (0,0), bords à ±1
```

### Corriger l'aspect ratio (sinon tes cercles seront des ovales)

`vUv` va de 0 à 1 **dans les deux axes**, même si le canvas est plus large que haut.
Donc une distance « ronde » apparaît ovale. On corrige en étirant x par le ratio :

```glsl
vec2 p = vUv - 0.5;
p.x *= uResolution.x / uResolution.y;  // x à la même échelle que y
```

Retiens ce réflexe : **dès qu'il y a une notion de distance/forme, on corrige l'aspect.**
Ça prépare directement le M2.

### Passer en pixels

Si tu veux raisonner en pixels (comme en p5) plutôt qu'en 0..1 :

```glsl
vec2 pix = vUv * uResolution;   // coordonnée en pixels
```

### Distance & dégradé radial

`length(v)` donne la longueur d'un vecteur (= distance à l'origine). Premier pas vers
les formes :

```glsl
vec2 p = vUv - 0.5;
p.x *= uResolution.x / uResolution.y;
float d = length(p);              // distance au centre
gl_FragColor = vec4(vec3(d), 1.0); // dégradé radial : noir au centre, clair aux bords
```

---

## Exercices (dans le playground)

Fais-les dans l'ordre. Garde tes solutions dans `../solutions/` (un fichier `.frag`
par exo, ex. `m1-e2.frag`).

- **E0 — Couleur fixe.** Affiche un écran entièrement orange. *(But : la sortie est `gl_FragColor`, couleurs 0..1.)*
- **E1 — Dégradés.** Reproduis le dégradé R/G. Puis : un dégradé **horizontal** en niveaux de gris (noir→blanc de gauche à droite). Puis **vertical**. *(But : lire `vUv.x` / `vUv.y`.)*
- **E2 — Dégradé radial centré et rond.** Centre l'origine, corrige l'aspect ratio, affiche `length(p)`. Vérifie que le motif reste **rond** même si tu redimensionnes la fenêtre. *(But : centrage + aspect + `length`.)*
- **E3 — Le pont vers le M2.** Reprends E2 et remplace l'affichage par un **disque dur** : blanc si `d < 0.3`, noir sinon. Indice : `step(0.3, d)` donne 0 ou 1. *(But : transformer une distance en forme — c'est l'idée de la SDF.)*
- **E4 — Bonus animé.** Fais varier le rayon du disque avec `uTime` (ex. `0.3 + 0.1 * sin(uTime)`). *(But : un uniform qui change dans le temps.)*

---

## Memory checks

Réponds **sans regarder** (puis vérifie) :

1. Combien de fois s'exécute `main()` pour une image ?
2. Un pixel peut-il connaître la couleur de son voisin ?
3. Quelle est la plage des valeurs de couleur en GLSL ?
4. En `vUv`, où se trouve l'origine `(0,0)` ? En quoi est-ce différent de p5 ?
5. Pourquoi un cercle basé sur `length(vUv - 0.5)` apparaît-il ovale, et comment corriger ?
6. **Recall** : réécris de mémoire, dans un éditeur vide, le shader complet du dégradé R/G
   (avec `precision`, `varying`, `main`).

<details>
<summary>Réponses</summary>

1. Une fois **par pixel/fragment**, en parallèle.
2. **Non** — pas d'état partagé, exécution isolée.
3. **0.0 à 1.0**.
4. En **bas-gauche**, y monte. En p5 : haut-gauche, y descend.
5. Parce que `vUv` va de 0 à 1 sur les deux axes quel que soit le format ; on
   multiplie `p.x` par `uResolution.x / uResolution.y`.
6. ```glsl
   precision highp float;
   varying vec2 vUv;
   void main() {
     gl_FragColor = vec4(vUv.x, vUv.y, 0.0, 1.0);
   }
   ```
</details>

---

**Quand tu as fait E0→E3 (E4 bonus) et les memory checks**, dis-le moi (ou pousse tes
`.frag` dans `solutions/`). Je corrige, on note la progression dans `PROGRESS.md`, et
on passe au **M2 — la SDF du cercle**, où on disséquera ton `discMask()`.
