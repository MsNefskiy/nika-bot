const { createCanvas, loadImage } = require('canvas');
const fs = require('fs');
const path = require('path');

const assetsDir = path.join(process.cwd(), 'assets');

const COLORS = {
    YELLOW: [255, 215, 0],
    RED: [221, 46, 68],
    GREEN: [120, 177, 89],
    SILVER: [189, 195, 199],
    WHITE: [255, 255, 255]
};

async function processIcon(filename, targetColor) {
    const filePath = path.join(assetsDir, filename);
    if (!fs.existsSync(filePath)) {
        console.log(`⚠️ Skip: ${filename} (not found)`);
        return;
    }

    const img = await loadImage(filePath);
    const canvas = createCanvas(img.width, img.height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = data[i + 3];

        // 1. УДАЛЯЕМ КОНТУР
        if (r < 80 && g < 80 && b < 80 && a > 0) {
            data[i + 3] = 0;
            continue;
        }

        // 2. ЗАМЕНЯЕМ ЦВЕТ
        if (a > 10 && !(r > 245 && g > 245 && b > 245)) {
            data[i] = targetColor[0];
            data[i+1] = targetColor[1];
            data[i+2] = targetColor[2];
        }
    }

    ctx.putImageData(imageData, 0, 0);
    const buffer = canvas.toBuffer('image/png');
    fs.writeFileSync(filePath, buffer);
    console.log(`✨ Processed: ${filename}`);
}

async function run() {
    console.log('--- Cleaning up remaining icons ---');
    await processIcon('sparkles.png', COLORS.YELLOW);
    await processIcon('star.png', COLORS.YELLOW);
    await processIcon('check.png', COLORS.GREEN);
    await processIcon('cross.png', COLORS.RED);
    await processIcon('calendar.png', COLORS.RED);
    await processIcon('mic.png', COLORS.SILVER);
    await processIcon('shop.png', COLORS.YELLOW);
    await processIcon('clock.png', COLORS.WHITE);
    console.log('--- All icons updated! ---');
}

run().catch(console.error);
