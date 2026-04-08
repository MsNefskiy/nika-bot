import { 
    SlashCommandBuilder, 
    ChatInputCommandInteraction, 
    AttachmentBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle 
} from 'discord.js';
import { MyClient } from '../types';
import { CanvasHelper } from '../utils/canvasHelper';
import { prisma } from '../handlers/db';
import { isCurator } from '../utils/config';

export default {
    data: new SlashCommandBuilder()
        .setName('profile')
        .setNameLocalization('ru', 'профиль')
        .setDescription('Show your personal profile (Private)')
        .setDescriptionLocalization('ru', 'Показать ваш личный профиль (Приватно)'),
    async execute(interaction: ChatInputCommandInteraction, client: MyClient) {
        // Всегда показываем профиль автора команды
        const targetUser = interaction.user;
        const curatorStatus = isCurator(targetUser.id);

        // Получаем дату вступления на сервер
        const member = interaction.member as any; // GuildMember
        const joinedAt = member?.joinedAt || new Date();

        // Находим или создаем пользователя в БД
        const dbUser = await prisma.user.upsert({
            where: { discordId: targetUser.id },
            update: { username: targetUser.username, joinedAt },
            create: { 
                discordId: targetUser.id, 
                username: targetUser.username,
                joinedAt
            }
        });

        // Проверка Нормы (последние 2 недели)
        const twoWeeksAgo = new Date();
        twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

        const historyCount = await prisma.tribuneHistory.count({
            where: {
                hostId: targetUser.id,
                closedAt: { gte: twoWeeksAgo }
            }
        });

        const hasNorma = historyCount > 0;

        // Отрисовка профиля
        const avatarUrl = targetUser.displayAvatarURL({ extension: 'png' });
        const buffer = await CanvasHelper.drawProfileCard(
            targetUser.username, 
            avatarUrl,
            hasNorma, 
            dbUser.stars, 
            dbUser.joinedAt
        );
        const attachment = new AttachmentBuilder(buffer, { name: 'profile.png' });

        // --- КНОПКИ ---
        const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
                .setCustomId('view_tasks')
                .setLabel('Задания')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('view_shop')
                .setLabel('Магазин')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('view_tribune')
                .setLabel('Трибуны')
                .setStyle(ButtonStyle.Secondary)
        );

        const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
                .setCustomId('view_my_reprimands')
                .setLabel('Выговоры')
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId('view_history')
                .setLabel('История')
                .setStyle(ButtonStyle.Secondary)
        );

        const rows = [row1, row2];

        // Третий ряд: Админ-панель для кураторов
        if (curatorStatus) {
            const curatorRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder()
                    .setCustomId('admin_issue_reprimand')
                    .setLabel('Выдать выговор')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId('admin_remove_reprimand')
                    .setLabel('Снять выговор')
                    .setStyle(ButtonStyle.Secondary)
            );
            rows.push(curatorRow);
        }

        await interaction.reply({ files: [attachment], components: rows, ephemeral: true });
    },
};
