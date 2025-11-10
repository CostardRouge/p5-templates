# Quick Start: PWA & Notifications

Get your PWA up and running in 3 steps!

## Step 1: Generate VAPID Keys (Required)

```bash
node scripts/generate-vapid-keys.mjs
```

Copy the output and create/update your `.env` file with:

```env
NEXT_PUBLIC_VAPID_PUBLIC_KEY=BNxxx...
VAPID_PRIVATE_KEY=xxx...
```

## Step 2: Create Icons (Required)

### Quick Option - Placeholder SVGs:
```bash
node scripts/create-placeholder-icons.mjs
```

Then convert to PNG or use proper icons for production.

### Better Option - Use a Generator:
1. Visit https://realfavicongenerator.net/
2. Upload your logo
3. Download the generated icons
4. Place `icon-192x192.png` and `icon-512x512.png` in `public/`

## Step 3: Install Dependencies & Run

```bash
npm install
npm run dev
```

## Test It Out!

1. Open your app in the browser
2. Look for the bell icon 🔔 in the bottom navigation
3. Click "Enable Notifications"
4. Allow notifications when prompted
5. Click "Test" to send a test notification
6. Start a recording job and get notified when it completes!

## Testing with HTTPS (Recommended)

For full PWA features:

```bash
npm run dev -- --experimental-https
```

Visit `https://localhost:3000` (accept the certificate warning)

## That's It! 🎉

Your app is now a PWA with push notifications. Users will be notified when:
- ✅ Recording jobs complete
- ❌ Recording jobs fail

---

For more details, see:
- `PWA_IMPLEMENTATION_SUMMARY.md` - Full implementation details
- `SETUP_PWA.md` - Complete setup guide
- `public/ICON_INSTRUCTIONS.md` - Icon creation help
