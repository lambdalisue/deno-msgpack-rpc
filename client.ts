import { Session } from "./session.ts";

/**
 * MessagePack-RPC Client
 *
 * DEPRECATED: v1.5
 */
export class Client {
  private session: Session;

  /**
   * Constructor
   */
  constructor(transport: Deno.Reader & Deno.Writer) {
    this.session = new Session(transport);
    this.session.listen();
  }

  /**
   * Call a method with params and return a Promise which resolves when a response message
   * has received and to the result value of the method.
   */
  async call(method: string, ...params: any): Promise<any> {
    return await this.session.call(method, ...params);
  }

  /**
   * Notify a method with params and return a Promise which resolves when the message has sent.
   */
  async notify(method: string, ...params: any): Promise<void> {
    await this.session.notify(method, ...params);
  }
}
