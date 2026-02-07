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
// PERFORMANCE SETTINGS
// ============================================
const performanceSettings = {
    shadowQuality: 'off',     // 'high', 'medium', 'low', 'off' - off for 60fps performance
    particleMultiplier: 0.5,  // Reduce particle spawn rate
    maxParticles: 30,         // Cap particle count for performance
    skipFrameThreshold: 0.05  // Skip rendering if dt > this (lag spike recovery)
};

// Helper to get shadow blur based on quality setting - USE THIS for all shadowBlur calls
function getShadowBlur(baseBlur) {
    switch (performanceSettings.shadowQuality) {
        case 'high': return baseBlur;
        case 'medium': return Math.floor(baseBlur * 0.5);
        case 'low': return Math.floor(baseBlur * 0.2);
        case 'off': return 0;
        default: return baseBlur;
    }
}

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
    // Extended cache for frequently-used gradients
    railGradients: new Map(),
    obstacleGradients: new Map(),
    // Static gradients (position-independent, created once)
    static: {
        treeTrunk: null,
        supportPost: null,
        railBody: null,
        flowMeter: null,
        railShadow: null
    },

    invalidate() {
        this.background = null;
        this.dangerVignette = null;
        this.fogGradient = null;
        this.railGradients.clear();
        this.obstacleGradients.clear();
        this.static.treeTrunk = null;
        this.static.supportPost = null;
        this.static.railBody = null;
        this.static.flowMeter = null;
        this.static.railShadow = null;
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
    },

    // Get or create a cached gradient
    getGradient(key, creator) {
        if (!this.railGradients.has(key)) {
            this.railGradients.set(key, creator());
        }
        return this.railGradients.get(key);
    },

    // Initialize static gradients (call once when ctx is available)
    initStaticGradients(ctx) {
        // Tree trunk gradient (horizontal, 10px wide)
        if (!this.static.treeTrunk) {
            const trunkGrad = ctx.createLinearGradient(-5, 0, 5, 0);
            trunkGrad.addColorStop(0, '#3a2718');
            trunkGrad.addColorStop(0.5, '#5a4738');
            trunkGrad.addColorStop(1, '#3a2718');
            this.static.treeTrunk = trunkGrad;
        }
        // Support post gradient (vertical, 12px tall)
        if (!this.static.supportPost) {
            const supportGrad = ctx.createLinearGradient(0, 0, 0, 12);
            supportGrad.addColorStop(0, '#888');
            supportGrad.addColorStop(0.5, '#aaa');
            supportGrad.addColorStop(1, '#666');
            this.static.supportPost = supportGrad;
        }
        // Rail body gradient (vertical, 8px for cylindrical effect)
        if (!this.static.railBody) {
            const railGrad = ctx.createLinearGradient(0, -4, 0, 4);
            railGrad.addColorStop(0, '#ddd');
            railGrad.addColorStop(0.3, '#fff');
            railGrad.addColorStop(0.5, '#ccc');
            railGrad.addColorStop(1, '#888');
            this.static.railBody = railGrad;
        }
        // Flow meter gradient (horizontal, 80px)
        if (!this.static.flowMeter) {
            const flowGrad = ctx.createLinearGradient(0, 0, 80, 0);
            flowGrad.addColorStop(0, '#00ffff');  // COLORS.cyan
            flowGrad.addColorStop(0.5, '#00ff00'); // COLORS.limeGreen
            flowGrad.addColorStop(1, '#ffd700');  // COLORS.gold
            this.static.flowMeter = flowGrad;
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
// PERFORMANCE OPTIMIZATION: CACHED FONT STRINGS
// ============================================
// Pre-built font strings to avoid string concatenation every frame
const FONTS = {
    pressStart8: '8px "Press Start 2P", monospace',
    pressStart10: '10px "Press Start 2P", monospace',
    pressStart12: 'bold 12px "Press Start 2P", monospace',
    pressStart14: 'bold 14px "Press Start 2P", monospace',
    pressStart16: 'bold 16px "Press Start 2P", monospace',
    pressStart20: 'bold 20px "Press Start 2P", monospace',
    pressStart24: 'bold 24px "Press Start 2P", monospace',
    pressStart32: 'bold 32px "Press Start 2P", monospace'
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

// ============================================
// MUSIC SYSTEM
// ============================================
const musicManager = {
    audio: null,
    enabled: true,
    volume: 0.5,
    fadeInterval: null,
    postDeathTimer: null,

    init() {
        this.audio = new Audio('assets/music/shredordead.mp3');
        this.audio.loop = true;
        this.audio.volume = this.volume;
        this.audio.preload = 'auto';

        try {
            const saved = localStorage.getItem('shredordead_music');
            if (saved !== null) this.enabled = saved !== 'false';
        } catch (e) {}
    },

    play() {
        if (!this.audio || !this.enabled) return;
        this.clearTimers();
        this.audio.volume = this.volume;
        const promise = this.audio.play();
        if (promise) promise.catch(() => {});
    },

    stop() {
        if (!this.audio) return;
        this.clearTimers();
        this.audio.pause();
        this.audio.currentTime = 0;
        this.audio.volume = this.volume;
    },

    fadeOut(durationMs = 3000) {
        if (!this.audio) return;
        this.clearFade();
        const startVolume = this.audio.volume;
        const steps = 30;
        const stepTime = durationMs / steps;
        const volumeStep = startVolume / steps;
        let currentStep = 0;

        this.fadeInterval = setInterval(() => {
            currentStep++;
            this.audio.volume = Math.max(0, startVolume - volumeStep * currentStep);
            if (currentStep >= steps) {
                this.audio.pause();
                this.audio.currentTime = 0;
                this.audio.volume = this.volume;
                this.clearFade();
            }
        }, stepTime);
    },

    startPostDeathTimer() {
        this.clearPostDeathTimer();
        this.postDeathTimer = setTimeout(() => {
            this.fadeOut(3000);
        }, 30000);
    },

    clearFade() {
        if (this.fadeInterval) {
            clearInterval(this.fadeInterval);
            this.fadeInterval = null;
        }
    },

    clearPostDeathTimer() {
        if (this.postDeathTimer) {
            clearTimeout(this.postDeathTimer);
            this.postDeathTimer = null;
        }
    },

    clearTimers() {
        this.clearFade();
        this.clearPostDeathTimer();
    }
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
    // Warm accent colors (replacing yellow with more neon-appropriate tones)
    gold: '#ffd700',           // Warm gold for achievements/bonuses
    neonOrange: '#ff6b35',     // Neon orange for UI elements
    warmWhite: '#fff5e6',      // Warm white for collectibles
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
    beastSpeed: 1.4,            // 40% faster than player!
    beastLungeInterval: 1.5,    // More frequent lunges
    beastLungeVariance: 0.5,    // Less random delay
    beastLungeDuration: 0.35,
    beastRetreatDuration: 0.4,  // Shorter retreat
    // Crash triggers (beast only spawns from crashes)
    crashThreshold: 3,          // 3 crashes in window = beast spawns
    crashWindow: 30,            // Track crashes over 30 seconds
    // Catch mechanics
    maxMisses: 2,               // After 2 misses, next lunge is guaranteed
    guaranteedCatchCrashes: 5,  // 5 total crashes = guaranteed catch on next lunge
    baseCatchRadius: 35,        // Normal catch radius
    enhancedCatchRadius: 70,    // Catch radius after too many crashes/misses
    // Avalanche visual config
    avalancheCloudCount: 10,    // Number of billowing snow clouds
    avalancheDebrisCount: 18,   // Snow chunks ahead of wall
    avalancheSprayCount: 25     // Fine powder particles
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
    spawnChance: 0.01,          // 1% chance per chunk (very rare)
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

// ============================================
// HUD PANEL OVERLAY - Bottom panel frame
// ============================================
const hudPanel = {
    image: null,
    loaded: false,
    canvas: null,       // Offscreen canvas for composited panel
    cachedWidth: 0,
    cachedHeight: 0,
    panelHeight: 72     // Height of panel in base resolution pixels — thin band for 2 rows of text
};

async function loadHUDPanel() {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            hudPanel.image = img;
            hudPanel.loaded = true;
            compositeHUDPanel();
            console.log('HUD panel loaded');
            resolve(true);
        };
        img.onerror = () => {
            console.warn('HUD panel failed to load, using text-only HUD');
            hudPanel.loaded = false;
            resolve(false);
        };
        img.src = 'assets/hud/hud-panel.png';
    });
}

function compositeHUDPanel() {
    if (!hudPanel.loaded || !hudPanel.image) return;

    const img = hudPanel.image;
    const w = CANVAS_WIDTH;
    const scale = getUIScale();
    const h = Math.round(hudPanel.panelHeight * scale);

    hudPanel.canvas = document.createElement('canvas');
    hudPanel.canvas.width = w;
    hudPanel.canvas.height = h;
    const pCtx = hudPanel.canvas.getContext('2d');

    // Draw the full panel image scaled to fit the bottom bar area
    pCtx.drawImage(img, 0, 0, img.width, img.height, 0, 0, w, h);

    hudPanel.cachedWidth = w;
    hudPanel.cachedHeight = CANVAS_HEIGHT;
}

// ===================
// GAME STATE
// ===================

let canvas, ctx;
let lastTime = 0;
let selectedMode = 'og'; // 'og' or 'slalom'

let gameState = {
    screen: 'title', // 'title', 'playing', 'gameOver', 'lodge', 'slalomResults'
    mode: 'og', // 'og' or 'slalom'
    animationTime: 0,

    player: {
        x: 0,
        y: 0,
        visualX: 0,
        visualY: 0,
        speed: 260,
        lateralSpeed: 0,
        angle: 0,
        airborne: false,
        altitude: 0,
        verticalVelocity: 0,
        airTime: 0,
        grinding: false,
        grindProgress: 0,
        grindStartTime: 0,
        grindFrames: 0,
        grindImmunity: 0,
        grindTrick: null,              // Current grind trick type
        grindTrickDisplayTimer: 0,     // Timer for showing trick name
        lastRail: null,
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
        lastLodgeY: -9999,  // Track last lodge spawn position
        pendingExclusions: {}  // Cross-chunk landing zone exclusions keyed by chunkIndex
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
        totalCrashes: 0,        // Total crashes this game session
        missCount: 0,           // Consecutive lunge misses
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
    highScore: 0,

    // Death animation state (for beast chomp sequence)
    deathAnimation: {
        active: false,
        type: null,         // 'beast', 'fog', etc.
        timer: 0,           // Total animation time
        phase: 0,           // 0: grab, 1: chomp, 2: fade
        playerX: 0,
        playerY: 0,
        beastX: 0,
        beastY: 0,
        chompCount: 0,      // Number of chomps completed
        completed: false    // Prevents re-triggering after animation plays
    }
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

// Touch control state for mobile devices
const touchState = {
    active: false,
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0,
    touchId: null,
    startTime: 0
};

// Touch sensitivity thresholds (in pixels)
const TOUCH_THRESHOLDS = {
    horizontal: 20,      // Movement to trigger left/right
    vertical: 30,        // Movement to trigger up/down
    tapMaxDistance: 15,  // Max movement for tap gesture
    tapMaxDuration: 200  // Max ms for tap gesture
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
            case 'Escape':
                if (document.fullscreenElement) {
                    document.exitFullscreen();
                }
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

// ===================
// TOUCH INPUT (MOBILE)
// ===================

function setupTouchInput() {
    // Use document-level listeners for best iOS compatibility
    document.addEventListener('touchstart', handleTouchStart, { passive: false });
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd, { passive: false });
    document.addEventListener('touchcancel', handleTouchEnd, { passive: false });
}

function handleTouchStart(e) {
    // Check if touching an interactive element (button, link, input, etc.)
    const target = e.target;
    const isInteractive = target.tagName === 'BUTTON' ||
                          target.tagName === 'A' ||
                          target.tagName === 'INPUT' ||
                          target.tagName === 'SELECT' ||
                          target.closest('button') ||
                          target.closest('a') ||
                          target.closest('.menu-btn') ||
                          target.closest('.submenu') ||
                          target.closest('#settingsMenu') ||
                          target.closest('#startScreen');

    // Only prevent default during active gameplay, allow menu interactions
    if (gameState.screen === 'playing' || gameState.screen === 'lodge') {
        e.preventDefault();
    } else if (isInteractive) {
        // Allow the touch event to pass through to buttons on menus
        return;
    }

    // Always take the first touch
    const touch = e.changedTouches[0] || e.touches[0];
    if (!touch) return;

    touchState.active = true;
    touchState.touchId = touch.identifier;
    touchState.startX = touch.clientX;
    touchState.startY = touch.clientY;
    touchState.currentX = touch.clientX;
    touchState.currentY = touch.clientY;
    touchState.startTime = performance.now();

    // Reset input flags
    input.left = false;
    input.right = false;
    input.up = false;
    input.down = false;
}

function handleTouchMove(e) {
    // Only prevent default during active gameplay
    if (gameState.screen === 'playing' || gameState.screen === 'lodge') {
        e.preventDefault();
    }
    if (!touchState.active) return;

    // Find our touch or use first available
    let touch = null;
    for (let i = 0; i < e.touches.length; i++) {
        if (e.touches[i].identifier === touchState.touchId) {
            touch = e.touches[i];
            break;
        }
    }
    if (!touch && e.touches.length > 0) {
        touch = e.touches[0];
    }
    if (!touch) return;

    touchState.currentX = touch.clientX;
    touchState.currentY = touch.clientY;

    const deltaX = touchState.currentX - touchState.startX;
    const deltaY = touchState.currentY - touchState.startY;

    // Horizontal steering (left/right)
    if (deltaX > TOUCH_THRESHOLDS.horizontal) {
        input.right = true;
        input.left = false;
    } else if (deltaX < -TOUCH_THRESHOLDS.horizontal) {
        input.left = true;
        input.right = false;
    } else {
        input.left = false;
        input.right = false;
    }

    // Vertical speed control (up = brake, down = tuck/accelerate)
    if (deltaY < -TOUCH_THRESHOLDS.vertical) {
        input.up = true;
        input.down = false;
    } else if (deltaY > TOUCH_THRESHOLDS.vertical) {
        input.down = true;
        input.up = false;
    } else {
        input.up = false;
        input.down = false;
    }

}

function handleTouchEnd(e) {
    // Only prevent default during active gameplay
    if (gameState.screen === 'playing' || gameState.screen === 'lodge') {
        e.preventDefault();
    }

    if (!touchState.active) return;

    // Check if our tracked touch ended
    let ourTouchEnded = true;
    for (let i = 0; i < e.touches.length; i++) {
        if (e.touches[i].identifier === touchState.touchId) {
            ourTouchEnded = false;
            break;
        }
    }
    if (!ourTouchEnded) return;

    // Detect tap gesture for start/confirm
    const duration = performance.now() - touchState.startTime;
    const distance = Math.hypot(
        touchState.currentX - touchState.startX,
        touchState.currentY - touchState.startY
    );

    if (duration < TOUCH_THRESHOLDS.tapMaxDuration && distance < TOUCH_THRESHOLDS.tapMaxDistance) {
        // Fire momentary space input for tap
        input.space = true;
        setTimeout(() => { input.space = false; }, 100);
    }

    // Reset touch state
    touchState.active = false;
    touchState.touchId = null;
    input.left = false;
    input.right = false;
    input.up = false;
    input.down = false;
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

// PERFORMANCE: In-place array culling using swap-and-pop (O(1) removal, no allocation)
function cullArrayInPlace(arr, shouldRemove) {
    for (let i = arr.length - 1; i >= 0; i--) {
        if (shouldRemove(arr[i])) {
            arr[i] = arr[arr.length - 1];
            arr.pop();
        }
    }
}

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
    const colors = [COLORS.cyan, COLORS.magenta, COLORS.hotPink, COLORS.electricBlue, COLORS.limeGreen, COLORS.neonOrange];
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
    const particles = gameState.particles;
    const maxParticles = performanceSettings.maxParticles;

    // Enforce particle limit using swap-and-pop (O(1) per removal instead of O(n))
    while (particles.length > maxParticles) {
        ParticlePool.release(particles.pop());
    }

    // Update particles using swap-and-pop for removal (O(1) instead of O(n) splice)
    let i = 0;
    while (i < particles.length) {
        const p = particles[i];
        p.age += dt;

        if (p.age >= p.lifetime) {
            // Swap with last element and pop (O(1) removal)
            ParticlePool.release(p);
            particles[i] = particles[particles.length - 1];
            particles.pop();
            // Don't increment i - need to check the swapped element
            continue;
        }

        p.x += p.vx * dt;
        p.y += p.vy * dt;

        if (p.type === 'snow') {
            p.vy += 300 * dt;
            p.alpha = 1 - (p.age / p.lifetime);
        } else if (p.type === 'spark') {
            p.vy += 500 * dt;
            // Simplified alpha calculation (avoid Math.pow)
            const ratio = p.age / p.lifetime;
            p.alpha = 1 - ratio * ratio;
            p.size *= 0.96;
        }
        i++;
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

    // Load any pending exclusions from previous chunk's landing zones
    const pendingKey = chunkIndex;
    if (gameState.terrain.pendingExclusions[pendingKey]) {
        for (const cellKey of gameState.terrain.pendingExclusions[pendingKey]) {
            usedCells.add(cellKey);
        }
        delete gameState.terrain.pendingExclusions[pendingKey];
    }

    // ===== PHASE 1: Generate jumps and rails FIRST =====
    // This allows us to calculate landing zones before placing obstacles

    // Temporary storage for jumps and rails generated in grid pass
    const tempJumps = [];
    const tempRails = [];

    // Helper to check if position is too close to existing jumps/rails
    // Uses squared distance comparison to avoid expensive sqrt calls
    function isTooCloseToJumpsOrRails(x, y, minDist = 150) {
        const minDistSq = minDist * minDist;
        for (const jump of tempJumps) {
            const dx = x - jump.x;
            const dy = y - jump.y;
            if (dx * dx + dy * dy < minDistSq) return true;
        }
        for (const rail of tempRails) {
            // Check distance to rail start and end
            const dxStart = x - rail.x;
            const dyStart = y - rail.y;
            const dxEnd = x - rail.endX;
            const dyEnd = y - rail.endY;
            if (dxStart * dxStart + dyStart * dyStart < minDistSq ||
                dxEnd * dxEnd + dyEnd * dyEnd < minDistSq) return true;
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
        // Physics-accurate landing distance: matches actual airborne trajectory
        // v0 = jumpLaunchPower * power * (speed/400), airTime = v0/gravity, dist = speed * airTime
        const avgSpeed = 400;
        const v0 = PHYSICS.jumpLaunchPower * jump.launchPower * (avgSpeed / 400);
        const airTime = v0 / PHYSICS.gravity;
        const landingDistance = avgSpeed * airTime * 1.15; // 15% safety buffer

        const jumpCol = Math.round((jump.x / TERRAIN.laneWidth) + gridCols / 2 - 0.5);

        // Wider lateral exclusion for bigger jumps (air control allows drift)
        const laneSpread = jump.launchPower >= 3.0 ? 3 : jump.launchPower >= 1.0 ? 2 : 1;

        // Mark from jump cell through entire flight path to landing + buffer
        const jumpRow = Math.floor((jump.y - chunk.y) / 80);
        const landingRows = Math.ceil(landingDistance / 80);

        for (let dx = -laneSpread; dx <= laneSpread; dx++) {
            for (let dy = -1; dy <= landingRows + 1; dy++) {
                const cellRow = jumpRow + dy;
                const cellCol = jumpCol + dx;
                if (cellCol >= 0 && cellCol < gridCols) {
                    if (cellRow >= 0 && cellRow < gridRows) {
                        usedCells.add(`${cellRow},${cellCol}`);
                    } else if (cellRow >= gridRows) {
                        // Landing zone extends into next chunk — store for propagation
                        const nextChunkIndex = chunkIndex + 1;
                        if (!gameState.terrain.pendingExclusions[nextChunkIndex]) {
                            gameState.terrain.pendingExclusions[nextChunkIndex] = [];
                        }
                        const overflowRow = cellRow - gridRows;
                        gameState.terrain.pendingExclusions[nextChunkIndex].push(`${overflowRow},${cellCol}`);
                    }
                }
            }
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

    // Mark rail zones as used (prevents obstacles from spawning along and below rails)
    for (let railIdx = 0; railIdx < tempRails.length; railIdx++) {
        const rail = tempRails[railIdx];
        const startRow = Math.floor((rail.y - chunk.y) / 80);
        const endRow = Math.floor((rail.endY - chunk.y) / 80);
        const startCol = Math.round((rail.x / TERRAIN.laneWidth) + gridCols / 2);
        const endCol = Math.round(rail.endColApprox);

        // Mark the entire rail path plus landing zone below (±2 lanes for maneuvering room)
        // Mark from rail start to 6 rows past rail end for safe dismount (extended clearance)
        for (let row = Math.max(0, startRow - 1); row <= Math.min(gridRows - 1, endRow + 6); row++) {
            // Interpolate column position along the rail
            const t = (row - startRow) / Math.max(1, endRow - startRow);
            const midCol = Math.round(startCol + (endCol - startCol) * Math.min(1, Math.max(0, t)));

            // Mark ±2 lanes around the rail path for maneuvering room
            for (let dx = -2; dx <= 2; dx++) {
                const cellCol = midCol + dx;
                if (cellCol >= 0 && cellCol < gridCols) {
                    usedCells.add(`${row},${cellCol}`);
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

            // Add size variation - trees range from 0.6x to 1.65x base size (reduced 25%)
            const sizeMultiplier = 0.6 + seededRandom(clusterSeed + 40 + i) * 1.05;
            const baseWidth = 28;
            const baseHeight = 56;
            chunk.obstacles.push({
                x: (treeCol - gridCols / 2) * TERRAIN.laneWidth,
                y: chunk.y + treeRow * 80 + seededRandom(clusterSeed + 30 + i) * 20,
                type: 'tree',
                width: Math.floor(baseWidth * sizeMultiplier),
                height: Math.floor(baseHeight * sizeMultiplier),
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

            // Add size variation for secondary cluster (reduced 25%)
            const sizeMultiplier = 0.6 + seededRandom(clusterSeed + 75 + i) * 1.05;
            const baseWidth = 28;
            const baseHeight = 56;
            chunk.obstacles.push({
                x: (treeCol - gridCols / 2) * TERRAIN.laneWidth,
                y: chunk.y + treeRow * 80 + seededRandom(clusterSeed + 70 + i) * 20,
                type: 'tree',
                width: Math.floor(baseWidth * sizeMultiplier),
                height: Math.floor(baseHeight * sizeMultiplier),
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

            // Add size variation for tertiary cluster (reduced 25%)
            const sizeMultiplier = 0.6 + seededRandom(clusterSeed + 105 + i) * 1.05;
            const baseWidth = 28;
            const baseHeight = 56;
            chunk.obstacles.push({
                x: (treeCol - gridCols / 2) * TERRAIN.laneWidth,
                y: chunk.y + treeRow * 80 + seededRandom(clusterSeed + 100 + i) * 20,
                type: 'tree',
                width: Math.floor(baseWidth * sizeMultiplier),
                height: Math.floor(baseHeight * sizeMultiplier),
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

                // Add size variation for scattered trees (reduced 25%)
                let treeWidth = 24, treeHeight = 40;
                if (obstacleType === 'tree') {
                    const treeSizeMultiplier = 0.6 + seededRandom(cellSeed + 0.8) * 1.05;
                    treeWidth = Math.floor(28 * treeSizeMultiplier);
                    treeHeight = Math.floor(56 * treeSizeMultiplier);
                }

                chunk.obstacles.push({
                    x: (col - gridCols / 2 + 0.5) * TERRAIN.laneWidth,
                    y: chunk.y + row * 80 + seededRandom(cellSeed + 0.3) * 30,
                    type: obstacleType,
                    width: obstacleType === 'tree' ? treeWidth : obstacleType === 'rock' ? rockWidth : 40,
                    height: obstacleType === 'tree' ? treeHeight : obstacleType === 'rock' ? rockHeight : 16
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

    return chunk;
}

function updateTerrain() {
    const camera = gameState.camera;
    const terrain = gameState.terrain;

    while (terrain.nextChunkY < camera.y + CANVAS_HEIGHT * 2.5) {
        const chunkIndex = Math.floor(terrain.nextChunkY / TERRAIN.chunkHeight);
        const newChunk = generateTerrainChunk(chunkIndex);
        terrain.chunks.push(newChunk);

        // Use push.apply instead of spread for better performance with arrays
        Array.prototype.push.apply(gameState.obstacles, newChunk.obstacles);
        Array.prototype.push.apply(gameState.jumps, newChunk.jumps);
        Array.prototype.push.apply(gameState.rails, newChunk.rails);
        Array.prototype.push.apply(gameState.lodges, newChunk.lodges);
        if (newChunk.collectibles) Array.prototype.push.apply(gameState.collectibles, newChunk.collectibles);

        terrain.nextChunkY += TERRAIN.chunkHeight;
    }

    const cullY = camera.y - CANVAS_HEIGHT;
    // PERFORMANCE: Use in-place culling instead of .filter() to avoid allocations
    cullArrayInPlace(terrain.chunks, c => c.y + TERRAIN.chunkHeight <= cullY);
    cullArrayInPlace(gameState.obstacles, o => o.y <= cullY);
    cullArrayInPlace(gameState.jumps, j => j.y <= cullY);
    cullArrayInPlace(gameState.rails, r => r.endY <= cullY);
    cullArrayInPlace(gameState.lodges, l => l.y + l.height <= cullY);
    cullArrayInPlace(gameState.collectibles, c => c.y <= cullY || c.collected);
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

    // Update grind immunity (prevents immediate re-entry to rails)
    if (player.grindImmunity > 0) {
        player.grindImmunity -= dt;
        // Clear last rail reference after immunity expires
        if (player.grindImmunity <= 0) {
            player.lastRail = null;
        }
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

    // Safety: prevent player from flying too far ahead of camera (fixes massive jump crash)
    const maxYAhead = gameState.camera.y + CANVAS_HEIGHT * 3;
    if (player.y > maxYAhead) {
        // Force landing to prevent flying off map
        player.altitude = 0;
        player.verticalVelocity = 0;
        landFromJump(player);
        return;
    }

    // Safety: cap maximum altitude to prevent extreme air time
    const maxAltitude = 800;
    if (player.altitude > maxAltitude) {
        player.verticalVelocity = Math.min(player.verticalVelocity, 0);
    }

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
    // Guard: verify we're actually grinding
    if (!player.grinding) return;

    const rail = player.currentRail;

    // Safety check - if rail is invalid, end grind immediately
    if (!rail || !rail.length || rail.length <= 0) {
        player.grinding = false;
        player.currentRail = null;
        player.grindImmunity = 0.5;
        return;
    }

    // Increment frame counter for timeout safety
    player.grindFrames = (player.grindFrames || 0) + 1;

    // Force minimum speed during grind - increased for faster exit
    const minGrindSpeed = 300;
    const grindSpeed = Math.max(player.speed * 0.85, minGrindSpeed);

    // Ensure progress always advances - minimum 3% per frame
    const progressIncrement = Math.max((grindSpeed * dt) / rail.length, 0.03);
    player.grindProgress += progressIncrement;

    player.x = lerp(rail.x, rail.endX, player.grindProgress);
    player.y = lerp(rail.y, rail.endY, player.grindProgress);

    // Update distance
    gameState.chase.distanceTraveled += grindSpeed * dt / 100;
    gameState.distance = Math.floor(gameState.chase.distanceTraveled);

    // Sparks - very low frequency for performance
    if (Math.random() < 0.1) {
        spawnGrindSparks(player.x, player.y);
    }

    // Exit conditions - multiple safeguards:
    // 1. Progress complete (>=100%)
    // 2. Time-based timeout (1 second max)
    // 3. Frame-based timeout (60 frames max ~1 second)
    const grindDuration = gameState.animationTime - (player.grindStartTime || 0);
    if (player.grindProgress >= 1.0 || grindDuration > 1.0 || player.grindFrames > 60) {
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
            color: COLORS.gold,
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
            celebrationColor = COLORS.gold;
        } else if (gameState.comboChainLength >= 3) {
            celebrationText = 'SICK ' + trickName + bigAirText;
            celebrationColor = COLORS.limeGreen;
        }

        gameState.celebrations.push({
            text: celebrationText,
            subtext: `+${points}`,
            color: celebrationColor,
            timer: 1.5,
            scale: Math.min(1.3, 1.0 + (gameState.trickMultiplier - 1) * 0.1 + (gameState.comboChainLength - 1) * 0.03) // Cap scale at 1.3x
        });

        const prevMultiplier = gameState.trickMultiplier;
        gameState.trickMultiplier = Math.min(gameState.trickMultiplier + 0.5, 5);
        gameState.trickComboTimer = 2.5; // Longer window for combos
        gameState.maxCombo = Math.max(gameState.maxCombo, gameState.trickMultiplier);

        // Show multiplier growth when it crosses a threshold
        if (gameState.trickMultiplier >= 1.5 && gameState.trickMultiplier > prevMultiplier) {
            gameState.celebrations.push({
                text: `\u00d7${gameState.trickMultiplier.toFixed(1)} COMBO`,
                color: COLORS.gold,
                timer: 0.8,
                scale: 0.85
            });
        }
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

// Grind trick types with display names
const GRIND_TRICKS = [
    { id: '50-50', name: '50-50', weight: 25 },
    { id: 'boardslide', name: 'BOARDSLIDE', weight: 25 },
    { id: 'noseslide', name: 'NOSESLIDE', weight: 25 },
    { id: 'tailslide', name: 'TAILSLIDE', weight: 25 }
];

function selectGrindTrick() {
    // Weighted random selection
    const totalWeight = GRIND_TRICKS.reduce((sum, t) => sum + t.weight, 0);
    let rand = Math.random() * totalWeight;
    for (const trick of GRIND_TRICKS) {
        rand -= trick.weight;
        if (rand <= 0) return trick;
    }
    return GRIND_TRICKS[0]; // Default to 50-50
}

function startGrinding(player, rail) {
    // Safety check
    if (!rail || !rail.length || rail.length <= 0) return;

    player.grinding = true;
    player.currentRail = rail;
    player.grindProgress = 0;
    player.grindStartTime = gameState.animationTime;
    player.x = rail.x;
    player.y = rail.y;

    // Select random grind trick
    player.grindTrick = selectGrindTrick();

    // Show grind trick celebration
    gameState.celebrations.push({
        text: player.grindTrick.name,
        subtext: '',
        color: COLORS.cyan,
        timer: 0.8,
        scale: 0.9
    });
}

function startGrindingAtProgress(player, rail, entryProgress) {
    // Safety check
    if (!rail || !rail.length || rail.length <= 0) return;

    player.grinding = true;
    player.currentRail = rail;
    player.grindStartTime = gameState.animationTime;
    player.grindFrames = 0;
    player.grindProgress = Math.max(0, Math.min(0.9, entryProgress));
    player.x = lerp(rail.x, rail.endX, player.grindProgress);
    player.y = lerp(rail.y, rail.endY, player.grindProgress);

    // Select random grind trick
    player.grindTrick = selectGrindTrick();

    // Show grind trick celebration
    gameState.celebrations.push({
        text: player.grindTrick.name,
        subtext: '',
        color: COLORS.cyan,
        timer: 0.8,
        scale: 0.9
    });
}

function endGrind(player) {
    // Guard: only end if actually grinding (prevent double calls)
    if (!player.grinding) return;

    const rail = player.currentRail;

    // Always reset grind state first to prevent getting stuck
    player.grinding = false;
    player.grindFrames = 0;
    player.lastRail = rail; // Track last rail to prevent immediate re-entry
    player.grindImmunity = 0.5; // 0.5 second immunity after grinding (increased)
    player.currentRail = null;
    player.currentGrindable = null;

    // Safety check - if rail is invalid, just return after resetting state
    if (!rail || !rail.length) {
        return;
    }

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
    switch (grindableType) {
        case 'funbox': typeBonus = 1.2; break;
        case 'log': typeBonus = 1.3; break;
        case 'bench': typeBonus = 1.15; break;
        case 'kinked': typeBonus = 1.4; break;
    }

    // Calculate points
    const chainBonus = gameState.trickComboTimer > 1.5 ? 1.5 : 1.0;
    const basePoints = Math.floor(trick.points * typeBonus);
    const points = Math.floor(basePoints * gameState.trickMultiplier * chainBonus);
    gameState.score += points;

    // Celebrate rail chains
    if (chainBonus > 1.0) {
        gameState.celebrations.push({
            text: 'RAIL CHAIN! \u00d71.5',
            color: COLORS.magenta,
            timer: 1.0,
            scale: 1.0
        });
    }

    // Track combo
    if (!gameState.comboChainLength) gameState.comboChainLength = 0;
    gameState.comboChainLength++;

    // Simple, small celebration - with duplicate prevention and cap
    const celebrationText = trick.name;
    const isDuplicate = gameState.celebrations.some(c => c.text === celebrationText);
    if (!isDuplicate && gameState.celebrations.length < 5) {
        gameState.celebrations.push({
            text: celebrationText,
            subtext: `+${points}`,
            color: COLORS.cyan,
            timer: 0.6, // Short duration
            scale: 1.0  // No scaling - fixed small size
        });
    }

    // Update multiplier
    const prevGrindMultiplier = gameState.trickMultiplier;
    const multiplierGain = 0.3 + (typeBonus - 1) * 0.5;
    gameState.trickMultiplier = Math.min(gameState.trickMultiplier + multiplierGain, 5);
    gameState.trickComboTimer = 2.5;

    // Show multiplier growth when it crosses a threshold
    if (gameState.trickMultiplier >= 1.5 && gameState.trickMultiplier > prevGrindMultiplier) {
        gameState.celebrations.push({
            text: `\u00d7${gameState.trickMultiplier.toFixed(1)} COMBO`,
            color: COLORS.gold,
            timer: 0.8,
            scale: 0.85
        });
    }
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
    gameState.chase.totalCrashes++;  // Track total crashes this session

    // Remove old crashes outside the window
    gameState.chase.recentCrashes = gameState.chase.recentCrashes.filter(
        t => now - t < CHASE.crashWindow
    );

    // If too many crashes in window, spawn beast immediately
    if (gameState.chase.recentCrashes.length >= CHASE.crashThreshold && !gameState.chase.beastActive) {
        spawnBeast('TOO MANY WIPEOUTS!');
    }

    // If total crashes hit guaranteed catch threshold, warn player
    if (gameState.chase.totalCrashes === CHASE.guaranteedCatchCrashes) {
        gameState.celebrations.push({
            text: 'THE BEAST HUNGERS!',
            subtext: 'One more crash...',
            color: COLORS.magenta,
            timer: 2.0,
            scale: 1.2
        });
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

    // Check rails - allow entry anywhere along the rail, not just at the top
    // Respect grind immunity timer to prevent re-triggering
    if (!player.grinding && (!player.grindImmunity || player.grindImmunity <= 0)) {
        for (const rail of gameState.rails) {
            // Skip the last rail we were on to prevent immediate re-entry
            if (rail === player.lastRail) continue;

            // Check if player is within the rail's Y span (top to bottom)
            if (player.y < rail.y - 20 || player.y > rail.endY + 20) continue;

            // Calculate rail's X position at player's Y using linear interpolation
            const t = (player.y - rail.y) / (rail.endY - rail.y);
            const tClamped = Math.max(0, Math.min(1, t));
            const railXAtPlayerY = lerp(rail.x, rail.endX, tClamped);

            // Check X proximity to rail at this point
            if (Math.abs(railXAtPlayerY - player.x) > 25) continue;

            // Start grinding at the current position along the rail
            startGrindingAtProgress(player, rail, tClamped);
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
            color: COLORS.gold,
            alpha: 1,
            type: 'spark',
            life: 0.5
        });
    }

    if (isBig) {
        gameState.celebrations.push({
            text: 'BIG SNOWFLAKE!',
            subtext: `+${points}`,
            color: COLORS.gold,
            timer: 1.0,
            scale: 1.0
        });
    }
}

function checkNearMisses(player) {
    // Check for near-misses with obstacles
    // Use squared distances to avoid expensive sqrt (threshold^2 = 35^2 = 1225, min^2 = 20^2 = 400)
    const nearMissThresholdSq = 1225;
    const minDistSq = 400;

    for (const obs of gameState.obstacles) {
        const dx = obs.x - player.x;
        const dy = obs.y - player.y;
        const distSq = dx * dx + dy * dy;

        // Near miss: close but not crashed (compare squared distances)
        if (distSq < nearMissThresholdSq && distSq > minDistSq) {
            if (!obs.nearMissTriggered) {
                obs.nearMissTriggered = true;

                gameState.nearMissStreak++;
                const points = 25 * gameState.nearMissStreak;
                gameState.score += points;

                // Build flow meter
                gameState.flowMeter = Math.min(100, gameState.flowMeter + 8);

                // Celebrate every close call with escalating excitement
                const streak = gameState.nearMissStreak;
                const ccColor = streak >= 3 ? COLORS.limeGreen : streak >= 2 ? COLORS.gold : COLORS.warning;
                const ccScale = streak >= 3 ? 0.9 + Math.min(streak * 0.05, 0.4) : streak >= 2 ? 0.85 : 0.75;
                const ccText = streak >= 2 ? `CLOSE CALL x${streak}!` : 'CLOSE CALL!';
                gameState.celebrations.push({
                    text: ccText,
                    subtext: `+${points}`,
                    color: ccColor,
                    timer: 0.8,
                    scale: ccScale
                });
                triggerScreenShake(2 + Math.min(streak, 4), 0.85);
            }
        } else if (distSq > 3025) {  // (35 + 20)^2 = 55^2 = 3025
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
    addCelebration('BACK TO THE SLOPE!', COLORS.gold);
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

    // Check if guaranteed catch conditions are met
    const guaranteedCatch = chase.totalCrashes >= CHASE.guaranteedCatchCrashes ||
                           chase.missCount >= CHASE.maxMisses;

    switch (chase.beastState) {
        case 'chasing':
            // Track player X - faster tracking with rage (even faster if guaranteed catch)
            const trackSpeed = (2.5 + chase.beastRage * 2 + (guaranteedCatch ? 3 : 0)) * dt;
            chase.beastX += (player.x - chase.beastX) * trackSpeed;

            // Stay ahead of fog
            chase.beastY = Math.max(chase.beastY, chase.fogY + 60);

            // Chase player - faster with rage
            const beastSpeed = player.speed * CHASE.beastSpeed * rageMod;
            chase.beastY += beastSpeed * dt;

            // Proximity warning — escalating feedback as beast gets closer
            const proximityDist = player.y - chase.beastY;
            if (proximityDist < 200 && proximityDist > 0) {
                const proximityIntensity = 1 - (proximityDist / 200); // 0 at 200px, 1 at 0px
                const shakeAmount = proximityIntensity * 4;
                if (shakeAmount > gameState.screenShake.intensity) {
                    triggerScreenShake(shakeAmount, 0.92);
                }
                // Boost danger vignette based on beast proximity
                gameState.dangerLevel = Math.max(gameState.dangerLevel, proximityIntensity);
            }

            // Lunge check - more frequent with rage
            chase.beastLungeTimer -= dt * rageMod;
            const distToPlayer = player.y - chase.beastY;

            if (chase.beastLungeTimer <= 0 && distToPlayer < 280 && distToPlayer > 40) {
                chase.beastState = 'lunging';

                // If guaranteed catch, lunge directly at player with minimal prediction error
                if (guaranteedCatch) {
                    // Nearly perfect prediction - beast teleports closer
                    chase.beastY = player.y - 50; // Start closer
                    chase.lungeTargetX = player.x;
                    chase.lungeTargetY = player.y + player.speed * 0.15;
                } else {
                    // Normal prediction with some variance
                    const predictTime = 0.3;
                    chase.lungeTargetX = player.x + player.lateralSpeed * predictTime * chase.beastRage;
                    chase.lungeTargetY = player.y + player.speed * predictTime * 0.5;
                }
                chase.lungeProgress = 0;
                triggerScreenShake(guaranteedCatch ? 15 : 10, 0.8);
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

            // Determine catch radius - much larger if guaranteed catch
            const catchRadius = guaranteedCatch ? CHASE.enhancedCatchRadius :
                               (CHASE.baseCatchRadius + chase.beastRage * 10);
            const catchRadiusSq = catchRadius * catchRadius;
            const cdx = player.x - chase.beastX;
            const cdy = player.y - chase.beastY;
            const catchDistSq = cdx * cdx + cdy * cdy;

            // Catch check - if guaranteed catch, ignore some immunity
            const canCatch = guaranteedCatch ?
                           (player.invincible <= 0 && player.stunned <= 0) : // Can catch even if crashed
                           (player.invincible <= 0 && !player.crashed && player.stunned <= 0);

            if (catchDistSq < catchRadiusSq && canCatch) {
                chase.missCount = 0; // Reset on successful catch
                triggerGameOver('beast');
                return;
            }

            if (chase.lungeProgress >= 1) {
                // Lunge finished without catching - count as miss
                chase.missCount++;
                chase.beastState = 'retreating';
                chase.retreatTimer = CHASE.beastRetreatDuration;

                // Warn player if next lunge is guaranteed
                if (chase.missCount >= CHASE.maxMisses - 1) {
                    gameState.celebrations.push({
                        text: 'NO ESCAPE!',
                        subtext: '',
                        color: COLORS.magenta,
                        timer: 1.5,
                        scale: 1.1
                    });
                }
            }
            break;

        case 'retreating':
            chase.retreatTimer -= dt;
            chase.beastY -= 60 * dt; // Retreats less

            if (chase.retreatTimer <= 0) {
                chase.beastState = 'chasing';
                // Less variance, more consistent pressure with rage
                // Even faster lunge interval if close to guaranteed catch
                const variance = CHASE.beastLungeVariance * (1 - chase.beastRage * 0.5);
                const intervalMod = guaranteedCatch ? 0.5 : 1; // Half interval if guaranteed
                chase.beastLungeTimer = (CHASE.beastLungeInterval + Math.random() * variance) * intervalMod;
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
                    color: COLORS.gold,
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
            gameState.celebrations.push({
                text: 'SPEED RUSH!',
                subtext: `+${speedBonus}`,
                color: COLORS.cyan,
                timer: 0.6,
                scale: 0.8
            });
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

    // If player is very far ahead (massive jump), increase camera catch-up speed
    const distanceAhead = player.y - (camera.y + CANVAS_HEIGHT * 0.35);
    if (distanceAhead > CANVAS_HEIGHT) {
        camera.y = lerp(camera.y, camera.targetY, 15 * dt); // Faster catch-up
    } else {
        camera.y = lerp(camera.y, camera.targetY, 8 * dt);
    }
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

// Returns the pixel height reserved for the HUD panel at current scale
function getHUDHeight() {
    if (!hudPanel.loaded) return 0;
    return Math.round(hudPanel.panelHeight * getUIScale());
}

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

    // Slalom mode rendering
    if (gameState.mode === 'slalom' && (gameState.screen === 'playing' || gameState.screen === 'slalomResults')) {
        drawSlalom();
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

    // Death animation screen - render world plus chomp animation
    if (gameState.screen === 'dying') {
        drawBackground();
        drawTerrain();
        drawRails();
        drawJumps();
        drawLodges();
        drawCollectibles();
        drawObstacles();
        drawAvalanche();
        drawDeathAnimation();  // Draw chomp animation instead of player
        drawParticles();
        drawDangerVignette();
        return;
    }

    // HUD renders as thin overlay at bottom — no gameplay clipping needed

    // Draw background gradient
    drawBackground();

    // Draw terrain
    drawTerrain();

    // Draw rails
    drawRails();

    // Draw jumps
    drawJumps();

    // Draw lodges (behind obstacles, in front of jumps)
    drawLodges();

    // Draw collectibles
    drawCollectibles();

    // Draw obstacles
    drawObstacles();

    // Draw fog wall
    drawAvalanche();

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

    // Draw danger vignette
    if (gameState.dangerLevel > 0.2) {
        drawDangerVignette();
    }

    // Draw speed lines
    if (gameState.player.speed > 400) {
        drawSpeedLines();
    }

    // Draw HUD overlay at bottom of screen
    drawHUD();
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

    // PERFORMANCE: Removed decorative background line loops (was ~40 stroke calls per frame)
    // The gradient background provides sufficient visual appeal

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

        // Shadow - light source from upper-left, so shadow falls to bottom-right
        // Shadow is cast on the ground at the base of the object
        if (obs.type === 'tree') {
            // Tree shadow - elongated to the right, at ground level (screen.y is base of trunk)
            ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
            ctx.beginPath();
            ctx.ellipse(screen.x + 12, screen.y + 8, obs.width * 0.4, 6, 0.3, 0, Math.PI * 2);
            ctx.fill();
        } else if (obs.type === 'rock' || obs.type === 'mogul') {
            // Rock/mogul shadow - at base, offset to bottom-right
            ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
            ctx.beginPath();
            ctx.ellipse(screen.x + 8, screen.y + 4, obs.width * 0.5, 6, 0.2, 0, 0, Math.PI * 2);
            ctx.fill();
        }

        if (obs.type === 'tree') {
            // Tree trunk - simplified solid color for performance
            ctx.fillStyle = '#4a3728';
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
            // Irregular curved rock shape with flat colors (no per-frame gradient)
            // Base rock color
            ctx.fillStyle = '#5a5a6e';
            ctx.beginPath();
            // Irregular rock shape
            ctx.moveTo(screen.x - obs.width/2, screen.y);
            ctx.quadraticCurveTo(screen.x - obs.width/2 - 5, screen.y - obs.height/2, screen.x - obs.width/4, screen.y - obs.height);
            ctx.quadraticCurveTo(screen.x, screen.y - obs.height - 5, screen.x + obs.width/4, screen.y - obs.height);
            ctx.quadraticCurveTo(screen.x + obs.width/2 + 5, screen.y - obs.height/2, screen.x + obs.width/2, screen.y);
            ctx.closePath();
            ctx.fill();

            // Rock highlight (lighter top-left area for 3D effect)
            ctx.fillStyle = '#8a8a9e';
            ctx.beginPath();
            ctx.moveTo(screen.x - obs.width/4, screen.y - obs.height);
            ctx.quadraticCurveTo(screen.x - obs.width/3, screen.y - obs.height * 0.6, screen.x - obs.width/2, screen.y);
            ctx.quadraticCurveTo(screen.x - obs.width/2 - 5, screen.y - obs.height/2, screen.x - obs.width/4, screen.y - obs.height);
            ctx.fill();

            // Rock specular highlight
            ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
            ctx.beginPath();
            ctx.ellipse(screen.x - 6, screen.y - obs.height/2 - 4, obs.width/5, obs.height/5, -0.3, 0, Math.PI * 2);
            ctx.fill();

            // Snow patches on rock
            ctx.fillStyle = COLORS.snow;
            ctx.beginPath();
            ctx.ellipse(screen.x - 2, screen.y - obs.height + 3, 8, 4, 0, 0, Math.PI * 2);
            ctx.fill();

        } else if (obs.type === 'mogul') {
            // Ice mogul with flat colors (no per-frame gradient)
            // Base mogul color
            ctx.fillStyle = '#a0d0e6';
            ctx.beginPath();
            ctx.ellipse(screen.x, screen.y - obs.height/3, obs.width/2, obs.height/2, 0, 0, Math.PI * 2);
            ctx.fill();

            // Ice highlight (lighter center for 3D effect)
            ctx.fillStyle = '#d0f0ff';
            ctx.beginPath();
            ctx.ellipse(screen.x - 4, screen.y - obs.height/2, obs.width/4, obs.height/3, 0, 0, Math.PI * 2);
            ctx.fill();

            // Ice shimmer effect - use cached sin value
            const shimmer = animCache.sin3 * 0.15 + 0.55;
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
        const w = jump.width;
        const h = jump.height;

        // ===== X GAMES SUPERPIPE / BIG AIR STYLE KICKER =====

        // Ground shadow
        ctx.fillStyle = 'rgba(60, 80, 100, 0.3)';
        ctx.beginPath();
        ctx.ellipse(screen.x + 5, screen.y + 6, w * 0.45, 8, 0, 0, Math.PI * 2);
        ctx.fill();

        // ===== SIDE MARKER FLAGS (X Games style) =====
        // Left flag pole
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(screen.x - w/2 - 8, screen.y);
        ctx.lineTo(screen.x - w/2 - 8, screen.y - h - 20);
        ctx.stroke();

        // Left flag (orange)
        ctx.fillStyle = '#ff6600';
        ctx.beginPath();
        ctx.moveTo(screen.x - w/2 - 8, screen.y - h - 20);
        ctx.lineTo(screen.x - w/2 + 5, screen.y - h - 15);
        ctx.lineTo(screen.x - w/2 - 8, screen.y - h - 10);
        ctx.closePath();
        ctx.fill();

        // Right flag pole
        ctx.strokeStyle = '#333';
        ctx.beginPath();
        ctx.moveTo(screen.x + w/2 + 8, screen.y);
        ctx.lineTo(screen.x + w/2 + 8, screen.y - h - 20);
        ctx.stroke();

        // Right flag (orange)
        ctx.fillStyle = '#ff6600';
        ctx.beginPath();
        ctx.moveTo(screen.x + w/2 + 8, screen.y - h - 20);
        ctx.lineTo(screen.x + w/2 - 5, screen.y - h - 15);
        ctx.lineTo(screen.x + w/2 + 8, screen.y - h - 10);
        ctx.closePath();
        ctx.fill();

        // ===== MAIN KICKER SHAPE =====
        // Packed snow with strong contrast
        ctx.fillStyle = '#e0e8f0';  // Base snow color
        ctx.beginPath();
        // X Games style: steep approach → vertical transition → sharp lip
        ctx.moveTo(screen.x - w/2, screen.y);
        // Steeper approach ramp
        ctx.lineTo(screen.x - w/3, screen.y - h * 0.2);
        // Aggressive transition curve (kicks up sharply)
        ctx.quadraticCurveTo(
            screen.x - w/8, screen.y - h * 0.5,
            screen.x - w/15, screen.y - h * 0.85
        );
        // Sharp vertical takeoff lip
        ctx.quadraticCurveTo(
            screen.x, screen.y - h * 1.1,
            screen.x + w/12, screen.y - h * 0.9
        );
        // Back side drop (knuckle)
        ctx.quadraticCurveTo(
            screen.x + w/4, screen.y - h * 0.3,
            screen.x + w/2, screen.y
        );
        ctx.closePath();
        ctx.fill();

        // Snow face highlight (lit side)
        ctx.fillStyle = '#f5faff';
        ctx.beginPath();
        ctx.moveTo(screen.x - w/3, screen.y - h * 0.2);
        ctx.quadraticCurveTo(
            screen.x - w/8, screen.y - h * 0.5,
            screen.x - w/15, screen.y - h * 0.85
        );
        ctx.quadraticCurveTo(
            screen.x, screen.y - h * 1.1,
            screen.x + w/12, screen.y - h * 0.9
        );
        ctx.lineTo(screen.x - w/10, screen.y - h * 0.7);
        ctx.closePath();
        ctx.fill();

        // Grooming lines
        ctx.strokeStyle = 'rgba(140, 170, 200, 0.3)';
        ctx.lineWidth = 1;
        for (let i = 1; i <= 5; i++) {
            const lineY = screen.y - h * (i * 0.15);
            ctx.beginPath();
            ctx.moveTo(screen.x - w * (0.4 - i * 0.04), lineY);
            ctx.lineTo(screen.x + w * (0.1 + i * 0.03), lineY - 2);
            ctx.stroke();
        }

        // Sharp lip edge (bright white highlight)
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(screen.x - w/12, screen.y - h * 0.9);
        ctx.quadraticCurveTo(
            screen.x, screen.y - h * 1.1,
            screen.x + w/12, screen.y - h * 0.9
        );
        ctx.stroke();
        ctx.lineCap = 'butt';

        // Knuckle shadow (back side darker)
        ctx.fillStyle = 'rgba(100, 130, 160, 0.25)';
        ctx.beginPath();
        ctx.moveTo(screen.x + w/12, screen.y - h * 0.9);
        ctx.quadraticCurveTo(
            screen.x + w/4, screen.y - h * 0.3,
            screen.x + w/2, screen.y
        );
        ctx.lineTo(screen.x + w/5, screen.y);
        ctx.closePath();
        ctx.fill();

        // ===== JUMP SIZE INDICATORS =====
        if (jump.massive) {
            // BIG AIR label for massive jumps
            ctx.fillStyle = `rgba(255, 80, 40, ${0.8 + animCache.sin2 * 0.2})`;
            ctx.font = 'bold 12px "Press Start 2P", monospace';
            ctx.textAlign = 'center';
            ctx.fillText('BIG AIR', screen.x, screen.y - h - 30);
        } else if (h > 35) {
            // Medium/large jump indicator
            ctx.fillStyle = 'rgba(255, 150, 50, 0.7)';
            ctx.font = '8px "Press Start 2P", monospace';
            ctx.textAlign = 'center';
            ctx.fillText('▲', screen.x, screen.y - h - 15);
        }
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

    // Shadow projection offset (simulating sun angle from upper-left)
    const shadowOffsetX = 4;
    const shadowOffsetY = 6;

    // Draw main rail shadow first - simplified solid color for performance
    ctx.strokeStyle = 'rgba(60, 80, 100, 0.2)';
    ctx.lineWidth = 10;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(startScreen.x + shadowOffsetX, startScreen.y + railHeight + shadowOffsetY);
    ctx.lineTo(endScreen.x + shadowOffsetX, endScreen.y + railHeight + shadowOffsetY);
    ctx.stroke();

    // Support post shadows - angled ellipses matching projection
    ctx.fillStyle = 'rgba(60, 80, 100, 0.2)';
    for (let i = 0; i < numSupports; i++) {
        const t = i / (numSupports - 1);
        const x = lerp(startScreen.x, endScreen.x, t);
        const y = lerp(startScreen.y, endScreen.y, t);
        ctx.beginPath();
        ctx.ellipse(x + shadowOffsetX, y + railHeight + shadowOffsetY, 7, 3, angle * 0.3, 0, Math.PI * 2);
        ctx.fill();
    }

    // Draw support posts - simplified solid color for performance
    ctx.fillStyle = '#888';
    for (let i = 0; i < numSupports; i++) {
        const t = i / (numSupports - 1);
        const x = lerp(startScreen.x, endScreen.x, t);
        const y = lerp(startScreen.y, endScreen.y, t);

        // Support post
        ctx.fillRect(x - 3, y, 6, railHeight);

        // Support base plate
        ctx.fillStyle = '#555';
        ctx.fillRect(x - 5, y + railHeight - 2, 10, 4);

        // Snow mound at base for visual grounding
        ctx.fillStyle = 'rgba(230, 240, 250, 0.7)';
        ctx.beginPath();
        ctx.ellipse(x, y + railHeight + 1, 8, 3, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#888';  // Reset for next post
    }

    // Main rail - metallic with shine
    ctx.save();

    // Rail body - simplified solid metallic color for performance
    ctx.strokeStyle = '#bbb';
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

    // Subtle metallic reflection (reduced from heavy neon glow)
    ctx.shadowColor = 'rgba(200, 220, 240, 0.4)';
    ctx.shadowBlur = 4;
    ctx.strokeStyle = 'rgba(180, 210, 230, 0.2)';
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(startScreen.x, startScreen.y);
    ctx.lineTo(endScreen.x, endScreen.y);
    ctx.stroke();

    ctx.restore();

    // End caps (rounded metal)
    ctx.fillStyle = '#bbb';
    ctx.shadowColor = 'rgba(200, 220, 240, 0.3)';
    ctx.shadowBlur = 3;
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
    const angle = Math.atan2(dy, dx);

    ctx.save();
    ctx.translate(midX, midY);
    // Funboxes are fixed structures — limit rotation to ±10° for realism
    const clampedAngleFB = Math.max(-0.17, Math.min(0.17, angle));
    ctx.rotate(clampedAngleFB);

    // Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.beginPath();
    ctx.ellipse(3, boxHeight + 5, length / 2 + 5, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    // Box body (wood texture) - simplified solid color for performance
    ctx.fillStyle = '#8B5A2B';
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

    // Metal coping on top edge - simplified solid color for performance
    ctx.fillStyle = '#ccc';
    ctx.fillRect(-length / 2, -5, length, 4);

    // Coping shine
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.fillRect(-length / 2, -5, length, 1);

    // Neon accent
    ctx.shadowColor = COLORS.magenta;
    ctx.shadowBlur = 1;
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

    // Main log body - simplified solid color for performance
    ctx.fillStyle = '#6B5344';
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

    // Calculate rotation angle to match rail direction
    const angle = Math.atan2(dy, dx);

    ctx.save();
    ctx.translate(midX, midY);
    // Benches are fixed structures — limit rotation to ±10° for realism
    const clampedAngleB = Math.max(-0.17, Math.min(0.17, angle));
    ctx.rotate(clampedAngleB);

    // Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.beginPath();
    ctx.ellipse(3, 18, length / 2 + 8, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    // Bench legs (metal) - simplified solid color for performance
    ctx.fillStyle = '#666';
    // Left leg frame
    ctx.fillRect(-length / 2 + 5, -2, 4, 18);
    ctx.fillRect(-length / 2 + 5, 12, 15, 4);
    // Right leg frame
    ctx.fillRect(length / 2 - 9, -2, 4, 18);
    ctx.fillRect(length / 2 - 20, 12, 15, 4);

    // Seat slats (wood) - simplified solid color for performance
    ctx.fillStyle = '#A0522D';
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

    // Draw support posts at kink points - use solid color for performance
    const supports = [startScreen, {x: mid1X, y: mid1Y}, {x: mid2X, y: mid2Y}, endScreen];
    for (const pos of supports) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.beginPath();
        ctx.ellipse(pos.x + 2, pos.y + 18, 5, 3, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#777';
        ctx.fillRect(pos.x - 2, pos.y + 2, 4, 14);
    }

    // Draw rail segments
    ctx.save();

    // Rail - simplified solid color for performance
    ctx.strokeStyle = '#ccc';
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
    ctx.shadowColor = COLORS.gold;
    ctx.shadowBlur = 2;
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

        // ===== SHADOW (gradient trapezoid projecting downslope) =====
        const shadowLength = h * 0.7;
        const shadowGrad = ctx.createLinearGradient(screen.x, screen.y + h, screen.x, screen.y + h + shadowLength);
        shadowGrad.addColorStop(0, 'rgba(40, 60, 80, 0.35)');
        shadowGrad.addColorStop(1, 'rgba(40, 60, 80, 0)');
        ctx.fillStyle = shadowGrad;
        ctx.beginPath();
        ctx.moveTo(screen.x - w / 2 + 5, screen.y + h);
        ctx.lineTo(screen.x + w / 2 - 5, screen.y + h);
        ctx.lineTo(screen.x + w / 2 + 15, screen.y + h + shadowLength);
        ctx.lineTo(screen.x - w / 2 - 5, screen.y + h + shadowLength);
        ctx.closePath();
        ctx.fill();

        // ===== ENTRANCE RAMP (TOP - main entry point) =====
        const rampW = LODGE.rampWidth;
        const rampL = LODGE.rampLength;
        const rampTopY = screen.y - rampL;  // Ramp extends UP from lodge

        // Ramp shadow
        ctx.fillStyle = 'rgba(60, 80, 100, 0.3)';
        ctx.beginPath();
        ctx.moveTo(screen.x - rampW / 2 - 5, rampTopY + 10);
        ctx.lineTo(screen.x + rampW / 2 + 5, rampTopY + 10);
        ctx.lineTo(screen.x + rampW / 2 + 15, screen.y + 10);
        ctx.lineTo(screen.x - rampW / 2 - 15, screen.y + 10);
        ctx.closePath();
        ctx.fill();

        // Ramp surface (groomed snow)
        ctx.fillStyle = '#e8f0f8';
        ctx.beginPath();
        ctx.moveTo(screen.x - rampW / 2, rampTopY);
        ctx.lineTo(screen.x + rampW / 2, rampTopY);
        ctx.lineTo(screen.x + rampW / 2 + 10, screen.y);
        ctx.lineTo(screen.x - rampW / 2 - 10, screen.y);
        ctx.closePath();
        ctx.fill();

        // Ramp grooming lines
        ctx.strokeStyle = 'rgba(180, 200, 220, 0.4)';
        ctx.lineWidth = 1;
        for (let i = 1; i < 5; i++) {
            const t = i / 5;
            const y = rampTopY + t * rampL;
            const xOffset = t * 10;
            ctx.beginPath();
            ctx.moveTo(screen.x - rampW / 2 - xOffset, y);
            ctx.lineTo(screen.x + rampW / 2 + xOffset, y);
            ctx.stroke();
        }

        // Ramp side rails (orange safety markers)
        ctx.fillStyle = '#ff6600';
        for (let i = 0; i < 4; i++) {
            const t = i / 3;
            const y = rampTopY + t * rampL;
            const xOffset = t * 10;
            // Left marker
            ctx.beginPath();
            ctx.arc(screen.x - rampW / 2 - xOffset - 5, y, 4, 0, Math.PI * 2);
            ctx.fill();
            // Right marker
            ctx.beginPath();
            ctx.arc(screen.x + rampW / 2 + xOffset + 5, y, 4, 0, Math.PI * 2);
            ctx.fill();
        }

        // "ENTER" text on ramp
        ctx.fillStyle = 'rgba(0, 200, 150, 0.8)';
        ctx.font = '10px "Press Start 2P", monospace';
        ctx.textAlign = 'center';
        ctx.fillText('▼ ENTER ▼', screen.x, rampTopY + rampL * 0.4);

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

        // Smoke particles (subtle) - use cached sin2
        ctx.fillStyle = 'rgba(200, 200, 210, 0.3)';
        for (let i = 0; i < 3; i++) {
            const smokeY = chimneyY - 15 - i * 12 - animCache.sin2 * 5;
            const smokeX = chimneyX + animCache.sin2 * 8 * (i + 1) * 0.3;
            const smokeSize = 6 + i * 3;
            ctx.beginPath();
            ctx.arc(smokeX, smokeY, smokeSize, 0, Math.PI * 2);
            ctx.fill();
        }

        // ===== WINDOWS =====
        // Window glow (warm light from inside) - slow pulse, just use constant
        const windowGlow = 0.65;

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

        // ===== ENTRANCE INDICATOR (pulsing - at TOP of ramp) =====
        if (animCache.sin4 > 0) {
            ctx.fillStyle = 'rgba(0, 255, 200, 0.4)';
            ctx.beginPath();
            ctx.arc(screen.x, rampTopY + 20, 30, 0, Math.PI * 2);
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

        // Floating animation (use cached sin4 with offset)
        const float = animCache.sin4 * 5 + Math.sin(col.x * 0.1) * 3;
        const rotation = time * 2;

        ctx.save();
        ctx.translate(screen.x, screen.y + float);
        ctx.rotate(rotation);

        // Glow
        ctx.shadowColor = isBig ? COLORS.gold : COLORS.cyan;
        ctx.shadowBlur = isBig ? 15 : 8;

        // Draw snowflake
        ctx.strokeStyle = isBig ? COLORS.gold : '#fff';
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
        ctx.fillStyle = isBig ? COLORS.gold : '#fff';
        ctx.beginPath();
        ctx.arc(0, 0, isBig ? 3 : 2, 0, Math.PI * 2);
        ctx.fill();

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
    ctx.fillStyle = '#5a4030';
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

    // Fire glow (use cached sin8)
    const fireGlow = 0.6 + animCache.sin8 * 0.2;
    // Simplified fire - solid glow instead of gradient for performance
    ctx.fillStyle = `rgba(255, 120, 40, ${fireGlow * 0.7})`;
    ctx.fillRect(fpX + 5, fpY + 25, 50, 30);

    // Fire flames (use cached sin10)
    ctx.fillStyle = `rgba(255, 200, 50, ${fireGlow})`;
    for (let i = 0; i < 5; i++) {
        const flameX = fpX + 15 + i * 10 + animCache.sin10 * 3;
        const flameH = 15 + animCache.sin8 * 8;
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
        // DOWN/S only affects speed, no animation change
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

    // Going straight down the mountain (side profile view) - default riding pose
    // Board points down, we see rider's side profile
    // This also applies when pressing DOWN for speed (same visual, just faster)
    const goingStraight = !player.crashed && !isBraking && (
        // On ground and going straight (or pressing down for speed)
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
    } else if (player.grinding && player.grindTrick) {
        // Apply grind trick rotation based on trick type
        const grindTrickId = player.grindTrick.id;
        if (grindTrickId === 'boardslide') {
            ctx.rotate(Math.PI / 2 * 0.7); // Board perpendicular (boardslide)
        } else if (grindTrickId === 'noseslide') {
            ctx.rotate(Math.PI / 4 * 0.5); // Slight forward lean
        } else if (grindTrickId === 'tailslide') {
            ctx.rotate(-Math.PI / 4 * 0.5); // Slight backward lean
        }
        // 50-50 has no rotation (default)
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
    const crouchFactor = player.preloadCrouch || 0;
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
        ctx.fillStyle = COLORS.hotPink;
        ctx.shadowColor = COLORS.hotPink;
        ctx.shadowBlur = 2;
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
        ctx.strokeStyle = '#6644aa';
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
        ctx.fillStyle = COLORS.electricBlue;
        ctx.shadowColor = COLORS.cyan;
        ctx.shadowBlur = 1;
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
        ctx.strokeStyle = COLORS.electricBlue;
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
        ctx.fillStyle = COLORS.hotPink;
        ctx.shadowColor = COLORS.hotPink;
        ctx.shadowBlur = 2;
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
        ctx.strokeStyle = '#6644aa';
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
        ctx.fillStyle = COLORS.electricBlue;
        ctx.shadowColor = COLORS.cyan;
        ctx.shadowBlur = 1;
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
        ctx.strokeStyle = COLORS.electricBlue;
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

        // Face/skin (smaller, positioned forward)
        ctx.fillStyle = '#f5c9a6';  // Skin tone
        ctx.beginPath();
        ctx.arc(faceDir * 4, headY + 1, 6, 0, Math.PI * 2);
        ctx.fill();

        // Beanie - side view with texture
        ctx.fillStyle = '#1a1a2e';  // Dark navy beanie base
        ctx.beginPath();
        ctx.arc(faceDir * 2, headY - 3, 10, Math.PI * 0.7, Math.PI * 2.3);
        ctx.fill();

        // Beanie color band (hot pink accent)
        ctx.fillStyle = COLORS.hotPink;
        ctx.beginPath();
        ctx.arc(faceDir * 2, headY - 5, 8, Math.PI * 0.8, Math.PI * 2.2);
        ctx.fill();

        // Beanie knit texture lines
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.lineWidth = 1;
        for (let i = 0; i < 4; i++) {
            ctx.beginPath();
            ctx.arc(faceDir * 2, headY - 3, 8 - i * 1.5, Math.PI * 0.9, Math.PI * 2.1);
            ctx.stroke();
        }

        // Beanie fold/cuff at bottom
        ctx.fillStyle = '#2a2a4e';
        ctx.beginPath();
        ctx.ellipse(faceDir * 2, headY + 2, 9, 3, 0, Math.PI * 0.8, Math.PI * 2.2);
        ctx.fill();

        // Pom-pom on top
        ctx.fillStyle = COLORS.hotPink;
        ctx.beginPath();
        ctx.arc(faceDir * 0, headY - 12, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.beginPath();
        ctx.arc(faceDir * -1, headY - 13, 1.5, 0, Math.PI * 2);
        ctx.fill();

        // Goggle strap (visible behind head)
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(faceDir * 3, headY, 9, Math.PI * 0.3, Math.PI * 0.7);
        ctx.stroke();

        // Goggles - side view (clearly separate from beanie)
        const goggleY = headY + 1;

        // Goggle frame (dark)
        ctx.fillStyle = '#222';
        ctx.beginPath();
        ctx.ellipse(faceDir * 7, goggleY, 7, 4.5, faceDir * 0.2, 0, Math.PI * 2);
        ctx.fill();

        // Goggle lens
        ctx.fillStyle = COLORS.magenta;
        ctx.shadowColor = COLORS.magenta;
        ctx.shadowBlur = 3;
        ctx.beginPath();
        ctx.ellipse(faceDir * 7, goggleY, 5, 3, faceDir * 0.2, 0, Math.PI * 2);
        ctx.fill();

        // Goggle lens shine (reflection)
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.beginPath();
        ctx.ellipse(faceDir * 5.5, goggleY - 1, 2, 1.2, -0.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
    } else {
        // CARVING - board is HORIZONTAL (original drawing)
        ctx.fillStyle = COLORS.hotPink;
        ctx.shadowColor = COLORS.hotPink;
        ctx.shadowBlur = 2;
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

        // Body/jacket
        ctx.fillStyle = COLORS.electricBlue;
        ctx.shadowColor = COLORS.cyan;
        ctx.shadowBlur = 2;
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

        // Arms
        ctx.strokeStyle = COLORS.electricBlue;
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

        // Head/face - front view
        ctx.fillStyle = '#f5c9a6';  // Skin tone
        ctx.beginPath();
        ctx.arc(0, -22, 8, 0, Math.PI * 2);
        ctx.fill();

        // Beanie - front view with knit texture
        ctx.fillStyle = '#1a1a2e';  // Dark navy base
        ctx.beginPath();
        ctx.arc(0, -26, 11, Math.PI * 0.85, Math.PI * 2.15);
        ctx.fill();

        // Beanie color band (hot pink)
        ctx.fillStyle = COLORS.hotPink;
        ctx.beginPath();
        ctx.arc(0, -28, 9, Math.PI * 0.9, Math.PI * 2.1);
        ctx.fill();

        // Beanie knit texture
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
        ctx.lineWidth = 1;
        for (let i = 0; i < 5; i++) {
            ctx.beginPath();
            ctx.arc(0, -26, 9 - i * 1.2, Math.PI * 0.95, Math.PI * 2.05);
            ctx.stroke();
        }

        // Beanie fold/cuff
        ctx.fillStyle = '#2a2a4e';
        ctx.beginPath();
        ctx.roundRect(-10, -21, 20, 4, 2);
        ctx.fill();

        // Pom-pom
        ctx.fillStyle = COLORS.hotPink;
        ctx.beginPath();
        ctx.arc(0, -37, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.beginPath();
        ctx.arc(-1, -38, 1.5, 0, Math.PI * 2);
        ctx.fill();

        // Goggle strap (behind head, visible at sides)
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(-11, -24);
        ctx.lineTo(-13, -22);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(11, -24);
        ctx.lineTo(13, -22);
        ctx.stroke();

        // Goggle frame (dark outer edge)
        ctx.fillStyle = '#222';
        ctx.beginPath();
        ctx.roundRect(-11, -28, 22, 9, 3);
        ctx.fill();

        // Goggles lens
        ctx.fillStyle = COLORS.magenta;
        ctx.shadowColor = COLORS.magenta;
        ctx.shadowBlur = 4;
        ctx.beginPath();
        ctx.roundRect(-9, -27, 18, 7, 2);
        ctx.fill();

        // Goggle nose bridge (center divider)
        ctx.fillStyle = '#333';
        ctx.fillRect(-1, -26, 2, 5);
    }

    // Goggle lens shine (reflection)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.beginPath();
    ctx.ellipse(-5, -25, 3, 1.5, -0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(4, -25, 2, 1, -0.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.restore();
}

function drawAvalanche() {
    const chase = gameState.chase;
    const screen = worldToScreen(0, chase.fogY);
    const time = gameState.animationTime;

    // === Snow wall base gradient (white/icy) ===
    const gradient = ctx.createLinearGradient(0, screen.y - 220, 0, screen.y + 80);
    gradient.addColorStop(0, 'rgba(240, 245, 255, 0)');
    gradient.addColorStop(0.15, 'rgba(230, 238, 248, 0.2)');
    gradient.addColorStop(0.3, 'rgba(220, 230, 245, 0.5)');
    gradient.addColorStop(0.5, 'rgba(210, 222, 240, 0.75)');
    gradient.addColorStop(0.7, 'rgba(200, 215, 235, 0.9)');
    gradient.addColorStop(0.85, 'rgba(190, 205, 225, 0.97)');
    gradient.addColorStop(1, 'rgba(180, 195, 215, 1)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, screen.y - 220, CANVAS_WIDTH, 320);

    // === Billowing snow clouds (rolling tumble edge) ===
    const cloudCount = CHASE.avalancheCloudCount;
    for (let i = 0; i < cloudCount; i++) {
        const phase = time * 1.8 + i * 1.2;
        const baseX = (i * CANVAS_WIDTH / cloudCount) + Math.sin(phase) * 30;
        const cloudSize = 50 + Math.sin(i * 2.1 + time * 0.5) * 30;
        const cloudY = screen.y - 130 + Math.sin(phase * 0.7) * 20;

        // Each cloud is a cluster of overlapping circles
        ctx.save();
        const brightness = 240 + Math.sin(i * 1.7) * 15;
        ctx.fillStyle = `rgba(${brightness}, ${brightness + 5}, ${brightness + 10}, ${0.7 + Math.sin(phase) * 0.15})`;

        // Main cloud body
        ctx.beginPath();
        ctx.arc(baseX, cloudY, cloudSize * 0.6, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.arc(baseX - cloudSize * 0.4, cloudY + 8, cloudSize * 0.45, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.arc(baseX + cloudSize * 0.4, cloudY + 5, cloudSize * 0.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.arc(baseX + cloudSize * 0.15, cloudY - cloudSize * 0.25, cloudSize * 0.35, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }

    // === Rolling tumble edge (animated bezier bumps) ===
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.lineWidth = 5;
    ctx.fillStyle = 'rgba(235, 240, 250, 0.8)';
    ctx.beginPath();
    ctx.moveTo(-10, screen.y - 80);
    const bumpCount = 8;
    for (let i = 0; i < bumpCount; i++) {
        const segWidth = (CANVAS_WIDTH + 20) / bumpCount;
        const x0 = -10 + i * segWidth;
        const x1 = x0 + segWidth;
        const bumpPhase = time * 2.2 + i * 1.5;
        const bumpHeight = 25 + Math.sin(bumpPhase) * 15;
        const cpX = x0 + segWidth / 2 + Math.sin(bumpPhase * 0.8 + i) * 15;

        ctx.quadraticCurveTo(cpX, screen.y - 80 - bumpHeight, x1, screen.y - 80 + Math.sin(bumpPhase + 2) * 8);
    }
    ctx.lineTo(CANVAS_WIDTH + 10, screen.y + 100);
    ctx.lineTo(-10, screen.y + 100);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // === Snow debris chunks ahead of the wall ===
    const debrisCount = CHASE.avalancheDebrisCount;
    for (let i = 0; i < debrisCount; i++) {
        const seed = i * 73.37;
        const debrisPhase = time * 3 + seed;
        const debrisX = ((seed * 7 + time * 40) % (CANVAS_WIDTH + 60)) - 30;
        const debrisBaseY = screen.y - 160 - i * 8;
        const debrisY = debrisBaseY + Math.sin(debrisPhase) * 20;
        const debrisSize = 3 + Math.sin(seed * 0.3) * 3;
        const rotation = debrisPhase * 2;

        if (debrisY < screen.y - 60 && debrisY > screen.y - 280) {
            ctx.save();
            ctx.translate(debrisX, debrisY);
            ctx.rotate(rotation);
            ctx.fillStyle = `rgba(${230 + Math.floor(Math.sin(seed) * 20)}, ${238 + Math.floor(Math.sin(seed + 1) * 12)}, 250, ${0.5 + Math.sin(debrisPhase * 0.5) * 0.2})`;
            ctx.fillRect(-debrisSize, -debrisSize * 0.6, debrisSize * 2, debrisSize * 1.2);
            ctx.restore();
        }
    }

    // === Powder spray (fine mist ahead of avalanche) ===
    const sprayCount = CHASE.avalancheSprayCount;
    for (let i = 0; i < sprayCount; i++) {
        const seed = i * 43.71;
        const sprayX = ((seed * 11 + time * 25) % CANVAS_WIDTH);
        const sprayY = screen.y - 200 + Math.sin(time * 1.5 + seed) * 60;
        const spraySize = 1.5 + Math.sin(time * 2 + seed * 0.5) * 1;

        if (sprayY > screen.y - 280 && sprayY < screen.y - 100) {
            ctx.fillStyle = `rgba(245, 248, 255, ${0.2 + Math.sin(time + seed) * 0.1})`;
            ctx.beginPath();
            ctx.arc(sprayX, sprayY, spraySize, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // === Dense snow mass behind the leading edge ===
    const innerGrad = ctx.createLinearGradient(0, screen.y - 40, 0, screen.y + 120);
    innerGrad.addColorStop(0, 'rgba(200, 210, 225, 0.8)');
    innerGrad.addColorStop(0.3, 'rgba(185, 195, 210, 0.95)');
    innerGrad.addColorStop(1, 'rgba(160, 175, 195, 1)');
    ctx.fillStyle = innerGrad;
    ctx.fillRect(0, screen.y - 40, CANVAS_WIDTH, 180);

    // === Shadow at base for depth ===
    const shadowGrad = ctx.createLinearGradient(0, screen.y + 60, 0, screen.y + 120);
    shadowGrad.addColorStop(0, 'rgba(120, 135, 160, 0.3)');
    shadowGrad.addColorStop(1, 'rgba(100, 115, 140, 0.6)');
    ctx.fillStyle = shadowGrad;
    ctx.fillRect(0, screen.y + 60, CANVAS_WIDTH, 60);
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

        // Draw dark energy aura behind sprite - purple/magenta for shadowy beast
        const pulseIntensity = 0.4 + Math.sin(time * 3) * 0.2;
        const auraGrad = ctx.createRadialGradient(screen.x, screen.y, 20, screen.x, screen.y, 85 * scale);
        auraGrad.addColorStop(0, `rgba(120, 0, 180, ${pulseIntensity * 0.4})`);
        auraGrad.addColorStop(0.5, `rgba(60, 0, 100, ${pulseIntensity * 0.25})`);
        auraGrad.addColorStop(1, 'rgba(20, 0, 40, 0)');
        ctx.fillStyle = auraGrad;
        ctx.beginPath();
        ctx.arc(screen.x, screen.y, 80 * scale, 0, Math.PI * 2);
        ctx.fill();

        // Draw sprite
        const drawn = sprites.beast.draw(ctx, screen.x, screen.y, scale, 0, false);
        if (drawn) return; // Success, skip procedural drawing
    }

    // Fallback to procedural drawing - HUMANOID BEAST silhouette
    ctx.save();
    ctx.translate(screen.x, screen.y);

    // Scale up during lunge and with rage
    let scale = 1 + chase.beastRage * 0.25;
    if (chase.beastState === 'lunging') {
        scale += chase.lungeProgress * 0.5;
    }
    ctx.scale(scale, scale);

    // Breathing animation (use cached sin3)
    const breathe = animCache.sin3 * 0.05 + 1;
    ctx.scale(breathe, 1 / breathe);

    // Subtle dark aura
    const pulseIntensity = 0.3 + animCache.sin3 * 0.15;
    ctx.fillStyle = `rgba(26, 10, 50, ${pulseIntensity * 0.2})`;
    ctx.beginPath();
    ctx.arc(0, 0, 75, 0, Math.PI * 2);
    ctx.fill();

    // Walking leg animation
    const walkPhase = Math.sin(time * 4) * 6;

    // Legs - two thick limbs
    ctx.strokeStyle = '#0d0d2a';
    ctx.lineWidth = 13;
    ctx.lineCap = 'round';
    // Left leg
    ctx.beginPath();
    ctx.moveTo(-12, 20);
    ctx.lineTo(-16 - walkPhase, 42);
    ctx.lineTo(-14 - walkPhase * 0.5, 54);
    ctx.stroke();
    // Right leg
    ctx.beginPath();
    ctx.moveTo(12, 20);
    ctx.lineTo(16 + walkPhase, 42);
    ctx.lineTo(14 + walkPhase * 0.5, 54);
    ctx.stroke();
    // Feet
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(-18 - walkPhase * 0.5, 53);
    ctx.lineTo(-10 - walkPhase * 0.5, 56);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(10 + walkPhase * 0.5, 53);
    ctx.lineTo(18 + walkPhase * 0.5, 56);
    ctx.stroke();

    // Torso - barrel chest trapezoid
    ctx.fillStyle = '#1a1a3a';
    ctx.beginPath();
    ctx.moveTo(-28, -18);
    ctx.lineTo(-22, 22);
    ctx.quadraticCurveTo(0, 26, 22, 22);
    ctx.lineTo(28, -18);
    ctx.quadraticCurveTo(0, -24, -28, -18);
    ctx.fill();

    // Shoulder humps
    ctx.fillStyle = '#1a1a3a';
    ctx.beginPath();
    ctx.ellipse(-26, -16, 10, 7, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(26, -16, 10, 7, 0.3, 0, Math.PI * 2);
    ctx.fill();

    // Arms - gorilla length
    const armSwing = walkPhase * 0.8;
    ctx.strokeStyle = '#0d0d2a';
    ctx.lineWidth = 11;
    // Left arm
    ctx.beginPath();
    ctx.moveTo(-28, -12);
    ctx.lineTo(-34 + armSwing, 6);
    ctx.lineTo(-32 + armSwing * 0.5, 22);
    ctx.stroke();
    // Right arm
    ctx.beginPath();
    ctx.moveTo(28, -12);
    ctx.lineTo(34 - armSwing, 6);
    ctx.lineTo(32 - armSwing * 0.5, 22);
    ctx.stroke();

    // Clawed hands
    ctx.fillStyle = '#0d0d2a';
    ctx.beginPath();
    ctx.arc(-32 + armSwing * 0.5, 23, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(32 - armSwing * 0.5, 23, 5, 0, Math.PI * 2);
    ctx.fill();
    // Claw strokes
    ctx.strokeStyle = '#3a3030';
    ctx.lineWidth = 2;
    for (let side = -1; side <= 1; side += 2) {
        const hx = side * (32 - armSwing * 0.5 * side);
        for (let c = -1; c <= 1; c++) {
            ctx.beginPath();
            ctx.moveTo(hx + c * 3, 20);
            ctx.lineTo(hx + c * 3 + side * 3, 14);
            ctx.stroke();
        }
    }

    // Head - rounded shape
    ctx.fillStyle = '#1a1a3a';
    ctx.beginPath();
    ctx.ellipse(0, -32, 16, 14, 0, 0, Math.PI * 2);
    ctx.fill();

    // Brow ridge
    ctx.fillStyle = '#0d0d2a';
    ctx.beginPath();
    ctx.ellipse(0, -38, 14, 4, 0, Math.PI, Math.PI * 2);
    ctx.fill();

    // Fur spikes on head
    ctx.strokeStyle = '#4a4a6a';
    ctx.lineWidth = 2;
    for (let i = -2; i <= 2; i++) {
        ctx.beginPath();
        ctx.moveTo(i * 5, -44);
        ctx.lineTo(i * 5, -52 - Math.abs(i));
        ctx.stroke();
    }

    // Fur texture on torso
    ctx.strokeStyle = '#4a4a6a';
    ctx.lineWidth = 1.2;
    for (let i = 0; i < 6; i++) {
        const fx = -18 + i * 7;
        ctx.beginPath();
        ctx.moveTo(fx, -14);
        ctx.lineTo(fx + animCache.sin2 * 2, 8);
        ctx.stroke();
    }

    ctx.shadowBlur = 0;

    // Eyes - both cyan
    const eyeTrack = Math.sin(time) * 1.5;
    ctx.fillStyle = COLORS.cyan;
    ctx.shadowColor = COLORS.cyan;
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.ellipse(-7 + eyeTrack, -34, 4, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(7 + eyeTrack, -34, 4, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Eye cores
    ctx.fillStyle = '#ffffff';
    ctx.shadowBlur = 2;
    ctx.beginPath();
    ctx.ellipse(-7 + eyeTrack, -34, 1.5, 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(7 + eyeTrack, -34, 1.5, 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Mouth - grimace with fang tips
    ctx.strokeStyle = '#0d0d2a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-10, -24);
    ctx.quadraticCurveTo(0, -21, 10, -24);
    ctx.stroke();
    // Fang tips peeking
    ctx.strokeStyle = '#e8e0d0';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(-6, -24); ctx.lineTo(-7, -21); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(6, -24); ctx.lineTo(7, -21); ctx.stroke();

    // Extended claws during lunge
    if (chase.beastState === 'lunging') {
        ctx.strokeStyle = '#3a3030';
        ctx.lineWidth = 3;
        ctx.shadowColor = COLORS.cyan;
        ctx.shadowBlur = 3;
        for (let side = -1; side <= 1; side += 2) {
            const hx = side * 36;
            for (let c = 0; c < 4; c++) {
                ctx.beginPath();
                ctx.moveTo(hx, 10 + c * 6);
                ctx.lineTo(hx + side * 16, 8 + c * 6);
                ctx.stroke();
            }
        }
        ctx.shadowBlur = 0;
    }

    ctx.restore();
}

function drawParticles() {
    const particles = gameState.particles;

    // Draw non-spark particles first (no shadow blur needed)
    for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        if (p.type === 'spark') continue;

        const screen = worldToScreen(p.x, p.y);
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.fillRect(screen.x - p.size/2, screen.y - p.size/2, p.size, p.size);
    }

    // Draw spark particles with shadow (batch shadow state change)
    ctx.shadowBlur = getShadowBlur(3);
    for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        if (p.type !== 'spark') continue;

        const screen = worldToScreen(p.x, p.y);
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.beginPath();
        ctx.arc(screen.x, screen.y, p.size, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
}

function drawCelebrations() {
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';

    // Sort by timer (newest first) and limit visible count to prevent overlap
    const sortedCelebrations = [...gameState.celebrations].sort((a, b) => b.timer - a.timer);
    const maxVisible = 3;

    // Position in top-right corner, below HUD (around y=50)
    const baseX = CANVAS_WIDTH - 15;
    const baseY = 50;

    for (let i = 0; i < Math.min(sortedCelebrations.length, maxVisible); i++) {
        const c = sortedCelebrations[i];
        const fade = Math.min(1, c.timer / 0.3);
        const verticalOffset = i * 28; // Tighter stacking for smaller text

        ctx.globalAlpha = fade * 0.9;

        // Main text - fixed small font (ignore scale to prevent giant text)
        const fontSize = Math.min(12, Math.floor(10 * Math.min(c.scale, 1.1)));
        ctx.font = `bold ${fontSize}px "Press Start 2P", monospace`;
        ctx.shadowColor = c.color;
        ctx.shadowBlur = 1;
        ctx.fillStyle = c.color;
        ctx.fillText(c.text, baseX, baseY + verticalOffset);

        // Subtext (points) - even smaller, fixed size
        if (c.subtext) {
            ctx.font = `bold 8px "Press Start 2P", monospace`;
            ctx.fillStyle = '#fff';
            ctx.fillText(c.subtext, baseX, baseY + 12 + verticalOffset);
        }

        ctx.shadowBlur = 0;
    }
    ctx.globalAlpha = 1;
}

function drawHUD() {
    ctx.textBaseline = 'top';

    if (hudPanel.loaded && hudPanel.canvas) {
        drawPanelHUD();
    } else {
        drawFallbackHUD();
    }
}

// ============================================
// PANEL HUD - All data in bottom frame
// ============================================
function drawPanelHUD() {
    const scale = getUIScale();
    const panelH = Math.round(hudPanel.panelHeight * scale);
    const panelY = CANVAS_HEIGHT - panelH;

    // --- Draw panel frame image (no background — transparent over gameplay) ---
    ctx.drawImage(hudPanel.canvas, 0, panelY);

    // --- Grid layout: 3 columns x 2 rows, equidistant ---
    const padX = Math.round(CANVAS_WIDTH * 0.08);
    const usableW = CANVAS_WIDTH - padX * 2;

    // 3 column centers: evenly spaced
    const col1X = padX + Math.round(usableW * (1 / 6));
    const col2X = padX + Math.round(usableW * (3 / 6));
    const col3X = padX + Math.round(usableW * (5 / 6));

    // Single row vertically centered in the interior (~30% to ~60%)
    ctx.textBaseline = 'middle';
    const interiorCenter = panelH * 0.45;
    const rowY = panelY + Math.round(interiorCenter);

    const fontSize = Math.round(8 * scale);

    // === Distance | Speed | Score ===
    drawNeonText(`${gameState.distance}m`, col1X, rowY, COLORS.cyan, fontSize, 'center');

    const speedPercent = Math.floor((gameState.player.speed / PHYSICS.maxSpeed) * 100);
    const speedColor = speedPercent > 75 ? COLORS.hotPink : COLORS.electricBlue;
    drawNeonText(`${speedPercent}%`, col2X, rowY, speedColor, fontSize, 'center');

    drawNeonText(gameState.score.toString().padStart(6, '0'), col3X, rowY, COLORS.magenta, fontSize, 'center');

    // Danger warning (above the panel)
    if (gameState.dangerLevel > 0.5) {
        const pulse = animCache.sin10 * 0.3 + 0.7;
        ctx.globalAlpha = gameState.dangerLevel * pulse;
        ctx.font = FONTS.pressStart20;
        ctx.textAlign = 'center';
        ctx.fillStyle = COLORS.danger;
        ctx.shadowColor = COLORS.danger;
        ctx.shadowBlur = getShadowBlur(6);
        ctx.fillText('SPEED UP!', CANVAS_WIDTH / 2, panelY - Math.round(28 * scale));
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
    }

    // Restore textBaseline
    ctx.textBaseline = 'top';
}

// ============================================
// FALLBACK HUD (original text-only layout)
// ============================================
function drawFallbackHUD() {
    drawNeonText(`${gameState.distance}m`, 15, 15, COLORS.cyan, 16, 'left');

    const speedPercent = Math.floor((gameState.player.speed / PHYSICS.maxSpeed) * 100);
    const speedColor = speedPercent > 75 ? COLORS.hotPink : COLORS.electricBlue;
    drawNeonText(`${speedPercent}%`, CANVAS_WIDTH/2, 15, speedColor, 18, 'center');

    drawNeonText(gameState.score.toString().padStart(6, '0'), CANVAS_WIDTH - 15, 15, COLORS.magenta, 16, 'right');

    if (gameState.trickMultiplier > 1) {
        const comboY = 50;
        ctx.font = FONTS.pressStart14;
        ctx.textAlign = 'center';
        ctx.fillStyle = COLORS.gold;
        ctx.shadowColor = COLORS.gold;
        ctx.shadowBlur = getShadowBlur(5);
        ctx.fillText(`x${gameState.trickMultiplier.toFixed(1)}`, CANVAS_WIDTH/2, comboY);
        ctx.shadowBlur = 0;
        const barWidth = 80;
        const barFill = gameState.trickComboTimer / 2.5;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(CANVAS_WIDTH/2 - barWidth/2, comboY + 18, barWidth, 4);
        ctx.fillStyle = COLORS.gold;
        ctx.fillRect(CANVAS_WIDTH/2 - barWidth/2, comboY + 18, barWidth * barFill, 4);
        if (gameState.comboChainLength > 1) {
            ctx.font = FONTS.pressStart10;
            ctx.fillStyle = COLORS.limeGreen;
            ctx.fillText(`${gameState.comboChainLength} chain`, CANVAS_WIDTH/2, comboY + 26);
        }
    }

    if (gameState.flowMeter > 5) {
        const flowY = CANVAS_HEIGHT - 40;
        const flowBarWidth = 80;
        const flowFill = gameState.flowMeter / 100;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(15, flowY, flowBarWidth, 10);
        ctx.fillStyle = COLORS.cyan;
        ctx.fillRect(15, flowY, flowBarWidth * flowFill, 10);
        ctx.font = FONTS.pressStart8;
        ctx.textAlign = 'left';
        ctx.fillStyle = COLORS.cyan;
        ctx.fillText('FLOW', 15, flowY - 12);
        if (gameState.flowMultiplier > 1.1) {
            ctx.fillStyle = COLORS.limeGreen;
            ctx.fillText(`x${gameState.flowMultiplier.toFixed(1)}`, 15 + flowBarWidth + 8, flowY);
        }
    }

    if (gameState.collectiblesCollected > 0) {
        ctx.font = FONTS.pressStart10;
        ctx.textAlign = 'right';
        ctx.fillStyle = COLORS.gold;
        ctx.shadowColor = COLORS.gold;
        ctx.shadowBlur = getShadowBlur(8);
        ctx.fillText(`\u2744${gameState.collectiblesCollected}`, CANVAS_WIDTH - 15, CANVAS_HEIGHT - 35);
        ctx.shadowBlur = 0;
    }

    if (gameState.dangerLevel > 0.5) {
        const pulse = animCache.sin10 * 0.3 + 0.7;
        ctx.globalAlpha = gameState.dangerLevel * pulse;
        ctx.font = FONTS.pressStart20;
        ctx.textAlign = 'center';
        ctx.fillStyle = COLORS.danger;
        ctx.shadowColor = COLORS.danger;
        ctx.shadowBlur = getShadowBlur(6);
        ctx.fillText('SPEED UP!', CANVAS_WIDTH/2, CANVAS_HEIGHT - 60);
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
    }
}

function drawNeonText(text, x, y, color, size, align) {
    // Use cached font if available, otherwise build string
    const fontKey = `pressStart${size}`;
    ctx.font = FONTS[fontKey] || `bold ${size}px "Press Start 2P", monospace`;
    ctx.textAlign = align;

    // Dark outline for readability on light backgrounds
    ctx.strokeStyle = '#000';
    ctx.lineWidth = Math.max(Math.round(size * 0.25), 2);
    ctx.lineJoin = 'round';
    ctx.shadowColor = '#000';
    ctx.shadowBlur = getShadowBlur(4);
    ctx.strokeText(text, x, y);

    // Colored fill with neon glow
    ctx.shadowColor = color;
    ctx.shadowBlur = getShadowBlur(5);
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
    ctx.shadowBlur = 0;
}

function drawDangerVignette() {
    const intensity = gameState.dangerLevel * 0.4;
    const pulse = animCache.sin6 * 0.1;  // Use cached sin value

    // Cache the danger vignette gradient (recreated only on canvas resize)
    if (!gradientCache.dangerVignette) {
        gradientCache.dangerVignette = ctx.createRadialGradient(
            CANVAS_WIDTH/2, CANVAS_HEIGHT/2, CANVAS_HEIGHT * 0.3,
            CANVAS_WIDTH/2, CANVAS_HEIGHT/2, CANVAS_HEIGHT * 0.7
        );
        gradientCache.dangerVignette.addColorStop(0, 'rgba(220, 230, 245, 0)');
        gradientCache.dangerVignette.addColorStop(1, 'rgba(220, 230, 245, 1)');
    }

    // Use globalAlpha to modulate intensity instead of recreating gradient
    ctx.globalAlpha = intensity + pulse;
    ctx.fillStyle = gradientCache.dangerVignette;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.globalAlpha = 1;
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
    ctx.shadowBlur = 4;
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
        ctx.fillStyle = COLORS.gold;
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
        deathText = 'BURIED BY THE AVALANCHE';
        deathColor = '#c8daf0';
    } else if (gameState.deathCause === 'beast') {
        deathText = 'CAUGHT BY THE BEAST';
        deathColor = COLORS.magenta;
    }

    ctx.font = 'bold 18px "Press Start 2P", monospace';
    ctx.shadowColor = deathColor;
    ctx.shadowBlur = 3;
    ctx.fillStyle = deathColor;
    ctx.fillText(deathText, CANVAS_WIDTH/2, CANVAS_HEIGHT * 0.3);
    ctx.shadowBlur = 0;

    // Stats
    ctx.font = '12px "Press Start 2P", monospace';
    ctx.fillStyle = COLORS.cyan;
    ctx.fillText(`DISTANCE: ${gameState.distance}m`, CANVAS_WIDTH/2, CANVAS_HEIGHT * 0.45);
    ctx.fillStyle = COLORS.magenta;
    ctx.fillText(`SCORE: ${gameState.score}`, CANVAS_WIDTH/2, CANVAS_HEIGHT * 0.52);
    ctx.fillStyle = COLORS.gold;
    ctx.fillText(`MAX COMBO: x${gameState.maxCombo.toFixed(1)}`, CANVAS_WIDTH/2, CANVAS_HEIGHT * 0.59);

    // New high score
    if (gameState.score > gameState.highScore) {
        const pulse = Math.sin(gameState.animationTime * 5) * 0.3 + 0.7;
        ctx.globalAlpha = pulse;
        ctx.font = '14px "Press Start 2P", monospace';
        ctx.fillStyle = COLORS.gold;
        ctx.shadowColor = COLORS.gold;
        ctx.shadowBlur = 2;
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
    gameState.mode = 'og';
    gameState.animationTime = 0;

    // Start music loop
    musicManager.play();

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
        grindStartTime: 0,
        grindFrames: 0,
        grindImmunity: 0,
        lastRail: null,
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
        lastLodgeY: -9999,
        pendingExclusions: {}  // Cross-chunk landing zone exclusions keyed by chunkIndex
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
        totalCrashes: 0,
        missCount: 0,
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

    // Collectibles
    gameState.collectibles = [];
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
    // For beast kills, play chomp animation first (once)
    if (cause === 'beast' && !gameState.deathAnimation.active && !gameState.deathAnimation.completed) {
        startDeathAnimation(cause);
        return;
    }

    // For fog/avalanche kills, play avalanche engulf animation (once)
    if (cause === 'fog' && !gameState.deathAnimation.active && !gameState.deathAnimation.completed) {
        startDeathAnimation('avalanche');
        return;
    }

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

    // Continue music for 30s after death, then fade out
    musicManager.startPostDeathTimer();
}

function startDeathAnimation(cause) {
    const player = gameState.player;
    const chase = gameState.chase;

    gameState.deathAnimation = {
        active: true,
        type: cause,
        timer: 0,
        phase: 0,
        playerX: player.x,
        playerY: player.y,
        beastX: chase.beastX,
        beastY: chase.beastY,
        chompCount: 0,
        // Avalanche-specific state
        avalancheDebris: cause === 'avalanche' ? Array.from({length: 50}, (_, i) => ({
            x: (Math.random() - 0.5) * CANVAS_WIDTH * 1.2,
            y: -Math.random() * 200 - 50,
            size: 2 + Math.random() * 6,
            speed: 50 + Math.random() * 100,
            drift: (Math.random() - 0.5) * 40,
            rotation: Math.random() * Math.PI * 2,
            rotSpeed: (Math.random() - 0.5) * 4
        })) : null,
        playerRotation: 0
    };

    gameState.screen = 'dying';

    // Freeze player movement
    player.speed = 0;
    player.lateralSpeed = 0;
}

function updateDeathAnimation(dt) {
    const anim = gameState.deathAnimation;
    if (!anim.active) return;

    anim.timer += dt;

    // Route to avalanche-specific update
    if (anim.type === 'avalanche') {
        updateAvalancheDeathAnimation(anim, dt);
        return;
    }

    // Beast death phase timing
    const grabDuration = 0.5;
    const windUpDuration = 0.3;
    const chompDuration = 1.2;
    const swallowDuration = 0.3;
    const fadeDuration = 0.4;

    if (anim.phase === 0) {
        // Phase 0: Beast grabs player with dramatic lunge
        anim.beastX = lerp(anim.beastX, anim.playerX, 8 * dt);
        anim.beastY = lerp(anim.beastY, anim.playerY, 8 * dt);

        if (anim.timer >= grabDuration) {
            anim.phase = 1;
            anim.timer = 0;
        }
    } else if (anim.phase === 1) {
        // Phase 1: Wind-up - jaw opens wide (anticipation)
        if (anim.timer >= windUpDuration) {
            anim.phase = 2;
            anim.timer = 0;
        }
    } else if (anim.phase === 2) {
        // Phase 2: Chomp animation - 3 slower, impactful chomps
        const chompCycle = Math.floor(anim.timer * 2.5);
        if (chompCycle > anim.chompCount) {
            anim.chompCount = chompCycle;
            gameState.screenShake.intensity = 12;
        }

        if (anim.timer >= chompDuration) {
            anim.phase = 3;
            anim.timer = 0;
        }
    } else if (anim.phase === 3) {
        // Phase 3: Swallow - final gulp
        if (anim.timer >= swallowDuration) {
            anim.phase = 4;
            anim.timer = 0;
        }
    } else if (anim.phase === 4) {
        // Phase 4: Fade out
        if (anim.timer >= fadeDuration) {
            anim.active = false;
            anim.completed = true;
            triggerGameOver(anim.type);
        }
    }
}

function drawDeathAnimation() {
    const anim = gameState.deathAnimation;
    if (!anim.active) return;

    // Route to avalanche-specific draw
    if (anim.type === 'avalanche') {
        drawAvalancheDeathAnimation(anim);
        return;
    }

    const screen = worldToScreen(anim.playerX, anim.playerY);

    ctx.save();
    ctx.translate(screen.x, screen.y);

    const time = gameState.animationTime;

    // Easing function for smoother motion
    const easeInOutQuad = t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

    if (anim.phase === 0) {
        // Phase 0: Grab - massive clawed hand reaches from below
        const grabProgress = easeInOutQuad(Math.min(1, anim.timer / 0.5));

        // Player shrinking/flinching
        const struggle = Math.sin(anim.timer * 20) * (1 - grabProgress) * 3;
        ctx.fillStyle = COLORS.hotPink;
        ctx.beginPath();
        ctx.arc(struggle, -10 - grabProgress * 8, 10 * (1 - grabProgress * 0.4), 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = COLORS.electricBlue;
        ctx.beginPath();
        ctx.arc(struggle, -20 - grabProgress * 5, 6 * (1 - grabProgress * 0.3), 0, Math.PI * 2);
        ctx.fill();

        // Beast clawed hand reaching from below
        const handY = 60 - grabProgress * 50;
        ctx.fillStyle = '#1a1a3a';
        ctx.beginPath();
        ctx.moveTo(-20, handY + 20);
        ctx.quadraticCurveTo(-25, handY + 5, -18, handY - 5);
        ctx.quadraticCurveTo(-10, handY - 12, 0, handY - 14);
        ctx.quadraticCurveTo(10, handY - 12, 18, handY - 5);
        ctx.quadraticCurveTo(25, handY + 5, 20, handY + 20);
        ctx.fill();
        // Claws curling around player
        ctx.strokeStyle = '#3a3030';
        ctx.lineWidth = 3;
        const clawCurl = grabProgress * 0.6;
        ctx.beginPath(); ctx.moveTo(-18, handY - 5); ctx.lineTo(-24 + clawCurl * 10, handY - 14 + clawCurl * 6); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-10, handY - 12); ctx.lineTo(-14 + clawCurl * 8, handY - 22 + clawCurl * 8); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(10, handY - 12); ctx.lineTo(14 - clawCurl * 8, handY - 22 + clawCurl * 8); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(18, handY - 5); ctx.lineTo(24 - clawCurl * 10, handY - 14 + clawCurl * 6); ctx.stroke();

    } else if (anim.phase === 1) {
        // Phase 1: Wind-up - jaw opens wide for anticipation
        const windUpProgress = easeInOutQuad(Math.min(1, anim.timer / 0.3));
        const mouthOpen = windUpProgress * 1.0; // Opens wide

        drawBeastHead(ctx, mouthOpen, false, time);

        // Player visible in mouth, trembling
        const tremble = Math.sin(anim.timer * 25) * 2;
        ctx.fillStyle = COLORS.hotPink;
        ctx.globalAlpha = 0.8;
        ctx.beginPath();
        ctx.arc(tremble, -15, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;

    } else if (anim.phase === 2) {
        // Phase 2: Chomp - slower, more impactful bites with eased motion
        const chompPhase = (anim.timer * 2.5) % 1; // Slower: 2.5 chomps/sec
        // Eased chomp motion - snaps shut faster than it opens
        const easedChomp = chompPhase < 0.3
            ? chompPhase / 0.3  // Quick close (0-0.3)
            : 1 - (chompPhase - 0.3) / 0.7; // Slower open (0.3-1.0)
        const mouthOpen = easeInOutQuad(easedChomp) * 0.9;

        // Player bounces with each chomp
        const playerBounce = Math.sin(chompPhase * Math.PI) * 5;

        drawBeastHead(ctx, mouthOpen, false, time);

        // Player fragments after first chomp
        if (anim.chompCount >= 1) {
            ctx.fillStyle = COLORS.hotPink;
            for (let i = 0; i < Math.min(anim.chompCount + 1, 4); i++) {
                const angle = (i * 1.5 + time * 1.5) % (Math.PI * 2);
                const dist = 25 + i * 12 + anim.timer * 15;
                const size = 4 - i * 0.5;
                ctx.globalAlpha = Math.max(0, 1 - dist / 80);
                ctx.beginPath();
                ctx.arc(Math.cos(angle) * dist, -15 + Math.sin(angle) * dist * 0.4, size, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.globalAlpha = 1;
        }

    } else if (anim.phase === 3) {
        // Phase 3: Swallow - gulp animation
        const swallowProgress = easeInOutQuad(Math.min(1, anim.timer / 0.3));

        // Throat bulge moving down
        const bulgeY = -15 + swallowProgress * 40;

        drawBeastHead(ctx, 0.1, true, time); // Mouth mostly closed

        // Throat bulge effect - dark fur color matching beast
        ctx.fillStyle = '#2a2a4a';
        ctx.beginPath();
        ctx.ellipse(0, bulgeY, 12 * (1 - swallowProgress * 0.5), 8 * (1 - swallowProgress * 0.3), 0, 0, Math.PI * 2);
        ctx.fill();

    } else if (anim.phase === 4) {
        // Phase 4: Fade - satisfied dark beast fading to black
        const fadeProgress = easeInOutQuad(Math.min(1, anim.timer / 0.4));
        ctx.globalAlpha = 1 - fadeProgress;

        // Dark beast body silhouette
        ctx.fillStyle = '#1a1a3a';
        ctx.beginPath();
        ctx.moveTo(-18, -48);
        ctx.quadraticCurveTo(-28, -44, -32, -30);
        ctx.quadraticCurveTo(-36, -16, -30, -2);
        ctx.quadraticCurveTo(-24, 8, -14, 12);
        ctx.quadraticCurveTo(0, 16, 14, 12);
        ctx.quadraticCurveTo(24, 8, 30, -2);
        ctx.quadraticCurveTo(36, -16, 32, -30);
        ctx.quadraticCurveTo(28, -44, 18, -48);
        ctx.quadraticCurveTo(0, -54, -18, -48);
        ctx.fill();

        // Happy closed eyes (satisfied) - dimming cyan
        ctx.strokeStyle = COLORS.cyan;
        ctx.lineWidth = 2.5;
        ctx.shadowColor = COLORS.cyan;
        ctx.shadowBlur = 4;
        ctx.beginPath();
        ctx.arc(-12, -38, 5, Math.PI * 0.15, Math.PI * 0.85);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(12, -38, 5, Math.PI * 0.15, Math.PI * 0.85);
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Content smile - visible against dark fur
        ctx.strokeStyle = '#4a4a6a';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(0, -12, 10, Math.PI * 0.15, Math.PI * 0.85);
        ctx.stroke();

        // Belly pat (dark paw on stomach with claw detail)
        ctx.fillStyle = '#2a2a4a';
        ctx.beginPath();
        ctx.ellipse(8, 20 - fadeProgress * 10, 10, 8, 0.3, 0, Math.PI * 2);
        ctx.fill();
        // Claw strokes on paw
        ctx.strokeStyle = '#3a3030';
        ctx.lineWidth = 1.5;
        const pawY = 20 - fadeProgress * 10;
        ctx.beginPath(); ctx.moveTo(4, pawY - 6); ctx.lineTo(2, pawY - 10); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(8, pawY - 7); ctx.lineTo(8, pawY - 12); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(12, pawY - 6); ctx.lineTo(14, pawY - 10); ctx.stroke();
    }

    ctx.restore();
}

// === Avalanche Death Animation ===

function updateAvalancheDeathAnimation(anim, dt) {
    const engulfDuration = 1.5;
    const tumbleDuration = 1.5;
    const whiteoutDuration = 1.0;
    const fadeDuration = 1.0;

    if (anim.phase === 0) {
        // Phase 0: Engulf — avalanche rushes over player
        const progress = anim.timer / engulfDuration;
        // Increasing screen shake as avalanche approaches
        gameState.screenShake.intensity = 4 + progress * 16;
        // Update debris positions
        if (anim.avalancheDebris) {
            for (const d of anim.avalancheDebris) {
                d.y += d.speed * dt;
                d.x += d.drift * dt;
                d.rotation += d.rotSpeed * dt;
            }
        }
        if (anim.timer >= engulfDuration) {
            anim.phase = 1;
            anim.timer = 0;
        }
    } else if (anim.phase === 1) {
        // Phase 1: Tumble — player rotates amid swirling snow
        anim.playerRotation += dt * 6; // Spinning
        gameState.screenShake.intensity = Math.max(0, 15 - anim.timer * 8);
        if (anim.avalancheDebris) {
            for (const d of anim.avalancheDebris) {
                d.y += d.speed * 0.3 * dt;
                d.x += Math.sin(anim.timer * 3 + d.rotation) * 20 * dt;
                d.rotation += d.rotSpeed * dt;
            }
        }
        if (anim.timer >= tumbleDuration) {
            anim.phase = 2;
            anim.timer = 0;
        }
    } else if (anim.phase === 2) {
        // Phase 2: Whiteout — screen goes fully white
        if (anim.timer >= whiteoutDuration) {
            anim.phase = 3;
            anim.timer = 0;
        }
    } else if (anim.phase === 3) {
        // Phase 3: Fade — white fades to dark
        if (anim.timer >= fadeDuration) {
            anim.active = false;
            anim.completed = true;
            triggerGameOver('fog'); // Re-trigger as fog to reach actual game over
        }
    }
}

function drawAvalancheDeathAnimation(anim) {
    const time = gameState.animationTime;
    const easeInOutQuad = t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

    if (anim.phase === 0) {
        // Phase 0: Engulf — avalanche wall rushes over player
        const progress = easeInOutQuad(Math.min(1, anim.timer / 1.5));
        const screen = worldToScreen(anim.playerX, anim.playerY);

        // Player still visible, being overtaken
        ctx.save();
        ctx.translate(screen.x, screen.y);
        ctx.globalAlpha = 1 - progress * 0.6;
        ctx.fillStyle = COLORS.hotPink;
        ctx.beginPath();
        ctx.arc(0, -10, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = COLORS.electricBlue;
        ctx.beginPath();
        ctx.arc(0, -20, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.restore();

        // Avalanche wall advancing from top
        const wallY = -50 + progress * (CANVAS_HEIGHT + 100);
        const wallGrad = ctx.createLinearGradient(0, wallY - 120, 0, wallY + 30);
        wallGrad.addColorStop(0, 'rgba(200, 215, 235, 1)');
        wallGrad.addColorStop(0.4, 'rgba(220, 230, 245, 0.95)');
        wallGrad.addColorStop(0.7, 'rgba(240, 245, 255, 0.8)');
        wallGrad.addColorStop(1, 'rgba(245, 248, 255, 0)');
        ctx.fillStyle = wallGrad;
        ctx.fillRect(0, wallY - 120, CANVAS_WIDTH, 150);

        // Dense snow behind
        ctx.fillStyle = 'rgba(210, 222, 240, 0.97)';
        ctx.fillRect(0, 0, CANVAS_WIDTH, Math.max(0, wallY - 120));

        // Rolling cloud bumps at leading edge
        for (let i = 0; i < 8; i++) {
            const bx = (i * CANVAS_WIDTH / 8) + Math.sin(time * 2 + i * 1.3) * 20;
            const by = wallY + Math.sin(time * 1.8 + i * 0.9) * 12;
            const br = 30 + Math.sin(i * 2.3 + time) * 12;
            ctx.fillStyle = `rgba(${235 + Math.floor(Math.sin(i) * 10)}, 242, 252, 0.85)`;
            ctx.beginPath();
            ctx.arc(bx, by, br, 0, Math.PI * 2);
            ctx.fill();
        }

        // Snow debris chunks
        if (anim.avalancheDebris) {
            for (const d of anim.avalancheDebris) {
                if (d.y > -100 && d.y < CANVAS_HEIGHT + 50) {
                    ctx.save();
                    ctx.translate(d.x + CANVAS_WIDTH / 2, d.y);
                    ctx.rotate(d.rotation);
                    ctx.fillStyle = `rgba(240, 245, 255, ${0.4 + Math.sin(d.rotation) * 0.2})`;
                    ctx.fillRect(-d.size, -d.size * 0.5, d.size * 2, d.size);
                    ctx.restore();
                }
            }
        }

    } else if (anim.phase === 1) {
        // Phase 1: Tumble — player rotates and shrinks amid dense snow
        const progress = easeInOutQuad(Math.min(1, anim.timer / 1.5));

        // Full snow background
        ctx.fillStyle = 'rgba(220, 230, 245, 0.95)';
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        // Swirling debris
        if (anim.avalancheDebris) {
            for (const d of anim.avalancheDebris) {
                ctx.save();
                const dx = CANVAS_WIDTH / 2 + d.x * (1 - progress * 0.3);
                const dy = CANVAS_HEIGHT / 2 + (d.y % CANVAS_HEIGHT) * 0.5;
                ctx.translate(dx, dy);
                ctx.rotate(d.rotation);
                const alpha = 0.3 + Math.sin(d.rotation * 2) * 0.15;
                ctx.fillStyle = `rgba(190, 205, 225, ${alpha})`;
                ctx.fillRect(-d.size, -d.size * 0.6, d.size * 2, d.size * 1.2);
                ctx.restore();
            }
        }

        // Player tumbling (shrinking and spinning)
        const playerScale = 1 - progress * 0.8;
        const playerAlpha = 1 - progress * 0.7;
        ctx.save();
        ctx.translate(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
        ctx.rotate(anim.playerRotation);
        ctx.scale(playerScale, playerScale);
        ctx.globalAlpha = playerAlpha;
        ctx.fillStyle = COLORS.hotPink;
        ctx.beginPath();
        ctx.arc(0, 5, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = COLORS.electricBlue;
        ctx.beginPath();
        ctx.arc(0, -8, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.restore();

    } else if (anim.phase === 2) {
        // Phase 2: Whiteout — screen fully white with settling particles
        const progress = easeInOutQuad(Math.min(1, anim.timer / 1.0));

        ctx.fillStyle = `rgba(240, 245, 255, ${0.9 + progress * 0.1})`;
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        // Settling snow particles drifting down slowly
        const settleCount = 30;
        for (let i = 0; i < settleCount; i++) {
            const seed = i * 57.13;
            const sx = ((seed * 13 + time * 8) % CANVAS_WIDTH);
            const sy = ((seed * 7 + anim.timer * 30 + i * 25) % CANVAS_HEIGHT);
            const ss = 1 + Math.sin(seed) * 0.8;
            const alpha = (1 - progress) * 0.4;
            ctx.fillStyle = `rgba(200, 210, 225, ${alpha})`;
            ctx.beginPath();
            ctx.arc(sx, sy, ss, 0, Math.PI * 2);
            ctx.fill();
        }

    } else if (anim.phase === 3) {
        // Phase 3: Fade — white fades to dark
        const progress = easeInOutQuad(Math.min(1, anim.timer / 1.0));

        // White background fading to black
        const r = Math.floor(240 * (1 - progress));
        const g = Math.floor(245 * (1 - progress));
        const b = Math.floor(255 * (1 - progress));
        ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    }
}

// Helper function to draw beast head with mouth - dark furry humanoid beast
function drawBeastHead(ctx, mouthOpen, satisfied, time) {
    // Fur fringe strokes around head perimeter
    ctx.strokeStyle = '#4a4a6a';
    ctx.lineWidth = 2;
    const furAngles = [-2.5, -2.1, -1.7, -1.3, -0.9, -0.5, 0.5, 0.9, 1.3, 1.7, 2.1, 2.5];
    for (let i = 0; i < furAngles.length; i++) {
        const a = furAngles[i];
        const wobble = time ? Math.sin(time * 2 + i * 0.7) * 2 : 0;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * 34, -20 + Math.sin(a) * 28);
        ctx.lineTo(Math.cos(a) * (42 + wobble), -20 + Math.sin(a) * (36 + wobble));
        ctx.stroke();
    }

    // Head shape - dark indigo fur, irregular
    ctx.fillStyle = '#1a1a3a';
    ctx.beginPath();
    ctx.moveTo(-18, -48);
    ctx.quadraticCurveTo(-28, -44, -32, -30);
    ctx.quadraticCurveTo(-36, -16, -30, -2);
    ctx.quadraticCurveTo(-24, 8, -14, 12);
    ctx.quadraticCurveTo(0, 16, 14, 12);
    ctx.quadraticCurveTo(24, 8, 30, -2);
    ctx.quadraticCurveTo(36, -16, 32, -30);
    ctx.quadraticCurveTo(28, -44, 18, -48);
    ctx.quadraticCurveTo(0, -54, -18, -48);
    ctx.fill();

    // Brow ridge - thick dark band
    ctx.fillStyle = '#0d0d2a';
    ctx.beginPath();
    ctx.moveTo(-24, -38);
    ctx.quadraticCurveTo(-16, -44, 0, -46);
    ctx.quadraticCurveTo(16, -44, 24, -38);
    ctx.quadraticCurveTo(20, -34, 0, -36);
    ctx.quadraticCurveTo(-20, -34, -24, -38);
    ctx.fill();

    // Upper jaw area
    const upperJawY = -18 - mouthOpen * 6;
    ctx.fillStyle = '#0d0d2a';
    ctx.beginPath();
    ctx.moveTo(-22, upperJawY);
    ctx.quadraticCurveTo(-18, upperJawY - 4, 0, upperJawY - 5);
    ctx.quadraticCurveTo(18, upperJawY - 4, 22, upperJawY);
    ctx.quadraticCurveTo(18, upperJawY + 4, 0, upperJawY + 5);
    ctx.quadraticCurveTo(-18, upperJawY + 4, -22, upperJawY);
    ctx.fill();

    // Lower jaw
    const lowerJawY = -4 + mouthOpen * 14;
    ctx.fillStyle = '#0d0d2a';
    ctx.beginPath();
    ctx.moveTo(-20, lowerJawY);
    ctx.quadraticCurveTo(-16, lowerJawY + 6, 0, lowerJawY + 8);
    ctx.quadraticCurveTo(16, lowerJawY + 6, 20, lowerJawY);
    ctx.quadraticCurveTo(16, lowerJawY - 4, 0, lowerJawY - 5);
    ctx.quadraticCurveTo(-16, lowerJawY - 4, -20, lowerJawY);
    ctx.fill();

    // Mouth interior (visible when open)
    if (mouthOpen > 0.05) {
        ctx.fillStyle = '#2a0510';
        ctx.beginPath();
        ctx.ellipse(0, (upperJawY + lowerJawY) / 2, 16 * mouthOpen, 8 * mouthOpen + 2, 0, 0, Math.PI * 2);
        ctx.fill();
        // Gum lines
        ctx.strokeStyle = '#5a1020';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(-14, upperJawY + 3);
        ctx.quadraticCurveTo(0, upperJawY + 1, 14, upperJawY + 3);
        ctx.stroke();
    }

    // Upper teeth - 2 big canines + smaller teeth
    ctx.fillStyle = '#e8e0d0';
    // Left canine fang
    const fangLen = 8 + mouthOpen * 10;
    ctx.beginPath();
    ctx.moveTo(-10, upperJawY + 2);
    ctx.lineTo(-8, upperJawY + 2 + fangLen);
    ctx.lineTo(-6, upperJawY + 2);
    ctx.fill();
    // Right canine fang
    ctx.beginPath();
    ctx.moveTo(6, upperJawY + 2);
    ctx.lineTo(8, upperJawY + 2 + fangLen);
    ctx.lineTo(10, upperJawY + 2);
    ctx.fill();
    // Smaller upper teeth
    const smallToothH = 4 + mouthOpen * 4;
    for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.moveTo(i * 5 - 1.5, upperJawY + 2);
        ctx.lineTo(i * 5, upperJawY + 2 + smallToothH);
        ctx.lineTo(i * 5 + 1.5, upperJawY + 2);
        ctx.fill();
    }

    // Lower teeth
    const lowerFangLen = 6 + mouthOpen * 6;
    ctx.beginPath();
    ctx.moveTo(-7, lowerJawY - 2);
    ctx.lineTo(-6, lowerJawY - 2 - lowerFangLen);
    ctx.lineTo(-5, lowerJawY - 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(5, lowerJawY - 2);
    ctx.lineTo(6, lowerJawY - 2 - lowerFangLen);
    ctx.lineTo(7, lowerJawY - 2);
    ctx.fill();
    // Smaller lower teeth
    for (let i = -1; i <= 1; i += 2) {
        ctx.beginPath();
        ctx.moveTo(i * 12 - 1, lowerJawY - 2);
        ctx.lineTo(i * 12, lowerJawY - 2 - smallToothH * 0.6);
        ctx.lineTo(i * 12 + 1, lowerJawY - 2);
        ctx.fill();
    }

    // Saliva strings when mouth wide open
    if (mouthOpen > 0.4) {
        ctx.strokeStyle = 'rgba(180, 200, 220, 0.35)';
        ctx.lineWidth = 0.8;
        const wobble1 = time ? Math.sin(time * 8) * 2 : 0;
        const wobble2 = time ? Math.sin(time * 8 + 1.5) * 2 : 0;
        ctx.beginPath();
        ctx.moveTo(-8, upperJawY + fangLen);
        ctx.quadraticCurveTo(-8 + wobble1, (upperJawY + lowerJawY) / 2, -6, lowerJawY - lowerFangLen);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(8, upperJawY + fangLen);
        ctx.quadraticCurveTo(8 + wobble2, (upperJawY + lowerJawY) / 2, 6, lowerJawY - lowerFangLen);
        ctx.stroke();
    }

    // Nose ridge
    ctx.strokeStyle = '#0d0d2a';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(-3, -28);
    ctx.lineTo(0, -23);
    ctx.lineTo(3, -28);
    ctx.stroke();

    // Eyes
    if (!satisfied) {
        // Deep-set glowing cyan eyes under brow
        ctx.fillStyle = COLORS.cyan;
        ctx.shadowColor = COLORS.cyan;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.ellipse(-12, -38, 5, 4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(12, -38, 5, 4, 0, 0, Math.PI * 2);
        ctx.fill();
        // White cores
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.ellipse(-12, -38, 2, 1.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(12, -38, 2, 1.5, 0, 0, Math.PI * 2);
        ctx.fill();
        // Angry brow furrows
        ctx.strokeStyle = '#0d0d2a';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(-20, -44);
        ctx.lineTo(-6, -42);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(20, -44);
        ctx.lineTo(6, -42);
        ctx.stroke();
        ctx.shadowBlur = 0;
    } else {
        // Satisfied - closed happy arc eyes
        ctx.strokeStyle = COLORS.cyan;
        ctx.lineWidth = 2.5;
        ctx.shadowColor = COLORS.cyan;
        ctx.shadowBlur = 4;
        ctx.beginPath();
        ctx.arc(-12, -38, 5, Math.PI * 0.15, Math.PI * 0.85);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(12, -38, 5, Math.PI * 0.15, Math.PI * 0.85);
        ctx.stroke();
        ctx.shadowBlur = 0;
    }
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
            startSelectedMode();
        } else if (gameState.screen === 'gameOver') {
            gameState.screen = 'title';
            showStartScreen();
            musicManager.stop();
        } else if (gameState.screen === 'slalomResults') {
            // Space on slalom results = race again
            document.getElementById('slalomResults').style.display = 'none';
            startSlalom();
        }
    }
    input._lastSpace = input.space;

    // Handle slalom mode
    if (gameState.mode === 'slalom' && (gameState.screen === 'playing' || gameState.screen === 'slalomResults')) {
        if (gameState.screen === 'playing') {
            updateSlalom(dt);
            if (sprites.player) sprites.player.update(dt);
        }
        return;
    }

    // Handle lodge state
    if (gameState.screen === 'lodge') {
        updateLodge(dt);
        return;
    }

    // Handle death animation state
    if (gameState.screen === 'dying') {
        updateDeathAnimation(dt);
        updateScreenShake(dt);
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

    // Check if player reached exit door (use squared distance, 40^2 = 1600)
    const exitX = LODGE.interiorWidth / 2;
    const exitY = LODGE.interiorHeight - 20;
    const edx = lodge.playerX - exitX;
    const edy = lodge.playerY - exitY;
    const distToExitSq = edx * edx + edy * edy;

    if (distToExitSq < 1600) {  // 40^2 = 1600
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

// ============================================================================
// MODE SELECTION SYSTEM
// ============================================================================

function selectMode(mode) {
    selectedMode = mode;
    const ogBtn = document.getElementById('modeOG');
    const slalomBtn = document.getElementById('modeSlalom');
    if (ogBtn) ogBtn.classList.toggle('mode-active', mode === 'og');
    if (slalomBtn) slalomBtn.classList.toggle('mode-active', mode === 'slalom');
}

function startSelectedMode() {
    if (selectedMode === 'slalom') {
        startSlalom();
    } else {
        startGame();
    }
}

// ============================================================================
// SLALOM MODE
// ============================================================================

const SLALOM = {
    courseChunks: 20,           // Number of terrain chunks for the course
    gateCount: 16,             // Total gates on course
    gateSpacing: 700,          // Pixels between gates (base)
    gateSpacingVariance: 150,  // Random variance on spacing
    gateWidth: 130,            // Opening between poles
    poleWidth: 12,             // Width of each pole
    poleHeight: 40,            // Height of each pole
    warmUpDistance: 600,        // Distance before first gate
    waterZoneLength: 800,      // Water section at bottom
    crowdZoneLength: 200,      // Crowd/lodge zone after water
    missedGatePenalty: 5.0,    // Seconds added for missed gate
    poleCrashPenalty: 2.0,     // Seconds added for hitting a pole
    finishDeceleration: 300,   // Deceleration on water (px/s²)
    rocksPerChunk: 1           // Sparse obstacles
};

function startSlalom() {
    hideStartScreen();

    // Hide slalom results if showing (RACE AGAIN flow)
    const resultsEl = document.getElementById('slalomResults');
    if (resultsEl) resultsEl.style.display = 'none';

    if (canvas) {
        canvas.style.display = 'block';
        canvas.style.opacity = '1';
    }

    fitCanvasToViewport();

    TERRAIN.slopeWidth = getTerrainSlopeWidth();
    TERRAIN.laneWidth = getTerrainLaneWidth();

    gradientCache.invalidate();

    gameState.screen = 'playing';
    gameState.mode = 'slalom';
    gameState.animationTime = 0;

    musicManager.play();

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
        grindStartTime: 0,
        grindFrames: 0,
        grindImmunity: 0,
        grindTrick: null,
        grindTrickDisplayTimer: 0,
        lastRail: null,
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

    // Generate slalom course
    const course = generateSlalomCourse();

    gameState.terrain = {
        chunks: [],
        nextChunkY: 0,
        seed: Math.floor(Math.random() * 100000),
        lastLodgeY: -9999,
        pendingExclusions: {}
    };

    gameState.obstacles = course.obstacles;
    gameState.jumps = [];
    gameState.rails = [];
    gameState.lodges = [];
    gameState.collectibles = [];
    gameState.collectiblesCollected = 0;

    // No chase in slalom
    gameState.chase = {
        fogY: -99999, fogSpeed: 0, beastActive: false,
        beastY: 0, beastX: 0, beastState: 'chasing',
        beastLungeTimer: 0, lungeTargetX: 0, lungeTargetY: 0,
        lungeProgress: 0, retreatTimer: 0, distanceTraveled: 0,
        recentCrashes: [], totalCrashes: 0, missCount: 0,
        slowSpeedTimer: 0, beastRage: 0
    };

    gameState.score = 0;
    gameState.distance = 0;
    gameState.trickScore = 0;
    gameState.trickMultiplier = 1;
    gameState.trickComboTimer = 0;
    gameState.maxCombo = 1;
    gameState.comboChainLength = 0;
    gameState.flowMeter = 0;
    gameState.flowMultiplier = 1;
    gameState.nearMissStreak = 0;
    gameState.speedStreak = 0;
    gameState.speedBonus = 0;
    gameState.particles = [];
    gameState.celebrations = [];
    gameState.screenShake = { x: 0, y: 0, intensity: 0, decay: 0.9 };
    gameState.dangerLevel = 0;
    gameState.deathCause = null;
    gameState.deathAnimation = {
        active: false, type: null, timer: 0, phase: 0,
        playerX: 0, playerY: 0, beastX: 0, beastY: 0, chompCount: 0
    };

    // Lodge state reset
    gameState.lodge = {
        active: false, timeInside: 0, playerX: 0, playerY: 0,
        currentLodge: null, warningShown: false
    };

    // Slalom-specific state
    gameState.slalom = {
        elapsed: 0,
        penalties: 0,
        gatesPassed: 0,
        gatesMissed: 0,
        totalGates: course.gates.length,
        gates: course.gates,
        gatePoles: course.gatePoles,
        finished: false,
        finishTime: 0,
        bestTime: loadSlalomBestTime(),
        courseLength: course.courseLength,
        finishLineY: course.finishLineY,
        waterStartY: course.waterStartY,
        onWater: false,
        finishAnimation: 0,
        nextGateIndex: 0
    };
}

function generateSlalomCourse() {
    const halfSlope = TERRAIN.slopeWidth / 2 - 30;
    const gates = [];
    const gatePoles = [];
    const obstacles = [];

    let gateY = SLALOM.warmUpDistance;

    for (let i = 0; i < SLALOM.gateCount; i++) {
        const side = i % 2 === 0 ? 'left' : 'right';

        // Gate center offset from slope center
        const offsetRatio = 0.25 + seededRandom(i * 137 + 42) * 0.20;
        const gateX = side === 'left' ? -halfSlope * offsetRatio : halfSlope * offsetRatio;

        const halfGateWidth = SLALOM.gateWidth / 2;

        const gate = {
            y: gateY,
            gateX: gateX,
            side: side,
            width: SLALOM.gateWidth,
            poleLeftX: gateX - halfGateWidth,
            poleRightX: gateX + halfGateWidth,
            passed: false,
            missed: false,
            checked: false
        };
        gates.push(gate);

        // Create pole obstacles for collision
        gatePoles.push({
            x: gate.poleLeftX,
            y: gateY,
            width: SLALOM.poleWidth,
            height: SLALOM.poleHeight,
            type: 'gate_pole',
            gateSide: side,
            gateIndex: i
        });
        gatePoles.push({
            x: gate.poleRightX,
            y: gateY,
            width: SLALOM.poleWidth,
            height: SLALOM.poleHeight,
            type: 'gate_pole',
            gateSide: side,
            gateIndex: i
        });

        // Spacing for next gate
        const spacing = SLALOM.gateSpacing + (seededRandom(i * 293 + 17) - 0.5) * SLALOM.gateSpacingVariance * 2;
        gateY += spacing;
    }

    // Add sparse rocks between gates
    const totalDistance = gateY + 200;
    const rockCount = Math.floor(totalDistance / TERRAIN.chunkHeight * SLALOM.rocksPerChunk);
    for (let r = 0; r < rockCount; r++) {
        const rockSeed = r * 431 + 77;
        const rockY = 300 + seededRandom(rockSeed) * (totalDistance - 600);
        const rockX = (seededRandom(rockSeed + 1) - 0.5) * halfSlope * 1.4;

        // Don't place rocks too close to gates
        let tooClose = false;
        for (const gate of gates) {
            if (Math.abs(gate.y - rockY) < 120 && Math.abs(gate.gateX - rockX) < SLALOM.gateWidth) {
                tooClose = true;
                break;
            }
        }
        if (!tooClose) {
            obstacles.push({
                x: rockX,
                y: rockY,
                width: 24 + seededRandom(rockSeed + 2) * 16,
                height: 18 + seededRandom(rockSeed + 3) * 12,
                type: 'rock'
            });
        }
    }

    const finishLineY = gateY + 200;
    const waterStartY = finishLineY + 100;
    const courseLength = waterStartY + SLALOM.waterZoneLength + SLALOM.crowdZoneLength;

    return {
        gates,
        gatePoles,
        obstacles,
        finishLineY,
        waterStartY,
        courseLength
    };
}

function updateSlalom(dt) {
    const player = gameState.player;
    const slalom = gameState.slalom;

    if (slalom.finished) {
        // Finish animation - decelerate on water
        slalom.finishAnimation += dt;
        if (slalom.onWater) {
            player.speed = Math.max(0, player.speed - SLALOM.finishDeceleration * dt);
            player.y += player.speed * dt;

            // Spray particles on water
            if (player.speed > 50 && Math.random() < 0.3) {
                const screenPos = worldToScreen(player.x, player.y);
                ParticlePool.spawn(
                    screenPos.x + (Math.random() - 0.5) * 20,
                    screenPos.y + 10,
                    (Math.random() - 0.5) * 60,
                    -30 - Math.random() * 40,
                    3 + Math.random() * 3,
                    'rgba(100, 180, 255, 0.7)',
                    0.5 + Math.random() * 0.3,
                    'spray'
                );
            }

            updateVisualPosition(player, dt);
            updateCamera(dt);
        }

        // Show results after delay
        if (slalom.finishAnimation > 2.5 && document.getElementById('slalomResults').style.display === 'none') {
            showSlalomResults();
        }
        return;
    }

    // Update stopwatch
    slalom.elapsed += dt;

    // Normal physics
    updatePlayer(dt);
    updateCamera(dt);

    // Gate checking
    updateSlalomGates();

    // Collision with gate poles and rocks
    checkSlalomCollisions();

    // Check for water/finish
    if (player.y >= slalom.waterStartY && !slalom.onWater) {
        slalom.onWater = true;
        slalom.finished = true;
        slalom.finishTime = slalom.elapsed + slalom.penalties;

        // Water entry celebration
        addCelebration('FINISH!', COLORS.cyan);

        // Big splash particles
        const screenPos = worldToScreen(player.x, player.y);
        for (let i = 0; i < 20; i++) {
            const angle = (Math.random() * Math.PI * 2);
            const speed = 40 + Math.random() * 80;
            ParticlePool.spawn(
                screenPos.x + (Math.random() - 0.5) * 30,
                screenPos.y,
                Math.cos(angle) * speed,
                Math.sin(angle) * speed - 40,
                2 + Math.random() * 4,
                Math.random() < 0.5 ? 'rgba(100, 200, 255, 0.8)' : 'rgba(255, 255, 255, 0.9)',
                0.6 + Math.random() * 0.4,
                'spray'
            );
        }

        gameState.screenShake = { x: 0, y: 0, intensity: 8, decay: 0.92 };
    }

    // Check if passed finish line (trigger visual)
    if (player.y >= slalom.finishLineY && !slalom.finished) {
        // Keep going to water
    }

    updateParticles(dt);
    updateCelebrations(dt);
    updateScreenShake(dt);
}

function updateSlalomGates() {
    const player = gameState.player;
    const slalom = gameState.slalom;

    for (let i = slalom.nextGateIndex; i < slalom.gates.length; i++) {
        const gate = slalom.gates[i];
        if (gate.checked) continue;

        // Player has passed this gate's Y position
        if (player.y > gate.y + 30) {
            gate.checked = true;
            slalom.nextGateIndex = i + 1;

            // Check if player passed on correct side
            let passed = false;
            if (gate.side === 'left') {
                // Left gate: player should pass between the poles (through the gate opening)
                passed = player.x > gate.poleLeftX && player.x < gate.poleRightX;
            } else {
                // Right gate: player should pass between the poles
                passed = player.x > gate.poleLeftX && player.x < gate.poleRightX;
            }

            if (passed) {
                gate.passed = true;
                slalom.gatesPassed++;
                addCelebration('GATE ' + slalom.gatesPassed + '/' + slalom.totalGates, '#00ff88', '');
                gameState.screenShake = { x: 0, y: 0, intensity: 2, decay: 0.9 };
            } else {
                gate.missed = true;
                slalom.gatesMissed++;
                slalom.penalties += SLALOM.missedGatePenalty;
                addCelebration('+' + SLALOM.missedGatePenalty.toFixed(1) + 's', COLORS.warning, 'GATE MISSED');
                gameState.screenShake = { x: 0, y: 0, intensity: 5, decay: 0.9 };
            }
        } else {
            break; // Gates are sorted by Y, so stop checking once we find one ahead
        }
    }
}

function checkSlalomCollisions() {
    const player = gameState.player;
    if (player.crashed || player.stunned > 0 || player.invincible > 0) return;

    const pw = 20, ph = 20;

    // Check gate poles
    for (const pole of gameState.slalom.gatePoles) {
        if (Math.abs(pole.y - player.y) > 50) continue;
        if (Math.abs(pole.x - player.x) > 40) continue;

        if (player.x - pw/2 < pole.x + pole.width/2 &&
            player.x + pw/2 > pole.x - pole.width/2 &&
            player.y - ph/2 < pole.y + pole.height/2 &&
            player.y + ph/2 > pole.y - pole.height/2) {
            triggerCrash(player);
            gameState.slalom.penalties += SLALOM.poleCrashPenalty;
            addCelebration('+' + SLALOM.poleCrashPenalty.toFixed(1) + 's', COLORS.danger, 'POLE HIT');
            return;
        }
    }

    // Check rocks
    for (const obs of gameState.obstacles) {
        if (Math.abs(obs.y - player.y) > 60) continue;
        if (Math.abs(obs.x - player.x) > 40) continue;

        if (player.x - pw/2 < obs.x + obs.width/2 &&
            player.x + pw/2 > obs.x - obs.width/2 &&
            player.y - ph/2 < obs.y + obs.height/2 &&
            player.y + ph/2 > obs.y - obs.height/2) {
            triggerCrash(player);
            return;
        }
    }
}

// ============================================================================
// SLALOM DRAWING
// ============================================================================

function drawSlalom() {
    drawBackground();
    drawTerrain();

    // Draw finish zone if in view
    drawSlalomFinishZone();

    // Draw gate poles and flags
    drawSlalomGates();

    // Draw obstacles (rocks)
    drawObstacles();

    // Draw player
    drawPlayer();

    // Draw particles
    drawParticles();

    // Draw celebrations
    drawCelebrations();

    // Draw speed lines
    if (gameState.player.speed > 400) {
        drawSpeedLines();
    }

    // Draw HUD
    drawSlalomHUD();
}

function drawSlalomGates() {
    const camera = gameState.camera;
    const slalom = gameState.slalom;
    const time = gameState.animationTime;

    for (let i = 0; i < slalom.gates.length; i++) {
        const gate = slalom.gates[i];

        // Skip if off screen
        if (gate.y < camera.y - 80 || gate.y > camera.y + CANVAS_HEIGHT + 80) continue;

        const leftScreen = worldToScreen(gate.poleLeftX, gate.y);
        const rightScreen = worldToScreen(gate.poleRightX, gate.y);

        // Gate colors
        const isRed = gate.side === 'left';
        const poleColor = gate.checked ? (gate.passed ? 'rgba(0, 255, 136, 0.4)' : 'rgba(255, 80, 80, 0.4)') :
                          (isRed ? '#e53935' : '#1e88e5');
        const flagColor = gate.checked ? (gate.passed ? 'rgba(0, 255, 136, 0.3)' : 'rgba(255, 80, 80, 0.3)') :
                          (isRed ? '#ff6659' : '#64b5f6');

        const alpha = gate.checked ? 0.5 : 1.0;
        ctx.globalAlpha = alpha;

        // Draw connecting line between poles
        ctx.strokeStyle = gate.checked ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.3)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(leftScreen.x, leftScreen.y);
        ctx.lineTo(rightScreen.x, rightScreen.y);
        ctx.stroke();
        ctx.setLineDash([]);

        // Draw left pole
        drawSlalomPole(leftScreen.x, leftScreen.y, poleColor, flagColor, isRed, time);

        // Draw right pole
        drawSlalomPole(rightScreen.x, rightScreen.y, poleColor, flagColor, isRed, time);

        // Draw gate number
        if (!gate.checked) {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
            ctx.font = '8px "Press Start 2P", monospace';
            ctx.textAlign = 'center';
            ctx.fillText((i + 1).toString(), (leftScreen.x + rightScreen.x) / 2, leftScreen.y - 30);
        }

        // Draw pass/miss indicator
        if (gate.checked) {
            const centerX = (leftScreen.x + rightScreen.x) / 2;
            ctx.font = '14px "Press Start 2P", monospace';
            ctx.textAlign = 'center';
            if (gate.passed) {
                ctx.fillStyle = 'rgba(0, 255, 136, 0.6)';
                ctx.fillText('✓', centerX, leftScreen.y - 5);
            } else {
                ctx.fillStyle = 'rgba(255, 80, 80, 0.6)';
                ctx.fillText('✗', centerX, leftScreen.y - 5);
            }
        }

        ctx.globalAlpha = 1.0;
    }

    // Draw next gate direction indicator
    drawNextGateIndicator();
}

function drawSlalomPole(x, y, poleColor, flagColor, isRed, time) {
    // Pole shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.beginPath();
    ctx.ellipse(x + 4, y + 5, 6, 3, 0, 0, Math.PI * 2);
    ctx.fill();

    // Pole shaft
    ctx.fillStyle = poleColor;
    ctx.fillRect(x - 2, y - SLALOM.poleHeight, 4, SLALOM.poleHeight);

    // Flag at top (triangular, waving)
    const wave = Math.sin(time * 4 + x * 0.1) * 3;
    ctx.fillStyle = flagColor;
    ctx.beginPath();
    ctx.moveTo(x + 2, y - SLALOM.poleHeight);
    ctx.lineTo(x + 18 + wave, y - SLALOM.poleHeight + 6);
    ctx.lineTo(x + 2, y - SLALOM.poleHeight + 12);
    ctx.closePath();
    ctx.fill();

    // Flag border
    ctx.strokeStyle = poleColor;
    ctx.lineWidth = 1;
    ctx.stroke();
}

function drawNextGateIndicator() {
    const slalom = gameState.slalom;
    if (slalom.nextGateIndex >= slalom.gates.length || slalom.finished) return;

    const nextGate = slalom.gates[slalom.nextGateIndex];
    const player = gameState.player;
    const time = gameState.animationTime;

    // Arrow at top of screen pointing toward next gate
    const gateScreenPos = worldToScreen(nextGate.gateX, nextGate.y);
    const arrowX = Math.max(30, Math.min(CANVAS_WIDTH - 30, gateScreenPos.x));

    // Only show arrow if gate is off-screen ahead
    if (gateScreenPos.y < -20) {
        const pulse = 0.7 + Math.sin(time * 6) * 0.3;
        const isRed = nextGate.side === 'left';
        ctx.fillStyle = isRed ? `rgba(229, 57, 53, ${pulse})` : `rgba(30, 136, 229, ${pulse})`;

        // Down-pointing arrow
        ctx.beginPath();
        ctx.moveTo(arrowX, 20);
        ctx.lineTo(arrowX - 10, 8);
        ctx.lineTo(arrowX + 10, 8);
        ctx.closePath();
        ctx.fill();

        // Gate number
        ctx.fillStyle = `rgba(255, 255, 255, ${pulse})`;
        ctx.font = '7px "Press Start 2P", monospace';
        ctx.textAlign = 'center';
        ctx.fillText('G' + (slalom.nextGateIndex + 1), arrowX, 5);
    }
}

function drawSlalomFinishZone() {
    const camera = gameState.camera;
    const slalom = gameState.slalom;

    // Finish line
    const finishScreen = worldToScreen(0, slalom.finishLineY);
    if (finishScreen.y > -20 && finishScreen.y < CANVAS_HEIGHT + 20) {
        const halfSlope = TERRAIN.slopeWidth / 2;
        const leftX = CANVAS_WIDTH / 2 - halfSlope;
        const rightX = CANVAS_WIDTH / 2 + halfSlope;

        // Checkered finish line
        const checkerSize = 10;
        const numChecks = Math.ceil((rightX - leftX) / checkerSize);
        for (let c = 0; c < numChecks; c++) {
            ctx.fillStyle = c % 2 === 0 ? '#fff' : '#222';
            ctx.fillRect(leftX + c * checkerSize, finishScreen.y - 3, checkerSize, 6);
        }

        // "FINISH" text
        ctx.fillStyle = '#fff';
        ctx.font = '10px "Press Start 2P", monospace';
        ctx.textAlign = 'center';
        ctx.shadowColor = 'rgba(0, 255, 255, 0.8)';
        ctx.shadowBlur = getShadowBlur(8);
        ctx.fillText('FINISH', CANVAS_WIDTH / 2, finishScreen.y - 12);
        ctx.shadowBlur = 0;
    }

    // Water zone
    const waterScreenY = worldToScreen(0, slalom.waterStartY).y;
    const waterEndScreenY = worldToScreen(0, slalom.waterStartY + SLALOM.waterZoneLength).y;

    if (waterEndScreenY > 0 && waterScreenY < CANVAS_HEIGHT) {
        const drawStartY = Math.max(0, waterScreenY);
        const drawEndY = Math.min(CANVAS_HEIGHT, waterEndScreenY);
        const time = gameState.animationTime;

        // Water gradient
        const waterGrad = ctx.createLinearGradient(0, drawStartY, 0, drawEndY);
        waterGrad.addColorStop(0, 'rgba(20, 120, 200, 0.7)');
        waterGrad.addColorStop(0.3, 'rgba(15, 90, 180, 0.8)');
        waterGrad.addColorStop(1, 'rgba(10, 60, 140, 0.9)');
        ctx.fillStyle = waterGrad;
        ctx.fillRect(0, drawStartY, CANVAS_WIDTH, drawEndY - drawStartY);

        // Animated wave lines
        ctx.strokeStyle = 'rgba(100, 200, 255, 0.3)';
        ctx.lineWidth = 1;
        for (let wy = drawStartY; wy < drawEndY; wy += 20) {
            ctx.beginPath();
            for (let wx = 0; wx < CANVAS_WIDTH; wx += 5) {
                const waveY = wy + Math.sin(wx * 0.03 + time * 2 + wy * 0.01) * 3;
                if (wx === 0) ctx.moveTo(wx, waveY);
                else ctx.lineTo(wx, waveY);
            }
            ctx.stroke();
        }

        // Water shoreline
        ctx.strokeStyle = 'rgba(200, 230, 255, 0.5)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let wx = 0; wx < CANVAS_WIDTH; wx += 4) {
            const shoreY = waterScreenY + Math.sin(wx * 0.05 + time * 3) * 4;
            if (wx === 0) ctx.moveTo(wx, shoreY);
            else ctx.lineTo(wx, shoreY);
        }
        ctx.stroke();
    }

    // Crowd/lodge zone
    const crowdStartY = slalom.waterStartY + SLALOM.waterZoneLength;
    const crowdScreenY = worldToScreen(0, crowdStartY).y;
    const crowdEndScreenY = worldToScreen(0, crowdStartY + SLALOM.crowdZoneLength).y;

    if (crowdEndScreenY > 0 && crowdScreenY < CANVAS_HEIGHT) {
        const drawStartY = Math.max(0, crowdScreenY);
        const drawEndY = Math.min(CANVAS_HEIGHT, crowdEndScreenY);
        const time = gameState.animationTime;

        // Lodge deck background
        ctx.fillStyle = '#5d4037';
        ctx.fillRect(0, drawStartY, CANVAS_WIDTH, drawEndY - drawStartY);

        // Deck planks
        ctx.strokeStyle = '#4e342e';
        ctx.lineWidth = 1;
        for (let py = drawStartY; py < drawEndY; py += 12) {
            ctx.beginPath();
            ctx.moveTo(0, py);
            ctx.lineTo(CANVAS_WIDTH, py);
            ctx.stroke();
        }

        // Railing
        ctx.fillStyle = '#795548';
        ctx.fillRect(0, drawStartY, CANVAS_WIDTH, 6);
        // Railing posts
        for (let px = 20; px < CANVAS_WIDTH; px += 50) {
            ctx.fillRect(px, drawStartY - 20, 6, 26);
        }

        // Crowd - small pixel figures
        const crowdCount = Math.floor(CANVAS_WIDTH / 40);
        const cheering = slalom.finished;
        for (let c = 0; c < crowdCount; c++) {
            const cx = 20 + c * 40 + Math.sin(c * 2.7) * 10;
            const bobY = cheering ? Math.sin(time * 8 + c * 1.5) * 6 : 0;
            const armY = cheering ? Math.sin(time * 6 + c * 2) * 8 : 0;
            const baseY = drawStartY + 20;

            // Body
            const bodyColors = ['#e53935', '#1e88e5', '#43a047', '#fb8c00', '#8e24aa', '#00acc1'];
            ctx.fillStyle = bodyColors[c % bodyColors.length];
            ctx.fillRect(cx - 4, baseY - bobY - 12, 8, 12);

            // Head
            ctx.fillStyle = '#d4a574';
            ctx.fillRect(cx - 3, baseY - bobY - 18, 6, 6);

            // Arms (raised when cheering)
            if (cheering) {
                ctx.fillRect(cx - 8, baseY - bobY - 16 - armY, 4, 2);
                ctx.fillRect(cx + 4, baseY - bobY - 16 - armY, 4, 2);
            }
        }

        // Confetti when finished
        if (cheering && slalom.finishAnimation > 0.5) {
            if (Math.random() < 0.3) {
                const confettiColors = ['#ff0', '#f0f', '#0ff', '#f00', '#0f0', '#00f'];
                ParticlePool.spawn(
                    Math.random() * CANVAS_WIDTH,
                    crowdScreenY - 20,
                    (Math.random() - 0.5) * 40,
                    20 + Math.random() * 30,
                    2 + Math.random() * 3,
                    confettiColors[Math.floor(Math.random() * confettiColors.length)],
                    1.5 + Math.random(),
                    'confetti'
                );
            }
        }
    }
}

function drawSlalomHUD() {
    const slalom = gameState.slalom;
    const time = slalom.finished ? slalom.finishTime : slalom.elapsed + slalom.penalties;

    // Stopwatch - top center
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    const tenths = Math.floor((time * 10) % 10);
    const timeStr = minutes + ':' + seconds.toString().padStart(2, '0') + '.' + tenths;

    ctx.textAlign = 'center';
    ctx.font = '16px "Press Start 2P", monospace';
    ctx.fillStyle = '#fff';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
    ctx.shadowBlur = getShadowBlur(4);
    ctx.fillText(timeStr, CANVAS_WIDTH / 2, 28);

    // Penalty display below stopwatch
    if (slalom.penalties > 0) {
        ctx.font = '9px "Press Start 2P", monospace';
        ctx.fillStyle = COLORS.warning;
        ctx.fillText('(+' + slalom.penalties.toFixed(1) + 's)', CANVAS_WIDTH / 2, 44);
    }

    // Gate counter - top right
    ctx.textAlign = 'right';
    ctx.font = '10px "Press Start 2P", monospace';
    ctx.fillStyle = COLORS.cyan;
    ctx.fillText('GATES', CANVAS_WIDTH - 15, 16);
    ctx.fillStyle = '#fff';
    ctx.font = '12px "Press Start 2P", monospace';
    ctx.fillText(slalom.gatesPassed + '/' + slalom.totalGates, CANVAS_WIDTH - 15, 32);

    // Speed indicator - top left
    ctx.textAlign = 'left';
    ctx.font = '8px "Press Start 2P", monospace';
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillText('SPEED', 15, 16);
    const speedRatio = Math.min(1, gameState.player.speed / PHYSICS.maxSpeed);
    const barWidth = 60;
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.fillRect(15, 20, barWidth, 6);
    ctx.fillStyle = speedRatio > 0.7 ? COLORS.cyan : '#fff';
    ctx.fillRect(15, 20, barWidth * speedRatio, 6);

    ctx.shadowBlur = 0;
    ctx.textAlign = 'left';
}

// ============================================================================
// SLALOM RESULTS
// ============================================================================

function formatSlalomTime(t) {
    const minutes = Math.floor(t / 60);
    const seconds = Math.floor(t % 60);
    const tenths = Math.floor((t * 10) % 10);
    return minutes + ':' + seconds.toString().padStart(2, '0') + '.' + tenths;
}

function showSlalomResults() {
    const slalom = gameState.slalom;
    gameState.screen = 'slalomResults';

    document.getElementById('slalomTime').textContent = formatSlalomTime(slalom.elapsed);
    document.getElementById('slalomGates').textContent = slalom.gatesPassed + '/' + slalom.totalGates;
    document.getElementById('slalomPenalties').textContent = '+' + slalom.penalties.toFixed(1) + 's';
    document.getElementById('slalomFinal').textContent = formatSlalomTime(slalom.finishTime);

    // Check for new best
    const isNewBest = slalom.bestTime === null || slalom.finishTime < slalom.bestTime;
    if (isNewBest) {
        slalom.bestTime = slalom.finishTime;
        saveSlalomBestTime(slalom.finishTime);
    }

    document.getElementById('slalomBest').textContent = slalom.bestTime !== null ? formatSlalomTime(slalom.bestTime) : '--:--.-';
    document.getElementById('slalomNewBest').style.display = isNewBest ? 'block' : 'none';
    document.getElementById('slalomResults').style.display = 'flex';
}

function slalomBackToMenu() {
    document.getElementById('slalomResults').style.display = 'none';
    gameState.screen = 'title';
    gameState.mode = 'og';
    showStartScreen();
    musicManager.stop();
    selectedMode = 'slalom'; // Keep slalom selected for quick replay
    selectMode('slalom');
}

function loadSlalomBestTime() {
    try {
        const val = localStorage.getItem('shredordead_slalom_best');
        return val !== null ? parseFloat(val) : null;
    } catch (e) {
        return null;
    }
}

function saveSlalomBestTime(time) {
    try {
        localStorage.setItem('shredordead_slalom_best', time.toString());
    } catch (e) {}
}

function init() {
    canvas = document.getElementById('gameCanvas');
    // PERFORMANCE: Canvas optimization hints
    ctx = canvas.getContext('2d', {
        alpha: false,          // No transparency needed - solid background
        desynchronized: true   // Reduce latency, allow GPU to work independently
    });
    ctx.imageSmoothingEnabled = false; // Pixel art doesn't need anti-aliasing

    // Detect iOS/mobile and enable fullscreen-like mode automatically
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) ||
                     (navigator.maxTouchPoints > 0 && window.innerWidth < 1024);
    if (isMobile) {
        displaySettings.fullscreen = true;
        document.body.classList.add('fullscreen-mode');
    }

    // Initialize resolution system
    loadSettings();
    setResolution(displaySettings.currentResolution);
    fitCanvasToViewport();

    // Make sure start screen fills viewport on initial load
    resizeStartScreenCanvases();

    setupInput();
    setupTouchInput();
    loadHighScore();
    loadStance();
    musicManager.init();
    updateSettingsUI();

    // Load sprites asynchronously (game works without them)
    loadSprites().then(() => {
        console.log('Sprite system ready');
    }).catch(err => {
        console.warn('Sprites failed to load, using procedural rendering:', err);
    });

    // Load HUD panel overlay (falls back to text HUD)
    loadHUDPanel();

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

    // Music toggle
    const musicToggle = document.getElementById('musicToggle');
    if (musicToggle) musicToggle.checked = musicManager.enabled;

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
    if (hudPanel.loaded) compositeHUDPanel();

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
            if (hudPanel.loaded) compositeHUDPanel();

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
        const savedMusic = localStorage.getItem('shredordead_music');
        if (savedMusic !== null) {
            musicManager.enabled = savedMusic !== 'false';
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

function toggleMusic(enabled) {
    musicManager.enabled = enabled;
    if (!enabled) musicManager.stop();
    try {
        localStorage.setItem('shredordead_music', enabled.toString());
    } catch (e) {}
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
        localStorage.removeItem('shredordead_music');
    } catch (e) {}
    musicManager.enabled = true;
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
