import Redis from "redis";import { promisify } from "util";
import { DEFAULT_EMPTY_TTL_CACHE, RedisClientInjectionOptions, REDIS_CLIENT_KEY_PREFIX } from ".";
import { Logger } from "../../../util/logger";
import { BaseInjection, BaseInjectionExecutionResult, BaseInjectionPhase } from "../base";
//@ts-ignore
import Packet from 'native-dns-packet';
import { MAX_UDP_PACKET_SIZE } from "../../udp";

export class SaveCacheInjection extends BaseInjection {
  protected client!: Redis.RedisClient;
  protected logger = new Logger({ prefix: 'REDIS SAVE' });

  public readonly phase = BaseInjectionPhase.AFTER_RESPONSE;

  constructor(protected readonly options: RedisClientInjectionOptions) {
    super();

    this.client = Redis.createClient({ url: this.options.url });

    this.client.on('error', (error) => {
      this.logger.error('Redis Client returned error: ', error);
    });

    this.logger.log('Ready to be used.');
  }

  public async needsExecution(query: any, result: any): Promise<boolean> {
    const answers = result.answer || [];
    return answers.length > 0 || this.options.cacheEmptyResults === true;
  }

  public async onExecute(query: any, result: any): Promise<BaseInjectionExecutionResult> {
    const answers = result.answer || [];

    const keyName = answers.map((a: any) => a.name).join('.');

    const exists = await this.cacheExists(`${REDIS_CLIENT_KEY_PREFIX}${keyName}`);

    if (!exists) {
      const buffer = Buffer.alloc(MAX_UDP_PACKET_SIZE);
      Packet.write(buffer, result);
      await this.setCache(`${REDIS_CLIENT_KEY_PREFIX}${keyName}`, buffer.toString('base64'), this.getMinTTL(answers));
    }

    return {
      halt: false,
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

  private setCache(key: string, value: string, expires: number): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.client.set(key, value, 'EX', expires, (err) => {
        if (err) return reject(err);
        resolve();
      });
    });
  }

  private getMinTTL(answers: any[]): number {
    if (answers.length === 0) {
      return this.options.cachedEmptyResultsTTL || DEFAULT_EMPTY_TTL_CACHE;
    }
    
    return answers.reduce((min, a) => a.ttl < min ? a.ttl : min, answers[0].ttl);
  }
    
}