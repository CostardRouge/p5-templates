/**
 * LCD Sketch: the Sketchbook's lcd-v1-flipper-zero animation, on the device.
 *
 * Six screens play in a loop, 4 s each, crossing through a Bayer-dithered
 * fade: a scrolling main menu, a frequency analyzer, a raw pulse capture, a
 * card read, a typed message and a dithered plasma. Everything on screen is
 * drawn from the animation clock and a seed, so nothing here touches a radio,
 * a card or a pin — it is an animation, not a tool.
 *
 * Buttons: Left / Right change screen, OK holds the current one (or resumes
 * the loop), Up inverts the display, Down re-rolls the seed (codes, noise,
 * card ID), Back exits.
 */
#include <furi.h>
#include <gui/gui.h>
#include <input/input.h>

#include <math.h>
#include <stdio.h>
#include <string.h>

#define SCREEN_W 128
#define SCREEN_H 64

#define FRAME_MS  33
#define SCENE_MS  4000
#define FADE_MS   360
#define TOAST_MS  1200

typedef enum {
    SceneMenu,
    SceneScanner,
    SceneSignal,
    SceneReader,
    SceneMessage,
    ScenePlasma,
    SceneCount,
} SceneId;

static const char* const SCENE_NAMES[SceneCount] = {
    "Main menu",
    "Freq. analyzer",
    "Raw capture",
    "Card reader",
    "Message",
    "Plasma",
};

typedef enum {
    AppEventTick,
    AppEventInput,
} AppEventType;

typedef struct {
    AppEventType type;
    InputEvent input;
} AppEvent;

typedef struct {
    FuriMutex* mutex;
    FuriMessageQueue* queue;

    uint32_t clock_ms; // animation clock, only ever moves forward
    uint32_t last_tick; // kernel tick of the previous frame
    uint32_t scene_start_ms; // clock_ms when the current scene began
    SceneId scene;
    bool cycling; // advance to the next scene every SCENE_MS
    bool fade_in; // the current scene arrived through the fade
    bool inverted;
    uint32_t seed;

    char toast[24];
    uint32_t toast_until_ms;
} App;

/* ------------------------------------------------------------------ */
/*  Small maths: an integer sine table, a hash, the Bayer matrix       */
/* ------------------------------------------------------------------ */

// 256 steps to the turn, amplitude 127. Filled once at start: sinf per pixel
// would cost the plasma its frame rate.
static int8_t sine_table[256];

static void sine_table_init(void) {
    for(int i = 0; i < 256; i++) {
        sine_table[i] = (int8_t)lroundf(127.0f * sinf((float)i * 2.0f * (float)M_PI / 256.0f));
    }
}

static inline int isin(int32_t phase) {
    return sine_table[phase & 255];
}

// Deterministic hash to [0, 1): every "random" value on screen comes from it,
// so a seed always draws the same codes and the same card.
static float hash01(uint32_t a, uint32_t b, uint32_t c) {
    uint32_t h = 0x811c9dc5u;
    uint32_t parts[3] = {a, b, c};
    for(int i = 0; i < 3; i++) {
        h ^= parts[i];
        h *= 0x01000193u;
        h ^= h >> 15;
        h *= 0x2c1b3c6du;
        h ^= h >> 12;
    }
    return (float)(h >> 8) / 16777216.0f;
}

static const uint8_t BAYER_8[64] = {
    0,  32, 8,  40, 2,  34, 10, 42, 48, 16, 56, 24, 50, 18, 58, 26, 12, 44, 4,  36, 14, 46,
    6,  38, 60, 28, 52, 20, 62, 30, 54, 22, 3,  35, 11, 43, 1,  33, 9,  41, 51, 19, 59, 27,
    49, 17, 57, 25, 15, 47, 7,  39, 13, 45, 5,  37, 63, 31, 55, 23, 61, 29, 53, 21,
};

static inline uint8_t bayer(int x, int y) {
    return BAYER_8[((y & 7) << 3) | (x & 7)];
}

static inline float clamp01(float v) {
    return v < 0.0f ? 0.0f : (v > 1.0f ? 1.0f : v);
}

static inline float smooth(float v) {
    return v * v * (3.0f - 2.0f * v);
}

/* ------------------------------------------------------------------ */
/*  Drawing helpers                                                    */
/* ------------------------------------------------------------------ */

// 10 x 10 icons as rows of '#' (ink) and '.' (transparent): readable in source.
typedef const char* const Icon10[10];

static void draw_rows(Canvas* canvas, const char* const* rows, int count, int x, int y) {
    for(int row = 0; row < count; row++) {
        for(int col = 0; rows[row][col]; col++) {
            if(rows[row][col] == '#') canvas_draw_dot(canvas, x + col, y + row);
        }
    }
}

// A soft-key hint along the bottom edge: an inked tab, the label in paper.
static void soft_key(Canvas* canvas, const char* label, Align align) {
    canvas_set_font(canvas, FontSecondary);
    int width = canvas_string_width(canvas, label) + 7;
    int x = align == AlignLeft ? 0 : (align == AlignRight ? SCREEN_W - width : (SCREEN_W - width) / 2);
    canvas_set_color(canvas, ColorBlack);
    canvas_draw_rbox(canvas, x, SCREEN_H - 12, width, 13, 2);
    canvas_set_color(canvas, ColorWhite);
    canvas_draw_str(canvas, x + 4, SCREEN_H - 2, label);
    canvas_set_color(canvas, ColorBlack);
}

/* ------------------------------------------------------------------ */
/*  Main menu                                                          */
/* ------------------------------------------------------------------ */

static Icon10 ICON_SUBGHZ = {".#......#.", "#..#..#..#", "#.#....#.#", "#.#.##.#.#", "#.#.##.#.#",
                             "#..#..#..#", ".#..##..#.", "....##....", "....##....", "...####..."};
static Icon10 ICON_RFID = {"##########", "#........#", "#.######.#", "#.#....#.#", "#.#.##.#.#",
                           "#.#.##.#.#", "#.#....#.#", "#.######.#", "#........#", "##########"};
static Icon10 ICON_NFC = {".......#..", "....#...#.", ".#...#..#.", "..#..#...#", "..#..#...#",
                          "..#..#...#", "..#..#...#", ".#...#..#.", "....#...#.", ".......#.."};
static Icon10 ICON_INFRARED = {"..####....", ".#....#...", ".#.##.#.#.", ".#....#..#", ".#.##.#.#.",
                               ".#....#..#", ".#.##.#.#.", ".#....#...", ".#....#...", "..####...."};
static Icon10 ICON_GPIO = {"..#.#.#...", ".#######..", "##.....##.", ".#.....#..", "##.....##.",
                           ".#.....#..", "##.....##.", ".#######..", "..#.#.#...", ".........."};
static Icon10 ICON_IBUTTON = {"...####...", "..#....#..", ".#..##..#.", ".#.#..#.#.", ".#.#..#.#.",
                              ".#..##..#.", "..#....#..", "...####...", "....##....", "....##...."};
static Icon10 ICON_BADUSB = {"..######..", "..#.##.#..", "..#....#..", ".########.", ".#......#.",
                             ".#......#.", ".#......#.", ".#......#.", ".########.", ".........."};
static Icon10 ICON_U2F = {"##########", "#........#", "#...##...#", "#..#..#..#", "#...##...#",
                          ".#..##..#.", ".#..##..#.", "..#....#..", "...#..#...", "....##...."};
static Icon10 ICON_APPS = {"####..####", "#..#..#..#", "#..#..#..#", "####..####", "..........",
                           "..........", "####..####", "#..#..#..#", "#..#..#..#", "####..####"};
static Icon10 ICON_SETTINGS = {"....##....", ".#.####.#.", "..######..", ".###..###.", "####..####",
                               "####..####", ".###..###.", "..######..", ".#.####.#.", "....##...."};

static const char* const CHECK_ICON[8] = {
    ".........#", "........##", ".......##.", "#.....##..",
    "##...##...", ".##.##....", "..###.....", "...#......"};

typedef struct {
    const char* label;
    const char* const* icon;
} MenuItem;

static const MenuItem MENU[] = {
    {"Sub-GHz", ICON_SUBGHZ},
    {"RFID", ICON_RFID},
    {"NFC", ICON_NFC},
    {"Infrared", ICON_INFRARED},
    {"GPIO", ICON_GPIO},
    {"iButton", ICON_IBUTTON},
    {"Bad USB", ICON_BADUSB},
    {"U2F", ICON_U2F},
    {"Apps", ICON_APPS},
    {"Settings", ICON_SETTINGS},
};
#define MENU_COUNT   ((int)COUNT_OF(MENU))
#define MENU_ROW     16
#define MENU_VISIBLE 4
#define MENU_STEP_MS 650

static int menu_index_at(int32_t step) {
    const int moves = 2 * (MENU_COUNT - 1);
    int wrapped = ((step % moves) + moves) % moves;
    return wrapped <= MENU_COUNT - 1 ? wrapped : moves - wrapped;
}

// The cursor walks down the list and back up, gliding then dwelling on each
// row; the list scrolls to keep it on the second row once past the first.
static void scene_menu(Canvas* canvas, uint32_t t, uint32_t seed) {
    UNUSED(seed);
    int32_t step = t / MENU_STEP_MS;
    float glide = smooth(clamp01((float)(t % MENU_STEP_MS) / (MENU_STEP_MS * 0.35f)));
    float position =
        menu_index_at(step) + (menu_index_at(step + 1) - menu_index_at(step)) * glide;
    float top = position - 1.0f;
    if(top < 0.0f) top = 0.0f;
    if(top > MENU_COUNT - MENU_VISIBLE) top = MENU_COUNT - MENU_VISIBLE;

    canvas_set_font(canvas, FontSecondary);
    for(int i = 0; i < MENU_COUNT; i++) {
        int y = (int)lroundf((i - top) * MENU_ROW);
        if(y <= -MENU_ROW || y >= SCREEN_H) continue;
        draw_rows(canvas, MENU[i].icon, 10, 4, y + 3);
        canvas_draw_str(canvas, 19, y + 12, MENU[i].label);
    }

    // XOR a plain box, then XOR its corner pixels back to round it. Not
    // canvas_draw_rbox: u8g2 builds it from overlapping discs and boxes, and
    // under XOR the overlaps invert twice and leave light seams at both ends.
    int bar_y = (int)lroundf((position - top) * MENU_ROW) + 1;
    canvas_set_color(canvas, ColorXOR);
    canvas_draw_box(canvas, 1, bar_y, 118, 14);
    canvas_draw_dot(canvas, 1, bar_y);
    canvas_draw_dot(canvas, 118, bar_y);
    canvas_draw_dot(canvas, 1, bar_y + 13);
    canvas_draw_dot(canvas, 118, bar_y + 13);
    canvas_set_color(canvas, ColorBlack);

    // Scrollbar: a dotted track and a thumb sized to the visible share.
    for(int y = 0; y < SCREEN_H; y += 2)
        canvas_draw_dot(canvas, 124, y);
    int thumb = SCREEN_H * MENU_VISIBLE / MENU_COUNT;
    int thumb_y = (int)lroundf(top / (MENU_COUNT - MENU_VISIBLE) * (SCREEN_H - thumb));
    canvas_draw_box(canvas, 123, thumb_y, 3, thumb);
}

/* ------------------------------------------------------------------ */
/*  Frequency analyzer                                                 */
/* ------------------------------------------------------------------ */

#define BAND_MIN      300.0f
#define BAND_MAX      928.0f
#define BINS          62
#define SPECTRUM_BASE 52
#define SPECTRUM_H    34

static const float EMITTERS[] = {315.00f, 433.92f, 868.35f};

static inline float bin_of(float mhz) {
    return (mhz - BAND_MIN) / (BAND_MAX - BAND_MIN) * (BINS - 1);
}

static inline int x_of_bin(float bin) {
    return 2 + (int)lroundf(bin) * 2;
}

// A spectrum sweeping the band: a noise floor re-rolled 12 times a second,
// and emitters keying up in bursts. The readout locks onto the strongest.
static void scene_scanner(Canvas* canvas, uint32_t t, uint32_t seed) {
    uint32_t tick = t / 83;
    uint32_t burst = tick / 7;
    bool on[COUNT_OF(EMITTERS)];
    float strength[COUNT_OF(EMITTERS)];
    int locked = -1;

    for(size_t e = 0; e < COUNT_OF(EMITTERS); e++) {
        on[e] = hash01(seed, e, burst * 16 + 11) > 0.42f;
        strength[e] = 0.6f + 0.4f * hash01(seed, e, tick * 16 + 7);
        if(on[e] && (locked < 0 || strength[e] > strength[locked])) locked = e;
    }

    char readout[16];
    if(locked >= 0) {
        // Integer formatting: no dependency on the printf float support.
        unsigned hundredths = (unsigned)lroundf(EMITTERS[locked] * 100.0f) % 100000u;
        snprintf(readout, sizeof(readout), "%u.%02u", hundredths / 100, hundredths % 100);
    } else {
        snprintf(readout, sizeof(readout), "---.--");
    }
    canvas_set_font(canvas, FontBigNumbers);
    canvas_draw_str(canvas, 1, 15, readout);
    int end = 1 + canvas_string_width(canvas, readout);
    canvas_set_font(canvas, FontSecondary);
    canvas_draw_str(canvas, end + 3, 15, "MHz");

    // Signal strength: five rising bars, lit up to the locked emitter's level.
    int level = locked >= 0 ? (int)lroundf(strength[locked] * 5.0f) : 0;
    for(int bar = 0; bar < 5; bar++) {
        int height = 3 + bar * 2;
        int x = 110 + bar * 3;
        if(bar < level) {
            canvas_draw_box(canvas, x, 14 - height, 2, height);
        } else {
            canvas_draw_line(canvas, x, 13, x + 1, 13);
        }
    }

    for(int bin = 0; bin < BINS; bin++) {
        float amplitude = 1.0f + hash01(seed, bin, tick) * 4.0f;
        for(size_t e = 0; e < COUNT_OF(EMITTERS); e++) {
            if(!on[e]) continue;
            float d = (bin - bin_of(EMITTERS[e])) / 1.3f;
            amplitude += strength[e] * SPECTRUM_H * expf(-d * d);
        }
        int height = (int)lroundf(amplitude);
        if(height > SPECTRUM_H) height = SPECTRUM_H;
        int x = x_of_bin(bin);
        canvas_draw_line(canvas, x, SPECTRUM_BASE - height + 1, x, SPECTRUM_BASE);
    }

    // Marker over the locked peak.
    if(locked >= 0) {
        int x = x_of_bin(bin_of(EMITTERS[locked]));
        int peak = (int)lroundf(1.0f + strength[locked] * SPECTRUM_H);
        if(peak > SPECTRUM_H) peak = SPECTRUM_H;
        int y = SPECTRUM_BASE - peak - 4;
        canvas_draw_line(canvas, x - 2, y, x + 2, y);
        canvas_draw_line(canvas, x - 1, y + 1, x + 1, y + 1);
        canvas_draw_dot(canvas, x, y + 2);
    }

    canvas_draw_line(canvas, 0, SPECTRUM_BASE + 1, SCREEN_W - 1, SPECTRUM_BASE + 1);
    for(int mhz = 300; mhz <= 900; mhz += 100) {
        int x = x_of_bin(bin_of(mhz));
        canvas_draw_line(canvas, x, SPECTRUM_BASE + 2, x, SPECTRUM_BASE + 3);
    }
    canvas_draw_str(canvas, 0, SCREEN_H, "300");
    canvas_draw_str_aligned(canvas, SCREEN_W, SCREEN_H, AlignRight, AlignBottom, "928");
}

/* ------------------------------------------------------------------ */
/*  Raw signal capture                                                 */
/* ------------------------------------------------------------------ */

#define CODE_BITS  24
#define PULSE_UNIT 2
// 24 bits of 4 units each, then a 1-unit sync pulse and a 14-unit gap.
#define TRAIN_LEN  ((CODE_BITS * 4 + 15) * PULSE_UNIT)
#define WAVE_HIGH  15
#define WAVE_LOW   42

// One transmission of a fixed-code remote, one level per pixel: pulse-width
// coding (a long high for 1, a short high for 0), then the sync gap.
static bool train_level(uint32_t seed, int position) {
    int unit = (position % TRAIN_LEN) / PULSE_UNIT;
    int bit = unit / 4;
    if(bit < CODE_BITS) {
        bool one = hash01(seed, bit, 41) > 0.5f;
        return (unit % 4) < (one ? 3 : 1);
    }
    return unit == CODE_BITS * 4;
}

static void scene_signal(Canvas* canvas, uint32_t t, uint32_t seed) {
    int offset = (int)(t * 50 / 1000);

    canvas_set_font(canvas, FontSecondary);
    canvas_draw_str(canvas, 1, 8, "433.92  AM650");
    if((t / 500) % 2 == 0) canvas_draw_disc(canvas, 104, 4, 2);
    canvas_draw_str_aligned(canvas, SCREEN_W - 1, 8, AlignRight, AlignBottom, "REC");
    canvas_draw_line(canvas, 0, 10, SCREEN_W - 1, 10);

    const int middle = (WAVE_HIGH + WAVE_LOW) / 2;
    for(int x = 0; x < SCREEN_W; x += 4)
        canvas_draw_dot(canvas, x, middle);

    bool previous = train_level(seed, offset);
    for(int x = 0; x < SCREEN_W; x++) {
        bool level = train_level(seed, x + offset);
        canvas_draw_dot(canvas, x, level ? WAVE_HIGH : WAVE_LOW);
        if(x > 0 && level != previous) canvas_draw_line(canvas, x, WAVE_HIGH, x, WAVE_LOW);
        previous = level;
    }

    soft_key(canvas, "Erase", AlignLeft);
    soft_key(canvas, "Stop", AlignCenter);
    soft_key(canvas, "Save", AlignRight);
}

/* ------------------------------------------------------------------ */
/*  Card reader                                                        */
/* ------------------------------------------------------------------ */

#define READING_MS 2200

static uint8_t hex_byte(uint32_t seed, uint32_t index) {
    return (uint8_t)(hash01(seed, index, 97) * 256.0f);
}

// Waiting for a card, waves pulsing out of it; then the read, typed out.
static void scene_reader(Canvas* canvas, uint32_t t, uint32_t seed) {
    t %= SCENE_MS;
    canvas_set_font(canvas, FontSecondary);

    if(t < READING_MS) {
        int lit = (t / 210) % 4;
        canvas_draw_rframe(canvas, 4, 20, 28, 20, 3);
        canvas_draw_frame(canvas, 8, 25, 8, 7);
        canvas_draw_line(canvas, 12, 28, 15, 28);
        canvas_draw_line(canvas, 19, 26, 27, 26);
        canvas_draw_line(canvas, 19, 29, 25, 29);
        canvas_draw_line(canvas, 8, 35, 27, 35);

        // Arcs: only the right-hand side of each circle, as waves leaving the card.
        for(int wave = 0; wave < lit; wave++) {
            int r = 5 + wave * 6;
            for(int a = -45; a <= 45; a += 3) {
                float rad = (float)a * (float)M_PI / 180.0f;
                canvas_draw_dot(canvas, 33 + (int)lroundf(r * cosf(rad)), 30 + (int)lroundf(r * sinf(rad)));
            }
        }

        canvas_draw_str(canvas, 58, 19, "Reading");
        int end = 58 + canvas_string_width(canvas, "Reading");
        for(int dot = 0; dot < lit; dot++)
            canvas_draw_dot(canvas, end + 2 + dot * 3, 18);
        canvas_draw_str(canvas, 58, 37, "Hold card");
        canvas_draw_str(canvas, 58, 47, "next to back");
        return;
    }

    char lines[3][24];
    snprintf(
        lines[0],
        sizeof(lines[0]),
        "UID: 04 %02X %02X %02X",
        hex_byte(seed, 1),
        hex_byte(seed, 2),
        hex_byte(seed, 3));
    snprintf(lines[1], sizeof(lines[1]), "ATQA: 00 %02X", hex_byte(seed, 8));
    snprintf(lines[2], sizeof(lines[2]), "SAK: %02X", hex_byte(seed, 9));

    canvas_draw_box(canvas, 0, 0, SCREEN_W, 11);
    canvas_set_color(canvas, ColorWhite);
    canvas_draw_str(canvas, 3, 9, "Card detected");
    draw_rows(canvas, CHECK_ICON, 8, SCREEN_W - 13, 2);
    canvas_set_color(canvas, ColorBlack);

    // Typed out over the first 900 ms of the result.
    int revealed = (int)((t - READING_MS) / 30);
    for(int i = 0; i < 3 && revealed > 0; i++) {
        char shown[24];
        int length = strlen(lines[i]);
        int count = revealed < length ? revealed : length;
        memcpy(shown, lines[i], count);
        shown[count] = '\0';
        canvas_draw_str(canvas, 3, 21 + i * 10, shown);
        revealed -= length;
    }

    soft_key(canvas, "Retry", AlignLeft);
    soft_key(canvas, "More", AlignRight);
}

/* ------------------------------------------------------------------ */
/*  Typed message                                                      */
/* ------------------------------------------------------------------ */

static const char* const MESSAGE = "Hack the planet!";
#define TYPE_MS 70

// The message typed out, word-wrapped, then held with a blinking block cursor.
static void scene_message(Canvas* canvas, uint32_t t, uint32_t seed) {
    UNUSED(seed);
    t %= SCENE_MS;
    canvas_set_font(canvas, FontPrimary);

    // Wrap into at most four lines of at most 31 characters.
    char lines[4][32];
    int line_count = 0;
    lines[0][0] = '\0';
    const char* word = MESSAGE;
    while(*word && line_count < 4) {
        const char* space = strchr(word, ' ');
        int word_len = space ? (int)(space - word) : (int)strlen(word);
        if(word_len > 30) word_len = 30;
        // The line with this word appended, built by bounded copies.
        char candidate[64];
        size_t current = strlen(lines[line_count]);
        size_t length = current;
        memcpy(candidate, lines[line_count], current);
        if(current) candidate[length++] = ' ';
        memcpy(candidate + length, word, word_len);
        length += word_len;
        candidate[length] = '\0';
        if(current && (length > 31 || canvas_string_width(canvas, candidate) > SCREEN_W - 12)) {
            if(++line_count >= 4) break;
            memcpy(lines[line_count], word, word_len);
            lines[line_count][word_len] = '\0';
        } else {
            memcpy(lines[line_count], candidate, length + 1);
        }
        word += word_len;
        while(*word == ' ')
            word++;
    }
    if(line_count < 4) line_count++;

    const int leading = 14;
    int top = (SCREEN_H - line_count * leading) / 2 + 10;
    int revealed = t / TYPE_MS;
    int total = 0;
    for(int i = 0; i < line_count; i++)
        total += strlen(lines[i]);
    bool typing = revealed < total;
    int cursor_x = 4, cursor_y = top;

    for(int i = 0; i < line_count && revealed >= 0; i++) {
        int length = strlen(lines[i]);
        int count = revealed < length ? revealed : length;
        char shown[32];
        memcpy(shown, lines[i], count);
        shown[count] = '\0';
        int y = top + i * leading;
        canvas_draw_str(canvas, 4, y, shown);
        if(revealed <= length) {
            cursor_x = 4 + canvas_string_width(canvas, shown) + (count ? 2 : 0);
            cursor_y = y;
        }
        revealed -= length;
    }

    if(typing || (t / 400) % 2 == 0) canvas_draw_box(canvas, cursor_x, cursor_y - 9, 6, 10);
}

/* ------------------------------------------------------------------ */
/*  Dithered plasma                                                    */
/* ------------------------------------------------------------------ */

// A sum of travelling sines folded into bands, then ordered-dithered to one
// bit. Integer phases: 256 per turn, one turn of the slowest term per 4 s.
static void scene_plasma(Canvas* canvas, uint32_t t, uint32_t seed) {
    UNUSED(seed);
    int32_t turn = (int32_t)((t % 4000) * 256 / 4000);
    float cx = SCREEN_W / 2 + 34.0f * isin(turn + 64) / 127.0f;
    float cy = SCREEN_H / 2 + 14.0f * isin(2 * turn) / 127.0f;

    for(int y = 0; y < SCREEN_H; y++) {
        float dy = (y - cy) * 1.4f;
        for(int x = 0; x < SCREEN_W; x++) {
            float dx = x - cx;
            int32_t distance = (int32_t)(sqrtf(dx * dx + dy * dy) * 6.5f);
            int32_t value = isin((x * 367) / 100 + 2 * turn) + isin((y * 65) / 10 - turn) +
                            isin(((x + 2 * y) * 183) / 100 + 3 * turn) + isin(distance - 2 * turn);
            int level = 128 + isin(value / 2); // 1 .. 255
            if(level > bayer(x, y) * 4 + 2) canvas_draw_dot(canvas, x, y);
        }
    }
}

typedef void (*SceneDraw)(Canvas* canvas, uint32_t t, uint32_t seed);

static const SceneDraw SCENES[SceneCount] = {
    scene_menu,
    scene_scanner,
    scene_signal,
    scene_reader,
    scene_message,
    scene_plasma,
};

/* ------------------------------------------------------------------ */
/*  App                                                                */
/* ------------------------------------------------------------------ */

// Clears the pixels whose Bayer threshold is under `amount` (0..1): a 1-bit
// fade to the empty screen.
static void dither_clear(Canvas* canvas, float amount) {
    int threshold = (int)(amount * 64.0f);
    if(threshold <= 0) return;
    canvas_set_color(canvas, ColorWhite);
    for(int y = 0; y < SCREEN_H; y++) {
        for(int x = 0; x < SCREEN_W; x++) {
            if(bayer(x, y) < threshold) canvas_draw_dot(canvas, x, y);
        }
    }
    canvas_set_color(canvas, ColorBlack);
}

static void draw_callback(Canvas* canvas, void* context) {
    App* app = context;

    furi_mutex_acquire(app->mutex, FuriWaitForever);
    App snapshot = *app;
    furi_mutex_release(app->mutex);

    uint32_t elapsed = snapshot.clock_ms - snapshot.scene_start_ms;

    canvas_clear(canvas);
    canvas_set_color(canvas, ColorBlack);
    SCENES[snapshot.scene](canvas, elapsed, snapshot.seed);

    // Fade out at the end of a scene when the loop is running, and in at the
    // start of a scene the loop brought in.
    if(snapshot.cycling && elapsed > SCENE_MS - FADE_MS / 2) {
        dither_clear(canvas, (float)(elapsed - (SCENE_MS - FADE_MS / 2)) / (FADE_MS / 2));
    } else if(snapshot.fade_in && elapsed < FADE_MS / 2) {
        dither_clear(canvas, 1.0f - (float)elapsed / (FADE_MS / 2));
    }

    if(snapshot.clock_ms < snapshot.toast_until_ms) {
        canvas_set_font(canvas, FontSecondary);
        int width = canvas_string_width(canvas, snapshot.toast) + 10;
        int x = (SCREEN_W - width) / 2;
        canvas_set_color(canvas, ColorWhite);
        canvas_draw_rbox(canvas, x - 1, 23, width + 2, 17, 3);
        canvas_set_color(canvas, ColorBlack);
        canvas_draw_rframe(canvas, x, 24, width, 15, 3);
        canvas_draw_str_aligned(canvas, SCREEN_W / 2, 32, AlignCenter, AlignCenter, snapshot.toast);
    }

    if(snapshot.inverted) {
        canvas_set_color(canvas, ColorXOR);
        canvas_draw_box(canvas, 0, 0, SCREEN_W, SCREEN_H);
        canvas_set_color(canvas, ColorBlack);
    }
}

static void input_callback(InputEvent* input_event, void* context) {
    App* app = context;
    AppEvent event = {.type = AppEventInput, .input = *input_event};
    furi_message_queue_put(app->queue, &event, FuriWaitForever);
}

static void tick_callback(void* context) {
    App* app = context;
    AppEvent event = {.type = AppEventTick};
    // Never block the timer thread: a dropped tick only delays one frame.
    furi_message_queue_put(app->queue, &event, 0);
}

static void show_toast(App* app, const char* text) {
    strlcpy(app->toast, text, sizeof(app->toast));
    app->toast_until_ms = app->clock_ms + TOAST_MS;
}

static void go_to_scene(App* app, int scene, bool fade_in) {
    app->scene = (SceneId)((scene % SceneCount + SceneCount) % SceneCount);
    app->scene_start_ms = app->clock_ms;
    app->fade_in = fade_in;
}

static void advance_clock(App* app) {
    uint32_t now = furi_get_tick();
    uint32_t delta = (now - app->last_tick) * 1000 / furi_kernel_get_tick_frequency();
    app->last_tick = now;
    app->clock_ms += delta;

    if(app->cycling && app->clock_ms - app->scene_start_ms >= SCENE_MS) {
        go_to_scene(app, app->scene + 1, true);
    }
}

// Returns false when the app should exit.
static bool handle_input(App* app, const InputEvent* input) {
    if(input->key == InputKeyBack) {
        return input->type != InputTypeShort && input->type != InputTypeLong;
    }
    if(input->type != InputTypePress && input->type != InputTypeRepeat) return true;

    switch(input->key) {
    case InputKeyLeft:
    case InputKeyRight:
        go_to_scene(app, app->scene + (input->key == InputKeyRight ? 1 : -1), false);
        show_toast(app, SCENE_NAMES[app->scene]);
        break;
    case InputKeyOk:
        app->cycling = !app->cycling;
        // Resuming restarts the current scene so it gets its full 4 s.
        if(app->cycling) app->scene_start_ms = app->clock_ms;
        show_toast(app, app->cycling ? "Loop: on" : "Loop: hold");
        break;
    case InputKeyUp:
        app->inverted = !app->inverted;
        break;
    case InputKeyDown: {
        app->seed = app->seed * 1103515245u + 12345u;
        char text[24];
        snprintf(text, sizeof(text), "Seed %lu", (unsigned long)(app->seed % 1000));
        show_toast(app, text);
        break;
    }
    default:
        break;
    }
    return true;
}

int32_t lcd_sketch_main(void* p) {
    UNUSED(p);
    sine_table_init();

    App* app = malloc(sizeof(App));
    memset(app, 0, sizeof(App));
    app->mutex = furi_mutex_alloc(FuriMutexTypeNormal);
    app->queue = furi_message_queue_alloc(8, sizeof(AppEvent));
    app->last_tick = furi_get_tick();
    app->cycling = true;
    app->seed = 7;
    app->scene = SceneMenu;

    ViewPort* view_port = view_port_alloc();
    view_port_draw_callback_set(view_port, draw_callback, app);
    view_port_input_callback_set(view_port, input_callback, app);

    Gui* gui = furi_record_open(RECORD_GUI);
    gui_add_view_port(gui, view_port, GuiLayerFullscreen);

    FuriTimer* timer = furi_timer_alloc(tick_callback, FuriTimerTypePeriodic, app);
    furi_timer_start(timer, furi_ms_to_ticks(FRAME_MS));

    AppEvent event;
    bool running = true;
    while(running) {
        if(furi_message_queue_get(app->queue, &event, FuriWaitForever) != FuriStatusOk) continue;

        furi_mutex_acquire(app->mutex, FuriWaitForever);
        if(event.type == AppEventTick) {
            advance_clock(app);
        } else {
            running = handle_input(app, &event.input);
        }
        furi_mutex_release(app->mutex);

        view_port_update(view_port);
    }

    furi_timer_stop(timer);
    furi_timer_free(timer);
    view_port_enabled_set(view_port, false);
    gui_remove_view_port(gui, view_port);
    view_port_free(view_port);
    furi_record_close(RECORD_GUI);
    furi_message_queue_free(app->queue);
    furi_mutex_free(app->mutex);
    free(app);

    return 0;
}
