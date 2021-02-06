import { Server } from "../server.ts";

const server = new Server({
  async sum(x: number, y: number): Promise<number> {
    return x + y;
  },
});
await server.listen(Deno.listen({ hostname: "localhost", port: 18800 }));
