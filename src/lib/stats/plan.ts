/**
 * What the plan's two readers — the gallery's Plan view and the agent's
 * `plan.get` — need of statistics, in one call: the signal for the planner
 * (undefined unless the level listens) and what to SAY about it. Importing
 * this file is the whole of statistics' hold on the plan.
 */

import type {
  GallerySend
} from "../gallery/sends";
import type {
  Rhythm
} from "../postiz/rhythm";
import type {
  PlanSignal, PlanSketch
} from "../planner/planner";
import {
  listening, type Listening
} from "./listen";
import type {
  StatsLevel
} from "./settings";
import {
  quietReason, signalLines
} from "./signal";
import type {
  StatsState
} from "./store";

/** What is said of the listening, under the Plan and in `plan.get`. */
export interface PlanListening {
  level: StatsLevel;
  /** Sends with an index: what every move rests on. */
  measured: number;
  /** What moves, each with its figures; empty when nothing does. */
  moving: string[];
  note: string;
}

export const OFF_NOTE = "Statistics are off in this browser (menu › Publishing › Results): the plan is drawn from the calendar alone.";
export const SHOW_NOTE = "Figures are read and shown, but the plan does not listen to them (menu › Publishing › Results).";
export const BOUND_NOTE = "The figures only reorder proposals, within fixed bounds; they approve and schedule nothing.";

export function saidOf( l: Listening ): PlanListening {
  if ( l.level !== "listen" ) {
    return {
      level: l.level,
      measured: l.facts.measured,
      moving: [],
      note: l.level === "off" ? OFF_NOTE : SHOW_NOTE
    };
  }

  const moving = signalLines( l.facts );

  return {
    level: l.level,
    measured: l.facts.measured,
    moving,
    note: moving.length ? BOUND_NOTE : quietReason( l.facts )
  };
}

export function heardPlan( input: {
  sends: readonly GallerySend[];
  catalogue: readonly PlanSketch[];
  rhythm: Rhythm;
  now: number;
  level?: StatsLevel;
  state?: StatsState;
} ): { signal: PlanSignal | undefined;
  listening: PlanListening;
  heard: Listening; } {
  const heard = listening( input );

  return {
    signal: heard.signal,
    listening: saidOf( heard ),
    heard
  };
}
