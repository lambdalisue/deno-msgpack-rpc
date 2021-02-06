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

export class Client {
  private counter: number;
  private replies: { [key: number]: Deferred<Response> };

  constructor(private conn: Deno.Conn) {
    this.counter = -1;
    this.replies = {};
    // Start listener which will stop when conn is closed
    this.start_listener();
  }

  private async start_listener(): Promise<void> {
    const stream = Deno.iter(this.conn);
    try {
      for await (const data of decodeStream(stream)) {
        if (!Array.isArray(data)) {
          console.warn(`Unexpected data ${data} received`);
          continue;
        }
        const message = decodeMessage(data);
        if (message.type !== 1) {
          console.warn(`Unexpected message type ${message.type} received`);
          continue;
        }
        const reply = this.get_or_create_reply(message.msgid);
        reply.resolve(message);
      }
    } catch (e) {
      if (e instanceof Deno.errors.BadResource) {
        // Connection is closed
        return;
      }
      throw e;
    }
  }

  private get_or_create_reply(msgid: number): Deferred<Response> {
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
      const n = await this.conn.write(data);
      if (n === data.byteLength) {
        break;
      }
      data = data.slice(n);
    }
  }

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

  async notify(method: string, ...params: any): Promise<void> {
    const m: Notification = {
      type: 2,
      method,
      params,
    };
    await this.send(encode(encodeMessage(m)));
  }
}
