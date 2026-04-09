import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const discordId = '1271591410294063185';

    console.log('--- STARTING NORMA REMOVAL ---');
    
    const user = await prisma.user.update({
        where: { discordId },
        data: {
            hasNorma: false,
            normaLastUpdated: null
        }
    }).catch(() => null);

    if (user) {
        console.log(`✅ Status REMOVED for user: ${discordId}`);
    } else {
        console.log(`❌ User ${discordId} not found in database.`);
    }

    console.log('--- REMOVAL COMPLETED ---');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
