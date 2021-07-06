import { readFileSync } from "fs";
import { join } from "path";
import { Logger } from "../../util/logger";
import { BaseInjection, BaseInjectionExecutionResult, BaseInjectionPhase } from "./base";


export interface DNSMap {
  [key: string]: string;
}

export interface DNSOverrideInjectionOptions {
  dnsMap: DNSMap;
}

export class DNSOverrideInjection extends BaseInjection {
  protected blackList: DNSMap = {};
  protected logger = new Logger({ prefix: 'DNS OVERRIDE' });

  public readonly phase = BaseInjectionPhase.BEFORE_RESPONSE;

  constructor(protected readonly options: DNSOverrideInjectionOptions) {
    super();
  }

  public async needsExecution(query: any): Promise<boolean> {
    const answers = query.answers;

    if (answers instanceof Array && answers.length > 0) {
      const found = answers.filter(answer => this.options.dnsMap[answer.name] !== undefined);

      return found.length === 0;
    }

    return true;
  }

  public async onExecute(query: any): Promise<BaseInjectionExecutionResult> {
    // If URL matched, always block it.
    return {
      halt: false,
    };
  }
    
}