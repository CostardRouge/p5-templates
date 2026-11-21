"use client";

import React, {
  useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore
} from "react";

import type {
  GallerySend
} from "@/lib/gallery/sends";
import type {
  PostizClient
} from "@/lib/postiz/client";
import {
  DEFAULT_RHYTHM, type Rhythm
} from "@/lib/postiz/rhythm";
import type {
  PlanSignal, PlanSketch
} from "@/lib/planner/planner";
import {
  candidatesOf, measure, type Measured
} from "@/lib/stats/measure";
import {
  formatCount, headline, headlineWord, NO_POST_FIGURES
} from "@/lib/stats/metrics";
import {
  heardPlan
} from "@/lib/stats/plan";
import {
  readPosts
} from "@/lib/stats/reader";
import {
  dueOnLook, dueReadings, RUN_BUDGET
} from "@/lib/stats/schedule";
import {
  DEFAULT_STATS_LEVEL, getStatsLevel, subscribeStatsLevel, type StatsLevel
} from "@/lib/stats/settings";
import {
  EMPTY_STATS, getStats, subscribeStats, type StatsState
} from "@/lib/stats/store";
import {
  PROVIDER_GLYPH
} from "@/components/ChannelChip";
import SendFigures from "./SendFigures";

/** The switch, live — `off` on the server and until the browser's own value is read. */
export function useStatsLevel(): StatsLevel {
  return useSyncExternalStore(
    subscribeStatsLevel,
    getStatsLevel,
    () => DEFAULT_STATS_LEVEL
  );
}

export function useStatsState(): StatsState {
  return useSyncExternalStore(
    subscribeStats,
    getStats,
    () => EMPTY_STATS
  );
}

export interface Stats {
  level: StatsLevel;
  state: StatsState;
  rhythm: Rhythm;
  /** The sends that are out, with what is kept of each post — no pillar nor series (no catalogue here). */
  measured: Measured;
  /** True while Postiz is being asked. */
  reading: boolean;
  /** Why the last reading stopped early, in words; null otherwise. */
  problem: string | null;
  /** How many posts are still due a reading (a run reads a few at a time). */
  due: number;
  /** Read the next few that are due, now — a gesture, never by itself. */
  readDue: ( () => void ) | null;
  /** The sketch sheet's figures under a send; undefined when statistics are off. */
  figures: ( ( send: GallerySend ) => React.ReactNode ) | undefined;
  /** A grid card's figure for its newest send, its network by its mark's letters: `IG 4,210 reached`, or null. */
  cardLine: ( send: GallerySend | undefined ) => string | null;
  /** The Plan's signal for a catalogue; undefined unless the level listens. */
  signalFor: ( ( catalogue: readonly PlanSketch[] ) => PlanSignal | undefined ) | undefined;
}

/**
 * Statistics for a page that shows sends (the gallery, the sheet opened from
 * Export): the level, what is kept, and — only when the level is on and a
 * Postiz is kept — ONE run of the readings that are due when the sends are
 * known, plus the posts of the sketch being looked at. Off, it asks nothing
 * and hands back nothing to draw.
 */
export function useStats( input: {
  sends: readonly GallerySend[];
  client: PostizClient | null;
  rhythm: Rhythm | null;
  /** True once the sends are final (the archive and Postiz are read). */
  known: boolean;
  now: number;
  /** The sketch whose sheet is open, `<engine>/<name>`; null when none. */
  looking?: string | null;
} ): Stats {
  const level = useStatsLevel();
  const state = useStatsState();
  const rhythm = input.rhythm ?? DEFAULT_RHYTHM;
  const on = level !== "off";
  const {
    sends, client, known, now
  } = input;
  const [
    reading,
    setReading
  ] = useState( false );
  const [
    problem,
    setProblem
  ] = useState<string | null>( null );
  const ran = useRef<string | null>( null );

  const run = useCallback(
    async( posts: Parameters<typeof readPosts>[ 1 ] ) => {
      if ( !client || !posts.length ) {
        return;
      }

      setReading( true );
      try {
        const outcome = await readPosts(
          client,
          posts
        );

        setProblem( outcome.stopped );
      } finally {
        setReading( false );
      }
    },
    [
      client
    ]
  );

  // The readings that are due, once per Postiz per page: sparingly (`schedule.ts`).
  useEffect(
    () => {
      if ( !on || !client || !known || ran.current === client.apiBase ) {
        return;
      }

      ran.current = client.apiBase;
      void run( dueReadings(
        candidatesOf(
          sends,
          now
        ),
        getStats(),
        Date.now(),
        client.apiBase
      ) );
    },
    [
      on,
      client,
      known,
      sends,
      now,
      run
    ]
  );

  // Looking at a sketch's sheet reads its posts that have not settled, at most once an hour each.
  const looking = input.looking ?? null;

  useEffect(
    () => {
      if ( !on || !client || !known || !looking ) {
        return;
      }

      // eslint-disable-next-line react-hooks/set-state-in-effect -- the read a sheet's opening asks for
      void run( dueOnLook(
        candidatesOf(
          sends.filter( ( s ) => s.sketchKey === looking ),
          now
        ),
        getStats(),
        Date.now(),
        client.apiBase
      ) );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- when a sheet opens, not whenever the sends are rebuilt
    [
      on,
      client,
      known,
      looking
    ]
  );

  const measured = useMemo(
    () => measure( {
      sends: on ? sends : [],
      state,
      catalogue: null,
      rhythm,
      now
    } ),
    [
      on,
      sends,
      state,
      rhythm,
      now
    ]
  );

  const again = useCallback(
    ( send: GallerySend ) => run( candidatesOf(
      [
        send
      ],
      Date.now()
    ).filter( ( c ) => !NO_POST_FIGURES.has( c.provider ) ) ),
    [
      run
    ]
  );

  const waiting = useMemo(
    () => !on || !client || !known ? [] : dueReadings(
      candidatesOf(
        sends,
        now
      ),
      state,
      now,
      client.apiBase,
      Infinity
    ),
    [
      on,
      client,
      known,
      sends,
      state,
      now
    ]
  );
  const readDue = useCallback(
    () => void run( waiting.slice(
      0,
      RUN_BUDGET
    ) ),
    [
      run,
      waiting
    ]
  );

  const figures = useMemo(
    () => !on ? undefined : ( send: GallerySend ) => {
      const mine = measured.sends.find( ( s ) => s.key === send.key );

      return mine ? (
        <SendFigures
          send={ mine }
          usual={ measured.usual }
          tz={ rhythm.timeZone }
          reading={ reading }
          problem={ problem }
          onAgain={ client ? () => void again( send ) : null }
        />
      ) : null;
    },
    [
      on,
      measured,
      rhythm.timeZone,
      reading,
      problem,
      client,
      again
    ]
  );

  const cardLine = useCallback(
    ( send: GallerySend | undefined ) => {
      const mine = send ? measured.sends.find( ( s ) => s.key === send.key ) : undefined;

      for ( const account of mine?.accounts ?? [] ) {
        const head = account.shown ? headline( account.shown.figures ) : null;

        if ( head ) {
          return `${ PROVIDER_GLYPH[ account.provider ] } ${ formatCount( head.value ) } ${ headlineWord( head ) }`;
        }
      }

      return null;
    },
    [
      measured
    ]
  );

  const signalFor = useMemo(
    () => level !== "listen" ? undefined : ( catalogue: readonly PlanSketch[] ) => heardPlan( {
      sends,
      catalogue,
      rhythm,
      now,
      level,
      state
    } ).signal,
    [
      level,
      sends,
      rhythm,
      now,
      state
    ]
  );

  return {
    level,
    state,
    rhythm,
    measured,
    reading,
    problem,
    due: waiting.length,
    readDue: client && waiting.length ? readDue : null,
    figures,
    cardLine,
    signalFor
  };
}
