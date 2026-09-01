import {
  STUDIO_FEATURES, STUDIO_OVERVIEW_CAPTURE, type FeatureCapture, type StudioFeature
} from "./features";

/**
 * The home page's detailed studio tour: one section per surface of the sketch
 * page, each with a real screenshot of it.
 *
 * A **server** component on purpose — the whole tour is static prose and
 * `<img>` tags, so it ships in the first HTML response (crawlable, readable
 * with JavaScript off) and adds nothing to the client bundle. It is handed to
 * `HomePage` as a prop rather than imported by it, because `HomePage` is a
 * client component and would otherwise drag this into the browser.
 *
 * Captures are 2× assets rendered at their natural CSS size, capped by height
 * so a tall panel does not turn into a screenful of scrolling on a phone.
 * `width` / `height` are always set: the aspect ratio is reserved before the
 * image arrives, so nothing below it moves.
 */

const CAPTION_CLASS =
  "px-3 py-2 text-[11px] sm:text-xs leading-relaxed text-label border-t border-border";

function Capture( {
  capture,
  className = ""
}: {
  capture: FeatureCapture;
  className?: string;
} ) {
  return (
    <figure
      className={ `overflow-hidden rounded-xl sm:rounded-2xl border border-border bg-background ${ className }` }
    >
      {/* Every capture is of the studio's dark theme, so the mat behind it is
          dark in both themes — on a light page a dark screenshot dropped
          straight onto white reads as a hole rather than as a framed picture.
          `mx-auto` on a block child centres the picture while it fits and
          pins it to the left once it overflows, which a centred flex row does
          not: there the overflowing start is clipped and unreachable. */}
      <div
        className={ `bg-[#0b0b0b] p-2 sm:p-3 ${
          capture.scrollOnNarrow ? "overflow-x-auto" : ""
        }` }
        // A scroll container with nothing focusable inside cannot be reached
        // by keyboard, so it gets a tab stop and a name of its own.
        { ...( capture.scrollOnNarrow
          ? {
            tabIndex: 0,
            role: "group",
            "aria-label": `${ capture.caption } (scroll sideways to see all of it)`
          }
          : {} ) }
      >
        <img
          src={ capture.src }
          alt={ capture.alt }
          width={ capture.width }
          height={ capture.height }
          loading="lazy"
          decoding="async"
          data-pin-nopin="true"
          // No height cap on a phone: the column is already narrow enough to
          // bound the picture, and capping the height there shrinks a UI panel
          // past the point where its labels can be read. On wider screens the
          // cap is what stops a tall inspector from taking the whole viewport.
          //
          // A text-dense capture keeps its natural width on a narrow screen and
          // scrolls sideways instead — shrinking a table of 11px mono values to
          // a third of its size leaves a picture of a table, not a table.
          className={ `mx-auto block h-auto w-auto max-h-none sm:max-h-[70svh] rounded-md ${
            capture.scrollOnNarrow ? "max-w-none sm:max-w-full" : ""
          }` }
          style={ capture.scrollOnNarrow
            ? {
              width: capture.width / 2
            }
            : {
              // Both dimensions stay `auto` and both maxima are set, which is
              // the one combination browsers resolve by scaling a replaced
              // element down while keeping its ratio. Pinning `width` instead
              // lets `max-height` squash the picture.
              //
              // The asset is 2×: half of it is the size the panel really is on
              // screen, and blowing it up past that would only soften it.
              maxWidth: `min(100%, ${ capture.width / 2 }px)`
            } }
        />
      </div>
      <figcaption className={ CAPTION_CLASS }>{ capture.caption }</figcaption>
    </figure>
  );
}

function FeatureBlock( {
  feature,
  index
}: {
  feature: StudioFeature;
  index: number;
} ) {
  const headingId = `${ feature.id }-title`;
  const prose = (
    <div className="min-w-0">
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-label mb-2">
        <span className="tabular-nums">
          { String( index + 1 ).padStart(
            2,
            "0"
          ) }
        </span>
        <span aria-hidden className="mx-2 text-fuchsia-500">
          ·
        </span>
        { feature.eyebrow }
      </p>

      <h3
        id={ headingId }
        className="text-lg sm:text-2xl font-black tracking-tight [text-wrap:balance]"
      >
        { feature.title }
      </h3>

      <p className="mt-3 text-sm sm:text-base text-label leading-relaxed [text-wrap:pretty]">
        { feature.summary }
      </p>

      <ul className="mt-4 space-y-2 list-disc list-outside pl-4 marker:text-fuchsia-500">
        { feature.points.map( ( point ) => (
          <li
            key={ point }
            className="text-xs sm:text-sm text-label leading-relaxed [text-wrap:pretty]"
          >
            { point }
          </li>
        ) ) }
      </ul>
    </div>
  );

  if ( feature.layout === "wide" ) {
    return (
      <article
        id={ feature.id }
        aria-labelledby={ headingId }
        className="scroll-mt-24 border-t border-border pt-8 sm:pt-12"
      >
        { prose }
        <Capture capture={ feature.capture } className="mt-6" />
      </article>
    );
  }

  // Alternate which side the picture sits on so the tour keeps a rhythm. Only
  // the visual order flips — the prose always comes first in the markup, so
  // reading and tab order are unaffected.
  const pictureFirst = index % 2 === 1;

  return (
    <article
      id={ feature.id }
      aria-labelledby={ headingId }
      className="scroll-mt-24 border-t border-border pt-8 sm:pt-12 grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-10 items-start"
    >
      { prose }
      <Capture
        capture={ feature.capture }
        className={ pictureFirst ? "lg:order-first" : "" }
      />
    </article>
  );
}

function jsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Sketchbook studio features",
    description:
      "The surfaces of the Sketchbook sketch editor: parameter controls, live modulation, layers, slides, transitions, export and presentation.",
    itemListElement: STUDIO_FEATURES.map( (
      feature, index
    ) => ( {
      "@type": "ListItem",
      position: index + 1,
      name: feature.title,
      description: feature.summary
    } ) )
  };
}

export default function StudioFeatures() {
  return (
    <section
      id="studio"
      aria-labelledby="studio-heading"
      className="scroll-mt-24 pb-12 sm:pb-16"
    >
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={ {
          __html: JSON.stringify( jsonLd() )
        } }
      />

      <header className="mb-6 sm:mb-8">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-label mb-1.5">
          /studio
        </p>
        <h2
          id="studio-heading"
          className="text-xl sm:text-2xl font-black tracking-tight"
        >
          Inside the studio
        </h2>
        <p className="mt-3 max-w-[68ch] text-sm sm:text-base text-label leading-relaxed [text-wrap:pretty]">
          Open any sketch and you get the same editor: a form generated from the
          sketch&rsquo;s own parameters, a layer stack for everything drawn over
          it, a deck of variants, and an export queue. Nothing below is a mockup
          &mdash; every picture is a screenshot of the running studio.
        </p>
      </header>

      <Capture capture={ STUDIO_OVERVIEW_CAPTURE } />

      <nav aria-label="Studio features" className="mt-6 sm:mt-8">
        <ul className="flex flex-wrap gap-2">
          { STUDIO_FEATURES.map( ( feature ) => (
            <li key={ feature.id }>
              <a
                href={ `#${ feature.id }` }
                className="inline-flex items-center rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-label hover:text-foreground hover:border-foreground/30 hover:bg-hover/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/40 transition-colors"
              >
                { feature.eyebrow }
              </a>
            </li>
          ) ) }
        </ul>
      </nav>

      <div className="mt-10 sm:mt-14 space-y-10 sm:space-y-14">
        { STUDIO_FEATURES.map( (
          feature, index
        ) => (
          <FeatureBlock key={ feature.id } feature={ feature } index={ index } />
        ) ) }
      </div>
    </section>
  );
}
