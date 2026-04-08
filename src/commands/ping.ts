import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { MyClient } from '../types';

export default {
    data: new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Проверить задержку бота'),
    async execute(interaction: ChatInputCommandInteraction, client: MyClient) {
        await interaction.reply(`🏓 Понг! Задержка: ${client.ws.ping}мс`);
    },
};
