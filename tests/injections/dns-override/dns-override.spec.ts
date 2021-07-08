import { Resolver } from "dns";
import { DEFAULT_UDP_PORT, DNSUDPInterceptor } from "../../../src/interceptor/interceptor";
import { DNSQueryMethod } from "../../../src/query";

describe('DNS Override Interceptor', () => {
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
        redis: false,
        domainBlackList: false,
        domainWhiteList: false,
        dnsOverride: {
          mappers: {
            'google.com.br': {
              address: '1.2.3.4',
            }
          }
        },
      }
    });
    await client.bind();

    resolver = new Resolver();
    resolver.setServers([`127.0.0.1:${port}`]);
  });

  it('should map dns queries that match', async () => {
    resolver.resolve('google.com.br', (err, addresses) => {
      expect(err).toBeFalsy();
      expect(addresses.length).toBeGreaterThan(0);
      expect(addresses[0]).toBe('1.2.3.4');
    });
  });

  it('should fallback if dns query not mapped', async () => {
    resolver.resolve('google.us', (err, addresses) => {
      expect(err).toBeFalsy();
      expect(addresses.length).toBeGreaterThan(0);
      expect(addresses[0]).not.toBe('1.2.3.4');
    });
  });

  afterAll(async () => {
    await client.unbind();
  });
});