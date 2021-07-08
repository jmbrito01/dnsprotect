import { Resolver } from "dns";
import { join } from "path";
import { DEFAULT_UDP_PORT, DNSUDPInterceptor } from "../../../src/interceptor/interceptor";
import { DNSQueryMethod } from "../../../src/query/query";

describe('Whitelist Interceptor', () => {
  let client: DNSUDPInterceptor;
  let resolver: Resolver;
  const port = process.env.PORT ? parseInt(process.env.PORT) : DEFAULT_UDP_PORT;
  
  jest.setTimeout(10000);

  beforeAll(async () => {
    client = new DNSUDPInterceptor({
      port,
      forwardRetries: 1,
      forwardServers: ['1.0.0.1'],
      queryMethod: DNSQueryMethod.DNS_OVER_TLS,
      injections: {
        redis: false,
        domainBlackList: false,
        domainWhiteList: {
          lists: [
            './tests/injections/white-list/whitelist.mock.trusted',
          ]
        },
        dnsOverride: false,
      }
    });
    await client.bind();

    resolver = new Resolver();
    resolver.setServers([`127.0.0.1:${port}`]);
  });

  it('should pass through with whitelisted domains', async () => {
    resolver.resolve('google.com.ar', (err, addresses) => {
      expect(err).toBeFalsy();
      expect(addresses.length).toBeGreaterThan(0);
      expect(addresses[0]).toBe('1.2.3.4');
    });
  });

  it('should timeout if dns is not in the whitelist', async () => {
    resolver.resolve('google.us', (err, addresses) => {
      expect(err).toBeTruthy();
      expect(addresses).toBeUndefined();
    });
  });

  afterAll(async () => {
    await client.unbind();
  });
});