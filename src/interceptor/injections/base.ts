//@ts-ignore
import Packet from 'native-dns-packet';
import { MAX_UDP_PACKET_SIZE } from '../udp';

export enum BaseInjectionPhase {
  BEFORE_QUERY = 'before-query',
  BEFORE_RESPONSE = 'before-response',
  AFTER_RESPONSE = 'after-response',
}

export interface BaseInjectionExecutionResult {
  halt?: boolean;
  response?: Buffer;
}

export abstract class BaseInjection {
  public readonly abstract phase: BaseInjectionPhase;

  public abstract needsExecution(query: any, result?: any): Promise<boolean>;

  public abstract onExecute(query: any, result?: any): Promise<BaseInjectionExecutionResult>;

  public static async executeInjections(injections: BaseInjection[], query: Uint8Array, phase: BaseInjectionPhase, result?: Uint8Array): Promise<BaseInjectionExecutionResult> {
    if (injections.length === 0) {
      return {
        halt: false,
      }
    }

    const request = Packet.parse(query);

    if (phase === BaseInjectionPhase.BEFORE_QUERY) {
      const promises = injections
        .filter(injection => injection.phase === BaseInjectionPhase.BEFORE_QUERY)
        .map(async injection => {
          const needsExecution = await injection.needsExecution(request);

          if (needsExecution) {
            return injection.onExecute(request, result);
          }

          return {
            halt: false
          };
        });
  
      const response = await Promise.all(promises);

      return {
        halt: response.find(each => each.halt) !== undefined,
        response: response.find(each => each.response)?.response,
      }
    } else if (phase === BaseInjectionPhase.BEFORE_RESPONSE) {
      if (!result) {
        throw new Error('Cant execute injections after query with no result');
      }
      let response = Packet.parse(result);

      const promises = injections
        .filter(injection => injection.phase === BaseInjectionPhase.BEFORE_RESPONSE)
        .map(async injection => {
          return {
            needsExecution: await injection.needsExecution(request, response),
            execute: injection.onExecute.bind(this, request, response),
          }
        });
      
      const ijs = (await Promise.all(promises)).filter(injection => injection.needsExecution);

      for (let injection of ijs) {
        const injectionResult = await injection.execute();
        if (!injectionResult) return {
          halt: true,
        }

        response = injectionResult;
      }

      const buffer = Buffer.alloc(MAX_UDP_PACKET_SIZE);
      Packet.write(buffer, response);
      return {
        halt: false,
        response: buffer,
      }
    } else if (phase === BaseInjectionPhase.AFTER_RESPONSE) {
      let response = Packet.parse(result);
      const promises = injections
        .filter(injection => injection.phase === BaseInjectionPhase.AFTER_RESPONSE)
        .map(async injection => {
          const needsExecution = await injection.needsExecution(request, response);

          if (needsExecution) {
            return injection.onExecute(request, response);
          }

          return {
            halt: false,
          }
        });
  
      await Promise.all(promises);

      return {
        halt: false,
      }
    }
    
    throw new Error('Cant execute injections! Invalid execution phase: ' + phase);
  }
}