import {
  PrismaClient
} from "@/generated/prisma";

import {
  PrismaPg
} from "@prisma/adapter-pg";

const globalForPrisma = global as unknown as {
  prisma: PrismaClient;
};

// Prisma 7 ships a Rust-free client that connects through a driver adapter
// instead of reading the datasource URL from the schema. The pool is created
// lazily and only dials the database on the first query, so this is safe to
// evaluate at import time (e.g. during `next build`) even without DATABASE_URL.
const adapter = new PrismaPg( {
  connectionString: process.env.DATABASE_URL
} );

export const prisma = globalForPrisma.prisma || new PrismaClient( {
  adapter
} );

if ( process.env.NODE_ENV !== "production" ) {
  globalForPrisma.prisma = prisma;
}
