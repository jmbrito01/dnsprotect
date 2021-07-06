import axios, { AxiosInstance } from "axios";
import { Agent } from "https";
import { BaseInjection } from "./interceptor/injections/base";

export interface DNSQueryOptions {
  forwardServer: string;
}

export class DNSQuery {
  protected client!: AxiosInstance;

  constructor(protected readonly options: DNSQueryOptions) {
    this.client = axios.create({
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

  public async secureQuery(msg: Uint8Array): Promise<any> {
    const buffer = Buffer.from(msg);
    const response = await this.client.get(`/dns-query`, {
      params: {
        dns: buffer.toString('base64'),
      },
      headers: {
        'content-length': buffer.length,
      }
    });
  
    return response.data;
  }
}