/**
 * The person's choices about the plan (`planner.ts`), kept in THIS browser:
 * the mix, the gap between two posts of one sketch, what was passed over,
 * the slots left empty and the slots pinned. One `localStorage` key; another
 * tab is told through the `storage` event, so a plan an agent changes in the
 * studio's tab redraws in the gallery's.
 */

import {
  DEFAULT_GAP_WEEKS, DEFAULT_MIX, EMPTY_CHOICES, GAP_WEEKS, MIXES, type Mix, type Pin, type PlanChoices
} from "./planner";

const KEY = "sketchbook.plan.v1";
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

    if ( ahead( slot ) && typeof pin.sketchKey === "string" && /^[a-z0-9]+\/[A-Za-z0-9._-]+$/.test( pin.sketchKey ) ) {
      pins[ slot ] = {
        sketchKey: pin.sketchKey,
        by: pin.by === "agent" ? "agent" : "person",
        ...( typeof pin.note === "string" && pin.note.trim() ? {
          note: pin.note.trim().slice(
            0,
            280
          )
        } : {} )
      };
    }
  }

  return {
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
    pins
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
      skipped
    };
  } );
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
      skipped
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
    pins: {}
  } ) );
}
