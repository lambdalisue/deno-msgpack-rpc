import { decodeStream, Deferred, deferred, encode, io } from "./deps.ts";
import * as message from "./message.ts";

const MSGID_THRESHOLD = 2 ** 32;

/**
 * Method dispatcher
 */
export interface Dispatcher {
  [key: string]: (this: Session, ...args: unknown[]) => Promise<unknown>;
}

/**
 * Create Dispatcher from type annotated object T
 */
export type DispatcherFrom<T> = {
  [K in keyof T]: T[K] extends (...args: infer Args) => unknown
    ? (...args: { [K in keyof Args]: unknown }) => Promise<unknown>
    : never;
};

/**
 * MessagePack-RPC Session
 */
export class Session {
  #counter: number;
  #replies: { [key: number]: Deferred<message.ResponseMessage> };
  #reader: Deno.Reader & Deno.Closer;
  #writer: Deno.Writer;

  /**
   * API name and method map which is used to dispatch API request
   */
  dispatcher: Dispatcher;

  constructor(
    reader: Deno.Reader & Deno.Closer,
    writer: Deno.Writer,
    dispatcher: Dispatcher = {},
  ) {
    this.dispatcher = dispatcher;
    this.#counter = -1;
    this.#replies = {};
    this.#reader = reader;
    this.#writer = writer;
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
    await io.writeAll(this.#writer, data);
  }

  private async dispatch(
    method: string,
    ...params: unknown[]
  ): Promise<unknown> {
    if (!Object.prototype.hasOwnProperty.call(this.dispatcher, method)) {
      const propertyNames = Object.getOwnPropertyNames(this.dispatcher);
      throw new Error(
        `No method '${method}' exists in ${JSON.stringify(propertyNames)}`,
      );
    }
    return await this.dispatcher[method].apply(this, params);
  }

  private async handleRequest(request: message.RequestMessage): Promise<void> {
    const [_, msgid, method, params] = request;
    const [result, error] = await (async () => {
      let result: message.MessageResult = null;
      let error: message.MessageError = null;
      try {
        result = await this.dispatch(method, ...params);
      } catch (e) {
        // Use string representation to send the error through msgpack
        error = e.stack ?? e.toString();
      }
      return [result, error];
    })();
    const response: message.ResponseMessage = [1, msgid, error, result];
    await io.writeAll(this.#writer, encode(response));
  }

  private async handleNotification(
    notification: message.NotificationMessage,
  ): Promise<void> {
    const [_, method, params] = notification;
    try {
      await this.dispatch(method, ...params);
    } catch (e) {
      console.error(e);
    }
  }

  /**
   * Listen messages and handle request/response/notification.
   * This method must be called to start session.
   */
  async listen(): Promise<void> {
    const stream = io.iter(this.#reader);
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
    const [err, result] = (await this.getOrCreateReply(msgid)).slice(2);
    delete this.#replies[msgid];
    if (err) {
      const paramsStr = JSON.stringify(params);
      const errStr = typeof err === "string" ? err : JSON.stringify(err);
      throw new Error(
        `Failed to call '${method}' with ${paramsStr}: ${errStr}`,
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

  /**
   * Clear an internal dispatcher
   *
   * @Deprecated Use `dispatcher` directly
   */
  clearDispatcher(): void {
    this.dispatcher = {};
  }

  /**
   * Extend an internal dispatcher
   *
   * @Deprecated Use `dispatcher` directly
   */
  extendDispatcher(dispatcher: Dispatcher): void {
    this.dispatcher = {
      ...this.dispatcher,
      ...dispatcher,
    };
  }
}
