import { Collection, GuildMember, Guild } from 'discord.js';
import { REPRIMAND_ROLE_ID } from './config';

let hostsCache: Collection<string, GuildMember> | null = null;
let lastFetchTime = 0;
const CACHE_TTL = 15 * 60 * 1000; // 15 минут

/**
 * Получить список ведущих (с использованием кеша)
 */
export async function getHosts(guild: Guild): Promise<Collection<string, GuildMember>> {
    const now = Date.now();

    // Если кеш есть и он не протух — отдаем его
    if (hostsCache && (now - lastFetchTime < CACHE_TTL)) {
        return hostsCache;
    }

    console.log('[Cache] Запрашиваю свежий список участников из Discord...');
    
    // Скачиваем участников сервера (это "тяжелый" запрос, делаем редко)
    const allMembers = await guild.members.fetch();
    
    // Фильтруем ведущих
    hostsCache = allMembers.filter(m => m.roles.cache.has(REPRIMAND_ROLE_ID));
    lastFetchTime = now;

    console.log(`[Cache] Обновлено: найдено ${hostsCache.size} ведущих.`);
    return hostsCache;
}

/**
 * Принудительно очистить кеш (например, при смене ролей)
 */
export function invalidateHostsCache() {
    console.log('[Cache] Кеш сброшен (состав изменен).');
    hostsCache = null;
    lastFetchTime = 0;
}
