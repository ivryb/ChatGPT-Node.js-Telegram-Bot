import { session } from 'grammy';

import { RedisAdapter } from '@grammyjs/storage-redis';
import IORedis from 'ioredis';

const { allowedUsersIdsString, adminIdString, redisURL } = process.env;

const allowedUsersIds = allowedUsersIdsString.split(',').map(Number);
export const adminId = Number(adminIdString);

const getInitialSessionData = () => ({
  userId: null,
  firstName: null,
  lastName: null,
  username: null,
  isPremium: null,
  
  paidUntilDate: null,
  freeRequestsLeft: 10,

  locale: null
});

export const getPrettyUserId = (user) => {
  const { username, firstName, lastName, userId } = user;

  return [username || userId, firstName, lastName].filter(Boolean).join(' ');
}

export const getSessionKey = (ctx) => {
  return ctx.chat?.id.toString();
}

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
  getSessionKey
});

export const saveUser = (ctx, user) => {
  if (!ctx.session.userId) {
    ctx.session.userId = user.id;
    ctx.session.firstName = user.first_name;
    ctx.session.lastName = user.last_name;
    ctx.session.username = user.username;
    ctx.session.isPremium = user.is_premium;
  }
}

export const isAdmin = (ctx) => ctx.session.userId === adminId;

export const hasFreeRequests = (ctx) => {
  const { freeRequestsLeft } = ctx.session;

  return freeRequestsLeft > 0;
}

export const isAllowedUser = (ctx) => {
  return allowedUsersIds.includes(ctx.session.userId);
}

export const hasPaidRequests = (ctx) => {
  const { paidUntilDate } = ctx.session;
  
  if (!paidUntilDate) return false;

  const now = Date.now();

  return now < paidUntilDate;
}

export const canMakeRequest = (ctx) => {
  // if (isAdmin(ctx)) {
  //   return false;
  // }
  
  return isAllowedUser(ctx) || hasFreeRequests(ctx) || hasPaidRequests(ctx);
}

export const isFreeUser = (ctx) => {
  return !isAllowedUser(ctx) && !hasPaidRequests(ctx);
}

export const hasLocale = (ctx) => {
  return Boolean(ctx.session.locale);
}

export const removeFreeRequest = (ctx) => {
  const { freeRequestsLeft } = ctx.session;
  
  if (freeRequestsLeft > 0) {
    ctx.session.freeRequestsLeft = freeRequestsLeft - 1;
    
    console.log('Free request removed', ctx.session.userId, ctx.session.freeRequestsLeft);
  }
}

export const enableUserSubscription = async (userId, months) => {
  const user = await getUser(userId);

  const now = Date.now();
    
  const subscriptionPeriod = 1000 * 60 * 60 * 24 * 31 * months;

  user.paidUntilDate = now + subscriptionPeriod;

  await updateUser(userId, user);

  return user;
}
