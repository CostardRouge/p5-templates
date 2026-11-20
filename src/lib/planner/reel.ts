/**
 * A series or a recap as a DOCUMENT (lab 7's Series and Recap pillars): the
 * empty sketch carrying one `sequence` item — an opening card, then each
 * sketch of the reel as a scene, cut together (`docs/memory/transitions.md`).
 * Nothing new is drawn: this is the document a person would build by hand in
 * the studio, handed over through the gallery's own crossing
 * (`pendingImportOptions`). Pure.
 */

import {
  REEL_HOST, type Proposal
} from "./planner";

/** What the opening card and each sketch get of the loop, in seconds. */
const CARD_SECONDS = 1.5;
const SCENE_SECONDS = 2.5;
/** The loop's bounds (`SketchAnimationSchema`). */
const MAX_SECONDS = 60;

/** One entrance after another, so no two cuts in a row look the same. */
const ENTRANCES = [
  {
    kind: "wipe",
    angle: 0,
    softness: 0.08
  },
  {
    kind: "iris",
    shape: "circle",
    center: {
      x: 0.5,
      y: 0.5
    },
    softness: 0.05
  },
  {
    kind: "wipe",
    angle: 90,
    softness: 0.08
  },
  {
    kind: "wipe",
    angle: 180,
    softness: 0.08
  }
] as const;

/** How long the reel of `scenes` sketches loops, in seconds. */
export function reelSeconds( scenes: number ): number {
  return Math.min(
    MAX_SECONDS,
    Math.round( CARD_SECONDS + scenes * SCENE_SECONDS )
  );
}

/** The document of a series or recap proposal; null for a proposal that is one sketch. */
export function reelDocument( proposal: Pick<Proposal, "reel"> ): Record<string, unknown> | null {
  const reel = proposal.reel;

  if ( !reel || !reel.scenes.length ) {
    return null;
  }

  return {
    name: REEL_HOST.name,
    animation: {
      duration: reelSeconds( reel.scenes.length )
    },
    content: [
      {
        type: "sequence",
        scenes: [
          {
            kind: "splash",
            weight: CARD_SECONDS,
            title: reel.title,
            subtitle: reel.subtitle,
            transition: {
              effect: ENTRANCES[ 1 ]
            }
          },
          ...reel.scenes.map( (
            sketch, i
          ) => ( {
            kind: "sketch",
            sketch,
            settings: {},
            weight: SCENE_SECONDS,
            transition: {
              effect: ENTRANCES[ i % ENTRANCES.length ]
            }
          } ) )
        ]
      }
    ]
  };
}

/**
 * The words a reel's post starts from, for the person to rewrite and approve.
 * No `{link}` nor `{title}`: those pills would name the empty host sketch.
 */
export function reelCaption( proposal: Pick<Proposal, "title" | "pillar" | "reel"> ): string | null {
  if ( !proposal.reel ) {
    return null;
  }

  const count = proposal.reel.sketches.length;

  return [
    proposal.title,
    proposal.pillar === "series" ? `${ count } sketches, one idea pushed further each time.` : `${ count } sketches, cut together.`,
    "",
    "#generativeart #creativecoding"
  ].join( "\n" );
}
