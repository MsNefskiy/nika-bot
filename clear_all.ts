import { REST, Routes } from 'discord.js';
import * as dotenv from 'dotenv';
dotenv.config();

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN!);

async function clearCommands() {
    try {
        console.log('🧹 Начинаю очистку всех команд...');

        // 1. Очистка Глобальных команд
        await rest.put(Routes.applicationCommands(process.env.CLIENT_ID!), { body: [] });
        console.log('✅ Глобальные команды удалены!');

        // 2. Очистка Серверных команд
        await rest.put(Routes.applicationGuildCommands(process.env.CLIENT_ID!, process.env.GUILD_ID!), { body: [] });
        console.log('✅ Серверные команды удалены!');

        console.log('\n✨ Теперь просто перезапусти бота, чтобы он загрузил свежие команды!');
    } catch (error) {
        console.error('❌ Ошибка при очистке:', error);
    }
}

clearCommands();
