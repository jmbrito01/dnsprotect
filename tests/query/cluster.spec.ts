import { DNSQueryMethod } from "../../src/query/query";
import { RandomUtil } from "../../src/util/random";
import * as mock from './query.mock.json';
//@ts-ignore
import Packet from 'native-dns-packet';
import { MAX_UDP_PACKET_SIZE } from "../../src/interceptor/interceptor";
import { DNSQueryCluster } from "../../src/query/query-cluster";
import { LoadBalancingStrategy } from "../../src/util/load-balancing";

const CLOUDFLARE_DNS_SERVERS = ['1.1.1.1','1.0.0.1'];
let mockInstance = mock;

describe('DNSQuery Cluster', () => {
  jest.setTimeout(15000);
  
  beforeEach(async () => {
    // Generate a new transaction id
    mockInstance.header.id = RandomUtil.randomRange(0, 99999);
  });
  
  it('should query google.com', async () => {
    const client = new DNSQueryCluster({
      forwardServers: CLOUDFLARE_DNS_SERVERS,
      queryMethod: DNSQueryMethod.DNS_OVER_TLS,
      loadBalancingStrategy: LoadBalancingStrategy.RANDOM_BALANCE
    });
    mockInstance.question[0].name = 'google.co.uk'; // Changes domain to avoid http code 405
    const msg = Buffer.alloc(MAX_UDP_PACKET_SIZE);
    Packet.write(msg, mockInstance);
    const raw = await client.query(msg);
  
    const response = Packet.parse(raw); 
    expect(response.answer.length).toBeGreaterThan(0);
  });
});