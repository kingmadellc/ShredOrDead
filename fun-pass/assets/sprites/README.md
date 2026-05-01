# ShredOrDead Sprite Sheets

## Overview

This directory contains sprite sheets for the snowboarder player character and the yeti/beast enemy. Both sheets are provided in SVG format for scalability and can be exported to PNG for production use.

## Sprite Sheet Specifications

### Snowboarder (`snowboarder-spritesheet.svg`)
- **Dimensions:** 384 × 256 pixels
- **Frame Size:** 64 × 64 pixels
- **Grid:** 6 columns × 4 rows = 24 frames
- **Color Palette:** Neon cyan/magenta matching game aesthetic

#### Animation Layout

| Row | Frames | Animation | Description |
|-----|--------|-----------|-------------|
| 0 | 0-5 | Idle/Carve Left | Neutral → extreme left lean with snow spray |
| 1 | 0-4 | Carve Right | Slight → extreme right lean with snow spray |
| 1 | 5 | Tuck | Speed crouch position |
| 2 | 0-5 | Airborne | Launch, arm wave cycle, 180 spin, board grab, landing |
| 3 | 0-4 | Crash | Tumble sequence through face plant |
| 3 | 5 | Dazed | Recovery with stars |

#### Frame Details

**Row 0 - Carve Left:**
- Frame 0: Neutral idle stance
- Frame 1: 5° left lean
- Frame 2: 12° left lean
- Frame 3: 20° left lean
- Frame 4: 28° left lean
- Frame 5: 35° left lean with snow particles

**Row 1 - Carve Right:**
- Frame 0: 5° right lean
- Frame 1: 12° right lean
- Frame 2: 20° right lean
- Frame 3: 28° right lean
- Frame 4: 35° right lean with snow particles
- Frame 5: Tucked speed position

**Row 2 - Airborne:**
- Frame 0: Jump launch (arms up)
- Frame 1: Air wave 1 (left arm up)
- Frame 2: Air wave 2 (right arm up)
- Frame 3: 180° spin (side view)
- Frame 4: Board grab (indy style)
- Frame 5: Landing prep (arms out)

**Row 3 - Crash:**
- Frame 0: Initial tumble (15°)
- Frame 1: Mid tumble (45°)
- Frame 2: Upside down (90°)
- Frame 3: Coming down (135°)
- Frame 4: Face plant (board detached)
- Frame 5: Dazed sitting with stars

---

### Yeti/Beast (`yeti-spritesheet-fur-v2.svg`)
- **Dimensions:** 768 × 512 pixels
- **Frame Size:** 128 × 128 pixels
- **Grid:** 6 columns × 4 rows = 24 frames
- **Color Palette:** Pale snow fur, icy cyan shadows, dark face mask, cyan glowing eyes

#### Animation Layout

| Row | Frames | Animation | Description |
|-----|--------|-----------|-------------|
| 0 | 0-5 | Emerge | Snow mound → head reveal → full roar |
| 1 | 0-5 | Chase | Bounding run cycle with arm swing and snow kick |
| 2 | 0-5 | Telegraph/Lunge | Coil → warning roar → lunge → swipe → recovery |
| 3 | 0-5 | Rage Levels | Low → Medium → High → Max/Berserk loop |

#### Frame Details

**Row 0 - Emerge:**
- Frame 0: Snow mound with eye hint
- Frames 1-4: Rising through snow with more body revealed
- Frame 5: Full roar reveal

**Row 1 - Chase Movement:**
- Frames 0-5: Continuous bounding run with alternating arms, legs, and snow puffs

**Row 2 - Telegraph/Lunge Sequence:**
- Frame 0: Low crouch warning
- Frame 1: Coiled roar
- Frame 2: Lunge start
- Frame 3: Full forward grab
- Frame 4: Claw swipe
- Frame 5: Recovery crouch

**Row 3 - Rage States:**
- Frame 0: Low rage
- Frame 1: Medium rage
- Frame 2: High rage
- Frames 3-5: Max rage/Berserk loop

---

## Converting to PNG

### Using Inkscape (CLI)
```bash
inkscape snowboarder-spritesheet.svg --export-filename=snowboarder-spritesheet.png
inkscape yeti-spritesheet-fur-v2.svg --export-filename=yeti-spritesheet.png
```

### Using ImageMagick
```bash
convert -background transparent snowboarder-spritesheet.svg snowboarder-spritesheet.png
convert -background transparent yeti-spritesheet-fur-v2.svg yeti-spritesheet.png
```

### For Higher Resolution (2x)
```bash
inkscape snowboarder-spritesheet.svg -w 768 -h 512 --export-filename=snowboarder-spritesheet@2x.png
inkscape yeti-spritesheet-fur-v2.svg -w 1536 -h 1024 --export-filename=yeti-spritesheet@2x.png
```

---

## Integration

See `sprite-system.js` for the complete implementation including:
- `SpriteSheet` class for loading and frame extraction
- `AnimatedSprite` class for animation playback
- `SpriteManager` for global sprite management
- Integration guide for replacing procedural drawing in game.js

### Quick Start

```javascript
// Load sprites
await spriteManager.loadAll();

// Create sprite instances
const playerSprite = spriteManager.createSprite('snowboarder');
const beastSprite = spriteManager.createSprite('yeti');

// Set animation based on game state
playerSprite.setAnimation('carveLeft');
beastSprite.setAnimation('chase');

// Update each frame
playerSprite.update(deltaTime);
beastSprite.update(deltaTime);

// Draw
playerSprite.draw(ctx, x, y);
beastSprite.draw(ctx, x, y);
```

---

## Visual Style Notes

Both sprite sheets maintain the game's neon aesthetic:
- **Glow effects:** SVG filters create soft glows around key elements
- **Gradient fills:** Body parts use linear/radial gradients
- **Color scheme:** Cyan (#00ffff), Magenta (#ff00ff), Hot Pink (#ff1493)
- **Snow beast tones:** Pale whites and icy blues for fur, dark teal outlines for readable silhouettes
