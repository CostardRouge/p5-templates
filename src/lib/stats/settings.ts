/**
 * THE switch of statistics (lab 8's three levels, one per-browser setting,
 * off by default):
 *
 * - `off` — Sketchbook reads no figure, shows none, and the Plan is exactly
 *   what it is without this folder. Nothing is asked of Postiz's analytics.
 * - `show` — each post's figures are read and shown where its sends are
 *   (the sketch's sheet, the grid's card, «What works»). The Plan does not move.
 * - `listen` — and the Plan listens: favourites, new sketches and the week's
 *   pillars are reordered within fixed bounds (`signal.ts`), every line saying
 *   what moved it and on which figures.
 *
 * There is no level that listens without showing (lab 8, Q3): an order nobody
 * can read is an order nobody can contradict.
 */

import {
  kept
} from "./kept";

export type StatsLevel = "off" | "show" | "listen";

export const STATS_LEVELS: readonly { id: StatsLevel;
  label: string;
  title: string }[] = [
  {
    id: "off",
    label: "Off",
    title: "Sketchbook reads no figure and shows none; the Plan is drawn from the calendar alone"
  },
  {
    id: "show",
    label: "Figures",
    title: "Each post's figures, read from your Postiz, where its sends are shown; the Plan does not move"
  },
  {
    id: "listen",
    label: "Figures + the Plan listens",
    title: "And the Plan reorders its proposals by them, within fixed bounds, saying why on each line"
  }
];

export const DEFAULT_STATS_LEVEL: StatsLevel = "off";
export const STATS_LEVEL_KEY = "sketchbook.stats.level.v1";

export function readLevel( raw: unknown ): StatsLevel {
  return raw === "show" || raw === "listen" ? raw : DEFAULT_STATS_LEVEL;
}

const store = kept(
  STATS_LEVEL_KEY,
  readLevel
);

export const getStatsLevel = store.get;
export const subscribeStatsLevel = store.subscribe;
export const clearStatsLevel = store.clear;

export function setStatsLevel( level: StatsLevel ): StatsLevel {
  return store.update( () => readLevel( level ) );
}

/** Figures are read and shown. */
export function statsShown( level: StatsLevel = getStatsLevel() ): boolean {
  return level !== "off";
}

/** The Plan listens. */
export function statsListened( level: StatsLevel = getStatsLevel() ): boolean {
  return level === "listen";
}
