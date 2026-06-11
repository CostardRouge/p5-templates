import {
  CSSProperties, JSX, useEffect, useRef, useState
} from "react";
import {
  useDrag
} from "@use-gesture/react";
import clsx from "clsx";

type CollapsibleItemProps = {
  header: ( expanded: boolean, title: string ) => JSX.Element;
  initialExpandedValue?: boolean;
  children: React.ReactNode;
  className?: string;
  headerContainerClassName?: string;
  /**
   * Applied to the inner wrapper that holds the children. Use it to restore
   * layout (e.g. `flex flex-col gap-1`) when the root previously relied on
   * its own flex gap to space multiple direct children.
   */
  contentClassName?: string;
  style?: CSSProperties;
  expanded?: boolean;
  onToggle?: ( expanded: boolean ) => void;
  /**
   * Enable touch swipe gestures on the header: swipe down to collapse an open
   * panel, swipe up to expand a closed one. Disabled automatically when the
   * user has enabled the prefers-reduced-motion system setting.
   * Mouse/pen input is unaffected — only touch pointers trigger the swipe.
   */
  swipeToCollapse?: boolean;
  /**
   * Keep children mounted while collapsed (hidden via the 0fr grid row +
   * visibility) instead of the default lazy unmount. Use when the content
   * holds state or refs that must survive collapsing (e.g. the capture
   * actions autosave handle in the mobile drawer).
   */
  keepMounted?: boolean;
};

// Keep in sync with the grid-template-rows transition duration below.
const COLLAPSE_TRANSITION_MS = 200;
// Distance (px) a downward swipe must travel to commit a collapse.
const SWIPE_COLLAPSE_THRESHOLD = 56;
// Flick velocity (px/ms) that commits a collapse even on a short swipe.
const SWIPE_COLLAPSE_VELOCITY = 0.35;
// Distance (px) an upward swipe must travel to commit an expand.
const SWIPE_EXPAND_THRESHOLD = 30;
// Flick velocity (px/ms) that commits an expand even on a short swipe.
const SWIPE_EXPAND_VELOCITY = 0.3;

const CollapsibleItem = ( {
  header,
  children,
  className,
  headerContainerClassName,
  contentClassName,
  style,
  initialExpandedValue = true,
  expanded: controlledExpanded,
  onToggle,
  swipeToCollapse = false,
  keepMounted = false
}: CollapsibleItemProps ) => {
  const [
    internalExpanded,
    setInternalExpanded
  ] = useState( initialExpandedValue );

  const isControlled = controlledExpanded !== undefined;
  const expanded = isControlled ? controlledExpanded : internalExpanded;

  const setExpanded = ( next: boolean ) => {
    if ( isControlled ) {
      onToggle?.( next );
    } else {
      setInternalExpanded( next );
    }
  };

  const handleToggle = () => {
    setExpanded( !expanded );
  };

  // Detect prefers-reduced-motion to disable animations and swipe gestures.
  const [
    prefersReducedMotion,
    setPrefersReducedMotion
  ] = useState( false );

  useEffect(
    () => {
      const mq = window.matchMedia( "(prefers-reduced-motion: reduce)" );

      setPrefersReducedMotion( mq.matches );
      const handler = ( e: MediaQueryListEvent ) => setPrefersReducedMotion( e.matches );

      mq.addEventListener(
        "change",
        handler
      );

      return () => mq.removeEventListener(
        "change",
        handler
      );
    },
    []
  );

  // `render` keeps children in the DOM while open and during the closing
  // animation, then unmounts them — preserving the original lazy behaviour
  // where collapsed sections were never rendered. `gridOpen` drives the
  // grid-template-rows transition and only flips true after children have
  // been painted at 0fr, so the open animation reliably interpolates.
  const [
    render,
    setRender
  ] = useState( expanded );
  const [
    gridOpen,
    setGridOpen
  ] = useState( expanded );
  // True only while fully open and settled. Drives overflow: we clip during
  // the open/close animation, then release to natural overflow so nested
  // scroll containers keep working when the panel exceeds its max-height.
  const [
    settledOpen,
    setSettledOpen
  ] = useState( expanded );

  // Mount children as soon as we start expanding.
  useEffect(
    () => {
      if ( expanded ) {
        setRender( true );
      } else {
        setSettledOpen( false );
      }
    },
    [
      expanded
    ]
  );

  // Flip the grid open once children are mounted (and painted at 0fr); flip
  // it closed immediately when collapsing.
  useEffect(
    () => {
      if ( expanded && render ) {
        setGridOpen( true );
      } else if ( !expanded ) {
        setGridOpen( false );
      }
    },
    [
      expanded,
      render
    ]
  );

  // Fallback in case the transitionend event doesn't fire (unmount on close,
  // release overflow on open).
  useEffect(
    () => {
      if ( !expanded && render ) {
        const timer = setTimeout(
          () => setRender( false ),
          COLLAPSE_TRANSITION_MS + 50
        );

        return () => clearTimeout( timer );
      }

      if ( expanded && gridOpen && !settledOpen ) {
        const timer = setTimeout(
          () => setSettledOpen( true ),
          COLLAPSE_TRANSITION_MS + 50
        );

        return () => clearTimeout( timer );
      }
    },
    [
      expanded,
      render,
      gridOpen,
      settledOpen
    ]
  );

  const handleTransitionEnd = ( event: React.TransitionEvent<HTMLDivElement> ) => {
    // Ignore transitions bubbling up from nested collapsibles / children.
    if ( event.target !== event.currentTarget ) {
      return;
    }

    if ( event.propertyName !== "grid-template-rows" ) {
      return;
    }

    if ( expanded ) {
      setSettledOpen( true );
    } else {
      setRender( false );
    }
  };

  // --- Swipe gestures (touch only) ----------------------------------------
  const [
    dragY,
    setDragY
  ] = useState( 0 );
  // Suppresses the synthetic click that follows a real swipe, so the gesture
  // doesn't immediately re-toggle the panel via the header onClick.
  const suppressClickRef = useRef( false );

  // Gestures are disabled when the user prefers reduced motion.
  const gesturesEnabled = swipeToCollapse && !prefersReducedMotion;

  const bindSwipe = useDrag(
    ( state ) => {
      const {
        last, tap, movement: [
          , my
        ], velocity: [
          , vy
        ], direction: [
          , dy
        ], event
      } = state;

      const pointerType = ( event as PointerEvent )?.pointerType;

      if ( pointerType && pointerType !== "touch" ) {
        return;
      }

      if ( expanded ) {
        // Swipe down to collapse.
        const down = Math.max(
          0,
          my
        );

        if ( !last ) {
          setDragY( down );

          return;
        }

        setDragY( 0 );

        if ( !tap ) {
          suppressClickRef.current = true;
        }

        const shouldCollapse =
          down > SWIPE_COLLAPSE_THRESHOLD ||
          ( dy > 0 && vy > SWIPE_COLLAPSE_VELOCITY );

        if ( shouldCollapse ) {
          setExpanded( false );
        }
      } else {
        // Swipe up to expand.
        if ( !last ) {
          return;
        }

        if ( !tap ) {
          // Suppress the pointer-up click so it doesn't immediately re-collapse.
          suppressClickRef.current = true;
        }

        const up = Math.max(
          0,
          -my
        );
        const shouldExpand =
          up > SWIPE_EXPAND_THRESHOLD ||
          ( dy < 0 && vy > SWIPE_EXPAND_VELOCITY );

        if ( shouldExpand ) {
          setExpanded( true );
        }
      }
    },
    {
      enabled: gesturesEnabled,
      axis: "y",
      filterTaps: true,
      pointer: {
        touch: true
      },
      from: () => [
        0,
        0
      ]
    }
  );

  const handleHeaderClick = () => {
    if ( suppressClickRef.current ) {
      suppressClickRef.current = false;

      return;
    }

    handleToggle();
  };

  const isDragging = dragY > 0;

  return (
    <div
      className={ className }
      style={ {
        ...style,
        transform: isDragging ? `translateY(${ dragY }px)` : undefined,
        transition: isDragging || prefersReducedMotion ? "none" : "transform 0.15s ease-out"
      } }
    >
      <div
        className={ headerContainerClassName }
        onClick={ handleHeaderClick }
        style={ gesturesEnabled ? {
          touchAction: "pan-x"
        } : undefined }
        { ...( gesturesEnabled ? bindSwipe() : {} ) }
      >
        {header(
          expanded,
          expanded ? "click to collapse" : "click to expand"
        )}
      </div>

      <div
        className="grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none"
        style={ {
          gridTemplateRows: gridOpen ? "1fr" : "0fr"
        } }
        aria-hidden={ !expanded }
        onTransitionEnd={ handleTransitionEnd }
      >
        <div
          className={ clsx(
            // min-w-0 matters as much as min-h-0: grid items default to
            // min-width auto, letting wide content (long select labels…)
            // stretch the panel instead of truncating.
            "min-h-0 min-w-0 transition-opacity duration-150 ease-out motion-reduce:transition-none",
            settledOpen ? "overflow-visible" : "overflow-hidden",
            gridOpen ? "opacity-100" : "opacity-0",
            // Kept-mounted content must also drop out of the focus order
            // while collapsed.
            keepMounted && !gridOpen && "invisible",
            contentClassName
          ) }
        >
          {render || keepMounted ? children : null}
        </div>
      </div>
    </div>
  );
};

export default CollapsibleItem;
