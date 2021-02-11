import { assertEquals } from "https://deno.land/std@0.86.0/testing/asserts.ts";
import { createTransporter } from "./utils.ts";

Deno.test(
  "createTransporter create a new transporter from reader and writer",
  () => {
    const result = {
      closeCalled: false,
      readCalled: false,
      writeCalled: false,
    };
    const reader: Deno.Reader & Deno.Closer = {
      close(): void {
        result.closeCalled = true;
      },
      read(p: Uint8Array): Promise<number | null> {
        result.readCalled = true;
        return Promise.resolve(p.length);
      },
    };
    const writer: Deno.Writer = {
      write(p: Uint8Array): Promise<number> {
        result.writeCalled = true;
        return Promise.resolve(p.length);
      },
    };
    const transporter = createTransporter(reader, writer);

    assertEquals(result, {
      closeCalled: false,
      readCalled: false,
      writeCalled: false,
    });

    transporter.read(new Uint8Array());
    assertEquals(result, {
      closeCalled: false,
      readCalled: true,
      writeCalled: false,
    });

    transporter.write(new Uint8Array());
    assertEquals(result, {
      closeCalled: false,
      readCalled: true,
      writeCalled: true,
    });

    transporter.close();
    assertEquals(result, {
      closeCalled: true,
      readCalled: true,
      writeCalled: true,
    });
  },
);
