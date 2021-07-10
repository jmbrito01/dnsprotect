import { DNSPacket } from "../../packet/packet";
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

    this.logger.info(`Number of DNS overrides loaded:`, Object.keys(this.options.mappers).length);
  }

  public async needsExecution(query: DNSPacket, response: DNSPacket): Promise<boolean> {
    if (response && response.isReply() && response.hasQuestions()) {
      const questions = response.sections.questions;
      const found = questions.filter(answer => this.options.mappers[answer.name] !== undefined);

      return found.length > 0;
    }

    return false;
  }

  public async onExecute(query: DNSPacket, response: DNSPacket): Promise<BaseInjectionExecutionResult> {
    // If DNS found on mapping, lets change the result address
    const answers: any[] = response.sections.answers;
    const newResponse = Object.assign({}, response);

    newResponse.sections.answers = answers
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

    newResponse.sections.answers = newResponse.sections.answers.slice(0, 1);

    return {
      halt: false,
      response: newResponse.getRaw(),
    };
}
    
}