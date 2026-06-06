import { buildDailyQueue } from "./queueBuilder.js";
import { processQueue } from "./queueProcessor.js";

export function startScheduler() {
  const buildIntervalMs = 60 * 60 * 1000;
  const processIntervalMs = 5 * 60 * 1000;

  setInterval(() => {
    buildDailyQueue().catch((error) => console.error("scheduled queue build failed", error));
  }, buildIntervalMs);

  setInterval(() => {
    processQueue({ limit: 1 }).catch((error) => console.error("scheduled queue process failed", error));
  }, processIntervalMs);
}
