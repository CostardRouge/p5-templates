"use client";

import React, {
  useCallback, useEffect, useMemo, useRef, useState
} from "react";
import clsx from "clsx";
import {
  Check, ChevronDown
} from "lucide-react";
import ChannelChip, {
  PROVIDER_GLYPH
} from "@/components/ChannelChip";
import {
  PROVIDER_LABEL, providerOf, type PostKind, type TikTokPrivacy, type YouTubeVisibility
} from "@/lib/postiz/client";
import {
  DEFAULT_CAPTION
} from "@/lib/postiz/caption";
import {
  CAPTION_TEMPLATES, FOLD, emptyPills, paletteOf, type PillContext, type PillFacts
} from "@/lib/postiz/pills";
import {
  KIND_LABEL, kindWhy
} from "@/lib/postiz/postShape";
import {
  routeWords, type PlanAccount, type PostPlan, type PostRoute, type RouteWords
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
import PillEditor, {
  type PillEditorHandle
} from "./PillEditor";
import PillPalette, {
  noteRecent, recentPills
} from "./PillPalette";

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

const STATE_WORDS: Record<RouteWords[ "state" ], string> = {
  follows: "follows",
  adapted: "adapted",
  own: "own",
  stale: "own · shared changed",
  over: "too long"
};
const STATE_CLASS: Record<RouteWords[ "state" ], string> = {
  follows: "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  adapted: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  own: "border-indigo-500/40 bg-indigo-500/10 text-indigo-600 dark:text-indigo-300",
  stale: "border-dashed border-indigo-500/60 text-indigo-600 dark:text-indigo-300",
  over: "border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-400"
};

function StateChip( {
  words
}: {
  words: RouteWords;
} ) {
  return (
    <span className={ clsx(
      "inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-1.5 font-mono text-[10px] leading-4",
      STATE_CLASS[ words.state ]
    ) }
    >
      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />
      {STATE_WORDS[ words.state ]}
    </span>
  );
}

function Count( {
  words
}: {
  words: RouteWords;
} ) {
  return (
    <span className={ clsx(
      "whitespace-nowrap font-mono text-[10px] tabular-nums",
      words.state === "over" ? "text-red-500" : "text-label"
    ) }
    >
      {words.length.toLocaleString( "en-GB" )} / {words.limit.toLocaleString( "en-GB" )}
    </span>
  );
}

/**
 * Export › Publish's Post panel (labs 2, 4, 5 and 6, his yes to every
 * recommendation, 2026-11-15): When, then ONE shared text made of pills —
 * the list of pills with their values beside it when the panel is wide, his
 * recent pills and a drawer of all of them when it is narrow — then ONE list
 * of accounts, each row carrying what it receives: ticked or not, its
 * variant, its state and the start of its words; open, its network's
 * settings, its words as they will read (with the network's «… more»), and
 * its own words if he rewrites them, pills still live.
 */
export default function PostBand( {
  conn, plan, draft, when, taken, facts, disabled, onPatch, onWhen, onRemember
}: {
  conn: PostizConnection;
  plan: PostPlan;
  draft: PostDraft;
  when: When;
  taken: readonly Date[];
  facts: PillFacts;
  disabled: boolean;
  onPatch: ( patch: Partial<PostDraft> ) => void;
  onWhen: ( next: When ) => void;
  /** Keep `format` as what this account usually takes. */
  onRemember: ( accountId: string, format: string ) => void;
} ) {
  const rootRef = useRef<HTMLElement | null>( null );
  const [
    narrow,
    setNarrow
  ] = useState( false );
  const [
    drawer,
    setDrawer
  ] = useState( false );
  const [
    openId,
    setOpenId
  ] = useState<string | null>( null );
  const shared = useRef<PillEditorHandle | null>( null );
  const active = useRef<PillEditorHandle | null>( null );
  const [
    activeLabel,
    setActiveLabel
  ] = useState( "the shared words" );
  const ticked = new Set( plan.accounts.filter( ( a ) => a.ticked ).map( ( a ) => a.channel.id ) );

  useEffect(
    () => {
      const el = rootRef.current;

      if ( !el ) {
        return;
      }

      const observer = new ResizeObserver( ( [
        e
      ] ) => setNarrow( e.contentRect.width < 640 ) );

      observer.observe( el );

      return () => observer.disconnect();
    },
    []
  );

  const ctx = useMemo<PillContext>(
    () => ( {
      facts,
      at: plan.at instanceof Date ? plan.at : null,
      timeZone: conn.rhythm.timeZone,
      dayStart: conn.dayStart,
      phrases: conn.phrases
    } ),
    [
      facts,
      plan.at,
      conn.rhythm.timeZone,
      conn.dayStart,
      conn.phrases
    ]
  );
  const palette = useMemo(
    () => paletteOf( conn.phrases ),
    [
      conn.phrases
    ]
  );
  const template = draft.caption ?? DEFAULT_CAPTION;
  const empty = emptyPills(
    template,
    ctx
  );

  const onActive = useCallback(
    ( h: PillEditorHandle ) => {
      active.current = h;
      setActiveLabel( h.label );
    },
    []
  );
  const onSharedMount = useCallback(
    ( h: PillEditorHandle ) => {
      shared.current = h;
    },
    []
  );
  const pick = ( key: string ) => {
    noteRecent( key );
    ( active.current ?? shared.current )?.insert( key );
  };

  const summary = [
    plan.routes.length ? `${ plan.routes.length } account${ plan.routes.length === 1 ? "" : "s" }` : "no account",
    plan.toRead ? `${ plan.toRead } adapted or own` : null,
    plan.collaborators.length ? `with ${ plan.collaborators.map( ( h ) => `@${ h }` ).join( ", " ) }` : null,
    plan.whenWords,
    `words ${ draft.approved ? "approved" : "not approved yet" }`
  ].filter( Boolean )
    .join( " · " );

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

  const pickVariant = (
    account: PlanAccount, variantId: string
  ) => {
    const option = account.options.find( ( o ) => o.variant.id === variantId );

    onPatch( {
      variantFor: {
        ...draft.variantFor,
        [ account.channel.id ]: variantId
      }
    } );

    if ( option ) {
      onRemember(
        account.channel.id,
        option.format
      );
    }
  };

  const rewrite = ( route: PostRoute ) => {
    const id = route.channel.id;

    onPatch( {
      own: {
        ...draft.own,
        [ id ]: route.words.own ? route.words.template : template
      },
      ownBase: {
        ...draft.ownBase,
        [ id ]: template
      }
    } );
  };
  const takeShared = ( route: PostRoute ) => {
    const own = {
      ...draft.own
    };
    const ownBase = {
      ...draft.ownBase
    };

    delete own[ route.channel.id ];
    delete ownBase[ route.channel.id ];
    onPatch( {
      own,
      ownBase,
      // The old short caption was these networks' own words: taking the shared ones back leaves it.
      ...( route.words.own && !draft.own[ route.channel.id ] ? {
        shortCaption: null
      } : {} )
    } );
  };
  const anyOwn = plan.routes.some( ( r ) => r.words.own );
  const recent = recentPills().map( ( k ) => palette.find( ( p ) => p.key === k ) )
    .filter( ( p ): p is NonNullable<typeof p> => Boolean( p ) )
    .slice(
      0,
      6
    );

  return (
    <section ref={ rootRef } aria-label="Post" data-narrow={ narrow ? "" : undefined } className="flex min-w-0 flex-col">
      <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-theme bg-background px-3 py-2">
        <span className="text-xs font-semibold text-foreground">Post</span>
        <span className="min-w-0 flex-1 truncate text-xs text-label">{summary}</span>
      </div>

      <fieldset disabled={ disabled } className="m-0 flex min-w-0 flex-col gap-4 border-0 px-3 pb-4 pt-3">
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

        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <span className={ LEGEND }>Words · shared by every account</span>
            <span className="flex flex-wrap gap-1">
              {[
                {
                  name: "Sketchbook’s own",
                  template: DEFAULT_CAPTION
                },
                ...CAPTION_TEMPLATES
              ].map( ( t ) => (
                <button
                  key={ t.name }
                  type="button"
                  onClick={ () => onPatch( {
                    caption: t.template === DEFAULT_CAPTION ? null : t.template
                  } ) }
                  className={ clsx(
                    "rounded-md border px-1.5 py-0.5 text-[11px] transition-colors pointer-coarse:min-h-9",
                    template === t.template ? "border-foreground text-foreground" : "border-theme text-label hover:border-foreground hover:text-foreground"
                  ) }
                >
                  {t.name}
                </button>
              ) )}
            </span>
          </div>

          <div className={ clsx(
            "grid min-w-0 gap-3",
            !narrow && "grid-cols-[minmax(0,210px)_minmax(0,1fr)]"
          ) }
          >
            {!narrow && (
              <PillPalette
                palette={ palette }
                ctx={ ctx }
                onPick={ pick }
                className="max-h-80 overflow-y-auto rounded-lg border border-theme p-1.5"
              />
            )}
            <div className="flex min-w-0 flex-col gap-2">
              {narrow && (
                <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none]">
                  <button
                    type="button"
                    aria-expanded={ drawer }
                    onMouseDown={ ( e ) => e.preventDefault() }
                    onClick={ () => setDrawer( ( d ) => !d ) }
                    className="shrink-0 rounded-full border border-dashed border-theme px-2.5 text-xs leading-7 text-foreground"
                  >
                    {drawer ? "Close" : "＋ Pill"}
                  </button>
                  {recent.map( ( p ) => (
                    <button
                      key={ p.key }
                      type="button"
                      onMouseDown={ ( e ) => e.preventDefault() }
                      onClick={ () => pick( p.key ) }
                      className="shrink-0 rounded-full border border-theme px-2.5 text-xs leading-7 text-foreground hover:bg-hover"
                    >
                      {p.label}
                    </button>
                  ) )}
                </div>
              )}
              {narrow && drawer && (
                <div className="rounded-lg border border-theme p-1.5">
                  <span className="block px-1.5 pb-1 text-[11px] text-label">Adds to {activeLabel}.</span>
                  <PillPalette palette={ palette } ctx={ ctx } onPick={ pick } className="max-h-72 overflow-y-auto" />
                </div>
              )}
              <PillEditor
                id="publish-caption"
                label="the shared words"
                value={ template }
                ctx={ ctx }
                palette={ palette }
                onChange={ ( next ) => onPatch( {
                  caption: next === DEFAULT_CAPTION ? null : next
                } ) }
                onActive={ onActive }
                onMount={ onSharedMount }
              />
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-label">
                <span className="tabular-nums">
                  {plan.caption.text.length.toLocaleString( "en-GB" )} characters
                  {empty.length ? ` · ${ empty.length } empty for this sketch` : ""}
                </span>
                <span className="hidden sm:inline">Type <kbd className="rounded border border-theme px-1 font-mono">/</kbd> for a pill · click one for its options</span>
                <span className="flex-1" />
                {anyOwn && (
                  <button
                    type="button"
                    onClick={ () => onPatch( {
                      own: {},
                      ownBase: {},
                      shortCaption: null
                    } ) }
                    className="underline underline-offset-2 hover:text-foreground"
                  >
                    ↺ Every account to the shared words
                  </button>
                )}
              </div>
              <label className="flex min-w-0 items-center gap-2 text-[11px] text-label">
                <span className="shrink-0">My note</span>
                <input
                  id="publish-note"
                  value={ draft.note }
                  placeholder="A line about this sketch, in your words — the My note pill"
                  maxLength={ 1000 }
                  onChange={ ( e ) => onPatch( {
                    note: e.target.value
                  } ) }
                  className="min-w-0 flex-1 rounded-md border border-theme bg-background px-2 py-1 text-base text-foreground focus:border-foreground focus:outline-hidden sm:text-xs"
                />
              </label>
            </div>
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-1.5">
          <div className="flex items-baseline justify-between gap-2">
            <span className={ LEGEND }>Accounts · {plan.routes.length} of {plan.accounts.length} · open one for its words</span>
            <button
              type="button"
              onClick={ openPublishing }
              className="font-mono text-[10px] text-label underline underline-offset-2 hover:text-foreground"
            >
              accounts
            </button>
          </div>
          <ul aria-label="Accounts" className="m-0 flex list-none flex-col rounded-lg border border-theme p-0">
            {plan.accounts.map( ( account ) => (
              <AccountRow
                key={ account.channel.id }
                account={ account }
                open={ openId === account.channel.id && Boolean( account.route ) }
                narrow={ narrow }
                draft={ draft }
                plan={ plan }
                conn={ conn }
                facts={ facts }
                ctx={ ctx }
                palette={ palette }
                onOpen={ () => setOpenId( ( o ) => o === account.channel.id ? null : account.channel.id ) }
                onToggle={ () => toggle( account.channel.id ) }
                onVariant={ ( id ) => pickVariant(
                  account,
                  id
                ) }
                onInvite={ invite }
                onPatch={ onPatch }
                onRewrite={ rewrite }
                onShared={ takeShared }
                onActive={ onActive }
              />
            ) )}
          </ul>
          {plan.routes.some( ( r ) => r.shape.media === "image" ) && (
            <p className="m-0 text-[11px] leading-snug text-label">
              Pictures go out as JPEG — Instagram takes nothing else. Your downloaded file stays PNG.
            </p>
          )}
        </div>

        <p className="m-0 text-[11px] text-label">
          Pressing {plan.at === "now" ? "Publish now" : plan.at === "draft" ? "Send as a draft" : "Schedule"} approves
          every account’s words as you read them. Claude can only schedule words you approved.
        </p>
      </fieldset>
    </section>
  );
}

/** The words as the network shows them: «… more» where it folds a caption. */
function AsItReads( {
  words, provider
}: {
  words: RouteWords;
  provider: PostRoute[ "provider" ];
} ) {
  const fold = FOLD[ provider ];
  const text = words.text || "—";

  return (
    <div className="flex flex-col gap-1">
      <p className="m-0 whitespace-pre-wrap break-words border-l-2 border-theme pl-3 text-xs leading-relaxed text-foreground/85">
        {fold && text.length > fold ? (
          <>
            {text.slice(
              0,
              fold
            )}
            <span className="text-label"> … more</span>
            <span className="text-foreground/40">{text.slice( fold )}</span>
          </>
        ) : text}
      </p>
      {fold && text.length > fold && <span className="text-[11px] text-label">{PROVIDER_LABEL[ provider ]} shows the first {fold} characters before «more».</span>}
    </div>
  );
}

/**
 * One account: ticked or not; folded, its variant, its state and the start of
 * its words; open, its network's settings (Instagram's kind, story, Trial
 * Reel and collaborators, TikTok's privacy, YouTube's title and visibility),
 * its words as they will read, and its own words if he rewrites them.
 */
function AccountRow( {
  account, open, narrow, draft, plan, conn, facts, ctx, palette, onOpen, onToggle, onVariant, onInvite, onPatch, onRewrite, onShared, onActive
}: {
  account: PlanAccount;
  open: boolean;
  narrow: boolean;
  draft: PostDraft;
  plan: PostPlan;
  conn: PostizConnection;
  facts: PillFacts;
  ctx: PillContext;
  palette: ReturnType<typeof paletteOf>;
  onOpen: () => void;
  onToggle: () => void;
  onVariant: ( variantId: string ) => void;
  onInvite: ( id: string ) => void;
  onPatch: ( patch: Partial<PostDraft> ) => void;
  onRewrite: ( route: PostRoute ) => void;
  onShared: ( route: PostRoute ) => void;
  onActive: ( h: PillEditorHandle ) => void;
} ) {
  const {
    channel, provider, ticked, reason, options, usual, route
  } = account;
  const on = ticked && !reason;
  const invited = draft.collabAccounts.includes( channel.id );
  const storyAllowed = route?.kind && route.kind !== "story" && route.shape.files === 1;
  const words = route?.words;
  const firstLine = words ? ( words.text.split( "\n" ).find( ( l ) => l.trim() ) ?? "—" ) : null;
  const line = reason && ticked ? reason : invited && !ticked ? "Invited as collaborator on the Instagram post" : !ticked ? "Not ticked" : firstLine;

  return (
    <li className={ clsx(
      "border-b border-theme last:border-b-0",
      reason && "opacity-55"
    ) }
    >
      <div className="grid grid-cols-[auto_minmax(0,1fr)] items-stretch">
        <button
          type="button"
          role="checkbox"
          aria-checked={ on }
          aria-label={ `Post to ${ channel.name } on ${ PROVIDER_LABEL[ provider ] }` }
          disabled={ Boolean( reason ) }
          title={ reason ?? undefined }
          onClick={ onToggle }
          className="grid place-items-center pl-2.5 pr-1 pointer-coarse:min-w-11"
        >
          <span
            aria-hidden="true"
            className={ clsx(
              "grid h-4 w-4 place-items-center rounded border pointer-coarse:h-5 pointer-coarse:w-5",
              on ? "border-foreground bg-foreground text-background" : "border-label"
            ) }
          >
            {on && <Check className="h-3 w-3" strokeWidth={ 3 } />}
          </span>
        </button>
        <button
          type="button"
          aria-expanded={ open }
          disabled={ !route }
          onClick={ onOpen }
          className="grid min-w-0 grid-cols-[20px_minmax(0,1fr)_auto] items-center gap-x-2.5 gap-y-0.5 py-2 pl-1 pr-3 text-left enabled:hover:bg-hover pointer-coarse:min-h-13"
        >
          {channel.picture
            ? <img src={ channel.picture } alt="" className="row-span-2 h-5 w-5 self-start rounded-full object-cover" />
            : <span aria-hidden="true" className="row-span-2 grid h-5 w-5 place-items-center self-start rounded-full bg-hover font-mono text-[8px] font-semibold">{PROVIDER_GLYPH[ provider ]}</span>}
          <span className="flex min-w-0 items-baseline gap-2">
            <span className="truncate text-xs font-medium text-foreground">{channel.name}</span>
            <span className="shrink-0 font-mono text-[10px] text-label">
              {PROVIDER_LABEL[ provider ]}{route ? ` · ${ routeWords( route ).split( " · " )[ 0 ] }` : ""}
            </span>
          </span>
          <span className="flex items-center justify-end gap-2">
            {words && <StateChip words={ words } />}
            {words && !narrow && <Count words={ words } />}
          </span>
          <span className={ clsx(
            "col-span-2 min-w-0 text-[11px]",
            narrow ? "line-clamp-2" : "truncate",
            reason && ticked ? "text-red-500" : "text-label"
          ) }
          >
            {line}
          </span>
        </button>
      </div>

      {open && route && words && (
        <div className="flex min-w-0 flex-col gap-2.5 px-3 pb-3 pt-1 sm:pl-12">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <select
              value={ route.variant.id }
              onChange={ ( event ) => onVariant( event.target.value ) }
              aria-label={ `Variant for ${ channel.name }` }
              className="min-w-0 max-w-full rounded-md border border-theme bg-background px-2 py-1 text-base text-foreground focus:border-foreground focus:outline-hidden sm:text-xs pointer-coarse:min-h-10"
            >
              {options.map( ( option ) => (
                <option key={ option.variant.id } value={ option.variant.id } disabled={ Boolean( option.reason ) }>
                  {option.variant.name} · {option.format}{option.reason ? " — not here" : ""}
                </option>
              ) )}
            </select>
            <span className="font-mono text-[10px] text-label">
              {routeWords( route )}
              {route.source === "usual" ? ` · usually ${ route.format }` : route.source === "picked" ? ` · remembered: ${ route.format }` : usual ? ` · usually ${ usual }, none here` : ""}
            </span>
          </div>

          {route.kind && (
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <div className="min-w-0 flex-1">
                <Segmented<PostKind>
                  label={ `Post as on ${ channel.name }` }
                  value={ route.kind }
                  options={ KINDS.map( ( k ) => ( {
                    id: k,
                    label: KIND_LABEL[ k ],
                    disabled: kindWhy(
                      k,
                      route.shape
                    )
                  } ) ) }
                  onChange={ ( kind ) => onPatch( {
                    kindFor: {
                      ...draft.kindFor,
                      [ channel.id ]: kind
                    }
                  } ) }
                />
              </div>
              {storyAllowed && (
                <Toggle
                  checked={ draft.storyToo.includes( channel.id ) }
                  onChange={ ( storyOn ) => onPatch( {
                    storyToo: storyOn
                      ? [
                        ...draft.storyToo,
                        channel.id
                      ]
                      : draft.storyToo.filter( ( x ) => x !== channel.id )
                  } ) }
                  title="The same file also goes out as a story on this account"
                >
                  + Story
                </Toggle>
              )}
            </div>
          )}

          {route.kind === "reel" && (
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

          {provider === "instagram" && route.kind !== "story" && ( plan.partners.length > 0 || conn.collaborator ) && (
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
                      onToggle={ () => onInvite( partner.channel.id ) }
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
            </div>
          )}

          {provider === "tiktok" && (
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
          )}

          {provider === "youtube" && (
            <div className="flex flex-col gap-1.5">
              <input
                id="publish-youtube-title"
                value={ draft.youtubeTitle ?? facts.title }
                maxLength={ 100 }
                onChange={ ( event ) => onPatch( {
                  youtubeTitle: event.target.value
                } ) }
                aria-label="YouTube title"
                className="w-full rounded-md border border-theme bg-background px-2 py-1.5 text-base text-foreground focus:border-foreground focus:outline-hidden sm:text-xs"
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

          <AsItReads words={ words } provider={ provider } />
          <span className="text-[11px] text-label">
            <Count words={ words } />
            {" · "}
            {words.notes.length ? `Adapted: ${ words.notes.join( " · " ) }.` : words.own ? "Its own words, as they will read." : "The shared words, as they are."}
          </span>

          {words.state === "stale" && (
            <div className="flex flex-wrap items-center gap-2 rounded-md border border-dashed border-indigo-500/50 bg-indigo-500/5 px-2.5 py-1.5 text-xs">
              <span className="min-w-0 basis-full sm:basis-auto sm:flex-1">You changed the shared words after rewriting this one.</span>
              <button type="button" onClick={ () => onShared( route ) } className="rounded-md border border-theme bg-background px-2 py-1 hover:bg-hover">Take the new shared words</button>
              <button
                type="button"
                onClick={ () => onPatch( {
                  ownBase: {
                    ...draft.ownBase,
                    [ channel.id ]: draft.caption ?? DEFAULT_CAPTION
                  }
                } ) }
                className="text-label underline underline-offset-2"
              >
                Keep mine
              </button>
            </div>
          )}

          {words.own ? (
            <div className="flex flex-col gap-1.5">
              <span className={ LEGEND }>Its own words · pills stay live</span>
              <PillEditor
                id={ `publish-own-${ channel.id }` }
                label={ `the words of ${ channel.name } on ${ PROVIDER_LABEL[ provider ] }` }
                value={ words.template }
                ctx={ ctx }
                palette={ palette }
                small
                onChange={ ( next ) => onPatch( {
                  own: {
                    ...draft.own,
                    [ channel.id ]: next
                  },
                  ownBase: {
                    ...draft.ownBase,
                    [ channel.id ]: draft.ownBase[ channel.id ] ?? ( draft.caption ?? DEFAULT_CAPTION )
                  }
                } ) }
                onActive={ onActive }
              />
              <span>
                <button type="button" onClick={ () => onShared( route ) } className="rounded-md border border-theme px-2 py-1 text-xs hover:bg-hover pointer-coarse:min-h-10">↺ Shared words</button>
              </span>
            </div>
          ) : (
            <span className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={ () => onRewrite( route ) } className="rounded-md border border-theme px-2 py-1 text-xs hover:bg-hover pointer-coarse:min-h-10">Rewrite for this account</button>
              <span className="text-[11px] text-label">It starts from the shared words, pills included.</span>
            </span>
          )}
        </div>
      )}
    </li>
  );
}
