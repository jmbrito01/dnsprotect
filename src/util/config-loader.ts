import { readFileSync } from "fs";
import { DNSUDPInterceptorOptions } from "../interceptor/udp";
import dot from 'dot-object';

export const DEFAULT_INTERCEPTOR_CONFIG: DNSUDPInterceptorOptions = {
  forwardServer: '1.0.0.1',
  forwardRetries: 1,
  injections: {
    blackList: false,
  }
}

export interface ConfigLoaderOptions {
  fileName?: string;
}
export class ConfigLoader {
  protected config: DNSUDPInterceptorOptions = DEFAULT_INTERCEPTOR_CONFIG;
  protected static _instance: ConfigLoader|undefined;

  constructor(protected options: ConfigLoaderOptions) {
    if (this.options.fileName) {
      this.config = JSON.parse(readFileSync(this.options.fileName).toString());
    }
  }

  static getInstance(): ConfigLoader {
    if (!this._instance) {
      throw new Error('ConfigLoader was not initialized yet!');
    }

    return this._instance;
  }

  static initialize(options: ConfigLoaderOptions): ConfigLoader {
    this._instance = new ConfigLoader(options);

    return this._instance;
  }

  public get<T = any>(name: string): T {
    return dot.pick(name, this.config);
  }

  public getFull(): DNSUDPInterceptorOptions {
    return this.config;
  }
}