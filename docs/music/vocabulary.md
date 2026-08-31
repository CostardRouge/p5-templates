# Vocabulary — the seven axes

Every term with its French equivalent, a one-line definition, the field of
`src/types/music.types.ts` that carries it, and what it can mean visually. The last
column is not decoration: it is where this becomes a motion-design tool rather than a
glossary.

Terms the model does not carry yet are marked *(not modelled)* — they are here because
you need the word, not because the schema has a slot for it.

---

## 1. Time and grid — *le temps et la grille*

Where things happen. This axis is the one everything else is measured against.

| Term | FR | What it is | In the model | Visually |
| --- | --- | --- | --- | --- |
| Pulse | pulsation | The steady beat you tap along to | Derived from `TempoMark.bpm` | The metronome every animation can lock to |
| Tempo (BPM) | tempo | How fast the pulse runs, in beats per minute | `TempoMark.bpm` | A global speed multiplier |
| Time signature | métrique, chiffrage | How many beats a bar holds and which note value gets one | `MeterMark.signature` | How many steps a cycle divides into |
| Bar / measure | mesure | One group of beats — the unit everything is counted in | `MusicalTime.bar` | The natural loop length of a sketch |
| Beat | temps | One pulse inside the bar | `MusicalTime.beat` | The frame a movement should land on |
| Subdivision | subdivision (croche, triolet) | Dividing a beat into smaller equal parts | `MusicalTime.tick` (960 per beat) | Sub-frame accuracy for fast events |
| Downbeat | temps fort | Beat 1 — the strongest position in the bar | `beat === 1` | The anchor; a shape that resets here reads as "in time" |
| Backbeat | contretemps marqué (2 et 4) | Accents on beats 2 and 4; the spine of most pop and rock | `Marker` `"hit"`, or `Articulation` `"accent"` | The alternating pulse a viewer feels as *groove* |
| Offbeat | contretemps | Between the beats rather than on them | A `tick` offset of half a beat | Motion that lands late on purpose — the difference between stiff and alive |
| Syncopation | syncope | An accent where the grid does not expect one | `Motif.rhythm` onsets, `Marker` `"hit"` | A visual accent off the obvious frame |
| Anacrusis / pickup | anacrouse, levée | Notes before the first downbeat that lean into it | `PhraseRole` `"anacrusis"`, `bar: 0` | A wind-up before the movement proper |
| Swing | swing | Offbeats delayed so pairs of notes become long–short | `Feel` `"swing8"` / `"swing16"` | Easing rather than linear interpolation between beats |
| Shuffle | shuffle | Triplet-based swing, heavier than swing | `Feel` `"shuffle"` | A stronger, more lopsided ease |
| Groove | groove | The composite feel of the rhythm section | `Feel` + `LayerActivity.density` | The overall "how it moves" of a scene |
| Polyrhythm | polyrythmie | Two grids at once, e.g. 3 against 4 | Two layers with different `Motif.rhythm` | Two elements cycling at rates that realign rarely |
| Hemiola | hémiole | Three in the space of two — a temporary regrouping | `Motif.rhythm` | A brief change of visual cadence without a tempo change |
| Rubato | rubato | Deliberately elastic tempo, pushed and pulled | `Feel` `"rubato"`, `TempoMark.curve` `"linear"` | Time itself easing, not just the object |
| Half-time / double-time | demi-temps / double temps | Same tempo, backbeat felt twice as slow or fast | `Feel` `"halfTime"` / `"doubleTime"` | The same clock read at half or double the rate |
| Accelerando / ritardando | accelerando / ritardando | Speeding up / slowing down gradually | `TempoMark.curve: "linear"` | A ramp applied to the master clock |

---

## 2. Pitch and harmony — *la hauteur et l'harmonie*

Which notes, and how their combination creates the pull towards resolution. In this
model, harmony is an **optional annotation** — you can describe a whole piece without it.

| Term | FR | What it is | In the model | Visually |
| --- | --- | --- | --- | --- |
| Note | note | A pitch with a duration | *(not modelled — generative layer)* | — |
| Interval | intervalle | The distance between two pitches | `ContourStep` `"leapUp"` / `"leapDown"` | Size of a jump |
| Scale | gamme | The ordered set of pitches a passage draws from | `KeyMark.mode` | The palette a scene is allowed |
| Mode | mode | A scale's character: dorian, phrygian, lydian… | `Mode` | Colour temperament — lydian bright, phrygian dark |
| Key | tonalité | The pitch everything resolves to, plus its scale | `KeyMark` | The visual "home state" |
| Chord | accord | Several pitches sounding together | `HarmonyEvent.chord` | A combination held on screen |
| Degree | degré | A chord's function in the key: i, IV, V7… | `HarmonyEvent.degree` | Function, not identity — V always means "wants to move" |
| Extension | extension (7, 9, 11, 13) | Notes stacked above the basic triad | Written into `HarmonyEvent.chord` | Richness without a change of function |
| Inversion | renversement | The same chord with a different note in the bass | Written into `HarmonyEvent.chord` (`"Am7/C"`) | The same shape seen from another angle |
| Consonance / dissonance | consonance / dissonance | Stable versus unstable combinations | `HarmonyEvent.tension` | Rest versus visual friction |
| Cadence | cadence | How a phrase comes to rest | `HarmonyEvent.cadence` | The full stop of a visual sentence |
| Authentic cadence | cadence parfaite | V → i. The definitive ending | `CadenceKind` `"authentic"` | Arrival; the shape settles |
| Plagal cadence | cadence plagale | IV → i. Softer, the "amen" ending | `CadenceKind` `"plagal"` | Arrival without emphasis |
| Half cadence | demi-cadence | Ends on V. Suspended, expects a continuation | `CadenceKind` `"half"` | An unfinished movement, held |
| Deceptive cadence | cadence rompue | V → anything but i. **The codified surprise** | `CadenceKind` `"deceptive"` + `Marker` `"surprise"` | The transition the viewer predicted, resolving elsewhere |
| ii–V–I | II-V-I | The fundamental cadential motion, everywhere in jazz | A run of `HarmonyEvent.degree` | A three-step approach the eye learns to expect |
| Tritone substitution | substitution tritonique | Replacing V7 by the dominant a tritone away | `HarmonyEvent.chord` + `degree: "bII7"` | The same destination reached by an unexpected road |
| Modulation | modulation | Changing key mid-piece | A second `KeyMark` + `Marker` `"modulation"` | A palette shift that recontextualises everything |
| Pedal point | pédale | One note held while the harmony moves over it | *(not modelled)* | A fixed element under a changing scene |
| Voice leading | conduite des voix | Moving between chords by the smallest steps | *(not modelled)* | Morphing rather than cutting |
| Tension / resolution | tension / résolution | The pull away from rest, and the return to it | `HarmonyEvent.tension`, `Curve` `"tension"` | The engine of the whole visual layer |

---

## 3. Form and architecture — *la forme et l'architecture*

The shape of the whole. This axis is what makes a description reusable: it says what
comes back, and what is new.

| Term | FR | What it is | In the model | Visually |
| --- | --- | --- | --- | --- |
| Section | section, partie | A named span of the form | `Section` | A scene |
| Intro | intro | Sets up the material before the piece proper | `SectionRole` `"intro"` | Establishing shot |
| Verse | couplet | Narrative section; the words change, the music repeats | `"verse"` | The recurring frame the content varies within |
| Pre-chorus | pré-refrain | The ramp that makes the chorus land | `"prechorus"` | Approach; tension rising |
| Chorus | refrain | The section that returns, unchanged, and carries the hook | `"chorus"` | The image the piece is remembered by |
| Bridge | pont | Contrasting material, usually once, before the last chorus | `"bridge"` | The scene that breaks the pattern |
| Break | break | Everything drops out but one element | `"break"` + `Marker` `"break"` | Near-emptiness that resets the eye |
| Build-up | montée | Progressive accumulation towards a release | `"buildup"` + rising `Curve` | Convergence, acceleration, accumulation |
| Drop | drop | The release the build was for | `"drop"` + `Marker` `"drop"` | Full arrangement — and, note, *lower* tension |
| Outro | outro, coda | The way out | `"outro"` | Dissolution |
| Head | thème (jazz) | The written tune, played at the start and the end | `"head"` | The bookends of an improvised middle |
| Chorus *(jazz sense)* | chorus, grille | **One pass of the whole form** — not the refrain | `Section.repeatOf` | ⚠️ The single most confusing term in music: in pop, "chorus" is the refrain; in jazz, it is one cycle of the changes |
| Solo | chorus, solo | An improvised pass over the form | `"solo"` | Variation within a fixed frame |
| Turnaround | turnaround | The 2–4 bars that steer the end of a cycle back to its start | `"turnaround"` | The transition that makes a loop loop |
| Phrase | phrase | A musical sentence, usually 4 or 8 bars | `Phrase` | A visual sentence |
| Period | période | Two phrases that behave as question and answer | `"antecedent"` + `"consequent"` | Setup and payoff |
| Motif | motif | The smallest recognisable idea | `Motif` | A recurring visual signature |
| Theme | thème | A complete melodic idea built from motifs | `Motif` + `Phrase.motifId` | The identity of a scene |
| Variation | variation | The same material, altered | `Section.variationOf`, `PhraseRole` `"variation"` | Recognisable but changed — the eye enjoys the difference |
| Repeat | reprise | The same material, unchanged | `Section.repeatOf` | Return; a viewer relaxes on a repeat |
| Development | développement | Fragmenting and recombining material | *(not modelled)* | Deconstruction of an established shape |
| Recapitulation | réexposition | The return of the opening material | `Section.repeatOf` pointing far back | Homecoming |
| AABA | forme AABA | 32-bar song form: two statements, a bridge, a return | A `Section` sequence | — |
| 12-bar blues | blues en 12 mesures | The fixed 12-bar I–IV–V cycle | A `Section` + `HarmonyEvent` cycle | A grid short enough to be felt as one gesture |

---

## 4. Dynamics and tension — *la dynamique et la tension*

**The axis that matters most for animation**, and the one usable with no note-level
information at all.

| Term | FR | What it is | In the model | Visually |
| --- | --- | --- | --- | --- |
| Dynamics | nuances | How loud, from *pp* to *ff* | *(not modelled — see density)* | — |
| Crescendo / diminuendo | crescendo / decrescendo | Getting gradually louder / softer | A rising or falling `Curve` | A parameter ramp |
| Density | densité | How much is happening — events per bar, not volume | `Curve` `"density"`, `LayerActivity.density` | Number of elements, rate of change |
| Energy | énergie | The felt intensity of the moment | `Curve` `"energy"` | Amplitude of motion |
| Tension | tension | The need for something to change | `Curve` `"tension"` | Constraint, compression, held breath |
| Release | détente, résolution | The satisfaction of that need | `Marker` `"release"` | Expansion, letting go |
| Build-up | montée | Accumulated tension over time | `Marker` `"buildStart"` + rising curve | Convergence and acceleration |
| Riser | riser | The sound effect that carries a build | `LayerRole` `"fx"` | The visual equivalent of a rising pitch |
| Breakdown | breakdown | Stripping the arrangement back mid-piece | `SectionRole` `"break"` | Subtraction as an event |
| Climax | climax, apogée | The peak of the piece | `Marker` `"climax"` | The frame everything was aiming at |
| Delayed resolution | résolution retardée | Withholding the expected arrival | `Marker` `"surprise"` + a curve that stays high | Making the viewer wait one beat too long — on purpose |
| Contrast | contraste | Difference between adjacent sections | Compare `Curve` values across `Section`s | The only reason a loud passage reads as loud |
| Register | registre | How high or low the material sits | `Register`, `Layer.register` | Vertical position, scale, weight |

> **The trap worth internalising.** Loudness is not tension. In the worked example,
> tension peaks in the bar of *silence* and falls at the drop — the drop is the release.
> A visual bound to loudness gets this backwards; a visual bound to `tension` gets it
> right. This is precisely why tension is stored as its own curve.

---

## 5. Timbre and orchestration — *le timbre et l'orchestration*

Who plays, and how much. Not what they play.

| Term | FR | What it is | In the model | Visually |
| --- | --- | --- | --- | --- |
| Timbre | timbre | The colour of a sound, independent of pitch and volume | `Layer.instrument` | Material, texture, treatment |
| Layer | couche | One instrumental line in the arrangement | `Layer` | One visual element or system |
| Role | rôle | What a layer is for: kick, bass, pad, lead… | `LayerRole` | Function in the composition |
| Layer stack | étagement | Foundation / rhythm / harmony / lead / fills | Set of `Layer`s by role | Background, midground, foreground |
| Arrangement | arrangement | Which layers play when | `LayerActivity` | The choreography of appearances |
| Instrumentation | instrumentation | Which instruments are used at all | The `Layer` list | The cast |
| Register | registre | The pitch range a layer occupies | `Layer.register` | Vertical band, scale, weight |
| Panning | panoramique | Left–right placement | *(not modelled)* | Horizontal placement |
| Space | espace (réverbe, delay) | Perceived distance and room | *(not modelled)* | Depth, blur, scale |
| Articulation | articulation | How a note is attacked and held | `Articulation` | Snap versus glide |
| Staccato | staccato | Short, detached | `"staccato"` | Cuts, discrete steps |
| Legato | legato | Connected, flowing | `"legato"` | Continuous interpolation |
| Accent | accent | One note played harder | `"accent"` | A punctuating spike |
| Ghost note | note fantôme | A barely-audible note that keeps the groove alive | `"ghost"` | Micro-motion below the threshold of attention |
| Texture | texture | Monophonic, homophonic, polyphonic | Number of active `Layer`s | One line, one line with backing, or several independent lines |
| Doubling | doublure | Two instruments playing the same line | Two layers, same activity | Reinforcement rather than addition |

---

## 6. Rhetoric of the discourse — *la rhétorique du discours*

How music makes an argument. These are the terms the model treats as **events**, because
they are exactly what an animation can react to.

| Term | FR | What it is | In the model | Visually |
| --- | --- | --- | --- | --- |
| Call and response | appel-réponse | One voice states, another answers | `PhraseRole` `"call"` / `"response"`, `Phrase.answers` | Two elements taking turns — the oldest dialogue there is |
| Question and answer | question-réponse | An open phrase followed by a closing one | `"antecedent"` / `"consequent"` | Unresolved gesture, then its completion |
| Repetition | répétition | Saying it again | `Section.repeatOf` | Recognition; the viewer relaxes |
| Variation | variation | Saying it again, differently | `Section.variationOf` | Recognition plus interest |
| Rupture | rupture | Breaking the established pattern | `Marker` `"surprise"` | The cut that resets attention |
| Anticipation | anticipation | Arriving just before the expected beat | A negative `tick` offset | Motion that pre-empts the beat — reads as eager |
| Suspension | retard | Holding a note past its chord, so it clashes then resolves | `HarmonyEvent.tension` | Something held too long, then released |
| Silence | silence | Absence used as an event, not as a gap | `PhraseRole` `"silence"`, `Marker` `"silence"` | The held frame. **Not** an empty one |
| Fill | fill, break | A short flourish that marks the end of a section | `PhraseRole` `"fill"` | The transition flourish |
| Turnaround | turnaround | The figure that sends a cycle back to its start | `SectionRole` `"turnaround"` | The seam of a loop |
| Riff | riff | A short repeated figure that defines a piece | `Motif` + repeated `Phrase.motifId` | A signature gesture |
| Ostinato | ostinato | A figure repeated obstinately, often underneath | `Motif` with high-density activity | The unchanging base layer |
| Hook | accroche | The bit you remember | `Motif` on `SectionRole` `"chorus"` | The image the piece is remembered by |
| Quotation | citation | Borrowing a recognisable phrase from elsewhere | `Motif.label` | A visual reference |
| Motivic development | développement motivique | Growing a whole piece from one small idea | `Motif` reused across sections | One shape, transformed throughout |

---

## 7. Performance and controlled chance — *l'interprétation et l'aléa maîtrisé*

Why two performances of the same score are not the same, and why jazz can be
unpredictable and logical at once.

| Term | FR | What it is | In the model | Visually |
| --- | --- | --- | --- | --- |
| Feel | feel | How the written grid is actually played | `Feel` | Easing applied to the whole clock |
| Humanisation | humanisation | Small deliberate deviations from the grid | *(not modelled)* | Micro-jitter that stops motion reading as mechanical |
| Micro-timing | micro-timing | Playing a hair early or late, consistently | `MusicalTime.tick` | Sub-frame offsets |
| Velocity | vélocité | How hard a note is struck | *(not modelled)* | Per-event intensity |
| Pocket | pocket | Sitting exactly right against the pulse | `Feel` + micro-timing | The difference between correct and good |
| Improvisation | improvisation | Inventing within a form | `SectionRole` `"solo"` | Controlled variation over a fixed structure |
| Constrained improvisation | improvisation contrainte | Free choices inside a form, a scale and a vocabulary | `Section` + `KeyMark` + `Motif` | **The model for generative visuals**: fixed frame, free content |
| Inside / outside | inside / outside | Playing within the harmony, or deliberately against it | `HarmonyEvent.tension` | On-palette versus deliberately clashing |
| Comping | accompagnement | Supporting a soloist with chords, reactively | `LayerActivity.density` | Background that responds to the foreground |
| Trading fours | échange de quatre | Soloists alternating every four bars | Alternating `"call"` / `"response"` phrases | Strict alternation between two systems |
| Probability | probabilité | The chance an event occurs at all | *(not modelled)* | Seeded randomness — deterministic, per rule 2 |
| Note density | densité de notes | How many events per bar | `LayerActivity.density` | How busy the frame is |

---

## The terms this model does not carry yet

Named here so they are not forgotten: dynamics marks, velocity, panning, reverb and
space, pedal point, voice leading, development, humanisation and probability. Each needs
either the generative layer (notes) or the mix layer (sound) to mean anything, and both
are deliberately out of scope for now — see `README.md`.
