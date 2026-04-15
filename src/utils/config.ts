export const ADMIN_IDS = [
    '331518705835966464',
    '1271591410294063185',
    '236508653434306560'
];

// Ответственные за ежедневные задания (получают DM)
export const TASK_MANAGER_IDS = [
    '331518705835966464',
    '1271591410294063185',
];

// Ответственные за магазин (получают DM о покупках)
export const SHOP_MANAGER_IDS = [
    '1271591410294063185'
];

// Пользователи с ролью "Звездочка" (доступ к собеседованиям)
export const STAR_IDS = [
    '1271591410294063185',
    '331518705835966464'
];

export const REPRIMAND_ROLE_ID = '1264275526865129613';

// Хелперы для проверки прав
export const isAdmin = (userId: string) => ADMIN_IDS.includes(userId);
export const isTaskManager = (userId: string) => TASK_MANAGER_IDS.includes(userId);
export const isShopManager = (userId: string) => SHOP_MANAGER_IDS.includes(userId);
export const isStar = (userId: string) => STAR_IDS.includes(userId);

// Для обратной совместимости (пока не везде обновили)
export const isCurator = isAdmin;
