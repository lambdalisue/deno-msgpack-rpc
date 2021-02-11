import { decodeStream, encode } from "https://deno.land/x/msgpack@v1.2/mod.ts";
import {
  Deferred,
  deferred,
} from "https://deno.land/x/std@0.86.0/async/deferred.ts";
import * as message from "./message.ts";

const MSGID_THRESHOLD = 2 ** 32;

/**
 * Method dispatcher
 */
export interface Dispatcher {
  [key: string]: (this: Session, ...args: unknown[]) => Promise<unknown>;
}

/**
 * MessagePack-RPC Session
 */
export class Session {
  #counter: number;
  #replies: { [key: number]: Deferred<message.ResponseMessage> };
  #reader: Deno.Reader & Deno.Closer;
  #writer: Deno.Writer;
  #dispatcher: Dispatcher;

  constructor(
    reader: Deno.Reader & Deno.Closer,
    writer: Deno.Writer,
    dispatcher: Dispatcher = {},
  ) {
    this.#counter = -1;
    this.#replies = {};
    this.#reader = reader;
    this.#writer = writer;
    this.#dispatcher = dispatcher;
  }

  protected getOrCreateReply(
    msgid: message.MessageId,
  ): Deferred<message.ResponseMessage> {
    this.#replies[msgid] = this.#replies[msgid] || deferred();
    return this.#replies[msgid];
  }

  private getNextIndex(): number {
    this.#counter += 1;
    if (this.#counter >= MSGID_THRESHOLD) {
      this.#counter = 0;
    }
    return this.#counter;
  }

  private async send(data: Uint8Array): Promise<void> {
    while (true) {
      const n = await this.#writer.write(data);
      if (n === data.byteLength) {
        break;
      }
      data = data.slice(n);
    }
  }

  private async dispatch(
    method: string,
    ...params: unknown[]
  ): Promise<unknown> {
    return await this.#dispatcher[method].apply(this, params);
  }

  private async handleRequest(request: message.RequestMessage): Promise<void> {
    const [_, msgid, method, params] = request;
    const [result, error] = await (async () => {
      let result: message.MessageResult = null;
      let error: message.MessageError = null;
      try {
        result = await this.dispatch(method, ...params);
      } catch (e) {
        error = e;
      }
      return [result, error];
    })();
    const response: message.ResponseMessage = [1, msgid, error, result];
    await this.#writer.write(encode(response));
  }

  private async handleNotification(
    notification: message.NotificationMessage,
  ): Promise<void> {
    const [_, method, params] = notification;
    try {
      await this.dispatch(method, ...params);
    } catch (error) {
      console.error(error);
    }
  }

  /**
   * Listen messages and handle request/response/notification.
   * This method must be called to start session.
   */
  async listen(): Promise<void> {
    const stream = Deno.iter(this.#reader);
    try {
      for await (const data of decodeStream(stream)) {
        if (message.isRequestMessage(data)) {
          this.handleRequest(data);
        } else if (message.isResponseMessage(data)) {
          const reply = this.getOrCreateReply(data[1]);
          reply.resolve(data);
        } else if (message.isNotificationMessage(data)) {
          this.handleNotification(data);
        } else {
          console.warn(`Unexpected data received: ${data}`);
          continue;
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
  async call(method: string, ...params: unknown[]): Promise<unknown> {
    const msgid = this.getNextIndex();
    const data: message.RequestMessage = [0, msgid, method, params];
    await this.send(encode(data));
    const [_1, _2, error, result] = await this.getOrCreateReply(msgid);
    delete this.#replies[msgid];
    if (error) {
      throw new Error(
        `Failed to call '${method}' with ${JSON.stringify(params)}: ${error}`,
      );
    }
    return result;
  }

  /**
   * Notify a method with params and return a Promise which resolves when the message has sent.
   */
  async notify(method: string, ...params: unknown[]): Promise<void> {
    const data: message.NotificationMessage = [2, method, params];
    await this.send(encode(data));
  }
}
