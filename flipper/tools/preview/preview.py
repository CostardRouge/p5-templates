"""Render LCD Sketch frames on a desktop, through the firmware's own u8g2 and fonts.

There is no Flipper emulator, but everything the app draws goes through
canvas_* calls, which the firmware implements on u8g2. stub/ reimplements
those calls on the firmware's u8g2 copy (lib/u8g2), render.c includes the
app's source and calls its draw callback at a chosen instant, and this script
compiles it and lays the frames out on one PNG.

    python3 preview.py /path/to/flipperzero-firmware out.png

Needs gcc and Pillow. The firmware checkout only provides lib/u8g2.
"""
import pathlib
import subprocess
import sys

from PIL import Image

HERE = pathlib.Path(__file__).resolve().parent

# (scene, elapsed_ms, cycling, fade_in, inverted, seed, toast)
SHOTS = [
    (0, 300, 1, 0, 0, 7, ""),
    (0, 4200, 0, 0, 0, 7, ""),
    (0, 3900, 1, 0, 0, 7, ""),
    (1, 1000, 1, 0, 0, 7, ""),
    (1, 60, 1, 1, 0, 7, ""),
    (2, 1500, 1, 0, 0, 7, ""),
    (3, 900, 1, 0, 0, 7, ""),
    (3, 3500, 1, 0, 0, 7, ""),
    (4, 600, 1, 0, 0, 7, ""),
    (4, 3000, 1, 0, 0, 7, ""),
    (5, 1000, 1, 0, 0, 7, ""),
    (5, 2500, 1, 0, 1, 7, ""),
    (1, 1000, 0, 0, 0, 7, "Freq. analyzer"),
    (3, 3500, 1, 0, 0, 42, ""),
]


def main(firmware: str, out: str) -> None:
    u8g2 = pathlib.Path(firmware) / "lib" / "u8g2"
    sources = [str(p) for p in sorted(u8g2.glob("u8*.c")) if "glue" not in p.name]
    binary = HERE / "render"
    subprocess.run(
        ["gcc", "-std=gnu2x", "-O1", "-ffunction-sections", "-fdata-sections", "-Wl,--gc-sections",
         "-Wall", "-Wextra", "-Wno-unused-function", "-Wno-unused-parameter",
         f"-I{HERE / 'stub'}", f"-I{u8g2}", "-o", str(binary), str(HERE / "render.c"), *sources, "-lm"],
        check=True,
    )

    scale, pad, cols = 3, 6, 4
    rows = (len(SHOTS) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * (128 * scale + pad), rows * (64 * scale + pad)), (40, 40, 40))
    for index, (scene, elapsed, cycling, fade_in, inverted, seed, toast) in enumerate(SHOTS):
        frame = HERE / f"frame_{index}.pbm"
        args = [str(binary), str(frame), *map(str, (scene, elapsed, cycling, fade_in, inverted, seed))]
        subprocess.run(args + ([toast] if toast else []), check=True)
        image = Image.open(frame).convert("L")
        frame.unlink()
        # Ink is black in the PBM: draw it as dark crystal on the orange backlight.
        lcd = Image.new("RGB", image.size)
        lcd.putdata([(255, 130, 0) if value else (22, 12, 4) for value in image.getdata()])
        lcd = lcd.resize((128 * scale, 64 * scale), Image.NEAREST)
        sheet.paste(lcd, ((index % cols) * (128 * scale + pad), (index // cols) * (64 * scale + pad)))
    binary.unlink()
    sheet.save(out)
    print(f"{len(SHOTS)} frames -> {out}")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
