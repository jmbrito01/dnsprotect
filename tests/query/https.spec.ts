import { DNSQuery, DNSQueryMethod } from "../../src/query";
import { RandomUtil } from "../../src/util/random";
import * as mock from './query.mock.json';
//@ts-ignore
import Packet from 'native-dns-packet';
import { MAX_UDP_PACKET_SIZE } from "../../src/interceptor/udp";

const CLOUDFLARE_DNS_SERVER = '1.0.0.1';
let client: DNSQuery;
let mockInstance = mock;

describe('DNSQuery with DNS-Over-HTTPS and CloudFlare DNS', () => {
  jest.setTimeout(15000);
  beforeAll(async () => {
    client = new DNSQuery({
      forwardServer: CLOUDFLARE_DNS_SERVER,
      queryMethod: DNSQueryMethod.DNS_OVER_HTTPS,
    });
  });
  
  beforeEach(async () => {
    // Generate a new transaction id
    mockInstance.header.id = RandomUtil.randomRange(0, 99999);
  })
  
  it('should query google.com and return answers', async () => {
    mockInstance.question[0].name = 'google.co.uk'; // Changes domain to avoid http code 405
    const msg = Buffer.alloc(MAX_UDP_PACKET_SIZE);
    Packet.write(msg, mockInstance);
    const raw = await client.query(msg);
  
    const response = Packet.parse(raw); 
    expect(response.answer.length).toBeGreaterThan(0);
  });
});