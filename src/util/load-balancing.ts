import { RandomUtil } from "./random";

export enum LoadBalancingStrategy {
  RANDOM_BALANCE = 'random',
  ROUND_ROBIN = 'round-robin',
}

export interface LoadBalancingOptions {
  strategy: LoadBalancingStrategy;
}
export class LoadBalancing {
  private roundRobinCounter: number = 0;
  constructor (protected readonly options: LoadBalancingOptions) {}

  public pick<T>(load: T[]): T {
    let idx = 0;

    switch (this.options.strategy) {
      case LoadBalancingStrategy.RANDOM_BALANCE:
        idx = RandomUtil.randomRange(0, load.length);
        break;
      case LoadBalancingStrategy.ROUND_ROBIN:
        idx = this.getRoundRobinNext(load.length - 1);
      default:
        throw new Error(`Cant pick load balancing option. Strategy ${this.options.strategy} cant be handled.`);
    }
    return load[idx];
  }

  private getRoundRobinNext(max: number): number {
    const next = this.roundRobinCounter + 1;
    if (next > max) {
      this.roundRobinCounter = 0;
    } else {
      this.roundRobinCounter = next;
    }
    return this.roundRobinCounter;
  }
}