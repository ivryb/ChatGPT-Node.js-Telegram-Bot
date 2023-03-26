import { Bot, InlineKeyboard } from 'grammy';
import { run, sequentialize } from '@grammyjs/runner';
import { hydrateReply, parseMode } from '@grammyjs/parse-mode';
import { I18n } from '@grammyjs/i18n';

import Amplitude from 'amplitude';

import { Configuration, OpenAIApi } from 'openai';

const { chatBotToken, openAiKey, amplitudeApiKey, payLinkMonth, payLinkSixMonths, payLinkAny } = process.env;

import {
  botSession,
  getSessionKey,
  saveUser,
  canMakeRequest,
  isFreeUser,
  isAdmin,
  removeFreeRequest,
  enableUserSubscription,
  adminId,
  getPrettyUserId,
} from './db.js';

const amp = new Amplitude(amplitudeApiKey);

const configuration = new Configuration({
  apiKey: openAiKey,
});

const openai = new OpenAIApi(configuration);

const bot = new Bot(chatBotToken);

bot.use(hydrateReply);

bot.use(sequentialize(getSessionKey))
bot.use(botSession);

// await bot.api.setMyCommands([
//   { command: "start", description: "Start the bot" },
//   { command: "help", description: "Show help text" },
//   { command: "settings", description: "Open settings" },
// ]);

const monthPrice = 50;
const sixMonthsPrice = 200;

let lastActiveUsersIds = [];
let lastActiveUsers = {};
let requestsCounter = 0;

const clearLastActivity = () => {
  lastActiveUsersIds = [];
  lastActiveUsers = {};
  requestsCounter = 0;
};

const saveActiveUser = (user) => {
  requestsCounter++;
  
  if (!lastActiveUsersIds.includes(user.userId)) {
    lastActiveUsersIds.push(user.userId);
    lastActiveUsers[user.userId] = user;
  }
}

const listLastActiveUsers = () => {
  return lastActiveUsersIds
    .map((userId) => {
      return `\n${getPrettyUserId(lastActiveUsers[userId])}`;
    })
    .join('');
}

bot.command('start', async (ctx) => {
  saveUser(ctx, ctx.msg.from);
  
  saveActiveUser(ctx.session);
  
  await ctx.replyWithHTML('Привіт! Цей бот дозволяє швидко та зручно використовувати ChatGPT, без необхідності щоразу відкривати незручний сайт.\n\nChatGPT — це модель штучного інтелекту від OpenAI, яка може відповідати на запитання та виконувати різноманітні завдання через чат-інтерфейс. Вона навчена на надзвичайно великому обсязі текстової інформації та гарно розуміє сенс слів.\n\nChatGPT краще працює з англійською, але також підтримує інші мови, в тому числі українську. Вам не потрібно нічого налаштовувати, просто пишіть свої запити тією мовою, якою забажаєте.\n\n<b>Ми не зберігаємо історію вашого листування з ботом.</b> Через це модель не пам’ятає ваші попередні запити і генерує кожну відповідь з нуля. Щоб отримати найкращий результат, розписуйте свої запити якомога детальніше і не бійтеся експериментувати)');
  // Hi! This is a simple ChatGPT Telegram bot. It allows you to use ChatGPT via OpenAI API, without having to go to their website.\n\nChatGPT works better with English language, but supports other languages too. You don\'t need to configure anything, just write your requests in any language you want.\n\n<b>We do not save the history of your correspondence with the bot.</b> Each new message generates a new response from scratch. Therefore, try to describe your request in as much detail as possible.

  await ctx.replyWithHTML('А тепер спробуйте самі! Просто напишіть в чат будь-який запит, і штучний інтелект згенерує для вас відповідь)\n\nТакож ви можете скористатись командою /examples щоб побачити приклади.');
  // Go on, try it yourself! Just write any question and ChatGPT will generate a response for you)

  amp.track({
    eventType: 'Start',
    userId: ctx.session.userId,
    userProperties: ctx.session
  });
});

bot.command('examples', async (ctx) => {
  await ctx.replyWithHTML('<b>Ось декілька прикладів використання ChatGPT</b>\n\n<i>Поясни *(будь-яку-тему)* простими словами.</i>\n\n<i>Ти — професійний письменник. Перепиши цей текст в стилі художнього роману, не змінюючи його сенсу: …</i>\n\n<i>Напиши 10 найцікавіших фактів з біографіі Черчілля.</i>\n\n<i>З якими проблемами найчастіше зіштовхуються люди, що вивчають програмування?</i>\n\n<i>Допоможи мені написати листа з проханням взяти вихідний на роботі, по причині…</i>\n\n<i>Ти — аналітик даних, що спеціалізується на стартапах в сфері освіти. Напиши 10 ідей для прибуткового edtech-стартапу, на базі ринкових даних.</i>\n\n<i>Напиши код простого Telegram-бота на мові JavaScript.</i>');

  saveActiveUser(ctx.session);
  
  amp.track({
    eventType: 'Examples',
    userId: ctx.session.userId,
    userProperties: ctx.session
  });
});

bot.command('confirm', async (ctx) => {    
  if (!isAdmin(ctx)) {
    await ctx.reply('You are not allowed to use that command!');
  } else {
    const [subscriberId, months] = ctx.match.split(' ').map(Number);
    
    const user = await enableUserSubscription(subscriberId, months);
    
    const paidDate = new Date(user.paidUntilDate);
    const dateString = paidDate.toLocaleDateString('en-GB');

    if (ctx.session.userId === subscriberId) {
      ctx.session.paidUntilDate = user.paidUntilDate;
    }
      
    await ctx.reply(`Subscription enabled successfuly, last date: ${dateString}`);

    await bot.api.sendMessage(subscriberId, `Дякуємо за оплату! Вашу підписку успішно активовано, тепер ви можете вільно користуватися ботом) Підписка дійсна до ${dateString}`);

    amp.track({
      eventType: 'Subscribed',
      userId: subscriberId,
      userProperties: user,
      eventProperties: {
        months
      }
    });
  }
});

bot.command('status', async (ctx) => {    
  await ctx.reply(`I'm fine) New requests: ${requestsCounter}${listLastActiveUsers()}`);
  
  clearLastActivity();
});

const sendTrialEndedMessage = async (ctx) => {
  await ctx.replyWithHTML(`Використання OpenAI API, завдяки якому цей бот функціонує, нажаль, не безкоштовне. Втім, завдяки цьому бот генерує відповіді значно швидше, ніж безкоштовний сайт, і вам <b>не треба</b> купляти офіційну підписку OpenAI вартістю <b>$20/місяць</b>.\n\nМи надали вам 10 безкоштовних запитів. Щоб і далі користуватись ботом, ви можете придбати недорогу підписку вартістю <b>${monthPrice} грн/місяць</b> або <b>${sixMonthsPrice} грн/6 місяців</b>, щоб ми мали змогу і далі оплачувати API.`, {
    reply_markup: new InlineKeyboard()
      .text('Придбати підписку', 'paymentInstructions')
  });
  // You are not allowed to use this bot.\n\nIf you want to start using ChatGPT via Telegram, please contact @ivryb

  amp.track({
    eventType: 'FreeRequestsEnded',
    userId: ctx.session.userId
  });
}

bot.on('message', async (ctx) => {
  const user = ctx.msg.from;

  saveUser(ctx, user);

  saveActiveUser(ctx.session);

  console.log('Start message processing', user.id);

  if (!canMakeRequest(ctx)) {
    await sendTrialEndedMessage(ctx);
  } else {
    const fastReply = await ctx.reply('Генерую відповідь...');
    // Generating a response...
    
    try {
      const { data } = await openai.createChatCompletion({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'user',
            content: ctx.message.text
          }
        ]
      });
  
      const responseText = data.choices[0].message.content;
  
      await ctx.reply(responseText);

      if (isFreeUser(ctx)) {
        removeFreeRequest(ctx);
      };
      
      amp.track({
        eventType: 'RequestMade',
        userId: ctx.session.userId,
        userProperties: ctx.session,
        eventProperties: data.usage
      });

      if (isFreeUser(ctx) && !canMakeRequest(ctx)) {
        await sendTrialEndedMessage(ctx);
      }
    } catch (error) {      
      if (error.response) {
        console.log(error.response.status);
        console.log(error.response.data);
      } else {
        console.log(error.message);
      }

      await ctx.reply('Вибачте, при генерації вашого запиту трапилася помилка( Будь ласка, зверніться до @ivryb');
      // Sorry, an error occurred while generating your request( Please contact

      amp.track({
        eventType: 'RequestError',
        userId: ctx.session.userId,
        userProperties: ctx.session
      });
    }

    ctx.api.deleteMessage(ctx.chat.id, fastReply.message_id);
  }

  console.log('End message processing', user.id);
});

bot.callbackQuery('paymentInstructions', async (ctx) => {
  await ctx.replyWithHTML(`1. Перейдіть за посиланням для оплати: ${payLinkAny}\nПерекажіть ${monthPrice} грн. для підписки на 1 місяць, або ${sixMonthsPrice} грн. для підписки на півроку.\n\n2. Тицніть по кнопці знизу щоб повідомити нас про успішну оплату та продовжити користуватись ботом)\n\nДякуємо що залишаєтесь з нами 🙏🏻`, {
    disable_web_page_preview: true,
    reply_markup: new InlineKeyboard().text('Я оплатив', 'paymentCheck')
  });

  await ctx.answerCallbackQuery();

  amp.track({
    eventType: 'PaymentInstructions',
    userId: ctx.session.userId
  });
});

bot.callbackQuery('paymentCheck', async (ctx) => {
  await ctx.replyWithHTML('Дякуємо! Скоро ми перевіримо статус оплати та повідомимо вас про активацію підписки 😇');
  
  await ctx.answerCallbackQuery();

  await bot.api.sendMessage(adminId, `User payment reported`);
  await bot.api.sendMessage(adminId, ctx.session.userId);

  amp.track({
    eventType: 'PaymentCheck',
    userId: ctx.session.userId
  });
});

const runner = run(bot);

const stopRunner = () => runner.isRunning() && runner.stop();

process.once('SIGINT', stopRunner);
process.once('SIGTERM', stopRunner);
