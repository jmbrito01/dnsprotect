import axios, { AxiosInstance } from "axios";
import { Agent } from "https";
import { connect, TLSSocket } from 'tls';
import { promisify } from "util";
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

export class ConnectionClosedError extends Error {
  constructor(transactionId: number) {
    super(`The transaction with ID ${transactionId} was rejected because the connection was closed.`);
  }
}

export interface DNSQueryPromiseMapper {
  resolve: DNSQueryPromiseResolver;
  reject: DNSQueryPromiseRejecter;
}

export class DNSQuery {
  public isTLSReady: boolean = false;
  public isClosing: boolean = false;
  public isConnecting: boolean = false;
  protected httpClient?: AxiosInstance;
  protected tlsClient?: TLSSocket;
  protected readonly tlsPromises: Map<number, DNSQueryPromiseMapper> = new Map();
  protected readonly tlsQueue: ({data: Uint8Array}&DNSQueryPromiseMapper)[] = [];
  protected readonly logger = new Logger({ prefix: 'DNS QUERY' });

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
      this.createTLSClient();
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

  public close(): Promise<void> {
    return new Promise((resolve) => {
      this.isClosing = true;
      if (this.options.queryMethod === DNSQueryMethod.DNS_OVER_TLS && this.tlsClient && this.isTLSReady) {
        this.tlsClient?.destroy();
        this.tlsClient.removeAllListeners();
        this.tlsClient.unpipe();
        this.tlsClient.unref();
        this.tlsClient?.end(() => {
          resolve();
        })
      }
    });
  }

  protected async dohQuery(msg: Uint8Array): Promise<any> {
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

  protected async dotQuery(msg: Uint8Array): Promise<Uint8Array> {
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

        if (err) {
          if (this.tlsPromises.has(transactionId)) {
            this.logger.log('DNS-Over-TLS - Deleted Promise TID:', transactionId, 'because it was rejected');
            this.tlsPromises.delete(transactionId);
          }
          return reject(err);
        }

        this.tlsPromises.set(transactionId, { resolve, reject });
      });
    });
  }

  private createTLSClient(): void {
    if (this.isConnecting) return; // Dont try to connect if it's already connecting

    this.isConnecting = true;
    this.tlsClient = connect({
      host: this.options.forwardServer,
      port: DEFAULT_DNS_TLS_PORT,
    }, () => {
      this.isTLSReady = true;
      this.isConnecting = false;
      this.logger.log('DNS-Over-TLS - Established connection with DNS Server')

      this.reprocessTLSQueue();
    });

    this.tlsClient.setKeepAlive(true);

    this.tlsClient.on('data', this.onTLSData.bind(this));
    this.tlsClient.on('end', this.onTLSClose.bind(this));
  }

  private async reprocessTLSQueue(): Promise<void> {
    if (this.tlsQueue.length > 0) {
      const queued = this.tlsQueue.splice(0);
      this.logger.log('DNS-Over-TLS - Sending', queued.length, 'queries in queue');
      await Promise.all(
        queued.map(promise => this.dotQuery(promise.data).then(promise.resolve).catch(promise.reject))
      );
    }
  }

  private onTLSClose(): void {
    this.isTLSReady = false;
    this.isConnecting = false;
    this.logger.log('DNS-Over-TLS - Connection closed. Reconnecting...');

    this.tlsPromises.forEach((promise, key) => {
      this.logger.log('DNS-Over-TLS - Rejecting query', key, 'because connection closed.');
      promise.reject(new ConnectionClosedError(key));
      this.tlsPromises.delete(key);
    });

    if (!this.isClosing) {
      this.createTLSClient();
    }
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
      this.logger.warn('DNS-Over-TLS - Could not find the correct promise for:', transactionId);
    }
  }
}