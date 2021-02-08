import { Session, Dispatcher } from "./session.ts";

/**
 * MessagePack-RPC Server
 *
 * DEPRECATED: v1.5
 */
export class Server {
  constructor(private dispatcher: Dispatcher) {}

  /**
   * Start MessagePack-RPC on the transport
   */
  async start(transport: Deno.Reader & Deno.Writer): Promise<void> {
    const session = new Session(transport, this.dispatcher);
    return await session.listen();
  }
}

export type { Dispatcher };
