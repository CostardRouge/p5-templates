"use client";

import Link from "next/link";
import {
  useEffect, useMemo, useRef, useState
} from "react";
import {
  ArrowUpRight, Layers, Radio, Search, Server, Shuffle, SlidersHorizontal, X
} from "lucide-react";
import Github from "@/components/ui/GithubIcon";
import AnimatedPreview from "@/components/AnimatedPreview";
import {
  MenuBarSlot
} from "@/components/MenuBarPortal";
import {
  fuzzyFilter
} from "@/utils/fuzzySearch";
import type {
  SketchItem
} from "@/app/sketches/getSketchesData";

type HomePageProps = {
  sketches: SketchItem[];
  engineLabels: Record<string, string>;
  /**
   * The detailed studio tour, rendered between the capabilities grid and the
   * footer. Passed in as a slot rather than imported here: it is a server
   * component (static prose + screenshots), and importing it from this client
   * component would ship the whole thing to the browser.
   */
  studioFeatures?: React.ReactNode;
};

// Still the p5-templates slug until the repo itself is renamed (see TODO.md,
// "Rename follow-ups") — GitHub will redirect the old URL afterwards.
const GITHUB_URL = "https://github.com/CostardRouge/p5-templates";
const LATEST_COUNT = 8;
const RANDOM_COUNT = 4;

// Inline search shows at most this many cards; the library link picks up the
// keyword for the full result set.
const MAX_RESULTS = 24;

const CARD_GRID =
  "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4";

// The capabilities grid doubles as the table of contents for the studio tour
// below it: every card but the last links to the section that shows it.
const FEATURES = [
  {
    icon: SlidersHorizontal,
    title: "Live parameters",
    text: "Sliders, colors, text, easing curves and image, video or audio drop-zones — generated per sketch. Every change re-renders instantly.",
    href: "#controls"
  },
  {
    icon: Radio,
    title: "Driven by anything",
    text: "Bind a parameter to the microphone, a hand, a face, a gamepad — or to an oscillator that needs no permission at all.",
    href: "#modulation"
  },
  {
    icon: Layers,
    title: "Layers and telemetry",
    text: "Seventeen kinds of overlay: text, images, QR codes, specs and breakdown panels, plus seven live readouts bound to the sketch.",
    href: "#elements"
  },
  {
    icon: Shuffle,
    title: "Variants and montage",
    text: "Randomize a look, keep it as a slide, then let one slide morph all the others into each other on a loop.",
    href: "#slides"
  },
  {
    icon: Server,
    title: "An export queue",
    text: "mp4, webm, gif, png or a png sequence — several sizes at once, in the browser or handed to the server queue.",
    href: "#export"
  },
  {
    icon: Github,
    title: "Open source",
    text: "MIT-licensed and reusable — fork it, add your own sketches, run it anywhere."
  }
];

function shuffle<T>( arr: T[] ): T[] {
  const out = arr.slice();

  for ( let i = out.length - 1; i > 0; i-- ) {
    const j = Math.floor( Math.random() * ( i + 1 ) );

    [
      out[ i ],
      out[ j ]
    ] = [
      out[ j ],
      out[ i ]
    ];
  }
  return out;
}

function useReveal<T extends HTMLElement>() {
  const ref = useRef<T | null>( null );
  const [
    visible,
    setVisible
  ] = useState( false );

  useEffect(
    () => {
      const el = ref.current;

      if ( !el ) {
        return;
      }

      const observer = new IntersectionObserver(
        ( entries ) => {
          for ( const e of entries ) {
            if ( e.isIntersecting ) {
              setVisible( true );
              observer.disconnect();
              break;
            }
          }
        },
        {
          threshold: 0.1
        }
      );

      observer.observe( el );
      return () => observer.disconnect();
    },
    []
  );

  return {
    ref,
    visible
  };
}

function Reveal( {
  children,
  className = ""
}: {
  children: React.ReactNode;
  className?: string;
} ) {
  const {
    ref, visible
  } = useReveal<HTMLDivElement>();

  return (
    <div
      ref={ ref }
      className={ `${ className } ${
        visible ? "animate-reveal-up" : "opacity-0 translate-y-10"
      } transition-all` }
    >
      {children}
    </div>
  );
}

function SectionHeader( {
  label,
  title,
  children
}: {
  label: string;
  title: string;
  children?: React.ReactNode;
} ) {
  return (
    <div className="flex items-end justify-between gap-4 mb-4 sm:mb-6">
      <div className="min-w-0">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-label mb-1.5">
          { label }
        </p>
        <h2 className="text-xl sm:text-2xl font-black tracking-tight truncate">
          { title }
        </h2>
      </div>
      { children }
    </div>
  );
}

function SketchCard( {
  sketch,
  eager = false
}: {
  sketch: SketchItem;
  eager?: boolean;
} ) {
  return (
    <Link
      href={ sketch.href }
      className="group relative block w-full bg-background rounded-xl sm:rounded-2xl overflow-hidden border border-border hover:border-foreground/20 transition duration-300 hover:shadow-lg hover:shadow-active/10 hover:-translate-y-0.5"
    >
      {/* 4:5 aspect box — same ratio as the gallery cards */}
      <div
        className="w-full relative"
        style={ {
          paddingTop: "125%"
        } }
      >
        {/* The picture is decorative: the card prints the sketch's name right
            under it, inside the same link, so alt text repeating it would make
            a screen reader say the name twice (axe `image-redundant-alt`). */}
        { sketch.preview ? (
          <AnimatedPreview
            previewUrl={ sketch.preview }
            previewUrlDesktop={ sketch.previewMd ?? undefined }
            thumbnailUrl={ sketch.thumbnail }
            name={ sketch.name }
            alt=""
            eager={ eager }
            imgClassName="w-full h-full object-cover"
          />
        ) : (
          <img
            data-pin-nopin="true"
            alt=""
            src={ sketch.thumbnail }
            srcSet={ `${ sketch.thumbnail } 1x, ${ sketch.thumbnail.replace(
              /\.webp$/,
              "-2x.webp"
            ) } 2x` }
            loading={ eager ? "eager" : "lazy" }
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) }
      </div>
      <div className="bg-background border-t border-border px-2 py-2">
        <p
          title={ sketch.name }
          className="text-xs sm:text-sm font-medium text-foreground text-center truncate"
        >
          { sketch.name }
        </p>
      </div>
    </Link>
  );
}

export default function HomePage( {
  sketches,
  engineLabels,
  studioFeatures
}: HomePageProps ) {
  const [
    query,
    setQuery
  ] = useState( "" );

  // `.hidden-home` entries stay searchable but never appear in the
  // latest/random sections.
  const homePool = useMemo(
    () => sketches.filter( ( t ) => !t.hiddenFromHome ),
    [
      sketches
    ]
  );

  const latest = useMemo(
    () => homePool
      .slice()
      .sort( (
        a, b
      ) =>
        new Date( b.mtime ?? 0 ).getTime() - new Date( a.mtime ?? 0 ).getTime() )
      .slice(
        0,
        LATEST_COUNT
      ),
    [
      homePool
    ]
  );

  // Random picks avoid duplicating the latest row and prefer sketches with
  // an animated preview when enough are available.
  const randomPool = useMemo(
    () => {
      const latestHrefs = new Set( latest.map( ( t ) => t.href ) );
      const rest = homePool.filter( ( t ) => !latestHrefs.has( t.href ) );
      const withPreview = rest.filter( ( t ) => t.preview );

      if ( withPreview.length >= RANDOM_COUNT ) {
        return withPreview;
      }

      if ( rest.length >= RANDOM_COUNT ) {
        return rest;
      }

      return homePool;
    },
    [
      homePool,
      latest
    ]
  );

  // First paint is deterministic so SSR markup and hydration match; the real
  // shuffle happens after mount (and on every "Shuffle" click).
  const [
    randomPicks,
    setRandomPicks
  ] = useState( () => randomPool.slice(
    0,
    RANDOM_COUNT
  ) );

  useEffect(
    () => {
      setRandomPicks( shuffle( randomPool ).slice(
        0,
        RANDOM_COUNT
      ) );
    },
    [
      randomPool
    ]
  );

  const reroll = () => setRandomPicks( shuffle( randomPool ).slice(
    0,
    RANDOM_COUNT
  ) );

  const searchActive = query.trim().length > 0;

  const results = useMemo(
    () => ( searchActive
      ? fuzzyFilter(
        sketches,
        query,
        ( t ) => [
          t.name,
          t.category || ""
        ]
      )
      : [] ),
    [
      sketches,
      query,
      searchActive
    ]
  );

  const engineCount = Object.keys( engineLabels ).length;
  const libraryHref = searchActive
    ? `/sketches?keyword=${ encodeURIComponent( query.trim() ) }`
    : "/sketches";

  return (
    <div className="relative w-full bg-background text-foreground">
      {/* Faint dot-grid backdrop */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
        <div
          className="absolute inset-0 opacity-[0.35] dark:opacity-[0.18]"
          style={ {
            backgroundImage:
              "radial-gradient(hsl(var(--foreground) / 0.18) 0.5px, transparent 0.5px)",
            backgroundSize: "22px 22px"
          } }
        />
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-8 pb-16 sm:pb-20">
        {/* ============ HERO ============ */}
        <header className="pt-8 sm:pt-16 pb-10 sm:pb-16">
          {/* Mobile-only inline menubar slot — avoids the floating menu
              overlapping the hero on narrow viewports. On md+ the slot is
              hidden and the menu falls back to its floating position. */}
          <MenuBarSlot className="md:hidden mb-6" />

          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10px] sm:text-xs uppercase tracking-[0.2em] text-label mb-6 sm:mb-8">
            <span className="tabular-nums">{ sketches.length } sketches</span>
            <span className="h-1 w-1 rounded-full bg-fuchsia-500" />
            <span className="tabular-nums">{ engineCount } engines</span>
            <span className="h-1 w-1 rounded-full bg-foreground/30" />
            <span>open source</span>
          </p>

          <h1 className="font-black text-4xl sm:text-6xl lg:text-7xl tracking-[-0.04em] leading-[0.95] [text-wrap:balance]">
            a studio for{ " " }
            <span className="italic font-extralight">creative-coding</span>{ " " }
            visuals<span className="text-fuchsia-500">.</span>
          </h1>

          <p className="mt-5 sm:mt-6 max-w-[60ch] text-sm sm:text-base text-label leading-relaxed [text-wrap:pretty]">
            Customizable sketches built on{ " " }
            <span className="text-foreground font-medium">p5.js</span>,{ " " }
            <span className="text-foreground font-medium">gsap</span> and{ " " }
            <span className="text-foreground font-medium">html stages</span>.
            Tweak parameters live, randomize, then export images or record
            video — in the browser or on the server.
          </p>

          {/* Search + primary CTA */}
          <div className="mt-7 sm:mt-9 flex flex-col sm:flex-row gap-2 sm:gap-3 max-w-2xl">
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/40" />
              <input
                type="text"
                value={ query }
                onChange={ ( e ) => setQuery( e.target.value ) }
                placeholder={ `Search ${ sketches.length } sketches...` }
                autoComplete="off"
                className={ `pl-11 py-3 rounded-xl w-full bg-background border border-border hover:border-foreground/30 focus:border-foreground/50 focus:outline-none focus:ring-2 focus:ring-foreground/10 transition-all text-sm placeholder:text-foreground/40 ${
                  query ? "pr-11" : "pr-4"
                }` }
              />
              { query && (
                <button
                  type="button"
                  onClick={ () => setQuery( "" ) }
                  aria-label="Clear search"
                  title="Clear search"
                  className="absolute right-3 top-1/2 -translate-y-1/2 grid place-items-center w-7 h-7 rounded-md text-foreground/50 hover:text-foreground hover:bg-hover/50 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              ) }
            </div>

            <Link
              href="/sketches"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-foreground text-background px-5 py-3 text-sm font-semibold hover:scale-[1.02] active:scale-[0.98] transition-transform flex-shrink-0"
            >
              <span>Open the library</span>
              <ArrowUpRight className="w-4 h-4" />
            </Link>
          </div>
        </header>

        { searchActive ? (
          /* ============ SEARCH RESULTS ============ */
          <section className="pb-12 sm:pb-16">
            <SectionHeader
              label="/search"
              title={
                results.length === 0
                  ? "No matches"
                  : `${ results.length } ${ results.length === 1 ? "match" : "matches" }`
              }
            >
              <Link
                href={ libraryHref }
                className="inline-flex items-center gap-1.5 text-xs sm:text-sm text-label hover:text-foreground transition-colors flex-shrink-0"
              >
                <span>Open in library</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </SectionHeader>

            { results.length === 0 ? (
              <p className="text-sm text-label">
                Nothing matches &ldquo;{ query.trim() }&rdquo;. Try a shorter
                keyword, or{ " " }
                <button
                  type="button"
                  onClick={ () => setQuery( "" ) }
                  className="underline underline-offset-4 hover:text-foreground transition-colors"
                >
                  clear the search
                </button>
                .
              </p>
            ) : (
              <>
                <div className={ CARD_GRID }>
                  { results
                    .slice(
                      0,
                      MAX_RESULTS
                    )
                    .map( (
                      sketch, index
                    ) => (
                      <SketchCard
                        key={ sketch.href }
                        sketch={ sketch }
                        eager={ index === 0 }
                      />
                    ) ) }
                </div>

                { results.length > MAX_RESULTS && (
                  <div className="mt-5 sm:mt-6">
                    <Link
                      href={ libraryHref }
                      className="inline-flex items-center gap-2 text-sm text-label hover:text-foreground transition-colors"
                    >
                      <span>
                        See all { results.length } results in the library
                      </span>
                      <ArrowUpRight className="w-4 h-4" />
                    </Link>
                  </div>
                ) }
              </>
            ) }
          </section>
        ) : (
          <>
            {/* ============ LATEST ============ */}
            <Reveal>
              <section className="pb-12 sm:pb-16">
                <SectionHeader label="/latest" title="Recently added">
                  <Link
                    href="/sketches"
                    className="inline-flex items-center gap-1.5 text-xs sm:text-sm text-label hover:text-foreground transition-colors flex-shrink-0"
                  >
                    <span>View all { sketches.length }</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </Link>
                </SectionHeader>

                <div className={ CARD_GRID }>
                  { latest.map( (
                    sketch, index
                  ) => (
                    <SketchCard
                      key={ sketch.href }
                      sketch={ sketch }
                      eager={ index === 0 }
                    />
                  ) ) }
                </div>
              </section>
            </Reveal>

            {/* ============ RANDOM PICKS ============ */}
            <Reveal>
              <section className="pb-12 sm:pb-16">
                <SectionHeader label="/random" title="Random picks">
                  <button
                    type="button"
                    onClick={ reroll }
                    className="group inline-flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-xs sm:text-sm font-medium text-foreground/70 hover:text-foreground hover:border-foreground/30 hover:bg-hover/50 transition-colors flex-shrink-0"
                  >
                    <Shuffle className="w-3.5 h-3.5 transition-transform duration-500 group-hover:rotate-180" />
                    <span>Shuffle</span>
                  </button>
                </SectionHeader>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                  { randomPicks.map( ( sketch ) => (
                    <SketchCard key={ sketch.href } sketch={ sketch } />
                  ) ) }
                </div>
              </section>
            </Reveal>
          </>
        ) }

        {/* ============ CAPABILITIES ============ */}
        <Reveal>
          <section id="capabilities" className="pb-12 sm:pb-16">
            <SectionHeader label="/capabilities" title="What you can do" />

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              { FEATURES.map( ( feature ) => {
                const body = (
                  <>
                    <feature.icon
                      className="w-4 h-4 text-fuchsia-500 mb-3"
                      strokeWidth={ 1.5 }
                    />
                    <h3 className="text-sm sm:text-base font-bold tracking-tight mb-1.5">
                      { feature.title }
                    </h3>
                    <p className="text-xs sm:text-sm text-label leading-relaxed">
                      { feature.text }
                    </p>
                  </>
                );

                return (
                  <article
                    key={ feature.title }
                    className="rounded-xl sm:rounded-2xl border border-border bg-background"
                  >
                    { feature.href ? (
                      <a
                        href={ feature.href }
                        className="block p-5 rounded-xl sm:rounded-2xl hover:bg-hover/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/40 transition-colors"
                      >
                        { body }
                      </a>
                    ) : (
                      <div className="p-5">{ body }</div>
                    ) }
                  </article>
                );
              } ) }
            </div>
          </section>
        </Reveal>

        {/* ============ STUDIO TOUR ============ */}
        { studioFeatures }

        {/* ============ FOOTER CTA ============ */}
        <Reveal>
          <footer className="border-t border-border pt-10 sm:pt-14 flex flex-col items-center text-center gap-5 sm:gap-6">
            <p className="max-w-[48ch] text-sm sm:text-base text-label leading-relaxed">
              <span className="font-mono tabular-nums text-foreground">
                { sketches.length }
              </span>{ " " }
              sketches ready to customize, record and export. No signup, no
              install — everything runs in your browser.
            </p>

            <div className="flex flex-col sm:flex-row gap-3">
              <Link
                href="/sketches"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-foreground text-background px-6 py-3 text-sm font-semibold hover:scale-[1.02] active:scale-[0.98] transition-transform"
              >
                <span>Open the library</span>
                <ArrowUpRight className="w-4 h-4" />
              </Link>
              <a
                href={ GITHUB_URL }
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-border px-6 py-3 text-sm font-semibold text-foreground/80 hover:text-foreground hover:border-foreground/30 hover:bg-hover/50 transition-colors"
              >
                <Github className="w-4 h-4" />
                <span>Star on GitHub</span>
              </a>
            </div>

            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-label">
              <Link
                href="/sitemap"
                className="hover:text-foreground transition-colors"
              >
                site map
              </Link>
              { " · mit license · " }
              { new Date().getFullYear() }
            </p>
          </footer>
        </Reveal>
      </div>
    </div>
  );
}
