import Redis from "redis";import { promisify } from "util";
import { RedisClientInjectionOptions, REDIS_CLIENT_KEY_PREFIX } from ".";
import { Logger } from "../../../util/logger";
import { BaseInjection, BaseInjectionExecutionResult, BaseInjectionPhase } from "../base";
//@ts-ignore
import Packet from 'native-dns-packet';

export class LoadCacheInjection extends BaseInjection {
  protected client!: Redis.RedisClient;
  protected logger = new Logger({ prefix: 'REDIS LOAD' });

  public readonly phase = BaseInjectionPhase.BEFORE_QUERY;

  constructor(protected readonly options: RedisClientInjectionOptions) {
    super();

    this.client = Redis.createClient({ url: this.options.url });

    this.client.on('error', (error) => {
      this.logger.error('Redis Client returned error: ', error);
    });

    this.logger.log('Ready to be used.');
  }

  public async needsExecution(query: any): Promise<boolean> {
    const questions: any[] = query.question;

    const keyName = questions.map((a: any) => a.name).join('.');

    const exists = await this.cacheExists(`${REDIS_CLIENT_KEY_PREFIX}${keyName}`);
    return exists;
  }

  public async onExecute(query: any, result: any): Promise<BaseInjectionExecutionResult> {
    const questions: any[] = query.question;

    const keyName = questions.map((a: any) => a.name).join('.');
    const response = await this.getCache(`${REDIS_CLIENT_KEY_PREFIX}${keyName}`);
    
    response.writeUInt16BE(query.header.id, 0); // Sets the correct transaction id

    // TODO: We should also update the TTL acording to the last time we saved it, or the server can spend a little time with the wrong ip

    this.logger.log('Loaded cached dns response.');
    return {
      halt: false,
      response,
    };
  }

  private cacheExists(key: string): Promise<boolean> {
    return new Promise<boolean>((resolve, reject) => {
      this.client.exists(key, (err, res) => {
        if (err) return reject(err);

        resolve(res > 0);
      })
    });
  }

  private getCache(key: string): Promise<Buffer> {
    return new Promise<Buffer>((resolve, reject) => {
      this.client.get(key, (err, value) => {
        if (err) return reject(err);

        if (value) {
          resolve(Buffer.from(value.toString(), 'base64'));
        } else reject(new Error('Invalid value was found'));
      });
    });
  }
    
}