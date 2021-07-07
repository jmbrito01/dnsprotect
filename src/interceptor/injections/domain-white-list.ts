import { readFileSync } from "fs";
import { join } from "path";
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

  public async needsExecution(query: any): Promise<boolean> {
    const questions = query.question;

    if (questions instanceof Array && questions.length > 0) {
      const found = questions.filter(question => this.WhiteList[question.name] !== undefined);
      // If not explicitly whitelisted, we should halt
      return found.length === 0;
    }
    return true;
  }

  public async onExecute(query: any): Promise<BaseInjectionExecutionResult> {
    // If URL matched, always block it.
    return {
      halt: true,
    };
  }
    
}