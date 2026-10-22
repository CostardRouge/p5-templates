/* Host Canvas: the firmware's canvas.c calls, on the firmware's own u8g2 and fonts. */
#pragma once
#include <furi.h>
#include <input/input.h>
#include <u8g2.h>
typedef enum { ColorWhite = 0x00, ColorBlack = 0x01, ColorXOR = 0x02 } Color;
typedef enum { FontPrimary, FontSecondary, FontKeyboard, FontBigNumbers, FontTotalNumber } Font;
typedef enum { AlignLeft, AlignRight, AlignTop, AlignBottom, AlignCenter } Align;
typedef struct Canvas { u8g2_t fb; } Canvas;
static inline void canvas_clear(Canvas* c) { u8g2_ClearBuffer(&c->fb); }
static inline void canvas_set_color(Canvas* c, Color color) { u8g2_SetDrawColor(&c->fb, color); }
static inline void canvas_set_font(Canvas* c, Font font) {
    u8g2_SetFontMode(&c->fb, 1);
    if(font == FontPrimary) u8g2_SetFont(&c->fb, u8g2_font_helvB08_tr);
    else if(font == FontSecondary) u8g2_SetFont(&c->fb, u8g2_font_haxrcorp4089_tr);
    else if(font == FontKeyboard) u8g2_SetFont(&c->fb, u8g2_font_profont11_mr);
    else u8g2_SetFont(&c->fb, u8g2_font_profont22_tn);
}
static inline void canvas_draw_str(Canvas* c, int32_t x, int32_t y, const char* s) { if(s) u8g2_DrawUTF8(&c->fb, x, y, s); }
static inline uint16_t canvas_string_width(Canvas* c, const char* s) { return s ? u8g2_GetUTF8Width(&c->fb, s) : 0; }
static inline void canvas_draw_str_aligned(Canvas* c, int32_t x, int32_t y, Align h, Align v, const char* s) {
    if(!s) return;
    if(h == AlignRight) x -= u8g2_GetUTF8Width(&c->fb, s);
    else if(h == AlignCenter) x -= u8g2_GetUTF8Width(&c->fb, s) / 2;
    if(v == AlignTop) y += u8g2_GetAscent(&c->fb);
    else if(v == AlignCenter) y += u8g2_GetAscent(&c->fb) / 2;
    u8g2_DrawUTF8(&c->fb, x, y, s);
}
static inline void canvas_draw_dot(Canvas* c, int32_t x, int32_t y) { u8g2_DrawPixel(&c->fb, x, y); }
static inline void canvas_draw_box(Canvas* c, int32_t x, int32_t y, size_t w, size_t h) { u8g2_DrawBox(&c->fb, x, y, w, h); }
static inline void canvas_draw_rbox(Canvas* c, int32_t x, int32_t y, size_t w, size_t h, size_t r) { u8g2_DrawRBox(&c->fb, x, y, w, h, r); }
static inline void canvas_draw_frame(Canvas* c, int32_t x, int32_t y, size_t w, size_t h) { u8g2_DrawFrame(&c->fb, x, y, w, h); }
static inline void canvas_draw_rframe(Canvas* c, int32_t x, int32_t y, size_t w, size_t h, size_t r) { u8g2_DrawRFrame(&c->fb, x, y, w, h, r); }
static inline void canvas_draw_line(Canvas* c, int32_t x1, int32_t y1, int32_t x2, int32_t y2) { u8g2_DrawLine(&c->fb, x1, y1, x2, y2); }
static inline void canvas_draw_disc(Canvas* c, int32_t x, int32_t y, size_t r) { u8g2_DrawDisc(&c->fb, x, y, r, U8G2_DRAW_ALL); }
typedef struct ViewPort ViewPort;
typedef struct Gui Gui;
typedef enum { GuiLayerFullscreen } GuiLayer;
typedef void (*ViewPortDrawCallback)(Canvas*, void*);
typedef void (*ViewPortInputCallback)(InputEvent*, void*);
static inline ViewPort* view_port_alloc(void) { return NULL; }
static inline void view_port_free(ViewPort* v) { UNUSED(v); }
static inline void view_port_draw_callback_set(ViewPort* v, ViewPortDrawCallback cb, void* c) { UNUSED(v); UNUSED(cb); UNUSED(c); }
static inline void view_port_input_callback_set(ViewPort* v, ViewPortInputCallback cb, void* c) { UNUSED(v); UNUSED(cb); UNUSED(c); }
static inline void view_port_update(ViewPort* v) { UNUSED(v); }
static inline void view_port_enabled_set(ViewPort* v, bool e) { UNUSED(v); UNUSED(e); }
static inline void gui_add_view_port(Gui* g, ViewPort* v, GuiLayer l) { UNUSED(g); UNUSED(v); UNUSED(l); }
static inline void gui_remove_view_port(Gui* g, ViewPort* v) { UNUSED(g); UNUSED(v); }
