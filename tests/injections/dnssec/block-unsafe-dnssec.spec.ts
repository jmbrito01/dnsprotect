import { Resolver } from "dns";
import { BlockDNSSECUnsafeResponseInjection } from "../../../src/interceptor/injections/dnssec/block-unsafe-dnssec-response";
import { EnsureDNSSECMode, EnsureDNSSECRequestInjection } from "../../../src/interceptor/injections/dnssec/ensure-dnssec-request";
import { DNSPacket } from "../../../src/packet/packet";
import mock from './packet.mock.json';

describe('Block Unsafe DNSSEC Interceptor', () => {
  let blockUnsafeDnssec = new BlockDNSSECUnsafeResponseInjection({
    logActions: false,
    mode: EnsureDNSSECMode.BLOCK,
    blockUnvalidatedDomains: true,
  });

  it('should need execution if packet does not have AD', async () => {
    const packetQuery = new DNSPacket(Buffer.from(mock.query, 'base64'));
    const packetResponse = new DNSPacket(Buffer.from(mock.response, 'base64'));

    packetQuery.disableAuthenticatedData();
    packetResponse.disableAuthenticatedData();

    const needsExecutionWihoutAD = await blockUnsafeDnssec.needsExecution(packetQuery, packetResponse);

    expect(needsExecutionWihoutAD).toBe(true);

    packetQuery.enableAuthenticatedData();
    packetResponse.enableAuthenticatedData();

    const needsExecutionWithAD = await blockUnsafeDnssec.needsExecution(packetQuery, packetResponse);
    expect(needsExecutionWithAD).toBe(false);
  });

  it('should halt if AD not enabled in response', async () => {
    const packetQuery = new DNSPacket(Buffer.from(mock.query, 'base64'));
    const packetResponse = new DNSPacket(Buffer.from(mock.response, 'base64'));
    packetQuery.enableAuthenticatedData();
    packetResponse.disableAuthenticatedData();

    const result = await blockUnsafeDnssec.onExecute(packetQuery, packetResponse);

    expect(result.halt).toBe(true);
  });
});