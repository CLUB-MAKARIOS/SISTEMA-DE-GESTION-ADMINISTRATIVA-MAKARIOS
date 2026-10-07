# Club Makarios · Gestión

La página vive en `docs/`. El servidor (`server.js`) es opcional y solo se necesita para compartir datos entre varias personas.

## Publicar en GitHub Pages
```bash
git init && git add . && git commit -m "Primera versión"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/club-makarios.git
git push -u origin main
```
En GitHub: **Settings → Pages → Build and deployment → Deploy from a branch → `main` / carpeta `/docs` → Save.**
Tu sitio quedará en `https://TU_USUARIO.github.io/club-makarios/` (tarda 1–2 minutos).

⚠ En modo `local` cada navegador guarda sus propios datos: no se comparten entre personas ni dispositivos, y se pierden si se borran los datos del navegador.

## Compartir datos con Railway (opcional)
1. Despliega este repo en Railway con PostgreSQL y las variables:
   - `DATABASE_URL` = `${{Postgres.DATABASE_URL}}`
   - `APP_PASSWORD` = contraseña larga
   - `CORS_ORIGIN` = `https://TU_USUARIO.github.io` (solo el dominio, sin ruta)
2. En `docs/config.js` cambia `api` por la URL de Railway y haz `git push`.
3. La app pedirá la contraseña al abrir.

## Local
```bash
npm install
cp .env.example .env && npm run dev   # http://localhost:3000
```
