"use client";

import {
  useState, type ReactNode
} from "react";
import {
  AlertTriangle,
  CheckCircle2,
  XCircle
} from "lucide-react";

export type IconIssue = {
  level: "error" | "warn";
  msg: string;
};

export type IconCheck = {
  src: string;
  declaredSizes: string;
  type?: string;
  purpose: string;
  source: "manifest" | "document";
  exists: boolean;
  fileSizeKB: number | null;
  format: string | null;
  width: number | null;
  height: number | null;
  hasAlpha: boolean | null;
  icoSizes?: string[];
  issues: IconIssue[];
};

type ManifestMeta = {
  name: string;
  shortName: string;
  themeColor: string;
  backgroundColor: string;
  display: string;
};

type Props = {
  manifestChecks: IconCheck[];
  documentChecks: IconCheck[];
  manifestMeta: ManifestMeta;
};

const INTRO =
  "Local diagnostic page (dev only). Dimensions and transparency are measured server-side with sharp, so what you see here reflects the real files, not just the browser's rendering.";

const NATIVE_TOOLS = [
  "DevTools → Application tab → Manifest: parsed icons, installability warnings, maskable mask preview.",
  "Lighthouse (DevTools, or npx lighthouse http://localhost:3000): PWA and best-practices audit.",
  "maskable.app: drop the maskable PNG to see it under every Android mask shape."
];

const LEGEND = [
  "The checkerboard behind each preview reveals transparency: a maskable icon should sit on a solid background.",
  "The green circle marks the maskable safe zone (80% of the canvas): keep important content inside it.",
  "\"Simulate mask\" crops the preview to a circle to mimic what Android does on the home screen."
];

// Constant light backdrop for icon previews — kept theme-independent on
// purpose, so transparent dark-coloured icons stay visible in both themes
// (an icon inspector needs a stable reference background, like image editors).
const CHECKER = {
  backgroundColor: "#ffffff",
  backgroundImage:
    "linear-gradient(45deg, rgba(0,0,0,0.10) 25%, transparent 25%), linear-gradient(-45deg, rgba(0,0,0,0.10) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, rgba(0,0,0,0.10) 75%), linear-gradient(-45deg, transparent 75%, rgba(0,0,0,0.10) 75%)",
  backgroundSize: "16px 16px",
  backgroundPosition: "0 0, 0 8px, 8px -8px, -8px 0"
};

function statusOf( c: IconCheck ): "ok" | "warn" | "error" {
  if ( !c.exists || c.issues.some( ( i ) => i.level === "error" ) ) {
    return "error";
  }

  if ( c.issues.length > 0 ) {
    return "warn";
  }

  return "ok";
}

function realDimensions( c: IconCheck ): string {
  if ( c.icoSizes && c.icoSizes.length > 0 ) {
    return `ICO: ${ c.icoSizes.join( ", " ) }`;
  }

  if ( c.width && c.height ) {
    return `${ c.width }×${ c.height }`;
  }

  return "—";
}

function backgroundText( c: IconCheck ): string {
  if ( c.hasAlpha === true ) {
    return "transparent (alpha)";
  }

  if ( c.hasAlpha === false ) {
    return "opaque";
  }

  return "—";
}

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

function Row( {
  k, v
}: { k: string;
  v: string } ) {
  return (
    <>
      <dt className="text-label">{ k }</dt>
      <dd className="font-mono text-foreground">{ v }</dd>
    </>
  );
}

function IconCard( {
  check,
  masked,
  showSafe
}: {
  check: IconCheck;
  masked: boolean;
  showSafe: boolean;
} ) {
  const status = statusOf( check );
  const isMaskable = check.purpose.includes( "maskable" );
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
            className="relative overflow-hidden rounded-lg border border-border"
            style={ {
              width: 152,
              height: 152,
              ...CHECKER
            } }
          >
            <div
              className="absolute inset-0 flex items-center justify-center"
              style={ masked && isMaskable ? {
                clipPath: "circle(50%)"
              } : undefined }
            >
              <img
                src={ check.src }
                alt={ check.src }
                style={ {
                  maxWidth: "100%",
                  maxHeight: "100%"
                } }
              />
            </div>
            { isMaskable && showSafe && !masked
              ? (
                <svg
                  viewBox="0 0 100 100"
                  className="pointer-events-none absolute inset-0 h-full w-full text-emerald-500"
                >
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="0.9"
                    strokeDasharray="3 2"
                  />
                </svg>
              )
              : null }
          </div>
          <div className="mt-1 text-center text-[11px] text-label">
            { masked && isMaskable ? "mask circle" : `preview ${ check.declaredSizes }` }
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 break-all font-mono text-[13px] text-foreground">
              { check.src }
            </div>
            <div className="shrink-0">
              <StatusPill status={ status } />
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5 pt-2">
            <Badge>{ check.source }</Badge>
            <Badge>{ `usage: ${ check.purpose }` }</Badge>
            <Badge>{ `declared: ${ check.declaredSizes }` }</Badge>
            { check.type ? <Badge>{ check.type }</Badge> : null }
          </div>

          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 pt-3 text-[13px]">
            <Row k="Real" v={ realDimensions( check ) } />
            <Row k="Format" v={ check.format ?? "—" } />
            <Row k="Background" v={ backgroundText( check ) } />
            <Row
              k="Size"
              v={ check.fileSizeKB != null ? `${ check.fileSizeKB } KB` : "—" }
            />
          </dl>
        </div>
      </div>

      { check.issues.length > 0
        ? (
          <ul className="mt-3 space-y-1.5 border-t border-border pt-3">
            { check.issues.map( (
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

function ColorChip( {
  label, value
}: { label: string;
  value: string } ) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="text-label">{ label }</span>
      <span
        className="h-3.5 w-3.5 rounded border border-border"
        style={ {
          backgroundColor: value || "transparent"
        } }
      />
      <code className="text-[12px]">{ value || "—" }</code>
    </span>
  );
}

export default function IconDiagnostics( {
  manifestChecks,
  documentChecks,
  manifestMeta
}: Props ) {
  const [
    masked,
    setMasked
  ] = useState( false );
  const [
    showSafe,
    setShowSafe
  ] = useState( true );

  const all = [
    ...manifestChecks,
    ...documentChecks
  ];
  const errors = all.filter( ( c ) => statusOf( c ) === "error" ).length;
  const warns = all.filter( ( c ) => statusOf( c ) === "warn" ).length;
  const oks = all.filter( ( c ) => statusOf( c ) === "ok" ).length;

  return (
    <div className="mx-auto max-w-5xl px-5 py-8 text-foreground">
      <h1 className="text-2xl font-semibold tracking-tight">Icon diagnostics</h1>
      <p className="mt-2 max-w-3xl text-sm text-label">{ INTRO }</p>

      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-lg border border-border bg-hover/40 px-4 py-3 text-sm">
        <span>
          <span className="text-label">Name: </span>
          { manifestMeta.name }
        </span>
        <span>
          <span className="text-label">Short: </span>
          { manifestMeta.shortName }
        </span>
        <span>
          <span className="text-label">Display: </span>
          { manifestMeta.display }
        </span>
        <ColorChip label="Theme:" value={ manifestMeta.themeColor } />
        <ColorChip label="Background:" value={ manifestMeta.backgroundColor } />
      </div>

      <div className="mt-4 rounded-lg border border-border bg-hover/40 px-4 py-3 text-sm">
        <div className="font-medium">Recommended native tools</div>
        <ul className="mt-1.5 space-y-1 text-label">
          { NATIVE_TOOLS.map( ( t ) => (
            <li
              key={ t }
              className="flex gap-2"
            >
              <span className="text-label/60">•</span>
              <span>{ t }</span>
            </li>
          ) ) }
        </ul>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 text-sm">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-1 font-medium text-foreground">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            { oks } passing
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-2.5 py-1 font-medium text-foreground">
            <span className="h-2 w-2 rounded-full bg-amber-500" />
            { warns } to review
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/15 px-2.5 py-1 font-medium text-foreground">
            <span className="h-2 w-2 rounded-full bg-red-500" />
            { errors } problems
          </span>
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-4 text-sm">
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              className="h-4 w-4 accent-emerald-600"
              checked={ showSafe }
              onChange={ ( e ) => setShowSafe( e.target.checked ) }
            />
            Safe zone (80%)
          </label>
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              className="h-4 w-4 accent-emerald-600"
              checked={ masked }
              onChange={ ( e ) => setMasked( e.target.checked ) }
            />
            Simulate Android mask (circle)
          </label>
        </div>
      </div>

      <h2 className="mt-7 text-lg font-medium">Manifest icons</h2>
      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
        { manifestChecks.map( ( c ) => (
          <IconCard
            key={ `${ c.src }-${ c.purpose }` }
            check={ c }
            masked={ masked }
            showSafe={ showSafe }
          />
        ) ) }
      </div>

      <h2 className="mt-7 text-lg font-medium">Document icons (favicon, apple-touch)</h2>
      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
        { documentChecks.map( ( c ) => (
          <IconCard
            key={ `${ c.src }-${ c.purpose }` }
            check={ c }
            masked={ masked }
            showSafe={ showSafe }
          />
        ) ) }
      </div>

      <div className="mt-7 rounded-lg border border-border bg-hover/40 px-4 py-3 text-[13px] text-label">
        <div className="mb-1 font-medium text-foreground">Legend</div>
        <ul className="space-y-1">
          { LEGEND.map( ( t ) => (
            <li key={ t }>{ t }</li>
          ) ) }
        </ul>
      </div>
    </div>
  );
}
