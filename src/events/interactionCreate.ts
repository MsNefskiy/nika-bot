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
    EmbedBuilder
} from 'discord.js';
import { MyClient } from '../index';
import { prisma } from '../handlers/db';
import { CanvasHelper } from '../utils/canvasHelper';
import { tasks } from '../utils/tasks';

const CURATOR_ID = '1271591410294063185';

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
                
                // --- ЗАДАНИЯ ---
                if (id === 'view_tasks') await handleTasksView(interaction);
                if (id === 'submit_task') await submitTaskToCurator(interaction, client);
                if (id.startsWith('approve_task_')) await approveTask(interaction, id.split('_')[2], client);
                if (id.startsWith('deny_task_')) await denyTask(interaction, id.split('_')[2], client);
            }

            if (interaction.isStringSelectMenu()) {
                if (interaction.customId === 'select_event_type') {
                    await interaction.message.delete().catch(() => {});
                    await showDateModal(interaction, interaction.values[0]);
                }
                if (interaction.customId === 'select_leave_slot') {
                    await leaveSpecificSlot(interaction, interaction.values[0]);
                }
            }

            if (interaction.isModalSubmit()) {
                if (interaction.customId.startsWith('modal_create_tribune')) {
                    const type = interaction.customId.split(':')[1];
                    const dateTime = interaction.fields.getTextInputValue('date_input');
                    await createTribuneInDb(interaction, type, dateTime);
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

// --- СИСТЕМА ЗАДАНИЙ ---

async function handleTasksView(interaction: any) {
    const user = await prisma.user.findUnique({ where: { discordId: interaction.user.id } });
    if (!user) return;

    let taskIndex = user.currentTaskIndex;
    let isTaskDone = user.isTaskDone;
    let isTaskPending = user.isTaskPending;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const lastTaskDate = user.lastTaskDate ? new Date(user.lastTaskDate) : null;
    if (lastTaskDate) lastTaskDate.setHours(0, 0, 0, 0);

    // Если задание было получено не сегодня, обновляем его
    if (!lastTaskDate || lastTaskDate.getTime() !== today.getTime()) {
        taskIndex = Math.floor(Math.random() * tasks.length);
        isTaskDone = false;
        isTaskPending = false;
        
        await prisma.user.update({
            where: { discordId: interaction.user.id },
            data: {
                currentTaskIndex: taskIndex,
                lastTaskDate: new Date(),
                isTaskDone: false,
                isTaskPending: false
            }
        });
    }

    const taskText = tasks[taskIndex!];
    
    let statusText = '📝 Твое задание на сегодня:';
    if (isTaskPending) statusText = '⏳ Задание на проверке у куратора:';
    if (isTaskDone) statusText = '✅ Ты уже выполнил задание на сегодня:';

    const embed = new EmbedBuilder()
        .setTitle('📅 Ежедневное задание')
        .setDescription(`${statusText}\n\n>>> **${taskText}**`)
        .setColor(isTaskDone ? '#00ff00' : (isTaskPending ? '#ffff00' : '#00ffff'));

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId('submit_task')
            .setLabel('Выполнено')
            .setStyle(ButtonStyle.Success)
            .setDisabled(isTaskDone || isTaskPending)
    );

    await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
}

async function submitTaskToCurator(interaction: any, client: MyClient) {
    const user = await prisma.user.findUnique({ where: { discordId: interaction.user.id } });
    if (!user || user.currentTaskIndex === null) return;

    await prisma.user.update({
        where: { discordId: interaction.user.id },
        data: { isTaskPending: true }
    });

    const curator = await client.users.fetch(CURATOR_ID).catch(() => null);
    if (!curator) {
        return interaction.reply({ content: '❌ Ошибка: Куратор не найден!', ephemeral: true });
    }

    const embed = new EmbedBuilder()
        .setTitle('📢 Новое выполненное задание!')
        .setDescription(`Пользователь <@${interaction.user.id}> утверждает, что выполнил задание:\n\n**${tasks[user.currentTaskIndex]}**`)
        .setColor('#7289da');

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId(`approve_task_${interaction.user.id}`).setLabel('Да, принять').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`deny_task_${interaction.user.id}`).setLabel('Нет, отклонить').setStyle(ButtonStyle.Danger)
    );

    await curator.send({ embeds: [embed], components: [row] }).catch(console.error);

    await interaction.update({ content: '✅ Задание отправлено на проверку куратору!', embeds: [], components: [] });
    setTimeout(() => interaction.deleteReply().catch(() => {}), 5000);
}

async function approveTask(interaction: any, userId: string, client: MyClient) {
    const user = await prisma.user.findUnique({ where: { discordId: userId } });
    if (!user) return interaction.update({ content: 'Ошибка: пользователь не найден.', components: [] });

    await prisma.user.update({
        where: { discordId: userId },
        data: { 
            stars: { increment: 50 },
            isTaskDone: true,
            isTaskPending: false
        }
    });

    await interaction.update({ content: `✅ Задание <@${userId}> одобрено. +50 звезд начислено!`, components: [] });

    const targetUser = await client.users.fetch(userId).catch(() => null);
    if (targetUser) {
        await targetUser.send('🌟 Куратор одобрил твое задание! Тебе начислено **50 звезд**.').catch(() => {});
    }
}

async function denyTask(interaction: any, userId: string, client: MyClient) {
    await prisma.user.update({
        where: { discordId: userId },
        data: { isTaskPending: false }
    });

    await interaction.update({ content: `❌ Задание <@${userId}> отклонено.`, components: [] });

    const targetUser = await client.users.fetch(userId).catch(() => null);
    if (targetUser) {
        await targetUser.send('❌ Твое задание было отклонено куратором. Попробуй выполнить его лучше!').catch(() => {});
    }
}

// --- ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ТРИБУН (без изменений, но импортированы) ---

async function renderTribuneView(interaction: any) {
    const activeTribune = await prisma.tribune.findFirst({ where: { status: 'ACTIVE' } });
    if (!activeTribune) {
        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId('create_event').setLabel('Создать событие').setStyle(ButtonStyle.Success)
        );
        return interaction.reply({ content: 'Активных событий нет.', components: [row], ephemeral: true });
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
        if (interaction.replied || interaction.deferred) {
            await interaction.editReply({ files: [attachment], components: rows, content: '' });
        } else {
            await interaction.update({ files: [attachment], components: rows, content: '' });
        }
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
    const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('complete_tribune').setLabel('Завершить трибуну').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('cancel_tribune').setLabel('Отменить трибуну').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('leave_tribune').setLabel('Выписаться').setStyle(ButtonStyle.Primary).setDisabled(userSlots.length === 0)
    );
    return [row1, row2];
}

function getUserSlots(tribune: any, userId: string): string[] {
    const slots = ['slot1_1', 'slot1_2', 'slot2_1', 'slot2_2'];
    return slots.filter(s => (tribune as any)[s] === userId);
}

async function joinSlot(interaction: any, slot: string) {
    const tribune = await prisma.tribune.findFirst({ where: { status: 'ACTIVE' } });
    if (!tribune || (tribune as any)[slot]) return;
    await (prisma.tribune as any).update({ where: { id: tribune.id }, data: { [slot]: interaction.user.id } });
    await updateTribuneMessage(interaction);
}

async function handleLeaveRequest(interaction: any) {
    const tribune = await prisma.tribune.findFirst({ where: { status: 'ACTIVE' } });
    if (!tribune) return;
    const userSlots = getUserSlots(tribune, interaction.user.id);
    if (userSlots.length === 0) return interaction.reply({ content: 'Вы не записаны.', ephemeral: true });
    if (userSlots.length === 1) {
        await leaveSpecificSlot(interaction, userSlots[0]);
    } else {
        const select = new StringSelectMenuBuilder().setCustomId('select_leave_slot').setPlaceholder('Выберите место для освобождения').addOptions(userSlots.map(s => new StringSelectMenuOptionBuilder().setLabel(`Место ${s.replace('slot','').replace('_','.')}`).setValue(s)));
        await interaction.reply({ content: 'Отмена записи:', components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select)], ephemeral: true });
    }
}

async function leaveSpecificSlot(interaction: any, slot: string) {
    const tribune = await prisma.tribune.findFirst({ where: { status: 'ACTIVE' } });
    if (!tribune) return;
    await (prisma.tribune as any).update({ where: { id: tribune.id }, data: { [slot]: null } });
    if (interaction.isStringSelectMenu()) { await interaction.update({ content: 'Запись отменена!', components: [] }); } else { await updateTribuneMessage(interaction); }
}

async function cancelTribune(interaction: any) {
    const activeTribune = await prisma.tribune.findFirst({ where: { status: 'ACTIVE' } });
    if (!activeTribune) return;
    await prisma.tribune.delete({ where: { id: activeTribune.id } });
    await interaction.update({ content: '❌ Трибуна отменена без сохранения.', components: [], files: [] });
    setTimeout(() => interaction.deleteReply().catch(() => {}), 5000);
}

async function completeTribune(interaction: any) {
    const activeTribune = await prisma.tribune.findFirst({ where: { status: 'ACTIVE' } });
    if (!activeTribune) return;
    const hostIds = [activeTribune.slot1_1, activeTribune.slot1_2, activeTribune.slot2_1, activeTribune.slot2_2].filter(id => id !== null) as string[];
    await prisma.tribuneHistory.create({ data: { type: activeTribune.type, startTime: activeTribune.dateTime, hostId: interaction.user.id, participants: hostIds.join(',') } });
    await prisma.tribune.delete({ where: { id: activeTribune.id } });
    await interaction.update({ content: '✅ Трибуна завершена и добавлена в историю!', components: [], files: [] });
    setTimeout(() => interaction.deleteReply().catch(() => {}), 5000);
}

async function viewHistory(interaction: any, personal: boolean) {
    const history = await prisma.tribuneHistory.findMany({ where: personal ? { hostId: interaction.user.id } : {}, take: 5, orderBy: { closedAt: 'desc' } });
    if (history.length === 0) return interaction.reply({ content: 'История пока пуста.', ephemeral: true });
    const embed = new EmbedBuilder().setTitle(personal ? '🌟 Твои проведенные трибуны' : '📜 Общая история трибун').setColor(personal ? '#ff00ff' : '#00ffff').setThumbnail(interaction.guild.iconURL()).setTimestamp();
    history.forEach(h => {
        const hosts = h.participants?.split(',').map(id => id.trim()).filter(id => id && id !== 'null' && id !== 'пусто').map(id => `<@${id}>`).join(', ') || '*нет ведущих*';
        embed.addFields({ name: `━━━━━━━━━━━━━━━`, value: `**${h.type}** (${h.startTime})\n` + `👑 **Создатель:** <@${h.hostId.trim()}>\n` + `🎤 **Ведущие:** ${hosts}\n` + `📅 Завершена: <t:${Math.floor(h.closedAt.getTime() / 1000)}:R>`, inline: false });
    });
    await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function showEventSelector(interaction: any) {
    const select = new StringSelectMenuBuilder().setCustomId('select_event_type').setPlaceholder('Выберите тип события').addOptions(new StringSelectMenuOptionBuilder().setLabel('Синяя кнопка').setValue('Синяя кнопка'), new StringSelectMenuOptionBuilder().setLabel('Быстрые свидания').setValue('Быстрые свидания'), new StringSelectMenuOptionBuilder().setLabel('Шоу талантов').setValue('Шоу талантов'), new StringSelectMenuOptionBuilder().setLabel('Любовь в вопросах').setValue('Любовь в вопросах'), new StringSelectMenuOptionBuilder().setLabel('Любовное колесо').setValue('Любовное колесо'), new StringSelectMenuOptionBuilder().setLabel('Давай поженимся').setValue('Давай поженимся'));
    await interaction.update({ content: 'Выберите тип трибуны:', components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select)], files: [] });
}

async function showDateModal(interaction: any, eventType: string) {
    const modal = new ModalBuilder().setCustomId(`modal_create_tribune:${eventType}`).setTitle('Параметры события');
    modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId('date_input').setLabel("Дата и время (напр. Завтра 20:00)").setStyle(TextInputStyle.Short).setRequired(true)));
    await interaction.showModal(modal);
}

async function createTribuneInDb(interaction: any, type: string, dateTime: string) {
    await prisma.tribune.create({ data: { type, dateTime, creatorId: interaction.user.id, status: 'ACTIVE' } });
    await prisma.user.upsert({ where: { discordId: interaction.user.id }, update: { username: interaction.user.username }, create: { discordId: interaction.user.id, username: interaction.user.username } });
    await interaction.reply({ content: `✅ Трибуна "${type}" успешно создана!`, ephemeral: true });
    setTimeout(() => interaction.deleteReply().catch(() => {}), 5000);
}
