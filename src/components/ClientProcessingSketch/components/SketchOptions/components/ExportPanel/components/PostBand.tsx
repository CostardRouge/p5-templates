"use client";

import React, {
  useRef, useState
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
  CAPTION_TOKENS, type CaptionFacts
} from "@/lib/postiz/caption";
import {
  KIND_LABEL, kindWhy
} from "@/lib/postiz/postShape";
import {
  routeWords, type PlanAccount, type PostPlan
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
 * Export › Publish's band under the variants (lab 1 §6, reworked 2026-11-11
 * on his ask: each network its own format). To is one ROW per account — ticked
 * or not, the variant it takes (a 9:16 Reel for Instagram, a square picture
 * for Threads, X and Bluesky), Instagram's kind and «also as a story». A pick
 * is remembered for the account as a FORMAT (`video 9:16`), so the next
 * sketch's export routes itself. Then Instagram's collaborators, TikTok's and
 * YouTube's settings, When, and two captions: the long one (Instagram, TikTok,
 * YouTube) and the short one (Threads, X, Bluesky).
 */
export default function PostBand( {
  conn, plan, draft, when, taken, facts, disabled, onPatch, onWhen, onRemember
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
  /** Keep `format` as what this account usually takes. */
  onRemember: ( accountId: string, format: string ) => void;
} ) {
  const [
    open,
    setOpen
  ] = useState( true );
  const longArea = useRef<HTMLTextAreaElement | null>( null );
  const shortArea = useRef<HTMLTextAreaElement | null>( null );
  const lastArea = useRef<"long" | "short">( "long" );
  const ticked = new Set( plan.accounts.filter( ( a ) => a.ticked ).map( ( a ) => a.channel.id ) );
  const providers = new Set( plan.routes.map( ( r ) => r.provider ) );

  // `Reel → Steeve Pommier · Picture 1:1 → X, Threads`, grouped by what each variant sends.
  const groups = new Map<string, string[]>();

  for ( const route of plan.routes ) {
    const key = `${ routeWords( route ).split( " · " )[ 0 ] } ${ route.format.split( " " )[ 1 ] }`;
    const twin = plan.routes.filter( ( r ) => r.provider === route.provider ).length > 1;

    groups.set(
      key,
      [
        ...( groups.get( key ) ?? [] ),
        twin ? `${ PROVIDER_LABEL[ route.provider ] } (${ route.channel.name })` : PROVIDER_LABEL[ route.provider ]
      ]
    );
  }

  const summary = [
    plan.routes.length ? [
      ...groups
    ].map( ( [
      what,
      names
    ] ) => `${ what } → ${ names.join( ", " ) }` ).join( " · " ) : "no account",
    plan.collaborators.length ? `with ${ plan.collaborators.map( ( h ) => `@${ h }` ).join( ", " ) }` : null,
    plan.whenWords,
    `caption ${ draft.approved ? "approved" : "not approved yet" }`
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

  const insertToken = ( token: string ) => {
    const short = lastArea.current === "short" && plan.shortCaption.used;
    const area = short ? shortArea.current : longArea.current;
    const text = short ? plan.shortCaption.template : plan.caption.template;
    const start = area?.selectionStart ?? text.length;
    const end = area?.selectionEnd ?? start;
    const next = `${ text.slice(
      0,
      start
    ) }{${ token }}${ text.slice( end ) }`;

    onPatch( short ? {
      shortCaption: next
    } : {
      caption: next
    } );
  };

  const showLong = plan.caption.used || !plan.shortCaption.used;
  const accountsLegend = ( names: Set<string> ) => [
    ...names
  ].map( ( p ) => PROVIDER_LABEL[ p as keyof typeof PROVIDER_LABEL ] ).join( ", " );
  const longNames = accountsLegend( new Set( plan.routes.filter( ( r ) => !r.short ).map( ( r ) => r.provider ) ) ) || "Instagram, TikTok, YouTube";
  const shortNames = accountsLegend( new Set( plan.routes.filter( ( r ) => r.short ).map( ( r ) => r.provider ) ) );

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
                <span className={ LEGEND }>To · each account its variant</span>
                <button
                  type="button"
                  onClick={ openPublishing }
                  className="font-mono text-[10px] text-label underline underline-offset-2 hover:text-foreground"
                >
                  accounts
                </button>
              </div>
              <ul aria-label="Accounts" className="m-0 flex list-none flex-col gap-1.5 p-0">
                {plan.accounts.map( ( account ) => (
                  <AccountRow
                    key={ account.channel.id }
                    account={ account }
                    invited={ draft.collabAccounts.includes( account.channel.id ) }
                    storyToo={ draft.storyToo.includes( account.channel.id ) }
                    onToggle={ () => toggle( account.channel.id ) }
                    onVariant={ ( id ) => pickVariant(
                      account,
                      id
                    ) }
                    onKind={ ( kind ) => onPatch( {
                      kindFor: {
                        ...draft.kindFor,
                        [ account.channel.id ]: kind
                      }
                    } ) }
                    onStory={ ( on ) => onPatch( {
                      storyToo: on
                        ? [
                          ...draft.storyToo,
                          account.channel.id
                        ]
                        : draft.storyToo.filter( ( x ) => x !== account.channel.id )
                    } ) }
                  />
                ) )}
              </ul>
              {plan.routes.some( ( r ) => r.shape.media === "image" ) && (
                <p className="m-0 text-[11px] leading-snug text-label">
                  Pictures go out as JPEG — Instagram takes nothing else. Your downloaded file stays PNG.
                </p>
              )}
            </div>

            {plan.routes.some( ( r ) => r.kind === "reel" ) && (
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

            {plan.instagram && ( plan.partners.length > 0 || conn.collaborator ) && plan.routes.some( ( r ) => r.provider === "instagram" && r.kind !== "story" ) && (
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
                    ? `One post on ${ plan.routes.filter( ( r ) => r.provider === "instagram" ).map( ( r ) => r.channel.name )
                      .join( " and " ) }, co-signed by ${ plan.collaborators.map( ( h ) => `@${ h }` ).join( ", " ) } once the invite is accepted in Instagram.`
                    : "Invite your other account to co-sign ONE post — or tick both in To for a post on each."}
                </p>
              </div>
            )}

            {providers.has( "tiktok" ) && (
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

            {providers.has( "youtube" ) && (
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

          <div className="flex min-w-0 flex-col gap-3 md:col-span-2">
            {showLong && (
              <CaptionField
                id="publish-caption"
                legend={ `Caption · ${ longNames }` }
                caption={ plan.caption }
                approved={ draft.approved }
                areaRef={ longArea }
                onFocus={ () => {
                  lastArea.current = "long";
                } }
                onChange={ ( caption ) => onPatch( {
                  caption
                } ) }
                onReset={ draft.caption !== null ? () => onPatch( {
                  caption: null
                } ) : null }
              />
            )}
            {plan.shortCaption.used && (
              <CaptionField
                id="publish-short-caption"
                legend={ `Short caption · ${ shortNames }` }
                caption={ plan.shortCaption }
                approved={ draft.approved }
                areaRef={ shortArea }
                onFocus={ () => {
                  lastArea.current = "short";
                } }
                onChange={ ( shortCaption ) => onPatch( {
                  shortCaption
                } ) }
                onReset={ draft.shortCaption !== null ? () => onPatch( {
                  shortCaption: null
                } ) : null }
              />
            )}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] text-label">Filled when it is sent:</span>
              {CAPTION_TOKENS.map( ( token ) => (
                <button
                  key={ token }
                  type="button"
                  title={ facts[ token ] || "(empty for this sketch)" }
                  onMouseDown={ ( event ) => event.preventDefault() }
                  onClick={ () => insertToken( token ) }
                  className="rounded-md border border-theme bg-background px-1.5 py-0.5 font-mono text-[10.5px] text-label transition-colors hover:border-foreground hover:text-foreground"
                >
                  {`{${ token }}`}
                </button>
              ) )}
            </div>
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

/** One account: ticked or not, the variant it takes, Instagram's kind and «also as a story». */
function AccountRow( {
  account, invited, storyToo, onToggle, onVariant, onKind, onStory
}: {
  account: PlanAccount;
  invited: boolean;
  storyToo: boolean;
  onToggle: () => void;
  onVariant: ( variantId: string ) => void;
  onKind: ( kind: PostKind ) => void;
  onStory: ( on: boolean ) => void;
} ) {
  const {
    channel, provider, ticked, reason, options, usual, route
  } = account;
  const on = ticked && !reason;
  const storyAllowed = route?.kind && route.kind !== "story" && route.shape.files === 1;

  return (
    <li
      className={ clsx(
        "flex flex-col gap-1.5 rounded-lg border px-2 py-1.5",
        on ? "border-foreground/60" : "border-theme",
        reason && "opacity-50"
      ) }
    >
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          role="checkbox"
          aria-checked={ on }
          disabled={ Boolean( reason ) }
          title={ reason ?? undefined }
          onClick={ onToggle }
          className="flex min-h-8 min-w-0 flex-1 items-center gap-2 text-left text-xs text-foreground pointer-coarse:min-h-11"
        >
          <span
            aria-hidden="true"
            className={ clsx(
              "grid h-4 w-4 shrink-0 place-items-center rounded border",
              on ? "border-foreground bg-foreground text-background" : "border-label"
            ) }
          >
            {on && <Check className="h-3 w-3" strokeWidth={ 3 } />}
          </span>
          {channel.picture
            ? <img src={ channel.picture } alt="" className="h-5 w-5 shrink-0 rounded-full object-cover" />
            : <span aria-hidden="true" className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-hover font-mono text-[8px] font-semibold">{PROVIDER_GLYPH[ provider ]}</span>}
          <span className="truncate">{channel.name}</span>
          <span className="shrink-0 font-mono text-[10px] text-label">{PROVIDER_LABEL[ provider ].toLowerCase()}</span>
        </button>
      </div>
      {invited && !ticked && <span className="pl-6 text-[11px] text-label">Invited as collaborator below</span>}
      {reason && ticked && <span className="pl-6 text-[11px] text-red-500">{reason}</span>}
      {route && (
        <div className="flex flex-wrap items-center gap-2 pl-6">
          {route && (
            <select
              value={ route.variant.id }
              onChange={ ( event ) => onVariant( event.target.value ) }
              aria-label={ `Variant for ${ channel.name }` }
              className="min-w-0 max-w-full basis-full rounded-md border border-theme bg-background px-2 py-1 text-base text-foreground focus:border-foreground focus:outline-hidden sm:text-xs"
            >
              {options.map( ( option ) => (
                <option key={ option.variant.id } value={ option.variant.id } disabled={ Boolean( option.reason ) }>
                  {option.variant.name} · {option.format}{option.reason ? " — not here" : ""}
                </option>
              ) )}
            </select>
          )}
          {route.kind && (
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
                onChange={ onKind }
              />
            </div>
          )}
          {storyAllowed && (
            <Toggle checked={ storyToo } onChange={ onStory } title="The same file also goes out as a story on this account">
              + Story
            </Toggle>
          )}
          <span className="basis-full font-mono text-[10px] text-label">
            {routeWords( route )}
            {route.source === "usual" ? ` · usually ${ route.format }` : route.source === "picked" ? ` · remembered: ${ route.format }` : usual ? ` · usually ${ usual }, none here` : ""}
          </span>
        </div>
      )}
    </li>
  );
}

/** A caption template, its count against its networks' limit, and how it will read. */
function CaptionField( {
  id, legend, caption, approved, areaRef, onFocus, onChange, onReset
}: {
  id: string;
  legend: string;
  caption: PostPlan[ "caption" ];
  approved: boolean;
  areaRef: React.RefObject<HTMLTextAreaElement | null>;
  onFocus: () => void;
  onChange: ( template: string ) => void;
  onReset: ( () => void ) | null;
} ) {
  const over = caption.text.length > caption.limit;

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span className={ clsx(
        LEGEND,
        over && "text-red-500"
      ) }
      >
        {legend} · {caption.text.length.toLocaleString( "en-GB" )} / {caption.limit.toLocaleString( "en-GB" )} · {approved ? "approved" : "not approved yet"}
      </span>
      <textarea
        ref={ areaRef }
        id={ id }
        value={ caption.template }
        onFocus={ onFocus }
        onChange={ ( event ) => onChange( event.target.value ) }
        rows={ id === "publish-caption" ? 5 : 3 }
        spellCheck
        aria-label={ legend }
        className="w-full resize-y rounded-lg border border-theme bg-background px-3 py-2 font-mono text-base leading-snug text-foreground focus:border-foreground focus:outline-hidden sm:text-xs"
      />
      <div className="flex items-center gap-3">
        <details className="group min-w-0 flex-1">
          <summary className="cursor-pointer list-none text-xs text-label hover:text-foreground">As it will read</summary>
          <p className="m-0 mt-2 whitespace-pre-wrap border-l-2 border-theme pl-3 text-xs leading-relaxed text-foreground/80">{caption.text || "—"}</p>
        </details>
        {onReset && (
          <button type="button" onClick={ onReset } className="shrink-0 self-start text-[11px] text-label underline underline-offset-2 hover:text-foreground">
            Sketchbook’s own
          </button>
        )}
      </div>
    </div>
  );
}
