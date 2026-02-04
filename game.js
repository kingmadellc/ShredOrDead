// ============================================================================
// SHRED OR DEAD - A Retro Snowboarding Game
// Inspired by SkiFree with a late 80s/early 90s neon aesthetic
// ============================================================================

// ===================
// CONSTANTS
// ===================

const CANVAS_WIDTH = 480;
const CANVAS_HEIGHT = 640;

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
    gravity: 1400,
    groundFriction: 0.985,      // More drag for controlled feel
    airFriction: 0.995,
    turnSpeed: 500,             // Fast turning for responsive carving
    maxTurnAngle: 65,
    carveSpeedBoost: 1.08,      // Less speed boost from carving
    downhillAccel: 180,         // Much slower acceleration
    maxSpeed: 500,              // Much lower top speed
    minSpeed: 100,
    crashSpeedPenalty: 0.5,
    crashDuration: 0.8,
    stunDuration: 0.25,
    invincibilityDuration: 1.5,
    jumpLaunchPower: 400,       // Slightly lower jumps
    airControlFactor: 0.7
};

const TERRAIN = {
    chunkHeight: 600,
    laneCount: 7,
    laneWidth: 68,
    slopeWidth: 480,
    baseDensity: 0.08,          // Fewer obstacles
    maxDensity: 0.18,           // Less cluttered
    densityRampDistance: 4000,
    jumpChance: 0.20,           // Keep jumps plentiful
    railChance: 0.08,           // Was 0.14 - fewer rails
    clearPathWidth: 2
};

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
        trickRotation: 0
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

    for (let row = 0; row < gridRows; row++) {
        const rowSeed = baseSeed + row * 100;
        const clearLane = Math.floor(seededRandom(rowSeed) * gridCols);

        for (let col = 0; col < gridCols; col++) {
            if (Math.abs(col - clearLane) < TERRAIN.clearPathWidth) continue;

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
                chunk.rails.push({
                    x: (col - gridCols / 2 + 0.5) * TERRAIN.laneWidth,
                    y: chunk.y + row * 80,
                    endX: (clamp(endCol, 0, gridCols - 1) - gridCols / 2 + 0.5) * TERRAIN.laneWidth,
                    endY: chunk.y + row * 80 + railLength,
                    length: railLength
                });
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

    // Trick rotation
    if (inputDir !== 0) {
        player.trickRotation += inputDir * 400 * dt;
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
}

function landFromJump(player) {
    player.airborne = false;
    player.altitude = 0;
    player.verticalVelocity = 0;

    // Detect trick
    const absRot = Math.abs(player.trickRotation);
    let trickLanded = null;

    for (const [id, trick] of Object.entries(TRICKS)) {
        if (trick.minRot && absRot >= trick.minRot && absRot <= trick.maxRot) {
            trickLanded = trick;
            break;
        }
    }

    if (trickLanded) {
        const points = Math.floor(trickLanded.points * gameState.trickMultiplier);
        gameState.score += points;

        gameState.celebrations.push({
            text: trickLanded.name,
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
    // Gradient sky
    const gradient = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
    gradient.addColorStop(0, COLORS.bgDark);
    gradient.addColorStop(0.5, COLORS.bgMid);
    gradient.addColorStop(1, COLORS.bgLight);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

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

    ctx.save();
    ctx.translate(screen.x, drawY);

    // Apply rotation for tricks
    if (player.airborne) {
        ctx.rotate(player.trickRotation * Math.PI / 180);
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

    // Snowboard with gradient and edge highlights
    const boardGrad = ctx.createLinearGradient(-20, 8, 20, 14);
    boardGrad.addColorStop(0, COLORS.hotPink);
    boardGrad.addColorStop(0.5, '#ff69b4');
    boardGrad.addColorStop(1, COLORS.magenta);
    ctx.fillStyle = boardGrad;
    ctx.shadowColor = COLORS.hotPink;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.roundRect(-22, 8, 44, 6, 3);
    ctx.fill();

    // Board edge highlight
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-20, 9);
    ctx.lineTo(20, 9);
    ctx.stroke();

    // Bindings
    ctx.fillStyle = '#333';
    ctx.fillRect(-10, 7, 6, 8);
    ctx.fillRect(4, 7, 6, 8);
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

    // Arms (wave when airborne)
    const armAngle = player.airborne ? Math.sin(gameState.animationTime * 8) * 0.4 : 0;
    ctx.strokeStyle = jacketGrad;
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-10, -5);
    ctx.lineTo(-18, -12 + Math.sin(armAngle) * 8);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(10, -5);
    ctx.lineTo(18, -12 - Math.sin(armAngle) * 8);
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
        trickRotation: 0
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

    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;

    setupInput();
    loadHighScore();

    requestAnimationFrame(gameLoop);
}

// Start the game when the page loads
window.addEventListener('load', init);
