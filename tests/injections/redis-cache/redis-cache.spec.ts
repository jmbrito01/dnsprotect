jest.mock('redis', () => jest.requireActual('redis-mock'));

import { Resolver } from "dns";
import { DNSUDPInterceptor } from "../../../src/interceptor/interceptor";
import { DNSQueryMethod } from "../../../src/query";
import redis, { RedisClient } from 'redis-mock';
import { REDIS_CLIENT_KEY_PREFIX } from "../../../src/interceptor/injections/redis-cache";
import { DEFAULT_UDP_PORT } from "../../../src/interceptor/interceptor";

describe('Redis Cache Interceptor', () => {
  let client: DNSUDPInterceptor;
  let redisClient: RedisClient = redis.createClient();
  let resolver: Resolver;
  const port = process.env.PORT ? parseInt(process.env.PORT) : DEFAULT_UDP_PORT;

  jest.setTimeout(10000);

  beforeAll(async () => {
    jest.spyOn(redis, 'createClient')
      .mockImplementation((opts) => redisClient);
      
    resolver = new Resolver();
    resolver.setServers([`127.0.0.1:${port}`]);
  });

  describe('without cacheEmptyResults', () => {
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
    });

    it('should save a result found by the forward server', async () => {
      const spySet = jest.spyOn(redisClient, 'set');
  
      resolver.resolve('yahoo.com', (err, addresses) => {
        const questions = ['yahoo.com'];
        const key = REDIS_CLIENT_KEY_PREFIX + questions.join('.');

        expect(err).toBeUndefined();
        expect(addresses.length).toBeGreaterThan(0);
        expect(spySet).toBeCalledWith(key, String, )
        
        redisClient.exists(key, (err, count: number) => {
          expect(err).toBeUndefined();
          expect(count).toBe(1);
        });
      });
    });

    it('should load a result from cache before ttl', async () => {
      const spyGet = jest.spyOn(redisClient, 'get');
  
      resolver.resolve('yahoo.com', (err, addresses) => {
        const questions = ['yahoo.com'];
        expect(err).toBeUndefined();
        expect(addresses.length).toBeGreaterThan(0);

        resolver.resolve(questions[0], (err) => {
          expect(err).toBeUndefined();
          expect(spyGet).toBeCalled();
        });
      });
    });
  
    it('should not save empty results', async () => {
      const spyGet = jest.spyOn(redisClient, 'get');
  
      const questions = ['jdskdsjkldjljkjdsjd.com'];
      resolver.resolve(questions[0], (err, addresses) => {
        expect(err).toBeUndefined();
        expect(addresses.length).toBe(0);
        expect(spyGet).not.toBeCalled();
      });
    });

    afterAll(async () => {
      await client.unbind();
    });
  });

  describe('with cacheEmptyResults', () => {
    beforeAll(async () => {
      client = new DNSUDPInterceptor({
        port,
        forwardRetries: 1,
        forwardServer: '1.0.0.1',
        queryMethod: DNSQueryMethod.DNS_OVER_TLS,
        injections: {
          redis: {
            url: 'redis://localhost:6379',
            cacheEmptyResults: true,
            cachedEmptyResultsTTL: 100,
          },
          domainBlackList: false,
          domainWhiteList: false,
          dnsOverride: false,
        }
      });
      await client.bind();
    });
  
    it('should save empty results', async () => {
      const spyGet = jest.spyOn(redisClient, 'get');
  
      const questions = ['jdskdsjkldjljkjdsjd.com'];
      resolver.resolve(questions[0], (err, addresses) => {
        expect(err).toBeUndefined();
        expect(addresses.length).toBe(0);
        expect(spyGet).toBeCalled();

        const key = REDIS_CLIENT_KEY_PREFIX + questions.join('.');
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

  afterAll(async () => {
    jest.unmock('redis');
    
  });
});