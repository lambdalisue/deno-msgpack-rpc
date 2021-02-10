import { assertEquals } from "https://deno.land/std@0.86.0/testing/asserts.ts";
import * as message from "./message.ts";

const isRequestMessageTestCases = [
  [[0, 0, "say", ["hello"]], true],
  [[0, 0, "sum", [0, 1]], true],
  [[0, 0, "append", [[], "foo"]], true],
  [[0, 0, "extend", [{}, { foo: "bar" }]], true],
  [[1, 0, null, "hello"], false],
  [[2, "say", ["hello"]], false],
];
for (const t of isRequestMessageTestCases) {
  Deno.test(
    `isRequestMessage() returns ${t[1]} for ${JSON.stringify(t[0])}`,
    () => {
      assertEquals(message.isRequestMessage(t[0]), t[1]);
    },
  );
}

const isResponseMessageTestCases = [
  [[1, 0, null, "hello"], true],
  [[1, 0, null, 1], true],
  [[1, 0, null, ["foo"]], true],
  [[1, 0, null, { foo: "bar" }], true],
  [[0, 0, "say", ["hello"]], false],
  [[2, "say", ["hello"]], false],
];
for (const t of isResponseMessageTestCases) {
  Deno.test(
    `isResponseMessage() returns ${t[1]} for ${JSON.stringify(t[0])}`,
    () => {
      assertEquals(message.isResponseMessage(t[0]), t[1]);
    },
  );
}

const isNotificationMessageTestCases = [
  [[2, "say", ["hello"]], true],
  [[2, "sum", [0, 1]], true],
  [[2, "append", [[], "foo"]], true],
  [[2, "extend", [{}, { foo: "bar" }]], true],
  [[0, 0, "say", ["hello"]], false],
  [[1, 0, null, "hello"], false],
];
for (const t of isNotificationMessageTestCases) {
  Deno.test(
    `isNotificationMessage() returns ${t[1]} for ${JSON.stringify(t[0])}`,
    () => {
      assertEquals(message.isNotificationMessage(t[0]), t[1]);
    },
  );
}
