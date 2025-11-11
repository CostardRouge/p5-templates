# Quick Migration Steps

## What Was Done

Push notifications are now controlled by the `BACKEND_RECORDING` environment variable.

## Files Modified

1. ✅ `src/services/NotificationService.ts` - Implemented DB storage + env check
2. ✅ `src/lib/recordSketch.ts` - Added notification calls
3. ✅ `prisma/schema.prisma` - Added PushSubscription model

## Next Steps

### 1. Generate Prisma Client

```bash
npx prisma generate
```

### 2. Run Migration (if using PostgreSQL)

```bash
npx prisma migrate dev --name add_push_subscriptions
```

### 3. Test It

1. Set `BACKEND_RECORDING=true` in `.env`
2. Start app: `npm run dev`
3. Click bell icon in menu bar
4. Grant permissions
5. Start a recording
6. Get notified when complete! 🎉

## Toggle Notifications

- **Enable**: `BACKEND_RECORDING=true`
- **Disable**: `BACKEND_RECORDING=false`

That's it! The system is ready to use.
