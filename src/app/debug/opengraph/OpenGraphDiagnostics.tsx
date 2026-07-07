"use client";

import {
  useRouter, useSearchParams
} from "next/navigation";
import {
  useEffect, useState, type ReactNode
} from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  RefreshCw,
  XCircle
} from "lucide-react";
import type {
  ParsedMeta
} from "./parseMeta";

export type ImageProbeIssue = {
  level: "error" | "warn";
  msg: string;
};

export type ImageProbe = {
  src: string;
  absolute: string;
  exists: boolean;
  status: number | null;
  contentType: string | null;
  format: string | null;
  width: number | null;
  height: number | null;
  sizeKB: number | null;
  declaredWidth: string | null;
  declaredHeight: string | null;
  issues: ImageProbeIssue[];
};

export type FetchReport = {
  input: string;
  targetUrl: string;
  baseUrl: string;
  status: number | null;
  finalUrl: string | null;
  contentType: string | null;
  error: string | null;
  htmlBytes: number | null;
  meta: ParsedMeta | null;
  imageProbes: ImageProbe[];
};

type Props = {
  report: FetchReport;
  initialInput: string;
};

const INTRO =
  "Local diagnostic page (dev only). Enter a path on this site (or a full URL) and we'll fetch it, parse the meta tags Next.js emitted, and show how the link will look in chat apps and social previews.";

const QUICK_LINKS = [
  {
    label: "Home",
    path: "/"
  },
  {
    label: "Sketches index",
    path: "/sketches"
  },
  {
    label: "Recordings",
    path: "/recordings"
  },
  {
    label: "Icons debug",
    path: "/debug/icons"
  }
];

const SUGGESTED_CARDS: Array<{ label: string;
  width: number;
  height: number;
  note: string }> = [
  {
    label: "Facebook / LinkedIn",
    width: 524,
    height: 274,
    note: "summary_large_image, 1.91:1 crop"
  },
  {
    label: "X (Twitter)",
    width: 506,
    height: 254,
    note: "summary_large_image"
  },
  {
    label: "Discord / iMessage",
    width: 380,
    height: 200,
    note: "compact rich preview"
  }
];

function StatusPill( {
  status
}: { status: "ok" | "warn" | "error" } ) {
  if ( status === "error" ) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-2 py-0.5 text-xs font-medium text-foreground">
        <XCircle className="h-3.5 w-3.5 text-red-500" />
        Problem
      </span>
    );
  }

  if ( status === "warn" ) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-foreground">
        <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
        Review
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-foreground">
      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
      Pass
    </span>
  );
}

function Badge( {
  children
}: { children: ReactNode } ) {
  return (
    <span className="rounded border border-border bg-foreground/5 px-1.5 py-0.5 text-[11px] text-label">
      { children }
    </span>
  );
}

function FieldRow( {
  label,
  value,
  mono = true
}: {
  label: string;
  value: ReactNode;
  mono?: boolean;
} ) {
  const missing = value == null || value === "" || value === "—";

  return (
    <div className="grid grid-cols-[160px_1fr] items-start gap-3 border-b border-border/60 py-1.5 last:border-b-0">
      <dt className="text-[12px] uppercase tracking-[0.16em] text-label">
        { label }
      </dt>
      <dd
        className={ `${
          mono ? "font-mono" : ""
        } text-[13px] ${ missing ? "text-label/60 italic" : "text-foreground" } break-all` }
      >
        { missing ? "— not set —" : value }
      </dd>
    </div>
  );
}

function Section( {
  title,
  children,
  intro
}: {
  title: string;
  children: ReactNode;
  intro?: string;
} ) {
  return (
    <section className="rounded-xl border border-border bg-background p-5">
      <div className="mb-3">
        <h2 className="text-base font-medium">{ title }</h2>
        { intro
          ? (
            <p className="mt-1 text-[12px] text-label">{ intro }</p>
          )
          : null }
      </div>
      { children }
    </section>
  );
}

function ImageCard( {
  probe,
  index
}: { probe: ImageProbe;
  index: number } ) {
  const status: "ok" | "warn" | "error" = !probe.exists ||
  probe.issues.some( ( i ) => i.level === "error" )
    ? "error"
    : probe.issues.length > 0
      ? "warn"
      : "ok";

  const ring =
    status === "error"
      ? "ring-red-400/60"
      : status === "warn"
        ? "ring-amber-400/60"
        : "ring-emerald-400/50";

  return (
    <div
      className={ `rounded-xl border border-border bg-background p-4 ring-1 ${ ring }` }
    >
      <div className="flex gap-4">
        <div className="shrink-0">
          <div
            className="relative overflow-hidden rounded-lg border border-border bg-hover/40"
            style={ {
              width: 200,
              height: 200
            } }
          >
            { probe.exists
              ? (

                <img
                  src={ probe.absolute }
                  alt=""
                  className="absolute inset-0 h-full w-full object-contain"
                />
              )
              : (
                <div className="absolute inset-0 grid place-items-center p-3 text-center text-[12px] text-label">
                  Image could not be loaded
                </div>
              ) }
          </div>
          <div className="mt-1 text-center text-[11px] text-label">image { index + 1 }</div>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 break-all font-mono text-[13px] text-foreground">
              { probe.src }
            </div>
            <StatusPill status={ status } />
          </div>

          <div className="flex flex-wrap gap-1.5 pt-2">
            <Badge>{ `status: ${ probe.status ?? "—" }` }</Badge>
            { probe.contentType
              ? (
                <Badge>{ probe.contentType }</Badge>
              )
              : null }
            { probe.declaredWidth && probe.declaredHeight
              ? (
                <Badge>{ `declared ${ probe.declaredWidth }×${ probe.declaredHeight }` }</Badge>
              )
              : null }
          </div>

          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 pt-3 text-[13px]">
            <dt className="text-label">Real</dt>
            <dd className="font-mono text-foreground">
              { probe.width != null && probe.height != null
                ? `${ probe.width }×${ probe.height }`
                : "—" }
            </dd>
            <dt className="text-label">Format</dt>
            <dd className="font-mono text-foreground">{ probe.format ?? "—" }</dd>
            <dt className="text-label">Size</dt>
            <dd className="font-mono text-foreground">
              { probe.sizeKB != null ? `${ probe.sizeKB } KB` : "—" }
            </dd>
          </dl>
        </div>
      </div>

      { probe.issues.length > 0
        ? (
          <ul className="mt-3 space-y-1.5 border-t border-border pt-3">
            { probe.issues.map( (
              issue, idx
            ) => (
              <li
                key={ idx }
                className="flex items-start gap-2 text-[13px]"
              >
                { issue.level === "error"
                  ? <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                  : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" /> }
                <span className="text-foreground">{ issue.msg }</span>
              </li>
            ) ) }
          </ul>
        )
        : null }
    </div>
  );
}

function originHost( url: string | null ): string {
  if ( !url ) {
    return "—";
  }
  try {
    return new URL( url ).host.toLowerCase().replace(
      /^www\./,
      ""
    );
  } catch {
    return url;
  }
}

function SocialCardPreview( {
  title,
  description,
  imageUrl,
  url,
  variant
}: {
  title: string | null;
  description: string | null;
  imageUrl: string | null;
  url: string | null;
  variant: { label: string;
    width: number;
    height: number;
    note: string };
} ) {
  return (
    <div className="flex w-full flex-col gap-2">
      <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.18em] text-label">
        <span>{ variant.label }</span>
        <span className="font-mono normal-case tracking-normal">{ variant.note }</span>
      </div>
      <div className="overflow-hidden rounded-md border border-border bg-background">
        <div
          className="w-full bg-hover/40"
          style={ {
            aspectRatio: `${ variant.width } / ${ variant.height }`
          } }
        >
          { imageUrl
            ? (

              <img
                src={ imageUrl }
                alt=""
                className="h-full w-full object-cover"
              />
            )
            : (
              <div className="grid h-full w-full place-items-center text-xs text-label">
                no image
              </div>
            ) }
        </div>
        <div className="border-t border-border px-3 py-2.5">
          <div className="text-[11px] uppercase tracking-[0.16em] text-label">
            { originHost( url ) }
          </div>
          <div className="mt-0.5 truncate text-sm font-medium text-foreground">
            { title ?? "— no title —" }
          </div>
          <div className="mt-0.5 line-clamp-2 text-xs text-label">
            { description ?? "— no description —" }
          </div>
        </div>
      </div>
    </div>
  );
}

export default function OpenGraphDiagnostics( {
  report,
  initialInput
}: Props ) {
  const router = useRouter();
  const params = useSearchParams();
  const [
    input,
    setInput
  ] = useState( initialInput );
  const [
    pending,
    setPending
  ] = useState( false );

  useEffect(
    () => {
      setInput( initialInput );
      setPending( false );
    },
    [
      initialInput
    ]
  );

  const onSubmit = ( e: React.FormEvent ) => {
    e.preventDefault();
    const next = input.trim() || "/";
    const search = new URLSearchParams( params.toString() );

    search.set(
      "url",
      next
    );
    setPending( true );
    router.push( `?${ search.toString() }` );
    router.refresh();
  };

  const meta = report.meta;
  const og = meta?.openGraph;
  const tw = meta?.twitter;
  const previewImage =
    report.imageProbes.find( ( p ) => p.exists )?.absolute ??
    og?.images[ 0 ]?.url ??
    tw?.images[ 0 ] ??
    null;

  const previewTitle = og?.title ?? tw?.title ?? meta?.title ?? null;
  const previewDescription =
    og?.description ?? tw?.description ?? meta?.general.description ?? null;
  const previewUrl = og?.url ?? report.finalUrl ?? report.targetUrl;

  // Top-level status banner
  const errorCount = report.imageProbes.filter( ( p ) => p.issues.some( ( i ) => i.level === "error" ) ).length +
    ( report.error ? 1 : 0 ) +
    ( meta && !meta.openGraph.title ? 1 : 0 ) +
    ( meta && !meta.openGraph.description ? 1 : 0 ) +
    ( meta && meta.openGraph.images.length === 0 ? 1 : 0 );

  const warnCount = report.imageProbes.reduce(
    (
      acc, p
    ) => acc + p.issues.filter( ( i ) => i.level === "warn" ).length,
    0
  );

  return (
    <div className="mx-auto max-w-5xl px-5 py-8 text-foreground">
      <h1 className="text-2xl font-semibold tracking-tight">OpenGraph diagnostics</h1>
      <p className="mt-2 max-w-3xl text-sm text-label">{ INTRO }</p>

      {/* URL form */}
      <form onSubmit={ onSubmit } className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="flex flex-1 items-center overflow-hidden rounded-lg border border-border bg-background">
          <span className="border-r border-border px-3 py-2 font-mono text-[12px] text-label">
            { originHost( report.baseUrl ) }
          </span>
          <input
            value={ input }
            onChange={ ( e ) => setInput( e.target.value ) }
            placeholder="/ or /sketches/p5/photo-balloons or a full URL"
            className="flex-1 bg-transparent px-3 py-2 font-mono text-sm outline-none placeholder:text-label/60"
            spellCheck={ false }
            autoCapitalize="off"
            autoCorrect="off"
          />
        </div>
        <button
          type="submit"
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
          disabled={ pending }
        >
          <RefreshCw className={ `h-4 w-4 ${ pending ? "animate-spin" : "" }` } />
          Inspect
        </button>
      </form>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-[12px] text-label">
        <span>Quick links:</span>
        { QUICK_LINKS.map( ( q ) => (
          <button
            key={ q.path }
            type="button"
            onClick={ () => {
              setInput( q.path );
              const search = new URLSearchParams( params.toString() );

              search.set(
                "url",
                q.path
              );
              setPending( true );
              router.push( `?${ search.toString() }` );
              router.refresh();
            } }
            className="rounded-full border border-border bg-hover/40 px-2.5 py-1 text-foreground hover:border-foreground/40"
          >
            { q.label }
          </button>
        ) ) }
      </div>

      {/* Top status row */}
      <div className="mt-5 flex flex-wrap items-center gap-3 text-sm">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-foreground/10 px-2.5 py-1 font-medium">
          <span>HTTP { report.status ?? "—" }</span>
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-2.5 py-1 font-medium text-foreground">
          <span className="h-2 w-2 rounded-full bg-amber-500" />
          { warnCount } to review
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/15 px-2.5 py-1 font-medium text-foreground">
          <span className="h-2 w-2 rounded-full bg-red-500" />
          { errorCount } problems
        </span>
        <a
          href={ report.targetUrl }
          target="_blank"
          rel="noreferrer"
          className="ml-auto inline-flex items-center gap-1 text-label hover:text-foreground"
        >
          open URL <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>

      { report.error
        ? (
          <div className="mt-4 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-foreground">
            <span className="font-medium">Fetch failed.</span> { report.error }
          </div>
        )
        : null }

      {/* Live previews */}
      <h2 className="mt-8 text-lg font-medium">Social previews</h2>
      <p className="mt-1 text-[12px] text-label">
        Mock-ups of how the link will be rendered by the most common chat apps.
        Built from the OG title, description and the first reachable og:image.
      </p>
      <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-3">
        { SUGGESTED_CARDS.map( ( variant ) => (
          <SocialCardPreview
            key={ variant.label }
            variant={ variant }
            title={ previewTitle }
            description={ previewDescription }
            imageUrl={ previewImage }
            url={ previewUrl }
          />
        ) ) }
      </div>

      {/* General */}
      <div className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Section title="General">
          <dl>
            <FieldRow
              label="<title>"
              value={ meta?.title ?? "—" }
            />
            <FieldRow
              label="meta description"
              value={ meta?.general.description ?? "—" }
            />
            <FieldRow
              label="canonical"
              value={ meta?.general.canonical ?? "—" }
            />
            <FieldRow
              label="keywords"
              value={ meta?.general.keywords ?? "—" }
            />
            <FieldRow
              label="author"
              value={ meta?.general.author ?? "—" }
            />
            <FieldRow
              label="robots"
              value={ meta?.general.robots ?? "—" }
            />
            <FieldRow
              label="theme-color"
              value={ meta?.general.themeColor ?? "—" }
            />
            <FieldRow
              label="viewport"
              value={ meta?.general.viewport ?? "—" }
            />
          </dl>
        </Section>

        <Section title="OpenGraph">
          <dl>
            <FieldRow label="og:title" value={ og?.title ?? "—" } />
            <FieldRow label="og:description" value={ og?.description ?? "—" } />
            <FieldRow label="og:type" value={ og?.type ?? "—" } />
            <FieldRow label="og:url" value={ og?.url ?? "—" } />
            <FieldRow label="og:site_name" value={ og?.siteName ?? "—" } />
            <FieldRow label="og:locale" value={ og?.locale ?? "—" } />
            <FieldRow
              label="og:image count"
              value={ og ? `${ og.images.length }` : "—" }
            />
          </dl>
        </Section>

        <Section title="Twitter">
          <dl>
            <FieldRow label="twitter:card" value={ tw?.card ?? "—" } />
            <FieldRow label="twitter:title" value={ tw?.title ?? "—" } />
            <FieldRow label="twitter:description" value={ tw?.description ?? "—" } />
            <FieldRow label="twitter:site" value={ tw?.site ?? "—" } />
            <FieldRow label="twitter:creator" value={ tw?.creator ?? "—" } />
            <FieldRow
              label="twitter:image count"
              value={ tw ? `${ tw.images.length }` : "—" }
            />
          </dl>
        </Section>

        <Section title="Page">
          <dl>
            <FieldRow label="input" value={ report.input } />
            <FieldRow label="resolved" value={ report.targetUrl } />
            <FieldRow label="final URL" value={ report.finalUrl ?? "—" } />
            <FieldRow label="status" value={ report.status ?? "—" } />
            <FieldRow label="content-type" value={ report.contentType ?? "—" } />
            <FieldRow
              label="HTML size"
              value={ report.htmlBytes != null
                ? `${ Math.round( ( report.htmlBytes / 1024 ) * 10 ) / 10 } KB`
                : "—" }
            />
          </dl>
        </Section>
      </div>

      {/* Image probes */}
      <h2 className="mt-8 text-lg font-medium">Image probes</h2>
      <p className="mt-1 text-[12px] text-label">
        Every <code>og:image</code> and <code>twitter:image</code> is re-fetched from this server with sharp to verify it actually exists and has sensible dimensions.
      </p>
      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
        { report.imageProbes.length === 0
          ? (
            <div className="rounded-xl border border-border bg-background p-5 text-sm text-label">
              No og:image or twitter:image tags found on this page.
            </div>
          )
          : (
            report.imageProbes.map( (
              p, i
            ) => (
              <ImageCard key={ `${ p.src }-${ i }` } probe={ p } index={ i } />
            ) )
          ) }
      </div>

      {/* JSON-LD */}
      { meta && meta.jsonLd.length > 0
        ? (
          <>
            <h2 className="mt-8 text-lg font-medium">JSON-LD</h2>
            <p className="mt-1 text-[12px] text-label">
              Structured data emitted via <code>application/ld+json</code>. Google reads these for rich results.
            </p>
            <div className="mt-3 space-y-3">
              { meta.jsonLd.map( (
                block, i
              ) => (
                <pre
                  key={ i }
                  className="overflow-x-auto rounded-lg border border-border bg-hover/40 p-3 text-[12px] leading-relaxed text-foreground"
                >
                  { JSON.stringify(
                    block,
                    null,
                    2
                  ) }
                </pre>
              ) ) }
            </div>
          </>
        )
        : null }

      {/* Raw meta */}
      <h2 className="mt-8 text-lg font-medium">All meta tags</h2>
      <p className="mt-1 text-[12px] text-label">
        Every <code>&lt;meta&gt;</code> tag the parser found, in the order it appeared in the HTML.
      </p>
      <div className="mt-3 overflow-x-auto rounded-xl border border-border bg-background">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="border-b border-border bg-hover/40 text-left text-label">
              <th className="px-3 py-2 font-medium">attr</th>
              <th className="px-3 py-2 font-medium">key</th>
              <th className="px-3 py-2 font-medium">content</th>
            </tr>
          </thead>
          <tbody>
            { meta?.rawMeta.map( (
              row, i
            ) => (
              <tr key={ i } className="border-b border-border/60 last:border-b-0">
                <td className="px-3 py-1.5 font-mono text-label">{ row.source }</td>
                <td className="px-3 py-1.5 font-mono">{ row.key }</td>
                <td className="px-3 py-1.5 break-all">{ row.value }</td>
              </tr>
            ) ) }
            { !meta || meta.rawMeta.length === 0
              ? (
                <tr>
                  <td colSpan={ 3 } className="px-3 py-3 text-label">
                    no meta tags parsed
                  </td>
                </tr>
              )
              : null }
          </tbody>
        </table>
      </div>
    </div>
  );
}
