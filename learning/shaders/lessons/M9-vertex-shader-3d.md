# M9 — Vertex shader & matrices (3D, `peaks-cone`)

> Pré-requis : M0–M8. Notion clé : jusqu'ici le vertex shader était figé (un quad). Pour la
> 3D, c'est **lui** qui place la géométrie. Tes sphères/cônes/peaks vivent ici.

> ⚠️ Le playground est **fragment-only** (un quad plein écran). M9 est surtout une leçon de
> **lecture/compréhension** + des exercices papier. Un mini-template p5 est fourni en bas pour
> expérimenter quand tu auras internet.

---

## Les deux étages du pipeline

1. **Vertex shader** : s'exécute une fois **par sommet**. Son job : produire `gl_Position`, la
   position du sommet à l'écran (en clip space). C'est là qu'on applique les transformations 3D.
2. **Fragment shader** : une fois **par pixel** (ce que tu connais). Il colore.

Entre les deux, les `varying` interpolent des valeurs (couleur, normale, UV) du sommet vers le pixel.

## Les matrices : l'équivalent de `translate/rotate/scale`

En p5 3D tu fais `translate()`, `rotateY()`, `scale()`, puis `sphere()`. Sous le capot, ces
opérations sont des **matrices 4×4** (`mat4`) que le GPU multiplie au sommet :

```glsl
gl_Position = uP * uMV * vec4(position, 1.0);
```

- `uMV` (**model-view**) : place l'objet dans le monde **et** par rapport à la caméra
  (= tes `translate`/`rotate`/`scale` cumulés).
- `uP` (**projection**) : applique la perspective (objets lointains plus petits).
- L'ordre se lit **de droite à gauche** : le sommet est d'abord transformé par `uMV`, puis projeté par `uP`.
- `vec4(pos, 1.0)` : le `1.0` (coordonnée homogène `w`) permet à la matrice d'encoder une
  **translation** (avec `0.0`, ce serait une direction, non translatée).

## Lecture : ton `peaks-cone`

Ouvre `src/templates/p5/sketches/peaks/peaks-cone/index.js`. Le vertex shader **construit
chaque cône sur le GPU** à partir d'un cercle unité, puis le pose sur la sphère :

```glsl
attribute vec2 aUnit;   // (theta, layer_t) : par sommet du cône unité
attribute vec4 aPos;    // (x,y,z, longueur) : par instance (un spike)
attribute vec4 aNrm;    // normale (direction du spike) : par instance
attribute vec4 aCol;    // couleur : par instance

uniform mat4 uMV, uP;
uniform float uProfile, uTaper, uTwist, uPtBase, uPtTip;
varying vec4 vCol;

void main() {
  float theta  = aUnit.x;             // angle autour de l'axe du cône
  float layerT = aUnit.y;             // 0 = base, 1 = pointe
  vec3  pos    = aPos.xyz;            // position du spike sur la sphère
  float slen   = aPos.w;             // longueur du spike
  vec3  normal = normalize(aNrm.xyz); // axe du spike

  float h   = (1.0 - layerT) * slen;            // hauteur le long de l'axe
  float rad = profileRadius(layerT) * slen * uTaper; // rayon (selon le profil)
  float tw  = theta + uTwist * h;               // torsion (effet ADN)

  // repère local autour de la normale : (tan, bitan) ⟂ normal
  vec3 up    = abs(normal.y) < 0.9 ? vec3(0,1,0) : vec3(1,0,0);
  vec3 tan   = normalize(cross(normal, up));
  vec3 bitan = cross(normal, tan);

  // point 3D final = base + le long de l'axe + autour de l'axe
  vec3 wp = pos + normal*h + tan*cos(tw)*rad + bitan*sin(tw)*rad;

  gl_Position  = uP * uMV * vec4(wp, 1.0);
  gl_PointSize = mix(uPtTip, uPtBase, layerT);
  vCol         = aCol;
}
```

À comprendre :
- **Cône paramétrique** : un point du cône = `centre + axe*h + (autour de l'axe)*rayon`. Le
  « autour » se fait avec deux vecteurs perpendiculaires (`tan`, `bitan`) et `cos/sin(theta)`.
- **`profileRadius(layerT)`** mélange 4 profils (cône, goutte, tube, bulbe) selon `uProfile` —
  c'est ton morphing, fait **sur le GPU**.
- **`cross(normal, up)`** construit un repère orienté le long de chaque spike (base orthonormée).
- Le fragment shader est trivial : `gl_FragColor = vCol;` (il ne fait que ressortir la couleur interpolée).

## L'instancing (le « pour tous les spikes d'un coup »)

C'est la version 3D du M4 : au lieu d'une boucle CPU « pour chaque spike, push/sphere/pop », on
dessine **une seule géométrie de base** (le cône unité, `aUnit`) répétée N fois, chaque copie
recevant ses propres **données par instance** (`aPos`, `aNrm`, `aCol`) :

- `aUnit` : attribut **par sommet** (divisor 0) — la forme du cône, partagée.
- `aPos/aNrm/aCol` : attributs **par instance** (divisor 1) — un jeu par spike.
- Un seul `drawArraysInstanced(...)` dessine tous les spikes. Voir `gl.vertexAttribDivisor`.

C'est la même idée que « grille sans boucle » : on décrit **un** élément + **les données qui
changent**, et le GPU multiplie.

## Le passage mental depuis p5 3D

| p5 3D | Vertex shader |
|---|---|
| `translate/rotate/scale` | matrice `uMV` |
| perspective de la caméra | matrice `uP` |
| `sphere()`, `cone()` | géométrie construite/fournie en `attribute` |
| boucle `for` + `push/pop` | **instancing** (attributs par instance) |
| `fill(c)` | `varying` couleur vers le fragment |

---

## Exercices

Surtout **papier/lecture** (le playground ne fait pas de 3D) :

- **E1 — Lis `gl_Position`.** Explique avec tes mots ce que `uP * uMV * vec4(wp,1.0)` calcule,
  et pourquoi de droite à gauche.
- **E2 — Le `1.0`.** Pourquoi `vec4(wp, 1.0)` et pas `0.0` ? Qu'est-ce que ça change pour la translation ?
- **E3 — Repère local.** Pourquoi a-t-on besoin de `tan` et `bitan` perpendiculaires à `normal` ?
- **E4 — Données d'instance.** Liste ce qui est « par sommet » vs « par instance » dans `peaks-cone`, et pourquoi.
- **E5 — Nouveau profil.** Écris une expression `profileRadius` pour un profil « sablier »
  (fin au milieu, large aux bouts). Indice : l'inverse du `bulge` `4t(1-t)`.
- **E6 (avec internet) — Mini p5.** Avec le template ci-dessous, fais tourner un cube/sphère et
  déplace ses sommets avec du bruit dans le vertex shader.

<details>
<summary>Mini-template p5 (createShader) — pour quand tu auras internet</summary>

```js
// p5 (WEBGL). Vertex shader qui déforme une sphère ; fragment trivial.
let prog;
const VERT = `
precision highp float;
attribute vec3 aPosition;
uniform mat4 uModelViewMatrix;   // p5 fournit ces uniforms automatiquement
uniform mat4 uProjectionMatrix;
uniform float uTime;
varying float vH;
void main(){
  vec3 p = aPosition;
  float bump = sin(p.x*4.0 + uTime) * cos(p.y*4.0 + uTime) * 0.15;
  p += normalize(aPosition) * bump;   // pousse le sommet le long de sa normale
  vH = bump;
  gl_Position = uProjectionMatrix * uModelViewMatrix * vec4(p, 1.0);
}`;
const FRAG = `
precision highp float;
varying float vH;
void main(){ gl_FragColor = vec4(0.5 + vH*2.0, 0.6, 1.0 - vH*2.0, 1.0); }`;

function setup(){ createCanvas(600,600, WEBGL); prog = createShader(VERT, FRAG); }
function draw(){
  background(10);
  shader(prog);
  prog.setUniform('uTime', millis()/1000);
  rotateY(millis()/2000);
  noStroke();
  sphere(150, 64, 64);   // p5 fournit aPosition + les matrices au shader
}
```
</details>

## Memory checks

1. Que produit le vertex shader, et à quelle fréquence s'exécute-t-il ?
2. Rôles de `uMV` et `uP` ?
3. Pourquoi lit-on `uP * uMV * v` de droite à gauche ?
4. À quoi sert le `1.0` dans `vec4(pos, 1.0)` ?
5. Différence « par sommet » vs « par instance » dans l'instancing ?

<details>
<summary>Réponses</summary>

1. La position écran (`gl_Position`) de chaque sommet ; une fois **par sommet**. 2. `uMV` = modèle
+ caméra (translate/rotate/scale) ; `uP` = projection/perspective. 3. Le sommet est transformé
par `uMV` d'abord (le plus à droite), puis projeté par `uP`. 4. La coordonnée homogène `w=1`
permet d'encoder une **translation** dans la matrice. 5. « Par sommet » = la géométrie de base
partagée (divisor 0) ; « par instance » = les données propres à chaque copie (divisor 1).
</details>

**Pont → M10** : tu sais faire de la 3D **par géométrie** (sommets + matrices). Le M10 montre
l'autre voie — la 3D **par distance** (raymarching) — qui prolonge directement tes SDF du M2…
et qui, elle, tourne dans le playground.
