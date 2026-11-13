"use client";

import {
  MenuItem
} from "@headlessui/react";
import clsx from "clsx";
import {
  CalendarClock, TriangleAlert
} from "lucide-react";
import Link from "next/link";
import {
  useEffect, useMemo, useState
} from "react";

import {
  PROVIDER_GLYPH
} from "@/components/ChannelChip";
import {
  shortDate, weekdayTime
} from "@/lib/gallery/sends";
import {
  PostizClient
} from "@/lib/postiz/client";
import {
  publishingPeek, type PublishingPeek as Peek
} from "@/lib/postiz/peek";
import {
  keptPostIds
} from "@/lib/postiz/publishStore";
import {
  recentPosts
} from "@/lib/postiz/recentPosts";
import type {
  PostizConnection
} from "@/lib/postiz/store";

const ROW = "flex w-full items-center gap-3 px-4 py-2 text-sm no-underline transition-colors";

/**
 * Under Connections › Publishing (lab 3 Q2, M1): ONE line, «Next post · Sun
 * 10:00» with its networks, and «1 failed post» only when there is one — both
 * to the gallery, where the week and the reasons are. Postiz is asked when
 * the menu opens (this component lives inside the open menu), once a minute
 * at most, sharing the gallery's read; never on a page load.
 */
export default function PublishingPeek( {
  postiz
}: {
  postiz: PostizConnection;
} ) {
  const [
    peek,
    setPeek
  ] = useState<( Peek & { now: number } ) | null>( null );
  const client = useMemo(
    () => new PostizClient(
      postiz.apiBase,
      postiz.apiKey
    ),
    [
      postiz.apiBase,
      postiz.apiKey
    ]
  );

  useEffect(
    () => {
      let live = true;

      recentPosts( client ).then(
        ( posts ) => {
          const now = Date.now();

          if ( live ) {
            setPeek( {
              ...publishingPeek(
                posts,
                keptPostIds(),
                now
              ),
              now
            } );
          }
        },
        () => live && setPeek( {
          next: null,
          failed: 0,
          now: Date.now()
        } )
      );

      return () => {
        live = false;
      };
    },
    [
      client
    ]
  );

  const tz = postiz.rhythm.timeZone;
  const now = peek?.now ?? 0;
  const next = peek?.next;
  const when = next
    ? next.at - now < 6 * 86_400_000 ? weekdayTime(
      next.at,
      tz
    ) : `${ shortDate(
      next.at,
      tz
    ) } · ${ weekdayTime(
      next.at,
      tz
    ).split( " " )[ 1 ] }`
    : null;

  return (
    <>
      <MenuItem>
        {( {
          focus
        } ) => (
          <Link
            href="/gallery"
            data-publishing-next
            className={ clsx(
              ROW,
              "text-foreground",
              focus && "bg-hover"
            ) }
          >
            <CalendarClock className="h-4 w-4 text-foreground/70" />
            <span className="flex-1 text-left">Next post</span>
            <span className="flex items-center gap-1.5 font-mono text-[10px] text-label">
              {peek === null ? "…" : when ?? "none planned"}
              {next && (
                <span className="flex gap-0.5">
                  {next.providers.map( ( p ) => (
                    <span key={ p } className="grid h-3.5 min-w-3.5 place-items-center rounded-[3px] bg-foreground px-0.5 text-[7px] font-bold text-background">
                      {PROVIDER_GLYPH[ p ]}
                    </span>
                  ) )}
                </span>
              )}
            </span>
          </Link>
        )}
      </MenuItem>
      {peek && peek.failed > 0 && (
        <MenuItem>
          {( {
            focus
          } ) => (
            <Link
              href="/gallery"
              data-publishing-failed
              className={ clsx(
                ROW,
                "text-red-600 dark:text-red-400",
                focus && "bg-hover"
              ) }
            >
              <TriangleAlert className="h-4 w-4" />
              <span className="flex-1 text-left">{peek.failed} failed post{peek.failed === 1 ? "" : "s"}</span>
              <span className="font-mono text-[10px]">›</span>
            </Link>
          )}
        </MenuItem>
      )}
    </>
  );
}
