import { 
    SlashCommandBuilder, 
    ChatInputCommandInteraction, 
    AttachmentBuilder 
} from 'discord.js';
import { MyClient } from '../types';
import { CanvasHelper } from '../utils/canvasHelper';
import { prisma } from '../handlers/db';

export default {
    data: new SlashCommandBuilder()
        .setName('info')
        .setNameLocalization('ru', 'инфо')
        .setDescription('View another user\'s profile card')
        .setDescriptionLocalization('ru', 'Посмотреть карточку другого пользователя')
        .addUserOption(option => 
            option.setName('user')
                .setNameLocalization('ru', 'пользователь')
                .setDescription('User to view')
                .setDescriptionLocalization('ru', 'Пользователь для просмотра')
                .setRequired(true)
        ),
    async execute(interaction: ChatInputCommandInteraction, client: MyClient) {
        const targetUser = interaction.options.getUser('user')!;

        // Получаем дату вступления на сервер
        const targetMember = await interaction.guild?.members.fetch(targetUser.id).catch(() => null);
        const joinedAt = targetMember?.joinedAt || new Date();

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

        // Проверка Нормы
        const twoWeeksAgo = new Date();
        twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
        const historyCount = await prisma.tribuneHistory.count({
            where: {
                hostId: targetUser.id,
                closedAt: { gte: twoWeeksAgo }
            }
        });
        const hasNorma = historyCount > 0;

        // Показ прогресса (deferred) так как генерация картинки может занять время
        await interaction.deferReply({ ephemeral: true });

        // Отрисовка
        const avatarUrl = targetUser.displayAvatarURL({ extension: 'png' });
        const member = interaction.member as any;
        const roleName = member?.roles?.highest?.name || 'Пользователь';

        const buffer = await CanvasHelper.drawProfileCard(
            targetUser.username, 
            avatarUrl,
            hasNorma, 
            dbUser.stars, 
            dbUser.joinedAt,
            roleName
        );
        const attachment = new AttachmentBuilder(buffer, { name: 'profile.png' });

        await interaction.editReply({ files: [attachment] });
    },
};
