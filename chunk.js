// ----------------------------------
// World Manager Class (chunk.js)
// Handles world data and chunk meshing
// ----------------------------------

class WorldManager {
    constructor(scene, blockMaterials, player) { // Pass player reference for chunk size
        this.scene = scene;
        this.blockMaterials = blockMaterials;
        this.player = player; // Reference to the player instance

        // World Dimensions (blocks)
        this.worldWidth = 256;
        this.worldDepth = 256;
        this.worldHeight = 1 + 58 + 3 + 1 + 192; // Bedrock (1) + Stone (58) + Dirt (3) + Grass (1) + Air (192) = 255

        // World Data (stores block IDs or null for air)
        this.world = []; // world[x][y][z] - indexed from 0 to worldDim - 1

        // Block Layers (height ranges for different block types)
        this.blockLayers = [
            { id: '4', startY: 0, endY: 0 },     // Bedrock at the very bottom (y=0)
            { id: '3', startY: 1, endY: 58 },    // Stone layers (from y=1 up to y=58)
            { id: '2', startY: 59, endY: 61 },   // Dirt layers (from y=59 up to y=61)
            { id: '1', startY: 62, endY: 62 }    // Grass layer on top (y=62)
            // Layers above grass (y=63 to y=254) will remain null (Air Blocks)
        ];

        // Reuse a single geometry instance for all blocks across all chunks
        this.blockGeometry = new THREE.BoxGeometry(1, 1, 1);
    }

    // Generates the initial world data array
    generateWorldData() {
        console.log('Generating world data...');
        // Initialize the 3D array
        for (let x = 0; x < this.worldWidth; x++) {
            this.world[x] = [];
            for (let y = 0; y < this.worldHeight; y++) {
                this.world[x][y] = [];
                for (let z = 0; z < this.worldDepth; z++) {
                    this.world[x][y][z] = null; // Start with null, representing Air
                }
            }
        }

        // Fill the world data based on layers (only solid blocks)
        for (let x = 0; x < this.worldWidth; x++) {
            for (let z = 0; z < this.worldDepth; z++) {
                for (const layer of this.blockLayers) {
                    for (let y = layer.startY; y <= layer.endY; y++) {
                         // Ensure y is within world height bounds
                        if (y >= 0 && y < this.worldHeight) {
                            this.world[x][y][z] = layer.id; // Set the block ID for solid blocks
                        }
                    }
                }
            }
        }
        console.log('World data generated.');
    }

    // Get the block ID at specific world data coordinates (x, y, z)
    // Returns block ID string or null for air/out of bounds
    getBlock(x, y, z) {
        // Check bounds
        if (x >= 0 && x < this.worldWidth &&
            y >= 0 && y < this.worldHeight &&
            z >= 0 && z < this.worldDepth) {
            return this.world[x][y][z]; // Returns null if it's air
        }
        return null; // Return null if out of bounds
    }

    // Set the block ID at specific world data coordinates (x, y, z)
    // blockId can be a string ('1', '2', etc.) or null to represent an air block
    setBlock(x, y, z, blockId) {
         // Check bounds
         if (x >= 0 && x < this.worldWidth &&
             y >= 0 && y < this.worldHeight &&
             z >= 0 && z < this.worldDepth) {

             this.world[x][y][z] = blockId; // Set to the new ID or null
             // console.log(`Set block at ${x},${y},${z} to ID: ${blockId === null ? 'null (Air)' : blockId}`);
             return true; // Indicate successful set
         }
         // console.warn(`Attempted to set block out of bounds at ${x},${y},${z}`);
         return false; // Indicate failed set (out of bounds)
    }


    // Builds the mesh for a single chunk
    buildChunkMesh(chunkCoords) {
        const chunkGroup = new THREE.Group(); // Create a group to hold all meshes in this chunk
        chunkGroup.userData.chunkCoords = chunkCoords; // Store chunk coordinates on the group

        // Calculate the starting and ending block coordinates (in world data indices) for this chunk
        const chunkStartX = chunkCoords.x * this.player.chunkSizeX;
        const chunkStartY = chunkCoords.y * this.player.chunkSizeY;
        const chunkStartZ = chunkCoords.z * this.player.chunkSizeZ;

        const chunkEndX = chunkStartX + this.player.chunkSizeX;
        const chunkEndY = chunkStartY + this.player.chunkSizeY;
        const chunkEndZ = chunkStartZ + this.player.chunkSizeZ;

        // Iterate through the block coordinates within this chunk's bounds
        for (let x = chunkStartX; x < chunkEndX; x++) {
            for (let y = chunkStartY; y < chunkEndY; y++) {
                for (let z = chunkStartZ; z < chunkEndZ; z++) {

                    // Check if the block coordinate is within the actual world data bounds
                    if (x >= 0 && x < this.worldWidth &&
                        y >= 0 && y < this.worldHeight &&
                        z >= 0 && z < this.worldDepth) {

                        const blockId = this.world[x][y][z]; // Get block ID from world data (null for air)

                        if (blockId !== null) { // If it's NOT an air block
                            const materials = this.blockMaterials[blockId]; // Get the pre-made materials

                            if (materials) {
                                // Reuse the globally defined block geometry
                                const blockMesh = new THREE.Mesh(this.blockGeometry, materials);

                                // Position the block relative to the chunk's origin
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
         chunkGroup.position.set(
             chunkStartX - this.worldWidth / 2,
             chunkStartY, // Y position of the chunk group matches its startY index in world data
             chunkStartZ - this.worldDepth / 2
         );

        // Add the chunk group to the scene
        this.scene.add(chunkGroup);

        // We are reusing the blockGeometry, so do NOT dispose it here.
        // this.blockGeometry.dispose();

        return chunkGroup; // Return the created group
    }


    // Disposes of a chunk mesh group and removes it from the scene
    disposeChunkMesh(chunkGroup) {
        this.scene.remove(chunkGroup);

        chunkGroup.traverse(object => {
            if (object.isMesh) {
                // Geometry is shared (this.blockGeometry), do NOT dispose it here.
                // if (object.geometry && object.geometry.dispose) {
                //     object.geometry.dispose();
                // }
                // Materials are shared from blockMaterials, do NOT dispose them here.
            }
        });
        // If you need to dispose the group itself:
        // if (chunkGroup.dispose) chunkGroup.dispose(); // THREE.Group doesn't have dispose
    }

     // Get the highest solid block Y coordinate
     getHighestSolidBlockY() {
        const highestSolidLayer = this.blockLayers.reduce((highest, layer) => {
             // Assuming layers are sorted or we find the max endY
             return layer.endY > highest ? layer.endY : highest;
        }, -1); // Start with -1 or similar if Y can be 0

         return highestSolidLayer >= 0 ? highestSolidLayer : 0; // Return highest Y or 0 if no solid layers
     }
}