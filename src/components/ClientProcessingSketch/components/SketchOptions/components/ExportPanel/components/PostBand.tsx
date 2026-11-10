"use client";

import React, {
  useRef, useState
} from "react";
import clsx from "clsx";
import {
  ChevronDown
} from "lucide-react";
import ChannelChip from "@/components/ChannelChip";
import {
  providerOf, type PostKind, type TikTokPrivacy, type YouTubeVisibility
} from "@/lib/postiz/client";
import {
  CAPTION_TOKENS, type CaptionFacts
} from "@/lib/postiz/caption";
import {
  KIND_LABEL, kindWhy
} from "@/lib/postiz/postShape";
import type {
  PostPlan
} from "@/lib/postiz/plan";
import type {
  PostDraft, When
} from "@/lib/postiz/publishStore";
import type {
  PostizConnection
} from "@/lib/postiz/store";
import {
  openPublishing
} from "@/lib/postiz/usePostiz";
import WhenCard from "./WhenCard";

const LEGEND = "font-mono text-[10px] uppercase tracking-[0.14em] text-label";
const KINDS: PostKind[] = [
  "reel",
  "post",
  "carousel",
  "story"
];
const TIKTOK: [TikTokPrivacy, string][] = [
  [
    "PUBLIC_TO_EVERYONE",
    "Everyone"
  ],
  [
    "MUTUAL_FOLLOW_FRIENDS",
    "Friends"
  ],
  [
    "SELF_ONLY",
    "Only me"
  ]
];
const YOUTUBE: [YouTubeVisibility, string][] = [
  [
    "public",
    "Public"
  ],
  [
    "unlisted",
    "Unlisted"
  ],
  [
    "private",
    "Private"
  ]
];

/** The studio's segmented control, as the agent guide's app picker draws it. */
function Segmented<T extends string>( {
  label, value, options, onChange
}: {
  label: string;
  value: T | null;
  options: { id: T;
    label: string;
    disabled?: string | null }[];
  onChange: ( id: T ) => void;
} ) {
  return (
    <div
      role="radiogroup"
      aria-label={ label }
      className="grid auto-cols-fr grid-flow-col gap-1 rounded-lg border border-theme p-1"
    >
      {options.map( ( option ) => (
        <button
          key={ option.id }
          type="button"
          role="radio"
          aria-checked={ value === option.id }
          disabled={ Boolean( option.disabled ) }
          title={ option.disabled ?? undefined }
          onClick={ () => onChange( option.id ) }
          className={ clsx(
            "rounded-md px-2 py-1.5 text-xs font-medium transition-colors disabled:opacity-35 pointer-coarse:min-h-10",
            value === option.id ? "bg-foreground text-background" : "text-label hover:bg-hover hover:text-foreground disabled:hover:bg-transparent"
          ) }
        >
          {option.label}
        </button>
      ) )}
    </div>
  );
}

function Toggle( {
  checked, onChange, children, title
}: {
  checked: boolean;
  onChange: ( next: boolean ) => void;
  children: React.ReactNode;
  title?: string;
} ) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={ checked }
      title={ title }
      onClick={ () => onChange( !checked ) }
      className="flex items-center gap-2.5 py-0.5 text-left text-xs text-foreground pointer-coarse:min-h-10"
    >
      <span
        aria-hidden="true"
        className={ clsx(
          "relative h-4 w-7 shrink-0 rounded-full transition-colors",
          checked ? "bg-foreground" : "bg-foreground/20"
        ) }
      >
        <span
          className={ clsx(
            "absolute top-0.5 h-3 w-3 rounded-full bg-background transition-transform",
            checked ? "translate-x-3.5" : "translate-x-0.5"
          ) }
        />
      </span>
      {children}
    </button>
  );
}

/**
 * Export › Publish's band under the variants (lab 1 §6): four blocks — To
 * (the accounts, each refusing what its network cannot take, with the
 * reason), Post as (Instagram's kind, and the options of each ticked
 * network), When (the rhythm's card) and the Caption (a template filled with
 * the sketch's words when it is sent). Folded, it says all of it in one line.
 */
export default function PostBand( {
  conn, plan, draft, when, taken, facts, disabled, onPatch, onWhen
}: {
  conn: PostizConnection;
  plan: PostPlan;
  draft: PostDraft;
  when: When;
  taken: readonly Date[];
  facts: CaptionFacts;
  disabled: boolean;
  onPatch: ( patch: Partial<PostDraft> ) => void;
  onWhen: ( next: When ) => void;
} ) {
  const [
    open,
    setOpen
  ] = useState( true );
  const caption = useRef<HTMLTextAreaElement | null>( null );
  const ticked = new Set( plan.accounts.filter( ( a ) => a.ticked ).map( ( a ) => a.channel.id ) );
  const tickedTargets = plan.targets.map( ( c ) => providerOf( c.identifier ) );
  const shape = plan.shape;
  const summary = [
    plan.kind && plan.instagram ? KIND_LABEL[ plan.kind ] : plan.shape?.media === "image" ? "Pictures" : "Video",
    ( plan.targets.length ? plan.targets.map( ( c ) => c.name ).join( ", " ) : "no account" ) +
      ( plan.collaborators.length ? ` with ${ plan.collaborators.map( ( h ) => `@${ h }` ).join( ", " ) }` : "" ),
    plan.whenWords,
    `caption ${ draft.approved ? "approved" : "not approved yet" }`
  ].join( " · " );

  const toggle = ( id: string ) => {
    const current = [
      ...ticked
    ];

    // An account the post goes to is no longer invited as its collaborator.
    onPatch( {
      channelIds: ticked.has( id ) ? current.filter( ( x ) => x !== id ) : [
        ...current,
        id
      ],
      ...( ticked.has( id ) ? {} : {
        collabAccounts: draft.collabAccounts.filter( ( x ) => x !== id )
      } )
    } );
  };

  /** Invite (or not) one of his own Instagram accounts — it then stops being a place the post goes to. */
  const invite = ( id: string ) => {
    const invited = draft.collabAccounts.includes( id );

    onPatch( {
      collabAccounts: invited ? draft.collabAccounts.filter( ( x ) => x !== id ) : [
        ...draft.collabAccounts,
        id
      ],
      ...( invited ? {} : {
        channelIds: [
          ...ticked
        ].filter( ( x ) => x !== id )
      } )
    } );
  };

  const insertToken = ( token: string ) => {
    const area = caption.current;
    const text = plan.template;
    const start = area?.selectionStart ?? text.length;
    const end = area?.selectionEnd ?? start;

    onPatch( {
      caption: `${ text.slice(
        0,
        start
      ) }{${ token }}${ text.slice( end ) }`
    } );
  };

  return (
    <section aria-label="Post" className="border-t border-theme">
      <button
        type="button"
        aria-expanded={ open }
        onClick={ () => setOpen( ( o ) => !o ) }
        className="sticky top-0 z-10 flex w-full items-center gap-3 border-b border-theme bg-background px-3 py-2 text-left pointer-coarse:min-h-11"
      >
        <span className="text-xs font-semibold text-foreground">Post</span>
        <span className="min-w-0 flex-1 truncate text-xs text-label">{summary}</span>
        <ChevronDown className={ clsx(
          "h-3.5 w-3.5 shrink-0 text-label transition-transform",
          open && "rotate-180"
        ) }
        />
      </button>

      {open && (
        <fieldset
          disabled={ disabled }
          className="m-0 grid min-w-0 grid-cols-1 gap-x-6 gap-y-4 border-0 px-3 pb-4 pt-3 md:grid-cols-2"
        >
          <div className="flex min-w-0 flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between gap-2">
                <span className={ LEGEND }>To</span>
                <button
                  type="button"
                  onClick={ openPublishing }
                  className="font-mono text-[10px] text-label underline underline-offset-2 hover:text-foreground"
                >
                  accounts
                </button>
              </div>
              <div role="group" aria-label="Accounts" className="flex flex-wrap gap-1.5">
                {plan.accounts.map( ( {
                  channel, ticked: on, reason
                } ) => (
                  <ChannelChip
                    key={ channel.id }
                    channel={ channel }
                    checked={ on }
                    disabledReason={ reason }
                    onToggle={ () => toggle( channel.id ) }
                  />
                ) )}
              </div>
            </div>

            {plan.instagram && shape && (
              <div className="flex flex-col gap-1.5">
                <span className={ LEGEND }>Post as · Instagram</span>
                <Segmented<PostKind>
                  label="Post as"
                  value={ plan.kind }
                  options={ KINDS.map( ( k ) => ( {
                    id: k,
                    label: KIND_LABEL[ k ],
                    disabled: kindWhy(
                      k,
                      shape
                    )
                  } ) ) }
                  onChange={ ( kind ) => onPatch( {
                    kind
                  } ) }
                />
              </div>
            )}
            {shape?.media === "image" && (
              <p className="m-0 text-[11px] leading-snug text-label">
                Pictures go out as JPEG — Instagram takes nothing else. Your downloaded file stays PNG.
              </p>
            )}

            {plan.instagram && plan.kind === "reel" && (
              <div className="flex flex-col gap-1.5">
                <Toggle
                  checked={ draft.trial }
                  onChange={ ( trial ) => onPatch( {
                    trial
                  } ) }
                  title="Shown to people who do not follow you first; nothing reaches your followers until it is shared with them"
                >
                  Trial Reel — non-followers first
                </Toggle>
                {draft.trial && (
                  <Segmented<"auto" | "manual">
                    label="Share it with your followers"
                    value={ draft.graduate }
                    options={ [
                      {
                        id: "auto",
                        label: "When it works"
                      },
                      {
                        id: "manual",
                        label: "By hand"
                      }
                    ] }
                    onChange={ ( graduate ) => onPatch( {
                      graduate
                    } ) }
                  />
                )}
              </div>
            )}
            {plan.instagram && plan.kind !== "story" && ( plan.partners.length > 0 || conn.collaborator ) && (
              <div className="flex flex-col gap-1.5">
                <span className={ LEGEND }>With · Instagram collaborators</span>
                {plan.partners.length > 0 && (
                  <div role="group" aria-label="Your accounts as collaborators" className="flex flex-wrap gap-1.5">
                    {plan.partners.map( ( partner ) => (
                      <ChannelChip
                        key={ partner.channel.id }
                        channel={ partner.channel }
                        checked={ partner.invited }
                        note={ partner.handle ? `@${ partner.handle }` : "username?" }
                        disabledReason={ partner.handle ? null : "Type its Instagram username in Publishing (accounts) to invite it" }
                        onToggle={ () => invite( partner.channel.id ) }
                      />
                    ) )}
                  </div>
                )}
                {conn.collaborator && (
                  <Toggle
                    checked={ draft.collab }
                    onChange={ ( collab ) => onPatch( {
                      collab
                    } ) }
                  >
                    @{conn.collaborator} as collaborator
                  </Toggle>
                )}
                <p className="m-0 text-[11px] leading-snug text-label">
                  {plan.collaborators.length
                    ? `One post on ${ plan.targets.filter( ( c ) => providerOf( c.identifier ) === "instagram" ).map( ( c ) => c.name )
                      .join( " and " ) }, co-signed by ${ plan.collaborators.map( ( h ) => `@${ h }` ).join( ", " ) } once the invite is accepted in Instagram.`
                    : "Invite your other account to co-sign ONE post — or tick both in To for a post on each."}
                </p>
              </div>
            )}

            {tickedTargets.includes( "tiktok" ) && (
              <div className="flex flex-col gap-1.5">
                <span className={ LEGEND }>TikTok · who can see it</span>
                <Segmented<TikTokPrivacy>
                  label="TikTok privacy"
                  value={ draft.tiktokPrivacy }
                  options={ TIKTOK.map( ( [
                    id,
                    label
                  ] ) => ( {
                    id,
                    label
                  } ) ) }
                  onChange={ ( tiktokPrivacy ) => onPatch( {
                    tiktokPrivacy
                  } ) }
                />
              </div>
            )}

            {tickedTargets.includes( "youtube" ) && (
              <div className="flex flex-col gap-1.5">
                <span className={ LEGEND }>YouTube needs</span>
                <input
                  id="publish-youtube-title"
                  value={ draft.youtubeTitle ?? facts.title }
                  maxLength={ 100 }
                  onChange={ ( event ) => onPatch( {
                    youtubeTitle: event.target.value
                  } ) }
                  aria-label="YouTube title"
                  className="w-full rounded-lg border border-theme bg-background px-3 py-1.5 text-base text-foreground focus:border-foreground focus:outline-hidden sm:text-xs"
                />
                <Segmented<YouTubeVisibility>
                  label="YouTube visibility"
                  value={ draft.youtubeVisibility }
                  options={ YOUTUBE.map( ( [
                    id,
                    label
                  ] ) => ( {
                    id,
                    label
                  } ) ) }
                  onChange={ ( youtubeVisibility ) => onPatch( {
                    youtubeVisibility
                  } ) }
                />
              </div>
            )}
          </div>

          <div className="flex min-w-0 flex-col gap-1.5">
            <span className={ LEGEND }>When</span>
            <WhenCard
              rhythm={ conn.rhythm }
              taken={ taken }
              when={ when }
              at={ plan.at }
              free={ plan.free }
              warnings={ plan.warnings }
              onChoose={ onWhen }
            />
          </div>

          <div className="flex min-w-0 flex-col gap-1.5 md:col-span-2">
            <span className={ clsx(
              LEGEND,
              plan.text.length > plan.limit && "text-red-500"
            ) }
            >
              Caption · {plan.text.length.toLocaleString( "en-GB" )} / {plan.limit.toLocaleString( "en-GB" )}
              {" · "}
              {draft.approved ? "approved" : "not approved yet"}
            </span>
            <textarea
              ref={ caption }
              id="publish-caption"
              value={ plan.template }
              onChange={ ( event ) => onPatch( {
                caption: event.target.value
              } ) }
              rows={ 5 }
              spellCheck
              aria-label="Caption template"
              className="w-full resize-y rounded-lg border border-theme bg-background px-3 py-2 font-mono text-base leading-snug text-foreground focus:border-foreground focus:outline-hidden sm:text-xs"
            />
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] text-label">Filled when it is sent:</span>
              {CAPTION_TOKENS.map( ( token ) => (
                <button
                  key={ token }
                  type="button"
                  title={ facts[ token ] || "(empty for this sketch)" }
                  onClick={ () => insertToken( token ) }
                  className="rounded-md border border-theme bg-background px-1.5 py-0.5 font-mono text-[10.5px] text-label transition-colors hover:border-foreground hover:text-foreground"
                >
                  {`{${ token }}`}
                </button>
              ) )}
              {draft.caption !== null && (
                <button
                  type="button"
                  onClick={ () => onPatch( {
                    caption: null
                  } ) }
                  className="ml-auto text-[11px] text-label underline underline-offset-2 hover:text-foreground"
                >
                  Sketchbook’s caption
                </button>
              )}
            </div>
            <details className="group">
              <summary className="cursor-pointer list-none text-xs text-label hover:text-foreground">
                As it will read
              </summary>
              <p className="m-0 mt-2 whitespace-pre-wrap border-l-2 border-theme pl-3 text-xs leading-relaxed text-foreground/80">
                {plan.text || "—"}
              </p>
            </details>
            <p className="m-0 text-[11px] text-label">
              Pressing {plan.at === "now" ? "Publish now" : plan.at === "draft" ? "Send as a draft" : "Schedule"} approves
              the words you read. Claude can only schedule a caption you approved.
            </p>
          </div>
        </fieldset>
      )}
    </section>
  );
}
