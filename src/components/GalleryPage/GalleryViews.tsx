"use client";

import React, {
  useId, useLayoutEffect, useMemo, useRef, useState
} from "react";
import clsx from "clsx";
import {
  CalendarDays, ChevronLeft, ChevronRight, ExternalLink, LayoutGrid, Rows3
} from "lucide-react";

import {
  monthGrid, monthLabel, weekDays, weekLabel, type Month
} from "@/lib/gallery/calendar";
import {
  sendState, weekdayTime
} from "@/lib/gallery/sends";
import {
  formatSketchTitle
} from "@/lib/seo";
import type {
  GalleryView
} from "@/lib/gallery/view";
import {
  catalogueThumbnail, type CalendarItem
} from "./items";
import {
  SendMarks, StatePill, Vignette
} from "./marks";

const VIEW_LABEL: Record<GalleryView, string> = {
  month: "Month",
  week: "Week",
  grid: "Grid"
};

const VIEW_ICON: Record<GalleryView, React.ReactNode> = {
  month: <CalendarDays className="h-3.5 w-3.5" />,
  week: <Rows3 className="h-3.5 w-3.5 rotate-90" />,
  grid: <LayoutGrid className="h-3.5 w-3.5" />
};

/** Month · Week · Grid — ONE switcher (his hybrid of lab 3's G1 and G3). */
export function ViewSwitcher( {
  view, onChange
}: {
  view: GalleryView;
  onChange: ( view: GalleryView ) => void;
} ) {
  return (
    <div role="radiogroup" aria-label="View" className="inline-flex h-9 shrink-0 items-center gap-0.5 rounded-lg border border-border bg-hover/40 p-0.5">
      {( [
        "month",
        "week",
        "grid"
      ] as const ).map( ( v ) => (
        <button
          key={ v }
          type="button"
          role="radio"
          aria-checked={ view === v }
          data-gallery-view={ v }
          onClick={ () => onChange( v ) }
          className={ clsx(
            "inline-flex h-full items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors",
            view === v ? "bg-background text-foreground shadow-[0_0_0_1px_var(--color-border)]" : "text-foreground/60 hover:text-foreground"
          ) }
        >
          {VIEW_ICON[ v ]}
          {VIEW_LABEL[ v ]}
        </button>
      ) )}
    </div>
  );
}

const NAV_BUTTON = "grid h-8 w-8 place-items-center rounded-md border border-border bg-background text-foreground transition-colors hover:bg-hover disabled:opacity-30";

/** The row above a calendar: ‹ label › and what sits at its right. Fixed height: nothing in it moves the page. */
function NavRow( {
  label, onPrev, onNext, prevDisabled, nextDisabled, prevLabel, nextLabel, back, right
}: {
  label: string;
  onPrev: () => void;
  onNext: () => void;
  prevDisabled: boolean;
  nextDisabled: boolean;
  prevLabel: string;
  nextLabel: string;
  back: React.ReactNode;
  right?: React.ReactNode;
} ) {
  return (
    <div className="flex h-8 min-w-0 items-center gap-1.5">
      <button type="button" className={ NAV_BUTTON } aria-label={ prevLabel } disabled={ prevDisabled } onClick={ onPrev }>
        <ChevronLeft className="h-4 w-4" />
      </button>
      <h2 className="m-0 min-w-0 truncate px-1 text-sm font-semibold tabular-nums text-foreground sm:text-base" aria-live="polite">{label}</h2>
      <button type="button" className={ NAV_BUTTON } aria-label={ nextLabel } disabled={ nextDisabled } onClick={ onNext }>
        <ChevronRight className="h-4 w-4" />
      </button>
      {back}
      {/* A fixed width: the legend's words differ with and without a Postiz, which is known only after hydration. */}
      <span className="ml-auto flex w-[5.5rem] shrink-0 items-center justify-end gap-2 sm:w-[19rem]">{right}</span>
    </div>
  );
}

/** The rule the vignettes follow: published plain, planned ringed blue, failed ringed red, a draft dashed. */
function ringOf( item: CalendarItem ): string {
  if ( item.kind !== "send" ) {
    return "";
  }

  const state = sendState( item.send );

  return state === "failed"
    ? "ring-2 ring-inset ring-red-500"
    : state === "planned" ? "ring-2 ring-inset ring-blue-500" : state === "draft" ? "outline outline-1 outline-dashed outline-foreground/40" : "";
}

function dotOf( item: CalendarItem ): string {
  if ( item.kind !== "send" ) {
    return "bg-foreground/50";
  }

  const state = sendState( item.send );

  return state === "failed" ? "bg-red-500" : state === "planned" ? "bg-blue-500" : state === "draft" ? "border border-foreground/50" : "bg-foreground";
}

function itemTitle( item: CalendarItem ): string {
  const entry = item.entry;

  if ( entry?.title ) {
    return entry.title;
  }

  return formatSketchTitle( item.kind === "send" ? item.send.sketchKey.split( "/" )[ 1 ] : item.entry.name );
}

function itemLabel(
  item: CalendarItem, tz: string
): string {
  const time = weekdayTime(
    item.at,
    tz
  ).split( " " )[ 1 ];

  return item.kind === "send"
    ? `${ itemTitle( item ) }, ${ time }, ${ sendState( item.send ) === "unknown" ? "sent" : sendState( item.send ) }`
    : `${ itemTitle( item ) }, kept at ${ time }`;
}

function ItemVignette( {
  item, className
}: {
  item: CalendarItem;
  className?: string;
} ) {
  return (
    <Vignette
      blob={ item.entry?.thumbnail ?? null }
      src={ item.kind === "send" ? catalogueThumbnail( item.send.sketchKey ) : null }
      className={ className }
    />
  );
}

/** One line of the legend, at the calendars' right. */
function Legend( {
  pieces
}: {
  pieces: boolean;
} ) {
  if ( pieces ) {
    return <span key="pieces" className="hidden text-[11px] text-label sm:inline">Pieces kept, by day</span>;
  }

  return (
    // Its own key: it replaces the pieces' legend as a NEW node once a Postiz is known, rather than one node resized and moved.
    <span key="posts" className="hidden items-center gap-3 text-[11px] text-label sm:inline-flex">
      <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-foreground" />published</span>
      <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-blue-500" />planned</span>
      <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-500" />failed</span>
    </span>
  );
}

const WEEKDAY_HEADS = [
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
  "Sun"
];

/**
 * G3's month (his pick): six fixed weeks, each day holding the vignettes of
 * what went or goes out that day — or, without a Postiz, of the pieces kept
 * that day. Every cell has ONE height whatever it holds (four vignettes, then
 * «+N»), so the grid never moves when the data lands. On a phone a cell is
 * too small for a picture: it shows DOTS in the states' colours, and the day
 * tapped (today first) lists its items under the month, vignettes and all.
 */
export function MonthView( {
  month, today, tz, byDay, pieces, canPrev, canNext, onMonth, onToday, onPick, loading
}: {
  month: Month;
  today: string;
  tz: string;
  byDay: ReadonlyMap<string, CalendarItem[]>;
  /** Without a Postiz: the calendar of the pieces kept. */
  pieces: boolean;
  canPrev: boolean;
  canNext: boolean;
  onMonth: ( delta: number ) => void;
  onToday: () => void;
  onPick: ( item: CalendarItem ) => void;
  loading: boolean;
} ) {
  const days = useMemo(
    () => monthGrid(
      month,
      today
    ),
    [
      month,
      today
    ]
  );
  const [
    picked,
    setPicked
  ] = useState<string | null>( null );
  const selected = picked && days.some( ( d ) => d.day === picked && d.inMonth )
    ? picked
    : days.find( ( d ) => d.today && d.inMonth )?.day ?? days.find( ( d ) => d.inMonth )!.day;
  const listed = byDay.get( selected ) ?? [];
  const isThisMonth = days.some( ( d ) => d.today && d.inMonth );

  return (
    <section aria-label="Month" className="flex flex-col gap-3" data-gallery-month={ `${ month.y }-${ month.mo }` }>
      <NavRow
        label={ monthLabel( month ) }
        onPrev={ () => onMonth( -1 ) }
        onNext={ () => onMonth( 1 ) }
        prevDisabled={ !canPrev }
        nextDisabled={ !canNext }
        prevLabel="Previous month"
        nextLabel="Next month"
        back={
          <button
            type="button"
            onClick={ onToday }
            className={ clsx(
              "h-8 rounded-md px-2 text-xs text-label hover:bg-hover hover:text-foreground",
              isThisMonth && "invisible"
            ) }
          >
            Today
          </button>
        }
        right={ <Legend pieces={ pieces } /> }
      />

      <div className="grid grid-cols-7 overflow-hidden rounded-xl border border-border">
        {WEEKDAY_HEADS.map( ( d ) => (
          <span key={ d } className="border-b border-border px-1.5 py-1 font-mono text-[10px] uppercase tracking-wider text-label">
            {d}
          </span>
        ) )}
        {days.map( (
          d, k
        ) => {
          const items = d.inMonth ? byDay.get( d.day ) ?? [] : [];
          const shown = items.slice(
            0,
            4
          );

          return (
            <div
              key={ d.day }
              data-day={ d.day }
              className={ clsx(
                "relative flex h-14 min-w-0 flex-col gap-1 overflow-hidden border-border p-1 sm:h-[6.75rem] sm:p-1.5 lg:h-[7.5rem]",
                ( k + 1 ) % 7 !== 0 && "border-r",
                k < 35 && "border-b",
                selected === d.day && "max-sm:bg-hover/60"
              ) }
            >
              {/* The whole cell picks the day for the list under the month (phone). */}
              <button
                type="button"
                aria-label={ `${ d.weekday } ${ d.n }${ items.length ? `, ${ items.length } ${ items.length === 1 ? "item" : "items" }` : "" }` }
                aria-pressed={ selected === d.day }
                disabled={ !d.inMonth }
                onClick={ () => setPicked( d.day ) }
                className="absolute inset-0 rounded-none bg-transparent focus:outline-hidden focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus sm:cursor-default"
              />
              <span className={ clsx(
                "pointer-events-none relative text-[11px] tabular-nums leading-none",
                !d.inMonth && "opacity-30",
                d.today ? "font-bold text-foreground underline decoration-2 underline-offset-4" : d.past ? "text-foreground/45" : "text-label"
              ) }>
                {d.n}
              </span>
              {/* Phone: dots. */}
              <span className="pointer-events-none relative flex flex-wrap gap-[3px] sm:hidden">
                {items.slice(
                  0,
                  6
                ).map( ( item ) => (
                  <span key={ item.key } className={ clsx(
                    "h-1.5 w-1.5 rounded-full",
                    dotOf( item )
                  ) } />
                ) )}
              </span>
              {/* Wider: the vignettes themselves. */}
              <span className="relative hidden flex-wrap content-start gap-1 sm:flex">
                {shown.map( ( item ) => (
                  <button
                    key={ item.key }
                    type="button"
                    title={ itemLabel(
                      item,
                      tz
                    ) }
                    aria-label={ itemLabel(
                      item,
                      tz
                    ) }
                    onClick={ () => onPick( item ) }
                    className={ clsx(
                      "relative aspect-[4/5] w-[30px] shrink-0 overflow-hidden rounded-[4px] bg-hover/60 lg:w-10 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-focus",
                      d.past && item.kind === "send" && sendState( item.send ) === "published" && "saturate-[.8]"
                    ) }
                  >
                    <ItemVignette item={ item } />
                    <span aria-hidden="true" className={ clsx(
                      "absolute inset-0 rounded-[4px]",
                      ringOf( item )
                    ) } />
                  </button>
                ) )}
                {items.length > shown.length && (
                  <button
                    type="button"
                    onClick={ () => onPick( items[ shown.length ] ) }
                    className="grid aspect-[4/5] w-[30px] place-items-center lg:w-10 rounded-[4px] border border-border font-mono text-[10px] text-label hover:bg-hover"
                    aria-label={ `${ items.length - shown.length } more` }
                  >
                    +{items.length - shown.length}
                  </button>
                )}
              </span>
            </div>
          );
        } )}
      </div>

      {/* Phone: the day tapped, listed. It is the last thing on the page, so its height never moves anything. */}
      <div className="flex flex-col gap-1 sm:hidden" aria-label="The day" data-gallery-day-list>
        <p className="m-0 px-0.5 font-mono text-[10.5px] uppercase tracking-wider text-label">
          {( () => {
            const d = days.find( ( x ) => x.day === selected )!;

            return `${ d.weekday } ${ d.n }${ d.today ? " · today" : "" }`;
          } )()}
        </p>
        {listed.length === 0 && (
          <p className="m-0 px-0.5 text-xs text-foreground/50">{loading ? " " : pieces ? "Nothing kept that day." : selected < today ? "Nothing went out that day." : "Nothing goes out that day."}</p>
        )}
        {listed.map( ( item ) => (
          <DayRow key={ item.key } item={ item } tz={ tz } onPick={ onPick } />
        ) )}
      </div>
    </section>
  );
}

/** One item of the phone's day list: its vignette, its title, its time and networks. */
function DayRow( {
  item, tz, onPick
}: {
  item: CalendarItem;
  tz: string;
  onPick: ( item: CalendarItem ) => void;
} ) {
  const time = weekdayTime(
    item.at,
    tz
  ).split( " " )[ 1 ];

  return (
    <button
      type="button"
      onClick={ () => onPick( item ) }
      className="grid min-h-14 grid-cols-[40px_minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-border px-2 py-1.5 text-left hover:bg-hover"
    >
      <span className="relative aspect-[4/5] w-10 overflow-hidden rounded-md bg-hover/60">
        <ItemVignette item={ item } />
        <span aria-hidden="true" className={ clsx(
          "absolute inset-0 rounded-md",
          ringOf( item )
        ) } />
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-sm text-foreground">{itemTitle( item )}</span>
        <span className="font-mono text-[10.5px] text-label">{item.kind === "send" ? time : `kept ${ time }`}</span>
      </span>
      {item.kind === "send" ? (
        <span className="flex items-center gap-2">
          <SendMarks send={ item.send } />
          {sendState( item.send ) !== "published" && <StatePill state={ sendState( item.send ) } />}
        </span>
      ) : <span />}
    </button>
  );
}

/**
 * React warns about a `<script>` rendered on the client; Next's guide
 * («Preventing flash before hydration») renders it as JavaScript on the
 * server and as inert text on the client.
 */
function InlineScript( {
  html
}: {
  html: string;
} ) {
  return (
    <script
      type={ typeof window === "undefined" ? "text/javascript" : "text/plain" }
      suppressHydrationWarning
      dangerouslySetInnerHTML={ {
        __html: html
      } }
    />
  );
}

/**
 * G1/G2's week strip, Atelier's Planned at parity: seven days, a 4:5
 * vignette per send with its time and network marks (a failure ringed red),
 * the rhythm's FREE slots as dashed tiles (not clickable), ‹ ›, *Open Postiz ↗*.
 * On a phone it scrolls sideways snapped by day, today at the left edge —
 * placed there by an inline script BEFORE the first paint, so the strip never
 * jumps once the page shows. Without a Postiz it lists the pieces kept.
 */
export function WeekView( {
  monday, today, tz, byDay, free, pieces, offset, canPrev, canNext, onWeek, onPick, postizUrl
}: {
  monday: string;
  today: string;
  tz: string;
  byDay: ReadonlyMap<string, CalendarItem[]>;
  free: ReadonlyMap<string, Date[]>;
  pieces: boolean;
  offset: number;
  canPrev: boolean;
  canNext: boolean;
  onWeek: ( delta: number | null ) => void;
  onPick: ( item: CalendarItem ) => void;
  postizUrl: string | null;
} ) {
  const days = useMemo(
    () => weekDays(
      monday,
      today
    ),
    [
      monday,
      today
    ]
  );
  const id = useId().replace(
    /[^a-zA-Z0-9_-]/g,
    ""
  );
  const strip = useRef<HTMLDivElement | null>( null );

  // A soft navigation or a change of week: the inline script does not run then.
  useLayoutEffect(
    () => {
      const el = strip.current;
      const t = el?.querySelector<HTMLElement>( "[data-today=\"true\"]" );

      if ( el && t && el.scrollWidth > el.clientWidth ) {
        el.scrollLeft = t.offsetLeft - el.offsetLeft;
      }
    },
    [
      monday
    ]
  );

  return (
    <section aria-label="Week" className="flex flex-col gap-3" data-gallery-week={ monday }>
      <NavRow
        label={ weekLabel( monday ) }
        onPrev={ () => onWeek( -1 ) }
        onNext={ () => onWeek( 1 ) }
        prevDisabled={ !canPrev }
        nextDisabled={ !canNext }
        prevLabel="Previous week"
        nextLabel="Next week"
        back={
          <button
            type="button"
            onClick={ () => onWeek( null ) }
            className={ clsx(
              "h-8 whitespace-nowrap rounded-md px-2 text-xs text-label hover:bg-hover hover:text-foreground",
              offset === 0 && "invisible"
            ) }
          >
            This week
          </button>
        }
        right={
          <>
            <Legend pieces={ pieces } />
            {/* Its place is kept whether a Postiz is connected or not, so nothing beside it moves. */}
            <a
              href={ postizUrl ?? undefined }
              target="_blank"
              rel="noreferrer"
              aria-hidden={ !postizUrl }
              tabIndex={ postizUrl ? undefined : -1 }
              title="The whole calendar, in your Postiz"
              className={ clsx(
                "inline-flex h-8 items-center gap-1 whitespace-nowrap rounded-md border border-border bg-background px-2.5 text-xs font-medium text-foreground no-underline hover:bg-hover",
                !postizUrl && "invisible"
              ) }
            >
              <span className="hidden sm:inline">Open </span>Postiz
              <ExternalLink className="h-3 w-3" />
            </a>
          </>
        }
      />

      <div
        id={ id }
        ref={ strip }
        role="list"
        aria-label={ `The week of ${ weekLabel( monday ) }` }
        className="grid snap-x snap-mandatory auto-cols-[42%] grid-flow-col gap-2 overflow-x-auto pb-1.5 sm:auto-cols-[minmax(0,1fr)]"
      >
        {days.map( ( d ) => {
          const items = [
            ...( byDay.get( d.day ) ?? [] )
          ].sort( (
            a, b
          ) => a.at - b.at );
          const slots = free.get( d.day ) ?? [];

          return (
            <div key={ d.day } role="listitem" data-today={ d.today } data-day={ d.day } className="flex min-w-0 snap-start flex-col gap-2">
              <div className={ clsx(
                "flex items-baseline gap-1.5 border-b px-0.5 pb-1.5",
                d.today ? "border-foreground" : "border-border"
              ) }>
                <span className={ clsx(
                  "text-xl font-semibold leading-none tabular-nums",
                  d.past && !d.today ? "text-foreground/45" : "text-foreground"
                ) }>{d.n}</span>
                <span className="font-mono text-[10px] uppercase tracking-wider text-label">{d.weekday}</span>
                {d.today && <span className="ml-auto font-mono text-[10px] uppercase tracking-wider text-foreground">today</span>}
              </div>
              {items.map( ( item ) => (
                <WeekTile key={ item.key } item={ item } tz={ tz } past={ d.past } onPick={ onPick } />
              ) )}
              {slots.map( ( at ) => (
                <span
                  key={ at.toISOString() }
                  className="flex aspect-[4/5] flex-col items-center justify-center gap-0.5 rounded-lg border-[1.5px] border-dashed border-border text-label"
                >
                  <span className="font-mono text-sm text-foreground">{weekdayTime(
                    at.getTime(),
                    tz
                  ).split( " " )[ 1 ]}</span>
                  <span className="font-mono text-[10px]">free</span>
                </span>
              ) )}
            </div>
          );
        } )}
      </div>
      <InlineScript html={ `(function(){var s=document.getElementById(${ JSON.stringify( id ) });var t=s&&s.querySelector('[data-today="true"]');if(t&&s.scrollWidth>s.clientWidth){s.scrollLeft=t.offsetLeft-s.offsetLeft;}})()` } />
    </section>
  );
}

function WeekTile( {
  item, tz, past, onPick
}: {
  item: CalendarItem;
  tz: string;
  past: boolean;
  onPick: ( item: CalendarItem ) => void;
} ) {
  const time = weekdayTime(
    item.at,
    tz
  ).split( " " )[ 1 ];
  const state = item.kind === "send" ? sendState( item.send ) : null;

  return (
    <button
      type="button"
      onClick={ () => onPick( item ) }
      aria-label={ itemLabel(
        item,
        tz
      ) }
      className="group flex flex-col gap-1 rounded-lg text-left focus:outline-hidden focus-visible:ring-2 focus-visible:ring-focus"
    >
      <span className={ clsx(
        "relative block aspect-[4/5] w-full overflow-hidden rounded-lg bg-hover/60 transition-transform motion-safe:group-hover:-translate-y-0.5",
        past && "saturate-[.75]"
      ) }>
        <ItemVignette item={ item } />
        <span className="glass absolute left-1.5 top-1.5 rounded-[5px] px-1.5 py-0.5 font-mono text-[10px] leading-none text-foreground">
          {item.kind === "send" ? time : `kept ${ time }`}
        </span>
        {item.kind === "send" && (
          <span className="absolute inset-x-1.5 bottom-1.5 flex items-center justify-between gap-1">
            <span className="glass rounded-md p-1"><SendMarks send={ item.send } size="xs" /></span>
            {state && state !== "planned" && <StatePill state={ state } />}
          </span>
        )}
        <span aria-hidden="true" className={ clsx(
          "absolute inset-0 rounded-lg",
          state === "failed" ? "ring-2 ring-inset ring-red-500" : ""
        ) } />
      </span>
      <span className="line-clamp-1 px-0.5 text-xs text-foreground">{itemTitle( item )}</span>
    </button>
  );
}
