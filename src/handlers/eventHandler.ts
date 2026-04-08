import { MyClient } from '../types';
import fs from 'fs';
import path from 'path';

export async function loadEvents(client: MyClient) {
    const eventsPath = path.join(__dirname, '../events');
    const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.ts') || file.endsWith('.js'));

    for (const file of eventFiles) {
        const filePath = path.join(eventsPath, file);
        const event = require(filePath).default;
        
        if (event.once) {
            client.once(event.name, (...args: any[]) => event.execute(...args, client));
        } else {
            client.on(event.name, (...args: any[]) => event.execute(...args, client));
        }
    }
    console.log(`✅ Загружено событий: ${eventFiles.length}`);
}
