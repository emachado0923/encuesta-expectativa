# Encuesta de expectativas · Sapiencia

Formulario web de la encuesta de expectativas de estudiantes de grado 11 de
Medellín. Está hecho en Next.js, con TypeScript y React, y guarda en la base
MySQL de la entidad. Está pensado para desplegarse en una máquina virtual de la
entidad.

**Estado:** el código está completo y conectado a la base de datos de la
entidad. En la base ya se creó lo siguiente:

- La base `planeacionbd`.
- Las tablas.
- El usuario de la aplicación.
- La clave de la encuesta.
- Un estudiante de prueba.

Falta desplegarlo (ver [Desplegar en la máquina virtual](#desplegar-en-la-máquina-virtual))
y lo de [Antes de salir a campo](#antes-de-salir-a-campo).

## Qué falta para entregarlo

**Quien despliega necesita:**

1. **El código:** esta carpeta, sin `node_modules`, `.next` ni `.env`. Lo ideal
   es entregarlo en un repositorio de la entidad.
2. **Las credenciales, por un canal seguro, nunca en el repositorio ni en este
   archivo:**
   - La contraseña del usuario `encuesta_app` de la base.
   - La clave de la encuesta, solo para quien la reparte a los funcionarios.
3. **Acceso de la máquina virtual a la base:** la base está en Google Cloud SQL
   y solo acepta conexiones desde direcciones autorizadas. Hay que autorizar la
   IP pública de la máquina virtual. Hoy solo está autorizada la del equipo de
   desarrollo.
4. **Un dominio o subdominio con HTTPS**, apuntando a la máquina virtual.
5. **Recomendado:** el certificado del servidor de la base (`server-ca.pem`),
   para cifrar la conexión, que viaja por internet. Lo entrega quien administra
   Cloud SQL.

### Antes de salir a campo

- **Aviso de datos:** el texto de `AVISO_DATOS` en
  `src/lib/encuesta/instrumento.ts` es provisional. Debe revisarlo el área
  jurídica, en especial la autorización para menores de edad.
- **Lista de estudiantes:** cargar la real en la tabla `cedulas` (ver
  [Base de datos](#base-de-datos)).
- **Datos de prueba:** borrar el estudiante de prueba y las respuestas de prueba
  (ver [Base de datos](#base-de-datos)).
- **Clave:** confirmar la definitiva. Si se compartió por chat o correo,
  cambiarla (ver [La clave de la encuesta](#la-clave-de-la-encuesta)).
- **Política de datos:** poner la URL en `INSTRUMENTO.politicaUrl`. Mientras
  esté vacía, el enlace no aparece.
- **Rangos:**
  - Fecha de nacimiento: desde 1960 hasta hoy.
  - Documentos colombianos: de 4 a 15 dígitos.
  - Documentos extranjeros: de 4 a 20 caracteres.

  Confirmar que cubren a todos.

## Correr el proyecto en un computador

Sirve para desarrollar y probar.

- **Node.js 22.12 o superior.** Se revisa con `node -v`.
- **Acceso a la base de la entidad.** La IP pública del computador debe estar
  autorizada en Cloud SQL.

```bash
npm install
cp .env.example .env
```

En `.env` pon la contraseña de `encuesta_app` **entre comillas simples**, por
ejemplo `MYSQL_PASSWORD='la-contraseña'`. Sin comillas, un `#` o un `$` en la
contraseña hacen que llegue vacía o recortada. Luego:

```bash
npm run dev
```

Abre <http://localhost:3000>. Para probar:

- **Estudiante de la lista:** documento **11111111111**, nacido el **01/09/2026**.
- **Sin estar en la lista:** cualquier otro número, y la clave de la encuesta.

Lo que se envíe queda guardado en la base de la entidad; hay que borrarlo antes
de salir a campo. Si cambias `src/servidor/` con `npm run dev` encendido,
reinícialo: la conexión a la base se crea una sola vez.

| Qué | Comando |
|---|---|
| Servidor de desarrollo | `npm run dev` |
| Pruebas | `npm test` |
| Revisar tipos y estilo del código | `npm run typecheck` y `npm run lint` |
| Compilar para producción | `npm run build` |
| Generar la clave cifrada | `npm run clave -- 'la clave'` |

## Desplegar en Google Cloud Run

Es el despliegue actual, en el proyecto `sapiencia-sis-dev-qa` (región
`us-central1`). Reemplaza a la máquina virtual de la sección siguiente.

- **Servicio:** `encuesta-expectativas` en Cloud Run, con la imagen del
  `Dockerfile`.
- **Pipeline:** cada push a `main` en GitHub dispara Cloud Build
  (`cloudbuild.yaml`, trigger `encuesta-expectativas` en us-central1). Compila la imagen, la sube a Artifact Registry y
  despliega una revisión nueva. La configuración del servicio no cambia.
- **Salida a la base con IP fija:** el servicio sale por la red
  `encuesta-vpc` y el Cloud NAT `encuesta-nat`, con la IP `35.223.250.210`.
  Esa es la IP que hay que autorizar en Cloud SQL.
- **Contraseña:** en Secret Manager (`encuesta-mysql-password`), expuesta
  como `MYSQL_PASSWORD`. Las demás variables `MYSQL_*` están en el servicio.
- **Dominio:** `encuesta-expectativa.sapiencia.gov.co`, por un balanceador
  HTTPS global con certificado administrado por Google. En el DNS de
  sapiencia.gov.co debe haber un registro A hacia la IP del balanceador
  (`encuesta-lb-ip`).

Cambiar una variable (no hace falta volver a compilar):

```bash
gcloud run services update encuesta-expectativas --region=us-central1 \
  --project=sapiencia-sis-dev-qa --update-env-vars=MYSQL_CONEXIONES=10
```

Los registros se ven en Cloud Run › encuesta-expectativas › Registros.

## Desplegar en la máquina virtual

Guía para quien despliega. Supone Ubuntu Server 24.04 LTS, con 2 procesadores,
4 GB de RAM y 40 GB de disco, y un usuario con `sudo`. En los comandos,
reemplaza `DOMINIO` por el dominio o subdominio asignado.

La aplicación se sirve en la **raíz** de un dominio o subdominio (por ejemplo,
`https://encuesta.ejemplo.gov.co`). Si se quiere bajo una ruta
(`https://ejemplo.gov.co/encuesta`), hay que hacer cambios en el código:

- Configurar `basePath` en `next.config.ts`.
- Anteponer esa ruta a las direcciones de la API, a las fuentes y a los logos.

### 1. Preparar la máquina

```bash
# Node.js 24 (LTS), Nginx y Certbot (certificados HTTPS)
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt-get install -y nodejs nginx certbot python3-certbot-nginx

# Un usuario sin privilegios para correr la aplicación
sudo useradd --system --home /opt/encuesta --shell /usr/sbin/nologin encuesta

# Firewall: entran solo web (80 y 443) y SSH (idealmente restringido a la VPN)
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

La máquina también debe poder salir al servidor de la base: puerto 3306 de
35.202.252.42. Y su IP pública tiene que estar autorizada en Cloud SQL.

### 2. Copiar el código y configurar

```bash
sudo mkdir -p /opt/encuesta
# Copia aquí el código: git clone <repositorio> /opt/encuesta, o descomprime el archivo entregado.
cd /opt/encuesta
sudo cp .env.example .env
sudo nano .env            # poner la contraseña de encuesta_app entre comillas simples
sudo chmod 600 .env
```

**Recomendado:** para cifrar la conexión con la base, copia el certificado del
servidor en `/opt/encuesta/server-ca.pem` y agrega esta línea en `.env`:

```
MYSQL_SSL_CA=/opt/encuesta/server-ca.pem
```

### 3. Compilar

```bash
cd /opt/encuesta
sudo npm ci
sudo npm run build
sudo chown -R encuesta:encuesta /opt/encuesta
```

- `npm run build` genera en `.next/standalone` un servidor de Node autónomo,
  y copia ahí los archivos públicos y el `.env`.
- **Ojo:** el servidor usa la copia del `.env` que quedó al compilar. Si cambias
  `.env`, vuelve a compilar, o cópialo con `cp .env .next/standalone/.env`, y
  reinicia el servicio.

### 4. El servicio

Crea `/etc/systemd/system/encuesta.service`:

```ini
[Unit]
Description=Encuesta de expectativas (Sapiencia)
After=network.target

[Service]
User=encuesta
WorkingDirectory=/opt/encuesta/.next/standalone
Environment=NODE_ENV=production
Environment=PORT=3000
Environment=HOSTNAME=127.0.0.1
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now encuesta
sudo systemctl status encuesta
```

El servidor escucha solo en `127.0.0.1:3000`: desde afuera se entra por Nginx.

### 5. Nginx y HTTPS

Crea `/etc/nginx/sites-available/encuesta`:

```nginx
server {
    listen 80;
    server_name DOMINIO;

    # Una encuesta completa pesa unos 2 KB; la aplicación acepta hasta 32 KB.
    client_max_body_size 64k;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/encuesta /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d DOMINIO     # HTTPS con Let's Encrypt; renueva solo
```

Si la entidad tiene su propio certificado para el dominio, úsalo en lugar de
Certbot. La encuesta se puede incrustar en páginas de sapiencia.gov.co; ningún
otro sitio puede hacerlo.

### 6. Verificar

```bash
curl -s https://DOMINIO/api/salud
```

Debe responder `{"aplicacion":"ok","baseDeDatos":"ok"}`. Después abre el sitio
y haz una encuesta con el estudiante de prueba. Esa respuesta de prueba hay que
borrarla después.

### Actualizar a una versión nueva

```bash
cd /opt/encuesta
sudo git pull                  # o copia los archivos nuevos, sin tocar .env
sudo npm ci && sudo npm run build
sudo chown -R encuesta:encuesta /opt/encuesta
sudo systemctl restart encuesta
```

### Registros y problemas comunes

Los registros del servicio se ven con `sudo journalctl -u encuesta -f`.

| Síntoma | Causa probable | Qué hacer |
|---|---|---|
| `/api/salud` dice `sin conexión` y el registro muestra `ETIMEDOUT` | La IP de la máquina no está autorizada en Cloud SQL | Pedir que la autoricen |
| El registro dice `Access denied … (using password: NO)` | La contraseña llega vacía: tiene `#` o `$` sin comillas | Ponerla entre comillas simples y volver a compilar |
| El registro dice `Access denied … (using password: YES)` | Usuario o contraseña equivocados | Revisarlos con quien administra la base |
| El registro dice `HANDSHAKE_SSL_ERROR` | `MYSQL_SSL_CA` no es el certificado de esa instancia | Pedir el `server-ca.pem` correcto |
| Al enviar, el navegador recibe 413 | Nginx limita el tamaño | Revisar `client_max_body_size 64k` |
| Se cambió `.env` y no cambió nada | El servidor usa la copia hecha al compilar | Volver a compilar y reiniciar |

## La clave de la encuesta

**Para qué sirve.** Quien está en la lista de estudiantes entra con su
documento y su fecha de nacimiento. Quien no está, o no tiene documento,
necesita la clave de la encuesta. La tienen los funcionarios que acompañan la
aplicación en los colegios. Es una sola para todos.

**Cómo se guarda: cifrada.**

- Va en la tabla `claves`, columnas `nombre` y `clave_hash`, en la fila
  `encuesta_expectativas_2026`.
- Lo que se guarda es un hash scrypt con sal, no la clave. Ni quien tenga
  acceso a la base ni quien tenga una copia de ella puede leerla.
- La clave tampoco queda en las respuestas ni en los registros del servidor.
- Si se olvida, no se recupera: se genera una nueva.

**Para ponerla o cambiarla:**

1. En la carpeta del proyecto, genera la instrucción. La clave debe tener
   entre 8 y 100 caracteres, sin espacios al inicio ni al final:

   ```bash
   npm run clave -- 'la-clave-nueva'
   ```

   **Con comillas simples**, como en el ejemplo. Entre comillas dobles, la
   terminal cambia los signos `!` y `$` antes de cifrar, y la base guardaría
   otra clave (la encuesta diría que la clave no es correcta).

   Imprime algo así (el hash cambia cada vez, aunque la clave sea la misma):

   ```sql
   -- Ejecutar en la base de la encuesta (reemplaza la clave anterior):
   REPLACE INTO claves (nombre, clave_hash) VALUES ('encuesta_expectativas_2026', 'scrypt$16384$8$1$...$...');
   ```

2. Ejecuta esa instrucción en `planeacionbd`, con un usuario administrador
   (TablePlus, MySQL Workbench). El usuario de la aplicación solo puede leer esa
   tabla, no cambiarla.

3. Listo: la clave nueva funciona de inmediato y la anterior deja de servir.

**Recomendaciones:**

- Que sea larga y al azar.
- Cambiarla en cada temporada de campo, o apenas se sospeche que se filtró.
- Compartirla solo con los funcionarios que acompañan la encuesta.

## Variables de entorno

Van en `.env`, que no se sube al repositorio porque tiene contraseñas.
`.env.example` es la plantilla, ya con los datos de la base de la entidad salvo
la contraseña.

| Variable | Para qué | Valor |
|---|---|---|
| `MYSQL_HOST`, `MYSQL_PORT` | Servidor de MySQL | `35.202.252.42`, `3306` |
| `MYSQL_DATABASE` | Base de la encuesta | `planeacionbd` |
| `MYSQL_USER` | Usuario de la aplicación, con permisos mínimos | `encuesta_app` |
| `MYSQL_PASSWORD` | Su contraseña, **entre comillas simples** | Se entrega aparte |
| `MYSQL_SSL_CA` | Ruta del `server-ca.pem`: cifra la conexión y verifica el servidor | Recomendado |
| `MYSQL_SSL` | `true` cifra sin certificado propio (solo si el servidor tiene un certificado público) | `false` |
| `MYSQL_CONEXIONES` | Conexiones abiertas a la vez, como máximo | `10` |

## Cómo está armado

```
src/lib/encuesta/instrumento.ts   El cuestionario: preguntas, opciones, secciones, aviso de datos
src/lib/encuesta/logica.ts        Ruteo, validación y avance. Lo usan el navegador y el servidor
src/lib/encuesta/flujo.ts         El recorrido: qué pasa con cada acción de quien responde
src/lib/cliente/                  Borrador en sessionStorage y envío con reintentos
src/componentes/encuesta/         La interfaz en React: vistas, preguntas, avance y navegación
src/app/page.tsx                  La página de la encuesta
src/app/layout.tsx, globals.css   Cabecera, pie y estilos de la plantilla Sapiencia
src/app/api/validar/route.ts      POST /api/validar (documento y fecha, o la clave)
src/app/api/respuestas/route.ts   POST /api/respuestas (el envío)
src/app/api/salud/route.ts        GET /api/salud (la aplicación y la conexión a la base)
src/servidor/                     Validar y enviar, la conexión a MySQL y la clave cifrada
db/esquema.sql                    Tablas, restricciones y permisos de MySQL
scripts/                          Clave cifrada y prueba de carga
tests/                            Pruebas (vitest)
```

**La interfaz, en tres capas:**

- **`flujo.ts` decide.** Cada acción de quien responde (responder, siguiente,
  anterior, validar, enviar) es una función pura: recibe el estado y devuelve
  el siguiente, sin tocar la página ni la red. Por eso se prueba sin navegador.
- **`useEncuesta.ts` conecta.** Es el hook que guarda el estado, llama a la
  red, guarda el borrador en cada cambio y aplica el foco y el desplazamiento
  que pide cada acción.
- **Los componentes solo dibujan el estado.** Son `Portada.tsx` (bienvenida,
  aviso y final), `VistaEncuesta.tsx` (avance, números, pregunta y navegación)
  y `Campos.tsx` (cada tipo de campo y el paso de validación).

**El cuestionario es un solo archivo.** `instrumento.ts` tiene las 51 preguntas
del PDF con su texto exacto. El navegador dibuja lo que hay ahí y el servidor
valida contra lo mismo. Si cambian preguntas u opciones, hay que subir
`version`. Los `id` y los valores de las opciones son los nombres de las
variables en la base: no se cambian después de salir a campo.

**Reglas de validación** (en `src/servidor/almacen-mysql.ts`):

- Quien está en la lista (`cedulas`) entra solo con su fecha de nacimiento. La
  clave es para quien no está o no tiene documento.
- Tras 5 fechas equivocadas **distintas** para un mismo documento en 15
  minutos, el documento espera. Repetir la misma fecha no gasta intentos. El
  envío final cuenta para el mismo límite.
- Las comprobaciones de un mismo documento van de a una (la transacción
  bloquea su fila), para que muchas peticiones en paralelo no se salten el límite.
- Una sola respuesta por número de documento, con cualquier tipo de documento.
- El navegador genera el id del envío: un reintento trae el mismo id y no se
  duplica.

## Base de datos

La base es `planeacionbd`, en el servidor MySQL 8.0 de Google Cloud SQL de la
entidad (35.202.252.42). Allí ya se crearon las tablas con `db/esquema.sql` y
el usuario `encuesta_app`, con los permisos que indica el final de ese archivo.
Las tablas son cuatro:

- `respuestas`: una fila por persona, con las respuestas en una columna JSON.
- `cedulas`: la lista de estudiantes.
- `claves`: la clave cifrada.
- `intentos_validacion`: para el límite de intentos.

Las fechas y horas se guardan en UTC.

**Cargar la lista de estudiantes.** Va en `cedulas (cedula, fecha_nacimiento)`.
Se puede cargar con el asistente de importación de TablePlus o de MySQL
Workbench, desde un CSV:

- El número va sin puntos, comas ni espacios, en mayúsculas si tiene letras.
- La fecha va como AAAA-MM-DD.

La base rechaza los números con otro formato.

**Borrar los datos de prueba antes de salir a campo** (con un usuario
administrador: la aplicación no puede borrar):

```sql
USE planeacionbd;
DELETE FROM respuestas;
DELETE FROM intentos_validacion;
DELETE FROM cedulas WHERE cedula = '11111111111';
```

**Consultas útiles:**

```sql
-- Cuántas por ruta
SELECT ruta, COUNT(*) FROM respuestas GROUP BY ruta ORDER BY 2 DESC;

-- Una columna por pregunta
SELECT id, ruta, enviada_en, respuestas->>'$.tiempo_formacion' AS tiempo_formacion FROM respuestas;
```

## Pruebas

- **`npm test`:** 80 pruebas del cuestionario, las reglas, el recorrido de la
  interfaz, los servicios, la clave y el esquema. No usan la base de datos.
- **`tests/mysql.test.ts`:** 9 pruebas más contra un MySQL de verdad, incluida
  la conexión cifrada. Crean y borran una base y un usuario temporales, así que
  **nunca deben apuntar a la base de la entidad**. Solo corren si se define
  `MYSQL_PRUEBAS` con un MySQL desechable, por ejemplo
  `MYSQL_PRUEBAS=mysql://root@127.0.0.1:3306 npm test`.
- **De punta a punta:** en un Chrome automatizado, contra el servidor compilado
  y contra `npm run dev`, pasan 74 comprobaciones:
  - El recorrido completo en computador y en celular.
  - La lista, la clave y sin documento.
  - Los avisos, el foco y el lector de pantalla.
  - Validar otra vez tras un 403, recargar a mitad de la encuesta y el
    documento repetido.
  - La consola, sin errores.
- **Prueba de carga** (`npm run carga`, en un MySQL de pruebas): 1.000 envíos con
  80 a la vez en 6,7 s, todos guardados, y los reintentos sin duplicados. No se
  corre contra la base de la entidad: escribe respuestas de prueba.

## Pendientes técnicos

- Dejar las pruebas de punta a punta dentro del proyecto, por ejemplo con
  Playwright. Hoy se corren con un script aparte.
- Cambiar `'unsafe-inline'` de la política de seguridad de contenido por un
  nonce (ver `next.config.ts`).
