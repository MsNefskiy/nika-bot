import { GuildMember } from 'discord.js';
import { REPRIMAND_ROLE_ID } from '../utils/config';
import { invalidateHostsCache } from '../utils/hostCache';

export default {
    name: 'guildMemberUpdate',
    async execute(oldMember: GuildMember, newMember: GuildMember) {
        // Проверяем, изменились ли роли
        const oldRoles = oldMember.roles.cache;
        const newRoles = newMember.roles.cache;

        // Если роль ведущего была добавлена или удалена
        const hadRole = oldRoles.has(REPRIMAND_ROLE_ID);
        const hasRole = newRoles.has(REPRIMAND_ROLE_ID);

        if (hadRole !== hasRole) {
            console.log(`[Event] У ${newMember.user.username} изменился статус ведущего. Сбрасываю кеш...`);
            invalidateHostsCache();
        }
    },
};
