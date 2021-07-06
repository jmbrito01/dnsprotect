import { CommandLineFlagParameter, CommandLineParser } from "@rushstack/ts-command-line";
import { SetupCommandAction } from "./actions/setup";
import { StartCommandAction } from "./actions/start";

export class DNSProtectCLI extends CommandLineParser {
  private _verbose!: CommandLineFlagParameter;

  public constructor() {
    super({
      toolFilename: 'dnsprotect',
      toolDescription: 'Protect your network the easy way.'
    });

    this.addAction(new StartCommandAction());
    this.addAction(new SetupCommandAction());
  }

  public onDefineParameters(): void {
    this._verbose = this.defineFlagParameter({
      parameterLongName: '--verbose',
      parameterShortName: '-V',
      description: 'Show extra logging details'
    });
  }

  public async onExecute(): Promise<void> {
    return super.onExecute();
  }
}