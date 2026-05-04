#!/usr/bin/env node

/**
 * Auto-generate VAPID keys for web push notifications if not already set
 * This script checks for existing keys and generates new ones if needed
 */

import webpush from "web-push";
import {
  readFileSync, writeFileSync, existsSync
} from "fs";
import {
  join
} from "path";

const {
  generateVAPIDKeys
} = webpush;

const ENV_FILE = join(
  process.cwd(),
  ".env"
);

function generateKeys() {
  console.log( "🔑 Generating VAPID keys for push notifications..." );

  const vapidKeys = generateVAPIDKeys();

  console.log( "✅ VAPID keys generated successfully!" );
  console.log(
    "\nPublic Key:",
    vapidKeys.publicKey
  );
  console.log(
    "Private Key:",
    vapidKeys.privateKey
  );

  return vapidKeys;
}

function updateEnvFile(
  publicKey, privateKey
) {
  let envContent = "";

  // Read existing .env if it exists
  if ( existsSync( ENV_FILE ) ) {
    envContent = readFileSync(
      ENV_FILE,
      "utf-8"
    );

    // Check if keys already exist
    const hasPublicKey = /^NEXT_PUBLIC_VAPID_PUBLIC_KEY=/m.test( envContent );
    const hasPrivateKey = /^VAPID_PRIVATE_KEY=/m.test( envContent );

    if ( hasPublicKey && hasPrivateKey ) {
      console.log( "ℹ️  VAPID keys already exist in .env file. Skipping..." );
      return false;
    }

    // Update existing keys or append new ones
    if ( hasPublicKey ) {
      envContent = envContent.replace(
        /^NEXT_PUBLIC_VAPID_PUBLIC_KEY=.*/m,
        `NEXT_PUBLIC_VAPID_PUBLIC_KEY=${ publicKey }`
      );
    } else {
      envContent += `\nNEXT_PUBLIC_VAPID_PUBLIC_KEY=${ publicKey }`;
    }

    if ( hasPrivateKey ) {
      envContent = envContent.replace(
        /^VAPID_PRIVATE_KEY=.*/m,
        `VAPID_PRIVATE_KEY=${ privateKey }`
      );
    } else {
      envContent += `\nVAPID_PRIVATE_KEY=${ privateKey }`;
    }
  } else {
    // Create new .env file from .env.example
    if ( existsSync( join(
      process.cwd(),
      ".env.example"
    ) ) ) {
      envContent = readFileSync(
        join(
          process.cwd(),
          ".env.example"
        ),
        "utf-8"
      );

      // Replace placeholder keys
      envContent = envContent.replace(
        /^NEXT_PUBLIC_VAPID_PUBLIC_KEY=.*/m,
        `NEXT_PUBLIC_VAPID_PUBLIC_KEY=${ publicKey }`
      );
      envContent = envContent.replace(
        /^VAPID_PRIVATE_KEY=.*/m,
        `VAPID_PRIVATE_KEY=${ privateKey }`
      );
    } else {
      envContent = `NEXT_PUBLIC_VAPID_PUBLIC_KEY=${ publicKey }\nVAPID_PRIVATE_KEY=${ privateKey }\n`;
    }
  }

  writeFileSync(
    ENV_FILE,
    envContent
  );
  console.log( "✅ .env file updated with new VAPID keys" );
  return true;
}

function main() {
  console.log( "🚀 VAPID Key Generator for Push Notifications\n" );

  // Check if running in Docker and keys are provided via environment
  const hasEnvKeys = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY;

  if ( hasEnvKeys ) {
    console.log( "✅ VAPID keys found in environment variables" );
    return;
  }

  // Generate new keys
  const {
    publicKey, privateKey
  } = generateKeys();

  // Update .env file
  const updated = updateEnvFile(
    publicKey,
    privateKey
  );

  if ( updated ) {
    console.log( "\n📝 Next steps:" );
    console.log( "   1. Restart your application to use the new keys" );
    console.log( "   2. If using Docker, rebuild your containers" );
  }
}

main();
