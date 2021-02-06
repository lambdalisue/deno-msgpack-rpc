import { Client } from "../client.ts";

const client = new Client(
  await Deno.connect({ hostname: "localhost", port: 18800 })
);
const result = await client.call("sum", [1, 1]);
console.log(result);
