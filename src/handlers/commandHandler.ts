import { MyClient } from '../types';
import fs from 'fs';
import path from 'path';
import { REST, Routes } from 'discord.js';

export async function loadCommands(client: MyClient, deploy: boolean = false) {
    const commands: any[] = [];
    const commandsPath = path.join(__dirname, '../commands');
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.ts') || file.endsWith('.js'));

    for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file);
        const command = require(filePath).default;
        
        if ('data' in command && 'execute' in command) {
            client.commands.set(command.data.name, command);
            commands.push(command.data.toJSON());
        }
    }

    if (!deploy) return;

    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN!);

    try {
        console.log(`🔄 Начата регистрация ${commands.length} slash-команд...`);
        await rest.put(
            Routes.applicationGuildCommands(process.env.CLIENT_ID!, process.env.GUILD_ID!),
            { body: commands },
        );
        console.log('✅ Slash-команды успешно зарегистрированы!');
    } catch (error) {
        console.error(error);
    }
}
