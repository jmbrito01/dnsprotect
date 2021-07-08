import { RetryUtil } from "../../src/util/retry-util"

describe('Retry Util', () => {
  it('should respect retry count', async () => {
    let counter = 0;
    await RetryUtil.retryPromiseFunction({
      retries: 3,
      warnErrors: false,
    }, async () => {
      counter++;
      throw new Error('Force error');
    }).catch(() => true); // Ignore error 

    expect(counter).toBe(3);
  });

  it('should call warn function if retry is called', async () => {
    let warnCalled = false;
    await RetryUtil.retryPromiseFunction({
      retries: 1,
      warnErrors: true,
      warnFn() {
        warnCalled = true;
      }
    }, async () => {
      throw new Error('Force error');
    }).catch(() => true); // Ignore error 

    expect(warnCalled).toBe(true);
  })
})