import { CommandLineAction, CommandLineFlagParameter, CommandLineIntegerParameter, CommandLineStringParameter } from "@rushstack/ts-command-line";
import { writeFileSync } from "fs";
import { join } from "path";
import { DEFAULT_UDP_PORT, DNSUDPInterceptor, DNSUDPInterceptorInjections } from "../../interceptor/udp";
import { ConfigLoader } from "../../util/config-loader";
import { Logger } from "../../util/logger";
import inquirer, { Answers, Question } from 'inquirer';
import { DEFAULT_EMPTY_TTL_CACHE, RedisClientInjectionOptions } from "../../interceptor/injections/redis-cache";
import { DNSQueryMethod } from "../../query";
import { DNSOverrideMapper } from "../../interceptor/injections/dns-override";

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
      domainBlackList: false,
      redis: false,
      domainWhiteList: false,
      dnsOverride: false,
    }
    if (injections.indexOf('blackList') !== -1) {
      const lists: string[] = [];
      let response;
      do {
        response = await inquirer.prompt(BLACKLIST_SETUP);
        lists.push(response.list);
      } while (response.newList)

      injectionResult.domainBlackList = {
        lists,
      }
    }

    if (injections.indexOf('whiteList') !== -1) {
      if (injections.indexOf('blackList') !== -1) {
        this.logger.warn('Whitelist and Blacklist are ON. Thats not recommended and could cause conflicts if not properly set. Please consider what youre doing.');
      }
      const lists: string[] = [];
      let response;
      do {
        response = await inquirer.prompt(WHITELIST_SETUP);
        lists.push(response.list);
      } while (response.newList)

      injectionResult.domainWhiteList = {
        lists,
      }
    }

    if (injections.indexOf('redis') !== -1) {
      const response = await inquirer.prompt(REDIS_SETUP);
      injectionResult.redis = response as RedisClientInjectionOptions;
    }

    if (injections.indexOf('dnsOverride') !== -1) {
      const mappers: DNSOverrideMapper = {};
      let response;
      do {
        response = await inquirer.prompt(DNS_OVERRIDE_SETUP);
        mappers[response.domainName] = response.domainAddress;
      } while (response.newItem);

      injectionResult.dnsOverride = {
        mappers,
      }
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
      { value: 'blackList', name: 'Black List', checked: true },
      { value: 'whiteList', name: 'White List', checked: false },
      { value: 'redis', name: 'Redis Cache', checked: true },
      { value: 'dnsOverride', name: 'DNS Override', checked: true },
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

const WHITELIST_SETUP: inquirer.QuestionCollection[] = [
  {
    type: 'input',
    name: 'list',
    message: 'Type a new path for a whitelist:',
    prefix: '[WHITELIST]',
    validate(listName) {
      //TODO: Validate if this list is OK
      return true;
    },
  },
  {
    type: 'confirm',
    name: 'newList',
    message: 'Do you wish to add a new list?',
    prefix: '[WHITELIST]'
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

const DNS_OVERRIDE_SETUP: inquirer.QuestionCollection[] = [
  {
    type: 'input',
    name: 'domainName',
    message: 'Type the domain you wish to override:',
    prefix: '[DNS OVERRIDE]',
    suffix: '(e.g. google.com)',
  },
  {
    type: 'input',
    name: 'domainAddress',
    message: 'Type the address you wish to return:',
    prefix: '[DNS OVERRIDE]',
    suffix: '(e.g. 127.0.0.1)',
  },
  {
    type: 'confirm',
    name: 'newItem',
    message: 'Do you wish to add a new domain to override?',
    prefix: '[DNS OVERRIDE]',
    default: false,
  }
]