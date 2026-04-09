import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const userIds = [
        '403852911551053825',
        '343063201728036864'
    ];

    const normaDate = new Date('2026-04-02T00:00:00Z');

    console.log('--- STARTING NORMA SEED ---');
    
    for (const discordId of userIds) {
        const user = await prisma.user.upsert({
            where: { discordId },
            update: {
                hasNorma: true,
                normaLastUpdated: normaDate
            },
            create: {
                discordId,
                username: 'Ведущий (Seed)',
                hasNorma: true,
                normaLastUpdated: normaDate
            }
        });
        console.log(`✅ Status updated for user: ${discordId} (Status: ${user.hasNorma}, Date: ${user.normaLastUpdated})`);
    }

    console.log('--- SEED COMPLETED ---');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
