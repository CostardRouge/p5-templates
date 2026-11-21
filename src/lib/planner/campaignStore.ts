/**
 * The campaigns the person made (`campaign.ts`), kept in THIS browser beside
 * the Plan's choices (`planStore.ts`) and by the same rules: one
 * `localStorage` key, validated on every read, another tab told through the
 * `storage` event — so a campaign an agent proposes in the studio's tab shows
 * in the gallery's Plan.
 *
 * A key of its own rather than a member of the Plan's choices: «Reset» there
 * forgets what was passed over and pinned, and must not drop a campaign.
 */

import {
  CAMPAIGN_DAYS, CAMPAIGN_TEMPLATES, TEMPLATES, type Campaign, type CampaignTemplate
} from "./campaign";

const KEY = "sketchbook.campaigns.v1";
const SKETCH_KEY = /^[a-z0-9]+\/[A-Za-z0-9._-]+$/;
const ID = /^[A-Za-z0-9._-]{1,120}$/;

/** More than this is not a plan any more; the oldest go first. */
export const CAMPAIGN_CAP = 40;

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

/** Stored campaigns read back, whatever they hold; one whose day 0 is too old is dropped. Pure. */
export function readCampaigns(
  raw: unknown, now: number
): Campaign[] {
  const list = Array.isArray( raw ) ? raw : Array.isArray( record( raw ).campaigns ) ? record( raw ).campaigns as unknown[] : [];
  const out: Campaign[] = [];
  const seen = new Set<string>();

  for ( const value of list ) {
    const c = record( value );
    const start = typeof c.start === "string" ? Date.parse( c.start ) : NaN;

    if (
      typeof c.id !== "string" || !ID.test( c.id ) || seen.has( c.id ) ||
      typeof c.sketchKey !== "string" || !SKETCH_KEY.test( c.sketchKey ) ||
      !CAMPAIGN_TEMPLATES.includes( c.template as CampaignTemplate ) ||
      !Number.isFinite( start ) || now - start > CAMPAIGN_DAYS * 86_400_000
    ) {
      continue;
    }

    const beats = TEMPLATES[ c.template as CampaignTemplate ].beats.map( ( spec ) => spec.id );
    const opened: Campaign[ "opened" ] = {};

    for ( const [
      beat,
      mark
    ] of Object.entries( record( c.opened ) ) ) {
      const m = record( mark );

      if ( beats.includes( beat ) && typeof m.at === "number" && Number.isFinite( m.at ) && typeof m.slot === "string" && Number.isFinite( Date.parse( m.slot ) ) ) {
        opened[ beat ] = {
          at: m.at,
          slot: new Date( Date.parse( m.slot ) ).toISOString()
        };
      }
    }

    seen.add( c.id );
    out.push( {
      id: c.id,
      sketchKey: c.sketchKey,
      template: c.template as CampaignTemplate,
      start: new Date( start ).toISOString(),
      createdAt: typeof c.createdAt === "number" && Number.isFinite( c.createdAt ) ? c.createdAt : start,
      by: c.by === "agent" ? "agent" : "person",
      off: Array.isArray( c.off ) ? beats.filter( ( beat ) => ( c.off as unknown[] ).includes( beat ) ) : [],
      opened
    } );
  }

  return out.sort( (
    a, b
  ) => a.createdAt - b.createdAt ).slice( -CAMPAIGN_CAP );
}

const EMPTY: Campaign[] = [];
const listeners = new Set<() => void>();
/** Where there is no storage (a server render, a test), campaigns last as long as the module. */
let memory: Campaign[] = EMPTY;
let cache: { raw: string | null;
  value: Campaign[] } | null = null;

/** The campaigns as kept now. The same array comes back until something changes (it feeds `useSyncExternalStore`). */
export function getCampaigns(): Campaign[] {
  const store = storage();

  if ( !store ) {
    return memory;
  }

  let raw: string | null = null;

  try {
    raw = store.getItem( KEY );
  } catch {
    return EMPTY;
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

  const value = readCampaigns(
    parsed,
    Date.now()
  );

  cache = {
    raw,
    value: value.length ? value : EMPTY
  };

  return cache.value;
}

/** What a server render reads: no campaign. */
export function noCampaigns(): Campaign[] {
  return EMPTY;
}

function update( change: ( campaigns: Campaign[] ) => Campaign[] ): Campaign[] {
  const next = change( getCampaigns() );
  const store = storage();

  if ( !store ) {
    memory = next;
  }

  try {
    store?.setItem(
      KEY,
      JSON.stringify( {
        campaigns: next
      } )
    );
  } catch {
    // Storage full or off: the campaign lasts as long as the page.
    cache = {
      raw: cache?.raw ?? null,
      value: next
    };
  }

  listeners.forEach( ( listener ) => listener() );

  return getCampaigns();
}

export function subscribeCampaigns( listener: () => void ): () => void {
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

/** Keep a campaign; one of the same id is replaced. */
export function addCampaign( campaign: Campaign ): Campaign[] {
  return update( ( list ) => [
    ...list.filter( ( c ) => c.id !== campaign.id ),
    campaign
  ] );
}

/** Drop a campaign: its lines leave the Plan, nothing already posted is touched. */
export function dropCampaign( id: string ): Campaign[] {
  return update( ( list ) => list.filter( ( c ) => c.id !== id ) );
}

/** «Another» on a beat: leave it out of its campaign; `off: false` puts it back. */
export function passBeat(
  id: string, beat: string, off = true
): Campaign[] {
  return update( ( list ) => list.map( ( c ) => c.id !== id
    ? c
    : {
      ...c,
      off: off
        ? [
          ...new Set( [
            ...c.off,
            beat
          ] )
        ]
        : c.off.filter( ( b ) => b !== beat )
    } ) );
}

/** A beat was opened on Export › Publish, on this slot: the post made that day is its own. */
export function markBeatOpened(
  id: string, beat: string, slot: string
): Campaign[] {
  return update( ( list ) => list.map( ( c ) => c.id !== id
    ? c
    : {
      ...c,
      opened: {
        ...c.opened,
        [ beat ]: {
          at: Date.now(),
          slot
        }
      }
    } ) );
}

/** For tests: forget everything, storage or not. */
export function clearCampaignStore(): void {
  memory = EMPTY;
  cache = null;
  try {
    storage()?.removeItem( KEY );
  } catch {
    // Nothing kept.
  }
}
