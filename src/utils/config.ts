export const CURATORS = [
    '1271591410294063185',
    '236508653434306560',
    '331518705835966464'
];

export const REPRIMAND_ROLE_ID = '1264275526865129613';

export const isCurator = (userId: string) => CURATORS.includes(userId);
