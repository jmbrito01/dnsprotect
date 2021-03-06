import { CommandLineAction, CommandLineStringParameter } from "@rushstack/ts-command-line";
import { writeFileSync } from "fs";
import { join } from "path";
import { DNSUDPInterceptorInjections } from "../../interceptor/interceptor";
import { ConfigLoader } from "../../util/config-loader";
import { Logger } from "../../util/logger";
import inquirer, { Answers, Question } from 'inquirer';
import { DEFAULT_EMPTY_TTL_CACHE, RedisClientInjectionOptions } from "../../interceptor/injections/redis-cache";
import { DNSQueryMethod } from "../../query/query";
import { DNSOverrideMapper } from "../../interceptor/injections/dns-override";
import { LoadBalancingStrategy } from "../../util/load-balancing";
import { EnsureDNSSECMode } from "../../interceptor/injections/dnssec/ensure-dnssec-request";

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

    if (answers.forwardServersCustom) {
      answers.forwardServers = [
        ...answers.forwardServers.filter((each: string) => each !== 'other'),
        ...answers.forwardServersCustom.split(','),
      ]

    }
    
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

    if (injections.indexOf('ensureDnssec') !== -1) {
      const result = await inquirer.prompt(DNSSEC_SETUP);

      injectionResult.ensureDnssec = result;
    }

    return injectionResult;
  }
}

const INQUIRER_QUESTIONS: inquirer.QuestionCollection[] = [
  {
    type: 'checkbox',
    name: 'forwardServers',
    message: 'DNS Servers to forward all queries to:',
    choices: [
      { value: '1.1.1.1', name: 'CloudFlare DNS(1.1.1.1)' },
      { value: '1.0.0.1', name: 'Cloudflare DNS(1.0.0.1)' },
      { value: '8.8.8.8', name: 'Google DNS(8.8.8.8)'},
      { value: 'other', name: 'Other' }
    ],
    validate(input) {
      if (input.length === 0) {
        return `It's required to select at least one forward server`
      }

      return true;
    }
  },
  {
    type: 'input',
    name: 'forwardServersCustom',
    message: 'Enter your custom forward servers(comma separated):',
    when: (values) => values.forwardServers.indexOf('other') !== -1,
  },
  {
    type: 'list',
    name: 'loadBalancingStrategy',
    message: 'Which load balancing strategy should we use with the forward servers?',
    choices: [
      { value: LoadBalancingStrategy.RANDOM_BALANCE, name: 'Random Balance (Default)' },
      { value: LoadBalancingStrategy.ROUND_ROBIN, name: 'Round Robin' },
    ],
    when(answers) {
      return (
        answers.forwardServers.length > 1 || 
        ( answers.forwardServersCustom && answers.forwardServersCustom.split(',').length > 1  )
      );
    }
  },
  {
    type: 'number',
    name: 'forwardRetries',
    message: 'How many times should we try to get a query before failing?',
    default: 1,
    validate(input) {
      if (input == 0) {
        return 'The minimum allowed value is 1';
      }
      return true;
    }
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
      { value: 'ensureDnssec', name: 'Ensure DNSSEC', checked: true},
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

const DNSSEC_SETUP: inquirer.QuestionCollection[] = [
  {
    type: 'list',
    name: 'mode',
    message: 'Which injection mode do you wish to enable:',
    prefix: '[DNSSEC]',
    choices: [
      { name: 'Change - DEFAULT (If DNSSEC is not asked, change the packet to ask it)', value: EnsureDNSSECMode.CHANGE },
      { name: 'Block (If DNSSEC is not asked, block the request)', value: EnsureDNSSECMode.BLOCK }
    ],
    default: EnsureDNSSECMode.CHANGE,
  },
  {
    type: 'confirm',
    name: 'logActions',
    message: 'Do you wish that DNSSEC injection log everything it is doing?',
    prefix: '[DNSSEC]',
    default: true,
  },
  {
    type: 'confirm',
    name: 'blockUnvalidatedDomains',
    message: 'Do you wish to block all responses that dont use DNSSEC? This will protect you but most websites still dont use DNSSEC so you will have many problems surfing the open web.',
    prefix: '[DNSSEC]',
    default: false,
  }
]