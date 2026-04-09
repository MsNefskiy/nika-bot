import { 
    SlashCommandBuilder, 
    ChatInputCommandInteraction, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle 
} from 'discord.js';
import { MyClient } from '../types';
import { prisma } from '../handlers/db';
import { TASK_MANAGER_IDS } from '../utils/config';

export default {
    data: new SlashCommandBuilder()
        .setName('tiktok')
        .setNameLocalization('ru', 'тикток')
        .setDescription('Manage TikTok submissions')
        .setDescriptionLocalization('ru', 'Управление ТикТоками')
        .addSubcommand(sub =>
            sub.setName('add')
                .setNameLocalization('ru', 'добавил')
                .setDescription('Register a new TikTok video')
                .setDescriptionLocalization('ru', 'Зарегистрировать новое видео')
                .addStringOption(opt =>
                    opt.setName('url')
                        .setDescription('Link to the video')
                        .setDescriptionLocalization('ru', 'Ссылка на видео')
                        .setRequired(true)
                )
        ),
    async execute(interaction: ChatInputCommandInteraction, client: MyClient) {
        const HOST_ROLE_ID = '1264275526865129613';
        
        // 1. Проверка роли
        const member = interaction.member as any;
        if (!member?.roles?.cache?.has(HOST_ROLE_ID)) {
            return interaction.reply({ 
                content: '❌ Эта команда доступна только Ведущим.', 
                ephemeral: true 
            });
        }

        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'add') {
            const url = interaction.options.getString('url', true);

            // Проверка валидности URL (базовая)
            if (!url.includes('tiktok.com')) {
                return interaction.reply({ 
                    content: '❌ Пожалуйста, укажите верную ссылку на TikTok.', 
                    ephemeral: true 
                });
            }

            // 2. Создаем запись в БД
            const tiktok = await prisma.tikTok.create({
                data: {
                    userId: interaction.user.id,
                    url,
                    status: 'PENDING'
                }
            });

            await interaction.reply({ 
                content: '✅ Видео отправлено на проверку кураторам! Ожидайте уведомления.', 
                ephemeral: true 
            });

            // 3. Уведомляем кураторов
            const embed = new EmbedBuilder()
                .setTitle('🎬 Новый ТикТок на проверку!')
                .setDescription(`Пользователь <@${interaction.user.id}> выложил видео:\n\n🔗 [Смотреть видео](${url})`)
                .setColor('#f0f0f0')
                .setTimestamp();

            const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder()
                    .setCustomId(`approve_tiktok_${tiktok.id}`)
                    .setLabel('Одобрить')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId(`deny_tiktok_${tiktok.id}`)
                    .setLabel('Отклонить')
                    .setStyle(ButtonStyle.Danger)
            );

            for (const managerId of TASK_MANAGER_IDS) {
                const manager = await client.users.fetch(managerId).catch(() => null);
                if (manager) {
                    await manager.send({ embeds: [embed], components: [row] }).catch(() => {});
                }
            }
        }
    },
};
