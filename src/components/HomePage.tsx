"use client";

import Link from "next/link";
import type {
  CSSProperties
} from "react";
import {
  useEffect, useMemo, useRef, useState
} from "react";
import {
  ArrowUpRight,
  Circle,
  CornerDownRight,
  Hash,
  MousePointer2,
  Plus,
  Radio,
  Shuffle,
  Slash,
  Square,
  Triangle
} from "lucide-react";
import AnimatedPreview from "@/components/AnimatedPreview";
import {
  MenuBarSlot
} from "@/components/MenuBarPortal";
import ScrollToTopButton from "@/components/ScrollToTopButton";
import type {
  TemplateItem
} from "@/app/templates/getTemplatesData";

type HomePageProps = {
  templates: TemplateItem[];
  engineLabels: Record<string, string>;
  totalTemplates: number;
};

const TICKER = [
  "p5.js",
  "gsap",
  "html5 stages",
  "mp4 / webm record",
  "9:16 · 1:1 · 4:5",
  "live parameters",
  "headless renderer",
  "drop-zone uploads",
  "randomize",
  "frame-perfect",
  "browser-native",
  "zero install"
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
          threshold: 0.15
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
  delay = 0,
  className = ""
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
} ) {
  const {
    ref, visible
  } = useReveal<HTMLDivElement>();

  return (
    <div
      ref={ ref }
      style={ {
        animationDelay: visible ? `${ delay }ms` : undefined
      } }
      className={ `${ className } ${
        visible ? "animate-reveal-up" : "opacity-0 translate-y-10"
      } transition-all` }
    >
      {children}
    </div>
  );
}

function useCountUp(
  target: number, duration = 1200
) {
  const ref = useRef<HTMLSpanElement | null>( null );
  const [
    val,
    setVal
  ] = useState( 0 );

  useEffect(
    () => {
      const el = ref.current;

      if ( !el ) {
        return;
      }

      const io = new IntersectionObserver(
        ( entries ) => {
          if ( !entries[ 0 ].isIntersecting ) {
            return;
          }
          const start = performance.now();
          let raf = 0;
          const step = ( t: number ) => {
            const p = Math.min(
              1,
              ( t - start ) / duration
            );
            const eased = 1 - Math.pow(
              1 - p,
              3
            );

            setVal( Math.round( target * eased ) );
            if ( p < 1 ) {
              raf = requestAnimationFrame( step );
            }
          };

          raf = requestAnimationFrame( step );
          io.disconnect();
          return () => cancelAnimationFrame( raf );
        },
        {
          threshold: 0.4
        }
      );

      io.observe( el );
      return () => io.disconnect();
    },
    [
      target,
      duration
    ]
  );

  return {
    ref,
    val
  };
}

function PreviewSurface( {
  template,
  eager = false,
  imgClassName = "w-full h-full object-cover"
}: {
  template: TemplateItem;
  eager?: boolean;
  imgClassName?: string;
} ) {
  if ( template.preview ) {
    return (
      <AnimatedPreview
        previewUrl={ template.preview }
        thumbnailUrl={ template.thumbnail }
        name={ template.name }
        imgClassName={ imgClassName }
        eager={ eager }
      />
    );
  }

  return (
    <img
      alt={ template.name }
      src={ template.thumbnail }
      loading={ eager ? "eager" : "lazy" }
      className={ `absolute inset-0 ${ imgClassName }` }
    />
  );
}

function SpecLabel( {
  index,
  label
}: { index: string;
  label: string } ) {
  return (
    <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-label">
      <span className="tabular-nums">{index}</span>
      <span className="h-px w-4 bg-foreground/30" />
      <span>{label}</span>
    </div>
  );
}

function StatBlock( {
  value,
  label,
  suffix,
  numeric = true
}: {
  value: number | string;
  label: string;
  suffix?: string;
  numeric?: boolean;
} ) {
  const numericTarget = typeof value === "number" ? value : 0;
  const {
    ref, val
  } = useCountUp(
    numericTarget,
    1400
  );

  return (
    <div className="flex flex-col gap-2 py-6 sm:py-8">
      <span
        ref={ ref }
        className="font-black text-5xl sm:text-7xl lg:text-8xl tracking-[-0.04em] leading-[0.85] tabular-nums"
      >
        {numeric ? val : value}
        {suffix ? (
          <span className="text-foreground/30">{suffix}</span>
        ) : null}
      </span>
      <span className="font-mono text-[10px] sm:text-xs uppercase tracking-[0.2em] text-label">
        {label}
      </span>
    </div>
  );
}

export default function HomePage( {
  templates,
  engineLabels,
  totalTemplates
}: HomePageProps ) {
  const [
    showcase,
    setShowcase
  ] = useState<TemplateItem[]>( () => templates.slice(
    0,
    8
  ) );

  useEffect(
    () => {
      const withPreview = templates.filter( ( t ) => t.preview );
      const pool = withPreview.length >= 8 ? withPreview : templates;

      setShowcase( shuffle( pool ).slice(
        0,
        8
      ) );
    },
    [
      templates
    ]
  );

  const engineNames = useMemo(
    () => Object.values( engineLabels ),
    [
      engineLabels
    ]
  );

  const heroFront = showcase[ 0 ];
  const heroBack = showcase[ 1 ];

  return (
    <div className="relative w-full overflow-x-hidden bg-background text-foreground">
      {/* Background system: faint dot-grid + single subtle accent radial + grain */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.35] dark:opacity-[0.18]"
          style={ {
            backgroundImage:
              "radial-gradient(hsl(var(--foreground) / 0.18) 0.5px, transparent 0.5px)",
            backgroundSize: "22px 22px"
          } }
        />
        <div
          aria-hidden
          className="absolute -top-[20%] -right-[10%] h-[40rem] w-[40rem] rounded-full"
          style={ {
            background:
              "radial-gradient(closest-side, rgba(236,72,153,0.18), transparent 70%)",
            filter: "blur(40px)"
          } }
        />
      </div>

      {/* ============ HERO ============ */}
      <section className="relative px-4 sm:px-8 lg:px-12 pt-10 sm:pt-16 lg:pt-20 pb-16 sm:pb-24 max-w-[1440px] mx-auto">
        {/* Mobile-only inline menubar slot — avoids the floating menu
            overlapping the metadata strip on narrow viewports. On md+ the
            slot is hidden and the menu falls back to its floating position. */}
        <MenuBarSlot className="md:hidden mb-4" />

        {/* top metadata bar */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 font-mono text-[10px] sm:text-xs uppercase tracking-[0.2em] text-label mb-10 sm:mb-16">
          <span className="tabular-nums">v.0.1 · {new Date().getFullYear()}</span>
          <span className="h-1 w-1 rounded-full bg-fuchsia-500" />
          <span className="tabular-nums">
            {totalTemplates.toString().padStart(
              2,
              "0"
            )} templates
          </span>
          <span className="h-1 w-1 rounded-full bg-foreground/30" />
          <span className="tabular-nums">
            {engineNames.length.toString().padStart(
              2,
              "0"
            )} engines
          </span>
          <span className="hidden sm:inline-block h-1 w-1 rounded-full bg-foreground/30" />
          <span className="hidden sm:inline">browser-native</span>
          <span className="ml-auto hidden md:inline-flex items-center gap-2 text-foreground/60">
            <span className="h-1.5 w-1.5 rounded-full bg-fuchsia-500 animate-pulse-soft" />
            <span>live</span>
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 md:gap-10 lg:gap-16 items-start">
          {/* Headline column */}
          <div className="md:col-span-7 lg:col-span-8">
            <h1 className="font-black text-[3.25rem] sm:text-[5.5rem] md:text-[7rem] lg:text-[9.5rem] leading-[0.84] tracking-[-0.045em] [text-wrap:balance]">
              <span className="block">a studio</span>
              <span className="block">
                for{ " " }
                <span className="italic font-extralight">social</span>
              </span>
              <span className="block">
                visuals<span className="text-fuchsia-500">.</span>
              </span>
            </h1>

            <div className="mt-8 sm:mt-12 lg:mt-16 grid grid-cols-1 md:grid-cols-12 gap-6 items-end">
              <p className="md:col-span-7 max-w-[55ch] text-base sm:text-lg text-label leading-relaxed [text-wrap:pretty]">
                Customizable templates built on{ " " }
                <span className="text-foreground font-medium">p5.js</span>,{ " " }
                <span className="text-foreground font-medium">gsap</span>, and{ " " }
                <span className="text-foreground font-medium">html stages</span>.
                Tweak parameters in a live editor, then export images or record
                full animations to video — never leaving the browser.
              </p>

              <div className="md:col-span-5 flex flex-col sm:flex-row md:flex-col lg:flex-row items-stretch sm:items-center md:items-stretch lg:items-center gap-3 md:gap-4">
                <Link
                  href="/templates"
                  className="group inline-flex items-center justify-between gap-4 rounded-full bg-foreground text-background pl-6 pr-3 py-3 text-sm font-semibold hover:scale-[1.02] active:scale-[0.98] transition-transform"
                >
                  <span>Open the library</span>
                  <span className="grid place-items-center w-8 h-8 rounded-full bg-background/15 group-hover:bg-background/25 transition-colors">
                    <ArrowUpRight className="w-4 h-4 transition-transform group-hover:rotate-[20deg]" />
                  </span>
                </Link>
                <a
                  href="#capabilities"
                  className="group inline-flex items-center gap-2 text-sm text-label hover:text-foreground transition-colors px-2"
                >
                  <CornerDownRight className="w-4 h-4" />
                  <span className="underline-offset-4 group-hover:underline">
                    or scroll down
                  </span>
                </a>
              </div>
            </div>
          </div>

          {/* Right: hero spec stack */}
          <div className="md:col-span-5 lg:col-span-4 relative">
            <div className="relative mx-auto md:mx-0 w-full max-w-[360px] md:max-w-none aspect-[4/5]">
              {/* back ghost card */}
              {heroBack ? (
                <div className="absolute inset-0 will-change-transform animate-drift-reverse">
                  <div className="absolute inset-0 translate-x-[4%] translate-y-[5%] rounded-md overflow-hidden border border-border bg-background/60 opacity-60">
                    <PreviewSurface template={ heroBack } />
                  </div>
                </div>
              ) : null}

              {/* front featured card */}
              {heroFront ? (
                <Link
                  href={ heroFront.href }
                  className="absolute inset-0 group will-change-transform animate-drift block"
                >
                  <div className="absolute inset-0 rounded-md overflow-hidden border border-foreground/15 bg-background shadow-[0_30px_60px_-30px_rgba(0,0,0,0.35)] dark:shadow-[0_30px_60px_-30px_rgba(0,0,0,0.7)]">
                    {/* scan line micro-interaction */}
                    {/* <div*/}
                    {/*  aria-hidden*/}
                    {/*  className="absolute inset-x-0 h-px bg-fuchsia-500/40 z-10 animate-scan-line pointer-events-none"*/}
                    {/* />*/}
                    <PreviewSurface template={ heroFront } eager />
                  </div>
                  {/* corner labels */}
                  <div className="absolute -top-3 left-2 right-2 flex justify-between items-end font-mono text-[10px] uppercase tracking-[0.16em] text-label">
                    <span className="bg-background px-1 border">spec · 4:5</span>
                    <span className="bg-background px-1 truncate max-w-[55%] border">
                      {heroFront.name}
                    </span>
                  </div>
                  <div className="absolute -bottom-3 left-2 right-2 flex justify-between items-baseline font-mono text-[10px] uppercase tracking-[0.16em] text-label">
                    <span className="bg-background px-1 border">live · tap to open</span>
                    <span className="bg-background px-1 flex items-center gap-1 border">
                      <ArrowUpRight className="w-3 h-3" />
                    </span>
                  </div>
                </Link>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      {/* ============ TICKER ============ */}
      <section className="overflow-hidden border-y border-border bg-background/80 backdrop-blur-sm">
        <div className="flex w-max animate-marquee-slow gap-10 sm:gap-14 py-4 sm:py-5 will-change-transform">
          {[
            ...TICKER,
            ...TICKER
          ].map( (
            item, i
          ) => (
            <span
              key={ `${ item }-${ i }` }
              className="flex items-center gap-3 whitespace-nowrap font-mono text-xs sm:text-sm uppercase tracking-[0.22em] text-foreground/60"
            >
              <span
                className={ `h-1 w-1 rounded-full ${
                  i % 4 === 0 ? "bg-fuchsia-500" : "bg-foreground/30"
                }` }
              />
              <span>{item}</span>
            </span>
          ) )}
        </div>
      </section>

      {/* ============ SHOWCASE WALL ============ */}
      <section className="relative px-4 sm:px-8 lg:px-12 py-20 sm:py-28 max-w-[1440px] mx-auto">
        <Reveal>
          <div className="grid grid-cols-12 gap-6 mb-10 sm:mb-14 items-end">
            <div className="col-span-12 md:col-span-2">
              <SpecLabel index="01" label="/library" />
            </div>
            <div className="col-span-12 md:col-span-7">
              <h2 className="font-black text-3xl sm:text-5xl lg:text-6xl tracking-tighter leading-[0.95] [text-wrap:balance]">
                Pull a random{ " " }
                <span className="italic font-extralight">specimen</span>{ " " }
                from the shelf.
              </h2>
            </div>
            <div className="col-span-12 md:col-span-3 md:text-right">
              <p className="text-sm text-label leading-relaxed max-w-xs md:ml-auto">
                Reshuffled on every visit. Open one to inspect, tweak, and
                export.
              </p>
            </div>
          </div>
        </Reveal>

        {showcase.length >= 8 ? (
          <div className="grid grid-cols-12 gap-3 sm:gap-4">
            {/* Row 1 */}
            <Reveal className="col-span-12 md:col-span-7">
              <ShowcaseTile
                template={ showcase[ 0 ] }
                index="A.01"
                aspect="md:aspect-[16/13] aspect-[4/5]"
                size="lg"
              />
            </Reveal>
            <div className="col-span-12 md:col-span-5 grid grid-cols-1 md:grid-rows-2 gap-3 sm:gap-4 md:h-full">
              <Reveal delay={ 80 } className="md:h-full min-h-0">
                <ShowcaseTile
                  template={ showcase[ 1 ] }
                  index="A.02"
                  aspect="aspect-[16/9] md:aspect-auto md:h-full"
                />
              </Reveal>
              <Reveal delay={ 160 } className="md:h-full min-h-0">
                <ShowcaseTile
                  template={ showcase[ 2 ] }
                  index="A.03"
                  aspect="aspect-[16/9] md:aspect-auto md:h-full"
                />
              </Reveal>
            </div>

            {/* Row 2 */}
            <Reveal className="col-span-6 md:col-span-3" delay={ 240 }>
              <ShowcaseTile
                template={ showcase[ 3 ] }
                index="B.01"
                aspect="aspect-[9/16]"
              />
            </Reveal>
            <Reveal className="col-span-6 md:col-span-3" delay={ 300 }>
              <ShowcaseTile
                template={ showcase[ 4 ] }
                index="B.02"
                aspect="aspect-[9/16]"
              />
            </Reveal>
            <Reveal className="col-span-12 md:col-span-6" delay={ 360 }>
              <ShowcaseTile
                template={ showcase[ 5 ] }
                index="B.03"
                aspect="aspect-[16/9]"
              />
            </Reveal>

            {/* Row 3 */}
            <Reveal className="col-span-6 md:col-span-4" delay={ 420 }>
              <ShowcaseTile
                template={ showcase[ 6 ] }
                index="C.01"
                aspect="aspect-square"
              />
            </Reveal>
            <Reveal className="col-span-6 md:col-span-4" delay={ 480 }>
              <ShowcaseTile
                template={ showcase[ 7 ] }
                index="C.02"
                aspect="aspect-square"
              />
            </Reveal>
            <Reveal className="col-span-12 md:col-span-4" delay={ 540 }>
              <Link
                href="/templates"
                className="group relative block aspect-square rounded-md border border-dashed border-foreground/25 hover:border-foreground/60 transition-colors p-5 flex flex-col justify-between bg-background/40"
              >
                <SpecLabel index="C.03" label="/all" />
                <div className="flex flex-col gap-2">
                  <span className="text-2xl sm:text-3xl font-black tracking-tighter leading-none">
                    View all<br />
                    <span className="tabular-nums">{totalTemplates}</span>{ " " }
                    <span className="italic font-extralight">templates</span>
                  </span>
                  <span className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-[0.18em] text-label group-hover:text-fuchsia-500 transition-colors">
                    <ArrowUpRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                    browse
                  </span>
                </div>
              </Link>
            </Reveal>
          </div>
        ) : null}
      </section>

      {/* ============ NUMBERS STRIP ============ */}
      <section className="border-y border-border bg-background/60">
        <div className="px-4 sm:px-8 lg:px-12 max-w-[1440px] mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-y md:divide-y-0 divide-border">
            <div className="px-2 sm:px-6">
              <StatBlock value={ totalTemplates } label="ready to render" />
            </div>
            <div className="px-2 sm:px-6">
              <StatBlock value={ engineNames.length } label="rendering engines" />
            </div>
            <div className="px-2 sm:px-6">
              <StatBlock value="∞" label="param permutations" numeric={ false } />
            </div>
            <div className="px-2 sm:px-6">
              <StatBlock
                value="0"
                suffix=" sec"
                label="signup · install · upload"
                numeric={ false }
              />
            </div>
          </div>
        </div>
      </section>

      {/* ============ FEATURES BENTO ============ */}
      <section
        id="capabilities"
        className="relative px-4 sm:px-8 lg:px-12 py-20 sm:py-32 max-w-[1440px] mx-auto"
      >
        <Reveal>
          <div className="grid grid-cols-12 gap-6 mb-10 sm:mb-14 items-end">
            <div className="col-span-12 md:col-span-2">
              <SpecLabel index="02" label="/capabilities" />
            </div>
            <div className="col-span-12 md:col-span-10">
              <h2 className="font-black text-3xl sm:text-5xl lg:text-7xl tracking-tighter leading-[0.95] [text-wrap:balance]">
                The whole pipeline,{ " " }
                <span className="italic font-extralight">end to end</span>.
              </h2>
            </div>
          </div>
        </Reveal>

        <div className="grid grid-cols-1 md:grid-cols-6 gap-3 sm:gap-4 md:auto-rows-[10rem]">
          {/* Big tile — Live editing demo */}
          <Reveal className="md:col-span-4 md:row-span-2">
            <article className="relative h-full p-6 sm:p-8 rounded-md border border-border bg-background overflow-hidden group">
              <div className="flex items-start justify-between gap-4 mb-5">
                <SpecLabel index="F.01" label="primary" />
                <MousePointer2 className="w-5 h-5 text-fuchsia-500" strokeWidth={ 1.5 } />
              </div>
              <h3 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tighter leading-[1.02] mb-3 [text-wrap:balance]">
                Live editing.{ " " }
                <span className="italic font-extralight text-label">
                  every parameter, every frame.
                </span>
              </h3>
              <p className="text-sm text-label leading-relaxed max-w-md mb-8">
                Sliders, color pickers, text fields, drop-zones — generated per
                template. Each change reflects on the canvas instantly.
              </p>

              {/* Live demo: animated mini-sliders */}
              <div className="mt-4 md:mt-0 md:absolute md:left-8 md:right-8 md:bottom-8 space-y-3 font-mono text-[10px] uppercase tracking-[0.18em]">
                {[
                  {
                    k: "count",
                    v: "47",
                    from: 0.42,
                    to: 0.62
                  },
                  {
                    k: "speed",
                    v: "1.28",
                    from: 0.68,
                    to: 0.48
                  },
                  {
                    k: "hue",
                    v: "312°",
                    from: 0.22,
                    to: 0.44
                  },
                  {
                    k: "scale",
                    v: "0.84",
                    from: 0.55,
                    to: 0.35
                  }
                ].map( (
                  row, i
                ) => (
                  <div key={ row.k } className="flex items-center gap-3">
                    <span className="w-12 text-label">{row.k}</span>
                    <div className="flex-1 h-px bg-foreground/15 relative">
                      <div
                        className="absolute inset-y-0 left-0 animate-slider-pulse"
                        style={ {
                          "--slider-from": `${ row.from * 100 }%`,
                          "--slider-to": `${ row.to * 100 }%`,
                          animationDelay: `${ i * 0.4 }s`
                        } as CSSProperties }
                      >
                        <span className="absolute inset-0 bg-foreground/60" />
                        <span className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-2 h-2 bg-foreground rounded-full" />
                      </div>
                    </div>
                    <span className="w-12 text-right tabular-nums text-foreground">
                      {row.v}
                    </span>
                  </div>
                ) )}
              </div>
            </article>
          </Reveal>

          {/* Multi-engine */}
          <Reveal className="md:col-span-2" delay={ 80 }>
            <article className="h-full p-5 sm:p-6 rounded-md border border-border bg-background flex flex-col justify-between">
              <div className="flex items-start justify-between gap-4">
                <SpecLabel index="F.02" label="layer" />
                <Hash className="w-4 h-4 text-foreground/40" strokeWidth={ 1.5 } />
              </div>
              <div>
                <h3 className="text-lg sm:text-xl font-black tracking-tight mb-2">
                  Multi-engine.
                </h3>
                <p className="text-xs text-label leading-relaxed">
                  p5 sketches, gsap dom animations, and html stages — one shared
                  recorder, exporter, and form system.
                </p>
              </div>
            </article>
          </Reveal>

          {/* Randomize */}
          <Reveal className="md:col-span-2" delay={ 160 }>
            <article className="h-full p-5 sm:p-6 rounded-md border border-border bg-background flex flex-col justify-between group hover:border-foreground/40 transition-colors">
              <div className="flex items-start justify-between gap-4">
                <SpecLabel index="F.03" label="entropy" />
                <Shuffle
                  className="w-4 h-4 text-foreground/40 group-hover:text-fuchsia-500 group-hover:rotate-180 transition-all duration-500"
                  strokeWidth={ 1.5 }
                />
              </div>
              <div>
                <h3 className="text-lg sm:text-xl font-black tracking-tight mb-2">
                  One-click randomize.
                </h3>
                <p className="text-xs text-label leading-relaxed">
                  Reroll every option to a valid random value. Fastest path to a
                  variation you didn&apos;t plan.
                </p>
              </div>
            </article>
          </Reveal>

          {/* Recording */}
          <Reveal className="md:col-span-2" delay={ 240 }>
            <article className="h-full p-5 sm:p-6 rounded-md border border-border bg-background flex flex-col justify-between">
              <div className="flex items-start justify-between gap-4">
                <SpecLabel index="F.04" label="capture" />
                <Radio className="w-4 h-4 text-fuchsia-500 animate-pulse-soft" strokeWidth={ 1.5 } />
              </div>
              <div>
                <h3 className="text-lg sm:text-xl font-black tracking-tight mb-2">
                  Frame-perfect record.
                </h3>
                <p className="text-xs text-label leading-relaxed">
                  Capture mp4 or webm directly from the canvas. No screen
                  recorder, no quality loss.
                </p>
              </div>
            </article>
          </Reveal>

          {/* Export */}
          <Reveal className="md:col-span-2" delay={ 320 }>
            <article className="h-full p-5 sm:p-6 rounded-md border border-border bg-background flex flex-col justify-between">
              <div className="flex items-start justify-between gap-4">
                <SpecLabel index="F.05" label="output" />
                <div className="flex items-center gap-1.5 text-foreground/40">
                  <Square className="w-3 h-3" strokeWidth={ 1.5 } />
                  <Circle className="w-3 h-3" strokeWidth={ 1.5 } />
                  <Triangle className="w-3 h-3" strokeWidth={ 1.5 } />
                </div>
              </div>
              <div>
                <h3 className="text-lg sm:text-xl font-black tracking-tight mb-2">
                  Image · video · loop.
                </h3>
                <p className="text-xs text-label leading-relaxed">
                  Single-frame png, full animation video, or seamless loops. Any
                  aspect: 9:16, 1:1, 4:5.
                </p>
              </div>
            </article>
          </Reveal>

          {/* Backend */}
          <Reveal className="md:col-span-2" delay={ 400 }>
            <article className="h-full p-5 sm:p-6 rounded-md border border-border bg-background flex flex-col justify-between">
              <div className="flex items-start justify-between gap-4">
                <SpecLabel index="F.06" label="queue" />
                <Plus className="w-4 h-4 text-foreground/40 rotate-45" strokeWidth={ 1.5 } />
              </div>
              <div>
                <h3 className="text-lg sm:text-xl font-black tracking-tight mb-2">
                  Headless rendering.
                </h3>
                <p className="text-xs text-label leading-relaxed">
                  Offload long renders to a playwright + bullmq queue. Keep
                  working while the server cooks.
                </p>
              </div>
            </article>
          </Reveal>
        </div>
      </section>

      {/* ============ WORKFLOW (editorial numbered list) ============ */}
      <section className="relative px-4 sm:px-8 lg:px-12 py-20 sm:py-28 max-w-[1440px] mx-auto">
        <Reveal>
          <div className="grid grid-cols-12 gap-6 mb-6 sm:mb-10">
            <div className="col-span-12 md:col-span-2">
              <SpecLabel index="03" label="/workflow" />
            </div>
            <div className="col-span-12 md:col-span-10">
              <h2 className="font-black text-3xl sm:text-5xl lg:text-7xl tracking-tighter leading-[0.95] [text-wrap:balance]">
                Three steps,{ " " }
                <span className="italic font-extralight">
                  uncountable outputs
                </span>
                .
              </h2>
            </div>
          </div>
        </Reveal>

        <div className="border-t border-border">
          {[
            {
              n: "01",
              icon: Slash,
              title: "Pick a template",
              text: "Scroll the gallery, hover for an animated preview, click to open the editor.",
              accent: false
            },
            {
              n: "02",
              icon: MousePointer2,
              title: "Tune the parameters",
              text: "Sliders, colors, copy, images. Every change re-renders on the canvas instantly. Hit randomize when you need a jolt.",
              accent: true
            },
            {
              n: "03",
              icon: Radio,
              title: "Export or record",
              text: "Save a still frame as image, or record the full animation to mp4 / webm. Pixel-perfect at any aspect.",
              accent: false
            }
          ].map( (
            step, i
          ) => (
            <Reveal key={ step.n } delay={ i * 120 }>
              <div className="grid grid-cols-12 gap-4 sm:gap-8 py-8 sm:py-14 border-b border-border group">
                <div className="col-span-3 md:col-span-2 flex flex-col gap-2">
                  <span
                    className={ `font-mono text-xs uppercase tracking-[0.2em] tabular-nums ${
                      step.accent ? "text-fuchsia-500" : "text-label"
                    }` }
                  >
                    step {step.n}
                  </span>
                  <step.icon
                    className={ `w-5 h-5 ${
                      step.accent ? "text-fuchsia-500" : "text-foreground/50"
                    }` }
                    strokeWidth={ 1.5 }
                  />
                </div>
                <div className="col-span-9 md:col-span-7">
                  <h3 className="font-black text-2xl sm:text-4xl lg:text-6xl tracking-tighter leading-[1] [text-wrap:balance]">
                    {step.title}
                    {step.accent ? (
                      <span className="text-fuchsia-500">.</span>
                    ) : null}
                  </h3>
                  <p className="mt-4 sm:mt-6 text-sm sm:text-base text-label max-w-[55ch] leading-relaxed">
                    {step.text}
                  </p>
                </div>
                <div className="hidden md:flex md:col-span-3 items-start justify-end">
                  <span className="font-black text-[6rem] lg:text-[9rem] leading-[0.8] tabular-nums text-foreground/[0.06] group-hover:text-foreground/[0.12] transition-colors select-none">
                    {step.n}
                  </span>
                </div>
              </div>
            </Reveal>
          ) )}
        </div>
      </section>

      {/* ============ FINAL CTA ============ */}
      <section className="relative px-4 sm:px-8 lg:px-12 py-24 sm:py-40 max-w-[1440px] mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10 lg:gap-16 items-center">
          <Reveal className="md:col-span-7 lg:col-span-8">
            <SpecLabel index="04" label="/open" />
            <h2 className="mt-6 sm:mt-8 font-black text-[3rem] sm:text-[5.5rem] md:text-[7rem] lg:text-[10rem] leading-[0.84] tracking-[-0.045em] [text-wrap:balance]">
              start
              <br />
              <span className="italic font-extralight">making</span>
              <br />
              things<span className="text-fuchsia-500">.</span>
            </h2>
            <p className="mt-8 sm:mt-10 max-w-[55ch] text-base sm:text-lg text-label leading-relaxed">
              <span className="font-mono tabular-nums text-foreground">
                {totalTemplates}
              </span>{ " " }
              templates ready to customize, record, and export. No signup, no
              upload, no install — everything runs in your browser.
            </p>
            <div className="mt-8 sm:mt-10 flex flex-col sm:flex-row gap-4 items-start sm:items-center">
              <Link
                href="/templates"
                className="group inline-flex items-center justify-between gap-4 rounded-full bg-foreground text-background pl-7 pr-3 py-4 text-base font-semibold hover:scale-[1.02] active:scale-[0.98] transition-transform"
              >
                <span>Browse all templates</span>
                <span className="grid place-items-center w-10 h-10 rounded-full bg-background/15 group-hover:bg-background/25 transition-colors">
                  <ArrowUpRight className="w-5 h-5 transition-transform group-hover:rotate-[20deg]" />
                </span>
              </Link>
            </div>
          </Reveal>

          {heroFront ? (
            <Reveal className="md:col-span-5 lg:col-span-4" delay={ 200 }>
              <Link
                href={ heroFront.href }
                className="relative block aspect-[4/5] w-full max-w-[360px] mx-auto md:mx-0 group"
              >
                <div className="absolute inset-0 rounded-md overflow-hidden border border-foreground/15 bg-background">
                  <PreviewSurface template={ heroFront } />
                </div>
                <div className="absolute -top-3 left-2 right-2 flex justify-between font-mono text-[10px] uppercase tracking-[0.16em] text-label">
                  <span className="bg-background px-1 border">featured</span>
                  <span className="bg-background px-1 truncate max-w-[55%] border">
                    {heroFront.name}
                  </span>
                </div>
              </Link>
            </Reveal>
          ) : null}
        </div>
      </section>

      <ScrollToTopButton />
    </div>
  );
}

function ShowcaseTile( {
  template,
  index,
  aspect,
  size = "sm"
}: {
  template: TemplateItem;
  index: string;
  aspect: string;
  size?: "sm" | "lg";
} ) {
  return (
    <Link
      href={ template.href }
      className={ `group flex flex-col w-full ${ aspect } rounded-md overflow-hidden border border-border bg-background hover:border-foreground/40 transition-all duration-300 hover:-translate-y-0.5` }
    >
      <div className="relative flex-1 overflow-hidden">
        <PreviewSurface
          template={ template }
          imgClassName="w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
        />
        <div className="absolute inset-x-0 top-0 p-3 sm:p-4 flex items-start justify-between gap-2 z-10">
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-background bg-foreground/80 backdrop-blur-sm px-1.5 py-0.5 rounded-sm">
            {index}
          </span>
          <ArrowUpRight className="w-4 h-4 text-background bg-foreground/80 rounded-sm p-0.5 opacity-0 group-hover:opacity-100 -translate-y-1 group-hover:translate-y-0 transition-all" />
        </div>
      </div>
      <div className="flex-shrink-0 bg-background border-t border-border px-3 sm:px-4 py-2">
        <p
          title={ template.name }
          className={ `font-medium tracking-tight text-foreground truncate ${
            size === "lg" ? "text-sm sm:text-base" : "text-xs sm:text-sm"
          }` }
        >
          {template.name}
        </p>
      </div>
    </Link>
  );
}
