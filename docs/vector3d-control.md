# The `vector3d` control — survey, proposals, what shipped

Point-in-time write-up (2026-09-21) behind the `vector3d` field kind. The
maintained rules live in `docs/memory/studio-ui.md`; this file keeps the
research and the reasoning so the next round does not redo it.

The question: the studio has a compact 2D vector pad (two number fields over a
draggable square). More and more sketches are 3D — a camera position, a light
direction, a spin axis — and edit those as three unrelated sliders. What should
the 3D counterpart look like?

## 1. What exists elsewhere

Surveyed on the web (docs, source code, issue trackers, papers). Grouped by
what the control is for.

### Parameter panels (the direct peers of this form)

| Tool | 3D vector UI | Notes |
| --- | --- | --- |
| Tweakpane `point3d` | three text fields, **no pad** | [Issue #102](https://github.com/cocopon/tweakpane/issues/102) asked for "the XY pad with a slider for z underneath, like the colour picker" or "pick any pair of axes for the pad"; fields shipped instead. `point2d` is the reference pad: `[-max, max]` mapping, `y: {inverted}`, arrow keys nudge. |
| `tweakpane-plugin-rotation` | 136px SVG gizmo: three axis rings split front/back and depth-sorted, free drag = virtual trackball (`axis = (dy, dx, 0)`, angle `l/68`), click a ring for single-axis, click a label to slerp there, arrows rotate π/16 | The only shipped compact 3D picker in the creative-coding GUI world — for **rotations**, not vectors. |
| Leva `Vector3` | three scrub fields (drag the coordinate name: 1 px = 1 step, Shift ×10, Alt ×0.1), `lock` keeps ratios | `Vector2` has a joystick pad (absolute mapping, auto-repeat outside the pad); "you don't have the joystick option" for Vector3. [Issue #431](https://github.com/pmndrs/leva/issues/431): "tap the joystick to show the 2D joystick applied to a plane, tap a button or hold a modifier to switch planes, animate the grid rotating". Open, unanswered. |
| lil-gui / dat.gui | none | [Issue #12](https://github.com/georgealways/lil-gui/issues/12) names "Point, 3DPoint" as community controllers; core stays minimal. |
| Theatre.js | `types.compound({x,y,z})` collapses to one row of numbers, `nudgeMultiplier` | No pad. |
| Unity inspector | three fields, drag the label to scrub, expressions accepted | **HDRP Light Anchor**: orbit / elevation / roll as three circular dials + nine preset thumbnails (rim, kick, fill…), camera-relative, right-click resets, 0.01° rounding. |
| Unreal | three fields with **red / green / blue bars**, horizontal drag scrubs, `AllowPreserveRatio` | |
| Godot | three spin-sliders with per-axis label colour, a **"linked" ratio toggle**, Shift = precise, Ctrl = round, Alt = coarse | |
| Houdini / TouchDesigner | **value ladder**: hold the label, move vertically to pick the magnitude rung, horizontally to change; opening the ladder on a vector's *label* moves all components | |
| PlayCanvas PCUI | N numeric inputs, **Alt+click binds all dimensions for synchronized dragging** | |
| Blender | `PROP_DIRECTION` subtype draws the **normal sphere**: drag on the disc = front hemisphere, drag past the rim folds onto the back hemisphere, Ctrl snaps 45°, Ctrl+Shift 15°, the drag starts from the *current* vector's projected position (no jump), Esc cancels, output always normalised (`numedit_but_UNITVEC`) | [#29156](https://projects.blender.org/blender/blender/issues/29156) asks for colour marks on the xyz fields. |
| Dear ImGui | [#2811](https://github.com/ocornut/imgui/issues/2811): `SliderFloat3` in −1..1 + manual normalisation is "cumbersome and unintuitive", zero-vector edge case | Answered by `imGuIZMO.quat`: a vec3 "direction arrow" widget, trackball drag, Shift/Ctrl/Alt = single axis. |
| Babylon.js inspector | collapsed "X · Y · Z" line, expand to per-axis inputs | |

### In-scene gizmos (for contrast)

three.js `TransformControls` / drei `PivotControls`: axis arrows, plane
squares, rings; drag intersects a camera-facing plane; `translationSnap`; Tab
for rounded values; live numeric annotations. Orientation gizmos (Autodesk
ViewCube, Blender's navigation gizmo, drei `GizmoViewport` / `GizmoViewcube`,
three.js `ViewHelper`): click a face / edge / corner to snap to one of 6 or 26
directions, drag to orbit; **negative axes drawn dimmer or hollow**.

### Lights specifically

Nobody edits a light as three numbers. Unity Light Anchor: dials + presets.
three.js sky example: `elevation` / `azimuth` sliders →
`setFromSphericalCoords`. Marmoset: drag the light on the **HDRI panorama** (a
2D pad whose axes are azimuth / elevation). Substance Painter: one yaw, rotated
with Shift+RMB in the viewport. Sketchfab: Alt-drag rotates the light.

### Trackball / arcball theory

- Shoemake, *ARCBALL* (1992): screen point → half sphere (`z = √(1 − r²)`,
  clamped to the rim outside), drag = rotation by the arc; no hysteresis;
  axis constraint by projecting onto the plane ⊥ axis.
- Henriksen, Sporring, Hornbæk, *Virtual Trackballs Revisited* (TVCG 2004):
  Shoemake's mapping is "inhomogeneous and discontinuous" at the rim; **Bell's**
  (sphere inside `r² ≤ ½`, hyperbolic sheet `z = 1/(2r)` outside) is
  continuous. This is why three.js `ArcballControls` uses the sphere +
  hyperboloid split at `r²·0.5`.
- Bade, Ritter, Preim (2005): predictability = directional compliance,
  **transitivity** (A→B→C equals A→C) and no hysteresis.
- Hinckley et al. (UIST '97): Arcball vs Virtual Sphere — no measurable
  difference; "most people are not good at mentally composing rotations", so a
  control that reaches any direction in one drag beats one that needs two.
- Fixed-reference-axis trackball (Visual Computer 2021): a fixed "up" helps when
  the value has a natural up (turntable over free arcball).

## 2. The patterns, distilled

1. **Three scrubbable number fields are the floor**, with drag-the-label,
   modifier step multipliers, a way to move all components at once, and colour
   coding where the palette allows it.
2. **"2D pad + one more control"** (XY pad + z fader, or a pad with a plane
   switch) is what the web-GUI world keeps asking for and never ships.
3. **A unit-sphere disc for directions**: front hemisphere on the disc,
   back hemisphere past the rim, Ctrl-snapping, no jump on click, Esc cancels.
4. **Arcball / trackball for continuous turning**: Bell's mapping, conservative,
   axis constraints by modifier.
5. **Spherical coordinates for lights**, often camera-relative, with presets.
6. **View cube for discrete directions**: 6 / 26 snaps plus drag-to-orbit,
   negative axes dimmer.
7. **Precision and cancel affordances** on every drag surface: snap modifier,
   Esc, right-click reset, rounded values on demand.
8. **Touch and keyboard are afterthoughts that break** — plan them in.

## 3. What shipped: one field kind, one view

`component: "vector3d"` stores a cartesian `{ x, y, z }` (like `vector2d`
stores `{ x, y }`), with the same range ladder (`allowNegative` →
`min`/`max`/`step` → `xAxis`/`yAxis`/`zAxis`) plus `zAxis`, `yDown` (p5's
WEBGL has +y down) and `kind: "position" | "direction"`. Above the control sit
three scrub fields (1 px = 1 step, Shift ×10, Alt slides all three); below them,
the one view:

**The orbitable box** (`Vector3DBox.tsx`) — an axonometric box drawn from the
axis ranges, the value as an arrow from the true origin, and for a position a
shadow dropped on the floor. Drag the tip in the screen plane; Shift pushes it
in depth; holding x, y or z slides along that axis alone (Blender's
G-then-axis); Ctrl snaps to the quarter grid; Escape cancels the drag. Drag the
background to orbit the view, double-click to reset it. Arrows nudge x / y,
PageUp / PageDown nudge z, Shift ×10.

It draws on the in-scene gizmo (three.js `TransformControls`, drei
`PivotControls`), the view cube's drag-to-orbit, and Blender's axis-constrained
move — brought into a 176 px panel column rather than onto the canvas.

`utils/vector3dMath.ts` holds everything the view needs, unit-tested without
React: the range ladder, snapping, the "cube space" that maps each axis' range
onto [−1, 1] so the drawn box is a cube whatever the ranges, the view's
rotation matrix, and the screen-plane / depth / single-axis unprojection.

### Why one view

Four were built and compared live on the same parameter (the bench artifact,
2026-09-21): the box, two orthographic pads (front x·y + top x·z), the 2D pad
plus a z fader, and Bell's trackball sphere. The maintainer picked the box and
asked for the rest to go. The reasoning that held up at the bench:

- **The box does what the flat variants do, and shows depth while doing it.**
  "Pad + z" is the clearest case — every gesture it offers, the box offers,
  minus the depth cue.
- **One control means one gesture to learn**, no switcher, no per-control view
  state to persist, and roughly 900 fewer lines.
- The cost, accepted: a **direction** (a light, a spin axis) is edited in a box
  whose bounds do not really apply to it, where a trackball would turn it
  directly. The box still reaches every direction; it just does not say
  "sphere". If that becomes annoying, the trackball is §4's first candidate.

Two more choices, unchanged by the cut:

- **Monochrome.** Every tool colour-codes x / y / z red / green / blue; the
  studio's visual language reserves colour (red is recording) and the axis
  letters do the job at this size. If colour is wanted later it is one token
  per axis, not a redesign — and the bench's three-way toggle (none / letters /
  full) is the fastest way to settle it.
- **No forced normalisation.** A direction edited as three numbers must be
  re-normalised somewhere; the control does not force it (ImGui #2811's
  zero-vector trap) — the sketch normalises.

## 4. Proposals not built (candidates for a next round)

The three cut views come first — they were written, driven headlessly and
compared, so bringing one back is recovering a known quantity rather than
starting over. The code is in the history of the branch that introduced the
control (`Add a vector3d control`, four-view revision), and all four are still
playable on the bench artifact.

- **The trackball sphere**, if editing a light in a box starts to grate. Bell's
  mapping (sphere inside `r² ≤ ½`, hyperbolic sheet outside), conservative and
  transitive, Ctrl snapping to 45° / 15°, a strip for the length, az / el
  readout.
- **Front · top pads**, if a sketch ever needs exact placement more than it
  needs depth.
- **Colour-coded axes** behind a CSS token (`--axis-x/y/z`), off by default;
  letters-only is the cheap version.
- **Fold-back disc** (Blender's exact gesture: absolute mapping from the
  current position, rim folds to the back) for people who want click-to-point.
- **Spherical dials** (azimuth ring + elevation arc + length) with **presets**
  for lights (rim / kick / fill…), Unity Light Anchor style; possibly
  camera-relative for a sketch that exposes its camera.
- **Ratio lock** on the number row (Leva `lock`, Godot "linked").
- **View cube snaps** in the 3D box: click an axis letter to snap the vector
  to that axis (drei `GizmoViewport` gesture).
- **Remember the chosen view** per sketch in `usePanelState` — only relevant if
  a second view ever comes back.
- **Bindings**: `bindingKindFor( "vector3d" )` is `null`, so a 3D field cannot
  yet be modulated from a channel; a `vector3d` kind would need a third
  projection in `interaction/bindings.js`.
- **HUD**: no widget reads a `{ x, y, z }`; `hud-vector` plots x·y only
  (`isPointValue` accepts a triple, so a 3D param already appears in the point
  pickers and plots its x·y).
- **Randomize on the unit sphere** for `kind: "direction"` (today: uniform in
  the box, then whatever length that gives).
- **Convert real sketches.** `dragon-corridor` (p5 and Three.js) keeps `camera.x/y/z`
  as siblings of `pitch`/`yaw`; moving them under a `camera.position` triple
  is a stored-shape change (breaks presets) — a `-vN` or a lazy migration, not
  an edit in place.

## 5. Sources

- Tweakpane: [point-2d plugin](https://github.com/cocopon/tweakpane/blob/main/packages/core/src/input-binding/point-2d/plugin.ts), [point-3d plugin](https://github.com/cocopon/tweakpane/blob/main/packages/core/src/input-binding/point-3d/plugin.ts), [#102 3D vector input](https://github.com/cocopon/tweakpane/issues/102), [#89 picker toggle UX](https://github.com/cocopon/tweakpane/issues/89), [#317 touch](https://github.com/cocopon/tweakpane/issues/317); [tweakpane-plugin-rotation](https://github.com/0b5vr/tweakpane-plugin-rotation).
- Leva: [inputs](https://github.com/pmndrs/leva/blob/main/docs/getting-started/inputs.md), [Number.tsx](https://github.com/pmndrs/leva/blob/main/packages/leva/src/plugins/Number/Number.tsx), [Vector.tsx](https://github.com/pmndrs/leva/blob/main/packages/leva/src/plugins/Vector/Vector.tsx), [Joystick.tsx](https://github.com/pmndrs/leva/blob/main/packages/leva/src/plugins/Vector2d/Joystick.tsx), [#431 joystick for Vector3](https://github.com/pmndrs/leva/issues/431).
- lil-gui [#12](https://github.com/georgealways/lil-gui/issues/12); Theatre.js [prop types](https://github.com/theatre-js/website/blob/main/content/docs/0.5/300-manual/130-prop-types.mdx).
- drei [PivotControls](https://github.com/pmndrs/drei/blob/master/src/web/pivotControls/index.tsx), [GizmoViewport](https://github.com/pmndrs/drei/blob/master/src/core/GizmoViewport.tsx), [GizmoViewcube](https://github.com/pmndrs/drei/blob/master/src/core/GizmoViewcube.tsx); three.js [TransformControls](https://github.com/mrdoob/three.js/blob/dev/examples/jsm/controls/TransformControls.js), [ArcballControls](https://github.com/mrdoob/three.js/blob/dev/examples/jsm/controls/ArcballControls.js), [TrackballControls](https://github.com/mrdoob/three.js/blob/dev/examples/jsm/controls/TrackballControls.js), [ViewHelper](https://github.com/mrdoob/three.js/blob/dev/examples/jsm/helpers/ViewHelper.js), [sky example](https://github.com/mrdoob/three.js/blob/dev/examples/webgl_shaders_sky.html); [spin-controls](https://github.com/PaulHax/spin-controls); [three-orientation-gizmo](https://github.com/joezappie/three-orientation-gizmo); [three-viewport-gizmo](https://github.com/Fennec-hub/three-viewport-gizmo); [Fil/versor](https://github.com/Fil/versor).
- Unity [Light Anchor editor](https://github.com/Unity-Technologies/Graphics/blob/master/Packages/com.unity.render-pipelines.core/Editor/Lighting/LightAnchorEditor.cs), [docs](https://docs.unity3d.com/Packages/com.unity.render-pipelines.high-definition@17.0/manual/light-anchor.html); Unreal [vector / rotator controls](https://dev.epicgames.com/documentation/en-us/unreal-engine/vector-/-rotator-controls?application_version=4.27); Godot [editor_properties_vector.cpp](https://github.com/godotengine/godot/blob/master/editor/inspector/editor_properties_vector.cpp), [proposal #6988](https://github.com/godotengine/godot-proposals/issues/6988); Houdini [value ladder](https://www.sidefx.com/docs/houdini/basics/ladder.html); TouchDesigner [parameter dialog](https://derivative.ca/UserGuide/Parameter_Dialog); PCUI [VectorInput](https://github.com/playcanvas/pcui/blob/main/src/components/VectorInput/index.ts); Babylon [vector3LineComponent](https://github.com/BabylonJS/Babylon.js/blob/master/packages/dev/sharedUiComponents/src/lines/vector3LineComponent.tsx).
- Blender [Normal node](https://docs.blender.org/manual/en/latest/render/shader_nodes/utilities/vector/normal.html), `numedit_but_UNITVEC` in [interface_handlers.cc](https://github.com/blender/blender/blob/main/source/blender/editors/interface/interface_handlers.cc), [property subtypes](https://docs.blender.org/api/current/bpy_types_enum_items/property_subtype_items.html), [#29156](https://projects.blender.org/blender/blender/issues/29156), [#104280](https://projects.blender.org/blender/blender/issues/104280).
- Dear ImGui [#2811](https://github.com/ocornut/imgui/issues/2811); [imGuIZMO.quat](https://github.com/BrutPitt/imGuIZMO.quat); [ImGuizmo](https://github.com/CedricGuillemet/ImGuizmo); [ImOGuizmo](https://github.com/fknfilewalker/imoguizmo).
- Marmoset [Lighting](https://docs.marmoset.co/docs/lighting/); Substance Painter [shortcuts](https://experienceleague.adobe.com/en/docs/substance-3d-painter/using/interface/settings/shortcuts); Sketchfab [lighting](https://sketchfab.com/blogs/community/how-to-fine-tune-your-lighting-and-shadows-on-sketchfab/); Autodesk [ViewCube](https://help.autodesk.com/cloudhelp/2018/ENU/Reality-Capture/files/GUID-B954D9E0-F4EC-4C26-A60E-EEFC76402D3B.htm).
- Papers: Shoemake, ARCBALL, Graphics Interface '92 ([Graphics Gems IV code](https://github.com/erich666/GraphicsGems/blob/master/gemsiv/arcball/BallMath.c)); Henriksen, Sporring, Hornbæk, *Virtual Trackballs Revisited*, IEEE TVCG 10(2) 2004; Bade, Ritter, Preim, *Usability Comparison of Mouse-Based Interaction Techniques for Predictable 3D Rotation*, Smart Graphics 2005; Hinckley et al., *Usability Analysis of 3D Rotation Techniques*, [UIST '97](https://www.microsoft.com/en-us/research/wp-content/uploads/2016/02/uistrotation-final.pdf); *3D Object Rotation Using Virtual Trackball with Fixed Reference Axis*, The Visual Computer 2021.
