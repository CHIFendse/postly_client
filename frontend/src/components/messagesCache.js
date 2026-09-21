// messagesCache.js
export const _msgsCache = new Map();
export const MSGS_TTL = 30_000;
export function clearMessagesCache() { _msgsCache.clear(); }