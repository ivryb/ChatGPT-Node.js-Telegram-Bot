import { session } from "grammy";

import { RedisAdapter } from "@grammyjs/storage-redis";
import IORedis from "ioredis";

import { defaultBotMode } from "./modes.js";

const { redisURL } = process.env;

const freeUsersIds = [];
export const adminId = 253485574;

export const dailyFreeRequests = 10;

const getInitialSessionData = () => ({
  userId: null,
  firstName: null,
  lastName: null,
  username: null,
  isPremium: null,

  paidUntilDate: null,
  freeRequestsLeft: dailyFreeRequests,
  lastUsageDate: null,

  botMode: null,

  isPro: false,
  savedMessages: [],

  locale: null,
});

export const defaultLocale = "uk";

export const supportedLocales = ["en", "uk"];

export const hasLocale = (ctx) => {
  return supportedLocales.includes(ctx.session.locale);
};

export const localeNegotiator = (ctx) => {
  if (supportedLocales.includes(ctx.session.locale)) {
    return ctx.session.locale;
  }

  return defaultLocale;
};

export const getPrettyUserId = (user) => {
  const { username, firstName, lastName, userId } = user;

  return [username || userId, firstName, lastName].filter(Boolean).join(" ");
};

export const getSessionKey = (ctx) => {
  return ctx.chat?.id.toString();
};

const redis = new IORedis(redisURL);

const storage = new RedisAdapter({ instance: redis });

const getUser = async (userId) => {
  const data = await redis.get(userId);

  return JSON.parse(data);
};

const updateUser = async (userId, data) => {
  await redis.set(userId, JSON.stringify(data));
};

export const botSession = session({
  initial: getInitialSessionData,
  storage,
  getSessionKey,
});

export const saveUser = (ctx, user) => {
  if (!ctx.session.userId) {
    ctx.session.userId = user.id;
    ctx.session.firstName = user.first_name;
    ctx.session.lastName = user.last_name;
    ctx.session.username = user.username;
    ctx.session.isPremium = user.is_premium;
  }
};

export const isAdmin = (ctx) => ctx.session.userId === adminId;

export const isAllowedUser = (ctx) => {
  return freeUsersIds.includes(ctx.session.userId);
};

export const hasPaidRequests = (ctx) => {
  // if (isAdmin(ctx)) {
  //   return false;
  // }

  const { paidUntilDate } = ctx.session;

  if (!paidUntilDate) return false;

  const now = Date.now();

  return now < paidUntilDate;
};

export const canMakeRequest = (ctx) => {
  // if (isAdmin(ctx)) {
  //   return false;
  // }

  return isAllowedUser(ctx) || hasFreeRequests(ctx) || hasPaidRequests(ctx);
};

export const isFreeUser = (ctx) => {
  // if (isAdmin(ctx)) {
  //   return true;
  // }

  return !isAllowedUser(ctx) && !hasPaidRequests(ctx);
};

export const getUsageDate = () => {
  const date = new Date();

  return new Date().toLocaleDateString("en-GB");
};

export const getFreeRequestsCount = (ctx) => {
  const { freeRequestsLeft, lastUsageDate } = ctx.session;

  const currentUsageDate = getUsageDate();

  return lastUsageDate === currentUsageDate
    ? freeRequestsLeft
    : dailyFreeRequests;
};

export const hasFreeRequests = (ctx) => {
  return getFreeRequestsCount(ctx) > 0;
};

export const removeFreeRequest = (ctx) => {
  const { freeRequestsLeft, lastUsageDate } = ctx.session;

  const currentUsageDate = getUsageDate();

  if (lastUsageDate !== currentUsageDate) {
    ctx.session.lastUsageDate = currentUsageDate;
    ctx.session.freeRequestsLeft = dailyFreeRequests - 1;
  } else if (freeRequestsLeft > 0) {
    ctx.session.freeRequestsLeft = freeRequestsLeft - 1;
  }
};

export const enableUserSubscription = async (userId, months) => {
  const user = await getUser(userId);

  const now = Date.now();

  const subscriptionPeriod = 1000 * 60 * 60 * 24 * 31 * months;

  user.paidUntilDate = now + subscriptionPeriod;

  await updateUser(userId, user);

  return user;
};

// Modes

export const setBotMode = (ctx, { botMode }) => {
  ctx.session.botMode = botMode;
};

export const getBotMode = (ctx) => {
  return ctx.session.botMode ?? defaultBotMode;
};

// Pro mode & saved messages

export const isProMode = (ctx) => {
  return Boolean(ctx.session.isPro);
};

export const setProMode = (ctx, status) => {
  ctx.session.isPro = status;
};

export const getSavedMessages = (ctx) => {
  if (isProMode(ctx)) {
    return ctx.session.savedMessages || [];
  }

  return [];
};

export const saveUserMessages = (ctx, messages) => {
  const savedMessages = getSavedMessages(ctx);

  ctx.session.savedMessages = [...savedMessages, ...messages];
};

export const clearSavedMessages = (ctx) => {
  ctx.session.savedMessages = [];
};
