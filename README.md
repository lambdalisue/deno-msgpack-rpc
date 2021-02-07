# msgpack-rpc-deno

[![deno doc](https://doc.deno.land/badge.svg)](https://doc.deno.land/https/deno.land/x/msgpack_rpc/mod.ts)

[Deno][] module to support [msgpack-rpc][] by using [msgpack-deno][].

[deno]: https://deno.land/
[msgpack-rpc]: https://github.com/msgpack-rpc/msgpack-rpc/blob/master/spec.md
[msgpack-deno]: https://github.com/Srinivasa314/msgpack-deno

## Example

### Server

```typescript
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
```

### Client

```typescript
import { Client } from "../client.ts";

const hostname = "localhost";
const port = 18800;

try {
  console.log(`Connect to MessagePack-RPC server (${hostname}:${port})`);
  const conn = await Deno.connect({ hostname, port });

  console.log(`Call 'sum' with [1, 1]`);
  const client = new Client(conn);
  const result = await client.call("sum", 1, 1);
  console.log(result);

  console.log(`Close connection`);
  conn.close();
} catch (e) {
  console.error(e);
}
```

## License

The code follows MIT license written in [LICENSE](./LICENSE).
Contributors need to agree that any modifications sent in this repository follow the license.
