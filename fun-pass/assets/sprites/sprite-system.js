/**
 * ShredOrDead Sprite System
 * Handles loading and rendering sprite sheets for the snowboarder and yeti characters
 */

// Sprite sheet configurations
const SPRITE_CONFIG = {
    snowboarder: {
        src: 'assets/sprites/snowboarder-spritesheet.svg',
        frameWidth: 64,
        frameHeight: 64,
        columns: 6,
        rows: 4,
        animations: {
            idle: { row: 0, frames: [0], frameTime: 100 },
            carveLeft: { row: 0, frames: [1, 2, 3, 4, 5], frameTime: 80 },
            carveRight: { row: 1, frames: [0, 1, 2, 3, 4], frameTime: 80 },
            tuck: { row: 1, frames: [5], frameTime: 100 },
            airborne: { row: 2, frames: [0, 1, 2, 3, 4, 5], frameTime: 120 },
            spin180: { row: 2, frames: [3], frameTime: 100 },
            grab: { row: 2, frames: [4], frameTime: 100 },
            crash: { row: 3, frames: [0, 1, 2, 3, 4], frameTime: 100 },
            dazed: { row: 3, frames: [5], frameTime: 150 }
        }
    },
    yeti: {
        src: 'assets/sprites/yeti-spritesheet.svg',
        frameWidth: 128,
        frameHeight: 128,
        columns: 4,
        rows: 3,
        animations: {
            chase: { row: 0, frames: [0, 1, 2, 3], frameTime: 150 },
            lunge: { row: 1, frames: [0, 1, 2, 3], frameTime: 100 },
            rageLow: { row: 2, frames: [0], frameTime: 100 },
            rageMedium: { row: 2, frames: [1], frameTime: 100 },
            rageHigh: { row: 2, frames: [2], frameTime: 100 },
            rageMax: { row: 2, frames: [3], frameTime: 80 }
        }
    }
};

/**
 * SpriteSheet class - handles loading and frame extraction
 */
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
            this.image.onerror = reject;
            this.image.src = this.config.src;
        });
    }

    getFrame(frameIndex) {
        const col = frameIndex % this.config.columns;
        const row = Math.floor(frameIndex / this.config.columns);
        return {
            x: col * this.config.frameWidth,
            y: row * this.config.frameHeight,
            width: this.config.frameWidth,
            height: this.config.frameHeight
        };
    }

    getAnimationFrame(animationName, frameIndex) {
        const anim = this.config.animations[animationName];
        if (!anim) return this.getFrame(0);

        const frameNum = anim.frames[frameIndex % anim.frames.length];
        const absoluteFrame = anim.row * this.config.columns + frameNum;
        return this.getFrame(absoluteFrame);
    }
}

/**
 * AnimatedSprite class - handles animation state and rendering
 */
class AnimatedSprite {
    constructor(spriteSheet) {
        this.spriteSheet = spriteSheet;
        this.currentAnimation = 'idle';
        this.currentFrame = 0;
        this.frameTimer = 0;
        this.scale = 1;
        this.rotation = 0;
        this.flipX = false;
    }

    setAnimation(animationName) {
        if (this.currentAnimation !== animationName) {
            this.currentAnimation = animationName;
            this.currentFrame = 0;
            this.frameTimer = 0;
        }
    }

    update(deltaTime) {
        const anim = this.spriteSheet.config.animations[this.currentAnimation];
        if (!anim || anim.frames.length <= 1) return;

        this.frameTimer += deltaTime;
        if (this.frameTimer >= anim.frameTime) {
            this.frameTimer = 0;
            this.currentFrame = (this.currentFrame + 1) % anim.frames.length;
        }
    }

    draw(ctx, x, y) {
        if (!this.spriteSheet.loaded) return;

        const frame = this.spriteSheet.getAnimationFrame(this.currentAnimation, this.currentFrame);

        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(this.rotation);
        ctx.scale(this.flipX ? -this.scale : this.scale, this.scale);

        ctx.drawImage(
            this.spriteSheet.image,
            frame.x, frame.y, frame.width, frame.height,
            -frame.width / 2, -frame.height / 2, frame.width, frame.height
        );

        ctx.restore();
    }
}

/**
 * SpriteManager - global manager for all game sprites
 */
class SpriteManager {
    constructor() {
        this.sheets = {};
        this.sprites = {};
    }

    async loadAll() {
        const loadPromises = [];

        for (const [name, config] of Object.entries(SPRITE_CONFIG)) {
            const sheet = new SpriteSheet(config);
            loadPromises.push(sheet.load().then(() => {
                this.sheets[name] = sheet;
            }));
        }

        await Promise.all(loadPromises);
        console.log('All sprite sheets loaded');
    }

    createSprite(sheetName) {
        const sheet = this.sheets[sheetName];
        if (!sheet) {
            console.warn(`Sprite sheet '${sheetName}' not found`);
            return null;
        }
        return new AnimatedSprite(sheet);
    }
}

// Export for use in game.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SpriteManager, AnimatedSprite, SpriteSheet, SPRITE_CONFIG };
}

// Global instance for browser use
const spriteManager = new SpriteManager();


/**
 * INTEGRATION GUIDE
 * =================
 *
 * To integrate sprites into ShredOrDead game.js:
 *
 * 1. Load sprites during game initialization:
 *
 *    async function initGame() {
 *        await spriteManager.loadAll();
 *        // ... rest of init
 *    }
 *
 * 2. Create sprite instances for player and beast:
 *
 *    const playerSprite = spriteManager.createSprite('snowboarder');
 *    const beastSprite = spriteManager.createSprite('yeti');
 *
 * 3. Update sprites each frame:
 *
 *    function updateSprites(deltaTime) {
 *        // Set animation based on player state
 *        if (player.crashed) {
 *            playerSprite.setAnimation('crash');
 *        } else if (player.airborne) {
 *            playerSprite.setAnimation('airborne');
 *        } else if (player.angle < -15) {
 *            playerSprite.setAnimation('carveLeft');
 *        } else if (player.angle > 15) {
 *            playerSprite.setAnimation('carveRight');
 *        } else if (player.speed > 400) {
 *            playerSprite.setAnimation('tuck');
 *        } else {
 *            playerSprite.setAnimation('idle');
 *        }
 *
 *        // Set yeti animation based on rage/state
 *        if (beast.lunging) {
 *            beastSprite.setAnimation('lunge');
 *        } else if (beastRage > 0.75) {
 *            beastSprite.setAnimation('rageMax');
 *        } else if (beastRage > 0.5) {
 *            beastSprite.setAnimation('rageHigh');
 *        } else if (beastRage > 0.25) {
 *            beastSprite.setAnimation('rageMedium');
 *        } else {
 *            beastSprite.setAnimation('chase');
 *        }
 *
 *        playerSprite.update(deltaTime);
 *        beastSprite.update(deltaTime);
 *    }
 *
 * 4. Draw sprites instead of procedural rendering:
 *
 *    function drawPlayer(ctx, x, y) {
 *        playerSprite.rotation = player.angle * Math.PI / 180 * 0.3;
 *        playerSprite.draw(ctx, x, y);
 *    }
 *
 *    function drawBeast(ctx, x, y) {
 *        beastSprite.scale = 1 + beastRage * 0.2;
 *        beastSprite.draw(ctx, x, y);
 *    }
 *
 * 5. Animation frame mappings:
 *
 *    SNOWBOARDER (64x64 frames):
 *    - Row 0: Idle + Left carve progression (0-35°)
 *    - Row 1: Right carve progression + Tuck
 *    - Row 2: Airborne animations (jump, wave arms, spin, grab, land)
 *    - Row 3: Crash sequence + Dazed recovery
 *
 *    YETI (128x128 frames):
 *    - Row 0: Chase/movement cycle
 *    - Row 1: Attack/lunge sequence
 *    - Row 2: Rage levels (low → max)
 */
