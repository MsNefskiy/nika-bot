import { Client, GatewayIntentBits, Collection } from 'discord.js';
import * as dotenv from 'dotenv';
import { loadEvents } from './handlers/eventHandler';
import { loadCommands } from './handlers/commandHandler';
import { MyClient } from './types';
import http from 'http';

// Просто сервер для прохождения Health Check на Render
const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Bot is running\n');
}).listen(PORT, () => {
    console.log(`📡 Health Check сервер запущен на порту ${PORT}`);
});

dotenv.config();

const client = new MyClient({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
    ],
});

client.once('ready', async () => {
    console.log(`✅ Бот ${client.user?.tag} запущен!`);
    
    // Проверяем флаг --deploy для регистрации команд
    const shouldDeploy = process.argv.includes('--deploy');
    await loadCommands(client, shouldDeploy);
    
    await loadEvents(client);
});

client.login(process.env.DISCORD_TOKEN);
