"use client";

import React, {
  useSyncExternalStore
} from "react";

import {
  getChoices, subscribeChoices
} from "@/lib/planner/planStore";
import {
  EMPTY_CHOICES
} from "@/lib/planner/planner";
import {
  cancelRun, getRun, ownsRun, subscribeRun
} from "@/lib/planner/runStore";

/**
 * The Plan's render queue, said on the page it is working on (lab 7, pass 3):
 * the tab moves from sketch to sketch by itself, so it must say what it is
 * doing and offer the way out. Shown only in the tab that runs the queue.
 */
export default function PlanRunBanner() {
  const run = useSyncExternalStore(
    subscribeRun,
    getRun,
    () => null
  );
  const choices = useSyncExternalStore(
    subscribeChoices,
    getChoices,
    () => EMPTY_CHOICES
  );

  if ( !run || run.state !== "running" || !ownsRun( run ) ) {
    return null;
  }

  const line = choices.held?.[ run.slots[ run.index ] ];
  const percent = run.progress === null ? "" : ` ${ Math.round( run.progress * 100 ) } %`;

  return (
    <div
      role="status"
      data-plan-run-banner
      className="fixed inset-x-0 bottom-3 z-[90] mx-auto flex w-[min(34rem,calc(100vw-1.5rem))] items-center gap-3 rounded-xl border border-border bg-background px-3 py-2 shadow-lg"
    >
      <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full border-2 border-blue-500 border-r-transparent motion-safe:animate-spin" aria-hidden />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-xs font-semibold text-foreground">
          Plan · line {Math.min(
            run.index + 1,
            run.slots.length
          )} of {run.slots.length}{line ? ` · ${ line.proposal.title }` : ""}
        </span>
        <span className="truncate font-mono text-[11px] text-foreground/60">{run.phase}{percent} — keep this tab open and visible</span>
      </span>
      <button
        type="button"
        data-plan-run-stop
        onClick={ () => cancelRun() }
        className="inline-flex h-8 shrink-0 items-center rounded-lg border border-border bg-background px-3 text-xs font-medium text-foreground transition-colors hover:bg-hover"
        title="Stop the queue: this line is dropped and stays approved, what is already scheduled stays scheduled"
      >
        Stop
      </button>
    </div>
  );
}
