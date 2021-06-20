import { Deferred, deferred } from "./deps.ts";
import { MessageId, ResponseMessage } from "./message.ts";

const DEFAULT_RESPONSE_TIMEOUT = 10000; // milliseconds

type Waiter = {
  timer: number;
  response: Deferred<ResponseMessage>;
};

export class TimeoutError extends Error {
  constructor() {
    super("the process didn't complete in time");
    this.name = "TimeoutError";
  }
}

/**
 * ResponseWaiter is for waiting a response messages for 'msgid'
 */
export class ResponseWaiter {
  #waiters: Map<MessageId, Waiter>;
  #timeout: number;

  constructor(timeout = DEFAULT_RESPONSE_TIMEOUT) {
    this.#waiters = new Map();
    this.#timeout = timeout;
  }

  /**
   * The number of internal waiters
   */
  get waiterCount(): number {
    return this.#waiters.size;
  }

  /**
   * Wait a response message of 'msgid'
   */
  wait(msgid: MessageId, timeout?: number): Promise<ResponseMessage> {
    let response = this.#waiters.get(msgid)?.response;
    if (!response) {
      response = deferred();
      const timer = setTimeout(() => {
        const response = this.#waiters.get(msgid)?.response;
        if (!response) {
          return;
        }
        response.reject(new TimeoutError());
        this.#waiters.delete(msgid);
      }, timeout ?? this.#timeout);
      this.#waiters.set(msgid, {
        timer,
        response,
      });
    }
    return response;
  }

  /**
   * Provide a response message
   *
   * It returns false if no one seems to wait the message.
   * Otherwise it returns true.
   */
  provide(message: ResponseMessage): boolean {
    const [_type, msgid, _error, _result] = message;
    const waiter = this.#waiters.get(msgid);
    if (!waiter) {
      return false;
    }
    this.#waiters.delete(msgid);
    const { timer, response } = waiter;
    clearTimeout(timer);
    response.resolve(message);
    return true;
  }
}
