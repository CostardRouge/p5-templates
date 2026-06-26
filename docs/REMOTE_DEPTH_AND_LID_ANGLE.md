# Remote inputs: iPhone LiDAR depth + Mac lid-angle

Two new interaction sources sit alongside the existing ones (mouse, touch,
vision, gyroscope, midi, audio, joypad). They follow the exact same pattern — a
collector registered in `src/templates/p5/utils/interaction/index.js`, defaults +
form config in `defaults.js`, colour + label in `overlay.js` — so they appear
automatically in the `kinetic/interaction-test` sketch and in any sketch that
reads `getPointers()` / `getPointerGroups()`.

- **`lidar`** — iPhone LiDAR depth streamed in over a WebSocket (remote input).
- **`lidAngle`** — the MacBook screen-hinge angle, read in-browser via WebHID.

---

## Why the iPhone LiDAR has to be remote

iOS Safari (and every iOS browser, since they all use WebKit) exposes **no**
WebXR, **no** Depth Sensing API and **no** access to the depth camera. A web page
on the phone simply cannot read the LiDAR. So the capture must happen in a
**native source** (an iOS/ARKit app, or a desktop bridge), and the sketch's
browser is only the **receiver**. The `lidar` collector is that receiver: it
opens a WebSocket to the source and decodes depth frames.

```
[iPhone native ARKit app]  →  WebSocket (LAN)  →  [sketch: lidar collector]
   reads ARFrame.sceneDepth      or USB+bridge       getPointers() / getLidar()
```

### What quality to expect

- LiDAR depth on iPhone is **256×192** (~49k points/frame) — the ARKit hardware
  ceiling, identical in every app. It is low-resolution but **metrically
  accurate** (depth in metres), with a matching **confidence map** (0/1/2).
- For *interaction* you do not want 49k points per frame in p5. The source should
  **downsample** to a small grid (e.g. 32×24). The collector then keeps only the
  **N nearest in-band cells** as pointers, and exposes the whole grid via
  `getLidar()`.
- Latency: USB tether ≈ 30–80 ms; LAN WebSocket ≈ 50–150 ms with WiFi jitter.
  Fine for driving generative visuals, not "pixel-perfect realtime".

### Wired vs wireless

| Transport | Quality / latency | Topology | Catch |
|---|---|---|---|
| **USB tether** | best, full 256×192, lowest latency | iPhone → desktop bridge → WS → sketch | browser can't read the iPhone over USB directly; needs a small desktop relay process |
| **WiFi / LAN WebSocket** | reduced rate, WiFi jitter | iPhone (WS server) → sketch | simplest, zero backend; matches this collector directly |
| **WiFi WebRTC** (Record3D paid) | compressed depth | iPhone → browser | paid extension, LAN only |

Branché = plus rapide, mais réintroduit un process desktop. Le WiFi-direct est le
point d'entrée le plus simple pour ce collector.

---

## The WebSocket depth protocol (source-agnostic)

Point the collector at any source that speaks one of these two formats. Set the
URL in the sketch form: **Interaction → LiDAR (iPhone depth, remote) → WebSocket
URL** (e.g. `ws://192.168.1.50:8765`).

### Binary frame (preferred — compact)

Little-endian, one message per frame:

| Offset | Type | Field |
|---|---|---|
| 0 | uint16 | magic `0x4C44` (`"LD"`) |
| 2 | uint8 | version (`1`) |
| 3 | uint8 | flags — bit0 = confidence present |
| 4 | uint16 | width |
| 6 | uint16 | height |
| 8 | float32 | min depth (m) → mapped to "near" |
| 12 | float32 | max depth (m) → mapped to "far" |
| 16 | float32 × w·h | depth, row-major, metres (`0`/`NaN` = no reading) |
| … | uint8 × w·h | confidence 0–2 (only if flag bit0 set) |

### JSON frame (easy to emit / debug)

```json
{ "width": 32, "height": 24, "min": 0.2, "max": 4.0,
  "data": [/* w*h depths in metres, row-major */],
  "confidence": [/* optional, w*h, 0..2 */] }
```

### Mixed-content gotcha ⚠️

An **`https://` page cannot open a `ws://` socket** (the browser blocks it). So:

- **Dev:** open the sketch over `http://localhost:3000` — `localhost` is exempt,
  and an `http://` page may use `ws://`.
- **Prod (https):** expose the source over **`wss://`** (TLS), or run a localhost
  bridge the page connects to.

---

## Recommended sources

- **[Arvos](https://github.com/jaskirat1616/Arvos)** — open-source iOS app that
  runs a WebSocket server and streams depth (binary PLY + confidence) over the
  LAN. Closest to plug-and-play; note its LiDAR rate is low (~1–5 fps). Needs a
  small adapter to re-emit in the format above, or extend the collector to parse
  PLY.
- **[Record3D](https://github.com/marek-simonik/record3d)** (LGPL-2.1) — USB
  streaming is free via its Python/C++ lib; WiFi-to-browser is a paid WebRTC
  extension. Best path for **quality/latency**: Record3D USB → tiny Node/Python
  bridge that downsamples `sceneDepth` and re-emits a binary frame over WS.
- **Custom iOS app** — ~a few hundred lines of Swift + ARKit. Bases:
  [ios-depth-point-cloud](https://github.com/Waley-Z/ios-depth-point-cloud),
  [ExampleOfiOSLiDAR](https://github.com/TokyoYoshida/ExampleOfiOSLiDAR),
  [LiDAR-Depth-Map-Capture-for-iOS](https://github.com/ioridev/LiDAR-Depth-Map-Capture-for-iOS).
  Emitting the binary frame above directly = smallest payload, full control.

### Reading the rich snapshot in a sketch

```js
import { getLidar } from "@/p5/utils/interaction/index.js";

const lidar = getLidar();
// { enabled, connected, width, height, min, max,
//   depth: Float32Array|null, confidence: Uint8Array|null,
//   nearest: { x, y, z, depth }|null, frames, receivedAt }
if ( lidar.nearest ) {
  // nearest.x / nearest.y in canvas space, nearest.depth in metres
}
```

The collector also emits the N nearest cells as ordinary pointers (z = normalised
depth), so existing pointer-driven sketches react to LiDAR with no extra code.

---

## Mac lid-angle (WebHID)

Apple ships a hidden HID sensor reporting the screen-hinge angle. It is readable
**straight from the browser** via WebHID — no native helper.

- Device: vendor `0x05AC`, product `0x8104`, usagePage `0x20`, usage `0x8A`.
- Read **Feature Report 1**: uint16 LE in **degrees** at byte offset 1
  (offset 0 is the report id).
- **Chrome/Edge desktop only** (no Safari/Firefox), **Apple Silicon** (M3/M4
  reliable; M1/M2 reported flaky), and `requestDevice()` needs a **user gesture**
  — so the first grant is armed on a one-shot click, exactly like the iOS
  gyroscope permission. Already-granted devices reopen silently.

Enable under **Interaction → Mac Lid Angle (WebHID)**. The angle maps onto the
chosen axis (the other axis stays centred), with min/max angle + offset controls.
Read the raw value with `getLidAngle()` → `{ degrees, connected }`.

Credit: reverse-engineering by
[Sam Henri Gold](https://github.com/samhenrigold/LidAngleSensor); WebHID approach
documented across [pybooklid](https://github.com/tcsenpai/pybooklid) and
[lid-angle-rs](https://github.com/wangfu91/lid-angle-rs).
