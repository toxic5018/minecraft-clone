// ----------------------------------
// Player Class
// ----------------------------------

class Player {
    constructor(camera, world, scene, blockMaterials, buildChunkMesh, disposeChunkMesh) {
        this.camera = camera;
        this.world = world; // Reference to the world data object (includes dimensions and data array)
        this.scene = scene; // Reference to the Three.js scene
        this.blockMaterials = blockMaterials; // Reference to the loaded block materials

        // Functions provided by script.js for chunk meshing
        this.buildChunkMesh = buildChunkMesh;
        this.disposeChunkMesh = disposeChunkMesh;

        // Player position and movement
        // Initial position will be set relative to the centered world later in script.js
        this.position = new THREE.Vector3();
        this.velocity = new THREE.Vector3();
        this.speed = 5; // Units per second
        this.rotation = new THREE.Euler(0, 0, 0, 'YXZ'); // YXZ order is common for camera

        // Input handling
        this.keys = {
            w: false, s: false, a: false, d: false,
            space: false, shift: false
        };

        // Mouse look variables (uses Pointer Lock API)
        this.isMouseLookEnabled = false; // Set by Pointer Lock status
        this.sensitivity = 0.002;

        // Chunk management
        this.chunkSizeX = 4; // Dimensions of a chunk in blocks
        this.chunkSizeY = 4;
        this.chunkSizeZ = 4;
        this.renderDistance = 10; // Render distance in blocks (spherical radius)
        // The cubic search range for chunks (in chunks) based on render distance and chunk size
        // Ensures we check all chunks that *might* be within the spherical distance.
        this.renderDistanceInChunks = Math.ceil(this.renderDistance / Math.min(this.chunkSizeX, this.chunkSizeY, this.chunkSizeZ)) + 1;


        this.loadedChunks = new Map(); // Map<string (chunkCoords), THREE.Group (chunkMesh)>

        // Player's current chunk coordinates
        this.currentChunk = { x: null, y: null, z: null };

        // Event listeners for input and pointer lock
        this.addInputListeners();

        // Initial camera update (position will be set by script.js)
        this.updateCamera();
    }

    addInputListeners() {
        document.addEventListener('keydown', (event) => {
            this.handleKeyDown(event);
        });
        document.addEventListener('keyup', (event) => {
            this.handleKeyUp(event);
        });

        // Pointer Lock API event listeners
        document.addEventListener('pointerlockchange', () => {
            this.isMouseLookEnabled = (document.pointerLockElement === renderer.domElement);
            console.log('Pointer Lock Status:', this.isMouseLookEnabled ? 'Locked' : 'Unlocked');
            if (!this.isMouseLockEnabled) {
                 // If pointer lock is lost (e.g., by pressing Esc), reset key states
                 this.keys = { w: false, s: false, a: false, d: false, space: false, shift: false };
             }
        });

        document.addEventListener('pointerlockerror', () => {
            console.error('Pointer Lock Error');
        });

        // Request Pointer Lock on click (attach to renderer's DOM element for best results)
        renderer.domElement.addEventListener('click', () => {
             renderer.domElement.requestPointerLock();
        });

        // Listen for mouse movement ONLY when pointer lock is active
        document.addEventListener('mousemove', (event) => {
             if (this.isMouseLookEnabled) {
                 this.handleMouseMove(event.movementX, event.movementY);
             }
        });
    }

    handleKeyDown(event) {
        const key = event.key.toLowerCase();
        if (this.keys.hasOwnProperty(key)) {
            this.keys[key] = true;
        }
         if (event.key === 'Shift') {
             this.keys.shift = true;
         }
         if (event.key === ' ') { // Space bar
             this.keys.space = true;
         }
        if (event.key === 'Escape' && document.pointerLockElement) {
             document.exitPointerLock();
        }
    }

    handleKeyUp(event) {
        const key = event.key.toLowerCase();
        if (this.keys.hasOwnProperty(key)) {
            this.keys[key] = false;
        }
         if (event.key === 'Shift') {
             this.keys.shift = false;
         }
         if (event.key === ' ') { // Space bar
             this.keys.space = false;
         }
    }

    handleMouseMove(movementX, movementY) {
        this.rotation.y -= movementX * this.sensitivity; // Yaw (around Y-axis)
        this.rotation.x -= movementY * this.sensitivity; // Pitch (around X-axis)

        // Clamp vertical rotation (pitch) to +/- 90 degrees (PI / 2 radians)
        const pi = Math.PI;
        this.rotation.x = Math.max(-pi / 2, Math.min(pi / 2, this.rotation.x));
    }

    update(deltaTime) {
        // --- Player Movement ---
        this.velocity.set(0, 0, 0); // Reset velocity

        const forward = new THREE.Vector3(0, 0, -1).applyEuler(this.rotation);
        const right = new THREE.Vector3(1, 0, 0).applyEuler(this.rotation);

        if (this.keys.w) this.velocity.add(forward);
        if (this.keys.s) this.velocity.sub(forward);
        if (this.keys.a) this.velocity.sub(right);
        if (this.keys.d) this.velocity.add(right);

        if (this.keys.space) this.velocity.y += 1;
        if (this.keys.shift) this.velocity.y -= 1;

        const horizontalVelocity = new THREE.Vector3(this.velocity.x, 0, this.velocity.z);
        if (horizontalVelocity.lengthSq() > 0) {
            horizontalVelocity.normalize().multiplyScalar(this.speed * deltaTime);
            this.velocity.x = horizontalVelocity.x;
            this.velocity.z = horizontalVelocity.z;
        } else {
             this.velocity.x = 0;
             this.velocity.z = 0;
        }

        this.velocity.y *= this.speed * deltaTime;

        this.position.add(this.velocity);


        // --- Chunk Management ---
        this.updateChunks();

        // --- Update Camera ---
        this.updateCamera();
    }

    updateCamera() {
        this.camera.position.copy(this.position);
        this.camera.rotation.copy(this.rotation);
    }

    // Determine the chunk coordinates for a given world position
    getChunkCoords(position) {
         // Account for world centering (world data indices start from 0)
         // Physical position (0,0,0) in scene is world data index (worldWidth/2, 0, worldDepth/2)
         const worldDataX = position.x + this.world.worldWidth / 2;
         const worldDataY = position.y; // Y position matches world data index Y
         const worldDataZ = position.z + this.world.worldDepth / 2;

        return {
            x: Math.floor(worldDataX / this.chunkSizeX),
            y: Math.floor(worldDataY / this.chunkSizeY),
            z: Math.floor(worldDataZ / this.chunkSizeZ)
        };
    }

    // Get a string key for chunk coordinates
    getChunkKey(chunkCoords) {
        return `${chunkCoords.x},${chunkCoords.y},${chunkCoords.z}`;
    }

    // Calculate the physical center position of a chunk in the scene
    getChunkCenterPosition(chunkCoords) {
        const chunkStartX = chunkCoords.x * this.chunkSizeX;
        const chunkStartY = chunkCoords.y * this.chunkSizeY;
        const chunkStartZ = chunkCoords.z * this.chunkSizeZ;

         // Chunk center is at the start plus half the chunk size
        const centerX = chunkStartX + this.chunkSizeX / 2;
        const centerY = chunkStartY + this.chunkSizeY / 2;
        const centerZ = chunkStartZ + this.chunkSizeZ / 2;

        // Translate from world data index space to physical scene space (centered)
         const physicalCenterX = centerX - this.world.worldWidth / 2;
         const physicalCenterY = centerY;
         const physicalCenterZ = centerZ - this.world.worldDepth / 2;

        return new THREE.Vector3(physicalCenterX, physicalCenterY, physicalCenterZ);
    }


    // Main chunk management logic
    updateChunks() {
        const playerChunk = this.getChunkCoords(this.position);

        // Only update chunks if the player has moved into a new chunk
        // Or if it's the initial load (currentChunk is null)
        if (playerChunk.x !== this.currentChunk.x ||
            playerChunk.y !== this.currentChunk.y ||
            playerChunk.z !== this.currentChunk.z ||
            this.currentChunk.x === null) { // Initial load

            this.currentChunk = playerChunk;
            console.log(`Player moved to chunk: ${this.getChunkKey(this.currentChunk)}`);

            const chunksToKeep = new Set(); // Keep track of chunks that are within render distance

            // Determine the cubic search range of chunk coordinates around the player's chunk
            const minChunkX = this.currentChunk.x - this.renderDistanceInChunks;
            const maxChunkX = this.currentChunk.x + this.renderDistanceInChunks;
             const minChunkY = Math.max(0, this.currentChunk.y - this.renderDistanceInChunks); // Don't search below world min Y chunk
             const maxChunkY = Math.min(Math.floor((this.world.worldHeight - 1) / this.chunkSizeY), this.currentChunk.y + this.renderDistanceInChunks); // Don't search above world max Y chunk
            const minChunkZ = this.currentChunk.z - this.renderDistanceInChunks;
            const maxChunkZ = this.currentChunk.z + this.renderDistanceInChunks;


            // Iterate through the cubic search range of potential chunk coordinates
            for (let cx = minChunkX; cx <= maxChunkX; cx++) {
                for (let cy = minChunkY; cy <= maxChunkY; cy++) {
                    for (let cz = minChunkZ; cz <= maxChunkZ; cz++) {
                        const chunkCoords = { x: cx, y: cy, z: cz };
                        const chunkKey = this.getChunkKey(chunkCoords);

                        // Calculate the physical center of this potential chunk
                        const chunkCenter = this.getChunkCenterPosition(chunkCoords);

                        // --- Spherical Render Distance Check ---
                        // Load the chunk if its center is within the render distance radius
                         const distanceToChunkCenter = this.position.distanceTo(chunkCenter);

                        if (distanceToChunkCenter <= this.renderDistance /* + buffer */) { // Add buffer if needed for accuracy
                             chunksToKeep.add(chunkKey); // This chunk is within spherical render distance

                            // If the chunk is not currently loaded, load it
                            if (!this.loadedChunks.has(chunkKey)) {
                                // Check if this chunk actually overlaps with the world data bounds before building
                                // (This check is also done inside buildChunkMesh, but doing it here avoids the call)
                                // A simple check is if the chunk's starting world data coords are within world bounds
                                const chunkWorldDataStartX = chunkCoords.x * this.chunkSizeX;
                                const chunkWorldDataStartY = chunkCoords.y * this.chunkSizeY;
                                const chunkWorldDataStartZ = chunkCoords.z * this.chunkSizeZ;

                                 if (chunkWorldDataStartX < this.world.worldWidth && chunkWorldDataStartY < this.world.worldHeight && chunkWorldDataStartZ < this.world.worldDepth) {
                                    console.log(`Loading chunk: ${chunkKey}`);
                                    // Call the function from script.js to build and add the chunk mesh
                                    const chunkMesh = this.buildChunkMesh(chunkCoords, this.world, this.blockMaterials, this.scene);
                                    if (chunkMesh) {
                                         this.loadedChunks.set(chunkKey, chunkMesh);
                                    }
                                }
                            }
                        }
                    }
                }
            }

            // Identify and unload chunks that are currently loaded but no longer in the render distance
            const chunksToUnload = [];
            this.loadedChunks.forEach((chunkMesh, chunkKey) => {
                if (!chunksToKeep.has(chunkKey)) {
                    chunksToUnload.push(chunkKey); // This chunk needs to be unloaded
                }
            });

            // Unload chunks
            chunksToUnload.forEach(chunkKey => {
                 console.log(`Unloading chunk: ${chunkKey}`);
                 const chunkMesh = this.loadedChunks.get(chunkKey);
                 // Call the function from script.js to dispose and remove the chunk mesh
                 this.disposeChunkMesh(chunkMesh, this.scene);
                 this.loadedChunks.delete(chunkKey);
            });
        }
    }
}