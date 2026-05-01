import { prisma } from '../handlers/db';

export interface HostInfo {
    id: string;
    displayName: string;
    username: string;
}

let hostsCache: HostInfo[] | null = null;
let lastFetchTime = 0;
const CACHE_TTL = 15 * 60 * 1000; // 15 минут

export async function getHosts(): Promise<HostInfo[]> {
    const now = Date.now();
    if (hostsCache && (now - lastFetchTime < CACHE_TTL)) {
        return hostsCache;
    }

    const users = await prisma.user.findMany({
        select: { discordId: true, username: true },
        orderBy: { username: 'asc' }
    });

    hostsCache = users.map(u => ({
        id: u.discordId,
        displayName: u.username,
        username: u.username
    }));
    lastFetchTime = now;
    return hostsCache;
}

export function invalidateHostsCache() {
    hostsCache = null;
    lastFetchTime = 0;
}
