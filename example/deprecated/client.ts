import { Client } from "../../client.ts";

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
