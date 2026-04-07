import { Client, GatewayIntentBits, Collection } from 'discord.js';
import * as dotenv from 'dotenv';
import { loadEvents } from './handlers/eventHandler';
import { loadCommands } from './handlers/commandHandler';

dotenv.config();

export class MyClient extends Client {
    commands: Collection<string, any> = new Collection();
}

const client = new MyClient({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ],
});

client.once('ready', async () => {
    console.log(`✅ Бот ${client.user?.tag} запущен!`);
    await loadCommands(client);
    await loadEvents(client);
});

client.login(process.env.DISCORD_TOKEN);
