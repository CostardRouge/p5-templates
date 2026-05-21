import fs from "fs";
import path from "path";
import type {
  Metadata
} from "next";
import {
  notFound
} from "next/navigation";
import sharp from "sharp";
import manifest from "@/app/manifest";
import IconDiagnostics, {
  type IconCheck
} from "./IconDiagnostics";

// Always re-read the files from disk on each request (live diagnostic).
export const dynamic = "force-dynamic";

// Sets the browser tab title (rendered through the layout's "%s | <site>" template).
export const metadata: Metadata = {
  title: "Icon Diagnostics"
};

type Descriptor = {
  src: string;
  declaredSizes: string;
  type?: string;
  purpose: string;
  source: "manifest" | "document";
  expect?: { w: number;
    h: number };
};

/** Parse the size directory of an .ico file (returns ["16x16", "32x32", ...]). */
function readIcoSizes( filePath: string ): string[] {
  try {
    const buf = fs.readFileSync( filePath );
    const count = buf.readUInt16LE( 4 );
    const out: string[] = [];

    for ( let i = 0; i < count; i++ ) {
      const off = 6 + i * 16;
      let w = buf.readUInt8( off );
      let h = buf.readUInt8( off + 1 );

      if ( w === 0 ) {
        w = 256;
      }

      if ( h === 0 ) {
        h = 256;
      }

      out.push( `${ w }x${ h }` );
    }

    return out;
  } catch {
    return [];
  }
}

/** "192x192" -> { w: 192, h: 192 }; anything else -> undefined. */
function parseExpect( sizes: string ): { w: number;
  h: number } | undefined {
  const m = /^(\d+)x(\d+)$/.exec( sizes.trim() );

  if ( !m ) {
    return undefined;
  }

  return {
    w: Number( m[ 1 ] ),
    h: Number( m[ 2 ] )
  };
}

/** Inspect a single icon on disk and collect any problems. */
async function analyze( d: Descriptor ): Promise<IconCheck> {
  const filePath = path.join(
    process.cwd(),
    "public",
    d.src
  );
  const check: IconCheck = {
    src: d.src,
    declaredSizes: d.declaredSizes,
    type: d.type,
    purpose: d.purpose,
    source: d.source,
    exists: false,
    fileSizeKB: null,
    format: null,
    width: null,
    height: null,
    hasAlpha: null,
    icoSizes: undefined,
    issues: []
  };

  if ( !fs.existsSync( filePath ) ) {
    check.issues.push( {
      level: "error",
      msg: "File not found on disk — this URL will return a 404."
    } );

    return check;
  }

  check.exists = true;
  check.fileSizeKB = Math.round( ( fs.statSync( filePath ).size / 1024 ) * 10 ) / 10;

  if ( d.src.toLowerCase().endsWith( ".ico" ) ) {
    check.format = "ico";
    check.icoSizes = readIcoSizes( filePath );

    const missing = [
      "16x16",
      "32x32"
    ].filter( ( s ) => !check.icoSizes?.includes( s ) );

    if ( missing.length > 0 ) {
      check.issues.push( {
        level: "warn",
        msg: `The .ico is missing the ${ missing.join( ", " ) } size(s).`
      } );
    }

    return check;
  }

  try {
    const meta = await sharp( filePath ).metadata();

    check.format = meta.format ?? null;
    check.width = meta.width ?? null;
    check.height = meta.height ?? null;
    check.hasAlpha = meta.hasAlpha ?? null;
  } catch {
    check.issues.push( {
      level: "warn",
      msg: "Could not read the image with sharp — unexpected format?"
    } );

    return check;
  }

  if ( d.expect && ( check.width !== d.expect.w || check.height !== d.expect.h ) ) {
    check.issues.push( {
      level: "error",
      msg: `Real dimensions ${ check.width }×${ check.height } ≠ declared size ${ d.expect.w }×${ d.expect.h }.`
    } );
  }

  if ( d.type === "image/png" && check.format !== "png" ) {
    check.issues.push( {
      level: "warn",
      msg: `declared type "image/png" but actual format "${ check.format }".`
    } );
  }

  if ( d.purpose.includes( "maskable" ) && check.hasAlpha === true ) {
    check.issues.push( {
      level: "warn",
      msg: "Maskable icon has an alpha channel — the background should be solid (opaque)."
    } );
  }

  return check;
}

export default async function IconDebugPage() {
  // Dev-only tool: never expose it in production.
  if ( process.env.NODE_ENV === "production" ) {
    notFound();
  }

  const m = manifest();
  const manifestIcons: Descriptor[] = ( m.icons ?? [] ).map( ( ic ) => ( {
    src: String( ic.src ),
    declaredSizes: ic.sizes ?? "—",
    type: ic.type,
    purpose: String( ic.purpose ?? "any" ),
    source: "manifest" as const,
    expect: parseExpect( ic.sizes ?? "" )
  } ) );

  const documentIcons: Descriptor[] = [
    {
      src: "/favicon.ico",
      declaredSizes: "16x16, 32x32 (multi)",
      type: "image/x-icon",
      purpose: "favicon",
      source: "document"
    },
    {
      src: "/apple-touch-icon.png",
      declaredSizes: "180x180",
      type: "image/png",
      purpose: "apple-touch",
      source: "document",
      expect: {
        w: 180,
        h: 180
      }
    }
  ];

  const manifestChecks = await Promise.all( manifestIcons.map( analyze ) );
  const documentChecks = await Promise.all( documentIcons.map( analyze ) );

  return (
    <IconDiagnostics
      manifestChecks={ manifestChecks }
      documentChecks={ documentChecks }
      manifestMeta={ {
        name: m.name ?? "",
        shortName: m.short_name ?? "",
        themeColor: String( m.theme_color ?? "" ),
        backgroundColor: String( m.background_color ?? "" ),
        display: String( m.display ?? "" )
      } }
    />
  );
}
