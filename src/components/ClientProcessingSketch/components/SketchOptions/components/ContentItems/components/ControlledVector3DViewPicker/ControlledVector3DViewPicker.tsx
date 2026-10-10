"use client";

import clsx from "clsx";
import {
  useCallback, useEffect, useLayoutEffect, useRef
} from "react";
import {
  useController, useFormContext, useWatch
} from "react-hook-form";

import {
  getBindingValues, subscribeBindingValues
} from "@/lib/channelBridge";
import {
  getByPath
} from "@/p5/utils/hud/keyPaths";
import {
  VECTOR3D_VIEWS, buildVector3dView, toTriple, vector3dViewLabel
} from "@/p5/utils/hud/vector3dViews";
import {
  CONTROL_CARD_CLASS
} from "../../constants/control-bar";
import {
  CardLabelHeader
} from "../ControlChrome";
import {
  drawVector3dOps, type Vector3dOp
} from "./drawVector3dOps";

type Props = {
  /** The `view` field's form path. */
  name: string;
  /** The owning hud-vector3d item's form path — its siblings feed the tiles. */
  itemPath: string;
  label?: string;
  isModified?: boolean;
  onReset?: ( event: React.MouseEvent ) => void;
};

type Triple = { x: number;
  y: number;
  z: number };

type ItemShape = {
  source?: string;
  kind?: "position" | "direction";
  domain?: Record<string, number>;
  yDown?: boolean;
  fill?: number[];
};

const DEFAULT_FILL: [number, number, number] = [
  0,
  255,
  120
];

/**
 * A stand-in for an element with no readable source yet, so every tile still
 * shows what its view looks like: a point off-centre on all three axes.
 */
function sampleValue( domain: Record<string, number> | undefined ): Triple {
  const at = (
    axis: "x" | "y" | "z", fraction: number
  ) => {
    const min = domain?.[ `${ axis }Min` ] ?? -1;
    const max = domain?.[ `${ axis }Max` ] ?? 1;

    return min + ( max - min ) * fraction;
  };

  return {
    x: at(
      "x",
      0.7
    ),
    y: at(
      "y",
      0.3
    ),
    z: at(
      "z",
      0.75
    )
  };
}

/**
 * The Vector 3D element's view setting, as five live tiles. Each tile draws
 * the element's own value through the same display list the canvas widget
 * paints (vector3dViews.js), so choosing a view is choosing a picture already
 * seen. The value is the bound parameter's live one when a binding drives it
 * (repainted from the channel bridge, never through React state per frame),
 * else the form's.
 */
export default function ControlledVector3DViewPicker( {
  name,
  itemPath,
  label,
  isModified,
  onReset
}: Props ) {
  const {
    control
  } = useFormContext();
  const {
    field
  } = useController( {
    name,
    control
  } );

  const item = ( useWatch( {
    control,
    name: itemPath
  } ) ?? {} ) as ItemShape;

  // A slide-scoped element reads its slide's sketch values, like the engine.
  const slideMatch = /^slides\.(\d+)\./.exec( itemPath );
  const scopeSketch = useWatch( {
    control,
    name: slideMatch ? `slides.${ slideMatch[ 1 ] }.sketch` : "sketch"
  } );
  const rootSketch = useWatch( {
    control,
    name: "sketch"
  } );

  const source = typeof item.source === "string" ? item.source : "";
  const formValue = source
    ? toTriple( getByPath(
      scopeSketch ?? {},
      source
    ) ) ?? toTriple( getByPath(
      rootSketch ?? {},
      source
    ) )
    : null;

  const current = typeof field.value === "string" ? field.value : "box";
  const canvases = useRef<Array<HTMLCanvasElement | null>>( [] );

  // Latest inputs for the bridge subscriber, which repaints outside React.
  const inputs = useRef( {
    item,
    source,
    formValue
  } );

  const paint = useCallback(
    () => {
      const {
        item: latest, source: watched, formValue: base
      } = inputs.current;
      const live = watched ? toTriple( getBindingValues()[ watched ] ) : null;
      const value = live ?? base ?? sampleValue( latest.domain );
      const fill = Array.isArray( latest.fill ) && latest.fill.length >= 3
        ? [
          latest.fill[ 0 ],
          latest.fill[ 1 ],
          latest.fill[ 2 ]
        ] as [number, number, number]
        : DEFAULT_FILL;

      VECTOR3D_VIEWS.forEach( (
        view, index
      ) => {
        const canvas = canvases.current[ index ];

        if ( !canvas ) {
          return;
        }

        const rect = canvas.getBoundingClientRect();
        const dpr = Math.min(
          2,
          window.devicePixelRatio || 1
        );
        const width = Math.max(
          1,
          Math.round( rect.width * dpr )
        );
        const height = Math.max(
          1,
          Math.round( rect.height * dpr )
        );

        if ( canvas.width !== width || canvas.height !== height ) {
          canvas.width = width;
          canvas.height = height;
        }

        const ctx = canvas.getContext( "2d" );

        if ( !ctx || rect.width < 2 ) {
          return;
        }

        ctx.setTransform(
          dpr,
          0,
          0,
          dpr,
          0,
          0
        );
        ctx.fillStyle = "#0c0c10";
        ctx.fillRect(
          0,
          0,
          rect.width,
          rect.height
        );

        // Lay the bare body out at a nominal size, then scale it to the tile.
        const build = ( size: number ) => buildVector3dView( {
          view: view.id,
          value,
          cfg: latest,
          size,
          bare: true
        } ) as { w: number;
          h: number;
          ops: Vector3dOp[] };
        const probe = build( 10 );
        const size = 10 * Math.min(
          ( rect.width * 0.82 ) / probe.w,
          ( rect.height * 0.82 ) / probe.h
        );
        const laid = build( size );

        drawVector3dOps(
          ctx,
          laid.ops,
          {
            x: ( rect.width - laid.w ) / 2,
            y: ( rect.height - laid.h ) / 2
          },
          fill,
          size
        );
      } );
    },
    []
  );

  // Repaint on every render (form value, source, style changed)…
  useLayoutEffect( () => {
    inputs.current = {
      item,
      source,
      formValue
    };
    paint();
  } );

  // …and on every frame a binding publishes, without re-rendering.
  useEffect(
    () => subscribeBindingValues( () => {
      if ( inputs.current.source && toTriple( getBindingValues()[ inputs.current.source ] ) ) {
        paint();
      }
    } ),
    [
      paint
    ]
  );

  // The tiles are sized by CSS; repaint when the panel resizes them.
  useEffect(
    () => {
      if ( typeof ResizeObserver === "undefined" ) {
        return undefined;
      }

      const observer = new ResizeObserver( () => paint() );

      canvases.current.forEach( ( canvas ) => canvas && observer.observe( canvas ) );

      return () => observer.disconnect();
    },
    [
      paint
    ]
  );

  const select = ( id: string ) => {
    if ( id !== current ) {
      field.onChange( id );
    }
  };

  const onKeyDown = ( event: React.KeyboardEvent ) => {
    const step = event.key === "ArrowRight" || event.key === "ArrowDown"
      ? 1
      : event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 0;

    if ( !step ) {
      return;
    }

    event.preventDefault();

    const index = VECTOR3D_VIEWS.findIndex( ( view ) => view.id === current );
    const next = VECTOR3D_VIEWS[ ( index + step + VECTOR3D_VIEWS.length ) % VECTOR3D_VIEWS.length ];

    select( next.id );
    ( event.currentTarget.querySelector( `[data-view="${ next.id }"]` ) as HTMLElement | null )?.focus();
  };

  return (
    <div className={ CONTROL_CARD_CLASS }>
      <CardLabelHeader
        label={ label ? `${ label } · ${ vector3dViewLabel( current ) }` : vector3dViewLabel( current ) }
        isModified={ isModified }
        onReset={ onReset }
      />
      <div
        role="radiogroup"
        aria-label={ label ?? "View" }
        className="grid grid-cols-5 gap-1.5 p-1.5"
        onKeyDown={ onKeyDown }
      >
        {VECTOR3D_VIEWS.map( (
          view, index
        ) => {
          const checked = view.id === current;

          return (
            <button
              key={ view.id }
              type="button"
              role="radio"
              aria-checked={ checked }
              tabIndex={ checked ? 0 : -1 }
              data-view={ view.id }
              title={ view.label }
              onClick={ () => select( view.id ) }
              className={ clsx(
                "flex min-w-0 flex-col items-center gap-1 rounded-md border p-1 text-[10px] leading-tight transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-focus",
                checked
                  ? "border-focus text-foreground ring-1 ring-focus"
                  : "border-theme text-label hover:text-foreground"
              ) }
            >
              <canvas
                ref={ ( element ) => {
                  canvases.current[ index ] = element;
                } }
                aria-hidden="true"
                className="block aspect-square w-full rounded-sm"
              />
              <span className="w-full truncate text-center">{view.label}</span>
            </button>
          );
        } )}
      </div>
    </div>
  );
}
