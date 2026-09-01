/**
 * How to hide an `<input type="file">` that is opened programmatically.
 *
 * NOT `hidden` / `display: none`. iOS Safari refuses to open the picker for a
 * scripted `.click()` on a file input that is not rendered, and it fails
 * silently — the tap simply does nothing, with no error anywhere. Every file
 * input in this app is styled and driven by something else (a drop zone, a
 * button), so every one of them hit that, and none of it is reproducible in
 * Chromium: the emulated mobile context opens the picker from a `display: none`
 * input quite happily.
 *
 * `sr-only` keeps the element in the render tree at 1x1px, clipped and out of
 * flow — invisible and layout-neutral, but real enough for WebKit to act on.
 * It also leaves the input reachable by keyboard and assistive tech, which
 * `hidden` did not.
 */
export const HIDDEN_FILE_INPUT_CLASS = "sr-only";
