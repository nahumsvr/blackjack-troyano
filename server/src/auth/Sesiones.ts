/** Autenticación persistente y registro atómico; usa el esquema y consultas existentes. */
import { SQL } from "bun";
import {
  EquipadoSchema, ErrorJuego, MensajeClienteSchema, TokenSchema,
  type BilleteraEstado, type Equipado, type UsuarioVista,
} from "@blackjack/shared";
import { DINERO_INICIAL, EQUIPADO_INICIAL, FICHAS_INICIALES, SESION_DURACION_MS, TOKEN_BYTES } from "../config";
import { enTransaccion } from "../db/conexion";
import { consultarEstado } from "../store/consultas";

/** Sesión SQL; expiraEn es metadata interna y el transporte no la incluye en JSON. */
export interface Sesion {
  token: string;
  usuario: UsuarioVista;
  billetera: BilleteraEstado;
  equipado: Equipado;
  expiraEn: number;
}

/** Gestiona contraseñas Argon2id y tokens persistentes con vencimiento de siete días. */
export class Sesiones {
  /**
   * @param conexion - Pool PostgreSQL administrado por el proceso servidor.
   * @returns Servicio sin conexión global ni estado de mesas.
   */
  constructor(private readonly conexion: SQL) {}

  /**
   * Crea usuario, inventario, libro contable y sesión en una única transacción.
   * @param usuario - Nombre que cumple el contrato compartido.
   * @param contrasena - Contraseña validada; solo se persiste su hash Argon2id.
   * @returns Sesión confirmada con los saldos y artículos de bienvenida.
   * @throws ErrorJuego MENSAJE_INVALIDO | USUARIO_EXISTE | ERROR_INTERNO; propaga fallos SQL.
   */
  async registrar(usuario: string, contrasena: string): Promise<Sesion> {
    this.validarCredenciales(usuario, contrasena);
    const hash = await Bun.password.hash(contrasena, { algorithm: "argon2id" });
    try {
      return await enTransaccion(this.conexion, async (sql) => {
        const gratuitos = await sql<{ id: string; tipo: string }[]>`
          SELECT id, tipo FROM articulos WHERE activo AND precio = 0
          AND id IN (${EQUIPADO_INICIAL.avatar}, ${EQUIPADO_INICIAL.reverso}, ${EQUIPADO_INICIAL.tema}) FOR SHARE
        `;
        if (!Object.entries(EQUIPADO_INICIAL).every(([tipo, id]) => gratuitos.some((articulo) => articulo.id === id && articulo.tipo === tipo))) {
          throw new ErrorJuego("ERROR_INTERNO");
        }
        const [nuevo] = await sql<UsuarioVista[]>`
          INSERT INTO usuarios (usuario, hash, dinero, fichas, avatar_id, reverso_id, tema_id)
          VALUES (${usuario}, ${hash}, ${DINERO_INICIAL}, ${FICHAS_INICIALES},
            ${EQUIPADO_INICIAL.avatar}, ${EQUIPADO_INICIAL.reverso}, ${EQUIPADO_INICIAL.tema}) RETURNING id, usuario
        `;
        if (!nuevo) throw new ErrorJuego("ERROR_INTERNO");
        await sql`INSERT INTO inventario (usuario_id, articulo_id) VALUES
          (${nuevo.id}, ${EQUIPADO_INICIAL.avatar}), (${nuevo.id}, ${EQUIPADO_INICIAL.reverso}), (${nuevo.id}, ${EQUIPADO_INICIAL.tema})`;
        await sql`INSERT INTO movimientos (usuario_id, tipo, delta_dinero, delta_fichas, dinero_despues, fichas_despues)
          VALUES (${nuevo.id}, 'registro', ${DINERO_INICIAL}, ${FICHAS_INICIALES}, ${DINERO_INICIAL}, ${FICHAS_INICIALES})`;
        return this.crearSesion(sql, nuevo);
      });
    } catch (error) {
      // La restricción UNIQUE resuelve también dos registros simultáneos del mismo nombre.
      if (error instanceof SQL.PostgresError && error.errno === "23505" && error.constraint === "usuarios_usuario_key") {
        throw new ErrorJuego("USUARIO_EXISTE");
      }
      throw error;
    }
  }

  /**
   * Verifica la contraseña y crea un token independiente para esta conexión.
   * @param usuario - Nombre registrado.
   * @param contrasena - Contraseña sin persistir ni incluir en respuestas.
   * @returns Nueva sesión persistente del mismo usuario.
   * @throws ErrorJuego MENSAJE_INVALIDO | CREDENCIALES_INVALIDAS | ERROR_INTERNO.
   */
  async login(usuario: string, contrasena: string): Promise<Sesion> {
    this.validarCredenciales(usuario, contrasena);
    const [fila] = await this.conexion<(UsuarioVista & { hash: string })[]>`
      SELECT id, usuario, hash FROM usuarios WHERE usuario = ${usuario}
    `;
    if (!fila || !await Bun.password.verify(contrasena, fila.hash)) throw new ErrorJuego("CREDENCIALES_INVALIDAS");
    return enTransaccion(this.conexion, (sql) => this.crearSesion(sql, { id: fila.id, usuario: fila.usuario }));
  }

  /**
   * Recupera una sesión vigente sin modificar su fecha de expiración.
   * @param token - Token hexadecimal de 32 bytes.
   * @returns Identidad, billetera y artículos equipados actuales.
   * @throws ErrorJuego SESION_INVALIDA | ERROR_INTERNO.
   */
  async validar(token: string): Promise<Sesion> {
    if (!TokenSchema.safeParse(token).success) throw new ErrorJuego("SESION_INVALIDA");
    return enTransaccion(this.conexion, async (sql) => {
      const [usuario] = await sql<UsuarioVista[]>`
        SELECT u.id, u.usuario FROM sesiones s JOIN usuarios u ON u.id = s.usuario_id
        WHERE s.token = ${token.toLowerCase()} AND s.expira_en > clock_timestamp()
      `;
      if (!usuario) throw new ErrorJuego("SESION_INVALIDA");
      return this.datosPublicos(sql, token.toLowerCase(), usuario);
    });
  }

  /**
   * Revoca el token; no borra otras sesiones del mismo usuario.
   * @param token - Token de la conexión que cierra sesión.
   * @returns Confirmación de la eliminación persistente.
   * @throws ErrorJuego SESION_INVALIDA si el formato es inválido; propaga fallos SQL.
   */
  async cerrar(token: string): Promise<void> {
    if (!TokenSchema.safeParse(token).success) throw new ErrorJuego("SESION_INVALIDA");
    await this.conexion`DELETE FROM sesiones WHERE token = ${token.toLowerCase()}`;
  }

  private validarCredenciales(usuario: string, contrasena: string): void {
    if (!MensajeClienteSchema.safeParse({ type: "login", usuario, contrasena }).success) throw new ErrorJuego("MENSAJE_INVALIDO");
  }

  private async crearSesion(sql: SQL, usuario: UsuarioVista): Promise<Sesion> {
    const token = Buffer.from(crypto.getRandomValues(new Uint8Array(TOKEN_BYTES))).toString("hex");
    await sql`INSERT INTO sesiones (token, usuario_id, expira_en)
      VALUES (${token}, ${usuario.id}, clock_timestamp() + ${SESION_DURACION_MS} * INTERVAL '1 millisecond')`;
    return this.datosPublicos(sql, token, usuario);
  }

  private async datosPublicos(sql: SQL, token: string, usuario: UsuarioVista): Promise<Sesion> {
    const [fila] = await sql<{ avatar: string | null; reverso: string | null; tema: string | null; expira_en: Date }[]>`
      SELECT u.avatar_id AS avatar, u.reverso_id AS reverso, u.tema_id AS tema, s.expira_en
      FROM usuarios u JOIN sesiones s ON s.usuario_id = u.id
      WHERE u.id = ${usuario.id} AND s.token = ${token}
    `;
    if (!fila) throw new ErrorJuego("SESION_INVALIDA");
    const equipado = EquipadoSchema.safeParse({ avatar: fila.avatar, reverso: fila.reverso, tema: fila.tema });
    if (!equipado.success) throw new ErrorJuego("ERROR_INTERNO");
    return { token, usuario, billetera: await consultarEstado(sql, usuario.id), equipado: equipado.data, expiraEn: fila.expira_en.getTime() };
  }
}
