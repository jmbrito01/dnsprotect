import { DNSQueryMethod } from "../../src/query/query";
import { RandomUtil } from "../../src/util/random";
import * as mock from './query.mock.json';
import { MAX_UDP_PACKET_SIZE } from "../../src/interceptor/interceptor";
import { DNSQueryCluster } from "../../src/query/query-cluster";
import { LoadBalancingStrategy } from "../../src/util/load-balancing";
import { DNSPacket } from "../../src/packet/packet";

const CLOUDFLARE_DNS_SERVERS = ['1.1.1.1','1.0.0.1'];
let mockInstance = mock;

describe('DNSQuery Cluster', () => {
  jest.setTimeout(15000);
  let mockPacket = new DNSPacket(Buffer.from(mock.query, 'base64'));
  
  beforeEach(async () => {
    // Generate a new transaction id
    mockPacket.headers.id = RandomUtil.randomRange(0, 65535);
  });
  
  it('should query google.com', async () => {
    const client = new DNSQueryCluster({
      forwardServers: CLOUDFLARE_DNS_SERVERS,
      queryMethod: DNSQueryMethod.DNS_OVER_TLS,
      loadBalancingStrategy: LoadBalancingStrategy.RANDOM_BALANCE
    });
    const raw = await client.query(mockPacket.getRaw());
  
    const response = new DNSPacket(raw);
    expect(response.hasAnswers()).toBe(true);
  });
});