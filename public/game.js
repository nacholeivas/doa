console.log("✅ game.js cargó");

/* ============================================================
   ✅ SAVE / LOAD (LOCALSTORAGE)
============================================================ */
const SAVE_KEY = "ATLANTIS_MVP_SAVE_V1";
/* ============================================================
   ✅ AUTH (BETA) - LocalStorage Login/Register
   (Cuando tengas servidor, esto se reemplaza por API real)
============================================================ */
const USERS_KEY = "ATLANTIS_USERS_V1";
const SESSION_KEY = "ATLANTIS_SESSION_V1";

function getUsers(){
  try{ return JSON.parse(localStorage.getItem(USERS_KEY) || "{}"); }
  catch{ return {}; }
}
function setUsers(obj){
  localStorage.setItem(USERS_KEY, JSON.stringify(obj || {}));
}

function setAuthMsg(id, text, ok=false){
  const el = document.getElementById(id);
  if(!el) return;
  el.textContent = text || "";
  el.style.color = ok ? "#b8ffcf" : "#ffd0d0";
}

function showAuth(){
  document.getElementById("authScreen")?.classList.remove("hidden");
}
function hideAuth(){
  document.getElementById("authScreen")?.classList.add("hidden");
}

function setSession(username){
  localStorage.setItem(SESSION_KEY, JSON.stringify({ user: username, at: Date.now() }));
}
function getSession(){
  try{ return JSON.parse(localStorage.getItem(SESSION_KEY) || "null"); }
  catch{ return null; }
}

function initAuthUI(){
  const tabLogin = document.getElementById("tabLogin");
  const tabRegister = document.getElementById("tabRegister");
  const loginPanel = document.getElementById("loginPanel");
  const registerPanel = document.getElementById("registerPanel");

  const btnLogin = document.getElementById("btnLogin");
  const btnRegister = document.getElementById("btnRegister");

  function activate(mode){
    if(mode === "login"){
      tabLogin?.classList.add("active");
      tabRegister?.classList.remove("active");
      loginPanel?.classList.remove("hidden");
      registerPanel?.classList.add("hidden");
      setAuthMsg("authMsgLogin", "");
      setAuthMsg("authMsgRegister", "");
    }else{
      tabRegister?.classList.add("active");
      tabLogin?.classList.remove("active");
      registerPanel?.classList.remove("hidden");
      loginPanel?.classList.add("hidden");
      setAuthMsg("authMsgLogin", "");
      setAuthMsg("authMsgRegister", "");
    }
  }

  tabLogin?.addEventListener("click", ()=> activate("login"));
  tabRegister?.addEventListener("click", ()=> activate("register"));

  btnRegister?.addEventListener("click", ()=>{
    const u = (document.getElementById("regUser")?.value || "").trim().toLowerCase();
    const e = (document.getElementById("regEmail")?.value || "").trim().toLowerCase();
    const p = (document.getElementById("regPass")?.value || "").trim();

    if(u.length < 3) return setAuthMsg("authMsgRegister", "Usuario mínimo 3 caracteres.");
    if(!e.includes("@")) return setAuthMsg("authMsgRegister", "Email inválido.");
    if(p.length < 4) return setAuthMsg("authMsgRegister", "Contraseña mínimo 4 caracteres.");

    const users = getUsers();
    if(users[u]) return setAuthMsg("authMsgRegister", "Ese usuario ya existe.");

    // ⚠️ BETA: guarda pass plano (solo para probar)
    users[u] = { email: e, pass: p, createdAt: Date.now() };
    setUsers(users);

    setAuthMsg("authMsgRegister", "Cuenta creada ✅ Ahora iniciá sesión.", true);
    activate("login");
    const loginUser = document.getElementById("loginUser");
    if(loginUser) loginUser.value = u;
  });

  btnLogin?.addEventListener("click", ()=>{
    const uRaw = (document.getElementById("loginUser")?.value || "").trim().toLowerCase();
    const p = (document.getElementById("loginPass")?.value || "").trim();

    const users = getUsers();

    // permite login por usuario o por email
    let foundUser = null;
    if(users[uRaw]) foundUser = uRaw;
    else{
      foundUser = Object.keys(users).find(k => users[k]?.email === uRaw) || null;
    }

    if(!foundUser) return setAuthMsg("authMsgLogin", "No existe ese usuario/email.");
    if(users[foundUser].pass !== p) return setAuthMsg("authMsgLogin", "Contraseña incorrecta.");

    setSession(foundUser);
    setAuthMsg("authMsgLogin", "Entrando... ✅", true);

    // ✅ arrancar juego
    hideAuth();
    bootGameOnce();
  });

  // Enter para login
  document.getElementById("loginPass")?.addEventListener("keydown", (e)=>{
    if(e.key === "Enter") btnLogin?.click();
  });

  activate("login");
}

// ✅ runtime-only: NO se guarda
const RUNTIME_FIELDS = ["gifEl", "sprite", "levelBadge", "_timer", "hoverOutline"];

/* ============================================================
   DEFAULTS (se pisan al cargar)
============================================================ */
const playerResources = {
  wood: 20000000,
  stone: 20000000,
  iron: 20000000,
  food: 20000000,
  gold: 20000000,
  poblacion: 0,
  power: 0 // ✅ NUEVO
};

// Coordenadas de la ciudad del jugador
const playerCity = {
  coordX: 138,
  coordY: 48,
  name: "My City"
};

const builtSlots = {};

// ✅ NUEVO: slots del FIELD (24)
const builtFieldSlots = {};

/* ============================================================
   ✅ CATALOGO FIELD (4 buildings)
============================================================ */
const FIELD_BUILDINGS = {
  farm: {
    name: "Farm",
    desc: "Food production building (más adelante conecta producción).",
    spriteKey: "fieldFarm",
    icon: "assets/farm.png",
    cost: { wood: 300, stone: 200, iron: 150, food: 50 },
    popBase: 5,
    buildTimeSec: 15
  },
  mine: {
    name: "Mine",
    desc: "Iron production building (más adelante conecta producción).",
    spriteKey: "fieldMine",
    icon: "assets/mine.png",
    cost: { wood: 600, stone: 500, iron: 200, food: 210 },
    popBase: 5,
    buildTimeSec: 15
  },
  quarry: {
    name: "Quarry",
    desc: "Stone production building (más adelante conecta producción).",
    spriteKey: "fieldQuarry",
    icon: "assets/quarry.png",
    cost: { wood: 500, stone: 150, iron: 400, food: 180 },
    popBase: 5,
    buildTimeSec: 15
  },
  lumbermill: {
    name: "Lumbermill",
    desc: "Wood production building (más adelante conecta producción).",
    spriteKey: "fieldLumbermill",
    icon: "assets/lumbermill.png",
    cost: { wood: 100, stone: 250, iron: 300, food: 150 },
    popBase: 5,
    buildTimeSec: 15
  }
};

/* ============================================================
   ✅ ANTHROPUS TROOPS DATA (Enemigos de zonas)
============================================================ */

// TABLA 1: Poder de tropas para CAMPAMENTOS ANTHROPUS por nivel
const ANTHROPUS_CAMP_POWER = {
  brats:      [0, 1500,   3000,   6000,   15000,  30000,  45000,  90000,  180000, 360000, 750000],
  cannibals:  [0, 500,    1000,   2000,   5000,   10000,  15000,  30000,  60000,  120000, 250000],
  stench:     [0, 0,      500,    1000,   2000,   5000,   10000,  15000,  30000,  60000,  120000],
  sheDevils:  [0, 0,      1000,   2000,   4000,   10000,  20000,  30000,  60000,  120000, 250000],
  clubbers:   [0, 0,      0,      1000,   2000,   4000,   15000,  20000,  30000,  60000,  120000],
  hurlers:    [0, 0,      0,      0,      1500,   3000,   10000,  15000,  30000,  45000,  90000],
  shredders:  [0, 0,      0,      0,      0,      2000,   4000,   8000,   20000,  40000,  60000],
  chieftains: [0, 0,      0,      0,      0,      0,      0,      2000,   4000,   8000,   16000],
  bloods:     [0, 0,      0,      0,      0,      0,      0,      0,      0,      5000,   10000],
  ragers:     [0, 0,      0,      0,      0,      0,      0,      0,      0,      0,      10000]
};

// TABLA 2: Cantidad de tropas para ZONAS SALVAJES (wilderness) por nivel
const WILDERNESS_TROOP_COUNT = {
  cannibals:  [0, 50,  100,  200,  500,  1000, 2000, 2000, 5000,  10000, 20000],
  stench:     [0, 0,   50,   100,  200,  500,  1000, 1000, 2000,  5000,  10000],
  sheDevils:  [0, 0,   0,    50,   100,  200,  500,  500,  1000,  2000,  5000],
  clubbers:   [0, 0,   0,    0,    50,   100,  200,  200,  500,   1000,  2000],
  hurlers:    [0, 0,   0,    0,    0,    50,   100,  100,  200,   500,   1000],
  shredders:  [0, 0,   0,    0,    0,    0,    50,   50,   100,   200,   500],
  chieftains: [0, 0,   0,    0,    0,    0,    0,    0,    50,    100,   200],
  bloods:     [0, 0,   0,    0,    0,    0,    0,    0,    0,     50,    100],
  ragers:     [0, 0,   0,    0,    0,    0,    0,    0,    0,     0,     50]
};

// Información de cada tipo de tropa CON STATS COMPLETAS
const ANTHROPUS_TROOPS_INFO = {
  brats: {
    name: 'Brats',
    icon: 'assets/Brats.png',
    powerPerUnit: 1,
    meleeAtk: 1,
    def: 10,
    life: 45,
    speed: 100,
    range: 0,
    rangeAtk: 0
  },
  cannibals: {
    name: 'Cannibals',
    icon: 'assets/Cannibals.png',
    powerPerUnit: 1,
    meleeAtk: 10,
    def: 10,
    life: 75,
    speed: 200,
    range: 0,
    rangeAtk: 0
  },
  stench: {
    name: 'Stench',
    icon: 'assets/Stench.png',
    powerPerUnit: 2,
    meleeAtk: 5,
    def: 5,
    life: 10,
    speed: 3000,
    range: 0,
    rangeAtk: 0
  },
  sheDevils: {
    name: 'She-Devils',
    icon: 'assets/She-devils.png',
    powerPerUnit: 2,
    meleeAtk: 40,
    def: 40,
    life: 150,
    speed: 300,
    range: 0,
    rangeAtk: 0
  },
  clubbers: {
    name: 'Clubbers',
    icon: 'assets/Clubbers.png',
    powerPerUnit: 3,
    meleeAtk: 70,
    def: 45,
    life: 225,
    speed: 275,
    range: 0,
    rangeAtk: 0
  },
  hurlers: {
    name: 'Hurlers',
    icon: 'assets/Hurlers.png',
    powerPerUnit: 4,
    meleeAtk: 5,
    def: 30,
    life: 75,
    speed: 250,
    range: 1200,
    rangeAtk: 80
  },
  shredders: {
    name: 'Shredders',
    icon: 'assets/Shredders.png',
    powerPerUnit: 5,
    meleeAtk: 150,
    def: 60,
    life: 300,
    speed: 1000,
    range: 0,
    rangeAtk: 0
  },
  chieftains: {
    name: 'Chieftan',
    icon: 'assets/Chieftain.png',
    powerPerUnit: 7,
    meleeAtk: 300,
    def: 300,
    life: 1500,
    speed: 750,
    range: 0,
    rangeAtk: 0
  },
  bloods: {
    name: 'Bloods',
    icon: 'assets/Bloods.png',
    powerPerUnit: 9,
    meleeAtk: 1000,
    def: 400,
    life: 4000,
    speed: 120,
    range: 0,
    rangeAtk: 0
  },
  ragers: {
    name: 'Ragers',
    icon: 'assets/Ragers.png',
    powerPerUnit: 10,
    meleeAtk: 20,
    def: 30,
    life: 1500,
    speed: 50,
    range: 1500,
    rangeAtk: 1200
  }
};

// ✅ carga (si existe) y pisa los defaults
function loadGame(){
  try{
    const raw = localStorage.getItem(SAVE_KEY);
    if(!raw) return false;

    const data = JSON.parse(raw);

    // recursos
    if(data.playerResources){
      Object.keys(playerResources).forEach(k=>{
        if(typeof data.playerResources[k] !== "undefined"){
          playerResources[k] = data.playerResources[k];
        }
      });
    }

    // ✅ compat: si venís de un save viejo, aseguramos power
    if(typeof playerResources.power !== "number") playerResources.power = 0;

    // builtSlots (sin runtime objects)
    if(data.builtSlots){
      Object.keys(builtSlots).forEach(k => delete builtSlots[k]);
      Object.entries(data.builtSlots).forEach(([slotId, v])=>{
        builtSlots[Number(slotId)] = {
          state: v.state,
          building: v.building,
          level: v.level ?? 0,
          fixed: !!v.fixed,
          endsAt: v.endsAt ?? null,
          gifEl: null,
          sprite: null,
          levelBadge: null,
          hoverOutline: null,
          _timer: null
        };
      });
    }

    // ✅ NUEVO: cargar builtFieldSlots (con timer real + upgrade)
    if(data.builtFieldSlots){
      Object.keys(builtFieldSlots).forEach(k => delete builtFieldSlots[k]);
      Object.entries(data.builtFieldSlots).forEach(([slotId, v])=>{
        builtFieldSlots[Number(slotId)] = {
          state: v.state,
          building: v.building,
          level: v.level ?? 0,
          endsAt: v.endsAt ?? null,
          // runtime
          gifEl: null,
          sprite: null,
          _timer: null,
          badgeEl: null,
          levelBadge: null
        };
      });
    }

    // ✅ NUEVO: cargar niveles de investigación
    if(data.researchLevels){
      Object.assign(researchLevels, data.researchLevels);
    }

    // ✅ NUEVO: cargar entrenamientos de tropas en progreso
    if(data.activeTroopTrainings && Array.isArray(data.activeTroopTrainings)){
      activeTroopTrainings = data.activeTroopTrainings;
    }

    console.log("💾✅ SAVE CARGADO", data);
    return true;
  }catch(err){
    console.warn("❌ Error cargando save:", err);
    return false;
  }
}

// ✅ guarda estado actual
function saveGame(){
  try{
    const serialSlots = {};
    Object.entries(builtSlots).forEach(([slotId, v])=>{
      if(!v) return;

      const clean = {};
      Object.keys(v).forEach(k=>{
        if(!RUNTIME_FIELDS.includes(k)){
          clean[k] = v[k];
        }
      });

      serialSlots[slotId] = clean;
    });

    // ✅ NUEVO: serializar field (incluye endsAt/level)
    const serialFieldSlots = {};
    Object.entries(builtFieldSlots).forEach(([slotId, v])=>{
      if(!v) return;

      serialFieldSlots[slotId] = {
        state: v.state,
        building: v.building,
        level: v.level ?? 0,
        endsAt: v.endsAt ?? null
      };
    });

    const payload = {
      savedAt: Date.now(),
      playerResources: { ...playerResources },
      builtSlots: serialSlots,
      builtFieldSlots: serialFieldSlots, // ✅ NUEVO
      researchLevels: { ...researchLevels }, // ✅ NUEVO: guardar niveles de investigación
      activeTroopTrainings: [...activeTroopTrainings] // ✅ NUEVO: guardar entrenamientos en progreso
    };

    localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
  }catch(err){
    console.warn("❌ Error guardando:", err);
  }
}

function clearSave(){
  localStorage.removeItem(SAVE_KEY);
  console.log("🗑️ Save borrado");
}
function resetGameProgressOnly(){
  // 1) borrar SOLO el save del juego
  localStorage.removeItem(SAVE_KEY);

  // 2) si querés que también se vuelva a dar el starter pack,
  // descomentá estas 2 líneas:
  // localStorage.removeItem(STARTER_KEY);

  // 3) limpiar estados en memoria
  Object.keys(builtSlots).forEach(k => delete builtSlots[k]);
  Object.keys(builtFieldSlots).forEach(k => delete builtFieldSlots[k]);

  // 4) resetear recursos a defaults
  playerResources.wood = 2000000;
  playerResources.stone = 2000000;
  playerResources.iron = 2000000;
  playerResources.food = 2000000;
  playerResources.gold = 2000000;
  playerResources.poblacion = 0;
  playerResources.power = 0;

  // 5) reponer prebuilt (fortress + egg)
  applyPrebuiltDefaults();

  // 6) refrescar UI + volver a dibujar sprites
  updateResourcesUI();

  if(window.cityScene){
    restoreVisualStateAfterLoad(); // redibuja city
  }
  if(window.fieldScene){
    window.fieldScene.restoreFieldVisualsAfterLoad?.(); // redibuja field
  }

  // 7) guardar el nuevo estado limpio
  saveGame();

  setSelection("✅ Progreso reiniciado (sin cerrar sesión).");
}



/* ============================================================
   STARTER PACK (DOA-style)
============================================================ */
const STARTER_KEY = "ATLANTIS_STARTER_GIVEN_V1";

function giveStarterPackOnce(){
  if(localStorage.getItem(STARTER_KEY)) return;

  // ✅ pack inicial para avanzar (aunque capacity sea 0)
  playerResources.wood  += 2000;
  playerResources.stone += 2000;
  playerResources.iron  += 1000;
  playerResources.food  += 2000;
  playerResources.gold  += 500;

  localStorage.setItem(STARTER_KEY, "1");
  updateResourcesUI();
  saveGame();
}

/* ============================================================
   ✅ EDIFICIOS PRECOLOCADOS (FORTRESS + EGG)
============================================================ */
const PREBUILT_DEFAULTS = [
  { slotId: 1, building: "fortress", level: 1, fixed: true },
  { slotId: 2, building: "eggdragon", level: 1, fixed: true }
];

function applyPrebuiltDefaults(){
  PREBUILT_DEFAULTS.forEach(({slotId, building, level, fixed})=>{
    if(builtSlots[slotId]) return;

    builtSlots[slotId] = {
      state: "built",
      building,
      level: level ?? 1,
      fixed: !!fixed,
      endsAt: null,
      gifEl: null,
      sprite: null,
      levelBadge: null,
      hoverOutline: null,
      _timer: null
    };
  });
}

/* ============================================================
   ✅ CATALOGO DE EDIFICIOS
============================================================ */
const BUILDINGS = {
  home: {
    name: "Home",
    desc: "Increases your population capacity, allowing your city to grow.",
    spriteKey: "homeSprite",
    icon: "assets/House.png",
    cost: { wood: 1200, stone: 1500, iron: 500, food: 250 },
    buildTimeSec: 10,
    onBuilt: () => {
      playerResources.poblacion += HOME_POPULATION_GAIN;
      updateResourcesUI();
    }
  },

  barrack: {
    name: "Barrack",
    desc: "Trains infantry units.",
    spriteKey: "barrackSprite",
    icon: "assets/barrack.png",
    cost: { wood: 1200, stone: 1500, iron: 500, food: 250 },
    buildTimeSec: 20
  },

  factory: {
    name: "Factory",
    desc: "Produces war supplies and upgrades.",
    spriteKey: "factorySprite",
    icon: "assets/Factory.png",
    cost: { wood: 1500, stone: 500, iron: 1500, food: 150 },
    buildTimeSec: 60
  },

  muster: {
    name: "Muster Point",
    desc: "Gather and manage your troops.",
    spriteKey: "musterSprite",
    icon: "assets/muster point.png",
    cost: { wood: 600, stone: 2000, iron: 250, food: 100 },
    buildTimeSec: 90
  },

  metal: {
    name: "Metalsmith",
    desc: "Increases iron production.",
    spriteKey: "metalSprite",
    icon: "assets/metal smith.png",
    cost: { wood: 1000, stone: 600, iron: 1200, food: 150 },
    buildTimeSec: 180
  },

  rookery: {
    name: "Rookery",
    desc: "Allows dragon related features.",
    spriteKey: "rookerySprite",
    icon: "assets/Rookery.png",
    cost: { wood: 2000, stone: 800, iron: 1000, food: 1200 },
    buildTimeSec: 120
  },

  science: {
    name: "Science Center",
    desc: "Research technologies to boost your city.",
    spriteKey: "scienceSprite",
    icon: "assets/science center.png",
    cost: { wood: 2500, stone: 1500, iron: 200, food: 120 },
    buildTimeSec: 480
  },

  sentinel: {
    name: "Sentinel",
    desc: "Improves city defense and watch.",
    spriteKey: "sentinelSprite",
    icon: "assets/Sentinel.png",
    cost: { wood: 1000, stone: 3000, iron: 300, food: 150 },
    buildTimeSec: 300
  },

  storage: {
    name: "Storage Vault",
    desc: "Increases your storage capacity.",
    spriteKey: "storageSprite",
    icon: "assets/storage vault.png",
    cost: { wood: 1500, stone: 1000, iron: 300, food: 100 },
    buildTimeSec: 600
  },

  theater: {
    name: "Theater",
    desc: "Unlocks entertainment and bonuses.",
    spriteKey: "theaterSprite",
    icon: "assets/theater.png",
    cost: { wood: 2000, stone: 1000, iron: 400, food: 300 },
    buildTimeSec: 240
  },

  // ✅ PREBUILT
  fortress: {
    name: "Fortress",
    desc: "Main fortress of the city.",
    spriteKey: "fortressSprite",
    icon: "assets/Fortress.png",
    cost: { wood: 10000, stone: 10000, iron: 10000, food: 10000 },
    buildTimeSec: 900,   // ⏱️ tiempo base
    maxLevel: 10
  },

  eggdragon: {
    name: "Dragon Egg",
    desc: "Dragon egg area (special building).",
    spriteKey: "eggdragonSprite", // base (Lv 1-2)
    icon: "assets/eggdragon.png",
    cost: { wood: 0, stone: 0, iron: 0, food: 0 },
    buildTimeSec: 900,   // ⏱️ tiempo base
    maxLevel: 10
 }
   
};

/* ============================================================
   ✅ TAMAÑOS DISTINTOS POR EDIFICIO
============================================================ */
const BUILDING_SCALE_MULT = {
  fortress: 5.0,
  eggdragon: 2.5,
  default: 1.5
};

/* ============================================================
   ✅ EVOLUCIÓN DRAGÓN (eggdragon) + MODAL DRAGON KEEP
============================================================ */
const DRAGON_EVOLUTION = {
  babyAt: 3,
  teenAt: 6,
  adultAt: 8,
  spriteKeys: {
    egg: "eggdragonSprite",
    baby: "eggBabySprite",
    teen: "eggTeenSprite",
    adult: "eggAdultSprite"
  },
  keepBgByStage: {
    egg:   "assets/EggDragonDiv.png",
    baby:  "assets/BabyDragonDiv.png",
    teen:  "assets/JuvDragonDiv.png",
    adult: "assets/AdultDragonDiv.png"
  }
};

function getEggdragonSpriteKeyForLevel(level){
  level = Number(level || 1);
  if(level >= DRAGON_EVOLUTION.adultAt) return DRAGON_EVOLUTION.spriteKeys.adult;
  if(level >= DRAGON_EVOLUTION.teenAt)  return DRAGON_EVOLUTION.spriteKeys.teen;
  if(level >= DRAGON_EVOLUTION.babyAt)  return DRAGON_EVOLUTION.spriteKeys.baby;
  return DRAGON_EVOLUTION.spriteKeys.egg;
}

function getEggdragonKeepBgForLevel(level){
  level = Number(level || 1);
  if(level >= DRAGON_EVOLUTION.adultAt) return DRAGON_EVOLUTION.keepBgByStage.adult;
  if(level >= DRAGON_EVOLUTION.teenAt)  return DRAGON_EVOLUTION.keepBgByStage.teen;
  if(level >= DRAGON_EVOLUTION.babyAt)  return DRAGON_EVOLUTION.keepBgByStage.baby;
  return DRAGON_EVOLUTION.keepBgByStage.egg;
}
function getEggdragonModalImageForLevel(level){
  level = Number(level || 1);

  if(level >= DRAGON_EVOLUTION.adultAt){
    return "assets/adultdragon.png";
  }
  if(level >= DRAGON_EVOLUTION.teenAt){
    return "assets/Adolecentedragon.png";
  }
  if(level >= DRAGON_EVOLUTION.babyAt){
    return "assets/babyDragon.png";
  }
  return "assets/eggdragon.png";
}



function ensureDragonKeepStyles(){
  if(document.getElementById("dragonKeepStyles")) return;
  const style = document.createElement("style");
  style.id = "dragonKeepStyles";
  style.textContent = `
    .dk-wrap{
      width: min(980px, 92vw);
      aspect-ratio: 4 / 3;
      position: relative;
      background-size: contain;
      background-repeat: no-repeat;
      background-position: center;
      margin: 0 auto;
    }
    .dk-close{
      position:absolute;
      top: 6%;
      right: 6.5%;
      width: 42px;
      height: 42px;
      background: transparent;
      border: none;
      cursor: pointer;
    }
    .dk-info{
      position:absolute;
      left: 10%;
      bottom: 16%;
      width: 55%;
      color: #d7f3ff;
      font-weight: 800;
      text-shadow: 0 2px 3px rgba(0,0,0,.65);
      font-family: Arial, sans-serif;
      line-height: 1.35;
      pointer-events: none;
    }
    .dk-info .dk-small{ font-size: 14px; opacity: .95; }
    .dk-info .dk-big{ font-size: 16px; margin-top: 4px; }

    .dk-upgrade{
      position:absolute;
      left: 28%;
      bottom: 7.5%;
      width: 40%;
      height: 52px;
      border-radius: 10px;
      border: 1px solid rgba(255,255,255,.25);
      background: rgba(20,90,120,.25);
      color: #e9fbff;
      font-weight: 900;
      letter-spacing: .8px;
      cursor: pointer;
      backdrop-filter: blur(2px);
    }
    .dk-upgrade:disabled{ opacity: .45; cursor: not-allowed; }
  `;
  document.head.appendChild(style);
}

/* ============================================================
   HOME: niveles / upgrade bonus
============================================================ */
const HOME_POPULATION_GAIN = 150;

function getHomePopulationGainForNextLevel(currentLevel){
  return HOME_POPULATION_GAIN * Math.pow(2, Math.max(0, currentLevel - 1));
}

/* ============================================================
   ✅ UPGRADE GLOBAL (TODOS LOS EDIFICIOS)
============================================================ */
const BUILDING_MAX_LEVEL = 10;

const UPGRADE_TIME_BASE_SEC = 5;
const UPGRADE_TIME_PER_LEVEL_SEC = 8;

const UPGRADE_COST_MULT = 2.00;

const UPGRADE_BASE_COST_FALLBACK = { wood: 1000, stone: 1000, iron: 600, food: 800 };

const UPGRADE_BASE_COST_OVERRIDES = {
  fortress: { wood: 600, stone: 5000, iron: 200, food: 400 },
  eggdragon: { wood: 5000, food: 800, stone: 2400, iron: 1400 }
};

function getUpgradeBaseCost(buildingKey){
  if(UPGRADE_BASE_COST_OVERRIDES[buildingKey]) return UPGRADE_BASE_COST_OVERRIDES[buildingKey];

  const def = BUILDINGS[buildingKey];
  const c = def?.cost || {};
  const isAllZero = ((c.wood ?? 0) + (c.stone ?? 0) + (c.iron ?? 0) + (c.food ?? 0)) === 0;

  return isAllZero ? UPGRADE_BASE_COST_FALLBACK : {
    wood: c.wood ?? 0,
    stone: c.stone ?? 0,
    iron: c.iron ?? 0,
    food: c.food ?? 0
  };
}

function getUpgradeCost(buildingKey, currentLevel){
  const base = getUpgradeBaseCost(buildingKey);
  const mult = Math.pow(UPGRADE_COST_MULT, Math.max(0, currentLevel - 1));
  return {
    wood: Math.round((base.wood ?? 0) * mult),
    stone: Math.round((base.stone ?? 0) * mult),
    iron: Math.round((base.iron ?? 0) * mult),
    food: Math.round((base.food ?? 0) * mult)
  };
}

function getUpgradeTimeSec(buildingKey, currentLevel){
  const def = BUILDINGS[buildingKey];
  const baseBuild = def?.buildTimeSec ?? UPGRADE_TIME_BASE_SEC;

  const level = Math.max(1, Number(currentLevel || 1)); 
  // currentLevel=1 significa upgrade 1→2, duplica 1 vez
  let timeSeconds = Math.round(baseBuild * Math.pow(2, level ));
  
  // Aplicar bono de Levitation: -5% por nivel
  const levitationLevel = researchLevels["levitation"] || 0;
  const levitationBonus = 1 - (levitationLevel * 0.05);
  timeSeconds = Math.max(1, Math.floor(timeSeconds * levitationBonus));
  
  return timeSeconds;
}

/* ============================================================
   ✅ POWER SYSTEM (base por edificio + duplica por nivel)
============================================================ */
const BUILDING_POWER_BASE = {
  home: 10, barrack: 25, factory: 30, muster: 18, metal: 15,
  rookery: 40, science: 35, sentinel: 22, storage: 20, theater: 16,
  fortress: 100, eggdragon: 60,

  // ✅ FIELD
  farm: 9,
  mine: 12,
  quarry: 10,
  lumbermill: 9
  };

const POWER_BASE_DEFAULT = 10;

function getBuildingPowerBase(buildingKey){
  return (typeof BUILDING_POWER_BASE[buildingKey] === "number")
    ? BUILDING_POWER_BASE[buildingKey]
    : POWER_BASE_DEFAULT;
}

function getPowerForLevel(buildingKey, level){
  level = Math.max(1, Number(level || 1));
  const base = getBuildingPowerBase(buildingKey);
  return base * Math.pow(2, level - 1);
}

/* ============================================================
   ✅ POWER TOAST (emoji + number en el centro + fade)
============================================================ */
const POWER_EMOJI = "✊";

function ensurePowerToastStyles(){
  if(document.getElementById("powerToastStyles")) return;

  const style = document.createElement("style");
  style.id = "powerToastStyles";
  style.textContent = `
    .power-toast{
      position: fixed;
      left: 50%;
      top: 45%;
      transform: translate(-50%, -50%);
      z-index: 99999;
      font-family: Arial, sans-serif;
      font-weight: 900;
      font-size: 44px;
      letter-spacing: 1px;
      color: #f6ff7a;
      text-shadow:
        0 3px 0 rgba(0,0,0,.55),
        0 10px 18px rgba(0,0,0,.55);
      opacity: 0;
      pointer-events: none;
      will-change: transform, opacity;
      display: inline-flex;
      align-items: center;
      gap: 12px;
      user-select: none;
    }
    .power-toast .pt-emoji{
      font-size: 46px;
      filter: drop-shadow(0 6px 10px rgba(0,0,0,.55));
      transform: translateY(1px);
    }
    .power-toast .pt-text{ font-size: 44px; line-height: 1; }

    @keyframes powerToastFloat {
      0%   { opacity: 0; transform: translate(-50%, -50%) translateY(14px) scale(.95); }
      12%  { opacity: 1; transform: translate(-50%, -50%) translateY(0px) scale(1); }
      70%  { opacity: 1; transform: translate(-50%, -50%) translateY(-18px) scale(1.02); }
      100% { opacity: 0; transform: translate(-50%, -50%) translateY(-34px) scale(1.04); }
    }

    .power-toast.play{
      animation: powerToastFloat 900ms ease-out forwards;
    }
  `;
  document.head.appendChild(style);
}

let _powerToastEl = null;
let _powerToastTimer = null;

function showPowerToast(amount){
  amount = Math.max(0, Math.floor(amount || 0));
  if(amount <= 0) return;

  ensurePowerToastStyles();

  if(!_powerToastEl){
    _powerToastEl = document.createElement("div");
    _powerToastEl.className = "power-toast";
    document.body.appendChild(_powerToastEl);
  }

  _powerToastEl.innerHTML = `
    <span class="pt-emoji">${POWER_EMOJI}</span>
    <span class="pt-text">+${amount} Power</span>
  `;

  _powerToastEl.classList.remove("play");
  void _powerToastEl.offsetWidth;
  _powerToastEl.classList.add("play");

  if(_powerToastTimer) clearTimeout(_powerToastTimer);
  _powerToastTimer = setTimeout(() => {
    if(_powerToastEl) _powerToastEl.classList.remove("play");
  }, 950);
}

function addPower(amount){
  amount = Math.max(0, Math.floor(amount || 0));
  playerResources.power = (playerResources.power || 0) + amount;
  updateResourcesUI();
  showPowerToast(amount);
}

/* ============================================================
   POPULATION TOAST (emoji + number en el centro + fade)
============================================================ */
const POPULATION_EMOJI = "👥";

function ensurePopulationToastStyles(){
  if(document.getElementById("populationToastStyles")) return;

  const style = document.createElement("style");
  style.id = "populationToastStyles";
  style.textContent = `
    .population-toast{
      position: fixed;
      left: 50%;
      top: 45%;
      transform: translate(-50%, -50%);
      z-index: 99999;
      font-family: Arial, sans-serif;
      font-weight: 900;
      font-size: 44px;
      letter-spacing: 1px;
      color: #9df6ff;
      text-shadow:
        0 3px 0 rgba(0,0,0,.55),
        0 10px 18px rgba(0,0,0,.55);
      opacity: 0;
      pointer-events: none;
      will-change: transform, opacity;
      display: inline-flex;
      align-items: center;
      gap: 12px;
      user-select: none;
    }
    .population-toast .pop-emoji{
      font-size: 46px;
      filter: drop-shadow(0 6px 10px rgba(0,0,0,.55));
      transform: translateY(1px);
    }
    .population-toast .pop-text{ font-size: 44px; line-height: 1; }

    @keyframes populationToastFloat {
      0%   { opacity: 0; transform: translate(-50%, -50%) translateY(14px) scale(.95); }
      12%  { opacity: 1; transform: translate(-50%, -50%) translateY(0px) scale(1); }
      70%  { opacity: 1; transform: translate(-50%, -50%) translateY(-18px) scale(1.02); }
      100% { opacity: 0; transform: translate(-50%, -50%) translateY(-34px) scale(1.04); }
    }

    .population-toast.play{
      animation: populationToastFloat 900ms ease-out forwards;
    }
  `;
  document.head.appendChild(style);
}

let _populationToastEl = null;
let _populationToastTimer = null;

function showPopulationToast(amount){
  amount = Math.max(0, Math.floor(amount || 0));
  if(amount <= 0) return;

  ensurePopulationToastStyles();

  if(!_populationToastEl){
    _populationToastEl = document.createElement("div");
    _populationToastEl.className = "population-toast";
    document.body.appendChild(_populationToastEl);
  }

  _populationToastEl.innerHTML = `
    <span class="pop-emoji">${POPULATION_EMOJI}</span>
    <span class="pop-text">+${amount} Population</span>
  `;

  _populationToastEl.classList.remove("play");
  void _populationToastEl.offsetWidth;
  _populationToastEl.classList.add("play");

  if(_populationToastTimer) clearTimeout(_populationToastTimer);
  _populationToastTimer = setTimeout(() => {
    if(_populationToastEl) _populationToastEl.classList.remove("play");
  }, 950);
}

function addPopulation(amount){
  amount = Math.max(0, Math.floor(amount || 0));
  playerResources.poblacion = (playerResources.poblacion || 0) + amount;
  updateResourcesUI();
  showPopulationToast(amount);
}

/* ============================================================
   HELPERS
============================================================ */
function canBuild(cost, resources){
  return Object.keys(cost).every(k => (resources[k] ?? 0) >= cost[k]);
}
function spendResources(cost, resources){
  Object.keys(cost).forEach(k => {
    resources[k] = (resources[k] ?? 0) - cost[k];
  });
}

function formatTime(sec){
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
}

function formatTimeHMS(totalSec){
  totalSec = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if(h > 0) return `${h}h ${m}m ${s}s`;
  return `${m}m ${s}s`;
}

function fmtCostLine(cost){
  const w = cost.wood ?? 0;
  const f = cost.food ?? 0;
  const s = cost.stone ?? 0;
  const i = cost.iron ?? 0;
  return `🪵 ${w} &nbsp; 🍞 ${f} &nbsp; 🪨 ${s} &nbsp; 🧱 ${i}`;
}

/* ============================================================
   ✅ RESOURCE SYSTEM (production + capacity + tooltip like DOA)
============================================================ */
const RESOURCE_DATA = {
  wood:   { perHour: 0, capacity: 0, label: "Wood",  emoji: "🪵" },
  stone:  { perHour: 0,  capacity: 0, label: "Stone", emoji: "🪨" },
  iron:   { perHour: 0, capacity: 0, label: "Iron",  emoji: "🧱" },
  food:   { perHour: 0, capacity: 0, label: "Food",  emoji: "🍞" }
};

const RESOURCE_TICK_MS = 60000;

function clampResourcesToCapacity(){
  // ✅ DOA-style: la capacidad limita la generación, NO borra recursos existentes
  Object.keys(RESOURCE_DATA).forEach(k=>{
    const cur = playerResources[k] ?? 0;
    if(cur < 0) playerResources[k] = 0; // por seguridad
  });
}

/* ============================================================
   FIELD -> BONUS de producción y capacidad (duplica por nivel)
============================================================ */

const FIELD_RESOURCE_MAP = {
  farm: "food",
  mine: "iron",
  quarry: "stone",
  lumbermill: "wood"
};

const FIELD_BONUS_BASE = {
  farm:       { perHour: 150,  capacity: 12000  },
  mine:       { perHour: 150,  capacity: 12000  },
  quarry:     { perHour: 150,  capacity: 12000  },
  lumbermill: { perHour: 150,  capacity: 12000  }
};

function getFieldMultiplierForLevel(level){
  level = Math.max(1, Number(level || 1));
  return Math.pow(2, level - 1);
}

function computeFieldBonuses(){
  const out = {
    wood:  { perHour: 0, capacity: 0 },
    stone: { perHour: 0, capacity: 0 },
    iron:  { perHour: 0, capacity: 0 },
    food:  { perHour: 0, capacity: 0 }
  };

  Object.values(builtFieldSlots).forEach(d=>{
    if(!d || d.state !== "built") return;

    const resKey = FIELD_RESOURCE_MAP[d.building];
    const base = FIELD_BONUS_BASE[d.building];
    if(!resKey || !base) return;

    const mult = getFieldMultiplierForLevel(d.level ?? 1);
    out[resKey].perHour  += base.perHour  * mult;
    out[resKey].capacity += base.capacity * mult;
  });

  return out;
}

function getResourceCapacity(key){
  const base = RESOURCE_DATA[key]?.capacity ?? null;
  if(base === null) return null;

  const fieldBonus = computeFieldBonuses();
  return base + (fieldBonus[key]?.capacity ?? 0);
}

function getResourcePerHour(key){
  const base = RESOURCE_DATA[key]?.perHour ?? 0;

  const fieldBonus = computeFieldBonuses();
  const fieldAmount = fieldBonus[key]?.perHour ?? 0;
  
  // Calcular bonus de investigación
  const researchBonus = getResearchBonus(key);
  
  // Total base (sin research)
  const totalBase = base + fieldAmount;
  
  // Aplicar el bonus de investigación como porcentaje
  let totalWithResearch = totalBase * (1 + researchBonus);
  
  // Si es comida, restar el upkeep de las tropas
  if(key === "food"){
    const upkeepCost = getTotalUpkeep();
    totalWithResearch -= upkeepCost;
  }
  
  return Math.floor(totalWithResearch);
}

// Nueva función: calcula el upkeep total de todas las tropas entrenadas
function getTotalUpkeep(){
  let totalUpkeep = 0;
  
  TROOPS.forEach(troop => {
    const troopCount = troop.have || 0;
    const upkeepPerTroop = troop.stats?.upk || 0;
    totalUpkeep += troopCount * upkeepPerTroop;
  });
  
  return totalUpkeep;
}

// Nueva función: calcula el bonus de investigación para un recurso
function getResearchBonus(resourceKey){
  // Mapeo de recursos a investigaciones que los afectan
  const researchMap = {
    "food": "agriculture",     // Agriculture → +5% food per level
    "wood": "woodcraft",       // Woodcraft → +5% wood per level
    "stone": "masonry",        // Masonry → +5% stone per level
    "iron": "alloys"           // Alloys → +5% iron per level
  };
  
  const researchId = researchMap[resourceKey];
  if(!researchId) return 0; // Si no hay investigación asociada, no hay bonus
  
  const level = researchLevels[researchId] || 0;
  
  // Cada nivel da +5% de bonus (5% = 0.05)
  return level * 0.05;
}

function resourceTick(){
  Object.keys(RESOURCE_DATA).forEach(key=>{
    const cap = getResourceCapacity(key);
    const current = playerResources[key] ?? 0;
    
    const perHour = getResourcePerHour(key);
    const perMinute = perHour / 60;
    const next = current + perMinute;

    // Para comida, permitir valores negativos si el upkeep es mayor que la producción
    if(key === "food"){
      // Si la producción es negativa (upkeep > producción)
      if(perMinute < 0){
        // Consumir comida almacenada
        playerResources[key] = Math.floor(next);
        // Si llega a 0 o menos, mantener en 0 como mínimo
        if(playerResources[key] < 0){
          playerResources[key] = 0;
        }
      } else {
        // Producción positiva normal
        if(typeof cap === "number" && current >= cap) return;
        playerResources[key] = (typeof cap === "number")
          ? Math.min(cap, Math.floor(next))
          : Math.floor(next);
      }
    } else {
      // Otros recursos funcionan normal
      if(typeof cap === "number" && current >= cap) return;
      playerResources[key] = (typeof cap === "number")
        ? Math.min(cap, Math.floor(next))
        : Math.floor(next);
    }
  });

  updateResourcesUI();
  saveGame();
}

/* ----------------------------
   Tooltip flotante
---------------------------- */
let _resTooltipEl = null;

function ensureResourceTooltip(){
  if(_resTooltipEl) return;

  const tip = document.createElement("div");
  tip.id = "resourceTooltip";
  tip.style.position = "fixed";
  tip.style.left = "0px";
  tip.style.top = "0px";
  tip.style.transform = "translate(12px, 12px)";
  tip.style.pointerEvents = "none";
  tip.style.padding = "10px 12px";
  tip.style.background = "rgba(10,20,35,0.95)";
  tip.style.border = "1px solid rgba(74,163,255,0.85)";
  tip.style.borderRadius = "10px";
  tip.style.color = "#e6f3ff";
  tip.style.fontFamily = "Arial, sans-serif";
  tip.style.fontWeight = "800";
  tip.style.fontSize = "13px";
  tip.style.boxShadow = "0 10px 25px rgba(0,0,0,.45)";
  tip.style.zIndex = "99999";
  tip.style.display = "none";
  tip.style.whiteSpace = "nowrap";

  document.body.appendChild(tip);
  _resTooltipEl = tip;
}

function showResourceTooltip(key, clientX, clientY){
  ensureResourceTooltip();

  const def = RESOURCE_DATA[key];
  if(!def) return;

  const current = playerResources[key] ?? 0;
  const cap = getResourceCapacity(key);
  const perHour = getResourcePerHour(key);

  const full = (typeof cap === "number") ? (current >= cap) : false;

  let tooltipContent = `
    <div style="font-size:14px; margin-bottom:6px;">
      ${def.emoji} ${def.label}
    </div>
    <div>📊 ${current}${typeof cap === "number" ? ` / ${cap}` : ""}</div>
  `;

  // Si es comida, mostrar info de upkeep
  if(key === "food"){
    const upkeep = getTotalUpkeep();
    const base = RESOURCE_DATA[key]?.perHour ?? 0;
    const fieldBonus = computeFieldBonuses();
    const fieldAmount = fieldBonus[key]?.perHour ?? 0;
    const researchBonus = getResearchBonus(key);
    const totalBase = base + fieldAmount;
    const production = Math.floor(totalBase * (1 + researchBonus));
    
    tooltipContent += `
      <div style="margin-top:6px; padding-top:6px; border-top:1px solid rgba(255,255,255,0.2);">
        <div>📈 Production: ${production} / hour</div>
        <div>🍖 Upkeep: ${upkeep} / hour</div>
      </div>
      <div style="margin-top:6px; font-weight:900; color:${perHour >= 0 ? "#8dffb0" : "#ff7a7a"};">
        🔁 Net: ${perHour} / hour
      </div>
    `;
  } else {
    tooltipContent += `<div>🔁 ${perHour} / hour</div>`;
  }

  tooltipContent += `
    <div style="margin-top:6px; font-weight:900; color:${full ? "#ff7a7a" : "#8dffb0"};">
      ${full ? "🚫 Storage Full" : "✅ Generating"}
    </div>
  `;

  _resTooltipEl.innerHTML = tooltipContent;

  _resTooltipEl.style.display = "block";
  _resTooltipEl.style.left = `${clientX}px`;
  _resTooltipEl.style.top = `${clientY}px`;
}

function moveResourceTooltip(clientX, clientY){
  if(!_resTooltipEl) return;
  _resTooltipEl.style.left = `${clientX}px`;
  _resTooltipEl.style.top = `${clientY}px`;
}

function hideResourceTooltip(){
  if(!_resTooltipEl) return;
  _resTooltipEl.style.display = "none";
}

function bindResourceHovers(){
  ["wood","stone","iron","food"].forEach(key=>{
    const el = document.getElementById(key);
    if(!el) return;

    el.addEventListener("mouseenter", (e)=>{
      showResourceTooltip(key, e.clientX, e.clientY);
    });

    el.addEventListener("mousemove", (e)=>{
      moveResourceTooltip(e.clientX, e.clientY);
    });

    el.addEventListener("mouseleave", ()=>{
      hideResourceTooltip();
    });
  });
}

/* ============================================================
   UI
============================================================ */
function updateResourcesUI(){
  clampResourcesToCapacity();
  const ids = ["wood","stone","iron","food","gold","poblacion","power"];
  ids.forEach(id=>{
    const el = document.getElementById(id);
    if(!el) return;
    el.textContent = playerResources[id] ?? 0;
  });
}

const gameEl = document.getElementById("game");

function setSelection(text){
  const el = document.getElementById("selectionText");
  if(el) el.textContent = text;
}

/* ============================================================
   ✅ TROOPS SCREEN (Overlay) — NUEVO
============================================================ */

// 1) Datos de tropas (podés ajustar stats/imagenes)
const TROOPS = [
  { id:"porter", name:"Porter", img:"assets/porter.png", have:0,
    stats:{ atk:1, def:10, spd:100, hp:45, load:200, upk:2, pow:1, raa:0, ran:0 },
    desc:"Unidad de transporte. Mucha carga para recolectar recursos.",
    buildings:[{name:"barrack", lvl:1}],
    costs:{ food:50, wood:25 },
    time:"30s"
  },
  { id:"conscript", name:"Conscript", img:"assets/conscript.png", have:0,
    stats:{ atk:10, def:10, spd:200, hp:75, load:20, upk:3, pow:1, raa:0, ran:0 },
    desc:"Infantería básica, barata y rápida.",
    buildings:[{name:"barrack", lvl:1}],
    costs:{ food:75, wood:50, iron:25 },
    time:"1m"
  },
  { id:"spy", name:"Spy", img:"assets/spy.png", have:0,
    stats:{ atk:5, def:5, spd:1000, hp:10, load:0, upk:5, pow:2, raa:0, ran:0 },
    desc:"Espía para exploración. Evitar combate directo.",
    buildings:[{name:"barrack", lvl:2}],
    costs:{ food:100, gold:50 },
    time:"2m"
  },
  
  { id:"halberdsman", name:"Hallberdsman", img:"assets/Hallberdsman.png", have:0,
    stats:{ atk:40, def:40, spd:300, hp:150, load:40, upk:6, pow:2, raa:0, ran:0 },
    desc:"Infantería pesada. Buen aguante.",
    buildings:[{name:"barrack", lvl:3}],
    costs:{ food:200, wood:100, iron:75 },
    time:"3m"
  },
  { id:"minotaur", name:"Minotaur", img:"assets/Minotaur.png", have:0,
    stats:{ atk:70, def:45, spd:275, hp:225, load:30, upk:7, pow:3, raa:0, ran:0 },
    desc:"Bestia melee muy fuerte.",
    buildings:[{name:"barrack", lvl:5}],
    costs:{ food:400, iron:200, gold:100 },
    time:"5m"
  },
  { id:"longbow", name:"Longbow Man", img:"assets/Longbowmen.png", have:0,
    stats:{ atk:5, def:30, spd:250, hp:75, load:25, upk:9, pow:4, raa:80, ran:1200 },
    desc:"Unidad a distancia especializada en daño de rango.",
    buildings:[{name:"barrack", lvl:6}],
    costs:{ food:300, wood:250, iron:150 },
    time:"4m"
  },
  { id:"swift", name:"Swift Strike Dragon", img:"assets/swift strike dragon.png", have:0,
    stats:{ atk:150, def:60, spd:1000, hp:300, load:100, upk:18, pow:5, raa:0, ran:0 },
    desc:"Dragón rápido para ataques relámpago.",
    buildings:[{name:"barrack", lvl:8}],
    costs:{ food:800, iron:500, gold:300 },
    time:"10m"
  },
  { id:"armored", name:"Armored Transport", img:"assets/Armored Transport.png", have:0,
    stats:{ atk:5, def:200, spd:150, hp:750, load:5000, upk:10, pow:6, raa:0, ran:0 },
    desc:"Transporte protegido.",
    buildings:[{name:"barrack", lvl:7}],
    costs:{ food:600, wood:400, iron:300, gold:200 },
    time:"8m"
  },
  { id:"battle", name:"Battle Dragon", img:"assets/battledragon.png", have:0,
    stats:{ atk:300, def:300, spd:750, hp:1500, load:80, upk:35, pow:7, raa:0, ran:0 },
    desc:"Dragón de guerra.",
    buildings:[{name:"barrack", lvl:10}],
    costs:{ food:1500, iron:1000, gold:800 },
    time:"15m"
  },
  { id:"pack", name:"Pack Dragon", img:"assets/packdragon.png", have:0,
    stats:{ atk:150, def:400, spd:1000, hp:850, load:6000, upk:10, pow:6, raa:0, ran:0 },
    desc:"Dragón de carga / soporte.",
    buildings:[{name:"barrack", lvl:9}],
    costs:{ food:1200, wood:600, iron:800, gold:500 },
    time:"12m"
  },
  { id:"giant", name:"Giant", img:"assets/giant.png", have:0,
    stats:{ atk:1000, def:400, spd:120, hp:4000, load:45, upk:100, pow:9, raa:0, ran:0 },
    desc:"Unidad enorme. Lenta pero brutal.",
    buildings:[{name:"barrack", lvl:12}],
    costs:{ food:3000, stone:2000, iron:1500, gold:1200 },
    time:"20m"
  },
  { id:"firemirror", name:"Fire Mirror", img:"assets/firemirror.png", have:0,
    stats:{ atk:20, def:30, spd:50, hp:1500, load:75, upk:250, pow:10, raa:1200, ran:1500 },
    desc:"Unidad especial (placeholder).",
    buildings:[{name:"barrack", lvl:15}],
    costs:{ food:5000, iron:3000, gold:2500 },
    time:"30m"
  },
];

// 2) Inyecta CSS (así NO tocás tu CSS actual)
function ensureTroopsStyles(){
  if(document.getElementById("troopsStyles")) return;
  const st = document.createElement("style");
  st.id = "troopsStyles";
  st.textContent = `

  .troops-overlay{
      position:fixed; inset:0;
      background: rgba(0,0,0,.65);
      display:flex; align-items:center; justify-content:center;
      z-index: 99999;
    }
    .troops-hidden{ display:none !important; }

    .troops-panel{
      width: min(1200px, 92vw);
      height: min(720px, 88vh);
      background:#161616;
      border:2px solid #c9a55a;
      border-radius:10px;
      box-shadow:0 20px 60px rgba(0,0,0,.6);
      overflow:hidden;
      display:flex; flex-direction:column;
    }
    .troops-topbar{
      display:flex; align-items:center; justify-content:space-between;
      padding:10px 14px;
      background: linear-gradient(#262626,#141414);
      border-bottom:1px solid rgba(201,165,90,.35);
    }
    .troops-title{ font-weight:900; color:#e9d7ab; letter-spacing:.5px; }
    .troops-close{
      border:1px solid rgba(201,165,90,.55);
      background:#1c1c1c;
      color:#e9d7ab;
      width:34px; height:30px;
      border-radius:8px;
      cursor:pointer;
    }
    .troops-close:hover{ filter:brightness(1.15); }

    /* ✅ FIX SCROLL: clave para que el overflow funcione en flex */
    .troops-grid{
      padding:12px;

      flex: 1;         /* ✅ ocupa el espacio debajo del topbar */
      min-height: 0;   /* ✅ permite que el overflow recorte y scrollee */

      overflow-y: auto; /* ✅ scroll vertical */
      overflow-x: hidden;

      display:grid;
      grid-template-columns: repeat(4, minmax(220px, 1fr));
      gap:12px;
    }

    /* ✅ Scroll lindo */
    .troops-grid::-webkit-scrollbar{ width: 8px; }
    .troops-grid::-webkit-scrollbar-thumb{
      background: rgba(201,165,90,.55);
      border-radius: 8px;
    }
    .troops-grid::-webkit-scrollbar-track{
      background: rgba(255,255,255,.06);
    }

    .troop-card{
      background:#101010;
      border:2px solid rgba(201,165,90,.65);
      border-radius:10px;
      overflow:hidden;
      display:flex;
      flex-direction:column;
    }
    .troop-header{
      padding:8px 10px;
      background: linear-gradient(#222,#121212);
      color:#f0dfb8;
      font-weight:900;
      text-align:center;
      border-bottom:1px solid rgba(201,165,90,.35);
    }
    .troop-img-wrap{ position:relative; padding:10px; display:flex; justify-content:center; }
    .troop-img{
      width:100%;
      max-height:190px;
      object-fit:cover;
      border-radius:8px;
      border:1px solid rgba(255,255,255,.08);
    }
    .troop-info{
      position:absolute;
      right:14px; bottom:14px;
      width:28px; height:28px;
      border-radius:999px;
      border:1px solid rgba(201,165,90,.65);
      background: rgba(0,0,0,.55);
      color:#e9d7ab;
      cursor:pointer;
      font-weight:900;
    }
    .troop-body{ padding:10px; color:#ddd; font-size:14px; display:flex; flex-direction:column; gap:10px; }
    .troop-stats{
      display:grid;
      grid-template-columns: repeat(3, 1fr);
      gap:8px;
      font-size:13px;
    }
    .tstat{ display:flex; gap:6px; align-items:center; color:#d8d8d8; opacity:.95; }
    .tstat .ico{ width:16px; text-align:center; }
    .troop-have{ color:#cfcfcf; }
    .troop-desc{
      display:none;
      padding:8px;
      border-radius:8px;
      background: rgba(255,255,255,.06);
      border:1px solid rgba(255,255,255,.08);
      line-height:1.25;
    }
    .troop-desc.show{ display:block; }

    .troop-footer{
      margin-top:auto;
      padding:10px;
      display:flex;
      gap:10px;
      justify-content:center;
    }
    .tbtn{
      min-width:96px;
      padding:8px 12px;
      border-radius:999px;
      cursor:pointer;
      border:1px solid rgba(201,165,90,.75);
      background:#143b32;
      color:#e9f1ea;
      font-weight:900;
    }
    .tbtn.secondary{ background:#2b2b2b; color:#e9d7ab; }
    .tbtn:hover{ filter:brightness(1.15); }

    @media (max-width:1050px){ .troops-grid{ grid-template-columns: repeat(3, minmax(220px, 1fr)); } }
    @media (max-width:780px){ .troops-grid{ grid-template-columns: repeat(2, minmax(200px, 1fr)); } }
    @media (max-width:520px){ .troops-grid{ grid-template-columns: 1fr; } }
  `;
  document.head.appendChild(st);
}


// 3) Crea el HTML del overlay (así NO tocás tu HTML)
let troopsOverlayEl = null;
let troopsGridEl = null;

let _troopsEscBound = false;

function ensureTroopsOverlay(){
  ensureTroopsStyles();

  // ✅ Si ya lo creamos/ya lo agarramos, listo
  if(troopsOverlayEl && troopsGridEl) return;

  // ✅ 1) SI EXISTE EN EL HTML, USARLO (NO CREAR OTRO)
  const existing = document.getElementById("troopsOverlay");
  if(existing){
    troopsOverlayEl = existing;
    troopsGridEl = existing.querySelector("#troopsGrid");

    // Asegura clases correctas (sin depender de tu CSS actual)
    troopsOverlayEl.classList.add("troops-overlay");
    troopsOverlayEl.classList.add("troops-hidden"); // arranca oculto

    // Botón cerrar: soporta ambos ids (tu HTML y el mío)
    const closeBtn =
      existing.querySelector("#troopsCloseBtn") ||
      existing.querySelector("#closeTroopsBtn");

    if(closeBtn){
      closeBtn.addEventListener("click", closeTroops);
    }


    return;
  }

  // ✅ 2) Si NO existe en HTML, recién ahí lo creamos (fallback)
  const overlay = document.createElement("div");
  overlay.className = "troops-overlay troops-hidden";
  overlay.id = "troopsOverlay";

  overlay.innerHTML = `
    <div class="troops-panel">
      <div class="troops-topbar">
        <div class="troops-title">Troop Training</div>
        <button class="troops-close" id="troopsCloseBtn">✕</button>
      </div>
      <div class="troops-grid" id="troopsGrid"></div>
    </div>
  `;

  document.body.appendChild(overlay);

  troopsOverlayEl = overlay;
  troopsGridEl = overlay.querySelector("#troopsGrid");

  overlay.querySelector("#troopsCloseBtn").addEventListener("click", closeTroops);
  overlay.addEventListener("click", (e)=>{ if(e.target === overlay) closeTroops(); });

  if(!_troopsEscBound){
    _troopsEscBound = true;
    window.addEventListener("keydown", (e)=>{
      if(e.key === "Escape" && !troopsOverlayEl.classList.contains("troops-hidden")) closeTroops();
    });
  }
}


function renderTroopsGrid(troops){
  const grid = document.getElementById("troopsGrid");
  if(!grid) return;

  grid.innerHTML = "";

  (troops || []).forEach(t => {
    const s = t.stats || {};
    
    // Aplicar bonos de investigación
    const medicineLevel = researchLevels["medicine"] || 0;
    const metallurgyLevel = researchLevels["metallurgy"] || 0;
    const weapCalLevel = researchLevels["weapCal"] || 0;
    
    // Bonos se aplican solo si el stat base > 0
    const atk  = (s.atk ?? 0) > 0 ? Math.floor((s.atk ?? 0) * (1 + metallurgyLevel * 0.05)) : 0;
    const def  = (s.def ?? 0) > 0 ? Math.floor((s.def ?? 0) * (1 + metallurgyLevel * 0.05)) : 0;
    const hp   = (s.hp  ?? 0) > 0 ? Math.floor((s.hp  ?? 0) * (1 + medicineLevel * 0.05)) : 0;
    const ran  = (s.ran ?? 0) > 0 ? Math.floor((s.ran ?? 0) * (1 + weapCalLevel * 0.05)) : 0;
    
    const spd  = s.spd  ?? 0;
    const load = s.load ?? 0;
    const upk  = s.upk  ?? 0;
    const pow  = s.pow  ?? 0;
    const raa  = s.raa  ?? 0;
    
    const card = document.createElement("div");
    card.className = "troop-card";

    card.innerHTML = `
      <div class="troop-header">${t.name}</div>

      <div class="troop-img-wrap">
        <img class="troop-img" src="${t.img}" alt="${t.name}">
        <button class="troop-info" type="button" title="Detalles">i</button>
      </div>

      <div class="troop-body">
        <div class="troop-stats">
          <div class="tstat"><span class="ico">⚔️</span>ATK: <b>${atk}</b></div>
          <div class="tstat"><span class="ico">🛡️</span>DEF: <b>${def}</b></div>
          <div class="tstat"><span class="ico">❤️</span>HP: <b>${hp}</b></div>
          <div class="tstat"><span class="ico">👣</span>SPD: <b>${spd}</b></div>
          <div class="tstat"><span class="ico">📦</span>LOAD: <b>${load}</b></div>
          <div class="tstat"><span class="ico">🍖</span>UPK: <b>${upk}</b></div>
          <div class="tstat"><span class="ico">✊</span>POW: <b>${pow}</b></div>
          <div class="tstat"><span class="ico">🏹</span>RAA: <b>${raa}</b></div>
          <div class="tstat"><span class="ico">🎯</span>RAN: <b>${ran}</b></div>
        </div>

        <div class="troop-have">Have: <b>${t.have ?? 0}</b></div>

        <div class="troop-desc">${t.desc ?? ""}</div>
      </div>

      <div class="troop-footer">
        <button class="tbtn" type="button">Train</button>
        <button class="tbtn secondary dismiss-btn" type="button">Dismiss</button>
      </div>
    `;

    const desc = card.querySelector(".troop-desc");
    const btnDismiss = card.querySelector(".dismiss-btn");
    const btnInfo = card.querySelector(".troop-info");

    function toggleDesc(){
      desc.classList.toggle("show");
    }

    btnInfo.addEventListener("click", toggleDesc);
    
    btnDismiss.addEventListener("click", () => {
      if((t.have || 0) > 0){
        openDismissTroopModal(t.id);
      }
    });

    card.querySelector(".tbtn").addEventListener("click", () => {
      openTroopDetail(t.id);
    });

    grid.appendChild(card);
  });
}

/* ============================================================
   DISMISS TROOP MODAL (Eliminar tropas)
============================================================ */
let currentDismissTroopId = null;

function openDismissTroopModal(troopId){
  const troop = TROOPS.find(t => t.id === troopId);
  if(!troop || (troop.have || 0) <= 0) return;
  
  currentDismissTroopId = troopId;
  const troopCount = troop.have || 0;
  
  const modal = document.getElementById("dismissTroopModal");
  const input = document.getElementById("dismissTroopInput");
  
  if(!modal || !input) return;
  
  // Configurar input
  input.value = 1;
  input.max = troopCount;
  
  // Mostrar modal
  modal.classList.remove("hidden");
}

function closeDismissModal(){
  const modal = document.getElementById("dismissTroopModal");
  if(modal) modal.classList.add("hidden");
  currentDismissTroopId = null;
}

function confirmDismissTroop(){
  if(!currentDismissTroopId) return;
  
  const input = document.getElementById("dismissTroopInput");
  const count = parseInt(input.value) || 0;
  
  if(count > 0){
    dismissTroops(currentDismissTroopId, count);
    closeDismissModal();
    renderTroopsGrid(TROOPS);
  }
}

function dismissTroops(troopId, count){
  const troop = TROOPS.find(t => t.id === troopId);
  if(!troop) return;
  
  const troopCount = troop.have || 0;
  const actualCount = Math.min(count, troopCount);
  
  // Restar tropas
  troop.have = Math.max(0, troopCount - actualCount);
  
  // Restar poder
  const powerLost = actualCount * (troop.stats?.pow || 0);
  playerResources.power = Math.max(0, (playerResources.power || 0) - powerLost);
  
  console.log(`🗑️ Dismissed ${actualCount}x ${troop.name} - Power lost: ${powerLost}`);
  
  // Actualizar UI
  updateResourcesUI();
  saveGame();
}

// Inicializar event listeners del modal de dismiss
function initDismissModal(){
  const confirmBtn = document.getElementById("dismissConfirmBtn");
  const cancelBtn = document.getElementById("dismissCancelBtn");
  const closeBtn = document.getElementById("dismissModalClose");
  
  if(confirmBtn){
    confirmBtn.addEventListener("click", confirmDismissTroop);
  }
  
  if(cancelBtn){
    cancelBtn.addEventListener("click", closeDismissModal);
  }
  
  if(closeBtn){
    closeBtn.addEventListener("click", closeDismissModal);
  }
}

/* ============================================================
   TROOP DETAIL MODAL (Entrenamiento detallado con requisitos)
============================================================ */
let troopDetailOverlayEl = null;
let troopDetailTitleEl = null;
let troopDetailBodyEl = null;
let troopDetailCloseEl = null;
let troopTrainBtn = null;
let troopTrainInput = null;
let troopMaxCountEl = null;

function ensureTroopDetailOverlay(){
  if(troopDetailOverlayEl) return;
  
  troopDetailOverlayEl = document.getElementById("troopDetailOverlay");
  troopDetailTitleEl = document.getElementById("troopDetailTitle");
  troopDetailBodyEl = document.getElementById("troopDetailBody");
  troopDetailCloseEl = document.getElementById("troopDetailClose");
  troopTrainBtn = document.getElementById("troopTrainBtn");
  troopTrainInput = document.getElementById("troopTrainInput");
  troopMaxCountEl = document.getElementById("troopMaxCount");
  
  const maxBtn = document.getElementById("troopTrainMaxBtn");
  
  if(troopDetailCloseEl){
    troopDetailCloseEl.addEventListener("click", closeTroopDetail);
  }
  
  if(maxBtn){
    maxBtn.addEventListener("click", ()=>{
      const maxValue = troopMaxCountEl.textContent || "0";
      troopTrainInput.value = maxValue;
    });
  }
}

function openTroopDetail(troopId){
  ensureTroopDetailOverlay();
  
  const troop = TROOPS.find(t => t.id === troopId);
  if(!troop) return;
  
  troopDetailTitleEl.textContent = troop.name;
  
  // Verificar requisitos
  const reqCheck = checkTroopRequirements(troop);
  
  // Calcular cantidad máxima que puede entrenar
  const maxCanTrain = calculateMaxTroops(troop);
  troopMaxCountEl.textContent = maxCanTrain;
  troopTrainInput.value = 0;
  troopTrainInput.max = maxCanTrain;
  
  // Renderizar el contenido
  troopDetailBodyEl.innerHTML = renderTroopDetail(troop, reqCheck);
  
  // Función para actualizar costos dinámicamente
  function updateTroopCosts(){
    const count = parseInt(troopTrainInput.value) || 0;
    
    if(troop.costs){
      Object.entries(troop.costs).forEach(([resource, baseCost]) => {
        const totalCost = baseCost * count;
        const costEl = document.getElementById(`troop-cost-${resource}`);
        if(costEl){
          const current = playerResources[resource] || 0;
          const meets = current >= totalCost;
          
          costEl.textContent = totalCost.toLocaleString();
          
          if(meets){
            costEl.classList.remove("troop-req-not-met");
          } else {
            costEl.classList.add("troop-req-not-met");
          }
        }
      });
    }
    
    // Actualizar tiempo total multiplicado
    const timeDisplay = document.getElementById("troop-time-display");
    if(timeDisplay && troop.time){
      const totalTimeStr = multiplyTroopTime(troop.time, count);
      timeDisplay.textContent = totalTimeStr;
    }
    
    // Verificar si puede entrenar con la cantidad actual
    const canTrainCount = count > 0 && count <= maxCanTrain;
    const hasResources = checkResourcesForCount(troop, count);
    
    if(reqCheck.canTrain && canTrainCount && hasResources){
      troopTrainBtn.disabled = false;
      troopTrainBtn.textContent = "Train";
    } else {
      troopTrainBtn.disabled = true;
      if(!reqCheck.canTrain){
        troopTrainBtn.textContent = "Requirements not met";
      } else if(!hasResources){
        troopTrainBtn.textContent = "Not enough resources";
      } else {
        troopTrainBtn.textContent = "Train";
      }
    }
  }
  
  // Listener para actualizar costos cuando cambie el input
  troopTrainInput.addEventListener("input", updateTroopCosts);
  
  // Habilitar/deshabilitar botón Train
  if(reqCheck.canTrain && maxCanTrain > 0){
    troopTrainBtn.disabled = false;
    troopTrainBtn.textContent = "Train";
  } else {
    troopTrainBtn.disabled = true;
    troopTrainBtn.textContent = reqCheck.canTrain ? "Not enough resources" : "Requirements not met";
  }
  
  // Evento del botón Train
  troopTrainBtn.onclick = ()=>{
    const count = parseInt(troopTrainInput.value) || 0;
    const hasResources = checkResourcesForCount(troop, count);
    
    if(count > 0 && count <= maxCanTrain && reqCheck.canTrain && hasResources){
      // Descontar recursos
      if(troop.costs){
        Object.entries(troop.costs).forEach(([resource, baseCost]) => {
          const totalCost = baseCost * count;
          playerResources[resource] = (playerResources[resource] || 0) - totalCost;
        });
      }
      
      // Descontar población (cada tropa consume 1)
      playerResources.poblacion = (playerResources.poblacion || 0) - count;
      
      // Calcular poder total de las tropas
      const powerPerTroop = troop.stats?.pow || 0;
      const totalPower = powerPerTroop * count;
      
      // Parsear tiempo y multiplicarlo por la cantidad de tropas
      const timePerTroop = parseTroopTime(troop.time);
      const totalTimeMs = timePerTroop * count;
      
      // Agregar a cola de entrenamiento
      activeTroopTrainings.push({
        troopId: troop.id,
        name: troop.name,
        count: count,
        power: totalPower,
        population: count, // Guardar cuánta población consume
        endsAt: Date.now() + totalTimeMs
      });
      
      console.log(`Training ${count}x ${troop.name} - Power: ${totalPower} - Population used: ${count} - Completes in ${totalTimeMs / 1000} seconds (${Math.floor(totalTimeMs / 60000)}m ${Math.floor((totalTimeMs % 60000) / 1000)}s)`);
      
      // Actualizar UI
      updateResourcesUI();
      saveGame();
      
      // Abrir HUD de tropas
      if(troopTrainingHudPanel){
        troopTrainingHudPanel.classList.remove("hidden");
        renderTroopTrainingHudPanel();
      }
      
      closeTroopDetail();
    }
  };
  
  troopDetailOverlayEl.classList.remove("troop-detail-hidden");
}

// Función auxiliar para verificar recursos según cantidad
function checkResourcesForCount(troop, count){
  if(!troop.costs) return true;
  
  // Verificar recursos
  for(const [resource, baseCost] of Object.entries(troop.costs)){
    const totalCost = baseCost * count;
    const current = playerResources[resource] || 0;
    if(current < totalCost) return false;
  }
  
  // Verificar población (cada tropa consume 1)
  const currentPopulation = playerResources.poblacion || 0;
  if(currentPopulation < count) return false;
  
  return true;
}

// Función para parsear tiempo de tropas
function parseTroopTime(timeStr){
  if(!timeStr || timeStr === "—") return 0;
  
  let totalMs = 0;
  const parts = timeStr.split(" ");
  
  for(let part of parts){
    if(part.includes("h")){
      totalMs += parseInt(part) * 60 * 60 * 1000;
    } else if(part.includes("m")){
      totalMs += parseInt(part) * 60 * 1000;
    } else if(part.includes("s")){
      totalMs += parseInt(part) * 1000;
    }
  }
  
  return totalMs;
}

// Función para multiplicar tiempo de tropa por cantidad
function multiplyTroopTime(timeStr, count){
  if(!timeStr || timeStr === "—" || count === 0) return timeStr || "—";
  if(count === 1) return timeStr;
  
  // Parsear tiempo a milisegundos
  const baseMs = parseTroopTime(timeStr);
  const totalMs = baseMs * count;
  
  // Convertir de vuelta a formato legible
  const totalSeconds = Math.floor(totalMs / 1000);
  
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  
  const parts = [];
  if(hours > 0) parts.push(`${hours}h`);
  if(minutes > 0) parts.push(`${minutes}m`);
  if(seconds > 0 || parts.length === 0) parts.push(`${seconds}s`);
  
  return parts.join(" ");
}

function closeTroopDetail(){
  if(!troopDetailOverlayEl) return;
  troopDetailOverlayEl.classList.add("troop-detail-hidden");
}

function checkTroopRequirements(troop){
  const result = {
    canTrain: true,
    buildings: [],
    resources: []
  };
  
  // Verificar edificios
  if(troop.buildings && troop.buildings.length > 0){
    troop.buildings.forEach(req => {
      const building = Object.values(builtSlots).find(s => 
        s && s.building && s.building.toLowerCase() === req.name.toLowerCase()
      );
      
      const currentLevel = building ? (building.level || 0) : 0;
      const meets = currentLevel >= req.lvl;
      
      result.buildings.push({
        name: req.name,
        required: req.lvl,
        current: currentLevel,
        meets: meets
      });
      
      if(!meets) result.canTrain = false;
    });
  }
  
  // Verificar recursos
  if(troop.costs){
    Object.entries(troop.costs).forEach(([resource, cost]) => {
      const current = playerResources[resource] || 0;
      const meets = current >= cost;
      
      result.resources.push({
        resource: resource,
        required: cost,
        current: current,
        meets: meets
      });
      
      if(!meets) result.canTrain = false;
    });
  }
  
  return result;
}

function calculateMaxTroops(troop){
  if(!troop.costs) return 999;
  
  let maxByResources = 999;
  
  // Limitar por recursos
  Object.entries(troop.costs).forEach(([resource, cost]) => {
    const current = playerResources[resource] || 0;
    const canMake = Math.floor(current / cost);
    maxByResources = Math.min(maxByResources, canMake);
  });
  
  // Limitar por población disponible (cada tropa consume 1 población)
  const currentPopulation = playerResources.poblacion || 0;
  maxByResources = Math.min(maxByResources, currentPopulation);
  
  return Math.max(0, maxByResources);
}

function renderTroopDetail(troop, reqCheck){
  const s = troop.stats || {};
  
  // Aplicar bonos de investigación
  const medicineLevel = researchLevels["medicine"] || 0;
  const metallurgyLevel = researchLevels["metallurgy"] || 0;
  const weapCalLevel = researchLevels["weapCal"] || 0;
  
  // Crear objeto de stats con bonos aplicados (solo si stat base > 0)
  const statsWithBonuses = {
    atk: (s.atk ?? 0) > 0 ? Math.floor((s.atk ?? 0) * (1 + metallurgyLevel * 0.05)) : 0,
    def: (s.def ?? 0) > 0 ? Math.floor((s.def ?? 0) * (1 + metallurgyLevel * 0.05)) : 0,
    hp: (s.hp ?? 0) > 0 ? Math.floor((s.hp ?? 0) * (1 + medicineLevel * 0.05)) : 0,
    spd: s.spd ?? 0,
    load: s.load ?? 0,
    upk: s.upk ?? 0,
    pow: s.pow ?? 0,
    raa: s.raa ?? 0,
    ran: (s.ran ?? 0) > 0 ? Math.floor((s.ran ?? 0) * (1 + weapCalLevel * 0.05)) : 0
  };
  
  // Mapeo de iconos de estadísticas
  const statIcons = {
    atk: "⚔️", def: "🛡️", hp: "❤️", spd: "👣",
    load: "📦", upk: "🍖", pow: "✊", raa: "🏹", ran: "🎯"
  };
  
  // Mapeo de iconos de recursos
  const resourceIcons = {
    food: "🍞", wood: "🪵", stone: "🪨", iron: "⛓️", gold: "🪙"
  };
  
  // Mapeo de imágenes de edificios
  const buildingImages = {
    "barrack": "assets/barrack.png"
  };
  
  // Renderizar estadísticas con bonos aplicados
  const statsHTML = Object.entries(statsWithBonuses).map(([key, value]) => {
    const icon = statIcons[key.toLowerCase()] || "•";
    const label = key.toUpperCase();
    return `
      <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid rgba(201,165,90,0.15);">
        <span style="color:#a89370;">${icon} ${label}</span>
        <span style="font-weight:900;color:#f0e6d2;">${value}</span>
      </div>
    `;
  }).join("");
  
  // Renderizar requisitos de edificios con imagen
  const buildingsHTML = reqCheck.buildings.map(b => {
    const imgSrc = buildingImages[b.name.toLowerCase()] || "assets/houseC.png";
    const meetsClass = b.meets ? "" : "troop-req-not-met";
    return `
      <div style="display:flex;align-items:center;gap:8px;padding:10px;background:rgba(0,0,0,0.3);border-radius:8px;border:1px solid rgba(201,165,90,0.2);">
        <img src="${imgSrc}" style="width:42px;height:42px;object-fit:contain;" alt="${b.name}">
        <div style="flex:1;">
          <div style="font-weight:700;color:#d4c4a0;text-transform:capitalize;">${b.name}</div>
          <div style="font-size:12px;color:#a89370;">Current: Lv.${b.current}</div>
        </div>
        <div class="${meetsClass}" style="background:rgba(20,16,12,0.8);padding:6px 12px;border-radius:6px;font-weight:900;color:#c9a55a;">
          Lv.${b.required}
        </div>
      </div>
    `;
  }).join("");
  
  // Renderizar costos de recursos con IDs para actualización dinámica
  const resourcesHTML = reqCheck.resources.map(r => {
    const icon = resourceIcons[r.resource] || "💎";
    const meetsClass = r.meets ? "" : "troop-req-not-met";
    return `
      <div style="display:flex;align-items:center;gap:8px;padding:10px;background:rgba(0,0,0,0.3);border-radius:8px;border:1px solid rgba(201,165,90,0.2);">
        <div style="font-size:24px;">${icon}</div>
        <div style="flex:1;">
          <div style="font-weight:700;color:#d4c4a0;text-transform:capitalize;">${r.resource}</div>
          <div style="font-size:12px;color:#a89370;">Available: ${r.current.toLocaleString()}</div>
        </div>
        <div id="troop-cost-${r.resource}" class="${meetsClass}" style="background:rgba(20,16,12,0.8);padding:6px 12px;border-radius:6px;font-weight:900;color:#c9a55a;">
          ${r.required.toLocaleString()}
        </div>
      </div>
    `;
  }).join("");
  
  return `
    <div style="display:grid;grid-template-columns:350px 1fr;gap:24px;">
      <!-- Columna izquierda: Imagen y estadísticas -->
      <div>
        <div style="background:rgba(0,0,0,0.4);border:2px solid rgba(201,165,90,0.3);border-radius:12px;padding:16px;margin-bottom:16px;">
          <img src="${troop.img}" style="width:100%;height:auto;border-radius:8px;margin-bottom:12px;" alt="${troop.name}">
          <div style="color:#d4c4a0;font-size:14px;line-height:1.6;margin-bottom:12px;">${troop.desc || ""}</div>
          <div style="color:#8a7a5a;font-size:12px;">⏱ <span id="troop-time-display">${troop.time || "—"}</span></div>
        </div>
        
        <div style="background:rgba(0,0,0,0.4);border:2px solid rgba(201,165,90,0.3);border-radius:12px;padding:16px;">
          <div style="font-weight:900;color:#c9a55a;margin-bottom:12px;font-size:16px;">STATISTICS</div>
          ${statsHTML}
        </div>
      </div>
      
      <!-- Columna derecha: Requisitos -->
      <div>
        <div style="background:rgba(0,0,0,0.4);border:2px solid rgba(201,165,90,0.3);border-radius:12px;padding:20px;margin-bottom:16px;">
          <div style="font-weight:900;color:#c9a55a;margin-bottom:16px;font-size:18px;">REQUIREMENTS</div>
          
          ${buildingsHTML ? `
            <div style="margin-bottom:20px;">
              <div style="font-weight:700;color:#a89370;margin-bottom:10px;font-size:14px;">BUILDINGS</div>
              <div style="display:grid;gap:8px;">${buildingsHTML}</div>
            </div>
          ` : ''}
          
          ${resourcesHTML ? `
            <div>
              <div style="font-weight:700;color:#a89370;margin-bottom:10px;font-size:14px;">RESOURCES</div>
              <div id="troop-resources-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:8px;">${resourcesHTML}</div>
            </div>
          ` : ''}
        </div>
        
        <div style="background:rgba(0,0,0,0.4);border:2px solid rgba(201,165,90,0.3);border-radius:12px;padding:20px;">
          <div style="font-weight:900;color:#c9a55a;margin-bottom:10px;font-size:16px;">POWER AND POPULATION</div>
          <div style="display:flex;gap:16px;">
            <div style="flex:1;text-align:center;padding:12px;background:rgba(201,165,90,0.1);border-radius:8px;">
              <div style="font-size:24px;margin-bottom:4px;">✊</div>
              <div style="font-weight:900;color:#f0e6d2;font-size:20px;">${s.pow || 0}</div>
              <div style="font-size:12px;color:#a89370;">Power</div>
            </div>
            <div style="flex:1;text-align:center;padding:12px;background:rgba(201,165,90,0.1);border-radius:8px;">
              <div style="font-size:24px;margin-bottom:4px;">👥</div>
              <div style="font-weight:900;color:#f0e6d2;font-size:20px;">1</div>
              <div style="font-size:12px;color:#a89370;">Population</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}



function openTroops(){
  ensureTroopsOverlay();
  renderTroopsGrid(TROOPS);

  // por si tu HTML usa "hidden"
  troopsOverlayEl.classList.remove("hidden");
  troopsOverlayEl.classList.remove("troops-hidden");
  isModalOpen = true;
setCanvasInteractivity(false);

}

function closeTroops(){
  if(!troopsOverlayEl) return;

  troopsOverlayEl.classList.add("hidden");       // por si existe en tu HTML
  troopsOverlayEl.classList.add("troops-hidden");
isModalOpen = false;
setCanvasInteractivity(true);
}
/* =========================
   RESEARCH (UI)
   - Solo se cierra con la X
   - Bloquea interacción detrás
========================= */
const RESEARCH = [
  { id:"agriculture",   name:"Agriculture",        desc:"Boosts food production...",            icon:"assets/agriculture.png",               level:1 },
  { id:"woodcraft",     name:"Woodcraft",          desc:"Improves wood gathering...",           icon:"assets/Woodcraft.png",                 level:1 },
  { id:"masonry",       name:"Masonry",            desc:"Enhances stone...",                    icon:"assets/Masonry.png",                   level:1 },
  { id:"alloys",        name:"Alloys",             desc:"Unlocks stronger metal...",            icon:"assets/Alloys.png",                    level:1 },
  { id:"clairvoyance",  name:"Clairvoyance",       desc:"Reveals hidden areas and...",          icon:"assets/Clairvoyance.png",              level:1 },
  { id:"metallurgy",    name:"Metallurgy",         desc:"Refines metalworking for...",          icon:"assets/Metallurgy.png",                level:1 },
  //{ id:"mercantilism",  name:"Mercantilism",       desc:"Improves trade income and...",         icon:"assets/Mercantilism.png",              level:1 },
  { id:"rapidDeploy",   name:"Rapid Deployment",   desc:"Speeds up troop moveme...",            icon:"assets/Rapid Deployment.png",          level:1 },
  { id:"medicine",      name:"Medicine",           desc:"Heals units faster and...",            icon:"assets/Medicine.png",                  level:1 },
  { id:"levitation",    name:"Levitation",         desc:"Reduce the building...",               icon:"assets/Levitation.png",                level:1 },
  //{ id:"draconicWis",   name:"Draconic Wisdom",    desc:"Reduce the heal time of...",           icon:"assets/Draconic Wisdom.png",           level:1 },
  { id:"dragonry",      name:"Dragonry",           desc:"Unlocks dragon training an...",        icon:"assets/Dragonry.png",                  level:1 },
  { id:"weapCal",       name:"Weapons Calibration",desc:"Increases weapon precisio...",         icon:"assets/Weapons Calibrations.png",      level:1 },
  { id:"rationing",     name:"Rationing",          desc:"Reduces resource usage...",            icon:"assets/Rationing.png",                 level:1 },
  { id:"aerialCombat",  name:"Aerial Combat",      desc:"Improves dragon combat...",            icon:"assets/Aerial Combat.png",             level:1 },
];

let researchOverlayEl = null;
let researchGridEl = null;

function ensureResearchOverlay(){
  if (researchOverlayEl) return;
  researchOverlayEl = document.getElementById("researchOverlay");
  researchGridEl    = document.getElementById("researchGrid");

  const btnClose = document.getElementById("researchClose");
  if (btnClose) btnClose.addEventListener("click", closeResearch);

// ✅ NO cerrar al clickear afuera, pero NO bloquear el botón X
researchOverlayEl.addEventListener("click", (e)=>{
  // si clickean la X, dejá que corra su handler
  if (e.target.closest("#researchClose")) return;

  // si clickean adentro del panel, no hacer nada (solo evitar que pase al juego)
  if (e.target.closest(".research-panel")) {
    e.stopPropagation();
    return;
  }

  // si clickean el fondo (overlay), no cierra, pero bloquea el click al juego
  e.stopPropagation();
}, false); // ✅ bubble (sin capture)


  const panel = researchOverlayEl.querySelector(".research-panel");
  if (panel){
    panel.addEventListener("click", (e)=> e.stopPropagation());
  }
}

function renderResearch(){
  if (!researchGridEl) return;

  researchGridEl.innerHTML = RESEARCH.map(r => `
    <div class="research-card" data-research="${r.id}">
      <div class="research-icon">
        <img src="${r.icon}" alt="${r.name}">
      </div>

      <div class="research-mid">
        <div class="research-name">${r.name}</div>
        <div class="research-desc">${r.desc}</div>
        <div class="research-lvl">Lv.${r.level}</div>
      </div>

      <div class="research-actions">
        <button class="rbtn" type="button" data-action="view" data-id="${r.id}">View</button>
      </div>
    </div>
  `).join("");

  researchGridEl.querySelectorAll('[data-action="view"]').forEach(btn=>{
    btn.addEventListener("click", (e)=>{
      e.stopPropagation();
      const id = btn.getAttribute("data-id");
      const r = RESEARCH.find(x=>x.id===id);
      alert(`View: ${r?.name ?? id} (Lv.${r?.level ?? 1})`);

      
    });
  });
}

function openResearch(){
  ensureResearchOverlay();
  renderResearch();

  isModalOpen = true;
  if (typeof setCanvasInteractivity === "function") setCanvasInteractivity(false);

  researchOverlayEl.classList.remove("research-hidden");
  researchOverlayEl.setAttribute("aria-hidden","false");
}

function closeResearch(){
  if (!researchOverlayEl) return;

  isModalOpen = false;
  if (typeof setCanvasInteractivity === "function") setCanvasInteractivity(true);

  researchOverlayEl.classList.add("research-hidden");
  researchOverlayEl.setAttribute("aria-hidden","true");
}



/* ============================================================
   LOCK MODAL
============================================================ */
let isModalOpen = false;

function setCanvasInteractivity(enabled){
  const canvas = gameEl.querySelector("canvas");
  if(canvas){
    canvas.style.pointerEvents = enabled ? "auto" : "none";
  }
}

/* ============================================================
   ✅ FIELD: GIF + TIMER + BADGE + LEVEL BADGE (LO NUEVO)
============================================================ */
function clearFieldTimer(slotId){
  const d = builtFieldSlots[slotId];
  if(!d) return;
  if(d._timer){
    clearTimeout(d._timer);
    d._timer = null;
  }
}

/* ✅ NUEVO: scheduleFieldTimer soporta building + upgrading */
function scheduleFieldTimer(slotId){
  const d = builtFieldSlots[slotId];
  if(!d) return;

  clearFieldTimer(slotId);

  if(!(d.state === "building" || d.state === "upgrading")) return;
  if(!d.endsAt) return;

  const msLeft = d.endsAt - Date.now();
  if(msLeft <= 0){
    if(d.state === "building") finishFieldConstruction(slotId);
    else if(d.state === "upgrading") finishFieldUpgrade(slotId);
    return;
  }

  d._timer = setTimeout(()=>{
    if(d.state === "building") finishFieldConstruction(slotId);
    else if(d.state === "upgrading") finishFieldUpgrade(slotId);
  }, msLeft);
}

function getFieldSlotRect(slotId){
  const field = game.scene.getScene("FieldScene");
  if(!field) return null;
  const slot = field.slots?.find(s=> s.def.id === slotId);
  if(!slot) return null;

  const w = field.scale.width;
  const h = field.scale.height;

  const scale = Math.max(w / field.bg.width, h / field.bg.height);
  const bgW = field.bg.width * scale;
  const bgH = field.bg.height * scale;
  const left = (w - bgW) / 2;
  const top  = (h - bgH) / 2;

  const x = left + bgW * slot.def.x;
  const y = top  + bgH * slot.def.y;

  return { x, y, w: slot.def.w, h: slot.def.h };
}


function placeGifOnFieldSlot(slotId){
  const r = getFieldSlotRect(slotId);
  if(!r) return null;

  const img = document.createElement("img");
  img.src = "assets/Building.gif";
  img.alt = "Building...";
  img.dataset.zone = "field";
  img.dataset.slotId = String(slotId);


  img.style.position = "absolute";
  img.style.left = `${r.x}px`;
  img.style.top = `${r.y}px`;
  img.style.transform = "translate(-50%, -50%)";
  img.style.pointerEvents = "none";
  img.style.zIndex = "60";
  img.style.width = `${Math.max(40, r.w * 1.15)}px`;
  img.style.height = `${Math.max(30, r.h * 1.15)}px`;

  gameEl.style.position = gameEl.style.position || "relative";
  gameEl.appendChild(img);

  return img;
}

function updateFieldGifPosition(slotId){
  const d = builtFieldSlots[slotId];
  if(!d || !d.gifEl) return;

  const r = getFieldSlotRect(slotId);
  if(!r) return;

  d.gifEl.style.left = `${r.x}px`;
  d.gifEl.style.top  = `${r.y}px`;
}

function ensureFieldBadgeStyles(){
  if(document.getElementById("fieldBadgeStyles")) return;

  const st = document.createElement("style");
  st.id = "fieldBadgeStyles";

  // ✅ FIX: faltaba el selector .field-badge { ... }
  st.textContent = `
    .field-badge{
      position:absolute;
      transform: translate(-50%, -50%);
      padding: 3px 8px;
      border-radius: 8px;
      background: rgba(10,20,35,0.75);
      border: 1px solid rgba(74,163,255,0.55);
      color: #e6f3ff;
      font-family: Arial, sans-serif;
      font-weight: 900;
      font-size: 12px;
      z-index: 65;
      pointer-events: none;
      white-space: nowrap;
      text-shadow: 0 2px 3px rgba(0,0,0,.5);
    }
  `;
  document.head.appendChild(st);
}

function setFieldBadge(slotId, text){
  ensureFieldBadgeStyles();

  const d = builtFieldSlots[slotId];
  if(!d) return;

  if(!d.badgeEl){
    d.badgeEl = document.createElement("div");
    d.badgeEl.className = "field-badge";
    gameEl.appendChild(d.badgeEl);
  }

  d.badgeEl.textContent = text || "";

  const r = getFieldSlotRect(slotId);
  if(r){
    // ✅ FIX: mismo offset que usa FieldScene (arriba del slot)
    d.badgeEl.style.left = `${r.x}px`;
    d.badgeEl.style.top  = `${r.y - (r.h * 0.35)}px`;
  }
}

function removeFieldBadge(slotId){
  const d = builtFieldSlots[slotId];
  if(!d) return;
  if(d.badgeEl && d.badgeEl.parentNode){
    d.badgeEl.parentNode.removeChild(d.badgeEl);
  }
  d.badgeEl = null;
}

/* ✅ NUEVO: niveles en Field (badge igual que city pero en FieldScene) */
function clearFieldLevelBadge(slotId){
  const d = builtFieldSlots[slotId];
  if(d?.levelBadge?.container){
    d.levelBadge.container.destroy(true);
  }
  if(d) d.levelBadge = null;
}

/* ============================================================
   ✅ FIELD UPGRADE SYSTEM (NUEVO)
============================================================ */
const FIELD_MAX_LEVEL = 10;
const FIELD_UPGRADE_COST_MULT = 2.1;
const FIELD_UPGRADE_TIME_BASE_SEC = 10;
const FIELD_UPGRADE_TIME_PER_LEVEL_SEC = 6;

function getFieldPopCost(buildingKey, currentLevel){
  // currentLevel = nivel ACTUAL (por ejemplo 1 si vas a mejorar 1→2)
  const base = FIELD_BUILDINGS[buildingKey]?.popBase ?? 0;
  const lvl = Math.max(1, Number(currentLevel || 1));
  return Math.round(base * Math.pow(2, lvl - 1)); // ✅ duplica cada upgrade
}

function getFieldUpgradeCost(buildingKey, currentLevel){
  const base = FIELD_BUILDINGS[buildingKey]?.cost || { wood:0, stone:0, iron:0, food:0 };
  const mult = Math.pow(FIELD_UPGRADE_COST_MULT, Math.max(0, currentLevel - 1));
  return {
    wood:  Math.round((base.wood  ?? 0) * mult),
    stone: Math.round((base.stone ?? 0) * mult),
    iron:  Math.round((base.iron  ?? 0) * mult),
    food:  Math.round((base.food  ?? 0) * mult)
  };
}

function getFieldUpgradeTimeSec(buildingKey, currentLevel){
  const def = FIELD_BUILDINGS[buildingKey];
  const base = def?.buildTimeSec ?? FIELD_UPGRADE_TIME_BASE_SEC;

  const lvl = Math.max(1, Number(currentLevel || 1)); // 1 = upgrade 1→2
  let timeSeconds = Math.round(base * Math.pow(2, lvl - 1));     // duplica: x1, x2, x4, x8...
  
  // Aplicar bono de Levitation: -5% por nivel
  const levitationLevel = researchLevels["levitation"] || 0;
  const levitationBonus = 1 - (levitationLevel * 0.05);
  timeSeconds = Math.max(1, Math.floor(timeSeconds * levitationBonus));
  
  return timeSeconds;
}


function openFieldUpgradeWindow(slotId){
  const frameImg = "assets/buldings.png";
  const closeBtnImg = "assets/salirbutton.png";

  const data = builtFieldSlots[slotId];
  if(!data || data.state !== "built") return;

  const def = FIELD_BUILDINGS[data.building];
  const name = def ? def.name : data.building;

  const currentLevel = data.level ?? 1;
  const nextLevel = currentLevel + 1;
  // ⏳ tiempo de upgrade (duplica cada upgrade)
  const timeSec = getFieldUpgradeTimeSec(data.building, currentLevel);
  const maxed = currentLevel >= FIELD_MAX_LEVEL;

  const cost = getFieldUpgradeCost(data.building, currentLevel);
  const can = canBuild(cost, playerResources);

  const html = `
    <div class="cb-frame" style="background-image:url('${frameImg}')">
      <button class="buildings-close" data-close="modal" aria-label="Cerrar">
        <img src="${closeBtnImg}" alt="X">
      </button>

      <div class="cb-titlebar">Field • Upgrade</div>

      <div class="cb-card" style="margin: 14px;">
        <img class="cb-icon-img" src="${def?.icon || ""}" alt="${name}">
        <div class="cb-title">${name}</div>
        <div class="cb-desc">Level: <b>${currentLevel}</b> ${maxed ? "(MAX)" : `→ <b>${nextLevel}</b>`}</div>

        <div class="cb-costs" style="margin-top:10px;">
          <div class="cb-cost"><span class="cb-cost-ico">🪵</span><span class="cb-cost-txt">${cost.wood}</span></div>
          <div class="cb-cost"><span class="cb-cost-ico">🍞</span><span class="cb-cost-txt">${cost.food}</span></div>
          <div class="cb-cost"><span class="cb-cost-ico">🪨</span><span class="cb-cost-txt">${cost.stone}</span></div>
          <div class="cb-cost"><span class="cb-cost-ico">🧱</span><span class="cb-cost-txt">${cost.iron}</span></div>
        </div>

        <div style="margin-top:10px; font-weight:900; color:rgba(0,0,0,.65);">
          ⏳ Time: ${formatTime(timeSec)}
        </div>

        <button class="cb-field-upgrade btn btn-primary"
                data-slot="${slotId}"
                ${(!can || maxed) ? "disabled" : ""}>
          ${maxed ? "MAX" : "Upgrade"}
        </button>

        ${(!can && !maxed) ? `<div style="margin-top:8px;color:#8b0000;font-weight:800;">No tenés recursos suficientes.</div>` : ""}
      </div>
    </div>
  `;

  openModal("", html, "big");
  updateResourcesUI();
}

function startFieldUpgrade(slotId){
  const d = builtFieldSlots[slotId];
  if(!d || d.state !== "built") return;

  const currentLevel = d.level ?? 1;
  if(currentLevel >= FIELD_MAX_LEVEL){
    setSelection(`⛔ Field building ya está en nivel máximo (${FIELD_MAX_LEVEL})`);
    return;
  }

  const cost = getFieldUpgradeCost(d.building, currentLevel);
const timeSec = getFieldUpgradeTimeSec(d.building, currentLevel);

  const def = FIELD_BUILDINGS[d.building];
  const name = def ? def.name : d.building;

  // ✅ NUEVO: costo de población para este upgrade (duplica por nivel)
  const popCost = getFieldPopCost(d.building, currentLevel);

  // ✅ Chequeo recursos + población
  if(!canBuild(cost, playerResources)){
    setSelection(`❌ No tenés recursos para mejorar ${name} (Lv ${currentLevel} → ${currentLevel+1})`);
    return;
  }
  if((playerResources.poblacion ?? 0) < popCost){
    setSelection(`❌ No tenés población para mejorar ${name}. Requiere ${popCost} población.`);
    return;
  }

  // ✅ Gastar recursos + población
  spendResources(cost, playerResources);
  playerResources.poblacion -= popCost;
  updateResourcesUI();

  // destruir sprite y badge phaser (si existía)
  if(d.sprite){
    d.sprite.destroy();
    d.sprite = null;
  }
  clearFieldLevelBadge(slotId);

  d.state = "upgrading";
  d.endsAt = Date.now() + timeSec * 1000;

  if(d.gifEl && d.gifEl.parentNode) d.gifEl.parentNode.removeChild(d.gifEl);
  d.gifEl = placeGifOnFieldSlot(slotId);

  //setFieldBadge(slotId, `⏳ ${formatTime(timeSec)}`);

  builtFieldSlots[slotId] = d;

  setSelection(`⏫ Mejorando ${name} en Field Slot ${slotId} (Lv ${currentLevel} → ${currentLevel+1}) (${formatTime(timeSec)})`);
  scheduleFieldTimer(slotId);
  saveGame();
}

function finishFieldUpgrade(slotId){
  const d = builtFieldSlots[slotId];
  if(!d || d.state !== "upgrading") return;

  clearFieldTimer(slotId);

  if(d.gifEl && d.gifEl.parentNode){
    d.gifEl.parentNode.removeChild(d.gifEl);
  }
  d.gifEl = null;

  d.state = "built";
  d.endsAt = null;
  d.level = (d.level ?? 1) + 1;
    
  // ✅ POWER: sumar power por upgrade en FIELD
  const pGain = getPowerForLevel(d.building, d.level);
  addPower(pGain);


  // recrear sprite + level badge
  const field = game.scene.getScene("FieldScene");
  if(field && field.scene.isActive()){
    field.createFieldSprite?.(slotId);
    field.createOrUpdateFieldLevelBadge?.(slotId);
  }

  //setFieldBadge(slotId, `Lv ${d.level}`);

  const def = FIELD_BUILDINGS[d.building];
  setSelection(`✅ ${def ? def.name : d.building} mejorada a Lv ${d.level} en Field Slot ${slotId} (+${pGain} Power)`);


  saveGame();
}

function startFieldConstruction(slotId, buildingKey){
  const def = FIELD_BUILDINGS[buildingKey];
  if(!def){
    setSelection(`❌ Edificio FIELD inválido: ${buildingKey}`);
    return;
  }

  // Aplicar bono de Levitation: -5% por nivel
  let buildTime = def.buildTimeSec ?? 10;
  const levitationLevel = researchLevels["levitation"] || 0;
  const levitationBonus = 1 - (levitationLevel * 0.05);
  buildTime = Math.max(1, Math.floor(buildTime * levitationBonus));
  
  const endsAt = Date.now() + buildTime * 1000;

  builtFieldSlots[slotId] = {
    state: "building",
    building: buildingKey,
    level: 0,
    endsAt,
    gifEl: null,
    sprite: null,
    _timer: null,
    badgeEl: null,
    levelBadge: null
  };

  builtFieldSlots[slotId].gifEl = placeGifOnFieldSlot(slotId);

  setSelection(`⏳ Construyendo ${def.name} en Field Slot ${slotId} (${formatTime(def.buildTimeSec ?? 10)})`);

  scheduleFieldTimer(slotId);
  saveGame();
}

function finishFieldConstruction(slotId){
  const d = builtFieldSlots[slotId];
  if(!d || d.state !== "building") return;

  clearFieldTimer(slotId);

  if(d.gifEl && d.gifEl.parentNode){
    d.gifEl.parentNode.removeChild(d.gifEl);
  }
  d.gifEl = null;

  d.state = "built";
  d.level = 1;
  d.endsAt = null;
   // ✅ POWER: sumar power por construcción en FIELD
  const pGain = getPowerForLevel(d.building, d.level); // d.level es 1
  addPower(pGain);



  // dibujar sprite en FieldScene si está activa
  const field = game.scene.getScene("FieldScene");
  if(field && field.scene.isActive()){
    field.createFieldSprite?.(slotId);
    field.createOrUpdateFieldLevelBadge?.(slotId);
  }
  const def = FIELD_BUILDINGS[d.building];
  setSelection(`✅ ${def ? def.name : d.building} terminada en Field Slot ${slotId} (+${pGain} Power)`);


  saveGame();
}

// refresco visual del badge/gif (1s)
setInterval(()=>{
  Object.entries(builtFieldSlots).forEach(([id, d])=>{
    const slotId = Number(id);
    if(!d) return;

    if((d.state === "building" || d.state === "upgrading") && d.endsAt){
      const left = Math.max(0, Math.ceil((d.endsAt - Date.now()) / 1000));
      updateFieldGifPosition(slotId);
      // refrescar badge con el tiempo
     //setFieldBadge(slotId, `⏳ ${formatTimeHMS(left)}`);
    }else if(d.state === "built"){
    }
  });
}, 1000);

/* ============================================================
   CONSTRUCTION HUD (CITY + FIELD) ✅ MODIFICADO
============================================================ */
let constructionBtn, constructionPanel, constructionBody;

/* ✅ MOD: incluye City + Field */
function getActiveConstructions(){
  const city = Object.entries(builtSlots)
    .filter(([,v]) => v && (v.state === "building" || v.state === "upgrading"))
    .map(([slotId, v]) => ({
      slotId: Number(slotId),
      building: v.building,
      state: v.state,
      level: v.level ?? 1,
      endsAt: v.endsAt,
      zone: "city"
    }));

  const field = Object.entries(builtFieldSlots)
    .filter(([,v]) => v && (v.state === "building" || v.state === "upgrading"))
    .map(([slotId, v]) => ({
      slotId: Number(slotId),
      building: v.building,
      state: v.state,
      level: v.level ?? 1,
      endsAt: v.endsAt,
      zone: "field"
    }));

  return [...city, ...field].sort((a,b)=> a.endsAt - b.endsAt);
}

function renderConstructionPanel(){
  if(!constructionBody) return;

  const active = getActiveConstructions();

  if(!active.length){
    constructionBody.innerHTML = `<div class="cp-empty">No active constructions</div>`;
    return;
  }

  constructionBody.innerHTML = active.map(item => {
    const leftSec = Math.ceil((item.endsAt - Date.now()) / 1000);
    const time = formatTimeHMS(leftSec);

    const def = (item.zone === "field") ? FIELD_BUILDINGS[item.building] : BUILDINGS[item.building];
    const name = def ? def.name : item.building;

    const title =
      item.state === "upgrading"
        ? `Upgrading ${name} (Lv ${item.level} → ${item.level + 1}) (Slot ${item.slotId})`
        : `${name} (Slot ${item.slotId})`;

    return `
      <div class="cp-row" data-slot="${item.slotId}" data-zone="${item.zone}">
        <div class="cp-left">
          <div class="cp-title">${title}</div>
          <div class="cp-sub">${item.zone === "field" ? "Field" : "Main city"}</div>
        </div>

        <div class="cp-time">${time}</div>

        <button class="cp-acc" data-acc="${item.slotId}" data-zone="${item.zone}">Accelerate</button>
      </div>
    `;
  }).join("");
}

function initConstructionHUD(){
  const iconPath = "assets/construction_icon.png";
  const closeIcon = "assets/salirbutton.png";

  constructionBtn = document.createElement("button");
  constructionBtn.className = "construction-btn";
  constructionBtn.innerHTML = `<img src="${iconPath}" alt="Construction">`;
  constructionBtn.title = "Construction";

  constructionPanel = document.createElement("div");
  constructionPanel.className = "construction-panel hidden";
  constructionPanel.innerHTML = `
    <div class="cp-header">
      <div>Construction</div>
      <button class="cp-close" id="cpCloseBtn" aria-label="Close">
        <img src="${closeIcon}" alt="X">
      </button>
    </div>
    <div class="cp-body" id="cpBody"></div>
  `;

  gameEl.style.position = gameEl.style.position || "relative";
  gameEl.appendChild(constructionBtn);
  gameEl.appendChild(constructionPanel);

  constructionBody = constructionPanel.querySelector("#cpBody");

  constructionBtn.addEventListener("click", (e)=>{
    e.preventDefault();
    e.stopPropagation();
    constructionPanel.classList.toggle("hidden");
    renderConstructionPanel();
  });

  constructionPanel.querySelector("#cpCloseBtn").addEventListener("click", (e)=>{
    e.preventDefault();
    e.stopPropagation();
    constructionPanel.classList.add("hidden");
  });

  renderConstructionPanel();
}

setInterval(() => {
  if(!constructionPanel) return;
  if(constructionPanel.classList.contains("hidden")) return;
  renderConstructionPanel();
}, 1000);

/* ============================================================
   RESEARCH HUD (Similar al Construction)
============================================================ */
let researchBtn, researchHudPanel, researchHudBody;

// Array temporal para guardar investigaciones en progreso
let activeResearches = [];

// Objeto para guardar el nivel actual de cada investigación
let researchLevels = {}; // { "agriculture": 3, "woodcraft": 2, ... }

// Nivel máximo de investigaciones
const MAX_RESEARCH_LEVEL = 10;

function getActiveResearches(){
  // Por ahora retornamos el array temporal
  // Más adelante esto se conectará con el sistema real de investigaciones
  return activeResearches.filter(r => r.endsAt > Date.now());
}

function renderResearchHudPanel(){
  if(!researchHudBody) return;

  const active = getActiveResearches();

  if(!active.length){
    researchHudBody.innerHTML = `<div class="rh-empty">No active research</div>`;
    return;
  }

  researchHudBody.innerHTML = active.map(item => {
    const leftSec = Math.ceil((item.endsAt - Date.now()) / 1000);
    const time = formatTimeHMS(leftSec);

    return `
      <div class="rh-row">
        <div class="rh-left">
          <div class="rh-title">${item.name} (Lv ${item.level} → ${item.level + 1})</div>
          <div class="rh-sub">Research</div>
        </div>

        <div class="rh-time">${time}</div>

        <button class="rh-acc" data-research="${item.id}">Accelerate</button>
      </div>
    `;
  }).join("");
  
  // Agregar eventos a los botones Accelerate
  researchHudBody.querySelectorAll('.rh-acc').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const researchId = btn.getAttribute('data-research');
      
      // Buscar y completar la investigación inmediatamente
      const index = activeResearches.findIndex(r => r.id === researchId);
      if(index !== -1){
        const research = activeResearches[index];
        const newLevel = research.level + 1;
        
        // Guardar el nuevo nivel
        researchLevels[research.id] = newLevel;
        
        // Remover de activas
        activeResearches.splice(index, 1);
        
        // Actualizar panel
        renderResearchHudPanel();
        
        // Mensajes especiales para investigaciones de recursos
        const resourceBonusMap = {
          "agriculture": { resource: "food", emoji: "🍞" },
          "woodcraft": { resource: "wood", emoji: "🪵" },
          "masonry": { resource: "stone", emoji: "🪨" },
          "alloys": { resource: "iron", emoji: "⛓️" }
        };
        
        const bonusInfo = resourceBonusMap[research.id];
        if(bonusInfo){
          const totalBonus = newLevel * 5;
          console.log(`⚡ Research accelerated: ${research.name} Level ${research.level} → ${newLevel}`);
          console.log(`   ${bonusInfo.emoji} ${bonusInfo.resource.toUpperCase()} generation bonus: +${totalBonus}%`);
        } else {
          console.log("⚡ Research accelerated:", research.name, "Level", research.level, "→", newLevel);
        }
      }
    });
  });
}

function initResearchHUD(){
  const iconPath = "assets/ui_icon_research.png";
  const closeIcon = "assets/salirbutton.png";

  researchBtn = document.createElement("button");
  researchBtn.className = "research-hud-btn";
  researchBtn.innerHTML = `<img src="${iconPath}" alt="Research">`;
  researchBtn.title = "Research";

  researchHudPanel = document.createElement("div");
  researchHudPanel.className = "research-hud-panel hidden";
  researchHudPanel.innerHTML = `
    <div class="rh-header">
      <div>Research</div>
      <button class="rh-close" id="rhCloseBtn" aria-label="Close">
        <img src="${closeIcon}" alt="X">
      </button>
    </div>
    <div class="rh-body" id="rhBody"></div>
  `;

  gameEl.style.position = gameEl.style.position || "relative";
  gameEl.appendChild(researchBtn);
  gameEl.appendChild(researchHudPanel);

  researchHudBody = researchHudPanel.querySelector("#rhBody");

  researchBtn.addEventListener("click", (e)=>{
    e.preventDefault();
    e.stopPropagation();
    researchHudPanel.classList.toggle("hidden");
    renderResearchHudPanel();
  });

  researchHudPanel.querySelector("#rhCloseBtn").addEventListener("click", (e)=>{
    e.preventDefault();
    e.stopPropagation();
    researchHudPanel.classList.add("hidden");
  });

  renderResearchHudPanel();
}

setInterval(() => {
  // Revisar si alguna investigación ha terminado
  const now = Date.now();
  const completed = activeResearches.filter(r => r.endsAt <= now);
  
  if(completed.length > 0){
    completed.forEach(r => {
      const newLevel = r.level + 1;
      
      // Guardar el nuevo nivel
      researchLevels[r.id] = newLevel;
      
      // Mensajes especiales para investigaciones de recursos
      const resourceBonusMap = {
        "agriculture": { resource: "food", emoji: "🍞" },
        "woodcraft": { resource: "wood", emoji: "🪵" },
        "masonry": { resource: "stone", emoji: "🪨" },
        "alloys": { resource: "iron", emoji: "⛓️" }
      };
      
      const bonusInfo = resourceBonusMap[r.id];
      if(bonusInfo){
        const totalBonus = newLevel * 5;
        console.log(`✅ Research completed: ${r.name} Level ${r.level} → ${newLevel}`);
        console.log(`   ${bonusInfo.emoji} ${bonusInfo.resource.toUpperCase()} generation bonus: +${totalBonus}%`);
      } else {
        console.log("✅ Research completed:", r.name, "Level", r.level, "→", newLevel);
      }
    });
    
    // Remover las investigaciones completadas
    activeResearches = activeResearches.filter(r => r.endsAt > now);
  }
  
  // Actualizar el panel si está visible
  if(!researchHudPanel) return;
  if(researchHudPanel.classList.contains("hidden")) return;
  renderResearchHudPanel();
}, 1000);

/* ============================================================
   TROOP TRAINING HUD (Similar al Construction y Research)
============================================================ */
let troopTrainingBtn, troopTrainingHudPanel, troopTrainingHudBody;

// Array para guardar entrenamientos en progreso
let activeTroopTrainings = [];

function getActiveTroopTrainings(){
  return activeTroopTrainings.filter(t => t.endsAt > Date.now());
}

function renderTroopTrainingHudPanel(){
  if(!troopTrainingHudBody) return;

  const active = getActiveTroopTrainings();

  if(!active.length){
    troopTrainingHudBody.innerHTML = `<div class="th-empty">No active troop training</div>`;
    return;
  }

  troopTrainingHudBody.innerHTML = active.map(item => {
    const leftSec = Math.ceil((item.endsAt - Date.now()) / 1000);
    const time = formatTimeHMS(leftSec);

    return `
      <div class="th-row">
        <div class="th-left">
          <div class="th-title">${item.count}x ${item.name}</div>
          <div class="th-sub">Troop Training</div>
        </div>

        <div class="th-time">${time}</div>

        <button class="th-acc" data-troop="${item.troopId}">Accelerate</button>
      </div>
    `;
  }).join("");
  
  // Agregar eventos a los botones Accelerate
  troopTrainingHudBody.querySelectorAll('.th-acc').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const troopId = btn.getAttribute('data-troop');
      
      // Completar el entrenamiento inmediatamente
      const index = activeTroopTrainings.findIndex(t => t.troopId === troopId);
      if(index !== -1){
        const training = activeTroopTrainings[index];
        
        // Agregar las tropas entrenadas
        const troop = TROOPS.find(t => t.id === training.troopId);
        if(troop){
          troop.have = (troop.have || 0) + training.count;
        }
        
        // Sumar el poder total al poder del jugador con efecto visual
        if(training.power){
          playerResources.power = (playerResources.power || 0) + training.power;
          showPowerToast(training.power);
        }
        
        // Devolver la población con efecto visual
        if(training.population){
          playerResources.poblacion = (playerResources.poblacion || 0) + training.population;
          // showPopulationToast removed
        }
        
        // Remover de activas
        activeTroopTrainings.splice(index, 1);
        
        // Actualizar panel y UI
        renderTroopTrainingHudPanel();
        updateResourcesUI();
        saveGame();
        
        console.log("⚡ Troop training accelerated:", training.count, "x", training.name, "- Power gained:", training.power, "- Population returned:", training.population);
      }
    });
  });
}

function initTroopTrainingHUD(){
  const iconPath = "assets/ui_icon_troop.png";
  const closeIcon = "assets/salirbutton.png";

  troopTrainingBtn = document.createElement("button");
  troopTrainingBtn.className = "troop-training-hud-btn";
  troopTrainingBtn.innerHTML = `<img src="${iconPath}" alt="Troop Training">`;
  troopTrainingBtn.title = "Troop Training";

  troopTrainingHudPanel = document.createElement("div");
  troopTrainingHudPanel.className = "troop-training-hud-panel hidden";
  troopTrainingHudPanel.innerHTML = `
    <div class="th-header">
      <div>Troop Training</div>
      <button class="th-close" id="thCloseBtn" aria-label="Close">
        <img src="${closeIcon}" alt="X">
      </button>
    </div>
    <div class="th-body" id="thBody"></div>
  `;

  gameEl.style.position = gameEl.style.position || "relative";
  gameEl.appendChild(troopTrainingBtn);
  gameEl.appendChild(troopTrainingHudPanel);

  troopTrainingHudBody = troopTrainingHudPanel.querySelector("#thBody");

  troopTrainingBtn.addEventListener("click", (e)=>{
    e.preventDefault();
    e.stopPropagation();
    troopTrainingHudPanel.classList.toggle("hidden");
    renderTroopTrainingHudPanel();
  });

  troopTrainingHudPanel.querySelector("#thCloseBtn").addEventListener("click", (e)=>{
    e.preventDefault();
    e.stopPropagation();
    troopTrainingHudPanel.classList.add("hidden");
  });

  renderTroopTrainingHudPanel();
}

setInterval(() => {
  // Revisar si algún entrenamiento ha terminado
  const now = Date.now();
  const completed = activeTroopTrainings.filter(t => t.endsAt <= now);
  
  if(completed.length > 0){
    completed.forEach(training => {
      const troop = TROOPS.find(t => t.id === training.troopId);
      if(troop){
        // Agregar tropas al inventario
        troop.have = (troop.have || 0) + training.count;
        
        // Sumar el poder total al poder del jugador con efecto visual
        if(training.power){
          playerResources.power = (playerResources.power || 0) + training.power;
          showPowerToast(training.power);
        }
        
        // Devolver la población con efecto visual
        if(training.population){
          playerResources.poblacion = (playerResources.poblacion || 0) + training.population;
          // showPopulationToast removed
        }
        
        console.log(`✅ Training completed: ${training.count}x ${training.name} - Power gained: ${training.power} - Population returned: ${training.population}`);
      }
    });
    
    // Remover entrenamientos completados
    activeTroopTrainings = activeTroopTrainings.filter(t => t.endsAt > now);
    
    // Actualizar UI
    updateResourcesUI();
    saveGame();
  }
  
  // Actualizar el panel si está visible
  if(!troopTrainingHudPanel) return;
  if(troopTrainingHudPanel.classList.contains("hidden")) return;
  renderTroopTrainingHudPanel();
}, 1000);

/* ✅ MOD: accelerate sirve para city y field */
document.addEventListener("click", (e)=>{
  const acc = e.target.closest("[data-acc]");
  if(!acc) return;

  const slotId = Number(acc.dataset.acc);
  const zone = acc.dataset.zone || "city";

  if(zone === "field"){
    const data = builtFieldSlots[slotId];
    if(data && (data.state === "building" || data.state === "upgrading")){
      data.endsAt -= 500000;
      scheduleFieldTimer(slotId);
      renderConstructionPanel();
      setSelection(`⚡ Accelerate Field Slot ${slotId} (-4000s demo)`);
      saveGame();
    }
    return;
  }

  const data = builtSlots[slotId];
  if(data && (data.state === "building" || data.state === "upgrading")){
    data.endsAt -= 500000;
    scheduleTimerForSlot(slotId);
    renderConstructionPanel();
    setSelection(`⚡ Accelerate Slot ${slotId} (-4000s demo)`);
    saveGame();
  }
});

/* ============================================================
   MODAL
============================================================ */
function openModal(title, html, cardClass){
  const modal = document.getElementById("modal");
  const mt = document.getElementById("modal-title");
  const mb = document.getElementById("modal-body");
  if(!modal) return;

  if(mt) mt.textContent = title || "Título";
  if(mb) mb.innerHTML = html || "";

  const card = modal.querySelector(".modal-card");
  if(card){
    card.classList.remove("big");
    if(cardClass) card.classList.add(cardClass);
  }

  modal.classList.remove("hidden");
  modal.classList.add("open");

  isModalOpen = true;
  setCanvasInteractivity(false);
}

function closeModal(){
  const modal = document.getElementById("modal");
  if(!modal) return;

  const card = modal.querySelector(".modal-card");
  if(card) card.classList.remove("big");

  modal.classList.remove("open");
  modal.classList.add("hidden");

  isModalOpen = false;
  setCanvasInteractivity(true);
}

document.addEventListener("click", (e)=>{
  const closeBtn = e.target.closest("[data-close='modal']");
  if(closeBtn){
    e.preventDefault();
    e.stopPropagation();
    closeModal();
  }
});

/* ============================================================
   GIF overlay (auto-fit al slot) (CITY)
============================================================ */
function placeGifOnSlot(slotId){
  if(!window.cityScene) return null;
  const scene = window.cityScene;

  const slot = scene.slots.find(s => s.def.id === slotId);
  if(!slot) return null;

  const x = scene.scale.width * slot.def.x;
  const y = scene.scale.height * slot.def.y;

  const gifW = Math.max(30, slot.def.w * 1.1);
  const gifH = Math.max(20, slot.def.h * 1.1);

  const img = document.createElement("img");
  img.src = "assets/Building.gif";
  img.alt = "Building...";
  img.dataset.zone = "city";
  img.dataset.slotId = String(slotId);

  img.style.position = "absolute";
  img.style.left = `${x}px`;
  img.style.top = `${y}px`;
  img.style.transform = "translate(-50%, -50%)";
  img.style.pointerEvents = "none";
  img.style.zIndex = "50";
  img.style.width = `${gifW}px`;
  img.style.height = `${gifH}px`;

  gameEl.style.position = gameEl.style.position || "relative";
  gameEl.appendChild(img);

  return img;
}

function updateGifPosition(slotId){
  if(!window.cityScene) return;
  const scene = window.cityScene;
  const data = builtSlots[slotId];
  if(!data || !data.gifEl) return;

  const slot = scene.slots.find(s => s.def.id === slotId);
  if(!slot) return;

  const x = scene.scale.width * slot.def.x;
  const y = scene.scale.height * slot.def.y;

  data.gifEl.style.left = `${x}px`;
  data.gifEl.style.top = `${y}px`;
}

/* ============================================================
   ✅ NIVEL BADGE (CITY)
============================================================ */
function createOrUpdateLevelBadge(slotId){
  if(!window.cityScene) return;
  const scene = window.cityScene;

  const data = builtSlots[slotId];
  if(!data || data.state !== "built") return;

  const slot = scene.slots.find(s => s.def.id === slotId);
  if(!slot) return;

  const x = scene.scale.width * slot.def.x;
  const y = scene.scale.height * slot.def.y;

 let offsetX = 0;
let offsetY = 0;

if(data.building === "eggdragon"){
  offsetX = 0;
  offsetY = -20;   // sube más el número en el egg
}else if(data.building === "fortress"){
  offsetX = -20;  // ejemplo: lo corre a la izquierda
  offsetY = -90;   // lo sube más para que no tape
}else{
  offsetX = slot.def.w * 0.00;
  offsetY = slot.def.h * -0.30;
}


  const lvl = data.level ?? 1;

  if(!data.levelBadge){
    const bg = scene.add.image(0, 0, "lvlBadge");
    bg.setDepth(999);

    const badgeTarget = Math.max(18, Math.min(slot.def.w, slot.def.h) * 0.10);
    bg.setDisplaySize(badgeTarget, badgeTarget);

    const txt = scene.add.text(0, 0, String(lvl), {
      fontFamily: "Arial",
      fontSize: `${Math.round(badgeTarget * 0.7)}px`,
      fontStyle: "bold",
      color: "#2b1b00"
    });
    txt.setOrigin(0.5);
    txt.setDepth(1000);

    const container = scene.add.container(x + offsetX, y - offsetY, [bg, txt]);
    container.setDepth(1000);

    data.levelBadge = { container, bg, text: txt };
  } else {
    data.levelBadge.text.setText(String(lvl));
    data.levelBadge.container.setPosition(x + offsetX, y - offsetY);
  }
}

/* ============================================================
   ✅ DOA HOVER EFFECT (CITY)
============================================================ */
function ensureDoaHoverOutline(slotId){
  if(!window.cityScene) return;
  const scene = window.cityScene;

  const data = builtSlots[slotId];
  if(!data || data.state !== "built" || !data.sprite) return;

  if(data.hoverOutline && data.hoverOutline.active) return;

  const outline = scene.add.image(data.sprite.x, data.sprite.y, data.sprite.texture.key);
  outline.setDepth(data.sprite.depth - 1);
  outline.setScale(data.sprite.scaleX * 1.08, data.sprite.scaleY * 1.08);

  outline.setTint(0xffffdd);
  outline.setAlpha(0.55);
  outline.disableInteractive();
  outline.setVisible(false);

  data.hoverOutline = outline;
}

function showDoaHover(slotId){
  const data = builtSlots[slotId];
  if(!data || data.state !== "built" || !data.sprite) return;

  ensureDoaHoverOutline(slotId);

  if(data.hoverOutline){
    data.hoverOutline.setVisible(true);
    data.hoverOutline.setPosition(data.sprite.x, data.sprite.y);
    data.hoverOutline.setScale(data.sprite.scaleX * 1.08, data.sprite.scaleY * 1.08);
  }
}

function hideDoaHover(slotId){
  const data = builtSlots[slotId];
  if(!data) return;
  if(data.hoverOutline){
    data.hoverOutline.setVisible(false);
  }
}

/* ============================================================
   ✅ NUEVO: ocultar visuals durante upgrading (CITY)
============================================================ */
function destroyBuiltVisuals(slotId){
  const data = builtSlots[slotId];
  if(!data) return;

  if(data.sprite){
    data.sprite.destroy();
    data.sprite = null;
  }
  if(data.hoverOutline){
    data.hoverOutline.destroy();
    data.hoverOutline = null;
  }
  if(data.levelBadge?.container){
    data.levelBadge.container.destroy(true);
    data.levelBadge = null;
  }
}

/* ============================================================
   BUILD / UPGRADE (timers + save) (CITY)
============================================================ */
function clearSlotTimer(slotId){
  const data = builtSlots[slotId];
  if(!data) return;
  if(data._timer){
    clearTimeout(data._timer);
    data._timer = null;
  }
}

function scheduleTimerForSlot(slotId){
  const data = builtSlots[slotId];
  if(!data) return;

  clearSlotTimer(slotId);

  if(!(data.state === "building" || data.state === "upgrading")) return;
  if(!data.endsAt) return;

  const msLeft = data.endsAt - Date.now();

  if(msLeft <= 0){
    if(data.state === "building") finishConstruction(slotId);
    else if(data.state === "upgrading") finishUpgrade(slotId);
    return;
  }

  data._timer = setTimeout(() => {
    if(data.state === "building") finishConstruction(slotId);
    else if(data.state === "upgrading") finishUpgrade(slotId);
  }, msLeft);
}

function startConstruction(slotId, buildingKey){
  const def = BUILDINGS[buildingKey];
  if(!def){
    setSelection(`❌ Edificio inválido: ${buildingKey}`);
    return;
  }

  // Aplicar bono de Levitation: -5% por nivel
  let buildTime = def.buildTimeSec ?? 20;
  const levitationLevel = researchLevels["levitation"] || 0;
  const levitationBonus = 1 - (levitationLevel * 0.05);
  buildTime = Math.max(1, Math.floor(buildTime * levitationBonus));
  
  const endsAt = Date.now() + buildTime * 1000;
  const gifEl = placeGifOnSlot(slotId);

  builtSlots[slotId] = {
    state: "building",
    building: buildingKey,
    level: 0,
    fixed: false,
    endsAt,
    gifEl,
    sprite: null,
    levelBadge: null,
    hoverOutline: null,
    _timer: null
  };

  setSelection(`⏳ Construyendo ${def.name} en Slot ${slotId} (${formatTime(buildTime)})`);
  renderConstructionPanel();

  scheduleTimerForSlot(slotId);
  saveGame();
}

function recreateBuiltSprite(slotId){
  if(!window.cityScene) return;
  const scene = window.cityScene;
  const data = builtSlots[slotId];
  if(!data || data.state !== "built") return;

  const slot = scene.slots.find(s => s.def.id === slotId);
  if(!slot) return;

  const def = BUILDINGS[data.building];
  if(!def) return;

  let spriteKey = def.spriteKey;
  if(data.building === "eggdragon"){
    spriteKey = getEggdragonSpriteKeyForLevel(data.level ?? 1);
  }

  const x = scene.scale.width * slot.def.x - 5;
  const y = scene.scale.height * slot.def.y;

  if(data.sprite){
    if(data.sprite.texture?.key !== spriteKey){
      destroyBuiltVisuals(slotId);
    } else {
      data.sprite.setPosition(x, y);

      if(data.hoverOutline){
        data.hoverOutline.setPosition(x,y);
        data.hoverOutline.setScale(data.sprite.scaleX * 1.08, data.sprite.scaleY * 1.08);
      }

      createOrUpdateLevelBadge(slotId);
      return;
    }
  }

  const spr = scene.add.image(x, y, spriteKey);
  spr.setDepth(11);

  const scaleX = slot.def.w / spr.width;
  const scaleY = slot.def.h / spr.height;

  const mult = BUILDING_SCALE_MULT[data.building] ?? BUILDING_SCALE_MULT.default;
  spr.setScale(Math.min(scaleX, scaleY) * mult);

  data.sprite = spr;

  data.hoverOutline = null;
  ensureDoaHoverOutline(slotId);
  hideDoaHover(slotId);

  createOrUpdateLevelBadge(slotId);
}

function finishConstruction(slotId){
  const data = builtSlots[slotId];
  if(!data || data.state !== "building") return;

  clearSlotTimer(slotId);

  if(data.gifEl && data.gifEl.parentNode){
    data.gifEl.parentNode.removeChild(data.gifEl);
  }
  data.gifEl = null;

  const def = BUILDINGS[data.building];
  if(!def){
    setSelection(`✅ Construcción terminada en Slot ${slotId}`);
    data.state = "built";
    data.endsAt = null;
    data.level = 1;
    builtSlots[slotId] = data;
    saveGame();
    return;
  }

  data.state = "built";
  data.endsAt = null;
  data.level = 1;

  builtSlots[slotId] = data;

  recreateBuiltSprite(slotId);

  if(typeof def.onBuilt === "function"){
    def.onBuilt();
  }

  const pGain = getPowerForLevel(data.building, 1);
  addPower(pGain);

  setSelection(`✅ ${def.name} terminada en Slot ${slotId} (+${pGain} Power)`);
  renderConstructionPanel();
  saveGame();
}

/* ============================================================
   UPGRADE (GLOBAL para TODOS + bonus Home)
============================================================ */
function startUpgrade(slotId){
  const data = builtSlots[slotId];
  if(!data || data.state !== "built") return;

  const buildingKey = data.building;
  const def = BUILDINGS[buildingKey];
  const name = def ? def.name : buildingKey;

  const currentLevel = data.level ?? 1;

  if(currentLevel >= BUILDING_MAX_LEVEL){
    setSelection(`⛔ ${name} ya está en nivel máximo (${BUILDING_MAX_LEVEL})`);
    return;
  }

  const cost = getUpgradeCost(buildingKey, currentLevel);
  const timeSec = getUpgradeTimeSec(buildingKey, currentLevel);

  if(!canBuild(cost, playerResources)){
    setSelection(`❌ No tenés recursos para mejorar ${name} (Lv ${currentLevel} → ${currentLevel+1})`);
    return;
  }

  spendResources(cost, playerResources);
  updateResourcesUI();

  destroyBuiltVisuals(slotId);

  data.state = "upgrading";
  data.endsAt = Date.now() + timeSec * 1000;

  if(data.gifEl && data.gifEl.parentNode) data.gifEl.parentNode.removeChild(data.gifEl);
  data.gifEl = placeGifOnSlot(slotId);

  builtSlots[slotId] = data;

  setSelection(`⏫ Mejorando ${name} en Slot ${slotId} (Lv ${currentLevel} → ${currentLevel+1}) (${formatTime(timeSec)})`);
  renderConstructionPanel();

  scheduleTimerForSlot(slotId);
  saveGame();
}

function finishUpgrade(slotId){
  const data = builtSlots[slotId];
  if(!data || data.state !== "upgrading") return;

  clearSlotTimer(slotId);

  if(data.gifEl && data.gifEl.parentNode){
    data.gifEl.parentNode.removeChild(data.gifEl);
  }
  data.gifEl = null;

  data.state = "built";
  data.endsAt = null;
  data.level = (data.level ?? 1) + 1;

  builtSlots[slotId] = data;

  recreateBuiltSprite(slotId);

  const pGain = getPowerForLevel(data.building, data.level);
  addPower(pGain);

  if(data.building === "home"){
    const gain = getHomePopulationGainForNextLevel(data.level - 1);
    playerResources.poblacion += gain;
    updateResourcesUI();
    setSelection(`✅ HOME mejorada a Lv ${data.level} en Slot ${slotId} (+${gain} población, +${pGain} Power)`);
  } else {
    const def = BUILDINGS[data.building];
    const name = def ? def.name : data.building;
    setSelection(`✅ ${name} mejorada a Lv ${data.level} en Slot ${slotId} (+${pGain} Power)`);
  }

  renderConstructionPanel();
  saveGame();
}

/* ============================================================
   WINDOWS (BUILDING LIST / UPGRADE)
============================================================ */
// ✅ UPGRADE WINDOW (CITY - edificios normales)
function openUpgradeWindow(slotId){
  const frameImg = "assets/buldings.png";
  const closeBtnImg = "assets/salirbutton.png";

  const data = builtSlots[slotId];
  if(!data || data.state !== "built") return;

  const buildingKey = data.building;
  const def = BUILDINGS[buildingKey];
  const name = def ? def.name : buildingKey;

  const currentLevel = data.level ?? 1;
  const maxed = currentLevel >= BUILDING_MAX_LEVEL;

  const cost = getUpgradeCost(buildingKey, currentLevel);
  const timeSec = getUpgradeTimeSec(buildingKey, currentLevel);
  const can = canBuild(cost, playerResources);

  const html = `
    <div class="cb-frame" style="background-image:url('${frameImg}')">
      <button class="buildings-close" data-close="modal" aria-label="Cerrar">
        <img src="${closeBtnImg}" alt="X">
      </button>

      <div class="cb-titlebar">${name} • Upgrade</div>

      <div class="cb-card" style="margin: 24px auto; width: min(320px, 92%);">
        <img class="cb-icon-img" src="${def?.icon || ""}" alt="${name}">
        <div class="cb-title">${name}</div>
        <div class="cb-desc">Level: <b>${currentLevel}</b> ${maxed ? "(MAX)" : `→ <b>${currentLevel+1}</b>`}</div>

        <div class="cb-costs" style="margin-top:10px;">
          <div class="cb-cost"><span class="cb-cost-ico">🪵</span><span class="cb-cost-txt">${cost.wood}</span></div>
          <div class="cb-cost"><span class="cb-cost-ico">🍞</span><span class="cb-cost-txt">${cost.food}</span></div>
          <div class="cb-cost"><span class="cb-cost-ico">🪨</span><span class="cb-cost-txt">${cost.stone}</span></div>
          <div class="cb-cost"><span class="cb-cost-ico">🧱</span><span class="cb-cost-txt">${cost.iron}</span></div>
        </div>

        <div style="margin-top:10px; font-weight:900; color:rgba(0,0,0,.65);">
          ⏳ Time: ${formatTime(timeSec)}
        </div>

        <button class="cb-upgrade btn btn-primary"
                data-slot="${slotId}"
                ${(!can || maxed) ? "disabled" : ""}>
          ${maxed ? "MAX" : "Upgrade"}
        </button>

        ${(!can && !maxed) ? `<div style="margin-top:8px;color:#8b0000;font-weight:800;">No tenés recursos suficientes.</div>` : ""}
      </div>
    </div>
  `;

  openModal("", html, "big");
  updateResourcesUI();
}

// ✅ por si en algún lado te quedó escrito así:
function openUpgradedWindow(slotId){
  return openUpgradeWindow(slotId);
}


function openFieldBuildingsWindow(slotId){
  const frameImg = "assets/buldings.png";
  const closeBtnImg = "assets/salirbutton.png";

  const data = builtFieldSlots[slotId];
  const alreadyBuilt = data && data.state === "built";
  const isBusy = data && (data.state === "building" || data.state === "upgrading");

  const cards = Object.entries(FIELD_BUILDINGS).map(([key, def])=>{
    const can = canBuild(def.cost, playerResources);
    const disabled = (alreadyBuilt || isBusy || !can) ? "disabled" : "";
    const btnText = alreadyBuilt ? "Built" : (isBusy ? "Busy..." : "Build");

    return `
      <div class="cb-card">
        <img class="cb-icon-img" src="${def.icon}" alt="${def.name}">
        <div class="cb-title">${def.name}</div>
        <div class="cb-desc">${def.desc}</div>

        <div class="cb-costs">
          <div class="cb-cost"><span class="cb-cost-ico">🪵</span><span class="cb-cost-txt">${def.cost.wood ?? 0}</span></div>
          <div class="cb-cost"><span class="cb-cost-ico">🍞</span><span class="cb-cost-txt">${def.cost.food ?? 0}</span></div>
          <div class="cb-cost"><span class="cb-cost-ico">🪨</span><span class="cb-cost-txt">${def.cost.stone ?? 0}</span></div>
          <div class="cb-cost"><span class="cb-cost-ico">🧱</span><span class="cb-cost-txt">${def.cost.iron ?? 0}</span></div>
        </div>

        <div style="margin-top:10px; font-weight:800; color:rgba(0,0,0,.65);">
          ⏳ Time: ${formatTime(def.buildTimeSec ?? 10)}
        </div>

        <button class="cb-build btn btn-primary"
                data-context="field"
                data-slot="${slotId}"
                data-building="${key}"
                ${disabled}>
          ${btnText}
        </button>

        ${(!can && !alreadyBuilt && !isBusy) ? `<div style="margin-top:8px;color:#8b0000;font-weight:800;">No tenés recursos suficientes.</div>` : ""}
      </div>
    `;
  }).join("");

  const html = `
    <div class="cb-frame" style="background-image:url('${frameImg}')">
      <button class="buildings-close" data-close="modal" aria-label="Cerrar">
        <img src="${closeBtnImg}" alt="X">
      </button>

      <div class="cb-titlebar">Field • Build</div>

      <div class="cb-grid" style="
        max-height: 75vh;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 18px;
        padding: 8px 12px 16px 12px;
      ">
        ${cards}
      </div>
    </div>
  `;

  openModal("", html, "big");
  updateResourcesUI();
}

/* ============================================================
   CLICK BUILD / UPGRADE
============================================================ */
document.addEventListener("click", (e)=>{
  const btn = e.target.closest(".cb-build");
  if(!btn) return;

  e.preventDefault();
  e.stopPropagation();

  if(btn.disabled) return;

  const context = btn.dataset.context || "city";
  const slotId = Number(btn.dataset.slot);
  const buildingKey = btn.dataset.building;

  if(context === "field"){
    const data = builtFieldSlots[slotId];
    if(data && (data.state === "building" || data.state === "upgrading" || data.state === "built")) return;

    const def = FIELD_BUILDINGS[buildingKey];
    if(!def){
      setSelection(`❌ Edificio FIELD inválido: ${buildingKey}`);
      return;
    }
    if(!canBuild(def.cost, playerResources)){
      setSelection(`❌ No tenés recursos para construir ${def.name} en Field Slot ${slotId}`);
      btn.disabled = true;
      return;
    }
const popCost = getFieldPopCost(buildingKey, 1);
if((playerResources.poblacion ?? 0) < popCost){
  setSelection(`❌ No tenés población para construir ${def.name}. Requiere ${popCost} población.`);
  btn.disabled = true;
  return;
}

    spendResources(def.cost, playerResources);
    updateResourcesUI();
playerResources.poblacion -= popCost;
updateResourcesUI();

    closeModal();
    startFieldConstruction(slotId, buildingKey);
    return;
  }

  // CITY (tu lógica original)
  const data = builtSlots[slotId];
  if(data && (data.state === "building" || data.state === "upgrading" || data.state === "built")) return;

  const def = BUILDINGS[buildingKey];
  if(!def){
    setSelection(`❌ Edificio inválido: ${buildingKey}`);
    return;
  }

  if(!canBuild(def.cost, playerResources)){
    setSelection(`❌ No tenés recursos para construir ${def.name} en Slot ${slotId}`);
    btn.disabled = true;
    return;
  }

  spendResources(def.cost, playerResources);
  updateResourcesUI();

  closeModal();
  startConstruction(slotId, buildingKey);
});

document.addEventListener("click", (e)=>{
  const btn = e.target.closest(".cb-upgrade");
  if(!btn) return;

  e.preventDefault();
  e.stopPropagation();

  const slotId = Number(btn.dataset.slot);
  if(btn.disabled) return;

  closeModal();
  startUpgrade(slotId);
});

/* ✅ NUEVO: handler upgrade Field */
document.addEventListener("click", (e)=>{
  const btn = e.target.closest(".cb-field-upgrade");
  if(!btn) return;

  e.preventDefault();
  e.stopPropagation();

  if(btn.disabled) return;

  const slotId = Number(btn.dataset.slot);
  closeModal();
  startFieldUpgrade(slotId);
});

/* ============================================================
   CITY SCENE
============================================================ */
function openBuildingsWindow(slotId){
  const frameImg = "assets/buldings.png";
  const closeBtnImg = "assets/salirbutton.png";

  const data = builtSlots[slotId];
  const alreadyBuilt = data && data.state === "built";
  const isBusy = data && (data.state === "building" || data.state === "upgrading");

  const cards = Object.entries(BUILDINGS).map(([key, def])=>{
    // no mostrar prebuilt en lista
    if(key === "fortress" || key === "eggdragon") return "";

    const can = canBuild(def.cost, playerResources);
    const disabled = (alreadyBuilt || isBusy || !can) ? "disabled" : "";
    const btnText = alreadyBuilt ? "Built" : (isBusy ? "Busy..." : "Build");

    return `
      <div class="cb-card">
        <img class="cb-icon-img" src="${def.icon}" alt="${def.name}">
        <div class="cb-title">${def.name}</div>
        <div class="cb-desc">${def.desc}</div>

        <div class="cb-costs">
          <div class="cb-cost"><span class="cb-cost-ico">🪵</span><span class="cb-cost-txt">${def.cost.wood ?? 0}</span></div>
          <div class="cb-cost"><span class="cb-cost-ico">🍞</span><span class="cb-cost-txt">${def.cost.food ?? 0}</span></div>
          <div class="cb-cost"><span class="cb-cost-ico">🪨</span><span class="cb-cost-txt">${def.cost.stone ?? 0}</span></div>
          <div class="cb-cost"><span class="cb-cost-ico">🧱</span><span class="cb-cost-txt">${def.cost.iron ?? 0}</span></div>
        </div>

        <div style="margin-top:10px; font-weight:800; color:rgba(0,0,0,.65);">
          ⏳ Time: ${formatTime(def.buildTimeSec ?? 20)}
        </div>

        <button class="cb-build btn btn-primary"
                data-context="city"
                data-slot="${slotId}"
                data-building="${key}"
                ${disabled}>
          ${btnText}
        </button>

        ${(!can && !alreadyBuilt && !isBusy) ? `<div style="margin-top:8px;color:#8b0000;font-weight:800;">No tenés recursos suficientes.</div>` : ""}
      </div>
    `;
  }).join("");

  const html = `
    <div class="cb-frame" style="background-image:url('${frameImg}')">
      <button class="buildings-close" data-close="modal" aria-label="Cerrar">
        <img src="${closeBtnImg}" alt="X">
      </button>

      <div class="cb-titlebar">City • Build</div>

      <div class="cb-grid" style="
        max-height: 75vh;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 18px;
        padding: 8px 12px 16px 12px;
      ">
        ${cards}
      </div>
    </div>
  `;

  openModal("", html, "big");
  updateResourcesUI();
}
function openFortressUpgradeWindow(slotId){
  const frameImg = "assets/buldings.png";
  const closeBtnImg = "assets/salirbutton.png";

  const data = builtSlots[slotId];
  if(!data || data.state !== "built") return;

  const def = BUILDINGS.fortress;
  const name = def?.name || "Fortress";

  const currentLevel = data.level ?? 1;
  const maxed = currentLevel >= BUILDING_MAX_LEVEL;

  const cost = getUpgradeCost("fortress", currentLevel);
  const timeSec = getUpgradeTimeSec("fortress", currentLevel);
  const can = canBuild(cost, playerResources);

  const html = `
    <div class="cb-frame" style="background-image:url('${frameImg}')">
      <button class="buildings-close" data-close="modal" aria-label="Cerrar">
        <img src="${closeBtnImg}" alt="X">
      </button>

      <div class="cb-titlebar">Fortress</div>

      <div class="cb-card" style="margin: 24px auto; width: min(320px, 92%);">
        <img class="cb-icon-img" src="${def?.icon || ""}" alt="${name}">
        <div class="cb-title">${name}</div>
        <div class="cb-desc">Level: <b>${currentLevel}</b> ${maxed ? "(MAX)" : `→ <b>${currentLevel+1}</b>`}</div>

        <div class="cb-costs" style="margin-top:10px;">
          <div class="cb-cost"><span class="cb-cost-ico">🪵</span><span class="cb-cost-txt">${cost.wood}</span></div>
          <div class="cb-cost"><span class="cb-cost-ico">🍞</span><span class="cb-cost-txt">${cost.food}</span></div>
          <div class="cb-cost"><span class="cb-cost-ico">🪨</span><span class="cb-cost-txt">${cost.stone}</span></div>
          <div class="cb-cost"><span class="cb-cost-ico">🧱</span><span class="cb-cost-txt">${cost.iron}</span></div>
        </div>

        <div style="margin-top:10px; font-weight:900; color:rgba(0,0,0,.65);">
          ⏳ Time: ${formatTime(timeSec)}
        </div>

        <button class="cb-upgrade btn btn-primary"
                data-slot="${slotId}"
                ${(!can || maxed) ? "disabled" : ""}>
          ${maxed ? "MAX" : "Upgrade"}
        </button>

        ${(!can && !maxed) ? `<div style="margin-top:8px;color:#8b0000;font-weight:800;">No tenés recursos suficientes.</div>` : ""}
      </div>
    </div>
  `;

  openModal("", html, "big");
  updateResourcesUI();
}


function openDragonKeepWindow(slotId){
  const frameImg = "assets/buldings.png";
  const closeBtnImg = "assets/salirbutton.png";

  const data = builtSlots[slotId];
  if(!data || data.state !== "built") return;

  const currentLevel = data.level ?? 1;
  const maxed = currentLevel >= BUILDING_MAX_LEVEL;

  const name = "Gran Dragón";
  const stageImg = getEggdragonModalImageForLevel(currentLevel);

  const cost = getUpgradeCost("eggdragon", currentLevel);
  const timeSec = getUpgradeTimeSec("eggdragon", currentLevel);
  const can = canBuild(cost, playerResources);

  const html = `
    <div class="cb-frame" style="background-image:url('${frameImg}')">
      <button class="buildings-close" data-close="modal" aria-label="Cerrar">
        <img src="${closeBtnImg}" alt="X">
      </button>

      <div class="cb-titlebar">Great dragon</div>

      <div class="cb-card" style="margin: 24px auto; width: min(320px, 92%);">
        <img class="cb-icon-img" src="${stageImg}" alt="${name}">
        <div class="cb-title">${name}</div>
        <div class="cb-desc">Level: <b>${currentLevel}</b> ${maxed ? "(MAX)" : `→ <b>${currentLevel+1}</b>`}</div>

        <div class="cb-costs" style="margin-top:10px;">
          <div class="cb-cost"><span class="cb-cost-ico">🪵</span><span class="cb-cost-txt">${cost.wood}</span></div>
          <div class="cb-cost"><span class="cb-cost-ico">🍞</span><span class="cb-cost-txt">${cost.food}</span></div>
          <div class="cb-cost"><span class="cb-cost-ico">🪨</span><span class="cb-cost-txt">${cost.stone}</span></div>
          <div class="cb-cost"><span class="cb-cost-ico">🧱</span><span class="cb-cost-txt">${cost.iron}</span></div>
        </div>

        <div style="margin-top:10px; font-weight:900; color:rgba(0,0,0,.65);">
          ⏳ Time: ${formatTime(timeSec)}
        </div>

        <button class="cb-upgrade btn btn-primary"
                data-slot="${slotId}"
                ${(!can || maxed) ? "disabled" : ""}>
          ${maxed ? "MAX" : "Upgrade"}
        </button>

        ${(!can && !maxed) ? `<div style="margin-top:8px;color:#8b0000;font-weight:800;">No tenés recursos suficientes.</div>` : ""}
      </div>

      <div style="margin: 10px auto 0; display:flex; justify-content:center;">
        <img src="assets/great dragon armor.png"
             alt="Dragon Armor"
             style="max-width:520px; width:920%; height:auto; opacity:.95;">
      </div>
    </div>
  `;

  openModal("", html, "big");
  updateResourcesUI();
}



class CityScene extends Phaser.Scene {
  constructor(){
    super("CityScene");

    this.SLOT_W = 80;
    this.SLOT_H = 43;

    this.slotDefs = [
      { id: 1, x: 0.43, y: 0.205, w: 65, h: 150 },
      { id: 2, x: 0.54, y: 0.358 },
      { id: 3, x: 0.627, y: 0.270 },
      { id: 4, x: 0.670, y: 0.315 },

      { id: 5, x: 0.250, y: 0.395 },
      { id: 6, x: 0.300, y: 0.420 },
      { id: 7, x: 0.240, y: 0.470 },

      { id: 8,  x: 0.370, y: 0.485 },
      { id: 9,  x: 0.330, y: 0.530 },
      { id: 10, x: 0.270, y: 0.580 },

      { id: 11, x: 0.415, y: 0.510 },
      { id: 12, x: 0.360, y: 0.570 },
      { id: 13, x: 0.470, y: 0.570 },
      { id: 14, x: 0.510, y: 0.515 },
      { id: 15, x: 0.577, y: 0.535 },
      { id: 16, x: 0.620, y: 0.430 },

      { id: 17, x: 0.310, y: 0.615 },
      { id: 18, x: 0.420, y: 0.610 },
      { id: 19, x: 0.470, y: 0.640 },
      { id: 20, x: 0.580, y: 0.630 },
      { id: 21, x: 0.680, y: 0.470 },
      { id: 22, x: 0.590, y: 0.475 },

      { id: 23, x: 0.375, y: 0.675 },
      { id: 24, x: 0.540, y: 0.675 },
      { id: 25, x: 0.485, y: 0.700 },
      { id: 26, x: 0.530, y: 0.600 },
      { id: 27, x: 0.645, y: 0.510 },

      { id: 28, x: 0.540, y: 0.740 },
      { id: 29, x: 0.635, y: 0.570 },

      { id: 30, x: 0.580, y: 0.237 },
      { id: 31, x: 0.531, y: 0.200 }
    ].map(s => ({
      ...s,
      w: (typeof s.w === "number") ? s.w : this.SLOT_W,
      h: (typeof s.h === "number") ? s.h : this.SLOT_H
    }));
  }

  preload(){
    this.load.image("cityBg", "assets/city_bg.png");
    this.load.image("hoverBuild", "assets/hover_building.png");
    this.load.image("lvlBadge", "assets/ui_niveles.png");

    this.load.image("homeSprite", "assets/houseC.png");
    this.load.image("barrackSprite", "assets/barrack.png");
    this.load.image("factorySprite", "assets/Factory.png");
    this.load.image("musterSprite", "assets/muster point.png");
    this.load.image("metalSprite", "assets/metalC.png");
    this.load.image("rookerySprite", "assets/Rookery.png");
    this.load.image("scienceSprite", "assets/science center.png");
    this.load.image("sentinelSprite", "assets/Sentinel.png");
    this.load.image("storageSprite", "assets/storage vault.png");
    this.load.image("theaterSprite", "assets/theater.png");

    this.load.image("fortressSprite", "assets/Fortress.png");
    this.load.image("eggdragonSprite", "assets/eggdragon.png");

    this.load.image("eggBabySprite", "assets/babyDragon.png");
    this.load.image("eggTeenSprite", "assets/Adolecentedragon.png");
    this.load.image("eggAdultSprite", "assets/adultdragon.png");
  }

  create(){
    window.cityScene = this;

    this.cameras.main.setBackgroundColor("#0b1020");
    this.bg = this.add.image(0, 0, "cityBg").setOrigin(0.5);
    this.bg.setDepth(0);

    this.slots = [];
    this.createSlots();
    this.layout();

    restoreVisualStateAfterLoad();

    setSelection("Ciudad lista ✅ (slots listos).");
    updateResourcesUI();
  }

  createSlots(){
    this.slotDefs.forEach(def => {
      const rect = this.add.rectangle(0, 0, def.w, def.h, 0x000000, 0.001);
      rect.setStrokeStyle(2, 0x4aa3ff, 0.0);
      rect.setInteractive({ useHandCursor:true });
      rect.setDepth(10);

      const hoverImg = this.add.image(0, 0, "hoverBuild");
      hoverImg.setVisible(false);
      hoverImg.setDepth(9);

      const scaleX = def.w / hoverImg.width;
      const scaleY = def.h / hoverImg.height;
      hoverImg.setScale(Math.min(scaleX, scaleY) * 1.60);

      rect.on("pointerover", () => {
        const data = builtSlots[def.id];
        const noBlueBorder = (def.id === 1 || def.id === 2);

        if(data && data.state === "built" && data.sprite){
          rect.setStrokeStyle(2, 0x4aa3ff, noBlueBorder ? 0.0 : 0.0);
          hoverImg.setVisible(false);
          showDoaHover(def.id);
          return;
        }

        if(data && (data.state === "building" || data.state === "upgrading")){
          rect.setStrokeStyle(2, 0x4aa3ff, 0.0);
          hoverImg.setVisible(false);
          return;
        }

        rect.setStrokeStyle(2, 0x4aa3ff, noBlueBorder ? 0.0 : 0.0);
        hoverImg.setVisible(true);
      });

      rect.on("pointerout", () => {
        const data = builtSlots[def.id];
        if(data && data.state === "built"){
          hideDoaHover(def.id);
        }
        rect.setStrokeStyle(2, 0x4aa3ff, 0.0);
        hoverImg.setVisible(false);
      });
rect.on("pointerdown", () => {
  console.log("CLICK", def.id, builtSlots[def.id]);

  if(isModalOpen) return;

  // Tomamos data
  let data = builtSlots[def.id];

  // ✅ FIX: si existe pero está corrupto (sin state), lo tratamos como vacío
  if(data && !data.state){
    delete builtSlots[def.id];
    data = null;
  }

if(data && data.state === "built"){
  const bdef = BUILDINGS[data.building];
  setSelection(`Slot ${def.id} seleccionado ✅ (${bdef ? bdef.name : data.building})`);

  // ✅ abrir ventana distinta según el edificio
  if(data.building === "eggdragon"){
    openDragonKeepWindow(def.id);      // <-- NUEVA
  }else if(data.building === "fortress"){
    openFortressUpgradeWindow(def.id); // <-- NUEVA
  }else{
    openUpgradeWindow(def.id);         // la normal
  }
  return;
}

  if(data && (data.state === "building" || data.state === "upgrading")){
    setSelection(`⏳ Slot ${def.id} está ocupado (${data.state})`);
    return;
  }

  // ✅ SLOT VACÍO
  setSelection(`Slot ${def.id} seleccionado ✅`);
  openBuildingsWindow(def.id);
});


      this.slots.push({ def, rect, hoverImg });
    });
  }

  layout(){
    const w = this.scale.width;
    const h = this.scale.height;

    this.bg.setPosition(w/2, h/2);
    const scale = Math.max(w / this.bg.width, h / this.bg.height);
    this.bg.setScale(scale);

    this.slots.forEach(s => {
      const x = w * s.def.x;
      const y = h * s.def.y;
      s.rect.setPosition(x, y);
      s.hoverImg.setPosition(x, y);

      const d = builtSlots[s.def.id];

      if(d && d.state === "built"){
        if(d.sprite) d.sprite.setPosition(x - 5, y);
        createOrUpdateLevelBadge(s.def.id);

        if(d.hoverOutline && d.sprite){
          d.hoverOutline.setPosition(x - 5, y);
          d.hoverOutline.setScale(d.sprite.scaleX * 1.08, d.sprite.scaleY * 1.08);
        }
      }

      if(d && (d.state === "building" || d.state === "upgrading") && d.gifEl){
        updateGifPosition(s.def.id);
      }
    });
  }
}
/* ============================================================
   ✅ FIELD SCENE (24 slots) ✅ MODIFICADO
============================================================ */
class FieldScene extends Phaser.Scene {
  constructor(){
    super("FieldScene");

    this.SLOT_W = 55;
    this.SLOT_H = 55;

    // ✅ SLOTS MANUALES (como City)
    this.slotDefs = [
      { id: 1,  x: 0.40, y: 0.27, w: this.SLOT_W, h: this.SLOT_H },
      { id: 2,  x: 0.40, y: 0.33, w: this.SLOT_W, h: this.SLOT_H },
      { id: 3,  x: 0.45, y: 0.27, w: this.SLOT_W, h: this.SLOT_H },
      { id: 4,  x: 0.45, y: 0.32, w: this.SLOT_W, h: this.SLOT_H },
      { id: 5,  x: 0.51, y: 0.32, w: this.SLOT_W, h: this.SLOT_H },
      { id: 6,  x: 0.57, y: 0.32, w: this.SLOT_W, h: this.SLOT_H },

      { id: 7,  x: 0.08, y: 0.57, w: this.SLOT_W, h: this.SLOT_H },
      { id: 8,  x: 0.13, y: 0.57, w: this.SLOT_W, h: this.SLOT_H },
      { id: 9,  x: 0.40, y: 0.38, w: this.SLOT_W, h: this.SLOT_H },
      { id: 10, x: 0.45, y: 0.37, w: this.SLOT_W, h: this.SLOT_H },
      { id: 11, x: 0.51, y: 0.37, w: this.SLOT_W, h: this.SLOT_H },
      { id: 12, x: 0.57, y: 0.37, w: this.SLOT_W, h: this.SLOT_H },

      { id: 13, x: 0.08, y: 0.64, w: this.SLOT_W, h: this.SLOT_H },
      { id: 14, x: 0.18, y: 0.57, w: this.SLOT_W, h: this.SLOT_H },
      { id: 15, x: 0.40, y: 0.43, w: this.SLOT_W, h: this.SLOT_H },
      { id: 16, x: 0.46, y: 0.43, w: this.SLOT_W, h: this.SLOT_H },
      { id: 17, x: 0.51, y: 0.43, w: this.SLOT_W, h: this.SLOT_H },
      { id: 18, x: 0.57, y: 0.42, w: this.SLOT_W, h: this.SLOT_H },

      { id: 19, x: 0.18, y: 0.64, w: this.SLOT_W, h: this.SLOT_H },
      { id: 20, x: 0.13, y: 0.64, w: this.SLOT_W, h: this.SLOT_H },
      { id: 21, x: 0.43, y: 0.47, w: this.SLOT_W, h: this.SLOT_H },
      { id: 22, x: 0.49, y: 0.47, w: this.SLOT_W, h: this.SLOT_H },
      { id: 23, x: 0.62, y: 0.42, w: this.SLOT_W, h: this.SLOT_H },
      { id: 24, x: 0.45, y: 0.53, w: this.SLOT_W, h: this.SLOT_H },
    ];
  }

  preload(){
    this.load.image("fieldBg", "assets/field_bg.png");
    this.load.image("hoverBuild", "assets/hover_building.png");
    this.load.image("lvlBadge", "assets/ui_niveles.png");

    this.load.image("fieldFarm", "assets/farm.png");
    this.load.image("fieldMine", "assets/mine.png");
    this.load.image("fieldQuarry", "assets/quarry.png");
    this.load.image("fieldLumbermill", "assets/lumbermill.png");
  }

  create(){
    window.fieldScene = this;

    this.cameras.main.setBackgroundColor("#0b1020");
    this.bg = this.add.image(0, 0, "fieldBg").setOrigin(0.5);
    this.bg.setDepth(0);

    this.slots = [];
    this.createSlots();
    this.layout();

    this.restoreFieldVisualsAfterLoad();

    setSelection("Field listo ✅ (24 slots).");
    updateResourcesUI();
  }

  createSlots(){
    this.slotDefs.forEach(def=>{
      const rect = this.add.rectangle(0, 0, def.w, def.h, 0x000000, 0.001);
      rect.setStrokeStyle(2, 0x4aa3ff, 0.0);
      rect.setInteractive({ useHandCursor:true });
      rect.setDepth(10);

      const hoverImg = this.add.image(0, 0, "hoverBuild");
      hoverImg.setVisible(false);
      hoverImg.setDepth(9);

      const scaleX = def.w / hoverImg.width;
      const scaleY = def.h / hoverImg.height;
      hoverImg.setScale(Math.min(scaleX, scaleY) * 1.40);

      rect.on("pointerover", ()=>{
        const data = builtFieldSlots[def.id];
        if(data && (data.state === "built" || data.state === "building" || data.state === "upgrading")){
          rect.setStrokeStyle(2, 0x4aa3ff, 0.0);
          hoverImg.setVisible(false);
          return;
        }
        rect.setStrokeStyle(2, 0x4aa3ff, 0.0);
        hoverImg.setVisible(true);
      });

      rect.on("pointerout", ()=>{
        rect.setStrokeStyle(2, 0x4aa3ff, 0.0);
        hoverImg.setVisible(false);
      });

      rect.on("pointerdown", ()=>{
        if(isModalOpen) return;

        const data = builtFieldSlots[def.id];

        if(data && data.state === "built"){
          const bdef = FIELD_BUILDINGS[data.building];
          setSelection(`Field Slot ${def.id} ✅ (${bdef ? bdef.name : data.building})`);
          openFieldUpgradeWindow(def.id);
          return;
        }

        if(data && (data.state === "building" || data.state === "upgrading")){
          setSelection(`⏳ Field Slot ${def.id} está ocupado (${data.state})`);
          return;
        }

        setSelection(`Field Slot ${def.id} seleccionado ✅`);
        openFieldBuildingsWindow(def.id);
      });

      this.slots.push({ def, rect, hoverImg });
    });
  }

 layout(){
  const w = this.scale.width;
  const h = this.scale.height;

  this.bg.setPosition(w/2, h/2);

  // ✅ COVER (llena todo, puede recortar)
  const scale = Math.max(w / this.bg.width, h / this.bg.height);
  this.bg.setScale(scale);

  // ✅ tamaño real del fondo escalado
  const bgW = this.bg.width * scale;
  const bgH = this.bg.height * scale;

  // ✅ offset por el recorte (va a ser negativo o positivo)
  const left = (w - bgW) / 2;
  const top  = (h - bgH) / 2;

  // ✅ helper: convierte coords normalizadas al mundo
  const mapX = (nx) => left + bgW * nx;
  const mapY = (ny) => top  + bgH * ny;

  this.slots.forEach(s=>{
    const x = mapX(s.def.x);
    const y = mapY(s.def.y);

    s.rect.setPosition(x, y);
    s.hoverImg.setPosition(x, y);

    const d = builtFieldSlots[s.def.id];

    if(d && d.state === "built"){
      if(d.sprite) d.sprite.setPosition(x, y);
      this.createOrUpdateFieldLevelBadge(s.def.id); // se reubica abajo
    }

    if(d && (d.state === "building" || d.state === "upgrading")){
      updateFieldGifPosition(s.def.id); // esto usa getFieldSlotRect, lo ajustamos abajo
    }
  });
}


  createFieldSprite(slotId){
    const data = builtFieldSlots[slotId];
    if(!data || data.state !== "built") return;

    const slot = this.slots.find(s=>s.def.id === slotId);
    if(!slot) return;

    const def = FIELD_BUILDINGS[data.building];
    if(!def) return;

    const x = this.scale.width * slot.def.x;
    const y = this.scale.height * slot.def.y;

    if(data.sprite){
      data.sprite.destroy();
      data.sprite = null;
    }

    const spr = this.add.image(x, y, def.spriteKey);
    spr.setDepth(11);

    const scaleX = slot.def.w / spr.width;
    const scaleY = slot.def.h / spr.height;
    spr.setScale(Math.min(scaleX, scaleY) * 1.2);

    data.sprite = spr;
  }

  createOrUpdateFieldLevelBadge(slotId){
    const d = builtFieldSlots[slotId];
    if(!d || d.state !== "built") return;

    const slot = this.slots.find(s=>s.def.id === slotId);
    if(!slot) return;

    const x = this.scale.width * slot.def.x;
    const y = this.scale.height * slot.def.y;

    const lvl = d.level ?? 1;

    if(!d.levelBadge){
      const bg = this.add.image(0, 0, "lvlBadge");
      bg.setDepth(999);

      const badgeTarget = Math.max(18, Math.min(slot.def.w, slot.def.h) * 0.35);
      bg.setDisplaySize(badgeTarget, badgeTarget);

      const txt = this.add.text(0, 0, String(lvl), {
        fontFamily: "Arial",
        fontSize: `${Math.round(badgeTarget * 0.7)}px`,
        fontStyle: "bold",
        color: "#2b1b00"
      });
      txt.setOrigin(0.5);
      txt.setDepth(1000);

      const container = this.add.container(x, y - (slot.def.h * 0.10), [bg, txt]);
      container.setDepth(1000);

      d.levelBadge = { container, bg, text: txt };
    } else {
      d.levelBadge.text.setText(String(lvl));
      d.levelBadge.container.setPosition(x, y - (slot.def.h * 0.40));
    }
  }

  restoreFieldVisualsAfterLoad(){
    Object.entries(builtFieldSlots).forEach(([id, d])=>{
      const slotId = Number(id);
      if(!d) return;

      d.sprite = null;
      d.gifEl = null;
      d._timer = null;
      d.badgeEl = null;
      d.levelBadge = null;

      if(d.state === "built"){
        this.createFieldSprite(slotId);
        this.createOrUpdateFieldLevelBadge(slotId);
      }

      if(d.state === "building" || d.state === "upgrading"){
        d.gifEl = placeGifOnFieldSlot(slotId);
        scheduleFieldTimer(slotId);
      }

      builtFieldSlots[slotId] = d;
    });
  }
}



 
/* ============================================================
   ✅ RESTORE VISUALS + TIMERS AFTER LOAD (CITY)
============================================================ */
function restoreVisualStateAfterLoad(){
  Object.entries(builtSlots).forEach(([id, data])=>{
    const slotId = Number(id);
    if(!data) return;

    data.sprite = null;
    data.levelBadge = null;
    data.hoverOutline = null;
    data._timer = null;

    if(data.state === "building" || data.state === "upgrading"){
      data.gifEl = placeGifOnSlot(slotId);
      scheduleTimerForSlot(slotId);
    }

    if(data.state === "built"){
      data.gifEl = null;
      recreateBuiltSprite(slotId);
    }

    builtSlots[slotId] = data;
  });

  renderConstructionPanel();
}

/* ============================================================
   PHASER INIT + RESIZE
============================================================ */
let game = null;
let _booted = false;

function bootGameOnce(){
  if(_booted) return;
  _booted = true;

  loadGame();
  applyPrebuiltDefaults();

  const config = {
    type: Phaser.AUTO,
    parent: "game",
    backgroundColor: "#0b1020",
    scale: {
      mode: Phaser.Scale.NONE,
      width: gameEl.clientWidth,
      height: gameEl.clientHeight
    },
    scene: [CityScene, FieldScene]
  };

  game = new Phaser.Game(config);

  // resize hook
  window.addEventListener("resize", resizeGame);
  setTimeout(resizeGame, 50);
}


function resizeGame(){
  const w = gameEl.clientWidth;
  const h = gameEl.clientHeight;
  game.scale.resize(w, h);

  const city = game.scene.getScene("CityScene");
  if(city && city.scene.isActive() && city.layout) city.layout();

  const field = game.scene.getScene("FieldScene");
  if(field && field.scene.isActive() && field.layout) field.layout();
}
window.addEventListener("resize", resizeGame);
setTimeout(resizeGame, 50);
function cleanupGifsForZone(activeZone){
  // Borra cualquier gif que NO sea de la zona activa
  const gifs = gameEl.querySelectorAll('img[src*="Building.gif"]');
  gifs.forEach(img => {
    const z = img.dataset.zone || "unknown";
    if(z !== activeZone){
      img.remove();
    }
  });

  // Además, por seguridad, si por algún bug quedó el puntero en builtSlots/builtFieldSlots,
  // le sacamos la referencia para que no intente moverlo luego.
  if(activeZone === "city"){
    Object.values(builtFieldSlots).forEach(d => { if(d) d.gifEl = null; });
  }else{
    Object.values(builtSlots).forEach(d => { if(d) d.gifEl = null; });
  }
}

/* ============================================================
   VIEW SWITCH: CITY / FIELD ✅ FIX BOTONES
============================================================ */
function showCity(){
  document.getElementById("fieldView")?.classList.add("hidden");
  document.getElementById("mapView")?.classList.add("hidden");

  if(game.scene.isActive("FieldScene")) game.scene.stop("FieldScene");

  cleanupGifsForZone("city");   // ✅ NUEVO: borra gifs del Field

  game.scene.start("CityScene");
}

function showField(){
  document.getElementById("fieldView")?.classList.add("hidden");
  document.getElementById("mapView")?.classList.add("hidden");

  if(game.scene.isActive("CityScene")) game.scene.stop("CityScene");

  cleanupGifsForZone("field");  // ✅ NUEVO: borra gifs del City

  game.scene.start("FieldScene");
}

/* ============================================================
   LEFT BUTTONS
============================================================ */
document.getElementById("btnField")?.addEventListener("click", ()=>{
  showField();
});

document.getElementById("btnCity")?.addEventListener("click", ()=>{
  showCity();
});

document.getElementById("btnPve")?.addEventListener("click", ()=>{
  openModal("Atacar PvE", "<p>Después conectamos esto con combate y reportes.</p>");
});




/* ============================================================
   INIT UI
============================================================ */
window.addEventListener("load", ()=>{
  // UI base
  closeModal();
  updateResourcesUI();

  // ✅ Auth
  initAuthUI();

  const ses = getSession();
  if(ses?.user){
    // ya estaba logueado
    hideAuth();
    bootGameOnce();
  }else{
    showAuth();
  }

  // (esto se ejecuta igual, está ok)
  initConstructionHUD();
  initResearchHUD();
  initTroopTrainingHUD();
  initDismissModal();
  bindResourceHovers();

  setInterval(resourceTick, RESOURCE_TICK_MS);
  setInterval(saveGame, 10000);
  window.addEventListener("beforeunload", saveGame);
document.getElementById("btnTroops")?.addEventListener("click", ()=>{
  openTroops();
});
document.getElementById("btnResearch")?.addEventListener("click", ()=>{
  openResearch();
});
// ✅ Research: cerrar SOLO con la X
document.getElementById("researchClose")?.addEventListener("click", (e) => {
  e.preventDefault();
  closeResearch();
});

// ✅ IMPORTANTE: que no pase nada por detrás al hacer click en la ventana
// (No cierra al clickear afuera; solo absorbe el click)
document.getElementById("researchOverlay")?.addEventListener("pointerdown", (e) => {
  e.stopPropagation();
});
document.getElementById("researchOverlay")?.addEventListener("click", (e) => {
  e.stopPropagation();
});
/* =========================
   RESEARCH SYSTEM
========================= */

// 🔧 Editá acá niveles, beneficios, costos, etc.
const RESEARCH = [
  { id:"agriculture", name:"Agriculture", icon:"assets/agriculture.png", level:0, desc:"Boosts food production and farming efficiency.",
    time:"7m 13s",
    current:{ label:"Resource Generation Increase", value:"0%" },
    next:{ label:"Resource Generation Increase", value:"5%" },
    buildings:[{name:"Farm", lvl:1},{name:"science center",lvl:1}],
    costs:{ gold:"1000", food:"500", iron:"100" },
    action:"Research"
  },
  { id:"woodcraft", name:"Woodcraft", icon:"assets/Woodcraft.png", level:0, desc:"Improves wood gathering and crafting skills.",
    time:"8m 11s",
    current:{ label:"Resource Generation Increase", value:"0%" },
    next:{ label:"Resource Generation Increase", value:"5%" },
    buildings:[{name:"LumberMill", lvl:1},{name:"science center",lvl:1}],
    costs:{ gold:"1200", wood:"500", iron:"100" },
    action:"Research"
  },
  { id:"masonry", name:"Masonry", icon:"assets/Masonry.png", level:0, desc:"Enhances stone construction and durability.",
    time:"8m 49s",
    current:{ label:"Resource Generation Increase", value:"0%" },
    next:{ label:"Resource Generation Increase", value:"5%" },
    buildings:[{name:"Quarry", lvl:1},{name:"science center",lvl:1}],
    costs:{ gold:"1500", stone:"500", iron:"200" },
    action:"Research"
  },

  { id:"alloys", name:"Alloys", icon:"assets/Alloys.png", level:0, desc:"Unlocks stronger metal combinations for crafting.",
    time:"9m 58s",
    current:{ label:"Resource Generation Increase", value:"0%" },
    next:{ label:"Resource Generation Increase", value:"5%" },
    buildings:[{name:"mine", lvl:1},{name:"science center",lvl:1}],
    costs:{ gold:"2000", iron:"800" },
    action:"Research"
  },
  { id:"clairvoyance", name:"Clairvoyance", icon:"assets/Clairvoyance.png", level:0, desc:"Reveals hidden areas and enemy movements.",
    time:"7m 0s",
    buildings:[{name:"Sentinel", lvl:1},{name:"science center",lvl:1}],
    costs:{ food:"300", gold:"2000"},
    action:"Research"
  },
  { id:"metallurgy", name:"Metallurgy", icon:"assets/Metallurgy.png", level:0, desc:"Refines metalworking for better gear.",
    time:"22m17s",
    current:{ label:"Resource Generation Increase", value:"0%" },
    next:{ label:"Resource Generation Increase", value:"5%" },
    buildings:[{name:"barrack", lvl:1},{name:"metal smith",lvl:1}],
    requiredResearch:[{name:"Alloys", lvl:1}],
    costs:{ gold:"3500", iron:"3000", stone:"200", wood:"150", food:"800" },
    action:"Research"
  },

  { id:"rapid", name:"Rapid Deployment", icon:"assets/Rapid Deployment.png", level:0, desc:"Speeds up troop movement and setup.",
    time:"29m 36s",
    current:{ label:"March Time Reduction", value:"0%" },
    next:{ label:"March Time Reduction", value:"5%" },
    buildings:[{name:"science center", lvl:1}],
    costs:{ food:"600", gold:"3000" },
    action:"Research"
  },
  { id:"medicine", name:"Medicine", icon:"assets/Medicine.png", level:0, desc:"Heals units faster and boosts recovery.",
    time:"29m 36s",
    current:{ label:"Healing Speed Increase", value:"0%" },
    next:{ label:"Healing Speed Increase", value:"5%" },
    buildings:[{name:"science center", lvl:1}],
    costs:{ food:"1500", gold:"3600" },
    action:"Research"
  },
  { id:"levitation", name:"Levitation", icon:"assets/Levitation.png", level:0, desc:"Reduce the building upgrade time duration.",
    time:"29m 36s",
    current:{ label:"Building Time Reduction", value:"0%" },
    next:{ label:"Building Time Reduction", value:"5%" },
    buildings:[{name:"science center", lvl:1}],
    requiredResearch:[{name:"Masonry", lvl:1}],
    costs:{ gold:"5000", wood:"2000", iron:"2000" },
    action:"Research"
  },

  { id:"dragonry", name:"Dragonry", icon:"assets/Dragonry.png", level:0, desc:"Unlocks dragon training and support.",
    time:"37m 2s",
    buildings:[{name:"science center", lvl:1},{name:"Rookery",lvl:1}],
    costs:{ food:"2500", iron:"1000", gold:"5000" },
    action:"Research"
  },
  { id:"weapons", name:"Weapons Calibration", icon:"assets/Weapons Calibrations.png", level:0, desc:"Increases weapon precision and range.",
    time:"39m 44s",
    current:{ label:"Weapon Damage Increase", value:"0%" },
    next:{ label:"Weapon Damage Increase", value:"5%" },
    buildings:[{name:"science center", lvl:1}],
    requiredResearch:[{name:"Woodcraft", lvl:1}],
    costs:{ wood:"800", stone:"500", iron:"600", gold:"5000" },
    action:"Research"
  },
  { id:"rationing", name:"Rationing", icon:"assets/Rationing.png", level:0, desc:"Reduces resource usage and boosts efficiency.",
    time:"16m 20s",
    current:{ label:"Troop Upkeep Reduction", value:"0%" },
    next:{ label:"Troop Upkeep Reduction", value:"5%" },
    buildings:[{name:"science center", lvl:1}],
    costs:{ food:"500", wood:"800", stone:"400", gold:"10000", iron:"800" },
    action:"Research"
  },

  { id:"aerial", name:"Aerial Combat", icon:"assets/Aerial Combat.png", level:0, desc:"Improves dragon combat capabilities.",
    time:"—",
    buildings:[],
    costs:{},
    action:"View"
  }
];

let researchOverlayEl = null;
let researchGridEl = null;

let researchDetailOverlayEl = null;
let researchDetailTitleEl = null;
let researchDetailBodyEl = null;
let researchDetailActionEl = null;

function ensureResearchOverlay(){
  if (researchOverlayEl) return;

  researchOverlayEl = document.getElementById("researchOverlay");
  researchGridEl = document.getElementById("researchGrid");

  const btnClose = document.getElementById("researchClose");
  if (btnClose) btnClose.addEventListener("click", closeResearch);

  // Bloquear eventos en el fondo del overlay (pero no en el panel)
  researchOverlayEl.addEventListener("click", (e)=>{
    if (e.target === researchOverlayEl) {
      e.stopPropagation();
      e.preventDefault();
    }
  });

  // Bloquear todos los eventos de mouse en el overlay para que no lleguen al juego
  researchOverlayEl.addEventListener("mousedown", (e)=>{
    e.stopPropagation();
  }, true);
  
  researchOverlayEl.addEventListener("mouseup", (e)=>{
    e.stopPropagation();
  }, true);
}

function ensureResearchDetail(){
  if (researchDetailOverlayEl) return;

  researchDetailOverlayEl = document.getElementById("researchDetailOverlay");
  researchDetailTitleEl   = document.getElementById("researchDetailTitle");
  researchDetailBodyEl    = document.getElementById("researchDetailBody");
  researchDetailActionEl  = document.getElementById("researchDetailAction");

  const btnClose = document.getElementById("researchDetailClose");
  if (btnClose) btnClose.addEventListener("click", closeResearchDetail);

  // Bloquear eventos en el fondo del overlay (pero no en el panel)
  researchDetailOverlayEl.addEventListener("click", (e)=>{
    if (e.target === researchDetailOverlayEl) {
      e.stopPropagation();
      e.preventDefault();
    }
  });

  // Bloquear todos los eventos de mouse en el overlay para que no lleguen al juego
  researchDetailOverlayEl.addEventListener("mousedown", (e)=>{
    e.stopPropagation();
  }, true);
  
  researchDetailOverlayEl.addEventListener("mouseup", (e)=>{
    e.stopPropagation();
  }, true);
}

function renderResearch(){
  if (!researchGridEl) return;

  researchGridEl.innerHTML = RESEARCH.map(r => {
    const currentLevel = researchLevels[r.id] || 0;
    const levelText = currentLevel >= MAX_RESEARCH_LEVEL ? `Lv.${currentLevel} (MAX)` : `Lv.${currentLevel}`;
    
    return `
      <div class="research-card">
        <div class="research-left">
          <div class="research-ico"><img src="${r.icon}" alt=""></div>
          <div class="research-meta">
            <div class="research-name">${r.name}</div>
            <div class="research-desc">${r.desc || ""}</div>
            <div class="research-lv">${levelText}</div>
          </div>
        </div>
        <button class="research-view" type="button" data-research-view="${r.id}">View</button>
      </div>
    `;
  }).join("");

  // View -> abre detalle
  researchGridEl.querySelectorAll("[data-research-view]").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const id = btn.getAttribute("data-research-view");
      openResearchDetail(id);
    });
  });
}

function openResearch(){
  ensureResearchOverlay();
  ensureResearchDetail();
  renderResearch();

  researchOverlayEl.classList.remove("research-hidden");
  document.body.classList.add("modal-lock");
}

function closeResearch(){
  if (!researchOverlayEl) return;
  researchOverlayEl.classList.add("research-hidden");

  // si el detalle está abierto, también lo cerramos
  closeResearchDetail();

  document.body.classList.remove("modal-lock");
}

function openResearchDetail(id){
  ensureResearchDetail();
  const r = RESEARCH.find(x=>x.id===id);
  if (!r) return;

  // Obtener el nivel actual de esta investigación
  const currentLevel = researchLevels[r.id] || 0;
  
  // Verificar si ya llegó al nivel máximo
  if(currentLevel >= MAX_RESEARCH_LEVEL){
    researchDetailTitleEl.textContent = `${r.name}  Lv.${currentLevel} (MAX)`;
  } else {
    researchDetailTitleEl.textContent = `${r.name}  Lv.${currentLevel}`;
  }

  // Calcular porcentajes dinámicamente basados en el nivel (incremento de 5% por nivel)
  const currentPercent = currentLevel * 5;
  const nextPercent = (currentLevel + 1) * 5;

  // Si el nivel es 0, mostramos "No stats available" en current
  const currentBox = (r.current && currentLevel > 0) ? `
    <div style="flex:1;background:#1b1b1b;color:#eaeaea;border-radius:8px;padding:10px;border:1px solid rgba(0,0,0,.25)">
      <div style="color:#2fe6d7;font-weight:900;margin-bottom:6px">Current benefits</div>
      <div style="display:flex;justify-content:space-between;gap:10px">
        <div>${r.current.label}</div>
        <div style="font-weight:900">${currentPercent}%</div>
      </div>
    </div>` : `
    <div style="flex:1;background:#1b1b1b;color:#eaeaea;border-radius:8px;padding:10px;border:1px solid rgba(0,0,0,.25)">
      <div style="color:#2fe6d7;font-weight:900;margin-bottom:6px">Current benefits</div>
      <div style="opacity:.75">No stats available for this level</div>
    </div>`;

  const nextBox = (r.next && currentLevel < MAX_RESEARCH_LEVEL) ? `
    <div style="flex:1;background:#1b1b1b;color:#eaeaea;border-radius:8px;padding:10px;border:1px solid rgba(0,0,0,.25)">
      <div style="color:#ffcc66;font-weight:900;margin-bottom:6px">Next level benefits</div>
      <div style="display:flex;justify-content:space-between;gap:10px">
        <div>${r.next.label}</div>
        <div style="font-weight:900">${nextPercent}%</div>
      </div>
    </div>` : "";

  // Mapeo de edificios a imágenes
  const buildingImages = {
    "Rookery": "assets/Rookery.png",
    "Sentinel": "assets/Sentinel.png",
    "Factory": "assets/Factory.png",
    "Farm": "assets/farm.png",
    "mine": "assets/mine.png",
    "Quarry": "assets/quarry.png",
    "barrack": "assets/barrack.png",
    "metal smith": "assets/metal smith.png",
    "LumberMill": "assets/lumbermill.png",
    "science center": "assets/science center.png"
  };

  // Mapeo de investigaciones a iconos
  const researchImages = {
    "Agriculture": "assets/agriculture.png",
    "Woodcraft": "assets/Woodcraft.png",
    "Masonry": "assets/Masonry.png",
    "Alloys": "assets/Alloys.png",
    "Clairvoyance": "assets/Clairvoyance.png",
    "Metallurgy": "assets/Metallurgy.png",
    "Rapid Deployment": "assets/Rapid Deployment.png",
    "Medicine": "assets/Medicine.png",
    "Levitation": "assets/Levitation.png",
    "Dragonry": "assets/Dragonry.png",
    "Weapons Calibration": "assets/Weapons Calibrations.png",
    "Rationing": "assets/Rationing.png",
    "Aerial Combat": "assets/Aerial Combat.png"
  };

  // Calcular requisitos de research escalados (nivel base + nivel actual)
  const requiredResearch = (r.requiredResearch && r.requiredResearch.length)
    ? r.requiredResearch.map(res => {
        const imgSrc = researchImages[res.name] || "assets/science center.png";
        const requiredLevel = res.lvl + currentLevel; // Incrementa según el nivel actual
        return `
          <div style="display:flex;align-items:center;gap:8px;background:#2a2a2a;padding:8px 12px;border-radius:8px;border:1px solid rgba(255,255,255,.1)">
            <div style="width:32px;height:32px;flex-shrink:0;display:flex;align-items:center;justify-content:center;">
              <img src="${imgSrc}" style="width:100%;height:100%;object-fit:contain;" alt="${res.name}">
            </div>
            <div style="color:#eaeaea;font-weight:700;font-size:13px">${res.name}</div>
            <div style="margin-left:auto;background:#1b1b1b;padding:4px 10px;border-radius:6px;font-weight:900;color:#66ccff">Lv.${requiredLevel}</div>
          </div>
        `;
      }).join("")
    : "";

  // Calcular requisitos de edificios escalados (nivel base + nivel actual)
  const buildings = (r.buildings && r.buildings.length)
    ? r.buildings.map(b => {
        const imgSrc = buildingImages[b.name] || "assets/houseC.png";
        const requiredLevel = b.lvl + currentLevel; // Incrementa según el nivel actual
        return `
          <div style="display:flex;align-items:center;gap:8px;background:#2a2a2a;padding:8px 12px;border-radius:8px;border:1px solid rgba(255,255,255,.1)">
            <div style="width:32px;height:32px;flex-shrink:0;display:flex;align-items:center;justify-content:center;">
              <img src="${imgSrc}" style="width:100%;height:100%;object-fit:contain;" alt="${b.name}">
            </div>
            <div style="color:#eaeaea;font-weight:700;font-size:13px">${b.name}</div>
            <div style="margin-left:auto;background:#1b1b1b;padding:4px 10px;border-radius:6px;font-weight:900;color:#ffcc66">Lv.${requiredLevel}</div>
          </div>
        `;
      }).join("")
    : `<div style="opacity:.75;color:#eaeaea">—</div>`;

  // Función para parsear y escalar costos
  function parseAndScaleCost(costStr, multiplier){
    if(!costStr) return costStr;
    
    // Si tiene "K" al final (ejemplo: "4K")
    if(costStr.includes("K")){
      const num = parseFloat(costStr.replace("K", ""));
      const scaled = num * multiplier;
      return scaled >= 1 ? `${scaled}K` : `${scaled * 1000}`;
    }
    
    // Si es un número normal
    const num = parseInt(costStr);
    if(!isNaN(num)){
      return (num * multiplier).toString();
    }
    
    return costStr;
  }

  // Calcular el multiplicador (2^nivel)
  const costMultiplier = Math.pow(2, currentLevel);

  // Íconos de recursos
  const resourceIcons = {
    "food": "🍞",
    "wood": "🪵",
    "stone": "🪨",
    "iron": "⛓️",
    "gold": "🪙"
  };

  // Calcular costos escalados
  const costs = r.costs && Object.keys(r.costs).length
    ? Object.entries(r.costs).map(([k,v]) => {
        const icon = resourceIcons[k] || "💎";
        const scaledCost = parseAndScaleCost(v, costMultiplier);
        return `
          <div style="display:flex;align-items:center;gap:6px;background:#2a2a2a;padding:8px 12px;border-radius:8px;border:1px solid rgba(255,255,255,.1)">
            <div style="font-size:16px">${icon}</div>
            <div style="color:#eaeaea;font-weight:900;font-size:13px">${scaledCost}</div>
          </div>
        `;
      }).join("")
    : `<div style="opacity:.75;color:#eaeaea">—</div>`;

  // Parsear y escalar el tiempo
  function parseTime(timeStr){
    if(!timeStr || timeStr === "—") return 0;
    
    let totalSeconds = 0;
    const parts = timeStr.split(" ");
    
    for(let part of parts){
      if(part.includes("h")){
        totalSeconds += parseInt(part) * 3600;
      } else if(part.includes("m")){
        totalSeconds += parseInt(part) * 60;
      } else if(part.includes("s")){
        totalSeconds += parseInt(part);
      }
    }
    
    return totalSeconds;
  }

  function formatTime(seconds){
    if(seconds === 0) return "—";
    
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    
    let result = [];
    if(h > 0) result.push(`${h}h`);
    if(m > 0) result.push(`${m}m`);
    if(s > 0) result.push(`${s}s`);
    
    return result.join(" ");
  }

  const baseTimeSeconds = parseTime(r.time);
  const scaledTimeSeconds = baseTimeSeconds * costMultiplier;
  const scaledTime = formatTime(scaledTimeSeconds);

  researchDetailBodyEl.innerHTML = `
    <div style="display:flex;gap:14px;align-items:flex-start">
      <div style="width:74px;height:74px;background:#111;border-radius:10px;display:flex;align-items:center;justify-content:center;overflow:hidden">
        <img src="${r.icon}" style="width:100%;height:100%;object-fit:contain" alt="">
      </div>

      <div style="flex:1">
        <div style="font-weight:900;margin-top:2px">${r.desc || ""}</div>
        <div style="margin-top:6px;opacity:.85">⏱ ${scaledTime}</div>
      </div>
    </div>

    <div style="display:flex;gap:10px;margin-top:14px">
      ${currentBox}
      ${nextBox}
    </div>

    <div style="margin-top:14px;background:#1b1b1b;border-radius:10px;padding:12px;border:1px solid rgba(0,0,0,.25)">
      ${requiredResearch ? `
        <div style="font-weight:900;opacity:.85;margin-bottom:10px;color:#eaeaea">REQUIRED RESEARCH</div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:8px">${requiredResearch}</div>
        <div style="height:1px;background:rgba(255,255,255,.08);margin:12px 0"></div>
      ` : ''}
      
      <div style="font-weight:900;opacity:.85;margin-bottom:10px;color:#eaeaea">BUILDINGS</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:8px">${buildings}</div>

      <div style="height:1px;background:rgba(255,255,255,.08);margin:12px 0"></div>

      <div style="font-weight:900;opacity:.85;margin-bottom:10px;color:#eaeaea">RESOURCES</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:8px">${costs}</div>
    </div>
  `;

  // Si ya llegó al nivel máximo, cambiar el botón
  if(currentLevel >= MAX_RESEARCH_LEVEL){
    researchDetailActionEl.textContent = "MAX LEVEL";
    researchDetailActionEl.style.opacity = "0.5";
    researchDetailActionEl.style.cursor = "not-allowed";
    researchDetailActionEl.onclick = null;
  } else {
    researchDetailActionEl.textContent = "Research";
    researchDetailActionEl.style.opacity = "1";
    researchDetailActionEl.style.cursor = "pointer";
    researchDetailActionEl.onclick = ()=> {
      // Parsear el tiempo de la investigación escalado
      const duration = scaledTimeSeconds * 1000; // Convertir a milisegundos
      
      if(duration > 0){
        // Agregar al array de investigaciones activas
        activeResearches.push({
          id: r.id,
          name: r.name,
          level: currentLevel,
          endsAt: Date.now() + duration
        });
        
        // Cerrar ambos overlays
        closeResearchDetail();
        closeResearch();
        
        // Abrir el panel de Research HUD automáticamente
        if(researchHudPanel){
          researchHudPanel.classList.remove("hidden");
          renderResearchHudPanel();
        }
        
        console.log("Research started:", r.name, "Level", currentLevel, "→", currentLevel + 1, "Duration:", duration / 1000, "seconds");
      } else {
        console.log("Cannot start research - no time defined");
      }
    };
  }

  researchDetailOverlayEl.classList.remove("research-hidden");
  document.body.classList.add("modal-lock");
}

function closeResearchDetail(){
  if (!researchDetailOverlayEl) return;
  researchDetailOverlayEl.classList.add("research-hidden");
  document.body.classList.remove("modal-lock");
}

// Botón Investigación (leftpanel)
(function hookResearchButton(){
  const btn = document.getElementById("btnResearch");
  if (!btn) return;
  btn.addEventListener("click", openResearch);
})();

});
/* ============================================================
   MAP SYSTEM (World Map con zonas salvajes y campamentos)
============================================================ */

const ZONE_TYPES = [
  { id: "camp", name: "Anthropus Camp", icon: "assets/camp.png", type: "camp" },
  { id: "forest", name: "Forest", icon: "assets/forest.png", type: "wilderness" },
  { id: "lake", name: "Lake", icon: "assets/lake.png", type: "wilderness" },
  { id: "mountain", name: "Mountain", icon: "assets/mountain.png", type: "wilderness" },
  { id: "plain", name: "Plains", icon: "assets/plain.png", type: "wilderness" },
  { id: "savanna", name: "Savanna", icon: "assets/savanna.png", type: "wilderness" },
  { id: "bog", name: "Bog", icon: "assets/bog.png", type: "wilderness" },
  { id: "hill", name: "Hill", icon: "assets/hill.png", type: "wilderness" }
];

// Enemigos con sus estadísticas (basado en la tabla)
const ENEMIES = [
  {
    name: "Brats",
    meleeAtk: 1,
    def: 10,
    life: 45,
    speed: 100,
    range: 0,
    rangeAtk: 0
  },
  {
    name: "Cannibals",
    meleeAtk: 10,
    def: 10,
    life: 75,
    speed: 200,
    range: 0,
    rangeAtk: 0
  },
  {
    name: "Stench",
    meleeAtk: 5,
    def: 5,
    life: 10,
    speed: 3000,
    range: 0,
    rangeAtk: 0
  },
  {
    name: "She-Devils",
    meleeAtk: 40,
    def: 40,
    life: 150,
    speed: 300,
    range: 0,
    rangeAtk: 0
  },
  {
    name: "Clubbers",
    meleeAtk: 70,
    def: 45,
    life: 225,
    speed: 275,
    range: 0,
    rangeAtk: 0
  },
  {
    name: "Hurlers",
    meleeAtk: 5,
    def: 30,
    life: 75,
    speed: 250,
    range: 1200,
    rangeAtk: 80
  },
  {
    name: "Shredders",
    meleeAtk: 150,
    def: 60,
    life: 300,
    speed: 1000,
    range: 0,
    rangeAtk: 0
  },
  {
    name: "Chieftan",
    meleeAtk: 300,
    def: 300,
    life: 1500,
    speed: 750,
    range: 0,
    rangeAtk: 0
  },
  {
    name: "Bloods",
    meleeAtk: 1000,
    def: 400,
    life: 4000,
    speed: 120,
    range: 0,
    rangeAtk: 0
  },
  {
    name: "Ragers",
    meleeAtk: 20,
    def: 30,
    life: 1500,
    speed: 50,
    range: 1500,
    rangeAtk: 1200
  }
];

let mapViewEl = null;
let mapWrapperEl = null;
let mapZonesEl = null;
let mapZones = [];
let mapInitialized = false;

// Variables para el drag
let isDragging = false;
let startX = 0;
let startY = 0;
let currentX = 0;
let currentY = 0;
let mapX = 0;
let mapY = 0;

function initMapSystem(){
  if(mapInitialized) return;
  
  mapViewEl = document.getElementById("mapView");
  mapWrapperEl = document.getElementById("mapWrapper");
  mapZonesEl = document.getElementById("mapZones");

  // Inicializar posición del mapa (centrado)
  centerMap();

  // Generar zonas en clusters
  generateMapZones();
  
  // Setup drag handlers
  setupMapDrag();
  
  // Setup search
  setupMapSearch();
  
  mapInitialized = true;
}

function centerMap(){
  // Centrar el mapa en el grid 3x3
  // Para centrar: mover a -100% del viewport width (mostramos el tile del centro)
  if(!mapViewEl) return;
  const viewRect = mapViewEl.getBoundingClientRect();
  mapX = -viewRect.width;
  mapY = -viewRect.height;
  updateMapPosition();
}

function setupMapDrag(){
  mapViewEl.addEventListener('mousedown', onMapMouseDown);
  document.addEventListener('mousemove', onMapMouseMove);
  document.addEventListener('mouseup', onMapMouseUp);
  
  // Touch events para móvil
  mapViewEl.addEventListener('touchstart', onMapTouchStart);
  document.addEventListener('touchmove', onMapTouchMove);
  document.addEventListener('touchend', onMapTouchEnd);
}

function onMapMouseDown(e){
  // No iniciar drag si se clickeó una zona o el buscador
  if(e.target.closest('.map-zone') || e.target.closest('.map-search')) return;
  
  isDragging = true;
  mapViewEl.classList.add('dragging');
  
  startX = e.clientX - mapX;
  startY = e.clientY - mapY;
}

function onMapMouseMove(e){
  if(!isDragging) return;
  
  e.preventDefault();
  
  currentX = e.clientX - startX;
  currentY = e.clientY - startY;
  
  // Limitar el movimiento del mapa
  const bounds = getMapBounds();
  mapX = Math.max(bounds.minX, Math.min(bounds.maxX, currentX));
  mapY = Math.max(bounds.minY, Math.min(bounds.maxY, currentY));
  
  updateMapPosition();
}

function onMapMouseUp(){
  isDragging = false;
  mapViewEl.classList.remove('dragging');
}

function onMapTouchStart(e){
  if(e.target.closest('.map-zone') || e.target.closest('.map-search')) return;
  
  isDragging = true;
  mapViewEl.classList.add('dragging');
  
  const touch = e.touches[0];
  startX = touch.clientX - mapX;
  startY = touch.clientY - mapY;
}

function onMapTouchMove(e){
  if(!isDragging) return;
  
  e.preventDefault();
  
  const touch = e.touches[0];
  currentX = touch.clientX - startX;
  currentY = touch.clientY - startY;
  
  const bounds = getMapBounds();
  mapX = Math.max(bounds.minX, Math.min(bounds.maxX, currentX));
  mapY = Math.max(bounds.minY, Math.min(bounds.maxY, currentY));
  
  updateMapPosition();
}

function onMapTouchEnd(){
  isDragging = false;
  mapViewEl.classList.remove('dragging');
}

function getMapBounds(){
  if(!mapViewEl || !mapWrapperEl) return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
  
  const viewRect = mapViewEl.getBoundingClientRect();
  // El mapa es 3x3, entonces el wrapper es 3 veces el tamaño del viewport
  const wrapperWidth = viewRect.width * 3;
  const wrapperHeight = viewRect.height * 3;
  
  return {
    minX: -(wrapperWidth - viewRect.width),
    maxX: 0,
    minY: -(wrapperHeight - viewRect.height),
    maxY: 0
  };
}

function updateMapPosition(){
  if(!mapWrapperEl) return;
  
  // Usar píxeles en lugar de porcentajes para mejor control
  mapWrapperEl.style.transform = `translate(${mapX}px, ${mapY}px)`;
}

// Generar enemigos para una zona según su tipo y nivel
function generateZoneEnemies(zoneType, level){
  const enemies = {};
  
  if(zoneType === 'camp'){
    // CAMPAMENTOS ANTHROPUS: Usar tabla de PODER
    Object.keys(ANTHROPUS_CAMP_POWER).forEach(troopKey => {
      const powerAtLevel = ANTHROPUS_CAMP_POWER[troopKey][level];
      if(powerAtLevel > 0){
        const troopInfo = ANTHROPUS_TROOPS_INFO[troopKey];
        const quantity = Math.floor(powerAtLevel / troopInfo.powerPerUnit);
        if(quantity > 0){
          enemies[troopKey] = {
            name: troopInfo.name,
            icon: troopInfo.icon,
            quantity: quantity,
            power: powerAtLevel,
            // ✅ STATS COMPLETAS
            meleeAtk: troopInfo.meleeAtk,
            def: troopInfo.def,
            life: troopInfo.life,
            speed: troopInfo.speed,
            range: troopInfo.range,
            rangeAtk: troopInfo.rangeAtk
          };
        }
      }
    });
  } else {
    // ZONAS SALVAJES: Usar tabla de CANTIDAD
    Object.keys(WILDERNESS_TROOP_COUNT).forEach(troopKey => {
      const quantityAtLevel = WILDERNESS_TROOP_COUNT[troopKey][level];
      if(quantityAtLevel > 0){
        const troopInfo = ANTHROPUS_TROOPS_INFO[troopKey];
        enemies[troopKey] = {
          name: troopInfo.name,
          icon: troopInfo.icon,
          quantity: quantityAtLevel,
          power: quantityAtLevel * troopInfo.powerPerUnit,
          // ✅ STATS COMPLETAS
          meleeAtk: troopInfo.meleeAtk,
          def: troopInfo.def,
          life: troopInfo.life,
          speed: troopInfo.speed,
          range: troopInfo.range,
          rangeAtk: troopInfo.rangeAtk
        };
      }
    });
  }
  
  return enemies;
}

// Calcular poder total de una zona basado en sus enemigos
function calculateZoneTotalPower(enemies){
  let totalPower = 0;
  Object.values(enemies).forEach(enemy => {
    totalPower += enemy.power;
  });
  return totalPower;
}

// Generar zonas distribuidas uniformemente por todo el mapa
function generateMapZones(){
  mapZones = [];
  
  let zoneId = 0;
  
  // Generar 1600 zonas (40x40 grid)
  const gridSize = 40; // 40x40 = 1600 zonas
  const cellSize = 100 / gridSize; // Cada celda ocupa 100/40 = 2.5% del mapa
  
  // PRIMERO: Calcular posición de la fortaleza en el grid
  const fortressCoordX = playerCity.coordX;
  const fortressCoordY = playerCity.coordY;
  
  // Convertir coordenadas a posición en el grid (0-300 → 0-40)
  const fortressGridCol = Math.floor((fortressCoordX / 300) * gridSize);
  const fortressGridRow = Math.floor((fortressCoordY / 300) * gridSize);
  
  console.log(`🏰 Fortress will be at grid position [${fortressGridCol}, ${fortressGridRow}]`);
  
  for(let row = 0; row < gridSize; row++){
    for(let col = 0; col < gridSize; col++){
      // SALTAR la celda donde va la fortaleza
      if(col === fortressGridCol && row === fortressGridRow){
        console.log(`⏭️ Skipping grid cell [${col}, ${row}] for fortress`);
        continue;
      }
      
      // GENERAR ZONA EN CADA CELDA
      const zoneType = ZONE_TYPES[Math.floor(Math.random() * ZONE_TYPES.length)];
      const level = Math.floor(Math.random() * 10) + 1; // nivel 1-10
      
      // Posición exacta en el centro de cada celda
      const x = col * cellSize + cellSize / 2;
      const y = row * cellSize + cellSize / 2;
      
      // Coordenadas del mapa (0-300 en cada eje)
      const coordX = Math.floor(x * 3);
      const coordY = Math.floor(y * 3);
      
      // ✅ GENERAR ENEMIGOS para esta zona
      const enemies = generateZoneEnemies(zoneType.type, level);
      const totalPower = calculateZoneTotalPower(enemies);
      
      mapZones.push({
        id: `zone_${zoneId}`,
        typeId: zoneType.id,
        name: zoneType.name,
        icon: zoneType.icon,
        type: zoneType.type,
        level: level,
        x: x,
        y: y,
        coordX: coordX,
        coordY: coordY,
        enemies: enemies,        // ✅ NUEVO: Enemigos de la zona
        totalPower: totalPower   // ✅ NUEVO: Poder total calculado
      });
      
      zoneId++;
    }
  }
  
  console.log(`✅ Generated ${mapZones.length} zones (excluding fortress spot)`);
  
  // AHORA AGREGAR LA FORTALEZA EN SU POSICIÓN EXACTA
  const fortressX = fortressGridCol * cellSize + cellSize / 2;
  const fortressY = fortressGridRow * cellSize + cellSize / 2;
  
  mapZones.push({
    id: 'player_fortress',
    typeId: 'fortress',
    name: playerCity.name,
    icon: 'assets/Fortress.png',
    type: 'fortress',
    level: 1,
    x: fortressX,  // Porcentaje del mapa (0-100) - SINCRONIZADO con el grid
    y: fortressY,  // Porcentaje del mapa (0-100) - SINCRONIZADO con el grid
    coordX: fortressCoordX,  // Coordenadas del juego (0-300)
    coordY: fortressCoordY   // Coordenadas del juego (0-300)
  });
  
  console.log(`✅ Fortress added at [${fortressCoordX}:${fortressCoordY}] = (${fortressX.toFixed(1)}%, ${fortressY.toFixed(1)}%) grid[${fortressGridCol},${fortressGridRow}]`);
  console.log(`🗺️ Total zones on map: ${mapZones.length}`);
}

function renderMapZones(){
  if(!mapZonesEl) return;
  
  // Limpiar mapa
  mapZonesEl.innerHTML = '';
  
  console.log(`🗺️ Rendering ${mapZones.length} zones on map`);
  
  // Renderizar cada zona (incluye 1600 zonas + fortaleza)
  mapZones.forEach(zone => {
    const zoneElement = document.createElement('div');
    zoneElement.className = 'map-zone';
    zoneElement.style.position = 'absolute';
    zoneElement.style.left = `${zone.x}%`;
    zoneElement.style.top = `${zone.y}%`;
    zoneElement.style.transform = 'translate(-50%, -50%)';
    zoneElement.setAttribute('data-zone-id', zone.id);
    zoneElement.setAttribute('data-coord-x', zone.coordX);
    zoneElement.setAttribute('data-coord-y', zone.coordY);
    
    if(zone.type === 'fortress'){
      // FORTALEZA DEL JUGADOR - SIMPLE Y LIMPIA
      zoneElement.classList.add('player-city');
      zoneElement.style.width = '150px';
      zoneElement.style.height = '150px';
      zoneElement.style.zIndex = '99999';
      zoneElement.style.background = 'transparent';
      zoneElement.style.border = 'none';
      zoneElement.style.borderRadius = '0';
      zoneElement.style.boxShadow = 'none';
      zoneElement.style.cursor = 'pointer';
      zoneElement.title = `${zone.name} [${zone.coordX}:${zone.coordY}]`;
      
      zoneElement.innerHTML = `
        <div style="
          width: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          position: relative;
        ">
          <!-- Imagen principal de la fortaleza -->
          <img src="${zone.icon}" 
               onerror="console.error('❌ Fortress image failed to load:', '${zone.icon}'); this.style.display='none'; this.parentElement.querySelector('.fallback-emoji').style.display='block';" 
               onload="console.log('✅ Fortress image loaded successfully');"
               style="
                 width: 120px;
                 height: 120px;
                 object-fit: contain;
                 filter: drop-shadow(0 0 10px rgba(0,0,0,0.5));
                 margin-bottom: 5px;
                 position: relative;
                 z-index: 2;
               ">
          
          <!-- Emoji de respaldo si la imagen no carga -->
          <div class="fallback-emoji" style="
            display: none;
            font-size: 80px;
            text-shadow: 0 0 10px rgba(0,0,0,0.5);
            margin-bottom: 5px;
          ">🏰</div>
          
          <!-- Nombre de la ciudad (MÁS PEQUEÑO) -->
          <div style="
            font-size: 11px;
            font-weight: 700;
            color: #ffffff;
            background: rgba(0,0,0,0.7);
            padding: 3px 8px;
            border-radius: 4px;
            text-shadow: 0 1px 3px rgba(0,0,0,0.8);
            position: relative;
            z-index: 3;
          ">${zone.name}</div>
        </div>
      `;
      
      console.log(`🏰 Fortress rendered at ${zone.x.toFixed(1)}%, ${zone.y.toFixed(1)}% [${zone.coordX}:${zone.coordY}]`);
      
      
    } else {
      // ZONAS NORMALES (campamentos y zonas salvajes)
      zoneElement.style.width = '85px';
      zoneElement.style.height = '85px';
      zoneElement.style.zIndex = '100';
      zoneElement.style.cursor = 'pointer';
      
      // Determinar ícono correcto para campamentos según nivel
      let zoneIcon = zone.icon;
      let zoneName = zone.name;
      
      if(zone.type === 'camp'){
        zoneName = 'Anthropus Camp';
        
        // Cambiar imagen según el nivel
        if(zone.level >= 1 && zone.level <= 4){
          zoneIcon = 'assets/camp.png';
        } else if(zone.level >= 5 && zone.level <= 7){
          zoneIcon = 'assets/camp2.png';
        } else if(zone.level >= 8 && zone.level <= 10){
          zoneIcon = 'assets/camp3.png';
        }
      }
      
      zoneElement.title = `${zoneName} - Lv.${zone.level} [${zone.coordX}:${zone.coordY}]`;
      
      zoneElement.innerHTML = `
        <img src="${zoneIcon}" class="map-zone-icon" alt="${zoneName}">
        <div class="map-zone-coords">${zone.coordX}:${zone.coordY}</div>
        <div class="map-zone-level">${zone.level}</div>
      `;
    }
    
    // Evento de click
    zoneElement.addEventListener('click', (e) => {
      e.stopPropagation();
      onZoneClick(zone);
    });
    
    mapZonesEl.appendChild(zoneElement);
  });
  
  console.log(`✅ All ${mapZones.length} zones rendered successfully`);
  
  // VERIFICACIÓN ADICIONAL: Contar fortalezas renderizadas
  const fortressElements = mapZonesEl.querySelectorAll('.player-city');
  console.log(`🏰 Fortress elements found: ${fortressElements.length}`);
  
  if(fortressElements.length > 0){
    fortressElements.forEach((el, idx) => {
      const rect = el.getBoundingClientRect();
      const coordX = el.getAttribute('data-coord-x');
      const coordY = el.getAttribute('data-coord-y');
      console.log(`   Fortress ${idx + 1}: [${coordX}:${coordY}] | Position: ${el.style.left}, ${el.style.top} | Size: ${rect.width}x${rect.height}px | Visible: ${rect.width > 0 && rect.height > 0}`);
    });
  } else {
    console.error('❌ NO FORTRESS ELEMENTS RENDERED!');
  }
  
  // Agregar animación CSS si no existe
  if(!document.getElementById('fortress-animation-style')){
    const style = document.createElement('style');
    style.id = 'fortress-animation-style';
    style.textContent = `
      @keyframes pulse {
        0%, 100% { transform: scale(1); opacity: 1; }
        50% { transform: scale(1.5); opacity: 0.5; }
      }
    `;
    document.head.appendChild(style);
  }
}

function onZoneClick(zone){
  console.log("🎯 Zone clicked:", zone);
  
  if(zone.type === 'fortress'){
    alert(`${zone.name}\nCoordinates: [${zone.coordX}:${zone.coordY}]\n\n🏰 This is your fortress!`);
    return;
  }
  
  // Mostrar modal con información de la zona
  showZoneInfoModal(zone);
}

// Variable global para almacenar la zona actual
let currentZone = null;

function showZoneInfoModal(zone){
  const modal = document.getElementById('zoneInfoModal');
  if(!modal) return;
  
  // Guardar zona actual para el botón INFO
  currentZone = zone;
  
  // Determinar nombre según el tipo
  let displayName = zone.name;
  if(zone.type === 'camp'){
    displayName = 'ANTHROPUS CAMP';
  } else if(zone.type === 'wilderness'){
    displayName = zone.name.toUpperCase();
  }
  
  // Usar el poder REAL calculado de las tropas
  const zonePower = zone.totalPower || 0;
  
  // Actualizar contenido del modal
  document.getElementById('zoneInfoLevel').textContent = `Lv.${zone.level}`;
  document.getElementById('zoneInfoName').textContent = displayName;
  document.getElementById('zoneInfoPowerValue').textContent = zonePower.toLocaleString();
  document.getElementById('zoneInfoCoords').textContent = `[${zone.coordX}:${zone.coordY}]`;
  
  // Actualizar imagen
  const zoneImage = document.getElementById('zoneInfoImage');
  zoneImage.src = zone.icon;
  zoneImage.alt = displayName;
  
  // Mostrar modal
  modal.classList.remove('hidden');
  
  console.log(`📋 Zone info modal opened for: ${displayName} Lv.${zone.level} | Power: ${zonePower}`);
}

function closeZoneInfoModal(){
  const modal = document.getElementById('zoneInfoModal');
  if(modal){
    modal.classList.add('hidden');
    console.log('📋 Zone info modal closed');
  }
}

// Event listeners para el modal de zona
document.addEventListener('DOMContentLoaded', () => {
  const zoneInfoClose = document.getElementById('zoneInfoClose');
  const zoneInfoBtnInfo = document.getElementById('zoneInfoBtnInfo');
  const zoneInfoBtnSpy = document.getElementById('zoneInfoBtnSpy');
  const zoneInfoBtnAttack = document.getElementById('zoneInfoBtnAttack');
  const zoneInfoModal = document.getElementById('zoneInfoModal');
  
  // Cerrar modal
  if(zoneInfoClose){
    zoneInfoClose.addEventListener('click', closeZoneInfoModal);
  }
  
  // Cerrar al hacer click en el overlay (fondo oscuro)
  if(zoneInfoModal){
    zoneInfoModal.addEventListener('click', (e) => {
      if(e.target === zoneInfoModal){
        closeZoneInfoModal();
      }
    });
  }
  
  // Botón INFO
  if(zoneInfoBtnInfo){
    zoneInfoBtnInfo.addEventListener('click', () => {
      console.log('ℹ️ INFO button clicked');
      
      if(!currentZone || !currentZone.enemies){
        alert('No hay información de enemigos disponible.');
        return;
      }
      
      // Construir mensaje con todos los enemigos Y TODAS SUS STATS
      let message = `🗺️ ${currentZone.name.toUpperCase()}\n`;
      message += `📍 Coordenadas: [${currentZone.coordX}:${currentZone.coordY}]\n`;
      message += `⭐ Nivel: ${currentZone.level}\n`;
      message += `💪 Poder Total: ${currentZone.totalPower.toLocaleString()}\n`;
      message += `\n━━━━━━━━━━━━━━━━━━━━━━━\n`;
      message += `👹 ENEMIGOS Y STATS:\n`;
      message += `━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
      
      const enemiesList = Object.values(currentZone.enemies);
      if(enemiesList.length === 0){
        message += 'No hay enemigos en esta zona.';
      } else {
        enemiesList.forEach((enemy, index) => {
          message += `━━ ${enemy.name} ━━\n`;
          message += `Cantidad: ${enemy.quantity.toLocaleString()}\n`;
          message += `Poder: ${enemy.power.toLocaleString()}\n\n`;
          message += `📊 STATS POR UNIDAD:\n`;
          message += `⚔️  Melee ATK: ${enemy.meleeAtk}\n`;
          message += `🛡️  Defense: ${enemy.def}\n`;
          message += `❤️  Life: ${enemy.life}\n`;
          message += `⚡ Speed: ${enemy.speed}\n`;
          message += `🎯 Range: ${enemy.range}\n`;
          message += `🏹 Range ATK: ${enemy.rangeAtk}\n`;
          
          // Agregar separador entre enemigos (excepto el último)
          if(index < enemiesList.length - 1){
            message += `\n━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
          }
        });
      }
      
      alert(message);
    });
  }
  
  // Botón SPY
  if(zoneInfoBtnSpy){
    zoneInfoBtnSpy.addEventListener('click', () => {
      console.log('🔍 SPY button clicked');
      alert('Espiar zona\n\n(Esta funcionalidad se implementará más adelante)');
      closeZoneInfoModal();
    });
  }
  
  // Botón ATTACK
  if(zoneInfoBtnAttack){
    zoneInfoBtnAttack.addEventListener('click', () => {
      console.log('⚔️ ATTACK button clicked');
      
      if(!currentZone){
        alert('No hay zona seleccionada.');
        return;
      }
      
      // Cerrar modal de zona y abrir modal de selección de tropas
      closeZoneInfoModal();
      openTroopSelectionModal(currentZone);
    });
  }
});

// =========================
// SISTEMA DE BATALLA COMPLETO
// =========================

// Variable global para almacenar el objetivo del ataque
let currentAttackTarget = null;
let selectedTroopsForAttack = {};

// Abrir modal de selección de tropas
function openTroopSelectionModal(targetZone){
  const modal = document.getElementById('troopSelectionModal');
  if(!modal) return;
  
  currentAttackTarget = targetZone;
  selectedTroopsForAttack = {};
  
  // Actualizar INFO DEL OBJETIVO (arriba izquierda)
  const displayName = targetZone.type === 'camp' ? 'CAMP' : targetZone.name.toUpperCase();
  document.getElementById('attackTargetLevel').textContent = `LV.${targetZone.level} ${displayName}`;
  document.getElementById('attackTargetPower').textContent = targetZone.totalPower.toLocaleString();
  document.getElementById('attackTargetCoords').textContent = `${targetZone.coordX}, ${targetZone.coordY}`;
  
  // Actualizar imagen del objetivo
  const targetImage = document.getElementById('attackTargetImage');
  targetImage.src = targetZone.icon;
  targetImage.alt = displayName;
  
  // Renderizar tropas como cartas
  renderAttackTroopCards();
  
  // Actualizar stats
  updateAttackStats();
  
  // Mostrar modal
  modal.classList.remove('hidden');
  
  console.log(`🗡️ Opened attack modal for: ${displayName} Lv.${targetZone.level}`);
}

// Renderizar tropas como cartas grandes (estilo DoA)
function renderAttackTroopCards(){
  const grid = document.getElementById('attackTroopCardsGrid');
  if(!grid) return;
  
  grid.innerHTML = '';
  
  // Obtener tropas entrenadas del jugador
  Object.values(TROOPS).forEach(troop => {
    const available = troop.have || 0;
    
    if(available <= 0) return; // No mostrar tropas sin unidades
    
    const card = document.createElement('div');
    card.className = 'attack-troop-card';
    
    card.innerHTML = `
      <div class="attack-troop-card-image">
        <img src="${troop.img}" alt="${troop.name}">
      </div>
      <div class="attack-troop-card-quantity">0 / ${available}</div>
      <div class="attack-troop-card-name">${troop.name}</div>
      <input 
        type="number" 
        class="attack-troop-card-input" 
        data-troop-id="${troop.id}"
        min="0" 
        max="${available}" 
        value="${selectedTroopsForAttack[troop.id] || 0}"
        placeholder="0">
    `;
    
    // Event listener para actualizar stats
    const input = card.querySelector('input');
    input.addEventListener('input', () => {
      const value = parseInt(input.value) || 0;
      const maxValue = parseInt(input.max);
      
      // Limitar al máximo disponible
      if(value > maxValue){
        input.value = maxValue;
      }
      if(value < 0){
        input.value = 0;
      }
      
      // Actualizar cantidad en la tarjeta
      const quantityDisplay = card.querySelector('.attack-troop-card-quantity');
      quantityDisplay.textContent = `${input.value} / ${available}`;
      
      selectedTroopsForAttack[troop.id] = parseInt(input.value) || 0;
      updateAttackStats();
    });
    
    grid.appendChild(card);
  });
}

// Actualizar poder total seleccionado
// Actualizar todos los stats de la barra inferior
function updateAttackStats(){
  let totalTroops = 0;
  let totalLoadCapacity = 0;
  const maxSlots = 120000; // Slots máximos por marcha
  
  Object.keys(selectedTroopsForAttack).forEach(troopId => {
    const quantity = selectedTroopsForAttack[troopId];
    if(quantity > 0){
      totalTroops += quantity;
      // Asumiendo que cada tropa tiene 1 de capacidad de carga
      totalLoadCapacity += quantity * 1;
    }
  });
  
  // Actualizar valores
  document.getElementById('attackLoadCapacity').textContent = totalLoadCapacity.toLocaleString();
  document.getElementById('attackEstimatedTime').textContent = '0'; // TODO: calcular tiempo real
  document.getElementById('attackSelectedTroops').textContent = totalTroops.toLocaleString();
  document.getElementById('attackSlotsLeft').textContent = (maxSlots - totalTroops).toLocaleString();
  
  // Habilitar/deshabilitar botón de ataque
  const attackBtn = document.getElementById('troopSelectionAttackBtn');
  if(attackBtn){
    attackBtn.disabled = (totalTroops === 0);
  }
}

// Cerrar modal de selección de tropas
function closeTroopSelectionModal(){
  const modal = document.getElementById('troopSelectionModal');
  if(modal){
    modal.classList.add('hidden');
    selectedTroopsForAttack = {};
    currentAttackTarget = null;
  }
}

// Ejecutar ataque
function executeAttack(){
  if(!currentAttackTarget){
    alert('No hay objetivo seleccionado.');
    return;
  }
  
  // Verificar que hay tropas seleccionadas
  const totalSelected = Object.values(selectedTroopsForAttack).reduce((sum, qty) => sum + qty, 0);
  if(totalSelected === 0){
    alert('Debes seleccionar al menos 1 tropa para atacar.');
    return;
  }
  
  console.log('⚔️ Executing attack!');
  console.log('Target:', currentAttackTarget);
  console.log('Selected troops:', selectedTroopsForAttack);
  
  // Simular batalla
  const battleResult = simulateBattle(selectedTroopsForAttack, currentAttackTarget);
  
  console.log('Battle result:', battleResult);
  
  // Cerrar modal de selección
  closeTroopSelectionModal();
  
  // Mostrar resultados
  showBattleResult(battleResult);
  
  // Aplicar cambios al juego
  applyBattleResults(battleResult);
}

// Simular batalla (lógica completa como en DoA)
/* ============================================================
   ⚔️ DRAGONS OF ATLANTIS BATTLE SYSTEM
   Sistema de combate completo con líneas, counters, y rondas
   ============================================================ */

// Configuración del sistema de combate
const BATTLE_CONFIG = {
  MAX_ROUNDS: 10,
  COUNTER_BONUS: {
    MELEE_VS_RANGED: 1.20,    // +20% daño melee contra ranged
    RANGED_VS_MELEE: 1.20,    // +20% daño ranged contra melee
    DRAGON_VS_RANGED: 1.35    // +35% daño dragon contra ranged
  },
  NO_DRAGON_PENALTY: 0.80,    // -20% poder total sin dragón
  DEFENDER_BONUS: {
    WALL: 1.15,               // +15% defensa por muros
    TOWER: 1.10,              // +10% defensa por torres
    GENERAL: 1.05             // +5% defensa general
  }
};

// Líneas de combate
const BATTLE_LINES = {
  MELEE: 'melee',
  RANGED: 'ranged',
  DRAGON: 'dragon'
};

/**
 * Clase principal del sistema de combate
 */
class BattleSystem {
  constructor(attacker, defender, research = {}, dragon = null, isDefendingCity = false){
    this.attacker = this.prepareArmy(attacker, 'attacker', research.attacker || {}, dragon);
    this.defender = this.prepareArmy(defender, 'defender', research.defender || {}, null);
    this.research = research;
    this.isDefendingCity = isDefendingCity;
    this.rounds = [];
    this.currentRound = 0;
  }
  
  /**
   * Preparar ejército organizándolo por líneas
   */
  prepareArmy(troops, side, research, dragon){
    const army = {
      troops: {},
      lines: {
        melee: [],
        ranged: [],
        dragon: []
      },
      totalPower: 0,
      hasDragon: !!dragon,
      dragon: dragon,
      research: research,
      wounded: {},
      dead: {}
    };
    
    // Organizar tropas por línea
    Object.keys(troops).forEach(troopId => {
      const troop = troops[troopId];
      if(!troop || troop.quantity <= 0) return;
      
      const troopData = {
        id: troopId,
        name: troop.name,
        quantity: troop.quantity,
        originalQuantity: troop.quantity,
        attack: troop.meleeAtk || troop.rangeAtk || 10,
        defense: troop.def || 10,
        life: troop.life || 50,
        maxLife: troop.life || 50,
        range: troop.range || 0,
        power: troop.power || 50,
        line: this.determineLine(troop)
      };
      
      // Aplicar bonus de investigación
      troopData.attack = this.applyResearchBonus(troopData.attack, troopData.line, research, 'attack');
      troopData.defense = this.applyResearchBonus(troopData.defense, troopData.line, research, 'defense');
      
      army.troops[troopId] = troopData;
      army.lines[troopData.line].push(troopId);
      army.totalPower += troopData.power * troopData.quantity;
    });
    
    // Aplicar penalización si no tiene dragón
    if(!army.hasDragon){
      army.totalPower *= BATTLE_CONFIG.NO_DRAGON_PENALTY;
    } else if(dragon){
      // Bonus de dragón
      army.totalPower += dragon.power || 1000;
    }
    
    // Bonus de defensor
    if(side === 'defender' && this.isDefendingCity){
      army.totalPower *= (BATTLE_CONFIG.DEFENDER_BONUS.WALL * 
                         BATTLE_CONFIG.DEFENDER_BONUS.TOWER * 
                         BATTLE_CONFIG.DEFENDER_BONUS.GENERAL);
    }
    
    return army;
  }
  
  /**
   * Determinar la línea de una tropa
   */
  determineLine(troop){
    if(troop.type === 'dragon') return BATTLE_LINES.DRAGON;
    if(troop.range && troop.range > 0) return BATTLE_LINES.RANGED;
    return BATTLE_LINES.MELEE;
  }
  
  /**
   * Aplicar bonus de investigación
   */
  applyResearchBonus(baseStat, line, research, statType){
    let bonus = 1.0;
    
    if(statType === 'attack'){
      if(line === BATTLE_LINES.RANGED && research.weaponsCalibration){
        bonus += research.weaponsCalibration * 0.05; // +5% por nivel
      }
      if(line === BATTLE_LINES.DRAGON){
        if(research.dragonry) bonus += research.dragonry * 0.06; // +6% por nivel
        if(research.aerialCombat) bonus += research.aerialCombat * 0.04; // +4% por nivel
      }
    }
    
    if(statType === 'defense' && research.masonry){
      bonus += research.masonry * 0.03; // +3% defensa por nivel
    }
    
    return Math.floor(baseStat * bonus);
  }
  
  /**
   * Obtener línea activa (la que recibirá daño)
   */
  getActiveLine(army){
    // Prioridad: Melee > Ranged > Dragon
    if(army.lines.melee.some(id => army.troops[id].quantity > 0)){
      return BATTLE_LINES.MELEE;
    }
    if(army.lines.ranged.some(id => army.troops[id].quantity > 0)){
      return BATTLE_LINES.RANGED;
    }
    if(army.lines.dragon.some(id => army.troops[id].quantity > 0)){
      return BATTLE_LINES.DRAGON;
    }
    return null; // Ejército eliminado
  }
  
  /**
   * Calcular daño de un ejército contra otro
   */
  calculateDamage(attackingArmy, defendingArmy){
    const attackingLine = this.getActiveLine(attackingArmy);
    const defendingLine = this.getActiveLine(defendingArmy);
    
    if(!attackingLine || !defendingLine) return 0;
    
    // Calcular ataque total del atacante
    let totalAttack = 0;
    attackingArmy.lines[attackingLine].forEach(troopId => {
      const troop = attackingArmy.troops[troopId];
      if(troop.quantity > 0){
        totalAttack += troop.attack * troop.quantity;
      }
    });
    
    // Aplicar bonus de counter
    const counterBonus = this.getCounterBonus(attackingLine, defendingLine);
    totalAttack *= counterBonus;
    
    // Calcular defensa total del defensor
    let totalDefense = 0;
    defendingArmy.lines[defendingLine].forEach(troopId => {
      const troop = defendingArmy.troops[troopId];
      if(troop.quantity > 0){
        totalDefense += troop.defense * troop.quantity;
      }
    });
    
    // Bonus de defensor de ciudad
    if(defendingArmy === this.defender && this.isDefendingCity){
      totalDefense *= (BATTLE_CONFIG.DEFENDER_BONUS.WALL * BATTLE_CONFIG.DEFENDER_BONUS.TOWER);
    }
    
    // Daño final
    const damage = Math.max(0, totalAttack - totalDefense);
    
    return {
      damage: damage,
      attackingLine: attackingLine,
      defendingLine: defendingLine,
      counterBonus: counterBonus
    };
  }
  
  /**
   * Obtener bonus de counter
   */
  getCounterBonus(attackingLine, defendingLine){
    if(attackingLine === BATTLE_LINES.MELEE && defendingLine === BATTLE_LINES.RANGED){
      return BATTLE_CONFIG.COUNTER_BONUS.MELEE_VS_RANGED;
    }
    if(attackingLine === BATTLE_LINES.RANGED && defendingLine === BATTLE_LINES.MELEE){
      return BATTLE_CONFIG.COUNTER_BONUS.RANGED_VS_MELEE;
    }
    if(attackingLine === BATTLE_LINES.DRAGON && defendingLine === BATTLE_LINES.RANGED){
      return BATTLE_CONFIG.COUNTER_BONUS.DRAGON_VS_RANGED;
    }
    return 1.0; // Sin bonus
  }
  
  /**
   * Aplicar daño a un ejército
   */
  applyDamage(army, damageInfo){
    const { damage, defendingLine } = damageInfo;
    
    if(damage <= 0) return { killed: 0, wounded: 0 };
    
    // Obtener tropas de la línea activa
    const activeUnits = army.lines[defendingLine]
      .map(id => army.troops[id])
      .filter(troop => troop.quantity > 0);
    
    if(activeUnits.length === 0) return { killed: 0, wounded: 0 };
    
    // Distribuir daño proporcionalmente
    const totalHP = activeUnits.reduce((sum, unit) => sum + (unit.life * unit.quantity), 0);
    
    let remainingDamage = damage;
    let totalKilled = 0;
    let totalWounded = 0;
    
    activeUnits.forEach(unit => {
      if(remainingDamage <= 0) return;
      
      const unitTotalHP = unit.life * unit.quantity;
      const damageShare = unitTotalHP / totalHP;
      const damageToThisUnit = Math.min(remainingDamage * damageShare, unitTotalHP);
      
      const unitsKilled = Math.floor(damageToThisUnit / unit.life);
      
      if(unitsKilled > 0){
        // Sistema de heridos (Medicine)
        const medicineLevel = army.research.medicine || 0;
        const woundedRate = Math.min(0.5, medicineLevel * 0.06); // Máximo 50% heridos
        const wounded = Math.floor(unitsKilled * woundedRate);
        const killed = unitsKilled - wounded;
        
        unit.quantity -= unitsKilled;
        totalKilled += killed;
        totalWounded += wounded;
        
        // Registrar bajas
        if(!army.dead[unit.id]) army.dead[unit.id] = 0;
        if(!army.wounded[unit.id]) army.wounded[unit.id] = 0;
        
        army.dead[unit.id] += killed;
        army.wounded[unit.id] += wounded;
        
        remainingDamage -= damageToThisUnit;
      }
    });
    
    return { killed: totalKilled, wounded: totalWounded };
  }
  
  /**
   * Ejecutar una ronda de combate
   */
  executeRound(){
    this.currentRound++;
    
    const roundData = {
      round: this.currentRound,
      attackerDamage: this.calculateDamage(this.attacker, this.defender),
      defenderDamage: this.calculateDamage(this.defender, this.attacker),
      attackerCasualties: null,
      defenderCasualties: null
    };
    
    // Aplicar daño
    roundData.defenderCasualties = this.applyDamage(this.defender, roundData.attackerDamage);
    roundData.attackerCasualties = this.applyDamage(this.attacker, roundData.defenderDamage);
    
    this.rounds.push(roundData);
    
    return roundData;
  }
  
  /**
   * Verificar si la batalla terminó
   */
  isBattleOver(){
    const attackerHasTroops = Object.values(this.attacker.troops).some(t => t.quantity > 0);
    const defenderHasTroops = Object.values(this.defender.troops).some(t => t.quantity > 0);
    
    return !attackerHasTroops || !defenderHasTroops || this.currentRound >= BATTLE_CONFIG.MAX_ROUNDS;
  }
  
  /**
   * Determinar ganador
   */
  determineWinner(){
    const attackerHasTroops = Object.values(this.attacker.troops).some(t => t.quantity > 0);
    const defenderHasTroops = Object.values(this.defender.troops).some(t => t.quantity > 0);
    
    if(!attackerHasTroops && !defenderHasTroops) return 'draw';
    if(!defenderHasTroops) return 'attacker';
    if(!attackerHasTroops) return 'defender';
    
    // Si llega al máximo de rondas, gana quien tenga más poder restante
    const attackerRemainingPower = Object.values(this.attacker.troops)
      .reduce((sum, t) => sum + (t.quantity * t.power), 0);
    const defenderRemainingPower = Object.values(this.defender.troops)
      .reduce((sum, t) => sum + (t.quantity * t.power), 0);
    
    return attackerRemainingPower > defenderRemainingPower ? 'attacker' : 'defender';
  }
  
  /**
   * Simular batalla completa
   */
  simulate(){
    console.log('⚔️ BATTLE START - Dragons of Atlantis Style');
    console.log('Attacker power:', this.attacker.totalPower);
    console.log('Defender power:', this.defender.totalPower);
    
    // Ejecutar rondas
    while(!this.isBattleOver()){
      const roundData = this.executeRound();
      console.log(`Round ${this.currentRound}: Attacker dealt ${roundData.attackerDamage.damage} damage, Defender dealt ${roundData.defenderDamage.damage} damage`);
    }
    
    // Determinar ganador
    const winner = this.determineWinner();
    
    console.log(`✅ Battle ended after ${this.currentRound} rounds`);
    console.log(`Winner: ${winner}`);
    
    return this.generateResult(winner);
  }
  
  /**
   * Generar resultado final
   */
  generateResult(winner){
    const result = {
      winner: winner,
      rounds: this.currentRound,
      attackerLosses: {
        dead: {},
        wounded: {},
        total: 0
      },
      defenderLosses: {
        dead: {},
        wounded: {},
        total: 0
      },
      remainingTroops: {
        attacker: {},
        defender: {}
      },
      roundDetails: this.rounds
    };
    
    // Calcular pérdidas del atacante
    Object.keys(this.attacker.dead).forEach(troopId => {
      if(this.attacker.dead[troopId] > 0){
        result.attackerLosses.dead[troopId] = {
          name: this.attacker.troops[troopId].name,
          quantity: this.attacker.dead[troopId]
        };
        result.attackerLosses.total += this.attacker.dead[troopId];
      }
    });
    
    Object.keys(this.attacker.wounded).forEach(troopId => {
      if(this.attacker.wounded[troopId] > 0){
        result.attackerLosses.wounded[troopId] = {
          name: this.attacker.troops[troopId].name,
          quantity: this.attacker.wounded[troopId]
        };
      }
    });
    
    // Calcular pérdidas del defensor
    Object.keys(this.defender.dead).forEach(troopId => {
      if(this.defender.dead[troopId] > 0){
        result.defenderLosses.dead[troopId] = {
          name: this.defender.troops[troopId].name,
          quantity: this.defender.dead[troopId]
        };
        result.defenderLosses.total += this.defender.dead[troopId];
      }
    });
    
    Object.keys(this.defender.wounded).forEach(troopId => {
      if(this.defender.wounded[troopId] > 0){
        result.defenderLosses.wounded[troopId] = {
          name: this.defender.troops[troopId].name,
          quantity: this.defender.wounded[troopId]
        };
      }
    });
    
    // Tropas restantes
    Object.keys(this.attacker.troops).forEach(troopId => {
      const troop = this.attacker.troops[troopId];
      if(troop.quantity > 0){
        result.remainingTroops.attacker[troopId] = {
          name: troop.name,
          quantity: troop.quantity
        };
      }
    });
    
    Object.keys(this.defender.troops).forEach(troopId => {
      const troop = this.defender.troops[troopId];
      if(troop.quantity > 0){
        result.remainingTroops.defender[troopId] = {
          name: troop.name,
          quantity: troop.quantity
        };
      }
    });
    
    return result;
  }
}

/**
 * Función principal para simular batalla
 * Integración con el sistema actual del juego
 */
function simulateBattle(playerTroops, targetZone, research = {}, dragon = null){
  // Preparar tropas del jugador
  const attackerArmy = {};
  Object.keys(playerTroops).forEach(troopId => {
    const quantity = playerTroops[troopId];
    if(quantity > 0){
      const troop = Object.values(TROOPS).find(t => t.id === troopId);
      if(troop){
        attackerArmy[troopId] = {
          name: troop.name,
          quantity: quantity,
          meleeAtk: troop.meleeAtk || 10,
          rangeAtk: troop.rangeAtk || 0,
          def: troop.def || 10,
          life: troop.life || 50,
          speed: troop.speed || 100,
          range: troop.range || 0,
          power: troop.power || 50,
          type: troop.type || 'melee'
        };
      }
    }
  });
  
  // Preparar tropas enemigas
  const defenderArmy = {};
  if(targetZone.enemies){
    Object.keys(targetZone.enemies).forEach(enemyKey => {
      const enemy = targetZone.enemies[enemyKey];
      const troopInfo = ANTHROPUS_TROOPS_INFO[enemyKey];
      
      defenderArmy[enemyKey] = {
        name: enemy.name,
        quantity: enemy.quantity,
        meleeAtk: 15,  // Stats base para Anthropus
        rangeAtk: 0,
        def: 12,
        life: 40,
        speed: 90,
        range: 0,
        power: troopInfo ? troopInfo.powerPerUnit : 25,
        type: 'melee'
      };
    });
  }
  
  // Investigaciones del jugador (obtener del juego real si están disponibles)
  const playerResearch = {
    attacker: {
      weaponsCalibration: 0,  // Nivel de investigación
      dragonry: 0,
      aerialCombat: 0,
      medicine: 0,
      masonry: 0
    },
    defender: {} // Los Anthropus no tienen investigaciones
  };
  
  // Crear sistema de batalla
  const battle = new BattleSystem(
    attackerArmy,
    defenderArmy,
    playerResearch,
    dragon,
    false // Los Anthropus no defienden ciudad
  );
  
  // Simular batalla
  const battleResult = battle.simulate();
  
  // Calcular recompensas si ganó el atacante
  if(battleResult.winner === 'attacker'){
    const zoneLevel = targetZone.level;
    battleResult.rewards = {
      wood: Math.floor(zoneLevel * 500 * (1 + Math.random() * 0.5)),
      stone: Math.floor(zoneLevel * 500 * (1 + Math.random() * 0.5)),
      iron: Math.floor(zoneLevel * 300 * (1 + Math.random() * 0.5)),
      food: Math.floor(zoneLevel * 400 * (1 + Math.random() * 0.5)),
      gold: Math.floor(zoneLevel * 50 * (1 + Math.random() * 0.5))
    };
  }
  
  // Convertir al formato esperado por el UI existente
  const result = {
    victory: (battleResult.winner === 'attacker'),
    playerCasualties: {},
    enemyCasualties: {},
    wounded: {},
    rewards: battleResult.rewards || {},
    targetZone: targetZone,
    battleDetails: battleResult,
    playerTroopsSent: attackerArmy  // ✅ AGREGADO: Tropas enviadas por el jugador
  };
  
  // Formatear bajas del jugador
  Object.keys(battleResult.attackerLosses.dead).forEach(troopId => {
    result.playerCasualties[troopId] = battleResult.attackerLosses.dead[troopId];
  });
  
  // Formatear heridos del jugador
  Object.keys(battleResult.attackerLosses.wounded).forEach(troopId => {
    result.wounded[troopId] = battleResult.attackerLosses.wounded[troopId];
  });
  
  // Formatear bajas enemigas
  Object.keys(battleResult.defenderLosses.dead).forEach(troopId => {
    result.enemyCasualties[troopId] = battleResult.defenderLosses.dead[troopId];
  });
  
  return result;
}

// Variable global para almacenar el resultado actual de batalla
let currentBattleResult = null;

// Generar ID único para batalla
function generateBattleId(){
  const chars = '0123456789abcdef';
  let id = '';
  for(let i = 0; i < 32; i++){
    id += chars[Math.floor(Math.random() * chars.length)];
    if(i === 7 || i === 11 || i === 15 || i === 19) id += '-';
  }
  return id;
}

// Mostrar resultado de batalla (NUEVA VERSIÓN COMPLETA)
function showBattleResult(battleResult){
  currentBattleResult = battleResult;
  
  const modal = document.getElementById('battleResultModal');
  if(!modal) return;
  
  // Generar Battle ID
  const battleId = generateBattleId();
  const now = new Date();
  const dateStr = `${now.getFullYear()}/${String(now.getMonth()+1).padStart(2,'0')}/${String(now.getDate()).padStart(2,'0')} - ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`;
  
  // Actualizar info del batalla
  document.getElementById('battleReportId').textContent = battleId;
  document.getElementById('battleReportDate').textContent = dateStr;
  
  const zone = battleResult.targetZone;
  const zoneType = zone.type === 'camp' ? 'Camp' : zone.name;
  document.getElementById('battleReportType').textContent = zoneType;
  document.getElementById('battleReportCoords').textContent = `${zone.coordX},${zone.coordY}`;
  
  // Título Victory/Defeat
  const title = document.getElementById('battleResultTitle');
  if(battleResult.victory){
    title.textContent = 'Victory';
    title.className = 'battle-result-title victory-title';
  } else {
    title.textContent = 'Defeat';
    title.className = 'battle-result-title defeat-title';
  }
  
  // Imagen de batalla
  const battleImage = document.getElementById('battleResultImage');
  const imageContainer = document.querySelector('.battle-result-image-container');
  
  if(battleImage && imageContainer){
    // Hacer visible el contenedor
    imageContainer.style.display = 'block';
    
    // Establecer la imagen
    if(battleResult.victory){
      battleImage.src = 'wilderness_win.png';
      battleImage.alt = 'Victory';
    } else {
      battleImage.src = 'wilderness_lose.png';
      battleImage.alt = 'Defeat';
    }
    
    // Manejar error de carga
    battleImage.onerror = function() {
      console.error('Failed to load battle image:', this.src);
      this.style.minHeight = '250px';
      this.style.display = 'flex';
      this.style.alignItems = 'center';
      this.style.justifyContent = 'center';
      this.style.fontSize = '24px';
      this.style.color = '#d4a574';
      this.alt = battleResult.victory ? '⚔️ VICTORY' : '💀 DEFEAT';
    };
    
    // Manejar carga exitosa
    battleImage.onload = function() {
      console.log('Battle image loaded successfully:', this.src);
    };
  }
  
  // Recompensas (solo si ganó)
  const rewardsSection = document.getElementById('battleResultRewardsSection');
  const rewardsList = document.getElementById('battleResultRewards');
  
  if(battleResult.victory && battleResult.rewards){
    rewardsSection.style.display = 'block';
    let rewardsHTML = '';
    if(battleResult.rewards.wood > 0) {
      rewardsHTML += `<div class="battle-reward-item"><span class="battle-reward-icon">🪵</span><span class="battle-reward-amount">${battleResult.rewards.wood.toLocaleString()}</span></div>`;
    }
    if(battleResult.rewards.stone > 0) {
      rewardsHTML += `<div class="battle-reward-item"><span class="battle-reward-icon">🪨</span><span class="battle-reward-amount">${battleResult.rewards.stone.toLocaleString()}</span></div>`;
    }
    if(battleResult.rewards.iron > 0) {
      rewardsHTML += `<div class="battle-reward-item"><span class="battle-reward-icon">⛓️</span><span class="battle-reward-amount">${battleResult.rewards.iron.toLocaleString()}</span></div>`;
    }
    if(battleResult.rewards.food > 0) {
      rewardsHTML += `<div class="battle-reward-item"><span class="battle-reward-icon">🍞</span><span class="battle-reward-amount">${battleResult.rewards.food.toLocaleString()}</span></div>`;
    }
    if(battleResult.rewards.gold > 0) {
      rewardsHTML += `<div class="battle-reward-item"><span class="battle-reward-icon">🪙</span><span class="battle-reward-amount">${battleResult.rewards.gold.toLocaleString()}</span></div>`;
    }
    rewardsList.innerHTML = rewardsHTML;
  } else {
    rewardsSection.style.display = 'none';
  }
  
  // Tabla de atacante - mostrar TODAS las tropas enviadas
  const attackerBody = document.getElementById('attackerStatsBody');
  let attackerHTML = '';
  let attackerPowerLost = 0;
  
  // Iterar sobre TODAS las tropas enviadas
  if(battleResult.playerTroopsSent){
    Object.keys(battleResult.playerTroopsSent).forEach(troopId => {
      const sentTroop = battleResult.playerTroopsSent[troopId];
      const troop = Object.values(TROOPS).find(t => t.id === troopId);
      if(!troop) return;
      
      const initial = sentTroop.quantity;
      const casualty = battleResult.playerCasualties[troopId];
      const lost = casualty ? casualty.quantity : 0;
      const alive = initial - lost;
      
      attackerPowerLost += lost * (troop.power || 1);
      
      attackerHTML += `
        <tr>
          <td><img src="${troop.img}" class="battle-troop-icon" alt="${troop.name}"></td>
          <td>${initial.toLocaleString()}</td>
          <td>${alive.toLocaleString()}</td>
          <td>${lost.toLocaleString()}</td>
        </tr>
      `;
    });
  }
  
  attackerBody.innerHTML = attackerHTML;
  document.getElementById('attackerName').textContent = playerCity.name || 'Player';
  document.getElementById('attackerPowerLost').textContent = `${attackerPowerLost.toLocaleString()} 🪙`;
  
  // Tabla de defensor - mostrar TODAS las tropas enemigas
  const defenderBody = document.getElementById('defenderStatsBody');
  let defenderHTML = '';
  let defenderPowerLost = 0;
  
  // Usar las tropas enemigas originales
  const enemyTroops = battleResult.targetZone.enemies || {};
  
  Object.keys(enemyTroops).forEach(enemyKey => {
    const enemyInfo = ANTHROPUS_TROOPS_INFO[enemyKey];
    if(!enemyInfo) return;
    
    const initial = enemyTroops[enemyKey].quantity;
    const casualty = battleResult.enemyCasualties[enemyKey];
    const lost = casualty ? casualty.quantity : 0;
    const alive = initial - lost;
    
    defenderPowerLost += lost * (enemyInfo.powerPerUnit || 1);
    
    defenderHTML += `
      <tr>
        <td><img src="${enemyInfo.icon}" class="battle-troop-icon" alt="${enemyInfo.name}"></td>
        <td>${initial.toLocaleString()}</td>
        <td>${alive.toLocaleString()}</td>
        <td>${lost.toLocaleString()}</td>
      </tr>
    `;
  });
  
  defenderBody.innerHTML = defenderHTML;
  
  // Calcular poder total del defensor
  const totalDefenderPower = Object.keys(enemyTroops).reduce((sum, key) => {
    const enemy = ANTHROPUS_TROOPS_INFO[key];
    if(!enemy) return sum;
    return sum + (enemyTroops[key].quantity * (enemy.powerPerUnit || 1));
  }, 0);
  
  // Si ganó el jugador, mostrar todo el poder perdido
  // Si perdió, mostrar solo el poder que perdió el defensor
  if(battleResult.victory){
    document.getElementById('defenderPowerLost').textContent = `-${totalDefenderPower.toLocaleString()} 🪙`;
  } else {
    document.getElementById('defenderPowerLost').textContent = `-${defenderPowerLost.toLocaleString()} 🪙`;
  }
  
  // Generar logs UNA SOLA VEZ y guardarlos en el battleResult
  if(!battleResult.battleLogs){
    battleResult.battleLogs = generateBattleLogs(battleResult);
  }
  
  // Mostrar modal
  modal.classList.remove('hidden');
  
  console.log('📋 Battle result modal opened');
  console.log('Battle ID:', battleId);
}

// Mostrar logs de batalla
function showBattleLogs(){
  if(!currentBattleResult) return;
  
  // Ocultar modal de resultados
  document.getElementById('battleResultModal').classList.add('hidden');
  
  // Mostrar modal de logs
  const logsModal = document.getElementById('battleLogsModal');
  if(!logsModal) return;
  
  // Copiar info básica
  const zone = currentBattleResult.targetZone;
  const zoneType = zone.type === 'camp' ? 'Camp' : zone.name;
  
  document.getElementById('logsReportId').textContent = document.getElementById('battleReportId').textContent;
  document.getElementById('logsReportDate').textContent = document.getElementById('battleReportDate').textContent;
  document.getElementById('logsReportType').textContent = zoneType;
  document.getElementById('logsReportCoords').textContent = `${zone.coordX},${zone.coordY}`;
  
  // Título
  const logsTitle = document.getElementById('logsResultTitle');
  if(currentBattleResult.victory){
    logsTitle.textContent = 'Victory';
    logsTitle.className = 'battle-result-title victory-title';
  } else {
    logsTitle.textContent = 'Defeat';
    logsTitle.className = 'battle-result-title defeat-title';
  }
  
  // Imagen
  const logsImage = document.getElementById('logsResultImage');
  if(currentBattleResult.victory){
    logsImage.src = 'wilderness_win.png';
  } else {
    logsImage.src = 'wilderness_lose.png';
  }
  
  // Recompensas compactas
  const logsRewardsSection = document.getElementById('logsRewardsSection');
  const logsRewards = document.getElementById('logsRewards');
  
  if(currentBattleResult.victory && currentBattleResult.rewards){
    logsRewardsSection.style.display = 'block';
    let rewardsHTML = '';
    const rewards = currentBattleResult.rewards;
    if(rewards.wood > 0) rewardsHTML += `<div class="battle-reward-item">🪵 ${rewards.wood.toLocaleString()}</div>`;
    if(rewards.stone > 0) rewardsHTML += `<div class="battle-reward-item">🪨 ${rewards.stone.toLocaleString()}</div>`;
    if(rewards.iron > 0) rewardsHTML += `<div class="battle-reward-item">⛓️ ${rewards.iron.toLocaleString()}</div>`;
    if(rewards.food > 0) rewardsHTML += `<div class="battle-reward-item">🍞 ${rewards.food.toLocaleString()}</div>`;
    if(rewards.gold > 0) rewardsHTML += `<div class="battle-reward-item">🪙 ${rewards.gold.toLocaleString()}</div>`;
    logsRewards.innerHTML = rewardsHTML;
  } else {
    logsRewardsSection.style.display = 'none';
  }
  
  // Usar logs guardados en lugar de generarlos cada vez
  const logsContent = document.getElementById('battleLogsContent');
  logsContent.innerHTML = currentBattleResult.battleLogs || '';
  
  // Mostrar modal
  logsModal.classList.remove('hidden');
  
  console.log('📜 Battle logs modal opened');
}

// Generar logs de batalla simulados
function generateBattleLogs(battleResult){
  let logs = '';
  
  // Información inicial
  logs += `<div class="battle-log-round">`;
  logs += `<div class="battle-log-round-title">Battlefield size set to 1560</div>`;
  logs += `</div>`;
  
  // Número máximo de rondas basado en el nivel de la zona
  const zoneLevel = battleResult.targetZone.level || 5;
  const maxRounds = Math.min(Math.max(3, zoneLevel), 5); // Entre 3 y 5 rondas máximo
  
  // Preparar datos de tropas
  const playerTroops = battleResult.playerTroopsSent || {};
  const enemyTroops = battleResult.targetZone.enemies || {};
  
  // Variables para tracking
  let playerAlive = {};
  let enemyAlive = {};
  
  // Inicializar cantidades vivas
  Object.keys(playerTroops).forEach(id => {
    playerAlive[id] = playerTroops[id].quantity;
  });
  Object.keys(enemyTroops).forEach(id => {
    enemyAlive[id] = enemyTroops[id].quantity;
  });
  
  // Generar cada ronda
  let round = 1;
  let battleEnded = false;
  
  while(round <= maxRounds && !battleEnded){
    logs += `<div class="battle-log-round">`;
    logs += `<div class="battle-log-round-title">Round #${round}</div>`;
    
    // Fase 1: Posicionamiento (mostrar tropas vivas)
    let playerHasUnits = false;
    Object.keys(playerTroops).forEach(troopId => {
      const troop = Object.values(TROOPS).find(t => t.id === troopId);
      if(!troop || playerAlive[troopId] <= 0) return;
      
      playerHasUnits = true;
      const position = 100 + (round * 100);
      logs += `<div class="battle-log-action">`;
      logs += `<span class="battle-log-attacker">${troop.name}</span> (x${playerAlive[troopId].toLocaleString()}) is battling`;
      logs += `</div>`;
      
      if(round > 1){
        logs += `<div class="battle-log-action">`;
        logs += `<span class="battle-log-attacker">${troop.name}</span> moves ${Math.floor(troop.speed/10)} units to position ${position}`;
        logs += `</div>`;
      }
    });
    
    // Mostrar enemigos también
    let enemyHasUnits = false;
    Object.keys(enemyTroops).forEach(enemyId => {
      const enemy = ANTHROPUS_TROOPS_INFO[enemyId];
      if(!enemy || enemyAlive[enemyId] <= 0) return;
      
      enemyHasUnits = true;
      if(round === 1){
        logs += `<div class="battle-log-action">`;
        logs += `<span class="battle-log-defender">${enemy.name}</span> (x${enemyAlive[enemyId].toLocaleString()}) is defending`;
        logs += `</div>`;
      }
    });
    
    // Fase 2: Ataques del jugador
    Object.keys(playerTroops).forEach(troopId => {
      const troop = Object.values(TROOPS).find(t => t.id === troopId);
      if(!troop || playerAlive[troopId] <= 0) return;
      
      // Elegir enemigo random que esté vivo
      const aliveEnemies = Object.keys(enemyAlive).filter(id => enemyAlive[id] > 0);
      if(aliveEnemies.length === 0) return;
      
      const targetEnemyId = aliveEnemies[Math.floor(Math.random() * aliveEnemies.length)];
      const targetEnemy = ANTHROPUS_TROOPS_INFO[targetEnemyId];
      if(!targetEnemy) return;
      
      const attackType = (playerTroops[troopId].range || 0) > 0 ? 'Range attack' : 'Melee attack';
      const damage = Math.floor((playerTroops[troopId].quantity / maxRounds) * 0.3) + Math.floor(Math.random() * 20);
      const killed = Math.min(damage, enemyAlive[targetEnemyId]);
      enemyAlive[targetEnemyId] -= killed;
      
      if(killed > 0){
        logs += `<div class="battle-log-action">`;
        logs += `<span class="battle-log-attacker">${troop.name}</span> attacks <span class="battle-log-defender">${targetEnemy.name}</span> using <span class="battle-log-damage">${attackType}</span>. `;
        logs += `<span class="battle-log-killed">${killed.toLocaleString()} were killed</span>, ${enemyAlive[targetEnemyId].toLocaleString()} remaining`;
        logs += `</div>`;
      }
    });
    
    // ✅ VERIFICAR SI TODOS LOS ENEMIGOS ESTÁN MUERTOS
    const totalEnemiesAlive = Object.values(enemyAlive).reduce((sum, qty) => sum + qty, 0);
    if(totalEnemiesAlive === 0){
      logs += `<div class="battle-log-action">`;
      logs += `<span style="color: #4ade80;">All enemy forces have been eliminated!</span>`;
      logs += `</div>`;
      logs += `</div>`;
      battleEnded = true;
      break;
    }
    
    // Fase 3: Contraataques de enemigos (solo si quedan vivos)
    Object.keys(enemyTroops).forEach(enemyId => {
      const enemy = ANTHROPUS_TROOPS_INFO[enemyId];
      if(!enemy || enemyAlive[enemyId] <= 0) return;
      
      // Elegir tropa del jugador random que esté viva
      const alivePlayers = Object.keys(playerAlive).filter(id => playerAlive[id] > 0);
      if(alivePlayers.length === 0) return;
      
      const targetPlayerId = alivePlayers[Math.floor(Math.random() * alivePlayers.length)];
      const targetPlayer = Object.values(TROOPS).find(t => t.id === targetPlayerId);
      if(!targetPlayer) return;
      
      const attackType = (enemyTroops[enemyId].range || 0) > 0 ? 'Range attack' : 'Melee attack';
      const damage = Math.floor((enemyTroops[enemyId].quantity / maxRounds) * 0.2) + Math.floor(Math.random() * 15);
      const killed = Math.min(damage, playerAlive[targetPlayerId]);
      playerAlive[targetPlayerId] -= killed;
      
      if(killed > 0){
        logs += `<div class="battle-log-action">`;
        logs += `<span class="battle-log-defender">${enemy.name}</span> attacks <span class="battle-log-attacker">${targetPlayer.name}</span> using <span class="battle-log-damage">${attackType}</span>. `;
        logs += `<span class="battle-log-killed">${killed.toLocaleString()} were killed</span>, ${playerAlive[targetPlayerId].toLocaleString()} remaining`;
        logs += `</div>`;
      }
    });
    
    // ✅ VERIFICAR SI TODAS LAS TROPAS DEL JUGADOR ESTÁN MUERTAS
    const totalPlayerAlive = Object.values(playerAlive).reduce((sum, qty) => sum + qty, 0);
    if(totalPlayerAlive === 0){
      logs += `<div class="battle-log-action">`;
      logs += `<span style="color: #ef4444;">All your forces have been defeated!</span>`;
      logs += `</div>`;
      logs += `</div>`;
      battleEnded = true;
      break;
    }
    
    logs += `</div>`;
    round++;
  }
  
  // Resultado final
  logs += `<div class="battle-log-round">`;
  if(battleResult.victory){
    logs += `<div class="battle-log-round-title" style="color: #4ade80;">⚔️ VICTORY! All enemy forces were defeated.</div>`;
  } else {
    logs += `<div class="battle-log-round-title" style="color: #ef4444;">💀 DEFEAT! Your forces were overwhelmed.</div>`;
    
    // Mostrar cuántos enemigos sobrevivieron
    const survivingEnemies = Object.keys(enemyAlive)
      .filter(id => enemyAlive[id] > 0)
      .map(id => {
        const enemy = ANTHROPUS_TROOPS_INFO[id];
        return `${enemy.name}: ${enemyAlive[id].toLocaleString()}`;
      });
    
    if(survivingEnemies.length > 0){
      logs += `<div class="battle-log-action" style="margin-top: 10px;">`;
      logs += `<span style="color: #ff6b6b;">Surviving enemy forces:</span>`;
      logs += `</div>`;
      survivingEnemies.forEach(line => {
        logs += `<div class="battle-log-action">`;
        logs += `<span class="battle-log-defender">${line}</span>`;
        logs += `</div>`;
      });
    }
  }
  logs += `</div>`;
  
  return logs;
}

// Volver al modal de resultados desde logs
function backToBattleResult(){
  document.getElementById('battleLogsModal').classList.add('hidden');
  document.getElementById('battleResultModal').classList.remove('hidden');
}

// Cerrar modal de logs
function closeBattleLogsModal(){
  document.getElementById('battleLogsModal').classList.add('hidden');
  currentBattleResult = null;
}

// Cerrar modal de resultados
function closeBattleResultModal(){
  const modal = document.getElementById('battleResultModal');
  if(modal){
    modal.classList.add('hidden');
  }
  currentBattleResult = null;
}

// Aplicar resultados de batalla al juego
function applyBattleResults(battleResult){
  // Aplicar bajas del jugador
  Object.keys(battleResult.playerCasualties).forEach(troopId => {
    const casualties = battleResult.playerCasualties[troopId].quantity;
    const troop = Object.values(TROOPS).find(t => t.id === troopId);
    if(troop && casualties > 0){
      troop.have = Math.max(0, (troop.have || 0) - casualties);
      console.log(`💀 Lost ${casualties} ${troop.name} (remaining: ${troop.have})`);
    }
  });
  
  // Recalcular poder del jugador
  recalculatePlayerPower();
  
  // Si ganó, dar recompensas
  if(battleResult.victory && battleResult.rewards){
    wood += battleResult.rewards.wood || 0;
    stone += battleResult.rewards.stone || 0;
    iron += battleResult.rewards.iron || 0;
    food += battleResult.rewards.food || 0;
    gold += battleResult.rewards.gold || 0;
    
    console.log('🎁 Rewards collected:', battleResult.rewards);
    
    // Eliminar la zona del mapa
    const zoneIndex = mapZones.findIndex(z => z.id === battleResult.targetZone.id);
    if(zoneIndex !== -1){
      mapZones.splice(zoneIndex, 1);
      console.log(`🗑️ Zone ${battleResult.targetZone.id} removed from map`);
      
      // Re-renderizar mapa
      renderMapZones();
    }
  }
  
  // Actualizar UI
  updateResourcesUI();
  renderTroopsGrid();
}

// Event listeners para modales de batalla
document.addEventListener('DOMContentLoaded', () => {
  // Modal de selección de tropas
  const troopSelectionClose = document.getElementById('troopSelectionClose');
  const troopSelectionAttackBtn = document.getElementById('troopSelectionAttackBtn');
  const useLastMarchBtn = document.getElementById('useLastMarchBtn');
  
  if(troopSelectionClose){
    troopSelectionClose.addEventListener('click', closeTroopSelectionModal);
  }
  
  if(troopSelectionAttackBtn){
    troopSelectionAttackBtn.addEventListener('click', executeAttack);
  }
  
  if(useLastMarchBtn){
    useLastMarchBtn.addEventListener('click', () => {
      console.log('📋 Use last march clicked');
      alert('Use last march\n\n(Esta funcionalidad se implementará más adelante)');
    });
  }
  
  // Modal de resultados de batalla
  const battleResultClose = document.getElementById('battleResultClose');
  const battleResultOkBtn = document.getElementById('battleResultOkBtn');
  const battleLogsBtn = document.getElementById('battleLogsBtn');
  
  if(battleResultClose){
    battleResultClose.addEventListener('click', closeBattleResultModal);
  }
  
  if(battleResultOkBtn){
    battleResultOkBtn.addEventListener('click', closeBattleResultModal);
  }
  
  if(battleLogsBtn){
    battleLogsBtn.addEventListener('click', showBattleLogs);
  }
  
  // Modal de logs de batalla
  const battleLogsClose = document.getElementById('battleLogsClose');
  const battleLogsBackBtn = document.getElementById('battleLogsBackBtn');
  
  if(battleLogsClose){
    battleLogsClose.addEventListener('click', closeBattleLogsModal);
  }
  
  if(battleLogsBackBtn){
    battleLogsBackBtn.addEventListener('click', backToBattleResult);
  }
});
function setupMapSearch(){
  const searchBtn = document.getElementById("mapSearchBtn");
  const searchInput = document.getElementById("mapSearchInput");
  
  if(!searchBtn || !searchInput) return;
  
  searchBtn.addEventListener("click", ()=> {
    searchCoordinates(searchInput.value);
  });
  
  searchInput.addEventListener("keypress", (e)=> {
    if(e.key === "Enter"){
      searchCoordinates(searchInput.value);
    }
  });
}

function searchCoordinates(input){
  const coords = input.trim().split(":");
  
  if(coords.length !== 2){
    alert("Formato inválido. Usa: X:Y (ej: 150:150)");
    return;
  }
  
  const targetX = parseInt(coords[0]);
  const targetY = parseInt(coords[1]);
  
  if(isNaN(targetX) || isNaN(targetY)){
    alert("Coordenadas inválidas. Deben ser números.");
    return;
  }
  
  console.log(`🔍 Searching for coordinates [${targetX}:${targetY}]`);
  
  // BUSCAR la zona más cercana a las coordenadas
  let closestZone = null;
  let minDistance = Infinity;
  
  mapZones.forEach(zone => {
    const distance = Math.sqrt(
      Math.pow(zone.coordX - targetX, 2) + 
      Math.pow(zone.coordY - targetY, 2)
    );
    
    console.log(`  📍 Zone [${zone.coordX}:${zone.coordY}] ${zone.type === 'fortress' ? '🏰' : ''} distance: ${distance.toFixed(2)}`);
    
    if(distance < minDistance){
      minDistance = distance;
      closestZone = zone;
    }
  });
  
  if(closestZone){
    console.log(`✅ Found closest zone: [${closestZone.coordX}:${closestZone.coordY}] (${closestZone.name} ${closestZone.type === 'fortress' ? '🏰' : ''}) at distance ${minDistance.toFixed(2)}`);
    
    // Mover el mapa para centrar la zona
    moveToZone(closestZone);
    
    // Highlight de la zona
    highlightZone(closestZone.id);
    
    // Mostrar mensaje de confirmación
    const zoneTypeName = closestZone.type === 'fortress' ? 'Fortress' : closestZone.type === 'camp' ? 'Camp' : 'Wilderness';
    setTimeout(() => {
      alert(`📍 Found: ${closestZone.name}\nType: ${zoneTypeName}\nCoordinates: [${closestZone.coordX}:${closestZone.coordY}]\nDistance: ${minDistance.toFixed(1)} units`);
    }, 600);
  } else {
    console.log(`❌ No zones found (mapZones.length = ${mapZones.length})`);
    alert("No se encontraron zonas cerca de esas coordenadas.");
  }
}

function moveToZone(zone){
  if(!mapViewEl || !mapWrapperEl) return;
  
  const viewRect = mapViewEl.getBoundingClientRect();
  const wrapperWidth = viewRect.width * 3;
  const wrapperHeight = viewRect.height * 3;
  
  // Calcular posición en píxeles de la zona
  const zonePxX = (zone.x / 100) * wrapperWidth;
  const zonePxY = (zone.y / 100) * wrapperHeight;
  
  // Centrar en la zona
  mapX = -(zonePxX - viewRect.width / 2);
  mapY = -(zonePxY - viewRect.height / 2);
  
  // Limitar bounds
  const bounds = getMapBounds();
  mapX = Math.max(bounds.minX, Math.min(bounds.maxX, mapX));
  mapY = Math.max(bounds.minY, Math.min(bounds.maxY, mapY));
  
  // Animar el movimiento
  mapWrapperEl.style.transition = "transform 0.5s ease-out";
  updateMapPosition();
  
  setTimeout(()=> {
    mapWrapperEl.style.transition = "none";
  }, 500);
}

function highlightZone(zoneId){
  const zoneEl = document.querySelector(`[data-zone-id="${zoneId}"]`);
  if(!zoneEl) return;
  
  // Efecto de highlight
  zoneEl.style.animation = "zone-pulse 1s ease-in-out 3";
}

// Agregar CSS para la animación (inline)
const style = document.createElement('style');
style.textContent = `
  @keyframes zone-pulse {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.3); filter: brightness(1.5); }
  }
`;
document.head.appendChild(style);

function showMap(){
  // Inicializar si es primera vez
  if(!mapInitialized) initMapSystem();
  
  // Ocultar fieldView
  document.getElementById("fieldView")?.classList.add("hidden");
  
  // Parar escenas de Phaser si están activas
  if(game.scene.isActive("CityScene")) game.scene.stop("CityScene");
  if(game.scene.isActive("FieldScene")) game.scene.stop("FieldScene");
  
  // Mostrar mapView
  mapViewEl?.classList.remove("hidden");
  
  // Renderizar zonas (incluye la fortaleza)
  renderMapZones();
  
  // Centrar el mapa en la fortaleza del jugador
  const fortressZone = mapZones.find(z => z.type === 'fortress');
  if(fortressZone){
    console.log(`🗺️ Map opened - Centering on fortress at [${fortressZone.coordX}:${fortressZone.coordY}]`);
    console.log(`   Fortress position: ${fortressZone.x.toFixed(2)}%, ${fortressZone.y.toFixed(2)}%`);
    
    // Esperar un frame para que el DOM se actualice
    setTimeout(() => {
      moveToZone(fortressZone);
      
      // Highlight la fortaleza después de centrarla
      setTimeout(() => {
        highlightZone(fortressZone.id);
        console.log(`✨ Fortress highlighted!`);
      }, 600);
    }, 50);
  } else {
    console.error(`❌ FORTRESS ZONE NOT FOUND IN mapZones!`);
    console.log(`   mapZones length: ${mapZones.length}`);
    console.log(`   Looking for zone with type='fortress'`);
  }
}

function centerMapOnPlayerCity(){
  // Centrar usando moveToZone
  const fortressZone = mapZones.find(z => z.type === 'fortress');
  if(fortressZone){
    moveToZone(fortressZone);
  }
}

// Hook del botón Map
document.getElementById("btnWorld")?.addEventListener("click", ()=>{
  showMap();
});

// Event listener global para cerrar modales con data-close="modal"
document.addEventListener("click", (e) => {
  const closeBtn = e.target.closest('[data-close="modal"]');
  if(closeBtn){
    const modal = document.getElementById("modal");
    if(modal){
      modal.classList.add("hidden");
    }
  }
});
