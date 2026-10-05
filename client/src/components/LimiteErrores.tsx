/**
 * Límite de errores raíz (ErrorBoundary): si un componente lanza al renderizar,
 * se muestra una pantalla de recuperación en vez de dejar la página en blanco.
 * La conexión vive fuera de React, así que no se pierde al mostrar esta pantalla.
 */
import { Component, type ErrorInfo, type ReactNode } from "react";

/** Props del límite de errores. */
type PropsLimiteErrores = { children: ReactNode };
/** Estado interno: el error capturado, o `null` si todo va bien. */
type EstadoLimiteErrores = { error: Error | null };

/**
 * Captura excepciones de renderizado de sus hijos y ofrece recargar.
 * React exige un componente de clase para los límites de errores.
 */
export class LimiteErrores extends Component<PropsLimiteErrores, EstadoLimiteErrores> {
  override state: EstadoLimiteErrores = { error: null };

  /**
   * Guarda el error para mostrar la pantalla de recuperación en el siguiente render.
   * @param error - Excepción lanzada por un componente hijo.
   * @returns Nuevo estado con el error.
   */
  static getDerivedStateFromError(error: Error): EstadoLimiteErrores {
    return { error };
  }

  /**
   * Registra el error en consola para depurar; no se reenvía a ningún servicio.
   * @param error - Excepción capturada.
   * @param info - Pila de componentes donde ocurrió.
   */
  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("Error de renderizado:", error, info.componentStack);
  }

  override render(): ReactNode {
    if (this.state.error === null) return this.props.children;
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
        <h1 className="text-2xl font-bold">Algo salió mal</h1>
        <p className="text-emerald-200">La pantalla tuvo un error inesperado. Tu sesión y tu saldo están a salvo en el servidor.</p>
        <button
          type="button"
          className="rounded bg-amber-400 px-4 py-2 font-semibold text-emerald-950 hover:bg-amber-300"
          onClick={() => window.location.reload()}
        >
          Recargar
        </button>
      </main>
    );
  }
}
