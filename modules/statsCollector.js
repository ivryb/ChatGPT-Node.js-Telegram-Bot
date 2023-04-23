import { getPrettyUserId } from './db.js';

export let lastActiveUsersIds = [];
export let lastActiveUsers = {};
export let requestsCounter = 0;

export const clearLastActivity = () => {
  lastActiveUsersIds = [];
  lastActiveUsers = {};
  requestsCounter = 0;
};

export const saveActiveUser = (user) => {
  requestsCounter++;

  if (!lastActiveUsersIds.includes(user.userId)) {
    lastActiveUsersIds.push(user.userId);
    lastActiveUsers[user.userId] = user;
  }
}

export const listLastActiveUsers = () => {
  return lastActiveUsersIds
    .map((userId) => {
      return `\n${getPrettyUserId(lastActiveUsers[userId])}`;
    })
    .join('');
}