import {
  decodeStream,
  Deferred,
  deferred,
  Disposable,
  encode,
  io,
} from "./deps.ts";
import * as message from "./message.ts";
import { Indexer } from "./indexer.ts";
import { ResponseWaiter } from "./response_waiter.ts";

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
 * Session options
 */
export type SessionOptions = {
  /**
   * Response timeout in milliseconds
   */
  responseTimeout?: number;

  /**
   * A callback called when session raised internal error
   */
  errorCallback?: (e: Error) => void;
};

/**
 * MessagePack-RPC Session
 */
export class Session implements Disposable {
  #indexer: Indexer;
  #waiter: ResponseWaiter;
  #reader: Deno.Reader & Deno.Closer;
  #writer: Deno.Writer;
  #listener: Promise<void>;
  #closed: boolean;
  #closedSignal: Deferred<never>;

  /**
   * API name and method map which is used to dispatch API request
   */
  dispatcher: Dispatcher;

  constructor(
    reader: Deno.Reader & Deno.Closer,
    writer: Deno.Writer,
    dispatcher: Dispatcher = {},
    options: SessionOptions = {},
  ) {
    this.dispatcher = dispatcher;
    this.#indexer = new Indexer(MSGID_THRESHOLD);
    this.#waiter = new ResponseWaiter(options.responseTimeout);
    this.#reader = reader;
    this.#writer = writer;
    this.#closed = false;
    this.#closedSignal = deferred();
    this.#listener = this.listen().catch((e) => {
      if (options.errorCallback) {
        options.errorCallback(e);
      } else {
        console.error(`Unexpected error occured in session: ${e}`);
      }
    });
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
    await this.send(encode(response));
  }

  private handleResponse(response: message.ResponseMessage): void {
    if (!this.#waiter.provide(response)) {
      console.warn("Unexpected response message received", response);
    }
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

  private async listen(): Promise<void> {
    const iter = decodeStream(io.iter(this.#reader));
    try {
      while (!this.#closed) {
        const { done, value } = await Promise.race([
          this.#closedSignal,
          iter.next(),
        ]);
        if (done) {
          return;
        }
        if (message.isRequestMessage(value)) {
          this.handleRequest(value);
        } else if (message.isResponseMessage(value)) {
          this.handleResponse(value);
        } else if (message.isNotificationMessage(value)) {
          this.handleNotification(value);
        } else {
          console.warn(`Unexpected data received: ${value}`);
          continue;
        }
      }
    } catch (e) {
      if (e instanceof SessionClosedError) {
        return;
      }
      // https://github.com/denoland/deno/issues/5194#issuecomment-631987928
      if (e instanceof Deno.errors.BadResource) {
        return;
      }
      throw e;
    }
  }

  dispose() {
    this.close();
  }

  /**
   * Close this session
   */
  close(): void {
    this.#closed = true;
    this.#closedSignal.reject(new SessionClosedError());
  }

  /**
   * Wait until the session is closed
   */
  waitClosed(): Promise<void> {
    return this.#listener;
  }

  /**
   * Call a method with params and return a Promise which resolves when a response message
   * has received and to the result value of the method.
   */
  async call(method: string, ...params: unknown[]): Promise<unknown> {
    if (this.#closed) {
      throw new SessionClosedError();
    }
    const msgid = this.#indexer.next();
    const data: message.RequestMessage = [0, msgid, method, params];
    const [_, response] = await Promise.race([
      this.#closedSignal,
      Promise.all([this.send(encode(data)), this.#waiter.wait(msgid)]),
    ]);
    const [err, result] = response.slice(2);
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
    if (this.#closed) {
      throw new SessionClosedError();
    }
    const data: message.NotificationMessage = [2, method, params];
    await Promise.race([this.#closedSignal, this.send(encode(data))]);
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

/**
 * An error indicates that the session is closed
 */
export class SessionClosedError extends Error {
  constructor() {
    super("The session is closed");
    this.name = "SessionClosedError";
  }
}
