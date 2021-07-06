/**
 * Options for RetryUtil.retryPromiseFunction
 */
 export interface RetryPromiseFunctionOptions {
  /**
   * the number of retries to be accepted before it throws an error
   */
  retries: number;
  /**
   * If true, all errors before the last will be logged as warns, defaults to false
   */
  warnErrors?: boolean;

  warnFn?: (...args: any[]) => void;
}

export class RetryUtil {
  /**
   * Retries a given promise util max retries is reached
   * @param options retry options
   * @param fn The function to be executed
   * @param args The arguments to be sent for the function
   * @returns The functions result
   */
  static async retryPromiseFunction<T>(
    options: RetryPromiseFunctionOptions, 
    fn: (...args: any[]) => Promise<T>, 
    ...args: any[]
  ): Promise<T> {
    let error = null;
    for (let retry = 0;retry < options.retries;retry++) {
      try {
        error = null; // reset error before retry
        return await fn(...args);
      } catch (e) {
        error = e;

        if (options.warnErrors) {
          (options.warnFn || console.warn)(`[ ERROR ] (Retry ${retry+1}/${options.retries}) `, error);
        }
      }
    };

    throw error; // throw the last error received.
  }
}