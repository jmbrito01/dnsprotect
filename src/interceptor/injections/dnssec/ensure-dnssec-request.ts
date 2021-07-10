import chalk from "chalk";
import { readFileSync } from "fs";
import { join } from "path";
import { DNSPacket } from "../../../packet/packet";
import { Logger } from "../../../util/logger";
import { BaseInjection, BaseInjectionExecutionResult, BaseInjectionPhase } from "../base";

export enum EnsureDNSSECMode {
  CHANGE = 'change',
  BLOCK = 'block',
}

export interface EnsureDNSSECInjectionOptions {
  mode?: EnsureDNSSECMode;
  blockUnvalidatedDomains?: boolean;
  logActions?: boolean;
}

export class EnsureDNSSECRequestInjection extends BaseInjection {
  protected logger = new Logger({ prefix: 'DNSSEC BEFORE QUERY' });

  public readonly phase = BaseInjectionPhase.BEFORE_QUERY;

  constructor(protected readonly options: EnsureDNSSECInjectionOptions = {}) {
    super();

    if (!this.options.mode) {
      this.options.mode = EnsureDNSSECMode.CHANGE;
    }
  }

  public async needsExecution(query: DNSPacket): Promise<boolean> {
    return (
      query.isReply() === false &&
      query.headers.flags.authenticatedData === false
    )
  }

  public async onExecute(query: DNSPacket): Promise<BaseInjectionExecutionResult> {
    if (this.options.mode === EnsureDNSSECMode.BLOCK) {
      if (this.options.logActions) {
        this.logger.warn(chalk.bold.red('BLOCKED'), 'TID', query.getId(), 'because did not ask for', chalk.bold.green('DNSSEC'));
      }
      return {
        halt: true
      }
    }

    if (this.options.mode === EnsureDNSSECMode.CHANGE) {
      if (this.options.logActions) {
        this.logger.log(chalk.bold.yellow('CHANGED'), 'TID', query.getId(), 'to ensure asking for', chalk.bold.green('DNSSEC'));
      }

      query.enableAuthenticatedData();

      return {
        halt: false,
        query: query.getRaw(),
      }
    }

    return {};
  }
    
}