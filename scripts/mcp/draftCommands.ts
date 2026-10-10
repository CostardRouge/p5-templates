/**
 * `drafts.*` — build a whole piece (document + media) on the server, as the
 * studio's "Save draft" does. See `drafts.ts` for what a draft is.
 */
import {
  sketchId, type CatalogEntry
} from "./catalog.ts";
import type {
  Context
} from "./context.ts";
import {
  assetPath, checkDocumentKeys, composeDocument, listedAssets, mediaKind, mimeType, storedName, uploadKey, type ListedAsset
} from "./drafts.ts";
import {
  CommandError, isRecord, type CommandSpec, type ParamSpecs
} from "./registry.ts";
import {
  mergeOptions
} from "./sketchForm.ts";

const DOCUMENT_PARAMS: ParamSpecs = {
  options: {
    type: "object",
    description: "The sketch's parameters, a nested delta (sketches.describe), checked against its controls",
    optional: true
  },
  document: {
    type: "object",
    description: "The rest of the piece, merged over what is there: size {width,height}, animation {framerate,duration}, content (text, image, title, qrcode, HUD, sketch-layer items…), slides, interactive, name. A list given replaces the list. options.schema describes every field",
    optional: true
  },
  files: {
    type: "strings",
    description: "Local media files to upload (images, videos, audio). Each is referenced in the document as global/<images|videos|audios>/<file name>, the path this command answers",
    optional: true
  }
};

export function draftCommands( ctx: Context ): CommandSpec[] {
  const {
    deps
  } = ctx;

  function studioUrl(
    sketchPath: string, draft: string
  ): string {
    return `${ deps.baseUrl }/${ sketchPath.replace(
      /^\/+/,
      ""
    ) }?id=${ encodeURIComponent( draft ) }`;
  }

  /** The files the agent hands over, read and named as they will be stored. */
  async function readFiles( paths: unknown ): Promise<{ local: string;
    asset: ListedAsset;
    bytes: Uint8Array }[]> {
    const list = Array.isArray( paths ) ? paths as string[] : [];
    const out: { local: string;
      asset: ListedAsset;
      bytes: Uint8Array }[] = [];

    for ( const local of list ) {
      const file = await deps.readMedia( local );
      const name = storedName( file.name );
      const kind = mediaKind( name )!;
      const path = assetPath(
        kind,
        name
      );
      const twin = out.find( ( other ) => other.asset.path === path );

      if ( twin ) {
        throw new CommandError(
          "invalid",
          `${ twin.local } and ${ local } would both be stored as ${ path } — rename one`
        );
      }
      out.push( {
        local,
        asset: {
          scope: "global",
          kind,
          path
        },
        bytes: file.bytes
      } );
    }

    return out;
  }

  function attach(
    body: FormData, asset: ListedAsset, bytes: Uint8Array
  ): void {
    body.append(
      uploadKey( asset ),
      new File(
        [
          bytes as BlobPart
        ],
        asset.path,
        {
          type: mimeType( asset.path )
        }
      )
    );
  }

  async function post( body: FormData ): Promise<string> {
    const answer = await ctx.getJson(
      "/api/recordings/enqueue",
      {
        method: "POST",
        body
      }
    ) as Record<string, unknown>;

    if ( !answer.success || typeof answer.jobId !== "string" ) {
      throw new CommandError(
        "failed",
        `the server did not save it: ${ String( answer.error ?? "no job id" ) }`
      );
    }

    return answer.jobId;
  }

  /**
   * The agent's `document`, merged over `base` key by key, checked by the
   * app's schema and answered with its defaults filled in — for the keys the
   * agent gave only.
   */
  async function checkedDocument(
    params: Record<string, unknown>, base: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    const document = isRecord( params.document ) ? params.document : {};

    checkDocumentKeys( document );
    if ( !Object.keys( document ).length ) {
      return {};
    }

    const merged = mergeOptions(
      base,
      document
    );

    return ctx.validateDocument( Object.fromEntries( Object.keys( document ).map( ( key ) => [
      key,
      merged[ key ]
    ] ) ) );
  }

  async function draftJob( draft: unknown ): Promise<{ job: Record<string, unknown>;
    entry: CatalogEntry;
    stored: Record<string, unknown> }> {
    const job = await ctx.getJob( draft );
    const entry = await ctx.sketch( job.sketch );
    const stored = isRecord( job.options ) ? job.options : {};

    return {
      job,
      entry,
      stored
    };
  }

  return [
    {
      id: "drafts.create",
      title: "Create a draft",
      description: "Start a whole piece on the server — the sketch's parameters, the document (size, clock, text/image/HUD/sketch-layer content items, slides) and uploaded media — as the studio's Save draft does. Answers the draft id, the asset path of each uploaded file and the studio URL a person can open. Then: render.frame { draft } to look, drafts.update to change, render.video { draft } to record.",
      params: {
        sketch: {
          type: "string",
          description: "Sketch id from sketches.list"
        },
        ...DOCUMENT_PARAMS
      },
      available: ctx.queueUp,
      async run( params ) {
        const entry = await ctx.sketch( params.sketch );
        const {
          delta, form
        } = await ctx.checkedDelta(
          entry,
          params.options
        );
        const own = await deps.localOptions( entry ) ?? {};

        delete own.assets;

        const document = await checkedDocument(
          params,
          own
        );
        const files = await readFiles( params.files );

        const body = new FormData();

        body.set(
          "sketch",
          `sketches/${ sketchId( entry ) }`
        );
        body.set(
          "options",
          JSON.stringify( composeDocument(
            own,
            document,
            mergeOptions(
              form.formValues,
              delta
            )
          ) )
        );
        body.set(
          "status",
          "draft"
        );
        for ( const file of files ) {
          attach(
            body,
            file.asset,
            file.bytes
          );
        }

        const draft = await post( body );

        return {
          draft,
          sketch: sketchId( entry ),
          assets: Object.fromEntries( files.map( ( file ) => [
            file.local,
            file.asset.path
          ] ) ),
          studio: studioUrl(
            `sketches/${ sketchId( entry ) }`,
            draft
          ),
          next: "render.frame { draft } to look at it; drafts.update { draft, … } to change it; render.video { draft } to record it"
        };
      }
    },
    {
      id: "drafts.update",
      title: "Change a draft",
      description: "Change a draft in place: a parameter delta, document fields merged over the stored document (a list given replaces the list), new media files, and removeFiles (asset paths) to drop. Every file already in the draft is kept unless removed. Only a job in status draft can change — drafts.copy makes an editable draft from any job.",
      params: {
        draft: {
          type: "string",
          description: "Draft id"
        },
        ...DOCUMENT_PARAMS,
        removeFiles: {
          type: "strings",
          description: "Asset paths to drop from the draft (drafts.get lists them)",
          optional: true
        }
      },
      available: ctx.queueUp,
      async run( params ) {
        const {
          job, entry, stored
        } = await draftJob( params.draft );

        if ( job.status !== "draft" ) {
          throw new CommandError(
            "invalid",
            `${ String( params.draft ) } is ${ String( job.status ) }, not a draft — drafts.copy { draft } makes an editable copy`
          );
        }

        const current = isRecord( stored.sketch ) ? stored.sketch : ( await ctx.form( entry ) ).formValues;
        const {
          delta
        } = await ctx.checkedDelta(
          entry,
          params.options,
          current
        );
        const document = await checkedDocument(
          params,
          stored
        );
        const files = await readFiles( params.files );
        const existing = listedAssets( stored );
        const remove = new Set( Array.isArray( params.removeFiles ) ? params.removeFiles as string[] : [] );

        for ( const path of remove ) {
          if ( !existing.some( ( asset ) => asset.path === path ) ) {
            throw new CommandError(
              "invalid",
              `${ path } is not in this draft — it has ${ existing.map( ( asset ) => asset.path ).join( ", " ) || "no files" }`
            );
          }
        }

        const next = composeDocument(
          stored,
          document,
          mergeOptions(
            current,
            delta
          )
        );
        const slideCount = Array.isArray( next.slides ) ? next.slides.length : 0;
        const body = new FormData();
        const kept: string[] = [];
        const dropped: string[] = [];

        body.set(
          "jobId",
          String( params.draft )
        );
        body.set(
          "sketch",
          String( job.sketch )
        );
        body.set(
          "options",
          JSON.stringify( next )
        );
        body.set(
          "status",
          "draft"
        );

        // The route rebuilds the asset lists from the files it is sent, so
        // every file the draft keeps is sent again — as the studio does.
        for ( const asset of existing ) {
          const replaced = files.some( ( file ) => file.asset.path === asset.path && asset.scope === "global" );

          if ( remove.has( asset.path ) || replaced ) {
            continue;
          }
          if ( asset.scope !== "global" && asset.scope >= slideCount ) {
            dropped.push( asset.path );
            continue;
          }

          const response = await ctx.request( `/api/s3/${ ctx.jobPath( params.draft ) }/assets/${ asset.path.split( "/" ).map( encodeURIComponent )
            .join( "/" ) }` );

          if ( !response.ok ) {
            throw new CommandError(
              "failed",
              `could not read back ${ asset.path } from the draft (${ response.status })`
            );
          }
          attach(
            body,
            asset,
            new Uint8Array( await response.arrayBuffer() )
          );
          kept.push( asset.path );
        }
        for ( const file of files ) {
          attach(
            body,
            file.asset,
            file.bytes
          );
        }

        await post( body );

        return {
          draft: params.draft,
          assets: [
            ...kept,
            ...files.map( ( file ) => file.asset.path )
          ],
          added: Object.fromEntries( files.map( ( file ) => [
            file.local,
            file.asset.path
          ] ) ),
          removed: [
            ...remove
          ],
          ...( dropped.length ? {
            droppedWithTheirSlides: dropped
          } : {} ),
          studio: studioUrl(
            String( job.sketch ),
            String( params.draft )
          )
        };
      }
    },
    {
      id: "drafts.get",
      title: "Read a draft",
      description: "A draft's (or any job's) stored document — sketch parameters, size, clock, content, slides —, its status, its files and the studio URL.",
      params: {
        draft: {
          type: "string",
          description: "Draft or job id"
        }
      },
      available: ctx.queueUp,
      async run( params ) {
        const {
          job, entry, stored
        } = await draftJob( params.draft );

        return {
          draft: job.id,
          status: job.status,
          sketch: sketchId( entry ),
          assets: listedAssets( stored ).map( ( asset ) => asset.path ),
          studio: studioUrl(
            String( job.sketch ),
            String( job.id )
          ),
          document: stored
        };
      }
    },
    {
      id: "drafts.copy",
      title: "Copy a draft",
      description: "A new editable draft from any job or draft, files included (the server's Clone). The original is left untouched.",
      params: {
        draft: {
          type: "string",
          description: "Draft or job id to copy"
        }
      },
      available: ctx.queueUp,
      async run( params ) {
        const answer = await ctx.getJson(
          `/api/recordings/${ ctx.jobPath( params.draft ) }/clone`,
          {
            method: "POST"
          }
        ) as Record<string, unknown>;

        if ( typeof answer.jobId !== "string" ) {
          throw new CommandError(
            "failed",
            `the server did not copy it: ${ String( answer.error ?? "no job id" ) }`
          );
        }

        return {
          draft: answer.jobId,
          from: params.draft
        };
      }
    }
  ];
}
