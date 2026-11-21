/**
 * The ONE reading of statistics that the gallery's Plan, «What works» and the
 * agent's commands share: the sends, what is kept of each post, the level —
 * in; what is measured, what the signal rests on, and the signal itself (only
 * at the level that listens) — out. So the Plan view and `plan.get` cannot
 * disagree about what moved.
 *
 * Reads the two kept values (`settings.ts`, `store.ts`) unless they are
 * handed in; asks Postiz nothing.
 */

import type {
  GallerySend
} from "../gallery/sends";
import {
  buildSends, foreignSends
} from "../gallery/sends";
import type {
  GalleryEntry
} from "../gallery/types";
import type {
  PostizChannel, PostizPost
} from "../postiz/client";
import type {
  Publication
} from "../postiz/publishStore";
import type {
  Rhythm
} from "../postiz/rhythm";
import type {
  PlanSignal, PlanSketch
} from "../planner/planner";
import {
  measure, type Measured
} from "./measure";
import {
  getStatsLevel, type StatsLevel
} from "./settings";
import {
  planSignal, signalFacts, type SignalFacts
} from "./signal";
import {
  getStats, type StatsState
} from "./store";

export interface Listening {
  level: StatsLevel;
  measured: Measured;
  facts: SignalFacts;
  /** Undefined unless the level listens: the planner then draws the plan it always drew. */
  signal: PlanSignal | undefined;
}

export function listening( input: {
  sends: readonly GallerySend[];
  catalogue: readonly PlanSketch[];
  rhythm: Rhythm;
  now: number;
  level?: StatsLevel;
  state?: StatsState;
} ): Listening {
  const level = input.level ?? getStatsLevel();
  const measured = measure( {
    sends: level === "off" ? [] : input.sends,
    state: input.state ?? getStats(),
    catalogue: input.catalogue,
    rhythm: input.rhythm,
    now: input.now
  } );
  const facts = signalFacts(
    measured,
    input.rhythm
  );

  return {
    level,
    measured,
    facts,
    signal: level === "listen" ? planSignal(
      facts,
      input.rhythm,
      input.catalogue
    ) : undefined
  };
}

/**
 * The sends statistics know, where no gallery is at hand (the agent's
 * commands): this browser's, and Sketchbook's posts from another device —
 * the gallery's own two lists, with the pieces when they are handed in.
 */
export function knownSends(
  publications: readonly { key: string;
    publication: Publication }[],
  posts: readonly PostizPost[] | null,
  channels: readonly PostizChannel[],
  now: number,
  entries: readonly GalleryEntry[] = []
): GallerySend[] {
  return [
    ...buildSends( {
      publications,
      posts,
      channels,
      entries,
      now
    } ),
    ...( posts ? foreignSends(
      posts,
      publications
    ) : [] )
  ].sort( (
    a, b
  ) => b.at - a.at );
}
