/**
 * Variations from the tab (lab 9, his answer to Q4, `docs/memory/publishing.md`):
 * an agent PROPOSES other looks of the open sketch — named moves drawn from
 * its own form (`src/lib/variations/propose.ts`), or values of its own —,
 * LOOKS at them in one picture, and KEEPS the good ones in the gallery as
 * candidates. The person accepts or discards them there; only accepted pieces
 * enter a Variations post, so nothing drawn at random ever reaches one.
 *
 * There is no `variations.accept`, on purpose: accepting is the person's.
 *
 * Every candidate is tried through the form (`setValue`, the controls' own
 * funnel) and the form is put back as it was before the command answers.
 */
import {
  CommandError, isRecord, type CommandSpec, type ImageResult
} from "../../../../scripts/mcp/registry.ts";
import {
  checkSketchOptions
} from "../../../../scripts/mcp/sketchForm.ts";
import {
  keepPiece
} from "../../gallery/keep";
import {
  variationsDocument, variationsOf
} from "../../variations/kept";
import {
  allCandidates, DEFAULT_CANDIDATES, findCandidate, MAX_CANDIDATES, MOVES, proposeVariations, type Candidate
} from "../../variations/propose";
import {
  leafWrites, sketchBase, type StudioHandles
} from "../handles";
import {
  settle, targetSlide
} from "./sketchCommands";

const SLIDE_PARAM = {
  slide: {
    type: "number" as const,
    description: "Slide index (default: the active slide, or the root when there are no slides)",
    min: 0,
    max: 999,
    integer: true,
    optional: true
  }
};

/** A carousel takes at least this many accepted pieces when built by hand, and at most this many. */
const BUILD_MIN = 2;
const BUILD_MAX = 5;

function sketchValues(
  h: StudioHandles, slide: number | undefined
): Record<string, unknown> {
  const values = h.getValues( sketchBase( slide ) );

  return isRecord( values ) ? values : h.formValues;
}

/**
 * Until what the form holds has reached the sketch: the form hands its values
 * over on an animation frame, so three of them — or, in a tab that paints no
 * frame, a short wait rather than a hang (`docs/memory/recording.md`: nothing
 * may await a bare frame).
 */
export function landed(): Promise<void> {
  return new Promise( ( resolve ) => {
    const frame = typeof requestAnimationFrame === "function" ? requestAnimationFrame : null;
    const timer = setTimeout(
      resolve,
      frame ? 500 : 0
    );

    frame?.( () => frame( () => frame( () => {
      clearTimeout( timer );
      resolve();
    } ) ) );
  } );
}

/** One thing to try: a candidate of the form, or values the agent composed, checked against the same controls. */
interface Trial {
  id: string;
  label: string;
  values: Record<string, unknown>;
}

function candidateOrRefuse(
  h: StudioHandles, slide: number | undefined, id: string
): Candidate {
  const found = findCandidate(
    h.formConfiguration,
    sketchValues(
      h,
      slide
    ),
    id
  );

  if ( !found ) {
    throw new CommandError(
      "invalid",
      `no candidate "${ id }" for this sketch as it is now — variations.propose lists them (an id names a control and a value: it changes when the form does)`
    );
  }

  return found;
}

function customTrial(
  h: StudioHandles, slide: number | undefined, values: unknown, label: unknown
): Trial {
  if ( !isRecord( values ) || !Object.keys( values ).length ) {
    throw new CommandError(
      "invalid",
      "values must be a nested subset of sketch.describe, e.g. { \"render\": { \"palette\": \"sunset\" } }"
    );
  }

  checkSketchOptions(
    h.formConfiguration,
    sketchValues(
      h,
      slide
    ),
    values
  );

  return {
    id: "custom",
    label: typeof label === "string" && label.trim() ? label.trim() : leafWrites(
      "",
      values
    ).map( ( [
      path,
      value
    ] ) => `${ path } → ${ typeof value === "object" ? JSON.stringify( value ) : String( value ) }` )
      .join( ", " )
      .slice(
        0,
        160
      ),
    values
  };
}

/**
 * Show `trial` on the canvas, run `look`, and put the form back — whatever
 * happens. The frame looked at is drawn AFTER the values landed (a seek to
 * the same position redraws it).
 */
async function withTrial<T>(
  h: StudioHandles, slide: number | undefined, trial: Trial, position: number | null, look: () => Promise<T>
): Promise<T> {
  const base = sketchBase( slide );
  const writes = leafWrites(
    base,
    trial.values
  );
  const before = writes.map( ( [
    path
  ] ) => [
    path,
    structuredClone( h.getValues( path ) )
  ] as const );

  try {
    for ( const [
      path,
      value
    ] of writes ) {
      h.setValue(
        path,
        value
      );
    }
    await landed();
    if ( position !== null ) {
      h.playback.seek( position );
    }
    await settle();

    return await look();
  } finally {
    for ( const [
      path,
      value
    ] of before ) {
      h.setValue(
        path,
        value
      );
    }
    await landed();
  }
}

/** Pause, do, and put the transport back where the person left it. */
async function paused<T>(
  h: StudioHandles, at: number | undefined, fn: ( position: number | null ) => Promise<T>
): Promise<T> {
  const wasPlaying = h.playback.isPlaying();
  const wasAt = h.playback.progress();

  try {
    h.playback.pause();

    return await fn( at ?? wasAt );
  } finally {
    if ( wasAt !== null ) {
      h.playback.seek( wasAt );
    }
    if ( wasPlaying ) {
      h.playback.play();
    }
  }
}

const AT_PARAM = {
  at: {
    type: "number" as const,
    description: "Loop position to look at, 0–1 (default: where the tab is)",
    min: 0,
    max: 1,
    optional: true
  }
};

export function variationCommands( h: StudioHandles ): CommandSpec[] {
  const [
    engine,
    ...rest
  ] = h.sketchId.split( "/" );
  const name = rest[ rest.length - 1 ] ?? "";
  const category = rest.length > 1 ? rest[ 0 ] : null;
  const sketchKey = `${ engine }/${ name }`;

  return [
    {
      id: "variations.propose",
      title: "Propose variations of the sketch",
      description: "Other LOOKS of the open sketch, each ONE named move on its own controls: another palette, another choice of a select (a mode, a shape), an amount taken to the other end of its range, another seed, a switch flipped — taken in turn so a few candidates show different kinds of change. Nothing is drawn at random and nothing is written: the same form gives the same list. Answers { candidates: [{ candidate, move, label, values }], available } — `values` is the delta sketch.set takes, so you may also compose your own. Then variations.sheet shows them in one picture, and variations.keep keeps a good one in the gallery as a CANDIDATE the person accepts or discards.",
      params: {
        count: {
          type: "number",
          description: `How many (default ${ DEFAULT_CANDIDATES })`,
          min: 1,
          max: MAX_CANDIDATES,
          integer: true,
          optional: true
        },
        move: {
          type: "string",
          description: "Only this kind of move",
          enum: [
            ...MOVES
          ],
          optional: true
        },
        ...SLIDE_PARAM
      },
      run( params ) {
        const slide = targetSlide(
          h,
          params.slide
        );
        const values = sketchValues(
          h,
          slide
        );
        const count = ( params.count as number | undefined ) ?? DEFAULT_CANDIDATES;
        const all = allCandidates(
          h.formConfiguration,
          values
        );
        const candidates = params.move === undefined
          ? proposeVariations(
            h.formConfiguration,
            values,
            count
          )
          : all[ params.move as Candidate[ "move" ] ].slice(
            0,
            count
          );

        return {
          sketch: h.sketchId,
          candidates: candidates.map( ( c ) => ( {
            candidate: c.id,
            move: c.move,
            label: c.label,
            values: c.values
          } ) ),
          available: Object.fromEntries( MOVES.map( ( move ) => [
            move,
            all[ move ].length
          ] ) ),
          note: candidates.length
            ? "Candidates are a starting grid, not a verdict: look at them (variations.sheet), keep only what reads as another look of the same piece, and compose your own values where a single move is too timid."
            : "This sketch's form has no palette, select, ranged slider nor switch to move — compose values by hand from sketch.describe, if anything."
        };
      }
    },
    {
      id: "variations.sheet",
      title: "Look at variations side by side",
      description: "ONE picture of several variations of the open sketch, each tried in turn at the same loop position and labelled with its number and what it changes — the first tile is the sketch as it is. Give `candidates` (ids from variations.propose) or nothing for the first ones proposed. The form is put back as it was, and the transport where it was. Look before you keep.",
      params: {
        candidates: {
          type: "strings",
          description: "Candidate ids from variations.propose (at most 11); default: the first proposed",
          optional: true
        },
        count: {
          type: "number",
          description: "Without `candidates`: how many of the proposed ones (default 5)",
          min: 1,
          max: 11,
          integer: true,
          optional: true
        },
        ...AT_PARAM,
        maxEdge: {
          type: "number",
          description: "Longest edge of the whole sheet handed back, px (default 1536)",
          min: 64,
          max: 4096,
          integer: true,
          optional: true
        },
        ...SLIDE_PARAM
      },
      async run( params ): Promise<ImageResult> {
        const slide = targetSlide(
          h,
          params.slide
        );
        const ids = Array.isArray( params.candidates ) ? params.candidates.map( String ) : null;

        if ( ids && ( !ids.length || ids.length > 11 ) ) {
          throw new CommandError(
            "invalid",
            `a sheet takes 1 to 11 candidates — ${ ids.length } given`
          );
        }

        const trials: Trial[] = ids
          ? ids.map( ( id ) => candidateOrRefuse(
            h,
            slide,
            id
          ) )
          : proposeVariations(
            h.formConfiguration,
            sketchValues(
              h,
              slide
            ),
            ( params.count as number | undefined ) ?? 5
          );

        if ( !trials.length ) {
          throw new CommandError(
            "unavailable",
            "this sketch's form has nothing to vary — variations.propose says why"
          );
        }

        const frames = await paused(
          h,
          params.at as number | undefined,
          async( position ) => {
            const out: { blob: Blob;
              label: string }[] = [];
            const shoot = async( label: string ) => {
              const blob = await h.snapshot();

              if ( !blob ) {
                throw new CommandError(
                  "unavailable",
                  `the sketch had no frame to read for "${ label }"`
                );
              }
              out.push( {
                blob,
                label
              } );
            };

            if ( position !== null ) {
              h.playback.seek( position );
            }
            await settle();
            await shoot( "0 · as it is" );

            for ( const [
              i,
              trial
            ] of trials.entries() ) {
              await withTrial(
                h,
                slide,
                trial,
                position,
                () => shoot( `${ i + 1 } · ${ trial.label }`.slice(
                  0,
                  48
                ) )
              );
            }

            return out;
          }
        );

        return h.contactSheet(
          frames,
          ( params.maxEdge as number | undefined ) ?? 1536,
          "jpeg",
          `${ h.sketchId } — tile 0 is the sketch as it is; then ${ trials.map( (
            trial, i
          ) => `${ i + 1 } = ${ trial.id } (${ trial.label })` ).join( "; " ) }. The form is back as it was. variations.keep { candidate } keeps one as a candidate for the person to accept.`
        );
      }
    },
    {
      id: "variations.keep",
      title: "Keep a variation as a candidate",
      description: "Keep ONE variation of the open sketch in the gallery, marked as a CANDIDATE: the whole document with the variation applied, plus a thumbnail of it. Give `candidate` (an id from variations.propose) or your own `values` (a nested delta, checked against the controls like sketch.set — refused out of range, never clamped). The person then accepts or discards it in the gallery or in the Plan; a Variations post is built from accepted pieces only, and you cannot accept one. The form is put back as it was. Keep what you LOOKED at (variations.sheet) and judged a real other look — not a batch.",
      params: {
        candidate: {
          type: "string",
          description: "A candidate id from variations.propose",
          optional: true
        },
        values: {
          type: "object",
          description: "Or your own delta, e.g. { \"render\": { \"palette\": \"sunset\", \"count\": 120 } }",
          optional: true
        },
        label: {
          type: "string",
          description: "What changes, for the person — one short line (default: the candidate's own label)",
          optional: true
        },
        title: {
          type: "string",
          description: "A title for the gallery entry",
          optional: true
        },
        ...AT_PARAM,
        ...SLIDE_PARAM
      },
      async run( params ) {
        const slide = targetSlide(
          h,
          params.slide
        );

        if ( ( params.candidate === undefined ) === ( params.values === undefined ) ) {
          throw new CommandError(
            "invalid",
            "give one of candidate or values"
          );
        }

        const trial: Trial = params.candidate !== undefined
          ? candidateOrRefuse(
            h,
            slide,
            String( params.candidate )
          )
          : customTrial(
            h,
            slide,
            params.values,
            params.label
          );
        const label = typeof params.label === "string" && params.label.trim() ? params.label.trim() : trial.label;
        const result = await paused(
          h,
          params.at as number | undefined,
          ( position ) => withTrial(
            h,
            slide,
            trial,
            position,
            async() => keepPiece(
              h.gallery.store,
              {
                engine,
                category,
                name,
                options: h.getValues(),
                origin: "agent",
                title: params.title as string | undefined,
                thumbnail: await h.gallery.thumbnail(),
                variation: {
                  state: "candidate",
                  by: "agent",
                  label
                }
              }
            )
          )
        );

        return {
          id: result.entry.id,
          sketch: result.entry.sketch,
          label,
          state: result.entry.variation?.state ?? "candidate",
          kept: result.kept,
          note: result.kept
            ? "Kept as a candidate. The person accepts or discards it in the gallery (its sketch's sheet) or on the campaign's Variations line in the Plan — only then can it be posted."
            : "The gallery's newest piece of this sketch already held this exact document; it now wears the candidate mark unless the person had already decided on it."
        };
      }
    },
    {
      id: "variations.list",
      title: "List the kept variations",
      description: "The variations of the open sketch kept in the gallery, accepted first: id, state (candidate — waiting for the person — or accepted), label, who proposed it. gallery.thumbnail shows one, gallery.open reopens one, gallery.remove discards one YOU proposed and no longer stand by. Answers also how many a Variations post still needs.",
      async run() {
        const entries = variationsOf(
          await h.gallery.store.entries(),
          sketchKey
        );
        const accepted = entries.filter( ( e ) => e.variation!.state === "accepted" ).length;

        return {
          sketch: h.sketchId,
          accepted,
          candidates: entries.length - accepted,
          variations: entries.map( ( entry ) => ( {
            id: entry.id,
            at: new Date( entry.at ).toISOString(),
            state: entry.variation!.state,
            by: entry.variation!.by,
            label: entry.variation!.label ?? "",
            title: entry.title
          } ) ),
          note: accepted >= 3
            ? "Enough accepted for a Variations carousel (3 to 5)."
            : `A Variations carousel takes 3 accepted pieces — ${ accepted } so far. Accepting is the person's: propose, they choose.`
        };
      }
    },
    {
      id: "variations.build",
      title: "Build the variations carousel",
      description: `Build the Variations piece NOW on the open sketch from the pieces the person ACCEPTED: one slide per accepted variation (the ${ BUILD_MAX } oldest at most), each with its own settings — a carousel once exported as stills, a cut from look to look as a video. Refused with fewer than ${ BUILD_MIN } accepted pieces: candidates do not count, and nothing here accepts one. It replaces this tab's document: pass discard: true to leave unsaved changes behind. Nothing is planned, approved or sent.`,
      params: {
        discard: {
          type: "boolean",
          description: "Leave this tab's unsaved changes behind",
          optional: true
        }
      },
      async run( params ) {
        const entries = variationsOf(
          await h.gallery.store.entries(),
          sketchKey
        );
        const document = variationsDocument(
          entries,
          BUILD_MIN,
          BUILD_MAX
        );

        if ( !document ) {
          const accepted = entries.filter( ( e ) => e.variation!.state === "accepted" ).length;

          throw new CommandError(
            "unavailable",
            `${ accepted } accepted ${ accepted === 1 ? "variation" : "variations" } of this sketch — a carousel takes ${ BUILD_MIN }. ${ entries.length - accepted } ${ entries.length - accepted === 1 ? "candidate waits" : "candidates wait" } for the person's yes (variations.list).`
          );
        }
        if ( h.history.canUndo() && !params.discard ) {
          throw new CommandError(
            "invalid",
            "this tab has changes that are not saved — building the carousel replaces its document; pass discard: true to go anyway"
          );
        }

        const applied = h.gallery.importDocument( document );

        if ( !applied.ok ) {
          throw new CommandError(
            "failed",
            `the carousel could not be built: ${ applied.reason }`
          );
        }

        return {
          sketch: h.sketchId,
          slides: ( document.slides as { name: string }[] ).map( ( s ) => s.name ),
          note: "slides.list shows them; export.variants and export.add choose how they go out (stills over the slides make a carousel)."
        };
      }
    }
  ];
}
