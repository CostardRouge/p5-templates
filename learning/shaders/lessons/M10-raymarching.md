# M10 — Raymarching (3D par distance) — avancé, optionnel

> Pré-requis : M2 (SDF) surtout, + M5–M7. Notion clé : faire de la **vraie 3D dans un fragment
> shader**, sans aucune géométrie, en prolongeant tes SDF 2D en 3D. **Ça tourne dans le playground.**

---

## L'idée

Au M2, une forme 2D = une fonction de distance `length(p) - r`. En **3D**, c'est pareil mais
`p` est un `vec3`. Pour afficher ça, on ne dessine pas de triangles : pour chaque pixel, on
lance un **rayon** depuis la caméra et on **avance** le long du rayon jusqu'à toucher la surface.

L'astuce (« sphere tracing ») : la SDF donne la **distance à la surface la plus proche** = la
distance qu'on peut avancer **sans rien traverser**. On marche donc par bonds sûrs jusqu'à
frôler la surface (distance ≈ 0).

## Les SDF 3D de base

```glsl
float sdSphere(vec3 p, float r) { return length(p) - r; }
float sdBox(vec3 p, vec3 b)     { vec3 q = abs(p) - b; return length(max(q,0.0)) + min(max(q.x,max(q.y,q.z)),0.0); }
float sdTorus(vec3 p, vec2 t)   { vec2 q = vec2(length(p.xz) - t.x, p.y); return length(q) - t.y; }
```

Combinaisons (comme au M2, mais en **distances signées** : union = `min`) :
- Union : `min(a, b)` · Intersection : `max(a, b)` · Soustraction : `max(a, -b)`
- **Union douce** (fusion organique, très « toi ») :
  ```glsl
  float smin(float a, float b, float k){ float h = clamp(0.5 + 0.5*(b-a)/k, 0.0, 1.0); return mix(b, a, h) - k*h*(1.0-h); }
  ```

## La scène = une seule fonction `map`

Tout ton monde 3D tient dans une fonction qui renvoie la distance au plus proche :

```glsl
float map(vec3 p) {
  float s = sdSphere(p - vec3(0.0), 1.0);
  // répétition de domaine en 3D (le M4 en 3D !) : des sphères à l'infini, gratuitement
  // vec3 q = mod(p + 2.0, 4.0) - 2.0;  float s = sdSphere(q, 1.0);
  return s;
}
```

## La boucle de marche + l'éclairage

```glsl
vec3 calcNormal(vec3 p){               // normale = gradient de la SDF
  vec2 e = vec2(0.001, 0.0);
  return normalize(vec3(
    map(p+e.xyy)-map(p-e.xyy),
    map(p+e.yxy)-map(p-e.yxy),
    map(p+e.yyx)-map(p-e.yyx)));
}

void main(){
  vec2 uv = (vUv - 0.5);
  uv.x *= uResolution.x / uResolution.y;        // aspect (M1)

  vec3 ro = vec3(0.0, 0.0, 3.0);                 // origine du rayon (caméra)
  vec3 rd = normalize(vec3(uv, -1.5));           // direction du rayon

  float t = 0.0;                                  // distance parcourue
  float hit = -1.0;
  for (int i = 0; i < 80; i++) {                  // borne CONSTANTE (WebGL1)
    vec3 p = ro + rd * t;
    float d = map(p);                             // distance sûre
    if (d < 0.001) { hit = t; break; }            // touché
    if (t > 20.0) break;                          // trop loin → ciel
    t += d;                                        // on avance du bond sûr
  }

  vec3 col = vec3(0.04);                           // fond
  if (hit > 0.0) {
    vec3 p = ro + rd * hit;
    vec3 n = calcNormal(p);
    vec3 lightDir = normalize(vec3(0.6, 0.7, 0.4));
    float diff = max(dot(n, lightDir), 0.0);       // éclairage diffus (Lambert)
    col = vec3(0.2, 0.5, 1.0) * (0.2 + diff);      // ambiant + diffus
  }
  gl_FragColor = vec4(col, 1.0);
}
```

Colle-le dans le playground (avec les `sdSphere`/`calcNormal`/`map` au-dessus de `main`) : tu as
une sphère 3D éclairée, **sans une seule triangle**. C'est la suite directe de tes SDF du M2.

## Pourquoi ça t'intéresse

- **Formes organiques** (fusion `smin`, déformations par bruit) bien plus souples qu'avec des maillages.
- **Répétition infinie** quasi gratuite (`mod` en 3D = M4 en 3D).
- Tout le coût est par pixel → idéal pour tes rendus plein écran et temps réel.
- Contrepartie : ça peut devenir lourd (beaucoup de pas de marche, AO/ombres) → à doser.

---

## Exercices (playground)

- **E1 — Sphère.** Fais tourner le template ci-dessus. Bouge la caméra (`ro`) et la lumière.
- **E2 — Deux formes.** Ajoute un `sdBox`/`sdTorus` ; combine avec `min`, puis avec `smin` (compare).
- **E3 — Animation.** Anime la position d'une sphère avec `uTime` (sin/cos) ; elle fusionne avec
  une autre via `smin` → effet « blob ».
- **E4 — Répétition 3D.** Active la ligne `mod` dans `map` → un champ infini de sphères. Fais
  défiler avec `uTime` (`p.z += uTime`).
- **E5 — Couleur.** Colore selon la normale (`col = n*0.5+0.5`) ou via une `palette()` (M7) sur
  la distance/hauteur.
- **E6 — Souris-caméra.** Fais tourner la scène avec `uMouse` (rotation de `ro`/`rd` autour de Y).

<details>
<summary>Indice E2 (smin) & E4 (répétition)</summary>

```glsl
float map(vec3 p){
  vec3 q = mod(p + 2.0, 4.0) - 2.0;     // E4 : répétition de domaine
  float s = sdSphere(q, 0.7);
  float b = sdBox(p - vec3(0.0, sin(uTime), 0.0), vec3(0.6));
  return smin(s, b, 0.5);               // E2 : fusion douce
}
```
</details>

## Memory checks

1. Pourquoi peut-on « avancer de la distance renvoyée par la SDF » sans rien traverser ?
2. Comment obtient-on la **normale** d'une surface définie par une SDF ?
3. Union de deux SDF (distances signées) : `min` ou `max` ? Et au M2 (couvertures) ?
4. Comment crée-t-on une **infinité** de copies sans boucle/géométrie ?
5. Avantage clé du raymarching pour des formes organiques ?

<details>
<summary>Réponses</summary>

1. Parce que la SDF donne la distance à la surface **la plus proche** : c'est la marge sûre. 2.
Par le **gradient** de la SDF (différences finies sur x,y,z). 3. Ici `min` (distances) ; au M2
c'était `max` (couvertures) — attention à la convention. 4. Répétition de domaine en 3D :
`mod(p, taille)` (le M4 en 3D). 5. Fusion douce (`smin`) et déformations continues, impossibles/
coûteuses avec des maillages.
</details>

---

🎓 **Fin du parcours.** Tu as les briques : pixel→couleur (M0–M1), formes par SDF (M2–M3),
répétition sans boucle (M4), animation (M5), bruit (M6), couleur (M7), composition (M8), 3D par
géométrie (M9) et 3D par distance (M10). Le pas suivant : **démarrer un sketch neuf
directement en shader** — reprends un de tes sketchs 2D/3D et reconstruis-le brique par brique.
