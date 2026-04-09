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
import { isAdmin } from '../utils/config';

export default {
    data: new SlashCommandBuilder()
        .setName('profile')
        .setNameLocalization('ru', 'профиль')
        .setDescription('Show your personal profile (Private)')
        .setDescriptionLocalization('ru', 'Показать ваш личный профиль (Приватно)'),
    async execute(interaction: ChatInputCommandInteraction, client: MyClient) {
        // Всегда показываем профиль автора команды
        const targetUser = interaction.user;
        const curatorStatus = isAdmin(targetUser.id);

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

        // Проверка Нормы (14 дней)
        let hasNorma = false;
        if (dbUser.hasNorma && dbUser.normaLastUpdated) {
            const twoWeeksInMs = 14 * 24 * 60 * 60 * 1000;
            const timePassed = new Date().getTime() - dbUser.normaLastUpdated.getTime();
            if (timePassed < twoWeeksInMs) {
                hasNorma = true;
            }
        }

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
            const curatorRow1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder()
                    .setCustomId('admin_issue_reprimand')
                    .setLabel('Выдать выговор')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId('admin_remove_reprimand')
                    .setLabel('Снять выговор')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('admin_norma_manage')
                    .setLabel('🔧 Управление нормой')
                    .setStyle(ButtonStyle.Primary)
            );

            const curatorRow2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder()
                    .setCustomId('admin_view_host_list')
                    .setLabel('📋 Список ведущих')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId('admin_view_norms')
                    .setLabel('Норма ведущих')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('admin_view_tiktok_norms')
                    .setLabel('Норма ТикТоков')
                    .setStyle(ButtonStyle.Secondary)
            );

            rows.push(curatorRow1, curatorRow2);
        }

        await interaction.reply({ files: [attachment], components: rows, ephemeral: true });
    },
};
