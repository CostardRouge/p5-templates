/**
 * The Plan's render queue as it stands (lab 7, pass 3): which approved lines
 * one «Render & schedule» is going through, in order, and where it is.
 *
 * Rendering only happens on a sketch's page (the engine, the recorder) and
 * the Plan lives on `/gallery`, so a run WALKS the studio from sketch to
 * sketch. Its state therefore lives outside any page:
 *
 * - the RUN in `localStorage` — it survives a closed tab, and the gallery in
 *   another tab follows it through the `storage` event;
 * - WHO runs it in `sessionStorage` — the tab that was told to, and no other:
 *   a sketch opened in a second tab must not start rendering the queue.
 *
 * A running run with no heartbeat is a run whose tab went away: nothing is
 * lost (each line's standing is on the line, `planStore`), and it can be
 * resumed from where it stopped.
 */

const KEY = "sketchbook.plan.run.v1";
const TAB_KEY = "sketchbook.plan.run.tab";

/** A run that has not said anything for this long has no tab any more. */
export const RUN_SILENT_MS = 12_000;

export interface PlanRun {
  id: string;
  startedAt: number;
  /** The lines, by slot (ISO), in the order they are rendered. */
  slots: string[];
  /** The line being worked on. */
  index: number;
  state: "running" | "done" | "cancelled";
  /** Where the tab goes once it is over: the page that started it. */
  origin: string;
  /** The last sign of life, ms. */
  beat: number;
  /** What the current line is doing, said short: `rendering`, `sending`… */
  phase: string;
  /** 0–1 of the current line's render, when known. */
  progress: number | null;
}

function local(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

function session(): Storage | null {
  try {
    return typeof sessionStorage === "undefined" ? null : sessionStorage;
  } catch {
    return null;
  }
}

/** A stored run read back, whatever it holds. Pure. */
export function readRun( raw: unknown ): PlanRun | null {
  const r = raw && typeof raw === "object" && !Array.isArray( raw ) ? raw as Record<string, unknown> : null;

  if ( !r || typeof r.id !== "string" || !Array.isArray( r.slots ) ) {
    return null;
  }

  const slots = r.slots.filter( ( slot ): slot is string => typeof slot === "string" && Number.isFinite( Date.parse( slot ) ) );
  const index = typeof r.index === "number" && r.index >= 0 ? Math.floor( r.index ) : 0;

  return {
    id: r.id,
    startedAt: typeof r.startedAt === "number" ? r.startedAt : 0,
    slots,
    index,
    state: r.state === "running" && index < slots.length ? "running" : r.state === "cancelled" ? "cancelled" : "done",
    origin: typeof r.origin === "string" && r.origin.startsWith( "/" ) && !r.origin.startsWith( "//" ) ? r.origin : "/gallery",
    beat: typeof r.beat === "number" ? r.beat : 0,
    phase: typeof r.phase === "string" ? r.phase.slice(
      0,
      80
    ) : "",
    progress: typeof r.progress === "number" && r.progress >= 0 && r.progress <= 1 ? r.progress : null
  };
}

/** True when a run is going and its tab still speaks. Pure. */
export function runAlive(
  run: PlanRun | null, now: number
): boolean {
  return Boolean( run && run.state === "running" && now - run.beat < RUN_SILENT_MS );
}

/** True when a run was left going by a tab that is gone: it can be resumed. Pure. */
export function runInterrupted(
  run: PlanRun | null, now: number
): boolean {
  return Boolean( run && run.state === "running" && now - run.beat >= RUN_SILENT_MS );
}

const listeners = new Set<() => void>();
let memory: PlanRun | null = null;
let cache: { raw: string | null;
  value: PlanRun | null } | null = null;

export function getRun(): PlanRun | null {
  const store = local();

  if ( !store ) {
    return memory;
  }

  let raw: string | null = null;

  try {
    raw = store.getItem( KEY );
  } catch {
    return memory;
  }
  if ( cache && cache.raw === raw ) {
    return cache.value;
  }

  let parsed: unknown = null;

  try {
    parsed = JSON.parse( raw ?? "null" );
  } catch {
    // Not ours.
  }
  cache = {
    raw,
    value: readRun( parsed )
  };

  return cache.value;
}

function write( run: PlanRun | null ): void {
  const store = local();

  memory = run;
  try {
    if ( run ) {
      store?.setItem(
        KEY,
        JSON.stringify( run )
      );
    } else {
      store?.removeItem( KEY );
    }
  } catch {
    // Storage off: the run lasts as long as the page.
  }
  listeners.forEach( ( listener ) => listener() );
}

/** Change the run, if it is still the one `id` names. */
export function updateRun(
  id: string, change: ( run: PlanRun ) => PlanRun
): PlanRun | null {
  const run = getRun();

  if ( !run || run.id !== id ) {
    return run;
  }
  write( change( run ) );

  return getRun();
}

/** Begin a run over these lines, owned by THIS tab. */
export function startRun(
  slots: readonly string[], origin: string
): PlanRun {
  const run: PlanRun = {
    id: `run-${ Date.now().toString( 36 ) }-${ Math.random().toString( 36 )
      .slice(
        2,
        8
      ) }`,
    startedAt: Date.now(),
    slots: [
      ...slots
    ],
    index: 0,
    state: "running",
    origin,
    beat: Date.now(),
    phase: "starting",
    progress: null
  };

  claimRun( run.id );
  write( run );

  return run;
}

/** This tab takes the run over (a resume after its tab was closed). */
export function claimRun( id: string ): void {
  try {
    session()?.setItem(
      TAB_KEY,
      id
    );
  } catch {
    // No session storage: nothing can own a run here.
  }
}

/** True when THIS tab is the one running `run`. */
export function ownsRun( run: PlanRun | null ): boolean {
  try {
    return Boolean( run && session()?.getItem( TAB_KEY ) === run.id );
  } catch {
    return false;
  }
}

/** Stop the run: the line being rendered is dropped, what is already planned stays planned. */
export function cancelRun(): void {
  const run = getRun();

  if ( run?.state === "running" ) {
    write( {
      ...run,
      state: "cancelled",
      beat: Date.now(),
      phase: "cancelled",
      progress: null
    } );
  }
}

/** Forget a finished or cancelled run (its lines keep their own standing). */
export function clearRun(): void {
  if ( getRun()?.state !== "running" ) {
    write( null );
  }
}

export function subscribeRun( listener: () => void ): () => void {
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

/** For tests. */
export function resetRunStore(): void {
  memory = null;
  cache = null;
  try {
    local()?.removeItem( KEY );
    session()?.removeItem( TAB_KEY );
  } catch {
    // Nothing kept.
  }
}
