/**
 * Publishing, as the Export dialog's Publish mode does it (lab 1, P5): the
 * same per-sketch post (`publishStore`) the Post band edits — an agent's
 * choices show up there, and the other way round — the same reading
 * (`planPost`), the same render (`h.exports.run`) and the same send
 * (`sendPost`). Atelier's rule holds: an agent schedules only a caption the
 * person approved — `publish.approve` exists for when they say so in the
 * conversation, and any new words take the approval back.
 */
import {
  CommandError, type CommandSpec
} from "../../../../scripts/mcp/registry.ts";
import {
  PROVIDER_LABEL, providerOf, type PostKind, type PostizClient
} from "../../postiz/client";
import {
  planPost, plannedInstants, type PostPlan
} from "../../postiz/plan";
import {
  KIND_LABEL
} from "../../postiz/postShape";
import {
  addPublication,
  dropPublication,
  getDraft,
  getPublications,
  getWhen,
  patchDraft,
  setWhen,
  type PostDraft,
  type When
} from "../../postiz/publishStore";
import {
  rhythmGrid, slotLabel
} from "../../postiz/rhythm";
import {
  mimeOf, sendPost
} from "../../postiz/send";
import type {
  PostizConnection
} from "../../postiz/store";
import type {
  ExportArtifact
} from "../../export/runExportBatch";
import type {
  StudioHandles
} from "../handles";

const AHEAD_DAYS = 42;
const KINDS: PostKind[] = [
  "reel",
  "post",
  "carousel",
  "story"
];

/** One send at a time, as the dialog's single button. */
let sending = false;

function connection( h: StudioHandles ): {
  conn: PostizConnection;
  client: PostizClient;
} {
  const conn = h.publish.connection();
  const client = h.publish.client();

  if ( !conn || !client ) {
    throw new CommandError(
      "unavailable",
      "no Postiz is connected in this browser — the person connects one in Menu › Publishing"
    );
  }

  return {
    conn,
    client
  };
}

async function readPlanned( client: PostizClient ) {
  const now = Date.now();

  try {
    return await client.posts(
      new Date( now - 86400000 ),
      new Date( now + AHEAD_DAYS * 86400000 )
    );
  } catch {
    return [];
  }
}

async function currentPlan( h: StudioHandles ): Promise<{ plan: PostPlan;
  conn: PostizConnection;
  client: PostizClient;
  draft: PostDraft }> {
  const {
    conn, client
  } = connection( h );
  const key = h.publish.key();
  const draft = getDraft( key );
  const plan = planPost( {
    conn,
    draft,
    when: getWhen( key ),
    variants: h.exports.list().map( ( variant ) => ( {
      variant,
      slideSpan: h.publish.slideSpan( variant )
    } ) ),
    facts: h.publish.facts(),
    planned: plannedInstants( await readPlanned( client ) )
  } );

  return {
    plan,
    conn,
    client,
    draft
  };
}

/** What an agent reads of a plan: the post as the Post band shows it. */
function describePlan(
  plan: PostPlan, draft: PostDraft, tz: string
) {
  return {
    variant: plan.variant ? {
      id: plan.variant.id,
      name: plan.variant.name
    } : null,
    files: plan.shape?.files ?? null,
    media: plan.shape?.media ?? null,
    kind: plan.instagram && plan.kind ? KIND_LABEL[ plan.kind ] : null,
    kinds: plan.shape?.kinds.map( ( k ) => KIND_LABEL[ k ] ) ?? [],
    accounts: plan.accounts.map( ( a ) => ( {
      id: a.channel.id,
      name: a.channel.name,
      network: PROVIDER_LABEL[ providerOf( a.channel.identifier ) ],
      ticked: a.ticked,
      ...( a.reason ? {
        refused: a.reason
      } : {} )
    } ) ),
    goesTo: plan.targets.map( ( c ) => c.name ),
    collaborators: plan.collaborators.map( ( h ) => `@${ h }` ),
    canInvite: plan.partners.map( ( p ) => ( {
      id: p.channel.id,
      name: p.channel.name,
      username: p.handle,
      invited: p.invited
    } ) ),
    when: plan.whenWords,
    verb: plan.verb,
    nextFreeSlot: plan.free ? slotLabel(
      plan.free,
      tz
    ) : null,
    rhythmWarnings: plan.warnings,
    caption: plan.text,
    captionLength: `${ plan.text.length } / ${ plan.limit }`,
    approved: draft.approved,
    blocked: plan.blocked
  };
}

/** `next`, `now`, `draft` or an ISO date-time with its zone. */
function readWhen( value: string ): When {
  if ( value === "next" || value === "now" || value === "draft" ) {
    return {
      kind: value
    };
  }

  const at = new Date( value );

  if ( Number.isNaN( at.getTime() ) || !/[zZ]|[+-]\d\d:?\d\d$/.test( value ) ) {
    throw new CommandError(
      "invalid",
      `when must be next, now, draft or an ISO date-time WITH its zone (2026-11-17T09:00:00+01:00) — got "${ value }"`
    );
  }

  if ( at.getTime() <= Date.now() ) {
    throw new CommandError(
      "invalid",
      "that time is past"
    );
  }

  return {
    kind: "at",
    at: at.toISOString(),
    custom: true
  };
}

export function publishCommands( h: StudioHandles ): CommandSpec[] {
  const connected = () => h.publish.connection() ? true : "no Postiz is connected in this browser — the person connects one in Menu › Publishing";

  return [
    {
      id: "publish.status",
      title: "Publishing status",
      description: "The connected Postiz's accounts, the person's rhythm and next free slot, and this sketch's post as the Export dialog's Post band holds it (variant, accounts, kind, when, caption, approval, what blocks it), plus what this sketch already sent.",
      available: connected,
      async run() {
        const {
          plan, conn, draft
        } = await currentPlan( h );
        const tz = conn.rhythm.timeZone;

        return {
          postiz: new URL( conn.apiBase ).host,
          rhythm: {
            timeZone: tz,
            slots: conn.rhythm.slots.map( ( s ) => `${ [
              "Sun",
              "Mon",
              "Tue",
              "Wed",
              "Thu",
              "Fri",
              "Sat"
            ][ s.day ] } ${ s.time }` ),
            perWeek: conn.rhythm.perWeek
          },
          collaborator: conn.collaborator || null,
          post: describePlan(
            plan,
            draft,
            tz
          ),
          sent: getPublications( h.publish.key() ).map( ( p ) => ( {
            postIds: p.postIds,
            kind: KIND_LABEL[ p.kind ],
            variant: p.variantName,
            as: p.target,
            at: p.at ? slotLabel(
              new Date( p.at ),
              tz
            ) : null
          } ) )
        };
      }
    },
    {
      id: "publish.facts",
      title: "What a caption can say",
      description: "The sketch's words a caption template fills — {title}, {description}, {tags}, {engine}, {seconds}, {link}, {sketch} — the template as it stands and the caption it reads as. Read this before writing a caption.",
      run: () => {
        const draft = getDraft( h.publish.key() );
        const conn = h.publish.connection();
        const facts = h.publish.facts();
        const plan = conn ? planPost( {
          conn,
          draft,
          when: getWhen( h.publish.key() ),
          variants: [],
          facts,
          planned: []
        } ) : null;

        return {
          facts,
          template: plan?.template ?? draft.caption,
          caption: plan?.text ?? null,
          approved: draft.approved
        };
      }
    },
    {
      id: "publish.compose",
      title: "Set up the post",
      description: "Choose, in the Export dialog's Post band, the variant that goes (export.variants lists them), the accounts (publish.status lists them, by id), Instagram's kind, when, and each network's options. Only what is given changes. Answers the post as it now stands.",
      available: connected,
      params: {
        variant: {
          type: "string",
          description: "Variant id",
          optional: true
        },
        accounts: {
          type: "strings",
          description: "Account ids to post to (replaces the ticked ones)",
          optional: true
        },
        kind: {
          type: "string",
          description: "Instagram's kind",
          enum: KINDS,
          optional: true
        },
        when: {
          type: "string",
          description: "next (the next free slot of the rhythm), now, draft (kept in Postiz, unsent), or an ISO date-time with its zone",
          optional: true
        },
        collaborators: {
          type: "strings",
          description: "His OTHER Instagram accounts (ids) invited to co-sign ONE post on the account it goes to — instead of a post on each; replaces the invited ones. publish.status lists them under canInvite.",
          optional: true
        },
        trial: {
          type: "boolean",
          description: "Instagram trial Reel: non-followers first",
          optional: true
        },
        collaborator: {
          type: "boolean",
          description: "Propose the person's collaborator (publish.status names them)",
          optional: true
        },
        tiktokPrivacy: {
          type: "string",
          description: "Who can see it on TikTok",
          enum: [
            "PUBLIC_TO_EVERYONE",
            "MUTUAL_FOLLOW_FRIENDS",
            "SELF_ONLY"
          ],
          optional: true
        },
        youtubeTitle: {
          type: "string",
          description: "YouTube's title, 2 to 100 characters",
          optional: true
        },
        youtubeVisibility: {
          type: "string",
          description: "YouTube's visibility",
          enum: [
            "public",
            "unlisted",
            "private"
          ],
          optional: true
        }
      },
      async run( params ) {
        const {
          conn
        } = connection( h );
        const key = h.publish.key();
        const patch: Partial<PostDraft> = {};

        if ( params.variant !== undefined ) {
          const variant = h.exports.list().find( ( v ) => v.id === params.variant );

          if ( !variant ) {
            throw new CommandError(
              "invalid",
              `no variant "${ params.variant }" — export.variants lists them`
            );
          }
          patch.variantId = variant.id;
        }

        if ( params.accounts !== undefined ) {
          const ids = params.accounts as string[];
          const unknown = ids.filter( ( id ) => !conn.channels.some( ( c ) => c.id === id ) );

          if ( unknown.length ) {
            throw new CommandError(
              "invalid",
              `no account ${ unknown.join( ", " ) } — ${ conn.channels.map( ( c ) => `${ c.id } (${ c.name })` ).join( ", " ) }`
            );
          }
          patch.channelIds = ids;
        }

        if ( params.kind !== undefined ) {
          patch.kind = params.kind as PostKind;
        }

        if ( params.collaborators !== undefined ) {
          const ids = params.collaborators as string[];
          const wrong = ids.filter( ( id ) => !conn.channels.some( ( c ) => c.id === id && providerOf( c.identifier ) === "instagram" ) );

          if ( wrong.length ) {
            throw new CommandError(
              "invalid",
              `${ wrong.join( ", " ) } is not one of his Instagram accounts — publish.status lists them`
            );
          }

          const going = patch.channelIds ?? getDraft( key ).channelIds ?? conn.defaultChannelIds;

          if ( params.accounts !== undefined && ids.some( ( id ) => going.includes( id ) ) ) {
            throw new CommandError(
              "invalid",
              "an account the post goes to cannot also be invited as its collaborator"
            );
          }

          patch.collabAccounts = ids;
          // An invited account is no longer one the post goes to.
          patch.channelIds = going.filter( ( id ) => !ids.includes( id ) );
        }

        if ( params.trial !== undefined ) {
          patch.trial = params.trial as boolean;
        }

        if ( params.collaborator !== undefined ) {
          patch.collab = params.collaborator as boolean;
        }

        if ( params.tiktokPrivacy !== undefined ) {
          patch.tiktokPrivacy = params.tiktokPrivacy as PostDraft[ "tiktokPrivacy" ];
        }

        if ( params.youtubeTitle !== undefined ) {
          const title = String( params.youtubeTitle ).trim();

          if ( title.length < 2 || title.length > 100 ) {
            throw new CommandError(
              "invalid",
              "a YouTube title is 2 to 100 characters"
            );
          }
          patch.youtubeTitle = title;
        }

        if ( params.youtubeVisibility !== undefined ) {
          patch.youtubeVisibility = params.youtubeVisibility as PostDraft[ "youtubeVisibility" ];
        }

        const when = params.when === undefined ? null : readWhen( String( params.when ) );

        // The kind must fit the variant it will carry: refused, never bent.
        if ( patch.kind ) {
          const draft = {
            ...getDraft( key ),
            ...patch
          };
          const plan = planPost( {
            conn,
            draft,
            when: getWhen( key ),
            variants: h.exports.list().map( ( variant ) => ( {
              variant,
              slideSpan: h.publish.slideSpan( variant )
            } ) ),
            facts: h.publish.facts(),
            planned: []
          } );

          if ( plan.kind !== patch.kind ) {
            throw new CommandError(
              "invalid",
              `${ plan.variant?.name ?? "this variant" } cannot be a ${ KIND_LABEL[ patch.kind ] } — it can be ${ plan.shape?.kinds.map( ( k ) => KIND_LABEL[ k ] ).join( ", " ) || "nothing" }`
            );
          }
        }

        patchDraft(
          key,
          {
            ...patch,
            mode: "publish"
          }
        );

        if ( when ) {
          setWhen(
            key,
            when
          );
        }

        const {
          plan, draft
        } = await currentPlan( h );

        return describePlan(
          plan,
          draft,
          conn.rhythm.timeZone
        );
      }
    },
    {
      id: "publish.caption",
      title: "Write the caption",
      description: "Replace the caption TEMPLATE ({title}, {description}, {tags}, {engine}, {seconds}, {link}, {sketch} are filled when it is sent; omit template to go back to Sketchbook's own). New words are NOT approved: show the person the caption it reads as, and publish.approve only once they say it suits them.",
      params: {
        template: {
          type: "string",
          description: "The caption template; omit for Sketchbook's own",
          optional: true
        }
      },
      run( params ) {
        const key = h.publish.key();
        const template = params.template === undefined ? null : String( params.template );

        patchDraft(
          key,
          {
            caption: template,
            approved: false
          }
        );

        const conn = h.publish.connection();
        const plan = conn ? planPost( {
          conn,
          draft: getDraft( key ),
          when: getWhen( key ),
          variants: [],
          facts: h.publish.facts(),
          planned: []
        } ) : null;

        return {
          template: plan?.template ?? template,
          caption: plan?.text ?? null,
          approved: false
        };
      }
    },
    {
      id: "publish.approve",
      title: "Approve the caption",
      description: "Mark the caption as read and accepted. Call it ONLY when the person said, in this conversation, that the caption as it reads (publish.facts shows it) suits them — never on your own.",
      run: () => {
        const draft = patchDraft(
          h.publish.key(),
          {
            approved: true
          }
        );

        return {
          approved: draft.approved
        };
      }
    },
    {
      id: "publish.schedule",
      title: "Render and send the post",
      description: "Render the chosen variant and send it to Postiz as the post stands (publish.status shows it): scheduled, now, or as a draft. Refused until the caption is approved. Long videos take minutes — the tab must stay open and visible.",
      available: () => {
        const ok = connected();

        if ( ok !== true ) {
          return ok;
        }

        const exportable = h.exports.supported();

        if ( exportable !== true ) {
          return exportable;
        }

        return sending ? "a post is already being sent" : true;
      },
      async run() {
        const {
          plan, client, draft, conn
        } = await currentPlan( h );

        if ( !draft.approved ) {
          throw new CommandError(
            "unavailable",
            "the caption is not approved — show the person the caption it reads as (publish.facts) and publish.approve once they say it suits them"
          );
        }

        if ( plan.blocked || !plan.variant || !plan.choices ) {
          throw new CommandError(
            "unavailable",
            plan.blocked ?? "nothing can be posted"
          );
        }

        const target = plan.at ?? "draft";
        const variant = plan.variant;
        const produced: ExportArtifact[] = [];
        const controller = new AbortController();

        sending = true;

        try {
          const items = await h.exports.run(
            [
              variant
            ],
            (
              _, artifacts
            ) => {
              produced.push( ...artifacts );
            },
            () => undefined,
            controller.signal
          );
          const failed = items.find( ( item ) => item.status !== "done" );

          if ( failed || !produced.length ) {
            throw new CommandError(
              "failed",
              `the render did not finish${ failed?.error ? `: ${ failed.error }` : "" }`
            );
          }

          const files: File[] = [];

          for ( const artifact of produced ) {
            files.push( await h.publish.postable( new File(
              [
                artifact.blob
              ],
              artifact.fileName,
              {
                type: mimeOf(
                  artifact.fileName,
                  artifact.blob.type
                )
              }
            ) ) );
          }

          const publication = await sendPost( {
            client,
            channels: plan.targets,
            choices: plan.choices,
            caption: plan.text,
            files,
            at: target,
            variantName: variant.name
          } );

          addPublication(
            h.publish.key(),
            publication
          );
          setWhen(
            h.publish.key(),
            {
              kind: "next"
            }
          );

          return {
            sent: publication.target,
            at: publication.at ? slotLabel(
              new Date( publication.at ),
              conn.rhythm.timeZone
            ) : null,
            to: plan.targets.map( ( c ) => c.name ),
            kind: KIND_LABEL[ publication.kind ],
            files: files.map( ( f ) => `${ f.name } (${ ( f.size / 1024 / 1024 ).toFixed( 1 ) } MB)` ),
            postIds: publication.postIds
          };
        } finally {
          sending = false;
        }
      }
    },
    {
      id: "publish.calendar",
      title: "What is planned",
      description: "The posts planned on the person's Postiz over the coming weeks (from any app — Atelier's too), and the rhythm's slots, each past, taken or free.",
      available: connected,
      params: {
        weeks: {
          type: "number",
          description: "How many weeks from this one (default 3)",
          min: 1,
          max: 6,
          integer: true,
          optional: true
        }
      },
      async run( params ) {
        const {
          conn, client
        } = connection( h );
        const tz = conn.rhythm.timeZone;
        const posts = await readPlanned( client );
        const grid = rhythmGrid(
          conn.rhythm,
          plannedInstants( posts ),
          new Date(),
          ( params.weeks as number | undefined ) ?? 3
        );

        return {
          posts: posts.map( ( p ) => ( {
            id: p.id,
            at: slotLabel(
              new Date( p.publishDate ),
              tz
            ),
            state: p.state,
            account: p.channel?.name ?? null,
            caption: p.content.split( "\n" )[ 0 ].slice(
              0,
              120
            ),
            ...( p.error ? {
              error: p.error
            } : {} )
          } ) ),
          slots: grid.weeks.flatMap( ( week ) => week.cells.map( ( cell ) => ( {
            at: slotLabel(
              cell.at,
              tz
            ),
            state: cell.state
          } ) ) )
        };
      }
    },
    {
      id: "publish.unschedule",
      title: "Take a post back",
      description: "Delete a post from the person's Postiz before it goes out (publish.calendar or publish.status give its id). A post this sketch sent to several accounts is taken back from all of them. A published post is refused: it is on the network already.",
      available: connected,
      params: {
        postId: {
          type: "string",
          description: "The post's id"
        }
      },
      async run( params ) {
        const {
          client
        } = connection( h );
        const id = String( params.postId );
        const listed = await readPlanned( client );
        // One send made one post per account: take them all back together.
        const ids = getPublications( h.publish.key() ).find( ( p ) => p.postIds.includes( id ) )?.postIds ?? [
          id
        ];

        if ( ids.some( ( postId ) => listed.find( ( p ) => p.id === postId )?.state === "published" ) ) {
          throw new CommandError(
            "invalid",
            "that post is published already — remove it on the network itself"
          );
        }

        for ( const postId of ids ) {
          await client.deletePost( postId );
          dropPublication(
            h.publish.key(),
            postId
          );
        }

        return {
          deleted: ids
        };
      }
    }
  ];
}
