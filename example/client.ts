import { Session, Dispatcher } from "../session.ts";

const hostname = "localhost";
const port = 18800;

const dispatcher: Dispatcher = {
  async hello_server(name: string): Promise<string> {
    // NOTE: 'this' is an instance of Session
    return this.call("hello_server", name);
  },

  async hello_client(name: string): Promise<string> {
    return `Hello ${name}, this is client`;
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
  console.log(await client.call("hello_server", "Bob"));
  console.log(await client.call("hello_client", "Bob"));
  console.log(`Close connection`);
  conn.close();
} catch (e) {
  console.error(e);
}
