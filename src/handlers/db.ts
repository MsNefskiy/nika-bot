import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();

export function startDbHeartbeat(intervalMs = 4 * 60 * 1000) {
    setInterval(async () => {
        try {
            await prisma.$queryRaw`SELECT 1`;
        } catch {
            try {
                await prisma.$disconnect();
                await prisma.$connect();
            } catch {}
        }
    }, intervalMs);
}
