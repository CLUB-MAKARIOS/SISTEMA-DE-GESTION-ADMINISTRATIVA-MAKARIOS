-- Club Makarios · Script de base de datos para PostgreSQL
-- 1) Crear la base de datos (ejecutar una sola vez, conectado como postgres):
--      CREATE DATABASE club_makarios;
-- 2) Conectarse a club_makarios y ejecutar lo siguiente.
--    (El servidor también crea esta tabla automáticamente al arrancar.)

CREATE TABLE IF NOT EXISTS app_state (
    id         integer     PRIMARY KEY,
    data       jsonb       NOT NULL DEFAULT '{}'::jsonb,
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Consultas útiles para revisar los datos desde pgAdmin o psql:
-- Socios:   SELECT s->>'codigo' AS codigo, s->>'nombre' AS nombre, s->>'cat' AS categoria
--           FROM app_state, jsonb_array_elements(data->'socios') s WHERE id = 1;
-- Usuarios: SELECT u->>'usuario' AS usuario, u->>'nombre' AS nombre, u->>'rol' AS rol
--           FROM app_state, jsonb_array_elements(data->'users') u WHERE id = 1;
