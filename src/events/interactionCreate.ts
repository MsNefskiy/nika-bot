import { 
    Interaction, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    StringSelectMenuBuilder, 
    StringSelectMenuOptionBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    AttachmentBuilder,
    EmbedBuilder,
    ButtonInteraction,
    StringSelectMenuInteraction,
    ModalSubmitInteraction,
    UserSelectMenuInteraction
} from 'discord.js';
import { MyClient } from '../types';
import { prisma } from '../handlers/db';
import { CanvasHelper } from '../utils/canvasHelper';
import { tasks } from '../utils/tasks';
import { 
    ADMIN_IDS, 
    TASK_MANAGER_IDS, 
    SHOP_MANAGER_IDS, 
    isAdmin, 
    isTaskManager, 
    isShopManager, 
    isStar,
    isAdmin as isCurator, 
    REPRIMAND_ROLE_ID 
} from '../utils/config';
import { shopItems } from '../utils/shop';
import { getHosts } from '../utils/hostCache';

export default {
    name: 'interactionCreate',
    async execute(interaction: Interaction, client: MyClient) {
        try {
            if (interaction.isChatInputCommand()) {
                const command = client.commands.get(interaction.commandName);
                if (!command) return;
                await command.execute(interaction, client);
            }

            if (interaction.isButton()) {
                const id = interaction.customId;

                // --- ПРОФИЛЬ И ТРИБУНЫ ---
                if (id === 'view_tribune') return await renderTribuneView(interaction);
                if (id === 'create_event') return await showEventSelector(interaction);
                if (id.startsWith('join_')) {
                    const parts = id.split('_');
                    const slot = `slot${parts[1]}_${parts[2]}`;
                    return await joinSlot(interaction, slot);
                }
                if (id === 'leave_tribune') return await handleLeaveRequest(interaction);
                if (id === 'complete_tribune') return await completeTribune(interaction);
                if (id === 'cancel_tribune') return await cancelTribune(interaction);
                
                // --- ЗАДАНИЯ ---
                if (id === 'view_tasks') return await handleTasksView(interaction);
                if (id === 'submit_task') return await submitTaskToCurators(interaction, client);
                if (id.startsWith('approve_task_')) return await approveTask(interaction, id.split('_')[2], client);
                if (id.startsWith('deny_task_')) return await denyTask(interaction, id.split('_')[2], client);

                // --- ВЫГОВОРЫ ---
                if (id === 'view_my_reprimands') return await viewMyReprimands(interaction);
                if (id === 'admin_issue_reprimand') return await initiateReprimandIssue(interaction);
                if (id === 'admin_remove_reprimand') return await initiateReprimandRemove(interaction);

                // --- МАГАЗИН ---
                if (id === 'view_shop') return await handleShopView(interaction);
                if (id.startsWith('confirm_buy:')) return await processPurchase(interaction, id.split(':')[1], client);

                // --- УПРАВЛЕНИЕ НОРМОЙ (АДМИН) ---
                if (id.startsWith('admin_view_host_list')) {
                    const page = parseInt(id.split(':')[1]) || 0;
                    return await viewDetailedHostList(interaction as ButtonInteraction, page);
                }
                if (id === 'admin_norma_manage') return await startNormaManage(interaction as ButtonInteraction);
                if (id === 'admin_reprimand_manage') return await startReprimandManage(interaction as ButtonInteraction);
                if (id.startsWith('norma_action:')) return await chooseNormaType(interaction as ButtonInteraction, id.split(':')[1]);
                if (id.startsWith('norma_type:')) return await chooseNormaUser(interaction as ButtonInteraction, id.split(':')[1], id.split(':')[2]);
                if (id.startsWith('reprimand_action:')) return await chooseReprimandUser(interaction as ButtonInteraction, id.split(':')[1]);
                if (id.startsWith('confirm_norma_remove:')) {
                    const [, type, targetId] = id.split(':');
                    return await finalizeNormaRemove(interaction as ButtonInteraction, type, targetId);
                }

                // --- СОБЕСЕДОВАНИЯ ---
                if (id === 'admin_interview_start') return await startInterviewModal(interaction as ButtonInteraction);
                if (id === 'admin_interview_history') return await viewInterviewHistory(interaction as ButtonInteraction);
                if (id.startsWith('int_q:')) {
                    const [, targetId, qIdx, score, showAns] = id.split(':');
                    return await renderInterviewQuestion(interaction as ButtonInteraction, targetId, parseInt(qIdx), parseFloat(score), showAns === '1');
                }
                if (id.startsWith('int_tab:')) {
                    const [, tab, targetId, qIdx, score] = id.split(':');
                    if (tab === 'q') return await renderInterviewQuestion(interaction as ButtonInteraction, targetId, parseInt(qIdx), parseFloat(score), false);
                    if (tab === 't') return await renderInterviewText(interaction as ButtonInteraction, targetId, parseInt(qIdx), parseFloat(score));
                }
                if (id.startsWith('int_rate:')) {
                    const [, targetId, qIdx, score, rate] = id.split(':');
                    const newScore = parseFloat(score) + parseFloat(rate);
                    return await renderInterviewQuestion(interaction as ButtonInteraction, targetId, parseInt(qIdx) + 1, newScore, false);
                }
                if (id.startsWith('int_finish:')) {
                    const [, status, targetId, score] = id.split(':');
                    return await finalizeInterview(interaction as ButtonInteraction, targetId, parseFloat(score), status as 'PASS' | 'FAIL');
                }

                // --- УДАЛЕНИЕ ИСТОРИИ ---
                if (id.startsWith('history_delete_all:')) {
                    const [, type, targetId] = id.split(':');
                    return await confirmDeleteAllHistory(interaction as ButtonInteraction, type, targetId);
                }
                if (id.startsWith('confirm_delete_all:')) {
                    const [, type, targetId] = id.split(':');
                    return await executeDeleteAllHistory(interaction as ButtonInteraction, type, targetId);
                }
                if (id.startsWith('confirm_delete_single:')) {
                    const [, type, targetId, entryId] = id.split(':');
                    return await executeDeleteSingleHistory(interaction as ButtonInteraction, type, targetId, entryId);
                }
                
                // --- ИСТОРИЯ (ОБЩЕЕ) ---
                if (id === 'view_history') return await viewHistory(interaction as ButtonInteraction, true);
                if (id === 'view_personal_history') return await viewHistory(interaction as ButtonInteraction, true);
                if (id === 'admin_view_history_global') return await viewHistory(interaction as ButtonInteraction, false);
                if (id === 'clear_history') return await clearHistory(interaction as ButtonInteraction);

                // --- ТИКТОКИ (ОДОБРЕНИЕ) ---
                if (id.startsWith('approve_tiktok_')) return await approveTikTok(interaction as ButtonInteraction, id.split('_')[2], client);
                if (id.startsWith('deny_tiktok_')) return await denyTikTok(interaction as ButtonInteraction, id.split('_')[2], client);
            }


            if (interaction.isStringSelectMenu()) {
                if (interaction.customId.startsWith('norma_user_select:')) {
                    const [, action, type] = interaction.customId.split(':');
                    await handleNormaUserSelection(interaction as StringSelectMenuInteraction, action, type, (interaction as StringSelectMenuInteraction).values[0]);
                }

                if (interaction.customId === 'select_event_type') {
                    await interaction.message.delete().catch(() => {});
                    await showDateModal(interaction as StringSelectMenuInteraction, (interaction as StringSelectMenuInteraction).values[0]);
                }
                if (interaction.customId === 'select_leave_slot') {
                    await leaveSpecificSlot(interaction as StringSelectMenuInteraction, (interaction as StringSelectMenuInteraction).values[0]);
                }
                if (interaction.customId === 'select_target_for_remove_reprimand') {
                    await showReprimandsToRemove(interaction as StringSelectMenuInteraction, (interaction as StringSelectMenuInteraction).values[0]);
                }
                if (interaction.customId === 'select_reprimand_to_delete') {
                    await finalizeReprimandRemove(interaction as StringSelectMenuInteraction, (interaction as StringSelectMenuInteraction).values[0], client);
                }

                if (interaction.customId.startsWith('history_delete_single:')) {
                    const [, type, targetId] = interaction.customId.split(':');
                    await executeDeleteSingleHistory(interaction as StringSelectMenuInteraction, type, targetId, (interaction as StringSelectMenuInteraction).values[0]);
                }

                // Магазин: Выбор товара
                if (interaction.customId === 'select_shop_item') {
                    await handleShopSelection(interaction as StringSelectMenuInteraction, (interaction as StringSelectMenuInteraction).values[0]);
                }
            }

            if (interaction.isModalSubmit()) {
                if (interaction.customId.startsWith('modal_norma_date:')) {
                    const [, type, targetId] = interaction.customId.split(':');
                    const dateStr = interaction.fields.getTextInputValue('norma_date_input');
                    await finalizeNormaIssue(interaction, type, targetId, dateStr, client);
                }
                if (interaction.customId.startsWith('modal_create_tribune')) {
                    const type = interaction.customId.split(':')[1];
                    const dateTime = interaction.fields.getTextInputValue('date_input');
                    await createTribuneInDb(interaction, type, dateTime);
                }
                if (interaction.customId.startsWith('modal_interview_target')) {
                    const targetId = (interaction as ModalSubmitInteraction).fields.getTextInputValue('target_id');
                    await startInterview(interaction as ModalSubmitInteraction, targetId);
                }
                if (interaction.customId.startsWith('modal_issue_reprimand:')) {
                    const targetId = interaction.customId.split(':')[1];
                    const reason = interaction.fields.getTextInputValue('reprimand_reason');
                    await saveReprimand(interaction, targetId, reason, client);
                }
                if (interaction.customId === 'modal_issue_reprimand_manual') {
                    const targetId = interaction.fields.getTextInputValue('target_id');
                    const reason = interaction.fields.getTextInputValue('reprimand_reason');
                    await saveReprimand(interaction, targetId, reason, client);
                }
                if (interaction.customId === 'modal_remove_reprimand_id') {
                    const targetId = interaction.fields.getTextInputValue('target_id');
                    await showReprimandsToRemove(interaction, targetId);
                }
            }
        } catch (error) {
            console.error('Interaction Error:', error);
            if (interaction.isRepliable()) {
                const msg = { content: '⚠️ Ошибка при обработке!', ephemeral: true };
                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp(msg).catch(() => {});
                } else {
                    await interaction.reply(msg).catch(() => {});
                }
            }
        }
    },
};

// --- МАГАЗИН ---

async function handleShopView(interaction: any) {
    if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply({ ephemeral: true });
    }

    const buffer = await CanvasHelper.drawShopCard(shopItems);
    const attachment = new AttachmentBuilder(buffer, { name: 'shop.png' });

    const select = new StringSelectMenuBuilder()
        .setCustomId('select_shop_item')
        .setPlaceholder('Выберите товар для покупки...')
        .addOptions(shopItems.map(item => 
            new StringSelectMenuOptionBuilder()
                .setLabel(`${item.name} (${item.price}✨)`)
                .setValue(item.id)
        ));

    await interaction.editReply({ 
        files: [attachment], 
        components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select)],
        content: ''
    });
}

async function handleShopSelection(interaction: StringSelectMenuInteraction, itemId: string) {
    const item = shopItems.find(i => i.id === itemId);
    if (!item) return;

    const embed = new EmbedBuilder()
        .setTitle('🛒 Подтверждение покупки')
        .setDescription(`Вы выбрали: **${item.name}**\nЦена: **✨ ${item.price} звезд**\n\nВы уверены, что хотите совершить покупку?`)
        .setColor('#ffff00');

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId(`confirm_buy:${itemId}`)
            .setLabel('Да, купить')
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId('view_shop')
            .setLabel('Назад в магазин')
            .setStyle(ButtonStyle.Secondary)
    );

    await interaction.update({ embeds: [embed], components: [row], files: [] });
}

async function processPurchase(interaction: ButtonInteraction, itemId: string, client: MyClient) {
    const item = shopItems.find(i => i.id === itemId);
    if (!item) return;

    const user = await prisma.user.findUnique({ where: { discordId: interaction.user.id } });
    if (!user || user.stars < item.price) {
        return interaction.update({ 
            content: `❌ Недостаточно звезд! У вас: **${user?.stars || 0}**, нужно: **${item.price}**.`, 
            embeds: [], 
            components: [] 
        });
    }

    await prisma.user.update({
        where: { discordId: interaction.user.id },
        data: { stars: { decrement: item.price } }
    });

    await interaction.update({ 
        content: `✅ Вы успешно купили **${item.name}**! Кураторы уведомлены и свяжутся с вами для выдачи.`, 
        embeds: [], 
        components: [] 
    });

    const notifyEmbed = new EmbedBuilder()
        .setTitle('🛍️ Новая покупка в магазине!')
        .setColor('#ffd700')
        .setDescription(`Пользователь <@${interaction.user.id}> купил: **${item.name}**\nЦена: **${item.price} звезд**\nПожалуйста, свяжитесь с ним для выдачи товара.`)
        .setTimestamp();

    // Уведомляем только ответственных за магазин
    for (const managerId of SHOP_MANAGER_IDS) {
        const manager = await client.users.fetch(managerId).catch(() => null);
        if (manager) await manager.send({ embeds: [notifyEmbed] }).catch(() => {});
    }
}

// --- СИСТЕМА ВЫГОВОРОВ (АДМИН) ---

async function initiateReprimandIssue(interaction: ButtonInteraction) {
    const modal = new ModalBuilder()
        .setCustomId('modal_issue_reprimand_manual')
        .setTitle('Выдача выговора');

    const idInput = new TextInputBuilder()
        .setCustomId('target_id')
        .setLabel('ID пользователя')
        .setPlaceholder('Вставьте ID (например: 123456789012345678)')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

    const reasonInput = new TextInputBuilder()
        .setCustomId('reprimand_reason')
        .setLabel('Причина выговора')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true);

    modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(idInput),
        new ActionRowBuilder<TextInputBuilder>().addComponents(reasonInput)
    );

    await interaction.showModal(modal);
}


async function saveReprimand(interaction: ModalSubmitInteraction, targetId: string, reason: string, client: MyClient) {
    // Проверка, есть ли пользователь на сервере
    const member = await interaction.guild?.members.fetch(targetId).catch(() => null);
    if (!member) {
        return interaction.reply({ content: '❌ Пользователь не найден на этом сервере!', ephemeral: true });
    }

    const username = member.user.username;

    // Гарантируем, что пользователь есть в базе перед созданием выговора
    await prisma.user.upsert({
        where: { discordId: targetId },
        update: { username },
        create: { discordId: targetId, username }
    });

    // ВНИМАНИЕ: Если здесь ошибка, запустите npx prisma generate!
    await (prisma as any).reprimand.create({
        data: { userId: targetId, reason, authorId: interaction.user.id }
    });

    await interaction.reply({ content: `✅ Выговор выдан пользователю <@${targetId}>!`, ephemeral: true });

    // Попытка отправить сообщение в личку (не блокирует выполнение из-за catch)
    try {
        await member.send(`⚖️ **Вам выдан выговор!**\n>>> **Причина:** ${reason}\n**Автор:** <@${interaction.user.id}>`);
    } catch (e) {
        console.log(`Не удалось отправить ЛС пользователю ${targetId}:`, e);
    }
}

async function initiateReprimandRemove(interaction: ButtonInteraction) {
    const modal = new ModalBuilder()
        .setCustomId('modal_remove_reprimand_id')
        .setTitle('Снятие выговора');

    const idInput = new TextInputBuilder()
        .setCustomId('target_id')
        .setLabel('ID пользователя')
        .setPlaceholder('Введите ID пользователя для поиска выговоров')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

    modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(idInput));

    await interaction.showModal(modal);
}

async function showReprimandsToRemove(interaction: ModalSubmitInteraction | StringSelectMenuInteraction, targetId: string) {
    const reprimands = await (prisma as any).reprimand.findMany({ where: { userId: targetId }, take: 25 });
    
    if (reprimands.length === 0) {
        const msg = { content: '❌ У этого пользователя нет активных выговоров в базе.', components: [], ephemeral: true };
        if (interaction.isModalSubmit()) return interaction.reply(msg);
        else return interaction.update(msg);
    }

    const select = new StringSelectMenuBuilder()
        .setCustomId('select_reprimand_to_delete')
        .setPlaceholder('Выберите выговор для удаления')
        .addOptions(reprimands.map((r: any) => new StringSelectMenuOptionBuilder().setLabel(r.reason.substring(0, 50)).setValue(r.id)));

    const replyData = { 
        content: `Список выговоров <@${targetId}>:`, 
        components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select)],
        ephemeral: true
    };

    if (interaction.isModalSubmit()) await interaction.reply(replyData);
    else await interaction.update(replyData);
}

async function finalizeReprimandRemove(interaction: StringSelectMenuInteraction, reprimandId: string, client: MyClient) {
    const reprimand = await (prisma as any).reprimand.findUnique({ where: { id: reprimandId } });
    if (!reprimand) return interaction.update({ content: 'Выговор не найден.', components: [] });

    await (prisma as any).reprimand.delete({ where: { id: reprimandId } });
    await interaction.update({ content: '✅ Выговор успешно снят!', components: [] });

    const target = await client.users.fetch(reprimand.userId).catch(() => null);
    if (target) {
        await target.send(`🛡️ **С вас снят выговор!**\n>>> **Был за:** ${reprimand.reason}\n**Снял:** <@${interaction.user.id}>`).catch(() => {});
    }
}

async function viewMyReprimands(interaction: ButtonInteraction) {
    const reprimands = await (prisma as any).reprimand.findMany({ where: { userId: interaction.user.id }, orderBy: { createdAt: 'desc' } });
    
    const embed = new EmbedBuilder()
        .setTitle('⚖️ Твои выговоры')
        .setColor(reprimands.length > 0 ? '#ff0000' : '#00ff00')
        .setDescription(reprimands.length > 0 ? `Всего нарушений: **${reprimands.length}**` : 'У тебя нет активных выговоров! 🎉');

    reprimands.forEach((r: any, i: number) => {
        embed.addFields({
            name: `Выговор #${reprimands.length - i}`,
            value: `>>> **Причина:** ${r.reason}\n**Выдал:** <@${r.authorId}>\n**Дата:** <t:${Math.floor(r.createdAt.getTime() / 1000)}:R>`,
            inline: false
        });
    });

    await interaction.reply({ embeds: [embed], ephemeral: true });
}

// --- СИСТЕМА ЗАДАНИЙ ---

async function handleTasksView(interaction: ButtonInteraction) {
    const user = await prisma.user.findUnique({ where: { discordId: interaction.user.id } });
    if (!user) return;
    let taskIndex = user.currentTaskIndex;
    let isTaskDone = user.isTaskDone;
    let isTaskPending = user.isTaskPending;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const lastTaskDate = user.lastTaskDate ? new Date(user.lastTaskDate) : null;
    if (lastTaskDate) lastTaskDate.setHours(0, 0, 0, 0);
    if (!lastTaskDate || lastTaskDate.getTime() !== today.getTime()) {
        taskIndex = Math.floor(Math.random() * tasks.length);
        isTaskDone = false;
        isTaskPending = false;
        await prisma.user.update({ where: { discordId: interaction.user.id }, data: { currentTaskIndex: taskIndex, lastTaskDate: new Date(), isTaskDone: false, isTaskPending: false } });
    }
    const taskText = tasks[taskIndex!];
    let statusText = '📝 Твое задание на сегодня:';
    if (isTaskPending) statusText = '⏳ Задание на проверке у кураторов:';
    if (isTaskDone) statusText = '✅ Ты уже выполнил задание на сегодня:';
    const embed = new EmbedBuilder()
        .setTitle('📅 Ежедневное задание')
        .setDescription(`${statusText}\n\n>>> **${taskIndex! + 1}. ${taskText}**`)
        .setColor(isTaskDone ? '#00ff00' : (isTaskPending ? '#ffff00' : '#00ffff'));
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId('submit_task').setLabel('Выполнено').setStyle(ButtonStyle.Success).setDisabled(isTaskDone || isTaskPending));
    await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
}

async function submitTaskToCurators(interaction: ButtonInteraction, client: MyClient) {
    const user = await prisma.user.findUnique({ where: { discordId: interaction.user.id } });
    if (!user || user.currentTaskIndex === null) return;
    await prisma.user.update({ where: { discordId: interaction.user.id }, data: { isTaskPending: true } });
    
    const embed = new EmbedBuilder()
        .setTitle('📢 Новое выполненное задание!')
        .setDescription(`Пользователь <@${interaction.user.id}> утверждает, что выполнил задание:\n\n**${user.currentTaskIndex + 1}. ${tasks[user.currentTaskIndex]}**`)
        .setColor('#7289da');
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId(`approve_task_${interaction.user.id}`).setLabel('Да, принять').setStyle(ButtonStyle.Success), new ButtonBuilder().setCustomId(`deny_task_${interaction.user.id}`).setLabel('Нет, отклонить').setStyle(ButtonStyle.Danger));

    // Уведомляем только ответственных за задания
    for (const managerId of TASK_MANAGER_IDS) {
        const manager = await client.users.fetch(managerId).catch(() => null);
        if (manager) await manager.send({ embeds: [embed], components: [row] }).catch(() => {});
    }

    await interaction.update({ content: '✅ Задание отправлено на проверку кураторам!', embeds: [], components: [] });
    setTimeout(() => interaction.deleteReply().catch(() => {}), 5000);
}

async function approveTask(interaction: ButtonInteraction, userId: string, client: MyClient) {
    const user = await prisma.user.findUnique({ where: { discordId: userId } });
    if (!user) return (interaction as any).update({ content: 'Ошибка: пользователь не найден.', components: [] });
    await prisma.user.update({ where: { discordId: userId }, data: { stars: { increment: 50 }, isTaskDone: true, isTaskPending: false } });
    await (interaction as any).update({ content: `✅ Задание <@${userId}> одобрено. +50 звезд начислено!`, components: [] });
    const targetUser = await client.users.fetch(userId).catch(() => null);
    if (targetUser) { await targetUser.send('🌟 Куратор одобрил твое задание! Тебе начислено **50 звезд**.').catch(() => {}); }
}

async function denyTask(interaction: ButtonInteraction, userId: string, client: MyClient) {
    await prisma.user.update({ where: { discordId: userId }, data: { isTaskPending: false } });
    await (interaction as any).update({ content: `❌ Задание <@${userId}> отклонено.`, components: [] });
    const targetUser = await client.users.fetch(userId).catch(() => null);
    if (targetUser) { await targetUser.send('❌ Твое задание было отклонено за несоответствие. Попробуй еще раз!').catch(() => {}); }
}

// --- ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ТРИБУН ---

async function renderTribuneView(interaction: ButtonInteraction) {
    const activeTribune = await prisma.tribune.findFirst({ where: { status: 'ACTIVE' } });
    if (!activeTribune) {
        const rows = [];
        if (isAdmin(interaction.user.id)) {
            const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder()
                    .setCustomId('create_event')
                    .setLabel('Создать событие')
                    .setStyle(ButtonStyle.Success)
            );
            rows.push(row);
        }
        return interaction.reply({ content: 'Активных событий нет.', components: rows, ephemeral: true });
    }
    await updateTribuneMessage(interaction);
}

async function updateTribuneMessage(interaction: any) {
    if (!interaction.deferred && !interaction.replied) {
        await interaction.deferUpdate().catch(() => {});
    }
    const activeTribune = await prisma.tribune.findFirst({ where: { status: 'ACTIVE' } });
    if (!activeTribune) return;
    const hostNames: any = {};
    const slots = ['slot1_1', 'slot1_2', 'slot2_1', 'slot2_2'];
    for (const s of slots) {
        const id = (activeTribune as any)[s];
        if (id) {
            const member = await interaction.guild?.members.fetch(id).catch(() => null);
            hostNames[s] = member ? member.user.username : 'Неизвестен';
        } else {
            hostNames[s] = null;
        }
    }
    const buffer = await CanvasHelper.drawTribuneCard(activeTribune, hostNames);
    const attachment = new AttachmentBuilder(buffer, { name: 'tribune.png' });
    const rows = createTribuneButtons(activeTribune, interaction.user.id);
    if (interaction.isButton() || interaction.isStringSelectMenu()) {
        if (interaction.replied || interaction.deferred) { await interaction.editReply({ files: [attachment], components: rows, content: '' }); } else { await interaction.update({ files: [attachment], components: rows, content: '' }); }
    } else {
        await interaction.reply({ files: [attachment], components: rows, ephemeral: true });
    }
}

function createTribuneButtons(tribune: any, userId: string) {
    const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('join_1_1').setLabel('1.1').setStyle(ButtonStyle.Secondary).setDisabled(!!tribune.slot1_1), 
        new ButtonBuilder().setCustomId('join_1_2').setLabel('1.2').setStyle(ButtonStyle.Secondary).setDisabled(!!tribune.slot1_2), 
        new ButtonBuilder().setCustomId('join_2_1').setLabel('2.1').setStyle(ButtonStyle.Secondary).setDisabled(!!tribune.slot2_1), 
        new ButtonBuilder().setCustomId('join_2_2').setLabel('2.2').setStyle(ButtonStyle.Secondary).setDisabled(!!tribune.slot2_2)
    );
    const userSlots = getUserSlots(tribune, userId);
    const row2 = new ActionRowBuilder<ButtonBuilder>();

    // Кнопки управления только для Админов
    if (isAdmin(userId)) {
        row2.addComponents(
            new ButtonBuilder().setCustomId('complete_tribune').setLabel('Завершить трибуну').setStyle(ButtonStyle.Success), 
            new ButtonBuilder().setCustomId('cancel_tribune').setLabel('Отменить трибуну').setStyle(ButtonStyle.Secondary)
        );
    }

    row2.addComponents(
        new ButtonBuilder().setCustomId('leave_tribune').setLabel('Выписаться').setStyle(ButtonStyle.Primary).setDisabled(userSlots.length === 0)
    );

    return [row1, row2];
}

function getUserSlots(tribune: any, userId: string): string[] { const slots = ['slot1_1', 'slot1_2', 'slot2_1', 'slot2_2']; return slots.filter(s => (tribune as any)[s] === userId); }

async function joinSlot(interaction: ButtonInteraction, slot: string) {
    const tribune = await prisma.tribune.findFirst({ where: { status: 'ACTIVE' } });
    if (!tribune || (tribune as any)[slot]) return;

    const isFirstHalf = slot === 'slot1_1' || slot === 'slot1_2';
    const isSecondHalf = slot === 'slot2_1' || slot === 'slot2_2';

    if (isFirstHalf && (tribune.slot1_1 === interaction.user.id || tribune.slot1_2 === interaction.user.id)) {
        return interaction.reply({ content: '❌ Вы уже заняли место в первой половине трибуны (1.1 или 1.2).', ephemeral: true });
    }
    if (isSecondHalf && (tribune.slot2_1 === interaction.user.id || tribune.slot2_2 === interaction.user.id)) {
        return interaction.reply({ content: '❌ Вы уже заняли место во второй половине трибуны (2.1 или 2.2).', ephemeral: true });
    }

    await (prisma.tribune as any).update({ where: { id: tribune.id }, data: { [slot]: interaction.user.id } });
    await updateTribuneMessage(interaction);
}

async function handleLeaveRequest(interaction: ButtonInteraction) {
    const tribune = await prisma.tribune.findFirst({ where: { status: 'ACTIVE' } });
    if (!tribune) return;
    const userSlots = getUserSlots(tribune, interaction.user.id);
    if (userSlots.length === 0) return interaction.reply({ content: 'Вы не записаны.', ephemeral: true });
    if (userSlots.length === 1) { await leaveSpecificSlot(interaction, userSlots[0]); } else { const select = new StringSelectMenuBuilder().setCustomId('select_leave_slot').setPlaceholder('Выберите место для освобождения').addOptions(userSlots.map(s => new StringSelectMenuOptionBuilder().setLabel(`Место ${s.replace('slot','').replace('_','.')}`).setValue(s))); await interaction.reply({ content: 'Отмена записи:', components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select)], ephemeral: true }); }
}

async function leaveSpecificSlot(interaction: any, slot: string) {
    const tribune = await prisma.tribune.findFirst({ where: { status: 'ACTIVE' } });
    if (!tribune) return;
    await (prisma.tribune as any).update({ where: { id: tribune.id }, data: { [slot]: null } });
    await updateTribuneMessage(interaction);
}

async function cancelTribune(interaction: ButtonInteraction) {
    if (!isAdmin(interaction.user.id)) {
        return interaction.reply({ content: '❌ Только кураторы могут отменить трибуну.', ephemeral: true });
    }
    const activeTribune = await prisma.tribune.findFirst({ where: { status: 'ACTIVE' } });
    if (!activeTribune) return;
    await prisma.tribune.delete({ where: { id: activeTribune.id } });
    await interaction.update({ content: '❌ Трибуна отменена.', components: [], files: [] });
    setTimeout(() => interaction.deleteReply().catch(() => {}), 5000);
}

async function completeTribune(interaction: ButtonInteraction) {
    if (!isAdmin(interaction.user.id)) {
        return interaction.reply({ content: '❌ Только кураторы могут завершать трибуну.', ephemeral: true });
    }
    const activeTribune = await prisma.tribune.findFirst({ where: { status: 'ACTIVE' } });
    if (!activeTribune) return;
    const hostIds = [activeTribune.slot1_1, activeTribune.slot1_2, activeTribune.slot2_1, activeTribune.slot2_2].filter(id => id !== null) as string[];
    
    // Сохраняем историю
    await prisma.tribuneHistory.create({ data: { type: activeTribune.type, startTime: activeTribune.dateTime, hostId: interaction.user.id, participants: hostIds.join(',') } });
    
    // Обновляем норму для всех ведущих
    for (const hostId of hostIds) {
        await prisma.user.upsert({
            where: { discordId: hostId },
            update: { hasNorma: true, normaLastUpdated: new Date() },
            create: { discordId: hostId, username: 'Ведущий', hasNorma: true, normaLastUpdated: new Date() }
        }).catch(e => console.error(`Ошибка нормы для ${hostId}:`, e));
    }

    await prisma.tribune.delete({ where: { id: activeTribune.id } });
    await interaction.update({ content: '✅ Трибуна завершена! Норма ведущим проставлена.', components: [], files: [] });
    setTimeout(() => interaction.deleteReply().catch(() => {}), 5000);
}



async function clearHistory(interaction: ButtonInteraction) {
    if (!isAdmin(interaction.user.id)) return;
    
    await prisma.tribuneHistory.deleteMany({});
    await interaction.update({ content: '✅ История трибун успешно очищена!', embeds: [], components: [] });
    
    setTimeout(() => interaction.deleteReply().catch(() => {}), 5000);
}

async function showEventSelector(interaction: ButtonInteraction) { 
    if (!isAdmin(interaction.user.id)) {
        return interaction.reply({ content: '❌ У вас нет прав для создания событий.', ephemeral: true });
    }
    const select = new StringSelectMenuBuilder()
        .setCustomId('select_event_type')
        .setPlaceholder('Выберите тип')
        .addOptions(
            new StringSelectMenuOptionBuilder().setLabel('Синяя кнопка').setValue('Синяя кнопка'), 
            new StringSelectMenuOptionBuilder().setLabel('Быстрые свидания').setValue('Быстрые свидания'), 
            new StringSelectMenuOptionBuilder().setLabel('Шоу талантов').setValue('Шоу талантов'), 
            new StringSelectMenuOptionBuilder().setLabel('Любовь в вопросах').setValue('Любовь в вопросах'), 
            new StringSelectMenuOptionBuilder().setLabel('Любовное колесо').setValue('Любовное колесо'), 
            new StringSelectMenuOptionBuilder().setLabel('Давай поженимся').setValue('Давай поженимся')
        ); 
    await interaction.update({ content: 'Тип трибуны:', components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select)], files: [] }); 
}
async function showDateModal(interaction: any, eventType: string) { const modal = new ModalBuilder().setCustomId(`modal_create_tribune:${eventType}`).setTitle('Параметры'); modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId('date_input').setLabel("Дата/время").setStyle(TextInputStyle.Short).setRequired(true))); await interaction.showModal(modal); }
async function createTribuneInDb(interaction: any, type: string, dateTime: string) { await prisma.tribune.create({ data: { type, dateTime, creatorId: interaction.user.id, status: 'ACTIVE' } }); await prisma.user.upsert({ where: { discordId: interaction.user.id }, update: { username: interaction.user.username }, create: { discordId: interaction.user.id, username: interaction.user.username } }); await interaction.reply({ content: `✅ Создано!`, ephemeral: true }); setTimeout(() => interaction.deleteReply().catch(() => {}), 5000); }
async function viewHostsNorms(interaction: ButtonInteraction) {
    if (!isAdmin(interaction.user.id)) {
        return interaction.reply({ content: 'У вас нет прав для этого.', ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    try {
        const guild = interaction.guild;
        if (!guild) return;

        const hosts = await getHosts(guild);

        const hostIds = hosts.map(h => h.id);
        const hostDataFromDb = await prisma.user.findMany({
            where: { discordId: { in: hostIds } }
        });

        const dataForTable = hosts.map(member => {
            const dbUser = hostDataFromDb.find(u => u.discordId === member.id);
            let hasNorma = false;
            
            // Проверка автоматической нормы (через трибуны) и ручной
            if (dbUser?.normaLastUpdated) {
                const twoWeeksInMs = 14 * 24 * 60 * 60 * 1000;
                const timePassed = new Date().getTime() - dbUser.normaLastUpdated.getTime();
                if (timePassed < twoWeeksInMs) {
                    hasNorma = true;
                }
            }

            return {
                username: member.displayName,
                hasNorma
            };
        });

        dataForTable.sort((a, b) => a.username.localeCompare(b.username));

        const embed = new EmbedBuilder()
            .setTitle('📋 Статус нормы ведущих')
            .setColor('#a76eff')
            .setDescription(
                dataForTable.map((h, i) => `${i + 1}. **${h.username}** — ${h.hasNorma ? '✅' : '❌'}`).join('\n') || 'Ведущие не найдены.'
            )
            .setFooter({ text: 'Норма: эфир или ручное подтверждение за последние 14 дней' })
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    } catch (e) {
        console.error('Ошибка при просмотре норм:', e);
        await interaction.editReply({ content: 'Произошла ошибка при формировании таблицы.' });
    }
}

async function viewHostsTikTokNorms(interaction: ButtonInteraction) {
    if (!isAdmin(interaction.user.id)) {
        return interaction.reply({ content: 'У вас нет прав для этого.', ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    try {
        const guild = interaction.guild;
        if (!guild) return;

        const hosts = await getHosts(guild);

        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

        const hostIds = hosts.map(h => h.id);
        const hostDataFromDb = await prisma.user.findMany({
            where: { discordId: { in: hostIds } },
            include: {
                _count: {
                    select: {
                        tiktoks: {
                            where: { 
                                status: 'APPROVED',
                                createdAt: { gte: oneWeekAgo } 
                            }
                        }
                    }
                }
            }
        }) as any[];

        const dataForTable = hosts.map(member => {
            const dbUser = hostDataFromDb.find(u => u.discordId === member.id);
            
            // Автоматическая норма (одобренные ТТ за неделю)
            let hasNorma = (dbUser?._count?.tiktoks || 0) > 0;
            
            // Ручная норма (проверка tiktokNormaLastUpdated)
            if (!hasNorma && dbUser?.tiktokNormaLastUpdated) {
                const oneWeekInMs = 7 * 24 * 60 * 60 * 1000;
                const timePassed = new Date().getTime() - dbUser.tiktokNormaLastUpdated.getTime();
                if (timePassed < oneWeekInMs) {
                    hasNorma = true;
                }
            }

            return {
                username: member.displayName,
                hasNorma
            };
        });

        dataForTable.sort((a, b) => a.username.localeCompare(b.username));

        const embed = new EmbedBuilder()
            .setTitle('📋 Статус нормы ТикТоков')
            .setColor('#a76eff')
            .setDescription(
                dataForTable.map((h, i) => `${i + 1}. **${h.username}** — ${h.hasNorma ? '✅' : '❌'}`).join('\n') || 'Ведущие не найдены.'
            )
            .setFooter({ text: 'Норма: 1 одобренный ТикТок или ручное подтверждение за 7 дней' })
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    } catch (e) {
        console.error('Ошибка при просмотре норм тиктоков:', e);
        await interaction.editReply({ content: 'Произошла ошибка при формировании таблицы.' });
    }
}


async function approveTikTok(interaction: ButtonInteraction, tiktokId: string, client: MyClient) {
    const tiktok = await prisma.tikTok.findUnique({ where: { id: tiktokId } });
    if (!tiktok) return interaction.update({ content: '❌ ТикТок не найден.', components: [] });

    await prisma.tikTok.update({
        where: { id: tiktokId },
        data: { status: 'APPROVED' }
    });

    await interaction.update({ 
        content: `✅ ТикТок пользователя <@${tiktok.userId}> одобрен!`, 
        embeds: [], 
        components: [] 
    });

    const targetUser = await client.users.fetch(tiktok.userId).catch(() => null);
    if (targetUser) {
        await targetUser.send(`🎬 **Ваше видео одобрено!**\n>>> Ваша норма за эту неделю выполнена. Спасибо!`).catch(() => {});
    }
}

async function denyTikTok(interaction: ButtonInteraction, tiktokId: string, client: MyClient) {
    const tiktok = await prisma.tikTok.findUnique({ where: { id: tiktokId } });
    if (!tiktok) return interaction.update({ content: '❌ ТикТок не найден.', components: [] });

    await prisma.tikTok.update({
        where: { id: tiktokId },
        data: { status: 'DENIED' }
    });

    await interaction.update({ 
        content: `❌ ТикТок пользователя <@${tiktok.userId}> отклонен.`, 
        embeds: [], 
        components: [] 
    });

    const targetUser = await client.users.fetch(tiktok.userId).catch(() => null);
    if (targetUser) {
        await targetUser.send(`❌ **Ваше видео было отклонено куратором.**\n>>> Пожалуйста, проверьте правила публикации и попробуйте еще раз.`).catch(() => {});
    }
}

async function viewDetailedHostList(interaction: ButtonInteraction, page: number = 0) {
    if (!isAdmin(interaction.user.id)) {
        return interaction.reply({ content: 'У вас нет прав для этого.', ephemeral: true });
    }

    // Проверяем: это переключение страницы (ID содержит номер) или новый вызов из профиля
    const isPageSwitch = interaction.customId.includes(':');

    if (isPageSwitch) {
        // Если это кнопка пагинации — обновляем текущее сообщение
        await interaction.deferUpdate().catch(() => {});
    } else {
        // Если это первый вызов из профиля — создаем новое ephemeral сообщение
        await interaction.deferReply({ ephemeral: true });
    }

    try {
        const guild = interaction.guild;
        if (!guild) return;

        // 1. Получаем участников с ролью ведущего (из кеша)
        const hostsCollection = await getHosts(guild);
        const hosts = Array.from(hostsCollection.values());

        if (hosts.length === 0) {
            return interaction.editReply({ content: 'Ведущие с указанной ролью не найдены.', embeds: [], components: [] });
        }

        // 2. Получаем данные из БД
        const twoWeeksAgo = new Date();
        twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

        const hostIds = hosts.map(h => h.id);
        
        const allReprimands = await (prisma as any).reprimand.findMany({
            where: { userId: { in: hostIds } },
            orderBy: { createdAt: 'desc' }
        });

        const tribuneHistory = await prisma.tribuneHistory.findMany({
            where: { closedAt: { gte: twoWeeksAgo } },
            orderBy: { closedAt: 'desc' }
        });

        // 3. Пагинация (по 5 человек на страницу)
        const itemsPerPage = 5;
        const totalPages = Math.ceil(hosts.length / itemsPerPage);
        const start = page * itemsPerPage;
        const pageHosts = hosts.slice(start, start + itemsPerPage);

        const embed = new EmbedBuilder()
            .setTitle('📋 Список ведущих')
            .setDescription(`Страница **${page + 1}** из **${totalPages}**`)
            .setColor('#a76eff')
            .setTimestamp();

        for (const member of pageHosts) {
            const id = member.id;
            const userReprimands = allReprimands.filter((r: any) => r.userId === id);
            const reprimandText = userReprimands.length > 0 
                ? userReprimands.map((r: any) => `• <t:${Math.floor(r.createdAt.getTime() / 1000)}:d> — ${r.reason}`).join('\n')
                : '*Нет активных выговоров*';

            const userTribunes = tribuneHistory.filter(h => h.hostId === id || h.participants?.includes(id));
            const manualTribunePass = await prisma.user.findUnique({ where: { discordId: id } }).then(u => u?.normaLastUpdated);
            const isManualTribunePass = manualTribunePass ? (new Date().getTime() - manualTribunePass.getTime() < 14 * 24 * 60 * 60 * 1000) : false;

            const tribuneCount = userTribunes.length;
            const tribuneDetails = userTribunes.length > 0
                ? userTribunes.map(h => `• ${h.type} (<t:${Math.floor(h.closedAt.getTime() / 1000)}:d>)`).slice(0, 5).join('\n') + (userTribunes.length > 5 ? '\n*...и еще другие*' : '')
                : (isManualTribunePass ? '*Норма выдана вручную куратором*' : '*Нет проведенных трибун за 14 дней*');

            const fieldValue = `**⚖️ Выговоры:**\n${reprimandText}\n**🎤 Трибуны (за 2 нед): ${tribuneCount}**\n${tribuneDetails}\n\n⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯`;

            embed.addFields({
                name: `👤 ${member.displayName} (${member.user.username})`,
                value: fieldValue.substring(0, 1024),
                inline: false
            });
        }

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
                .setCustomId(`admin_view_host_list:${page - 1}`)
                .setLabel('⬅️ Назад')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(page === 0),
            new ButtonBuilder()
                .setCustomId(`admin_view_host_list:${page + 1}`)
                .setLabel('Вперед ➡️')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(page >= totalPages - 1)
        );

        // Используем editReply, так как мы всегда либо deferReply, либо deferUpdate
        await interaction.editReply({ 
            embeds: [embed], 
            components: [row]
        });

    } catch (e) {
        console.error('Ошибка при формировании списка ведущих:', e);
        await interaction.editReply({ content: '❌ Произошла ошибка при сборе данных.', embeds: [], components: [] });
    }
}

// --- УПРАВЛЕНИЕ ВЫГОВОРАМИ ---

async function startReprimandManage(interaction: ButtonInteraction) {
    const embed = new EmbedBuilder()
        .setTitle('⚙️ Управление выговорами')
        .setDescription('Выберите действие:')
        .setColor('#FF4747');

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId('reprimand_action:issue')
            .setLabel('Выдать выговор')
            .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
            .setCustomId('reprimand_action:remove')
            .setLabel('Снять выговор')
            .setStyle(ButtonStyle.Secondary)
    );

    await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
}

async function chooseReprimandUser(interaction: ButtonInteraction, action: string) {
    const guild = interaction.guild;
    if (!guild) return;

    const hosts = await getHosts(guild);

    if (hosts.size === 0) {
        return interaction.update({ content: '❌ Ведущие не найдены.', embeds: [], components: [] });
    }

    const select = new StringSelectMenuBuilder()
        .setCustomId(`reprimand_user_select:${action}`)
        .setPlaceholder('Выберите ведущего...')
        .addOptions(
            Array.from(hosts.values()).slice(0, 25).map(m => 
                new StringSelectMenuOptionBuilder()
                    .setLabel(m.displayName)
                    .setValue(m.id)
                    .setDescription(m.user.username)
            )
        );

    const embed = new EmbedBuilder()
        .setTitle(`⚙️ ${action === 'issue' ? 'Выдача' : 'Снятие'} выговора`)
        .setDescription('Выберите пользователя из списка:')
        .setColor('#FF4747');

    await interaction.update({ 
        embeds: [embed], 
        components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select)] 
    });
}

async function handleReprimandUserSelection(interaction: StringSelectMenuInteraction, action: string, targetId: string) {
    if (action === 'remove') {
        return showReprimandsToRemove(interaction, targetId);
    }

    // Выдача выговора
    const modal = new ModalBuilder()
        .setCustomId(`modal_issue_reprimand:${targetId}`)
        .setTitle('Выдача выговора');

    const reasonInput = new TextInputBuilder()
        .setCustomId('reprimand_reason')
        .setLabel('Причина выговора')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true);

    modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(reasonInput));

    await interaction.showModal(modal);
}

// --- УПРАВЛЕНИЕ НОРМОЙ ---

async function startNormaManage(interaction: ButtonInteraction) {
    if (!isAdmin(interaction.user.id)) {
        return interaction.reply({ content: 'У вас нет прав для этого.', ephemeral: true });
    }

    const embed = new EmbedBuilder()
        .setTitle('⚙️ Управление нормой')
        .setDescription('Выберите действие, которое хотите совершить:')
        .setColor('#5865F2');

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId('norma_action:issue')
            .setLabel('Выдать норму')
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId('norma_action:remove')
            .setLabel('Снять норму')
            .setStyle(ButtonStyle.Danger)
    );

    await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
}

async function chooseNormaType(interaction: ButtonInteraction, action: string) {
    const embed = new EmbedBuilder()
        .setTitle(`⚙️ ${action === 'issue' ? 'Выдача' : 'Снятие'} нормы`)
        .setDescription('Выберите тип нормы:')
        .setColor('#5865F2');

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId(`norma_type:${action}:tribune`)
            .setLabel('Трибуны')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId(`norma_type:${action}:tiktok`)
            .setLabel('ТикТоки')
            .setStyle(ButtonStyle.Secondary)
    );

    await interaction.update({ embeds: [embed], components: [row] });
}

async function chooseNormaUser(interaction: ButtonInteraction, action: string, type: string) {
    const guild = interaction.guild;
    if (!guild) return;

    const hosts = await getHosts(guild);

    if (hosts.size === 0) {
        return interaction.update({ content: '❌ Ведущие не найдены.', embeds: [], components: [] });
    }

    const select = new StringSelectMenuBuilder()
        .setCustomId(`norma_user_select:${action}:${type}`)
        .setPlaceholder('Выберите ведущего...')
        .addOptions(
            Array.from(hosts.values()).slice(0, 25).map(m => 
                new StringSelectMenuOptionBuilder()
                    .setLabel(m.displayName)
                    .setValue(m.id)
                    .setDescription(m.user.username)
            )
        );

    const embed = new EmbedBuilder()
        .setTitle(`⚙️ ${action === 'issue' ? 'Выдача' : 'Снятие'} нормы: ${type === 'tribune' ? 'Трибуны' : 'ТикТоки'}`)
        .setDescription('Выберите пользователя из списка:')
        .setColor('#5865F2');

    await interaction.update({ 
        embeds: [embed], 
        components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select)] 
    });
}

async function handleNormaUserSelection(interaction: StringSelectMenuInteraction, action: string, type: string, targetId: string) {
    if (action === 'remove') {
        const embed = new EmbedBuilder()
            .setTitle('⚠️ Подтверждение снятия нормы')
            .setDescription(`Вы действительно хотите снять норму по **${type === 'tribune' ? 'Трибунам' : 'ТикТокам'}** для <@${targetId}>?`)
            .setColor('#ff4747');

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
                .setCustomId(`confirm_norma_remove:${type}:${targetId}`)
                .setLabel('Да, снять')
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId('admin_norma_manage')
                .setLabel('Отмена')
                .setStyle(ButtonStyle.Secondary)
        );

        return interaction.update({ embeds: [embed], components: [row] });
    }

    // Если выдача - показываем модал
    const modal = new ModalBuilder()
        .setCustomId(`modal_norma_date:${type}:${targetId}`)
        .setTitle('Выдача нормы');

    const dateInput = new TextInputBuilder()
        .setCustomId('norma_date_input')
        .setLabel('Дата (ДД.ММ.ГГГГ)')
        .setPlaceholder('Пример: 10.04.2024')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMinLength(10)
        .setMaxLength(10);

    modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(dateInput));

    await interaction.showModal(modal);
}

async function finalizeNormaIssue(interaction: ModalSubmitInteraction, type: string, targetId: string, dateStr: string, client: MyClient) {
    // Валидация даты
    const datePattern = /^(\d{2})\.(\d{2})\.(\d{4})$/;
    const match = dateStr.match(datePattern);

    if (!match) {
        return interaction.reply({ content: '❌ Неверный формат даты! Используйте ДД.ММ.ГГГГ', ephemeral: true });
    }

    const [, d, m, y] = match;
    const date = new Date(parseInt(y), parseInt(m) - 1, parseInt(d), 12, 0, 0);

    if (isNaN(date.getTime())) {
        return interaction.reply({ content: '❌ Введена некорректная дата!', ephemeral: true });
    }

    const updateData = type === 'tribune'
        ? { hasNorma: true, normaLastUpdated: date }
        : { tiktokNormaLastUpdated: date };

    await prisma.user.upsert({
        where: { discordId: targetId },
        update: updateData as any,
        create: { discordId: targetId, username: 'Ведущий', ...updateData } as any
    });

    await interaction.reply({ 
        content: `✅ Норма по **${type === 'tribune' ? 'Трибунам' : 'ТикТоки'}** для <@${targetId}> выдана от даты **${dateStr}**!`, 
        ephemeral: true 
    });

    // Уведомление в ЛС
    const member = await interaction.guild?.members.fetch(targetId).catch(() => null);
    if (member) {
        await member.send(`🌟 **Куратор подтвердил вашу норму по ${type === 'tribune' ? 'Трибунам' : 'ТикТокам'}!**\nДата подтверждения: **${dateStr}**`).catch(() => {});
    }
}

async function finalizeNormaRemove(interaction: ButtonInteraction, type: string, targetId: string) {
    const updateData = type === 'tribune' 
        ? { hasNorma: false, normaLastUpdated: null } 
        : { tiktokNormaLastUpdated: null };

    await prisma.user.upsert({
        where: { discordId: targetId },
        update: updateData as any,
        create: { discordId: targetId, username: 'Ведущий', ...updateData } as any
    });

    await interaction.update({ 
        content: `✅ Норма по **${type === 'tribune' ? 'Трибунам' : 'ТикТокам'}** для <@${targetId}> успешно снята.`, 
        embeds: [], 
        components: [] 
    });
}

// --- СИСТЕМА СОБЕСЕДОВАНИЙ ---

import { interviewQuestions } from '../utils/questions';

async function startInterviewModal(interaction: ButtonInteraction) {
    if (!isStar(interaction.user.id)) return interaction.reply({ content: '❌ У вас нет прав для проведения собеседований.', ephemeral: true });
    
    const modal = new ModalBuilder().setCustomId('modal_interview_target').setTitle('Начало собеседования');
    const input = new TextInputBuilder().setCustomId('target_id').setLabel('Discord ID кандидата').setStyle(TextInputStyle.Short).setRequired(true);
    modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
    await interaction.showModal(modal);
}

async function startInterview(interaction: ModalSubmitInteraction, targetId: string) {
    if (!isStar(interaction.user.id)) return interaction.reply({ content: '❌ У вас нет прав для проведения собеседований.', ephemeral: true });
    
    const guild = interaction.guild;
    if (!guild) return;
    const member = await guild.members.fetch(targetId).catch(() => null);
    if (!member) return interaction.reply({ content: '❌ Пользователь не найден на сервере.', ephemeral: true });
    
    // Проверка по роли (Ведущий)
    if (!member.roles.cache.has(REPRIMAND_ROLE_ID)) {
        return interaction.reply({ content: '❌ Указанный пользователь не является ведущим.', ephemeral: true });
    }

    await renderInterviewQuestion(interaction, targetId, 0, 0, false);
}

async function renderInterviewQuestion(interaction: any, targetId: string, qIdx: number, score: number, showAnswer: boolean) {
    if (!isStar(interaction.user.id)) return interaction.reply({ content: '❌ Отказано в доступе.', ephemeral: true });

    if (qIdx >= interviewQuestions.length) {
        return renderInterviewResult(interaction, targetId, score);
    }

    const question = interviewQuestions[qIdx];
    const embed = new EmbedBuilder()
        .setTitle(`📝 Собеседование: Вопрос ${qIdx + 1}/${interviewQuestions.length}`)
        .setDescription(`**Кандидат:** <@${targetId}>\n\n**Вопрос:**\n${question.text}`)
        .setColor('#5865F2')
        .setFooter({ text: `Текущий балл: ${score}` });

    if (showAnswer) {
        embed.addFields({ name: '✅ Правильный ответ:', value: question.answer });
    }

    const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId(`int_rate:${targetId}:${qIdx}:${score}:1`).setLabel('✅ Правильный ответ').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`int_rate:${targetId}:${qIdx}:${score}:0.5`).setLabel('⚠️ 50/50 (+0.5)').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(`int_rate:${targetId}:${qIdx}:${score}:0`).setLabel('❌ Неправильный ответ').setStyle(ButtonStyle.Danger)
    );

    const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId(`int_q:${targetId}:${qIdx}:${score}:${showAnswer ? '0' : '1'}`).setLabel(showAnswer ? '🙈 Скрыть ответ' : '👁️ Показать ответ').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`int_tab:t:${targetId}:${qIdx}:${score}`).setLabel('📄 Текст проверки').setStyle(ButtonStyle.Secondary)
    );

    const isComponent = interaction.isButton?.() || interaction.isStringSelectMenu?.();
    const method = isComponent ? 'update' : (interaction.replied || interaction.deferred ? 'editReply' : 'reply');
    await (interaction as any)[method]({ embeds: [embed], components: [row1, row2], ephemeral: true, content: null });
}

async function renderInterviewText(interaction: any, targetId: string, qIdx: number, score: number) {
    const embed = new EmbedBuilder()
        .setTitle('📄 Собеседование: Текст проверки')
        .setDescription(`**Кандидат:** <@${targetId}>\n\n>>> Добро пожаловать на трибуну "Давай поженимся"! Здесь мы создаем возможности для знакомства и нахождения своей второй половинки. Готовьтесь ответить на три вопроса и найти свою искреннюю половинку! Вперед, к новым знакомствам и возможно к будущему счастью! На трибуне "Давай поженимся" нету скипов, как это работает в случае с Быстрыми свиданиями и Синей кнопкой, все желающие остаются на трибуне до того момента, пока первый участник не выберет кого-то из них, желаем вам удачи и мы начинаем!`)
        .setColor('#9B59B6')
        .setFooter({ text: `Прогресс вопросов: ${qIdx}/${interviewQuestions.length}` });

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId(`int_tab:q:${targetId}:${qIdx}:${score}`).setLabel('📝 Вернуться к вопросам').setStyle(ButtonStyle.Success)
    );

    const isComponent = interaction.isButton?.() || interaction.isStringSelectMenu?.();
    const method = isComponent ? 'update' : (interaction.replied || interaction.deferred ? 'editReply' : 'reply');
    await (interaction as any)[method]({ embeds: [embed], components: [row] });
}

async function renderInterviewResult(interaction: any, targetId: string, score: number) {
    const embed = new EmbedBuilder()
        .setTitle('🏆 Собеседование завершено!')
        .setDescription(`**Кандидат:** <@${targetId}>\n**Итоговый балл:** \`${score}\` / ${interviewQuestions.length}\n\nВыберите вердикт:`)
        .setColor('#F1C40F');

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId(`int_finish:PASS:${targetId}:${score}`).setLabel('✅ Прошел').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`int_finish:FAIL:${targetId}:${score}`).setLabel('❌ Не прошел').setStyle(ButtonStyle.Danger)
    );

    const isComponent = interaction.isButton?.() || interaction.isStringSelectMenu?.();
    const method = isComponent ? 'update' : (interaction.replied || interaction.deferred ? 'editReply' : 'reply');
    await (interaction as any)[method]({ embeds: [embed], components: [row] });
}

async function finalizeInterview(interaction: ButtonInteraction, targetId: string, score: number, status: 'PASS' | 'FAIL') {
    await (prisma as any).interview.create({
        data: {
            targetId,
            interviewerId: interaction.user.id,
            score,
            status
        }
    });

    await interaction.update({
        content: `✅ Собеседование сохранено!\n**Кандидат:** <@${targetId}>\n**Балл:** ${score}\n**Вердикт:** ${status === 'PASS' ? 'ПРОШЕЛ' : 'НЕ ПРОШЕЛ'}`,
        embeds: [],
        components: []
    });
}

// --- УПРАВЛЕНИЕ ИСТОРИЕЙ ---

async function viewInterviewHistory(interaction: ButtonInteraction, targetId?: string) {
    if (!isStar(interaction.user.id)) return interaction.reply({ content: '❌ У вас нет прав для просмотра истории собеседований.', ephemeral: true });
    
    const history = await (prisma as any).interview.findMany({
        where: targetId ? { targetId } : {},
        take: 20,
        orderBy: { createdAt: 'desc' },
        include: { target: true }
    });

    const embed = new EmbedBuilder()
        .setTitle(targetId ? `📝 История кандидата: <@${targetId}>` : '📊 Глобальная история собеседований')
        .setColor('#5865F2')
        .setTimestamp();

    if (history.length === 0) {
        embed.setDescription('*Записей не найдено.*');
        const isComp = interaction.isButton?.() || interaction.isStringSelectMenu?.();
        const meth = isComp ? 'update' : (interaction.replied || interaction.deferred ? 'editReply' : 'reply');
        return (interaction as any)[meth]({ embeds: [embed], components: [], ephemeral: true });
    }

    const description = history.map((h: any, i: number) => {
        const date = `<t:${Math.floor(h.createdAt.getTime() / 1000)}:d>`;
        const candidate = h.target?.username || `<@${h.targetId}>`;
        const resultText = h.status === 'PASS' ? '✅ Прошел' : '❌ Не прошел';
        return `**${i + 1}.** ${date} — **${candidate}**\n**Итог:** \`${h.score}\` баллов | ${resultText}\n⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯`;
    }).join('\n');

    embed.setDescription(description);

    const idForActions = targetId || 'GLOBAL';
    const components: any[] = [];
    
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId(`history_delete_all:interview:${idForActions}`).setLabel('🗑️ Удалить всё').setStyle(ButtonStyle.Danger)
    );

    const select = new StringSelectMenuBuilder()
        .setCustomId(`history_delete_single:interview:${idForActions}`)
        .setPlaceholder('Удалить конкретную запись...')
        .addOptions(history.map((h: any, i: number) => ({
            label: `Запись #${i + 1} (${h.target?.username || h.targetId})`,
            value: h.id,
            description: `${h.status === 'PASS' ? 'Пройдено' : 'Провалено'} - ${h.createdAt.toLocaleDateString()}`
        })));

    components.push(row, new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select));
    
    const isComponent = (interaction as any).isButton?.() || (interaction as any).isStringSelectMenu?.();
    const method = isComponent ? 'update' : (interaction.replied || interaction.deferred ? 'editReply' : 'reply');
    await (interaction as any)[method]({ embeds: [embed], components, ephemeral: true });
}

async function confirmDeleteAllHistory(interaction: ButtonInteraction, type: string, targetId: string) {
    const isGlobal = targetId === 'GLOBAL';
    const targetText = isGlobal ? '**ВСЮ**' : `все записи для <@${targetId}>`;
    
    const embed = new EmbedBuilder()
        .setTitle('⚠️ Подтверждение удаления')
        .setDescription(`Вы уверены, что хотите удалить ${targetText} историю (${type === 'interview' ? 'собеседований' : 'трибун'})?`)
        .setColor('#FF0000');

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId(`confirm_delete_all:${type}:${targetId}`).setLabel('Да, удалить всё').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId(type === 'interview' ? 'admin_interview_history' : 'view_history').setLabel('Отмена').setStyle(ButtonStyle.Secondary)
    );

    await interaction.update({ embeds: [embed], components: [row] });
}

async function executeDeleteAllHistory(interaction: ButtonInteraction, type: string, targetId: string) {
    if (type === 'interview') {
        if (targetId === 'GLOBAL') {
            await (prisma as any).interview.deleteMany({});
        } else {
            await (prisma as any).interview.deleteMany({ where: { targetId } });
        }
    } else {
        await (prisma as any).tribuneHistory.deleteMany({ where: { hostId: targetId } });
    }

    await interaction.update({ content: `✅ История ${type === 'interview' ? 'собеседований' : 'трибун'} успешно очищена.`, embeds: [], components: [] });
}

async function executeDeleteSingleHistory(interaction: any, type: string, targetId: string, entryId: string) {
    if (type === 'interview') {
        await (prisma as any).interview.delete({ where: { id: entryId } });
        await viewInterviewHistory(interaction, targetId === 'GLOBAL' ? undefined : targetId);
    } else {
        await (prisma as any).tribuneHistory.delete({ where: { id: entryId } });
        await viewHistory(interaction, true);
    }
}

// Обновление старой функции истории для поддержки удаления
async function viewHistory(interaction: ButtonInteraction, personal: boolean) {
    const targetUserId = interaction.user.id;
    const history = await prisma.tribuneHistory.findMany({ 
        where: personal ? { hostId: targetUserId } : {}, 
        take: 10, 
        orderBy: { closedAt: 'desc' } 
    });
    
    const embed = new EmbedBuilder()
        .setTitle(personal ? '🌟 Твои трибуны' : '📜 История трибун')
        .setColor(personal ? '#ff00ff' : '#00ffff');

    if (history.length === 0) {
        embed.setDescription('*История трибун пуста.*');
        const msg = { embeds: [embed], components: [], ephemeral: true };
        const isComponent = (interaction as any).isButton?.() || (interaction as any).isStringSelectMenu?.();
        const method = isComponent ? 'update' : (interaction.replied || interaction.deferred ? 'editReply' : 'reply');
        return (interaction as any)[method](msg);
    }

    const description = history.map((h, i) => 
        `**${i + 1}.** ${h.type} (<t:${Math.floor(h.closedAt.getTime() / 1000)}:d>)`
    ).join('\n');

    embed.setDescription(description);

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId(`history_delete_all:tribune:${targetUserId}`).setLabel('🗑️ Удалить всё').setStyle(ButtonStyle.Danger)
    );

    const select = new StringSelectMenuBuilder()
        .setCustomId(`history_delete_single:tribune:${targetUserId}`)
        .setPlaceholder('Удалить конкретную запись...')
        .addOptions(history.map((h, i) => ({
            label: `Трибуна #${i + 1}`,
            value: h.id,
            description: h.type
        })));

    const components: any[] = [row, new ActionRowBuilder().addComponents(select)];
    
    const isComponent = (interaction as any).isButton?.() || (interaction as any).isStringSelectMenu?.();
    const method = isComponent ? 'update' : (interaction.replied || interaction.deferred ? 'editReply' : 'reply');
    await (interaction as any)[method]({ embeds: [embed], components, ephemeral: true });
}
