import { Interaction } from 'discord.js';
import { MyClient } from '../index';

export default {
    name: 'interactionCreate',
    async execute(interaction: Interaction, client: MyClient) {
        if (!interaction.isChatInputCommand()) return;

        const command = client.commands.get(interaction.commandName);

        if (!command) return;

        try {
            await command.execute(interaction, client);
        } catch (error) {
            console.error(error);
            await interaction.reply({ content: 'Произошла ошибка при выполнении команды!', ephemeral: true });
        }
    },
};
