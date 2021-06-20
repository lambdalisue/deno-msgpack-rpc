import { io } from "./deps.ts";
import { assertEquals, assertThrowsAsync, delay } from "./deps_test.ts";
import { Session, SessionClosedError } from "./session.ts";

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
  await io.writeAll(w, d);
  r.close();
  assertEquals(await io.readAll(r), d);
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
  assertEquals(
    await local.call("say", "John Titor"),
    "Hello John Titor from Remote",
  );
  // Close
  lr.close();
  rr.close();
  await Promise.all([
    local.waitClosed(),
    remote.waitClosed(),
  ]);
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
  assertEquals(
    await remote.call("say", "John Titor"),
    "Hello John Titor from Local",
  );
  // Close
  lr.close();
  rr.close();
  await Promise.all([
    local.waitClosed(),
    remote.waitClosed(),
  ]);
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
  assertEquals(
    await local.call("say", "John Titor"),
    "Hello Hello John Titor from Remote from Local",
  );
  // Close
  lr.close();
  rr.close();
  await Promise.all([
    local.waitClosed(),
    remote.waitClosed(),
  ]);
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
  assertEquals(
    await remote.call("say", "John Titor"),
    "Hello Hello John Titor from Local from Remote",
  );
  // Close
  lr.close();
  rr.close();
  await Promise.all([
    local.waitClosed(),
    remote.waitClosed(),
  ]);
});

Deno.test("Local can receive Remote massive data", async () => {
  const massiveData = buildMassiveData();
  const l2r: Uint8Array[] = []; // Local to Remote
  const r2l: Uint8Array[] = []; // Remote to Local
  const lr = new Reader(r2l);
  const lw = new Writer(l2r);
  const local = new Session(lr, lw);
  const rr = new Reader(l2r);
  const rw = new Writer(r2l);
  const remote = new Session(rr, rw, {
    say(): Promise<unknown> {
      return Promise.resolve(massiveData);
    },
  });
  assertEquals(
    await local.call("say"),
    massiveData,
  );
  // Close
  lr.close();
  rr.close();
  await Promise.all([
    local.waitClosed(),
    remote.waitClosed(),
  ]);
});

Deno.test("Session.call() throws SessionClosedError if the session has closed", async () => {
  const buffer: Uint8Array[] = [];
  const reader = new Reader(buffer);
  const writer = new Writer(buffer);
  const session = new Session(reader, writer);
  session.close();
  await assertThrowsAsync(async () => {
    await session.call("say");
  }, SessionClosedError);
  reader.close();
  await session.waitClosed();
});

Deno.test("Session.notify() throws SessionClosedError if the session has closed", async () => {
  const buffer: Uint8Array[] = [];
  const reader = new Reader(buffer);
  const writer = new Writer(buffer);
  const session = new Session(reader, writer);
  session.close();
  await assertThrowsAsync(async () => {
    await session.notify("say");
  }, SessionClosedError);
  reader.close();
  await session.waitClosed();
});
