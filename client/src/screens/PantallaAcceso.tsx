/**
 * Pantalla de acceso: iniciar sesión o registrarse. Valida con el MISMO esquema Zod del contrato
 * antes de enviar (solo para dar retroalimentación inmediata; el servidor vuelve a validar)
 * y deshabilita el botón mientras espera respuesta. Base de T-13.
 */
import { MensajeClienteSchema } from "@blackjack/shared";
import { useState, type FormEvent, type ReactNode } from "react";
import { useJuego } from "../state/store";

/** Modo del formulario. */
type Modo = "login" | "registro";
/** Errores por campo. */
type ErroresCampo = Partial<Record<"usuario" | "contrasena", string>>;

/** Textos de error por campo (los del contrato vienen en inglés técnico de Zod). */
const TEXTO_ERROR: Required<ErroresCampo> = {
  usuario: "De 3 a 20 letras, números o guion bajo, sin espacios.",
  contrasena: "La contraseña debe tener de 6 a 72 caracteres.",
};

/**
 * Valida usuario y contraseña con el esquema del mensaje que se va a enviar.
 * @param modo - `login` o `registro`.
 * @param usuario - Texto del campo usuario.
 * @param contrasena - Texto del campo contraseña.
 * @returns Errores por campo; vacío si todo es válido.
 */
export function validarCredenciales(modo: Modo, usuario: string, contrasena: string): ErroresCampo {
  const resultado = MensajeClienteSchema.safeParse({ type: modo, usuario, contrasena });
  if (resultado.success) return {};
  const errores: ErroresCampo = {};
  for (const problema of resultado.error.issues) {
    const campo = problema.path[0];
    if (campo === "usuario" || campo === "contrasena") errores[campo] = TEXTO_ERROR[campo];
  }
  return errores;
}

/**
 * Formulario de inicio de sesión y registro.
 * @returns Pantalla de acceso.
 */
export function PantallaAcceso(): ReactNode {
  const { estado, acciones } = useJuego();
  const [modo, setModo] = useState<Modo>("login");
  const [usuario, setUsuario] = useState("");
  const [contrasena, setContrasena] = useState("");
  const [errores, setErrores] = useState<ErroresCampo>({});
  const enviando = estado.pendientes.includes(modo);
  const conectado = estado.conexion === "conectado";

  const enviar = (evento: FormEvent) => {
    evento.preventDefault();
    const encontrados = validarCredenciales(modo, usuario, contrasena);
    setErrores(encontrados);
    if (Object.keys(encontrados).length > 0 || enviando || !conectado) return;
    void (modo === "login" ? acciones.iniciarSesion(usuario, contrasena) : acciones.registrar(usuario, contrasena));
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 p-6">
      <h1 className="text-center text-4xl font-bold">Blackjack</h1>
      <div className="grid grid-cols-2 overflow-hidden rounded border border-emerald-700">
        {(["login", "registro"] as const).map((opcion) => (
          <button
            key={opcion}
            type="button"
            onClick={() => {
              setModo(opcion);
              setErrores({});
            }}
            className={`py-2 ${modo === opcion ? "bg-emerald-700 font-semibold" : "hover:bg-emerald-900"}`}
          >
            {opcion === "login" ? "Entrar" : "Registrarse"}
          </button>
        ))}
      </div>
      <form onSubmit={enviar} noValidate className="flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          Usuario
          <input
            value={usuario}
            onChange={(evento) => setUsuario(evento.target.value)}
            autoComplete="username"
            maxLength={20}
            className="rounded bg-emerald-900 px-3 py-2"
          />
          {errores.usuario !== undefined && <span className="text-sm text-red-300">{errores.usuario}</span>}
        </label>
        <label className="flex flex-col gap-1">
          Contraseña
          <input
            type="password"
            value={contrasena}
            onChange={(evento) => setContrasena(evento.target.value)}
            autoComplete={modo === "login" ? "current-password" : "new-password"}
            maxLength={72}
            className="rounded bg-emerald-900 px-3 py-2"
          />
          {errores.contrasena !== undefined && <span className="text-sm text-red-300">{errores.contrasena}</span>}
        </label>
        <button
          type="submit"
          disabled={enviando || !conectado}
          className="rounded bg-amber-400 py-2 font-semibold text-emerald-950 hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {enviando ? "Enviando…" : modo === "login" ? "Entrar" : "Crear cuenta"}
        </button>
        {!conectado && <p className="text-center text-sm text-amber-300">Esperando conexión con el servidor…</p>}
      </form>
    </main>
  );
}
