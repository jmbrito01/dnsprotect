import { readFileSync } from "fs";
import { join } from "path";
import { DNSPacket } from "../../packet/packet";
import { Logger } from "../../util/logger";
import { BaseInjection, BaseInjectionExecutionResult, BaseInjectionPhase } from "./base";


export interface BlackListList {
  [key: string]: boolean;
}

export interface BlackListInjectionOptions {
  lists: string[];
}

export class DomainBlackListInjection extends BaseInjection {
  protected blackList: BlackListList = {};
  protected logger = new Logger({ prefix: 'BLACKLIST' });

  public readonly phase = BaseInjectionPhase.BEFORE_QUERY;

  constructor(protected readonly options: BlackListInjectionOptions) {
    super();

    this.loadLists();
  }

  private loadLists() {
    this.logger.info('Loading blacklists...');
    let count = 0;
    this.options.lists.forEach(list => {
      const rawList = readFileSync(join(process.cwd(), list))
      .toString()
      .split(' ');

      rawList.forEach(item => {
        this.blackList[item] = true;
        count++;
      });
    });

    this.logger.info(`Total of ${count} black listed domains loaded.`);
  }

  public async needsExecution(query: DNSPacket): Promise<boolean> {
    const questions = query.sections.questions;

    if (query.hasQuestions() && !query.isReply()) {
      const found = questions.filter(question => this.blackList[question.name] !== undefined);

      return found.length > 0;
    }
    return false;
  }

  public async onExecute(query: DNSPacket): Promise<BaseInjectionExecutionResult> {
    // If URL matched, always block it.
    return {
      halt: true,
    };
  }
    
}