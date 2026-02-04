// ============================================================================
// SHRED OR DEAD - A Retro Snowboarding Game
// Inspired by SkiFree with a late 80s/early 90s neon aesthetic
// ============================================================================

// ===================
// CONSTANTS
// ===================

// Base resolution (portrait orientation for snowboarding)
const BASE_WIDTH = 480;
const BASE_HEIGHT = 640;

// ============================================
// PERFORMANCE OPTIMIZATION: GRADIENT CACHE
// ============================================
// Gradients are expensive to create. Cache them and recreate only on canvas resize.
const gradientCache = {
    width: 0,
    height: 0,
    background: null,
    dangerVignette: null,
    fogGradient: null,

    invalidate() {
        this.background = null;
        this.dangerVignette = null;
        this.fogGradient = null;
    },

    needsRefresh(w, h) {
        return this.width !== w || this.height !== h;
    },

    refreshDimensions(w, h) {
        if (this.needsRefresh(w, h)) {
            this.width = w;
            this.height = h;
            this.invalidate();
        }
    }
};

// ============================================
// PERFORMANCE OPTIMIZATION: ANIMATION CACHE
// ============================================
// Pre-calculate common trig values once per frame instead of many times
const animCache = {
    time: 0,
    sin2: 0, sin3: 0, sin4: 0, sin5: 0, sin6: 0, sin8: 0, sin10: 0,
    cos3: 0, cos4: 0, cos5: 0, cos6: 0,

    update(animationTime) {
        this.time = animationTime;
        this.sin2 = Math.sin(animationTime * 2);
        this.sin3 = Math.sin(animationTime * 3);
        this.sin4 = Math.sin(animationTime * 4);
        this.sin5 = Math.sin(animationTime * 5);
        this.sin6 = Math.sin(animationTime * 6);
        this.sin8 = Math.sin(animationTime * 8);
        this.sin10 = Math.sin(animationTime * 10);
        this.cos3 = Math.cos(animationTime * 3);
        this.cos4 = Math.cos(animationTime * 4);
        this.cos5 = Math.cos(animationTime * 5);
        this.cos6 = Math.cos(animationTime * 6);
    }
};

// ============================================
// RESOLUTION SCALING SYSTEM
// Supports portrait, landscape, and handheld gaming devices
// ============================================
const displaySettings = {
    baseWidth: BASE_WIDTH,
    baseHeight: BASE_HEIGHT,
    scale: 1,
    fullscreen: false,
    currentResolution: '480x640',
    autoDetect: true,
    screenShakeEnabled: true,
    hapticsEnabled: true,
    fillScreen: true  // When true, canvas will fill the entire screen in fullscreen mode
};

// Available resolutions with aspect ratio info
// Portrait resolutions for standard play, landscape for handheld gaming devices
const RESOLUTIONS = {
    // Portrait resolutions (3:4) - Traditional mobile/tablet
    '480x640': { width: 480, height: 640, scale: 1, aspectRatio: '3:4', orientation: 'portrait' },
    '600x800': { width: 600, height: 800, scale: 1.25, aspectRatio: '3:4', orientation: 'portrait' },
    '720x960': { width: 720, height: 960, scale: 1.5, aspectRatio: '3:4', orientation: 'portrait' },
    '768x1024': { width: 768, height: 1024, scale: 1.6, aspectRatio: '3:4', orientation: 'portrait' },
    '900x1200': { width: 900, height: 1200, scale: 1.875, aspectRatio: '3:4', orientation: 'portrait' },

    // Portrait mobile (9:16)
    '405x720': { width: 405, height: 720, scale: 1.125, aspectRatio: '9:16', orientation: 'portrait' },
    '608x1080': { width: 608, height: 1080, scale: 1.6875, aspectRatio: '9:16', orientation: 'portrait' },

    // Steam Deck portrait (10:16)
    '500x800': { width: 500, height: 800, scale: 1.25, aspectRatio: '10:16', orientation: 'portrait' },

    // === LANDSCAPE / WIDESCREEN RESOLUTIONS ===
    // For handheld gaming devices (ROG Ally, Steam Deck in landscape)

    // HD Widescreen (16:9) - Great for ROG Ally, desktop
    '854x480': { width: 854, height: 480, scale: 1, aspectRatio: '16:9', orientation: 'landscape' },
    '1280x720': { width: 1280, height: 720, scale: 1.5, aspectRatio: '16:9', orientation: 'landscape' },
    '1920x1080': { width: 1920, height: 1080, scale: 2.25, aspectRatio: '16:9', orientation: 'landscape' },

    // Steam Deck native (16:10)
    '1280x800': { width: 1280, height: 800, scale: 1.67, aspectRatio: '16:10', orientation: 'landscape' },

    // ROG Ally / Ally X native (Full HD)
    '1920x1080-ally': { width: 1920, height: 1080, scale: 2.25, aspectRatio: '16:9', orientation: 'landscape', device: 'ally' }
};

// Dynamic canvas dimensions (will be updated by resolution system)
let CANVAS_WIDTH = BASE_WIDTH;
let CANVAS_HEIGHT = BASE_HEIGHT;

// Derived slope width - adapts to resolution
function getSlopeWidth() {
    const res = RESOLUTIONS[displaySettings.currentResolution];
    if (res && res.orientation === 'landscape') {
        // For landscape, slope is centered with margins
        return Math.min(res.width * 0.6, 720);
    }
    return CANVAS_WIDTH;
}

// Get scale factor for UI elements
function getUIScale() {
    const res = RESOLUTIONS[displaySettings.currentResolution];
    return res ? res.scale : 1;
}

const COLORS = {
    // Neon palette
    cyan: '#00ffff',
    magenta: '#ff00ff',
    hotPink: '#ff1493',
    electricBlue: '#00bfff',
    limeGreen: '#00ff00',
    sunsetOrange: '#ff4500',
    purple: '#9400d3',
    yellow: '#ffff00',
    // Snow/ice
    snow: '#f0f8ff',
    ice: '#b0e0e6',
    powder: '#e6e6fa',
    // Danger
    warning: '#ff6b6b',
    danger: '#ff0000',
    // Background
    bgDark: '#1a0a2e',
    bgMid: '#2d1b4e',
    bgLight: '#4a2c7a'
};

const PHYSICS = {
    gravity: 1200,
    groundFriction: 0.992,      // Less drag
    airFriction: 0.995,
    turnSpeed: 520,             // Fast turning for responsive carving
    maxTurnAngle: 65,
    carveSpeedBoost: 1.10,
    downhillAccel: 280,         // Faster acceleration
    maxSpeed: 650,              // Higher top speed
    minSpeed: 100,
    crashSpeedPenalty: 0.5,
    crashDuration: 0.8,
    stunDuration: 0.25,
    invincibilityDuration: 1.5,
    jumpLaunchPower: 550,       // Much higher jumps
    airControlFactor: 0.6
};

// TERRAIN settings - slopeWidth is dynamically calculated based on resolution
const TERRAIN = {
    chunkHeight: 600,
    laneCount: 7,
    laneWidth: 68,
    slopeWidth: 480,            // Current slope width (updated by resolution system)
    baseSlopeWidth: 480,        // Base slope width (updated dynamically)
    baseDensity: 0.08,          // Fewer obstacles
    maxDensity: 0.18,           // Less cluttered
    densityRampDistance: 4000,
    jumpChance: 0.20,           // Keep jumps plentiful
    railChance: 0.04,           // Reduced - fewer rails
    clearPathWidth: 2
};

// Dynamic terrain properties that adapt to resolution
function getTerrainSlopeWidth() {
    const res = RESOLUTIONS[displaySettings.currentResolution];

    // For dynamic fill-screen mode, use current canvas dimensions
    if (displaySettings.fillScreen && displaySettings.fullscreen) {
        const isLandscape = CANVAS_WIDTH > CANVAS_HEIGHT;
        if (isLandscape) {
            // For landscape, slope fills center portion of screen
            return Math.min(CANVAS_HEIGHT * 0.9, 720);
        }
        // For portrait, slope fills width
        return Math.min(CANVAS_WIDTH, 720);
    }

    if (!res) return TERRAIN.baseSlopeWidth;

    if (res.orientation === 'landscape') {
        // For landscape, slope fills center portion of screen
        // Scale with height to maintain playable area ratio
        return Math.min(res.height * 0.9, 720);
    }
    // For portrait, slope fills width
    return Math.min(res.width, 720);
}

function getTerrainLaneWidth() {
    const slopeWidth = getTerrainSlopeWidth();
    return Math.floor(slopeWidth / TERRAIN.laneCount);
}

// Jump variety system
const JUMP_TYPES = {
    small:  { width: 35, height: 12, power: 0.7, color: 'cyan', glow: false },
    medium: { width: 50, height: 20, power: 1.0, color: 'electricBlue', glow: false },
    large:  { width: 70, height: 28, power: 1.4, color: 'limeGreen', glow: true },
    mega:   { width: 95, height: 38, power: 1.8, color: 'yellow', glow: true }
};

const TRICKS = {
    spin180: { name: '180', minRot: 150, maxRot: 210, points: 100 },
    spin360: { name: '360', minRot: 330, maxRot: 390, points: 250 },
    spin540: { name: '540', minRot: 510, maxRot: 570, points: 500 },
    spin720: { name: '720!', minRot: 690, maxRot: 750, points: 1000 },
    shortGrind: { name: 'Grind', minLen: 0, maxLen: 120, points: 50 },
    longGrind: { name: 'Rail Slide', minLen: 120, maxLen: 250, points: 150 },
    epicGrind: { name: 'EPIC GRIND', minLen: 250, maxLen: 9999, points: 400 }
};

// Automatic trick animations when airborne
const AUTO_TRICKS = [
    { name: '360 Spin', type: 'spin', rotSpeed: 720, points: 200 },
    { name: 'Backflip', type: 'flip', flipSpeed: 500, points: 250 },
    { name: 'Method Grab', type: 'grab', grabStyle: 'method', points: 150 },
    { name: 'Indy Grab', type: 'grab', grabStyle: 'indy', points: 150 },
    { name: 'Tail Grab', type: 'grab', grabStyle: 'tail', points: 125 },
    { name: '540 Spin', type: 'spin', rotSpeed: 900, points: 350 },
    { name: 'Front Flip', type: 'flip', flipSpeed: -500, points: 250 },
    { name: 'Stalefish', type: 'grab', grabStyle: 'stale', points: 175 },
    { name: 'Cork 720', type: 'combo', rotSpeed: 600, flipSpeed: 300, points: 500 }
];

const CHASE = {
    fogStartOffset: -300,       // Starts closer
    fogBaseSpeed: 150,          // Faster
    fogAcceleration: 1.2,       // Ramps faster
    beastSpawnDistance: 500,    // Spawns at ~4-5 seconds!
    beastSpeed: 1.4,            // 40% faster than player!
    beastLungeInterval: 2.0,    // More frequent lunges
    beastLungeVariance: 1.0,    // Randomness
    beastLungeDuration: 0.35,
    beastRetreatDuration: 0.6,  // Much shorter retreat
    // Crash/slow triggers
    crashThreshold: 3,          // 3 crashes = instant beast
    crashWindow: 10,            // Within 10 seconds
    slowSpeedThreshold: 120,    // Below this = danger
    slowSpeedDuration: 2.0      // 2 seconds slow = beast
};

// ===================
// SPRITE SYSTEM
// ===================

const SPRITE_CONFIG = {
    snowboarder: {
        src: 'assets/sprites/snowboarder-spritesheet.svg',
        frameWidth: 64,
        frameHeight: 64,
        columns: 6,
        rows: 4,
        animations: {
            idle: { row: 0, frames: [0], frameTime: 100 },
            carveLeft1: { row: 0, frames: [1], frameTime: 100 },
            carveLeft2: { row: 0, frames: [2], frameTime: 100 },
            carveLeft3: { row: 0, frames: [3], frameTime: 100 },
            carveLeft4: { row: 0, frames: [4], frameTime: 100 },
            carveLeft5: { row: 0, frames: [5], frameTime: 100 },
            carveRight1: { row: 1, frames: [0], frameTime: 100 },
            carveRight2: { row: 1, frames: [1], frameTime: 100 },
            carveRight3: { row: 1, frames: [2], frameTime: 100 },
            carveRight4: { row: 1, frames: [3], frameTime: 100 },
            carveRight5: { row: 1, frames: [4], frameTime: 100 },
            tuck: { row: 1, frames: [5], frameTime: 100 },
            airborne: { row: 2, frames: [0, 1, 2], frameTime: 150 },
            spin: { row: 2, frames: [3], frameTime: 100 },
            grab: { row: 2, frames: [4], frameTime: 100 },
            land: { row: 2, frames: [5], frameTime: 100 },
            crash: { row: 3, frames: [0, 1, 2, 3, 4], frameTime: 120 },
            dazed: { row: 3, frames: [5], frameTime: 200 }
        }
    },
    yeti: {
        src: 'assets/sprites/yeti-spritesheet.svg',
        frameWidth: 128,
        frameHeight: 128,
        columns: 4,
        rows: 3,
        animations: {
            chase: { row: 0, frames: [0, 1, 2, 3, 2, 1], frameTime: 120 },
            lunge: { row: 1, frames: [0, 1, 2], frameTime: 100 },
            recover: { row: 1, frames: [3], frameTime: 150 },
            rageLow: { row: 2, frames: [0], frameTime: 100 },
            rageMedium: { row: 2, frames: [1], frameTime: 100 },
            rageHigh: { row: 2, frames: [2], frameTime: 100 },
            rageMax: { row: 2, frames: [3], frameTime: 80 }
        }
    }
};

// Sprite state
const sprites = {
    sheets: {},
    player: null,
    beast: null,
    loaded: false
};

class SpriteSheet {
    constructor(config) {
        this.config = config;
        this.image = null;
        this.loaded = false;
    }

    load() {
        return new Promise((resolve, reject) => {
            this.image = new Image();
            this.image.onload = () => {
                this.loaded = true;
                resolve(this);
            };
            this.image.onerror = () => {
                console.warn(`Failed to load sprite: ${this.config.src}`);
                resolve(this); // Resolve anyway to allow fallback
            };
            this.image.src = this.config.src;
        });
    }

    getFrame(row, col) {
        return {
            x: col * this.config.frameWidth,
            y: row * this.config.frameHeight,
            width: this.config.frameWidth,
            height: this.config.frameHeight
        };
    }
}

class AnimatedSprite {
    constructor(sheet) {
        this.sheet = sheet;
        this.currentAnim = 'idle';
        this.frameIndex = 0;
        this.frameTimer = 0;
    }

    setAnimation(name) {
        if (this.currentAnim !== name && this.sheet.config.animations[name]) {
            this.currentAnim = name;
            this.frameIndex = 0;
            this.frameTimer = 0;
        }
    }

    update(dt) {
        const anim = this.sheet.config.animations[this.currentAnim];
        if (!anim || anim.frames.length <= 1) return;

        this.frameTimer += dt * 1000;
        if (this.frameTimer >= anim.frameTime) {
            this.frameTimer = 0;
            this.frameIndex = (this.frameIndex + 1) % anim.frames.length;
        }
    }

    draw(ctx, x, y, scale = 1, rotation = 0, flipX = false) {
        if (!this.sheet.loaded || !this.sheet.image) return false;

        const anim = this.sheet.config.animations[this.currentAnim];
        if (!anim) return false;

        const frameNum = anim.frames[this.frameIndex % anim.frames.length];
        const frame = this.sheet.getFrame(anim.row, frameNum);

        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(rotation);
        ctx.scale(flipX ? -scale : scale, scale);

        ctx.drawImage(
            this.sheet.image,
            frame.x, frame.y, frame.width, frame.height,
            -frame.width / 2, -frame.height / 2, frame.width, frame.height
        );

        ctx.restore();
        return true;
    }
}

async function loadSprites() {
    const snowboarderSheet = new SpriteSheet(SPRITE_CONFIG.snowboarder);
    const yetiSheet = new SpriteSheet(SPRITE_CONFIG.yeti);

    await Promise.all([snowboarderSheet.load(), yetiSheet.load()]);

    sprites.sheets.snowboarder = snowboarderSheet;
    sprites.sheets.yeti = yetiSheet;

    if (snowboarderSheet.loaded) {
        sprites.player = new AnimatedSprite(snowboarderSheet);
    }
    if (yetiSheet.loaded) {
        sprites.beast = new AnimatedSprite(yetiSheet);
    }

    sprites.loaded = snowboarderSheet.loaded && yetiSheet.loaded;
    console.log('Sprites loaded:', sprites.loaded);
}

// ===================
// GAME STATE
// ===================

let canvas, ctx;
let lastTime = 0;

let gameState = {
    screen: 'title', // 'title', 'playing', 'gameOver'
    animationTime: 0,

    player: {
        x: 0,
        y: 0,
        visualX: 0,
        visualY: 0,
        speed: 150,
        lateralSpeed: 0,
        angle: 0,
        airborne: false,
        altitude: 0,
        verticalVelocity: 0,
        airTime: 0,
        grinding: false,
        grindProgress: 0,
        currentRail: null,
        crashed: false,
        crashTimer: 0,
        stunned: 0,
        invincible: 0,
        trickRotation: 0,
        // Auto trick state
        autoTrick: null,
        autoTrickProgress: 0,
        flipRotation: 0,
        grabPhase: 0
    },

    camera: {
        y: 0,
        targetY: 0,
        lookAhead: 150
    },

    terrain: {
        chunks: [],
        nextChunkY: 0,
        seed: 0
    },

    obstacles: [],
    jumps: [],
    rails: [],

    chase: {
        fogY: 0,
        fogSpeed: CHASE.fogBaseSpeed,
        beastActive: false,
        beastY: 0,
        beastX: 0,
        beastState: 'chasing',
        beastLungeTimer: 0,
        lungeTargetX: 0,
        lungeTargetY: 0,
        lungeProgress: 0,
        retreatTimer: 0,
        distanceTraveled: 0,
        // Crash/slow tracking
        recentCrashes: [],      // Timestamps of crashes
        slowSpeedTimer: 0,      // Time spent going slow
        beastRage: 0            // Increases aggression (0-1)
    },

    score: 0,
    distance: 0,
    trickScore: 0,
    trickMultiplier: 1,
    trickComboTimer: 0,
    maxCombo: 1,

    particles: [],
    celebrations: [],
    screenShake: { x: 0, y: 0, intensity: 0, decay: 0.9 },

    dangerLevel: 0,
    deathCause: null,
    highScore: 0
};

// ===================
// INPUT HANDLING
// ===================

const input = {
    left: false,
    right: false,
    down: false,
    space: false,
    _lastSpace: false
};

function setupInput() {
    document.addEventListener('keydown', (e) => {
        switch (e.code) {
            case 'ArrowLeft':
            case 'KeyA':
                input.left = true;
                break;
            case 'ArrowRight':
            case 'KeyD':
                input.right = true;
                break;
            case 'ArrowDown':
            case 'KeyS':
                input.down = true;
                break;
            case 'Space':
                input.space = true;
                break;
        }
    });

    document.addEventListener('keyup', (e) => {
        switch (e.code) {
            case 'ArrowLeft':
            case 'KeyA':
                input.left = false;
                break;
            case 'ArrowRight':
            case 'KeyD':
                input.right = false;
                break;
            case 'ArrowDown':
            case 'KeyS':
                input.down = false;
                break;
            case 'Space':
                input.space = false;
                break;
        }
    });
}

function getInputDirection() {
    let dir = 0;
    if (input.left) dir -= 1;
    if (input.right) dir += 1;
    return dir;
}

// ===================
// UTILITY FUNCTIONS
// ===================

function seededRandom(seed) {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
}

function lerp(a, b, t) {
    return a + (b - a) * t;
}

function clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
}

function randomRange(min, max) {
    return min + Math.random() * (max - min);
}

function getNeonColor() {
    const colors = [COLORS.cyan, COLORS.magenta, COLORS.hotPink, COLORS.electricBlue, COLORS.limeGreen, COLORS.yellow];
    return colors[Math.floor(Math.random() * colors.length)];
}

// ===================
// PARTICLE SYSTEM
// ===================

const ParticlePool = {
    pool: [],
    maxSize: 200,

    get() {
        if (this.pool.length > 0) return this.pool.pop();
        return { x: 0, y: 0, vx: 0, vy: 0, size: 0, color: '', alpha: 1, lifetime: 0, age: 0, type: 'snow' };
    },

    release(p) {
        if (this.pool.length < this.maxSize) this.pool.push(p);
    },

    spawn(x, y, vx, vy, size, color, lifetime, type = 'snow') {
        const p = this.get();
        p.x = x; p.y = y; p.vx = vx; p.vy = vy;
        p.size = size; p.color = color; p.alpha = 1;
        p.lifetime = lifetime; p.age = 0; p.type = type;
        return p;
    }
};

function spawnSnowSpray(x, y, direction) {
    for (let i = 0; i < 4; i++) {
        gameState.particles.push(ParticlePool.spawn(
            x + direction * 15,
            y,
            direction * (80 + Math.random() * 80),
            -40 - Math.random() * 40,
            2 + Math.random() * 2,
            COLORS.snow,
            0.4 + Math.random() * 0.2
        ));
    }
}

function spawnGrindSparks(x, y) {
    for (let i = 0; i < 2; i++) {
        gameState.particles.push(ParticlePool.spawn(
            x + (Math.random() - 0.5) * 15,
            y,
            (Math.random() - 0.5) * 150,
            -80 - Math.random() * 80,
            1 + Math.random() * 2,
            getNeonColor(),
            0.25 + Math.random() * 0.15,
            'spark'
        ));
    }
}

function spawnCrashParticles(x, y) {
    for (let i = 0; i < 15; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 100 + Math.random() * 150;
        gameState.particles.push(ParticlePool.spawn(
            x, y,
            Math.cos(angle) * speed,
            Math.sin(angle) * speed - 100,
            3 + Math.random() * 4,
            COLORS.snow,
            0.6 + Math.random() * 0.4
        ));
    }
}

function spawnLandingParticles(x, y) {
    for (let i = 0; i < 8; i++) {
        const angle = Math.PI + (Math.random() - 0.5) * Math.PI;
        const speed = 50 + Math.random() * 80;
        gameState.particles.push(ParticlePool.spawn(
            x, y,
            Math.cos(angle) * speed,
            Math.sin(angle) * speed,
            2 + Math.random() * 2,
            COLORS.powder,
            0.3 + Math.random() * 0.2
        ));
    }
}

function updateParticles(dt) {
    for (let i = gameState.particles.length - 1; i >= 0; i--) {
        const p = gameState.particles[i];
        p.age += dt;

        if (p.age >= p.lifetime) {
            ParticlePool.release(p);
            gameState.particles.splice(i, 1);
            continue;
        }

        p.x += p.vx * dt;
        p.y += p.vy * dt;

        if (p.type === 'snow') {
            p.vy += 300 * dt;
            p.alpha = 1 - (p.age / p.lifetime);
        } else if (p.type === 'spark') {
            p.vy += 500 * dt;
            p.alpha = 1 - Math.pow(p.age / p.lifetime, 2);
            p.size *= 0.96;
        }
    }
}

// ===================
// TERRAIN GENERATION
// ===================

function generateTerrainChunk(chunkIndex) {
    const chunk = {
        y: chunkIndex * TERRAIN.chunkHeight,
        obstacles: [],
        jumps: [],
        rails: []
    };

    const distance = chunk.y / 100;
    const density = Math.min(
        TERRAIN.baseDensity + (distance / TERRAIN.densityRampDistance) * (TERRAIN.maxDensity - TERRAIN.baseDensity),
        TERRAIN.maxDensity
    );

    const baseSeed = gameState.terrain.seed + chunkIndex * 1000;

    const gridRows = Math.floor(TERRAIN.chunkHeight / 80);
    const gridCols = TERRAIN.laneCount;

    // Track cells used by clusters to avoid overlaps
    const usedCells = new Set();

    // 25% chance to spawn a tree cluster per chunk (harder to navigate around)
    if (seededRandom(baseSeed + 777) < 0.25) {
        const clusterSeed = baseSeed + 778;
        const clusterRow = 1 + Math.floor(seededRandom(clusterSeed) * (gridRows - 3));
        const clusterCol = 1 + Math.floor(seededRandom(clusterSeed + 1) * (gridCols - 2));
        const clusterSize = 4 + Math.floor(seededRandom(clusterSeed + 2) * 4); // 4-7 trees

        // Generate cluster pattern (tight group of trees)
        for (let i = 0; i < clusterSize; i++) {
            const offsetX = (seededRandom(clusterSeed + 10 + i) - 0.5) * 2.5; // -1.25 to 1.25 lanes
            const offsetY = (seededRandom(clusterSeed + 20 + i) - 0.5) * 2; // -1 to 1 rows
            const treeCol = clusterCol + offsetX;
            const treeRow = clusterRow + offsetY;

            // Bounds check
            if (treeCol < 0.5 || treeCol > gridCols - 0.5) continue;
            if (treeRow < 0 || treeRow >= gridRows) continue;

            const cellKey = `${Math.floor(treeRow)},${Math.floor(treeCol)}`;
            usedCells.add(cellKey);

            chunk.obstacles.push({
                x: (treeCol - gridCols / 2) * TERRAIN.laneWidth,
                y: chunk.y + treeRow * 80 + seededRandom(clusterSeed + 30 + i) * 20,
                type: 'tree',
                width: 26, // Slightly larger cluster trees
                height: 44,
                isCluster: true
            });
        }
    }

    // Second cluster chance (20%) for even more challenging terrain
    if (seededRandom(baseSeed + 888) < 0.20) {
        const clusterSeed = baseSeed + 889;
        const clusterRow = Math.floor(gridRows / 2) + Math.floor(seededRandom(clusterSeed) * (gridRows / 2 - 1));
        const clusterCol = Math.floor(seededRandom(clusterSeed + 1) * (gridCols - 1));
        const clusterSize = 3 + Math.floor(seededRandom(clusterSeed + 2) * 3); // 3-5 trees

        for (let i = 0; i < clusterSize; i++) {
            const offsetX = (seededRandom(clusterSeed + 50 + i) - 0.5) * 2;
            const offsetY = (seededRandom(clusterSeed + 60 + i) - 0.5) * 1.5;
            const treeCol = clusterCol + offsetX;
            const treeRow = clusterRow + offsetY;

            if (treeCol < 0.5 || treeCol > gridCols - 0.5) continue;
            if (treeRow < 0 || treeRow >= gridRows) continue;

            const cellKey = `${Math.floor(treeRow)},${Math.floor(treeCol)}`;
            if (usedCells.has(cellKey)) continue;
            usedCells.add(cellKey);

            chunk.obstacles.push({
                x: (treeCol - gridCols / 2) * TERRAIN.laneWidth,
                y: chunk.y + treeRow * 80 + seededRandom(clusterSeed + 70 + i) * 20,
                type: 'tree',
                width: 24,
                height: 40,
                isCluster: true
            });
        }
    }

    for (let row = 0; row < gridRows; row++) {
        const rowSeed = baseSeed + row * 100;
        const clearLane = Math.floor(seededRandom(rowSeed) * gridCols);

        for (let col = 0; col < gridCols; col++) {
            if (Math.abs(col - clearLane) < TERRAIN.clearPathWidth) continue;

            // Skip cells used by clusters
            const cellKey = `${row},${col}`;
            if (usedCells.has(cellKey)) continue;

            const cellSeed = rowSeed + col;
            const rng = seededRandom(cellSeed);

            if (rng < density) {
                const types = ['tree', 'tree', 'rock'];
                if (distance > 800) types.push('rock', 'mogul');
                if (distance > 2000) types.push('mogul');

                const typeIndex = Math.floor(seededRandom(cellSeed + 0.5) * types.length);
                const obstacleType = types[typeIndex];

                chunk.obstacles.push({
                    x: (col - gridCols / 2 + 0.5) * TERRAIN.laneWidth,
                    y: chunk.y + row * 80 + seededRandom(cellSeed + 0.3) * 30,
                    type: obstacleType,
                    width: obstacleType === 'tree' ? 24 : obstacleType === 'rock' ? 32 : 40,
                    height: obstacleType === 'tree' ? 40 : obstacleType === 'rock' ? 24 : 16
                });
            } else if (rng < density + TERRAIN.jumpChance) {
                // Select jump type based on weighted random
                const typeRng = seededRandom(cellSeed + 0.6);
                let jumpType;
                if (typeRng < 0.40) jumpType = JUMP_TYPES.small;
                else if (typeRng < 0.75) jumpType = JUMP_TYPES.medium;
                else if (typeRng < 0.95) jumpType = JUMP_TYPES.large;
                else jumpType = JUMP_TYPES.mega;

                chunk.jumps.push({
                    x: (col - gridCols / 2 + 0.5) * TERRAIN.laneWidth,
                    y: chunk.y + row * 80,
                    width: jumpType.width,
                    height: jumpType.height,
                    launchPower: jumpType.power,
                    color: jumpType.color,
                    glow: jumpType.glow,
                    type: jumpType === JUMP_TYPES.mega ? 'mega' : jumpType === JUMP_TYPES.large ? 'large' : 'normal'
                });
            } else if (rng < density + TERRAIN.jumpChance + TERRAIN.railChance) {
                const railLength = 100 + seededRandom(cellSeed + 0.8) * 150;
                const endCol = col + (seededRandom(cellSeed + 0.9) - 0.5) * 2;
                const newRail = {
                    x: (col - gridCols / 2 + 0.5) * TERRAIN.laneWidth,
                    y: chunk.y + row * 80,
                    endX: (clamp(endCol, 0, gridCols - 1) - gridCols / 2 + 0.5) * TERRAIN.laneWidth,
                    endY: chunk.y + row * 80 + railLength,
                    length: railLength
                };

                // Check for collision with existing rails
                let collides = false;
                const minDistX = 50;  // Minimum horizontal distance between rails
                const minDistY = 120; // Minimum vertical distance between rail starts

                for (const existingRail of chunk.rails) {
                    // Check if rails are too close horizontally
                    const xDist = Math.abs(newRail.x - existingRail.x);
                    // Check if Y ranges overlap
                    const newTop = newRail.y;
                    const newBottom = newRail.endY;
                    const existTop = existingRail.y;
                    const existBottom = existingRail.endY;

                    const yOverlap = !(newBottom < existTop - minDistY || newTop > existBottom + minDistY);

                    if (xDist < minDistX && yOverlap) {
                        collides = true;
                        break;
                    }
                }

                if (!collides) {
                    chunk.rails.push(newRail);
                }
            }
        }
    }

    // 15% chance per chunk to spawn a jump sequence (2-4 consecutive jumps for combos)
    if (seededRandom(baseSeed + 999) < 0.15) {
        const seqLane = Math.floor(seededRandom(baseSeed + 998) * (gridCols - 2)) + 1;
        const seqStart = chunk.y + 100 + seededRandom(baseSeed + 997) * 200;
        const seqCount = 2 + Math.floor(seededRandom(baseSeed + 996) * 3); // 2-4 jumps

        for (let i = 0; i < seqCount; i++) {
            const seqJumpType = i === seqCount - 1 ? JUMP_TYPES.large : JUMP_TYPES.medium;
            chunk.jumps.push({
                x: (seqLane - gridCols / 2 + 0.5) * TERRAIN.laneWidth + (seededRandom(baseSeed + 990 + i) - 0.5) * 30,
                y: seqStart + i * 80,
                width: seqJumpType.width,
                height: seqJumpType.height,
                launchPower: seqJumpType.power,
                color: seqJumpType.color,
                glow: seqJumpType.glow,
                type: i === seqCount - 1 ? 'large' : 'normal'
            });
        }
    }

    return chunk;
}

function updateTerrain() {
    const camera = gameState.camera;
    const terrain = gameState.terrain;

    while (terrain.nextChunkY < camera.y + CANVAS_HEIGHT * 2.5) {
        const chunkIndex = Math.floor(terrain.nextChunkY / TERRAIN.chunkHeight);
        const newChunk = generateTerrainChunk(chunkIndex);
        terrain.chunks.push(newChunk);

        gameState.obstacles.push(...newChunk.obstacles);
        gameState.jumps.push(...newChunk.jumps);
        gameState.rails.push(...newChunk.rails);

        terrain.nextChunkY += TERRAIN.chunkHeight;
    }

    const cullY = camera.y - CANVAS_HEIGHT;
    terrain.chunks = terrain.chunks.filter(c => c.y + TERRAIN.chunkHeight > cullY);
    gameState.obstacles = gameState.obstacles.filter(o => o.y > cullY);
    gameState.jumps = gameState.jumps.filter(j => j.y > cullY);
    gameState.rails = gameState.rails.filter(r => r.endY > cullY);
}

// ===================
// PLAYER PHYSICS
// ===================

function updatePlayer(dt) {
    const player = gameState.player;

    // Update invincibility
    if (player.invincible > 0) {
        player.invincible -= dt;
    }

    // Handle crash state
    if (player.crashed) {
        player.crashTimer -= dt;
        player.y += player.speed * 0.2 * dt;

        if (player.crashTimer <= 0) {
            player.crashed = false;
            player.stunned = PHYSICS.stunDuration;
        }
        updateVisualPosition(player, dt);
        return;
    }

    // Handle stun state
    if (player.stunned > 0) {
        player.stunned -= dt;
        player.y += player.speed * 0.4 * dt;

        if (player.stunned <= 0) {
            player.invincible = PHYSICS.invincibilityDuration;
        }
        updateVisualPosition(player, dt);
        return;
    }

    // Airborne physics
    if (player.airborne) {
        updateAirbornePhysics(player, dt);
        return;
    }

    // Grinding physics
    if (player.grinding) {
        updateGrindingPhysics(player, dt);
        return;
    }

    // Ground physics
    updateGroundPhysics(player, dt);
}

function updateGroundPhysics(player, dt) {
    const inputDir = getInputDirection();

    // Turn input affects board angle
    const targetAngle = inputDir * PHYSICS.maxTurnAngle;
    const angleDiff = targetAngle - player.angle;
    player.angle += Math.sign(angleDiff) * Math.min(Math.abs(angleDiff), PHYSICS.turnSpeed * dt);

    // Speed based on carving vs straight
    const carving = Math.abs(player.angle) > 20;
    const speedMod = carving ? PHYSICS.carveSpeedBoost : 1.0;

    // Tuck for extra speed
    if (input.down) {
        player.speed += PHYSICS.downhillAccel * 1.5 * dt;
    } else {
        player.speed += PHYSICS.downhillAccel * speedMod * dt;
    }

    player.speed = Math.min(player.speed, PHYSICS.maxSpeed);
    player.speed *= PHYSICS.groundFriction;

    // Lateral movement from turning - full force for snappy carving
    const lateralForce = Math.sin(player.angle * Math.PI / 180) * player.speed;
    player.lateralSpeed = lateralForce * 1.0;

    // Apply movement
    player.y += player.speed * dt;
    player.x += player.lateralSpeed * dt;

    // Clamp to slope bounds
    const halfWidth = TERRAIN.slopeWidth / 2 - 20;
    player.x = clamp(player.x, -halfWidth, halfWidth);

    // Update distance
    gameState.chase.distanceTraveled += player.speed * dt / 100;
    gameState.distance = Math.floor(gameState.chase.distanceTraveled);

    // Spawn snow spray when carving fast
    if (carving && player.speed > 250 && Math.random() < 0.3) {
        spawnSnowSpray(player.x, player.y, Math.sign(player.angle));
    }

    updateVisualPosition(player, dt);
}

function updateAirbornePhysics(player, dt) {
    const inputDir = getInputDirection();

    player.airTime += dt;

    // Air control (reduced)
    player.lateralSpeed += inputDir * 150 * PHYSICS.airControlFactor * dt;
    player.lateralSpeed *= PHYSICS.airFriction;

    // Manual trick rotation (if no auto trick or player overriding)
    if (inputDir !== 0 && !player.autoTrick) {
        player.trickRotation += inputDir * 400 * dt;
    }

    // Auto trick animation
    if (player.autoTrick) {
        const trick = player.autoTrick;
        player.autoTrickProgress += dt * 1.5; // Complete trick over ~0.67 seconds

        if (trick.type === 'spin' || trick.type === 'combo') {
            // Spin tricks - rotate around Y axis (shown as 2D rotation)
            player.trickRotation += trick.rotSpeed * dt;
        }
        if (trick.type === 'flip' || trick.type === 'combo') {
            // Flip tricks - rotate around X axis (forward/back flip)
            player.flipRotation += (trick.flipSpeed || 0) * dt;
        }
        if (trick.type === 'grab') {
            // Grab tricks - oscillate grab phase
            player.grabPhase = Math.sin(player.autoTrickProgress * Math.PI);
        }
    }

    // Gravity
    player.verticalVelocity -= PHYSICS.gravity * dt;

    // Movement
    player.y += player.speed * dt;
    player.x += player.lateralSpeed * dt;
    player.altitude += player.verticalVelocity * dt;

    // Clamp X
    const halfWidth = TERRAIN.slopeWidth / 2 - 20;
    player.x = clamp(player.x, -halfWidth, halfWidth);

    // Update distance
    gameState.chase.distanceTraveled += player.speed * dt / 100;
    gameState.distance = Math.floor(gameState.chase.distanceTraveled);

    // Land
    if (player.altitude <= 0) {
        landFromJump(player);
    }

    updateVisualPosition(player, dt);
}

function updateGrindingPhysics(player, dt) {
    const rail = player.currentRail;

    const grindSpeed = player.speed * 0.85;
    player.grindProgress += (grindSpeed * dt) / rail.length;

    player.x = lerp(rail.x, rail.endX, player.grindProgress);
    player.y = lerp(rail.y, rail.endY, player.grindProgress);

    // Update distance
    gameState.chase.distanceTraveled += grindSpeed * dt / 100;
    gameState.distance = Math.floor(gameState.chase.distanceTraveled);

    // Sparks
    if (Math.random() < 0.4) {
        spawnGrindSparks(player.x, player.y);
    }

    // End grind
    if (player.grindProgress >= 1.0) {
        endGrind(player);
    }

    updateVisualPosition(player, dt);
}

function updateVisualPosition(player, dt) {
    const lerpSpeed = 15;
    player.visualX = lerp(player.visualX, player.x, lerpSpeed * dt);
    player.visualY = lerp(player.visualY, player.y, lerpSpeed * dt);
}

function triggerJump(player, jump) {
    player.airborne = true;
    player.altitude = 1;
    player.verticalVelocity = PHYSICS.jumpLaunchPower * jump.launchPower * (player.speed / 400);
    player.trickRotation = 0;
    player.airTime = 0;

    // Auto-select a random trick for bigger jumps
    if (jump.launchPower >= 1.0) {
        const trickIndex = Math.floor(Math.random() * AUTO_TRICKS.length);
        player.autoTrick = AUTO_TRICKS[trickIndex];
        player.autoTrickProgress = 0;
        player.flipRotation = 0;
        player.grabPhase = 0;
    } else {
        player.autoTrick = null;
    }
}

function landFromJump(player) {
    player.airborne = false;
    player.altitude = 0;
    player.verticalVelocity = 0;

    // Check for completed auto trick first
    let trickLanded = null;
    let trickName = null;
    let trickPoints = 0;

    if (player.autoTrick && player.autoTrickProgress >= 0.8) {
        // Auto trick completed successfully!
        trickName = player.autoTrick.name;
        trickPoints = player.autoTrick.points;
        trickLanded = true;
    } else {
        // Fall back to manual spin detection
        const absRot = Math.abs(player.trickRotation);
        for (const [id, trick] of Object.entries(TRICKS)) {
            if (trick.minRot && absRot >= trick.minRot && absRot <= trick.maxRot) {
                trickName = trick.name;
                trickPoints = trick.points;
                trickLanded = true;
                break;
            }
        }
    }

    if (trickLanded) {
        const points = Math.floor(trickPoints * gameState.trickMultiplier);
        gameState.score += points;

        gameState.celebrations.push({
            text: trickName,
            subtext: `+${points}`,
            color: getNeonColor(),
            timer: 1.5,
            scale: 1.0 + (gameState.trickMultiplier - 1) * 0.15
        });

        gameState.trickMultiplier = Math.min(gameState.trickMultiplier + 0.5, 5);
        gameState.trickComboTimer = 2.0;
        gameState.maxCombo = Math.max(gameState.maxCombo, gameState.trickMultiplier);
    } else if (player.airTime > 0.4) {
        const airPoints = Math.floor(player.airTime * 25);
        gameState.score += airPoints;
    }

    player.trickRotation = 0;
    player.airTime = 0;
    player.autoTrick = null;
    player.autoTrickProgress = 0;
    player.flipRotation = 0;
    player.grabPhase = 0;

    spawnLandingParticles(player.x, player.y);
}

function startGrinding(player, rail) {
    player.grinding = true;
    player.currentRail = rail;
    player.grindProgress = 0;
    player.x = rail.x;
    player.y = rail.y;
}

function endGrind(player) {
    const rail = player.currentRail;
    const grindLength = rail.length * player.grindProgress;

    let trick = TRICKS.shortGrind;
    for (const [id, t] of Object.entries(TRICKS)) {
        if (t.minLen !== undefined && grindLength >= t.minLen && grindLength < t.maxLen) {
            trick = t;
        }
    }

    const points = Math.floor(trick.points * gameState.trickMultiplier);
    gameState.score += points;

    gameState.celebrations.push({
        text: trick.name,
        subtext: `+${points}`,
        color: COLORS.cyan,
        timer: 1.2,
        scale: 1.0
    });

    gameState.trickMultiplier = Math.min(gameState.trickMultiplier + 0.3, 5);
    gameState.trickComboTimer = 2.0;

    player.grinding = false;
    player.currentRail = null;
}

function triggerCrash(player) {
    if (player.invincible > 0) return;

    player.crashed = true;
    player.crashTimer = PHYSICS.crashDuration;
    player.speed *= PHYSICS.crashSpeedPenalty;

    spawnCrashParticles(player.x, player.y);
    triggerScreenShake(12, 0.85);

    // Reset combo
    gameState.trickMultiplier = 1;
    gameState.trickComboTimer = 0;

    // Track crash for beast trigger
    const now = gameState.animationTime;
    gameState.chase.recentCrashes.push(now);

    // Remove old crashes outside the window
    gameState.chase.recentCrashes = gameState.chase.recentCrashes.filter(
        t => now - t < CHASE.crashWindow
    );

    // If too many crashes, spawn beast immediately!
    if (gameState.chase.recentCrashes.length >= CHASE.crashThreshold && !gameState.chase.beastActive) {
        spawnBeast('TOO MANY WIPEOUTS!');
    }
}

// ===================
// COLLISION DETECTION
// ===================

function checkCollisions() {
    const player = gameState.player;

    if (player.crashed || player.stunned > 0 || player.airborne || player.invincible > 0) return;

    // Check obstacles
    for (const obs of gameState.obstacles) {
        if (Math.abs(obs.y - player.y) > 60) continue;
        if (Math.abs(obs.x - player.x) > 40) continue;

        // Simple AABB collision
        const px = player.x, py = player.y;
        const pw = 20, ph = 20;

        if (px - pw/2 < obs.x + obs.width/2 &&
            px + pw/2 > obs.x - obs.width/2 &&
            py - ph/2 < obs.y + obs.height/2 &&
            py + ph/2 > obs.y - obs.height/2) {
            triggerCrash(player);
            return;
        }
    }

    // Check jumps
    if (!player.grinding) {
        for (const jump of gameState.jumps) {
            if (Math.abs(jump.y - player.y) > 30) continue;
            if (Math.abs(jump.x - player.x) > 35) continue;

            if (player.y > jump.y - 10 && player.y < jump.y + 20) {
                triggerJump(player, jump);
                return;
            }
        }
    }

    // Check rails
    if (!player.grinding) {
        for (const rail of gameState.rails) {
            if (Math.abs(rail.y - player.y) > 20) continue;
            if (Math.abs(rail.x - player.x) > 25) continue;

            startGrinding(player, rail);
            return;
        }
    }
}

// ===================
// CHASE MECHANICS
// ===================

function updateChase(dt) {
    const chase = gameState.chase;
    const player = gameState.player;

    // Fog accelerates over time
    chase.fogSpeed += CHASE.fogAcceleration * dt;

    // Fog catches up if player is slow
    const speedDiff = chase.fogSpeed - player.speed;
    if (speedDiff > 0) {
        chase.fogY += speedDiff * dt;
    }

    // Fog always advances slowly
    chase.fogY += chase.fogSpeed * 0.15 * dt;

    // Check if fog caught player
    if (chase.fogY >= player.y - 30) {
        triggerGameOver('fog');
        return;
    }

    // Calculate danger level
    const fogDistance = player.y - chase.fogY;
    gameState.dangerLevel = clamp(1 - fogDistance / 400, 0, 1);

    // Track slow speed - spawn beast if going too slow for too long
    if (!player.crashed && !player.stunned && player.speed < CHASE.slowSpeedThreshold) {
        chase.slowSpeedTimer += dt;
        if (chase.slowSpeedTimer >= CHASE.slowSpeedDuration && !chase.beastActive) {
            spawnBeast('GO FASTER!');
        }
    } else {
        chase.slowSpeedTimer = Math.max(0, chase.slowSpeedTimer - dt * 2); // Recover faster
    }

    // Spawn beast based on distance
    if (!chase.beastActive && chase.distanceTraveled >= CHASE.beastSpawnDistance) {
        spawnBeast();
    }

    // Update beast
    if (chase.beastActive) {
        updateBeast(dt);
    }
}

function spawnBeast(customMessage = null) {
    const chase = gameState.chase;

    chase.beastActive = true;
    chase.beastY = chase.fogY + 50;
    chase.beastX = 0;
    chase.beastState = 'chasing';
    chase.beastLungeTimer = 2;
    chase.beastRage = 0;

    const message = customMessage || 'THE BEAST AWAKENS';
    gameState.celebrations.push({
        text: message,
        subtext: '',
        color: COLORS.magenta,
        timer: 2.5,
        scale: 1.4
    });

    triggerScreenShake(18, 0.7);
}

function updateBeast(dt) {
    const chase = gameState.chase;
    const player = gameState.player;

    // Increase rage over time (makes beast more aggressive)
    chase.beastRage = Math.min(1, chase.beastRage + dt * 0.02);
    const rageMod = 1 + chase.beastRage * 0.5; // Up to 50% faster/more aggressive

    switch (chase.beastState) {
        case 'chasing':
            // Track player X - faster tracking with rage
            const trackSpeed = (2.5 + chase.beastRage * 2) * dt;
            chase.beastX += (player.x - chase.beastX) * trackSpeed;

            // Stay ahead of fog
            chase.beastY = Math.max(chase.beastY, chase.fogY + 60);

            // Chase player - faster with rage
            const beastSpeed = player.speed * CHASE.beastSpeed * rageMod;
            chase.beastY += beastSpeed * dt;

            // Lunge check - more frequent with rage
            chase.beastLungeTimer -= dt * rageMod;
            const distToPlayer = player.y - chase.beastY;

            if (chase.beastLungeTimer <= 0 && distToPlayer < 280 && distToPlayer > 40) {
                chase.beastState = 'lunging';
                // Predict player position for smarter lunges
                const predictTime = 0.3;
                chase.lungeTargetX = player.x + player.lateralSpeed * predictTime * chase.beastRage;
                chase.lungeTargetY = player.y + player.speed * predictTime * 0.5;
                chase.lungeProgress = 0;
                triggerScreenShake(10, 0.8);
            }
            break;

        case 'lunging':
            chase.lungeProgress += dt / CHASE.beastLungeDuration;

            const t = Math.min(chase.lungeProgress, 1);
            const easeT = t * t * (3 - 2 * t);

            const startX = chase.beastX;
            const startY = chase.beastY - (chase.lungeTargetY - chase.beastY) * chase.lungeProgress;

            chase.beastX = lerp(startX, chase.lungeTargetX, easeT * 0.8);
            chase.beastY = lerp(chase.beastY, chase.lungeTargetY, easeT);

            // Check catch - slightly larger catch radius with rage
            const catchRadius = 35 + chase.beastRage * 10;
            const catchDist = Math.sqrt(
                Math.pow(player.x - chase.beastX, 2) +
                Math.pow(player.y - chase.beastY, 2)
            );
            if (catchDist < catchRadius && player.invincible <= 0 && !player.crashed && player.stunned <= 0) {
                triggerGameOver('beast');
                return;
            }

            if (chase.lungeProgress >= 1) {
                chase.beastState = 'retreating';
                chase.retreatTimer = CHASE.beastRetreatDuration;
            }
            break;

        case 'retreating':
            chase.retreatTimer -= dt;
            chase.beastY -= 60 * dt; // Retreats less

            if (chase.retreatTimer <= 0) {
                chase.beastState = 'chasing';
                // Less variance, more consistent pressure with rage
                const variance = CHASE.beastLungeVariance * (1 - chase.beastRage * 0.5);
                chase.beastLungeTimer = CHASE.beastLungeInterval + Math.random() * variance;
            }
            break;
    }
}

// ===================
// SCREEN EFFECTS
// ===================

function triggerScreenShake(intensity, decay) {
    gameState.screenShake.intensity = intensity;
    gameState.screenShake.decay = decay;
}

function updateScreenShake(dt) {
    const shake = gameState.screenShake;
    if (shake.intensity > 0) {
        shake.x = (Math.random() - 0.5) * shake.intensity * 2;
        shake.y = (Math.random() - 0.5) * shake.intensity * 2;
        shake.intensity *= shake.decay;
        if (shake.intensity < 0.5) {
            shake.intensity = 0;
            shake.x = 0;
            shake.y = 0;
        }
    }
}

function updateCelebrations(dt) {
    for (let i = gameState.celebrations.length - 1; i >= 0; i--) {
        gameState.celebrations[i].timer -= dt;
        if (gameState.celebrations[i].timer <= 0) {
            gameState.celebrations.splice(i, 1);
        }
    }
}

function updateCombo(dt) {
    if (gameState.trickComboTimer > 0) {
        gameState.trickComboTimer -= dt;
        if (gameState.trickComboTimer <= 0) {
            gameState.trickMultiplier = 1;
        }
    }
}

// ===================
// CAMERA
// ===================

function updateCamera(dt) {
    const camera = gameState.camera;
    const player = gameState.player;

    const lookAhead = (player.speed / PHYSICS.maxSpeed) * camera.lookAhead;
    camera.targetY = player.y + lookAhead - CANVAS_HEIGHT * 0.35;

    camera.y = lerp(camera.y, camera.targetY, 8 * dt);
}

function worldToScreen(worldX, worldY) {
    const shake = gameState.screenShake;
    return {
        x: CANVAS_WIDTH / 2 + worldX + shake.x,
        y: worldY - gameState.camera.y + shake.y
    };
}

// ===================
// DRAWING
// ===================

function draw() {
    // Update animation cache at start of frame for performance
    animCache.update(gameState.animationTime);

    // Refresh gradient cache if needed
    gradientCache.refreshDimensions(CANVAS_WIDTH, CANVAS_HEIGHT);

    ctx.fillStyle = COLORS.bgDark;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Title screen is now handled by HTML overlay
    if (gameState.screen === 'title') {
        return;
    }

    if (gameState.screen === 'gameOver') {
        drawGameOverScreen();
        return;
    }

    // Draw background gradient
    drawBackground();

    // Draw terrain
    drawTerrain();

    // Draw rails
    drawRails();

    // Draw jumps
    drawJumps();

    // Draw obstacles
    drawObstacles();

    // Draw fog wall
    drawFogWall();

    // Draw beast
    if (gameState.chase.beastActive) {
        drawBeast();
    }

    // Draw player
    drawPlayer();

    // Draw particles
    drawParticles();

    // Draw celebrations
    drawCelebrations();

    // Draw HUD
    drawHUD();

    // Draw danger vignette
    if (gameState.dangerLevel > 0.2) {
        drawDangerVignette();
    }

    // Draw speed lines
    if (gameState.player.speed > 400) {
        drawSpeedLines();
    }
}

function drawBackground() {
    // Use cached gradient for performance
    if (!gradientCache.background) {
        gradientCache.background = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
        gradientCache.background.addColorStop(0, COLORS.bgDark);
        gradientCache.background.addColorStop(0.5, COLORS.bgMid);
        gradientCache.background.addColorStop(1, COLORS.bgLight);
    }
    ctx.fillStyle = gradientCache.background;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Draw side margins for landscape mode (mountain scenery)
    const res = RESOLUTIONS[displaySettings.currentResolution];
    if (res && res.orientation === 'landscape') {
        const slopeWidth = getTerrainSlopeWidth();
        const marginWidth = (CANVAS_WIDTH - slopeWidth) / 2;

        if (marginWidth > 10) {
            // Left mountain margin
            ctx.fillStyle = 'rgba(10, 5, 20, 0.7)';
            ctx.fillRect(0, 0, marginWidth - 5, CANVAS_HEIGHT);

            // Right mountain margin
            ctx.fillRect(CANVAS_WIDTH - marginWidth + 5, 0, marginWidth - 5, CANVAS_HEIGHT);

            // Mountain silhouette effect on sides
            const mountainGrad = ctx.createLinearGradient(0, 0, marginWidth, 0);
            mountainGrad.addColorStop(0, 'rgba(20, 10, 40, 0.9)');
            mountainGrad.addColorStop(0.7, 'rgba(30, 15, 60, 0.6)');
            mountainGrad.addColorStop(1, 'transparent');
            ctx.fillStyle = mountainGrad;
            ctx.fillRect(0, 0, marginWidth, CANVAS_HEIGHT);

            const mountainGradR = ctx.createLinearGradient(CANVAS_WIDTH, 0, CANVAS_WIDTH - marginWidth, 0);
            mountainGradR.addColorStop(0, 'rgba(20, 10, 40, 0.9)');
            mountainGradR.addColorStop(0.7, 'rgba(30, 15, 60, 0.6)');
            mountainGradR.addColorStop(1, 'transparent');
            ctx.fillStyle = mountainGradR;
            ctx.fillRect(CANVAS_WIDTH - marginWidth, 0, marginWidth, CANVAS_HEIGHT);
        }
    }

    // Snow texture lines (parallax)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    const scrollOffset = (gameState.camera.y * 0.3) % 40;
    for (let y = -scrollOffset; y < CANVAS_HEIGHT + 40; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(CANVAS_WIDTH, y + 20);
        ctx.stroke();
    }
}

function drawTerrain() {
    // Draw slope edge markers
    ctx.strokeStyle = COLORS.cyan;
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 10]);

    const leftEdge = CANVAS_WIDTH / 2 - TERRAIN.slopeWidth / 2;
    const rightEdge = CANVAS_WIDTH / 2 + TERRAIN.slopeWidth / 2;

    ctx.beginPath();
    ctx.moveTo(leftEdge, 0);
    ctx.lineTo(leftEdge, CANVAS_HEIGHT);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(rightEdge, 0);
    ctx.lineTo(rightEdge, CANVAS_HEIGHT);
    ctx.stroke();

    ctx.setLineDash([]);
}

function drawObstacles() {
    const camera = gameState.camera;
    const time = gameState.animationTime;

    for (const obs of gameState.obstacles) {
        if (obs.y < camera.y - 50 || obs.y > camera.y + CANVAS_HEIGHT + 50) continue;

        const screen = worldToScreen(obs.x, obs.y);

        // Shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.beginPath();
        ctx.ellipse(screen.x + 3, screen.y + obs.height * 0.5, obs.width * 0.45, 8, 0, 0, Math.PI * 2);
        ctx.fill();

        if (obs.type === 'tree') {
            // Tree trunk with gradient and texture
            const trunkGrad = ctx.createLinearGradient(screen.x - 5, screen.y, screen.x + 5, screen.y);
            trunkGrad.addColorStop(0, '#3a2718');
            trunkGrad.addColorStop(0.5, '#5a4738');
            trunkGrad.addColorStop(1, '#3a2718');
            ctx.fillStyle = trunkGrad;
            ctx.fillRect(screen.x - 5, screen.y - 12, 10, 22);

            // Trunk texture lines
            ctx.strokeStyle = '#2a1a0a';
            ctx.lineWidth = 1;
            for (let i = 0; i < 3; i++) {
                ctx.beginPath();
                ctx.moveTo(screen.x - 3 + i * 3, screen.y - 10);
                ctx.lineTo(screen.x - 3 + i * 3, screen.y + 8);
                ctx.stroke();
            }

            // Multi-layer foliage for depth
            const layers = [
                { y: -5, w: obs.width * 0.9, color: '#0a2a1a' },
                { y: -15, w: obs.width * 0.75, color: '#1a3a2a' },
                { y: -25, w: obs.width * 0.55, color: '#1a472a' },
                { y: obs.height * -0.85, w: obs.width * 0.35, color: '#2a5a3a' }
            ];

            for (const layer of layers) {
                ctx.fillStyle = layer.color;
                ctx.beginPath();
                ctx.moveTo(screen.x, screen.y + layer.y - 12);
                ctx.lineTo(screen.x - layer.w/2, screen.y + layer.y);
                ctx.lineTo(screen.x + layer.w/2, screen.y + layer.y);
                ctx.closePath();
                ctx.fill();
            }

            // Snow accumulation with highlights
            ctx.fillStyle = COLORS.snow;
            ctx.beginPath();
            ctx.moveTo(screen.x, screen.y - obs.height + 3);
            ctx.lineTo(screen.x - obs.width/4, screen.y - obs.height * 0.7);
            ctx.quadraticCurveTo(screen.x, screen.y - obs.height * 0.65, screen.x + obs.width/4, screen.y - obs.height * 0.7);
            ctx.closePath();
            ctx.fill();

            // Snow highlight
            ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
            ctx.beginPath();
            ctx.ellipse(screen.x - 3, screen.y - obs.height + 8, 4, 2, -0.3, 0, Math.PI * 2);
            ctx.fill();

        } else if (obs.type === 'rock') {
            // Irregular curved rock shape with radial gradient
            const rockGrad = ctx.createRadialGradient(
                screen.x - obs.width/4, screen.y - obs.height/2 - 5,
                2,
                screen.x, screen.y - obs.height/3,
                obs.width/1.5
            );
            rockGrad.addColorStop(0, '#8a8a9e');
            rockGrad.addColorStop(0.4, '#6a6a7e');
            rockGrad.addColorStop(1, '#3a3a4e');

            ctx.fillStyle = rockGrad;
            ctx.beginPath();
            // Irregular rock shape
            ctx.moveTo(screen.x - obs.width/2, screen.y);
            ctx.quadraticCurveTo(screen.x - obs.width/2 - 5, screen.y - obs.height/2, screen.x - obs.width/4, screen.y - obs.height);
            ctx.quadraticCurveTo(screen.x, screen.y - obs.height - 5, screen.x + obs.width/4, screen.y - obs.height);
            ctx.quadraticCurveTo(screen.x + obs.width/2 + 5, screen.y - obs.height/2, screen.x + obs.width/2, screen.y);
            ctx.closePath();
            ctx.fill();

            // Rock highlight
            ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
            ctx.beginPath();
            ctx.ellipse(screen.x - 6, screen.y - obs.height/2 - 4, obs.width/5, obs.height/5, -0.3, 0, Math.PI * 2);
            ctx.fill();

            // Snow patches on rock
            ctx.fillStyle = COLORS.snow;
            ctx.beginPath();
            ctx.ellipse(screen.x - 2, screen.y - obs.height + 3, 8, 4, 0, 0, Math.PI * 2);
            ctx.fill();

        } else if (obs.type === 'mogul') {
            // Ice mogul with shimmer effect
            const mogulGrad = ctx.createRadialGradient(
                screen.x - 5, screen.y - obs.height/2 - 3,
                2,
                screen.x, screen.y - obs.height/3,
                obs.width/1.5
            );
            mogulGrad.addColorStop(0, '#e0f0ff');
            mogulGrad.addColorStop(0.3, COLORS.ice);
            mogulGrad.addColorStop(1, '#90c0d6');

            ctx.fillStyle = mogulGrad;
            ctx.beginPath();
            ctx.ellipse(screen.x, screen.y - obs.height/3, obs.width/2, obs.height/2, 0, 0, Math.PI * 2);
            ctx.fill();

            // Ice shimmer effect
            const shimmer = Math.sin(time * 3 + obs.x * 0.1) * 0.3 + 0.5;
            ctx.fillStyle = `rgba(255, 255, 255, ${shimmer})`;
            ctx.beginPath();
            ctx.ellipse(screen.x - 8, screen.y - obs.height/2, 6, 3, -0.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.ellipse(screen.x + 5, screen.y - obs.height/3, 4, 2, 0.3, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}

function drawJumps() {
    const camera = gameState.camera;
    const time = gameState.animationTime;

    for (const jump of gameState.jumps) {
        if (jump.y < camera.y - 50 || jump.y > camera.y + CANVAS_HEIGHT + 50) continue;

        const screen = worldToScreen(jump.x, jump.y);
        const jumpColor = COLORS[jump.color] || COLORS.electricBlue;

        // Shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
        ctx.beginPath();
        ctx.ellipse(screen.x, screen.y + 5, jump.width * 0.4, 6, 0, 0, Math.PI * 2);
        ctx.fill();

        // Pulsing glow for large/mega jumps
        if (jump.glow) {
            const glowPulse = 0.4 + Math.sin(time * 4 + jump.x) * 0.2;
            const glowGrad = ctx.createRadialGradient(screen.x, screen.y - jump.height/2, 5, screen.x, screen.y, jump.width);
            glowGrad.addColorStop(0, `rgba(${jumpColor === COLORS.yellow ? '255,255,0' : '0,255,0'}, ${glowPulse})`);
            glowGrad.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = glowGrad;
            ctx.beginPath();
            ctx.arc(screen.x, screen.y - jump.height/2, jump.width * 0.8, 0, Math.PI * 2);
            ctx.fill();
        }

        // Multi-point ramp shape (more interesting than simple triangle)
        const rampGrad = ctx.createLinearGradient(screen.x - jump.width/2, screen.y, screen.x + jump.width/2, screen.y - jump.height);
        rampGrad.addColorStop(0, jumpColor);
        rampGrad.addColorStop(0.5, '#ffffff');
        rampGrad.addColorStop(1, jumpColor);

        ctx.fillStyle = rampGrad;
        ctx.beginPath();
        ctx.moveTo(screen.x - jump.width/2, screen.y);
        ctx.lineTo(screen.x - jump.width/4, screen.y - jump.height * 0.3);
        ctx.lineTo(screen.x, screen.y - jump.height);
        ctx.lineTo(screen.x + jump.width/4, screen.y - jump.height * 0.3);
        ctx.lineTo(screen.x + jump.width/2, screen.y);
        ctx.closePath();
        ctx.fill();

        // Snow cap on top
        ctx.fillStyle = COLORS.snow;
        ctx.beginPath();
        ctx.moveTo(screen.x - jump.width/6, screen.y - jump.height * 0.7);
        ctx.lineTo(screen.x, screen.y - jump.height + 2);
        ctx.lineTo(screen.x + jump.width/6, screen.y - jump.height * 0.7);
        ctx.closePath();
        ctx.fill();

        // Neon edge with stronger glow for bigger jumps
        ctx.strokeStyle = jumpColor;
        ctx.lineWidth = jump.glow ? 3 : 2;
        ctx.shadowColor = jumpColor;
        ctx.shadowBlur = jump.glow ? 15 : 8;
        ctx.beginPath();
        ctx.moveTo(screen.x - jump.width/2, screen.y);
        ctx.lineTo(screen.x, screen.y - jump.height);
        ctx.lineTo(screen.x + jump.width/2, screen.y);
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Size indicator for mega jumps
        if (jump.type === 'mega') {
            ctx.font = 'bold 10px "Press Start 2P", monospace';
            ctx.textAlign = 'center';
            ctx.fillStyle = COLORS.yellow;
            ctx.shadowColor = COLORS.yellow;
            ctx.shadowBlur = 8;
            ctx.fillText('MEGA', screen.x, screen.y - jump.height - 10);
            ctx.shadowBlur = 0;
        }
    }
}

function drawRails() {
    const camera = gameState.camera;

    ctx.strokeStyle = COLORS.magenta;
    ctx.lineWidth = 4;
    ctx.shadowColor = COLORS.magenta;
    ctx.shadowBlur = 10;

    for (const rail of gameState.rails) {
        if (rail.endY < camera.y - 50 || rail.y > camera.y + CANVAS_HEIGHT + 50) continue;

        const startScreen = worldToScreen(rail.x, rail.y);
        const endScreen = worldToScreen(rail.endX, rail.endY);

        ctx.beginPath();
        ctx.moveTo(startScreen.x, startScreen.y);
        ctx.lineTo(endScreen.x, endScreen.y);
        ctx.stroke();

        // End caps
        ctx.fillStyle = COLORS.magenta;
        ctx.beginPath();
        ctx.arc(startScreen.x, startScreen.y, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(endScreen.x, endScreen.y, 5, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.shadowBlur = 0;
}

function drawPlayer() {
    const player = gameState.player;
    const screen = worldToScreen(player.visualX, player.visualY);

    // Adjust Y for altitude when airborne
    let drawY = screen.y;
    let shadowOffset = 0;
    if (player.airborne) {
        drawY -= player.altitude * 0.5;
        shadowOffset = player.altitude * 0.3;
    }

    // Speed trails when going fast
    if (player.speed > 500 && !player.crashed) {
        const trailAlpha = (player.speed - 500) / 350 * 0.4;
        ctx.save();
        ctx.globalAlpha = trailAlpha;
        for (let i = 1; i <= 3; i++) {
            const trailY = screen.y + i * 15;
            ctx.fillStyle = COLORS.cyan;
            ctx.beginPath();
            ctx.ellipse(screen.x, trailY, 8 - i * 2, 4, 0, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    }

    // Try sprite-based rendering first
    if (sprites.player && sprites.player.sheet.loaded) {
        // Determine animation based on player state
        if (player.crashed) {
            if (player.crashTimer < 0.3) {
                sprites.player.setAnimation('crash');
            } else {
                sprites.player.setAnimation('dazed');
            }
        } else if (player.airborne) {
            const trick = player.autoTrick;
            if (trick) {
                if (trick.type === 'spin' || trick.type === 'combo') {
                    sprites.player.setAnimation('spin');
                } else if (trick.type === 'grab') {
                    sprites.player.setAnimation('grab');
                } else {
                    sprites.player.setAnimation('airborne');
                }
            } else {
                sprites.player.setAnimation('airborne');
            }
        } else if (input.down && player.speed > 300) {
            sprites.player.setAnimation('tuck');
        } else if (player.angle < -5) {
            // Left carve - select frame based on angle intensity
            const intensity = Math.min(5, Math.floor(Math.abs(player.angle) / 13) + 1);
            sprites.player.setAnimation('carveLeft' + intensity);
        } else if (player.angle > 5) {
            // Right carve - select frame based on angle intensity
            const intensity = Math.min(5, Math.floor(Math.abs(player.angle) / 13) + 1);
            sprites.player.setAnimation('carveRight' + intensity);
        } else {
            sprites.player.setAnimation('idle');
        }

        // Calculate rotation
        let rotation = 0;
        if (player.airborne) {
            rotation = player.trickRotation * Math.PI / 180;
        }

        // Calculate scale (invincibility flash)
        let alpha = 1;
        if (player.invincible > 0 && Math.floor(gameState.animationTime * 10) % 2 === 0) {
            alpha = 0.5;
        }

        // Draw shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
        ctx.beginPath();
        ctx.ellipse(screen.x, screen.y + 15 + shadowOffset, 18 - shadowOffset * 0.05, 6, 0, 0, Math.PI * 2);
        ctx.fill();

        // Draw sprite
        ctx.globalAlpha = alpha;
        const drawn = sprites.player.draw(ctx, screen.x, drawY, 1, rotation, false);
        ctx.globalAlpha = 1;

        if (drawn) return; // Success, skip procedural drawing
    }

    // Fallback to procedural drawing
    ctx.save();
    ctx.translate(screen.x, drawY);

    // Apply rotation for tricks
    if (player.airborne) {
        ctx.rotate(player.trickRotation * Math.PI / 180);
        // Apply flip rotation (scale Y to simulate forward/backward flip)
        if (player.flipRotation !== 0) {
            const flipScale = Math.cos(player.flipRotation * Math.PI / 180);
            ctx.scale(1, flipScale);
        }
    } else {
        ctx.rotate(player.angle * Math.PI / 180 * 0.3);
    }

    // Invincibility flash
    if (player.invincible > 0 && Math.floor(gameState.animationTime * 10) % 2 === 0) {
        ctx.globalAlpha = 0.5;
    }

    // Crashed state
    if (player.crashed) {
        ctx.rotate(Math.sin(gameState.animationTime * 15) * 0.5);
    }

    // Shadow (moves down when airborne)
    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.beginPath();
    ctx.ellipse(0, 15 + shadowOffset, 18 - shadowOffset * 0.05, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    // Determine grab offset for board (moves toward body during grabs)
    const grabOffset = player.grabPhase * 6;
    const boardY = 8 - grabOffset;

    // Snowboard with gradient and edge highlights
    const boardGrad = ctx.createLinearGradient(-20, boardY, 20, boardY + 6);
    boardGrad.addColorStop(0, COLORS.hotPink);
    boardGrad.addColorStop(0.5, '#ff69b4');
    boardGrad.addColorStop(1, COLORS.magenta);
    ctx.fillStyle = boardGrad;
    ctx.shadowColor = COLORS.hotPink;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.roundRect(-22, boardY, 44, 6, 3);
    ctx.fill();

    // Board edge highlight
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-20, boardY + 1);
    ctx.lineTo(20, boardY + 1);
    ctx.stroke();

    // Bindings
    ctx.fillStyle = '#333';
    ctx.fillRect(-10, boardY - 1, 6, 8);
    ctx.fillRect(4, boardY - 1, 6, 8);
    ctx.shadowBlur = 0;

    // Body/jacket with gradient and stripe
    const jacketGrad = ctx.createLinearGradient(-12, -20, 12, 10);
    jacketGrad.addColorStop(0, COLORS.cyan);
    jacketGrad.addColorStop(0.5, COLORS.electricBlue);
    jacketGrad.addColorStop(1, '#0099cc');
    ctx.fillStyle = jacketGrad;
    ctx.shadowColor = COLORS.cyan;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.ellipse(0, -5, 12, 16, 0, 0, Math.PI * 2);
    ctx.fill();

    // Magenta stripe on jacket
    ctx.fillStyle = COLORS.magenta;
    ctx.fillRect(-12, -8, 24, 4);

    // Arms - different poses for different tricks
    let leftArmX = -18, leftArmY = -12;
    let rightArmX = 18, rightArmY = -12;

    if (player.autoTrick && player.airborne) {
        const trick = player.autoTrick;
        const progress = player.autoTrickProgress;

        if (trick.grabStyle === 'method') {
            // Method grab - one arm up, one reaching for board
            leftArmX = -15; leftArmY = -25; // Up in air
            rightArmX = 8; rightArmY = boardY - 5; // Grabbing board
        } else if (trick.grabStyle === 'indy') {
            // Indy grab - reach between legs for board
            rightArmX = 5; rightArmY = boardY;
            leftArmX = -20; leftArmY = -8;
        } else if (trick.grabStyle === 'tail') {
            // Tail grab - reach back for tail
            rightArmX = 20; rightArmY = boardY + 2;
            leftArmX = -15; leftArmY = -20;
        } else if (trick.grabStyle === 'stale') {
            // Stalefish - reach behind for backside rail
            leftArmX = -5; leftArmY = boardY;
            rightArmX = 20; rightArmY = -15;
        } else {
            // Spin tricks - arms out for style
            const wave = Math.sin(progress * Math.PI * 2) * 8;
            leftArmX = -22; leftArmY = -15 + wave;
            rightArmX = 22; rightArmY = -15 - wave;
        }
    } else if (player.airborne) {
        // Default airborne arm wave
        const armAngle = Math.sin(gameState.animationTime * 8) * 0.4;
        leftArmY = -12 + Math.sin(armAngle) * 8;
        rightArmY = -12 - Math.sin(armAngle) * 8;
    }

    ctx.strokeStyle = jacketGrad;
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-10, -5);
    ctx.lineTo(leftArmX, leftArmY);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(10, -5);
    ctx.lineTo(rightArmX, rightArmY);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Head
    ctx.fillStyle = '#ffcc99';
    ctx.beginPath();
    ctx.arc(0, -24, 9, 0, Math.PI * 2);
    ctx.fill();

    // Helmet
    ctx.fillStyle = '#222';
    ctx.beginPath();
    ctx.arc(0, -26, 10, Math.PI, 0);
    ctx.fill();

    // Goggles with reflective gradient
    const goggleGrad = ctx.createLinearGradient(-8, -28, 8, -22);
    goggleGrad.addColorStop(0, COLORS.magenta);
    goggleGrad.addColorStop(0.3, '#ff66cc');
    goggleGrad.addColorStop(0.7, COLORS.cyan);
    goggleGrad.addColorStop(1, COLORS.electricBlue);
    ctx.fillStyle = goggleGrad;
    ctx.shadowColor = COLORS.magenta;
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.roundRect(-9, -28, 18, 7, 2);
    ctx.fill();

    // Goggle shine
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.beginPath();
    ctx.ellipse(-4, -26, 3, 2, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.restore();
}

function drawFogWall() {
    const chase = gameState.chase;
    const screen = worldToScreen(0, chase.fogY);
    const time = gameState.animationTime;

    // Multi-layer fog gradient for more depth
    const gradient = ctx.createLinearGradient(0, screen.y - 200, 0, screen.y + 80);
    gradient.addColorStop(0, 'rgba(20, 10, 35, 0)');
    gradient.addColorStop(0.2, 'rgba(40, 20, 60, 0.3)');
    gradient.addColorStop(0.4, 'rgba(60, 30, 90, 0.6)');
    gradient.addColorStop(0.6, 'rgba(50, 25, 75, 0.8)');
    gradient.addColorStop(0.8, 'rgba(30, 15, 50, 0.95)');
    gradient.addColorStop(1, 'rgba(15, 5, 25, 1)');

    ctx.fillStyle = gradient;
    ctx.fillRect(0, screen.y - 200, CANVAS_WIDTH, 300);

    // Animated tendrils with bezier curves (10 tendrils)
    for (let i = 0; i < 10; i++) {
        const baseX = (i * CANVAS_WIDTH / 10) + 24;
        const phase = time * 2.5 + i * 0.8;
        const amplitude = 30 + Math.sin(i * 1.3) * 15;

        // Tendril color varies
        const hue = 280 + Math.sin(time + i) * 30;
        ctx.strokeStyle = `hsla(${hue}, 80%, 60%, ${0.2 + Math.sin(phase) * 0.1})`;
        ctx.lineWidth = 3 + Math.sin(phase * 0.5) * 2;

        ctx.beginPath();
        ctx.moveTo(baseX, screen.y - 100);

        // Bezier curve for smooth tendril
        const cp1x = baseX + Math.sin(phase) * amplitude;
        const cp1y = screen.y - 60;
        const cp2x = baseX + Math.sin(phase + 1) * amplitude * 0.7;
        const cp2y = screen.y - 20;
        const endX = baseX + Math.sin(phase + 2) * amplitude * 0.4;
        const endY = screen.y + 40;

        ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, endX, endY);
        ctx.stroke();
    }

    // Glowing edge with sine wave
    ctx.strokeStyle = 'rgba(255, 100, 255, 0.4)';
    ctx.lineWidth = 4;
    ctx.shadowColor = COLORS.magenta;
    ctx.shadowBlur = 15;
    ctx.beginPath();
    ctx.moveTo(0, screen.y - 80);
    for (let x = 0; x <= CANVAS_WIDTH; x += 10) {
        const waveY = screen.y - 80 + Math.sin(x * 0.02 + time * 3) * 15 + Math.sin(x * 0.05 + time * 2) * 8;
        ctx.lineTo(x, waveY);
    }
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Floating particle motes
    ctx.fillStyle = 'rgba(200, 150, 255, 0.5)';
    for (let i = 0; i < 15; i++) {
        const moteX = (i * 37 + time * 20) % CANVAS_WIDTH;
        const moteY = screen.y - 120 + Math.sin(time * 2 + i * 0.7) * 40;
        const moteSize = 2 + Math.sin(time * 3 + i) * 1;

        if (moteY > screen.y - 150 && moteY < screen.y) {
            ctx.beginPath();
            ctx.arc(moteX, moteY, moteSize, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // Inner darkness
    const innerGrad = ctx.createLinearGradient(0, screen.y, 0, screen.y + 100);
    innerGrad.addColorStop(0, 'rgba(10, 5, 20, 0.5)');
    innerGrad.addColorStop(1, 'rgba(5, 0, 10, 1)');
    ctx.fillStyle = innerGrad;
    ctx.fillRect(0, screen.y, CANVAS_WIDTH, 150);
}

function drawBeast() {
    const chase = gameState.chase;
    const screen = worldToScreen(chase.beastX, chase.beastY);
    const time = gameState.animationTime;

    // Try sprite-based rendering first
    if (sprites.beast && sprites.beast.sheet.loaded) {
        // Determine animation based on beast state
        if (chase.beastState === 'lunging') {
            sprites.beast.setAnimation('lunge');
        } else if (chase.beastState === 'retreating') {
            sprites.beast.setAnimation('recover');
        } else {
            // Chase state - select based on rage level
            if (chase.beastRage > 0.75) {
                sprites.beast.setAnimation('rageMax');
            } else if (chase.beastRage > 0.5) {
                sprites.beast.setAnimation('rageHigh');
            } else if (chase.beastRage > 0.25) {
                sprites.beast.setAnimation('rageMedium');
            } else {
                sprites.beast.setAnimation('chase');
            }
        }

        // Calculate scale
        let scale = 0.9 + chase.beastRage * 0.2;
        if (chase.beastState === 'lunging') {
            scale += chase.lungeProgress * 0.3;
        }

        // Breathing effect
        const breathe = Math.sin(time * 3) * 0.03 + 1;
        scale *= breathe;

        // Draw aura behind sprite
        const pulseIntensity = 0.5 + Math.sin(time * 5) * 0.3;
        const auraGrad = ctx.createRadialGradient(screen.x, screen.y, 20, screen.x, screen.y, 80 * scale);
        auraGrad.addColorStop(0, `rgba(255, 0, 255, ${pulseIntensity * 0.4})`);
        auraGrad.addColorStop(0.5, `rgba(148, 0, 211, ${pulseIntensity * 0.2})`);
        auraGrad.addColorStop(1, 'rgba(100, 0, 150, 0)');
        ctx.fillStyle = auraGrad;
        ctx.beginPath();
        ctx.arc(screen.x, screen.y, 80 * scale, 0, Math.PI * 2);
        ctx.fill();

        // Draw sprite
        const drawn = sprites.beast.draw(ctx, screen.x, screen.y, scale, 0, false);
        if (drawn) return; // Success, skip procedural drawing
    }

    // Fallback to procedural drawing
    ctx.save();
    ctx.translate(screen.x, screen.y);

    // Scale up during lunge and with rage
    let scale = 1 + chase.beastRage * 0.2;
    if (chase.beastState === 'lunging') {
        scale += chase.lungeProgress * 0.4;
    }
    ctx.scale(scale, scale);

    // Breathing animation
    const breathe = Math.sin(time * 3) * 0.05 + 1;
    ctx.scale(breathe, 1 / breathe);

    // Pulsing aura gradient
    const pulseIntensity = 0.5 + Math.sin(time * 5) * 0.3;
    const auraGrad = ctx.createRadialGradient(0, 0, 20, 0, 0, 70);
    auraGrad.addColorStop(0, `rgba(255, 0, 255, ${pulseIntensity * 0.4})`);
    auraGrad.addColorStop(0.5, `rgba(148, 0, 211, ${pulseIntensity * 0.2})`);
    auraGrad.addColorStop(1, 'rgba(100, 0, 150, 0)');
    ctx.fillStyle = auraGrad;
    ctx.beginPath();
    ctx.arc(0, 0, 70, 0, Math.PI * 2);
    ctx.fill();

    // Animated shadow tendrils around body
    ctx.strokeStyle = 'rgba(50, 0, 80, 0.6)';
    ctx.lineWidth = 4;
    for (let i = 0; i < 6; i++) {
        const angle = (i / 6) * Math.PI * 2 + time * 2;
        const len = 35 + Math.sin(time * 4 + i) * 10;
        ctx.beginPath();
        ctx.moveTo(Math.cos(angle) * 25, Math.sin(angle) * 30);
        ctx.quadraticCurveTo(
            Math.cos(angle + 0.3) * 40,
            Math.sin(angle + 0.3) * 45,
            Math.cos(angle) * len,
            Math.sin(angle) * (len + 10)
        );
        ctx.stroke();
    }

    // Main body
    const bodyGrad = ctx.createRadialGradient(0, -10, 5, 0, 10, 50);
    bodyGrad.addColorStop(0, '#4a2a5a');
    bodyGrad.addColorStop(0.6, '#2a1a3a');
    bodyGrad.addColorStop(1, '#1a0a2a');
    ctx.fillStyle = bodyGrad;
    ctx.shadowColor = COLORS.magenta;
    ctx.shadowBlur = 25;
    ctx.beginPath();
    ctx.ellipse(0, 0, 35, 45, 0, 0, Math.PI * 2);
    ctx.fill();

    // Fur texture lines
    ctx.strokeStyle = 'rgba(100, 50, 120, 0.5)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 8; i++) {
        const fx = -25 + i * 7;
        ctx.beginPath();
        ctx.moveTo(fx, -30);
        ctx.lineTo(fx + Math.sin(time * 2 + i) * 3, 25);
        ctx.stroke();
    }

    // Eyes - dual colored (cyan left, magenta right)
    // Left eye - cyan
    const eyeTrack = Math.sin(time) * 2; // Subtle eye movement
    ctx.fillStyle = COLORS.cyan;
    ctx.shadowColor = COLORS.cyan;
    ctx.shadowBlur = 20;
    ctx.beginPath();
    ctx.ellipse(-14 + eyeTrack, -18, 8, 10, 0, 0, Math.PI * 2);
    ctx.fill();

    // Right eye - magenta
    ctx.fillStyle = COLORS.magenta;
    ctx.shadowColor = COLORS.magenta;
    ctx.beginPath();
    ctx.ellipse(14 + eyeTrack, -18, 8, 10, 0, 0, Math.PI * 2);
    ctx.fill();

    // Eye glow rings
    ctx.strokeStyle = COLORS.cyan;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(-14 + eyeTrack, -18, 10, 12, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = COLORS.magenta;
    ctx.beginPath();
    ctx.ellipse(14 + eyeTrack, -18, 10, 12, 0, 0, Math.PI * 2);
    ctx.stroke();

    // Pupils (track toward player slightly)
    ctx.fillStyle = '#000';
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.arc(-14 + eyeTrack + 1, -18, 3, 0, Math.PI * 2);
    ctx.arc(14 + eyeTrack + 1, -18, 3, 0, Math.PI * 2);
    ctx.fill();

    // Glowing mouth
    ctx.fillStyle = 'rgba(255, 0, 100, 0.6)';
    ctx.shadowColor = COLORS.danger;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.ellipse(0, 12, 18, 12, 0, 0, Math.PI);
    ctx.fill();

    // Jagged glowing teeth
    ctx.fillStyle = '#fff';
    ctx.shadowColor = '#fff';
    ctx.shadowBlur = 5;
    const teethCount = 7;
    for (let i = 0; i < teethCount; i++) {
        const tx = -15 + (i * 30 / (teethCount - 1));
        const th = 8 + Math.sin(i * 1.5) * 4; // Varying heights
        ctx.beginPath();
        ctx.moveTo(tx - 3, 8);
        ctx.lineTo(tx, 8 + th);
        ctx.lineTo(tx + 3, 8);
        ctx.closePath();
        ctx.fill();
    }

    // Claws appear during lunge
    if (chase.beastState === 'lunging') {
        ctx.fillStyle = '#ddd';
        ctx.shadowColor = COLORS.danger;
        ctx.shadowBlur = 8;
        for (let side = -1; side <= 1; side += 2) {
            for (let c = 0; c < 3; c++) {
                const clawX = side * 35;
                const clawY = -10 + c * 10;
                ctx.beginPath();
                ctx.moveTo(clawX, clawY);
                ctx.lineTo(clawX + side * 15, clawY + 5);
                ctx.lineTo(clawX, clawY + 4);
                ctx.closePath();
                ctx.fill();
            }
        }
    }

    ctx.shadowBlur = 0;
    ctx.restore();
}

function drawParticles() {
    for (const p of gameState.particles) {
        const screen = worldToScreen(p.x, p.y);

        ctx.globalAlpha = p.alpha;

        if (p.type === 'spark') {
            ctx.fillStyle = p.color;
            ctx.shadowColor = p.color;
            ctx.shadowBlur = 6;
            ctx.beginPath();
            ctx.arc(screen.x, screen.y, p.size, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
        } else {
            ctx.fillStyle = p.color;
            ctx.fillRect(screen.x - p.size/2, screen.y - p.size/2, p.size, p.size);
        }
    }
    ctx.globalAlpha = 1;
}

function drawCelebrations() {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (const c of gameState.celebrations) {
        const fade = Math.min(1, c.timer / 0.3);
        const rise = (1.5 - c.timer) * 30;

        ctx.globalAlpha = fade;

        // Main text
        ctx.font = `bold ${Math.floor(20 * c.scale)}px "Press Start 2P", monospace`;
        ctx.shadowColor = c.color;
        ctx.shadowBlur = 15;
        ctx.fillStyle = c.color;
        ctx.fillText(c.text, CANVAS_WIDTH/2, CANVAS_HEIGHT/2 - 50 - rise);

        // Subtext (points)
        if (c.subtext) {
            ctx.font = `bold ${Math.floor(14 * c.scale)}px "Press Start 2P", monospace`;
            ctx.fillStyle = '#fff';
            ctx.fillText(c.subtext, CANVAS_WIDTH/2, CANVAS_HEIGHT/2 - 25 - rise);
        }

        ctx.shadowBlur = 0;
    }
    ctx.globalAlpha = 1;
}

function drawHUD() {
    ctx.textBaseline = 'top';

    // Distance (top left)
    drawNeonText(`${gameState.distance}m`, 15, 15, COLORS.cyan, 16, 'left');

    // Speed (top center)
    const speedPercent = Math.floor((gameState.player.speed / PHYSICS.maxSpeed) * 100);
    const speedColor = speedPercent > 75 ? COLORS.hotPink : COLORS.electricBlue;
    drawNeonText(`${speedPercent}%`, CANVAS_WIDTH/2, 15, speedColor, 18, 'center');

    // Score (top right)
    drawNeonText(gameState.score.toString().padStart(6, '0'), CANVAS_WIDTH - 15, 15, COLORS.magenta, 16, 'right');

    // Combo (if active)
    if (gameState.trickMultiplier > 1) {
        const comboY = 50;
        ctx.font = 'bold 14px "Press Start 2P", monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = COLORS.yellow;
        ctx.shadowColor = COLORS.yellow;
        ctx.shadowBlur = 10;
        ctx.fillText(`x${gameState.trickMultiplier.toFixed(1)}`, CANVAS_WIDTH/2, comboY);
        ctx.shadowBlur = 0;

        // Combo timer bar
        const barWidth = 80;
        const barFill = gameState.trickComboTimer / 2.0;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(CANVAS_WIDTH/2 - barWidth/2, comboY + 18, barWidth, 4);
        ctx.fillStyle = COLORS.yellow;
        ctx.fillRect(CANVAS_WIDTH/2 - barWidth/2, comboY + 18, barWidth * barFill, 4);
    }

    // Danger warning
    if (gameState.dangerLevel > 0.5) {
        const pulse = Math.sin(gameState.animationTime * 10) * 0.3 + 0.7;
        ctx.globalAlpha = gameState.dangerLevel * pulse;
        ctx.font = 'bold 20px "Press Start 2P", monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = COLORS.danger;
        ctx.shadowColor = COLORS.danger;
        ctx.shadowBlur = 15;
        ctx.fillText('SPEED UP!', CANVAS_WIDTH/2, CANVAS_HEIGHT - 60);
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
    }
}

function drawNeonText(text, x, y, color, size, align) {
    ctx.font = `bold ${size}px "Press Start 2P", monospace`;
    ctx.textAlign = align;
    ctx.shadowColor = color;
    ctx.shadowBlur = 10;
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
    ctx.shadowBlur = 0;
}

function drawDangerVignette() {
    const intensity = gameState.dangerLevel * 0.4;
    const pulse = Math.sin(gameState.animationTime * 6) * 0.1;

    const gradient = ctx.createRadialGradient(
        CANVAS_WIDTH/2, CANVAS_HEIGHT/2, CANVAS_HEIGHT * 0.3,
        CANVAS_WIDTH/2, CANVAS_HEIGHT/2, CANVAS_HEIGHT * 0.7
    );
    gradient.addColorStop(0, 'rgba(255, 0, 50, 0)');
    gradient.addColorStop(1, `rgba(255, 0, 50, ${intensity + pulse})`);

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
}

function drawSpeedLines() {
    const speedRatio = gameState.player.speed / PHYSICS.maxSpeed;
    const lineCount = Math.floor((speedRatio - 0.5) * 30);
    const lineAlpha = (speedRatio - 0.5) * 0.4;

    ctx.strokeStyle = `rgba(0, 255, 255, ${lineAlpha})`;
    ctx.lineWidth = 1;

    for (let i = 0; i < lineCount; i++) {
        const x = Math.random() * CANVAS_WIDTH;
        const length = 30 + Math.random() * 60 * speedRatio;

        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x + (Math.random() - 0.5) * 10, length);
        ctx.stroke();
    }
}

function drawTitleScreen() {
    // Background
    const gradient = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
    gradient.addColorStop(0, COLORS.bgDark);
    gradient.addColorStop(1, COLORS.bgMid);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Animated snow
    for (let i = 0; i < 50; i++) {
        const x = (i * 47 + gameState.animationTime * 30) % CANVAS_WIDTH;
        const y = (i * 31 + gameState.animationTime * 80) % CANVAS_HEIGHT;
        ctx.fillStyle = `rgba(255, 255, 255, ${0.3 + Math.sin(i) * 0.2})`;
        ctx.fillRect(x, y, 2, 2);
    }

    // Title
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const titleY = CANVAS_HEIGHT * 0.3;
    const pulse = Math.sin(gameState.animationTime * 3) * 5;

    ctx.font = 'bold 36px "Press Start 2P", monospace';
    ctx.shadowColor = COLORS.cyan;
    ctx.shadowBlur = 20;
    ctx.fillStyle = COLORS.cyan;
    ctx.fillText('SNOW', CANVAS_WIDTH/2, titleY - 25 + pulse);

    ctx.shadowColor = COLORS.magenta;
    ctx.fillStyle = COLORS.magenta;
    ctx.fillText('FREE', CANVAS_WIDTH/2, titleY + 25 + pulse);
    ctx.shadowBlur = 0;

    // Subtitle
    ctx.font = '10px "Press Start 2P", monospace';
    ctx.fillStyle = COLORS.hotPink;
    ctx.fillText('SHRED THE GNAR OR GET WRECKED', CANVAS_WIDTH/2, titleY + 70);

    // High score
    if (gameState.highScore > 0) {
        ctx.font = '12px "Press Start 2P", monospace';
        ctx.fillStyle = COLORS.yellow;
        ctx.fillText(`HIGH SCORE: ${gameState.highScore}`, CANVAS_WIDTH/2, CANVAS_HEIGHT * 0.55);
    }

    // Start prompt
    const blink = Math.floor(gameState.animationTime * 2) % 2 === 0;
    if (blink) {
        ctx.font = '14px "Press Start 2P", monospace';
        ctx.fillStyle = '#fff';
        ctx.fillText('PRESS SPACE', CANVAS_WIDTH/2, CANVAS_HEIGHT * 0.7);
    }

    // Controls
    ctx.font = '8px "Press Start 2P", monospace';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.fillText('ARROW KEYS TO CARVE', CANVAS_WIDTH/2, CANVAS_HEIGHT * 0.85);
    ctx.fillText('DOWN TO TUCK', CANVAS_WIDTH/2, CANVAS_HEIGHT * 0.9);
}

function drawGameOverScreen() {
    // Darken background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Death message
    let deathText = 'WRECKED!';
    let deathColor = COLORS.danger;
    if (gameState.deathCause === 'fog') {
        deathText = 'SWALLOWED BY THE MOUNTAIN';
        deathColor = COLORS.purple;
    } else if (gameState.deathCause === 'beast') {
        deathText = 'CAUGHT BY THE BEAST';
        deathColor = COLORS.magenta;
    }

    ctx.font = 'bold 18px "Press Start 2P", monospace';
    ctx.shadowColor = deathColor;
    ctx.shadowBlur = 15;
    ctx.fillStyle = deathColor;
    ctx.fillText(deathText, CANVAS_WIDTH/2, CANVAS_HEIGHT * 0.3);
    ctx.shadowBlur = 0;

    // Stats
    ctx.font = '12px "Press Start 2P", monospace';
    ctx.fillStyle = COLORS.cyan;
    ctx.fillText(`DISTANCE: ${gameState.distance}m`, CANVAS_WIDTH/2, CANVAS_HEIGHT * 0.45);
    ctx.fillStyle = COLORS.magenta;
    ctx.fillText(`SCORE: ${gameState.score}`, CANVAS_WIDTH/2, CANVAS_HEIGHT * 0.52);
    ctx.fillStyle = COLORS.yellow;
    ctx.fillText(`MAX COMBO: x${gameState.maxCombo.toFixed(1)}`, CANVAS_WIDTH/2, CANVAS_HEIGHT * 0.59);

    // New high score
    if (gameState.score > gameState.highScore) {
        const pulse = Math.sin(gameState.animationTime * 5) * 0.3 + 0.7;
        ctx.globalAlpha = pulse;
        ctx.font = '14px "Press Start 2P", monospace';
        ctx.fillStyle = COLORS.yellow;
        ctx.shadowColor = COLORS.yellow;
        ctx.shadowBlur = 10;
        ctx.fillText('NEW HIGH SCORE!', CANVAS_WIDTH/2, CANVAS_HEIGHT * 0.68);
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
    }

    // Restart prompt
    const blink = Math.floor(gameState.animationTime * 2) % 2 === 0;
    if (blink) {
        ctx.font = '12px "Press Start 2P", monospace';
        ctx.fillStyle = '#fff';
        ctx.fillText('PRESS SPACE TO RESTART', CANVAS_WIDTH/2, CANVAS_HEIGHT * 0.82);
    }
}

// ===================
// GAME FLOW
// ===================

function startGame() {
    // Hide the HTML start screen
    hideStartScreen();

    // Ensure canvas is visible and properly sized for current resolution
    if (canvas) {
        canvas.style.display = 'block';
        canvas.style.opacity = '1';
    }

    // Re-apply canvas viewport fitting to ensure proper display
    fitCanvasToViewport();

    // Ensure terrain dimensions are correct for current resolution
    TERRAIN.slopeWidth = getTerrainSlopeWidth();
    TERRAIN.laneWidth = getTerrainLaneWidth();

    // Invalidate gradient cache to regenerate for current resolution
    gradientCache.invalidate();

    // Reset game state
    gameState.screen = 'playing';
    gameState.animationTime = 0;

    gameState.player = {
        x: 0,
        y: 0,
        visualX: 0,
        visualY: 0,
        speed: 150,
        lateralSpeed: 0,
        angle: 0,
        airborne: false,
        altitude: 0,
        verticalVelocity: 0,
        airTime: 0,
        grinding: false,
        grindProgress: 0,
        currentRail: null,
        crashed: false,
        crashTimer: 0,
        stunned: 0,
        invincible: 0,
        trickRotation: 0,
        autoTrick: null,
        autoTrickProgress: 0,
        flipRotation: 0,
        grabPhase: 0
    };

    gameState.camera = {
        y: -CANVAS_HEIGHT * 0.35,
        targetY: 0,
        lookAhead: 150
    };

    gameState.terrain = {
        chunks: [],
        nextChunkY: 0,
        seed: Math.floor(Math.random() * 100000)
    };

    gameState.obstacles = [];
    gameState.jumps = [];
    gameState.rails = [];

    gameState.chase = {
        fogY: CHASE.fogStartOffset,
        fogSpeed: CHASE.fogBaseSpeed,
        beastActive: false,
        beastY: 0,
        beastX: 0,
        beastState: 'chasing',
        beastLungeTimer: 0,
        lungeTargetX: 0,
        lungeTargetY: 0,
        lungeProgress: 0,
        retreatTimer: 0,
        distanceTraveled: 0,
        recentCrashes: [],
        slowSpeedTimer: 0,
        beastRage: 0
    };

    gameState.score = 0;
    gameState.distance = 0;
    gameState.trickScore = 0;
    gameState.trickMultiplier = 1;
    gameState.trickComboTimer = 0;
    gameState.maxCombo = 1;

    gameState.particles = [];
    gameState.celebrations = [];
    gameState.screenShake = { x: 0, y: 0, intensity: 0, decay: 0.9 };

    gameState.dangerLevel = 0;
    gameState.deathCause = null;
}

function triggerGameOver(cause) {
    gameState.screen = 'gameOver';
    gameState.deathCause = cause;

    // Update high score
    if (gameState.score > gameState.highScore) {
        gameState.highScore = gameState.score;
        saveHighScore();
    }

    // Save best distance
    saveBestDistance(gameState.distance);

    // Save max combo
    saveBestCombo(gameState.maxCombo);
}

function saveHighScore() {
    try {
        localStorage.setItem('shredordead_highscore', gameState.highScore.toString());
    } catch (e) {
        // LocalStorage not available
    }
}

function saveBestDistance(distance) {
    try {
        const saved = localStorage.getItem('shredordead_bestdistance');
        const best = saved ? parseInt(saved, 10) : 0;
        if (distance > best) {
            localStorage.setItem('shredordead_bestdistance', distance.toString());
        }
    } catch (e) {
        // LocalStorage not available
    }
}

function saveBestCombo(combo) {
    try {
        const saved = localStorage.getItem('shredordead_maxcombo');
        const best = saved ? parseFloat(saved) : 0;
        if (combo > best) {
            localStorage.setItem('shredordead_maxcombo', combo.toFixed(1));
        }
    } catch (e) {
        // LocalStorage not available
    }
}

function loadHighScore() {
    try {
        const saved = localStorage.getItem('shredordead_highscore');
        if (saved) {
            gameState.highScore = parseInt(saved, 10) || 0;
        }
    } catch (e) {
        // LocalStorage not available
    }
}

// ===================
// MAIN LOOP
// ===================

function update(dt) {
    gameState.animationTime += dt;

    // Handle input for screen transitions
    if (input.space && !input._lastSpace) {
        if (gameState.screen === 'title') {
            startGame();
        } else if (gameState.screen === 'gameOver') {
            gameState.screen = 'title';
            showStartScreen();
        }
    }
    input._lastSpace = input.space;

    if (gameState.screen !== 'playing') return;

    // Update game systems
    updatePlayer(dt);
    updateCamera(dt);
    updateTerrain();
    checkCollisions();
    updateChase(dt);
    updateParticles(dt);
    updateCelebrations(dt);
    updateCombo(dt);
    updateScreenShake(dt);

    // Update sprite animations
    if (sprites.player) sprites.player.update(dt);
    if (sprites.beast) sprites.beast.update(dt);
}

function gameLoop(timestamp) {
    let dt = (timestamp - lastTime) / 1000;
    if (lastTime === 0 || dt > 0.1) {
        dt = 0.016;
    }
    lastTime = timestamp;

    update(dt);
    draw();

    requestAnimationFrame(gameLoop);
}

function init() {
    canvas = document.getElementById('gameCanvas');
    ctx = canvas.getContext('2d');

    // Initialize resolution system
    loadSettings();
    setResolution(displaySettings.currentResolution);
    fitCanvasToViewport();

    setupInput();
    loadHighScore();
    updateSettingsUI();

    // Load sprites asynchronously (game works without them)
    loadSprites().then(() => {
        console.log('Sprite system ready');
    }).catch(err => {
        console.warn('Sprites failed to load, using procedural rendering:', err);
    });

    requestAnimationFrame(gameLoop);
}

// ============================================
// SETTINGS MENU FUNCTIONS
// ============================================

function showSettingsMenu() {
    const menu = document.getElementById('settingsMenu');
    if (menu) {
        menu.classList.add('active');
        updateSettingsUI();
    }
}

function hideSettingsMenu() {
    const menu = document.getElementById('settingsMenu');
    if (menu) {
        menu.classList.remove('active');
    }
}

function updateSettingsUI() {
    // Device profile with suggested resolution
    const deviceLabel = document.getElementById('deviceProfileLabel');
    if (deviceLabel) {
        const profile = getDeviceProfileInfo();
        deviceLabel.textContent = profile.label;
    }

    // Current resolution
    const resSelect = document.getElementById('resolutionSelect');
    if (resSelect) resSelect.value = displaySettings.currentResolution;

    // Auto-detect toggle
    const autoDetectToggle = document.getElementById('autoDetectToggle');
    if (autoDetectToggle) autoDetectToggle.checked = displaySettings.autoDetect;

    // Screen shake toggle
    const screenShakeToggle = document.getElementById('screenShakeToggle');
    if (screenShakeToggle) screenShakeToggle.checked = displaySettings.screenShakeEnabled;

    // Haptics toggle
    const hapticsToggle = document.getElementById('hapticsToggle');
    if (hapticsToggle) hapticsToggle.checked = displaySettings.hapticsEnabled;

    // Fill screen toggle
    const fillScreenToggle = document.getElementById('fillScreenToggle');
    if (fillScreenToggle) fillScreenToggle.checked = displaySettings.fillScreen;

    // Gamepad status
    const gamepadStatus = document.getElementById('gamepadStatus');
    if (gamepadStatus) {
        // gamepadState may not be defined yet - use safe access
        const isConnected = typeof gamepadState !== 'undefined' && gamepadState && gamepadState.connected;
        gamepadStatus.textContent = isConnected ? 'Connected' : 'Not Connected';
        gamepadStatus.style.color = isConnected ? '#00ffff' : '#ff6b6b';
    }

    // Show current resolution info
    const res = RESOLUTIONS[displaySettings.currentResolution];
    if (res) {
        const resInfo = document.getElementById('resolutionInfo');
        if (resInfo) {
            resInfo.textContent = `${res.width}×${res.height} (${res.orientation})`;
        }
    }
}

function setResolution(resKey) {
    const res = RESOLUTIONS[resKey];
    if (!res) return;

    displaySettings.currentResolution = resKey;
    displaySettings.scale = res.scale;

    if (canvas) {
        canvas.width = res.width;
        canvas.height = res.height;
    }

    CANVAS_WIDTH = res.width;
    CANVAS_HEIGHT = res.height;

    // Update terrain slope width based on orientation
    TERRAIN.slopeWidth = getTerrainSlopeWidth();
    TERRAIN.laneWidth = getTerrainLaneWidth();

    // Invalidate gradient cache on resolution change
    gradientCache.invalidate();

    try { localStorage.setItem('shredordead_resolution', resKey); } catch (e) {}
    fitCanvasToViewport();
    updateSettingsUI();

    console.log(`Resolution set to ${resKey} (${res.width}x${res.height}, ${res.orientation})`);
}

function fitCanvasToViewport() {
    if (!canvas) return;

    const isFullscreen = document.fullscreenElement || displaySettings.fullscreen;
    const marginX = isFullscreen ? 0 : 20;
    const marginY = isFullscreen ? 0 : 40;

    const maxWidth = window.innerWidth - marginX;
    const maxHeight = window.innerHeight - marginY;

    // In fill screen mode, adapt canvas resolution to match screen dimensions
    if (displaySettings.fillScreen && isFullscreen) {
        // Calculate internal resolution to match screen aspect ratio
        // Use a reasonable base height and scale width to match aspect ratio
        const screenAspect = maxWidth / maxHeight;
        let internalHeight = 1080; // Base internal resolution height
        let internalWidth = Math.round(internalHeight * screenAspect);

        // Cap resolution to avoid performance issues
        const maxInternalWidth = 1920;
        const maxInternalHeight = 1080;
        if (internalWidth > maxInternalWidth) {
            internalWidth = maxInternalWidth;
            internalHeight = Math.round(internalWidth / screenAspect);
        }
        if (internalHeight > maxInternalHeight) {
            internalHeight = maxInternalHeight;
            internalWidth = Math.round(internalHeight * screenAspect);
        }

        // Update internal canvas resolution
        if (canvas.width !== internalWidth || canvas.height !== internalHeight) {
            canvas.width = internalWidth;
            canvas.height = internalHeight;
            CANVAS_WIDTH = internalWidth;
            CANVAS_HEIGHT = internalHeight;

            // Update terrain dimensions for new resolution
            TERRAIN.slopeWidth = getTerrainSlopeWidth();
            TERRAIN.laneWidth = getTerrainLaneWidth();

            // Invalidate gradient cache
            gradientCache.invalidate();

            console.log(`Canvas adapted to screen: ${internalWidth}x${internalHeight}`);
        }

        // Scale canvas CSS to fill the entire viewport
        canvas.style.width = maxWidth + 'px';
        canvas.style.height = maxHeight + 'px';
        canvas.style.margin = 'auto';
        canvas.style.display = 'block';
        return;
    }

    const canvasRatio = canvas.width / canvas.height;
    const viewportRatio = maxWidth / maxHeight;

    if (canvasRatio > viewportRatio) {
        canvas.style.width = maxWidth + 'px';
        canvas.style.height = Math.floor(maxWidth / canvasRatio) + 'px';
    } else {
        canvas.style.height = maxHeight + 'px';
        canvas.style.width = Math.floor(maxHeight * canvasRatio) + 'px';
    }

    canvas.style.margin = 'auto';
    canvas.style.display = 'block';
}

function toggleFullscreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().then(() => {
            displaySettings.fullscreen = true;
            // Add fullscreen-mode class for CSS styling
            document.body.classList.add('fullscreen-mode');
            // Auto-detect best resolution for fullscreen based on screen dimensions
            if (displaySettings.autoDetect) {
                const bestRes = autoDetectResolution();
                setResolution(bestRes);
            }
            // Resize start screen canvases
            resizeStartScreenCanvases();
            fitCanvasToViewport();
        }).catch(err => {
            console.warn('Fullscreen request failed:', err);
        });
    } else {
        document.exitFullscreen();
        displaySettings.fullscreen = false;
        // Remove fullscreen-mode class
        document.body.classList.remove('fullscreen-mode');
        // Resize start screen canvases back
        resizeStartScreenCanvases();
    }
}

// Auto-detect best resolution based on screen size, aspect ratio, and device
function autoDetectResolution() {
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;
    const aspectRatio = screenWidth / screenHeight;
    const dpr = window.devicePixelRatio || 1;
    const ua = navigator.userAgent || '';

    const isIOS = /iPhone|iPad|iPod/i.test(ua);
    const isAndroid = /Android/i.test(ua);
    const isMobile = isIOS || isAndroid || ('ontouchstart' in window && screenWidth < 900);

    // === HANDHELD GAMING DEVICE DETECTION ===

    // Asus ROG Ally / Ally X - 1920x1080 native
    if (/ROG Ally|ASUS/i.test(ua) && screenWidth >= 1920) {
        return '1920x1080-ally';
    }

    // Generic 1080p handheld detection (not phone)
    const isHandheld1080p = (screenWidth >= 1920 && screenHeight >= 1080 &&
        'ontouchstart' in window && !isIOS && !isAndroid);
    if (isHandheld1080p && aspectRatio >= 1.7) {
        return '1920x1080';
    }

    // Steam Deck - 1280x800 native (16:10)
    if (/Steam Deck/i.test(ua)) {
        return '1280x800';
    }

    // === LANDSCAPE / WIDESCREEN DETECTION ===

    // 16:9 aspect ratio (desktop widescreen, gaming monitors)
    if (aspectRatio >= 1.7 && aspectRatio <= 1.85) {
        if (screenWidth >= 1920 && screenHeight >= 1080) return '1920x1080';
        if (screenHeight >= 720) return '1280x720';
        return '854x480';
    }

    // 16:10 aspect ratio (some laptops, Steam Deck in browser)
    if (aspectRatio >= 1.55 && aspectRatio < 1.7) {
        return '1280x800';
    }

    // === PORTRAIT / MOBILE DETECTION ===

    // iOS / Mobile - conservative internal resolution
    if (isIOS || isMobile) {
        if (Math.min(screenWidth, screenHeight) >= 900 || dpr > 2) return '600x800';
        return '480x640';
    }

    // Portrait detection (taller than wide)
    if (aspectRatio < 1) {
        // 9:16 mobile
        if (aspectRatio <= 0.6 && screenHeight >= 1080) return '608x1080';
        if (aspectRatio <= 0.6) return '405x720';

        // 3:4 tablet-like
        if (screenHeight >= 1200) return '900x1200';
        if (screenHeight >= 1024) return '768x1024';
        if (screenHeight >= 960) return '720x960';
        if (screenHeight >= 800) return '600x800';
        return '480x640';
    }

    // Square-ish or default: use portrait based on height
    if (screenHeight >= 1080) return '720x960';
    if (screenHeight >= 800) return '600x800';
    return '480x640';
}

// Get detailed device profile for display
function getDeviceProfile() {
    const ua = navigator.userAgent || '';
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;
    const aspectRatio = screenWidth / screenHeight;

    // Specific device detection
    if (/ROG Ally|ASUS/i.test(ua) && screenWidth >= 1920) {
        return 'ROG Ally / Ally X';
    }
    if (/Steam Deck/i.test(ua)) {
        return 'Steam Deck';
    }
    if (/iPhone|iPad|iPod/i.test(ua)) {
        return 'iOS Device';
    }
    if (/Android/i.test(ua)) {
        return 'Android';
    }

    // Generic detection by characteristics
    const isHandheld = (screenWidth >= 1920 && 'ontouchstart' in window);
    if (isHandheld && aspectRatio >= 1.7) {
        return 'Gaming Handheld (1080p)';
    }

    if (aspectRatio >= 1.7) return 'Desktop (16:9)';
    if (aspectRatio >= 1.55) return 'Desktop (16:10)';
    if (aspectRatio < 1) return 'Portrait Display';
    if ('ontouchstart' in window) return 'Touchscreen';
    return 'Desktop';
}

// Get device profile with suggested resolution
function getDeviceProfileInfo() {
    return {
        label: getDeviceProfile(),
        suggested: autoDetectResolution()
    };
}

function loadSettings() {
    try {
        const savedRes = localStorage.getItem('shredordead_resolution');
        if (savedRes && RESOLUTIONS[savedRes]) {
            displaySettings.currentResolution = savedRes;
        }
        const savedAutoDetect = localStorage.getItem('shredordead_autodetect');
        if (savedAutoDetect !== null) {
            displaySettings.autoDetect = savedAutoDetect === 'true';
        }
        const savedScreenShake = localStorage.getItem('shredordead_screenshake');
        if (savedScreenShake !== null) {
            displaySettings.screenShakeEnabled = savedScreenShake !== 'false';
        }
        const savedFillScreen = localStorage.getItem('shredordead_fillscreen');
        if (savedFillScreen !== null) {
            displaySettings.fillScreen = savedFillScreen !== 'false';
        }
    } catch (e) {}

    if (displaySettings.autoDetect) {
        displaySettings.currentResolution = autoDetectResolution();
    }
}

function saveSettings() {
    try {
        localStorage.setItem('shredordead_resolution', displaySettings.currentResolution);
        localStorage.setItem('shredordead_autodetect', displaySettings.autoDetect.toString());
        localStorage.setItem('shredordead_screenshake', displaySettings.screenShakeEnabled.toString());
        localStorage.setItem('shredordead_fillscreen', displaySettings.fillScreen.toString());
    } catch (e) {}
}

function changeResolution(resKey) {
    if (RESOLUTIONS[resKey]) {
        displaySettings.autoDetect = false;
        setResolution(resKey);
        saveSettings();
        updateSettingsUI();
    }
}

function toggleAutoDetect(enabled) {
    displaySettings.autoDetect = enabled;
    if (enabled) {
        setResolution(autoDetectResolution());
    }
    saveSettings();
    updateSettingsUI();
}

function toggleScreenShakeSetting(enabled) {
    displaySettings.screenShakeEnabled = enabled;
    saveSettings();
}

function toggleHapticsSetting(enabled) {
    // Placeholder for haptics
    saveSettings();
}

function toggleFillScreen(enabled) {
    displaySettings.fillScreen = enabled;
    saveSettings();
    // If currently in fullscreen, reapply to use new setting
    if (displaySettings.fullscreen) {
        fitCanvasToViewport();
    }
}

function resetAllSettings() {
    displaySettings.autoDetect = true;
    displaySettings.screenShakeEnabled = true;
    displaySettings.fillScreen = true;
    try {
        localStorage.removeItem('shredordead_resolution');
        localStorage.removeItem('shredordead_autodetect');
        localStorage.removeItem('shredordead_screenshake');
        localStorage.removeItem('shredordead_fillscreen');
    } catch (e) {}
    setResolution(autoDetectResolution());
    updateSettingsUI();
}

// Store pre-fullscreen resolution to restore when exiting
let preFullscreenResolution = null;

// Event listeners for resolution system
document.addEventListener('fullscreenchange', () => {
    const wasFullscreen = displaySettings.fullscreen;
    displaySettings.fullscreen = !!document.fullscreenElement;

    // Toggle fullscreen-mode class on body for CSS styling
    if (displaySettings.fullscreen) {
        document.body.classList.add('fullscreen-mode');
    } else {
        document.body.classList.remove('fullscreen-mode');
    }

    if (displaySettings.fullscreen && !wasFullscreen) {
        // Entering fullscreen - save current resolution
        preFullscreenResolution = displaySettings.currentResolution;
        // Auto-detect best resolution for this screen
        if (displaySettings.autoDetect) {
            const bestRes = autoDetectResolution();
            setResolution(bestRes);
        }
        // Resize start screen canvases for fullscreen
        resizeStartScreenCanvases();
    } else if (!displaySettings.fullscreen && wasFullscreen) {
        // Exiting fullscreen - restore original resolution
        if (preFullscreenResolution) {
            setResolution(preFullscreenResolution);
            preFullscreenResolution = null;
        }
        // Resize start screen canvases back to normal
        resizeStartScreenCanvases();
    }

    setTimeout(fitCanvasToViewport, 100);
});

// Resize start screen and particle canvases when entering/exiting fullscreen
function resizeStartScreenCanvases() {
    const startScreen = document.getElementById('startScreen');
    if (!startScreen) return;

    const isFullscreen = document.fullscreenElement || displaySettings.fullscreen;

    // Directly set start screen styles via JavaScript for fullscreen
    if (isFullscreen) {
        startScreen.style.position = 'fixed';
        startScreen.style.width = '100vw';
        startScreen.style.height = '100vh';
        startScreen.style.top = '0';
        startScreen.style.left = '0';
        startScreen.style.transform = 'none';
        startScreen.style.borderRadius = '0';
        startScreen.style.border = 'none';
        startScreen.style.boxShadow = 'none';
    } else {
        // Reset to CSS defaults
        startScreen.style.position = '';
        startScreen.style.width = '';
        startScreen.style.height = '';
        startScreen.style.top = '';
        startScreen.style.left = '';
        startScreen.style.transform = '';
        startScreen.style.borderRadius = '';
        startScreen.style.border = '';
        startScreen.style.boxShadow = '';
    }

    // Wait a frame for layout to update, then resize canvases
    requestAnimationFrame(() => {
        const snowCanvas = document.getElementById('snowCanvas');
        const blizzardCanvas = document.getElementById('blizzardCanvas');

        if (snowCanvas) {
            snowCanvas.width = startScreen.offsetWidth;
            snowCanvas.height = startScreen.offsetHeight;
        }

        // Blizzard canvas scales with logo area
        if (blizzardCanvas && isFullscreen) {
            blizzardCanvas.width = 800;
            blizzardCanvas.height = 500;
        } else if (blizzardCanvas) {
            blizzardCanvas.width = 520;
            blizzardCanvas.height = 360;
        }
    });
}

window.addEventListener('resize', fitCanvasToViewport);

// Start the game when the page loads
window.addEventListener('load', init);
