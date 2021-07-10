import { Logger } from "../util/logger";

export const DNS_PACKET_HEADER_SIZE = 2 * 6; // 6 16bit ints

export enum DNSPacketQR {
  QUERY = 0,
  REPLY = 1,
}

export enum DNSPacketOpcode {
  QUERY = 0,
  IQUERY = 1,
  STATUS = 2,
}

export enum DNSPacketRecordType {
  A = 1,
  NS = 2,
  CNAME = 5,
  SOA = 6,
  WKS = 11,
  PTR = 12,
  MX = 15,
  AAAA = 28,
  SRV = 33,
}

export enum DNSPacketClass {
  IN = 1,
}

export enum DNSResponseCode {
  NOERROR = 0,
  FORMERR = 1,
  SERVFAIL = 2,
  NXDOMAIN = 3,
  NOTIMP = 4,
  REFUSED = 5,
  YXDOMAIN = 6,
  YXRRSET = 7,
  NXRRSET = 8,
  NOTAUTH = 9,
  NOTZONE = 10,
  DSOTYPENI = 11,
  BADSIG = 16,
  BADKEY = 17,
  BADTIME = 18,
  BADMODE = 19,
  BADNAME = 20,
  BADALG = 21,
  BADTRUNC = 22,
  BADCOOKIE = 23,
}

export interface DNSPacketHeaderFlags {
  id: number;
  flags: {
    qr: DNSPacketQR;
    opcode: DNSPacketOpcode;
    authoritativeAnswer: boolean;
    truncated: boolean;
    recursionDesired: boolean;
    recursionAvailable: boolean;
    _reserved: number;
    authenticatedData: boolean;
    checkingDisabled: boolean;
    _raw: number;
    responseCode: DNSResponseCode;
  }
  questionCount: number;
  answerCount: number;
  authorityResourceRecordCount: number;
  additionalResourceRecordCount: number;
}

export interface DNSPacketSections {
  questions: DNSPacketQuestionRecord[];
  answers: DNSPacketResourceRecord[];
  authority: DNSPacketResourceRecord[];
  additional: DNSPacketResourceRecord[];
}
export interface DNSPacketQuestionRecord {
  name: string;
  type: number,
  class: number;
}

export interface DNSPacketResourceRecord {
  name: string;
  type: number;
  class: number;
  ttl: number;
  rdataSize: number;
  rdata: Buffer;
  address?: string; // A , AAAA 
  canonicalName?: string; // CNAME
  priority?: number; // MX
  mailExchange?: string; // MX
  nameServer?: string; // NS
  fullNameServer?: string; // NS
}

export class DNSPacket {
  public headers!: DNSPacketHeaderFlags;
  public sections!: DNSPacketSections;
  public buffer!: Buffer;
  private readonly logger = new Logger({ prefix: 'DNS PACKET' });

  constructor(msg: Uint8Array) {
    this.buffer = Buffer.from(msg);

    this.headers = this.parseHeader();
    this.sections = this.parseSections();
  }

  public hasQuestionWithDomain(name: string): boolean {
    return (
      this.hasQuestions() && 
      this.sections.questions.findIndex(question => question.name === name) !== -1
    );
  }

  public hasQuestions(): boolean {
    return this.sections.questions.length > 0;
  }

  public hasAnswers(): boolean {
    return this.sections.answers.length > 0;
  }

  public isReply(): boolean {
    return this.headers.flags.qr === DNSPacketQR.REPLY;
  }

  public getId(): number {
    return this.headers.id;
  }

  public getRaw(): Buffer {
    const header = this.writeRawHeader();
    const sections = this.writeRawSections();
    const raw = Buffer.concat([header, sections]);

    return raw;
  }

  public writeRawHeader(): Buffer {
    const buffer = Buffer.alloc(DNS_PACKET_HEADER_SIZE);

    buffer.writeUInt16BE(this.getId());
    buffer.writeUInt16BE(this.headers.flags._raw, 2);
    buffer.writeUInt16BE(this.sections.questions.length, 4);
    buffer.writeUInt16BE(this.sections.answers.length, 6);
    buffer.writeUInt16BE(this.sections.authority.length, 8);
    buffer.writeUInt16BE(this.sections.additional.length, 10);

    return buffer;
  }

  public writeRawSections(): Buffer {
    const questions = this.writeRawQuestions();
    
    const answers = this.writeRawResourceRecordCollection(this.sections.answers);
    const authority = this.writeRawResourceRecordCollection(this.sections.authority);
    const additional = this.writeRawResourceRecordCollection(this.sections.additional);
    const sections = Buffer.concat([questions, answers, authority, additional]);
    return sections;
  }

  private writeRawQuestions(): Buffer {
    const questions = this.sections.questions.map(question => {
      const name = this.createStringBuffer(question.name);

      const other = Buffer.alloc(4);
      other.writeUInt16BE(question.type, 0);
      other.writeUInt16BE(question.class, 2);

      return Buffer.concat([name, other]);
    });

    return Buffer.concat(questions);
  }

  private writeRawResourceRecordCollection(records: DNSPacketResourceRecord[]): Buffer {
    const mappedRecords = records.map(record => {
      const name = this.createStringBuffer(record.name);

      const other = Buffer.alloc(10);
      other.writeUInt16BE(record.type, 0);
      other.writeUInt16BE(record.class, 2);
      other.writeUInt32BE(record.ttl, 4);
      other.writeUInt16BE(record.rdataSize, 8);

      return Buffer.concat([name, other, record.rdata]);
    });

    return Buffer.concat(mappedRecords);
  }

  private createStringBuffer(name: string): Buffer {
    const parts = name.split('.').map(part => {
      const buffer = Buffer.alloc(part.length + 1, 0);
      buffer.writeUInt8(part.length);
      buffer.write(part, 1, 'utf-8');

      return buffer;
    });

    return Buffer.concat([...parts, Buffer.alloc(1, 0)]);
  }

  private parseHeader(): DNSPacketHeaderFlags {
    const rawHeader = this.buffer.slice(0, DNS_PACKET_HEADER_SIZE);
    
    const flags = rawHeader.readUInt16BE(2);
    const FLAG_BIT_SIZE = 16;

    const headers: DNSPacketHeaderFlags = {
      id: rawHeader.readUInt16BE(0),
      flags: {
        _raw: flags,
        qr: this.getBitsFromNumber(flags, 1, FLAG_BIT_SIZE),
        opcode: this.getBitsFromNumber(flags, 2, FLAG_BIT_SIZE, 4),
        authoritativeAnswer: this.getBitsFromNumber(flags, 6, FLAG_BIT_SIZE) === 1,
        truncated: this.getBitsFromNumber(flags, 7, FLAG_BIT_SIZE) === 1,
        recursionDesired: this.getBitsFromNumber(flags, 8, FLAG_BIT_SIZE) === 1,
        recursionAvailable: this.getBitsFromNumber(flags, 9, FLAG_BIT_SIZE) === 1,
        _reserved: this.getBitsFromNumber(flags, 10, FLAG_BIT_SIZE),
        authenticatedData: this.getBitsFromNumber(flags, 11, FLAG_BIT_SIZE) === 1,
        checkingDisabled: this.getBitsFromNumber(flags, 11, FLAG_BIT_SIZE) === 1,
        responseCode: this.getBitsFromNumber(flags, 13, FLAG_BIT_SIZE, 4),
      },
      questionCount: rawHeader.readUInt16BE(4),
      answerCount: rawHeader.readUInt16BE(6),
      authorityResourceRecordCount: rawHeader.readUInt16BE(8),
      additionalResourceRecordCount: rawHeader.readUInt16BE(10),
    };

    return headers;
  }

  private parseSections(): DNSPacketSections {
    
    let remainingSections = this.buffer.slice(DNS_PACKET_HEADER_SIZE);

    const sections: DNSPacketSections = {
      questions: [],
      answers: [],
      authority: [],
      additional: [],
    }

    const questions = this.getNextQuestionRecord(remainingSections, this.headers.questionCount);
    remainingSections = questions.buffer;
    sections.questions = questions.records;

    const answers = this.getNextResourceRecord(remainingSections, this.headers.answerCount);
    remainingSections = answers.buffer;
    sections.answers = this.mapAnswerSection(answers.records);

    const authority = this.getNextResourceRecord(remainingSections, this.headers.authorityResourceRecordCount);
    remainingSections = authority.buffer;
    sections.authority = authority.records;

    const additional = this.getNextResourceRecord(remainingSections, this.headers.additionalResourceRecordCount);
    remainingSections = additional.buffer;
    sections.additional = additional.records;
    return sections;
  }

  private getNextQuestionRecord(buffer: Buffer, count: number = 1): { buffer: Buffer, records: DNSPacketQuestionRecord[] } {
    let newBuffer = Buffer.from(buffer);
    const sections: DNSPacketQuestionRecord[] = [];
    for (let i = 0; i < count;i++) {
      const { label: name, size } = this.readStringLabel(newBuffer, 0);
      newBuffer = newBuffer.slice(size);
      const record: DNSPacketQuestionRecord = {
        name,
        type: newBuffer.readUInt16BE(0),
        class: newBuffer.readUInt16BE(2),
      }
      newBuffer = newBuffer.slice(4);
      sections.push(record);
    }
    return {
      buffer: newBuffer,
      records: sections,
    }
  }

  private getNextResourceRecord(buffer: Buffer, count: number = 1): { buffer: Buffer, records: DNSPacketResourceRecord[] } {
    let newBuffer = Buffer.from(buffer);
    const sections: DNSPacketResourceRecord[] = [];
    for (let i = 0; i < count;i++) {
      const { label: name, size } = this.readStringLabel(newBuffer, 0);
      newBuffer = newBuffer.slice(size); // String null terminated

      if (newBuffer.length < 10) {
        this.logger.warn('Buffer is smaller than it should. Length is', newBuffer.length, '')
        break;
      }

      const rdataSize = newBuffer.readUInt16BE(8);
      const record: DNSPacketResourceRecord = {
        name,
        type: newBuffer.readUInt16BE(0),
        class: newBuffer.readUInt16BE(2),
        ttl: newBuffer.readUInt32BE(4),
        rdataSize,
        rdata: newBuffer.slice(10, rdataSize+10),
      }
      newBuffer = newBuffer.slice(rdataSize+10);
      sections.push(record);
    }
    return {
      buffer: newBuffer,
      records: sections,
    }
  }

  private mapAnswerSection(records: DNSPacketResourceRecord[]): DNSPacketResourceRecord[] {
    return records.map(record => {
      if ([DNSPacketRecordType.A, DNSPacketRecordType.AAAA].indexOf(record.type) !== -1) {
        return {
          ...record,
          address: record.rdata.map(byte => byte).join('.'),
        }
      }
      
      if (record.rdataSize === 4) {
        const address = record.rdata.map(byte => byte).join('.');
        this.logger.warn('Not A or AAAA record but looks like an IP: type=', record.type, 'address=', address);
      }

      if ([DNSPacketRecordType.PTR, DNSPacketRecordType.NS].indexOf(record.type) !== -1) {
        const nameServer = this.readStringLabel(record.rdata, 0);
        const r = {
          ...record,
          nameServer: nameServer.label,
          fullNameServer: [nameServer.label, record.name].join('.'),
        };
        this.logger.warn('Name server parsed: ', r);
        return r;
      }

      if (record.type === DNSPacketRecordType.MX) {
        const priority = record.rdata.readUInt16BE(0);
        const mailExchange = this.readStringLabel(record.rdata, 2);
        const r: DNSPacketResourceRecord = {
          ...record,
          priority,
          mailExchange: mailExchange.label,
        }
        this.logger.warn('Found MX Record type, heres what we found: ', r);
        return r;
      }

      if (record.type === DNSPacketRecordType.CNAME) {
        const name = this.readStringLabel(record.rdata, 0);

        if (name.size > 0) {
          return {
            ...record,
            canonicalName: name.label,
          }
        }
      }
     return record;
    });
  }

  private readStringLabel(buffer: Buffer, position: number): { label: string, size: number } {
    let newBuffer = buffer.slice(position);
    const names: string[] = [];
    let partLength = 0, totalLength = 0;

    if (newBuffer.length === 0) {
      return {
        label: '',
        size: 0,
      }
    }

    const first8Bits = newBuffer.readUInt16BE(0);
    const first4Bits = this.getBitsFromNumber(first8Bits, 1, 16, 4);
    if (first4Bits === 0xC) {
      // It's a pointer string
      const pointerAddress = this.getBitsFromNumber(first8Bits, 5, 16, 12);
      const pointedString = this.readStringLabel(this.buffer.slice(pointerAddress), 0);
      return {
        label: pointedString.label,
        size: 2,
      }
    }
    while (newBuffer.length > 0 && (partLength = newBuffer.readInt8(0)) > 0) {  
      const name = newBuffer.slice(1, partLength+1).toString();
      names.push(name);
      newBuffer = newBuffer.slice(partLength+1);
      totalLength += partLength + 1;
    }

    return {
      label: names.join('.'),
      size: totalLength+1,
    };
  }

  private getBitsFromNumber(n: number, pos: number, numberSize: number, chunkSize: number = 1): number {
    // TODO: Make it faster using numbers
    const strBit = n.toString(2).padStart(numberSize, '0');
    return parseInt(strBit.slice(pos-1, (pos-1)+chunkSize), 2);
  }
}