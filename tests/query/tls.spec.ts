import { DNSQuery, DNSQueryMethod } from "../../src/query/query";
import { RandomUtil } from "../../src/util/random";
import * as mock from './query.mock.json';
//@ts-ignore
import Packet from 'native-dns-packet';
import { MAX_UDP_PACKET_SIZE } from "../../src/interceptor/interceptor";
import { TimerUtil } from "../../src/util/timer";
import { DNSPacket } from "../../src/packet/packet";

const CLOUDFLARE_DNS_SERVER = '1.1.1.1';
const JEST_TIMEOUT = 10000;
const MAX_TRANSACTION_ID = 65535;
const WAIT_FOR_DELAY_MS = 250;

let client: DNSQuery;
let mockInstance = mock;

beforeAll(async () => {
  client = new DNSQuery({
    forwardServer: CLOUDFLARE_DNS_SERVER,
    queryMethod: DNSQueryMethod.DNS_OVER_TLS,
  });

  jest.setTimeout(JEST_TIMEOUT);
});

describe('DNSQuery with DNS-Over-TLS, querying google.com', () => {
  let mockPacket = new DNSPacket(Buffer.from(mock.query, 'base64'));
  beforeEach(async () => {
    // Generate a new transaction id
    mockPacket.headers.id = RandomUtil.randomRange(0, MAX_TRANSACTION_ID);
    await TimerUtil.waitFor(() => client.isTLSReady, WAIT_FOR_DELAY_MS, JEST_TIMEOUT);
    expect(client.isTLSReady).toBeTruthy();
  });

  it('should return answers when tls is ready', async () => {
    const raw = await client.query(mockPacket.getRaw());
  
    const response = new DNSPacket(raw);
    expect(response.hasAnswers()).toBe(true);
  });
});

afterAll(async () => {
  await client.close();
})