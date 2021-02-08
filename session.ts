import { encode, decodeStream } from "https://deno.land/x/msgpack@v1.2/mod.ts";
import {
  Deferred,
  deferred,
} from "https://deno.land/x/std@0.86.0/async/deferred.ts";
import {
  encode as encodeMessage,
  decode as decodeMessage,
  Request,
  Response,
  Notification,
} from "./message.ts";

const MSGID_THRESHOLD = 2 ** 32;

/**
 * Method dispatcher
 */
export interface Dispatcher {
  [key: string]: (this: Session, ...args: any) => Promise<any>;
}

/**
 * MessagePack-RPC Session
 */
export class Session {
  private counter: number;
  private replies: { [key: number]: Deferred<Response> };

  /**
   * Constructor
   */
  constructor(
    private transport: Deno.Reader & Deno.Writer,
    private dispatcher: Dispatcher = {}
  ) {
    this.counter = -1;
    this.replies = {};
  }

  protected get_or_create_reply(msgid: number): Deferred<Response> {
    this.replies[msgid] = this.replies[msgid] || deferred();
    return this.replies[msgid];
  }

  private get_next_index(): number {
    this.counter += 1;
    if (this.counter >= MSGID_THRESHOLD) {
      this.counter = 0;
    }
    return this.counter;
  }

  private async send(data: Uint8Array): Promise<void> {
    while (true) {
      const n = await this.transport.write(data);
      if (n === data.byteLength) {
        break;
      }
      data = data.slice(n);
    }
  }

  private async dispatch(method: string, ...params: any): Promise<any> {
    return await this.dispatcher[method].apply(this, params);
  }

  private async handle_request(
    transport: Deno.Reader & Deno.Writer,
    request: Request
  ): Promise<void> {
    try {
      await transport.write(
        encode(
          encodeMessage({
            type: 1,
            msgid: request.msgid,
            result: await this.dispatch(request.method, ...request.params),
          })
        )
      );
    } catch (error) {
      console.error(error);
      await transport.write(
        encode(
          encodeMessage({
            type: 1,
            msgid: request.msgid,
            error,
          })
        )
      );
    }
  }

  private async handle_notification(request: Notification): Promise<void> {
    try {
      await this.dispatch(request.method, request.params);
    } catch (error) {
      console.error(error);
    }
  }

  /**
   * Listen messages and handle request/response/notification.
   * This method must be called to start session.
   */
  async listen(): Promise<void> {
    const stream = Deno.iter(this.transport);
    try {
      for await (const data of decodeStream(stream)) {
        if (!Array.isArray(data)) {
          console.warn(`Unexpected data received: ${data}`);
          continue;
        }
        const message = decodeMessage(data);
        switch (message.type) {
          case 0:
            this.handle_request(this.transport, message);
            break;
          case 1:
            const reply = this.get_or_create_reply(message.msgid);
            reply.resolve(message);
            break;
          case 2:
            this.handle_notification(message);
            break;
        }
      }
    } catch (e) {
      // https://github.com/denoland/deno/issues/5194#issuecomment-631987928
      if (e instanceof Deno.errors.BadResource) {
        return;
      }
      throw e;
    }
  }

  /**
   * Call a method with params and return a Promise which resolves when a response message
   * has received and to the result value of the method.
   */
  async call(method: string, ...params: any): Promise<any> {
    const msgid = this.get_next_index();
    const m: Request = {
      type: 0,
      msgid,
      method,
      params,
    };
    await this.send(encode(encodeMessage(m)));
    const response = await this.get_or_create_reply(msgid);
    delete this.replies[msgid];
    if (response.error) {
      return Promise.reject(response.error);
    }
    return response.result;
  }

  /**
   * Notify a method with params and return a Promise which resolves when the message has sent.
   */
  async notify(method: string, ...params: any): Promise<void> {
    const m: Notification = {
      type: 2,
      method,
      params,
    };
    await this.send(encode(encodeMessage(m)));
  }
}
