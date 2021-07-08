jest.mock('redis', () => jest.requireActual('redis-mock'));

import { Resolver } from "dns";
import { DNSUDPInterceptor } from "../../../src/interceptor/interceptor";
import { DNSQueryMethod } from "../../../src/query";
import redis from 'redis-mock';
import { REDIS_CLIENT_KEY_PREFIX } from "../../../src/interceptor/injections/redis-cache";
import { DEFAULT_UDP_PORT } from "../../../src/interceptor/interceptor";

describe('Redis Cache Interceptor', () => {
  let client: DNSUDPInterceptor;
  let resolver: Resolver;
  const port = process.env.PORT ? parseInt(process.env.PORT) : DEFAULT_UDP_PORT;

  jest.setTimeout(10000);

  beforeAll(async () => {
    client = new DNSUDPInterceptor({
      port,
      forwardRetries: 1,
      forwardServer: '1.0.0.1',
      queryMethod: DNSQueryMethod.DNS_OVER_TLS,
      injections: {
        redis: {
          url: 'redis://localhost:6379',
          cacheEmptyResults: false
        },
        domainBlackList: false,
        domainWhiteList: false,
        dnsOverride: false,
      }
    });
    await client.bind();

    resolver = new Resolver();
    resolver.setServers([`127.0.0.1:${port}`]);
  });

  it('should save a result found by the forward server', async () => {
    resolver.resolve('yahoo.com', (err, addresses) => {
      const questions = ['yahoo.com'];
      expect(err).toBeUndefined();
      expect(addresses.length).toBeGreaterThan(0);
      
      const redisClient = redis.createClient();
      const key = REDIS_CLIENT_KEY_PREFIX + questions.join('');
      redisClient.exists(key, (err, count: number) => {
        expect(err).toBeUndefined();
        expect(count).toBe(1);
      });
    });
  });

  afterAll(async () => {
    await client.unbind();
  });
});