# Push Notification Setup Guide

This guide explains how to set up web push notifications for your NAS deployment.

## Quick Start

### Option 1: Auto-Generate on Startup (Recommended for NAS)

The Docker container will automatically generate VAPID keys on first startup if they're not provided. However, **these keys will be regenerated each time the container restarts**, which means users will need to re-subscribe to notifications.

To persist keys across restarts, see Option 2 or 3.

### Option 2: Generate and Persist Keys

1. **Generate keys locally:**
   ```bash
   npm run setup:notifications
   ```

2. **Copy the generated keys** from your `.env` file

3. **Add them to your `docker-compose.yml`:**
   ```yaml
   services:
     app:
       environment:
         - NEXT_PUBLIC_VAPID_PUBLIC_KEY=BBpPJLkutVoWuLUtHE3jwIBSIFWFW4bqcMNLVFm0Sj_KRWwPPnCjNgHcMdsZHrs6Oh0sSvN9zuF7dmd37aVwyLc
         - VAPID_PRIVATE_KEY=jxHckSlId2G0M9rtWUGdCWWSTm0FFpP99QFlio8DGhk
   ```

4. **Restart your containers:**
   ```bash
   docker-compose up -d --build
   ```

### Option 3: Mount .env File

1. **Generate keys locally:**
   ```bash
   npm run setup:notifications
   ```

2. **Mount your .env file in docker-compose.yml:**
   ```yaml
   services:
     app:
       volumes:
         - ./prisma:/app/prisma
         - ./.env:/app/.env:ro  # Add this line
   ```

3. **Restart your containers:**
   ```bash
   docker-compose up -d --build
   ```

## How It Works

### VAPID Keys

VAPID (Voluntary Application Server Identification) keys are used to identify your application when sending push notifications. They consist of:

- **Public Key**: Shared with the browser when users subscribe to notifications
- **Private Key**: Kept secret on your server, used to sign notification requests

### Auto-Generation Process

When the Docker container starts, the `docker-entrypoint.sh` script:

1. Checks if `NEXT_PUBLIC_VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` are set
2. If not found, generates new keys using the `web-push` library
3. Exports them as environment variables for the current session
4. Displays the keys in the container logs with a warning to persist them

### Scripts

- **`scripts/generate-vapid-keys.mjs`**: Node.js script that generates keys and updates .env
- **`scripts/setup-notifications.sh`**: Bash wrapper for easier setup
- **`docker-entrypoint.sh`**: Modified to auto-generate keys on container startup

## Verification

After setup, verify notifications are working:

1. **Check container logs:**
   ```bash
   docker-compose logs app | grep VAPID
   ```

   You should see:
   ```
   ✅ VAPID keys found in environment
   ```

2. **Test in browser:**
   - Open your app in a browser
   - Look for notification permission prompts
   - Subscribe to notifications
   - Trigger a test notification

## Troubleshooting

### Keys regenerate on every restart

**Problem:** Users need to re-subscribe after each container restart.

**Solution:** Persist keys using Option 2 or 3 above.

### "VAPID keys not found" warning

**Problem:** Keys aren't being passed to the container.

**Solution:** 
- Check your docker-compose.yml environment section
- Verify .env file is mounted correctly
- Rebuild containers: `docker-compose up -d --build`

### Notifications not working

**Problem:** Notifications fail to send.

**Solution:**
1. Check browser console for errors
2. Verify VAPID keys are set: `docker-compose exec app env | grep VAPID`
3. Ensure HTTPS is enabled (required for push notifications in production)
4. Check that the public key matches between server and client

## Security Notes

- **Never commit** your VAPID private key to version control
- Keep `.env` in `.gitignore`
- Use environment variables or secrets management for production
- Rotate keys periodically for security

## For Development

For local development, simply run:

```bash
npm run setup:notifications
npm run dev
```

The keys will be stored in your local `.env` file and persist across restarts.
