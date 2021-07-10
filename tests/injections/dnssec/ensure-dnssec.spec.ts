import { Resolver } from "dns";
import { EnsureDNSSECMode, EnsureDNSSECRequestInjection } from "../../../src/interceptor/injections/dnssec/ensure-dnssec-request";
import { DNSPacket } from "../../../src/packet/packet";
import mock from './packet.mock.json';

describe('Ensure DNSSEC Interceptor', () => {
  it('should need execution if packet does not have AD', async () => {
    let ensureDnssec = new EnsureDNSSECRequestInjection({
      logActions: false,
      mode: EnsureDNSSECMode.CHANGE,
    });

    const packet = new DNSPacket(Buffer.from(mock.query, 'base64'));
    packet.disableAuthenticatedData();

    const needsExecutionWihoutAD = await ensureDnssec.needsExecution(packet);

    expect(needsExecutionWihoutAD).toBe(true);

    packet.enableAuthenticatedData();
    const needsExecutionWithAD = await ensureDnssec.needsExecution(packet);
    expect(needsExecutionWithAD).toBe(false);
  });

  describe('in CHANGE mode', () => {
    let ensureDnssec = new EnsureDNSSECRequestInjection({
      logActions: false,
      mode: EnsureDNSSECMode.CHANGE,
    });

    it('should change packet to enable AD', async () => {
      const packet = new DNSPacket(Buffer.from(mock.query, 'base64'));
      packet.disableAuthenticatedData();

      const result = await ensureDnssec.onExecute(packet);

      expect(result.halt).toBeFalsy();
      expect(result.query).toBeDefined();

      if (result.query) {
        const queryPacket = new DNSPacket(result.query);
        expect(queryPacket.headers.flags.authenticatedData).toBe(true);
      }
    });
  });

  describe('in BLOCK mode', () => {
    let ensureDnssec = new EnsureDNSSECRequestInjection({
      logActions: false,
      mode: EnsureDNSSECMode.BLOCK,
    });

    it('should halt if AD not enabled', async () => {
      const packet = new DNSPacket(Buffer.from(mock.query, 'base64'));
      packet.disableAuthenticatedData();

      const result = await ensureDnssec.onExecute(packet);

      expect(result.halt).toBe(true);
    });
  });
});