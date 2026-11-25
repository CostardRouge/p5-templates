"use client";

import clsx from "clsx";

import {
  isRider, type AccountRhythms, type SlotFormat
} from "@/lib/postiz/accountRhythm";

/** Monday first, as every week of the rhythm is drawn. */
const MONDAY_FIRST = [
  1,
  2,
  3,
  4,
  5,
  6,
  0
];

/** A format is told by its colour AND its glyph; a story riding on a Reel is a ring, not a dot. */
const FORMAT_DOT: Record<SlotFormat, string> = {
  reel: "bg-pink-600 dark:bg-pink-400",
  carousel: "bg-blue-600 dark:bg-blue-400",
  picture: "bg-amber-600 dark:bg-amber-400",
  story: "border-[1.5px] border-violet-600 dark:border-violet-400",
  video: "bg-teal-600 dark:bg-teal-400"
};

export const FORMAT_GLYPH: Record<SlotFormat, string> = {
  reel: "▶",
  carousel: "▦",
  picture: "■",
  story: "○",
  video: "▷"
};

export function FormatDot( {
  format, rider = false, className
}: {
  format: SlotFormat;
  rider?: boolean;
  className?: string;
} ) {
  return (
    <span
      aria-hidden="true"
      className={ clsx(
        "inline-block h-1.5 w-1.5 shrink-0 rounded-full",
        rider || format === "story" ? FORMAT_DOT.story : FORMAT_DOT[ format ],
        className
      ) }
    />
  );
}

/** The week in dots, Monday first — a column per day, a dot per slot, coloured by format. */
export function RhythmWeekDots( {
  accounts, className
}: {
  accounts: AccountRhythms | null;
  className?: string;
} ) {
  return (
    <span aria-hidden="true" className={ clsx(
      "grid grid-cols-7 items-end gap-[3px]",
      className
    ) }
    >
      {MONDAY_FIRST.map( ( day ) => {
        const slots = accounts
          ? Object.values( accounts ).flatMap( ( a ) => a.slots.filter( ( s ) => s.day === day ).map( ( s ) => ( {
            s,
            rider: isRider(
              a.slots,
              s
            )
          } ) ) )
          : [];

        return (
          <span key={ day } className="flex h-6 w-[7px] flex-col-reverse items-center gap-0.5 overflow-hidden border-b border-theme">
            {slots.slice(
              0,
              4
            ).map( (
              {
                s, rider
              }, i
            ) => <FormatDot key={ i } format={ s.format } rider={ rider } /> )}
          </span>
        );
      } )}
    </span>
  );
}

