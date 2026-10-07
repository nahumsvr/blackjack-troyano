/** Banco local de T-18: conduce el motor desde el servidor sin activar acciones o saldos reales. */
import { ErrorJuego, type CartaVisible, type MesaEstado } from "@blackjack/shared";
import { EQUIPADO_INICIAL } from "../server/src/config";
import { Carta } from "../server/src/game/Carta";
import { Mesa } from "../server/src/game/Mesa";
import { RelojMesa } from "../server/src/game/RelojMesa";

const rangos: CartaVisible["rango"][] = ["10", "8", "9", "6", "7", "10", "8", "10", "A"];
const cartas = rangos.map((rango) => new Carta("♠", rango));
let conectados = 0;
let paso = 0;
const publicaciones: { fase: MesaEstado["fase"]; json: string; publicadoEn: number; recepciones: Record<string, number> }[] = [];
const mesa = new Mesa("mesa-1", "Mesa 1", (mensaje) => {
  const json = JSON.stringify(mensaje);
  publicaciones.push({ fase: mensaje.fase, json, publicadoEn: performance.now(), recepciones: {} });
  servidor.publish("mesa:mesa-1", json);
}, {
  sacar: () => { const carta = cartas.shift(); if (!carta) throw new ErrorJuego("ERROR_INTERNO"); return carta; },
  necesitaRebarajar: () => false, barajar: () => {},
}, new RelojMesa({ ahora: Date.now, programar: () => null, cancelar: () => {} }));
const pasos = [
  () => { for (let id = 1; id <= 3; id++) mesa.unirse({ id, usuario: `jugador${id}` }, EQUIPADO_INICIAL); },
  () => { for (let id = 1; id <= 3; id++) mesa.registrarApuestaConfirmada(id, 10); mesa.cerrarApuestas(); },
  () => mesa.avanzarTurno(), () => mesa.avanzarTurno(), () => mesa.avanzarTurno(), () => mesa.finalizarPagos(),
];

const servidor = Bun.serve<{ espectador: boolean }>({
  hostname: "127.0.0.1", port: 0,
  fetch(peticion, actual) {
    const ruta = new URL(peticion.url).pathname;
    if (ruta === "/ws") {
      if (actual.upgrade(peticion, { data: { espectador: true } })) return;
      return new Response("Se requiere WebSocket", { status: 426 });
    }
    if (ruta === "/paso" && peticion.method === "POST") {
      if (conectados < 3) return new Response("Abre las tres pestañas antes de avanzar", { status: 409 });
      const avanzar = pasos[paso];
      if (!avanzar) return new Response("Verificación terminada; reinicia el script para repetir", { status: 409 });
      avanzar(); paso++;
      return Response.json({ paso });
    }
    if (ruta === "/evidencia") return Response.json({ conectados, paso, publicaciones });
    if (ruta === "/recibido" && peticion.method === "POST") {
      // Los acuses pertenecen solo a este banco de prueba; los frames del juego no cambian.
      return peticion.json().then((entrada: unknown) => {
        if (typeof entrada !== "object" || entrada === null || !("pagina" in entrada) || !("json" in entrada)
          || typeof entrada.pagina !== "string" || entrada.pagina.length > 20 || typeof entrada.json !== "string") {
          return new Response("Acuse inválido", { status: 400 });
        }
        const registro = publicaciones.findLast((publicacion) => publicacion.json === entrada.json);
        if (registro) registro.recepciones[entrada.pagina] = performance.now() - registro.publicadoEn;
        return new Response(null, { status: 204 });
      }).catch(() => new Response("Acuse inválido", { status: 400 }));
    }
    if (ruta === "/") return new Response(Bun.file(new URL("./verificar-mesa.html", import.meta.url)), { headers: { "Content-Type": "text/html; charset=utf-8" } });
    return new Response("No encontrado", { status: 404 });
  },
  websocket: {
    open(socket) {
      conectados++;
      socket.subscribe("mesa:mesa-1");
      socket.send(JSON.stringify({ type: "mesa.estado", ...mesa.snapshot() }));
      servidor.publish("conexiones", JSON.stringify({ type: "bienvenida", conectados }));
      socket.subscribe("conexiones");
      socket.send(JSON.stringify({ type: "bienvenida", conectados }));
    },
    close() { conectados--; servidor.publish("conexiones", JSON.stringify({ type: "bienvenida", conectados })); },
    message() {},
  },
});
console.info(`T-18: abre http://127.0.0.1:${servidor.port} en tres pestañas; avanza desde cualquiera.`);
