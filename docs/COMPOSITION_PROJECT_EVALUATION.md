# Évaluation — passer d'une orientation « template » à une orientation « création / composition »

> Statut : document d'évaluation, aucune implémentation associée.
> Question posée : faut-il faire évoluer l'app (galerie → choisir un template → régler → exporter)
> vers un modèle « projet de création » où l'on part d'un projet vierge et où l'on injecte des
> sketchs depuis un catalogue/tiroir — avec, à terme, interactions entre sketchs, passage de
> paramètres et système de calques ?

---

## TL;DR

**Oui, ça vaut le coup — mais comme une couche au-dessus de l'existant, pas comme un remplacement.**

1. Le modèle « template » reste le bon point d'entrée (découverte, simplicité, time-to-export
   court). Il ne faut pas le casser.
2. L'architecture actuelle est **déjà à ~70 % une architecture de composition** : les slides sont
   des scènes, les `content items` sont des mini-calques, les settings de sketch sont déjà
   per-slide, et le pipeline d'enregistrement boucle déjà sur une séquence. Le saut conceptuel
   manquant est petit : **autoriser chaque slide/scène à référencer un sketch différent**.
3. Le vrai verrou technique n'est pas p5 (les sketchs tournent déjà en instance mode) mais le
   **store global unique `globalThis.sketchOptions`** et le cycle de vie « un seul engine actif ».
4. La cible réaliste à moyen terme est la **composition séquentielle** (scènes enchaînées,
   concaténées à l'export). Les calques simultanés et le passage de paramètres entre sketchs
   sont faisables mais constituent une phase ultérieure distincte, à ne lancer que si la
   phase séquentielle prouve son usage.

---

## 1. État des lieux (ce que le code permet déjà)

| Mécanisme existant | Fichiers clés | Ce que ça donne pour la composition |
|---|---|---|
| Registre de sketchs auto-généré + imports dynamiques | `src/generated/sketchModuleRegistry.ts`, `src/templates/metadata.json` | Le « catalogue » existe déjà côté données : on sait lister, décrire et charger n'importe quel sketch à la demande |
| Slides avec overrides par slide (size, animation, content, **sketch settings**) | `src/types/sketch.types.ts`, `docs/PER_SLIDE_SKETCH_SETTINGS.md` | Une slide est déjà une « scène » paramétrée indépendamment — il manque seulement `slide.template` |
| Items de contenu (`text`, `image`, `images-stack`, `visual`, `qrcode`…) en union discriminée, ajout/suppression/réordonnancement | `src/types/sketch.types.ts`, `ContentItems/` | C'est déjà une UX de tiroir/palette : « Add item » est le prototype exact du futur « Add sketch » |
| Enregistrement qui itère sur les slides et produit une vidéo par slide | `src/lib/recordSketch.ts`, `src/lib/progression/stepConfig.ts` | La boucle d'export séquentiel existe ; il manque la concaténation et le changement de sketch entre itérations |
| Engines abstraits et interchangeables (p5, GSAP) derrière `SketchEngine` | `src/engines/engineCatalog.ts`, `src/engines/p5/P5Engine.ts` | L'abstraction nécessaire pour orchestrer « quel moteur pour quelle scène » est déjà en place |
| p5 en instance mode, un canvas par conteneur | `src/engines/p5/P5Engine.ts` | Plusieurs sketchs peuvent cohabiter dans le DOM sans collision — prérequis des calques |
| Persistance Template / TemplateSnapshot / Job | `prisma/schema.prisma` | Le modèle « snapshot immuable au moment de l'export » se généralise naturellement à un projet |

### Les deux verrous réels

1. **`globalThis.sketchOptions` est un singleton** (`src/templates/p5/shared/syncSketchOptions.js`,
   `src/lib/syncSketchOptions.ts`). Tous les sketchs p5 lisent le même store via un proxy.
   Deux sketchs montés en même temps se marcheraient dessus. C'est le refactor central :
   namespacer le store par instance (`sketchOptions[sceneId]`) ou passer les options à la
   construction de l'instance. Notons que le proxy per-slide existant
   (`options.sketch` → merge global + slide courante) montre que ce genre d'indirection est
   déjà accepté par les sketchs sans modification de leur code.
2. **Le cycle de vie UI ne gère qu'un engine + un sketch actif à la fois** (contexte
   `SketchContext`, page `/templates/[engine]/[...sketch]`). Pour la composition séquentielle,
   ce n'est pas bloquant (une seule scène active à l'édition, comme aujourd'hui une seule
   slide). Ça ne devient un vrai chantier que pour les calques simultanés.

---

## 2. Ce que serait le modèle « création »

### Modèle de données (extension naturelle, pas une refonte)

```
Project
├── id, name, size (presets multi-ratios déjà au TODO), audio? (plus tard)
└── scenes: Scene[]            ← généralisation de slides: SlideOption[]
    ├── template: "p5/noise-strips/noise-strips-v1"   ← LE champ nouveau
    ├── engine: "p5" | "gsap"
    ├── duration, transition? (cut au début, fondu plus tard)
    ├── sketch: {...}          ← options du sketch (existe déjà per-slide)
    └── content: ContentItem[] ← existe déjà
```

Côté Prisma : une table `Project` (ou un `Template` avec `kind: "composition"`), et le
mécanisme `TemplateSnapshot` → `Job` inchangé. Une scène est sérialisable exactement comme
les options actuelles, donc import/export JSON, clonage et partage fonctionnent gratuitement.

### Expérience utilisateur cible

```
┌────────────────────────────────────────────────────────────────┐
│  Mon projet « Promo juin »                        [Exporter ▶] │
├──────────┬────────────────────────────────┬────────────────────┤
│ CATALOGUE│        VIEWPORT                │  OPTIONS DE LA     │
│ (tiroir) │   scène active rendue          │  SCÈNE ACTIVE      │
│          │   (un seul sketch monté,       │                    │
│ [recherche]  comme aujourd'hui)           │  formulaire généré │
│ ▸ noise  │                                │  depuis options.ts │
│ ▸ photo  │                                │  du sketch choisi  │
│ ▸ video  │                                │  (existant)        │
│ ▸ text   │                                │                    │
│  (drag → │                                │                    │
│   drop)  │                                │                    │
├──────────┴────────────────────────────────┴────────────────────┤
│ TIMELINE / SÉQUENCE (carrousel de slides revampé)               │
│ ┌────────┐ ┌────────┐ ┌────────┐ ┌ + ┐                          │
│ │scène 1 │ │scène 2 │ │scène 3 │ │add│   ← thumbnails statiques,│
│ │noise   │ │photo   │ │video   │ └───┘     drag pour réordonner │
│ └────────┘ └────────┘ └────────┘           (@dnd-kit déjà inclus)│
└─────────────────────────────────────────────────────────────────┘
```

Points d'appui concrets :

- Le **tiroir/catalogue** est la `TemplatesList` actuelle re-présentée en panneau latéral
  avec drag-and-drop (`@dnd-kit` est déjà une dépendance, utilisée pour les items).
- La **timeline** est exactement le « Revamp slide carousel » déjà inscrit au TODO
  (slide active grande, autres en thumbnails statiques) — la composition donne enfin une
  raison forte de faire ce chantier, et le « Lazy slide rendering » du TODO devient un
  prérequis naturel (une seule scène montée à la fois → pas de problème de perf ni de
  collision de store à l'édition).
- Le **panneau d'options** ne change pas : il se re-génère depuis l'`options.ts` du sketch
  de la scène sélectionnée, comme aujourd'hui quand on change de page.
- **L'export** : la boucle de `recordSketch.ts` itère déjà slide par slide en produisant
  `videoUrls[]`. Pour un projet : itérer scène par scène (en remontant le bon sketch entre
  deux scènes, ce que fait déjà Playwright en changeant d'URL/params) puis **concaténer**
  les segments (ffmpeg concat côté worker, ou Mediabunny déjà présent). C'est l'étape
  backend la plus simple du chantier.

---

## 3. Est-ce que ça vaut le coup ?

### Avantages du modèle template (à conserver)

- **Time-to-résultat imbattable** : 3 clics → export. C'est la force actuelle du produit,
  notamment pour l'usage « social media » et les automatisations (N8n au TODO : un webhook
  cible un template + options, c'est simple et ça doit le rester).
- **Périmètre de test et de maintenance borné** : un sketch = un module isolé, pas de
  matrice d'interactions à valider.
- **Galerie = découvrabilité** : on voit ce que l'outil sait faire.

### Ce que le modèle création apporte

- **Pour vous (créateur)** : c'est l'alignement avec l'ambition affichée du projet —
  compiler des idées d'animation différentes en une seule pièce. Aujourd'hui le workaround
  (ouvrir N pages d'édition, exporter N vidéos, monter ailleurs) externalise la partie la
  plus intéressante du travail vers un logiciel de montage. La composition séquentielle
  rapatrie ça dans l'outil, avec la reproductibilité frame-perfect du pipeline headless que
  ni CapCut ni Premiere ne donnent sur du génératif.
- **Pour les utilisateurs** : le passage de « consommateur de templates » à « auteur de
  séquences » est le même saut que Canva (template unique → document multi-pages) ou
  CapCut (filtre → timeline). C'est la différence entre un gadget qu'on essaie et un outil
  dans lequel on revient. Combiné au multi-user du TODO, c'est la brique qui justifierait
  des comptes, des projets sauvegardés, et à terme un modèle freemium (X scènes/projets
  gratuits, export long payant, etc.).
- **Effet de levier sur l'existant** : chaque nouveau sketch ajouté au catalogue multiplie
  la valeur de tous les autres (combinatoire), au lieu de s'y additionner. C'est l'argument
  économique le plus fort en faveur de la composition.
- **Opportunités latérales** : batch recordings et multi-ratios (déjà au TODO) deviennent
  des propriétés du projet ; le « P5 → backend data push » du TODO préfigure le bus de
  paramètres entre scènes ; un projet partageable en readonly est un portfolio.

### Coûts et risques

- **Complexité UI** : un éditeur de projet est un produit en soi. Risque principal :
  l'effet « usine à gaz » qui dégrade l'expérience template actuelle. Mitigation : deux
  entrées distinctes (« Templates » inchangé, « Créations » nouveau), et « Ouvrir dans une
  création » depuis n'importe quel template comme pont entre les deux.
- **Le refactor du store d'options** est le passage obligé. Tant qu'une seule scène est
  montée à la fois (édition + export séquentiel), il reste contenu : on remplace le
  singleton par un store par montage. Le coût explose seulement avec les calques simultanés.
- **Hétérogénéité des sketchs** : les anciens sketchs non migrés (« Migrate old sketches »
  au TODO) et les différences de conventions (`getImages`, assets, durées) deviennent
  visibles dès qu'on enchaîne des scènes. La composition force une hygiène de contrat de
  sketch — c'est un coût, mais c'est aussi exactement ce que les tâches « Sketch code
  utils » et « Pending promises / asset loading system » du TODO visent déjà.
- **Calques et interactions entre sketchs (l'ambition long terme)** : techniquement
  réalisable — chaque sketch p5 rend dans un `p5.Graphics` offscreen, un compositeur les
  empile avec blend modes ; le passage de paramètres est un event bus que `syncSketchOptions`
  préfigure déjà. Mais cela exige un vrai contrat de sketch (rendre dans un buffer fourni,
  déclarer entrées/sorties), donc une migration de tous les sketchs, et la charge CPU/GPU de
  N draw loops simultanées. À traiter comme un projet séparé, déclenché par l'usage réel de
  la phase séquentielle — pas avant.

### Verdict

L'orientation template et l'orientation création ne sont pas concurrentes : la première est
le **catalogue**, la seconde est le **document**. Le risque n'est pas de faire la composition,
c'est de la faire en visant directement les calques/interactions. En visant d'abord la
**séquence de scènes**, on obtient 80 % de la valeur (combiner ses sketchs en une création
exportée d'un coup) pour ~20 % de l'effort, en réutilisant slides, items, snapshots, carrousel
et boucle d'enregistrement existants.

---

## 4. Trajectoire proposée (incrémentale, chaque étape utile seule)

**Phase 0 — Playlist d'export (quick win, aucun refactor).**
Sélectionner plusieurs drafts/templates existants et lancer un export groupé concaténé en une
vidéo (= « Batch recordings » du TODO + étape ffmpeg/Mediabunny concat dans le worker).
Aucune nouvelle UI d'édition : ça valide l'appétit pour la combinaison avec un coût minimal,
et la brique de concaténation servira telle quelle à la phase 1.

**Phase 1 — Scènes multi-sketchs (le cœur).**
Ajouter `template`/`engine` au niveau de la scène (extension du schéma de slide), démonter/
remonter l'engine au changement de scène active (le mécanisme existe : c'est ce que fait la
navigation entre pages), adapter la boucle d'enregistrement pour recharger le bon sketch
entre segments, concaténer. Prérequis embarqués : lazy slide rendering et revamp du carrousel
(déjà au TODO). Livrable : page `/creations/:id` avec timeline + panneau d'options existant.

**Phase 2 — Le tiroir/catalogue et le confort d'édition.**
Panneau latéral de sketchs (réutilise `TemplatesList` + metadata + thumbnails), drag-and-drop
vers la timeline, durées par scène, transitions simples (cut, fondu via opacité à l'encodage),
« Ouvrir dans une création » depuis la galerie, projets en DB avec snapshots.

**Phase 3 — Composition simultanée (exploratoire, conditionnée à l'usage des phases 1-2).**
Refactor du store d'options en stores par instance, contrat de sketch « rend dans un buffer »,
compositeur de calques (`p5.Graphics` + blend modes), puis bus de paramètres entre scènes
(sorties d'un sketch → entrées d'un autre), dans la lignée du « P5 → backend data push » du TODO.

---

## 5. Décisions à prendre avant la phase 1

- **Projet = nouveau modèle ou généralisation des slides ?** Recommandation : généraliser le
  schéma de slide (ajout de `template`) plutôt que créer un système parallèle — sinon deux
  systèmes de séquence coexisteront.
- **Mixage d'engines dans un même projet (p5 + GSAP)** : oui en séquentiel (chaque scène monte
  son engine), à exclure en simultané pour longtemps.
- **Où vivent les assets d'un projet** : par projet plutôt que par scène, pour éviter de
  reproduire le bug connu « clone — assets not copied ».
- **Compat N8n/API** : un projet doit rester déclenchable par un seul appel (snapshot de
  projet → job), pour ne pas perdre l'axe automatisation.
