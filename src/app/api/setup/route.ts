import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

// GET /api/setup - Initialize database tables and migrate schema
export async function GET() {
  try {
    // Create Contract table if not exists (PostgreSQL syntax)
    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "Contract" (
        "id" TEXT NOT NULL,
        "contractNumber" TEXT NOT NULL,
        "agentCode" TEXT NOT NULL,
        "agentName" TEXT NOT NULL,
        "position" TEXT NOT NULL,
        "ban" TEXT NOT NULL,
        "nhom" TEXT NOT NULL,
        "maNhom" TEXT NOT NULL,
        "leaderAgentCode" TEXT NOT NULL DEFAULT '',
        "recruiterCode" TEXT NOT NULL DEFAULT '',
        "startDate" TIMESTAMP(3),
        "effectiveDate" TIMESTAMP(3) NOT NULL,
        "issueDate" TIMESTAMP(3) NOT NULL,
        "fyp" DOUBLE PRECISION NOT NULL,
        "afyp" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "tinhLuot" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "Contract_pkey" PRIMARY KEY ("id")
      );
    `);

    // Create Contest table if not exists (PostgreSQL syntax)
    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "Contest" (
        "id" TEXT NOT NULL,
        "title" TEXT NOT NULL,
        "startDate" TIMESTAMP(3) NOT NULL,
        "endDate" TIMESTAMP(3) NOT NULL,
        "issueDate" TIMESTAMP(3),
        "conditionType" TEXT NOT NULL DEFAULT 'per_contract',
        "targetType" TEXT NOT NULL DEFAULT 'tvv',
        "bonusTiers" TEXT NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "Contest_pkey" PRIMARY KEY ("id")
      );
    `);

    // Unique index on contractNumber
    await db.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "Contract_contractNumber_key" ON "Contract"("contractNumber");
    `);

    // MIGRATION: Add leaderAgentCode column if missing
    try {
      await db.$executeRawUnsafe(`
        ALTER TABLE "Contract" ADD COLUMN IF NOT EXISTS "leaderAgentCode" TEXT NOT NULL DEFAULT '';
      `);
    } catch { /* column already exists */ }

    // MIGRATION: Add recruiterCode column if missing (for existing databases)
    try {
      await db.$executeRawUnsafe(`
        ALTER TABLE "Contract" ADD COLUMN IF NOT EXISTS "recruiterCode" TEXT NOT NULL DEFAULT '';
      `);
    } catch { /* column already exists */ }

    // MIGRATION: Add startDate column if missing
    try {
      await db.$executeRawUnsafe(`
        ALTER TABLE "Contract" ADD COLUMN IF NOT EXISTS "startDate" TIMESTAMP(3);
      `);
    } catch { /* column already exists */ }

    // MIGRATION: Add tinhLuot column if missing
    try {
      await db.$executeRawUnsafe(`
        ALTER TABLE "Contract" ADD COLUMN IF NOT EXISTS "tinhLuot" DOUBLE PRECISION NOT NULL DEFAULT 0;
      `);
    } catch { /* column already exists */ }

    return NextResponse.json({
      success: true,
      message: 'Database tables created/migrated successfully!',
      tables: ['Contract', 'Contest'],
    });
  } catch (error) {
    console.error('Error setting up database:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
