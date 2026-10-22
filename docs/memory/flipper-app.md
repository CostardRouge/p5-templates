# Flipper Zero app

Read before touching `flipper/` — the `.fap` that plays the `lcd-v1-flipper-zero` animation on a real Flipper Zero.

## What it is, and why it lives here

2026-09-23 — The maintainer asked for "a flipper sketch", then, shown the web sketch, said they wanted "actual code that would run on my flipper zero, an animated sketch". So `flipper/lcd_sketch/` is a C port of the same six scenes on the firmware's `canvas_*` API, and the web sketch stays. It lives in this repo beside the sketch it mirrors; nothing in `npm run check` or `next build` touches it. **It is an animation only** — no radio, NFC, IR or GPIO call — and it should stay that way: the scenes imitate a tool's screens, they are not tools. Built-in fonts (`FontPrimary`, `FontSecondary`, `FontBigNumbers` — profont22 digits and `.`), not the web sketch's bitmap font; icons as `'#'`/`'.'` row strings, as in the web sketch.

## Building it where `update.flipperzero.one` is blocked

2026-09-23 — A cloud session cannot run `ufbt update` (the SDK and toolchain come from `update.flipperzero.one`, denied by the proxy), but it can build the exact same `.fap`: `apt-get install gcc-arm-none-eabi gdb-multiarch` (symlink `gdb-multiarch` as `arm-none-eabi-gdb` and `arm-none-eabi-gdb-py3` — fbt refuses to start without them), shallow-clone `flipperdevices/flipperzero-firmware` at the release tag with `--recursive` submodules, `pip install scons ansi colorlog heatshrink2 pillow protobuf pyelftools pyserial cryptography cxxheaderparser pcpp grpcio-tools "setuptools<81"`, symlink the app into `applications_user/`, then `FBT_NOENV=1 FBT_NO_SYNC=1 ./fbt COMPACT=1 DEBUG=0 --extra-define=_RETARGETABLE_LOCKING fap_lcd_sketch`. **The trap**: without `_RETARGETABLE_LOCKING`, Ubuntu's newlib headers do not declare `__retarget_lock_*`, the SDK check "removes" them from `api_symbols.csv` and bumps the API to a new MAJOR (87.1 → 88.0) — a `.fap` built on that would be refused by every real device on 87.x. Never accept that rewrite; `git checkout` the csv and pass the define (Flipper's own toolchain newlib is built with retargetable locking). `APPCHK` passing is the proof every imported symbol exists on the device. Maths comes from `libm`, which fbt links statically into every FAP, so `sinf`/`expf` need no export.

## Seeing it without a device

2026-09-23 — `flipper/tools/preview/preview.py <firmware checkout> out.png` compiles the app's draw callback on the host against the firmware's own `lib/u8g2` and fonts (stub `furi`/`gui` headers reimplement `canvas_*` as the firmware's `canvas.c` does) and lays frames out on one PNG. It is outside `lcd_sketch/` because fbt globs `*.c*` RECURSIVELY in the app directory. It caught the one real bug: `canvas_draw_rbox` under `ColorXOR` leaves light seams, because u8g2 builds a rounded box from overlapping discs and boxes and XOR inverts the overlaps twice — XOR a plain `canvas_draw_box` and flip the four corner dots instead.
