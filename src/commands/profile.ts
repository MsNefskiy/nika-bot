import { SlashCommandBuilder, ChatInputCommandInteraction, AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { MyClient } from '../index';
import { CanvasHelper } from '../utils/canvasHelper';
import { prisma } from '../handlers/db';

export default {
    data: new SlashCommandBuilder()
        .setName('profile')
        .setNameLocalization('ru', 'профиль')
        .setDescription('Show your profile')
        .setDescriptionLocalization('ru', 'Показать ваш профиль'),
    async execute(interaction: ChatInputCommandInteraction, client: MyClient) {
        // Проверка Нормы (последние 2 недели)
        const twoWeeksAgo = new Date();
        twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

        const historyCount = await prisma.tribuneHistory.count({
            where: {
                hostId: interaction.user.id,
                closedAt: { gte: twoWeeksAgo }
            }
        });

        const hasNorma = historyCount > 0;

        // Отрисовка
        const buffer = await CanvasHelper.drawProfileCard(interaction.user.username, hasNorma);
        const attachment = new AttachmentBuilder(buffer, { name: 'profile.png' });

        // Кнопки
        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
                .setCustomId('view_tribune')
                .setLabel('Трибуны')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('view_history')
                .setLabel('История трибун')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('view_personal_history')
                .setLabel('Личная история')
                .setStyle(ButtonStyle.Secondary)
        );

        await interaction.reply({ files: [attachment], components: [row] });
    },
};
