# Audio assets

Uploadable sound files, on par with images and videos: a form field takes an
audio file, the sketch triggers it by path, and it is heard live, mixed into a
browser recording, and rendered sample-accurately into a server capture.

## Declaring a sound field

Audio is a regular asset kind, so a sketch's `options.ts` uses the generic
`asset` component:

```ts
export const formValues = {
  sound: {
    down: "",   // asset path, e.g. "global/audios/click-down.wav"
    up: ""
  }
};

export const formConfiguration = {
  sound: {
    component: "nested-object",
    label: "Click sounds",
    fields: {
      down: {
        label: "Mouse down",
        component: "asset",
        kind: "audios"
      },
      up: {
        label: "Mouse up",
        component: "asset",
        kind: "audios"
      }
    }
  }
};
```

`component: "asset-stack"` gives a reorderable list instead of a single slot.
Like images, the audios kind persists a **plain path string**, so `o.sound.down`
is exactly what the loader and the player take.

Uploads land in the shared asset pool (`assets.audios`), so they follow the
usual lifecycle: a `blob:` URL locally, uploaded to S3 with the job when a
recording is enqueued, and resolved through `resolveAssetURL` in both cases.

A default can also point at a file shipped with the app, exactly like the
cursor artwork does — `"/assets/audios/cursors/mousedown.wav"` resolves to the
static folder, so the sketch makes sound before anyone uploads anything.
Shipped sounds live under `public/assets/audios/`, mirroring
`public/assets/images/`.

## Playing a sound from a sketch

```js
import audioAssets from "@/p5/utils/audioAssets.js";

sketch.draw( () => {
  const o = options.sketch;

  // Decode anything audio-looking under the block (cheap, idempotent).
  audioAssets.sync( o.sound );

  if ( somethingHappened ) {
    audioAssets.play(
      o.sound.down,
      {
        gain: 0.6,
        playbackRate: 1
      }
    );
  }
} );
```

`play()` returns `false` when the asset is missing or still decoding, which is
the hook for a synth fallback:

```js
if ( !audioAssets.play( o.sound.down, { gain } ) ) {
  audio.trigger( "click", { preset: "pop", gain } );
}
```

### How it reaches the recordings

`audioAssets.load()` decodes the file once and registers the buffer in
`@/p5/utils/audio.js` **under its own asset path**. From there the path behaves
exactly like a built-in synth voice name:

| Path | Mechanism |
|---|---|
| Live preview | `audio.trigger( path )` → master gain → speakers |
| Browser recording | the same master gain feeds the MediaRecorder stream |
| Deterministic capture (async-loop / server) | the trigger is logged with its sketch-time stamp and replayed through an `OfflineAudioContext`, then muxed by FFmpeg |

A triggered path with nothing decoded behind it stays **silent** rather than
falling back to the default synth voice — a removed upload must not turn into a
stray beep in a rendered file.

### Opt-in on purpose

`audioAssets.js` is deliberately not wired into `options.js` the way images
are. Importing it pulls in the audio engine, which registers the recording
audio bridge — and that would add a silent audio track to every recording of
every sketch. Sound is opt-in: a sketch that wants it imports the module.

## Click sounds for a draggable layer

`@/p5/utils/interaction/dragClicks.js` is the ready-made consumer, used by
rings v7 and v8: it watches a `createDraggable()` instance and plays one sound
when a pointer takes a handle and another when it lets go — the mouse-down /
mouse-up pair that makes a drag sound like a real click.

```js
import {
  createDragClicks
} from "@/p5/utils/interaction/dragClicks.js";
import {
  dragClickFormConfiguration, dragClickFormValues
} from "@/p5/utils/interaction/dragClickOptions.js";

const clicks = createDragClicks();      // module scope

sketch.setup( () => clicks.reset() );

sketch.draw( () => {
  draggable.update( { … } );
  clicks.update( draggable.drags, options.sketch.sound );
} );
```

`dragClickOptions.js` carries the matching form block
(`sound: { ...dragClickFormValues }` + `sound: dragClickFormConfiguration`).
It is import-free on purpose: `options.ts` is loaded by the form and by the
metadata generator, and must never reach the audio engine.

Its defaults point at the two shipped click sounds
(`public/assets/audios/cursors/`), so adopting the block is enough to make a
drag layer click. Replace either one by dropping a file on the field; clear it
to fall back to the synth preset.

Because the layer reads the drag layer's own state rather than raw pointer
events, every pointer source clicks through it — mouse, touch, camera pinch and
the scripted virtual pointers alike — on exactly the frame the handle is taken,
and never when a press lands on empty canvas. `virtual: false` mutes the
scripted troupe if only real hands should click.

Simultaneous grabs are capped (`maxVoices`) and share a `1/√n` gain with a
deterministic per-voice detune (`spread`), so a crowd of cursors grabbing on
the same frame reads as one click, not a comb.

## When a sound doesn't play

Every failure below is silent by design in the rendered output — a missing
sound must never become a stray beep in a video — so the diagnosis lives in the
console. From the page running the sketch:

```js
window.__sketchAudioAssets()
// [ { path, status, registered, url }, … ]
```

| What you see | What it means |
|---|---|
| `status: "ready"`, `registered: true` | The sound is loaded and will play. |
| `status: "loading"` | Still decoding; the synth fallback covers the gap. |
| `status: "error"` | Fetch or decode failed — a `[audio]` warning names the reason (an HTTP status, a decode error). |
| the path is absent entirely | The field value never reached the sketch: check `window.sketchOptions.sketch.<block>` for the path. |
| `registered: false` while `status: "ready"` | The engine lost the sample (Fast Refresh, sketch reset). `ready()` re-arms the entry and the next frame decodes it again. |

Two more things silence a sound that is otherwise fine:

- **A suspended AudioContext.** Browsers start it suspended until the page gets
  a real click or key press, and anything scheduled meanwhile is discarded.
  Any gesture resumes it, and `trigger` now nudges a suspended context back
  awake — but the very first sounds of a page that has never been clicked are
  lost, by browser policy.
- **Nothing is grabbing.** The clicks fire on grab/release of a point, so a
  loop where the pointer show has already finished (or where the virtual
  pointers are off and you haven't dragged) is legitimately silent.

## Adding another asset kind

The kind descriptor is the whole contract — `src/lib/assets/kinds/audios.tsx`
is ~120 lines of it, registered in `src/lib/assets/kinds/index.ts`. Nothing in
the pickers, the upload bridge or the enqueue route is kind-specific; only the
Zod `Assets` pool in `src/types/sketch.types.ts` needs the new array.
