/** Regresión pura del UUID para HTTP LAN, sin servidor ni PostgreSQL. */
import { expect, test } from "bun:test";
import { MensajeClienteSchema } from "@blackjack/shared";
import { generarUuid } from "../src/net/identificadores";

test("genera UUID v4 únicos y válidos para shared sin randomUUID", () => {
  const descriptor = Object.getOwnPropertyDescriptor(crypto, "randomUUID");
  Object.defineProperty(crypto, "randomUUID", { value: undefined, configurable: true });
  try {
    const identificadores = Array.from({ length: 256 }, () => generarUuid());
    expect(new Set(identificadores).size).toBe(identificadores.length);
    for (const clave of identificadores) {
      expect(clave).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
      expect(MensajeClienteSchema.safeParse({ type: "ping", reqId: clave }).success).toBe(true);
    }
  } finally {
    if (descriptor) Object.defineProperty(crypto, "randomUUID", descriptor);
    else Reflect.deleteProperty(crypto, "randomUUID");
  }
});
