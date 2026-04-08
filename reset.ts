import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function reset() {
  const myDiscordId = '472382706345312266'; // Замени на свой ID
  
  await prisma.user.update({
    where: { discordId: myDiscordId },
    data: { 
      lastTaskDate: null,
      isTaskDone: false,
      isTaskPending: false
    }
  });
  
  console.log('✅ Задание обнулено! Можешь снова нажимать кнопку в профиле.');
}

reset();
