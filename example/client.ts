import { Client } from "../client.ts";

const conn = await Deno.connect({ hostname: "localhost", port: 18800 });
const client = new Client(conn);
const result = await client.call("sum", 1, 1);
console.log(result);
conn.close();
