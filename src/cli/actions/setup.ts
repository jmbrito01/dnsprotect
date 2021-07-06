import { CommandLineAction, CommandLineFlagParameter, CommandLineIntegerParameter, CommandLineStringParameter } from "@rushstack/ts-command-line";
import { writeFileSync } from "fs";
import { join } from "path";
import { DEFAULT_UDP_PORT, DNSUDPInterceptor, DNSUDPInterceptorInjections } from "../../interceptor/udp";
import { ConfigLoader } from "../../util/config-loader";
import { Logger } from "../../util/logger";
import inquirer, { Answers, Question } from 'inquirer';
import { DEFAULT_EMPTY_TTL_CACHE, RedisClientInjectionOptions } from "../../interceptor/injections/redis-cache";
import { DNSQueryMethod } from "../../query";

export class SetupCommandAction extends CommandLineAction {
  private outputFile!: CommandLineStringParameter;
  protected logger = new Logger({ prefix: 'SETUP ACTION' })
  constructor() {
    super({
      actionName: 'setup',
      summary: 'Generates a new configuration for dnsprotect',
      documentation: 'This action generates a new json with configurations for dnsprotect'
    });
  }

  public async onExecute(): Promise<void> {
    if (!this.outputFile.value) {
      throw new Error('Output file must be set for setup action');
    }

    this.logger.info('Starting to generate configuration file...');
    const config = ConfigLoader.initialize({});
    this.logger.info("Let's start asking you some question...");
    let answers = await inquirer.prompt(INQUIRER_QUESTIONS);
    
    answers.injections = await this.setupInjections(answers.injections);

    // TODO: Create a command-line checkbox option to go easy

    writeFileSync(this.outputFile.value, JSON.stringify(answers, undefined, 2));
    this.logger.info('Configuration file was generated at:', join(process.cwd(), this.outputFile.value));
  }

  public onDefineParameters(): void {
    this.outputFile = this.defineStringParameter({
      parameterLongName: '--output',
      parameterShortName: '-o',
      description: 'File path for the new configuration file',
      required: true,
      argumentName: 'CONFIG',
    });
  }

  private async setupInjections(injections: string[]): Promise<DNSUDPInterceptorInjections> {
    const injectionResult: DNSUDPInterceptorInjections = {
      blackList: false,
      redis: false,
    }
    if (injections.indexOf('blackList') !== -1) {
      const lists: string[] = [];
      let response;
      do {
        response = await inquirer.prompt(BLACKLIST_SETUP);
        lists.push(response.list);
      } while (response.newList)

      injectionResult.blackList = {
        lists,
      }
    }
    if (injections.indexOf('redis') !== -1) {
      const response = await inquirer.prompt(REDIS_SETUP);
      injectionResult.redis = response as RedisClientInjectionOptions;
    }
    return injectionResult;
  }
}

const INQUIRER_QUESTIONS: inquirer.QuestionCollection[] = [
  {
    type: 'input',
    name: 'forwardServer',
    message: 'DNS Server to forward all queries to (Defaults to CloudFlare DNS):',
    default: '1.0.0.1',
  },
  {
    type: 'number',
    name: 'forwardRetries',
    message: 'How many times should we try to get a query before failing?',
    default: 1,
  },
  {
    type: 'number',
    name: 'port',
    message: 'Which port dnsprotect should use?',
    default: 53,
  },
  {
    type: 'list',
    name: 'queryMethod',
    message: 'Which DNS query method should be used?',
    choices: [
      { value: DNSQueryMethod.DNS_OVER_HTTPS, name: 'DNS over HTTPS (Default)' },
      { value: DNSQueryMethod.DNS_OVER_TLS, name: 'DNS over TLS' },
    ],
    default: DNSQueryMethod.DNS_OVER_HTTPS,
  },
  {
    type: 'checkbox',
    name: 'injections',
    message: 'Which injections do you wish to enable?',
    choices: [
      { value: { doh: true }, name: 'Force DNS-over-HTTPS', disabled: 'Always ON', checked: true },
      { value: 'blackList', name: 'Black List', checked: true },
      { value: 'redis', name: 'Redis Cache', checked: true },
    ]
  }
]

const BLACKLIST_SETUP: inquirer.QuestionCollection[] = [
  {
    type: 'input',
    name: 'list',
    message: 'Type a new path for a blacklist:',
    prefix: '[BLACKLIST]',
    validate(listName) {
      //TODO: Validate if this list is OK
      return true;
    },
  },
  {
    type: 'confirm',
    name: 'newList',
    message: 'Do you wish to add a new list?',
    prefix: '[BLACKLIST]'
  }
]

const REDIS_SETUP: inquirer.QuestionCollection[] = [
  {
    type: 'input',
    name: 'url',
    message: 'Type the redis URL to use:',
    prefix: '[REDIS]',
    default: 'redis://localhost:6379'
  },
  {
    type: 'confirm',
    name: 'cacheEmptyResults',
    message: 'Do you wish to cache empty dns query results?',
    default: false,
    prefix: '[REDIS]'
  },
  {
    type: 'number',
    name: 'cachedEmptyResultsTTL',
    message: 'How many time(in seconds) empty results should be cached?',
    default: DEFAULT_EMPTY_TTL_CACHE,
    prefix: '[REDIS]',
    when: (answers: Answers) => answers.cacheEmptyResults,
  }
]