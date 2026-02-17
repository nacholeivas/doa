-- ═══════════════════════════════════════════════════════════════
-- SCHEMA DE BASE DE DATOS - Atlantis MMO DoA Style
-- Tablas: users, cities, marches, map_tiles, regions, alliances
-- ═══════════════════════════════════════════════════════════════

-- Crear DB (ejecutar antes de conectar)
-- CREATE DATABASE atlantis_game;
-- \c atlantis_game;

-- ════════════════════════════════════════════════════════════════
-- TABLA: users
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  username      VARCHAR(50)  UNIQUE NOT NULL,
  email         VARCHAR(100) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  is_active     BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMP DEFAULT NOW(),
  last_login    TIMESTAMP
);

-- ════════════════════════════════════════════════════════════════
-- TABLA: alliances
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS alliances (
  id             SERIAL PRIMARY KEY,
  name           VARCHAR(100) UNIQUE NOT NULL,
  tag            VARCHAR(10)  UNIQUE NOT NULL,   -- [TAG]
  leader_user_id INTEGER NOT NULL REFERENCES users(id),
  description    TEXT,
  created_at     TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS alliance_members (
  id           SERIAL PRIMARY KEY,
  alliance_id  INTEGER NOT NULL REFERENCES alliances(id) ON DELETE CASCADE,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role         VARCHAR(20) DEFAULT 'member',    -- leader | officer | member
  joined_at    TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id)                               -- un jugador → una alianza
);

-- ════════════════════════════════════════════════════════════════
-- TABLA: cities
-- Una por coordenada (UNIQUE x,y garantiza colisión imposible)
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS cities (
  id           SERIAL PRIMARY KEY,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  x            INTEGER NOT NULL,
  y            INTEGER NOT NULL,
  name         VARCHAR(100) NOT NULL,

  -- Región determinada por generación procedural al crear/teleportar
  region       VARCHAR(20) NOT NULL DEFAULT 'plains',

  -- Progresión
  level        INTEGER DEFAULT 1,
  power        INTEGER DEFAULT 100,
  population   INTEGER DEFAULT 0,

  -- Recursos almacenados
  wood         BIGINT DEFAULT 500,
  food         BIGINT DEFAULT 500,
  stone        BIGINT DEFAULT 500,
  metal        BIGINT DEFAULT 500,
  gold         BIGINT DEFAULT 100,

  -- Alianza (opcional)
  alliance_id  INTEGER REFERENCES alliances(id) ON DELETE SET NULL,

  created_at   TIMESTAMP DEFAULT NOW(),
  last_updated TIMESTAMP DEFAULT NOW(),

  -- ⚡ Solo una ciudad por coordenada
  UNIQUE(x, y)
);

-- Índices para búsqueda espacial rápida (miles de jugadores)
CREATE INDEX IF NOT EXISTS idx_cities_xy       ON cities(x, y);
CREATE INDEX IF NOT EXISTS idx_cities_user     ON cities(user_id);
CREATE INDEX IF NOT EXISTS idx_cities_region   ON cities(region);
CREATE INDEX IF NOT EXISTS idx_cities_power    ON cities(power DESC);
CREATE INDEX IF NOT EXISTS idx_cities_alliance ON cities(alliance_id);

-- ════════════════════════════════════════════════════════════════
-- TABLA: marches  (tropas en movimiento)
-- status: marching → arrived → returning → completed
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS marches (
  id             SERIAL PRIMARY KEY,
  user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  from_city_id   INTEGER NOT NULL REFERENCES cities(id) ON DELETE CASCADE,

  -- Coordenadas absolutas (no FK, el destino puede no tener ciudad)
  from_x         INTEGER NOT NULL,
  from_y         INTEGER NOT NULL,
  to_x           INTEGER NOT NULL,
  to_y           INTEGER NOT NULL,

  -- Tipo de destino detectado al enviar
  target_type    VARCHAR(20) NOT NULL, -- city | resource | npc | empty

  -- Tipo de marcha
  march_type     VARCHAR(20) NOT NULL, -- attack | transport | reinforce | scout

  -- Tropas y recursos como JSON flexible
  troops         JSONB NOT NULL DEFAULT '{}',
  resources      JSONB          DEFAULT '{}',

  -- Velocidad usada para calcular tiempos
  speed          NUMERIC(6,2) DEFAULT 1.0,

  -- Timestamps de la marcha (asincrónicos, sin movimiento real-time)
  departure_time TIMESTAMP NOT NULL DEFAULT NOW(),
  arrival_time   TIMESTAMP NOT NULL,
  return_time    TIMESTAMP,

  -- Estado actual
  status         VARCHAR(20) NOT NULL DEFAULT 'marching',
                 -- marching | arrived | returning | completed | cancelled

  -- Resultado del combate (se llena al procesar)
  battle_result  JSONB,

  created_at     TIMESTAMP DEFAULT NOW()
);

-- Índices críticos para consultas de marchas activas
CREATE INDEX IF NOT EXISTS idx_marches_user    ON marches(user_id);
CREATE INDEX IF NOT EXISTS idx_marches_status  ON marches(status);
CREATE INDEX IF NOT EXISTS idx_marches_arrival ON marches(arrival_time);
CREATE INDEX IF NOT EXISTS idx_marches_city    ON marches(from_city_id);

-- ════════════════════════════════════════════════════════════════
-- TABLA: map_tiles  (tiles especiales que SOBREESCRIBEN el procedural)
-- Solo se guardan los tiles modificados por eventos, admin, etc.
-- El 99.9% del mapa es procedural (no en DB).
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS map_tiles (
  id           SERIAL PRIMARY KEY,
  x            INTEGER NOT NULL,
  y            INTEGER NOT NULL,

  -- Sobreescribe la región procedural si no es NULL
  region       VARCHAR(20),

  -- Sobreescribe wild/camp procedural
  wild_type    VARCHAR(20),     -- wood | food | stone | metal | gold | NULL
  wild_level   INTEGER,
  camp_type    VARCHAR(30),     -- anthropus_camp | dark_citadel | NULL
  camp_level   INTEGER,
  camp_power   INTEGER,

  -- Tiles especiales de eventos
  special_type VARCHAR(50),     -- relic | portal | ruin | event_zone
  special_data JSONB,

  -- Estado
  is_depleted  BOOLEAN DEFAULT FALSE,
  depleted_at  TIMESTAMP,
  respawn_at   TIMESTAMP,

  -- Quién interactuó por última vez
  last_user_id INTEGER REFERENCES users(id),

  updated_at   TIMESTAMP DEFAULT NOW(),

  UNIQUE(x, y)
);

-- Índice espacial para override tiles
CREATE INDEX IF NOT EXISTS idx_map_tiles_xy ON map_tiles(x, y);

-- ════════════════════════════════════════════════════════════════
-- TABLA: resource_nodes  (nodos de wild activos / agotados)
-- Se crea al primer ataque/recolección sobre un wild
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS resource_nodes (
  id              SERIAL PRIMARY KEY,
  x               INTEGER NOT NULL,
  y               INTEGER NOT NULL,
  resource_type   VARCHAR(20) NOT NULL,
  level           INTEGER NOT NULL,
  current_amount  BIGINT NOT NULL,
  max_amount      BIGINT NOT NULL,
  is_depleted     BOOLEAN DEFAULT FALSE,
  last_harvested  TIMESTAMP,
  harvested_by    INTEGER REFERENCES users(id),
  respawn_at      TIMESTAMP,
  created_at      TIMESTAMP DEFAULT NOW(),
  UNIQUE(x, y)
);

CREATE INDEX IF NOT EXISTS idx_resource_nodes_xy   ON resource_nodes(x, y);
CREATE INDEX IF NOT EXISTS idx_resource_nodes_type ON resource_nodes(resource_type);

-- ════════════════════════════════════════════════════════════════
-- TABLA: npc_camps  (camps activos / derrotados)
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS npc_camps (
  id             SERIAL PRIMARY KEY,
  x              INTEGER NOT NULL,
  y              INTEGER NOT NULL,
  camp_type      VARCHAR(50) NOT NULL,
  level          INTEGER NOT NULL,
  power          INTEGER NOT NULL,
  is_defeated    BOOLEAN DEFAULT FALSE,
  defeated_by    INTEGER REFERENCES users(id),
  defeated_at    TIMESTAMP,
  respawn_at     TIMESTAMP,
  loot           JSONB,         -- recursos que dropeó al morir
  created_at     TIMESTAMP DEFAULT NOW(),
  UNIQUE(x, y)
);

CREATE INDEX IF NOT EXISTS idx_npc_camps_xy ON npc_camps(x, y);

-- ════════════════════════════════════════════════════════════════
-- FUNCIÓN: distancia euclidiana (reutilizable en queries SQL)
-- ════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION euclidean_distance(
  x1 INTEGER, y1 INTEGER, x2 INTEGER, y2 INTEGER
) RETURNS NUMERIC AS $$
  SELECT SQRT(POWER(x2-x1, 2)::NUMERIC + POWER(y2-y1, 2)::NUMERIC);
$$ LANGUAGE SQL IMMUTABLE;

-- ════════════════════════════════════════════════════════════════
-- FUNCIÓN: ciudades en radio
-- ════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION cities_in_radius(
  cx INTEGER, cy INTEGER, radius INTEGER
)
RETURNS TABLE(
  id INTEGER, user_id INTEGER, x INTEGER, y INTEGER,
  name VARCHAR, level INTEGER, power INTEGER, distance NUMERIC
) AS $$
  SELECT c.id, c.user_id, c.x, c.y, c.name, c.level, c.power,
         euclidean_distance(cx, cy, c.x, c.y) AS distance
  FROM cities c
  WHERE ABS(c.x - cx) <= radius            -- pre-filtro rápido (evita full scan)
    AND ABS(c.y - cy) <= radius
    AND euclidean_distance(cx, cy, c.x, c.y) <= radius
  ORDER BY distance;
$$ LANGUAGE SQL STABLE;

-- ════════════════════════════════════════════════════════════════
-- TRIGGER: actualizar last_updated en cities
-- ════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION fn_update_city_timestamp()
RETURNS TRIGGER AS $$
BEGIN NEW.last_updated = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_city_timestamp ON cities;
CREATE TRIGGER trg_city_timestamp
BEFORE UPDATE ON cities
FOR EACH ROW EXECUTE FUNCTION fn_update_city_timestamp();

-- ════════════════════════════════════════════════════════════════
-- VISTA: marchas activas con info completa
-- ════════════════════════════════════════════════════════════════

CREATE OR REPLACE VIEW view_active_marches AS
SELECT
  m.*,
  u.username,
  c.name AS from_city_name,
  EXTRACT(EPOCH FROM (m.arrival_time - NOW()))::INT AS seconds_remaining,
  EXTRACT(EPOCH FROM (m.return_time  - NOW()))::INT AS seconds_to_return,
  euclidean_distance(m.from_x, m.from_y, m.to_x, m.to_y) AS distance
FROM marches m
JOIN users u ON m.user_id = u.id
JOIN cities c ON m.from_city_id = c.id
WHERE m.status IN ('marching','arrived')
ORDER BY m.arrival_time;

-- ════════════════════════════════════════════════════════════════
-- VISTA: ranking de poder
-- ════════════════════════════════════════════════════════════════

CREATE OR REPLACE VIEW view_power_ranking AS
SELECT
  ROW_NUMBER() OVER (ORDER BY SUM(c.power) DESC) AS rank,
  u.id AS user_id,
  u.username,
  SUM(c.power)  AS total_power,
  COUNT(c.id)   AS city_count,
  MAX(c.level)  AS max_city_level
FROM users u
JOIN cities c ON c.user_id = u.id
GROUP BY u.id, u.username
ORDER BY total_power DESC;

-- ════════════════════════════════════════════════════════════════
-- DATOS DE EJEMPLO
-- ════════════════════════════════════════════════════════════════

INSERT INTO users (username, email, password_hash) VALUES
  ('nacho',   'nacho@game.com',   '$2b$10$placeholder_hash_1'),
  ('player2', 'player2@game.com', '$2b$10$placeholder_hash_2'),
  ('player3', 'player3@game.com', '$2b$10$placeholder_hash_3')
ON CONFLICT (username) DO NOTHING;

INSERT INTO cities (user_id, x, y, name, region, level, power, wood, food, stone, metal, gold)
VALUES
  (1, 150, 150, 'Atlantis',    'plains',    5, 5000, 10000, 10000, 5000, 5000, 1000),
  (1, 145, 148, 'Second City', 'forest',    3, 2000,  5000,  5000, 2000, 2000,  500),
  (2, 160, 155, 'Enemy Keep',  'highlands', 4, 3000,  7000,  7000, 3000, 3000,  700),
  (3, 170, 140, 'Far Keep',    'plains',    2, 1000,  3000,  3000, 1000, 1000,  200)
ON CONFLICT (x, y) DO NOTHING;

-- ════════════════════════════════════════════════════════════════
-- COMANDOS ÚTILES
-- ════════════════════════════════════════════════════════════════

-- Ver todas las tablas:
-- \dt

-- Ciudades en radio 30 de (150,150):
-- SELECT * FROM cities_in_radius(150, 150, 30);

-- Marchas activas:
-- SELECT * FROM view_active_marches;

-- Ranking de poder:
-- SELECT * FROM view_power_ranking LIMIT 10;

-- Distancia entre dos puntos:
-- SELECT euclidean_distance(0,0,150,150);