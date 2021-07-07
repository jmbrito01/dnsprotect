import dgram from 'dgram';
import { DNSQuery, DNSQueryMethod } from '../query';
import { BaseInjection, BaseInjectionPhase } from './injections/base';
//@ts-ignore
import Packet from 'native-dns-packet';
import { DomainBlackListInjection, BlackListInjectionOptions } from './injections/domain-black-list';
import { Logger } from '../util/logger';
import { RetryUtil } from '../util/retry-util';
import Redis from 'redis';
import { RedisClientInjectionOptions } from './injections/redis-cache';
import { SaveCacheInjection } from './injections/redis-cache/save-cache';
import { LoadCacheInjection } from './injections/redis-cache/load-cache';
import chalk from 'chalk';
import { DNSOverrideInjection, DNSOverrideInjectionOptions } from './injections/dns-override';
import { DomainWhiteListInjection, WhiteListInjectionOptions } from './injections/domain-white-list';

export const DEFAULT_UDP_PORT = 53;
export const MAX_UDP_PACKET_SIZE = 512;
export const DEFAULT_DNS_QUERY_METHOD = DNSQueryMethod.DNS_OVER_HTTPS;

export interface DNSUDPInterceptorInjections {
  domainBlackList?: false|BlackListInjectionOptions;
  domainWhiteList?: false|WhiteListInjectionOptions;
  redis?: false|RedisClientInjectionOptions;
  dnsOverride?: false|DNSOverrideInjectionOptions;
}

export interface DNSUDPInterceptorOptions {
  forwardServer: string;
  forwardRetries: number;
  queryMethod?: DNSQueryMethod;
  port?: number;
  injections: DNSUDPInterceptorInjections;
}

export class DNSUDPInterceptor {
  protected readonly server = dgram.createSocket('udp4');
  protected query!: DNSQuery;
  protected injections: BaseInjection[] = [];
  protected readonly logger = new Logger({ prefix: 'UDP INTERCEPTOR'})

  constructor(protected options: DNSUDPInterceptorOptions) {
    if (!this.options.port) {
      this.options.port = DEFAULT_UDP_PORT;
    }
    if (!this.options.forwardRetries) {
      this.options.forwardRetries = 1;
    }
    if (!this.options.queryMethod) {
      this.options.queryMethod = DEFAULT_DNS_QUERY_METHOD;
    }

    this.server.on('listening', this.onUDPListening.bind(this));
    this.server.on('error', this.onUDPError.bind(this));
    this.server.on('message', this.onUDPMessage.bind(this));

    this.query = new DNSQuery({
      forwardServer: this.options.forwardServer,
      queryMethod: this.options.queryMethod,
    });

    this.loadInjections();
  }

  public bindUDP(): void {
    this.server.bind(this.options.port)
  }

  public unbindUDP(): void {
    this.server.close();
  }

  private loadInjections(): void {
    if (this.options.injections.domainBlackList) {
      this.injections.push(new DomainBlackListInjection(this.options.injections.domainBlackList));
    }

    if (this.options.injections.domainWhiteList) {
      this.injections.push(new DomainWhiteListInjection(this.options.injections.domainWhiteList));
    }

    if (this.options.injections.redis) {
      this.injections.push(new SaveCacheInjection(this.options.injections.redis));
      this.injections.push(new LoadCacheInjection(this.options.injections.redis));
    }

    if (this.options.injections.dnsOverride) {
      this.injections.push(new DNSOverrideInjection(this.options.injections.dnsOverride));
    }
  }

  private async onUDPError(error: Error): Promise<void> {
    this.logger.error('There was a new UDP error: ', error);
  }

  private async onUDPMessage(msg: Uint8Array, rinfo: dgram.RemoteInfo): Promise<void> {
    const startTime = Date.now();
    this.logger.log('New DNS query received.');
    const startForwardTime = Date.now();

    const preInjectionResult = await BaseInjection.executeInjections(this.injections, msg, BaseInjectionPhase.BEFORE_QUERY);
 
    if (!preInjectionResult.halt) {
      
      try {
        let forwardTime = 0;
        let response: any;
        response = preInjectionResult.response || await RetryUtil.retryPromiseFunction({
          retries: this.options.forwardRetries,
          warnErrors: true,
          warnFn: (...args: any[]) => {
            this.logger.log('DNS Query returned error, retrying...');
          }
        }, () => this.query.query(msg));
        forwardTime = Date.now() - startForwardTime;

        const beforeResponseResult = await BaseInjection.executeInjections(this.injections, msg, BaseInjectionPhase.BEFORE_RESPONSE, response);
        if (beforeResponseResult.halt) {
          const totalTime = Date.now() - startTime;
          this.logger.info(`DNS Query Time(${chalk.bold.red('BLOCK')}): ${totalTime}ms (Proxy: ${totalTime}ms / Forward Server: ${forwardTime}ms)`);
          return;
        }

        if (beforeResponseResult.response) response = beforeResponseResult.response;

        return this.server.send(response, rinfo.port, rinfo.address, async () => {
          const totalTime = Date.now() - startTime;
          this.logger.log(`DNS Query Time(${chalk.bold.green('OK')}): ${totalTime}ms (Proxy: ${totalTime-forwardTime}ms / Forward Server: ${forwardTime}ms)`)

          await BaseInjection.executeInjections(this.injections, msg, BaseInjectionPhase.AFTER_RESPONSE, response);
        });
      } catch (e) {
        const packet = Packet.parse(msg);
        
        if (e instanceof Error) {
          this.logger.error('Error with DNS Query: ', e.message);
          this.logger.error(e.stack);  
        }
        return;
      }
      
    } 
    const totalTime = Date.now() - startTime;
    this.logger.info(`DNS Query Time(${chalk.bold.red('BLOCK')}): ${totalTime}ms (Proxy: ${totalTime}ms)`)
  }

  private async onUDPListening(): Promise<void> {
    this.logger.info('UDP Server is now listening');
  }
}