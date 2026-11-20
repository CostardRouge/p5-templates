import {
  readdirSync, readFileSync
} from "node:fs";
import {
  join, relative
} from "node:path";

import nextConfig from "../../../next.config";

/* The static front (next.config.ts, "Two builds"; docs/memory/deployment.md,
   "The front is static") is built by Cloudflare, not by this CI. These checks
   catch here what would only break there: a route or page that both builds
   compile but the static export refuses, and Cloudflare's _headers and
   _redirects drifting from the full server's. */

const ROOT = join(
  __dirname,
  "..",
  "..",
  ".."
);
const APP = join(
  ROOT,
  "src",
  "app"
);

function walk( dir: string ): string[] {
  return readdirSync(
    dir,
    {
      withFileTypes: true
    }
  ).flatMap( ( entry ) => {
    const path = join(
      dir,
      entry.name
    );

    if ( entry.isDirectory() ) {
      return entry.name === "__tests__" ? [] : walk( path );
    }

    return [
      path
    ];
  } );
}

/** Routes and pages both builds compile: plain names, no .server / .static. */
const shared = walk( APP ).filter( ( file ) => /\/(page|route)\.tsx?$/.test( file ) );

describe(
  "files both builds compile",
  () => {
    it.each( shared.map( ( file ) => relative(
      ROOT,
      file
    ) ) )(
      "%s can be exported statically",
      ( file ) => {
        const source = readFileSync(
          join(
            ROOT,
            file
          ),
          "utf8"
        );

        // What the static export refuses (Next's static-exports guide).
        expect( source ).not.toMatch( /from "next\/headers"|\bcookies\(\)|\bheaders\(\)/ );
        expect( source ).not.toMatch( /dynamic = "force-dynamic"|revalidate = 0\b/ );
        expect( source ).not.toMatch( /^"use server"/m );

        if ( /\/route\.ts$/.test( file ) ) {
          // A route handler in the export must be static and read no request.
          expect( source ).toMatch( /export const dynamic = "force-static"/ );
          expect( source ).not.toMatch( /export (async )?function (POST|PUT|PATCH|DELETE)\b/ );
        }

        if ( /\[[^/]+\]\/(page|route)\.tsx?$/.test( file ) ) {
          // A dynamic segment needs its list of values at build.
          expect( source ).toMatch( /generateStaticParams/ );
        }
      }
    );
  }
);

describe(
  "Cloudflare's _redirects and _headers",
  () => {
    const redirectsFile = readFileSync(
      join(
        ROOT,
        "public",
        "_redirects"
      ),
      "utf8"
    );
    const headersFile = readFileSync(
      join(
        ROOT,
        "public",
        "_headers"
      ),
      "utf8"
    );

    it(
      "carry every redirect of the full server",
      async() => {
        const redirects = await nextConfig.redirects?.() ?? [];

        expect( redirects.length ).toBeGreaterThan( 0 );

        for ( const rule of redirects ) {
          const source = rule.source.replace(
            "/:path*",
            "/*"
          );
          const destination = rule.destination.replace(
            "/:path*",
            "/:splat"
          );

          expect( redirectsFile ).toContain( `${ source } ${ destination } ${ rule.permanent ? 308 : 307 }` );
        }
      }
    );

    it(
      "let other sites frame /embed, as the full server does",
      async() => {
        const headers = await nextConfig.headers?.() ?? [];
        const embed = headers.find( ( rule ) => rule.source === "/embed/:path*" );

        expect( embed?.headers[ 0 ].value ).toBe( "frame-ancestors *" );
        expect( headersFile ).toMatch( /^\/embed\/\*\n {2}Content-Security-Policy: frame-ancestors \*$/m );
      }
    );
  }
);
