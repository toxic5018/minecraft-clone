# 🧱 Minecraft Classic Title Recreation ⛏️

A small, learning project inspired by the classic version of a very popular blocky sandbox game.

## ✨ About the Project

This project is a work-in-progress attempt to recreate some core mechanics of a classic voxel-based game using HTML, CSS, JavaScript, and the Three.js library for 3D rendering.

Current features include:

* Procedural world data generation with layered blocks.
* Dynamic chunk loading and unloading based on player position and a spherical render distance for performance.
* First-person camera controls with keyboard movement (WASD for horizontal, Space/Shift for vertical).
* Mouse look using the Pointer Lock API for immersive camera rotation.
* Loading block definitions and textures from external data files (`block.data`).
* Simulated in-game console messages fetched from a log file.

## ⚠️ IMPORTANT DISCLAIMER ⚠️

**THIS PROJECT IS SOLELY FOR EDUCATIONAL, EXPERIMENTAL, AND NOSTALGIA PURPOSES.**

I **DO NOT** own any rights to the game this project is inspired by, its assets (textures, sounds, logos, etc.), or its concepts. All rights belong to the original creators and copyright holders (Mojang Studios / Microsoft).

This project is **NOT** affiliated with or endorsed by Mojang Studios or Microsoft.

**I WILL NOT distribute the original game's assets.** Any textures or assets used during development are placeholders or created from scratch for learning purposes.

**This project is NOT for commercial use.** It is a personal learning exercise and tribute.

🙏 Please support the official game! 🙏

## ▶️ How to Play

1.  Make sure you have all the project files (`index.html`, `script.js`, `player.js`, `style.css`, `block.data`, `console.log`, and the `assets/textures/` folder with your texture images).
2.  Open the `index.html` file in a modern web browser (like Chrome, Firefox, Edge, or Safari).
3.  Once the page loads and assets are fetched, you should see a 3D view.
4.  **Click anywhere on the canvas area** to enable mouse look (using the Pointer Lock API). Your mouse cursor will disappear.
5.  Press the **Escape** key to exit mouse look and regain your cursor.

## 🎮 Controls

* **Mouse (when Pointer Lock is active):** Look around (control camera pitch and yaw).
* **<kbd>W</kbd>**: Move Forward
* **<kbd>S</kbd>**: Move Backward
* **<kbd>A</kbd>**: Move Left
* **<kbd>D</kbd>**: Move Right
* **<kbd>Space</kbd>**: Fly Up
* **<kbd>Shift</kbd>**: Fly Down
* **<kbd>Escape</kbd>**: Exit Mouse Look (release pointer lock)
* *(Buttons on the page simulate console messages - check your browser's developer console)*

## 🚶 The Player

The "Player" in this project is currently represented by the camera's position and orientation. You can move through the 3D space using the controls. The player's position is tracked, and the world around you is dynamically loaded based on how close chunks are to your location.

## 🌍 World Generation & Chunking

The world data (which block goes where) is generated procedurally based on simple layers (Bedrock, Stone, Dirt, Grass).

To handle larger worlds efficiently, the world is divided into smaller sections called "chunks". Only the chunks within a certain **spherical render distance** around the player are built as 3D meshes and added to the scene. As the player moves, new chunks load, and chunks that move too far away are unloaded to save memory and improve performance.

## 📦 Block Data & Textures

Block types, their names, and the textures for each of their sides are defined in the `block.data` file (which is a JSON file in disguise!). The project loads this data and applies the correct textures to the corresponding faces of the 3D block meshes when chunks are built.

## 📜 Simulated Console Messages

The buttons below the 3D view are a simple demonstration of fetching potential log, warning, and error messages from the `console.log` file and outputting them to your browser's developer console (usually accessed by pressing F12).

## 🏗️ Building and Mining (Future Features)

* Implementing block placing.
* Implementing block breaking.
* Adding collision detection so the player walks on blocks.
* Inventory system.
* More block types and world generation features.
* Sounds!

*(Note: Building and Mining are not implemented in the current version but are exciting possibilities for the future!)*

## ▶️ Getting Started

1.  Make sure you have Git installed.
2.  Clone this repository (if it's in a repo) or download the project files.
    ```bash
    git clone <repository-url>
    ```
3.  Navigate to the project folder.
4.  Ensure all necessary files (from the instructions in the chat where you built this) are present, including the `assets/textures/` folder with your texture images.
5.  Open `index.html` in your web browser.

---

## 📝 License

This project is made available under the terms of the [LICENSE.md](LICENSE.md) file.

## © Copyright

(C) 2025 ToxicStudios Copyright. All Rights Reserved.