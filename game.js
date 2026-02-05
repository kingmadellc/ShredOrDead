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
    fillScreen: true,  // When true, canvas will fill the entire screen in fullscreen mode
    stance: 'regular'  // 'regular' (left foot forward) or 'goofy' (right foot forward)
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
    // Neon palette (for UI, rails, effects)
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
    // Background - snow palette with subtle cyan/pink hints (matching SnowAsset references)
    bgDark: '#c8e8f0',      // Light cyan-tinted shadow
    bgMid: '#e8f4f8',       // Pale cyan-white mid-tone
    bgLight: '#f8fcff',     // Near-white with cool tint
    // Additional snow palette colors for terrain variety
    snowCyan: '#d0f0f8',    // Subtle cyan for snow streaks
    snowPink: '#f8e0e8',    // Subtle pink for snow highlights
    snowShadow: '#b8d8e8'   // Cyan-tinted snow shadows
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
    baseDensity: 0.10,          // More obstacles (trees/rocks)
    maxDensity: 0.22,           // Denser terrain
    densityRampDistance: 4000,
    jumpChance: 0.008,          // Very rare jumps (90% reduction from 0.08)
    railChance: 0.009,          // Rare rails
    massiveJumpChance: 0.002,   // Very rare massive jumps for 1080+ tricks
    rockChance: 0.06,           // New: chance for large rocks
    treeClusterChance: 0.60,    // Higher tree cluster chance
    clearPathWidth: 2
};

// Dynamic terrain properties that adapt to resolution
function getTerrainSlopeWidth() {
    const res = RESOLUTIONS[displaySettings.currentResolution];

    // For dynamic fill-screen mode, use current canvas dimensions
    if (displaySettings.fillScreen && displaySettings.fullscreen) {
        const isLandscape = CANVAS_WIDTH > CANVAS_HEIGHT;
        if (isLandscape) {
            // For landscape/widescreen, slope fills the ENTIRE screen width
            // This gives the player full horizontal freedom to carve
            return CANVAS_WIDTH;
        }
        // For portrait, slope fills width
        return CANVAS_WIDTH;
    }

    if (!res) return TERRAIN.baseSlopeWidth;

    if (res.orientation === 'landscape') {
        // For landscape, slope fills the entire screen width
        return res.width;
    }
    // For portrait, slope fills width
    return res.width;
}

function getTerrainLaneWidth() {
    const slopeWidth = getTerrainSlopeWidth();
    // Keep lane width consistent (~68px), but increase lane count for wider screens
    const baseLaneWidth = 68;
    return baseLaneWidth;
}

// Dynamically calculate lane count based on slope width
function getTerrainLaneCount() {
    const slopeWidth = getTerrainSlopeWidth();
    const baseLaneWidth = 68;
    // Calculate how many lanes fit, minimum 7 for portrait, scales up for widescreen
    return Math.max(7, Math.floor(slopeWidth / baseLaneWidth));
}

// Jump variety system - snow jumps like Red Bull tournament kickers
// Size differentiation through width, not color. All jumps are snow-colored
const JUMP_TYPES = {
    small:  { width: 40, height: 14, power: 0.7, color: 'snow', glow: false },
    medium: { width: 55, height: 22, power: 1.0, color: 'snow', glow: false },
    large:  { width: 80, height: 32, power: 1.4, color: 'snow', glow: true },
    mega:   { width: 110, height: 45, power: 1.8, color: 'snow', glow: true },
    // MASSIVE jump - rare, launches player into 1080+ territory
    massive: { width: 140, height: 60, power: 3.0, color: 'snow', glow: true, massive: true }
};

const TRICKS = {
    spin180: { name: '180', minRot: 150, maxRot: 210, points: 100 },
    spin360: { name: '360', minRot: 330, maxRot: 390, points: 250 },
    spin540: { name: '540', minRot: 510, maxRot: 570, points: 500 },
    spin720: { name: '720!', minRot: 690, maxRot: 750, points: 1000 },
    spin900: { name: '900!!', minRot: 870, maxRot: 930, points: 2000 },
    spin1080: { name: '1080!!!', minRot: 1050, maxRot: 1110, points: 4000 },
    spin1260: { name: '1260!!!!', minRot: 1230, maxRot: 1290, points: 6000 },
    spin1440: { name: '1440 INSANE', minRot: 1410, maxRot: 1470, points: 10000 },
    shortGrind: { name: 'Grind', minLen: 0, maxLen: 120, points: 50 },
    longGrind: { name: 'Rail Slide', minLen: 120, maxLen: 250, points: 150 },
    epicGrind: { name: 'EPIC GRIND', minLen: 250, maxLen: 9999, points: 400 }
};

// Automatic trick animations when airborne - expanded variety
const AUTO_TRICKS = [
    // Grabs (most common - happen on any decent jump)
    { name: 'Indy Grab', type: 'grab', grabStyle: 'indy', points: 100 },
    { name: 'Method', type: 'grab', grabStyle: 'method', points: 125 },
    { name: 'Melon', type: 'grab', grabStyle: 'melon', points: 125 },
    { name: 'Tail Grab', type: 'grab', grabStyle: 'tail', points: 100 },
    { name: 'Nose Grab', type: 'grab', grabStyle: 'nose', points: 100 },
    { name: 'Stalefish', type: 'grab', grabStyle: 'stale', points: 150 },
    { name: 'Mute', type: 'grab', grabStyle: 'mute', points: 125 },
    { name: 'Roast Beef', type: 'grab', grabStyle: 'roastbeef', points: 175 },
    { name: 'Japan Air', type: 'grab', grabStyle: 'japan', points: 175 },
    { name: 'Crail', type: 'grab', grabStyle: 'crail', points: 150 },
    // Tweaked grabs (stylized versions)
    { name: 'Tweaked Method', type: 'grab', grabStyle: 'method', tweaked: true, points: 175 },
    { name: 'Poked Tail', type: 'grab', grabStyle: 'tail', poked: true, points: 150 },
    // Flips (medium jumps)
    { name: 'Backflip', type: 'flip', flipSpeed: 500, points: 200 },
    { name: 'Front Flip', type: 'flip', flipSpeed: -500, points: 200 },
    { name: 'Wildcat', type: 'flip', flipSpeed: 450, backflip: true, points: 225 },
    { name: 'Tamedog', type: 'flip', flipSpeed: -450, frontflip: true, points: 225 },
    // Spins (only when player initiates direction)
    { name: '360', type: 'spin', rotSpeed: 720, points: 150, requiresInput: true },
    { name: '540', type: 'spin', rotSpeed: 900, points: 250, requiresInput: true },
    { name: '720', type: 'spin', rotSpeed: 1080, points: 400, requiresInput: true },
    // Combo tricks (big jumps only)
    { name: 'Cork 540', type: 'combo', rotSpeed: 540, flipSpeed: 200, points: 350 },
    { name: 'Cork 720', type: 'combo', rotSpeed: 720, flipSpeed: 250, points: 500 },
    { name: 'Rodeo 540', type: 'combo', rotSpeed: 540, flipSpeed: -200, points: 375 },
    { name: 'McTwist', type: 'combo', rotSpeed: 540, flipSpeed: 300, inverted: true, points: 450 },
    { name: 'Double Cork', type: 'combo', rotSpeed: 720, flipSpeed: 400, points: 750 }
];

const CHASE = {
    fogStartOffset: -300,       // Starts closer
    fogBaseSpeed: 150,          // Faster
    fogAcceleration: 1.5,       // Was 1.2 - fog catches up faster
    beastSpawnDistance: 300,    // Was 500 - spawns earlier (~3 seconds)
    beastSpeed: 1.4,            // 40% faster than player!
    beastLungeInterval: 1.8,    // Was 2.0 - more frequent lunges
    beastLungeVariance: 0.8,    // Was 1.0 - less random delay
    beastLungeDuration: 0.35,
    beastRetreatDuration: 0.5,  // Was 0.6 - shorter retreat
    // Crash/slow triggers
    crashThreshold: 2,          // Was 3 - 2 crashes = instant beast
    crashWindow: 12,            // Was 10 - longer window to track crashes
    slowSpeedThreshold: 150,    // Was 120 - easier to trigger
    slowSpeedDuration: 1.5      // Was 2.0 - less time needed
};

// Ski Lodge configuration - rare safe haven from the beast
const LODGE = {
    width: 180,                 // Lodge building width
    height: 140,                // Lodge building height
    stairsWidth: 50,            // Width of entrance stairs
    stairsHeight: 30,           // Height/depth of stairs
    doorWidth: 36,              // Door hitbox width
    doorHeight: 50,             // Door hitbox height
    // Entrance ramp (points UP the mountain so player can snowboard in)
    rampWidth: 80,              // Width of entrance ramp
    rampLength: 100,            // Length of ramp leading to lodge
    spawnChance: 0.025,         // 2.5% chance per chunk (very rare)
    minSpawnDistance: 1500,     // Only spawn after 1500 units traveled
    minLodgeSpacing: 3000,      // Minimum distance between lodges
    // Interior settings
    interiorWidth: 400,         // Lodge interior room width
    interiorHeight: 300,        // Lodge interior room height
    walkSpeed: 150,             // Player walking speed inside
    maxStayTime: 12,            // Seconds before forced to leave
    warningTime: 3,             // Seconds of warning before forced exit
    exitInvincibility: 2.0      // Invincibility duration after exiting
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
    screen: 'title', // 'title', 'playing', 'gameOver', 'lodge'
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
        currentGrindable: null, // For varied grindable objects
        crashed: false,
        crashTimer: 0,
        stunned: 0,
        invincible: 0,
        trickRotation: 0,
        // Auto trick state
        autoTrick: null,
        autoTrickProgress: 0,
        flipRotation: 0,
        grabPhase: 0,
        grabTweak: 0,      // Extra tweak extension for styled grabs
        grabPoke: 0,       // Poked leg extension
        // Jump animation state
        spinDirection: 0,   // -1 = left, 0 = none, 1 = right
        preJumpAngle: 0,    // Angle before jumping (to maintain orientation)
        jumpLaunchPower: 0, // How big the jump is
        preloadCrouch: 0,   // Crouch animation before launch (0-1)
        approachingJump: null // Jump we're about to hit
    },

    camera: {
        y: 0,
        targetY: 0,
        lookAhead: 150
    },

    terrain: {
        chunks: [],
        nextChunkY: 0,
        seed: 0,
        lastLodgeY: -9999  // Track last lodge spawn position
    },

    obstacles: [],
    jumps: [],
    rails: [],
    lodges: [],  // Ski lodge buildings

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

    // Lodge interior state
    lodge: {
        active: false,
        timeInside: 0,
        playerX: 0,
        playerY: 0,
        currentLodge: null,     // Reference to the lodge we entered
        warningShown: false
    },

    score: 0,
    distance: 0,
    trickScore: 0,
    trickMultiplier: 1,
    trickComboTimer: 0,
    maxCombo: 1,
    comboChainLength: 0,

    // Collectibles
    collectibles: [],
    boostPads: [],
    collectiblesCollected: 0,

    // Flow state - reward consistent good play
    flowMeter: 0,        // 0-100, builds with tricks/near-misses
    flowMultiplier: 1,   // Extra score multiplier when in flow
    nearMissStreak: 0,   // Consecutive near-misses

    // Speed streak
    speedStreak: 0,      // Time spent at high speed
    speedBonus: 0,       // Accumulated speed bonus points

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
    up: false,
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
            case 'ArrowUp':
            case 'KeyW':
                input.up = true;
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
            case 'ArrowUp':
            case 'KeyW':
                input.up = false;
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

function addCelebration(text, color, subtext = '') {
    gameState.celebrations.push({
        text: text,
        subtext: subtext,
        color: color || getNeonColor(),
        timer: 1.5,
        scale: 1.0
    });
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
        rails: [],
        lodges: []
    };

    const distance = chunk.y / 100;
    const density = Math.min(
        TERRAIN.baseDensity + (distance / TERRAIN.densityRampDistance) * (TERRAIN.maxDensity - TERRAIN.baseDensity),
        TERRAIN.maxDensity
    );

    const baseSeed = gameState.terrain.seed + chunkIndex * 1000;

    const gridRows = Math.floor(TERRAIN.chunkHeight / 80);
    const gridCols = getTerrainLaneCount(); // Dynamic lane count for widescreen support

    // Track cells used by clusters, jumps, rails, and landing zones to avoid overlaps
    const usedCells = new Set();

    // ===== PHASE 1: Generate jumps and rails FIRST =====
    // This allows us to calculate landing zones before placing obstacles

    // Temporary storage for jumps and rails generated in grid pass
    const tempJumps = [];
    const tempRails = [];

    // Helper to check if position is too close to existing jumps/rails
    function isTooCloseToJumpsOrRails(x, y, minDist = 150) {
        for (const jump of tempJumps) {
            const dist = Math.sqrt(Math.pow(x - jump.x, 2) + Math.pow(y - jump.y, 2));
            if (dist < minDist) return true;
        }
        for (const rail of tempRails) {
            // Check distance to rail start and end
            const distStart = Math.sqrt(Math.pow(x - rail.x, 2) + Math.pow(y - rail.y, 2));
            const distEnd = Math.sqrt(Math.pow(x - rail.endX, 2) + Math.pow(y - rail.endY, 2));
            if (distStart < minDist || distEnd < minDist) return true;
        }
        return false;
    }

    // First pass: determine where jumps and rails will go
    for (let row = 0; row < gridRows; row++) {
        const rowSeed = baseSeed + row * 100;
        for (let col = 0; col < gridCols; col++) {
            const cellSeed = rowSeed + col;
            const rng = seededRandom(cellSeed);

            const jumpX = (col - gridCols / 2 + 0.5) * TERRAIN.laneWidth;
            const jumpY = chunk.y + row * 80;

            // Check for MASSIVE jump first (very rare)
            if (rng >= density && rng < density + TERRAIN.massiveJumpChance) {
                // Only spawn if not too close to other jumps/rails
                if (!isTooCloseToJumpsOrRails(jumpX, jumpY, 200)) {
                    const jumpType = JUMP_TYPES.massive;
                    tempJumps.push({
                        x: jumpX,
                        y: jumpY,
                        width: jumpType.width,
                        height: jumpType.height,
                        launchPower: jumpType.power,
                        color: jumpType.color,
                        glow: jumpType.glow,
                        type: 'massive',
                        massive: true,
                        col: col,
                        row: row
                    });
                }
            } else if (rng >= density + TERRAIN.massiveJumpChance && rng < density + TERRAIN.massiveJumpChance + TERRAIN.jumpChance) {
                // Regular jumps - only spawn if not too close to other jumps/rails
                if (!isTooCloseToJumpsOrRails(jumpX, jumpY, 150)) {
                    // Select jump type based on weighted random
                    const typeRng = seededRandom(cellSeed + 0.6);
                    let jumpType;
                    if (typeRng < 0.50) jumpType = JUMP_TYPES.small;
                    else if (typeRng < 0.80) jumpType = JUMP_TYPES.medium;
                    else if (typeRng < 0.95) jumpType = JUMP_TYPES.large;
                    else jumpType = JUMP_TYPES.mega;

                    tempJumps.push({
                        x: jumpX,
                        y: jumpY,
                        width: jumpType.width,
                        height: jumpType.height,
                        launchPower: jumpType.power,
                        color: jumpType.color,
                        glow: jumpType.glow,
                        type: jumpType === JUMP_TYPES.mega ? 'mega' : jumpType === JUMP_TYPES.large ? 'large' : 'normal',
                        col: col,
                        row: row
                    });
                }
            } else if (rng >= density + TERRAIN.massiveJumpChance + TERRAIN.jumpChance &&
                       rng < density + TERRAIN.massiveJumpChance + TERRAIN.jumpChance + TERRAIN.railChance) {
                // Rails - must be mostly VERTICAL (player goes DOWN the mountain)
                const railLength = 100 + seededRandom(cellSeed + 0.8) * 150;

                // FIXED: Rails should be mostly vertical with only slight horizontal drift
                // Max horizontal drift is 20% of rail length to ensure grindable
                const maxDrift = railLength * 0.15;
                const horizontalDrift = (seededRandom(cellSeed + 0.9) - 0.5) * maxDrift;

                const railX = (col - gridCols / 2 + 0.5) * TERRAIN.laneWidth;
                const railY = chunk.y + row * 80;

                const newRail = {
                    x: railX,
                    y: railY,
                    endX: railX + horizontalDrift,  // Mostly vertical with slight drift
                    endY: railY + railLength,       // Always goes DOWN (positive Y)
                    length: railLength,
                    col: col,
                    endColApprox: col
                };

                // Check for collision with existing rails AND jumps
                let collides = isTooCloseToJumpsOrRails(railX, railY, 150);

                if (!collides) {
                    // Also check rail-to-rail collision
                    const minDistX = 80;
                    const minDistY = 150;

                    for (const existingRail of tempRails) {
                        const xDist = Math.abs(newRail.x - existingRail.x);
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
                }

                if (!collides) {
                    tempRails.push(newRail);
                }
            }
        }
    }

    // 2% chance per chunk to spawn a guaranteed MASSIVE jump (for 1080+ tricks)
    // Only if no massive jump already exists in this chunk
    const hasMassive = tempJumps.some(j => j.massive);
    if (!hasMassive && seededRandom(baseSeed + 999) < 0.02) {
        const massiveLane = Math.floor(seededRandom(baseSeed + 998) * (gridCols - 2)) + 1;
        const massiveX = (massiveLane - gridCols / 2 + 0.5) * TERRAIN.laneWidth;
        const massiveY = chunk.y + 200 + seededRandom(baseSeed + 997) * 200;

        // Only add if not too close to existing jumps/rails
        if (!isTooCloseToJumpsOrRails(massiveX, massiveY, 200)) {
            const jumpType = JUMP_TYPES.massive;
            tempJumps.push({
                x: massiveX,
                y: massiveY,
                width: jumpType.width,
                height: jumpType.height,
                launchPower: jumpType.power,
                color: jumpType.color,
                glow: jumpType.glow,
                type: 'massive',
                massive: true,
                col: massiveLane,
                row: Math.floor((massiveY - chunk.y) / 80)
            });
        }
    }

    // ===== PHASE 2: Calculate landing zones and mark cells =====

    // Mark jump landing zones as used (prevents obstacles from spawning there)
    for (const jump of tempJumps) {
        // Landing distance depends on jump power: small=80px, medium=100px, large=140px, mega=180px
        const landingDistance = 60 + jump.launchPower * 80;
        const landingY = jump.y + landingDistance;
        const landingRow = Math.floor((landingY - chunk.y) / 80);
        const jumpCol = Math.round((jump.x / TERRAIN.laneWidth) + gridCols / 2 - 0.5);

        // Mark landing zone cells (±1 lane for safety margin, 2 rows deep)
        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = 0; dy <= 2; dy++) {
                const cellRow = landingRow + dy;
                const cellCol = jumpCol + dx;
                if (cellRow >= 0 && cellRow < gridRows && cellCol >= 0 && cellCol < gridCols) {
                    usedCells.add(`${cellRow},${cellCol}`);
                }
            }
        }

        // Also mark the jump's own cell
        const jumpRow = Math.floor((jump.y - chunk.y) / 80);
        if (jumpRow >= 0 && jumpRow < gridRows) {
            usedCells.add(`${jumpRow},${jumpCol}`);
        }

        // Add jump to chunk (remove temp properties)
        chunk.jumps.push({
            x: jump.x,
            y: jump.y,
            width: jump.width,
            height: jump.height,
            launchPower: jump.launchPower,
            color: jump.color,
            glow: jump.glow,
            type: jump.type,
            massive: jump.massive || false
        });
    }

    // Mark rail endpoints as used (prevents obstacles from spawning at dismount points)
    for (let railIdx = 0; railIdx < tempRails.length; railIdx++) {
        const rail = tempRails[railIdx];
        const endRow = Math.floor((rail.endY - chunk.y) / 80);
        const endCol = Math.round(rail.endColApprox);

        // Mark rail endpoint zone (±1 lane for safety margin, 2 rows deep)
        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = 0; dy <= 2; dy++) {
                const cellRow = endRow + dy;
                const cellCol = endCol + dx;
                if (cellRow >= 0 && cellRow < gridRows && cellCol >= 0 && cellCol < gridCols) {
                    usedCells.add(`${cellRow},${cellCol}`);
                }
            }
        }

        // Randomly select grindable type with more variety
        const grindableTypes = ['rail', 'rail', 'funbox', 'log', 'bench', 'kinked', 'rail'];
        const typeIndex = Math.floor(seededRandom(baseSeed + railIdx * 100 + 50) * grindableTypes.length);
        const grindableType = grindableTypes[typeIndex];

        // Add rail to chunk (remove temp properties)
        chunk.rails.push({
            x: rail.x,
            y: rail.y,
            endX: rail.endX,
            endY: rail.endY,
            length: rail.length,
            grindableType: grindableType
        });
    }

    // ===== PHASE 3: Generate tree clusters (larger and more frequent) =====

    // 50% chance to spawn a PRIMARY tree cluster per chunk (8-15 trees)
    if (seededRandom(baseSeed + 777) < 0.50) {
        const clusterSeed = baseSeed + 778;
        const clusterRow = 1 + Math.floor(seededRandom(clusterSeed) * (gridRows - 3));
        const clusterCol = 1 + Math.floor(seededRandom(clusterSeed + 1) * (gridCols - 2));
        const clusterSize = 8 + Math.floor(seededRandom(clusterSeed + 2) * 8); // 8-15 trees

        // Generate cluster pattern (tight group of trees with wider spread)
        for (let i = 0; i < clusterSize; i++) {
            const offsetX = (seededRandom(clusterSeed + 10 + i) - 0.5) * 3.5; // -1.75 to 1.75 lanes (wider)
            const offsetY = (seededRandom(clusterSeed + 20 + i) - 0.5) * 2.5; // -1.25 to 1.25 rows
            const treeCol = clusterCol + offsetX;
            const treeRow = clusterRow + offsetY;

            // Bounds check
            if (treeCol < 0.5 || treeCol > gridCols - 0.5) continue;
            if (treeRow < 0 || treeRow >= gridRows) continue;

            const cellKey = `${Math.floor(treeRow)},${Math.floor(treeCol)}`;
            if (usedCells.has(cellKey)) continue; // Skip if in landing zone
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

    // 40% chance for SECONDARY tree cluster (6-10 trees)
    if (seededRandom(baseSeed + 888) < 0.40) {
        const clusterSeed = baseSeed + 889;
        const clusterRow = Math.floor(gridRows / 2) + Math.floor(seededRandom(clusterSeed) * (gridRows / 2 - 1));
        const clusterCol = Math.floor(seededRandom(clusterSeed + 1) * (gridCols - 1));
        const clusterSize = 6 + Math.floor(seededRandom(clusterSeed + 2) * 5); // 6-10 trees

        for (let i = 0; i < clusterSize; i++) {
            const offsetX = (seededRandom(clusterSeed + 50 + i) - 0.5) * 2.5;
            const offsetY = (seededRandom(clusterSeed + 60 + i) - 0.5) * 2;
            const treeCol = clusterCol + offsetX;
            const treeRow = clusterRow + offsetY;

            if (treeCol < 0.5 || treeCol > gridCols - 0.5) continue;
            if (treeRow < 0 || treeRow >= gridRows) continue;

            const cellKey = `${Math.floor(treeRow)},${Math.floor(treeCol)}`;
            if (usedCells.has(cellKey)) continue; // Skip if in landing zone
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

    // 30% chance for TERTIARY tree cluster (5-8 trees)
    if (seededRandom(baseSeed + 666) < 0.30) {
        const clusterSeed = baseSeed + 667;
        const clusterRow = Math.floor(seededRandom(clusterSeed) * (gridRows - 2)) + 1;
        const clusterCol = Math.floor(seededRandom(clusterSeed + 1) * (gridCols - 2)) + 1;
        const clusterSize = 5 + Math.floor(seededRandom(clusterSeed + 2) * 4); // 5-8 trees

        for (let i = 0; i < clusterSize; i++) {
            const offsetX = (seededRandom(clusterSeed + 80 + i) - 0.5) * 2;
            const offsetY = (seededRandom(clusterSeed + 90 + i) - 0.5) * 1.5;
            const treeCol = clusterCol + offsetX;
            const treeRow = clusterRow + offsetY;

            if (treeCol < 0.5 || treeCol > gridCols - 0.5) continue;
            if (treeRow < 0 || treeRow >= gridRows) continue;

            const cellKey = `${Math.floor(treeRow)},${Math.floor(treeCol)}`;
            if (usedCells.has(cellKey)) continue;
            usedCells.add(cellKey);

            chunk.obstacles.push({
                x: (treeCol - gridCols / 2) * TERRAIN.laneWidth,
                y: chunk.y + treeRow * 80 + seededRandom(clusterSeed + 100 + i) * 20,
                type: 'tree',
                width: 22,
                height: 38,
                isCluster: true
            });
        }
    }

    // ===== PHASE 4: Generate scattered obstacles (respecting landing zones) =====

    for (let row = 0; row < gridRows; row++) {
        const rowSeed = baseSeed + row * 100;
        const clearLane = Math.floor(seededRandom(rowSeed) * gridCols);

        for (let col = 0; col < gridCols; col++) {
            if (Math.abs(col - clearLane) < TERRAIN.clearPathWidth) continue;

            // Skip cells used by clusters, jumps, rails, or landing zones
            const cellKey = `${row},${col}`;
            if (usedCells.has(cellKey)) continue;

            const cellSeed = rowSeed + col;
            const rng = seededRandom(cellSeed);

            // Only spawn obstacles (jumps/rails already handled in Phase 1)
            if (rng < density) {
                const types = ['tree', 'tree', 'rock'];
                if (distance > 800) types.push('rock', 'mogul');
                if (distance > 2000) types.push('mogul');

                const typeIndex = Math.floor(seededRandom(cellSeed + 0.5) * types.length);
                const obstacleType = types[typeIndex];

                // Dynamic rock sizing: 50% small, 35% medium, 15% large boulder
                let rockWidth = 32, rockHeight = 24;
                if (obstacleType === 'rock') {
                    const sizeRng = seededRandom(cellSeed + 0.7);
                    if (sizeRng < 0.50) {
                        // Small rock (current size)
                        rockWidth = 32; rockHeight = 24;
                    } else if (sizeRng < 0.85) {
                        // Medium rock
                        rockWidth = 48; rockHeight = 36;
                    } else {
                        // Large boulder
                        rockWidth = 64; rockHeight = 48;
                    }
                }

                chunk.obstacles.push({
                    x: (col - gridCols / 2 + 0.5) * TERRAIN.laneWidth,
                    y: chunk.y + row * 80 + seededRandom(cellSeed + 0.3) * 30,
                    type: obstacleType,
                    width: obstacleType === 'tree' ? 24 : obstacleType === 'rock' ? rockWidth : 40,
                    height: obstacleType === 'tree' ? 40 : obstacleType === 'rock' ? rockHeight : 16
                });
            }
        }
    }

    // ===== PHASE 5: Generate Ski Lodges (very rare) =====
    // Only spawn after minimum distance and with proper spacing
    const chunkCenterY = chunk.y + TERRAIN.chunkHeight / 2;
    const distanceFromStart = chunk.y;
    const distanceFromLastLodge = chunkCenterY - gameState.terrain.lastLodgeY;

    if (distanceFromStart >= LODGE.minSpawnDistance &&
        distanceFromLastLodge >= LODGE.minLodgeSpacing &&
        seededRandom(baseSeed + 5555) < LODGE.spawnChance) {

        const lodgeSeed = baseSeed + 5556;
        // Place lodge in center-ish area (avoid edges)
        const lodgeCol = 1 + Math.floor(seededRandom(lodgeSeed) * (gridCols - 3));
        const lodgeRow = 1 + Math.floor(seededRandom(lodgeSeed + 1) * (gridRows - 3));
        const lodgeX = (lodgeCol - gridCols / 2 + 0.5) * TERRAIN.laneWidth;
        const lodgeY = chunk.y + lodgeRow * 80;

        // Mark large exclusion zone around lodge (no obstacles)
        const lodgeLaneSpan = Math.ceil(LODGE.width / TERRAIN.laneWidth) + 1;
        const lodgeRowSpan = Math.ceil(LODGE.height / 80) + 2;
        for (let dx = -lodgeLaneSpan; dx <= lodgeLaneSpan; dx++) {
            for (let dy = -1; dy <= lodgeRowSpan + 2; dy++) {
                const cellRow = lodgeRow + dy;
                const cellCol = lodgeCol + dx;
                if (cellRow >= 0 && cellRow < gridRows && cellCol >= 0 && cellCol < gridCols) {
                    usedCells.add(`${cellRow},${cellCol}`);
                }
            }
        }

        chunk.lodges.push({
            x: lodgeX,
            y: lodgeY,
            width: LODGE.width,
            height: LODGE.height,
            // Door position (centered at bottom of lodge, on stairs)
            doorX: lodgeX,
            doorY: lodgeY + LODGE.height - LODGE.doorHeight / 2,
            doorWidth: LODGE.doorWidth,
            doorHeight: LODGE.doorHeight,
            // Stairs position (back exit)
            stairsX: lodgeX,
            stairsY: lodgeY + LODGE.height,
            stairsWidth: LODGE.stairsWidth,
            stairsHeight: LODGE.stairsHeight,
            // Entrance ramp (ABOVE lodge, pointing UP the mountain)
            rampX: lodgeX,
            rampY: lodgeY - LODGE.rampLength,  // Ramp starts above lodge
            rampWidth: LODGE.rampWidth,
            rampLength: LODGE.rampLength
        });

        // Update last lodge position
        gameState.terrain.lastLodgeY = lodgeY;
    }

    // ===== PHASE 6: Generate collectibles (snowflakes) =====
    chunk.collectibles = [];
    const collectibleCount = 3 + Math.floor(seededRandom(baseSeed + 2000) * 5); // 3-7 per chunk
    for (let i = 0; i < collectibleCount; i++) {
        const colX = (seededRandom(baseSeed + 2001 + i) - 0.5) * (TERRAIN.slopeWidth - 40);
        const colY = chunk.y + seededRandom(baseSeed + 2100 + i) * TERRAIN.chunkHeight;
        const cellKey = `${Math.floor((colY - chunk.y) / 80)},${Math.floor((colX / TERRAIN.laneWidth) + gridCols / 2)}`;

        // Don't spawn in used cells or too close to obstacles
        if (!usedCells.has(cellKey)) {
            chunk.collectibles.push({
                x: colX,
                y: colY,
                type: seededRandom(baseSeed + 2200 + i) < 0.15 ? 'big' : 'normal', // 15% chance for big
                collected: false
            });
        }
    }

    // ===== PHASE 7: Generate boost pads =====
    chunk.boostPads = [];
    if (seededRandom(baseSeed + 3000) < 0.3) { // 30% chance per chunk
        const boostX = (seededRandom(baseSeed + 3001) - 0.5) * (TERRAIN.slopeWidth - 100);
        const boostY = chunk.y + 200 + seededRandom(baseSeed + 3002) * (TERRAIN.chunkHeight - 300);
        const cellKey = `${Math.floor((boostY - chunk.y) / 80)},${Math.floor((boostX / TERRAIN.laneWidth) + gridCols / 2)}`;

        if (!usedCells.has(cellKey)) {
            chunk.boostPads.push({
                x: boostX,
                y: boostY,
                width: 60,
                height: 25,
                boostAmount: 200 + seededRandom(baseSeed + 3003) * 100 // 200-300 speed boost
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
        gameState.lodges.push(...newChunk.lodges);
        if (newChunk.collectibles) gameState.collectibles.push(...newChunk.collectibles);
        if (newChunk.boostPads) gameState.boostPads.push(...newChunk.boostPads);

        terrain.nextChunkY += TERRAIN.chunkHeight;
    }

    const cullY = camera.y - CANVAS_HEIGHT;
    terrain.chunks = terrain.chunks.filter(c => c.y + TERRAIN.chunkHeight > cullY);
    gameState.obstacles = gameState.obstacles.filter(o => o.y > cullY);
    gameState.jumps = gameState.jumps.filter(j => j.y > cullY);
    gameState.rails = gameState.rails.filter(r => r.endY > cullY);
    gameState.lodges = gameState.lodges.filter(l => l.y + l.height > cullY);
    gameState.collectibles = gameState.collectibles.filter(c => c.y > cullY && !c.collected);
    gameState.boostPads = gameState.boostPads.filter(b => b.y > cullY);
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

    // Up = slow down (carving uphill), Down = crouch/tuck and accelerate to max speed
    if (input.up) {
        // Slowing down - carving back up the mountain
        player.speed -= PHYSICS.downhillAccel * 0.8 * dt;
        player.speed = Math.max(player.speed, PHYSICS.minSpeed);
    } else if (input.down) {
        // Crouching/tucking - rapidly accelerate toward max speed
        player.speed += PHYSICS.downhillAccel * 3.0 * dt;
        player.speed = Math.min(player.speed, PHYSICS.maxSpeed);
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

    // Extra snow spray when braking (pressing UP) - stopping motion creates more spray
    if (input.up && player.speed > 150 && Math.random() < 0.5) {
        spawnSnowSpray(player.x, player.y, Math.random() > 0.5 ? 1 : -1);
    }

    updateVisualPosition(player, dt);
}

function updateAirbornePhysics(player, dt) {
    const inputDir = getInputDirection();

    player.airTime += dt;

    // Air control (reduced)
    player.lateralSpeed += inputDir * 150 * PHYSICS.airControlFactor * dt;
    player.lateralSpeed *= PHYSICS.airFriction;

    // Update spin direction if player presses direction mid-air
    if (inputDir !== 0 && player.spinDirection === 0) {
        player.spinDirection = inputDir;
    }

    // Manual trick rotation - only if player is actively spinning
    if (inputDir !== 0 && (!player.autoTrick || player.autoTrick.type === 'grab')) {
        player.trickRotation += inputDir * 400 * dt;
    }

    // Auto trick animation
    if (player.autoTrick) {
        const trick = player.autoTrick;
        player.autoTrickProgress += dt * 1.5; // Complete trick over ~0.67 seconds

        if (trick.type === 'spin' || trick.type === 'combo') {
            // Spin tricks - only spin if player has a spin direction
            if (player.spinDirection !== 0) {
                const spinDir = player.spinDirection;
                player.trickRotation += spinDir * trick.rotSpeed * dt;
            }
        }
        if (trick.type === 'flip' || trick.type === 'combo') {
            // Flip tricks - rotate around X axis (forward/back flip)
            player.flipRotation += (trick.flipSpeed || 0) * dt;
        }
        if (trick.type === 'grab') {
            // Grab tricks - oscillate grab phase (tweak/poke adds extra motion)
            const basePhase = Math.sin(player.autoTrickProgress * Math.PI);
            player.grabPhase = basePhase;
            // Tweaked grabs have extra extension
            if (trick.tweaked) {
                player.grabTweak = Math.sin(player.autoTrickProgress * Math.PI * 0.8) * 0.3;
            }
            // Poked grabs extend the leg
            if (trick.poked) {
                player.grabPoke = Math.sin(player.autoTrickProgress * Math.PI * 0.9) * 0.4;
            }
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
    const inputDir = getInputDirection();

    player.airborne = true;
    player.altitude = 1;
    player.verticalVelocity = PHYSICS.jumpLaunchPower * jump.launchPower * (player.speed / 400);
    player.trickRotation = 0;
    player.airTime = 0;
    player.spinDirection = inputDir; // Store spin direction at launch (0 = no spin)
    player.preJumpAngle = player.angle; // Remember orientation before jump
    player.jumpLaunchPower = jump.launchPower; // Store for animation reference
    player.massiveJump = jump.massive || false; // Track if this is a massive jump

    // Special celebration for MASSIVE jumps
    if (jump.massive) {
        gameState.celebrations.push({
            text: '🚀 MASSIVE LAUNCH!',
            subtext: 'GO FOR 1080+!',
            color: COLORS.yellow,
            timer: 2.0,
            scale: 1.3
        });
    }

    // Select trick based on jump power and input direction
    if (jump.launchPower >= 1.0) {
        // Filter tricks by type based on input
        let availableTricks;
        if (inputDir !== 0) {
            // Player is pressing direction - allow spin tricks
            availableTricks = AUTO_TRICKS.filter(t =>
                t.type === 'spin' || t.type === 'combo' || t.type === 'grab'
            );
        } else {
            // No direction input - only grabs and flips (no spins)
            availableTricks = AUTO_TRICKS.filter(t =>
                t.type === 'grab' || t.type === 'flip' ||
                (t.type === 'combo' && jump.launchPower >= 1.4) // Combos only on big jumps
            );
        }

        // Weight selection toward grabs for smaller jumps
        if (jump.launchPower < 1.2) {
            availableTricks = availableTricks.filter(t => t.type === 'grab' || t.type === 'flip');
        }

        const trickIndex = Math.floor(Math.random() * availableTricks.length);
        player.autoTrick = availableTricks[trickIndex] || AUTO_TRICKS[0];
        player.autoTrickProgress = 0;
        player.flipRotation = 0;
        player.grabPhase = 0;
    } else {
        // Small jumps - just a simple grab or nothing
        if (Math.random() < 0.6) {
            const grabs = AUTO_TRICKS.filter(t => t.type === 'grab');
            player.autoTrick = grabs[Math.floor(Math.random() * grabs.length)];
            player.autoTrickProgress = 0;
            player.grabPhase = 0;
        } else {
            player.autoTrick = null;
        }
        player.flipRotation = 0;
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
        // Fall back to manual spin detection - check in descending order (highest spins first)
        const absRot = Math.abs(player.trickRotation);
        // Sort tricks by minRot descending so we match the highest applicable spin
        const spinTricks = Object.entries(TRICKS)
            .filter(([id, trick]) => trick.minRot)
            .sort((a, b) => b[1].minRot - a[1].minRot);

        for (const [id, trick] of spinTricks) {
            if (absRot >= trick.minRot) {
                trickName = trick.name;
                trickPoints = trick.points;
                trickLanded = true;
                break;
            }
        }
    }

    // Big air bonus for long hang time
    const bigAirBonus = player.airTime > 1.5 ? 1.5 : (player.airTime > 1.0 ? 1.2 : 1.0);
    const bigAirText = bigAirBonus > 1.2 ? ' BIG AIR!' : (bigAirBonus > 1 ? ' Air!' : '');

    // Track combo chain length
    if (!gameState.comboChainLength) gameState.comboChainLength = 0;
    gameState.comboChainLength++;

    if (trickLanded) {
        const basePoints = Math.floor(trickPoints * bigAirBonus);
        const points = Math.floor(basePoints * gameState.trickMultiplier);
        gameState.score += points;

        // Enhanced celebration for combos
        let celebrationText = trickName + bigAirText;
        let celebrationColor = getNeonColor();
        if (gameState.comboChainLength >= 5) {
            celebrationText = 'INSANE ' + trickName + bigAirText;
            celebrationColor = COLORS.yellow;
        } else if (gameState.comboChainLength >= 3) {
            celebrationText = 'SICK ' + trickName + bigAirText;
            celebrationColor = COLORS.limeGreen;
        }

        gameState.celebrations.push({
            text: celebrationText,
            subtext: `+${points}`,
            color: celebrationColor,
            timer: 1.5,
            scale: 1.0 + (gameState.trickMultiplier - 1) * 0.15 + (gameState.comboChainLength - 1) * 0.05
        });

        gameState.trickMultiplier = Math.min(gameState.trickMultiplier + 0.5, 5);
        gameState.trickComboTimer = 2.5; // Longer window for combos
        gameState.maxCombo = Math.max(gameState.maxCombo, gameState.trickMultiplier);
    } else if (player.airTime > 0.4) {
        // Even without a trick, reward hang time
        const airPoints = Math.floor(player.airTime * 25 * gameState.trickMultiplier);
        gameState.score += airPoints;

        if (player.airTime > 0.8) {
            gameState.celebrations.push({
                text: 'AIR TIME',
                subtext: `+${airPoints}`,
                color: COLORS.electricBlue,
                timer: 1.0,
                scale: 0.8
            });
            // Small multiplier increase for big air even without tricks
            gameState.trickMultiplier = Math.min(gameState.trickMultiplier + 0.1, 5);
            gameState.trickComboTimer = 1.5;
        }
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
    const grindableType = rail.grindableType || 'rail';

    let trick = TRICKS.shortGrind;
    for (const [id, t] of Object.entries(TRICKS)) {
        if (t.minLen !== undefined && grindLength >= t.minLen && grindLength < t.maxLen) {
            trick = t;
        }
    }

    // Bonus points for different grindable types
    let typeBonus = 1.0;
    let typeName = '';
    switch (grindableType) {
        case 'funbox':
            typeBonus = 1.2;
            typeName = 'Box ';
            break;
        case 'log':
            typeBonus = 1.3;
            typeName = 'Log ';
            break;
        case 'bench':
            typeBonus = 1.15;
            typeName = 'Bench ';
            break;
        case 'kinked':
            typeBonus = 1.4;
            typeName = 'Kink ';
            break;
    }

    // Chain bonus: if we just landed from a jump (combo timer still high), extra points
    const chainBonus = gameState.trickComboTimer > 1.5 ? 1.5 : 1.0;
    const chainText = chainBonus > 1 ? ' CHAIN!' : '';

    const basePoints = Math.floor(trick.points * typeBonus);
    const points = Math.floor(basePoints * gameState.trickMultiplier * chainBonus);
    gameState.score += points;

    // Track combo chain length
    if (!gameState.comboChainLength) gameState.comboChainLength = 0;
    gameState.comboChainLength++;

    // Special celebration for long chains
    let celebrationText = typeName + trick.name;
    let celebrationColor = COLORS.cyan;
    if (gameState.comboChainLength >= 5) {
        celebrationText = 'LEGENDARY ' + typeName + trick.name;
        celebrationColor = COLORS.yellow;
    } else if (gameState.comboChainLength >= 3) {
        celebrationText = 'SICK ' + typeName + trick.name;
        celebrationColor = COLORS.limeGreen;
    }

    gameState.celebrations.push({
        text: celebrationText + chainText,
        subtext: `+${points}`,
        color: celebrationColor,
        timer: 1.2,
        scale: 1.0 + (gameState.comboChainLength - 1) * 0.1
    });

    // Grind adds to multiplier - more for special types
    const multiplierGain = 0.3 + (typeBonus - 1) * 0.5;
    gameState.trickMultiplier = Math.min(gameState.trickMultiplier + multiplierGain, 5);
    gameState.trickComboTimer = 2.5; // Slightly longer window for chaining

    player.grinding = false;
    player.currentRail = null;
    player.currentGrindable = null;
}

function triggerCrash(player) {
    if (player.invincible > 0) return;

    player.crashed = true;
    player.crashTimer = PHYSICS.crashDuration;
    player.speed *= PHYSICS.crashSpeedPenalty;

    spawnCrashParticles(player.x, player.y);
    triggerScreenShake(12, 0.85);

    // Reset combo and chain
    gameState.trickMultiplier = 1;
    gameState.trickComboTimer = 0;
    gameState.comboChainLength = 0;

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

// Check if player is approaching a jump (for crouch animation)
function checkApproachingJump(player, dt) {
    if (player.airborne || player.grinding || player.crashed) {
        player.approachingJump = null;
        player.preloadCrouch = 0;
        return;
    }

    // Look for jumps ahead
    const lookAheadDist = 80; // pixels ahead to start crouch
    let nearestJump = null;
    let nearestDist = Infinity;

    for (const jump of gameState.jumps) {
        // Only consider jumps ahead of us and within lane
        const distY = jump.y - player.y;
        if (distY < 0 || distY > lookAheadDist) continue;
        if (Math.abs(jump.x - player.x) > jump.width * 0.8) continue;

        if (distY < nearestDist) {
            nearestDist = distY;
            nearestJump = jump;
        }
    }

    player.approachingJump = nearestJump;

    // Animate crouch based on distance
    if (nearestJump) {
        // Crouch intensifies as we get closer
        const crouchTarget = 1 - (nearestDist / lookAheadDist);
        player.preloadCrouch = lerp(player.preloadCrouch, crouchTarget, 12 * dt);
    } else {
        // Smoothly release crouch
        player.preloadCrouch = lerp(player.preloadCrouch, 0, 8 * dt);
    }
}

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

    // Check lodges
    for (const lodge of gameState.lodges) {
        // Quick distance check - include ramp area above lodge
        if (Math.abs(lodge.y + lodge.height / 2 - player.y) > lodge.height + lodge.rampLength) continue;
        if (Math.abs(lodge.x - player.x) > lodge.width) continue;

        const px = player.x, py = player.y;
        const pw = 20, ph = 20;

        // Check entrance RAMP collision (main entry point - ramp above lodge pointing UP mountain)
        // Player snowboards DOWN the mountain and hits this ramp to enter
        const rampLeft = lodge.rampX - lodge.rampWidth / 2;
        const rampRight = lodge.rampX + lodge.rampWidth / 2;
        const rampTop = lodge.rampY;  // Top of ramp (furthest up mountain)
        const rampBottom = lodge.y;   // Bottom of ramp connects to lodge top

        // If player hits the entrance ramp area, enter the lodge
        if (px > rampLeft && px < rampRight &&
            py > rampTop && py < rampBottom + 30) {
            enterLodge(lodge);
            return;
        }

        // Check back door/stairs collision (secondary entry/exit point)
        const doorLeft = lodge.doorX - lodge.stairsWidth / 2;
        const doorRight = lodge.doorX + lodge.stairsWidth / 2;
        const doorTop = lodge.y + lodge.height - lodge.doorHeight;
        const doorBottom = lodge.y + lodge.height + lodge.stairsHeight;

        // If player hits the door/stairs area, enter the lodge
        if (px > doorLeft && px < doorRight &&
            py > doorTop && py < doorBottom + 20) {
            enterLodge(lodge);
            return;
        }

        // Check wall collision (crash if hitting sides of lodge)
        const lodgeLeft = lodge.x - lodge.width / 2;
        const lodgeRight = lodge.x + lodge.width / 2;
        const lodgeTop = lodge.y;
        const lodgeBottom = lodge.y + lodge.height;

        // Only check wall collision if NOT in the door/ramp zone
        if (px - pw / 2 < lodgeRight && px + pw / 2 > lodgeLeft &&
            py - ph / 2 < lodgeBottom && py + ph / 2 > lodgeTop) {
            // Check if we're in the door zone or ramp zone (don't crash)
            const inDoorZone = px > doorLeft - 10 && px < doorRight + 10 && py > doorTop - 20;
            const inRampZone = px > rampLeft - 10 && px < rampRight + 10 && py < rampBottom + 20;
            if (!inDoorZone && !inRampZone) {
                triggerCrash(player);
                return;
            }
        }
    }

    // Check collectibles
    for (const col of gameState.collectibles) {
        if (col.collected) continue;
        if (Math.abs(col.y - player.y) > 30) continue;
        if (Math.abs(col.x - player.x) > 25) continue;

        collectItem(col);
    }

    // Check boost pads
    for (const boost of gameState.boostPads) {
        if (Math.abs(boost.y - player.y) > 20) continue;
        if (Math.abs(boost.x - player.x) > boost.width / 2) continue;

        triggerBoost(player, boost);
    }

    // Check near-misses with obstacles
    checkNearMisses(player);
}

function collectItem(collectible) {
    if (collectible.collected) return;
    collectible.collected = true;

    const isBig = collectible.type === 'big';
    const basePoints = isBig ? 100 : 25;
    const points = Math.floor(basePoints * gameState.flowMultiplier);

    gameState.score += points;
    gameState.collectiblesCollected++;

    // Build flow meter
    gameState.flowMeter = Math.min(100, gameState.flowMeter + (isBig ? 15 : 5));

    // Spawn sparkle particles
    for (let i = 0; i < (isBig ? 8 : 4); i++) {
        gameState.particles.push({
            x: collectible.x + (Math.random() - 0.5) * 20,
            y: collectible.y + (Math.random() - 0.5) * 20,
            vx: (Math.random() - 0.5) * 150,
            vy: (Math.random() - 0.5) * 150 - 50,
            size: isBig ? 4 : 2,
            color: COLORS.yellow,
            alpha: 1,
            type: 'spark',
            life: 0.5
        });
    }

    if (isBig) {
        gameState.celebrations.push({
            text: 'BIG SNOWFLAKE!',
            subtext: `+${points}`,
            color: COLORS.yellow,
            timer: 1.0,
            scale: 1.0
        });
    }
}

function triggerBoost(player, boost) {
    // Only trigger once per pad (use cooldown)
    if (boost.lastTriggered && gameState.animationTime - boost.lastTriggered < 1.0) return;
    boost.lastTriggered = gameState.animationTime;

    player.speed = Math.min(PHYSICS.maxSpeed * 1.2, player.speed + boost.boostAmount);

    // Visual feedback
    triggerScreenShake(5, 0.3);

    // Spawn boost particles
    for (let i = 0; i < 10; i++) {
        gameState.particles.push({
            x: player.x + (Math.random() - 0.5) * 30,
            y: player.y + 20,
            vx: (Math.random() - 0.5) * 100,
            vy: -50 - Math.random() * 100,
            size: 3,
            color: COLORS.cyan,
            alpha: 1,
            type: 'spark',
            life: 0.4
        });
    }

    gameState.celebrations.push({
        text: 'BOOST!',
        subtext: '',
        color: COLORS.cyan,
        timer: 0.8,
        scale: 1.0
    });

    // Small flow bonus
    gameState.flowMeter = Math.min(100, gameState.flowMeter + 5);
}

function checkNearMisses(player) {
    // Check for near-misses with obstacles
    const nearMissThreshold = 35; // Close but not colliding

    for (const obs of gameState.obstacles) {
        const dist = Math.sqrt(
            Math.pow(obs.x - player.x, 2) +
            Math.pow(obs.y - player.y, 2)
        );

        // Near miss: close but not crashed
        if (dist < nearMissThreshold && dist > 20) {
            if (!obs.nearMissTriggered) {
                obs.nearMissTriggered = true;

                gameState.nearMissStreak++;
                const points = 25 * gameState.nearMissStreak;
                gameState.score += points;

                // Build flow meter
                gameState.flowMeter = Math.min(100, gameState.flowMeter + 8);

                if (gameState.nearMissStreak >= 3) {
                    gameState.celebrations.push({
                        text: `CLOSE CALL x${gameState.nearMissStreak}!`,
                        subtext: `+${points}`,
                        color: COLORS.limeGreen,
                        timer: 0.8,
                        scale: 0.9
                    });
                }
            }
        } else if (dist > nearMissThreshold + 20) {
            // Reset near-miss flag when far enough away
            obs.nearMissTriggered = false;
        }
    }
}

// ===================
// LODGE MECHANICS
// ===================

function enterLodge(lodge) {
    const player = gameState.player;

    // Save current position for when we exit
    gameState.lodge.active = true;
    gameState.lodge.timeInside = 0;
    gameState.lodge.currentLodge = lodge;
    gameState.lodge.warningShown = false;

    // Position player in center of lodge interior
    gameState.lodge.playerX = LODGE.interiorWidth / 2;
    gameState.lodge.playerY = LODGE.interiorHeight - 60;

    // Stop player momentum
    player.speed = 0;
    player.lateralSpeed = 0;

    // Change game state
    gameState.screen = 'lodge';

    // Show entry message
    addCelebration('SAFE HAVEN!', COLORS.cyan);
}

function exitLodge() {
    const player = gameState.player;
    const lodge = gameState.lodge.currentLodge;

    // Restore player to slope, positioned at lodge exit
    player.x = lodge.x;
    player.y = lodge.y + lodge.height + lodge.stairsHeight + 50;
    player.visualX = player.x;
    player.visualY = player.y;

    // Give some starting speed and invincibility
    player.speed = 200;
    player.invincible = LODGE.exitInvincibility;

    // Reset lodge state
    gameState.lodge.active = false;
    gameState.lodge.currentLodge = null;

    // Return to playing state
    gameState.screen = 'playing';

    // Show exit message
    addCelebration('BACK TO THE SLOPE!', COLORS.yellow);
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
            // Combo expired - celebrate if it was a good chain
            if (gameState.comboChainLength >= 3 && gameState.trickMultiplier > 1) {
                const chainBonus = Math.floor(gameState.comboChainLength * gameState.trickMultiplier * 50);
                gameState.score += chainBonus;
                gameState.celebrations.push({
                    text: `${gameState.comboChainLength}x CHAIN COMPLETE`,
                    subtext: `+${chainBonus} bonus`,
                    color: COLORS.yellow,
                    timer: 1.5,
                    scale: 1.2
                });
            }
            gameState.trickMultiplier = 1;
            gameState.comboChainLength = 0;
        }
    }

    // Flow meter decay
    if (gameState.flowMeter > 0) {
        gameState.flowMeter -= dt * 3; // Decays over time
        if (gameState.flowMeter < 0) gameState.flowMeter = 0;
    }

    // Flow multiplier based on flow meter
    gameState.flowMultiplier = 1 + (gameState.flowMeter / 100) * 0.5; // Up to 1.5x

    // Speed streak - reward maintaining high speed
    const player = gameState.player;
    if (player.speed > PHYSICS.maxSpeed * 0.75 && !player.crashed && !player.airborne) {
        gameState.speedStreak += dt;

        // Every 3 seconds at high speed, bonus points
        if (Math.floor(gameState.speedStreak) > Math.floor(gameState.speedStreak - dt) && gameState.speedStreak >= 3) {
            const speedBonus = 50;
            gameState.score += speedBonus;
            gameState.speedBonus += speedBonus;
            gameState.flowMeter = Math.min(100, gameState.flowMeter + 3);
        }
    } else if (player.speed < PHYSICS.maxSpeed * 0.5 || player.crashed) {
        gameState.speedStreak = Math.max(0, gameState.speedStreak - dt * 2);
    }

    // Near-miss streak decay
    if (gameState.nearMissStreak > 0 && gameState.trickComboTimer <= 0) {
        gameState.nearMissStreak = 0;
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

    // Lodge interior is a separate render
    if (gameState.screen === 'lodge') {
        drawLodgeInterior();
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

    // Draw boost pads (on ground)
    drawBoostPads();

    // Draw lodges (behind obstacles, in front of jumps)
    drawLodges();

    // Draw collectibles
    drawCollectibles();

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
    // Use cached gradient for performance - snow palette with subtle cyan/pink
    if (!gradientCache.background) {
        gradientCache.background = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
        gradientCache.background.addColorStop(0, COLORS.bgLight);    // Bright snow at top
        gradientCache.background.addColorStop(0.4, COLORS.bgMid);    // Mid-tone
        gradientCache.background.addColorStop(0.7, COLORS.snowCyan); // Cyan hint
        gradientCache.background.addColorStop(1, COLORS.bgDark);     // Slightly shadowed at bottom
    }
    ctx.fillStyle = gradientCache.background;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Draw diagonal snow streaks (like wind-swept powder) - cyan and pink hints
    const time = gameState.animationTime || 0;
    const scrollOffset = (gameState.camera.y * 0.2) % 80;

    // Cyan streaks (subtle)
    ctx.strokeStyle = 'rgba(0, 200, 220, 0.08)';
    ctx.lineWidth = 2;
    for (let y = -scrollOffset - 40; y < CANVAS_HEIGHT + 80; y += 60) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(CANVAS_WIDTH, y + CANVAS_WIDTH * 0.15);
        ctx.stroke();
    }

    // Pink streaks (even more subtle)
    ctx.strokeStyle = 'rgba(255, 180, 200, 0.06)';
    ctx.lineWidth = 3;
    for (let y = -scrollOffset - 20; y < CANVAS_HEIGHT + 80; y += 90) {
        ctx.beginPath();
        ctx.moveTo(0, y + 30);
        ctx.lineTo(CANVAS_WIDTH, y + 30 + CANVAS_WIDTH * 0.12);
        ctx.stroke();
    }

    // Snow texture lines (parallax) - subtle gray for depth
    ctx.strokeStyle = 'rgba(150, 180, 200, 0.12)';
    ctx.lineWidth = 1;
    const textureOffset = (gameState.camera.y * 0.3) % 40;
    for (let y = -textureOffset; y < CANVAS_HEIGHT + 40; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(CANVAS_WIDTH, y + 20);
        ctx.stroke();
    }

    // Draw side margins for landscape mode (snowy mountain scenery)
    const res = RESOLUTIONS[displaySettings.currentResolution];
    if (res && res.orientation === 'landscape') {
        const slopeWidth = getTerrainSlopeWidth();
        const marginWidth = (CANVAS_WIDTH - slopeWidth) / 2;

        if (marginWidth > 10) {
            // Left mountain margin - snowy with cyan shadow
            ctx.fillStyle = 'rgba(180, 210, 230, 0.6)';
            ctx.fillRect(0, 0, marginWidth - 5, CANVAS_HEIGHT);

            // Right mountain margin
            ctx.fillRect(CANVAS_WIDTH - marginWidth + 5, 0, marginWidth - 5, CANVAS_HEIGHT);

            // Mountain silhouette effect on sides - cooler, snowy tones
            const mountainGrad = ctx.createLinearGradient(0, 0, marginWidth, 0);
            mountainGrad.addColorStop(0, 'rgba(160, 190, 210, 0.8)');
            mountainGrad.addColorStop(0.5, 'rgba(180, 210, 230, 0.5)');
            mountainGrad.addColorStop(1, 'transparent');
            ctx.fillStyle = mountainGrad;
            ctx.fillRect(0, 0, marginWidth, CANVAS_HEIGHT);

            const mountainGradR = ctx.createLinearGradient(CANVAS_WIDTH, 0, CANVAS_WIDTH - marginWidth, 0);
            mountainGradR.addColorStop(0, 'rgba(160, 190, 210, 0.8)');
            mountainGradR.addColorStop(0.5, 'rgba(180, 210, 230, 0.5)');
            mountainGradR.addColorStop(1, 'transparent');
            ctx.fillStyle = mountainGradR;
            ctx.fillRect(CANVAS_WIDTH - marginWidth, 0, marginWidth, CANVAS_HEIGHT);
        }
    }
}

function drawTerrain() {
    // Only draw slope edge markers if slope doesn't fill the screen
    // In fullscreen widescreen mode, the entire screen is playable
    const slopeWidth = TERRAIN.slopeWidth;
    const leftEdge = CANVAS_WIDTH / 2 - slopeWidth / 2;
    const rightEdge = CANVAS_WIDTH / 2 + slopeWidth / 2;

    // Only draw edge markers if there's a visible margin (not full-width)
    if (leftEdge > 5) {
        ctx.strokeStyle = COLORS.cyan;
        ctx.lineWidth = 2;
        ctx.setLineDash([10, 10]);

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

        // ===== SNOW JUMP DESIGN (Red Bull tournament style) =====

        // Shadow - subtle blue-gray for snow shadows
        ctx.fillStyle = 'rgba(100, 130, 160, 0.35)';
        ctx.beginPath();
        ctx.ellipse(screen.x + 4, screen.y + 6, jump.width * 0.45, 8, 0, 0, Math.PI * 2);
        ctx.fill();

        // Subtle ambient glow for large/mega jumps - white/cyan, not neon
        // MASSIVE jumps get an intense golden glow
        if (jump.massive) {
            // Intense pulsing golden glow for MASSIVE jumps
            const glowPulse = 0.4 + Math.sin(time * 4 + jump.x * 0.01) * 0.2;
            const glowGrad = ctx.createRadialGradient(
                screen.x, screen.y - jump.height * 0.5,
                jump.width * 0.1,
                screen.x, screen.y - jump.height * 0.3,
                jump.width * 1.2
            );
            glowGrad.addColorStop(0, `rgba(255, 220, 100, ${glowPulse})`);
            glowGrad.addColorStop(0.5, `rgba(255, 180, 50, ${glowPulse * 0.5})`);
            glowGrad.addColorStop(1, 'rgba(255, 150, 0, 0)');
            ctx.fillStyle = glowGrad;
            ctx.beginPath();
            ctx.ellipse(screen.x, screen.y - jump.height * 0.3, jump.width * 0.9, jump.height * 0.8, 0, 0, Math.PI * 2);
            ctx.fill();

            // "1080+" indicator text
            ctx.fillStyle = `rgba(255, 200, 50, ${0.6 + Math.sin(time * 3) * 0.2})`;
            ctx.font = 'bold 12px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('★ 1080+ ★', screen.x, screen.y - jump.height - 15);
        } else if (jump.glow) {
            const glowPulse = 0.15 + Math.sin(time * 2 + jump.x * 0.01) * 0.08;
            const glowGrad = ctx.createRadialGradient(
                screen.x, screen.y - jump.height * 0.4,
                jump.width * 0.2,
                screen.x, screen.y - jump.height * 0.3,
                jump.width * 0.9
            );
            glowGrad.addColorStop(0, `rgba(220, 240, 255, ${glowPulse})`);
            glowGrad.addColorStop(1, 'rgba(200, 230, 250, 0)');
            ctx.fillStyle = glowGrad;
            ctx.beginPath();
            ctx.ellipse(screen.x, screen.y - jump.height * 0.3, jump.width * 0.7, jump.height * 0.6, 0, 0, Math.PI * 2);
            ctx.fill();
        }

        // Main snow mound shape - smooth curved profile like packed snow kicker
        const snowGrad = ctx.createLinearGradient(
            screen.x - jump.width/2, screen.y,
            screen.x + jump.width/3, screen.y - jump.height
        );
        snowGrad.addColorStop(0, '#e8f0f4');      // Slightly shadowed base
        snowGrad.addColorStop(0.3, '#f4f8fc');    // Mid-tone snow
        snowGrad.addColorStop(0.6, '#ffffff');    // Bright top
        snowGrad.addColorStop(1, '#f0f6fa');      // Slight cyan tint at lip

        ctx.fillStyle = snowGrad;
        ctx.beginPath();
        // Curved mound shape (bezier curves for natural snow look)
        ctx.moveTo(screen.x - jump.width/2, screen.y);
        ctx.quadraticCurveTo(
            screen.x - jump.width/3, screen.y - jump.height * 0.2,
            screen.x - jump.width/6, screen.y - jump.height * 0.6
        );
        ctx.quadraticCurveTo(
            screen.x, screen.y - jump.height * 1.05,
            screen.x + jump.width/6, screen.y - jump.height * 0.7
        );
        ctx.quadraticCurveTo(
            screen.x + jump.width/3, screen.y - jump.height * 0.3,
            screen.x + jump.width/2, screen.y
        );
        ctx.closePath();
        ctx.fill();

        // Snow texture ridges (packed snow lines)
        ctx.strokeStyle = 'rgba(180, 200, 220, 0.3)';
        ctx.lineWidth = 1;
        for (let i = 1; i <= 3; i++) {
            const ridgeY = screen.y - jump.height * (i * 0.22);
            const ridgeWidth = jump.width * (0.9 - i * 0.15);
            ctx.beginPath();
            ctx.moveTo(screen.x - ridgeWidth/2, ridgeY + i * 2);
            ctx.quadraticCurveTo(
                screen.x, ridgeY - 3,
                screen.x + ridgeWidth/2, ridgeY + i * 2
            );
            ctx.stroke();
        }

        // Highlight on the lip (where light catches the edge)
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(screen.x - jump.width/5, screen.y - jump.height * 0.65);
        ctx.quadraticCurveTo(
            screen.x, screen.y - jump.height - 2,
            screen.x + jump.width/5, screen.y - jump.height * 0.7
        );
        ctx.stroke();

        // Subtle cyan shadow on the right side (ambient occlusion)
        ctx.fillStyle = 'rgba(160, 200, 220, 0.2)';
        ctx.beginPath();
        ctx.moveTo(screen.x + jump.width/6, screen.y - jump.height * 0.7);
        ctx.quadraticCurveTo(
            screen.x + jump.width/3, screen.y - jump.height * 0.3,
            screen.x + jump.width/2, screen.y
        );
        ctx.lineTo(screen.x + jump.width/3, screen.y);
        ctx.closePath();
        ctx.fill();

        // Pink highlight on left side (subtle, matching palette)
        ctx.fillStyle = 'rgba(255, 210, 220, 0.15)';
        ctx.beginPath();
        ctx.moveTo(screen.x - jump.width/2, screen.y);
        ctx.quadraticCurveTo(
            screen.x - jump.width/3, screen.y - jump.height * 0.15,
            screen.x - jump.width/4, screen.y - jump.height * 0.4
        );
        ctx.lineTo(screen.x - jump.width/3, screen.y);
        ctx.closePath();
        ctx.fill();
    }
}

function drawRails() {
    const camera = gameState.camera;

    for (const rail of gameState.rails) {
        if (rail.endY < camera.y - 50 || rail.y > camera.y + CANVAS_HEIGHT + 50) continue;

        const startScreen = worldToScreen(rail.x, rail.y);
        const endScreen = worldToScreen(rail.endX, rail.endY);
        const grindableType = rail.grindableType || 'rail';

        if (grindableType === 'rail') {
            drawMetalRail(startScreen, endScreen, rail);
        } else if (grindableType === 'funbox') {
            drawFunbox(startScreen, endScreen, rail);
        } else if (grindableType === 'log') {
            drawLog(startScreen, endScreen, rail);
        } else if (grindableType === 'bench') {
            drawBench(startScreen, endScreen, rail);
        } else if (grindableType === 'kinked') {
            drawKinkedRail(startScreen, endScreen, rail);
        } else {
            // Default to metal rail
            drawMetalRail(startScreen, endScreen, rail);
        }
    }
}

function drawMetalRail(startScreen, endScreen, rail) {
    const dx = endScreen.x - startScreen.x;
    const dy = endScreen.y - startScreen.y;
    const length = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx);

    // Rail height above ground
    const railHeight = 12;

    // Support posts every ~60 pixels
    const numSupports = Math.max(2, Math.ceil(length / 60));

    // Draw shadows first
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    for (let i = 0; i < numSupports; i++) {
        const t = i / (numSupports - 1);
        const x = lerp(startScreen.x, endScreen.x, t);
        const y = lerp(startScreen.y, endScreen.y, t);
        ctx.beginPath();
        ctx.ellipse(x + 3, y + railHeight + 5, 6, 3, 0, 0, Math.PI * 2);
        ctx.fill();
    }

    // Draw support posts
    const supportGrad = ctx.createLinearGradient(0, 0, 0, railHeight);
    supportGrad.addColorStop(0, '#888');
    supportGrad.addColorStop(0.5, '#aaa');
    supportGrad.addColorStop(1, '#666');

    for (let i = 0; i < numSupports; i++) {
        const t = i / (numSupports - 1);
        const x = lerp(startScreen.x, endScreen.x, t);
        const y = lerp(startScreen.y, endScreen.y, t);

        // Support post
        ctx.fillStyle = supportGrad;
        ctx.fillRect(x - 3, y, 6, railHeight);

        // Support base plate
        ctx.fillStyle = '#555';
        ctx.fillRect(x - 5, y + railHeight - 2, 10, 4);
    }

    // Main rail - metallic with shine
    ctx.save();

    // Rail body (cylindrical appearance)
    const railGrad = ctx.createLinearGradient(
        startScreen.x, startScreen.y - 4,
        startScreen.x, startScreen.y + 4
    );
    railGrad.addColorStop(0, '#ddd');
    railGrad.addColorStop(0.3, '#fff');
    railGrad.addColorStop(0.5, '#ccc');
    railGrad.addColorStop(1, '#888');

    ctx.strokeStyle = railGrad;
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(startScreen.x, startScreen.y);
    ctx.lineTo(endScreen.x, endScreen.y);
    ctx.stroke();

    // Highlight shine on top
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(startScreen.x, startScreen.y - 2);
    ctx.lineTo(endScreen.x, endScreen.y - 2);
    ctx.stroke();

    // Neon glow effect
    ctx.shadowColor = COLORS.cyan;
    ctx.shadowBlur = 8;
    ctx.strokeStyle = 'rgba(0, 255, 255, 0.3)';
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(startScreen.x, startScreen.y);
    ctx.lineTo(endScreen.x, endScreen.y);
    ctx.stroke();

    ctx.restore();

    // End caps (rounded metal)
    ctx.fillStyle = '#bbb';
    ctx.shadowColor = COLORS.cyan;
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.arc(startScreen.x, startScreen.y, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(endScreen.x, endScreen.y, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
}

function drawFunbox(startScreen, endScreen, rail) {
    const dx = endScreen.x - startScreen.x;
    const dy = endScreen.y - startScreen.y;
    const length = Math.sqrt(dx * dx + dy * dy);

    // Funbox is a rectangular box with metal coping on top
    const boxWidth = 30;
    const boxHeight = 15;

    // Calculate midpoint and angle
    const midX = (startScreen.x + endScreen.x) / 2;
    const midY = (startScreen.y + endScreen.y) / 2;

    ctx.save();
    ctx.translate(midX, midY);

    // Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.beginPath();
    ctx.ellipse(3, boxHeight + 5, length / 2 + 5, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    // Box body (wood texture)
    const woodGrad = ctx.createLinearGradient(-length / 2, -boxHeight, length / 2, boxHeight);
    woodGrad.addColorStop(0, '#8B6914');
    woodGrad.addColorStop(0.5, '#A0522D');
    woodGrad.addColorStop(1, '#6B4423');

    ctx.fillStyle = woodGrad;
    ctx.beginPath();
    ctx.moveTo(-length / 2, 0);
    ctx.lineTo(-length / 2 - 8, boxHeight);
    ctx.lineTo(length / 2 + 8, boxHeight);
    ctx.lineTo(length / 2, 0);
    ctx.closePath();
    ctx.fill();

    // Wood grain lines
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.lineWidth = 1;
    for (let i = -3; i <= 3; i++) {
        const x = i * length / 7;
        ctx.beginPath();
        ctx.moveTo(x, 2);
        ctx.lineTo(x - 2, boxHeight - 2);
        ctx.stroke();
    }

    // Top surface
    ctx.fillStyle = '#9B7B14';
    ctx.fillRect(-length / 2, -3, length, 6);

    // Metal coping on top edge
    const copingGrad = ctx.createLinearGradient(0, -5, 0, 2);
    copingGrad.addColorStop(0, '#ddd');
    copingGrad.addColorStop(0.5, '#fff');
    copingGrad.addColorStop(1, '#999');

    ctx.fillStyle = copingGrad;
    ctx.fillRect(-length / 2, -5, length, 4);

    // Coping shine
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.fillRect(-length / 2, -5, length, 1);

    // Neon accent
    ctx.shadowColor = COLORS.magenta;
    ctx.shadowBlur = 6;
    ctx.strokeStyle = COLORS.magenta;
    ctx.lineWidth = 1;
    ctx.strokeRect(-length / 2, -5, length, 4);
    ctx.shadowBlur = 0;

    ctx.restore();
}

function drawLog(startScreen, endScreen, rail) {
    const dx = endScreen.x - startScreen.x;
    const dy = endScreen.y - startScreen.y;
    const length = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx);

    ctx.save();
    ctx.translate(startScreen.x, startScreen.y);
    ctx.rotate(angle);

    // Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.beginPath();
    ctx.ellipse(length / 2 + 3, 15, length / 2 + 5, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    // Main log body
    const logGrad = ctx.createLinearGradient(0, -8, 0, 8);
    logGrad.addColorStop(0, '#5D4E37');
    logGrad.addColorStop(0.3, '#8B7355');
    logGrad.addColorStop(0.7, '#6B5344');
    logGrad.addColorStop(1, '#4A3728');

    ctx.fillStyle = logGrad;
    ctx.beginPath();
    ctx.ellipse(0, 0, 8, 10, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillRect(0, -8, length, 16);

    ctx.beginPath();
    ctx.ellipse(length, 0, 8, 10, 0, 0, Math.PI * 2);
    ctx.fill();

    // Bark texture lines
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.lineWidth = 1;
    for (let i = 0; i < length; i += 15) {
        ctx.beginPath();
        ctx.moveTo(i, -7);
        ctx.quadraticCurveTo(i + 5, 0, i, 7);
        ctx.stroke();
    }

    // End grain rings
    ctx.strokeStyle = '#4A3728';
    ctx.lineWidth = 1;
    for (let r = 2; r < 8; r += 2) {
        ctx.beginPath();
        ctx.ellipse(0, 0, r, r * 1.2, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.ellipse(length, 0, r, r * 1.2, 0, 0, Math.PI * 2);
        ctx.stroke();
    }

    // Snow on top
    ctx.fillStyle = 'rgba(240, 248, 255, 0.6)';
    ctx.beginPath();
    ctx.moveTo(5, -8);
    ctx.quadraticCurveTo(length / 4, -12, length / 2, -9);
    ctx.quadraticCurveTo(length * 3 / 4, -11, length - 5, -8);
    ctx.lineTo(length - 5, -6);
    ctx.quadraticCurveTo(length / 2, -8, 5, -6);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
}

function drawBench(startScreen, endScreen, rail) {
    const dx = endScreen.x - startScreen.x;
    const dy = endScreen.y - startScreen.y;
    const length = Math.sqrt(dx * dx + dy * dy);

    const midX = (startScreen.x + endScreen.x) / 2;
    const midY = (startScreen.y + endScreen.y) / 2;

    ctx.save();
    ctx.translate(midX, midY);

    // Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.beginPath();
    ctx.ellipse(3, 18, length / 2 + 8, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    // Bench legs (metal)
    const legGrad = ctx.createLinearGradient(0, -5, 0, 15);
    legGrad.addColorStop(0, '#666');
    legGrad.addColorStop(0.5, '#888');
    legGrad.addColorStop(1, '#444');

    ctx.fillStyle = legGrad;
    // Left leg frame
    ctx.fillRect(-length / 2 + 5, -2, 4, 18);
    ctx.fillRect(-length / 2 + 5, 12, 15, 4);
    // Right leg frame
    ctx.fillRect(length / 2 - 9, -2, 4, 18);
    ctx.fillRect(length / 2 - 20, 12, 15, 4);

    // Seat slats (wood)
    const woodGrad = ctx.createLinearGradient(-length / 2, 0, length / 2, 0);
    woodGrad.addColorStop(0, '#A0522D');
    woodGrad.addColorStop(0.5, '#CD853F');
    woodGrad.addColorStop(1, '#8B4513');

    ctx.fillStyle = woodGrad;
    for (let i = 0; i < 3; i++) {
        const slatY = -5 + i * 4;
        ctx.fillRect(-length / 2 + 8, slatY, length - 16, 3);
    }

    // Wood grain on slats
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.lineWidth = 0.5;
    for (let i = 0; i < 3; i++) {
        const slatY = -5 + i * 4 + 1.5;
        ctx.beginPath();
        ctx.moveTo(-length / 2 + 10, slatY);
        ctx.lineTo(length / 2 - 10, slatY);
        ctx.stroke();
    }

    // Metal edge coping (grindable surface)
    ctx.fillStyle = '#999';
    ctx.fillRect(-length / 2 + 8, -6, length - 16, 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.fillRect(-length / 2 + 8, -6, length - 16, 1);

    // Neon highlight
    ctx.shadowColor = COLORS.limeGreen;
    ctx.shadowBlur = 5;
    ctx.strokeStyle = COLORS.limeGreen;
    ctx.lineWidth = 1;
    ctx.strokeRect(-length / 2 + 8, -6, length - 16, 2);
    ctx.shadowBlur = 0;

    ctx.restore();
}

function drawKinkedRail(startScreen, endScreen, rail) {
    const dx = endScreen.x - startScreen.x;
    const dy = endScreen.y - startScreen.y;
    const length = Math.sqrt(dx * dx + dy * dy);

    // Kinked rail has a down-flat-down pattern
    const kinkHeight = 8;
    const flatLength = length * 0.4;

    const mid1X = startScreen.x + dx * 0.3;
    const mid1Y = startScreen.y + dy * 0.3;
    const mid2X = startScreen.x + dx * 0.7;
    const mid2Y = startScreen.y + dy * 0.7;

    // Draw support posts at kink points
    const supportGrad = ctx.createLinearGradient(0, 0, 0, 15);
    supportGrad.addColorStop(0, '#888');
    supportGrad.addColorStop(1, '#555');

    const supports = [startScreen, {x: mid1X, y: mid1Y}, {x: mid2X, y: mid2Y}, endScreen];
    for (const pos of supports) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.beginPath();
        ctx.ellipse(pos.x + 2, pos.y + 18, 5, 3, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = supportGrad;
        ctx.fillRect(pos.x - 2, pos.y + 2, 4, 14);
    }

    // Draw rail segments
    ctx.save();

    // Rail gradient
    const railGrad = ctx.createLinearGradient(startScreen.x, startScreen.y - 3, startScreen.x, startScreen.y + 3);
    railGrad.addColorStop(0, '#ddd');
    railGrad.addColorStop(0.5, '#fff');
    railGrad.addColorStop(1, '#999');

    ctx.strokeStyle = railGrad;
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Draw the kinked path
    ctx.beginPath();
    ctx.moveTo(startScreen.x, startScreen.y);
    ctx.lineTo(mid1X, mid1Y - kinkHeight);
    ctx.lineTo(mid2X, mid2Y - kinkHeight);
    ctx.lineTo(endScreen.x, endScreen.y);
    ctx.stroke();

    // Highlight
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(startScreen.x, startScreen.y - 2);
    ctx.lineTo(mid1X, mid1Y - kinkHeight - 2);
    ctx.lineTo(mid2X, mid2Y - kinkHeight - 2);
    ctx.lineTo(endScreen.x, endScreen.y - 2);
    ctx.stroke();

    // Neon glow
    ctx.shadowColor = COLORS.yellow;
    ctx.shadowBlur = 8;
    ctx.strokeStyle = 'rgba(255, 255, 0, 0.3)';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(startScreen.x, startScreen.y);
    ctx.lineTo(mid1X, mid1Y - kinkHeight);
    ctx.lineTo(mid2X, mid2Y - kinkHeight);
    ctx.lineTo(endScreen.x, endScreen.y);
    ctx.stroke();

    ctx.restore();
    ctx.shadowBlur = 0;
}

function drawLodges() {
    const camera = gameState.camera;
    const time = gameState.animationTime;

    for (const lodge of gameState.lodges) {
        if (lodge.y < camera.y - 100 || lodge.y > camera.y + CANVAS_HEIGHT + 200) continue;

        const screen = worldToScreen(lodge.x, lodge.y);
        const w = lodge.width;
        const h = lodge.height;

        // ===== SHADOW =====
        ctx.fillStyle = 'rgba(60, 80, 100, 0.4)';
        ctx.beginPath();
        ctx.ellipse(screen.x + 10, screen.y + h + 15, w * 0.5, 20, 0, 0, Math.PI * 2);
        ctx.fill();

        // ===== ENTRANCE RAMP (above lodge, pointing UP the mountain) =====
        // This is the main entry - player snowboards down and hits this ramp to enter
        const rampW = lodge.rampWidth;
        const rampL = lodge.rampLength;
        const rampScreen = worldToScreen(lodge.rampX, lodge.rampY);

        // Ramp shadow
        ctx.fillStyle = 'rgba(60, 80, 100, 0.3)';
        ctx.beginPath();
        ctx.ellipse(rampScreen.x + 5, rampScreen.y + rampL + 10, rampW * 0.4, 10, 0, 0, Math.PI * 2);
        ctx.fill();

        // Snow ramp base (packed snow)
        const rampGrad = ctx.createLinearGradient(rampScreen.x, rampScreen.y, rampScreen.x, rampScreen.y + rampL);
        rampGrad.addColorStop(0, '#e8f4f8');     // Light snow at top
        rampGrad.addColorStop(0.5, '#d0e8f0');   // Mid tone
        rampGrad.addColorStop(1, '#c8dce8');     // Slightly darker at bottom (shadow)
        ctx.fillStyle = rampGrad;

        // Draw tapered ramp shape (narrower at top, wider at bottom connecting to lodge)
        ctx.beginPath();
        ctx.moveTo(rampScreen.x - rampW * 0.3, rampScreen.y);           // Top left (narrower)
        ctx.lineTo(rampScreen.x + rampW * 0.3, rampScreen.y);           // Top right (narrower)
        ctx.lineTo(rampScreen.x + rampW * 0.5, rampScreen.y + rampL);   // Bottom right (wider)
        ctx.lineTo(rampScreen.x - rampW * 0.5, rampScreen.y + rampL);   // Bottom left (wider)
        ctx.closePath();
        ctx.fill();

        // Ramp side edges (darker for depth)
        ctx.strokeStyle = '#a0c0d0';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(rampScreen.x - rampW * 0.3, rampScreen.y);
        ctx.lineTo(rampScreen.x - rampW * 0.5, rampScreen.y + rampL);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(rampScreen.x + rampW * 0.3, rampScreen.y);
        ctx.lineTo(rampScreen.x + rampW * 0.5, rampScreen.y + rampL);
        ctx.stroke();

        // Ramp surface lines (ski grooves pointing up the mountain)
        ctx.strokeStyle = 'rgba(160, 190, 210, 0.4)';
        ctx.lineWidth = 1;
        for (let i = 0; i < 5; i++) {
            const t = (i + 1) / 6;
            const topX = rampScreen.x + (t - 0.5) * rampW * 0.6;
            const bottomX = rampScreen.x + (t - 0.5) * rampW;
            ctx.beginPath();
            ctx.moveTo(topX, rampScreen.y + 5);
            ctx.lineTo(bottomX, rampScreen.y + rampL - 5);
            ctx.stroke();
        }

        // "ENTER" text on ramp
        ctx.fillStyle = '#4a7a9a';
        ctx.font = 'bold 10px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('▲ ENTER ▲', rampScreen.x, rampScreen.y + rampL * 0.4);

        // Glow effect around ramp entrance
        const glowIntensity = 0.3 + Math.sin(time * 3) * 0.1;
        ctx.strokeStyle = `rgba(100, 200, 255, ${glowIntensity})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(rampScreen.x - rampW * 0.3, rampScreen.y);
        ctx.lineTo(rampScreen.x + rampW * 0.3, rampScreen.y);
        ctx.stroke();

        // ===== BACK STAIRS (behind lodge - secondary exit) =====
        const stairsW = lodge.stairsWidth;
        const stairsH = lodge.stairsHeight;
        // Stair steps
        ctx.fillStyle = '#8b7355';
        for (let i = 0; i < 3; i++) {
            const stepY = screen.y + h + i * (stairsH / 3);
            const stepW = stairsW - i * 8;
            ctx.fillRect(screen.x - stepW / 2, stepY, stepW, stairsH / 3 + 2);
        }
        // Stair shadows
        ctx.fillStyle = 'rgba(60, 40, 30, 0.3)';
        for (let i = 0; i < 3; i++) {
            const stepY = screen.y + h + i * (stairsH / 3);
            const stepW = stairsW - i * 8;
            ctx.fillRect(screen.x - stepW / 2, stepY, stepW, 3);
        }

        // ===== MAIN BUILDING BODY =====
        // Base/foundation
        ctx.fillStyle = '#5a4a3a';
        ctx.fillRect(screen.x - w / 2, screen.y + h * 0.7, w, h * 0.3);

        // Main wall
        const wallGrad = ctx.createLinearGradient(screen.x - w / 2, screen.y, screen.x + w / 2, screen.y);
        wallGrad.addColorStop(0, '#6b5a4a');
        wallGrad.addColorStop(0.5, '#7a6a5a');
        wallGrad.addColorStop(1, '#5a4a3a');
        ctx.fillStyle = wallGrad;
        ctx.fillRect(screen.x - w / 2, screen.y + h * 0.3, w, h * 0.4);

        // ===== A-FRAME ROOF =====
        const roofPeakY = screen.y - h * 0.15;
        const roofBaseY = screen.y + h * 0.35;
        const roofOverhang = 15;

        // Roof shadow side
        ctx.fillStyle = '#4a3a2a';
        ctx.beginPath();
        ctx.moveTo(screen.x, roofPeakY);
        ctx.lineTo(screen.x + w / 2 + roofOverhang, roofBaseY);
        ctx.lineTo(screen.x, roofBaseY);
        ctx.closePath();
        ctx.fill();

        // Roof lit side
        ctx.fillStyle = '#6a4a3a';
        ctx.beginPath();
        ctx.moveTo(screen.x, roofPeakY);
        ctx.lineTo(screen.x - w / 2 - roofOverhang, roofBaseY);
        ctx.lineTo(screen.x, roofBaseY);
        ctx.closePath();
        ctx.fill();

        // Snow on roof
        ctx.fillStyle = '#f0f8ff';
        ctx.beginPath();
        ctx.moveTo(screen.x, roofPeakY - 5);
        ctx.lineTo(screen.x - w / 2 - roofOverhang + 5, roofBaseY - 8);
        ctx.quadraticCurveTo(screen.x - w / 4, roofBaseY - 15, screen.x, roofPeakY - 5);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(screen.x, roofPeakY - 5);
        ctx.lineTo(screen.x + w / 2 + roofOverhang - 5, roofBaseY - 8);
        ctx.quadraticCurveTo(screen.x + w / 4, roofBaseY - 15, screen.x, roofPeakY - 5);
        ctx.fill();

        // ===== CHIMNEY =====
        const chimneyX = screen.x + w * 0.25;
        const chimneyY = roofPeakY + h * 0.15;
        ctx.fillStyle = '#8a6a5a';
        ctx.fillRect(chimneyX - 8, chimneyY, 16, 30);
        ctx.fillStyle = '#5a3a2a';
        ctx.fillRect(chimneyX - 10, chimneyY - 4, 20, 6);
        // Snow on chimney
        ctx.fillStyle = '#f0f8ff';
        ctx.fillRect(chimneyX - 10, chimneyY - 6, 20, 4);

        // Smoke particles (subtle)
        ctx.fillStyle = 'rgba(200, 200, 210, 0.3)';
        for (let i = 0; i < 3; i++) {
            const smokeY = chimneyY - 15 - i * 12 - Math.sin(time * 2 + i) * 5;
            const smokeX = chimneyX + Math.sin(time * 1.5 + i * 2) * 8;
            const smokeSize = 6 + i * 3;
            ctx.beginPath();
            ctx.arc(smokeX, smokeY, smokeSize, 0, Math.PI * 2);
            ctx.fill();
        }

        // ===== WINDOWS =====
        // Window glow (warm light from inside)
        const windowGlow = 0.6 + Math.sin(time * 0.5) * 0.1;

        // Left window
        ctx.fillStyle = `rgba(255, 200, 100, ${windowGlow})`;
        ctx.fillRect(screen.x - w * 0.3 - 15, screen.y + h * 0.4, 30, 25);
        ctx.strokeStyle = '#3a2a1a';
        ctx.lineWidth = 3;
        ctx.strokeRect(screen.x - w * 0.3 - 15, screen.y + h * 0.4, 30, 25);
        // Window cross
        ctx.beginPath();
        ctx.moveTo(screen.x - w * 0.3, screen.y + h * 0.4);
        ctx.lineTo(screen.x - w * 0.3, screen.y + h * 0.4 + 25);
        ctx.moveTo(screen.x - w * 0.3 - 15, screen.y + h * 0.4 + 12);
        ctx.lineTo(screen.x - w * 0.3 + 15, screen.y + h * 0.4 + 12);
        ctx.stroke();

        // Right window
        ctx.fillStyle = `rgba(255, 200, 100, ${windowGlow})`;
        ctx.fillRect(screen.x + w * 0.3 - 15, screen.y + h * 0.4, 30, 25);
        ctx.strokeStyle = '#3a2a1a';
        ctx.strokeRect(screen.x + w * 0.3 - 15, screen.y + h * 0.4, 30, 25);
        // Window cross
        ctx.beginPath();
        ctx.moveTo(screen.x + w * 0.3, screen.y + h * 0.4);
        ctx.lineTo(screen.x + w * 0.3, screen.y + h * 0.4 + 25);
        ctx.moveTo(screen.x + w * 0.3 - 15, screen.y + h * 0.4 + 12);
        ctx.lineTo(screen.x + w * 0.3 + 15, screen.y + h * 0.4 + 12);
        ctx.stroke();

        // ===== FRONT DOOR =====
        const doorX = screen.x;
        const doorY = screen.y + h * 0.55;
        const doorW = lodge.doorWidth;
        const doorH = lodge.doorHeight;

        // Door frame
        ctx.fillStyle = '#3a2a1a';
        ctx.fillRect(doorX - doorW / 2 - 4, doorY - 4, doorW + 8, doorH + 4);

        // Door
        ctx.fillStyle = '#5a3a2a';
        ctx.fillRect(doorX - doorW / 2, doorY, doorW, doorH);

        // Door window (small)
        ctx.fillStyle = `rgba(255, 220, 150, ${windowGlow * 0.8})`;
        ctx.fillRect(doorX - 8, doorY + 8, 16, 20);
        ctx.strokeStyle = '#3a2a1a';
        ctx.lineWidth = 2;
        ctx.strokeRect(doorX - 8, doorY + 8, 16, 20);

        // Door handle
        ctx.fillStyle = '#c0a060';
        ctx.beginPath();
        ctx.arc(doorX + doorW / 2 - 8, doorY + doorH / 2, 4, 0, Math.PI * 2);
        ctx.fill();

        // ===== WELCOME SIGN =====
        ctx.fillStyle = '#4a3020';
        ctx.fillRect(screen.x - 35, screen.y + h * 0.25, 70, 18);
        ctx.fillStyle = '#f0e8d0';
        ctx.font = '8px "Press Start 2P", monospace';
        ctx.textAlign = 'center';
        ctx.fillText('SKI LODGE', screen.x, screen.y + h * 0.25 + 13);

        // ===== ENTRANCE INDICATOR (pulsing) =====
        if (Math.sin(time * 4) > 0) {
            ctx.fillStyle = 'rgba(0, 255, 200, 0.3)';
            ctx.beginPath();
            ctx.arc(doorX, doorY + doorH + stairsH / 2, 25, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}

function drawCollectibles() {
    const camera = gameState.camera;
    const time = gameState.animationTime;

    for (const col of gameState.collectibles) {
        if (col.collected) continue;
        if (col.y < camera.y - 50 || col.y > camera.y + CANVAS_HEIGHT + 50) continue;

        const screen = worldToScreen(col.x, col.y);
        const isBig = col.type === 'big';
        const size = isBig ? 16 : 10;

        // Floating animation
        const float = Math.sin(time * 4 + col.x * 0.1) * 5;
        const rotation = time * 2;

        ctx.save();
        ctx.translate(screen.x, screen.y + float);
        ctx.rotate(rotation);

        // Glow
        ctx.shadowColor = isBig ? COLORS.yellow : COLORS.cyan;
        ctx.shadowBlur = isBig ? 15 : 8;

        // Draw snowflake
        ctx.strokeStyle = isBig ? COLORS.yellow : '#fff';
        ctx.lineWidth = isBig ? 3 : 2;
        ctx.lineCap = 'round';

        // Six-pointed snowflake
        for (let i = 0; i < 6; i++) {
            const angle = (i / 6) * Math.PI * 2;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(Math.cos(angle) * size, Math.sin(angle) * size);
            ctx.stroke();

            // Small branches on each arm
            const branchLen = size * 0.4;
            const branchX = Math.cos(angle) * size * 0.6;
            const branchY = Math.sin(angle) * size * 0.6;
            ctx.beginPath();
            ctx.moveTo(branchX, branchY);
            ctx.lineTo(
                branchX + Math.cos(angle + 0.5) * branchLen,
                branchY + Math.sin(angle + 0.5) * branchLen
            );
            ctx.moveTo(branchX, branchY);
            ctx.lineTo(
                branchX + Math.cos(angle - 0.5) * branchLen,
                branchY + Math.sin(angle - 0.5) * branchLen
            );
            ctx.stroke();
        }

        // Center dot
        ctx.fillStyle = isBig ? COLORS.yellow : '#fff';
        ctx.beginPath();
        ctx.arc(0, 0, isBig ? 3 : 2, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
        ctx.shadowBlur = 0;
    }
}

function drawBoostPads() {
    const camera = gameState.camera;
    const time = gameState.animationTime;

    for (const boost of gameState.boostPads) {
        if (boost.y < camera.y - 50 || boost.y > camera.y + CANVAS_HEIGHT + 50) continue;

        const screen = worldToScreen(boost.x, boost.y);
        const w = boost.width;
        const h = boost.height;

        ctx.save();
        ctx.translate(screen.x, screen.y);

        // Pulsing glow
        const pulse = 0.5 + Math.sin(time * 6) * 0.3;

        // Shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.beginPath();
        ctx.ellipse(0, h / 2 + 5, w / 2 + 5, 8, 0, 0, Math.PI * 2);
        ctx.fill();

        // Boost pad base
        const padGrad = ctx.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2);
        padGrad.addColorStop(0, '#1a3a4a');
        padGrad.addColorStop(0.5, '#2a5a6a');
        padGrad.addColorStop(1, '#1a3a4a');
        ctx.fillStyle = padGrad;
        ctx.beginPath();
        ctx.ellipse(0, 0, w / 2, h / 2, 0, 0, Math.PI * 2);
        ctx.fill();

        // Neon arrows
        ctx.strokeStyle = COLORS.cyan;
        ctx.lineWidth = 3;
        ctx.shadowColor = COLORS.cyan;
        ctx.shadowBlur = 10 * pulse;

        // Draw chevrons pointing down (direction of travel)
        for (let i = 0; i < 3; i++) {
            const offset = (time * 80 + i * 15) % 30 - 15;
            const arrowY = offset;
            const alpha = 1 - Math.abs(offset) / 15;
            ctx.globalAlpha = alpha * pulse;

            ctx.beginPath();
            ctx.moveTo(-15, arrowY - 8);
            ctx.lineTo(0, arrowY + 2);
            ctx.lineTo(15, arrowY - 8);
            ctx.stroke();
        }

        ctx.globalAlpha = 1;

        // Border ring
        ctx.strokeStyle = COLORS.cyan;
        ctx.lineWidth = 2;
        ctx.shadowBlur = 8 * pulse;
        ctx.beginPath();
        ctx.ellipse(0, 0, w / 2 - 2, h / 2 - 2, 0, 0, Math.PI * 2);
        ctx.stroke();

        ctx.restore();
        ctx.shadowBlur = 0;
    }
}

function drawLodgeInterior() {
    const lodge = gameState.lodge;
    const time = gameState.animationTime;
    const w = LODGE.interiorWidth;
    const h = LODGE.interiorHeight;

    // Center the interior on screen
    const offsetX = (CANVAS_WIDTH - w) / 2;
    const offsetY = (CANVAS_HEIGHT - h) / 2;

    // ===== BACKGROUND (wooden floor) =====
    const floorGrad = ctx.createLinearGradient(offsetX, offsetY, offsetX + w, offsetY + h);
    floorGrad.addColorStop(0, '#5a4030');
    floorGrad.addColorStop(0.5, '#6a5040');
    floorGrad.addColorStop(1, '#4a3020');
    ctx.fillStyle = floorGrad;
    ctx.fillRect(offsetX, offsetY, w, h);

    // Floor planks
    ctx.strokeStyle = '#3a2015';
    ctx.lineWidth = 1;
    for (let y = 0; y < h; y += 30) {
        ctx.beginPath();
        ctx.moveTo(offsetX, offsetY + y);
        ctx.lineTo(offsetX + w, offsetY + y);
        ctx.stroke();
    }

    // ===== WALLS =====
    // Back wall
    ctx.fillStyle = '#7a6050';
    ctx.fillRect(offsetX, offsetY, w, 60);

    // Wood paneling on back wall
    ctx.strokeStyle = '#5a4030';
    ctx.lineWidth = 2;
    for (let x = 0; x < w; x += 40) {
        ctx.beginPath();
        ctx.moveTo(offsetX + x, offsetY);
        ctx.lineTo(offsetX + x, offsetY + 60);
        ctx.stroke();
    }

    // ===== FIREPLACE (left side) =====
    const fpX = offsetX + 50;
    const fpY = offsetY + 10;

    // Fireplace stone surround
    ctx.fillStyle = '#6a6a7a';
    ctx.fillRect(fpX - 10, fpY, 80, 70);
    ctx.fillStyle = '#5a5a6a';
    ctx.fillRect(fpX, fpY + 10, 60, 50);

    // Fire glow
    const fireGlow = 0.6 + Math.sin(time * 8) * 0.2;
    const fireGrad = ctx.createRadialGradient(fpX + 30, fpY + 45, 5, fpX + 30, fpY + 45, 35);
    fireGrad.addColorStop(0, `rgba(255, 150, 50, ${fireGlow})`);
    fireGrad.addColorStop(0.5, `rgba(255, 100, 30, ${fireGlow * 0.6})`);
    fireGrad.addColorStop(1, 'rgba(100, 30, 10, 0)');
    ctx.fillStyle = fireGrad;
    ctx.fillRect(fpX + 5, fpY + 25, 50, 30);

    // Fire flames
    ctx.fillStyle = `rgba(255, 200, 50, ${fireGlow})`;
    for (let i = 0; i < 5; i++) {
        const flameX = fpX + 15 + i * 10 + Math.sin(time * 10 + i) * 3;
        const flameH = 15 + Math.sin(time * 12 + i * 2) * 8;
        ctx.beginPath();
        ctx.moveTo(flameX, fpY + 55);
        ctx.quadraticCurveTo(flameX - 5, fpY + 55 - flameH / 2, flameX, fpY + 55 - flameH);
        ctx.quadraticCurveTo(flameX + 5, fpY + 55 - flameH / 2, flameX, fpY + 55);
        ctx.fill();
    }

    // Mantle
    ctx.fillStyle = '#4a3020';
    ctx.fillRect(fpX - 15, fpY - 5, 90, 12);

    // ===== WINDOWS (back wall) =====
    // Window showing snowy exterior
    const winX = offsetX + w - 100;
    const winY = offsetY + 15;

    ctx.fillStyle = '#c0d8e8'; // Snowy sky
    ctx.fillRect(winX, winY, 70, 40);

    // Snow falling outside
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 8; i++) {
        const snowX = winX + 5 + (i * 9 + time * 20) % 60;
        const snowY = winY + 5 + (i * 7 + time * 30) % 30;
        ctx.beginPath();
        ctx.arc(snowX, snowY, 2, 0, Math.PI * 2);
        ctx.fill();
    }

    // Window frame
    ctx.strokeStyle = '#3a2015';
    ctx.lineWidth = 4;
    ctx.strokeRect(winX, winY, 70, 40);
    ctx.beginPath();
    ctx.moveTo(winX + 35, winY);
    ctx.lineTo(winX + 35, winY + 40);
    ctx.moveTo(winX, winY + 20);
    ctx.lineTo(winX + 70, winY + 20);
    ctx.stroke();

    // ===== VENDOR SPOTS (empty for now) =====
    // Counter on right side
    ctx.fillStyle = '#5a4030';
    ctx.fillRect(offsetX + w - 80, offsetY + 100, 60, 80);
    ctx.fillStyle = '#6a5040';
    ctx.fillRect(offsetX + w - 85, offsetY + 95, 70, 10);

    // "Coming Soon" sign
    ctx.fillStyle = '#3a2010';
    ctx.fillRect(offsetX + w - 75, offsetY + 110, 50, 25);
    ctx.fillStyle = '#d0c0a0';
    ctx.font = '6px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('SHOP', offsetX + w - 50, offsetY + 125);
    ctx.fillText('SOON', offsetX + w - 50, offsetY + 132);

    // ===== EXIT DOOR (bottom) =====
    const exitX = offsetX + w / 2;
    const exitY = offsetY + h - 20;

    // Door mat
    ctx.fillStyle = '#4a6040';
    ctx.fillRect(exitX - 30, exitY - 5, 60, 20);

    // Exit door
    ctx.fillStyle = '#5a3a2a';
    ctx.fillRect(exitX - 25, exitY - 60, 50, 60);
    ctx.strokeStyle = '#3a2015';
    ctx.lineWidth = 3;
    ctx.strokeRect(exitX - 25, exitY - 60, 50, 60);

    // Door sign
    ctx.fillStyle = '#d0c0a0';
    ctx.font = '8px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('EXIT', exitX, exitY - 35);

    // Exit indicator (pulsing)
    if (Math.sin(time * 3) > 0) {
        ctx.fillStyle = 'rgba(255, 255, 0, 0.3)';
        ctx.beginPath();
        ctx.arc(exitX, exitY - 30, 35, 0, Math.PI * 2);
        ctx.fill();
    }

    // ===== PLAYER (walking sprite, simplified) =====
    const px = offsetX + lodge.playerX;
    const py = offsetY + lodge.playerY;

    // Player shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.beginPath();
    ctx.ellipse(px, py + 15, 15, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    // Player body (simple walking figure)
    ctx.fillStyle = COLORS.sunsetOrange;
    ctx.fillRect(px - 10, py - 20, 20, 25);

    // Player head
    ctx.fillStyle = '#ffcc99';
    ctx.beginPath();
    ctx.arc(px, py - 28, 10, 0, Math.PI * 2);
    ctx.fill();

    // Beanie
    ctx.fillStyle = COLORS.magenta;
    ctx.beginPath();
    ctx.arc(px, py - 32, 10, Math.PI, 0);
    ctx.fill();

    // ===== UI ELEMENTS =====
    // Timer bar
    const timeLeft = LODGE.maxStayTime - lodge.timeInside;
    const timerWidth = 200;
    const timerHeight = 20;
    const timerX = (CANVAS_WIDTH - timerWidth) / 2;
    const timerY = 30;

    // Timer background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(timerX - 5, timerY - 5, timerWidth + 10, timerHeight + 10);

    // Timer fill
    const timerPercent = timeLeft / LODGE.maxStayTime;
    const timerColor = timerPercent > 0.3 ? COLORS.cyan : COLORS.warning;
    ctx.fillStyle = timerColor;
    ctx.fillRect(timerX, timerY, timerWidth * timerPercent, timerHeight);

    // Timer border
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.strokeRect(timerX, timerY, timerWidth, timerHeight);

    // Timer text
    ctx.fillStyle = '#ffffff';
    ctx.font = '10px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`TIME: ${Math.ceil(timeLeft)}s`, CANVAS_WIDTH / 2, timerY + 15);

    // Warning message when time is low
    if (timeLeft <= LODGE.warningTime) {
        ctx.fillStyle = COLORS.warning;
        ctx.font = '14px "Press Start 2P", monospace';
        ctx.fillText('THE BEAST IS COMING!', CANVAS_WIDTH / 2, timerY + 50);
    }

    // Instructions
    ctx.fillStyle = '#ffffff';
    ctx.font = '8px "Press Start 2P", monospace';
    ctx.fillText('ARROWS/WASD TO MOVE - WALK TO EXIT DOOR', CANVAS_WIDTH / 2, CANVAS_HEIGHT - 20);
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
        } else if (input.down && !player.airborne) {
            // Tucking for speed - crouch down (no speed requirement - animation shows immediately)
            sprites.player.setAnimation('tuck');
        } else if (input.up && !player.airborne) {
            // Braking/slowing - use idle animation (arms spread for drag)
            sprites.player.setAnimation('idle');
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

    // Determine player pose based on input and state
    const isSpinning = player.airborne && player.spinDirection !== 0 && Math.abs(player.trickRotation) > 30;

    // BRAKING (UP pressed) - board turns perpendicular to slope (horizontal), scraping snow to slow down
    const isBraking = !player.airborne && !player.crashed && input.up;

    // TUCKING (DOWN pressed) - same side profile as going straight, but CROUCHED LOW for speed
    // Board still points DOWN the mountain, rider is just lower/more aerodynamic
    const isTuckingDown = !player.airborne && !player.crashed && input.down;

    // Going straight down the mountain (side profile view) - default riding pose
    // Board points down, we see rider's side profile
    const goingStraight = !player.crashed && !isBraking && !isTuckingDown && (
        // On ground and going straight
        (!player.airborne && Math.abs(player.angle) < 5) ||
        // Airborne but NOT spinning (maintains straight orientation)
        (player.airborne && !isSpinning)
    );

    // Apply rotation for tricks - only rotate when actually spinning
    if (player.airborne && isSpinning) {
        ctx.rotate(player.trickRotation * Math.PI / 180);
        // Apply flip rotation (scale Y to simulate forward/backward flip)
        if (player.flipRotation !== 0) {
            const flipScale = Math.cos(player.flipRotation * Math.PI / 180);
            ctx.scale(1, flipScale);
        }
    } else if (!player.airborne && !goingStraight && !isBraking) {
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

    // Crouch factor - increases as we approach a jump, also applies in air for grabs
    // Also applies when player is pressing DOWN to tuck for speed
    const manualTuck = isTuckingDown ? 0.8 : 0;  // Tucking when pressing down
    const crouchFactor = Math.max(player.preloadCrouch || 0, manualTuck);
    const airCrouch = player.airborne && player.autoTrick && player.autoTrick.type === 'grab' ? player.grabPhase * 0.4 : 0;

    // Stance direction: regular = left foot forward, goofy = right foot forward
    // This affects which way the rider faces when going straight
    const isGoofy = displaySettings.stance === 'goofy';
    const stanceRotation = isGoofy ? -Math.PI / 2 : Math.PI / 2; // 90 degrees left or right

    // Determine grab offset for board (moves toward body during grabs)
    const grabOffset = player.grabPhase * 6;
    const boardY = 8 - grabOffset;

    if (isBraking) {
        // ===== BRAKING POSE - BOARD AND BODY FACING UP THE MOUNTAIN =====
        // Player presses UP to slow down - board turns perpendicular, scraping snow
        // This is like a hockey stop - board sideways to the direction of travel

        // Shadow - horizontal for sideways board
        ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
        ctx.beginPath();
        ctx.ellipse(0, 18 + shadowOffset, 22, 8, 0, 0, Math.PI * 2);
        ctx.fill();

        // Board - HORIZONTAL, perpendicular to slope (facing up mountain)
        const boardGrad = ctx.createLinearGradient(-20, 0, 20, 0);
        boardGrad.addColorStop(0, COLORS.hotPink);
        boardGrad.addColorStop(0.5, '#ff69b4');
        boardGrad.addColorStop(1, COLORS.magenta);
        ctx.fillStyle = boardGrad;
        ctx.shadowColor = COLORS.hotPink;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.roundRect(-22, 6, 44, 8, 4);
        ctx.fill();

        // Board edge highlight
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(-20, 7);
        ctx.lineTo(20, 7);
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Bindings - on the horizontal board
        ctx.fillStyle = '#333';
        ctx.fillRect(-12, 5, 8, 10);   // Left binding
        ctx.fillRect(4, 5, 8, 10);     // Right binding

        // Legs - front view, bent for braking stance
        const legGrad = ctx.createLinearGradient(0, -10, 0, 15);
        legGrad.addColorStop(0, '#7744bb');
        legGrad.addColorStop(1, '#553399');
        ctx.strokeStyle = legGrad;
        ctx.lineWidth = 7;
        ctx.lineCap = 'round';

        // Left leg
        ctx.beginPath();
        ctx.moveTo(-6, -8);
        ctx.quadraticCurveTo(-10, 0, -8, 8);
        ctx.stroke();

        // Right leg
        ctx.beginPath();
        ctx.moveTo(6, -8);
        ctx.quadraticCurveTo(10, 0, 8, 8);
        ctx.stroke();

        // Body/torso - front view, slightly leaned back for braking
        const jacketGrad = ctx.createLinearGradient(-10, -30, 10, -5);
        jacketGrad.addColorStop(0, COLORS.cyan);
        jacketGrad.addColorStop(0.5, COLORS.electricBlue);
        jacketGrad.addColorStop(1, '#0099cc');
        ctx.fillStyle = jacketGrad;
        ctx.shadowColor = COLORS.cyan;
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.ellipse(0, -18, 10, 14, 0, 0, Math.PI * 2);
        ctx.fill();

        // Jacket stripe
        ctx.fillStyle = COLORS.magenta;
        ctx.beginPath();
        ctx.ellipse(0, -18, 10, 2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Arms - spread wide for balance/drag during braking
        ctx.strokeStyle = jacketGrad;
        ctx.lineWidth = 5;
        ctx.lineCap = 'round';

        // Left arm - out to the side
        ctx.beginPath();
        ctx.moveTo(-8, -20);
        ctx.quadraticCurveTo(-15, -18, -22, -12);
        ctx.stroke();

        // Right arm - out to the side
        ctx.beginPath();
        ctx.moveTo(8, -20);
        ctx.quadraticCurveTo(15, -18, 22, -12);
        ctx.stroke();

        // Gloves
        ctx.fillStyle = '#2244aa';
        ctx.beginPath();
        ctx.arc(-22, -12, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(22, -12, 4, 0, Math.PI * 2);
        ctx.fill();

        // Head - looking up the mountain
        ctx.fillStyle = '#ffcc99';
        ctx.beginPath();
        ctx.arc(0, -34, 8, 0, Math.PI * 2);
        ctx.fill();

        // Helmet/goggles
        ctx.fillStyle = '#222';
        ctx.beginPath();
        ctx.ellipse(0, -36, 9, 6, 0, Math.PI, Math.PI * 2);
        ctx.fill();

        // Goggles
        ctx.fillStyle = COLORS.cyan;
        ctx.shadowColor = COLORS.cyan;
        ctx.shadowBlur = 4;
        ctx.beginPath();
        ctx.ellipse(0, -35, 7, 3, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Snow spray effect from braking
        if (player.speed > 100) {
            const sprayIntensity = Math.min(1, player.speed / 400);
            ctx.fillStyle = `rgba(255, 255, 255, ${0.3 * sprayIntensity})`;
            for (let i = 0; i < 5; i++) {
                const sprayX = (Math.random() - 0.5) * 50;
                const sprayY = 15 + Math.random() * 10;
                const spraySize = 3 + Math.random() * 4;
                ctx.beginPath();
                ctx.arc(sprayX, sprayY, spraySize, 0, Math.PI * 2);
                ctx.fill();
            }
        }

    } else if (isTuckingDown) {
        // ===== TUCK POSE - BOARD HORIZONTAL, RIDER FACING DOWN THE MOUNTAIN =====
        // Board is perpendicular (horizontal) like braking, but rider faces DOWNHILL
        // This is the aerodynamic speed tuck - crouched low, looking where you're going
        // Regular stance: rider faces LEFT (down mountain), Goofy: rider faces RIGHT

        const faceDir = isGoofy ? 1 : -1;  // Which way the rider faces

        // Shadow - horizontal for sideways board
        ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
        ctx.beginPath();
        ctx.ellipse(0, 14 + shadowOffset, 22, 6, 0, 0, Math.PI * 2);
        ctx.fill();

        // Board - HORIZONTAL, perpendicular to slope
        const boardGrad = ctx.createLinearGradient(-20, 0, 20, 0);
        boardGrad.addColorStop(0, COLORS.hotPink);
        boardGrad.addColorStop(0.5, '#ff69b4');
        boardGrad.addColorStop(1, COLORS.magenta);
        ctx.fillStyle = boardGrad;
        ctx.shadowColor = COLORS.hotPink;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.roundRect(-22, 4, 44, 8, 4);
        ctx.fill();

        // Board edge highlight
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(-20, 5);
        ctx.lineTo(20, 5);
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Bindings
        ctx.fillStyle = '#333';
        ctx.fillRect(-12, 3, 8, 10);
        ctx.fillRect(4, 3, 8, 10);

        // Legs - CROUCHED LOW, knees deeply bent, facing downhill
        const legGrad = ctx.createLinearGradient(0, -5, 0, 10);
        legGrad.addColorStop(0, '#7744bb');
        legGrad.addColorStop(1, '#553399');
        ctx.strokeStyle = legGrad;
        ctx.lineWidth = 7;
        ctx.lineCap = 'round';

        // Front leg - deeply bent, positioned for downhill stance
        ctx.beginPath();
        ctx.moveTo(faceDir * 6, -2);
        ctx.quadraticCurveTo(faceDir * 10, 3, faceDir > 0 ? 8 : -8, 6);
        ctx.stroke();

        // Back leg - deeply bent
        ctx.beginPath();
        ctx.moveTo(faceDir * -4, -2);
        ctx.quadraticCurveTo(faceDir * 2, 4, faceDir > 0 ? -8 : 8, 6);
        ctx.stroke();

        // Body/torso - CROUCHED LOW, leaning forward into the tuck
        const jacketGrad = ctx.createLinearGradient(faceDir * -5, -15, faceDir * 10, 0);
        jacketGrad.addColorStop(0, COLORS.cyan);
        jacketGrad.addColorStop(0.5, COLORS.electricBlue);
        jacketGrad.addColorStop(1, '#0099cc');
        ctx.fillStyle = jacketGrad;
        ctx.shadowColor = COLORS.cyan;
        ctx.shadowBlur = 4;
        ctx.beginPath();
        // Torso low and compressed, leaning in direction of travel
        ctx.ellipse(faceDir * 4, -6, 8, 9, faceDir * 0.4, 0, Math.PI * 2);
        ctx.fill();

        // Jacket stripe
        ctx.fillStyle = COLORS.magenta;
        ctx.beginPath();
        ctx.ellipse(faceDir * 4, -6, 8, 2, faceDir * 0.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Arms - TUCKED IN close to body, hands near knees/chest
        ctx.strokeStyle = jacketGrad;
        ctx.lineWidth = 5;
        ctx.lineCap = 'round';

        // Lead arm - tucked down near front knee
        ctx.beginPath();
        ctx.moveTo(faceDir * 8, -8);
        ctx.quadraticCurveTo(faceDir * 12, -3, faceDir * 10, 1);
        ctx.stroke();

        // Trail arm - tucked against body
        ctx.beginPath();
        ctx.moveTo(faceDir * 0, -8);
        ctx.quadraticCurveTo(faceDir * -2, -4, faceDir * -2, 0);
        ctx.stroke();

        // Gloves
        ctx.fillStyle = '#2244aa';
        ctx.beginPath();
        ctx.arc(faceDir * 10, 1, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(faceDir * -2, 0, 3, 0, Math.PI * 2);
        ctx.fill();

        // Head - tucked down, looking DOWNHILL (direction of travel)
        ctx.fillStyle = '#ffcc99';
        ctx.beginPath();
        ctx.arc(faceDir * 8, -16, 7, 0, Math.PI * 2);
        ctx.fill();

        // Helmet
        ctx.fillStyle = '#222';
        ctx.beginPath();
        ctx.ellipse(faceDir * 8, -18, 8, 5, faceDir * 0.3, Math.PI, Math.PI * 2);
        ctx.fill();

        // Goggles - facing DOWN the mountain (direction of travel)
        ctx.fillStyle = COLORS.cyan;
        ctx.shadowColor = COLORS.cyan;
        ctx.shadowBlur = 3;
        ctx.beginPath();
        ctx.ellipse(faceDir * 12, -15, 4, 3, faceDir * 0.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

    } else if (goingStraight) {
        // STRAIGHT DOWN THE MOUNTAIN - SIDE PROFILE VIEW
        // Board points down, rider's body is SIDEWAYS on board (perpendicular to board direction)
        // We see the rider's side profile - one shoulder toward camera, one away
        // Regular stance: left foot forward (rider faces left), Goofy: right foot forward (rider faces right)

        // Calculate crouch compression
        const totalCrouch = Math.min(1, crouchFactor + airCrouch);
        const crouchY = totalCrouch * 8; // How much to compress down
        const kneeBend = totalCrouch * 6; // Extra knee bend

        // Shadow - elongated vertically for the vertical board
        ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
        ctx.beginPath();
        ctx.ellipse(0, 20 + shadowOffset, 10, 18, 0, 0, Math.PI * 2);
        ctx.fill();

        // Board - VERTICAL, pointing straight down the mountain
        // When airborne, board can be brought up (for grabs)
        const boardLift = player.airborne ? player.grabPhase * 10 : 0;
        const boardGrad = ctx.createLinearGradient(0, -8, 0, 28);
        boardGrad.addColorStop(0, COLORS.hotPink);
        boardGrad.addColorStop(0.5, '#ff69b4');
        boardGrad.addColorStop(1, COLORS.magenta);
        ctx.fillStyle = boardGrad;
        ctx.shadowColor = COLORS.hotPink;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.roundRect(-4, -4 + boardLift, 8, 36, 4);
        ctx.fill();

        // Board edge highlight (vertical)
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(-3, -2 + boardLift);
        ctx.lineTo(-3, 28 + boardLift);
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Bindings - horizontal across the vertical board
        ctx.fillStyle = '#333';
        ctx.fillRect(-6, 4 + boardLift, 12, 5);   // Front binding
        ctx.fillRect(-6, 18 + boardLift, 12, 5);  // Back binding

        // The rider faces sideways - we see their SIDE PROFILE
        // Flip drawing direction based on stance
        const faceDir = isGoofy ? 1 : -1;  // 1 = facing right, -1 = facing left

        // Legs - side view, bent knees in snowboard stance
        // Crouch makes knees bend more
        const legGrad = ctx.createLinearGradient(0, -10, 0, 20);
        legGrad.addColorStop(0, '#7744bb');
        legGrad.addColorStop(1, '#553399');
        ctx.strokeStyle = legGrad;
        ctx.lineWidth = 7;
        ctx.lineCap = 'round';

        // Front leg (bent, on front binding) - more bent when crouching
        ctx.beginPath();
        ctx.moveTo(faceDir * 4, -6 + crouchY);
        ctx.quadraticCurveTo(faceDir * (8 + kneeBend), 2 + crouchY * 0.5, 0, 7 + boardLift);
        ctx.stroke();

        // Back leg (bent, on back binding)
        ctx.beginPath();
        ctx.moveTo(faceDir * -2, -6 + crouchY);
        ctx.quadraticCurveTo(faceDir * (2 + kneeBend * 0.5), 12 + crouchY * 0.5, 0, 20 + boardLift);
        ctx.stroke();

        // Body/torso - SIDE VIEW (thin profile) - lowers with crouch
        const jacketGrad = ctx.createLinearGradient(faceDir * -8, -30, faceDir * 8, -5);
        jacketGrad.addColorStop(0, COLORS.cyan);
        jacketGrad.addColorStop(0.5, COLORS.electricBlue);
        jacketGrad.addColorStop(1, '#0099cc');
        ctx.fillStyle = jacketGrad;
        ctx.shadowColor = COLORS.cyan;
        ctx.shadowBlur = 6;
        ctx.beginPath();
        // Side profile of torso - thin ellipse, compressed when crouching
        const torsoY = -18 + crouchY;
        const torsoHeight = 14 - totalCrouch * 3;
        ctx.ellipse(faceDir * 2, torsoY, 7, torsoHeight, 0, 0, Math.PI * 2);
        ctx.fill();

        // Jacket stripe (side view)
        ctx.fillStyle = COLORS.magenta;
        ctx.beginPath();
        ctx.ellipse(faceDir * 2, torsoY, 7, 2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Arms - side view, position depends on crouch/grab state
        ctx.strokeStyle = jacketGrad;
        ctx.lineWidth = 5;
        ctx.lineCap = 'round';

        // Determine arm positions based on state
        let leadArmEndX = faceDir * 12;
        let leadArmEndY = -10 + crouchY;
        let trailArmEndX = faceDir * -6;
        let trailArmEndY = -8 + crouchY;

        // Airborne grab positions
        if (player.airborne && player.autoTrick && player.autoTrick.type === 'grab') {
            const grabStyle = player.autoTrick.grabStyle;
            const grabIntensity = player.grabPhase;

            if (grabStyle === 'indy' || grabStyle === 'mute') {
                // Reach down to grab the board between bindings
                leadArmEndX = faceDir * 2;
                leadArmEndY = lerp(-10, 12 + boardLift, grabIntensity);
            } else if (grabStyle === 'method' || grabStyle === 'melon') {
                // One arm up, one grabbing behind
                leadArmEndX = faceDir * 15;
                leadArmEndY = lerp(-10, -30, grabIntensity); // Arm up in the air
                trailArmEndX = 0;
                trailArmEndY = lerp(-8, 10 + boardLift, grabIntensity); // Grab board
            } else if (grabStyle === 'tail') {
                // Reach back for tail
                leadArmEndY = lerp(-10, -5 + crouchY, grabIntensity);
                trailArmEndX = faceDir * -2;
                trailArmEndY = lerp(-8, 25 + boardLift, grabIntensity);
            } else if (grabStyle === 'nose') {
                // Reach forward for nose
                leadArmEndX = faceDir * 4;
                leadArmEndY = lerp(-10, -2 + boardLift, grabIntensity);
            } else if (grabStyle === 'stale' || grabStyle === 'roastbeef') {
                // Reach between legs behind
                trailArmEndX = faceDir * -1;
                trailArmEndY = lerp(-8, 15 + boardLift, grabIntensity);
            } else if (grabStyle === 'japan') {
                // Japan air - grab with lead hand, other arm trails
                leadArmEndX = faceDir * 3;
                leadArmEndY = lerp(-10, 8 + boardLift, grabIntensity);
                trailArmEndX = faceDir * -12;
                trailArmEndY = lerp(-8, -20, grabIntensity); // Trailing arm up and back
            } else if (grabStyle === 'crail') {
                // Crail - lead hand to nose
                leadArmEndX = faceDir * 5;
                leadArmEndY = lerp(-10, -5 + boardLift, grabIntensity);
            }
        } else if (player.airborne) {
            // Default airborne pose - arms out for balance, CONTROLLED (not flailing)
            // Both arms extend outward like maintaining balance in the air
            leadArmEndX = faceDir * 14;
            leadArmEndY = -12;
            trailArmEndX = faceDir * -10;
            trailArmEndY = -10;
        } else if (isTuckingDown) {
            // TUCK POSE - pressing DOWN to go faster
            // Arms tucked in close to body, very aerodynamic
            leadArmEndX = faceDir * 6;
            leadArmEndY = crouchY - 2;  // Arms low and forward
            trailArmEndX = faceDir * -3;
            trailArmEndY = crouchY - 1;  // Arms tucked behind
        } else if (totalCrouch > 0.3) {
            // Pre-jump crouch - arms come down and forward for balance
            leadArmEndX = faceDir * (12 - totalCrouch * 4);
            leadArmEndY = -10 + crouchY + totalCrouch * 5;
            trailArmEndX = faceDir * (-6 + totalCrouch * 3);
            trailArmEndY = -8 + crouchY + totalCrouch * 4;
        }

        // Leading arm (in front, bent for balance)
        ctx.beginPath();
        ctx.moveTo(faceDir * 6, torsoY - 4);
        ctx.quadraticCurveTo(faceDir * 10, torsoY, leadArmEndX, leadArmEndY);
        ctx.stroke();
        // Trailing arm (behind, relaxed)
        ctx.beginPath();
        ctx.moveTo(faceDir * -2, torsoY - 4);
        ctx.quadraticCurveTo(faceDir * -5, torsoY + 2, trailArmEndX, trailArmEndY);
        ctx.stroke();

        // Gloves
        ctx.fillStyle = '#2244aa';
        ctx.beginPath();
        ctx.arc(leadArmEndX, leadArmEndY, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(trailArmEndX, trailArmEndY, 3, 0, Math.PI * 2);
        ctx.fill();

        // Head - SIDE PROFILE - lowers with crouch
        const headY = -36 + crouchY * 0.7;
        ctx.fillStyle = '#ffcc99';  // Skin tone for face
        ctx.beginPath();
        ctx.arc(faceDir * 3, headY, 8, 0, Math.PI * 2);
        ctx.fill();

        // Helmet - side view
        ctx.fillStyle = '#222';
        ctx.beginPath();
        ctx.arc(faceDir * 3, headY - 2, 9, Math.PI * 0.8, Math.PI * 2.2);
        ctx.fill();

        // Helmet color accent
        ctx.fillStyle = COLORS.hotPink;
        ctx.beginPath();
        ctx.arc(faceDir * 3, headY - 4, 7, Math.PI, Math.PI * 2);
        ctx.fill();

        // Goggles - side view (visible on the side of face)
        const goggleY = headY - 1;
        const goggleGrad = ctx.createLinearGradient(faceDir * -2, goggleY - 3, faceDir * 8, goggleY + 3);
        goggleGrad.addColorStop(0, COLORS.magenta);
        goggleGrad.addColorStop(0.5, '#ff66cc');
        goggleGrad.addColorStop(1, COLORS.cyan);
        ctx.fillStyle = goggleGrad;
        ctx.shadowColor = COLORS.magenta;
        ctx.shadowBlur = 4;
        ctx.beginPath();
        ctx.ellipse(faceDir * 6, goggleY, 5, 3, faceDir * 0.3, 0, Math.PI * 2);
        ctx.fill();

        // Goggle lens shine
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.beginPath();
        ctx.ellipse(faceDir * 5, goggleY - 1, 2, 1, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
    } else {
        // CARVING - board is HORIZONTAL (original drawing)
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
    }

    // Arms, head, helmet - only draw if NOT going straight (straight pose already drew these)
    if (!goingStraight) {
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
                // Spin tricks - arms out for balance, controlled pose
                leftArmX = -20; leftArmY = -10;
                rightArmX = 20; rightArmY = -10;
            }
        } else if (player.airborne) {
            // Default airborne pose - arms out to the sides for balance, CONTROLLED (no flailing)
            // Arms slightly raised and spread like a skydiver maintaining stability
            leftArmX = -20; leftArmY = -8;
            rightArmX = 20; rightArmY = -8;
        }

        // Need to recreate jacketGrad for arms since it was in the else block
        const armGrad = ctx.createLinearGradient(-12, -20, 12, 10);
        armGrad.addColorStop(0, COLORS.cyan);
        armGrad.addColorStop(0.5, COLORS.electricBlue);
        armGrad.addColorStop(1, '#0099cc');
        ctx.strokeStyle = armGrad;
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
    }

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

        // Draw aura behind sprite - dark blue/cyan tones like the portrait
        const pulseIntensity = 0.5 + Math.sin(time * 5) * 0.3;
        const auraGrad = ctx.createRadialGradient(screen.x, screen.y, 20, screen.x, screen.y, 80 * scale);
        auraGrad.addColorStop(0, `rgba(0, 180, 220, ${pulseIntensity * 0.4})`);
        auraGrad.addColorStop(0.5, `rgba(20, 60, 100, ${pulseIntensity * 0.3})`);
        auraGrad.addColorStop(1, 'rgba(10, 20, 40, 0)');
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

    // Pulsing aura gradient - dark blue/cyan like the portrait
    const pulseIntensity = 0.5 + Math.sin(time * 5) * 0.3;
    const auraGrad = ctx.createRadialGradient(0, 0, 20, 0, 0, 70);
    auraGrad.addColorStop(0, `rgba(0, 180, 220, ${pulseIntensity * 0.4})`);
    auraGrad.addColorStop(0.5, `rgba(20, 60, 100, ${pulseIntensity * 0.3})`);
    auraGrad.addColorStop(1, 'rgba(10, 20, 40, 0)');
    ctx.fillStyle = auraGrad;
    ctx.beginPath();
    ctx.arc(0, 0, 70, 0, Math.PI * 2);
    ctx.fill();

    // Animated shadow tendrils around body - dark blue/black
    ctx.strokeStyle = 'rgba(10, 30, 50, 0.7)';
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

    // Main body - dark blue/black like the portrait (not purple)
    const bodyGrad = ctx.createRadialGradient(0, -10, 5, 0, 10, 50);
    bodyGrad.addColorStop(0, '#1a2a3a');  // Dark blue-gray center
    bodyGrad.addColorStop(0.4, '#0d1a28'); // Very dark blue
    bodyGrad.addColorStop(0.8, '#050d15'); // Near black
    bodyGrad.addColorStop(1, '#020508');   // Pure dark
    ctx.fillStyle = bodyGrad;
    ctx.shadowColor = COLORS.cyan;
    ctx.shadowBlur = 20;
    ctx.beginPath();
    ctx.ellipse(0, 0, 35, 45, 0, 0, Math.PI * 2);
    ctx.fill();

    // Fur texture lines - dark blue tones
    ctx.strokeStyle = 'rgba(30, 60, 90, 0.5)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 8; i++) {
        const fx = -25 + i * 7;
        ctx.beginPath();
        ctx.moveTo(fx, -30);
        ctx.lineTo(fx + Math.sin(time * 2 + i) * 3, 25);
        ctx.stroke();
    }

    // Wispy hair/fur strands on top
    ctx.strokeStyle = 'rgba(20, 40, 60, 0.6)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 5; i++) {
        const baseX = -15 + i * 7.5;
        const wave = Math.sin(time * 3 + i * 0.7) * 5;
        ctx.beginPath();
        ctx.moveTo(baseX, -40);
        ctx.quadraticCurveTo(baseX + wave, -55, baseX + wave * 0.5, -60);
        ctx.stroke();
    }

    // Eyes - BOTH CYAN like the portrait (glowing cyan eyes)
    const eyeTrack = Math.sin(time) * 2; // Subtle eye movement
    ctx.fillStyle = COLORS.cyan;
    ctx.shadowColor = COLORS.cyan;
    ctx.shadowBlur = 25;
    // Left eye
    ctx.beginPath();
    ctx.ellipse(-14 + eyeTrack, -18, 8, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    // Right eye - ALSO CYAN (matching the portrait)
    ctx.beginPath();
    ctx.ellipse(14 + eyeTrack, -18, 8, 10, 0, 0, Math.PI * 2);
    ctx.fill();

    // Bright white/cyan eye cores
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = '#ffffff';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.ellipse(-14 + eyeTrack, -18, 4, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(14 + eyeTrack, -18, 4, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Eye glow rings - both cyan
    ctx.strokeStyle = COLORS.cyan;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(-14 + eyeTrack, -18, 10, 12, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(14 + eyeTrack, -18, 10, 12, 0, 0, Math.PI * 2);
    ctx.stroke();

    // No pupils - the eyes are just glowing orbs (like the portrait)
    ctx.shadowBlur = 0;

    // Dark maw/mouth - subtle, not glowing pink
    ctx.fillStyle = 'rgba(5, 15, 25, 0.8)';
    ctx.beginPath();
    ctx.ellipse(0, 15, 15, 10, 0, 0, Math.PI);
    ctx.fill();

    // Subtle inner glow in mouth (faint cyan/white)
    ctx.fillStyle = 'rgba(100, 180, 200, 0.2)';
    ctx.beginPath();
    ctx.ellipse(0, 14, 10, 6, 0, 0, Math.PI);
    ctx.fill();

    // Teeth - slightly blue-tinted white
    ctx.fillStyle = '#e8f4f8';
    ctx.shadowColor = COLORS.cyan;
    ctx.shadowBlur = 3;
    const teethCount = 5;
    for (let i = 0; i < teethCount; i++) {
        const tx = -10 + (i * 20 / (teethCount - 1));
        const th = 6 + Math.sin(i * 1.5) * 2; // Varying heights
        ctx.beginPath();
        ctx.moveTo(tx - 2, 10);
        ctx.lineTo(tx, 10 + th);
        ctx.lineTo(tx + 2, 10);
        ctx.closePath();
        ctx.fill();
    }

    // Claws appear during lunge - dark blue/black with subtle cyan glow
    if (chase.beastState === 'lunging') {
        ctx.fillStyle = '#1a2a3a';
        ctx.shadowColor = COLORS.cyan;
        ctx.shadowBlur = 6;
        for (let side = -1; side <= 1; side += 2) {
            for (let c = 0; c < 3; c++) {
                const clawX = side * 35;
                const clawY = -10 + c * 10;
                ctx.beginPath();
                ctx.moveTo(clawX, clawY);
                ctx.lineTo(clawX + side * 18, clawY + 4);
                ctx.lineTo(clawX, clawY + 3);
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
        const barFill = gameState.trickComboTimer / 2.5;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(CANVAS_WIDTH/2 - barWidth/2, comboY + 18, barWidth, 4);
        ctx.fillStyle = COLORS.yellow;
        ctx.fillRect(CANVAS_WIDTH/2 - barWidth/2, comboY + 18, barWidth * barFill, 4);

        // Chain count
        if (gameState.comboChainLength > 1) {
            ctx.font = '10px "Press Start 2P", monospace';
            ctx.fillStyle = COLORS.limeGreen;
            ctx.fillText(`${gameState.comboChainLength} chain`, CANVAS_WIDTH/2, comboY + 26);
        }
    }

    // Flow meter (bottom left)
    if (gameState.flowMeter > 5) {
        const flowY = CANVAS_HEIGHT - 40;
        const flowBarWidth = 80;
        const flowFill = gameState.flowMeter / 100;

        // Flow bar background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(15, flowY, flowBarWidth, 10);

        // Flow bar fill with gradient
        const flowGrad = ctx.createLinearGradient(15, flowY, 15 + flowBarWidth, flowY);
        flowGrad.addColorStop(0, COLORS.cyan);
        flowGrad.addColorStop(0.5, COLORS.limeGreen);
        flowGrad.addColorStop(1, COLORS.yellow);
        ctx.fillStyle = flowGrad;
        ctx.fillRect(15, flowY, flowBarWidth * flowFill, 10);

        // Flow label
        ctx.font = '8px "Press Start 2P", monospace';
        ctx.textAlign = 'left';
        ctx.fillStyle = COLORS.cyan;
        ctx.fillText('FLOW', 15, flowY - 12);

        // Flow multiplier
        if (gameState.flowMultiplier > 1.1) {
            ctx.fillStyle = COLORS.limeGreen;
            ctx.fillText(`x${gameState.flowMultiplier.toFixed(1)}`, 15 + flowBarWidth + 8, flowY);
        }
    }

    // Collectibles count (bottom right)
    if (gameState.collectiblesCollected > 0) {
        ctx.font = '10px "Press Start 2P", monospace';
        ctx.textAlign = 'right';
        ctx.fillStyle = COLORS.yellow;
        ctx.shadowColor = COLORS.yellow;
        ctx.shadowBlur = 5;
        ctx.fillText(`❄${gameState.collectiblesCollected}`, CANVAS_WIDTH - 15, CANVAS_HEIGHT - 35);
        ctx.shadowBlur = 0;
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
        currentGrindable: null,
        crashed: false,
        crashTimer: 0,
        stunned: 0,
        invincible: 0,
        trickRotation: 0,
        autoTrick: null,
        autoTrickProgress: 0,
        flipRotation: 0,
        grabPhase: 0,
        grabTweak: 0,
        grabPoke: 0,
        spinDirection: 0,
        preJumpAngle: 0,
        jumpLaunchPower: 0,
        preloadCrouch: 0,
        approachingJump: null
    };

    gameState.camera = {
        y: -CANVAS_HEIGHT * 0.35,
        targetY: 0,
        lookAhead: 150
    };

    gameState.terrain = {
        chunks: [],
        nextChunkY: 0,
        seed: Math.floor(Math.random() * 100000),
        lastLodgeY: -9999
    };

    gameState.obstacles = [];
    gameState.jumps = [];
    gameState.rails = [];
    gameState.lodges = [];

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
    gameState.comboChainLength = 0;

    // Collectibles and boosts
    gameState.collectibles = [];
    gameState.boostPads = [];
    gameState.collectiblesCollected = 0;

    // Flow state
    gameState.flowMeter = 0;
    gameState.flowMultiplier = 1;
    gameState.nearMissStreak = 0;
    gameState.speedStreak = 0;
    gameState.speedBonus = 0;

    gameState.particles = [];
    gameState.celebrations = [];
    gameState.screenShake = { x: 0, y: 0, intensity: 0, decay: 0.9 };

    gameState.lodge = {
        active: false,
        timeInside: 0,
        playerX: 0,
        playerY: 0,
        currentLodge: null,
        warningShown: false
    };

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

    // Handle lodge state
    if (gameState.screen === 'lodge') {
        updateLodge(dt);
        return;
    }

    if (gameState.screen !== 'playing') return;

    // Update game systems
    updatePlayer(dt);
    updateCamera(dt);
    updateTerrain();
    checkApproachingJump(gameState.player, dt); // Check for crouch animation
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

function updateLodge(dt) {
    const lodge = gameState.lodge;

    // Update time inside
    lodge.timeInside += dt;

    // Check for forced exit
    if (lodge.timeInside >= LODGE.maxStayTime) {
        exitLodge();
        addCelebration('TIME\'S UP!', COLORS.warning);
        return;
    }

    // Show warning when time is running low
    if (lodge.timeInside >= LODGE.maxStayTime - LODGE.warningTime && !lodge.warningShown) {
        lodge.warningShown = true;
        addCelebration('BEAST APPROACHES!', COLORS.warning);
    }

    // Handle walking movement
    const speed = LODGE.walkSpeed * dt;
    const margin = 30;

    if (input.left) {
        lodge.playerX = Math.max(margin, lodge.playerX - speed);
    }
    if (input.right) {
        lodge.playerX = Math.min(LODGE.interiorWidth - margin, lodge.playerX + speed);
    }
    if (input.up) {
        lodge.playerY = Math.max(margin + 60, lodge.playerY - speed); // Can't walk into back wall
    }
    if (input.down) {
        lodge.playerY = Math.min(LODGE.interiorHeight - margin, lodge.playerY + speed);
    }

    // Check if player reached exit door
    const exitX = LODGE.interiorWidth / 2;
    const exitY = LODGE.interiorHeight - 20;
    const distToExit = Math.sqrt(
        Math.pow(lodge.playerX - exitX, 2) +
        Math.pow(lodge.playerY - exitY, 2)
    );

    if (distToExit < 40) {
        exitLodge();
    }
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

    // Make sure start screen fills viewport on initial load
    resizeStartScreenCanvases();

    setupInput();
    loadHighScore();
    loadStance();
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

    // Stance select (regular/goofy)
    const stanceSelect = document.getElementById('stanceSelect');
    if (stanceSelect) stanceSelect.value = displaySettings.stance;

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

function setStance(stance) {
    displaySettings.stance = stance;
    try {
        localStorage.setItem('shredordead_stance', stance);
    } catch (e) {}
    updateSettingsUI();
}

function loadStance() {
    try {
        const saved = localStorage.getItem('shredordead_stance');
        if (saved && (saved === 'regular' || saved === 'goofy')) {
            displaySettings.stance = saved;
        }
    } catch (e) {}
}

function resetAllSettings() {
    displaySettings.autoDetect = true;
    displaySettings.screenShakeEnabled = true;
    displaySettings.fillScreen = true;
    displaySettings.stance = 'regular';
    try {
        localStorage.removeItem('shredordead_resolution');
        localStorage.removeItem('shredordead_autodetect');
        localStorage.removeItem('shredordead_screenshake');
        localStorage.removeItem('shredordead_fillscreen');
        localStorage.removeItem('shredordead_stance');
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

    // Start screen ALWAYS fills the viewport (both fullscreen and windowed mode)
    startScreen.style.position = 'fixed';
    startScreen.style.width = '100vw';
    startScreen.style.height = '100vh';
    startScreen.style.top = '0';
    startScreen.style.left = '0';
    startScreen.style.transform = 'none';
    startScreen.style.borderRadius = '0';
    startScreen.style.border = 'none';
    startScreen.style.boxShadow = 'none';

    // Wait a frame for layout to update, then resize canvases
    requestAnimationFrame(() => {
        const snowCanvas = document.getElementById('snowCanvas');
        const blizzardCanvas = document.getElementById('blizzardCanvas');

        if (snowCanvas) {
            snowCanvas.width = startScreen.offsetWidth;
            snowCanvas.height = startScreen.offsetHeight;
        }

        // Blizzard canvas scales with viewport size
        if (blizzardCanvas) {
            // Scale blizzard canvas based on viewport width
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;
            blizzardCanvas.width = Math.min(800, viewportWidth * 0.6);
            blizzardCanvas.height = Math.min(500, viewportHeight * 0.45);
        }
    });
}

window.addEventListener('resize', () => {
    fitCanvasToViewport();
    resizeStartScreenCanvases();
});

// Start the game when the page loads
window.addEventListener('load', init);
