import type {
  PrismaConfig
} from "prisma/config";

// Prisma 7 no longer reads the datasource `url` from `schema.prisma`, and its
// CLI no longer auto-loads `.env`. The running Next.js app loads `.env` on its
// own; for CLI commands (generate / migrate / studio) we load it here when
// present. Guarded so CI, Docker and any environment that already exports the
// variables directly (no `.env` file) is left untouched.
import {
  existsSync
} from "node:fs";

if ( existsSync( ".env" ) && typeof process.loadEnvFile === "function" ) {
  process.loadEnvFile( ".env" );
}

export default {
  schema: "prisma/schema.prisma",
  datasource: {
    // Resolved lazily from the environment instead of `env("DATABASE_URL")`,
    // which throws when the variable is unset (e.g. `prisma generate` during
    // install / Docker build, which never connects to the database).
    url: process.env.DATABASE_URL ?? ""
  }
} satisfies PrismaConfig;
