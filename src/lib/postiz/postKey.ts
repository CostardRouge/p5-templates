/**
 * Which post a page is writing: a sketch's post is kept under
 * `<engine>/<name>` (`publishStore`), but every REEL (a series, a recap) is
 * built on the same empty host sketch — one draft there meant the next reel
 * opened overwrote the words of the one before, and two reels could not wait
 * in the Plan's queue together.
 *
 * So a reel's DRAFT lives under its own key, `p5/empty-sketch@<proposal key>`
 * (`series:p5/materials`, `recap:2026-11`, `pin:<slot>`). What it SENT stays
 * with the host (`sketchOfPostKey`): the gallery, the counters and the plan
 * read publications by sketch.
 *
 * The page knows which reel it shows because whoever built it said so:
 * `stageReel` before a navigation (it crosses in `sessionStorage`, like the
 * document itself), `setCurrentReel` when the reel is built in place.
 */

export const REEL_HOST_KEY = "p5/empty-sketch";

const SEPARATOR = "@";
const STAGED_KEY = "sketchbook.publish.reel";

export function reelPostKey( proposalKey: string ): string {
  return `${ REEL_HOST_KEY }${ SEPARATOR }${ proposalKey }`;
}

/** The sketch a post key belongs to: `p5/empty-sketch@series:p5/materials` → `p5/empty-sketch`. Pure. */
export function sketchOfPostKey( key: string ): string {
  const cut = key.indexOf( SEPARATOR );

  return cut < 0 ? key : key.slice(
    0,
    cut
  );
}

/** Where a plan proposal's post lives: the sketch's own, or — for a reel — the reel's. Pure. */
export function postKeyOfProposal( proposal: { key: string;
  sketchKey: string;
  reel?: unknown } ): string {
  return proposal.reel ? reelPostKey( proposal.key ) : proposal.sketchKey;
}

let current: string | null = null;
let mounted = 0;
const listeners = new Set<() => void>();

function session(): Storage | null {
  try {
    return typeof sessionStorage === "undefined" ? null : sessionStorage;
  } catch {
    return null;
  }
}

function tell(): void {
  listeners.forEach( ( listener ) => listener() );
}

/** Say which reel the host is about to open on — taken once by its page. */
export function stageReel( proposalKey: string ): void {
  try {
    session()?.setItem(
      STAGED_KEY,
      proposalKey
    );
  } catch {
    // No storage: the reel shares the host's own draft, as before.
  }
}

/** The reel the open host page shows; null for the host by itself, or any other sketch. */
export function currentReel(): string | null {
  return current;
}

export function setCurrentReel( proposalKey: string | null ): void {
  if ( current !== proposalKey ) {
    current = proposalKey;
    tell();
  }
}

/**
 * A sketch page mounted: the host takes the reel staged for it. Answers the
 * cleanup — the reel is forgotten when the page really leaves (a development
 * double mount leaves and comes back at once, and must keep it).
 */
export function mountReel( sketchKey: string ): () => void {
  const store = session();
  let staged: string | null = null;

  try {
    staged = store?.getItem( STAGED_KEY ) ?? null;
    store?.removeItem( STAGED_KEY );
  } catch {
    // Nothing staged.
  }

  mounted += 1;
  if ( sketchKey !== REEL_HOST_KEY ) {
    setCurrentReel( null );
  } else if ( staged ) {
    setCurrentReel( staged );
  }

  return () => {
    mounted -= 1;
    setTimeout(
      () => {
        if ( mounted === 0 ) {
          setCurrentReel( null );
        }
      },
      0
    );
  };
}

/** The key the page's post is kept under: the sketch's, or the reel's it shows. */
export function activePostKey( sketchKey: string ): string {
  return sketchKey === REEL_HOST_KEY && current ? reelPostKey( current ) : sketchKey;
}

export function subscribeReel( listener: () => void ): () => void {
  listeners.add( listener );

  return () => {
    listeners.delete( listener );
  };
}
