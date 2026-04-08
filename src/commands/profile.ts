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
        // Находим или создаем пользователя
        const user = await prisma.user.upsert({
            where: { discordId: interaction.user.id },
            update: { username: interaction.user.username },
            create: { 
                discordId: interaction.user.id, 
                username: interaction.user.username,
                joinedAt: new Date()
            }
        });

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
        const avatarUrl = interaction.user.displayAvatarURL({ extension: 'png' });
        const buffer = await CanvasHelper.drawProfileCard(
            interaction.user.username, 
            avatarUrl,
            hasNorma, 
            user.stars, 
            user.joinedAt
        );
        const attachment = new AttachmentBuilder(buffer, { name: 'profile.png' });

        // Кнопки
        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
                .setCustomId('view_tasks')
                .setLabel('Задания')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('view_tribune')
                .setLabel('Трибуны')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('view_history')
                .setLabel('История')
                .setStyle(ButtonStyle.Secondary)
        );

        await interaction.reply({ files: [attachment], components: [row] });
    },
};
