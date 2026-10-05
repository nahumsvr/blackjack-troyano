/**
 * Componente raíz de la interfaz. Por ahora solo confirma que el esqueleto (T-10) funciona;
 * en T-11 y siguientes elige la pantalla (acceso, lobby, mesa…) según el estado global.
 */
import type { ReactNode } from "react";

/**
 * Pantalla provisional del esqueleto del cliente.
 * @returns Elemento con el título de la app.
 */
export function App(): ReactNode {
  return (
    <main className="flex min-h-screen items-center justify-center">
      <h1 className="text-3xl font-bold">Blackjack</h1>
    </main>
  );
}
