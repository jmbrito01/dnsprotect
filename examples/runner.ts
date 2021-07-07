import { DNSUDPInterceptor } from "../src/interceptor/udp";
import { DNSQueryMethod } from "../src/query";

(async function () {
  const interceptor = new DNSUDPInterceptor({
    forwardServer: '1.0.0.1',
    queryMethod: DNSQueryMethod.DNS_OVER_HTTPS,
    forwardRetries: 1,
    injections: {
      domainBlackList: {
        lists: [
          './lists/noscript.untrusted',
        ]
      },
    }
  });

  interceptor.bindUDP();
})().catch((err: Error) => {
  console.error('Error in runner: ', err);
});