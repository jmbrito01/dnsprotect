
export interface LoggerOptions {
  prefix?: string;
}

export class Logger {
  constructor(private readonly options: LoggerOptions) {}

  public info(...args: any[]): void {
    const formatted = this.formatInput(...args);

    console.info(...formatted);
  }

  public error(...args: any[]): void {
    const formatted = this.formatInput(...args);

    console.error(...formatted);
  }

  public log(...args: any[]): void {
    const formatted = this.formatInput(...args);

    if (process.env.LOG_LEVEL === 'debug') {
      console.log(...formatted);
    }
  }

  private formatInput(...args: any[]): any[] {
    let newArgs = args;
    if (this.options.prefix) {
      newArgs = [`[${this.options.prefix}]`,...args]
    }

    return newArgs;
  }
}