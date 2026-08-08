"use strict";

function logEvent(level, event, context = {}) {
  const safeContext = Object.fromEntries(
    Object.entries(context).filter(([key]) => !/token|secret|password|authorization/i.test(key))
  );
  const record = JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    event,
    ...safeContext
  });
  (level === "error" ? console.error : console.log)(record);
}

module.exports = { logEvent };
