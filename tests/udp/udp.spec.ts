import { Resolver } from "dns";
import { DNSUDPInterceptor } from "../../src/interceptor/interceptor";
import { DNSQueryMethod } from "../../src/query";
import { TimerUtil } from "../../src/util/timer";

describe('UDP Interceptor', () => {
  let client: DNSUDPInterceptor;
  let resolver: Resolver;

  jest.setTimeout(10000);

  beforeAll(async () => {
    client = new DNSUDPInterceptor({
      forwardRetries: 1,
      forwardServer: '1.0.0.1',
      queryMethod: DNSQueryMethod.DNS_OVER_TLS,
      injections: {
        redis: false,
        domainBlackList: false,
        domainWhiteList: false,
        dnsOverride: false,
      }
    });
    await client.bind();

    resolver = new Resolver();
    resolver.setServers(['127.0.0.1']);
  });

  it('should forward new dns queries', async () => {
    resolver.resolve('google.com.br', (err, addresses) => {
      expect(err).toBeFalsy();
      expect(addresses.length).toBeGreaterThan(0);
    });
  });

  afterAll(async () => {
    await client.unbind();
  });
});