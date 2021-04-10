import { assertEquals } from "https://deno.land/std@0.86.0/testing/asserts.ts";
import { delay } from "https://deno.land/std/async/mod.ts";
import { Session } from "./session.ts";

class Reader implements Deno.Reader, Deno.Closer {
  #queue: Uint8Array[];
  #remain: Uint8Array;
  #closed: boolean;

  constructor(queue: Uint8Array[]) {
    this.#queue = queue;
    this.#remain = new Uint8Array();
    this.#closed = false;
  }

  close(): void {
    this.#closed = true;
  }

  async read(p: Uint8Array): Promise<number | null> {
    if (this.#remain.length) {
      return this.readFromRemain(p);
    }
    while (!this.#closed || this.#queue.length) {
      const v = this.#queue.shift();
      if (v) {
        this.#remain = v;
        return this.readFromRemain(p);
      }
      await delay(1);
    }
    return null;
  }

  private readFromRemain(p: Uint8Array): number {
    const size = p.byteLength;
    const head = this.#remain.slice(0, size);
    this.#remain = this.#remain.slice(size);
    p.set(head);
    return head.byteLength;
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

function buildMassiveData(): string {
  let data = "";
  for (let i = 0; i < 10000; i++) {
    data += ("0000" + String(i)).slice(-4) + ", ";
  }
  return data;
}

Deno.test("Make sure that Reader/Writer for tests works properly", async () => {
  const q: Uint8Array[] = [];
  const r = new Reader(q);
  const w = new Writer(q);
  const d = (new TextEncoder()).encode(buildMassiveData());
  await Deno.writeAll(w, d);
  r.close();
  assertEquals(await Deno.readAll(r), d);
});

Deno.test("Local can call Remote method", async () => {
  const l2r: Uint8Array[] = []; // Local to Remote
  const r2l: Uint8Array[] = []; // Remote to Local
  const lr = new Reader(r2l);
  const lw = new Writer(l2r);
  const local = new Session(lr, lw);
  const rr = new Reader(l2r);
  const rw = new Writer(r2l);
  const remote = new Session(rr, rw, {
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
  const local = new Session(lr, lw, {
    say(name: unknown): Promise<unknown> {
      return Promise.resolve(`Hello ${name} from Local`);
    },
  });
  const rr = new Reader(l2r);
  const rw = new Writer(r2l);
  const remote = new Session(rr, rw);
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
  const local = new Session(lr, lw, {
    say(name: unknown): Promise<unknown> {
      return Promise.resolve(`Hello ${name} from Local`);
    },
  });
  const rr = new Reader(l2r);
  const rw = new Writer(r2l);
  const remote = new Session(rr, rw, {
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
  const local = new Session(lr, lw, {
    say(name: unknown): Promise<unknown> {
      return this.call("say", `Hello ${name} from Local`);
    },
  });
  const rr = new Reader(l2r);
  const rw = new Writer(r2l);
  const remote = new Session(rr, rw, {
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
