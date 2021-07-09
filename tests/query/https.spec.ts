import { DNSQuery, DNSQueryMethod } from "../../src/query/query";
import { RandomUtil } from "../../src/util/random";
import * as mock from './query.mock.json';
//@ts-ignore
import Packet from 'native-dns-packet';
import { MAX_UDP_PACKET_SIZE } from "../../src/interceptor/interceptor";
import { DNSPacket } from "../../src/packet/packet";

const CLOUDFLARE_DNS_SERVER = '1.0.0.1';
let client: DNSQuery;

describe('DNSQuery with DNS-Over-HTTPS and CloudFlare DNS', () => {
  jest.setTimeout(15000);
  let mockPacket = new DNSPacket(Buffer.from(mock.query));
  
  beforeAll(async () => {
    client = new DNSQuery({
      forwardServer: CLOUDFLARE_DNS_SERVER,
      queryMethod: DNSQueryMethod.DNS_OVER_HTTPS,
    });
  });
  
  beforeEach(async () => {
    // Generate a new transaction id
    mockPacket.headers.id = RandomUtil.randomRange(0, 99999);
  })
  
  it('should query google.com and return answers', async () => {
    const raw = await client.query(mockPacket.getRaw());
  
    const response = new DNSPacket(raw);
    expect(response.hasAnswers()).toBe(true);
  });
});