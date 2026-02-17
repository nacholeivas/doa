// ═══════════════════════════════════════════════════════════════
// SERVER.JS - Sistema de Mapa DoA Completo
// Node.js + Express + PostgreSQL
// Incluye: ciudades, marchas, distancia, teleport, regiones,
//          Wilds (recursos) y Camps (NPC)
// ═══════════════════════════════════════════════════════════════

const express = require('express');
const cors    = require('cors');
const { Pool } = require('pg');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// ── Servir imágenes PNG del proyecto (rutas explícitas garantizadas) ──
const path = require('path');
const PNG_NAMES = ['plain', 'forest', 'hill', 'bog', 'lake', 'mountain', 'camp', 'camp2', 'camp3'];
PNG_NAMES.forEach(name => {
  app.get(`/${name}.png`, (req, res) => {
    const file = path.join(__dirname, `${name}.png`);
    res.sendFile(file, err => {
      if (err) res.status(404).send(`${name}.png not found`);
    });
  });
});

// ════════════════════════════════════════════════════════════════
// BASE DE DATOS
// ════════════════════════════════════════════════════════════════

const pool = new Pool({
  user:     process.env.DB_USER     || 'your_user',
  host:     process.env.DB_HOST     || 'localhost',
  database: process.env.DB_NAME     || 'atlantis_game',
  password: process.env.DB_PASSWORD || 'your_password',
  port:     parseInt(process.env.DB_PORT) || 5432,
  // Pool sizing para escalabilidad (miles de jugadores)
  max:      20,   // máximo 20 conexiones simultáneas
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => console.error('DB pool error:', err));

// ════════════════════════════════════════════════════════════════
// SEED Y GENERACIÓN PROCEDURAL
// (Mismo algoritmo que el cliente – resultado idéntico)
// ════════════════════════════════════════════════════════════════

const WORLD_SEED = 123456789;

// Hash determinístico para (x, y) → [0, 1]
function hash2D(x, y, seed = WORLD_SEED) {
  let h = seed + x * 374761393 + y * 668265263;
  h = (h ^ (h >> 13)) * 1274126177;
  return ((h ^ (h >> 16)) >>> 0) / 4294967296;
}

// Value noise interpolado
function valueNoise(x, y, scale, seed = WORLD_SEED) {
  const sx = Math.floor(x/scale), sy = Math.floor(y/scale);
  const fx = x/scale - sx,        fy = y/scale - sy;
  const u  = fx*fx*(3-2*fx),      v  = fy*fy*(3-2*fy);
  const v00= hash2D(sx,   sy,   seed), v10= hash2D(sx+1, sy,   seed);
  const v01= hash2D(sx,   sy+1, seed), v11= hash2D(sx+1, sy+1, seed);
  return (v00*(1-u)+v10*u)*(1-v) + (v01*(1-u)+v11*u)*v;
}

// fBm (Fractional Brownian Motion) – 4 octavas
function fbm(x, y) {
  let t=0, a=1, f=1, m=0;
  for(let i=0; i<4; i++){
    t += valueNoise(x, y, 64/f, WORLD_SEED+i) * a;
    m += a; a *= 0.5; f *= 2;
  }
  return t/m;
}

// ════════════════════════════════════════════════════════════════
// REGIONES  (idéntico al cliente)
// ════════════════════════════════════════════════════════════════

/**
 * Devuelve la región del tile (x, y).
 * Regiones DoA: plains, forest, highlands, marsh, desert, mountain, ocean, snow
 */
function getRegion(x, y) {
  const elev  = fbm(x, y);
  const moist = valueNoise(x, y, 64, WORLD_SEED+1000);
  const temp  = valueNoise(x, y, 64, WORLD_SEED+2000);

  if (elev < 0.30)                return 'ocean';
  if (elev > 0.75) return temp < 0.3 ? 'snow' : 'mountain';
  if (moist < 0.25 && temp > 0.60) return 'desert';
  if (moist > 0.70 && elev < 0.45) return 'marsh';
  if (elev > 0.55)                 return 'highlands';
  if (moist > 0.50)                return 'forest';
  return 'plains';
}

// Modificadores de región (speed bonus, resource bonus…)
const REGION_MODIFIERS = {
  plains:    { speedMod: 1.0,  resourceBonus: 0.1,  label: 'Plains'    },
  forest:    { speedMod: 0.85, resourceBonus: 0.0,  label: 'Forest'    },
  highlands: { speedMod: 0.90, resourceBonus: 0.05, label: 'Highlands' },
  marsh:     { speedMod: 0.75, resourceBonus: 0.0,  label: 'Marsh'     },
  desert:    { speedMod: 0.80, resourceBonus: 0.15, label: 'Desert'    },
  mountain:  { speedMod: 0.70, resourceBonus: 0.20, label: 'Mountain'  },
  ocean:     { speedMod: 1.20, resourceBonus: 0.0,  label: 'Ocean'     },
  snow:      { speedMod: 0.65, resourceBonus: 0.0,  label: 'Snow'      },
};

// ════════════════════════════════════════════════════════════════
// WILDS (recursos) y CAMPS (NPC)
// ════════════════════════════════════════════════════════════════

function getWild(x, y, region) {
  if (region === 'ocean' || region === 'snow') return null;
  if (hash2D(x, y, WORLD_SEED+5000) <= 0.93)  return null;

  const t   = hash2D(x, y, WORLD_SEED+6000);
  const lvl = Math.floor(hash2D(x, y, WORLD_SEED+7000)*10)+1;
  const typeMap = {
    forest:'wood', plains:'food', mountain:'metal',
    highlands:'stone', desert:'gold', marsh:'food'
  };
  return { type: typeMap[region]||'food', level: lvl };
}

function getCamp(x, y, region) {
  if (region === 'ocean') return null;
  if (hash2D(x, y, WORLD_SEED+8000) <= 0.975) return null;

  const lvl  = Math.floor(hash2D(x, y, WORLD_SEED+9000)*10)+1;
  const type = (region==='mountain' && hash2D(x,y,WORLD_SEED+9500)>0.7)
               ? 'dark_citadel' : 'anthropus_camp';
  return { type, level: lvl, power: lvl*1000 };
}

/** Genera un tile completo con región + wild + camp */
function generateTile(x, y) {
  const region = getRegion(x, y);
  const wild   = getWild(x, y, region);
  const camp   = getCamp(x, y, region);
  return {
    x, y, region,
    regionLabel:  REGION_MODIFIERS[region]?.label ?? region,
    wild:         wild?.type  ?? null,
    wildLevel:    wild?.level ?? 0,
    camp:         camp?.type  ?? null,
    campLevel:    camp?.level ?? 0,
    campPower:    camp?.power ?? 0,
  };
}

// ════════════════════════════════════════════════════════════════
// DISTANCIA  √((x2-x1)²+(y2-y1)²)
// ════════════════════════════════════════════════════════════════

/**
 * Distancia euclidiana entre dos puntos.
 * @returns {number} distancia en tiles
 */
function calcDistance(x1, y1, x2, y2) {
  return Math.sqrt(Math.pow(x2-x1, 2) + Math.pow(y2-y1, 2));
}

// ════════════════════════════════════════════════════════════════
// TIEMPO DE MARCHA
// ════════════════════════════════════════════════════════════════

/**
 * Calcula cuántos segundos tarda una marcha.
 * tiempo = distancia / velocidad   (velocidad = tiles/segundo)
 */
function calcMarchSeconds(x1, y1, x2, y2, speed) {
  const dist = calcDistance(x1, y1, x2, y2);
  return Math.max(1, Math.round(dist / speed));
}

// ════════════════════════════════════════════════════════════════
// HELPERS DE DB
// ════════════════════════════════════════════════════════════════

/** Verifica si una coordenada está libre (sin ciudad) */
async function isTileFree(x, y, excludeCityId = null) {
  const query = excludeCityId
    ? 'SELECT id FROM cities WHERE x=$1 AND y=$2 AND id<>$3 LIMIT 1'
    : 'SELECT id FROM cities WHERE x=$1 AND y=$2 LIMIT 1';
  const params = excludeCityId ? [x, y, excludeCityId] : [x, y];
  const { rows } = await pool.query(query, params);
  return rows.length === 0;
}

/** Verifica que una coordenada no sea océano */
function isLandTile(x, y) {
  return getRegion(x, y) !== 'ocean';
}

// ════════════════════════════════════════════════════════════════
// ─── API: MAPA ────────────────────────────────────────────────
// ════════════════════════════════════════════════════════════════

/**
 * GET /api/map/chunk?cx=0&cy=0&size=32
 * Devuelve todos los tiles de un chunk (generados) + ciudades reales de DB.
 * Usado por el cliente para renderizar.
 */
app.get('/api/map/chunk', async (req, res) => {
  try {
    const cx   = parseInt(req.query.cx)   || 0;
    const cy   = parseInt(req.query.cy)   || 0;
    const size = parseInt(req.query.size) || 32;

    const startX = cx * size;
    const startY = cy * size;

    // 1. Generar tiles proceduralmente
    const tiles = [];
    for (let row = 0; row < size; row++)
      for (let col = 0; col < size; col++)
        tiles.push(generateTile(startX+col, startY+row));

    // 2. Buscar ciudades en este rango
    const { rows: cities } = await pool.query(
      `SELECT id, user_id, x, y, name, level, power
       FROM cities
       WHERE x >= $1 AND x < $2 AND y >= $3 AND y < $4`,
      [startX, startX+size, startY, startY+size]
    );

    // 3. Marcar tiles con ciudad
    cities.forEach(city => {
      const idx = (city.y - startY)*size + (city.x - startX);
      if (tiles[idx]) {
        tiles[idx].cityId   = city.id;
        tiles[idx].cityName = city.name;
        tiles[idx].cityLevel= city.level;
        tiles[idx].cityPower= city.power;
        tiles[idx].userId   = city.user_id;
      }
    });

    res.json({ chunkX: cx, chunkY: cy, size, tiles, cities });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error generando chunk' });
  }
});

/**
 * GET /api/map/tile?x=150&y=150
 * Info detallada de un solo tile (incluye región, wild, camp, ciudad).
 */
app.get('/api/map/tile', async (req, res) => {
  try {
    const x = parseInt(req.query.x);
    const y = parseInt(req.query.y);
    if (isNaN(x)||isNaN(y)) return res.status(400).json({ error: 'Coordenadas inválidas' });

    const tile = generateTile(x, y);
    tile.regionMod = REGION_MODIFIERS[tile.region] || {};

    const { rows } = await pool.query(
      `SELECT c.id, c.user_id, c.name, c.level, c.power, u.username
       FROM cities c JOIN users u ON c.user_id=u.id
       WHERE c.x=$1 AND c.y=$2 LIMIT 1`,
      [x, y]
    );
    if (rows.length) {
      const city = rows[0];
      Object.assign(tile, { cityId: city.id, cityName: city.name, cityLevel: city.level,
                             cityPower: city.power, cityOwner: city.username });
    }

    res.json(tile);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error obteniendo tile' });
  }
});

// ════════════════════════════════════════════════════════════════
// ─── API: CIUDADES ────────────────────────────────────────────
// ════════════════════════════════════════════════════════════════

/**
 * GET /api/cities
 * Devuelve todas las ciudades (con usuario).
 * Soporta filtros: ?userId=1  ?minX=100&maxX=200&minY=100&maxY=200
 */
app.get('/api/cities', async (req, res) => {
  try {
    let sql = `SELECT c.*, u.username FROM cities c JOIN users u ON c.user_id=u.id WHERE 1=1`;
    const params = [];
    let i = 1;

    if (req.query.userId) { sql += ` AND c.user_id=$${i++}`; params.push(req.query.userId); }
    if (req.query.minX)   { sql += ` AND c.x>=$${i++}`;      params.push(req.query.minX); }
    if (req.query.maxX)   { sql += ` AND c.x<=$${i++}`;      params.push(req.query.maxX); }
    if (req.query.minY)   { sql += ` AND c.y>=$${i++}`;      params.push(req.query.minY); }
    if (req.query.maxY)   { sql += ` AND c.y<=$${i++}`;      params.push(req.query.maxY); }

    sql += ' ORDER BY c.power DESC';
    const { rows } = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error obteniendo ciudades' });
  }
});

/**
 * GET /api/cities/:id
 * Info de una ciudad por ID.
 */
app.get('/api/cities/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT c.*, u.username FROM cities c JOIN users u ON c.user_id=u.id WHERE c.id=$1`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Ciudad no encontrada' });
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: 'Error' }); }
});

/**
 * GET /api/cities/coord/:x/:y
 * Busca ciudad en coordenada exacta.
 */
app.get('/api/cities/coord/:x/:y', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT c.*, u.username FROM cities c JOIN users u ON c.user_id=u.id
       WHERE c.x=$1 AND c.y=$2 LIMIT 1`,
      [req.params.x, req.params.y]
    );
    if (!rows.length) return res.status(404).json({ error: 'No hay ciudad en esa coordenada' });
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: 'Error' }); }
});

/**
 * POST /api/cities
 * Crear ciudad en coordenada libre.
 * Body: { userId, x, y, name }
 */
app.post('/api/cities', async (req, res) => {
  try {
    const { userId, x, y, name } = req.body;

    // Validaciones
    if (!userId||isNaN(x)||isNaN(y)||!name?.trim())
      return res.status(400).json({ error: 'Faltan campos: userId, x, y, name' });

    if (!isLandTile(x, y))
      return res.status(400).json({ error: 'No se puede construir en el océano' });

    if (!(await isTileFree(x, y)))
      return res.status(409).json({ error: 'Coordenada ocupada' });

    const region = getRegion(x, y);
    const { rows } = await pool.query(
      `INSERT INTO cities (user_id, x, y, name, region, level, power)
       VALUES ($1,$2,$3,$4,$5,1,100) RETURNING *`,
      [userId, x, y, name.trim(), region]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error creando ciudad' });
  }
});

/**
 * POST /api/cities/:id/teleport
 * Mueve una ciudad a nueva coordenada.
 * Body: { x, y }
 */
app.post('/api/cities/:id/teleport', async (req, res) => {
  try {
    const cityId = parseInt(req.params.id);
    const { x, y } = req.body;

    if (isNaN(x)||isNaN(y)) return res.status(400).json({ error: 'Coordenadas inválidas' });

    // Verificar que existe
    const { rows: exist } = await pool.query('SELECT id FROM cities WHERE id=$1', [cityId]);
    if (!exist.length) return res.status(404).json({ error: 'Ciudad no encontrada' });

    if (!isLandTile(x, y))
      return res.status(400).json({ error: 'No se puede teleportar al océano' });

    // Excluir la propia ciudad al chequear disponibilidad
    if (!(await isTileFree(x, y, cityId)))
      return res.status(409).json({ error: 'Coordenada de destino ocupada' });

    const region = getRegion(x, y);
    const { rows } = await pool.query(
      `UPDATE cities SET x=$1, y=$2, region=$3, last_updated=NOW()
       WHERE id=$4 RETURNING *`,
      [x, y, region, cityId]
    );
    res.json({ message: 'Teleport exitoso', city: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error en teleport' });
  }
});

/**
 * GET /api/cities/:id/neighbors?radius=20
 * Ciudades cercanas en radio dado.
 */
app.get('/api/cities/:id/neighbors', async (req, res) => {
  try {
    const radius = parseInt(req.query.radius) || 20;
    const { rows: src } = await pool.query('SELECT x,y FROM cities WHERE id=$1', [req.params.id]);
    if (!src.length) return res.status(404).json({ error: 'Ciudad no encontrada' });

    const { x, y } = src[0];
    const { rows } = await pool.query(
      `SELECT c.*, u.username,
              SQRT(POWER(c.x-$1,2)+POWER(c.y-$2,2)) AS distance
       FROM cities c JOIN users u ON c.user_id=u.id
       WHERE c.id<>$3
         AND ABS(c.x-$1)<=$4 AND ABS(c.y-$2)<=$4
         AND SQRT(POWER(c.x-$1,2)+POWER(c.y-$2,2))<=$4
       ORDER BY distance`,
      [x, y, req.params.id, radius]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: 'Error' }); }
});

// ════════════════════════════════════════════════════════════════
// ─── API: MARCHAS ─────────────────────────────────────────────
// ════════════════════════════════════════════════════════════════

/**
 * POST /api/marches
 * Enviar una marcha de una ciudad a un destino.
 *
 * Body:
 *   fromCityId : int     – ciudad de origen
 *   toX, toY   : int     – coordenadas de destino
 *   marchType  : string  – 'attack' | 'transport' | 'reinforce' | 'scout'
 *   troops     : object  – { porter: 100, longbow: 50, ... }
 *   resources  : object  – (solo transport) { wood: 500 }
 *   speed      : number  – tiles/segundo (default 1.0)
 */
app.post('/api/marches', async (req, res) => {
  try {
    const { fromCityId, toX, toY, marchType, troops, resources, speed = 1.0 } = req.body;

    // 1. Verificar ciudad origen
    const { rows: srcRows } = await pool.query(
      'SELECT id,user_id,x,y FROM cities WHERE id=$1', [fromCityId]
    );
    if (!srcRows.length) return res.status(404).json({ error: 'Ciudad de origen no encontrada' });
    const src = srcRows[0];

    // 2. Calcular distancia
    const dist    = calcDistance(src.x, src.y, toX, toY);
    const seconds = calcMarchSeconds(src.x, src.y, toX, toY, speed);

    // 3. Calcular tiempos (timestamps)
    const now       = new Date();
    const arrival   = new Date(now.getTime() + seconds * 1000);
    const returnT   = new Date(arrival.getTime() + seconds * 1000);

    // 4. Validación: no marchar si destino es océano (para attack)
    if (marchType === 'attack' && !isLandTile(toX, toY))
      return res.status(400).json({ error: 'No se puede atacar el océano' });

    // 5. Crear marcha en DB
    const { rows } = await pool.query(
      `INSERT INTO marches
         (user_id, from_city_id, from_x, from_y, to_x, to_y,
          target_type, march_type, troops, resources,
          departure_time, arrival_time, return_time, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'marching')
       RETURNING *`,
      [
        src.user_id, fromCityId, src.x, src.y, toX, toY,
        determineMarchTarget(toX, toY), marchType,
        JSON.stringify(troops || {}),
        JSON.stringify(resources || {}),
        now, arrival, returnT
      ]
    );
    res.status(201).json({
      march: rows[0],
      distance:       Math.round(dist * 100) / 100,
      travelSeconds:  seconds,
      arrivalAt:      arrival,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error enviando marcha' });
  }
});

/** Determina el target_type según si hay ciudad o no */
function determineMarchTarget(x, y) {
  const tile = generateTile(x, y);
  if (tile.camp)  return 'npc';
  if (tile.wild)  return 'resource';
  return 'empty'; // Se complementa con DB check en la consulta
}

/**
 * GET /api/marches/active?userId=1
 * Marchas activas del usuario.
 */
app.get('/api/marches/active', async (req, res) => {
  try {
    const params = [];
    let sql = `
      SELECT m.*, c.name AS from_city_name,
             EXTRACT(EPOCH FROM (m.arrival_time - NOW()))::int AS seconds_remaining,
             EXTRACT(EPOCH FROM (m.return_time  - NOW()))::int AS seconds_to_return
      FROM marches m
      JOIN cities c ON m.from_city_id = c.id
      WHERE m.status IN ('marching','arrived')
    `;
    if (req.query.userId) { sql += ' AND m.user_id=$1'; params.push(req.query.userId); }
    sql += ' ORDER BY m.arrival_time';

    const { rows } = await pool.query(sql, params);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: 'Error' }); }
});

/**
 * PATCH /api/marches/:id/status
 * Actualizar estado de marcha (uso interno del servidor).
 * Body: { status: 'arrived' | 'returning' | 'completed' }
 */
app.patch('/api/marches/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const valid = ['marching','arrived','returning','completed'];
    if (!valid.includes(status)) return res.status(400).json({ error: 'Status inválido' });

    const { rows } = await pool.query(
      'UPDATE marches SET status=$1 WHERE id=$2 RETURNING *',
      [status, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Marcha no encontrada' });
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: 'Error' }); }
});

// ════════════════════════════════════════════════════════════════
// ─── API: DISTANCIA ───────────────────────────────────────────
// ════════════════════════════════════════════════════════════════

/**
 * GET /api/distance?x1=0&y1=0&x2=150&y2=150&speed=1
 * Calcula distancia y tiempo de marcha entre dos puntos.
 */
app.get('/api/distance', (req, res) => {
  const { x1, y1, x2, y2, speed = 1 } = req.query;
  if ([x1,y1,x2,y2].some(v => isNaN(v)))
    return res.status(400).json({ error: 'Parámetros inválidos' });

  const dist    = calcDistance(+x1,+y1,+x2,+y2);
  const seconds = calcMarchSeconds(+x1,+y1,+x2,+y2,+speed);

  res.json({
    from:    { x:+x1, y:+y1 },
    to:      { x:+x2, y:+y2 },
    distance:       Math.round(dist*100)/100,
    travelSeconds:  seconds,
    travelMinutes:  Math.round(seconds/60*10)/10,
    speed:          +speed,
  });
});

// ════════════════════════════════════════════════════════════════
// ─── API: REGIONES ────────────────────────────────────────────
// ════════════════════════════════════════════════════════════════

/**
 * GET /api/region?x=150&y=150
 * Devuelve la región y modificadores de un tile.
 */
app.get('/api/region', (req, res) => {
  const { x, y } = req.query;
  if (isNaN(x)||isNaN(y)) return res.status(400).json({ error: 'Coordenadas inválidas' });

  const region = getRegion(+x, +y);
  res.json({ x:+x, y:+y, region, ...REGION_MODIFIERS[region] });
});

// ════════════════════════════════════════════════════════════════
// ─── API: SEED ────────────────────────────────────────────────
// ════════════════════════════════════════════════════════════════

app.get('/api/seed', (_req, res) => res.json({ seed: WORLD_SEED }));

// ════════════════════════════════════════════════════════════════
// INICIAR SERVIDOR
// ════════════════════════════════════════════════════════════════

app.listen(PORT, () => {
  console.log(`\n🌍 Atlantis Map Server – Puerto ${PORT}`);
  console.log(`🎲 World Seed: ${WORLD_SEED}`);
  console.log(`\n📡 Endpoints disponibles:`);
  console.log(`   GET  /api/map/chunk?cx=0&cy=0&size=32    → tiles + ciudades del chunk`);
  console.log(`   GET  /api/map/tile?x=150&y=150           → info de un tile`);
  console.log(`   GET  /api/region?x=150&y=150             → región y modificadores`);
  console.log(`   GET  /api/distance?x1=0&y1=0&x2=10&y2=10→ distancia/tiempo`);
  console.log(`   GET  /api/cities                         → todas las ciudades`);
  console.log(`   GET  /api/cities/:id                     → ciudad por ID`);
  console.log(`   GET  /api/cities/coord/:x/:y             → ciudad en coordenada`);
  console.log(`   GET  /api/cities/:id/neighbors?radius=20 → vecinos`);
  console.log(`   POST /api/cities                         → crear ciudad`);
  console.log(`   POST /api/cities/:id/teleport            → teleportar ciudad`);
  console.log(`   POST /api/marches                        → enviar marcha`);
  console.log(`   GET  /api/marches/active?userId=1        → marchas activas`);
  console.log(`   PATCH /api/marches/:id/status            → actualizar estado\n`);
});

module.exports = app;