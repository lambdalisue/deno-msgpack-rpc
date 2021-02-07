import { Server, Dispatcher } from "../server.ts";

const hostname = "localhost";
const port = 18800;

const dispatcher: Dispatcher = {
  async sum(x: number, y: number): Promise<number> {
    return x + y;
  },
};

const server = new Server(dispatcher);

for await (const listener of Deno.listen({
  hostname,
  port,
})) {
  console.log("Client has connected");
  server
    .start(listener)
    .then(() => console.log("Client has disconnected"))
    .catch((e) => console.error(e));
}
