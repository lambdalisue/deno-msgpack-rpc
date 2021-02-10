# msgpack-rpc-deno

[![deno doc](https://doc.deno.land/badge.svg)](https://doc.deno.land/https/deno.land/x/msgpack_rpc/mod.ts)

[Deno][deno] module to support [msgpack-rpc][msgpack-rpc] by using
[msgpack-deno][msgpack-deno].

[deno]: https://deno.land/
[msgpack-rpc]: https://github.com/msgpack-rpc/msgpack-rpc/blob/master/spec.md
[msgpack-deno]: https://github.com/Srinivasa314/msgpack-deno

## Example

### Server

```typescript
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
  const server = new Session(conn, dispatcher);
  server
    .listen()
    .then(() => console.log("Client has disconnected"))
    .catch((e) => console.error(e));
  console.log(await server.call("helloServer", "Alice"));
  console.log(await server.call("helloClient", "Alice"));
}
```

### Client

```typescript
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
```

## License

The code follows MIT license written in [LICENSE](./LICENSE). Contributors need
to agree that any modifications sent in this repository follow the license.
