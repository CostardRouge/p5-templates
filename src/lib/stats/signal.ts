/**
 * The Plan that LISTENS (lab 8, level 2, taken to its end on the maintainer's
 * word, 2026-11-20): what measured results may move in the plan, through the
 * planner's one door (`PlanSignal`, `planner.ts`). Three moves, each bounded:
 *
 * 1. **A sketch's place in its pool.** A favourite whose last post did well
 *    above its accounts' usual comes back sooner, one that did well below
 *    later; a sketch never measured — every new one — takes the result of its
 *    SERIES once the series has `MIN_GROUP` measured posts, and otherwise
 *    keeps its place, to be tried. Nothing moves more than `MAX_SHIFT` places,
 *    and an index within `MIN_EDGE` of the usual moves nothing.
 * 2. **Which pillar a week's strongest slot gets.** When one slot of the
 *    rhythm measures clearly above the next and one pillar (new, favourite)
 *    clearly above the other, the two turns are SWAPPED inside the week — one
 *    swap a week at most, a series' or a recap's slot never touched, and the
 *    mix he chose keeps its counts exactly.
 * 3. **The line says so**: what moved, on which figures.
 *
 * With no measured post nothing qualifies, every order is handed back as it
 * came, and the plan is exactly the plan without this folder — the spec holds
 * that. The signal reorders proposals; it approves and schedules nothing.
 *
 * Pure and DOM-free.
 */

import {
  PROVIDER_LABEL
} from "../postiz/client";
import {
  slotHead, weekOf, type Rhythm
} from "../postiz/rhythm";
import {
  sketchKeyOf, type PlanSignal, type PlanSketch
} from "../planner/planner";
import {
  groups, measuredCount, MIN_GROUP, OFF_SLOT, sketchScores, slotOf, type GroupRow, type Measured, type MeasuredSend
} from "./measure";
import {
  formatCount, formatTimes, headline, headlineWord
} from "./metrics";

/** No sketch moves more than this many places in its pool, up or down. */
export const MAX_SHIFT = 3;
/** A result within this factor of the usual (above or below) moves nothing; a slot or a pillar must lead the next by it. */
export const MIN_EDGE = 1.2;

/**
 * `items` reordered by `score` (higher first), no item more than `maxShift`
 * places from where it stood, equal scores keeping their order. With every
 * score equal it is `items` itself, in order.
 *
 * Position by position: the item that would otherwise fall out of its bound
 * is taken first; else the best of those within reach, the earliest on a tie.
 */
export function boundedOrder<T>(
  items: readonly T[], score: ( item: T ) => number, maxShift = MAX_SHIFT
): T[] {
  const n = items.length;
  const scores = items.map( score );
  const taken = new Array<boolean>( n ).fill( false );
  const out: T[] = [];

  for ( let i = 0; i < n; i++ ) {
    const forced = i - maxShift;
    let pick = -1;

    if ( forced >= 0 && !taken[ forced ] ) {
      pick = forced;
    } else {
      for ( let j = Math.max(
        0,
        i - maxShift
      ); j <= Math.min(
          n - 1,
          i + maxShift
        ); j++ ) {
        if ( !taken[ j ] && ( pick < 0 || scores[ j ] > scores[ pick ] ) ) {
          pick = j;
        }
      }
    }

    taken[ pick ] = true;
    out.push( items[ pick ] );
  }

  return out;
}

/** A group that leads another clearly enough to move something. */
export interface Lead {
  id: string;
  label: string;
  index: number;
  posts: number;
  /** The one it leads: the next slot, the other pillar. */
  over: { id: string;
    label: string;
    index: number;
    posts: number; };
}

/** What the signal rests on — shown under the Plan and answered by `plan.get`, so the order can be read and contradicted. */
export interface SignalFacts {
  /** Sends with an index: what every comparison rests on. */
  measured: number;
  /** A sketch's own last measured send, by `<engine>/<name>`. */
  sketches: Map<string, MeasuredSend>;
  /** The series that have enough measured posts to speak, by category. */
  series: Map<string, GroupRow>;
  slot: Lead | null;
  pillar: Lead | null;
}

function lead( rows: readonly GroupRow[] ): Lead | null {
  const ranked = rows.filter( ( r ) => !r.thin && r.index !== null ).sort( (
    a, b
  ) => ( b.index as number ) - ( a.index as number ) );
  const [
    best,
    next
  ] = ranked;

  if ( !best || !next || ( next.index as number ) <= 0 || ( best.index as number ) / ( next.index as number ) < MIN_EDGE ) {
    return null;
  }

  return {
    id: best.id,
    label: best.label,
    index: best.index as number,
    posts: best.posts,
    over: {
      id: next.id,
      label: next.label,
      index: next.index as number,
      posts: next.posts
    }
  };
}

export function signalFacts(
  measured: Measured, rhythm: Rhythm
): SignalFacts {
  // Only the slots the rhythm still has: one he dropped can no longer be given anything.
  const live = new Set( rhythm.slots.map( slotHead ) );

  return {
    measured: measuredCount( measured.sends ),
    sketches: sketchScores( measured.sends ),
    series: new Map( groups(
      measured.sends,
      "series"
    ).filter( ( r ) => !r.thin && r.index !== null )
      .map( ( r ) => [
        r.id,
        r
      ] ) ),
    slot: lead( groups(
      measured.sends,
      "slot"
    ).filter( ( r ) => r.id !== OFF_SLOT && live.has( r.id ) ) ),
    // A reel's slot is the pattern's fifth: it is not moved, so it is not compared.
    pillar: lead( groups(
      measured.sends,
      "pillar"
    ).filter( ( r ) => r.id === "drop" || r.id === "favourite" ) )
  };
}

/** A result close to the usual counts as the usual. */
function settle( index: number ): number {
  return index >= MIN_EDGE || index <= 1 / MIN_EDGE ? index : 1;
}

/** The score a sketch is ordered by, and where it comes from. */
function scoreOf(
  sketch: PlanSketch, facts: SignalFacts
): { index: number;
  from: "own" | "series" | null } {
  const own = facts.sketches.get( sketchKeyOf( sketch ) );

  if ( own && own.index !== null ) {
    return {
      index: settle( own.index ),
      from: "own"
    };
  }

  const series = sketch.category ? facts.series.get( sketch.category ) : undefined;

  if ( series && series.index !== null ) {
    return {
      index: settle( series.index ),
      from: "series"
    };
  }

  return {
    index: 1,
    from: null
  };
}

function shortDay(
  at: number, timeZone: string
): string {
  return new Date( at ).toLocaleDateString(
    "en-GB",
    {
      day: "numeric",
      month: "short",
      timeZone
    }
  );
}

/** `Instagram 4,210 reached, X 1,180 impressions` — a send's settled headlines, the figures an index rests on. */
export function sendFigures( send: MeasuredSend ): string {
  return send.accounts.flatMap( ( a ) => {
    const head = a.index !== null && a.record?.settled ? headline( a.record.settled.figures ) : null;

    return head ? [
      `${ PROVIDER_LABEL[ a.provider ] } ${ formatCount( head.value ) } ${ headlineWord( head ) }`
    ] : [];
  } ).join( ", " );
}

const PILLAR_WORD: Record<string, string> = {
  drop: "new sketches",
  favourite: "favourites"
};

const places = ( n: number ) => `${ Math.abs( n ) } ${ Math.abs( n ) === 1 ? "place" : "places" }`;

/**
 * The signal the planner takes. `facts` with nothing measured gives a signal
 * that hands every order back untouched.
 */
export function planSignal(
  facts: SignalFacts, rhythm: Rhythm, catalogue: readonly PlanSketch[]
): PlanSignal {
  const byKey = new Map( catalogue.map( ( s ) => [
    sketchKeyOf( s ),
    s
  ] ) );
  const swap = facts.slot && facts.pillar ? {
    slot: facts.slot,
    pillar: facts.pillar
  } : null;

  return {
    order(
      _pillar, pool
    ) {
      return boundedOrder(
        pool,
        ( sketch ) => scoreOf(
          sketch,
          facts
        ).index
      );
    },
    pillars( turns ) {
      const out = turns.map( ( t ) => t.pillar );

      if ( !swap ) {
        return out;
      }

      const weeks = new Map<string, number[]>();

      turns.forEach( (
        t, i
      ) => {
        const monday = weekOf(
          t.at,
          rhythm.timeZone
        );

        weeks.set(
          monday,
          [
            ...( weeks.get( monday ) ?? [] ),
            i
          ]
        );
      } );

      for ( const week of weeks.values() ) {
        const strong = week.find( ( i ) => slotOf(
          turns[ i ].at.getTime(),
          rhythm
        ) === swap.slot.id );

        if ( strong === undefined || out[ strong ] !== swap.pillar.over.id ) {
          continue;
        }

        // The nearest turn of the week that holds the stronger pillar gives it up.
        const giver = week.filter( ( i ) => i !== strong && out[ i ] === swap.pillar.id ).sort( (
          a, b
        ) => Math.abs( a - strong ) - Math.abs( b - strong ) )[ 0 ];

        if ( giver !== undefined ) {
          [
            out[ strong ],
            out[ giver ]
          ] = [
            out[ giver ],
            out[ strong ]
          ];
        }
      }

      return out;
    },
    why( line ) {
      const said: string[] = [];
      const sketch = byKey.get( line.sketchKey );
      const score = sketch ? scoreOf(
        sketch,
        facts
      ) : null;

      // Only a sketch moved by ITS OWN result says so: one that merely made room for another keeps its line.
      if ( sketch && score && score.from && ( ( line.moved > 0 && score.index > 1 ) || ( line.moved < 0 && score.index < 1 ) ) ) {
        const direction = line.moved > 0 ? "up" : "down";

        if ( score.from === "own" ) {
          const send = facts.sketches.get( line.sketchKey ) as MeasuredSend;

          said.push( `moved ${ direction } ${ places( line.moved ) }: its post of ${ shortDay(
            send.at,
            rhythm.timeZone
          ) } did ${ formatTimes( send.index as number ) } your usual (${ sendFigures( send ) }, at 7 days or more)` );
        } else {
          const row = facts.series.get( sketch.category as string ) as GroupRow;

          said.push( `moved ${ direction } ${ places( line.moved ) }: ${ row.label } posts do ${ formatTimes( row.index as number ) } your usual (median of ${ row.posts })` );
        }
      }

      if ( swap && line.pattern !== line.pillar && ( line.pillar === "drop" || line.pillar === "favourite" ) ) {
        const here = slotOf(
          line.at.getTime(),
          rhythm
        );
        const edge = `${ swap.slot.label } is your strongest slot (${ formatTimes( swap.slot.index ) } your usual over ${ swap.slot.posts } posts, ${ swap.slot.over.label } ${ formatTimes( swap.slot.over.index ) } over ${ swap.slot.over.posts }) and ${ PILLAR_WORD[ swap.pillar.id ] } do better than ${ PILLAR_WORD[ swap.pillar.over.id ] } (${ formatTimes( swap.pillar.index ) } over ${ swap.pillar.posts } against ${ formatTimes( swap.pillar.over.index ) } over ${ swap.pillar.over.posts })`;

        said.push( here === swap.slot.id
          ? `${ edge }: this week's turn was swapped to bring one here`
          : `swapped turns with ${ swap.slot.label }, your strongest slot (${ formatTimes( swap.slot.index ) } your usual over ${ swap.slot.posts } posts), where ${ PILLAR_WORD[ swap.pillar.id ] } go first` );
      }

      return said.length ? said.join( " · " ) : null;
    }
  };
}

/** What the plan is listening to, in lines a person reads under it — and an agent in `plan.get`. */
export function signalLines( facts: SignalFacts ): string[] {
  const lines: string[] = [];
  // Only a favourite is proposed again once posted: a new sketch that went out leaves the plan for good.
  const own = [
    ...facts.sketches.values()
  ].filter( ( s ) => s.pillar === "favourite" && settle( s.index as number ) !== 1 );

  if ( own.length ) {
    lines.push( `${ own.length } ${ own.length === 1 ? "favourite has" : "favourites have" } a post far enough from your usual to move ${ own.length === 1 ? "it" : "them" } when ${ own.length === 1 ? "it comes" : "they come" } back (at most ${ MAX_SHIFT } places)` );
  }

  for ( const row of facts.series.values() ) {
    if ( settle( row.index as number ) !== 1 ) {
      lines.push( `${ row.label } posts do ${ formatTimes( row.index as number ) } your usual (median of ${ row.posts }): its unposted sketches move ${ ( row.index as number ) > 1 ? "up" : "down" }` );
    }
  }

  if ( facts.slot && facts.pillar ) {
    lines.push( `${ facts.slot.label } is your strongest slot (${ formatTimes( facts.slot.index ) } over ${ facts.slot.posts } posts) and ${ PILLAR_WORD[ facts.pillar.id ] } your stronger pillar (${ formatTimes( facts.pillar.index ) } over ${ facts.pillar.posts }): each week one turn is swapped to put them together` );
  }

  return lines;
}

/** Why nothing moves, when nothing does: what is still missing. */
export function quietReason( facts: SignalFacts ): string {
  return facts.measured === 0
    ? "No post is measured yet: a post counts once it was read 7 days after it went out, on an account with 5 such posts. Until then the Plan is drawn from the calendar alone."
    : `${ facts.measured } ${ facts.measured === 1 ? "post is" : "posts are" } measured, none far enough from your usual to move anything (a series, a slot or a pillar speaks from ${ MIN_GROUP } posts, and only when it leads by ${ Math.round( ( MIN_EDGE - 1 ) * 100 ) } %).`;
}
