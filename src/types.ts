import { Client, Collection } from 'discord.js';

export class MyClient extends Client {
    commands: Collection<string, any> = new Collection();
}
