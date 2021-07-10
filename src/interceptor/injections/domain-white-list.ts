import { readFileSync } from "fs";
import { join } from "path";
import { DNSPacket } from "../../packet/packet";
import { Logger } from "../../util/logger";
import { BaseInjection, BaseInjectionExecutionResult, BaseInjectionPhase } from "./base";


export interface WhiteListList {
  [key: string]: boolean;
}

export interface WhiteListInjectionOptions {
  lists: string[];
}

export class DomainWhiteListInjection extends BaseInjection {
  protected WhiteList: WhiteListList = {};
  protected logger = new Logger({ prefix: 'WHITELIST' });

  public readonly phase = BaseInjectionPhase.BEFORE_QUERY;

  constructor(protected readonly options: WhiteListInjectionOptions) {
    super();

    this.loadLists();
  }

  private loadLists() {
    this.logger.info('Loading Whitelists...');
    let count = 0;
    this.options.lists.forEach(list => {
      const rawList = readFileSync(join(process.cwd(), list))
      .toString()
      .split(' ');

      rawList.forEach(item => {
        this.WhiteList[item] = true;
        count++;
      });
    });

    this.logger.info(`Total of ${count} Whitelisted domains loaded.`);
  }

  public async needsExecution(query: DNSPacket): Promise<boolean> {
    const questions = query.sections.questions;

    if (query.hasQuestions() && !query.isReply()) {
      const found = questions.filter(question => this.WhiteList[question.name] !== undefined);
      // If not explicitly whitelisted, we should halt
      return found.length === 0;
    }
    return true;
  }

  public async onExecute(): Promise<BaseInjectionExecutionResult> {
    // If URL matched, always block it.
    return {
      halt: true,
    };
  }
    
}