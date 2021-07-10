import { DNSPacket } from '../../packet/packet';
import { MAX_UDP_PACKET_SIZE } from '../interceptor';

export enum BaseInjectionPhase {
  BEFORE_QUERY = 'before-query',
  BEFORE_RESPONSE = 'before-response',
  AFTER_RESPONSE = 'after-response',
}

export interface BaseInjectionExecutionResult {
  halt?: boolean;
  query?: Buffer;
  response?: Buffer;
}

export abstract class BaseInjection {
  public readonly abstract phase: BaseInjectionPhase;

  public abstract needsExecution(query: DNSPacket, result?: DNSPacket): Promise<boolean>;

  public abstract onExecute(query: DNSPacket, result?: DNSPacket): Promise<BaseInjectionExecutionResult>;

  public static async executeInjections(injections: BaseInjection[], query: Uint8Array, phase: BaseInjectionPhase, result?: Uint8Array): Promise<BaseInjectionExecutionResult> {
    if (injections.length === 0) {
      return {
        halt: false,
      }
    }

    const request = new DNSPacket(query);
    if (phase === BaseInjectionPhase.BEFORE_QUERY) {
      const promises = injections
        .filter(injection => injection.phase === BaseInjectionPhase.BEFORE_QUERY)
        .map(async injection => {
          const needsExecution = await injection.needsExecution(request);

          if (needsExecution) {
            return injection.onExecute(request);
          }

          return {
            halt: false
          };
        });
  
      const response = await Promise.all(promises);

      return {
        halt: response.find(each => each.halt) !== undefined,
        response: response.find(each => each.response)?.response,
        query: response.find(each => each.query)?.query,
      }
    } else if (phase === BaseInjectionPhase.BEFORE_RESPONSE) {
      if (!result) {
        throw new Error('Cant execute injections after query with no result');
      }
      const response = new DNSPacket(result);
      let injectionResponse: BaseInjectionExecutionResult = {
        halt: false,
      };

      const promises = injections
        .filter(injection => injection.phase === BaseInjectionPhase.BEFORE_RESPONSE)
        .map(async injection => {
          return {
            needsExecution: await injection.needsExecution(request, response),
            execute: injection.onExecute.bind(injection, request, response),
          }
        });
      
      const ijs = (await Promise.all(promises)).filter(injection => injection.needsExecution);

      for (let injection of ijs) {
        const injectionResult = await injection.execute();
        if (!injectionResult) return {
          halt: true,
        }

        injectionResponse = injectionResult;
      }

      if (injectionResponse.response) {
        return {
          halt: false,
          response: injectionResponse.response,
        }  
      } else {
        return {
          halt: false
        }
      }
      
    } else if (phase === BaseInjectionPhase.AFTER_RESPONSE && result) {
      let response = new DNSPacket(result);
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