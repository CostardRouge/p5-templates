import type {
  Metadata
} from "next";
import {
  notFound
} from "next/navigation";
import sharp from "sharp";
import {
  getBaseUrl
} from "@/lib/seo";
import {
  parseMeta, type ParsedMeta
} from "./parseMeta";
import OpenGraphDiagnostics, {
  type FetchReport,
  type ImageProbe
} from "./OpenGraphDiagnostics";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "OpenGraph diagnostics"
};

/** Coerce the optional ?url=... search param into a path or absolute URL. */
function normalizeInput( raw: string | undefined ): string {
  const v = ( raw ?? "/" ).trim();

  if ( !v ) {
    return "/";
  }

  return v;
}

/** Build the absolute URL we'll fetch from a user-provided path/URL. */
function resolveTarget(
  input: string, baseUrl: string
): string {
  if ( /^https?:\/\//i.test( input ) ) {
    return input;
  }

  return `${ baseUrl.replace(
    /\/$/,
    ""
  ) }${ input.startsWith( "/" ) ? input : `/${ input }` }`;
}

/** Verify the image actually exists and grab its real dimensions. */
async function probeImage(
  src: string,
  baseUrl: string,
  context: { ogWidth?: string;
    ogHeight?: string }
): Promise<ImageProbe> {
  const absolute = /^https?:\/\//i.test( src )
    ? src
    : resolveTarget(
      src,
      baseUrl
    );
  const probe: ImageProbe = {
    src,
    absolute,
    exists: false,
    status: null,
    contentType: null,
    format: null,
    width: null,
    height: null,
    sizeKB: null,
    declaredWidth: context.ogWidth ?? null,
    declaredHeight: context.ogHeight ?? null,
    issues: []
  };

  try {
    const res = await fetch(
      absolute,
      {
        cache: "no-store",
        redirect: "follow"
      }
    );

    probe.status = res.status;

    if ( !res.ok ) {
      probe.issues.push( {
        level: "error",
        msg: `Image request returned HTTP ${ res.status } — crawlers will see a broken image.`
      } );
      return probe;
    }

    probe.exists = true;
    probe.contentType = res.headers.get( "content-type" );

    const buf = Buffer.from( await res.arrayBuffer() );

    probe.sizeKB = Math.round( ( buf.byteLength / 1024 ) * 10 ) / 10;

    try {
      const meta = await sharp( buf ).metadata();

      probe.format = meta.format ?? null;
      probe.width = meta.width ?? null;
      probe.height = meta.height ?? null;
    } catch {
      probe.issues.push( {
        level: "warn",
        msg: "Could not parse the image with sharp — unexpected format?"
      } );
    }

    // Sanity checks
    if ( probe.width != null && probe.height != null ) {
      if ( probe.width < 600 || probe.height < 315 ) {
        probe.issues.push( {
          level: "warn",
          msg: `Image is small (${ probe.width }×${ probe.height }) — Facebook recommends at least 1200×630 for summary_large_image cards.`
        } );
      }

      const declaredW = context.ogWidth ? Number( context.ogWidth ) : null;
      const declaredH = context.ogHeight ? Number( context.ogHeight ) : null;

      if (
        declaredW &&
        declaredH &&
        ( declaredW !== probe.width || declaredH !== probe.height )
      ) {
        probe.issues.push( {
          level: "warn",
          msg: `Declared ${ declaredW }×${ declaredH } but real image is ${ probe.width }×${ probe.height }.`
        } );
      }
    }

    if ( probe.sizeKB != null && probe.sizeKB > 8000 ) {
      probe.issues.push( {
        level: "warn",
        msg: `Image is heavy (${ probe.sizeKB } KB) — many crawlers cap at ~8 MB.`
      } );
    }
  } catch( e ) {
    probe.issues.push( {
      level: "error",
      msg: `Image fetch failed: ${ ( e as Error ).message }`
    } );
  }

  return probe;
}

/** Collect every image referenced in og:image and twitter:image tags. */
function collectImageSources( meta: ParsedMeta ): Array<{
  src: string;
  origin: "og" | "twitter";
  width?: string;
  height?: string;
}> {
  const sources: Array<{ src: string;
    origin: "og" | "twitter";
    width?: string;
    height?: string }> = [];

  for ( const img of meta.openGraph.images ) {
    sources.push( {
      src: img.url,
      origin: "og",
      width: img.width,
      height: img.height
    } );
  }

  for ( const t of meta.twitter.images ) {
    // Avoid duplicates if the same URL was already collected via og:image
    if ( !sources.some( ( s ) => s.src === t ) ) {
      sources.push( {
        src: t,
        origin: "twitter"
      } );
    }
  }

  return sources;
}

export default async function OpenGraphDebugPage( {
  searchParams
}: {
  searchParams: Promise<{ url?: string }>;
} ) {
  if ( process.env.NODE_ENV === "production" ) {
    notFound();
  }

  const params = await searchParams;
  const input = normalizeInput( params.url );
  const baseUrl = getBaseUrl();
  const targetUrl = resolveTarget(
    input,
    baseUrl
  );

  const report: FetchReport = {
    input,
    targetUrl,
    baseUrl,
    status: null,
    finalUrl: null,
    contentType: null,
    error: null,
    htmlBytes: null,
    meta: null,
    imageProbes: []
  };

  try {
    const res = await fetch(
      targetUrl,
      {
        cache: "no-store",
        redirect: "follow",
        headers: {
          // Some apps detect crawlers; pretend to be a friendly link-preview bot
          "user-agent": "OG-Debug/1.0 (+https://localhost)"
        }
      }
    );

    report.status = res.status;
    report.finalUrl = res.url;
    report.contentType = res.headers.get( "content-type" );

    if ( !res.ok ) {
      report.error = `Page request returned HTTP ${ res.status }.`;
    } else {
      const html = await res.text();

      report.htmlBytes = html.length;
      report.meta = parseMeta( html );

      const sources = collectImageSources( report.meta );

      report.imageProbes = await Promise.all( sources.map( ( s ) =>
        probeImage(
          s.src,
          baseUrl,
          {
            ogWidth: s.width,
            ogHeight: s.height
          }
        ) ) );
    }
  } catch( e ) {
    report.error = `Page fetch failed: ${ ( e as Error ).message }`;
  }

  return (
    <OpenGraphDiagnostics
      report={ report }
      initialInput={ input }
    />
  );
}
