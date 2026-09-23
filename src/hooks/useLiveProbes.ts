"use client";

/**
 * The probes the running sketch is publishing right now — as React state that
 * changes only when a probe APPEARS or DISAPPEARS.
 *
 * `probeBridge` receives a snapshot every frame. Turning that into state per
 * frame would be the reconciler thrash the bridges exist to avoid (the same
 * rule `useLiveChannelIds` encodes for interaction channels), so this hook
 * compares the list of names and re-renders on a set change only. A consumer
 * that needs the VALUES — the inspector — subscribes on its own and writes
 * them into the DOM.
 *
 * Mount it where the list is wanted (a picker's panel, the inspector card), so
 * nothing is subscribed the rest of the time.
 */
import {
  useEffect, useRef, useState
} from "react";
import {
  getProbesSnapshot, subscribeProbes, type ProbeEntry, type ProbeSnapshot
} from "@/lib/probeBridge";

/** The static side of an entry: what a list or a picker needs. */
export type LiveProbe = Pick<ProbeEntry, "name" | "shape" | "label" | "unit" | "fold">;

function signatureOf( snapshot: ProbeSnapshot ): string {
  return snapshot.map( ( entry ) => `${ entry.name }:${ entry.shape }:${ entry.fold }` )
    .join( "|" );
}

function staticOf( snapshot: ProbeSnapshot ): LiveProbe[] {
  return snapshot.map( ( entry ) => ( {
    name: entry.name,
    shape: entry.shape,
    label: entry.label,
    unit: entry.unit,
    fold: entry.fold
  } ) );
}

export function useLiveProbes(): LiveProbe[] {
  const [
    probes,
    setProbes
  ] = useState<LiveProbe[]>( () => staticOf( getProbesSnapshot() ) );
  const signature = useRef( signatureOf( getProbesSnapshot() ) );

  useEffect(
    () => {
      const read = ( snapshot: ProbeSnapshot ) => {
        const next = signatureOf( snapshot );

        if ( next === signature.current ) {
          return;
        }

        signature.current = next;
        setProbes( staticOf( snapshot ) );
      };

      // The engine may have published since the initial state was computed.
      read( getProbesSnapshot() );

      return subscribeProbes( read );
    },
    []
  );

  return probes;
}
