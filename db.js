import { session } from 'grammy';

import Client from '@replit/database';
import fs from 'fs';

const { allowedUsersIdsString, adminIdString } = process.env;

const allowedUsersIds = allowedUsersIdsString.split(',').map(Number);
export const adminId = Number(adminIdString);

const db = new Client();

const getInitialSessionData = () => ({
  userId: null,
  firstName: null,
  lastName: null,
  username: null,
  isPremium: null,
  
  paidUntilDate: null,
  freeRequestsLeft: 10,
});

export const getPrettyUserId = (user) => {
  const { username, firstName, lastName, userId } = user;

  return [username || userId, firstName, lastName].filter(Boolean).join(' ');
}

const sessionStorageAdapter = {
  async read(key) {
    const value = await db.get(key);

    return value || getInitialSessionData();
  },
  
  async write(key, value) {
    console.log('Write DB value', key, value);
    
    try {
      await db.set(key, value);
    } catch (error) {
      console.log('Write DB Error', error);
    }
  },
  
  async delete(key) {
    await db.delete(key);
  },
  
  async readAllKeys() {
    const list = await db.list();

    return list;
  }
};

const exportDb = async () => {
  const data = await db.getAll();
  
  try {
    fs.writeFileSync('db.json', JSON.stringify(data))
  } catch (err) {
    console.error(err)
  }
};

// exportDb();

export const getSessionKey = (ctx) => {
  return ctx.chat?.id.toString();
}

export const botSession = session({
  initial: getInitialSessionData,
  storage: sessionStorageAdapter,
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

export const removeFreeRequest = (ctx) => {
  const { freeRequestsLeft } = ctx.session;
  
  if (freeRequestsLeft > 0) {
    ctx.session.freeRequestsLeft = freeRequestsLeft - 1;
    
    console.log('Free request removed', ctx.session.userId, ctx.session.freeRequestsLeft);
  }
}

export const enableUserSubscription = async (userId, months) => {
  const user = await db.get(userId);

  const now = Date.now();
    
  const subscriptionPeriod = 1000 * 60 * 60 * 24 * 30 * months;

  user.paidUntilDate = now + subscriptionPeriod;

  await db.set(userId, user);

  return user;
}