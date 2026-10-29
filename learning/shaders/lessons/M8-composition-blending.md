# M8 — Composition, ordre de dessin & blending

> Pré-requis : M0–M7. Notion clé : dans un fragment full-screen il n'y a **pas** d'ordre de
> dessin — tu composes toi-même la couleur finale. Et la gestion du débordement entre cellules.

---

## Il n'y a pas de « dessine par-dessus »

En p5, l'ordre des appels crée la profondeur (ce qui est dessiné après recouvre). Dans un
fragment shader full-screen, **chaque pixel calcule directement sa couleur finale** : pas de
« couche au-dessus ». Tu simules l'empilement avec des `mix` successifs (peintre) :

```glsl
vec3 col = bg;                       // fond
col = mix(col, colA, maskA);         // forme A par-dessus le fond
col = mix(col, colB, maskB);         // forme B par-dessus A
col = mix(col, colC, maskC);         // etc.
```

L'**ordre des `mix`** = l'ordre de dessin. La dernière forme dont le masque vaut 1 gagne.

Opérateurs utiles (rappel M2) :
- **Union** de masques : `max(mA, mB)` · **Intersection** : `min` · **Soustraction** : `mA*(1.0-mB)`
- Bord doux : `smoothstep` · Mélange de couleurs : `mix`

## Le problème du débordement (et `noise-grid-v12`)

Au M4 on a vu : une forme qui **déborde** de sa cellule est coupée, car le pixel voisin
appartient à une autre cellule et ne « voit » pas ce débordement. Pour des points qui se
chevauchent, il faut, depuis le pixel courant, **regarder aussi les cellules voisines** et
prendre en compte leurs formes.

C'est précisément ce que fait `noise-grid-v12-field-on-fire` : un **scan 3×3** autour de la
cellule courante. Le squelette :

```glsl
vec2 g  = vUv * N;
vec2 id = floor(g);
vec3 col = bg;

for (int dy = -1; dy <= 1; dy++) {        // bornes CONSTANTES (WebGL1)
  for (int dx = -1; dx <= 1; dx++) {
    vec2 nid    = id + vec2(float(dx), float(dy));   // cellule voisine
    vec2 center = (nid + 0.5) / N;                   // son centre en UV
    // ... calcule la forme/couleur de CETTE cellule (bruit, angle, rayon)
    // ... position du pixel courant par rapport à ce centre
    float m = /* masque de la forme de la cellule voisine au pixel courant */;
    col = mix(col, cellColor, m);                     // composition (ordre = front/back)
  }
}
gl_FragColor = vec4(col, 1.0);
```

Chaque pixel évalue donc jusqu'à 9 formes et les compose dans l'ordre voulu — ce qui résout
proprement les chevauchements et l'ordre d'empilement. C'est plus de calcul par pixel, mais
toujours massivement parallèle, donc rapide.

## L'alternative : l'instancing (`createInstancedFieldRenderer`)

Ton moteur a **deux** stratégies pour la même famille :

| | Fragment full-screen | Instanced (1 quad/cellule) |
|---|---|---|
| Idée | chaque pixel calcule tout | on dessine N petits quads, blending GPU |
| Ordre / chevauchement | scan voisinage (3×3) à la main | **ordre de dessin** natif + alpha blending |
| Coût | par pixel (×9 si scan) | par cellule (geometry) + overdraw |
| Quand | champs denses, plein écran | formes éparses, gros points qui se chevauchent |

L'instancing **active le blending GPU** (`gl.enable(BLEND)`, `blendFunc`), dessine une instance
par cellule et laisse le pipeline gérer la transparence dans l'ordre d'émission. C'est l'autre
façon, complémentaire, de régler l'ordre/chevauchement — voir `noise-grid-v1/v2/v8`.

> **Alpha blending en bref** : `couleur_finale = src.rgb*src.a + dst.rgb*(1-src.a)` (mode
> « over »). En fragment full-screen tu fais ça à la main avec `mix(dst, src, src_a)`. En
> instanced, le GPU le fait pour toi entre les quads.

## Vignette, fond, post-traitement

Comme tout finit dans une couleur, tu peux ajouter des effets « plein écran » en dernier :
vignette (`col *= smoothstep(1.2, 0.3, length(vUv-0.5))`), grain, teinte globale, etc.

---

## Exercices (playground)

- **E1 — Empilement.** Trois disques de couleurs différentes qui se chevauchent ; change
  l'ordre des `mix` et observe qui passe devant.
- **E2 — Union vs empilement.** Compare `max(mA,mB)` (fusion) et deux `mix` successifs (recouvrement).
- **E3 — Scan 3×3.** Grille de gros points (rayon > taille de cellule) ; d'abord **sans** scan
  (observe les coupures aux bords), puis **avec** le scan 3×3 (débordement propre).
- **E4 — Front/back par le bruit.** Dans le scan, choisis l'ordre de composition selon une
  valeur de bruit par cellule (certaines passent devant).
- **E5 — Vignette.** Ajoute une vignette en post pour finir une compo.

<details>
<summary>Corrigé (E3, scan 3×3 minimal)</summary>

```glsl
precision highp float;
varying vec2 vUv;
uniform vec2 uResolution;

void main(){
  vec2 N = vec2(10.0, 6.0);
  vec2 g = vUv * N, id = floor(g);
  vec3 col = vec3(0.05);
  for (int dy=-1; dy<=1; dy++){
    for (int dx=-1; dx<=1; dx++){
      vec2 nid = id + vec2(float(dx), float(dy));
      vec2 center = (nid + 0.5) / N;        // UV du centre de la cellule voisine
      vec2 d = (vUv - center) * N;          // distance en unités de cellule
      float m = 1.0 - smoothstep(0.55, 0.6, length(d));  // rayon > 0.5 -> déborde
      col = mix(col, vec3(1.0, 0.5, 0.2), m);
    }
  }
  gl_FragColor = vec4(col, 1.0);
}
```
</details>

## Memory checks

1. Pourquoi n'y a-t-il pas d'« ordre de dessin » dans un fragment full-screen ?
2. Comment simules-tu l'empilement « peintre » ?
3. Pourquoi `noise-grid-v12` scanne-t-il un voisinage 3×3 ?
4. Les deux stratégies de ton moteur pour gérer chevauchement/ordre ?
5. Formule du blending « over » ?

<details>
<summary>Réponses</summary>

1. Chaque pixel calcule directement sa couleur finale, isolément ; rien n'est « au-dessus ».
2. Des `mix(col, forme, masque)` successifs ; l'ordre des `mix` = l'ordre d'empilement. 3. Pour
que les formes qui débordent d'une cellule soient vues par les pixels des cellules voisines
(sinon coupures). 4. Fragment full-screen avec scan 3×3 **ou** instancing + alpha blending GPU.
5. `src.rgb*src.a + dst.rgb*(1 - src.a)`.
</details>

**Pont → M9** : fin de la piste 2D (fragment). On passe à la 3D : le **vertex shader** et les
**matrices**, avec ton `peaks-cone`.
