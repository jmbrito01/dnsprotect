import { LoadBalancing, LoadBalancingStrategy } from "../util/load-balancing";
import { Logger } from "../util/logger";
import { DNSQuery, DNSQueryMethod } from "./query";

export interface DNSQueryClusterOptions {
  forwardServers: string[];
  loadBalancingStrategy: LoadBalancingStrategy;
  queryMethod: DNSQueryMethod;
}

export class DNSQueryCluster {
  protected readonly instances: DNSQuery[] = [];
  protected logger = new Logger({ prefix: 'DNSQUERY CLUSTER'});
  protected loadBalancing!: LoadBalancing;

  constructor(protected options: DNSQueryClusterOptions) {
    this.loadBalancing = new LoadBalancing({
      strategy: options.loadBalancingStrategy,
    });

    options.forwardServers.forEach(forwardServer => {
      this.instances.push(new DNSQuery({
        forwardServer, 
        queryMethod: options.queryMethod,
      }));
    });

    this.logger.log('Initialized', this.instances.length, 'instances of DNSQuery');
  }

  public async query(msg: Uint8Array): Promise<any> {
    const instance = this.loadBalancing.pick(this.instances);

    return instance.query(msg);
  }
}