/**
 * VARIATIONS of a sketch, proposed from its own form (lab 9, his answer to
 * Q4: an agent proposes, he keeps the good ones — never settings drawn at
 * random into a post). A candidate is ONE named move on the sketch's
 * controls: another palette, another choice of a select, another seed, an
 * amount taken to the other end of its range, a switch flipped. Not noise:
 * every candidate changes one thing a person could name, and says so.
 *
 * It is a calculation: the same form and the same values always give the
 * same candidates, so `variations.propose` and `variations.keep` agree on an
 * id without keeping anything between two calls. What it proposes is only a
 * starting grid — an agent looks at each one (`variations.sheet`) and may
 * compose its own values instead.
 *
 * Pure. `configuration` is a sketch's `formConfiguration` (plain data).
 */

type Field = Record<string, unknown> & { component?: string;
  label?: string };

/** What a candidate moves. */
export type Move = "palette" | "choice" | "seed" | "amount" | "toggle";

export const MOVES: readonly Move[] = [
  "palette",
  "choice",
  "amount",
  "seed",
  "toggle"
];

export interface Change {
  /** Dotted path under the sketch's parameters. */
  path: string;
  from: unknown;
  to: unknown;
}

export interface Candidate {
  /** Stable for a form and its values: `palette:colors.palette=sunset`, `low:text.handles`. */
  id: string;
  move: Move;
  /** What changes, for a person: `Palette: Sunset`, `Handles 78 → 24`. */
  label: string;
  /** The nested delta `sketch.set` takes. */
  values: Record<string, unknown>;
  changes: Change[];
}

export const DEFAULT_CANDIDATES = 6;
export const MAX_CANDIDATES = 12;

/** Top-level groups that are never part of the look (the breakdown's own rule, `deriveSteps.js`). */
const RESERVED = new Set( [
  "bindings",
  "interaction",
  "interactive"
] );
/** Controls that drive devices and sound, not the picture. */
const NOT_THE_PICTURE = /sound|audio|midi|debug|webcam|microphone|device/i;
/** Controls that trade speed for sharpness: the same picture, slower or coarser. */
const PERFORMANCE = /^(quality|performance|rendering)$|renderscale|supersample|antialias|pixeldensity/i;
const PALETTE_KEY = /palette|colou?rs?$|scheme|theme/i;
const SEED_KEY = /seed/i;
/** Sliders that shape the piece, as their keys say it. */
const STRUCTURAL = /count|amount|number|density|rows?$|col(umn)?s?$|lines?$|points?$|segments?|steps?$|layers?$|rings?$|turns?$|twist|cycles?$|freq|scale|size|radius|thickness|weight|spacing|gap|amplitude|noise|detail|subdiv|depth|spread|length|handles|fusion/i;
/** Sliders that only shift or fade it. */
const MINOR = /phase|offset|opacity|alpha|smooth|timescale|duration|framerate|fps|^x$|^y$|^z$/i;

function isRecord( value: unknown ): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray( value );
}

function num( value: unknown ): number | undefined {
  return typeof value === "number" && Number.isFinite( value ) ? value : undefined;
}

interface Leaf {
  path: string;
  key: string;
  field: Field;
  value: unknown;
  order: number;
}

function walk(
  fields: unknown, values: unknown, prefix: string, out: Leaf[]
): Leaf[] {
  if ( !isRecord( fields ) ) {
    return out;
  }

  for ( const [
    key,
    raw
  ] of Object.entries( fields ) ) {
    if ( !isRecord( raw ) || ( !prefix && RESERVED.has( key ) ) || NOT_THE_PICTURE.test( key ) || PERFORMANCE.test( key ) ) {
      continue;
    }

    const field = raw as Field;
    const path = prefix ? `${ prefix }.${ key }` : key;
    const value = isRecord( values ) ? values[ key ] : undefined;

    if ( field.component === "nested-object" ) {
      walk(
        field.fields,
        value,
        path,
        out
      );
    } else if ( field.component !== "hidden" && value !== undefined ) {
      out.push( {
        path,
        key,
        field,
        value,
        order: out.length
      } );
    }
  }

  return out;
}

function humanize( key: string ): string {
  const words = key.replace(
    /([a-z0-9])([A-Z])/g,
    "$1 $2"
  ).replace(
    /[-_]+/g,
    " "
  )
    .toLowerCase();

  return words.charAt( 0 ).toUpperCase() + words.slice( 1 );
}

/** A control's label without its aside: `Detail (octaves)` → `Detail`. */
function ownName( leaf: Leaf ): string {
  const label = typeof leaf.field.label === "string" ? leaf.field.label.replace(
    /\s*\(.*\)\s*$/,
    ""
  ).trim() : "";

  return label || humanize( leaf.key );
}

/** A leaf's name for a person: its label, with its group when the label alone is ambiguous. */
function nameOf(
  leaf: Leaf, all: readonly Leaf[]
): string {
  const own = ownName( leaf );
  const parent = leaf.path.split( "." ).slice(
    -2,
    -1
  )[ 0 ];
  const twin = all.some( ( other ) => other !== leaf && ownName( other ) === own );

  return twin && parent ? `${ humanize( parent ) } › ${ own }` : own;
}

function options( field: Field ): { value: unknown;
  label: string; }[] {
  return Array.isArray( field.options )
    ? field.options.map( ( option ) => isRecord( option ) && "value" in option
      ? {
        value: option.value,
        label: typeof option.label === "string" && option.label ? option.label : String( option.value )
      }
      : {
        value: option,
        label: String( option )
      } )
    : [];
}

function nested(
  path: string, value: unknown
): Record<string, unknown> {
  return path.split( "." ).reduceRight<unknown>(
    (
      inner, key
    ) => ( {
      [ key ]: inner
    } ),
    value
  ) as Record<string, unknown>;
}

function decimals( step: number ): number {
  const text = String( step );

  return text.includes( "e-" ) ? Number( text.split( "e-" )[ 1 ] ) : ( text.split( "." )[ 1 ] ?? "" ).length;
}

/** `target` on the slider's own steps, inside its range. */
export function onStep(
  target: number, min: number, max: number, step: number | undefined
): number {
  const size = step && step > 0 ? step : ( max - min ) / 100 || 1;
  const snapped = min + Math.round( ( target - min ) / size ) * size;
  const inside = Math.min(
    max,
    Math.max(
      min,
      snapped
    )
  );

  return Number( inside.toFixed( Math.min(
    10,
    Math.max(
      decimals( size ),
      decimals( min )
    )
  ) ) );
}

function show( value: unknown ): string {
  return typeof value === "number" ? String( Number( value.toFixed( 3 ) ) ) : String( value );
}

function candidate(
  id: string, move: Move, label: string, leaf: Leaf, to: unknown
): Candidate {
  return {
    id,
    move,
    label,
    values: nested(
      leaf.path,
      to
    ),
    changes: [
      {
        path: leaf.path,
        from: leaf.value,
        to
      }
    ]
  };
}

/** `list` in an order that spans it: the middle first, then the quarters, so three picks of fifteen are far apart. */
function spread<T>( list: readonly T[] ): T[] {
  const out: T[] = [];
  const seen = new Set<number>();
  const visit = (
    from: number, to: number
  ) => {
    const queue: [ number, number ][] = [
      [
        from,
        to
      ]
    ];

    while ( queue.length ) {
      const [
        a,
        b
      ] = queue.shift()!;

      if ( a > b ) {
        continue;
      }

      const mid = Math.floor( ( a + b ) / 2 );

      if ( !seen.has( mid ) ) {
        seen.add( mid );
        out.push( list[ mid ] );
      }
      queue.push(
        [
          a,
          mid - 1
        ],
        [
          mid + 1,
          b
        ]
      );
    }
  };

  visit(
    0,
    list.length - 1
  );

  return out;
}

/** Every candidate of the form, by move, each family in its own order of interest. */
export function allCandidates(
  configuration: unknown, values: unknown
): Record<Move, Candidate[]> {
  const leaves = walk(
    configuration,
    values,
    "",
    []
  );
  const out: Record<Move, Candidate[]> = {
    palette: [],
    choice: [],
    amount: [],
    seed: [],
    toggle: []
  };
  const choices: Candidate[][] = [];
  const amounts: { score: number;
    order: number;
    far: Candidate;
    near: Candidate | null; }[] = [];

  for ( const leaf of leaves ) {
    const {
      field, value, path, key
    } = leaf;
    const name = nameOf(
      leaf,
      leaves
    );

    if ( field.component === "palette-picker" || ( field.component === "select" && PALETTE_KEY.test( key ) ) ) {
      out.palette.push( ...spread( options( field ).filter( ( option ) => option.value !== value ) ).map( ( option ) => candidate(
        `palette:${ path }=${ String( option.value ) }`,
        "palette",
        `${ name }: ${ option.label }`,
        leaf,
        option.value
      ) ) );
    } else if ( field.component === "select" ) {
      const others = options( field ).filter( ( option ) => option.value !== value );

      if ( others.length ) {
        choices.push( others.map( ( option ) => candidate(
          `choice:${ path }=${ String( option.value ) }`,
          "choice",
          `${ name }: ${ option.label }`,
          leaf,
          option.value
        ) ) );
      }
    } else if ( field.component === "checkbox" && typeof value === "boolean" ) {
      out.toggle.push( candidate(
        `flip:${ path }`,
        "toggle",
        `${ name }: ${ value ? "off" : "on" }`,
        leaf,
        !value
      ) );
    } else if ( ( field.component === "slider" || field.component === "number" ) && typeof value === "number" ) {
      const min = num( field.min );
      const max = num( field.max );
      const step = num( field.step );

      if ( min === undefined || max === undefined || max <= min ) {
        continue;
      }

      if ( SEED_KEY.test( key ) ) {
        const size = step && step > 0 ? step : 1;
        const span = Math.floor( ( max - min ) / size ) + 1;

        for ( let i = 1; i <= Math.min(
          3,
          span - 1
        ); i++ ) {
          const next = onStep(
            min + ( ( Math.round( ( value - min ) / size ) + i ) % span ) * size,
            min,
            max,
            size
          );

          out.seed.push( candidate(
            `seed:${ path }=${ next }`,
            "seed",
            `${ name } ${ show( value ) } → ${ show( next ) }`,
            leaf,
            next
          ) );
        }
        continue;
      }

      const range = max - min;
      const ends = ( [
        [
          "low",
          onStep(
            min + range * 0.2,
            min,
            max,
            step
          )
        ],
        [
          "high",
          onStep(
            min + range * 0.8,
            min,
            max,
            step
          )
        ]
      ] as const ).filter( ( [
        , to
      ] ) => Math.abs( to - value ) >= range * 0.15 )
        .sort( (
          a, b
        ) => Math.abs( b[ 1 ] - value ) - Math.abs( a[ 1 ] - value ) )
        .map( ( [
          end,
          to
        ] ) => candidate(
          `${ end }:${ path }`,
          "amount",
          `${ name } ${ show( value ) } → ${ show( to ) }`,
          leaf,
          to
        ) );

      if ( ends.length ) {
        amounts.push( {
          score: ( STRUCTURAL.test( key ) ? 2 : 0 ) + ( step !== undefined && step >= 1 ? 1 : 0 ) - ( MINOR.test( key ) ? 3 : 0 ),
          order: leaf.order,
          far: ends[ 0 ],
          near: ends[ 1 ] ?? null
        } );
      }
    }
  }

  // One alternative of each select before a second of any: a mode switch is the biggest single move.
  for ( let i = 0; choices.some( ( list ) => list[ i ] ); i++ ) {
    out.choice.push( ...choices.map( ( list ) => list[ i ] ).filter( Boolean ) );
  }

  // The sliders that shape the piece first, each to its far end; their near ends come last.
  amounts.sort( (
    a, b
  ) => b.score - a.score || a.order - b.order );
  out.amount.push(
    ...amounts.map( ( a ) => a.far ),
    ...amounts.map( ( a ) => a.near ).filter( ( c ): c is Candidate => c !== null )
  );

  return out;
}

/**
 * `count` candidates, the moves taken in turn (a palette, a choice, an
 * amount, a seed, a switch, then round again) so a small grid still shows
 * different KINDS of change.
 */
export function proposeVariations(
  configuration: unknown, values: unknown, count = DEFAULT_CANDIDATES
): Candidate[] {
  const all = allCandidates(
    configuration,
    values
  );
  const out: Candidate[] = [];
  const want = Math.max(
    0,
    Math.min(
      MAX_CANDIDATES,
      Math.floor( count )
    )
  );

  for ( let round = 0; out.length < want && MOVES.some( ( move ) => all[ move ][ round ] ); round++ ) {
    for ( const move of MOVES ) {
      const next = all[ move ][ round ];

      if ( next && out.length < want ) {
        out.push( next );
      }
    }
  }

  return out;
}

/** The candidate `id` names, wherever it sits in the form's whole list; null when the form has none such. */
export function findCandidate(
  configuration: unknown, values: unknown, id: string
): Candidate | null {
  const all = allCandidates(
    configuration,
    values
  );

  return MOVES.flatMap( ( move ) => all[ move ] ).find( ( c ) => c.id === id ) ?? null;
}
