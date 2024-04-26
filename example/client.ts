import { Dispatcher, Session } from "../mod.ts";
import { using } from "../deps_test.ts";

const hostname = "localhost";
const port = 18800;

const dispatcher: Dispatcher = {
  async helloServer(name: unknown): Promise<unknown> {
    // NOTE: 'this' is an instance of Session
    return await this.call("helloServer", name);
  },

  helloClient(name: unknown): Promise<unknown> {
    return Promise.resolve(`Hello ${name}, this is client`);
  },
};

try {
  console.log(`Connect to MessagePack-RPC server (${hostname}:${port})`);
  const conn = await Deno.connect({ hostname, port });
  using(new Session(conn, conn, dispatcher), async (client) => {
    console.log(await client.call("sum", 1, 1));
    console.log(await client.call("helloServer", "Bob"));
    console.log(await client.call("helloClient", "Bob"));
  });
  console.log("Session has disconnected");
  console.log(`Close connection`);
  conn.close();
} catch (e) {
  console.error(e);
}
