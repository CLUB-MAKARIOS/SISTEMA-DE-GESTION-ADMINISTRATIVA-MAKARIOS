# 🏹 Club Makarios · Sistema de gestión

Gestión de socios, cuentas por cobrar, pagos, alertas de mora y bitácora, con **inicio de sesión**,
**recuperación de contraseña** y **contraseñas temporales** para usuarios nuevos.
Los datos se guardan en **PostgreSQL**.

## Contenido

| Archivo | Para qué sirve |
|---|---|
| `server.js` | Servidor (Node.js). Conecta con PostgreSQL y valida el inicio de sesión |
| `public/index.html` | La aplicación (pantallas) |
| `public/auth-core.js` | Reglas de contraseñas (las usa el servidor y la página) |
| `public/config.js` | Indica si se usa el servidor o el modo local de demostración |
| `schema.sql` | Script de la base de datos (opcional: el servidor crea la tabla solo) |
| `.env.example` | Plantilla de configuración (conexión a PostgreSQL) |

---

## 1. Requisitos (una sola vez)

1. **PostgreSQL** instalado (ya lo tienes). Recuerda la contraseña del usuario `postgres`.
2. **Node.js 18 o superior**: descárgalo de <https://nodejs.org> (versión LTS) e instálalo.
3. **Git** (para subir a GitHub): <https://git-scm.com> — o, si prefieres algo visual, **GitHub Desktop**: <https://desktop.github.com>.

## 2. Crear la base de datos

Abre **pgAdmin** (o la consola `psql`) y ejecuta:

```sql
CREATE DATABASE club_makarios;
```

No hace falta crear tablas: el servidor las crea al arrancar.

## 3. Configurar y arrancar

En la carpeta del proyecto (abre una terminal/PowerShell ahí):

```bash
npm install
```

Copia `.env.example` con el nombre `.env` y edita la línea de conexión con tu contraseña de PostgreSQL:

```
DATABASE_URL=postgres://postgres:TU_CONTRASEÑA@localhost:5432/club_makarios
```

> Si tu contraseña tiene símbolos como `@`, `#` o `/`, escríbelos codificados (`@` → `%40`, `#` → `%23`, `/` → `%2F`).

Arranca el sistema:

```bash
npm start
```

Abre <http://localhost:3000> en el navegador. Desde otras computadoras de la misma red usa
`http://IP-DE-ESTA-PC:3000` (puede que tengas que permitir el puerto 3000 en el Firewall de Windows).

## 4. Primer ingreso

1. La primera vez aparece **«Primera configuración»**: crea el usuario y la contraseña del administrador, y elige una pregunta de seguridad.
2. En **Usuarios y categorías → Nuevo usuario** crea a cada persona con una **contraseña temporal** (la sugerida o una predeterminada que tú escribas, por ejemplo la misma para todos).
3. Entrega a cada persona su usuario y la contraseña temporal.
4. En su primer ingreso, el sistema le obliga a **crear su propia contraseña** y una **pregunta de seguridad**.

## 5. Contraseñas

- **¿Olvidaste tu contraseña?** (en la pantalla de inicio): la persona responde su pregunta de seguridad y crea una nueva contraseña. Tras 3 respuestas incorrectas se bloquea 15 minutos.
- Si alguien no recuerda ni la respuesta, el administrador puede pulsar **«Asignar temporal»** en su ficha; deberá cambiarla al entrar.
- **Mi cuenta**: cada usuario puede cambiar su contraseña y su pregunta de seguridad.
- Reglas: mínimo 8 caracteres, con letras y números. Tras 5 intentos fallidos de inicio de sesión se bloquea 1 minuto.
- La sesión se cierra sola tras 30 minutos sin actividad.

**Seguridad:** las contraseñas se guardan cifradas (hash con sal), nunca en texto. El servidor valida
el inicio de sesión y no envía los hashes al navegador. Cada usuario solo puede modificar las
secciones para las que tiene permiso.

## 6. Subir a GitHub

1. Entra a <https://github.com> → **New repository** → nombre `club-makarios` → márcalo **Private** → **Create repository** (sin README).
2. En la carpeta del proyecto ejecuta (cambia `TU-USUARIO`):

```bash
git init
git add .
git commit -m "Club Makarios con inicio de sesión y PostgreSQL"
git branch -M main
git remote add origin https://github.com/TU-USUARIO/club-makarios.git
git push -u origin main
```

El archivo `.env` (con tu contraseña de PostgreSQL) **no se sube**: está excluido en `.gitignore`.

> **Importante sobre GitHub Pages:** GitHub solo guarda el código y puede mostrar páginas estáticas;
> **no ejecuta el servidor ni se conecta a tu PostgreSQL**. Para que el sistema funcione con la base
> de datos, el servidor (`npm start`) debe estar encendido en tu computadora o en un servidor/hosting
> con Node.js (por ejemplo Render, Railway o un VPS).

## 7. Copias de seguridad

Respalda la base de datos periódicamente desde pgAdmin (clic derecho en `club_makarios` → **Backup**) o con:

```bash
pg_dump -U postgres club_makarios > respaldo_club_makarios.sql
```

## Modo demostración (sin servidor)

En `public/config.js` cambia a `window.CLUB_CONFIG = { api: 'local' };` y abre `public/index.html`
directamente. Los datos se guardan solo en ese navegador. Útil para probar o para GitHub Pages.
