import { Transporter } from "./session.ts";

/**
 * Create new transporer from reader and writer
 */
export function createTransporter(
  reader: Deno.Reader & Deno.Closer,
  writer: Deno.Writer,
): Transporter {
  return {
    close(): void {
      return reader.close();
    },
    read(p: Uint8Array): Promise<number | null> {
      return reader.read(p);
    },
    write(p: Uint8Array): Promise<number> {
      return writer.write(p);
    },
  };
}
