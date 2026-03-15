import {
  AllocatorCharacterArray,
  Character,
  CharacterAllocator,
  CharacterMeta,
} from "./character";
import {
  dino_layout,
  stone_layout,
  themes,
  cloud_layout,
  pit_layout,
  bird_layout,
  cactus_layout,
  retry_layout,
  star_layout,
} from "./layouts";
import {
  applyVelocityToPosition,
  isCollided,
  Position,
  Velocity,
} from "./physics";

const canvas = document.getElementById("board");
const canvas_ctx = canvas.getContext("2d");

const CELL_SIZE = 2;
const ROWS = 300;
let COLUMNS = 1000;
const FLOOR_VELOCITY = new Velocity(0, -7.8); // 1.2x faster than original -7
// Global minimum gap between cactus obstacles (higher value = fewer obstacles)
let CACTUS_MIN_GAP = 40; // softened difficulty: more room to react
const SAFE_LAND_GAP_COLUMNS = 140; // larger safe horizontal gap after landing for cheat
// ~30% more obstacles for default hard mode; hard mode uses HARD_MODE_OBSTACLE_FACTOR for even more.
const OBSTACLE_INCREASE_FACTOR = 1.3;
const HARD_MODE_OBSTACLE_FACTOR = 2.5; // crazily hard: way more obstacles for non-Matthew
const MIN_PLAYABLE_CACTUS_GAP = 50; // minimum ticks between cacti so player can react

// Returns gap params for obstacle spawn: matthew = easy (fewer obstacles), others = hard (more obstacles).
function getObstacleGapsForCharacter(character) {
  const isEasy = character === "matthew";
  const factor = isEasy ? 1 : 1 / HARD_MODE_OBSTACLE_FACTOR;
  return {
    cactusMin: Math.max(
      MIN_PLAYABLE_CACTUS_GAP,
      Math.round((CACTUS_MIN_GAP + 40) * factor),
    ),
    cactusMax: Math.round(200 * factor),
    birdMin: Math.round(650 * factor),
    birdMax: Math.round(90 * factor),
  };
}

if (screen.width < COLUMNS) {
  COLUMNS = screen.width;
  FLOOR_VELOCITY.add(new Velocity(0, 2));
  CACTUS_MIN_GAP = 70; // still softened on small screens
}
const DINO_INITIAL_TRUST = new Velocity(-10, 0);
const ENVIRONMENT_GRAVITY = new Velocity(-0.8, 0);
const DINO_FLOOR_INITIAL_POSITION = new Position(200, 10);
let dino_current_trust = new Velocity(0, 0);
let dino_ready_to_jump = true;
let jumpKeyHeld = false;
let jumpHoldFrames = 0;
const MAX_JUMP_HOLD_FRAMES = 15;
const EXTRA_JUMP_ACCEL = new Velocity(-0.4, 0);
let game_over = null;
let is_first_time = true;
let game_score = null;
let game_score_step = 0;
let game_hi_score = null;
// Horizontal speed-up step applied after score passes 1000.
let step_velocity = new Velocity(0, -0.1);
let cumulative_velocity = null;
let current_theme = null;
let matthewCheatManualOverride = false;
let matthewAutoJumping = false;
let matthewDesiredHoldFrames = 0;

// Character image support (served from Netlify's publish directory: www/character/)
const CHARACTER_SOURCES = {
  andison: "character/andison.png",
  ck: "character/ck.png",
  matthew: "character/matthew.png",
  tom: "character/Tom.png",
  eden: "character/eden.png",
  justin: "character/justin.png",
  junia: "character/junia.png",
  aien: "character/aien.png",
  ak: "character/ak.png",
  mui: "character/mui.png",
  avlynn: "character/avlynn.png",
};

const andisonImg = new Image();
const ckImg = new Image();
const matthewImg = new Image();
const tomImg = new Image();
const edenImg = new Image();
const justinImg = new Image();
const juniaImg = new Image();
const aienImg = new Image();
const akImg = new Image();
const muiImg = new Image();
const avlynnImg = new Image();
let andisonReady = false;
let ckReady = false;
let matthewReady = false;
let tomReady = false;
let edenReady = false;
let justinReady = false;
let juniaReady = false;
let aienReady = false;
let akReady = false;
let muiReady = false;
let avlynnReady = false;

andisonImg.src = CHARACTER_SOURCES.andison;
andisonImg.onload = () => {
  andisonReady = true;
};

ckImg.src = CHARACTER_SOURCES.ck;
ckImg.onload = () => {
  ckReady = true;
};

matthewImg.src = CHARACTER_SOURCES.matthew;
matthewImg.onload = () => {
  matthewReady = true;
};

tomImg.src = CHARACTER_SOURCES.tom;
tomImg.onload = () => {
  tomReady = true;
};

edenImg.src = CHARACTER_SOURCES.eden;
edenImg.onload = () => {
  edenReady = true;
};

justinImg.src = CHARACTER_SOURCES.justin;
justinImg.onload = () => {
  justinReady = true;
};

juniaImg.src = CHARACTER_SOURCES.junia;
juniaImg.onload = () => {
  juniaReady = true;
};

aienImg.src = CHARACTER_SOURCES.aien;
aienImg.onload = () => {
  aienReady = true;
};

akImg.src = CHARACTER_SOURCES.ak;
akImg.onload = () => {
  akReady = true;
};

muiImg.src = CHARACTER_SOURCES.mui;
muiImg.onload = () => {
  muiReady = true;
};

avlynnImg.src = CHARACTER_SOURCES.avlynn;
avlynnImg.onload = () => {
  avlynnReady = true;
};

let selectedCharacter = "andison";

let harmless_characters_pool = null;
let harmfull_characters_pool = null;

let harmless_character_allocator = [
  new CharacterAllocator(
    new AllocatorCharacterArray()
      .add_character(
        new CharacterMeta(
          [stone_layout.large],
          0,
          new Position(240, COLUMNS),
          FLOOR_VELOCITY,
        ),
        0.9,
      )
      .add_character(
        new CharacterMeta(
          [stone_layout.medium],
          0,
          new Position(243, COLUMNS),
          FLOOR_VELOCITY,
        ),
        0.75,
      )
      .add_character(
        new CharacterMeta(
          [stone_layout.small],
          0,
          new Position(241, COLUMNS),
          FLOOR_VELOCITY,
        ),
        0.6,
      ),
    2,
    0,
  ),
  new CharacterAllocator(
    new AllocatorCharacterArray()
      .add_character(
        new CharacterMeta(
          [cloud_layout],
          0,
          new Position(100, COLUMNS),
          new Velocity(0, -1.2), // 1.2x faster than -1
        ),
        0.9,
      )
      .add_character(
        new CharacterMeta(
          [cloud_layout],
          0,
          new Position(135, COLUMNS),
          new Velocity(0, -1.2),
        ),
        0.85,
      )
      .add_character(
        new CharacterMeta(
          [cloud_layout],
          0,
          new Position(150, COLUMNS),
          new Velocity(0, -1.2),
        ),
        0.8,
      ),
    350,
    300,
  ),
  new CharacterAllocator(
    new AllocatorCharacterArray()
      .add_character(
        new CharacterMeta(
          [star_layout.small_s1],
          0,
          new Position(90, COLUMNS),
          new Velocity(0, -0.36), // 1.2x faster than -0.3
        ),
        0.9,
      )
      .add_character(
        new CharacterMeta(
          [star_layout.small_s2],
          0,
          new Position(125, COLUMNS),
          new Velocity(0, -0.36),
        ),
        0.85,
      )
      .add_character(
        new CharacterMeta(
          [star_layout.small_s1],
          0,
          new Position(140, COLUMNS),
          new Velocity(0, -0.36),
        ),
        0.8,
      ),
    350,
    250,
  ),
  new CharacterAllocator(
    new AllocatorCharacterArray()
      .add_character(
        new CharacterMeta(
          [pit_layout.large],
          0,
          new Position(223, COLUMNS),
          FLOOR_VELOCITY,
        ),
        0.97,
      )
      .add_character(
        new CharacterMeta(
          [pit_layout.up],
          0,
          new Position(227, COLUMNS),
          FLOOR_VELOCITY,
        ),
        0.9,
      )
      .add_character(
        new CharacterMeta(
          [pit_layout.down],
          0,
          new Position(230, COLUMNS),
          FLOOR_VELOCITY,
        ),
        0.85,
      ),
    150, // larger gap so pits appear less often
    80,
  ),
];

function buildHarmfullCharacterAllocator(character) {
  const gaps = getObstacleGapsForCharacter(character);
  return [
    new CharacterAllocator(
      new AllocatorCharacterArray()
        .add_character(
          new CharacterMeta(
            [cactus_layout.small_d1],
            0,
            new Position(201, COLUMNS),
            FLOOR_VELOCITY,
          ),
          0.72, // 10% fewer
        )
        .add_character(
          new CharacterMeta(
            [cactus_layout.small_s1],
            0,
            new Position(201, COLUMNS),
            FLOOR_VELOCITY,
          ),
          0.63, // 10% fewer
        )
        .add_character(
          new CharacterMeta(
            [cactus_layout.small_s2],
            0,
            new Position(201, COLUMNS),
            FLOOR_VELOCITY,
          ),
          0.54, // 10% fewer
        )
        .add_character(
          new CharacterMeta(
            [cactus_layout.medium_d1],
            0,
            new Position(193, COLUMNS),
            FLOOR_VELOCITY,
          ),
          0.45, // 10% fewer
        )
        .add_character(
          new CharacterMeta(
            [cactus_layout.medium_s1],
            0,
            new Position(193, COLUMNS),
            FLOOR_VELOCITY,
          ),
          0.36, // 10% fewer
        )
        .add_character(
          new CharacterMeta(
            [cactus_layout.medium_s2],
            0,
            new Position(193, COLUMNS),
            FLOOR_VELOCITY,
          ),
          0.27, // 10% fewer
        ),
      gaps.cactusMin,
      gaps.cactusMax,
    ),
    new CharacterAllocator(
      new AllocatorCharacterArray()
        .add_character(
          new CharacterMeta(
            bird_layout.fly,
            0,
            new Position(170, COLUMNS),
            FLOOR_VELOCITY.clone().add(new Velocity(0, -1)),
          ),
          0.88, // 10% fewer bird waves
        )
        .add_character(
          new CharacterMeta(
            bird_layout.fly,
            0,
            new Position(190, COLUMNS),
            FLOOR_VELOCITY.clone().add(new Velocity(0, -1)),
          ),
          0.81, // 10% fewer bird waves
        ),
      gaps.birdMin,
      gaps.birdMax,
    ),
  ];
}

let harmfull_character_allocator =
  buildHarmfullCharacterAllocator(selectedCharacter);

function handleJumpDown() {
  if (game_over && Date.now() - game_over > 1000) {
    main();
    return;
  }

  if (dino_ready_to_jump) {
    dino_ready_to_jump = false;
    dino_current_trust = DINO_INITIAL_TRUST.clone();
    jumpKeyHeld = true;
    jumpHoldFrames = 0;
  }
}

function handleJumpUp() {
  jumpKeyHeld = false;
}

function initialize() {
  current_theme = themes.classic;
  cumulative_velocity = new Velocity(0, 0);
  game_over = false;
  game_score = 0;
  game_hi_score =
    localStorage.getItem("project.github.chrome_dino.high_score") || 0;
  canvas.height = ROWS;
  canvas.width = COLUMNS;
  document.body.style.backgroundColor = current_theme.background;
  matthewCheatManualOverride = false;

  // Matthew = easy (fewer obstacles), other characters = hard (more obstacles)
  harmfull_character_allocator =
    buildHarmfullCharacterAllocator(selectedCharacter);

  harmless_characters_pool = [];
  harmfull_characters_pool = [
    new Character(
      new CharacterMeta(
        dino_layout.run,
        4,
        DINO_FLOOR_INITIAL_POSITION.clone(),
        new Velocity(0, 0),
      ),
    ),
  ];

  // Character selector buttons
  const andisonButton = document.getElementById("character-andison");
  const ckButton = document.getElementById("character-ck");
  const matthewButton = document.getElementById("character-matthew");
  const tomButton = document.getElementById("character-tom");
  const edenButton = document.getElementById("character-eden");
  const justinButton = document.getElementById("character-justin");
  const juniaButton = document.getElementById("character-junia");
  const aienButton = document.getElementById("character-aien");
  const akButton = document.getElementById("character-ak");
  const muiButton = document.getElementById("character-mui");
  const avlynnButton = document.getElementById("character-avlynn");

  const characterInfoImg = document.getElementById("character-current-image");

  const updateCharacterInfoImage = () => {
    if (characterInfoImg && CHARACTER_SOURCES[selectedCharacter]) {
      characterInfoImg.src = CHARACTER_SOURCES[selectedCharacter];
    }
  };

  const characterButtons = {
    andison: andisonButton,
    ck: ckButton,
    matthew: matthewButton,
    tom: tomButton,
    eden: edenButton,
    justin: justinButton,
    junia: juniaButton,
    aien: aienButton,
    ak: akButton,
    mui: muiButton,
    avlynn: avlynnButton,
  };

  if (
    andisonButton &&
    ckButton &&
    matthewButton &&
    tomButton &&
    edenButton &&
    justinButton &&
    juniaButton &&
    aienButton &&
    akButton &&
    muiButton &&
    avlynnButton
  ) {
    const setActiveCharacter = (characterKey) => {
      selectedCharacter = characterKey;
      Object.entries(characterButtons).forEach(([key, button]) => {
        if (!button) return;
        button.classList.toggle(
          "character-button--active",
          key === characterKey,
        );
      });
      updateCharacterInfoImage();
    };

    andisonButton.onclick = (event) => {
      event.stopPropagation();
      // Do not allow changing character while a run is in progress
      if (!game_over && !is_first_time) return;
      setActiveCharacter("andison");
    };

    ckButton.onclick = (event) => {
      event.stopPropagation();
      if (!game_over && !is_first_time) return;
      setActiveCharacter("ck");
    };

    matthewButton.onclick = (event) => {
      event.stopPropagation();
      if (!game_over && !is_first_time) return;
      setActiveCharacter("matthew");
    };

    tomButton.onclick = (event) => {
      event.stopPropagation();
      if (!game_over && !is_first_time) return;
      setActiveCharacter("tom");
    };

    edenButton.onclick = (event) => {
      event.stopPropagation();
      if (!game_over && !is_first_time) return;
      setActiveCharacter("eden");
    };

    justinButton.onclick = (event) => {
      event.stopPropagation();
      if (!game_over && !is_first_time) return;
      setActiveCharacter("justin");
    };

    juniaButton.onclick = (event) => {
      event.stopPropagation();
      if (!game_over && !is_first_time) return;
      setActiveCharacter("junia");
    };

    aienButton.onclick = (event) => {
      event.stopPropagation();
      if (!game_over && !is_first_time) return;
      setActiveCharacter("aien");
    };

    akButton.onclick = (event) => {
      event.stopPropagation();
      if (!game_over && !is_first_time) return;
      setActiveCharacter("ak");
    };

    muiButton.onclick = (event) => {
      event.stopPropagation();
      if (!game_over && !is_first_time) return;
      setActiveCharacter("mui");
    };

    avlynnButton.onclick = (event) => {
      event.stopPropagation();
      if (!game_over && !is_first_time) return;
      setActiveCharacter("avlynn");
    };

    setActiveCharacter(selectedCharacter);
  }

  // Ensure the info image is set even if buttons are missing
  updateCharacterInfoImage();

  document.ontouchstart = () => {
    handleJumpDown();
  };

  document.ontouchend = () => {
    handleJumpUp();
  };

  document.body.onclick = () => {
    if (game_over) {
      document.ontouchstart();
    }
  };

  document.body.onkeydown = (event) => {
    // Command + I => turn off Matthew cheat and re-enable keyboard control
    if (
      event.metaKey &&
      (event.key === "i" || event.key === "I" || event.keyCode === 73)
    ) {
      matthewCheatManualOverride = true;
      return;
    }

    // While Matthew cheat is running, ignore normal keyboard input
    if (
      selectedCharacter === "matthew" &&
      !is_first_time &&
      !game_over &&
      !matthewCheatManualOverride
    ) {
      return;
    }

    if (event.keyCode === 32 || event.key === " ") {
      handleJumpDown();
    }
  };

  document.body.onkeyup = (event) => {
    // Let Command+I keyup through but otherwise ignore when cheat owns controls
    if (
      selectedCharacter === "matthew" &&
      !is_first_time &&
      !game_over &&
      !matthewCheatManualOverride &&
      !(
        event.metaKey &&
        (event.key === "i" || event.key === "I" || event.keyCode === 73)
      )
    ) {
      return;
    }

    if (event.keyCode === 32 || event.key === " ") {
      handleJumpUp();
    }
  };
}

function paint_layout(character_layout, character_position) {
  for (let j = 0; j < character_layout.length; j++) {
    for (let k = 0; k < character_layout[j].length; k++) {
      if (current_theme.layout[character_layout[j][k]]) {
        canvas_ctx.fillStyle = current_theme.layout[character_layout[j][k]];
        let x_pos = character_position[1] + k * CELL_SIZE;
        let y_pos = character_position[0] + j * CELL_SIZE;

        canvas_ctx.fillRect(x_pos, y_pos, CELL_SIZE, CELL_SIZE);
      }
    }
  }
}

function draw_dino(layout, position) {
  const row = position[0];
  const col = position[1];

  let img = null;
  let ready = false;

  if (selectedCharacter === "andison") {
    img = andisonImg;
    ready = andisonReady;
  } else if (selectedCharacter === "ck") {
    img = ckImg;
    ready = ckReady;
  } else if (selectedCharacter === "matthew") {
    img = matthewImg;
    ready = matthewReady;
  } else if (selectedCharacter === "tom") {
    img = tomImg;
    ready = tomReady;
  } else if (selectedCharacter === "eden") {
    img = edenImg;
    ready = edenReady;
  } else if (selectedCharacter === "justin") {
    img = justinImg;
    ready = justinReady;
  } else if (selectedCharacter === "junia") {
    img = juniaImg;
    ready = juniaReady;
  } else if (selectedCharacter === "aien") {
    img = aienImg;
    ready = aienReady;
  } else if (selectedCharacter === "ak") {
    img = akImg;
    ready = akReady;
  } else if (selectedCharacter === "mui") {
    img = muiImg;
    ready = muiReady;
  } else if (selectedCharacter === "avlynn") {
    img = avlynnImg;
    ready = avlynnReady;
  }

  // Only draw the chosen character image; never fall back to the pixel dino.
  if (!img || !ready) {
    return;
  }

  const layoutHeight = layout.length * CELL_SIZE;
  const layoutWidth = layout[0].length * CELL_SIZE;
  const iw = img.naturalWidth || img.width || 0;
  const ih = img.naturalHeight || img.height || 0;
  if (iw <= 0 || ih <= 0) return;

  const scale = Math.min(layoutWidth / iw, layoutHeight / ih);
  const drawWidth = iw * scale;
  const drawHeight = ih * scale;
  const x = col + (layoutWidth - drawWidth) / 2;
  const y = row + (layoutHeight - drawHeight) / 2;

  canvas_ctx.imageSmoothingEnabled = true;
  canvas_ctx.imageSmoothingQuality = "high";
  canvas_ctx.drawImage(img, x, y, drawWidth, drawHeight);
}

function runMatthewBot() {
  // Enable auto-play only when Matthew is selected
  if (selectedCharacter !== "matthew" || matthewCheatManualOverride) {
    return;
  }

  if (!harmfull_characters_pool || harmfull_characters_pool.length === 0) {
    return;
  }

  const dino_character = harmfull_characters_pool[0];
  const dino_pos = dino_character.get_position().get();
  const dino_col = dino_pos[1];

  // Look for the closest harmful characters (non-bird) in front of the dino,
  // using time-to-collision. Jump only when obstacle is close enough (not too early).
  const BASE_MIN_JUMP_TIME_FRAMES = 8; // don't jump when already too close
  const BASE_MAX_JUMP_TIME_FRAMES = 16; // don't jump when obstacle still far away

  const candidates = [];

  for (let i = 1; i < harmfull_characters_pool.length; i++) {
    const obst = harmfull_characters_pool[i];
    const obst_layout = obst.get_layout();

    // Ignore birds completely; they never collide in our rules
    if (bird_layout.fly.includes(obst_layout)) {
      continue;
    }

    const obst_pos = obst.get_position().get();
    const dx = obst_pos[1] - dino_col;

    // Ignore obstacles that are behind
    if (dx <= 0) {
      continue;
    }

    // Use current obstacle horizontal speed to estimate time-to-collision
    const obst_vel = obst.get_velocity().get();
    const speedX = Math.abs(obst_vel[1]);
    if (speedX <= 0.01) {
      continue;
    }

    const timeToCollision = dx / speedX;
    candidates.push({ dx, timeToCollision });
  }

  if (candidates.length === 0 || !dino_ready_to_jump) {
    return;
  }

  // Sort by distance so candidates[0] is the next obstacle.
  candidates.sort((a, b) => a.dx - b.dx);

  const primary = candidates[0];
  const secondary = candidates[1];

  // Slight adjustment for speed: at higher speed allow a tiny bit earlier jump,
  // but keep the window tight so we don't jump too early.
  const currentSpeedX = Math.abs(
    harmfull_characters_pool[1]
      ? harmfull_characters_pool[1].get_velocity().get()[1]
      : FLOOR_VELOCITY.get()[1],
  );
  const speedFactor = Math.min(Math.max(currentSpeedX / 8, 0.9), 1.15);

  const minJumpTimeFrames = BASE_MIN_JUMP_TIME_FRAMES * speedFactor;
  let maxJumpTimeFrames = BASE_MAX_JUMP_TIME_FRAMES * speedFactor;

  // Choose how long to "hold" the jump (how high/long) depending on how
  // tightly packed the next few obstacles are.
  let desiredHoldFrames = 6; // short hop by default

  if (secondary) {
    const gapBetween = secondary.dx - primary.dx;

    if (gapBetween < 45) {
      // Very tight pair of obstacles: use a long jump to try to clear both.
      desiredHoldFrames = MAX_JUMP_HOLD_FRAMES;
      maxJumpTimeFrames += 2; // small extension so we still don't jump too early
    } else if (gapBetween < SAFE_LAND_GAP_COLUMNS) {
      // Medium spacing: medium jump so we land early enough to react.
      desiredHoldFrames = 10;
    }
  }

  if (
    primary.timeToCollision >= minJumpTimeFrames &&
    primary.timeToCollision <= maxJumpTimeFrames
  ) {
    matthewAutoJumping = true;
    matthewDesiredHoldFrames = desiredHoldFrames;
    handleJumpDown();
  }
}

function event_loop() {
  game_score_step += 0.15;

  if (game_score_step > 1) {
    game_score_step -= 1;
    game_score++;
  }

  if (game_score != 0 && game_score % 300 == 0) {
    game_score++;
    if (current_theme.id == 1) {
      current_theme = themes.dark;
    } else {
      current_theme = themes.classic;
    }
    document.body.style.backgroundColor = current_theme.background;
  }

  canvas_ctx.clearRect(0, 0, canvas.width, canvas.height);
  canvas_ctx.fillStyle = current_theme.background;
  canvas_ctx.fillRect(0, 0, canvas.width, canvas.height);
  canvas_ctx.beginPath();

  // Road
  for (let i = 0; i < canvas.width; i++) {
    canvas_ctx.fillStyle = current_theme.road;
    canvas_ctx.fillRect(0, 232, canvas.width, CELL_SIZE * 0.2);
  }

  // score card update
  canvas_ctx.font = "20px Arcade";
  canvas_ctx.fillStyle = current_theme.score_text;
  canvas_ctx.fillText(
    `H I     ${Math.floor(game_hi_score).toString().padStart(4, "0").split("").join(" ")}     ${game_score.toString().padStart(4, "0").split("").join(" ")}`,
    canvas.width - 200,
    20,
  );

  // first time
  if (is_first_time) {
    is_first_time = false;
    draw_dino(
      dino_layout.stand,
      harmfull_characters_pool[0].get_position().get(),
    );
    game_over = Date.now();

    canvas_ctx.textBaseline = "middle";
    canvas_ctx.textAlign = "center";
    canvas_ctx.font = "25px Arcade";
    canvas_ctx.fillStyle = current_theme.info_text;
    canvas_ctx.fillText(
      "J     U     M     P             T     O             S     T     A     R     T",
      canvas.width / 2,
      canvas.height / 2 - 50,
    );
    return;
  }

  // characters
  // new characters generate
  [
    [harmless_character_allocator, harmless_characters_pool],
    [harmfull_character_allocator, harmfull_characters_pool],
  ].forEach((character_allocator_details, allocatorIndex) => {
    for (let i = 0; i < character_allocator_details[0].length; i++) {
      const ALLOCATOR = character_allocator_details[0][i];
      ALLOCATOR.tick();
      const RANDOM_CHARACTER = ALLOCATOR.get_character();
      if (RANDOM_CHARACTER) {
        RANDOM_CHARACTER.get_velocity().add(cumulative_velocity);

        // When Matthew cheat is active, avoid spawning harmful obstacles
        // unrealistically close in front of the dino, which can create
        // impossible sequences while the dino is still in the air.
        if (allocatorIndex === 1) {
          const dino_character = harmfull_characters_pool[0];
          if (dino_character) {
            const dino_col = dino_character.get_position().get()[1];
            const new_pos = RANDOM_CHARACTER.get_position().get();
            const dx = new_pos[1] - dino_col;

            // Skip spawning if the obstacle would appear too soon after the
            // player, where a second reaction is impossible during a single jump.
            if (dx > 0 && dx < SAFE_LAND_GAP_COLUMNS) {
              continue;
            }
          }
        }

        character_allocator_details[1].push(RANDOM_CHARACTER);
      }
    }
  });

  // increase velocity only after the player has scored at least 1000 points.
  if (game_score >= 200 && game_score % 100 === 0) {
    cumulative_velocity.add(step_velocity);
  }

  // characters display
  [harmless_characters_pool, harmfull_characters_pool].forEach(
    (characters_pool, index) => {
      for (let i = characters_pool.length - 1; i >= 0; i--) {
        // Increase velocity on each cycle once speed-up has started
        if (game_score >= 1000 && game_score % 100 === 0) {
          if (!(index == 1 && i == 0)) {
            characters_pool[i].get_velocity().add(step_velocity);
          }
        }

        characters_pool[i].tick();
        let CHARACTER_LAYOUT = characters_pool[i].get_layout();

        // A special case for dino jump. It's leg should be in standing position while jump
        // Yes, this can be done much better but I am lazy :-)
        if (!dino_ready_to_jump && index == 1 && i == 0) {
          CHARACTER_LAYOUT = dino_layout.stand;
        }
        // ******

        const CHARACTER_POSITION = characters_pool[i].get_position().get();

        if (CHARACTER_POSITION[1] < -150) {
          characters_pool.splice(i, 1);
          continue;
        }

        if (index === 1 && i === 0) {
          draw_dino(CHARACTER_LAYOUT, CHARACTER_POSITION);
        } else {
          paint_layout(CHARACTER_LAYOUT, CHARACTER_POSITION);
        }
      }
    },
  );

  // Matthew cheat: auto-play by triggering jumps before collisions
  runMatthewBot();

  // harmfull characters collision detection
  let dino_character = harmfull_characters_pool[0];
  let dino_current_position = dino_character.get_position();
  let dino_current_layout = dino_character.get_layout();
  for (let i = harmfull_characters_pool.length - 1; i > 0; i--) {
    const HARMFULL_CHARACTER_POSITION =
      harmfull_characters_pool[i].get_position();
    const HARMFULL_CHARACTER_LAYOUT = harmfull_characters_pool[i].get_layout();

    // Ignore birds completely for collision so they never cause game over
    if (bird_layout.fly.includes(HARMFULL_CHARACTER_LAYOUT)) {
      continue;
    }

    if (
      isCollided(
        dino_current_position.get()[0],
        dino_current_position.get()[1],
        dino_current_layout.length,
        dino_current_layout[0].length,
        HARMFULL_CHARACTER_POSITION.get()[0],
        HARMFULL_CHARACTER_POSITION.get()[1],
        HARMFULL_CHARACTER_LAYOUT.length,
        HARMFULL_CHARACTER_LAYOUT[0].length,
      )
    ) {
      canvas_ctx.textBaseline = "middle";
      canvas_ctx.textAlign = "center";
      canvas_ctx.font = "25px Arcade";
      canvas_ctx.fillStyle = current_theme.info_text;
      canvas_ctx.fillText(
        "G     A     M     E             O     V     E     R",
        canvas.width / 2,
        canvas.height / 2 - 50,
      );
      paint_layout(
        retry_layout,
        new Position(
          canvas.height / 2 - retry_layout.length,
          canvas.width / 2 - retry_layout[0].length,
        ).get(),
      );
      draw_dino(
        dino_layout.dead,
        harmfull_characters_pool[0].get_position().get(),
      );
      game_over = Date.now();

      if (
        localStorage.getItem("project.github.chrome_dino.high_score") <
        game_score
      ) {
        localStorage.setItem(
          "project.github.chrome_dino.high_score",
          game_score,
        );
      }

      return;
    }
  }

  // dino jump case
  dino_character.set_position(
    applyVelocityToPosition(dino_character.get_position(), dino_current_trust),
  );

  if (
    !dino_ready_to_jump &&
    jumpKeyHeld &&
    jumpHoldFrames < MAX_JUMP_HOLD_FRAMES
  ) {
    dino_current_trust.add(EXTRA_JUMP_ACCEL);
    jumpHoldFrames++;

    // For Matthew cheat, automatically "release" the jump after the
    // desired number of frames so we don't always use the maximum
    // airtime. This lets the bot land earlier and be ready for another
    // jump on tricky, closely-spaced sequences.
    if (
      matthewAutoJumping &&
      jumpHoldFrames >= matthewDesiredHoldFrames &&
      selectedCharacter === "matthew"
    ) {
      matthewAutoJumping = false;
      handleJumpUp();
    }
  }

  if (
    dino_character.get_position().get()[0] >
    DINO_FLOOR_INITIAL_POSITION.get()[0]
  ) {
    dino_character.set_position(DINO_FLOOR_INITIAL_POSITION.clone());
    dino_ready_to_jump = true;
    jumpKeyHeld = false;
    jumpHoldFrames = 0;
  }

  dino_current_trust.sub(ENVIRONMENT_GRAVITY);

  requestAnimationFrame(event_loop);
}

function main() {
  initialize();
  event_loop();
}

function hideIntroAndStartGame() {
  const intro = document.getElementById("intro-overlay");
  if (!intro || intro.classList.contains("intro-overlay--hidden")) {
    return;
  }

  intro.classList.add("intro-overlay--hidden");

  // Wait for fade-out transition to finish before starting the game
  setTimeout(() => {
    main();
  }, 600);
}

function setupIntroOrStartImmediately() {
  const intro = document.getElementById("intro-overlay");

  // If there is no intro overlay, just start the game as before
  if (!intro) {
    main();
    return;
  }

  const handleStart = () => {
    document.removeEventListener("keydown", handleStart);
    document.removeEventListener("click", handleStart);
    hideIntroAndStartGame();
  };

  document.addEventListener("keydown", handleStart);
  document.addEventListener("click", handleStart);
}

if (document.fonts && document.fonts.load) {
  document.fonts
    .load('1rem "Arcade"')
    .then(() => {
      setupIntroOrStartImmediately();
    })
    .catch(() => {
      // If font loading fails, still set up intro / game
      setupIntroOrStartImmediately();
    });
} else {
  // Fallback for environments without Font Loading API
  setupIntroOrStartImmediately();
}
