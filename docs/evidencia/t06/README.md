# Verificación visual T-06 — 5 oct 2026 CDMX

Se abrieron tres pestañas reales de Chromium 148.0.7778.96 mediante Playwright, con renderizado headless, usando `scripts/verificar-ws.html` sin modificarlo. El transporte probado corresponde a `main` en `831dcd2` (T-06 está fusionada desde PR #3).

Las tres pestañas conectaron a un servidor Bun iniciado con `iniciarServidor(0)`. Se asignó el puerto local 40857 para no ocupar ni detener el proceso ajeno que usa 3000. Las tres mostraron «Conectados: 3». Al cerrar la tercera, las dos restantes mostraron «Conectados: 2» en 32 ms, menor que el segundo exigido por T-06. Las capturas muestran el contenido renderizado; [resultado.json](resultado.json) conserva la medición.

| Pestaña | Antes de cerrar la tercera | Después |
|---|---|---|
| 1 | [Tres conexiones](t06-pestana-1-tres.png) | [Dos conexiones](t06-pestana-1-dos.png) |
| 2 | [Tres conexiones](t06-pestana-2-tres.png) | [Dos conexiones](t06-pestana-2-dos.png) |
| 3 | [Tres conexiones](t06-pestana-3-tres.png) | Pestaña cerrada |

Para repetir manualmente: iniciar desarrollo, abrir `scripts/verificar-ws.html` en tres pestañas, conectar a la dirección del servidor y cerrar una. El resultado esperado es 3 en las tres pestañas y luego 2 en las restantes. Esta comprobación acredita el transporte en una computadora; no sustituye T-13 (usuarios/lobby real) ni las pruebas LAN y de rondas.

El navegador y el servidor temporal se detuvieron al terminar.

## Aclaraciones de la revisión del 6 oct

El método fue Chromium con renderizado headless; las imágenes documentan el contenido de la página. Las capturas del mismo conteo son idénticas porque se abrió el mismo HTML sin etiquetas agregadas; los nombres corresponden a las tres páginas abiertas. No contienen la barra del navegador. La comprobación manual puede repetirse con las instrucciones anteriores para validar el criterio durante la revisión del equipo.

El empaquetador selecciona recursivamente `docs/`, por lo que estos PNG y la medición se incluyen en el ZIP. Su inclusión y el tamaño se comprobaron sobre esta rama. No se incluye aquí evidencia de mesas/economía de ramas de apoyo.
