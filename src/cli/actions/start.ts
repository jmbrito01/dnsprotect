import { CommandLineAction, CommandLineFlagParameter, CommandLineIntegerParameter, CommandLineStringParameter } from "@rushstack/ts-command-line";
import { DEFAULT_UDP_PORT, DNSUDPInterceptor } from "../../interceptor/udp";
import { ConfigLoader } from "../../util/config-loader";

export class StartCommandAction extends CommandLineAction {
  private _config!: CommandLineStringParameter;

  constructor() {
    super({
      actionName: 'start',
      summary: 'Starts a new DNSProtect Server',
      documentation: 'This is the action to create the dns server which will proxy all queries'
    });
  }

  public async onExecute(): Promise<void> {
    const config = ConfigLoader.initialize({
      fileName: this._config.value,
    });

    const server = new DNSUDPInterceptor(config.getFull());

    await server.bind();
  }

  public onDefineParameters(): void {
    this._config = this.defineStringParameter({
      parameterLongName: '--config',
      parameterShortName: '-c',
      description: 'Path to the configuration file',
      required: false,
      argumentName: 'CONFIG',
    });
  }
}