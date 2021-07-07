import { setTimeout } from "timers";

export class TimerUtil {
  public static DEFAULT_TIMEOUT = 20000;
  static waitFor(isReady: () => boolean, checkTimeMs: number, timeoutMs: number = TimerUtil.DEFAULT_TIMEOUT, startTime: number = Date.now()): Promise<void> {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (isReady()) {
          return resolve();
        }
        if (timeoutMs && Date.now() > (startTime+timeoutMs)) {
          return reject(new Error('Timer waited for too long'));
        }
        TimerUtil.waitFor(isReady, checkTimeMs, timeoutMs, startTime);
      }, checkTimeMs);
    });
  }
}