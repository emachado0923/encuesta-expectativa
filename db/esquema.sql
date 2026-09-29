-- Encuesta de expectativas · esquema de MySQL (8.0 o superior)
--
-- Lo ejecuta una vez quien administre la base, sobre la base asignada a la
-- encuesta (la de MYSQL_DATABASE en .env):
--
--   mysql -h <servidor> -u <administrador> -p <base> < db/esquema.sql
--
-- Cuatro tablas:
--   respuestas           una fila por persona que responde
--   cedulas              la lista de estudiantes que pueden responder
--   claves               la clave de la encuesta, cifrada, para quien no está en la lista
--   intentos_validacion  fechas equivocadas por documento, para el límite de intentos
--
-- Los valores de las listas (rutas y tipos de documento) salen de
-- src/lib/encuesta/instrumento.ts; tests/esquema.test.ts verifica que coincidan.
-- Las fechas y horas se guardan en UTC.

CREATE TABLE IF NOT EXISTS respuestas (
  id                  CHAR(36)     CHARACTER SET ascii COLLATE ascii_bin NOT NULL
                      COMMENT 'Lo genera el navegador al empezar: un reintento trae el mismo id y no duplica',
  instrumento         VARCHAR(40)  NOT NULL,
  version_instrumento VARCHAR(20)  NOT NULL,
  ruta                VARCHAR(20)  NOT NULL,
  tipo_documento      VARCHAR(40)  NOT NULL,
  numero_documento    VARCHAR(20)  CHARACTER SET ascii COLLATE ascii_bin NULL
                      COMMENT 'En mayúsculas, sin puntos ni espacios. NULL para quien no tiene documento',
  fecha_nacimiento    DATE         NOT NULL,
  respuestas          JSON         NOT NULL COMMENT 'Todas las respuestas, por id de pregunta',
  consentimiento_en   DATETIME(3)  NOT NULL COMMENT 'Cuándo aceptó el aviso de datos (UTC)',
  iniciada_en         DATETIME(3)  NULL,
  enviada_en          DATETIME(3)  NOT NULL,
  duracion_segundos   INT UNSIGNED NULL,
  PRIMARY KEY (id),
  -- Un número de documento responde una vez por instrumento, con cualquier tipo
  -- (una TI y una CC pueden tener el mismo número). Los NULL no chocan entre sí.
  UNIQUE KEY respuestas_un_numero (instrumento, numero_documento),
  KEY respuestas_enviada_en (enviada_en),
  CONSTRAINT respuestas_ruta CHECK (ruta IN ('estudiar', 'trabajar', 'estudiar_trabajar', 'indefinido')),
  CONSTRAINT respuestas_tipo_documento CHECK (tipo_documento IN (
    'registro_civil', 'tarjeta_identidad', 'cedula_ciudadania', 'pasaporte', 'documento_extranjero',
    'permiso_especial_permanencia', 'cedula_extranjeria', 'sin_documento'
  )),
  CONSTRAINT respuestas_numero_segun_tipo CHECK ((tipo_documento = 'sin_documento') = (numero_documento IS NULL))
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS cedulas (
  cedula           VARCHAR(20) CHARACTER SET ascii COLLATE ascii_bin NOT NULL
                   COMMENT 'Número de documento en mayúsculas, sin puntos ni espacios',
  fecha_nacimiento DATE        NOT NULL,
  PRIMARY KEY (cedula),
  CONSTRAINT cedulas_formato CHECK (REGEXP_LIKE(cedula, '^[A-Z0-9][A-Z0-9-]{2,18}[A-Z0-9]$', 'c'))
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS claves (
  nombre     VARCHAR(60)  NOT NULL COMMENT 'La encuesta usa la fila encuesta_expectativas_2026',
  clave_hash VARCHAR(255) CHARACTER SET ascii COLLATE ascii_bin NOT NULL
             COMMENT 'Hash scrypt de la clave, nunca la clave. Se genera con: npm run clave -- "la clave"',
  PRIMARY KEY (nombre)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS intentos_validacion (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  cedula       VARCHAR(20) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  fecha        DATE        NOT NULL COMMENT 'La fecha equivocada que se probó',
  intentado_en DATETIME(3) NOT NULL,
  PRIMARY KEY (id),
  KEY intentos_cedula (cedula, intentado_en)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- Opcional: al cargar la lista, los números se normalizan solos (mayúsculas, sin
-- puntos, comas ni espacios). Si la base no permite crear disparadores, la
-- lista debe cargarse ya normalizada: la restricción cedulas_formato rechaza
-- los números con puntos o espacios.
DROP TRIGGER IF EXISTS cedulas_normalizar_al_insertar;
CREATE TRIGGER cedulas_normalizar_al_insertar BEFORE INSERT ON cedulas FOR EACH ROW
  SET NEW.cedula = UPPER(REGEXP_REPLACE(NEW.cedula, '[[:space:].,]', ''));
DROP TRIGGER IF EXISTS cedulas_normalizar_al_actualizar;
CREATE TRIGGER cedulas_normalizar_al_actualizar BEFORE UPDATE ON cedulas FOR EACH ROW
  SET NEW.cedula = UPPER(REGEXP_REPLACE(NEW.cedula, '[[:space:].,]', ''));

-- Usuario de la aplicación, con lo mínimo que necesita. Lo crea quien administre
-- MySQL; cambiar <base>, el host y la contraseña:
--
--   CREATE USER 'encuesta_app'@'<ip de la máquina virtual>' IDENTIFIED BY '<me preguntan por la clave todo bien >';
--   GRANT SELECT, INSERT         ON <base>.respuestas          TO 'encuesta_app'@'<ip>';
--   GRANT SELECT                 ON <base>.cedulas             TO 'encuesta_app'@'<ip>';
--   GRANT SELECT                 ON <base>.claves              TO 'encuesta_app'@'<ip>';
--   GRANT SELECT, INSERT, DELETE ON <base>.intentos_validacion TO 'encuesta_app'@'<ip>';
--   -- Para bloquear la fila de un documento mientras se valida (SELECT ... FOR UPDATE):
--   GRANT LOCK TABLES            ON <base>.*                   TO 'encuesta_app'@'<ip>';
