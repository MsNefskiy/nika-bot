import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function addStars() {
    const userId = '472382706345312266';
    try {
        await prisma.user.update({
            where: { discordId: userId },
            data: { stars: { increment: 10000 } }
        });
        console.log('✅ 10 000 звезд успешно начислено!');
    } catch (e) {
        console.error('❌ Ошибка начисления:', e);
    } finally {
        await prisma.$disconnect();
    }
}

addStars();
