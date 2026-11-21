/**
 * The person's choices about the plan (`planner.ts`), kept in THIS browser:
 * the mix, the gap between two posts of one sketch, what was passed over,
 * the slots left empty and the slots pinned. One `localStorage` key; another
 * tab is told through the `storage` event, so a plan an agent changes in the
 * studio's tab redraws in the gallery's.
 */

import {
  DEFAULT_GAP_WEEKS, DEFAULT_MIX, EMPTY_CHOICES, GAP_WEEKS, MIXES, PIN_REEL_MAX, type HeldLine, type LineState, type Mix, type Pin, type PlanChoices, type Proposal
} from "./planner";

const KEY = "sketchbook.plan.v1";
const SKETCH_KEY = /^[a-z0-9]+\/[A-Za-z0-9._-]+$/;
/** A passed-over sketch comes back after this long: the plan is for now, not for ever. */
const PASSED_MS = 56 * 86_400_000;
/** A slot's choice is forgotten this long after the slot went by. */
const STALE_MS = 86_400_000;

function storage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

function record( raw: unknown ): Record<string, unknown> {
  return raw && typeof raw === "object" && !Array.isArray( raw ) ? raw as Record<string, unknown> : {};
}

const LINE_STATES: readonly LineState[] = [
  "waiting",
  "rendering",
  "planned",
  "failed"
];

/** A stored approved line read back, or null when it is not one. Pure. */
export function readHeld( raw: unknown ): HeldLine | null {
  const line = record( raw );
  const p = record( line.proposal );
  const reel = record( p.reel );
  const beat = record( line.beat );
  const strings = ( value: unknown ) => Array.isArray( value ) ? value.filter( ( s ): s is string => typeof s === "string" ) : [];

  if ( typeof p.key !== "string" || typeof p.sketchKey !== "string" || !SKETCH_KEY.test( p.sketchKey ) || typeof p.path !== "string" || typeof p.title !== "string" || typeof line.postKey !== "string" ) {
    return null;
  }

  const scenes = strings( reel.scenes );
  const proposal: Proposal = {
    key: p.key,
    pillar: p.pillar === "favourite" || p.pillar === "series" || p.pillar === "recap" ? p.pillar : "drop",
    sketchKey: p.sketchKey,
    path: p.path,
    title: p.title,
    why: typeof p.why === "string" ? p.why : "",
    favorite: p.favorite === true,
    ...( scenes.length && typeof reel.title === "string" ? {
      reel: {
        title: reel.title,
        subtitle: typeof reel.subtitle === "string" ? reel.subtitle : "",
        sketches: strings( reel.sketches ).filter( ( key ) => SKETCH_KEY.test( key ) ),
        scenes
      }
    } : {} )
  };

  return {
    proposal,
    postKey: line.postKey,
    stamp: typeof line.stamp === "string" ? line.stamp : null,
    approvedAt: typeof line.approvedAt === "number" ? line.approvedAt : 0,
    state: LINE_STATES.includes( line.state as LineState ) ? line.state as LineState : "waiting",
    ...( typeof line.error === "string" && line.error ? {
      error: line.error.slice(
        0,
        400
      )
    } : {} ),
    ...( line.sending === true ? {
      sending: true
    } : {} ),
    ...( strings( line.postIds ).length ? {
      postIds: strings( line.postIds )
    } : {} ),
    ...( typeof line.ms === "number" ? {
      ms: line.ms
    } : {} ),
    ...( typeof beat.id === "string" && typeof beat.beat === "string" ? {
      beat: {
        id: beat.id,
        beat: beat.beat,
        trial: beat.trial === true
      }
    } : {} )
  };
}

/** Stored choices read back, whatever they hold; what went stale by `now` is dropped. Pure. */
export function readChoices(
  raw: unknown, now: number
): PlanChoices {
  const r = record( raw );
  const stamps = (
    value: unknown, keep: ( key: string, at: number ) => boolean
  ) => Object.fromEntries( Object.entries( record( value ) ).filter( ( entry ): entry is [ string, number ] => typeof entry[ 1 ] === "number" && keep(
    entry[ 0 ],
    entry[ 1 ]
  ) ) );
  const ahead = ( slot: string ) => {
    const at = Date.parse( slot );

    return Number.isFinite( at ) && at > now - STALE_MS;
  };
  const pins: Record<string, Pin> = {};

  for ( const [
    slot,
    value
  ] of Object.entries( record( r.pins ) ) ) {
    const pin = record( value );

    if ( ahead( slot ) && typeof pin.sketchKey === "string" && SKETCH_KEY.test( pin.sketchKey ) ) {
      const reel = record( pin.reel );
      const scenes = Array.isArray( reel.sketches ) ? reel.sketches.filter( ( key ): key is string => typeof key === "string" && SKETCH_KEY.test( key ) ).slice(
        0,
        PIN_REEL_MAX
      ) : [];

      pins[ slot ] = {
        sketchKey: pin.sketchKey,
        by: pin.by === "agent" ? "agent" : "person",
        ...( scenes.length >= 2 && typeof reel.title === "string" && reel.title.trim() ? {
          reel: {
            title: reel.title.trim().slice(
              0,
              80
            ),
            subtitle: typeof reel.subtitle === "string" ? reel.subtitle.trim().slice(
              0,
              80
            ) : "",
            sketches: scenes,
            pillar: reel.pillar === "recap" ? "recap" : "series"
          }
        } : {} ),
        ...( typeof pin.note === "string" && pin.note.trim() ? {
          note: pin.note.trim().slice(
            0,
            280
          )
        } : {} )
      };
    }
  }

  const held: Record<string, HeldLine> = {};

  for ( const [
    slot,
    value
  ] of Object.entries( record( r.held ) ) ) {
    const line = ahead( slot ) ? readHeld( value ) : null;

    if ( line ) {
      held[ slot ] = line;
    }
  }

  return {
    held,
    mix: MIXES.some( ( m ) => m.id === r.mix ) ? r.mix as Mix : DEFAULT_MIX,
    gapWeeks: ( GAP_WEEKS as readonly number[] ).includes( r.gapWeeks as number ) ? r.gapWeeks as number : DEFAULT_GAP_WEEKS,
    passed: stamps(
      r.passed,
      (
        _key, at
      ) => now - at < PASSED_MS
    ),
    skipped: stamps(
      r.skipped,
      ( slot ) => ahead( slot )
    ),
    pins,
    // Kept a year: the longest gap is twelve weeks, and the year's recap must not come back in January.
    opened: stamps(
      r.opened,
      (
        _key, at
      ) => now - at < 366 * 86_400_000
    )
  };
}

const listeners = new Set<() => void>();
/** Where there is no storage (a server render, a test), the choices last as long as the module. */
let memory: PlanChoices = EMPTY_CHOICES;
let cache: { raw: string | null;
  value: PlanChoices } | null = null;

/** The choices as kept now. The same object comes back until something changes (it feeds `useSyncExternalStore`). */
export function getChoices(): PlanChoices {
  const store = storage();

  if ( !store ) {
    return memory;
  }

  let raw: string | null = null;

  try {
    raw = store.getItem( KEY );
  } catch {
    return EMPTY_CHOICES;
  }

  if ( cache && cache.raw === raw ) {
    return cache.value;
  }

  let parsed: unknown = null;

  try {
    parsed = JSON.parse( raw ?? "null" );
  } catch {
    // Not ours: start over.
  }

  cache = {
    raw,
    value: readChoices(
      parsed,
      Date.now()
    )
  };

  return cache.value;
}

/** Change the choices; every reader of this tab is told. */
export function updateChoices( change: ( choices: PlanChoices ) => PlanChoices ): PlanChoices {
  const next = change( getChoices() );
  const store = storage();

  if ( !store ) {
    memory = next;
  }

  try {
    store?.setItem(
      KEY,
      JSON.stringify( next )
    );
  } catch {
    // Storage full or off: the choice lasts as long as the page.
    cache = {
      raw: cache?.raw ?? null,
      value: next
    };
  }

  listeners.forEach( ( listener ) => listener() );

  return getChoices();
}

export function subscribeChoices( listener: () => void ): () => void {
  const onStorage = ( event: StorageEvent ) => {
    if ( event.key === KEY || event.key === null ) {
      listener();
    }
  };

  listeners.add( listener );
  if ( typeof window !== "undefined" ) {
    window.addEventListener(
      "storage",
      onStorage
    );
  }

  return () => {
    listeners.delete( listener );
    if ( typeof window !== "undefined" ) {
      window.removeEventListener(
        "storage",
        onStorage
      );
    }
  };
}

function without(
  held: Record<string, HeldLine>, slot: string
): Record<string, HeldLine> {
  // A line already in Postiz is not un-sent by a gesture on the plan.
  if ( !held[ slot ] || held[ slot ].state === "planned" ) {
    return held;
  }

  const next = {
    ...held
  };

  delete next[ slot ];

  return next;
}

/** «Approve»: fix this proposal on its slot, with the stamp of the words approved. */
export function holdLine(
  slot: string, line: Pick<HeldLine, "proposal" | "postKey" | "stamp" | "beat">
): PlanChoices {
  return updateChoices( ( c ) => ( {
    ...c,
    held: {
      ...c.held,
      [ slot ]: {
        ...line,
        approvedAt: Date.now(),
        state: "waiting"
      }
    }
  } ) );
}

/** Take the approval back and let the slot be proposed for again (a planned line stays: its post is in Postiz). */
export function releaseLine( slot: string ): PlanChoices {
  return updateChoices( ( c ) => ( {
    ...c,
    held: without(
      c.held,
      slot
    )
  } ) );
}

/** Change an approved line's standing (the queue's own writes); nothing when the line is gone. */
export function patchLine(
  slot: string, patch: Partial<Omit<HeldLine, "proposal" | "postKey">>
): PlanChoices {
  return updateChoices( ( c ) => {
    const line = c.held[ slot ];

    if ( !line ) {
      return c;
    }

    const next: HeldLine = {
      ...line,
      ...patch
    };

    // `undefined` in a patch clears the key (an error, the sending mark).
    for ( const key of Object.keys( patch ) as ( keyof typeof patch )[] ) {
      if ( patch[ key ] === undefined ) {
        delete next[ key ];
      }
    }

    return {
      ...c,
      held: {
        ...c.held,
        [ slot ]: next
      }
    };
  } );
}

/** «Another»: pass this proposal over, and unpin the slot it sat on. */
export function passProposal(
  key: string, slot: string
): PlanChoices {
  return updateChoices( ( c ) => {
    const pins = {
      ...c.pins
    };

    delete pins[ slot ];

    return {
      ...c,
      pins,
      held: without(
        c.held,
        slot
      ),
      passed: {
        ...c.passed,
        [ key ]: Date.now()
      }
    };
  } );
}

/** «Skip»: leave this slot empty; `on: false` proposes for it again. */
export function skipSlot(
  slot: string, on = true
): PlanChoices {
  return updateChoices( ( c ) => {
    const skipped = {
      ...c.skipped
    };

    if ( on ) {
      skipped[ slot ] = Date.now();
    } else {
      delete skipped[ slot ];
    }

    return {
      ...c,
      skipped,
      held: on ? without(
        c.held,
        slot
      ) : c.held
    };
  } );
}

/** A series or a recap was opened on Export › Publish: it waits for the gap before coming back. */
export function markOpened( key: string ): PlanChoices {
  return updateChoices( ( c ) => ( {
    ...c,
    opened: {
      ...c.opened,
      [ key ]: Date.now()
    }
  } ) );
}

/** Give a slot a sketch on purpose; null takes the pin back. */
export function pinSlot(
  slot: string, pin: Pin | null
): PlanChoices {
  return updateChoices( ( c ) => {
    const pins = {
      ...c.pins
    };
    const skipped = {
      ...c.skipped
    };

    if ( pin ) {
      pins[ slot ] = pin;
      delete skipped[ slot ];
    } else {
      delete pins[ slot ];
    }

    return {
      ...c,
      pins,
      skipped,
      held: pin ? without(
        c.held,
        slot
      ) : c.held
    };
  } );
}

/** For tests: forget everything, storage or not. */
export function clearPlanStore(): void {
  memory = EMPTY_CHOICES;
  cache = null;
  try {
    storage()?.removeItem( KEY );
  } catch {
    // Nothing kept.
  }
}

/** Forget what was passed over, skipped and pinned; the mix and the gap stay. */
export function resetPlan(): PlanChoices {
  return updateChoices( ( c ) => ( {
    ...c,
    passed: {},
    skipped: {},
    pins: {},
    opened: {},
    // What is already in Postiz stays in the plan until its slot goes by.
    held: Object.fromEntries( Object.entries( c.held ).filter( ( [
      , line
    ] ) => line.state === "planned" ) )
  } ) );
}
