/* ------------------------------------------------------------------ */
/*  Declarative music model — descriptive layer                        */
/* ------------------------------------------------------------------ */

/**
 * A piece of music described as data, so an animation can be driven by its
 * structure instead of by an audio file. This is the **descriptive** layer:
 * it says where the sections, phrases, tension and accents are — it does not
 * carry notes, and it does not make sound. See `docs/music/` for the
 * vocabulary behind every term used here and for the worked example.
 *
 * Four rules shape these types:
 *
 * 1. **Musical time is the addressing system.** Every position is a
 *    `MusicalTime` (`bar:beat:tick`), never a number of seconds or frames.
 *    A tempo map converts musical time → seconds → frames at read time, so a
 *    description survives a tempo change and stays resolution-independent.
 *    Interop resolution is 960 ticks per beat (the common MIDI PPQ), which is
 *    divisible by 2, 3, 4, 5, 6 and 8 — triplets and quintuplets stay exact.
 * 2. **A piece is a deterministic source.** Sampled from its own clock, it
 *    belongs to the same family as the binding system's generators
 *    (`src/sketches/p5/utils/interaction/bindings.js`) rather than to its live
 *    input channels: the same bar always yields the same value, so a sketch
 *    driven by a piece reproduces exactly in headless capture.
 * 3. **Tension is a first-class object**, orthogonal to notes: a `Curve` over
 *    bars plus discrete `Marker`s. It is the part that maps most directly onto
 *    motion design and it is usable without describing a single pitch.
 * 4. **Every normalised value is 0..1** (`Unit`), so a curve or a density feeds
 *    the binding pipeline's range-map with no conversion in between.
 */

/* ---- identifiers ------------------------------------------------- */

export type PieceId = string;
export type SectionId = string;
export type PhraseId = string;
export type LayerId = string;
export type MotifId = string;

/** A normalised scalar in 0..1 — the range every binding target expects. */
export type Unit = number;

/* ---- musical time ------------------------------------------------ */

/**
 * A position in the score. `bar` and `beat` are 1-based, the way musicians
 * count them: bar 1 beat 1 is the downbeat of the piece. `tick` is an optional
 * sub-beat offset in 0..959 (see the PPQ note above); an anacrusis is written
 * as a negative `bar`, so the pickup to bar 1 lives in bar 0.
 */
export type MusicalTime = {
  bar: number;
  beat: number;
  tick?: number;
};

export type TimeSignature = {
  numerator: number;
  /** Note value that gets one beat: 4 = crotchet, 8 = quaver … */
  denominator: 1 | 2 | 4 | 8 | 16;
};

/**
 * One entry of the tempo map. `curve` says how the tempo reaches this mark
 * from the previous one: `step` is an abrupt change, `linear` an accelerando
 * or a ritardando.
 */
export type TempoMark = {
  at: MusicalTime;
  bpm: number;
  curve?: "step" | "linear";
};

export type MeterMark = {
  at: MusicalTime;
  signature: TimeSignature;
};

/**
 * How the underlying grid is felt rather than written: `swing8` delays every
 * offbeat quaver, `halfTime` keeps the tempo but moves the backbeat, `rubato`
 * declares the pulse deliberately elastic.
 */
export type Feel =
  | "straight"
  | "swing8"
  | "swing16"
  | "shuffle"
  | "halfTime"
  | "doubleTime"
  | "rubato";

/** The clock of the piece. Both maps must carry at least a mark at bar 1. */
export type TimeMap = {
  tempo: TempoMark[];
  meter: MeterMark[];
  feel?: Feel;
};

/* ---- form: sections and phrases ---------------------------------- */

export type SectionRole =
  | "intro"
  | "verse"
  | "prechorus"
  | "chorus"
  | "bridge"
  | "break"
  | "buildup"
  | "drop"
  | "solo"
  | "head"
  | "turnaround"
  | "interlude"
  | "outro";

/**
 * What a phrase does in the discourse, which is what makes a description
 * usable visually: a `call` wants an answer, a `silence` is a full event and
 * not an absence, an `anacrusis` leans into the bar that follows it.
 */
export type PhraseRole =
  | "statement"
  | "antecedent"
  | "consequent"
  | "call"
  | "response"
  | "variation"
  | "fill"
  | "silence"
  | "anacrusis";

export type Phrase = {
  id?: PhraseId;
  start: MusicalTime;
  lengthBars: number;
  role: PhraseRole;
  /** The phrase this one answers — how a call/response pair is written down. */
  answers?: PhraseId;
  motifId?: MotifId;
  label?: string;
};

/**
 * A named span of the form. `repeatOf` marks an identical restatement and
 * `variationOf` an altered one; both are what let a renderer show that
 * material is coming back rather than arriving.
 */
export type Section = {
  id: SectionId;
  role: SectionRole;
  start: MusicalTime;
  lengthBars: number;
  label?: string;
  repeatOf?: SectionId;
  variationOf?: SectionId;
  feel?: Feel;
  phrases?: Phrase[];
};

/* ---- tension: curves and markers --------------------------------- */

/**
 * The curve ids a visual binding is expected to find. Custom ids are allowed;
 * these four are the conventional ones, so a sketch can bind to `tension`
 * without knowing which piece it is playing.
 */
export type StandardCurveId = "tension" | "density" | "energy" | "brightness";

export type CurveId = StandardCurveId | ( string & {} );

/**
 * `easing` is a key of the shared easing set (`src/sketches/p5/utils/easing.js`)
 * and shapes the interpolation from the previous point to this one.
 */
export type CurvePoint = {
  at: MusicalTime;
  value: Unit;
  easing?: string;
};

/** A continuous 0..1 quantity over the piece, sampled between its points. */
export type Curve = {
  id: CurveId;
  points: CurvePoint[];
  /** Value before the first point and after the last one. Defaults to 0. */
  default?: Unit;
  label?: string;
};

/**
 * A discrete moment worth reacting to. `silence` and `surprise` are deliberate
 * members: an unexpected turn (a deceptive cadence, a bar that drops out) is a
 * musical event with a position and a strength, not an accident.
 */
export type MarkerKind =
  | "buildStart"
  | "drop"
  | "climax"
  | "release"
  | "break"
  | "silence"
  | "surprise"
  | "call"
  | "response"
  | "cadence"
  | "modulation"
  | "hit"
  | "cue";

export type Marker = {
  at: MusicalTime;
  kind: MarkerKind;
  /** How hard it lands, 0..1 — a marker is not necessarily a full stop. */
  strength?: Unit;
  label?: string;
  note?: string;
};

/* ---- orchestration: layers --------------------------------------- */

export type LayerRole =
  | "kick"
  | "snare"
  | "hats"
  | "percussion"
  | "bass"
  | "chords"
  | "pad"
  | "lead"
  | "arp"
  | "vocal"
  | "fx"
  | "noise";

export type Register = "low" | "mid" | "high";

export type Articulation =
  | "staccato"
  | "legato"
  | "accent"
  | "ghost"
  | "sustained";

/**
 * When a layer plays, and how much. Give **either** `sectionId` — shorthand for
 * "the whole of that section" — **or** an explicit `from` + `lengthBars` span,
 * which is how a layer drops out for the last bar of a build without the form
 * having to be cut up around it.
 */
export type LayerActivity = {
  sectionId?: SectionId;
  from?: MusicalTime;
  lengthBars?: number;
  /** How busy the layer is over this span, 0..1 — not how loud it is. */
  density?: Unit;
  muted?: boolean;
  register?: Register;
  articulation?: Articulation;
};

export type Layer = {
  id: LayerId;
  role: LayerRole;
  label?: string;
  /** Free-form instrument name; the eventual MIDI export maps it to a track. */
  instrument?: string;
  register?: Register;
  activity: LayerActivity[];
};

/* ---- harmony (optional annotation) ------------------------------- */

export type PitchClass =
  | "C"
  | "C#"
  | "Db"
  | "D"
  | "D#"
  | "Eb"
  | "E"
  | "F"
  | "F#"
  | "Gb"
  | "G"
  | "G#"
  | "Ab"
  | "A"
  | "A#"
  | "Bb"
  | "B";

export type Mode =
  | "major"
  | "minor"
  | "ionian"
  | "dorian"
  | "phrygian"
  | "lydian"
  | "mixolydian"
  | "aeolian"
  | "locrian"
  | "harmonicMinor"
  | "melodicMinor"
  | "pentatonicMajor"
  | "pentatonicMinor"
  | "blues"
  | "wholeTone"
  | "chromatic";

export type KeyMark = {
  at: MusicalTime;
  tonic: PitchClass;
  mode: Mode;
};

/**
 * How a progression comes to rest. `deceptive` is the codified surprise: the
 * ear is led to expect the tonic and gets another chord instead.
 */
export type CadenceKind = "authentic" | "plagal" | "deceptive" | "half" | "none";

export type HarmonyEvent = {
  at: MusicalTime;
  /** Chord symbol as a musician writes it: "Am7", "F#m7b5", "E7#9". */
  chord: string;
  /** Roman-numeral degree in the prevailing key: "i", "IV", "V7", "bVI". */
  degree?: string;
  durationBeats?: number;
  cadence?: CadenceKind;
  /** Harmonic tension of this chord in context, 0..1. */
  tension?: Unit;
};

export type Harmony = {
  keys: KeyMark[];
  progression?: HarmonyEvent[];
};

/* ---- motifs (note-free) ------------------------------------------ */

export type ContourStep = "up" | "down" | "flat" | "leapUp" | "leapDown";

/**
 * A recognisable idea described by its *shape* rather than its pitches, so the
 * descriptive layer never depends on the (future) generative one. `rhythm` is a
 * grid string where `x` is an onset and `.` a rest, one character per
 * subdivision — "x..x..x." reads as a tresillo-ish quaver pattern.
 */
export type Motif = {
  id: MotifId;
  contour: ContourStep[];
  label?: string;
  rhythm?: string;
  lengthBars?: number;
};

/* ---- the piece ---------------------------------------------------- */

/**
 * `sections`, `curves` and `markers` are enough to drive an animation on their
 * own; `harmony` and `motifs` are annotations a piece may omit. `layers` says
 * who is playing and how busy they are, without saying what they play.
 */
export type Piece = {
  id: PieceId;
  time: TimeMap;
  lengthBars: number;
  sections: Section[];
  layers: Layer[];
  curves: Curve[];
  markers: Marker[];
  title?: string;
  composer?: string;
  /** Where the description comes from: a reference track, a sketch, an import. */
  source?: string;
  harmony?: Harmony;
  motifs?: Motif[];
  notes?: string;
};
