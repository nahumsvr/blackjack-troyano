-- Persistencia de usuarios, economía e historial terminado (PLAN.md §4).
-- db:reset aplica este esquema junto al catálogo dentro de una transacción.

CREATE TABLE articulos (
    id varchar(40) PRIMARY KEY,
    tipo varchar(10) NOT NULL CHECK (tipo IN ('avatar', 'reverso', 'tema')),
    nombre varchar(60) NOT NULL,
    precio integer NOT NULL CHECK (precio >= 0),
    activo boolean NOT NULL DEFAULT true
);

CREATE TABLE usuarios (
    id serial PRIMARY KEY,
    usuario varchar(20) UNIQUE NOT NULL CHECK (usuario ~ '^[A-Za-z0-9_]{3,20}$'),
    hash text NOT NULL,
    dinero bigint NOT NULL DEFAULT 10000 CHECK (dinero >= 0),
    fichas bigint NOT NULL DEFAULT 0 CHECK (fichas >= 0),
    avatar_id varchar(40) REFERENCES articulos(id),
    reverso_id varchar(40) REFERENCES articulos(id),
    tema_id varchar(40) REFERENCES articulos(id),
    creado_en timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE sesiones (
    token char(64) PRIMARY KEY,
    usuario_id integer NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    creado_en timestamptz NOT NULL DEFAULT now(),
    expira_en timestamptz NOT NULL
);

CREATE TABLE inventario (
    usuario_id integer NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    articulo_id varchar(40) NOT NULL REFERENCES articulos(id),
    adquirido_en timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (usuario_id, articulo_id)
);

-- Solo inserciones en la aplicación: cada transacción de saldo deja su asiento.
CREATE TABLE movimientos (
    id bigserial PRIMARY KEY,
    usuario_id integer NOT NULL REFERENCES usuarios(id),
    tipo varchar(20) NOT NULL CHECK (
        tipo IN ('registro', 'compra_fichas', 'apuesta', 'pago', 'compra_articulo')
    ),
    delta_dinero bigint NOT NULL DEFAULT 0,
    delta_fichas bigint NOT NULL DEFAULT 0,
    dinero_despues bigint NOT NULL CHECK (dinero_despues >= 0),
    fichas_despues bigint NOT NULL CHECK (fichas_despues >= 0),
    referencia varchar(80),
    clave varchar(64),
    creado_en timestamptz NOT NULL DEFAULT now(),
    CHECK (delta_dinero <> 0 OR delta_fichas <> 0)
);

CREATE INDEX movimientos_usuario_tipo_fecha_idx
    ON movimientos (usuario_id, tipo, creado_en);
CREATE UNIQUE INDEX movimientos_usuario_clave_idx
    ON movimientos (usuario_id, clave) WHERE clave IS NOT NULL;

CREATE TABLE rondas (
    id uuid PRIMARY KEY,
    mesa_id varchar(20) NOT NULL,
    iniciada_en timestamptz NOT NULL,
    terminada_en timestamptz NOT NULL,
    cartas_dealer jsonb NOT NULL,
    total_dealer smallint NOT NULL
);

CREATE TABLE rondas_jugadores (
    ronda_id uuid NOT NULL REFERENCES rondas(id),
    usuario_id integer NOT NULL REFERENCES usuarios(id),
    asiento smallint NOT NULL CHECK (asiento BETWEEN 0 AND 4),
    apuesta integer NOT NULL CHECK (apuesta > 0),
    cartas jsonb NOT NULL,
    total smallint NOT NULL,
    resultado varchar(10) NOT NULL CHECK (
        resultado IN ('blackjack', 'gana', 'empate', 'pierde', 'pasado')
    ),
    pago integer NOT NULL CHECK (pago >= 0),
    PRIMARY KEY (ronda_id, usuario_id)
);
