import { Dispatcher, Session } from "../mod.ts";

const hostname = "localhost";
const port = 18800;

const dispatcher: Dispatcher = {
  sum(x: unknown, y: unknown): Promise<unknown> {
    if (typeof x !== "number" || typeof y !== "number") {
      throw new Error("x and y must be number");
    }
    return Promise.resolve(x + y);
  },

  helloServer(name: unknown): Promise<unknown> {
    return Promise.resolve(`Hello ${name}, this is server`);
  },

  async helloClient(name: unknown): Promise<unknown> {
    // NOTE: 'this' is an instance of Session
    return await this.call("hello_client", name);
  },
};

for await (
  const conn of Deno.listen({
    hostname,
    port,
  })
) {
  console.log("Session has connected");
  const server = new Session(conn, conn, dispatcher);
  server
    .listen()
    .then(() => console.log("Client has disconnected"))
    .catch((e) => console.error(e));
  console.log(await server.call("helloServer", "Alice"));
  console.log(await server.call("helloClient", "Alice"));
}
