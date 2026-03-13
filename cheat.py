"""
Chrome Dino cheat bot (for Matthew)

This script uses simple image processing to detect obstacles in front of
the runner and automatically jumps (and optionally ducks) for you so the
game can run indefinitely.

How to use
----------
1. Install dependencies (once):

   pip install pyautogui pillow numpy

2. Open your Chrome Dino game (your customised one or the original) and
   choose the character "Matthew" in the browser.

3. Make sure the game window is visible on screen.

4. Adjust the REGION_* constants below so that the detection regions sit
   in front of the character on *your* screen. A good way is to take a
   screenshot and measure pixel coordinates.

5. Run this script while the game window is visible:

   python cheat.py

6. Quickly focus the browser window. The bot will press SPACE to start,
   then keep watching for obstacles and auto‑jumping.

Stop the script with Ctrl+C in the terminal.
"""

import time

import numpy as np
import pyautogui
from PIL import Image


# ---- Configuration --------------------------------------------------------

# IMPORTANT: These regions are for a typical 100% scaled 1920x1080 screen
# with the browser maximised. You will likely need to tweak them.
#
# REGION_GROUND: area just in front of Matthew on the ground where cacti appear
# (left, top, width, height)
REGION_GROUND = (450, 420, 220, 60)

# REGION_AIR: area a bit higher where birds fly (optional, can be None)
# (left, top, width, height)
REGION_AIR = (450, 360, 220, 40)

# Threshold: how dark a pixel must be (0–255) to be considered "obstacle"
OBSTACLE_THRESHOLD = 200

# Minimum number of dark pixels in region to trigger a jump / duck
OBSTACLE_PIXELS_GROUND = 50
OBSTACLE_PIXELS_AIR = 50

# Time (seconds) between scans; lower => faster reactions, more CPU
SCAN_INTERVAL = 0.015


def _count_dark_pixels(im: Image.Image, threshold: int) -> int:
    """Return number of pixels darker than threshold."""
    # Convert to grayscale and then to NumPy array for fast counting
    gray = im.convert("L")
    arr = np.array(gray)
    return int((arr < threshold).sum())


def _region_has_obstacle(region, threshold: int, min_pixels: int) -> bool:
    """Screenshot a region and decide if an obstacle is present."""
    shot = pyautogui.screenshot(region=region)
    dark_pixels = _count_dark_pixels(shot, threshold)
    return dark_pixels >= min_pixels


def main() -> None:
    print("Chrome Dino cheat bot (Matthew only)")
    print("Make sure the game window is visible and Matthew is selected.")
    print("Starting in 3 seconds...")
    time.sleep(3)

    # Start the game with an initial jump
    pyautogui.press("space")
    print("Bot running. Press Ctrl+C in this terminal to stop.")

    try:
        while True:
            # Ground obstacles -> jump
            if _region_has_obstacle(
                REGION_GROUND, OBSTACLE_THRESHOLD, OBSTACLE_PIXELS_GROUND
            ):
                pyautogui.keyDown("space")
                time.sleep(0.04)
                pyautogui.keyUp("space")

            # Air obstacles (birds) -> duck (Arrow Down)
            if REGION_AIR is not None and _region_has_obstacle(
                REGION_AIR, OBSTACLE_THRESHOLD, OBSTACLE_PIXELS_AIR
            ):
                pyautogui.keyDown("down")
                time.sleep(0.12)
                pyautogui.keyUp("down")

            time.sleep(SCAN_INTERVAL)
    except KeyboardInterrupt:
        print("\nBot stopped.")


if __name__ == "__main__":
    main()

