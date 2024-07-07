# msgpack-rpc

[![deno land](http://img.shields.io/badge/available%20on-deno.land/x-lightgrey.svg?logo=deno)](https://deno.land/x/msgpack_rpc)
[![deno doc](https://doc.deno.land/badge.svg)](https://doc.deno.land/https/deno.land/x/msgpack_rpc/mod.ts)
[![Test](https://github.com/lambdalisue/deno-msgpack-rpc/workflows/Test/badge.svg)](https://github.com/lambdalisue/deno-msgpack-rpc/actions?query=workflow%3ATest)

> [!WARNING]
>
> This module is for deprecated `Deno.Reader`, `Deno.Writer`, and `Deno.Closer`.
> Use
> [deno-messagepack-rpc](https://github.com/lambdalisue/deno-messagepack-rpc)
> instead for Web standard Streams APIs.

[Deno][deno] module to support [msgpack-rpc][msgpack-rpc] by using
[msgpack-deno][msgpack-deno].

[deno]: https://deno.land/
[msgpack-rpc]: https://github.com/msgpack-rpc/msgpack-rpc/blob/master/spec.md
[msgpack-deno]: https://github.com/Srinivasa314/msgpack-deno

## Example

The `Session` **MUST** be closed by `close()` method to release internal
resources. You can use `using` provided by https://deno.land/x/disposable/ to
ensure that while `Session` implements `Disposable` of that.

### Server

```typescript
import { Dispatcher, Session } from "https://deno.land/x/msgpack_rpc/mod.ts";
import { using } from "https://deno.land/x/disposable/mod.ts";

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
    return await this.call("helloClient", name);
  },
};

async function establishSession(conn: Deno.Conn) {
  using(new Session(conn, conn, dispatcher), async (server) => {
    console.log("Session has connected");
    console.log(await server.call("helloServer", "Alice"));
    console.log(await server.call("helloClient", "Alice"));
    await server.waitClosed();
  });
}

for await (
  const conn of Deno.listen({
    hostname,
    port,
  })
) {
  establishSession(conn)
    .then(() => console.log("Client has disconnected"))
    .catch((e) => console.error(e));
}
```

### Client

```typescript
import { Dispatcher, Session } from "https://deno.land/x/msgpack_rpc/mod.ts";
import { using } from "https://deno.land/x/disposable/mod.ts";

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
```

## License

The code follows MIT license written in [LICENSE](./LICENSE). Contributors need
to agree that any modifications sent in this repository follow the license.
