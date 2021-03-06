import dgram from 'dgram';
import { DNSQuery, DNSQueryMethod } from '../query/query';
import { BaseInjection, BaseInjectionPhase } from './injections/base';
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
import { LoadBalancingStrategy } from '../util/load-balancing';
import { DNSQueryCluster } from '../query/query-cluster';
import { EnsureDNSSECRequestInjection, EnsureDNSSECInjectionOptions } from './injections/dnssec/ensure-dnssec-request';
import { BlockDNSSECUnsafeResponseInjection } from './injections/dnssec/block-unsafe-dnssec-response';

export const DEFAULT_UDP_PORT = 53;
export const MAX_UDP_PACKET_SIZE = 512;
export const DEFAULT_DNS_QUERY_METHOD = DNSQueryMethod.DNS_OVER_HTTPS;

export interface DNSUDPInterceptorInjections {
  domainBlackList?: false|BlackListInjectionOptions;
  domainWhiteList?: false|WhiteListInjectionOptions;
  redis?: false|RedisClientInjectionOptions;
  dnsOverride?: false|DNSOverrideInjectionOptions;
  ensureDnssec?: false|EnsureDNSSECInjectionOptions;
}

export interface DNSUDPInterceptorOptions {
  forwardServers: string[];
  forwardRetries: number;
  loadBalancingStrategy?: LoadBalancingStrategy;
  queryMethod?: DNSQueryMethod;
  port?: number;
  injections: DNSUDPInterceptorInjections;
}

export class DNSUDPInterceptor {
  protected readonly server = dgram.createSocket('udp4');
  protected query!: DNSQueryCluster;
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

    if (!this.options.loadBalancingStrategy) {
      this.options.loadBalancingStrategy = LoadBalancingStrategy.RANDOM_BALANCE;
    }

    this.server.on('listening', this.onUDPListening.bind(this));
    this.server.on('error', this.onUDPError.bind(this));
    this.server.on('message', this.onUDPMessage.bind(this));

    this.query = new DNSQueryCluster({
      forwardServers: this.options.forwardServers,
      loadBalancingStrategy: this.options.loadBalancingStrategy,
      queryMethod: this.options.queryMethod,
    });

    this.loadInjections();
  }

  public bind(): Promise<void> {
    return new Promise((resolve) => {
      this.server.bind(this.options.port, () => resolve());
    });
  }

  public unbind(): Promise<void> {
    return new Promise((resolve) => {
      this.server.close(() => {
        this.server.removeAllListeners();
        this.server.unref();
        resolve();
      });
    });
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

    if (this.options.injections.ensureDnssec) {
      this.injections.push(new EnsureDNSSECRequestInjection(this.options.injections.ensureDnssec));
      this.injections.push(new BlockDNSSECUnsafeResponseInjection(this.options.injections.ensureDnssec));
    }
  }

  private async onUDPError(error: Error): Promise<void> {
    this.logger.error('There was a new UDP error: ', error);
  }

  private async onUDPMessage(msg: Uint8Array, rinfo: dgram.RemoteInfo): Promise<void> {
    const startTime = Date.now();
    const preInjectionResult = await BaseInjection.executeInjections(this.injections, msg, BaseInjectionPhase.BEFORE_QUERY);
 
    if (!preInjectionResult.halt) {
      const startForwardTime = Date.now();
      try {
        let forwardTime = 0;
        let response: any;
        response = preInjectionResult.response || await RetryUtil.retryPromiseFunction({
          retries: this.options.forwardRetries,
          warnErrors: true,
          warnFn: (...args: any[]) => {
            this.logger.warn('DNS Query returned error, retrying...');
          }
        }, () => this.query.query(Buffer.isBuffer(preInjectionResult.query) ? preInjectionResult.query : msg));
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
          this.logger.info(`DNS Query(${chalk.bold.green('OK')}): ${totalTime}ms (Proxy: ${totalTime-forwardTime}ms / Forward Server: ${forwardTime}ms)`)

          await BaseInjection.executeInjections(this.injections, msg, BaseInjectionPhase.AFTER_RESPONSE, response);
        });
      } catch (e) {
        if (e instanceof Error) {
          this.logger.error('Error with DNS Query: ', e.message);
          this.logger.error(e.stack);  
        }
        return;
      }
      
    } else if (preInjectionResult.halt && preInjectionResult.response) {
      this.logger.info('custom response');
      return this.server.send(preInjectionResult.response, rinfo.port, rinfo.address, async () => {
        const totalTime = Date.now() - startTime;
        this.logger.info(`DNS Query(${chalk.bold.red('BLOCK')}): ${totalTime}ms (Proxy: ${totalTime}ms)`)

        await BaseInjection.executeInjections(this.injections, msg, BaseInjectionPhase.AFTER_RESPONSE, preInjectionResult.response);
      });
    }
    const totalTime = Date.now() - startTime;
    this.logger.info(`DNS Query Time(${chalk.bold.red('BLOCK')}): ${totalTime}ms (Proxy: ${totalTime}ms)`)
  }

  private async onUDPListening(): Promise<void> {
    this.logger.info('UDP Server is now listening');
  }
}