export interface ShopItem {
    id: string;
    name: string;
    price: number;
    desc: string;
}

export const shopItems: ShopItem[] = [
    { id: 'profile_force', name: 'Заставить поставить профиль', price: 600, desc: 'На сервере Lounge' },
    { id: 'timeout_10min', name: 'Тайм-аут на 10 минут', price: 600, desc: 'Без нарушения обязанностей' },
    { id: 'remove_hard_reprimand', name: 'Снять строгий выговор', price: 800, desc: 'Не чаще 1 раза в 2 недели' },
    { id: 'remove_soft_reprimand', name: 'Снять устный выговор', price: 750, desc: 'Не чаще 1 раза в 2 недели' },
    { id: 'no_cd_tribune', name: 'Освобождение от кд трибун', price: 600, desc: 'Один и тот же человек 2 раза подряд' },
    { id: 'server_coins_1000', name: '1000 серверной валюты', price: 450, desc: 'Без лимита' },
    { id: 'private_room_month', name: 'Личная комната на месяц', price: 4000, desc: 'С возможностью продления' },
    { id: 'curator_signa', name: 'Сигна от куратора', price: 3000, desc: 'На руке или другой части тела' },
    { id: 'custom_role', name: 'Личная роль', price: 3300, desc: 'Продление и создание самостоятельно' },
    { id: 'star_signa', name: 'Сигна от звёздочки', price: 2500, desc: 'На выбор куратора' },
    { id: 'nitro_full', name: 'Nitro Full', price: 3000, desc: 'Выдается подарком (ссылкой)' },
    { id: 'custom_reprimand', name: 'Кастомный выговор', price: 700, desc: 'Только милые выговоры' }
];
