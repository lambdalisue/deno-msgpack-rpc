import { Dispatcher, Session } from "../mod.ts";

const hostname = "localhost";
const port = 18800;

const dispatcher: Dispatcher = {
  async helloServer(name: unknown): Promise<unknown> {
    // NOTE: 'this' is an instance of Session
    return await this.call("hello_server", name);
  },

  helloClient(name: unknown): Promise<unknown> {
    return Promise.resolve(`Hello ${name}, this is client`);
  },
};

try {
  console.log(`Connect to MessagePack-RPC server (${hostname}:${port})`);
  const conn = await Deno.connect({ hostname, port });
  const client = new Session(conn, dispatcher);
  client
    .listen()
    .then(() => console.log("Session has disconnected"))
    .catch((e) => console.error(e));
  console.log(await client.call("sum", 1, 1));
  console.log(await client.call("helloServer", "Bob"));
  console.log(await client.call("helloClient", "Bob"));
  console.log(`Close connection`);
  conn.close();
} catch (e) {
  console.error(e);
}
