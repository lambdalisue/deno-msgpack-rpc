# msgpack-rpc-deno

[![deno doc](https://doc.deno.land/badge.svg)](https://doc.deno.land/https/deno.land/x/msgpack_rpc/mod.ts)

[Deno][] module to support [msgpack-rpc][] by using [msgpack-deno][].

[deno]: https://deno.land/
[msgpack-rpc]: https://github.com/msgpack-rpc/msgpack-rpc/blob/master/spec.md
[msgpack-deno]: https://github.com/Srinivasa314/msgpack-deno

## Example

### Server

```typescript
import { Session, Dispatcher } from "https://deno.land/x/msgpack_rpc/mod.ts";

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
```

### Client

```typescript
import { Session, Dispatcher } from "https://deno.land/x/msgpack_rpc/mod.ts";

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
```

## License

The code follows MIT license written in [LICENSE](./LICENSE).
Contributors need to agree that any modifications sent in this repository follow the license.
