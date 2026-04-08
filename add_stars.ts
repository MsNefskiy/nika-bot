import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const DISCORD_ID = '472382706345312266';
    
    console.log(`🚀 Начинаю начисление звезд для ID: ${DISCORD_ID}...`);
    
    try {
        const user = await prisma.user.findUnique({
            where: { discordId: DISCORD_ID }
        });

        if (!user) {
            console.error('❌ Пользователь не найден в базе данных!');
            return;
        }

        const updatedUser = await prisma.user.update({
            where: { discordId: DISCORD_ID },
            data: { stars: { increment: 10000 } }
        });

        console.log(`✅ Успех!`);
        console.log(`👤 Пользователь: ${updatedUser.username}`);
        console.log(`✨ Звезд добавлено: 10 000`);
        console.log(`💰 Текущий баланс: ${updatedUser.stars}`);

    } catch (error) {
        console.error('❌ Произошла ошибка при выполнении скрипта:');
        console.error(error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
