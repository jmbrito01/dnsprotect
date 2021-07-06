import axios, { AxiosInstance } from "axios";
import { Agent } from "https";
import * as tls from 'tls';
import { BaseInjection } from "./interceptor/injections/base";
import { Logger } from "./util/logger";

export const DEFAULT_DNS_TLS_PORT = 853;

export enum DNSQueryMethod {
  DNS_OVER_HTTPS = 'doh',
  DNS_OVER_TLS = 'dot',
}

export interface DNSQueryOptions {
  forwardServer: string;
  queryMethod: DNSQueryMethod;
}

type DNSQueryPromiseResolver = (value: Uint8Array | PromiseLike<Uint8Array>) => void;
type DNSQueryPromiseRejecter = (reason?: any) => void;
export interface DNSQueryPromiseMapper {
  resolve: DNSQueryPromiseResolver;
  reject: DNSQueryPromiseRejecter;
}

export class DNSQuery {
  protected httpClient?: AxiosInstance;
  protected tlsClient?: tls.TLSSocket;
  protected isTLSReady: boolean = false;
  protected readonly tlsPromises: Map<number, DNSQueryPromiseMapper> = new Map();
  protected readonly tlsQueue: ({data: Uint8Array}&DNSQueryPromiseMapper)[] = [];
  protected readonly logger = new Logger({ prefix: 'DNSQuery' });

  constructor(protected readonly options: DNSQueryOptions) {
    if (options.queryMethod === DNSQueryMethod.DNS_OVER_HTTPS) {
      this.httpClient = axios.create({
        baseURL: `https://${options.forwardServer}`,
        headers: {
          'content-type': 'application/dns-message',
          'accept': 'application/dns-message',
          Connection: 'keep-alive',
          'authority': options.forwardServer,
        },
        responseType: 'arraybuffer',
        httpsAgent: new Agent({
          keepAlive: true,
        })
      });
    }

    if (options.queryMethod === DNSQueryMethod.DNS_OVER_TLS) {
      this.connectTLS();
    }
  }

  public async query(msg: Uint8Array): Promise<any> {
    switch (this.options.queryMethod) {
      case DNSQueryMethod.DNS_OVER_HTTPS:
        return this.dohQuery(msg);
      case DNSQueryMethod.DNS_OVER_TLS:
        return this.dotQuery(msg);
      default:
        throw new Error('Invaid DNS Query Method: ' + this.options.queryMethod);
    }
  }

  public async dohQuery(msg: Uint8Array): Promise<any> {
    if (this.options.queryMethod !== DNSQueryMethod.DNS_OVER_HTTPS || !this.httpClient) {
      throw new Error('Calling DNS Over HTTPS with a instance of DNS-over-TLS configuration');
    }

    const buffer = Buffer.from(msg);
    const response = await this.httpClient.get(`/dns-query`, {
      params: {
        dns: buffer.toString('base64'),
      },
      headers: {
        'content-length': buffer.length,
      }
    });
  
    return response.data;
  }

  public async dotQuery(msg: Uint8Array): Promise<Uint8Array> {
    const transactionId = Buffer.from(msg).readUInt16BE(0);
    return new Promise<Uint8Array>((resolve, reject) => {
      if (this.options.queryMethod !== DNSQueryMethod.DNS_OVER_TLS || !this.tlsClient) {
        return reject(Error('Calling DNS-over-TLS with a instance of DNS-over-HTTPS configuration'));
      }

      if (!this.isTLSReady) {
        return this.tlsQueue.push({
          data: msg, 
          reject, resolve
        });
      }
      const start = Buffer.alloc(2);
      start.writeUInt16BE(msg.length);
      const data = Buffer.concat([start, msg]);
      this.tlsClient.write(data, (err: any) => {
        this.logger.log('DNS-Over-TLS - Sent TID:', transactionId);

        if (err) return reject(err);

        this.tlsPromises.set(transactionId, { resolve, reject });
      });
    });
  }

  private connectTLS(): void {
    this.tlsClient = tls.connect({
      host: this.options.forwardServer,
      port: DEFAULT_DNS_TLS_PORT,
    });
    this.tlsClient.on('data', this.onTLSData.bind(this));
    this.tlsClient.on('secureConnect', () => {
      this.isTLSReady = true;
      this.logger.log('DNS-Over-TLS - Established connection with DNS Server')

      if (this.tlsQueue.length > 0) {
        const queued = this.tlsQueue.splice(this.tlsQueue.length);
        this.logger.log('DNS-Over-TLS - Sending', queued.length, 'queries in queue');
        Promise.all(
          queued.map(promise => this.dotQuery(promise.data).then(promise.resolve).catch(promise.reject))
        );
      }
      
    });
    this.tlsClient.on('close', this.onTLSClose.bind(this));
  }

  private onTLSClose(): void {
    this.isTLSReady = false;
    this.logger.log('DNS-Over-TLS - Connection closed. Reconnecting...');
    this.connectTLS();
  }

  private async onTLSData(buffer: Buffer): Promise<void> {
    const buffSize = buffer.readUInt16BE(0);
    let data = Buffer.from(buffer);
    if (data.length > (buffSize + 2)) {
      // Chunked packet
      data = buffer.slice(buffSize+2);
      this.onTLSData(buffer.slice(buffSize+2));
    } else if (data.length < (buffSize + 2) || data.length < 12) {
      this.logger.error('DNS-Over-TLS - Buffer smaller than it should:', data.length);
      debugger;
    }

    const transactionId = data.readUInt16BE(2);
    this.logger.log('DNS-Over-TLS - Received TID:', transactionId);

    const promise = this.tlsPromises.get(transactionId);
    if (promise) {
      promise.resolve(data.slice(2, buffSize+2));
      this.tlsPromises.delete(transactionId);
      this.logger.log('DNS-Over-TLS - Cleared one promise from promise queue, total count is:', this.tlsPromises.size);
    } else {
      this.logger.error('DNS-Over-TLS - Could not find the correct promise for:', transactionId);
    }
  }
}