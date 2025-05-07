// ----------------------------------
// Global Variables & Configuration
// ----------------------------------

// Three.js core objects
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer();

// World Dimensions (blocks)
const worldWidth = 256;
const worldDepth = 256;
// New height: 1 Bedrock + 58 Stone + 3 Dirt + 1 Grass = 63
const worldHeight = 1 + 58 + 3 + 1;

// World Data (stores block IDs at each position)
const world = []; // world[x][y][z] - indexed from 0 to worldDim - 1

// Block Layers (height ranges for different block types) - UPDATED
const blockLayers = [
    { id: '4', startY: 0, endY: 0 },     // Bedrock at the very bottom (y=0)
    { id: '3', startY: 1, endY: 58 },    // Stone layers (from y=1 up to y=58)
    { id: '2', startY: 59, endY: 61 },   // Dirt layers (from y=59 up to y=61)
    { id: '1', startY: 62, endY: 62 }    // Grass layer on top (y=62)
];

// Loaded Assets Storage
const loadedTextures = {}; // Stores loaded Three.js Texture objects by filename
const blockMaterials = {}; // Stores arrays of materials [6 per block face] by block ID

// Player instance
let player; // Will be created after world data is loaded

// Animation control
let lastTime = 0; // For calculating delta time

// Message Storage (remains the same)
let loadedLogs = [];
let loadedWarns = [];
let loadedErrors = [];

// ----------------------------------
// Three.js Setup
// ----------------------------------

renderer.setSize(window.innerWidth, window.innerHeight);
document.body.insertBefore(renderer.domElement, document.querySelector('.controls'));

// OrbitControls will conflict with Pointer Lock controls.
// Keep it defined but it won't be updated in the animation loop by default now.
const controls = new THREE.OrbitControls(camera, renderer.domElement);


// ----------------------------------
// World Data Generation
// ----------------------------------
// This generates the *data* for the whole world, but meshes are built per chunk

function generateWorldData() {
    console.log('Generating world data...');
    // Initialize the 3D array
    for (let x = 0; x < worldWidth; x++) {
        world[x] = [];
        for (let y = 0; y < worldHeight; y++) { // Use the new worldHeight
            world[x][y] = [];
            for (let z = 0; z < worldDepth; z++) {
                world[x][y][z] = null; // Start with empty space
            }
        }
    }

    // Fill the world data based on layers
    for (let x = 0; x < worldWidth; x++) {
        for (let z = 0; z < worldDepth; z++) {
            for (const layer of blockLayers) {
                for (let y = layer.startY; y <= layer.endY; y++) {
                     // Ensure y is within new world height bounds
                    if (y >= 0 && y < worldHeight) {
                        world[x][y][z] = layer.id; // Set the block ID for this position
                    }
                }
            }
        }
    }
    console.log('World data generated.');
}


// --- Chunk Meshing Functions (Called by player.js) ---

// Builds the mesh for a single chunk
function buildChunkMesh(chunkCoords, worldData, blockMaterials, scene) {
    const chunkGroup = new THREE.Group(); // Create a group to hold all meshes in this chunk
    chunkGroup.userData.chunkCoords = chunkCoords; // Store chunk coordinates on the group

    // Calculate the starting and ending block coordinates (in world data indices) for this chunk
    const chunkStartX = chunkCoords.x * player.chunkSizeX;
    const chunkStartY = chunkCoords.y * player.chunkSizeY;
    const chunkStartZ = chunkCoords.z * player.chunkSizeZ;

    const chunkEndX = chunkStartX + player.chunkSizeX;
    const chunkEndY = chunkStartY + player.chunkSizeY;
    const chunkEndZ = chunkStartZ + player.chunkSizeZ;

    // Reuse a single geometry instance for all blocks if possible for optimization
    // For simplicity now, we'll keep creating it here per chunk build call.
    // Consider defining `const blockGeometry = new THREE.BoxGeometry(1, 1, 1);` globally.
    const geometry = new THREE.BoxGeometry(1, 1, 1);

    // Iterate through the block coordinates within this chunk's bounds
    for (let x = chunkStartX; x < chunkEndX; x++) {
        for (let y = chunkStartY; y < chunkEndY; y++) {
            for (let z = chunkStartZ; z < chunkEndZ; z++) {

                // Check if the block coordinate is within the actual world data bounds (now up to worldHeight 63)
                if (x >= 0 && x < worldData.worldWidth &&
                    y >= 0 && y < worldData.worldHeight &&
                    z >= 0 && z < worldData.worldDepth) {

                    const blockId = worldData.data[x][y][z]; // Get block ID from world data

                    if (blockId !== null) { // If there is a block at this position
                        const materials = blockMaterials[blockId]; // Get the pre-made materials

                        if (materials) {
                            const blockMesh = new THREE.Mesh(geometry, materials);

                            // Position the block relative to the chunk's origin
                            // The chunk's origin in world data coordinates is (chunkStartX, chunkStartY, chunkStartZ)
                            // The block's local position within the chunk is (x - chunkStartX, y - chunkStartY, z - chunkStartZ)
                            blockMesh.position.set(
                                x - chunkStartX + 0.5,
                                y - chunkStartY + 0.5,
                                z - chunkStartZ + 0.5
                            );

                            chunkGroup.add(blockMesh); // Add the block mesh to the chunk's group
                        } else {
                             console.warn(`Materials not found for block ID: ${blockId}. Skipping mesh creation for block at ${x},${y},${z}.`);
                        }
                    }
                }
            }
        }
    }

     // Position the chunk group correctly in the scene (relative to world origin 0,0,0)
     // Chunk group origin is at the min physical coordinates of the chunk
     // A chunk at chunkCoords (cx, cy, cz) starts at world data coords (cx*cSizeX, cy*cSizeY, cz*cSizeZ)
     // The physical world is centered, so world data coord (0,0,0) is physical (-w/2, 0, -d/2)
     // Physical position of chunk group origin: (chunkStartX - worldWidth/2, chunkStartY, chunkStartZ - worldDepth/2)
     chunkGroup.position.set(
         chunkStartX - worldData.worldWidth / 2,
         chunkStartY,
         chunkStartZ - worldData.worldDepth / 2
     );

    // Add the chunk group to the scene
    scene.add(chunkGroup);

    // Dispose the geometry if it's created per chunk
    geometry.dispose();

    return chunkGroup; // Return the created group
}


// Disposes of a chunk mesh group and removes it from the scene
function disposeChunkMesh(chunkGroup, scene) {
    scene.remove(chunkGroup);

    chunkGroup.traverse(object => {
        if (object.isMesh) {
            if (object.geometry && object.geometry.dispose) {
                object.geometry.dispose();
            }
            // Materials are shared, do NOT dispose them here.
        }
    });
}


// ----------------------------------
// Animation Loop
// ----------------------------------

function animate(currentTime) {
    requestAnimationFrame(animate);

    const deltaTime = (currentTime - lastTime) / 1000;
    lastTime = currentTime;

    if (player) {
        player.update(deltaTime); // Update player position and chunk loading
    }

    // controls.update(); // Not needed if using Pointer Lock controls

    renderer.render(scene, camera);
}


// ----------------------------------
// Data & Texture Loading
// ----------------------------------

const textureLoader = new THREE.TextureLoader();

fetch('block.data')
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
    })
    .then(blockData => {
        const textureBasePath = blockData.textureBasePath || '';

        const uniqueTexturePaths = new Set();
        const blockDataMap = new Map();

        blockData.blocks.forEach(block => {
            blockDataMap.set(block.id, block);
            Object.values(block.textures).forEach(filename => {
                 uniqueTexturePaths.add(textureBasePath + filename);
            });
        });

        const texturePathsArray = Array.from(uniqueTexturePaths);
        console.log(`Identified ${texturePathsArray.length} unique textures to load.`);

        const texturePromises = texturePathsArray.map(path => textureLoader.loadAsync(path));

        return Promise.all(texturePromises)
            .then(loadedThreeTextures => {
                console.log('All textures loaded.');
                loadedThreeTextures.forEach((texture, index) => {
                     loadedTextures[texturePathsArray[index]] = texture;
                });

                console.log('Preparing materials for blocks...');
                blockData.blocks.forEach(block => {
                     const materials = [
                        new THREE.MeshBasicMaterial({ map: loadedTextures[textureBasePath + block.textures.east] }),
                        new THREE.MeshBasicMaterial({ map: loadedTextures[textureBasePath + block.textures.west] }),
                        new THREE.MeshBasicMaterial({ map: loadedTextures[textureBasePath + block.textures.up] }),
                        new THREE.MeshBasicMaterial({ map: loadedTextures[textureBasePath + block.textures.down] }),
                        new THREE.MeshBasicMaterial({ map: loadedTextures[textureBasePath + block.textures.south] }),
                        new THREE.MeshBasicMaterial({ map: loadedTextures[textureBasePath + block.textures.north] })
                     ];
                    blockMaterials[block.id] = materials;
                });
                 console.log(`Prepared materials for ${Object.keys(blockMaterials).length} block types.`);

                // --- World Data Generation and Player Setup ---
                generateWorldData(); // Create the structure of the world data (full 256x63x256 array)

                // Create the player AFTER world data and materials are loaded
                // Pass necessary references and functions to the player
                player = new Player(
                    camera,
                    { worldWidth, worldHeight, worldDepth, data: world }, // World data object
                    scene,
                    blockMaterials,
                    buildChunkMesh, // Pass the function to build a chunk mesh
                    disposeChunkMesh // Pass the function to dispose a chunk mesh
                );

                // Set the player's initial position at the top center of the centered world
                player.position.set(
                    0,               // Centered X
                    worldHeight + 2, // Top + a little buffer above the highest block layer
                    0                // Centered Z
                );
                 console.log(`Player created at initial position: ${player.position.x}, ${player.position.y}, ${player.position.z}`);


                // Trigger the initial chunk load immediately after setting player position
                 player.updateChunks();


                // Start the animation loop AFTER the player and world data are set up
                animate(performance.now());
            });
    })
    .catch(error => {
        console.error('Error loading block data or textures:', error);
        // Handle fatal error
    });


// ----------------------------------
// Console Message Handling (remains the same)
// ----------------------------------

// Fetch and Load Console Messages (remains the same)
fetch('console.log')
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.text();
    })
    .then(data => {
        const lines = data.split('\n').filter(line => line.trim() !== '');
        loadedLogs = lines.filter(line => line.startsWith('log:')).map(line => line.substring(4).trim());
        loadedWarns = lines.filter(line => line.startsWith('warn:')).map(line => line.substring(5).trim());
        loadedErrors = lines.filter(line => line.startsWith('error:')).map(line => line.substring(6).trim());

        console.log(`Loaded ${loadedLogs.length} log messages.`);
        console.log(`Loaded ${loadedWarns.length} warning messages.`);
        console.log(`Loaded ${loadedErrors.length} error messages.`);

        console.log('--- Sample Loaded Messages from console.log ---');
        loadedLogs.slice(0, 2).forEach(msg => console.log(`[Log from file] ${msg}`));
        loadedWarns.slice(0, 2).forEach(msg => console.warn(`[Warning from file] ${msg}`));
        loadedErrors.slice(0, 2).forEach(msg => console.error(`[Error from file] ${msg}`));
        console.log('--- End Sample Loaded Messages ---');

    })
    .catch(error => {
        console.error('Error fetching or processing console.log:', error);
    });

// Simulated Game Events (remains the same)
function getRandomMessage(messageArray) {
    if (messageArray.length === 0) {
        return "No messages available.";
    }
    const randomIndex = Math.floor(Math.random() * messageArray.length);
    return messageArray[randomIndex];
}

function simulateWorldGeneration() {
    console.log('--- Simulating World Generation ---');
    const successMessage = getRandomMessage(loadedLogs);
    console.log(`Generation Success: ${successMessage}`);
    if (Math.random() < 0.3) {
        const warningMessage = getRandomMessage(loadedWarns);
         console.warn(`Generation Warning: ${warningMessage}`);
    }
}

function simulateGameplayAction() {
     console.log('--- Simulating Gameplay Action ---');
     const actionLog = getRandomMessage(loadedLogs);
     console.log(`Gameplay Action: ${actionLog}`);
     if (Math.random() < 0.2) {
         const warningMessage = getRandomMessage(loadedWarns);
          console.warn(`Gameplay Issue: ${warningMessage}`);
     }
}

function simulateErrorOrWarning() {
    console.log('--- Simulating Issue Encountered ---');
    const isError = Math.random() < 0.5;
    if (isError) {
        const errorMessage = getRandomMessage(loadedErrors);
        console.error(`Runtime Error: ${errorMessage}`);
    } else {
        const warningMessage = getRandomMessage(loadedWarns);
        console.warn(`Runtime Warning: ${warningMessage}`);
    }
}

// Button Event Listeners (remains the same)
document.getElementById('generate-world-btn').addEventListener('click', simulateWorldGeneration);
document.getElementById('gameplay-action-btn').addEventListener('click', simulateGameplayAction);
document.getElementById('encounter-issue-btn').addEventListener('click', simulateErrorOrWarning);


// ----------------------------------
// Window Resizing (remains the same)
// ----------------------------------

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    // controls.update();
});