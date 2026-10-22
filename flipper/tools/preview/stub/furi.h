/* Host stubs: just enough of furi for lcd_sketch.c to compile and draw. */
#pragma once
#include <stdint.h>
#include <stdbool.h>
#include <stdlib.h>
#include <string.h>
#include <stdio.h>
#define UNUSED(x) (void)(x)
#define COUNT_OF(x) (sizeof(x) / sizeof(x[0]))
#define FuriWaitForever 0xFFFFFFFFu
typedef enum { FuriStatusOk = 0, FuriStatusError = -1 } FuriStatus;
typedef enum { FuriMutexTypeNormal } FuriMutexType;
typedef enum { FuriTimerTypeOnce, FuriTimerTypePeriodic } FuriTimerType;
typedef struct FuriMutex FuriMutex;
typedef struct FuriMessageQueue FuriMessageQueue;
typedef struct FuriTimer FuriTimer;
typedef void (*FuriTimerCallback)(void* context);
static inline FuriMutex* furi_mutex_alloc(FuriMutexType t) { UNUSED(t); return (FuriMutex*)1; }
static inline void furi_mutex_free(FuriMutex* m) { UNUSED(m); }
static inline FuriStatus furi_mutex_acquire(FuriMutex* m, uint32_t t) { UNUSED(m); UNUSED(t); return FuriStatusOk; }
static inline FuriStatus furi_mutex_release(FuriMutex* m) { UNUSED(m); return FuriStatusOk; }
static inline FuriMessageQueue* furi_message_queue_alloc(uint32_t n, uint32_t s) { UNUSED(n); UNUSED(s); return NULL; }
static inline void furi_message_queue_free(FuriMessageQueue* q) { UNUSED(q); }
static inline FuriStatus furi_message_queue_put(FuriMessageQueue* q, const void* m, uint32_t t) { UNUSED(q); UNUSED(m); UNUSED(t); return FuriStatusOk; }
static inline FuriStatus furi_message_queue_get(FuriMessageQueue* q, void* m, uint32_t t) { UNUSED(q); UNUSED(m); UNUSED(t); return FuriStatusError; }
static inline uint32_t furi_get_tick(void) { return 0; }
static inline uint32_t furi_kernel_get_tick_frequency(void) { return 1000; }
static inline uint32_t furi_ms_to_ticks(uint32_t ms) { return ms; }
static inline FuriTimer* furi_timer_alloc(FuriTimerCallback f, FuriTimerType t, void* c) { UNUSED(f); UNUSED(t); UNUSED(c); return NULL; }
static inline FuriStatus furi_timer_start(FuriTimer* t, uint32_t ticks) { UNUSED(t); UNUSED(ticks); return FuriStatusOk; }
static inline FuriStatus furi_timer_stop(FuriTimer* t) { UNUSED(t); return FuriStatusOk; }
static inline void furi_timer_free(FuriTimer* t) { UNUSED(t); }
#define RECORD_GUI "gui"
static inline void* furi_record_open(const char* n) { UNUSED(n); return NULL; }
static inline void furi_record_close(const char* n) { UNUSED(n); }
