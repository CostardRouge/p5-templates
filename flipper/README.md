# Flipper Zero app: LCD Sketch

`lcd_sketch/` is a Flipper Zero application (a `.fap`) that plays the animation of the web sketch
`p5/lcd/lcd-v1-flipper-zero` on the device's own screen. Six screens loop, 4 s each, through a
dithered fade: a scrolling main menu, a frequency analyzer, a raw pulse capture, a card read, a
typed message and a dithered plasma.

It is an animation only: every value on screen comes from a clock and a seed. It never touches a
radio, an NFC/RFID reader, infrared or a GPIO pin.

| Button | Action |
| --- | --- |
| Left / Right | Previous / next screen |
| OK | Hold the current screen, or resume the loop |
| Up | Invert the display |
| Down | New seed (other codes, noise and card ID) |
| Back | Exit |

## Install

A `.fap` is tied to the firmware's API version. The build attached to the pull request targets the
official firmware **1.4.3 (API 87.1)**, and runs on any official firmware with API 87.x:

1. Copy `lcd_sketch.fap` to the SD card under `apps/Media/`, with qFlipper (File manager) or a
   card reader.
2. On the Flipper: **Apps → Media → LCD Sketch**.

For any other firmware (another official release, Momentum, Unleashed…), build it for that firmware
with [ufbt](https://github.com/flipperdevices/flipperzero-ufbt):

```bash
pip install ufbt
cd flipper/lcd_sketch
ufbt update --channel=release   # or the SDK your firmware uses: ufbt update --help
ufbt                            # builds dist/lcd_sketch.fap
ufbt launch                     # with the Flipper plugged in over USB: installs and starts it
```

## Preview on a desktop

`tools/preview/` renders frames without a device. It compiles the app's draw code against the
firmware's own u8g2 library and fonts, and lays the frames out on one PNG:

```bash
git clone --depth 1 --branch 1.4.3 https://github.com/flipperdevices/flipperzero-firmware
python3 flipper/tools/preview/preview.py flipperzero-firmware preview.png   # needs gcc + Pillow
```

It is kept outside `lcd_sketch/` on purpose: ufbt compiles every C file in the app directory.
