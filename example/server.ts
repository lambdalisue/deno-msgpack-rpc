import { Session, Dispatcher } from "../session.ts";

const hostname = "localhost";
const port = 18800;

const dispatcher: Dispatcher = {
  async sum(x: number, y: number): Promise<number> {
    return x + y;
  },

  async hello_server(name: string): Promise<string> {
    return `Hello ${name}, this is server`;
  },

  async hello_client(name: string): Promise<string> {
    // NOTE: 'this' is an instance of Session
    return this.call("hello_client", name);
  },
};

for await (const conn of Deno.listen({
  hostname,
  port,
})) {
  console.log("Session has connected");
  const server = new Session(conn, dispatcher);
  server
    .listen()
    .then(() => console.log("Client has disconnected"))
    .catch((e) => console.error(e));
  console.log(await server.call("hello_server", "Alice"));
  console.log(await server.call("hello_client", "Alice"));
}
