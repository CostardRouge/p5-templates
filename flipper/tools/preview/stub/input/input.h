#pragma once
typedef enum { InputKeyUp, InputKeyDown, InputKeyRight, InputKeyLeft, InputKeyOk, InputKeyBack } InputKey;
typedef enum { InputTypePress, InputTypeRelease, InputTypeShort, InputTypeLong, InputTypeRepeat } InputType;
typedef struct { uint32_t sequence; InputKey key; InputType type; } InputEvent;
