import chalk from 'chalk';
export interface LoggerOptions {
  prefix?: string;
}

export class Logger {
  constructor(private readonly options: LoggerOptions) {}

  public info(...args: any[]): void {
    const formatted = this.formatInput(chalk.bold('INFO:'), chalk.white(...this.formatInputTypes(args)));

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

  public warn(...args: any[]): void {
    const formatted = this.formatInput(chalk.bold('WARN:'), chalk.dim.yellow(...this.formatInputTypes(args)));
    
    console.warn(...formatted); 
  }

  private formatInput(...args: any[]): any[] {
    let newArgs = args;
    if (this.options.prefix) {
      newArgs = [chalk.gray(`[${new Date().toISOString()}]`), chalk.blue(`[${this.options.prefix}]`), ...args]
    }

    return newArgs;
  }

  private formatInputTypes(args: any[]) {
    let newArgs = args.map(arg => {
      if (typeof arg === 'number') {
        return `${chalk.yellow(arg.toString())}`;
      }
      
      if (typeof arg === 'object') {
        return `\n${chalk.bgWhite.black(JSON.stringify(arg, undefined, 2))}`
      }

      return arg;
    });

    return newArgs;
  }
}