# T-38: producción por HTTP en LAN

Verificación del 6 de octubre de 2026, 21:54 CDMX, sobre `main` base `8bfe554` con la corrección de UUID del cliente.

```bash
bun run build
bun run start
# En otra terminal de la máquina servidor, desde la misma copia con client/dist, con tres asientos libres en mesa-1:
bun run verificar:produccion http://192.168.100.6:3000 docs/evidencia/t38/produccion.json
```

[produccion.json](produccion.json) registra HTTP 200, MIME/caché, hashes de assets idénticos al build local y una ronda común de tres bots por el mismo host y puerto. El script crea cuentas y movimientos reales; no reinicia la base. Tras una desconexión, los asientos pueden quedar reservados 60 s.

El usuario confirmó que la página abre desde dos dispositivos. Reportó que el registro fallaba con el aviso de error inesperado. La regresión `server/test/lanHttpReal.test.ts` reproduce un cliente sin `crypto.randomUUID`: falló antes de la corrección y ahora registra, compra dos veces y lista mesas contra PostgreSQL real. El cliente genera UUID v4 mediante `crypto.getRandomValues`, disponible por HTTP en LAN.

Aceptación humana: después de solicitar recarga, registro y ronda, el usuario confirmó que funcionó desde dos dispositivos distintos y autorizó el PR. `otraLaptopVerificada: false` en el JSON corresponde únicamente a la ejecución automática; esta confirmación posterior se registra aquí.
