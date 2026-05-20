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
   * Enable a downward touch swipe on the header to collapse the section.
   * Intended for bottom-anchored floating panels (mobile bottom-sheet feel).
   * Mouse/pen input is unaffected — only touch pointers trigger the swipe.
   */
  swipeToCollapse?: boolean;
};

// Keep in sync with the grid-template-rows transition duration below.
const COLLAPSE_TRANSITION_MS = 300;
// Distance (px) a downward swipe must travel to commit a collapse.
const SWIPE_COLLAPSE_THRESHOLD = 56;
// Flick velocity (px/ms) that commits a collapse even on a short swipe.
const SWIPE_COLLAPSE_VELOCITY = 0.35;

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
  swipeToCollapse = false
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

  // --- Swipe-to-collapse (touch only) -------------------------------------
  const [
    dragY,
    setDragY
  ] = useState( 0 );
  // Suppresses the synthetic click that follows a real swipe, so the gesture
  // doesn't immediately re-toggle the panel via the header onClick.
  const suppressClickRef = useRef( false );

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

      // Only an expanded panel can be swiped away.
      if ( !expanded ) {
        return;
      }

      const down = Math.max(
        0,
        my
      );

      if ( !last ) {
        setDragY( down );

        return;
      }

      // Pointer released.
      setDragY( 0 );

      if ( !tap ) {
        // A real drag occurred — don't let the trailing click re-toggle.
        suppressClickRef.current = true;
      }

      const shouldCollapse =
        down > SWIPE_COLLAPSE_THRESHOLD ||
        ( dy > 0 && vy > SWIPE_COLLAPSE_VELOCITY );

      if ( shouldCollapse ) {
        setExpanded( false );
      }
    },
    {
      enabled: swipeToCollapse,
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
        transition: isDragging ? "none" : "transform 0.25s ease-out"
      } }
    >
      <div
        className={ headerContainerClassName }
        onClick={ handleHeaderClick }
        style={ swipeToCollapse ? {
          touchAction: "pan-x"
        } : undefined }
        { ...( swipeToCollapse ? bindSwipe() : {} ) }
      >
        {header(
          expanded,
          expanded ? "click to collapse" : "click to expand"
        )}
      </div>

      <div
        className="grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none"
        style={ {
          gridTemplateRows: gridOpen ? "1fr" : "0fr"
        } }
        aria-hidden={ !expanded }
        onTransitionEnd={ handleTransitionEnd }
      >
        <div
          className={ clsx(
            "min-h-0 transition-opacity duration-200 ease-out motion-reduce:transition-none",
            settledOpen ? "overflow-visible" : "overflow-hidden",
            gridOpen ? "opacity-100" : "opacity-0",
            contentClassName
          ) }
        >
          {render ? children : null}
        </div>
      </div>
    </div>
  );
};

export default CollapsibleItem;
