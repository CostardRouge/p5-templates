import options, {
  syncEffectivePrevious
} from "../options.js";
import events from "../events.js";
import sketch, {
  getContainer, getP5
} from "../sketch.js";

import drawSlideVisual from "./common/drawSlideVisual.js";
import drawSlideMeta from "./common/drawSlideMeta.js";
import drawSlideSpecs from "./common/drawSlideSpecs.js";
import drawHudElement from "./common/drawHudElement.js";
import drawSlideText from "./common/drawSlideText.js";
import drawSlideTitle from "./common/drawSlideTitle.js";
import drawSlideImage from "./common/drawSlideImage.js";
import drawSlideImages from "./common/drawSlideImages.js";
import drawSlideBackground from "./common/drawSlideBackground.js";
import drawSlideImagesStack from "./common/drawSlideImagesStack.js";
import drawSlideQrCode from "./common/drawSlideQrCode.js";
import drawSlideBreakdown from "./common/drawSlideBreakdown.js";

import getMontageSketch from "./morph/index.js";
import getBreakdownSketch, {
  findActiveBreakdownItem
} from "./breakdown/index.js";
import animation from "../animation.js";
import drawMontageDip from "./morph/drawMontageDip.js";
import drawMontageSound from "./morph/drawMontageSound.js";
import drawMontageTitle from "./montageTitle/index.js";

import {
  registerContentDrag,
  resolveDraggedItem,
  slideContentScope,
  GLOBAL_CONTENT_SCOPE,
  MONTAGE_TITLE_INDEX
} from "./contentDrag.js";

import {
  beginItemBounds,
  endItemBounds
} from "./common/itemBoundsRegistry.js";

import {
  coerceFramerate
} from "../framerate.js";

import {
  mergeSlideOverride
} from "@/lib/effectiveSlideSettings";

import {
  resolveEffectiveSketch
} from "@/lib/effectiveSketch";

// Safe modulo that wraps negatives too
const wrap = (
  i, n
) => ( ( i % n ) + n ) % n;

const slides = {
  index: 0,

  registerEvents() {
    events.register(
      "pre-draw",
      () => {
        if ( options?.slides && options?.slides.length ) {
          getP5()?.clear();
        }
      }
    );

    events.register(
      "post-draw",
      () => {
        slides.renderCurrentSlide();
        slides.render( options );
        slides.renderMontageOverlay();
        slides.renderMontageTitle();
        slides.updateMontageSound();
      }
    );

    // After the render handler above so the drag layer hit-tests / draws on
    // top of the content items it makes draggable (mouse + touch, engine-wide).
    registerContentDrag();

    events.register(
      "post-draw",
      () => {
        const container = getContainer();
        const canvas = container?.querySelector( "canvas" ) ?? document.querySelector( "canvas.p5Canvas" );

        if ( !canvas ) {
          return;
        }

        if ( !slides.hasSlides ) {
          slides.index = null;
        } else if ( slides.index == null ) {
          // Recover from the add-first-slide race: React calls setSlide(0)
          // before the new slide reaches the option store, so the very next
          // post-draw (store still slide-less) nulled the index. Rendering
          // coerces null→0 so it looks fine, but the effective-settings
          // resolution (per-slide animation/size overrides) stays stuck on
          // the globals until the index is restored.
          slides.setSlide( 0 );
        }

        // dataset values are strings — compare like-for-like or the guard
        // never matches and the attribute is rewritten every frame.
        const datasetIndex = String( slides.index );

        if ( canvas.dataset.slide !== datasetIndex ) {
          canvas.dataset.slide = datasetIndex;
        }
      }
    );
  },

  get count() {
    return Array.isArray( options?.slides ) ? options.slides.length : 0;
  },

  get hasSlides() {
    return this.count > 0;
  },

  get previous() {
    if ( !this.hasSlides ) {
      return undefined;
    }

    return this.getSlide( this.index - 1 );
  },

  get current() {
    if ( !this.hasSlides ) {
      return undefined;
    }

    return this.getSlide( this.index );
  },

  get next() {
    if ( !this.hasSlides ) {
      return undefined;
    }

    return this.getSlide( this.index + 1 );
  },

  getSlide( index = this.index ) {
    const n = this.count;

    if ( !n ) {
      return undefined;
    }

    const idx = wrap(
      Number( index ) || 0,
      n
    ); // ensure number + wrap

    return options.slides[ idx ];
  },

  setSlide( index ) {
    this.index = index;
    this.applyEffectiveSettings();
  },

  /**
   * Apply the effective size/animation for the current slide.
   * Called after switching slides so the engine updates immediately.
   */
  applyEffectiveSettings() {
    const slide = this.current;
    const effectiveSize = mergeSlideOverride(
      options?.size,
      slide?.size
    );
    const effectiveAnimation = mergeSlideOverride(
      options?.animation,
      slide?.animation
    );

    if ( effectiveSize?.width && effectiveSize?.height ) {
      events.handle(
        "engine-resize-canvas",
        effectiveSize.width,
        effectiveSize.height
      );
    }

    // Coerced: a string framerate would pass a bare `> 0` check and then be
    // silently ignored by p5's frameRate(), leaving the loop on the old rate.
    const framerate = coerceFramerate( effectiveAnimation?.framerate );

    if ( framerate !== null ) {
      events.handle(
        "engine-framerate-change",
        framerate
      );
    }

    // The engine clock (animation.progression, the animation bridge,
    // window.get/setAnimationProgression) reads duration from
    // sketch.sketchOptions.animation — not from the option store. Without
    // this write a per-slide duration override would never reach the
    // running sketch: syncEffectivePrevious below updates the comparison
    // baseline, so the next handleOptionsChange wouldn't apply it either.
    if ( effectiveAnimation && sketch.sketchOptions ) {
      sketch.sketchOptions.animation = {
        ...sketch.sketchOptions.animation,
        ...effectiveAnimation
      };
    }

    // Keep previousOptions in options.js in sync so the next
    // handleOptionsChange comparison doesn't re-fire stale events.
    syncEffectivePrevious(
      effectiveSize,
      effectiveAnimation
    );
  },

  // `scope` says which content list is being rendered ("global" or
  // "slide:<n>") so an in-flight on-canvas drag (see contentDrag.js) can
  // substitute the live position of the grabbed item without touching the
  // option store every frame. Each item's render is bracketed with
  // begin/endItemBounds so the renderer's reportItemBounds() call lands on
  // the right (scope, index) — that visible rectangle is what the drag layer
  // hit-tests.
  render(
    source, scope = GLOBAL_CONTENT_SCOPE
  ) {
    // Pass the source straight through. For global content `source` is the
    // live options proxy; destructuring/spreading it would drop every key
    // (its target is empty and it has only a get trap), silently discarding
    // global `content`. `.content` is read below via the get trap instead.
    source?.content?.forEach( (
      rawItem, index
    ) => {
      const item = resolveDraggedItem(
        scope,
        index,
        rawItem
      );

      beginItemBounds(
        scope,
        index
      );

      switch ( item?.type ) {
        case "background":
          drawSlideBackground( item );
          break;
        case "meta":
          drawSlideMeta( item );
          break;
        case "specs":
          drawSlideSpecs( item );
          break;
        case "breakdown":
          drawSlideBreakdown( item );
          break;
        // HUD elements stack in array order like every other item —
        // reordering layers reorders their z-order (the old single "hud"
        // container forced its own internal order; the migration preserves
        // it via insertion order).
        case "hud-badge":
        case "hud-gauge":
        case "hud-sparkline":
        case "hud-counter":
        case "hud-crosshairs":
        case "hud-swatch":
        case "hud-bounding-box":
          drawHudElement( item );
          break;
        case "text":
          drawSlideText( item );
          break;
        case "title":
          drawSlideTitle( item );
          break;
        case "images":
          drawSlideImages(
            item,
            source
          );
          break;
        case "image":
          drawSlideImage(
            item,
            source
          );
          break;
        case "images-stack":
          drawSlideImagesStack(
            item,
            source
          );
          break;
        case "visual":
          drawSlideVisual(
            item,
            source
          );
          break;
        case "qrcode":
          drawSlideQrCode(
            item,
            source
          );
          break;
      }

      endItemBounds();
    } );
  },

  renderCurrentSlide() {
    const slide = this.current;

    if ( !slide ) {
      return;
    }

    // Wrapped like getSlide() so the scope matches what contentDrag targets.
    this.render(
      slide,
      slideContentScope( wrap(
        Number( this.index ) || 0,
        this.count
      ) )
    );
  },

  // Draw the montage "dip" fade on top of everything when the current slide is
  // a dip-style montage. Morph-style montages need no overlay.
  renderMontageOverlay() {
    const slide = this.current;

    if ( slide?.transition?.enabled && slide.transition.style === "dip" ) {
      drawMontageDip(
        slide,
        options?.slides || []
      );
    }
  },

  // Play the montage transition sound: schedules a hit through the sketch
  // audio engine each time the current montage slide advances to a new variant.
  // Paints nothing — polled once per frame so it stays deterministic in
  // captures, like the specs sound-on-change.
  updateMontageSound() {
    const slide = this.current;

    if ( slide?.transition?.enabled && slide.transition.sound?.enabled ) {
      drawMontageSound(
        slide,
        options?.slides || []
      );
    }
  },

  // Draw the variant-title overlay on top of everything (including the dip
  // fade) when the current montage slide opts into it.
  renderMontageTitle() {
    const slide = this.current;

    if ( slide?.transition?.enabled && slide.transition.title?.enabled ) {
      const slideIndex = wrap(
        Number( this.index ) || 0,
        this.count
      );

      // Bracket the overlay so its reported rectangle keys to this slide's
      // montage-title target — the surface the on-canvas drag hit-tests.
      beginItemBounds(
        slideContentScope( slideIndex ),
        MONTAGE_TITLE_INDEX
      );
      drawMontageTitle(
        slide,
        options?.slides || [],
        slideIndex
      );
      endItemBounds();
    }
  },

  /**
   * Get merged sketch settings for the current slide
   * Merges global sketch settings with slide-specific settings
   * Slide settings override global settings
   * @param {object} optionsTarget - The raw options object (to avoid proxy recursion)
   */
  getSketchSettings( optionsTarget ) {
    const globalSketch = optionsTarget?.sketch || {};
    const currentSlide = this.current;

    // Montage slide: morph the OTHER slides' params instead of using this
    // slide's own. Single injection point — the running sketch and any
    // specs/HUD overlay that reads options.sketch both see interpolated values.
    if ( currentSlide?.transition?.enabled ) {
      const montage = getMontageSketch(
        globalSketch,
        currentSlide,
        optionsTarget?.slides || []
      );

      if ( montage ) {
        return montage;
      }
    }

    // Breakdown diff narration: when a "breakdown" content item governs this
    // frame (current slide's content wins over global), return the
    // interpolated in-progress parameters instead of the settled merge —
    // same injection seam as the montage above (which wins on its own
    // slides). Reads raw store arrays only; the orchestrator memoizes.
    const breakdownItem = findActiveBreakdownItem(
      optionsTarget,
      this.index,
      Array.isArray( optionsTarget?.slides ) ? optionsTarget.slides.length : 0
    );

    if ( breakdownItem ) {
      const built = getBreakdownSketch(
        globalSketch,
        currentSlide?.sketch,
        breakdownItem,
        animation.progression
      );

      if ( built ) {
        return built;
      }
    }

    // Non-montage slides use the shared, engine-agnostic per-slide merge (the
    // same resolver GSAP + Three.js go through) so there is a single source of
    // truth for how a slide's overrides layer over the global sketch block.
    return resolveEffectiveSketch(
      optionsTarget,
      this.index
    );
  }
};

// Public helpers used by React
window.setSlide = ( index ) => {
  slides.setSlide( index );
};
window.getSlide = ( index ) => slides.getSlide( index );
window.getCurrentSlide = () => ( {
  slide: slides.current,
  index: slides.index
} );
window.getSketchSettings = ( optionsTarget ) =>
  slides.getSketchSettings( optionsTarget );

window.slides = slides;

export default slides;
