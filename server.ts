import { encode, decodeStream } from "https://deno.land/x/msgpack@v1.2/mod.ts";
import {
  encode as encodeMessage,
  decode as decodeMessage,
  Request,
  Response,
  Notification,
} from "./message.ts";

export interface Dispatcher {
  [key: string]: (...args: any) => Promise<any>;
}

export class Server {
  constructor(private dispatcher: Dispatcher) {}

  private async handle_connection(conn: Deno.Conn): Promise<void> {
    const stream = Deno.iter(conn);
    for await (const data of decodeStream(stream)) {
      if (!Array.isArray(data)) {
        console.warn(`Unexpected data received: ${data}`);
        continue;
      }
      const message = decodeMessage(data);
      switch (message.type) {
        case 0:
          this.handle_request(conn, message);
          break;
        case 1:
          console.warn(
            `Unexpected message received: ${JSON.stringify(message)}`
          );
          continue;
        case 2:
          this.handle_notification(message);
          break;
      }
    }
  }

  private async dispatch(method: string, ...params: any): Promise<any> {
    return await this.dispatcher[method].apply(null, params);
  }

  private async handle_request(
    conn: Deno.Conn,
    request: Request
  ): Promise<void> {
    try {
      await conn.write(
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
      await conn.write(
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

  async listen(listener: Deno.Listener): Promise<void> {
    for await (const conn of listener) {
      this.handle_connection(conn);
    }
  }
}
