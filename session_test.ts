import { assertEquals } from "https://deno.land/std@0.86.0/testing/asserts.ts";
import { sleep } from "https://deno.land/x/sleep/mod.ts";
import { Dispatcher, Session } from "./session.ts";
import { createTransporter } from "./mod.ts";

class Reader implements Deno.Reader, Deno.Closer {
  #queue: Uint8Array[];
  #closed: boolean;

  constructor(queue: Uint8Array[]) {
    this.#queue = queue;
    this.#closed = false;
  }

  close(): void {
    this.#closed = true;
  }

  async read(p: Uint8Array): Promise<number | null> {
    while (!this.#closed) {
      const v = this.#queue.pop();
      if (v) {
        p.set(v);
        return v.length;
      }
      await sleep(0.001);
    }
    return null;
  }
}

class Writer implements Deno.Writer {
  #queue: Uint8Array[];

  constructor(queue: Uint8Array[]) {
    this.#queue = queue;
  }

  write(p: Uint8Array): Promise<number> {
    this.#queue.push(p);
    return Promise.resolve(p.length);
  }
}

Deno.test("Local can call Remote method", async () => {
  const l2r: Uint8Array[] = []; // Local to Remote
  const r2l: Uint8Array[] = []; // Remote to Local
  const lr = new Reader(r2l);
  const lw = new Writer(l2r);
  const local = new Session(createTransporter(lr, lw));
  const rr = new Reader(l2r);
  const rw = new Writer(r2l);
  const remote = new Session(createTransporter(rr, rw), {
    say(name: unknown): Promise<unknown> {
      return Promise.resolve(`Hello ${name} from Remote`);
    },
  });
  const listeners = [local.listen(), remote.listen()];
  assertEquals(
    await local.call("say", "John Titor"),
    "Hello John Titor from Remote",
  );
  // Close
  lr.close();
  rr.close();
  await Promise.all(listeners);
});

Deno.test("Remote can call Local method", async () => {
  const l2r: Uint8Array[] = []; // Local to Remote
  const r2l: Uint8Array[] = []; // Remote to Local
  const lr = new Reader(r2l);
  const lw = new Writer(l2r);
  const local = new Session(createTransporter(lr, lw), {
    say(name: unknown): Promise<unknown> {
      return Promise.resolve(`Hello ${name} from Local`);
    },
  });
  const rr = new Reader(l2r);
  const rw = new Writer(r2l);
  const remote = new Session(createTransporter(rr, rw));
  const listeners = [local.listen(), remote.listen()];
  assertEquals(
    await remote.call("say", "John Titor"),
    "Hello John Titor from Local",
  );
  // Close
  lr.close();
  rr.close();
  await Promise.all(listeners);
});

Deno.test("Local can call Local method through Remote method", async () => {
  const l2r: Uint8Array[] = []; // Local to Remote
  const r2l: Uint8Array[] = []; // Remote to Local
  const lr = new Reader(r2l);
  const lw = new Writer(l2r);
  const local = new Session(createTransporter(lr, lw), {
    say(name: unknown): Promise<unknown> {
      return Promise.resolve(`Hello ${name} from Local`);
    },
  });
  const rr = new Reader(l2r);
  const rw = new Writer(r2l);
  const remote = new Session(createTransporter(rr, rw), {
    say(name: unknown): Promise<unknown> {
      return this.call("say", `Hello ${name} from Remote`);
    },
  });
  const listeners = [local.listen(), remote.listen()];
  assertEquals(
    await local.call("say", "John Titor"),
    "Hello Hello John Titor from Remote from Local",
  );
  // Close
  lr.close();
  rr.close();
  await Promise.all(listeners);
});

Deno.test("Remote can call Remote method through Local method", async () => {
  const l2r: Uint8Array[] = []; // Local to Remote
  const r2l: Uint8Array[] = []; // Remote to Local
  const lr = new Reader(r2l);
  const lw = new Writer(l2r);
  const local = new Session(createTransporter(lr, lw), {
    say(name: unknown): Promise<unknown> {
      return this.call("say", `Hello ${name} from Local`);
    },
  });
  const rr = new Reader(l2r);
  const rw = new Writer(r2l);
  const remote = new Session(createTransporter(rr, rw), {
    say(name: unknown): Promise<unknown> {
      return Promise.resolve(`Hello ${name} from Remote`);
    },
  });
  const listeners = [local.listen(), remote.listen()];
  assertEquals(
    await remote.call("say", "John Titor"),
    "Hello Hello John Titor from Local from Remote",
  );
  // Close
  lr.close();
  rr.close();
  await Promise.all(listeners);
});
