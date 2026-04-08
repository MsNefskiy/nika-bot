import { createCanvas, loadImage, Canvas, CanvasRenderingContext2D } from 'canvas';
import { ShopItem } from './shop';

export class CanvasHelper {
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
        ctx.fillText(`✨ ${stars}`, width - 50, 65);
        ctx.shadowBlur = 0;

        // --- 4. ДАТА ---
        ctx.font = 'bold 20px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillStyle = commonGrad;
        const dateStr = joinedAt.toLocaleDateString('ru-RU');
        ctx.fillText(`📅 С НАМИ С: ${dateStr}`, 45, height - 45);

        // --- 5. НОРМА ---
        ctx.font = 'bold 28px sans-serif';
        const normText = `Норма: ${hasNorma ? '✅' : '❌'}`;
        ctx.fillStyle = commonGrad;
        ctx.textAlign = 'right';
        ctx.fillText(normText, width - 50, height - 45);

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
        ctx.fillText('🛒 ЗВЕЗДНАЯ ЛАВКА', width / 2, 75);
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

        items.forEach((item, index) => {
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
            ctx.fillText(`✨ ${item.price}`, x + 380, y);

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
        });

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
        const width = 800;
        const height = 500;
        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext('2d');
        await this.drawBase(ctx, width, height);

        ctx.font = 'bold 36px sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.fillText(`Трибуна: ${tribune.type}`, 400, 70);
        ctx.font = '24px sans-serif';
        ctx.fillText(`Время: ${tribune.dateTime}`, 400, 110);

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(400, 150);
        ctx.lineTo(400, 450);
        ctx.stroke();

        ctx.font = 'bold 24px sans-serif';
        ctx.fillText('Ведущие (1 пол.)', 200, 160);
        ctx.fillText('Ведущие (2 пол.)', 600, 160);

        const slots = [
            { key: 'slot1_1', x: 200, y: 220, label: 'Место 1.1' },
            { key: 'slot1_2', x: 200, y: 320, label: 'Место 1.2' },
            { key: 'slot2_1', x: 600, y: 220, label: 'Место 2.1' },
            { key: 'slot2_2', x: 600, y: 320, label: 'Место 2.2' },
        ];

        slots.forEach(slot => {
            const occupant = hostNames[slot.key];
            ctx.fillStyle = occupant ? '#00ffff' : '#888888';
            ctx.font = '20px sans-serif';
            ctx.fillText(`${slot.label}:`, slot.x, slot.y - 15);
            ctx.font = occupant ? 'bold 22px sans-serif' : 'italic 18px sans-serif';
            ctx.fillText(occupant || 'свободно', slot.x, slot.y + 15);
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
            ctx.strokeRect(slot.x - 130, slot.y - 40, 260, 70);
        });

        return canvas.toBuffer();
    }
}
