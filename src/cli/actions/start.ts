import { CommandLineAction, CommandLineFlagParameter, CommandLineIntegerParameter, CommandLineStringParameter } from "@rushstack/ts-command-line";
import { DEFAULT_UDP_PORT, DNSUDPInterceptor } from "../../interceptor/interceptor";
import { ConfigLoader } from "../../util/config-loader";
import cluster, { Worker } from 'cluster';
import os from 'os';
import { Logger } from "../../util/logger";
export class StartCommandAction extends CommandLineAction {
  private _config!: CommandLineStringParameter;
  private _workerCount!: CommandLineIntegerParameter;
  private readonly workers: Map<number, Worker> = new Map();
  private server!: DNSUDPInterceptor;
  private isExiting: boolean = false;

  protected logger = new Logger({ prefix: 'START ACTION' });

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

    if (cluster.isMaster && this._workerCount.value && this._workerCount.value > 1) {
      this.logger.info('Starting master process:', process.pid);

      process.on('SIGINT', () => this.onMasterRequestToExit());
      cluster.on('exit', (worker, code, signal) => this.onWorkerExit(worker, code, signal));

      if (!this._workerCount.value) {
        throw new Error('Required workerCount to start');
      }
      for (let i = 0;i < this._workerCount.value;i++) {
        this.createWorkerProcess();
      }

    } else {
      this.logger.info('Starting worker process:', process.pid);
      this.server = new DNSUDPInterceptor(config.getFull());
      await this.server.bind();

      process.on('message', msg => this.onWorkerMessage(msg));
    }
  }

  public onDefineParameters(): void {
    this._config = this.defineStringParameter({
      parameterLongName: '--config',
      parameterShortName: '-c',
      description: 'Path to the configuration file',
      required: false,
      argumentName: 'CONFIG',
    });

    this._workerCount = this.defineIntegerParameter({
      parameterLongName: '--worker-count',
      parameterShortName: '-w',
      description: 'Number of process workers to be run',
      argumentName: 'WORKER_COUNT',
      defaultValue: os.cpus().length,
    })
  }

  private onMasterRequestToExit(): void {
    this.isExiting = true;

    this.workers.forEach((worker) => {
      this.logger.info('Sending exit command to worker', worker.process.pid);
      worker.send({cmd: 'STOP'});
    });
  }

  private onWorkerExit(worker: Worker, code: number, signal: string): void {
    this.logger.info('Worker', worker.process.pid, 'died with',  signal);
    this.workers.delete(worker.id);
    if (this._workerCount.value && this._workerCount.value > this.workers.size && !this.isExiting && code !== 1) {
      const delta = this._workerCount.value - this.workers.size;
      this.logger.info('Worker count is below minimum(', this._workerCount.value, ') creating', delta, 'more.');
      this.createWorkerProcess();
    } else if (this.workers.size === 0) {
      // No more workers, time to exit master
      this.logger.info('No more workers running, exiting main process...');
      process.exit(0);
    }
  }

  private async onWorkerMessage(msg: any): Promise<void> {
    if (msg.cmd === 'STOP') {
      this.logger.info('Worker', process.pid, 'is stopping because master process requested.');
      await this.server.unbind();
      process.exit(1);
    }
  }

  private createWorkerProcess(): void {
    this.logger.info('Creating new worker process');
    const worker = cluster.fork();
    this.workers.set(worker.id, worker);
  }
}