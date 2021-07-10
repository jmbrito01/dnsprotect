import chalk from "chalk";
import { DNSPacket } from "../../../packet/packet";
import { Logger } from "../../../util/logger";
import { BaseInjection, BaseInjectionExecutionResult, BaseInjectionPhase } from "../base";
import { EnsureDNSSECInjectionOptions } from "./ensure-dnssec-request";

export enum EnsureDNSSECMode {
  CHANGE = 'change',
  BLOCK = 'block',
}

export class BlockDNSSECUnsafeResponseInjection extends BaseInjection {
  protected logger = new Logger({ prefix: 'DNSSEC BEFORE RESPONSE' });

  public readonly phase = BaseInjectionPhase.BEFORE_RESPONSE;

  constructor(protected readonly options: EnsureDNSSECInjectionOptions = {}) {
    super();

    if (!this.options.mode) {
      this.options.mode = EnsureDNSSECMode.CHANGE;
    }
  }

  public async needsExecution(query: DNSPacket, response: DNSPacket): Promise<boolean> {
    const needsExecution = (
      response.isReply() === true &&
      response.headers.flags.authenticatedData === false
    );

    if (!needsExecution && this.options.logActions) {
      this.logger.log(chalk.bold.white('DNSSEC'), chalk.bold.green('OK'), 'for TID', query.getId());
    }

    return needsExecution;
  }

  public async onExecute(query: DNSPacket, response: DNSPacket): Promise<BaseInjectionExecutionResult> {
    if (this.options.mode === EnsureDNSSECMode.BLOCK && this.options.blockUnvalidatedDomains) {
      if (this.options.logActions) {
        this.logger.warn(chalk.bold.red('BLOCKED'), 'TID', query.getId(), 'because did not answer with DNSSEC');
      }
      return {
        halt: true
      }
    }

    // TODO: If did not respond, try to check it manually.

    return {};
  }
    
}