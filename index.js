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
  hasLocale,
  removeFreeRequest,
  enableUserSubscription,
  adminId,
  getPrettyUserId,
  isProMode,
  setProMode,
  getSavedMessages,
  saveUserMessages,
  clearSavedMessages
} from './db.js';

const amp = new Amplitude(amplitudeApiKey);

const configuration = new Configuration({
  apiKey: openAiKey,
});

const openai = new OpenAIApi(configuration);

const i18n = new I18n({
  directory: 'locales',

  defaultLocale: 'uk',

  localeNegotiator: (ctx) => ctx.session.locale ?? 'uk',
});

const bot = new Bot(chatBotToken);

bot.use(hydrateReply);

bot.use(sequentialize(getSessionKey))
bot.use(botSession);
bot.use(i18n);

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

const setBotCommands = async (ctx) => {
  await bot.api.setMyCommands([
    { command: 'start', description: 'Start the bot' },
    // { command: 'help', description: "Show help text" },
    // { command: "settings", description: "Open settings" },
    { command: 'examples', description: 'Examples of using ChatGPT' },
    { command: 'language', description: 'Language selection' },
  ]);

  await bot.api.setMyCommands([
    { command: 'start', description: 'Запустити бота' },
    // { command: 'help', description: "Show help text" },
    // { command: "settings", description: "Open settings" },
    { command: 'examples', description: 'Приклади використання ChatGPT' },
    { command: 'language', description: 'Змінити мову' },
  ], { language_code: 'uk' });

  await bot.api.setChatMenuButton({ type: 'commands' });
};

setBotCommands();

const sendStartMessages = async (ctx) => {
  await ctx.replyWithHTML(ctx.t('start'));
  await ctx.replyWithHTML(ctx.t('start-try'));
}

const sendSelectLanguageMessage = async (ctx, destination) => {
  await ctx.replyWithHTML('Select a language', {
    reply_markup: new InlineKeyboard()
      .text('English', `${destination}_en`).row()
      .text('Українська', `${destination}_uk`).row()
  });
};

const selectLocale = (locale, isStart) => async (ctx) => {
  ctx.session.locale = locale;

  await ctx.i18n.renegotiateLocale();

  if (isStart) {
    await sendStartMessages(ctx);
  } else {
    await ctx.replyWithHTML(ctx.t('language-changed'));
  }

  await ctx.answerCallbackQuery();

  amp.track({
    eventType: 'SelectLanguage',
    userId: ctx.session.userId,
    userProperties: ctx.session,
    eventProperties: { locale }
  });
};

bot.command('start', async (ctx) => {
  saveUser(ctx, ctx.msg.from);

  saveActiveUser(ctx.session);

  if (hasLocale(ctx)) {
    await sendStartMessages(ctx);
  } else {
    await sendSelectLanguageMessage(ctx, 'start');
  }

  amp.track({
    eventType: 'Start',
    userId: ctx.session.userId,
    userProperties: ctx.session
  });
});

bot.command('language', async (ctx) => {
  sendSelectLanguageMessage(ctx, 'language');

  saveActiveUser(ctx.session);

  amp.track({
    eventType: 'LanguageCommand',
    userId: ctx.session.userId,
    userProperties: ctx.session
  });
});

bot.callbackQuery('language_en', selectLocale('en'));
bot.callbackQuery('language_uk', selectLocale('uk'));
bot.callbackQuery('start_en', selectLocale('en', true));
bot.callbackQuery('start_uk', selectLocale('uk', true));

bot.command('examples', async (ctx) => {
  await ctx.replyWithHTML(ctx.t('examples'));

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

    const userMessage = i18n.t(user.locale ?? 'uk', 'you-are-subscribed', { dateString });

    await bot.api.sendMessage(subscriberId, userMessage);

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

bot.command('pro', async (ctx) => {
  if (isAdmin(ctx)) {
    setProMode(ctx, true);

    await ctx.reply('Pro mode is enabled, your message history will now be saved');
  } else {
    await ctx.reply('You are not allowed to use that command!');
  }
});

bot.command('default', async (ctx) => {
  setProMode(ctx, false);
  clearSavedMessages(ctx);

  await ctx.reply('Pro mode is disabled, message history will not be saved any more');
});

bot.command('clear', async (ctx) => {
  clearSavedMessages(ctx);

  await ctx.reply('Message history is cleared');
});

const sendTrialEndedMessage = async (ctx) => {
  const msg = ctx.t('trial-ended', {
    monthPrice,
    sixMonthsPrice
  });

  await ctx.replyWithHTML(msg, {
    reply_markup: new InlineKeyboard()
      .text(ctx.t('subscribe'), 'paymentInstructions')
  });

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
    const fastReply = await ctx.reply(ctx.t('generating-response'));

    const savedMessages = getSavedMessages(ctx);

    const userMessage = {
      role: 'user',
      content: ctx.message.text
    };

    try {
      const { data } = await openai.createChatCompletion({
        model: 'gpt-3.5-turbo',
        messages: [
          ...savedMessages,
          userMessage
        ]
      });

      const responseText = data.choices[0].message.content;

      await ctx.reply(responseText);

      if (isFreeUser(ctx)) {
        removeFreeRequest(ctx);
      };

      if (isProMode(ctx)) {
        saveUserMessages(ctx, [
          userMessage,
          { role: 'assistant', content: responseText }
        ]);
      }

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

      await ctx.reply(ctx.t('request-error'));

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
  const msg = ctx.t('payment-instructions', {
    payLink: payLinkAny,
    monthPrice,
    sixMonthsPrice
  });

  await ctx.replyWithHTML(msg, {
    disable_web_page_preview: true,
    reply_markup: new InlineKeyboard().text(ctx.t('i-paid'), 'paymentCheck')
  });

  await ctx.answerCallbackQuery();

  amp.track({
    eventType: 'PaymentInstructions',
    userId: ctx.session.userId
  });
});

bot.callbackQuery('paymentCheck', async (ctx) => {
  await ctx.replyWithHTML(ctx.t('checking-payment'));

  await ctx.answerCallbackQuery();

  await bot.api.sendMessage(adminId, `User payment reported: ${getPrettyUserId(ctx.session)}`);
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
