/* Renders lcd_sketch.c's draw callback at chosen instants into PBM frames. */
#include "../../lcd_sketch/lcd_sketch.c"

static const u8x8_display_info_t INFO = {.tile_width = 16, .tile_height = 8, .pixel_width = 128, .pixel_height = 64};
static uint8_t display_cb(u8x8_t* u8x8, uint8_t msg, uint8_t arg_int, void* arg_ptr) {
    UNUSED(arg_int); UNUSED(arg_ptr);
    if(msg == U8X8_MSG_DISPLAY_SETUP_MEMORY) u8x8_d_helper_display_setup_memory(u8x8, &INFO);
    return 1;
}
static uint8_t buffer[128 * 8];

int main(int argc, char** argv) {
    /* args: out.pbm scene elapsed_ms cycling fade_in inverted seed [toast] */
    Canvas canvas;
    u8x8_Setup(u8g2_GetU8x8(&canvas.fb), display_cb, u8x8_cad_empty, u8x8_byte_empty, u8x8_dummy_cb);
    u8g2_SetupBuffer(&canvas.fb, buffer, 8, u8g2_ll_hvline_vertical_top_lsb, U8G2_R0);
    sine_table_init();
    App app = {0};
    app.scene = atoi(argv[2]);
    app.clock_ms = 100000 + atoi(argv[3]);
    app.scene_start_ms = 100000;
    app.cycling = atoi(argv[4]);
    app.fade_in = atoi(argv[5]);
    app.inverted = atoi(argv[6]);
    app.seed = atoi(argv[7]);
    if(argc > 8) { strlcpy(app.toast, argv[8], sizeof(app.toast)); app.toast_until_ms = app.clock_ms + 1; }
    draw_callback(&canvas, &app);
    FILE* f = fopen(argv[1], "w");
    fprintf(f, "P1\n128 64\n");
    for(int y = 0; y < 64; y++) {
        for(int x = 0; x < 128; x++) fputc((buffer[(y / 8) * 128 + x] >> (y % 8)) & 1 ? '1' : '0', f);
        fputc('\n', f);
    }
    fclose(f);
    return 0;
}
