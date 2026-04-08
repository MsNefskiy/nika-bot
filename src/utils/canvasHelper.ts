import { createCanvas, loadImage, Canvas, CanvasRenderingContext2D, Image } from 'canvas';
import { ShopItem } from './shop';
import path from 'path';

const ASSETS_DIR = path.join(process.cwd(), 'assets');

export class CanvasHelper {
    private static iconCache: Map<string, Image> = new Map();

    private static async getIcon(name: string): Promise<Image> {
        if (this.iconCache.has(name)) return this.iconCache.get(name)!;
        const icon = await loadImage(path.join(ASSETS_DIR, `${name}.png`));
        this.iconCache.set(name, icon);
        return icon;
    }

    private static async drawBase(ctx: CanvasRenderingContext2D, width: number, height: number) {
        // --- ВОЗВРАТ К ОРИГИНАЛЬНОМУ ФОНУ ---
        // 1. Глубокий космический фон
        ctx.fillStyle = '#050505';
        ctx.fillRect(0, 0, width, height);

        // Туманности (Nebula)
        const nebula1 = ctx.createRadialGradient(width * 0.3, height * 0.7, 0, width * 0.3, height * 0.7, 300);
        nebula1.addColorStop(0, 'rgba(43, 16, 85, 0.4)');
        nebula1.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = nebula1;
        ctx.fillRect(0, 0, width, height);

        const nebula2 = ctx.createRadialGradient(width * 0.8, height * 0.2, 0, width * 0.8, height * 0.2, 400);
        nebula2.addColorStop(0, 'rgba(16, 43, 85, 0.4)');
        nebula2.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = nebula2;
        ctx.fillRect(0, 0, width, height);

        // 2. Звездное небо
        for (let i = 0; i < 150; i++) {
            const x = Math.random() * width;
            const y = Math.random() * height;
            const size = Math.random() * 1.5;
            const opacity = Math.random();
            ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
            ctx.beginPath();
            ctx.arc(x, y, size, 0, Math.PI * 2);
            ctx.fill();
            if (i % 30 === 0) {
                ctx.shadowBlur = 10;
                ctx.shadowColor = '#ffffff';
                ctx.arc(x, y, size + 1, 0, Math.PI * 2);
                ctx.fill();
                ctx.shadowBlur = 0;
            }
        }

        // 3. ТЕМНО-ФИОЛЕТОВО-КРАСНАЯ РАМКА
        const frameGrad = ctx.createLinearGradient(0, 0, width, height);
        frameGrad.addColorStop(0, '#2b1055'); // Темно-фиолетовый
        frameGrad.addColorStop(1, '#8b0000'); // Темно-красный
        
        ctx.strokeStyle = frameGrad;
        ctx.lineWidth = 12;
        ctx.strokeRect(6, 6, width - 12, height - 12);
        
        // Внутреннее свечение
        ctx.shadowBlur = 20;
        ctx.shadowColor = '#8b0000';
        ctx.lineWidth = 2;
        ctx.strokeRect(10, 10, width - 20, height - 20);
        ctx.shadowBlur = 0;
    }

    static async drawProfileCard(username: string, avatarUrl: string, hasNorma: boolean, stars: number, joinedAt: Date) {
        const width = 700;
        const height = 300;
        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext('2d');

        await this.drawBase(ctx, width, height);

        const commonGrad = ctx.createLinearGradient(0, 0, width, height);
        commonGrad.addColorStop(0, '#a76eff');
        commonGrad.addColorStop(1, '#ff6e6e');

        // --- 1. АВАТАРКА ---
        try {
            const avatar = await loadImage(avatarUrl + '?size=256');
            ctx.save();
            ctx.beginPath();
            ctx.arc(120, 150, 65, 0, Math.PI * 2);
            ctx.closePath();
            ctx.clip();
            ctx.drawImage(avatar, 55, 85, 130, 130);
            ctx.restore();

            ctx.strokeStyle = commonGrad;
            ctx.lineWidth = 5;
            ctx.beginPath();
            ctx.arc(120, 150, 65, 0, Math.PI * 2);
            ctx.stroke();
        } catch (e) {
            console.error('Ошибка аватарки:', e);
        }

        // --- 2. НИК В РАМКЕ ---
        ctx.font = 'bold 36px sans-serif';
        const nameWidth = ctx.measureText(username).width;
        const nameX = 210;
        const nameY = 135;

        ctx.strokeStyle = commonGrad;
        ctx.lineWidth = 3;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        this.drawRoundedRect(ctx, nameX, nameY, nameWidth + 40, 55, 12);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'left';
        ctx.fillText(username, nameX + 20, nameY + 40);

        // --- 3. ЗВЕЗДЫ ---
        ctx.font = 'bold 30px sans-serif';
        ctx.fillStyle = '#FFD700';
        ctx.textAlign = 'right';
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#FFD700';
        
        try {
            const star = await this.getIcon('sparkles');
            ctx.drawImage(star, width - 110, 35, 30, 30);
        } catch {}
        
        ctx.fillText(`${stars}`, width - 50, 65);
        ctx.shadowBlur = 0;

        // --- 4. ДАТА ---
        ctx.font = 'bold 20px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillStyle = commonGrad;
        const dateStr = joinedAt.toLocaleDateString('ru-RU');
        
        ctx.fillText(`С НАМИ С: ${dateStr}`, 45, height - 45);

        // --- 5. НОРМА ---
        ctx.font = 'bold 28px sans-serif';
        ctx.fillStyle = '#a76eff';
        ctx.textAlign = 'right';
        
        const normIcon = hasNorma ? 'check' : 'cross';
        try {
            const ni = await this.getIcon(normIcon);
            ctx.drawImage(ni, width - 190, height - 72, 28, 28);
        } catch {}
        
        ctx.fillText(`Норма`, width - 50, height - 45);

        return canvas.toBuffer();
    }

    static async drawShopCard(items: ShopItem[]) {
        const width = 1100; // Сделали ШИРЕ чтобы не налезали (было 800)
        const height = 650; 
        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext('2d');

        await this.drawBase(ctx, width, height);

        // Заголовок - СДЕЛАЛ ТЕМНЕЕ
        ctx.font = 'bold 44px sans-serif';
        ctx.fillStyle = '#B8860B'; // Темно-золотой (DarkGoldenRod)
        ctx.textAlign = 'center';
        ctx.shadowBlur = 5;
        ctx.shadowColor = '#000000';
        
        try {
            const shopIcon = await this.getIcon('shop');
            ctx.drawImage(shopIcon, width / 2 - 250, 35, 50, 50);
        } catch {}

        ctx.fillText('ЗВЕЗДНАЯ ЛАВКА', width / 2 + 30, 75);
        ctx.shadowBlur = 0;

        // Линия разделитель
        ctx.strokeStyle = 'rgba(184, 134, 11, 0.4)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(150, 105);
        ctx.lineTo(width - 150, 105);
        ctx.stroke();

        // Сетка (2 колонки)
        const startX = 80;
        const startY = 160;
        const colWidth = 500; // Больше места для колонок
        const rowHeight = 75;

        let index = 0;
        for (const item of items) {
            const col = index < 6 ? 0 : 1;
            const row = index % 6;
            const x = startX + col * colWidth;
            const y = startY + row * rowHeight;

            // Название товара
            ctx.font = 'bold 20px sans-serif';
            ctx.textAlign = 'left';
            ctx.fillStyle = '#FFFFFF';
            ctx.fillText(item.name.substring(0, 40), x, y);

            // Цена
            ctx.fillStyle = '#FFD700';
            ctx.font = 'bold 20px sans-serif';
            
            try {
                const s = await this.getIcon('sparkles');
                ctx.drawImage(s, x + 355, y - 18, 20, 20);
            } catch {}

            ctx.fillText(`${item.price}`, x + 380, y);

            // Описание
            ctx.font = '15px sans-serif';
            ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
            ctx.fillText(item.desc.substring(0, 60), x, y + 28);

            // Разделительная черта под товаром
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
            ctx.beginPath();
            ctx.moveTo(x, y + 42);
            ctx.lineTo(x + 450, y + 42);
            ctx.stroke();
            
            index++;
        }

        return canvas.toBuffer();
    }

    private static drawRoundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + width - radius, y);
        ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
        ctx.lineTo(x + width, y + height - radius);
        ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        ctx.lineTo(x + radius, y + height);
        ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
    }

    // ТРИБУНЫ
    static async drawTribuneCard(tribune: any, hostNames: any) {
        const width = 1000; // Шире (было 800)
        const height = 600; // Выше (было 500)
        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext('2d');
        await this.drawBase(ctx, width, height);

        const commonGrad = ctx.createLinearGradient(0, 0, width, height);
        commonGrad.addColorStop(0, '#a76eff');
        commonGrad.addColorStop(1, '#ff6e6e');

        // Название трибуны (По центру 500)
        ctx.font = 'bold 42px sans-serif';
        ctx.fillStyle = commonGrad;
        ctx.textAlign = 'center';
        
        ctx.fillText(`${tribune.type}`, width / 2, 80);

        // Время (По центру 500)
        ctx.font = '28px sans-serif';
        ctx.fillStyle = commonGrad;
        
        ctx.fillText(`Время: ${tribune.dateTime}`, width / 2, 130);

        // Центральная линия (По центру 500)
        ctx.strokeStyle = commonGrad;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(width / 2, 180);
        ctx.lineTo(width / 2, 530);
        ctx.stroke();

        // Заголовки половин (250 и 750)
        ctx.font = 'bold 26px sans-serif';
        ctx.fillStyle = commonGrad;
        ctx.fillText('Ведущие (1 пол.)', width * 0.25, 190);
        ctx.fillText('Ведущие (2 пол.)', width * 0.75, 190);

        const slots = [
            { key: 'slot1_1', x: width * 0.25, y: 270, label: 'Место 1.1' },
            { key: 'slot1_2', x: width * 0.25, y: 410, label: 'Место 1.2' },
            { key: 'slot2_1', x: width * 0.75, y: 270, label: 'Место 2.1' },
            { key: 'slot2_2', x: width * 0.75, y: 410, label: 'Место 2.2' },
        ];

        slots.forEach(slot => {
            const occupant = hostNames[slot.key];
            
            // Рамка слота (Шире плашка 350px)
            ctx.strokeStyle = commonGrad;
            ctx.lineWidth = 2;
            const cardW = 350;
            const cardH = 90;
            ctx.strokeRect(slot.x - cardW / 2, slot.y - 50, cardW, cardH);

            // Название места
            ctx.fillStyle = commonGrad;
            ctx.font = '22px sans-serif';
            ctx.fillText(`${slot.label}:`, slot.x, slot.y - 20);

            // Имя ведущего
            if (occupant) {
                ctx.fillStyle = commonGrad;
                ctx.font = 'bold 26px sans-serif';
                ctx.fillText(occupant, slot.x, slot.y + 20);
            } else {
                ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
                ctx.font = 'italic 20px sans-serif';
                ctx.fillText('СВОБОДНО', slot.x, slot.y + 20);
            }
        });

        return canvas.toBuffer();
    }
}
