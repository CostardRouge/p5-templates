"use client";

import Link from "next/link";
import {
  useEffect, useMemo, useRef, useState
} from "react";
import {
  ArrowRight,
  Code2,
  Film,
  Image as ImageIcon,
  Layers,
  Palette,
  Shuffle,
  Sliders,
  Sparkles,
  Wand2,
  Zap
} from "lucide-react";
import AnimatedPreview from "@/components/AnimatedPreview";
import type {
  TemplateItem
} from "@/app/templates/getTemplatesData";

type HomePageProps = {
  templates: TemplateItem[];
  engineLabels: Record<string, string>;
  totalTemplates: number;
};

const FEATURES = [
  {
    icon: Sliders,
    title: "Live editing",
    text: "Tweak template options in a side panel and watch the canvas update in real time. Every parameter, every frame.",
    gradient: "from-fuchsia-500 to-pink-500"
  },
  {
    icon: Layers,
    title: "Multi-engine",
    text: "p5.js sketches, GSAP DOM animations, and pure HTML stages share the same recorder, exporter, and form system.",
    gradient: "from-violet-500 to-indigo-500"
  },
  {
    icon: Film,
    title: "Front-end recording",
    text: "Capture frames directly from your browser into MP4 or WebM. No external tools, no screen recording, no quality loss.",
    gradient: "from-sky-500 to-cyan-400"
  },
  {
    icon: ImageIcon,
    title: "Image & video export",
    text: "Save a single frame as PNG or a full animation as video. Pixel-perfect at any aspect ratio for Instagram, TikTok, Reels.",
    gradient: "from-emerald-500 to-teal-400"
  },
  {
    icon: Zap,
    title: "Headless backend rendering",
    text: "Offload long renders to a Playwright + BullMQ queue. Templates render server-side while you keep working.",
    gradient: "from-amber-500 to-orange-500"
  },
  {
    icon: Sparkles,
    title: "Animated previews",
    text: "Every template ships with a generated WebM that plays on hover or scroll — no guessing what a sketch looks like.",
    gradient: "from-rose-500 to-red-500"
  },
  {
    icon: Wand2,
    title: "Magic forms",
    text: "Each sketch exposes a custom options form. Sliders, color pickers, drop-zones, presets — generated per template.",
    gradient: "from-lime-500 to-green-500"
  },
  {
    icon: Shuffle,
    title: "Randomize settings",
    text: "One click rerolls every option to a valid random value. The fastest way to discover a variation you didn't plan.",
    gradient: "from-purple-500 to-blue-500"
  }
];

const MARQUEE_WORDS = [
  "p5.js",
  "GSAP",
  "HTML",
  "Record",
  "Export",
  "Animate",
  "Preview",
  "Randomize",
  "Customize",
  "Render",
  "MP4",
  "WebM",
  "Instagram",
  "TikTok",
  "Reels",
  "Generative"
];

const MARQUEE_HUES = [
  "text-fuchsia-500",
  "text-amber-500",
  "text-sky-500",
  "text-emerald-500",
  "text-rose-500",
  "text-violet-500",
  "text-cyan-500",
  "text-orange-500"
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

  return (
    <div className="relative w-full overflow-x-hidden">
      {/* Animated background blobs */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] h-[40rem] w-[40rem] rounded-full bg-fuchsia-500/20 blur-3xl animate-blob" />
        <div
          className="absolute top-[20%] right-[-15%] h-[36rem] w-[36rem] rounded-full bg-sky-500/20 blur-3xl animate-blob"
          style={ {
            animationDelay: "4s"
          } }
        />
        <div
          className="absolute bottom-[-10%] left-[30%] h-[42rem] w-[42rem] rounded-full bg-amber-400/20 blur-3xl animate-blob"
          style={ {
            animationDelay: "8s"
          } }
        />
      </div>

      {/* ───── HERO ───── */}
      <section className="relative px-4 sm:px-8 pt-16 sm:pt-24 pb-12 sm:pb-20 max-w-6xl mx-auto">
        <div className="flex flex-col items-center text-center gap-6 sm:gap-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background/60 backdrop-blur px-4 py-1.5 text-xs sm:text-sm text-label animate-slideInFromTop">
            <Sparkles className="w-3.5 h-3.5 text-fuchsia-500" />
            <span>{totalTemplates} templates · {engineNames.join( " · " )}</span>
          </div>

          <h1 className="text-5xl sm:text-7xl md:text-8xl font-black leading-[0.95] tracking-tight">
            <span className="block">Code</span>
            <span
              className="block bg-clip-text text-transparent bg-[linear-gradient(90deg,#ec4899,#f59e0b,#10b981,#06b6d4,#8b5cf6,#ec4899)] bg-[length:300%_300%] animate-gradient-shift"
            >
              social visuals.
            </span>
            <span className="block">Render. Repeat.</span>
          </h1>

          <p className="max-w-2xl text-base sm:text-lg text-label leading-relaxed">
            A studio for generating Instagram, TikTok, and Reels content from
            customizable <strong className="text-foreground">p5.js</strong>,{ " " }
            <strong className="text-foreground">GSAP</strong>, and{ " " }
            <strong className="text-foreground">HTML</strong> templates. Tweak
            options in a live editor, then export images or record full
            animations to video — all from the browser.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mt-2">
            <Link
              href="/templates"
              className="group inline-flex items-center justify-center gap-2 rounded-2xl bg-foreground text-background px-6 py-3 sm:px-8 sm:py-4 text-sm sm:text-base font-semibold hover:scale-[1.02] active:scale-[0.98] transition-transform shadow-lg shadow-foreground/10"
            >
              <span>Browse {totalTemplates} templates</span>
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <a
              href="#features"
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-border bg-background/60 backdrop-blur px-6 py-3 sm:px-8 sm:py-4 text-sm sm:text-base font-semibold hover:bg-hover/60 transition-colors"
            >
              See features
            </a>
          </div>
        </div>
      </section>

      {/* ───── MARQUEE BAND ───── */}
      <section className="py-6 sm:py-8 border-y border-border bg-background/40 backdrop-blur-sm overflow-hidden">
        <div className="flex w-max animate-marquee gap-8 sm:gap-12 will-change-transform">
          {[
            ...MARQUEE_WORDS,
            ...MARQUEE_WORDS
          ].map( (
            word, i
          ) => (
            <span
              key={ `${ word }-${ i }` }
              className={ `text-3xl sm:text-5xl font-black uppercase tracking-tight whitespace-nowrap ${
                MARQUEE_HUES[ i % MARQUEE_HUES.length ]
              }` }
            >
              {word}
              <span className="text-foreground/30 ml-8 sm:ml-12">●</span>
            </span>
          ) )}
        </div>
      </section>

      {/* ───── FEATURED SHOWCASE ───── */}
      <section className="px-4 sm:px-8 py-16 sm:py-24 max-w-7xl mx-auto">
        <Reveal>
          <div className="flex items-end justify-between gap-4 mb-8 sm:mb-12 flex-wrap">
            <div>
              <div className="text-xs sm:text-sm uppercase tracking-widest text-fuchsia-500 font-bold mb-2">
                Featured
              </div>
              <h2 className="text-3xl sm:text-5xl font-black tracking-tight">
                A random{ " " }
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-fuchsia-500 to-amber-500">
                  pick
                </span>{ " " }
                from the library.
              </h2>
              <p className="mt-3 text-sm sm:text-base text-label max-w-xl">
                Reshuffled on every visit. Click any preview to open the editor
                and start exporting.
              </p>
            </div>
            <Link
              href="/templates"
              className="hidden sm:inline-flex items-center gap-2 text-sm font-semibold hover:text-fuchsia-500 transition-colors"
            >
              View all <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </Reveal>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          {showcase.map( (
            t, i
          ) => (
            <Reveal key={ t.href } delay={ i * 60 }>
              <Link
                href={ t.href }
                className="group relative block w-full bg-background rounded-xl sm:rounded-2xl overflow-hidden border border-border hover:border-foreground/30 transition-all duration-300 hover:shadow-xl hover:shadow-fuchsia-500/10 hover:-translate-y-1"
              >
                <div
                  className="w-full relative"
                  style={ {
                    paddingTop: "125%"
                  } }
                >
                  {t.preview ? (
                    <AnimatedPreview
                      previewUrl={ t.preview }
                      thumbnailUrl={ t.thumbnail }
                      name={ t.name }
                      imgClassName="w-full h-full object-contain transition-transform duration-500 group-hover:scale-[1.03]"
                    />
                  ) : (
                    <img
                      alt={ t.name }
                      src={ t.thumbnail }
                      loading="lazy"
                      className="absolute top-0 left-0 w-full h-full object-contain transition-transform duration-500 group-hover:scale-[1.03]"
                    />
                  )}
                </div>
                <div className="bg-background border-t border-border px-2 py-2 flex items-center justify-between">
                  <p className="text-xs sm:text-sm font-medium text-foreground truncate">
                    {t.name}
                  </p>
                  <ArrowRight className="w-3.5 h-3.5 text-foreground/40 group-hover:text-fuchsia-500 group-hover:translate-x-0.5 transition-all flex-shrink-0" />
                </div>
              </Link>
            </Reveal>
          ) )}
        </div>

        <Reveal className="sm:hidden mt-8 text-center">
          <Link
            href="/templates"
            className="inline-flex items-center gap-2 text-sm font-semibold"
          >
            View all templates <ArrowRight className="w-4 h-4" />
          </Link>
        </Reveal>
      </section>

      {/* ───── FEATURES ───── */}
      <section
        id="features"
        className="relative px-4 sm:px-8 py-16 sm:py-24 max-w-7xl mx-auto"
      >
        <Reveal>
          <div className="text-center mb-12 sm:mb-16">
            <div className="text-xs sm:text-sm uppercase tracking-widest text-sky-500 font-bold mb-2">
              What it does
            </div>
            <h2 className="text-3xl sm:text-5xl font-black tracking-tight">
              Every piece of the{ " " }
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-sky-500 via-violet-500 to-fuchsia-500">
                pipeline
              </span>
              , in one place.
            </h2>
          </div>
        </Reveal>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
          {FEATURES.map( (
            feature, i
          ) => (
            <Reveal key={ feature.title } delay={ i * 80 }>
              <div className="group relative h-full p-5 sm:p-6 rounded-2xl border border-border bg-background/60 backdrop-blur hover:border-foreground/30 hover:-translate-y-1 transition-all duration-300 overflow-hidden">
                <div
                  className={ `absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity duration-500 bg-gradient-to-br ${ feature.gradient }` }
                />
                <div
                  className={ `inline-flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br ${ feature.gradient } text-white mb-4 shadow-lg` }
                >
                  <feature.icon className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <h3 className="text-base sm:text-lg font-bold mb-2">
                  {feature.title}
                </h3>
                <p className="text-sm text-label leading-relaxed">
                  {feature.text}
                </p>
              </div>
            </Reveal>
          ) )}
        </div>
      </section>

      {/* ───── HOW IT WORKS ───── */}
      <section className="px-4 sm:px-8 py-16 sm:py-24 max-w-6xl mx-auto">
        <Reveal>
          <div className="text-center mb-12 sm:mb-16">
            <div className="text-xs sm:text-sm uppercase tracking-widest text-emerald-500 font-bold mb-2">
              Workflow
            </div>
            <h2 className="text-3xl sm:text-5xl font-black tracking-tight">
              Three steps,{ " " }
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-500 to-cyan-500">
                infinite output
              </span>
              .
            </h2>
          </div>
        </Reveal>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-8">
          {[
            {
              n: "01",
              icon: Palette,
              title: "Pick a template",
              text: "Browse the gallery, hover for an animated preview, click to open.",
              color: "from-fuchsia-500 to-rose-500"
            },
            {
              n: "02",
              icon: Sliders,
              title: "Customize options",
              text: "Sliders, colors, text, images. Every change reflects on the canvas instantly.",
              color: "from-amber-500 to-orange-500"
            },
            {
              n: "03",
              icon: Film,
              title: "Export or record",
              text: "Save a still frame as image. Or hit record and capture the full animation to video.",
              color: "from-sky-500 to-violet-500"
            }
          ].map( (
            step, i
          ) => (
            <Reveal key={ step.n } delay={ i * 120 }>
              <div className="relative h-full p-6 sm:p-8 rounded-2xl border border-border bg-background/60 backdrop-blur">
                <div
                  className={ `text-5xl sm:text-6xl font-black bg-clip-text text-transparent bg-gradient-to-br ${ step.color } leading-none mb-4` }
                >
                  {step.n}
                </div>
                <step.icon className="w-6 h-6 mb-3 text-foreground" />
                <h3 className="text-lg sm:text-xl font-bold mb-2">
                  {step.title}
                </h3>
                <p className="text-sm text-label leading-relaxed">{step.text}</p>
              </div>
            </Reveal>
          ) )}
        </div>
      </section>

      {/* ───── REVERSE MARQUEE ───── */}
      <section className="py-4 sm:py-6 border-y border-border overflow-hidden bg-background/40">
        <div className="flex w-max animate-marquee-reverse gap-8 sm:gap-12 will-change-transform">
          {[
            ...MARQUEE_WORDS.slice().reverse(),
            ...MARQUEE_WORDS.slice().reverse()
          ].map( (
            word, i
          ) => (
            <span
              key={ `r-${ word }-${ i }` }
              className="text-2xl sm:text-4xl font-black uppercase tracking-tight whitespace-nowrap text-foreground/20"
            >
              {word}
              <span className="text-foreground/10 ml-8 sm:ml-12">●</span>
            </span>
          ) )}
        </div>
      </section>

      {/* ───── FINAL CTA ───── */}
      <section className="px-4 sm:px-8 py-20 sm:py-32 max-w-4xl mx-auto text-center">
        <Reveal>
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background/60 backdrop-blur px-4 py-1.5 text-xs text-label mb-6">
            <Code2 className="w-3.5 h-3.5 text-fuchsia-500" />
            <span>Open the gallery</span>
          </div>
          <h2 className="text-4xl sm:text-6xl md:text-7xl font-black tracking-tight leading-[0.95] mb-6">
            Start{ " " }
            <span className="bg-clip-text text-transparent bg-[linear-gradient(90deg,#ec4899,#f59e0b,#06b6d4,#8b5cf6)] bg-[length:300%_300%] animate-gradient-shift">
              creating
            </span>
            .
          </h2>
          <p className="text-base sm:text-lg text-label mb-8 max-w-xl mx-auto">
            {totalTemplates} templates ready to customize, record, and export.
            No signup. No upload. Everything renders in your browser.
          </p>
          <Link
            href="/templates"
            className="group inline-flex items-center justify-center gap-2 rounded-2xl bg-foreground text-background px-8 py-4 sm:px-10 sm:py-5 text-base sm:text-lg font-semibold hover:scale-[1.02] active:scale-[0.98] transition-transform shadow-xl shadow-foreground/10"
          >
            <span>Browse all templates</span>
            <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
          </Link>
        </Reveal>
      </section>
    </div>
  );
}
