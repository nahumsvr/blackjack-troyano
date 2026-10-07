# Imagen de la aplicación: compila el cliente y sirve cliente + WebSocket por el puerto 3000.
# La versión de Bun coincide con "packageManager" de package.json.
FROM oven/bun:1.3.13

WORKDIR /app
COPY . .
# --frozen-lockfile: instala exactamente lo de bun.lock; las devDependencies hacen falta para vite build.
RUN bun install --frozen-lockfile && bun run build

EXPOSE 3000
CMD ["bun", "server/src/index.ts"]
