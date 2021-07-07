import { Resolver } from "dns";
import { DNSUDPInterceptor } from "../../../src/interceptor/udp";
import { DNSQueryMethod } from "../../../src/query";

describe('Blacklist Interceptor', () => {
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
        domainBlackList: {
          lists: [
            './tests/injections/black-list/blacklist.mock.untrusted',
          ]
        },
        domainWhiteList: false,
        dnsOverride: false,
      }
    });
    await client.bind();

    resolver = new Resolver();
    resolver.setServers(['127.0.0.1']);
  });

  it('should block blacklisted domains', async () => {
    resolver.resolve('google.com.br', (err, addresses) => {
      expect(err).toBeTruthy();
      expect(addresses).toBeUndefined();
    });
  });

  it('should timeout if dns is in the blacklist', async () => {
    resolver.resolve('google.com.mx', (err, addresses) => {
      expect(err).toBeFalsy();
      expect(addresses.length).toBeGreaterThan(0);
    });
  });

  afterAll(async () => {
    await client.unbind();
  });
});