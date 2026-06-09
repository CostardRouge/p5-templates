"use client";
import MiniTimeline from "./MiniTimeline";
import type {
  VideoFit, VideoLoopMode, VideoParams
} from "./types";
import type {
  AssetParamsEditorProps
} from "../../types";
import Vector2DPad, {
  type Vector2DInputConfig
} from "@/components/ClientProcessingSketch/components/TemplateOptions/components/ContentItems/components/ControlledVector2DInput/Vector2DPad";

// Screen-space position pad: centered [-1, 1] on both axes (0 = centered in the
// draw box), with the Y axis pointing down so dragging the handle up moves the
// video toward the top of the frame, matching `computeVideoLayout`'s offsets.
const POSITION_PAD_CONFIG: Vector2DInputConfig = {
  min: -1,
  max: 1,
  step: 0.01,
  yDown: true
};

const SPEED_MIN = 0.1;
const SPEED_MAX = 4;
const SPEED_LOG_MIN = Math.log( SPEED_MIN );
const SPEED_LOG_MAX = Math.log( SPEED_MAX );

// 0..1 slider position ↔ log-scaled speed value
const speedToSlider = ( s: number ) =>
  ( Math.log( s ) - SPEED_LOG_MIN ) / ( SPEED_LOG_MAX - SPEED_LOG_MIN );
const sliderToSpeed = ( v: number ) =>
  Math.exp( SPEED_LOG_MIN + v * ( SPEED_LOG_MAX - SPEED_LOG_MIN ) );

export default function VideoParamsEditor( {
  value,
  onChange
}: AssetParamsEditorProps<VideoParams> ) {
  const update = ( patch: Partial<VideoParams> ) =>
    onChange( {
      ...value,
      ...patch
    } );

  return (
    <div className="flex flex-col gap-2 text-xs">
      <Row label="Repeat" hint={ `${ value.repeat }×` }>
        <input
          type="range"
          min={ 1 }
          max={ 10 }
          step={ 1 }
          value={ value.repeat }
          onChange={ ( e ) =>
            update( {
              repeat: parseInt(
                e.target.value,
                10
              )
            } )
          }
          className="w-full"
        />
      </Row>

      <Row label="Speed" hint={ `${ value.speed.toFixed( 2 ) }×` }>
        <input
          type="range"
          min={ 0 }
          max={ 1 }
          step={ 0.001 }
          value={ speedToSlider( value.speed ) }
          onChange={ ( e ) =>
            update( {
              speed: Number( sliderToSpeed( parseFloat( e.target.value ) ).toFixed( 3 ) )
            } )
          }
          className="w-full"
        />
      </Row>

      <Row label="Offset" hint={ value.offset.toFixed( 2 ) }>
        <input
          type="range"
          min={ 0 }
          max={ 1 }
          step={ 0.01 }
          value={ value.offset }
          onChange={ ( e ) =>
            update( {
              offset: parseFloat( e.target.value )
            } )
          }
          className="w-full"
        />
      </Row>

      <Row label="Loop">
        <select
          value={ value.loopMode }
          onChange={ ( e ) =>
            update( {
              loopMode: e.target.value as VideoLoopMode
            } )
          }
          className="w-full p-1 border border-theme rounded bg-background text-foreground"
        >
          <option value="loop">loop</option>
          <option value="clamp">clamp</option>
          <option value="ping-pong">ping-pong</option>
        </select>
      </Row>

      <div className="mt-1 flex flex-col items-center gap-0.5">
        <MiniTimeline params={ value } />
        <span className="text-[10px] text-gray-400">video time over sketch progression</span>
      </div>

      <div className="mt-2 border-t border-theme pt-2 text-[10px] uppercase tracking-wide text-gray-400">
        Layout
      </div>

      <Row label="Size" hint={ `${ value.scale.toFixed( 2 ) }×` }>
        <input
          type="range"
          min={ 0.1 }
          max={ 3 }
          step={ 0.05 }
          value={ value.scale }
          onChange={ ( e ) =>
            update( {
              scale: parseFloat( e.target.value )
            } )
          }
          className="w-full"
        />
      </Row>

      {/* Position is a single { x, y } pad rather than two sliders: the
          AssetDialog's layout preview can be dragged for coarse placement, and
          this pad gives precise numeric control over the same posX/posY. Not
          wrapped in a `Row` <label> since the pad is a composite widget. */}
      <div className="flex flex-col gap-0.5">
        <span className="flex justify-between text-gray-500">
          <span>Position</span>
          <span className="font-mono text-foreground/80">
            {value.posX.toFixed( 2 )}, {value.posY.toFixed( 2 )}
          </span>
        </span>
        <Vector2DPad
          ariaLabel="Position"
          config={ POSITION_PAD_CONFIG }
          value={ {
            x: value.posX,
            y: value.posY
          } }
          onChange={ ( next ) =>
            update( {
              posX: next.x,
              posY: next.y
            } )
          }
        />
      </div>

      <Row label="Aspect ratio">
        <select
          value={ value.fit }
          onChange={ ( e ) =>
            update( {
              fit: e.target.value as VideoFit
            } )
          }
          className="w-full p-1 border border-theme rounded bg-background text-foreground"
        >
          <option value="stretch">stretch (fill box)</option>
          <option value="contain">contain (fit inside)</option>
          <option value="cover">cover (fill &amp; crop)</option>
        </select>
      </Row>
    </div>
  );
}

function Row( {
  label, hint, children
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
} ) {
  return (
    <label className="flex flex-col gap-0.5">
      <span className="flex justify-between text-gray-500">
        <span>{label}</span>
        {hint ? <span className="font-mono text-foreground/80">{hint}</span> : null}
      </span>
      {children}
    </label>
  );
}
