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
import { ADMIN_IDS, TASK_MANAGER_IDS, SHOP_MANAGER_IDS, isAdmin, isTaskManager, isShopManager, REPRIMAND_ROLE_ID } from '../utils/config';
import { shopItems } from '../utils/shop';

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
                if (id === 'view_tribune') await renderTribuneView(interaction);
                if (id === 'create_event') await showEventSelector(interaction);
                if (id.startsWith('join_')) {
                    const parts = id.split('_');
                    const slot = `slot${parts[1]}_${parts[2]}`;
                    await joinSlot(interaction, slot);
                }
                if (id === 'leave_tribune') await handleLeaveRequest(interaction);
                if (id === 'complete_tribune') await completeTribune(interaction);
                if (id === 'cancel_tribune') await cancelTribune(interaction);
                if (id === 'view_history') await viewHistory(interaction, false);
                if (id === 'view_personal_history') await viewHistory(interaction, true);
                if (id === 'clear_history') await clearHistory(interaction);
                
                // --- ЗАДАНИЯ ---
                if (id === 'view_tasks') await handleTasksView(interaction);
                if (id === 'submit_task') await submitTaskToCurators(interaction, client);
                if (id.startsWith('approve_task_')) await approveTask(interaction, id.split('_')[2], client);
                if (id.startsWith('deny_task_')) await denyTask(interaction, id.split('_')[2], client);

                // --- ВЫГОВОРЫ ---
                if (id === 'view_my_reprimands') await viewMyReprimands(interaction);
                if (id === 'admin_issue_reprimand') await initiateReprimandIssue(interaction);
                if (id === 'admin_remove_reprimand') await initiateReprimandRemove(interaction);

                // --- МАГАЗИН ---
                if (id === 'view_shop') await handleShopView(interaction);
                if (id.startsWith('confirm_buy:')) await processPurchase(interaction, id.split(':')[1], client);

                // --- НОРМА ВЕДУЩИХ (АДМИН) ---
                if (id === 'admin_view_norms') await viewHostsNorms(interaction);
                if (id === 'admin_view_tiktok_norms') await viewHostsTikTokNorms(interaction);

                // --- ТИКТОКИ (ОДОБРЕНИЕ) ---
                if (id.startsWith('approve_tiktok_')) await approveTikTok(interaction, id.split('_')[2], client);
                if (id.startsWith('deny_tiktok_')) await denyTikTok(interaction, id.split('_')[2], client);
            }

            if (interaction.isStringSelectMenu()) {
                if (interaction.customId === 'select_event_type') {
                    await interaction.message.delete().catch(() => {});
                    await showDateModal(interaction, (interaction as StringSelectMenuInteraction).values[0]);
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

                // Магазин: Выбор товара
                if (interaction.customId === 'select_shop_item') {
                    await handleShopSelection(interaction as StringSelectMenuInteraction, (interaction as StringSelectMenuInteraction).values[0]);
                }
            }

            if (interaction.isModalSubmit()) {
                if (interaction.customId.startsWith('modal_create_tribune')) {
                    const type = interaction.customId.split(':')[1];
                    const dateTime = interaction.fields.getTextInputValue('date_input');
                    await createTribuneInDb(interaction, type, dateTime);
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
    const embed = new EmbedBuilder().setTitle('📅 Ежедневное задание').setDescription(`${statusText}\n\n>>> **${taskText}**`).setColor(isTaskDone ? '#00ff00' : (isTaskPending ? '#ffff00' : '#00ffff'));
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId('submit_task').setLabel('Выполнено').setStyle(ButtonStyle.Success).setDisabled(isTaskDone || isTaskPending));
    await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
}

async function submitTaskToCurators(interaction: ButtonInteraction, client: MyClient) {
    const user = await prisma.user.findUnique({ where: { discordId: interaction.user.id } });
    if (!user || user.currentTaskIndex === null) return;
    await prisma.user.update({ where: { discordId: interaction.user.id }, data: { isTaskPending: true } });
    
    const embed = new EmbedBuilder().setTitle('📢 Новое выполненное задание!').setDescription(`Пользователь <@${interaction.user.id}> утверждает, что выполнил задание:\n\n**${tasks[user.currentTaskIndex]}**`).setColor('#7289da');
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

async function viewHistory(interaction: ButtonInteraction, personal: boolean) {
    const history = await prisma.tribuneHistory.findMany({ 
        where: personal ? { hostId: interaction.user.id } : {}, 
        take: 5, 
        orderBy: { closedAt: 'desc' } 
    });
    
    if (history.length === 0) return interaction.reply({ content: 'История пуста.', ephemeral: true });
    
    const embed = new EmbedBuilder()
        .setTitle(personal ? '🌟 Твои трибуны' : '📜 История')
        .setColor(personal ? '#ff00ff' : '#00ffff')
        .setTimestamp();
        
    history.forEach((h: any) => {
        const hosts = h.participants?.split(',').map((id: string) => id.trim()).filter((id: string) => id && id !== 'null').map((id: string) => `<@${id}>`).join(', ') || '*нет ведущих*';
        embed.addFields({
            name: `━━━━━━━━━━━━━━━`,
            value: `**${h.type}** (${h.startTime})\n` +
                   `👑 **Создатель:** <@${h.hostId.trim()}>\n` +
                   `🎤 **Ведущие:** ${hosts}\n` +
                   `📅 Завершена: <t:${Math.floor(h.closedAt.getTime() / 1000)}:R>`,
            inline: false
        });
    });

    const rows = [];
    if (!personal && isAdmin(interaction.user.id)) {
        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
                .setCustomId('clear_history')
                .setLabel('Очистить историю')
                .setStyle(ButtonStyle.Danger)
        );
        rows.push(row);
    }

    await interaction.reply({ embeds: [embed], components: rows, ephemeral: true });
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

        const HOST_ROLE_ID = '1264275526865129613';
        const members = await guild.members.fetch();
        const hosts = members.filter(m => m.roles.cache.has(HOST_ROLE_ID));

        const twoWeeksAgo = new Date();
        twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

        // Получаем всех пользователей-ведущих из базы
        const hostIds = hosts.map(h => h.id);
        const hostDataFromDb = await prisma.user.findMany({
            where: { discordId: { in: hostIds } }
        });

        const dataForCard = hosts.map(member => {
            const dbUser = hostDataFromDb.find(u => u.discordId === member.id);
            let hasNorma = false;
            
            if (dbUser?.hasNorma && dbUser.normaLastUpdated) {
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

        // Сортировка: сначала те, у кого есть норма, потом остальные (или по алфавиту)
        dataForCard.sort((a, b) => b.username.localeCompare(a.username));

        const buffer = await CanvasHelper.drawHostsNormaCard(dataForCard);
        const attachment = new AttachmentBuilder(buffer, { name: 'hosts_norma.png' });

        await interaction.editReply({ files: [attachment] });
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

        const HOST_ROLE_ID = '1264275526865129613';
        const members = await guild.members.fetch();
        const hosts = members.filter(m => m.roles.cache.has(HOST_ROLE_ID));

        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

        // Получаем всех пользователей-ведущих из базы с их тиктоками
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

        const dataForCard = hosts.map(member => {
            const dbUser = hostDataFromDb.find(u => u.discordId === member.id);
            const hasNorma = (dbUser?._count?.tiktoks || 0) > 0;
            return {
                username: member.displayName,
                hasNorma
            };
        });

        dataForCard.sort((a, b) => a.username.localeCompare(b.username));

        const buffer = await CanvasHelper.drawTikTokNormaCard(dataForCard);
        const attachment = new AttachmentBuilder(buffer, { name: 'tiktoks_norma.png' });

        await interaction.editReply({ files: [attachment] });
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
