import chalk, { gray, red } from 'chalk';
export interface LoggerOptions {
  prefix?: string;
}

export class Logger {
  constructor(private readonly options: LoggerOptions) {}

  public info(...args: any[]): void {
    const formatted = this.formatInput(chalk.bold('INFO:'), ...this.formatInputTypes(args));

    console.info(...formatted);
  }

  public error(...args: any[]): void {
    const formatted = this.formatInput(chalk.red(chalk.bold('ERROR:'), ...this.formatInputTypes(args)));

    console.error(...formatted);
  }

  public log(...args: any[]): void {
    const formatted = this.formatInput(chalk.bold('LOG:'), chalk.gray(...this.formatInputTypes(args)));

    if (process.env.LOG_LEVEL === 'debug') {
      console.log(...formatted); 
    }
  }

  private formatInput(...args: any[]): any[] {
    let newArgs = args;
    if (this.options.prefix) {
      newArgs = [chalk.blue(`[${this.options.prefix}]`), ...args]
    }

    return newArgs;
  }

  private formatInputTypes(args: any[]) {
    let newArgs = args.map(arg => {
      if (typeof arg === 'number') {
        return `${chalk.yellow(arg.toString())}`;
      }

      return arg;
    });

    return newArgs;
  }
}