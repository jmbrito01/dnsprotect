import { DNSUDPInterceptor } from "../src/interceptor/udp";

(async function () {
  const interceptor = new DNSUDPInterceptor({
    forwardServer: '1.0.0.1',
    injections: {
      blackList: {
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