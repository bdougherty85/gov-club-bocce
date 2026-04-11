import { PrismaClient } from '@/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  pool: pg.Pool | undefined;
};

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is not set');
  }

  // Create or reuse a connection pool
  if (!globalForPrisma.pool) {
    // Configure SSL for production (Render requires SSL)
    const ssl = process.env.NODE_ENV === 'production'
      ? { rejectUnauthorized: false }
      : undefined;

    globalForPrisma.pool = new pg.Pool({
      connectionString,
      ssl,
    });
  }

  const adapter = new PrismaPg(globalForPrisma.pool);
  return new PrismaClient({ adapter });
}

if (!globalForPrisma.prisma) {
  globalForPrisma.prisma = createPrismaClient();
}

export const prisma = globalForPrisma.prisma;
export default prisma;
