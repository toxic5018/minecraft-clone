// ----------------------------------
// Player Class
// ----------------------------------

class Player {
    constructor(camera, worldManager, scene, blockMaterials, blockDataMap) {
        this.camera = camera;
        this.worldManager = worldManager; // Reference to WorldManager
        this.scene = scene;
        this.blockMaterials = blockMaterials;
        this.blockDataMap = blockDataMap;
        // Removed all sound data properties


        this.position = new THREE.Vector3();
        this.velocity = new THREE.Vector3();
        this.speed = 5;
        this.rotation = new THREE.Euler(0, 0, 0, 'YXZ');

        this.keys = {
            w: false, s: false, a: false, d: false,
            space: false, shift: false
        };
        this.isLeftMouseDown = false;
        this.isRightMouseDown = false;

        this.isMouseLookEnabled = false;
        this.sensitivity = 0.002;

        // Get chunk size from WorldManager (or keep hardcoded if preferred, but getting from WM is better)
        // Based on your provided chunk.js, chunk size is not explicitly defined as a property there
        // Let's use the hardcoded values that match your chunk.js buildChunkMesh loops
        this.chunkSizeX = 4;
        this.chunkSizeY = 4;
        this.chunkSizeZ = 4;
        // Updated default render distance to 16 as requested
        this.renderDistance = 16;
        this.renderDistanceInChunks = Math.ceil(this.renderDistance / Math.min(this.chunkSizeX, this.chunkSizeY, this.chunkSizeZ)) + 1;

        this.loadedChunks = new Map();

        this.currentChunk = { x: null, y: null, z: null };

        // Raycaster for block interaction
        this.raycaster = new THREE.Raycaster();
        // Set Block Interaction Distance to 10 (keep as is)
        this.blockInteractionDistance = 10;
        this.raycaster.far = this.blockInteractionDistance;


        this.selectedBlockToPlaceId = '2';

        // Particle Properties
        this.activeParticles = [];
        this.particleGeometry = new THREE.BoxGeometry(0.1, 0.1, 0.1);
        this.particleSpeed = 2;
        this.gravity = 20; // Increased gravity for faster falling effect

        // New particle properties for collision/resting
        this.particleRestingTime = 0.5; // How long particles stay after hitting something
        this.particleSize = 0.1; // Size of the particle cubes


        this.blockParticleColors = {
            '1': new THREE.Color(0x87B53B), // Grass
            '2': new THREE.Color(0xA06640), // Dirt
            '3': new THREE.Color(0x808080), // Stone
            '4': new THREE.Color(0x404040), // Bedrock
            '5': new THREE.Color(0x707070), // Cobblestone
             null: new THREE.Color(0xFFFFFF) // Default (shouldn't happen for break particles)
        };


        this.addInputListeners();

        this.updateCamera();
    }


    addInputListeners() {
        document.addEventListener('keydown', (event) => {
            this.handleKeyDown(event);
        });
        document.addEventListener('keyup', (event) => {
            this.handleKeyUp(event);
        });

        document.addEventListener('pointerlockchange', () => {
            this.isMouseLookEnabled = (document.pointerLockElement === renderer.domElement);
            console.log('Pointer Lock Status:', this.isMouseLookEnabled ? 'Locked' : 'Unlocked');
            if (!this.isMouseLookEnabled) {
                 this.keys = { w: false, s: false, a: false, d: false, space: false, shift: false };
                 this.isLeftMouseDown = false;
                 this.isRightMouseDown = false;
             }
        });

        document.addEventListener('pointerlockerror', () => {
            console.error('Pointer Lock Error');
        });

        renderer.domElement.addEventListener('click', () => {
             if (document.pointerLockElement !== renderer.domElement) {
                 renderer.domElement.requestPointerLock();
             }
        });

        document.addEventListener('mousemove', (event) => {
             if (this.isMouseLookEnabled) {
                 this.handleMouseMove(event.movementX, event.movementY);
             }
        });

        document.addEventListener('mousedown', (event) => {
             if (this.isMouseLookEnabled) {
                 if (event.button === 0) { // Left mouse button
                     this.isLeftMouseDown = true;
                     // Get the hit block before destruction logic
                     const hitBlock = this.getBlockAtRaycastTarget();

                     // Only play sound if a breakable block was hit within distance and is breakable
                     // Use the blockDefinition allowBreaking property for consistency
                      if (hitBlock) {
                          const hitBlockDefinition = this.blockDataMap.get(hitBlock.id);
                          const isBreakable = hitBlock.id !== '4' && hitBlockDefinition?.allowBreaking === true; // Check bedrock special case and allowBreaking

                          if(isBreakable) {
                             this.playBlockSound(hitBlock.id);
                          } else if (hitBlock.id === '4' && hitBlock.position.y > 0.5) {
                               // If hitting non-bottom bedrock, play sound too (adjust if bedrock sound is different)
                               this.playBlockSound(hitBlock.id);
                          }
                      }

                     this.handleBlockDestruction(); // Handle destruction logic AFTER getting block info


                 } else if (event.button === 1) { // Middle mouse button
                      this.handleBlockSelection(); // Middle Click to Select
                 } else if (event.button === 2) { // Right mouse button
                      this.isRightMouseDown = true;
                       // Placement sound is played after successful placement inside handleBlockPlacement
                       this.handleBlockPlacement(); // Handle placement logic
                 }
             }
        });

         document.addEventListener('contextmenu', (event) => {
             if (this.isMouseLookEnabled) {
                 event.preventDefault();
             }
         });

         document.addEventListener('mouseup', (event) => {
              if (this.isMouseLookEnabled) {
                  if (event.button === 0) {
                      this.isLeftMouseDown = false;
                  } else if (event.button === 2) {
                      this.isRightMouseDown = false;
                  }
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
        // Handle number keys 1-5 for block selection
        if (key >= '1' && key <= '5') {
             const blockIdMap = {
                 '1': '1', '2': '2', '3': '3', '4': '4', '5': '5'
             };
             const selectedId = blockIdMap[key];
             // Check if this block ID exists in blockMaterials (meaning it was loaded)
             if (selectedId && this.blockMaterials[selectedId]) {
                 this.selectedBlockToPlaceId = selectedId;
                 console.log(`Selected block to place: ID ${this.selectedBlockToPlaceId} (${this.getBlockName(this.selectedBlockToPlaceId)})`);
             } else if (selectedId) {
                  console.warn(`Block ID ${selectedId} not loaded. Cannot select.`);
             }
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
        this.rotation.y -= movementX * this.sensitivity;
        this.rotation.x -= movementY * this.sensitivity;

        const pi = Math.PI;
        this.rotation.x = Math.max(-pi / 2, Math.min(pi / 2, this.rotation.x));
    }

     // Helper method to get the block ID and position at the raycast target
     getBlockAtRaycastTarget() {
         this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);

         const objectsToTest = [];
         this.loadedChunks.forEach(chunkGroup => {
              chunkGroup.traverseVisible(object => {
                   if (object.isMesh) {
                       objectsToTest.push(object);
                   }
              });
         });

         const intersects = this.raycaster.intersectObjects(objectsToTest, true);

         if (intersects.length > 0) {
             const hitObject = intersects[0].object;
             const blockWorldPosition = hitObject.getWorldPosition(new THREE.Vector3());

              // Check distance
              const distanceToHit = this.position.distanceTo(blockWorldPosition);
              if (distanceToHit > this.blockInteractionDistance) {
                  return null; // Too far
              }

             // Convert to world data indices (adjusting for world center offset)
             const hitBlockWorldDataX = Math.floor(blockWorldPosition.x + this.worldManager.worldWidth / 2);
             const hitBlockWorldDataY = Math.floor(blockWorldPosition.y); // Y is not offset
             const hitBlockWorldDataZ = Math.floor(blockWorldPosition.z + this.worldManager.worldDepth / 2);


              // Check if within world bounds based on worldData indices
              if (hitBlockWorldDataX >= 0 && hitBlockWorldDataX < this.worldManager.worldWidth &&
                 hitBlockWorldDataY >= 0 && hitBlockWorldDataY < this.worldManager.worldHeight &&
                 hitBlockWorldDataZ >= 0 && hitBlockWorldDataZ < this.worldManager.worldDepth) {

                 const blockIdAtHit = this.worldManager.getBlock(hitBlockWorldDataX, hitBlockWorldDataY, hitBlockWorldDataZ);
                 // Return the block ID and its physical world position
                 return { id: blockIdAtHit, position: blockWorldPosition };
              }
         }
         return null; // No block hit or out of bounds
     }


    // --- Block Interaction ---

    // Perform raycast and handle block destruction (Left Click)
    handleBlockDestruction() {
         const hitBlock = this.getBlockAtRaycastTarget();

        if (hitBlock) {
             const blockIdAtHit = hitBlock.id;
             const blockWorldPosition = hitBlock.position; // Use the position from the helper


             // --- Check if the block is breakable ---
             let isBreakable = false;
             const hitBlockDefinition = this.blockDataMap.get(blockIdAtHit);

             if (blockIdAtHit === '4') { // Special rule for Bedrock
                 // Check if it's at the bottom layer (y=0 in world data, which is physical y <= 0.5)
                 if (blockWorldPosition.y <= 0.5) {
                     console.log("Cannot destroy bottom layer Bedrock!");
                     isBreakable = false; // Explicitly not breakable at y=0
                 } else {
                      console.log("Breaking non-bottom layer Bedrock (for testing/future features).");
                      isBreakable = true; // Breakable at higher Y for demo
                 }
             } else if (hitBlockDefinition && hitBlockDefinition.allowBreaking === true) {
                 // Not bedrock, check the allowBreaking property in blockData
                 isBreakable = true;
             } else {
                 // Not bedrock, or allowBreaking is false/missing
                  console.log(`Cannot destroy ${this.getBlockName(blockIdAtHit)}.`);
                 isBreakable = false;
             }


             if (isBreakable) {
                 // Convert block's physical world position back to world data indices for setBlock
                 const hitBlockWorldDataX = Math.floor(blockWorldPosition.x + this.worldManager.worldWidth / 2);
                 const hitBlockWorldDataY = Math.floor(blockWorldPosition.y); // Y position directly maps to world data Y
                 const hitBlockWorldDataZ = Math.floor(blockWorldPosition.z + this.worldManager.worldDepth / 2);

                 console.log(`Destroying block at world data coords: ${hitBlockWorldDataX}, ${hitBlockWorldDataY}, ${hitBlockWorldDataZ}`);

                 // Create block breaking particles BEFORE setting block to null
                 this.createSimpleBreakParticles(blockWorldPosition.clone(), blockIdAtHit);

                 // Sound Playback is handled by mousedown listener calling playBlockSound


                 // Set the block in the world data to null (Air Block) using WorldManager
                 if (this.worldManager.setBlock(hitBlockWorldDataX, hitBlockWorldDataY, hitBlockWorldDataZ, null)) {

                     const chunkCoords = this.getChunkCoords(blockWorldPosition);
                     const chunkKey = this.getChunkKey(chunkCoords);

                     // Remove and rebuild the chunk mesh to reflect the change
                     if (this.loadedChunks.has(chunkKey)) {
                         const oldChunkMesh = this.loadedChunks.get(chunkKey);
                         this.worldManager.disposeChunkMesh(oldChunkMesh);
                         this.loadedChunks.delete(chunkKey);
                     }

                     const newChunkMesh = this.worldManager.buildChunkMesh(chunkCoords);
                     if (newChunkMesh) {
                         this.loadedChunks.set(chunkKey, newChunkMesh);
                     }
                 }
             }
        }
    }

    // Perform raycast and handle block placement (Right Click)
    handleBlockPlacement() {
         this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);

         const objectsToTest = [];
         this.loadedChunks.forEach(chunkGroup => {
              chunkGroup.traverseVisible(object => {
                   if (object.isMesh) {
                        objectsToTest.push(object);
                   }
              });
         });

        const intersects = this.raycaster.intersectObjects(objectsToTest, true);

        if (intersects.length > 0) { // --- Start of if (intersects.length > 0) block ---
            const hitPoint = intersects[0].point;
            const hitFaceNormal = intersects[0].face.normal;

            const placePosition = new THREE.Vector3().copy(hitPoint).add(hitFaceNormal.clone().multiplyScalar(0.5));

            // Check distance to the placement position (derived from hit block)
            const distanceToPlace = this.position.distanceTo(placePosition);
             // Subtract a small epsilon to allow placing right next to a block
             if (distanceToPlace > this.blockInteractionDistance + 0.1) {
                 console.log("Too far to place.");
                 return; // Exit if too far
             }


            // Convert placement physical position to world data coordinates
            const placeBlockWorldDataX = Math.floor(placePosition.x + this.worldManager.worldWidth / 2);
            const placeBlockWorldDataY = Math.floor(placePosition.y);
            const placeBlockWorldDataZ = Math.floor(placePosition.z + this.worldManager.worldDepth / 2);


             // --- Placement Validation ---
             // Check if within world bounds AND target position is currently air
             if (placeBlockWorldDataX >= 0 && placeBlockWorldDataX < this.worldManager.worldWidth &&
                 placeBlockWorldDataY >= 0 && placeBlockWorldDataY < this.worldManager.worldHeight &&
                 placeBlockWorldDataZ >= 0 && placeBlockWorldDataZ < this.worldManager.worldDepth &&
                 this.worldManager.getBlock(placeBlockWorldDataX, placeBlockWorldDataY, placeBlockWorldDataZ) === null) {

                  // Check that the selectedBlockToPlaceId is valid (not null and has materials)
                 if (this.selectedBlockToPlaceId !== null && this.blockMaterials[this.selectedBlockToPlaceId]) {

                     console.log(`Placing block ID ${this.selectedBlockToPlaceId} (${this.getBlockName(this.selectedBlockToPlaceId)}) at world data coords: ${placeBlockWorldDataX}, ${placeBlockWorldDataY}, ${placeBlockWorldDataZ}`);

                     // Sound Playback is handled by mousedown listener calling playBlockSound


                     // Set the block in the world data using WorldManager
                     if (this.worldManager.setBlock(placeBlockWorldDataX, placeBlockWorldDataY, placeBlockWorldDataZ, this.selectedBlockToPlaceId)) {

                         // After successful placement, trigger the sound
                         this.playBlockSound(this.selectedBlockToPlaceId);


                         // Trigger a reload of the chunk containing the placed block
                         const chunkCoords = {
                             x: Math.floor(placeBlockWorldDataX / this.chunkSizeX),
                             y: Math.floor(placeBlockWorldDataY / this.chunkSizeY),
                             z: Math.floor(placeBlockWorldDataZ / this.chunkSizeZ)
                         };
                         const chunkKey = this.getChunkKey(chunkCoords);

                         // Remove and rebuild the chunk mesh to reflect the change
                         if (this.loadedChunks.has(chunkKey)) {
                             const oldChunkMesh = this.loadedChunks.get(chunkKey);
                             this.worldManager.disposeChunkMesh(oldChunkMesh);
                             this.loadedChunks.delete(chunkKey);
                         }

                         const newChunkMesh = this.worldManager.buildChunkMesh(chunkCoords);
                         if (newChunkMesh) {
                             this.loadedChunks.set(chunkKey, newChunkMesh);
                         }
                     }
                 } else {
                      console.log(`Cannot place block: Invalid selected block ID '${this.selectedBlockToPlaceId}'.`);
                 }
             } else { // Placement position is not empty or out of bounds (checked in the outer if condition)
                 console.log("Cannot place block: Target position is not empty or out of bounds."); // Corrected log message
             }
         } else { // --- Else block for when raycast finds no intersection (placing in air) ---
             // console.log("Raycast missed a block, attempting to place in air."); // Optional log

             // Optional: If right-click misses a block, allow placing in the air up to the distance limit
             const lookDirection = new THREE.Vector3(0,0,-1).applyEuler(this.rotation);
             const placePosition = new THREE.Vector3().copy(this.position).add(lookDirection.multiplyScalar(this.blockInteractionDistance));

             // Check distance to this air placement position
              const distanceToPlace = this.position.distanceTo(placePosition);
              if (distanceToPlace > this.blockInteractionDistance + 0.1) { // +0.1 epsilon for floating point
                  console.log("Too far to place in air.");
                  return;
              }


             const placeBlockWorldDataX = Math.floor(placePosition.x + this.worldManager.worldWidth / 2);
             const placeBlockWorldDataY = Math.floor(placePosition.y);
             const placeBlockWorldDataZ = Math.floor(placePosition.z + this.worldManager.worldDepth / 2);

              // Check if within world bounds AND target position is currently air
              if (placeBlockWorldDataX >= 0 && placeBlockWorldDataX < this.worldManager.worldWidth &&
                 placeBlockWorldDataY >= 0 && placeBlockWorldDataY < this.worldManager.worldHeight &&
                 placeBlockWorldDataZ >= 0 && placeBlockWorldDataZ < this.worldManager.worldDepth &&
                 this.worldManager.getBlock(placeBlockWorldDataX, placeBlockWorldDataY, placeBlockWorldDataZ) === null &&
                  this.selectedBlockToPlaceId !== null && this.blockMaterials[this.selectedBlockToPlaceId]) {

                 console.log(`Placing block ID ${this.selectedBlockToPlaceId} in air at world data coords: ${placeBlockWorldDataX}, ${placeBlockWorldDataY}, ${placeBlockWorldDataZ}`);

                  // Sound Playback is handled by mousedown listener calling playBlockSound

                  if (this.worldManager.setBlock(placeBlockWorldDataX, placeBlockWorldDataY, placeBlockWorldDataZ, this.selectedBlockToPlaceId)) {

                     // After successful placement, trigger the sound
                     this.playBlockSound(this.selectedBlockToPlaceId);

                     const chunkCoords = {
                         x: Math.floor(placeBlockWorldDataX / this.chunkSizeX),
                         y: Math.floor(placeBlockWorldDataY / this.chunkSizeY),
                         z: Math.floor(placeBlockWorldDataZ / this.chunkSizeZ)
                     };
                     const chunkKey = this.getChunkKey(chunkCoords);
                     if (this.loadedChunks.has(chunkKey)) {
                         const oldChunkMesh = this.loadedChunks.get(chunkKey);
                         this.worldManager.disposeChunkMesh(oldChunkMesh);
                         this.loadedChunks.delete(chunkKey);
                     }
                     const newChunkMesh = this.worldManager.buildChunkMesh(chunkCoords);
                     if (newChunkMesh) {
                         this.loadedChunks.set(chunkKey, newChunkMesh);
                     }
                 }

              } else {
                 // console.log("Cannot place block in air: Target position out of bounds/not empty/invalid block."); // Corrected log
              }
        } // --- End of else block for when raycast finds no intersection ---
    } // --- End of handleBlockPlacement function ---

    // Perform raycast and handle block selection (Middle Click)
    handleBlockSelection() {
        this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);

        const objectsToTest = [];
        this.loadedChunks.forEach(chunkGroup => {
             chunkGroup.traverseVisible(object => {
                  if (object.isMesh) {
                       objectsToTest.push(object);
                   }
              });
         });

        const intersects = this.raycaster.intersectObjects(objectsToTest, true);

        if (intersects.length > 0) {
            const hitObject = intersects[0].object;

             // Check distance to the hit block
             const distanceToHit = this.position.distanceTo(hitObject.getWorldPosition(new THREE.Vector3()));
              if (distanceToHit > this.blockInteractionDistance) {
                 console.log("Too far to select.");
                 return; // Exit if too far
              }

             const blockWorldPosition = hitObject.getWorldPosition(new THREE.Vector3());

             const hitBlockWorldDataX = Math.floor(blockWorldPosition.x + this.worldManager.worldWidth / 2);
             const hitBlockWorldDataY = Math.floor(blockWorldPosition.y);
             const hitBlockWorldDataZ = Math.floor(blockWorldPosition.z + this.worldManager.worldDepth / 2);


             if (hitBlockWorldDataX >= 0 && hitBlockWorldDataX < this.worldManager.worldWidth &&
                 hitBlockWorldDataY >= 0 && hitBlockWorldDataY < this.worldManager.worldHeight &&
                 hitBlockWorldDataZ >= 0 && hitBlockWorldDataZ < this.worldManager.worldDepth) {

                 const blockIdAtHit = this.worldManager.getBlock(hitBlockWorldDataX, hitBlockWorldDataY, hitBlockWorldDataZ);

                 if (blockIdAtHit !== null) { // If the hit position is not air
                      if (this.blockMaterials[blockIdAtHit]) {
                          this.selectedBlockToPlaceId = blockIdAtHit;
                          console.log(`Selected block: ID ${this.selectedBlockToPlaceId} (${this.getBlockName(this.selectedBlockToPlaceId)})`);
                      } else {
                           console.warn(`Block ID ${blockIdAtHit} not loaded. Cannot select.`);
                      }
                 } else {
                      console.log("Selected block: Air");
                 }
             }
        }
    }


    // Get block name from ID using blockDataMap
    getBlockName(blockId) {
        if (blockId === null) return 'Air';

        const blockDefinition = this.blockDataMap.get(blockId);
        return blockDefinition ? blockDefinition.name : `ID ${blockId} (Unknown)`;
    }


    // --- Simple Block Breaking Particles ---

    createSimpleBreakParticles(position, blockId) {
         const numberOfParticles = 10;
         const particleSpeed = 2;
         const particleLifetime = 0.5; // Keep for time-based removal if no collision
         const particleSize = 0.1; // Size of the particle cubes


         const particleColor = this.blockParticleColors[blockId] || this.blockParticleColors[null];


         for (let i = 0; i < numberOfParticles; i++) {
             const particleMaterial = new THREE.MeshBasicMaterial({ color: particleColor });

             const particleMesh = new THREE.Mesh(this.particleGeometry, particleMaterial);

             particleMesh.position.copy(position);
             // Offset initial position slightly randomly around the break point
             particleMesh.position.x += (Math.random() - 0.5) * 0.5;
             particleMesh.position.y += (Math.random() - 0.5) * 0.5;
             particleMesh.position.z += (Math.random() - 0.5) * 0.5;

             const velocity = new THREE.Vector3(
                 (Math.random() - 0.5) * 2, // X velocity
                 Math.random() * 1.5 + 1, // Y velocity (make them go up initially)
                 (Math.random() - 0.5) * 2 // Z velocity
             ).normalize().multiplyScalar(particleSpeed);

             particleMesh.userData.velocity = velocity;
             particleMesh.userData.isResting = false; // New flag
             particleMesh.userData.restingTimer = 0; // Timer after hitting ground
             particleMesh.userData.particleSize = particleSize; // Store size for collision
             particleMesh.userData.initialStartTime = performance.now(); // Store start time


             this.scene.add(particleMesh);
             this.activeParticles.push(particleMesh);
         }
    }


    updateParticles(deltaTime) {
        const particlesToRemove = [];
        const currentTime = performance.now();

        for (let i = 0; i < this.activeParticles.length; i++) {
            const particle = this.activeParticles[i];

            if (particle.userData.isResting) {
                // If resting, just tick the resting timer
                particle.userData.restingTimer += deltaTime;
                // Optional: Fade out the particle visually here if desired (adjust material transparency)

                if (particle.userData.restingTimer >= this.particleRestingTime) {
                    particlesToRemove.push(i); // Mark for removal after resting time
                }
            } else {
                 // Check initial lifetime even if not resting (prevents floating forever)
                const timeElapsedInAir = (currentTime - particle.userData.initialStartTime) / 1000;
                 if (timeElapsedInAir >= this.particleLifetime * 2) { // Give them double normal life if they don't hit anything
                     particlesToRemove.push(i);
                      continue; // Skip rest of update for this particle
                 }


                // Apply gravity
                particle.userData.velocity.y -= this.gravity * deltaTime;

                // Calculate the next potential position
                const nextPosition = particle.position.clone().add(particle.userData.velocity.clone().multiplyScalar(deltaTime));

                // --- Simple Collision Detection ---
                // Check the block at the next potential position and slightly below
                const checkPositions = [
                     nextPosition, // Check at the next calculated position
                     new THREE.Vector3(nextPosition.x, nextPosition.y - particle.userData.particleSize / 2, nextPosition.z), // Check slightly below
                     new THREE.Vector3(nextPosition.x, particle.position.y - particle.userData.particleSize / 2, nextPosition.z) // Check below current Y, at next XZ
                ];

                let hitSolidBlock = false;
                let hitBlockY = -1; // To store the Y coordinate of the block hit

                 for(const checkPos of checkPositions) {
                     const blockX = Math.floor(checkPos.x + this.worldManager.worldWidth / 2);
                     const blockY = Math.floor(checkPos.y);
                     const blockZ = Math.floor(checkPos.z + this.worldManager.worldDepth / 2);

                      // Check if within world data bounds and if the block is solid
                     if (blockX >= 0 && blockX < this.worldManager.worldWidth &&
                         blockY >= 0 && blockY < this.worldManager.worldHeight &&
                         blockZ >= 0 && blockZ < this.worldManager.worldDepth) {

                         if (this.worldManager.getBlock(blockX, blockY, blockZ) !== null) {
                              hitSolidBlock = true;
                              hitBlockY = blockY;
                              break; // Found a collision, no need to check other positions
                         }
                     } else if (blockY < 0) { // Treat falling below the world as hitting the bottom (bedrock)
                          hitSolidBlock = true;
                          hitBlockY = -1; // Indicate hitting below the world
                          break;
                     }
                 }


                if (hitSolidBlock) {
                    // Collision detected!
                    particle.userData.isResting = true;
                    particle.userData.velocity.set(0, 0, 0); // Stop movement
                    particle.userData.restingTimer = 0; // Start the resting timer

                    // Snap particle position to rest on top of the block it hit
                     if(hitBlockY >= 0) { // If hit a block within the world
                         // The block surface is at Y = hitBlockY + 0.5 (center of the block)
                         // Particle's bottom edge should be at Y = hitBlockY + 0.5
                         // Particle's center should be at Y = hitBlockY + 0.5 + particleSize / 2
                         particle.position.y = hitBlockY + 0.5 + particle.userData.particleSize / 2;
                     } else { // If hit below the world (bedrock/bottom)
                         particle.position.y = 0.5 + particle.userData.particleSize / 2; // Snap to top of bedrock layer (assuming bedrock is at y=0 with height 1)
                     }


                    // Optional: Randomize final horizontal position slightly
                    particle.position.x += (Math.random() - 0.5) * 0.05;
                    particle.position.z += (Math.random() - 0.5) * 0.05;


                } else {
                    // No collision, update position
                    particle.position.copy(nextPosition);

                    // If particle falls below the world (e.g., fell off edge), remove it
                    if (particle.position.y < -5) { // A threshold below minimum block Y
                         particlesToRemove.push(i);
                    }
                }
            }
        }

        // Remove particles marked for removal (iterate backwards)
        for (let i = particlesToRemove.length - 1; i >= 0; i--) {
            const index = particlesToRemove[i];
            const particle = this.activeParticles[index];

            this.scene.remove(particle);
            if (particle.geometry && particle.geometry.dispose) {
                particle.geometry.dispose();
            }
             // Materials are shared, so don't dispose them here
            // if (particle.material && particle.material.dispose) {
            //     particle.material.dispose();
            // }

            this.activeParticles.splice(index, 1);
        }
    }

    // --- Sound Effects ---

    // Play a block sound based on block ID and a random variation (1-4)
    playBlockSound(blockId) {
        let soundPrefix = '';

        // Determine sound prefix based on block ID
        if (blockId === '1') { // Grass
            soundPrefix = 'block-grass';
        } else if (blockId === '2') { // Dirt (using gravel sound as requested)
             soundPrefix = 'block-gravel';
        } else if (blockId === '3' || blockId === '4' || blockId === '5') { // Stone, Bedrock, Cobblestone
            soundPrefix = 'block-stone';
        } else {
            // No sound defined for this block type
            // console.log(`No sound prefix defined for block ID: ${blockId}`);
            return;
        }

        // Select a random variation from 1 to 4
        const randomVariation = Math.floor(Math.random() * 4) + 1; // Generates 1, 2, 3, or 4

        // Construct the full sound file path
        const soundFilePath = `assets/sounds/${soundPrefix}_${randomVariation}.ogg`;

         console.log(`Attempting to play sound: ${soundFilePath}`); // Log the path being attempted

         const audio = new Audio(soundFilePath);
        audio.volume = 0.5; // Adjust volume
        audio.play().then(() => {
             // console.log(`Sound playback started successfully for ${soundFilePath}.`);
        }).catch(error => {
            console.error(`Error playing sound ${soundFilePath}:`, error);
            // This will likely report the 404 error if the file isn't found
        });

         // Optional: Clean up the audio element after it finishes playing
         audio.onended = () => {
             // console.log(`Sound finished: ${soundFilePath}`);
             audio.remove(); // Remove the element from memory
         };
          audio.onerror = (e) => {
               console.error(`Audio element error for ${soundFilePath}:`, e);
               audio.remove(); // Remove the element even on error
          };
    }


    update(deltaTime) {
        // --- Player Movement (Affected by World Border) ---
        const moveVector = new THREE.Vector3(0, 0, 0);
        const forward = new THREE.Vector3(0, 0, -1).applyEuler(this.rotation);
        const right = new THREE.Vector3(1, 0, 0).applyEuler(this.rotation);

        if (this.keys.w) moveVector.add(forward);
        if (this.keys.s) moveVector.sub(forward);
        if (this.keys.a) moveVector.sub(right);
        if (this.keys.d) moveVector.add(right);

        // Vertical movement
        if (this.keys.space) moveVector.y += 1;
        if (this.keys.shift) moveVector.y -= 1;

        const horizontalMovement = new THREE.Vector3(moveVector.x, 0, moveVector.z);
        if (horizontalMovement.lengthSq() > 0) {
            horizontalMovement.normalize().multiplyScalar(this.speed * deltaTime);
            moveVector.x = horizontalMovement.x;
            moveVector.z = horizontalMovement.z;
        } else {
             moveVector.x = 0;
             moveVector.z = 0;
        }

        moveVector.y *= this.speed * deltaTime;

        // Calculate the next potential position
        const nextPosition = this.position.clone().add(moveVector);

        // --- World Border Check ---
         // World data coordinates range from 0 to worldDim - 1
         // Physical coordinates are centered, ranging from -worldDim/2 to +worldDim/2
         // Player position is in physical coordinates

         const halfWorldWidth = this.worldManager.worldWidth / 2;
         const halfWorldDepth = this.worldManager.worldDepth / 2;
         const worldHeight = this.worldManager.worldHeight;


         // Clamp the next position within physical world bounds
         nextPosition.x = Math.max(-halfWorldWidth, Math.min(nextPosition.x, halfWorldWidth - 0.1)); // -0.1 to stay slightly inside
         nextPosition.y = Math.max(0.1, Math.min(nextPosition.y, worldHeight - 1.1)); // 0.1 above bottom, 1.1 below top (approx player height)
         nextPosition.z = Math.max(-halfWorldDepth, Math.min(nextPosition.z, halfWorldDepth - 0.1)); // -0.1 to stay slightly inside


        // Update the player's position to the clamped next position
        this.position.copy(nextPosition);


        this.updateChunks();

        this.updateParticles(deltaTime); // Call updateParticles in the main update loop

        this.updateCamera();
    }

    updateCamera() {
        this.camera.position.copy(this.position);
        this.camera.rotation.copy(this.rotation);
    }

    // Get chunk coordinates from player's physical position
    getChunkCoords(position) {
         // Convert physical X, Z to world data X, Z
         const worldDataX = position.x + this.worldManager.worldWidth / 2;
         const worldDataY = position.y; // Y is not offset
         const worldDataZ = position.z + this.worldManager.worldDepth / 2;

        return {
            x: Math.floor(worldDataX / this.chunkSizeX),
            y: Math.floor(worldDataY / this.chunkSizeY),
            z: Math.floor(worldDataZ / this.chunkSizeZ)
        };
    }

    getChunkKey(chunkCoords) {
        return `${chunkCoords.x},${chunkCoords.y},${chunkCoords.z}`;
    }

    getChunkCenterPosition(chunkCoords) {
        const chunkWorldDataStartX = chunkCoords.x * this.chunkSizeX;
        const chunkWorldDataStartY = chunkCoords.y * this.chunkSizeY;
        const chunkWorldDataStartZ = chunkCoords.z * this.chunkSizeZ;

        // Calculate the center of the chunk in world data coordinates
        const centerX = chunkWorldDataStartX + this.chunkSizeX / 2;
        const centerY = chunkWorldDataStartY + this.chunkSizeY / 2;
        const centerZ = chunkWorldDataStartZ + this.chunkSizeZ / 2;

         // Convert the center from world data coordinates back to physical coordinates (centered at 0,0,0)
         const physicalCenterX = centerX - this.worldManager.worldWidth / 2;
         const physicalCenterY = centerY; // Y position in physical space matches world data Y (relative to bottom 0)
         const physicalCenterZ = centerZ - this.worldManager.worldDepth / 2;

        return new THREE.Vector3(physicalCenterX, physicalCenterY, physicalCenterZ);
    }


    updateChunks() {
        const playerChunk = this.getChunkCoords(this.position);

        // Only update chunks if the player has moved to a different chunk or it's the first update
        if (playerChunk.x !== this.currentChunk.x ||
            playerChunk.y !== this.currentChunk.y || // Check Y chunk change too
            playerChunk.z !== this.currentChunk.z ||
            this.currentChunk.x === null) { // Check if it's the initial load

            this.currentChunk = playerChunk;
            // console.log(`Player moved to chunk: ${this.getChunkKey(this.currentChunk)}`); // Too chatty


            const chunksToKeep = new Set();

            // Calculate the range of chunk coordinates based on render distance in chunks
            const minChunkX = this.currentChunk.x - this.renderDistanceInChunks;
            const maxChunkX = this.currentChunk.x + this.renderDistanceInChunks;
             // Clamp Y chunk range to stay within world height chunk bounds
             const minChunkY = Math.max(0, this.currentChunk.y - this.renderDistanceInChunks);
             const maxChunkY = Math.min(Math.floor((this.worldManager.worldHeight - 1) / this.chunkSizeY), this.currentChunk.y + this.renderDistanceInChunks);

            const minChunkZ = this.currentChunk.z - this.renderDistanceInChunks;
            const maxChunkZ = this.currentChunk.z + this.renderDistanceInChunks;


            // Iterate through the potential chunk coordinates within the square render distance
            for (let cx = minChunkX; cx <= maxChunkX; cx++) {
                for (let cy = minChunkY; cy <= maxChunkY; cy++) {
                    for (let cz = minChunkZ; cz <= maxChunkZ; cz++) {
                        const chunkCoords = { x: cx, y: cy, z: cz };
                        const chunkKey = this.getChunkKey(chunkCoords);

                        // Calculate the distance from the player to the center of the chunk
                        const chunkCenter = this.getChunkCenterPosition(chunkCoords);
                         const distanceToChunkCenter = this.position.distanceTo(chunkCenter);


                        // --- Circular Render Distance Check ---
                        // If the distance is within the render distance radius
                        if (distanceToChunkCenter <= this.renderDistance) {
                             chunksToKeep.add(chunkKey); // Mark this chunk to be kept

                            // If the chunk is not already loaded
                            if (!this.loadedChunks.has(chunkKey)) {
                                // Check if chunk's world data start is within overall world data bounds
                                const chunkWorldDataStartX = chunkCoords.x * this.chunkSizeX;
                                const chunkWorldDataStartY = chunkCoords.y * this.chunkSizeY;
                                const chunkWorldDataStartZ = chunkCoords.z * this.chunkSizeZ;

                                 if (chunkWorldDataStartX < this.worldManager.worldWidth && chunkWorldDataStartY < this.worldManager.worldHeight && chunkWorldDataStartZ < this.worldManager.worldDepth) {
                                    // console.log(`Loading chunk: ${chunkKey}`); // Too chatty
                                    // Build the chunk mesh using the WorldManager
                                    const chunkMesh = this.worldManager.buildChunkMesh(chunkCoords);
                                    // If a mesh was successfully created (chunk is not empty)
                                    if (chunkMesh) {
                                         // Store the chunk mesh in the loadedChunks map
                                         this.loadedChunks.set(chunkKey, chunkMesh);
                                    }
                                }
                            }
                        }
                    }
                }
            }

            // Identify chunks that are currently loaded but are no longer within the render distance
            const chunksToUnload = [];
            this.loadedChunks.forEach((chunkMesh, chunkKey) => {
                if (!chunksToKeep.has(chunkKey)) {
                    chunksToUnload.push(chunkKey); // Mark for unloading
                }
            });

            // Unload chunks that are outside the render distance
            chunksToUnload.forEach(chunkKey => {
                 // console.log(`Unloading chunk: ${chunkKey}`); // Too chatty
                 const chunkMesh = this.loadedChunks.get(chunkKey);
                 this.worldManager.disposeChunkMesh(chunkMesh); // Dispose of the mesh
                 this.loadedChunks.delete(chunkKey); // Remove from the map
            });
        }
    }
} // --- End of Player class ---