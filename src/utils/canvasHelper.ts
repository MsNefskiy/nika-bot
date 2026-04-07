import { createCanvas, loadImage, Canvas, CanvasRenderingContext2D } from 'canvas';
import { User, Tribune } from '@prisma/client';

export class CanvasHelper {
    private static async drawBase(ctx: CanvasRenderingContext2D, width: number, height: number) {
        // Сине-розовый градиентный фон
        const gradient = ctx.createLinearGradient(0, 0, width, height);
        gradient.addColorStop(0, '#1a2a6c'); // Глубокий синий
        gradient.addColorStop(0.5, '#b21f1f'); // Пурпурный
        gradient.addColorStop(1, '#fdbb2d'); // Золотисто-розовый
        
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);

        // Рисуем декоративные "анимированные" рамки (слоистые градиенты)
        ctx.strokeStyle = '#ff00ff';
        ctx.lineWidth = 8;
        ctx.strokeRect(10, 10, width - 20, height - 20);

        ctx.strokeStyle = '#00ffff';
        ctx.lineWidth = 4;
        ctx.strokeRect(15, 15, width - 30, height - 30);

        // Рисуем "бабочек" (простые декоративные формы)
        this.drawButterfly(ctx, 50, 50, '#ffccff');
        this.drawButterfly(ctx, width - 50, height - 50, '#ccffff');
        this.drawButterfly(ctx, width - 100, 40, '#ff99ff');
    }

    private static drawButterfly(ctx: CanvasRenderingContext2D, x: number, y: number, color: string) {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.bezierCurveTo(x - 20, y - 20, x - 20, y + 20, x, y);
        ctx.bezierCurveTo(x + 20, y - 20, x + 20, y + 20, x, y);
        ctx.fill();
    }

    static async drawProfileCard(username: string, hasNorma: boolean) {
        const canvas = createCanvas(700, 250);
        const ctx = canvas.getContext('2d');

        await this.drawBase(ctx, 700, 250);

        // Имя
        ctx.font = 'bold 48px sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = 10;
        ctx.textAlign = 'center';
        ctx.fillText(username, 350, 110);

        // Норма
        ctx.font = '30px sans-serif';
        const normText = `Норма: ${hasNorma ? '✅' : '❌'}`;
        ctx.fillStyle = hasNorma ? '#00ff00' : '#ff0000';
        ctx.fillText(normText, 350, 170);

        return canvas.toBuffer();
    }

    static async drawTribuneCard(tribune: any, participants: any) {
        const canvas = createCanvas(800, 500);
        const ctx = canvas.getContext('2d');

        await this.drawBase(ctx, 800, 500);

        // Заголовок
        ctx.font = 'bold 36px sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.fillText(`Трибуна: ${tribune.type}`, 400, 60);
        ctx.font = '24px sans-serif';
        ctx.fillText(`Время: ${tribune.dateTime}`, 400, 100);

        // Разделение на половины
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(400, 150);
        ctx.lineTo(400, 450);
        ctx.stroke();

        ctx.font = 'bold 24px sans-serif';
        ctx.fillText('Ведущие (1 пол.)', 200, 150);
        ctx.fillText('Ведущие (2 пол.)', 600, 150);

        // Места
        ctx.font = '20px sans-serif';
        const slots = [
            { key: 'slot1_1', x: 200, y: 200, label: 'Место 1.1' },
            { key: 'slot1_2', x: 200, y: 280, label: 'Место 1.2' },
            { key: 'slot2_1', x: 600, y: 200, label: 'Место 2.1' },
            { key: 'slot2_2', x: 600, y: 280, label: 'Место 2.2' },
        ];

        slots.forEach(slot => {
            const occupant = participants[slot.key];
            ctx.fillStyle = occupant ? '#ffcc00' : '#a0a0a0';
            ctx.fillText(`${slot.label}: ${occupant || 'свободно'}`, slot.x, slot.y);
            
            // Рамка для места
            ctx.strokeStyle = '#ffffff';
            ctx.strokeRect(slot.x - 150, slot.y - 30, 300, 50);
        });

        return canvas.toBuffer();
    }
}
