"use client";

import React, {
  useState
} from "react";
import clsx from "clsx";
import {
  PILL_FAMILY_LABEL, type PillContext, type PillDef, type PillFamily
} from "@/lib/postiz/pills";
import {
  PILL_MIME, PillDot
} from "./PillEditor";

const FAMILIES: PillFamily[] = [
  "sketch",
  "piece",
  "post",
  "mine"
];

/** The pills used last in this tab, most recent first — a convenience, never stored. */
let recent: string[] = [
  "title",
  "link",
  "date",
  "categoryTag",
  "phrase:house",
  "note"
];

export function noteRecent( key: string ): void {
  recent = [
    key,
    ...recent.filter( ( k ) => k !== key )
  ].slice(
    0,
    8
  );
}

export function recentPills(): readonly string[] {
  return recent;
}

function Item( {
  def, ctx, onPick
}: {
  def: PillDef;
  ctx: PillContext;
  onPick: ( key: string ) => void;
} ) {
  const value = def.value(
    ctx,
    {}
  );

  return (
    <button
      type="button"
      draggable
      onDragStart={ ( e ) => {
        e.dataTransfer.setData(
          PILL_MIME,
          JSON.stringify( {
            key: def.key
          } )
        );
        e.dataTransfer.effectAllowed = "copy";
      } }
      // Keeps the caret in the text: the pill lands where he was typing.
      onMouseDown={ ( e ) => e.preventDefault() }
      onClick={ () => onPick( def.key ) }
      title={ value || `${ def.label }: nothing for this sketch` }
      className="grid w-full grid-cols-[8px_auto_minmax(0,1fr)] items-center gap-2 rounded-md px-1.5 py-1 text-left hover:bg-hover pointer-coarse:min-h-10"
    >
      <PillDot def={ def } empty={ !value } />
      <span className={ clsx(
        "whitespace-nowrap text-xs font-medium",
        !value && "text-foreground/45"
      ) }
      >
        {def.label}
      </span>
      <span className={ clsx(
        "truncate font-mono text-[10.5px]",
        value ? "text-label" : "text-foreground/35"
      ) }
      >
        {value ? value.replace(
          /\n/g,
          " "
        ) : "nothing for this sketch"}
      </span>
    </button>
  );
}

/**
 * Every pill as a LIST WITH VALUES (lab 6, his pick): one line per element
 * with what it says for this sketch, so he chooses what he reads rather than
 * a name to guess. His recent pills first, the families folded but «The
 * sketch», a family's empty elements grouped under «N empty here». A search
 * lists everything that matches. Click (or tap) adds at the caret of the text
 * he last typed in; drag drops it anywhere in a text.
 */
export default function PillPalette( {
  palette, ctx, onPick, className
}: {
  palette: readonly PillDef[];
  ctx: PillContext;
  onPick: ( key: string ) => void;
  className?: string;
} ) {
  const [
    query,
    setQuery
  ] = useState( "" );
  const [
    open,
    setOpen
  ] = useState<Record<string, boolean>>( {
    sketch: true
  } );
  const [
    empties,
    setEmpties
  ] = useState<Record<string, boolean>>( {} );
  const q = query.trim().toLowerCase();
  const byKey = new Map( palette.map( ( p ) => [
    p.key,
    p
  ] ) );
  const pick = ( key: string ) => {
    noteRecent( key );
    onPick( key );
  };
  const head = "flex w-full items-center justify-between gap-2 px-1.5 pb-0.5 pt-2 font-mono text-[10px] uppercase tracking-[0.12em] text-label";

  return (
    <div className={ clsx(
      "flex min-w-0 flex-col",
      className
    ) }
    >
      <input
        type="search"
        value={ query }
        onChange={ ( e ) => setQuery( e.target.value ) }
        placeholder="Find a pill…"
        aria-label="Find a pill"
        className="mb-1 w-full rounded-md border border-theme bg-background px-2 py-1.5 text-base text-foreground focus:border-foreground focus:outline-hidden sm:text-xs"
      />
      {q ? (
        <div className="flex flex-col">
          {palette.filter( ( p ) => p.label.toLowerCase().includes( q ) || PILL_FAMILY_LABEL[ p.family ].toLowerCase().includes( q ) ).map( ( p ) => <Item key={ p.key } def={ p } ctx={ ctx } onPick={ pick } /> )}
        </div>
      ) : (
        <>
          <span className={ head }>Recent</span>
          {recent.map( ( k ) => byKey.get( k ) ).filter( ( p ): p is PillDef => Boolean( p ) )
            .slice(
              0,
              5
            )
            .map( ( p ) => <Item key={ p.key } def={ p } ctx={ ctx } onPick={ pick } /> )}
          {FAMILIES.map( ( family ) => {
            const all = palette.filter( ( p ) => p.family === family );
            const full = all.filter( ( p ) => p.value(
              ctx,
              {}
            ) );
            const empty = all.filter( ( p ) => !p.value(
              ctx,
              {}
            ) );
            const isOpen = Boolean( open[ family ] );

            return (
              <div key={ family } className="flex flex-col">
                <button
                  type="button"
                  aria-expanded={ isOpen }
                  onClick={ () => setOpen( ( o ) => ( {
                    ...o,
                    [ family ]: !o[ family ]
                  } ) ) }
                  className={ clsx(
                    head,
                    "hover:text-foreground"
                  ) }
                >
                  <span>{PILL_FAMILY_LABEL[ family ]}</span>
                  <span>{all.length} {isOpen ? "▾" : "▸"}</span>
                </button>
                {isOpen && full.map( ( p ) => <Item key={ p.key } def={ p } ctx={ ctx } onPick={ pick } /> )}
                {isOpen && empty.length > 0 && ( empties[ family ]
                  ? empty.map( ( p ) => <Item key={ p.key } def={ p } ctx={ ctx } onPick={ pick } /> )
                  : (
                    <button
                      type="button"
                      onClick={ () => setEmpties( ( e ) => ( {
                        ...e,
                        [ family ]: true
                      } ) ) }
                      className="px-1.5 py-1 text-left text-[11px] text-foreground/45 hover:text-foreground"
                    >
                      {empty.length} empty here ▸
                    </button>
                  ) )}
              </div>
            );
          } )}
        </>
      )}
    </div>
  );
}
