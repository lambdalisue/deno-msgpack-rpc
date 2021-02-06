# msgpack-rpc-deno

[Deno][] module to support [msgpack-rpc][].

[deno]: https://deno.land/
[msgpack-rpc]: https://github.com/msgpack-rpc/msgpack-rpc/blob/master/spec.md

## Example

### Server

```typescript
import { Server } from "https://deno.land/x/msgpack_rpc/server.ts";

const server = new Server({
  async sum(x: number, y: number): Promise<number> {
    return x + y;
  },
});
await server.listen(Deno.listen({ hostname: "localhost", port: 18800 }));
```

### Client

```typescript
import { Client } from "https://deno.land/x/msgpack_rpc/client.ts";

const conn = await Deno.connect({ hostname: "localhost", port: 18800 });
const client = new Client(conn);
const result = await client.call("sum", 1, 1);
console.log(result);
conn.close();
```

## License

The code follows MIT license written in [LICENSE](./LICENSE).
Contributors need to agree that any modifications sent in this repository follow the license.
