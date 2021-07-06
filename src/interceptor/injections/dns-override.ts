import { Logger } from "../../util/logger";
import { BaseInjection, BaseInjectionExecutionResult, BaseInjectionPhase } from "./base";


export interface DNSOverrideMapper {
  [key: string]: {
    address: string;
  };
}

export interface DNSOverrideInjectionOptions {
  mappers: DNSOverrideMapper;
}

export class DNSOverrideInjection extends BaseInjection {
  protected logger = new Logger({ prefix: 'DNS OVERRIDE' });

  public readonly phase = BaseInjectionPhase.BEFORE_RESPONSE;

  constructor(protected readonly options: DNSOverrideInjectionOptions) {
    super();

    this.logger.log(`Number of DNS overrides loaded:`, Object.keys(this.options.mappers).length);
  }

  public async needsExecution(query: any, response: any): Promise<boolean> {
    const questions = response.question || [];

    if (response && questions instanceof Array && questions.length > 0) {
      const found = questions.filter(answer => this.options.mappers[answer.name] !== undefined);

      return found.length > 0;
    }

    return false;
  }

  public async onExecute(query: any, response: any): Promise<BaseInjectionExecutionResult> {
    // If DNS found on mapping, lets change the result address
    const answers: any[] = response.answer || [];
    const newResponse = Object.assign({}, response);

    newResponse.answer = answers
      .filter(answer => this.options.mappers[answer.name] !== undefined)
      .map(answer => {
        const mapper = this.options.mappers[answer.name];
        if (mapper) {
          const newAnswer = Object.assign({}, answer);
          newAnswer.address = mapper.address;
          return newAnswer;
        }

        return answer;
      });

    newResponse.answer = newResponse.answer.slice(0, 1);

    return {
      halt: false,
      response: newResponse,
    };
}
    
}