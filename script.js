// ----------------------------------
// Global Variables & Configuration
// ----------------------------------

// Three.js core objects
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer();

// World Manager instance
let worldManager; // Will be created after loading assets

// Loaded Assets Storage
const loadedTextures = {}; // Stores loaded Three.js Texture objects by filename
const blockMaterials = {}; // Stores arrays of materials [6 per block face] by block ID
const blockDataMap = new Map(); // Stores block definitions by ID

// Sound base path and categories from block.data
let soundBasePath = ''; // Will be loaded from block.data
let soundCategories = {}; // Will be loaded from block.data


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

const controls = new THREE.OrbitControls(camera, renderer.domElement);


// ----------------------------------
// Animation Loop
// ----------------------------------

function animate(currentTime) {
    requestAnimationFrame(animate);

    const deltaTime = (currentTime - lastTime) / 1000;
    lastTime = currentTime;

    if (player) {
        player.update(deltaTime);
    }

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
        soundBasePath = blockData.soundBasePath || ''; // Read sound base path
        soundCategories = blockData.soundCategories || {}; // Read sound categories

        const uniqueTexturePaths = new Set();

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

                // --- World Management and Player Setup ---

                // Create the WorldManager instance
                worldManager = new WorldManager(scene, blockMaterials, player);

                // Create the player instance AFTER WorldManager is defined
                player = new Player(
                    camera,
                    worldManager, // Pass the WorldManager instance
                    scene,
                    blockMaterials,
                    blockDataMap, // Pass the blockDataMap to Player
                    soundBasePath, // Pass the sound base path
                    soundCategories // Pass the sound categories
                );

                 worldManager.player = player;


                // Generate the world data using the WorldManager
                worldManager.generateWorldData();


                // Set the player's initial position just above the highest solid block layer (Grass)
                const highestSolidBlockY = worldManager.getHighestSolidBlockY();

                player.position.set(
                    0,
                    highestSolidBlockY + 2,
                    0
                );
                 console.log(`Player created at initial position: ${player.position.x}, ${player.position.y}, ${player.position.z}`);


                 player.updateChunks();


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
});