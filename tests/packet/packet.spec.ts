import { DNSPacket, DNSPacketOpcode, DNSPacketQR, DNSResponseCode } from "../../src/packet/packet";
import { DNSQuery, DNSQueryMethod } from "../../src/query/query";
import mock from './packet.json';

describe('DNSPacket with question packet', () => {
  let request: DNSPacket;
  let query: DNSQuery;
  jest.setTimeout(10000);

  beforeAll(async () => {
    request = new DNSPacket(Buffer.from(mock.query, 'base64'));
    query = new DNSQuery({
      forwardServer: '1.1.1.1',
      queryMethod: DNSQueryMethod.DNS_OVER_TLS,
    }); 
  });

  it('Should parse headers correctly', async () => {
    const header = request.headers;
    expect(header.id).toBe(33256);

    expect(header.flags.qr).toBe(DNSPacketQR.QUERY);
    expect(header.flags.opcode).toBe(DNSPacketOpcode.QUERY);
    expect(header.flags.authoritativeAnswer).toBe(false);
    expect(header.flags.truncated).toBe(false);
    expect(header.flags.recursionDesired).toBe(true);
    expect(header.flags.recursionAvailable).toBe(false);
    expect(header.flags.responseCode).toBe(DNSResponseCode.NOERROR);

    expect(header.questionCount).toBe(1);
    expect(header.answerCount).toBe(0);
    expect(header.authorityResourceRecordCount).toBe(0);
    expect(header.additionalResourceRecordCount).toBe(1);
  });

  it('should say its not a reply', async () => {
    expect(request.isReply()).toBe(false);
  });

  it('should parse question section correctly', async () => {
    const questions = request.sections.questions;
    expect(questions.length).toBe(1);

    const question = questions[0];
    expect(question.name).toBe('google.com');
    expect(question.type).toBe(1);
    expect(question.class).toBe(1);
  });

  it('should be able to parse own raw return', async () => {
    const buff = request.getRaw();

    const newRequest = new DNSPacket(buff);

    expect(newRequest.getId()).toBe(request.getId());
    expect(newRequest.sections.questions[0].name).toBe(request.sections.questions[0].name);
  });

  it('should be able to return a valid raw packet', async () => {
    const buff = request.getRaw();

    let error = false;
    const response = await query.query(buff)
      .catch(e => { error = true });

    expect(error).toBe(false);
  });

  it('should disable/enable authenticated data', async () => {
    request.disableAuthenticatedData();

    const disabled = new DNSPacket(request.getRaw());

    expect(disabled.headers.flags.authenticatedData).toBe(false);

    disabled.enableAuthenticatedData();

    const enabled = new DNSPacket(disabled.getRaw());

    expect(enabled.headers.flags.authenticatedData).toBe(true);
  });
});

describe('DNSPacket with answer packet', () => {
  let request: DNSPacket;
  let response: DNSPacket;
  let query: DNSQuery;

  beforeAll(async () => {
    const queryBuffer = Buffer.from(mock.query, 'base64');
    request = new DNSPacket(queryBuffer); 

    const responseBuffer = Buffer.from(mock.response, 'base64');
    response = new DNSPacket(Buffer.from(responseBuffer));

    query = new DNSQuery({
      forwardServer: '1.1.1.1',
      queryMethod: DNSQueryMethod.DNS_OVER_TLS,
    });
  });

  it('Should parse headers correctly', async () => {
    
    const header = response.headers;
    expect(response.getId()).toBe(request.getId());

    expect(header.flags.qr).toBe(DNSPacketQR.REPLY);
    expect(header.flags.opcode).toBe(DNSPacketOpcode.QUERY);
    expect(header.flags.authoritativeAnswer).toBe(false);
    expect(header.flags.truncated).toBe(false);
    expect(header.flags.recursionDesired).toBe(true);
    expect(header.flags.recursionAvailable).toBe(true);
    expect(header.flags.responseCode).toBe(DNSResponseCode.NOERROR);

    expect(header.questionCount).toBe(1);
    expect(header.answerCount).toBe(1);
    expect(header.authorityResourceRecordCount).toBe(0);
    expect(header.additionalResourceRecordCount).toBe(1);
  });

  it('should say its a reply', async () => {
    expect(response.isReply()).toBe(true);
  });

  it('Should parse answers correctly', async () => {
    const answers = response.sections.answers;

    expect(answers.length).toBeGreaterThan(0);
    const answer = answers[0];
    expect(answer.name).toBe(request.sections.questions[0].name);
    expect(answer.address).toBeDefined();
    expect(answer.address?.length).toBeGreaterThan(0);
  });

  it('should be able to parse a valid raw packet', async () => {
    const buff = request.getRaw();

    const responseRaw = await query.query(buff)

    const newResponse = new DNSPacket(responseRaw);

    expect(newResponse.getId()).toBe(request.getId());
    expect(newResponse.sections.questions.length).toBe(request.sections.questions.length);
    expect(newResponse.sections.answers.length).toBe(request.sections.questions.length);
    expect(newResponse.sections.answers.length).toBe(newResponse.headers.answerCount);
    expect(newResponse.sections.authority.length).toBe(newResponse.headers.authorityResourceRecordCount);
    expect(newResponse.sections.additional.length).toBe(newResponse.headers.additionalResourceRecordCount);
  });
});