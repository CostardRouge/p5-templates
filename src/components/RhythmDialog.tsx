"use client";

import {
  Dialog, DialogPanel, DialogTitle
} from "@headlessui/react";
import clsx from "clsx";
import {
  CalendarDays, X
} from "lucide-react";
import {
  useMemo, useState
} from "react";

import {
  PROVIDER_GLYPH
} from "@/components/ChannelChip";
import {
  FORMAT_GLYPH, FormatDot
} from "@/components/RhythmDots";
import {
  accountWarnings, bySlot, countedSlots, fitFormat, FORMAT_LABEL, formatFromUsual, formatsFor, isRider, MAX_ACCOUNT_SLOTS, MAX_SENDS, seedAccounts, sendsOf, SLOT_FORMATS, weekSends, withAccounts, type AccountRhythms, type AccountSlot, type SlotFormat
} from "@/lib/postiz/accountRhythm";
import {
  PROVIDER_LABEL, providerOf, type PostizChannel, type Provider
} from "@/lib/postiz/client";
import {
  DEFAULT_RHYTHM
} from "@/lib/postiz/rhythm";
import {
  updatePostiz, type PostizConnection
} from "@/lib/postiz/store";
import {
  usePostiz
} from "@/lib/postiz/usePostiz";

const DAYS = [
  "Sun",
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat"
];
const DAY_LONG = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday"
];
const LETTER = [
  "S",
  "M",
  "T",
  "W",
  "T",
  "F",
  "S"
];
const MONDAY_FIRST = [
  1,
  2,
  3,
  4,
  5,
  6,
  0
];
const ZONES = [
  "Europe/Paris",
  "Europe/London",
  "America/New_York",
  "America/Los_Angeles",
  "Australia/Sydney"
];

const GHOST = "inline-flex items-center gap-1.5 rounded-lg border border-theme bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-hover disabled:opacity-40";
const INK = "inline-flex items-center gap-1.5 rounded-lg border border-transparent bg-foreground px-3 py-1.5 text-xs font-medium text-background transition-opacity hover:opacity-85 disabled:opacity-40";
const LEGEND = "m-0 font-mono text-[0.65rem] uppercase tracking-[0.14em] text-label";
const CONTROL = "rounded-lg border border-theme bg-background px-2 py-1.5 text-base text-foreground focus:border-foreground focus:outline-hidden sm:text-xs";

const time = ( t: string ) => {
  const [
    h,
    m
  ] = t.split( ":" ).map( Number );

  return `${ h }:${ String( m ).padStart(
    2,
    "0"
  ) }`;
};

/** An account of the matrix: the Postiz channel and the network it is. */
interface Row {
  channel: PostizChannel;
  provider: Provider;
}

/** Which slot the editor holds: its account and the slot itself (value equality). */
interface Picked {
  id: string;
  slot: AccountSlot;
}

const same = (
  a: AccountSlot, b: AccountSlot
) => a.day === b.day && a.time === b.time && a.format === b.format;

/**
 * The rhythm, account by account (lab 10, his choice: the matrix B, opened
 * from the gallery's Plan). One row per account, one column per day; a slot is
 * a chip (format + time); «+» adds one in the account's usual format; picking a
 * chip opens its editor under the grid (format, day, time, the other accounts
 * of the same send, remove). Saved as he goes: the Plan behind redraws.
 */
export default function RhythmDialog( {
  open, onClose
}: {
  open: boolean;
  onClose: () => void;
} ) {
  const conn = usePostiz();

  return (
    <Dialog
      open={ open }
      onClose={ onClose }
      className="relative z-80"
    >
      <div
        className="fixed inset-0 bg-background/60 backdrop-blur-xs"
        aria-hidden="true"
      />
      <div className="fixed inset-0 flex items-end justify-center sm:items-center sm:p-4">
        <DialogPanel className="glass flex max-h-dvh w-full max-w-6xl flex-col overflow-hidden border border-theme shadow-lg sm:max-h-[92vh] sm:rounded-2xl">
          {conn ? <RhythmMatrix conn={ conn } onClose={ onClose } /> : (
            <div className="flex flex-col gap-3 p-6">
              <DialogTitle className="m-0 text-sm font-medium text-foreground">Your rhythm</DialogTitle>
              <p className="m-0 text-sm text-label">Connect your Postiz first (menu › Publishing): the rhythm is set account by account.</p>
              <button type="button" className={ clsx(
                GHOST,
                "self-start"
              ) } onClick={ onClose }
              >
                Close
              </button>
            </div>
          )}
        </DialogPanel>
      </div>
    </Dialog>
  );
}

function RhythmMatrix( {
  conn, onClose
}: {
  conn: PostizConnection;
  onClose: () => void;
} ) {
  const rows: Row[] = useMemo(
    () => conn.channels.filter( ( c ) => !c.disabled ).map( ( channel ) => ( {
      channel,
      provider: providerOf( channel.identifier )
    } ) )
      .filter( ( r ) => formatsFor( r.provider ).length > 0 ),
    [
      conn.channels
    ]
  );
  const seedFor = ( rhythm: typeof conn.rhythm ) => seedAccounts(
    rhythm,
    rows.map( ( r ) => ( {
      id: r.channel.id,
      provider: r.provider
    } ) ),
    conn.defaultChannelIds,
    conn.usual
  );
  // Seeded on every render (a few dozen slots): a rhythm with no accounts yet reads as the old one spread over them.
  const accounts = seedFor( conn.rhythm );
  const [
    picked,
    setPicked
  ] = useState<Picked | null>( null );
  const rowOf = ( id: string ) => rows.find( ( r ) => r.channel.id === id ) ?? null;
  const nameOf = ( id: string ) => {
    const r = rowOf( id );

    return r ? `${ r.channel.name } (${ PROVIDER_GLYPH[ r.provider ] })` : id;
  };
  const shortOf = ( id: string ) => {
    const r = rowOf( id );

    if ( !r ) {
      return id;
    }
    // A network with one account reads by its network; two of one network read by their names.
    return rows.filter( ( x ) => x.provider === r.provider ).length > 1 ? r.channel.name : PROVIDER_LABEL[ r.provider ];
  };

  const save = ( next: AccountRhythms ) => updatePostiz( {
    rhythm: withAccounts(
      conn.rhythm,
      next
    )
  } );
  /** `edit` gets a copy of every account's slots to change in place. */
  const change = ( edit: ( draft: AccountRhythms ) => void ) => {
    const draft: AccountRhythms = Object.fromEntries( Object.entries( accounts ).map( ( [
      id,
      a
    ] ) => [
      id,
      {
        slots: a.slots.map( ( s ) => ( {
          ...s
        } ) )
      }
    ] ) );

    edit( draft );
    for ( const a of Object.values( draft ) ) {
      const seen = new Set<string>();

      a.slots = a.slots.filter( ( s ) => {
        const key = `${ s.day }|${ s.time }|${ s.format }`;

        if ( seen.has( key ) ) {
          return false;
        }
        seen.add( key );

        return true;
      } ).sort( bySlot )
        .slice(
          0,
          MAX_ACCOUNT_SLOTS
        );
    }
    save( draft );
  };
  const sends = sendsOf( accounts );
  const isSend = (
    day: number, t: string
  ) => sends.some( ( s ) => s.day === day && s.time === t );

  const add = (
    id: string, day: number
  ) => {
    const row = rowOf( id );

    if ( !row ) {
      return;
    }
    const mine = accounts[ id ]?.slots ?? [];
    const sameDay = sends.find( ( s ) => s.day === day )?.time;
    const t = sameDay ?? mine.at( -1 )?.time ?? "12:00";
    const counts = new Map<SlotFormat, number>();

    mine.filter( ( s ) => s.format !== "story" ).forEach( ( s ) => counts.set(
      s.format,
      ( counts.get( s.format ) ?? 0 ) + 1
    ) );
    const own = [
      ...counts.entries()
    ].sort( (
      a, b
    ) => b[ 1 ] - a[ 1 ] )[ 0 ]?.[ 0 ];
    const format = own ?? formatFromUsual(
      row.provider,
      conn.usual[ id ]
    );

    if ( !format ) {
      return;
    }
    const slot: AccountSlot = {
      day,
      time: t,
      format
    };

    change( ( d ) => {
      d[ id ].slots.push( slot );
    } );
    setPicked( {
      id,
      slot
    } );
  };

  const current = picked && accounts[ picked.id ]?.slots.find( ( s ) => same(
    s,
    picked.slot
  ) ) ? picked : null;

  /** Move a slot — and, for a post, the story riding on it. */
  const move = (
    p: Picked, day: number, t: string
  ) => {
    if ( !isSend(
      day,
      t
    ) && sends.length >= MAX_SENDS ) {
      return;
    }
    change( ( d ) => {
      const a = d[ p.id ];
      const riders = p.slot.format === "story" ? [] : a.slots.filter( ( s ) => s.format === "story" && s.day === p.slot.day && s.time === p.slot.time );

      for ( const s of a.slots ) {
        if ( same(
          s,
          p.slot
        ) || riders.some( ( r ) => same(
          r,
          s
        ) ) ) {
          s.day = day;
          s.time = t;
        }
      }
    } );
    setPicked( {
      id: p.id,
      slot: {
        ...p.slot,
        day,
        time: t
      }
    } );
  };

  const setFormat = (
    p: Picked, format: SlotFormat
  ) => {
    change( ( d ) => {
      const s = d[ p.id ].slots.find( ( x ) => same(
        x,
        p.slot
      ) );

      if ( s ) {
        s.format = format;
      }
    } );
    setPicked( {
      id: p.id,
      slot: {
        ...p.slot,
        format
      }
    } );
  };

  const remove = ( p: Picked ) => {
    change( ( d ) => {
      const a = d[ p.id ];
      const rider = isRider(
        a.slots,
        p.slot
      );

      a.slots = a.slots.filter( ( s ) => !same(
        s,
        p.slot
      ) && ( rider || p.slot.format === "story" || !( s.format === "story" && s.day === p.slot.day && s.time === p.slot.time ) ) );
    } );
    setPicked( null );
  };

  /** Tick another account into the same send (in its own format), or take it out. */
  const toggleAlso = (
    p: Picked, id: string
  ) => {
    const row = rowOf( id );

    if ( !row ) {
      return;
    }
    const there = accounts[ id ]?.slots.some( ( s ) => s.day === p.slot.day && s.time === p.slot.time );

    change( ( d ) => {
      if ( there ) {
        d[ id ].slots = d[ id ].slots.filter( ( s ) => !( s.day === p.slot.day && s.time === p.slot.time ) );

        return;
      }
      const format = fitFormat(
        row.provider,
        p.slot.format === "story" ? "reel" : p.slot.format
      );

      if ( format ) {
        d[ id ].slots.push( {
          day: p.slot.day,
          time: p.slot.time,
          format
        } );
      }
    } );
  };

  const reset = () => {
    setPicked( null );
    save( seedFor( DEFAULT_RHYTHM ) );
  };

  const zones = [
    ...new Set( [
      conn.rhythm.timeZone,
      ...ZONES,
      Intl.DateTimeFormat().resolvedOptions().timeZone
    ] )
  ];
  const warnings = accountWarnings(
    accounts,
    nameOf
  );
  const week = weekSends( accounts );
  const slotCount = Object.values( accounts ).reduce(
    (
      n, a
    ) => n + a.slots.length,
    0
  );

  return (
    <>
      <div className="flex items-center gap-2 border-b border-theme px-4 py-2.5">
        <CalendarDays className="h-4 w-4 shrink-0 text-foreground" />
        <DialogTitle className="m-0 shrink-0 text-sm font-medium text-foreground">Your rhythm</DialogTitle>
        <span className="min-w-0 truncate font-mono text-[11px] text-label max-sm:hidden">
          {sends.length} send{sends.length === 1 ? "" : "s"} a week · {slotCount} slot{slotCount === 1 ? "" : "s"} on {rows.length} account{rows.length === 1 ? "" : "s"} · {conn.rhythm.timeZone}
        </span>
        <button
          type="button"
          onClick={ onClose }
          aria-label="Close"
          className="-mr-2 ml-auto flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-label transition-colors hover:bg-hover hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="grid min-h-0 flex-1 overflow-y-auto lg:grid-cols-[minmax(0,1fr)_17rem] lg:overflow-hidden">
        <div className="flex min-w-0 flex-col gap-3 p-4 lg:overflow-y-auto">
          {rows.length === 0 ? (
            <p className="m-0 text-sm text-label">Your Postiz lists no account Sketchbook can post to.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[36rem] table-fixed border-collapse sm:min-w-[40rem]" data-rhythm-matrix>
                <thead>
                  <tr>
                    <th className="w-32 sm:w-44" />
                    {MONDAY_FIRST.map( ( day ) => {
                      const n = sends.filter( ( s ) => s.day === day ).length;

                      return (
                        <th key={ day } className="pb-1.5 text-center text-xs font-medium text-label">
                          {DAYS[ day ]}
                          <span className="block font-mono text-[10px] font-normal">{n ? `${ n } send${ n > 1 ? "s" : "" }` : "—"}</span>
                        </th>
                      );
                    } )}
                  </tr>
                </thead>
                <tbody>
                  {rows.map( ( {
                    channel, provider
                  } ) => {
                    const a = accounts[ channel.id ];
                    const counted = a ? countedSlots( a ).length : 0;

                    return (
                      <tr key={ channel.id } className="border-t border-theme" data-rhythm-account={ channel.id }>
                        <th scope="row" className="py-2 pr-2 text-left align-top font-normal">
                          <span className="flex min-w-0 items-center gap-2">
                            <span aria-hidden="true" className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-hover font-mono text-[9px] font-semibold">{PROVIDER_GLYPH[ provider ]}</span>
                            <span className="min-w-0 truncate text-xs font-medium text-foreground" title={ `${ PROVIDER_LABEL[ provider ] } · ${ channel.name }` }>{channel.name}</span>
                          </span>
                          <span className="mt-0.5 block pl-8 font-mono text-[10px] text-label max-sm:pl-0">
                            {counted ? `${ counted } a week` : "nothing yet"}
                          </span>
                        </th>
                        {MONDAY_FIRST.map( ( day ) => {
                          const here = ( a?.slots ?? [] ).filter( ( s ) => s.day === day );
                          const full = ( a?.slots.length ?? 0 ) >= MAX_ACCOUNT_SLOTS;

                          return (
                            <td key={ day } className="group border-l border-dashed border-theme px-1 py-2 align-top">
                              <div className="flex flex-col items-start gap-1">
                                {here.map( ( s ) => {
                                  const rider = isRider(
                                    a.slots,
                                    s
                                  );
                                  const on = current?.id === channel.id && same(
                                    current.slot,
                                    s
                                  );

                                  return (
                                    <button
                                      key={ `${ s.time }-${ s.format }` }
                                      type="button"
                                      aria-pressed={ on }
                                      title={ `${ channel.name } · ${ FORMAT_LABEL[ s.format ] } · ${ DAY_LONG[ s.day ] } ${ time( s.time ) }${ rider ? " — the Reel’s «+ Story»" : "" }` }
                                      onClick={ () => setPicked( on ? null : {
                                        id: channel.id,
                                        slot: s
                                      } ) }
                                      className={ clsx(
                                        "inline-flex max-w-full items-center gap-1 rounded-md border px-1.5 font-mono text-[11px] leading-5 transition-colors",
                                        rider ? "border-dashed" : "",
                                        on ? "border-foreground bg-foreground text-background" : "border-theme bg-background text-foreground hover:bg-hover"
                                      ) }
                                    >
                                      <FormatDot format={ s.format } rider={ rider } />
                                      <span className="sr-only">{FORMAT_LABEL[ s.format ]}</span>
                                      <span aria-hidden="true" className="max-sm:hidden">{FORMAT_GLYPH[ s.format ]}</span>
                                      {time( s.time )}
                                    </button>
                                  );
                                } )}
                                <button
                                  type="button"
                                  disabled={ full }
                                  title={ full ? `${ MAX_ACCOUNT_SLOTS } slots is the most for one account` : undefined }
                                  aria-label={ `Add a slot on ${ DAY_LONG[ day ] } for ${ channel.name }` }
                                  onClick={ () => add(
                                    channel.id,
                                    day
                                  ) }
                                  className="rounded-md border border-dashed border-theme px-1.5 text-[11px] leading-5 text-label opacity-0 transition-opacity hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100 disabled:hidden pointer-coarse:opacity-70"
                                >
                                  +
                                </button>
                              </div>
                            </td>
                          );
                        } )}
                      </tr>
                    );
                  } )}
                </tbody>
              </table>
            </div>
          )}

          {current ? (
            <SlotEditor
              picked={ current }
              row={ rowOf( current.id ) }
              rows={ rows }
              accounts={ accounts }
              canAddSend={ sends.length < MAX_SENDS }
              isSend={ isSend }
              onFormat={ ( f ) => setFormat(
                current,
                f
              ) }
              onMove={ (
                day, t
              ) => move(
                current,
                day,
                t
              ) }
              onAlso={ ( id ) => toggleAlso(
                current,
                id
              ) }
              onRemove={ () => remove( current ) }
              onDone={ () => setPicked( null ) }
            />
          ) : (
            <p className="m-0 text-xs text-label">
              «+» adds a slot in the account’s usual format; pick a slot to change its format, day and time, or to send the same post to other accounts.
              A story at the same time as a Reel is its «+ Story»: it does not count.
            </p>
          )}
        </div>

        <aside className="flex min-w-0 flex-col gap-2.5 border-t border-theme bg-hover/40 p-4 lg:overflow-y-auto lg:border-l lg:border-t-0">
          <span className={ LEGEND }>Each week gives</span>
          {week.length === 0 && <p className="m-0 text-xs text-label">Nothing: Export will propose no slot.</p>}
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {week.map( ( s ) => (
              <li key={ `${ s.day }-${ s.time }` } className="grid grid-cols-[4.25rem_minmax(0,1fr)] gap-2 text-xs">
                <span className="font-mono text-[11px] text-label">{DAYS[ s.day ]} {time( s.time )}</span>
                <span className="flex min-w-0 flex-col gap-0.5">
                  {s.routes.map( ( r ) => (
                    <span key={ r.formats.join( "+" ) } className="flex min-w-0 items-center gap-1.5">
                      <FormatDot format={ r.formats[ 0 ] } />
                      <span className="min-w-0 truncate">
                        {r.formats.map( ( f ) => FORMAT_LABEL[ f ] ).join( " + " )} → {r.ids.map( shortOf ).join( ", " )}
                      </span>
                    </span>
                  ) )}
                </span>
              </li>
            ) )}
          </ul>
          <ul className="m-0 mt-auto flex list-none flex-col gap-1 border-t border-theme p-0 pt-2.5 text-xs" data-rhythm-warnings>
            {warnings.length
              ? warnings.map( ( w ) => <li key={ w } className="text-red-600 dark:text-red-400">{w}</li> )
              : <li className="text-label">One post a day at most on every account.</li>}
          </ul>
        </aside>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-theme px-4 py-3">
        <label className="inline-flex items-center gap-2 text-xs text-label">
          Time zone
          <select
            className={ CONTROL }
            value={ conn.rhythm.timeZone }
            onChange={ ( event ) => updatePostiz( {
              rhythm: {
                ...conn.rhythm,
                timeZone: event.target.value
              }
            } ) }
          >
            {zones.map( ( zone ) => <option key={ zone } value={ zone }>{zone}</option> )}
          </select>
        </label>
        <button
          type="button"
          className={ GHOST }
          title="Tuesday 9:00, Friday 19:00 and Sunday 10:00 on the accounts Export proposes, each in its usual format"
          onClick={ reset }
        >
          Reset
        </button>
        <span className="ml-auto text-[11px] text-label max-sm:hidden">Saved as you go · Export proposes the next free send</span>
        <button type="button" className={ INK } onClick={ onClose }>Done</button>
      </div>
    </>
  );
}

function SlotEditor( {
  picked, row, rows, accounts, canAddSend, isSend, onFormat, onMove, onAlso, onRemove, onDone
}: {
  picked: Picked;
  row: Row | null;
  rows: Row[];
  accounts: AccountRhythms;
  canAddSend: boolean;
  isSend: ( day: number, t: string ) => boolean;
  onFormat: ( f: SlotFormat ) => void;
  onMove: ( day: number, t: string ) => void;
  onAlso: ( id: string ) => void;
  onRemove: () => void;
  onDone: () => void;
} ) {
  const {
    slot
  } = picked;
  const allowed = row ? formatsFor( row.provider ) : [];
  const rider = isRider(
    accounts[ picked.id ]?.slots ?? [],
    slot
  );

  return (
    <section aria-label="Edit slot" className="flex flex-col gap-3 rounded-xl border border-foreground p-3" data-rhythm-editor>
      <div className="flex items-center gap-2">
        <span className="min-w-0 truncate text-sm font-medium text-foreground">
          {row?.channel.name} · {DAY_LONG[ slot.day ]} {time( slot.time )}
        </span>
        <span className="font-mono text-[10px] text-label">{row ? PROVIDER_LABEL[ row.provider ] : ""}</span>
        <button type="button" className={ clsx(
          GHOST,
          "ml-auto"
        ) } onClick={ onDone }
        >
          Close
        </button>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className={ LEGEND }>Format</span>
        <div role="radiogroup" aria-label="Format" className="inline-flex flex-wrap gap-1">
          {SLOT_FORMATS.map( ( f ) => {
            const ok = allowed.includes( f );

            return (
              <button
                key={ f }
                type="button"
                role="radio"
                aria-checked={ slot.format === f }
                disabled={ !ok }
                title={ ok ? undefined : `${ row ? PROVIDER_LABEL[ row.provider ] : "This network" } does not take a ${ FORMAT_LABEL[ f ].toLowerCase() } from Sketchbook` }
                onClick={ () => onFormat( f ) }
                className={ clsx(
                  "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-35",
                  slot.format === f ? "border-foreground bg-foreground text-background" : "border-theme bg-background text-foreground hover:bg-hover"
                ) }
              >
                <FormatDot format={ f } />
                {FORMAT_LABEL[ f ]}
              </button>
            );
          } )}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className={ LEGEND }>Day and time</span>
        <div className="flex flex-wrap items-center gap-2">
          <div role="radiogroup" aria-label="Day" className="inline-flex gap-1">
            {MONDAY_FIRST.map( ( day ) => (
              <button
                key={ day }
                type="button"
                role="radio"
                aria-checked={ slot.day === day }
                aria-label={ DAY_LONG[ day ] }
                disabled={ !canAddSend && !isSend(
                  day,
                  slot.time
                ) }
                onClick={ () => onMove(
                  day,
                  slot.time
                ) }
                className={ clsx(
                  "grid h-8 w-8 place-items-center rounded-full border text-xs transition-colors disabled:opacity-35",
                  slot.day === day ? "border-foreground bg-foreground text-background" : "border-theme bg-background text-foreground hover:bg-hover"
                ) }
              >
                {LETTER[ day ]}
              </button>
            ) )}
          </div>
          <input
            type="time"
            aria-label="Time"
            className={ CONTROL }
            value={ slot.time }
            onChange={ ( event ) => event.target.value && onMove(
              slot.day,
              event.target.value
            ) }
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className={ LEGEND }>Same post also on · each in its own format</span>
        <div className="flex flex-wrap gap-x-4 gap-y-1.5">
          {rows.filter( ( r ) => r.channel.id !== picked.id ).map( ( r ) => {
            const there = ( accounts[ r.channel.id ]?.slots ?? [] ).filter( ( s ) => s.day === slot.day && s.time === slot.time );

            return (
              <label key={ r.channel.id } className="inline-flex items-center gap-2 text-xs text-foreground">
                <input
                  type="checkbox"
                  checked={ there.length > 0 }
                  onChange={ () => onAlso( r.channel.id ) }
                  className="h-4 w-4 accent-foreground"
                />
                <span className="truncate">{r.channel.name}</span>
                <span className="font-mono text-[10px] text-label">{PROVIDER_GLYPH[ r.provider ]}</span>
                {there.length > 0 && <span className="font-mono text-[10px] text-label">{there.map( ( s ) => FORMAT_LABEL[ s.format ] ).join( " + " )}</span>}
              </label>
            );
          } )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-[11px] text-label">{rider ? "Rides on the Reel at the same time: not counted." : ""}</span>
        <button type="button" className={ clsx(
          GHOST,
          "ml-auto text-red-600 dark:text-red-400"
        ) } onClick={ onRemove }
        >
          Remove
        </button>
      </div>
    </section>
  );
}
