// ----------------------------------
// Player Class
// ----------------------------------

class Player {
    constructor(camera, worldManager, scene, blockMaterials, blockDataMap, soundBasePath, soundCategories) {
        this.camera = camera;
        this.worldManager = worldManager;
        this.scene = scene;
        this.blockMaterials = blockMaterials;
        this.blockDataMap = blockDataMap;
        this.soundBasePath = soundBasePath; // Path from block.data
        this.soundCategories = soundCategories;


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

        this.chunkSizeX = 4;
        this.chunkSizeY = 4;
        this.chunkSizeZ = 4;
        this.renderDistance = 10;
        this.renderDistanceInChunks = Math.ceil(this.renderDistance / Math.min(this.chunkSizeX, this.chunkSizeY, this.chunkSizeZ)) + 1;

        this.loadedChunks = new Map();

        this.currentChunk = { x: null, y: null, z: null };

        // Raycaster for block interaction
        this.raycaster = new THREE.Raycaster();
        this.blockInteractionDistance = 8;
        this.raycaster.far = this.blockInteractionDistance;


        this.selectedBlockToPlaceId = '2';

        this.activeParticles = [];
        this.particleGeometry = new THREE.BoxGeometry(0.1, 0.1, 0.1);
        this.particleLifetime = 0.5;
        this.particleSpeed = 2;
        this.gravity = 9.8;

        this.blockParticleColors = {
            '1': new THREE.Color(0x87B53B),
            '2': new THREE.Color(0xA06640),
            '3': new THREE.Color(0x808080),
            '4': new THREE.Color(0x404040),
            '5': new THREE.Color(0x707070),
             null: new THREE.Color(0xFFFFFF)
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
                     this.handleBlockDestruction(); // Left Click to Destroy
                 } else if (event.button === 1) { // Middle mouse button
                      this.handleBlockSelection(); // Middle Click to Select
                 } else if (event.button === 2) { // Right mouse button
                      this.isRightMouseDown = true;
                      this.handleBlockPlacement(); // Right Click to Place
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

    // --- Block Interaction ---

    // Perform raycast and handle block destruction (Left Click)
    handleBlockDestruction() {
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

             // Check distance to the hit block
             const distanceToHit = this.position.distanceTo(blockWorldPosition);
             if (distanceToHit > this.blockInteractionDistance) {
                 console.log("Too far to destroy.");
                 return; // Exit if too far
             }


             // Convert block's physical world position back to world data indices
             const hitBlockWorldDataX = Math.floor(blockWorldPosition.x + this.worldManager.worldWidth / 2);
             const hitBlockWorldDataY = Math.floor(blockWorldPosition.y); // Y position directly maps to world data Y
             const hitBlockWorldDataZ = Math.floor(blockWorldPosition.z + this.worldManager.worldDepth / 2);


             if (hitBlockWorldDataX >= 0 && hitBlockWorldDataX < this.worldManager.worldWidth &&
                 hitBlockWorldDataY >= 0 && hitBlockWorldDataY < this.worldManager.worldHeight &&
                 hitBlockWorldDataZ >= 0 && hitBlockWorldDataZ < this.worldManager.worldDepth) {

                 // Get the block ID from the WorldManager's data
                 const blockIdAtHit = this.worldManager.getBlock(hitBlockWorldDataX, hitBlockWorldDataY, hitBlockWorldDataZ);

                 // --- Check if the block is breakable ---
                 let isBreakable = false;
                 const hitBlockDefinition = this.blockDataMap.get(blockIdAtHit);

                 if (blockIdAtHit === '4') { // Special rule for Bedrock
                     if (hitBlockWorldDataY === 0) {
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
                     console.log(`Destroying block at world data coords: ${hitBlockWorldDataX}, ${hitBlockWorldDataY}, ${hitBlockWorldDataZ}`);

                     // Create block breaking particles
                     this.createSimpleBreakParticles(blockWorldPosition.clone(), blockIdAtHit);

                     // Play block breaking sound effect
                     this.playBlockSound(blockIdAtHit); // Simplified call


                     // Set the block in the world data to null (Air Block) using WorldManager
                     if (this.worldManager.setBlock(hitBlockWorldDataX, hitBlockWorldDataY, hitBlockWorldDataZ, null)) {

                         const chunkCoords = this.getChunkCoords(blockWorldPosition);
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

        if (intersects.length > 0) {
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
             if (placeBlockWorldDataX >= 0 && placeBlockWorldDataX < this.worldManager.worldWidth &&
                 placeBlockWorldDataY >= 0 && placeBlockWorldDataY < this.worldManager.worldHeight &&
                 placeBlockWorldDataZ >= 0 && placeBlockWorldDataZ < this.worldManager.worldDepth) {

                  // Check if the target position is currently null (Air Block) using WorldManager
                 if (this.worldManager.getBlock(placeBlockWorldDataX, placeBlockWorldDataY, placeBlockWorldDataZ) === null) {

                     // Check that the selectedBlockToPlaceId is valid (not null and has materials)
                     if (this.selectedBlockToPlaceId !== null && this.blockMaterials[this.selectedBlockToPlaceId]) {

                         console.log(`Placing block ID ${this.selectedBlockToPlaceId} (${this.getBlockName(this.selectedBlockToPlaceId)}) at world data coords: ${placeBlockWorldDataX}, ${placeBlockWorldDataY}, ${placeBlockWorldDataZ}`);

                         // Set the block in the world data using WorldManager
                         if (this.worldManager.setBlock(placeBlockWorldDataX, placeBlockWorldDataY, placeBlockWorldDataZ, this.selectedBlockToPlaceId)) {

                             // Play block placement sound effect
                             this.playBlockSound(this.selectedBlockToPlaceId); // Simplified call

                             // Trigger a reload of the chunk containing the placed block
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
                          console.log(`Cannot place block: Invalid selected block ID '${this.selectedBlockToPlaceId}'.`);
                     }
                 } else {
                     console.log("Cannot place block: Target position is not empty.");
                 }
             } else {
                 console.log("Cannot place block: Target position is out of bounds.");
             }
        } else {
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

              if (placeBlockWorldDataX >= 0 && placeBlockWorldDataX < this.worldManager.worldWidth &&
                 placeBlockWorldDataY >= 0 && placeBlockWorldDataY < this.worldManager.worldHeight &&
                 placeBlockWorldDataZ >= 0 && placeBlockWorldDataZ < this.worldManager.worldDepth &&
                 this.worldManager.getBlock(placeBlockWorldDataX, placeBlockWorldDataY, placeBlockWorldDataZ) === null &&
                  this.selectedBlockToPlaceId !== null && this.blockMaterials[this.selectedBlockToPlaceId]) {

                 console.log(`Placing block ID ${this.selectedBlockToPlaceId} in air at world data coords: ${placeBlockWorldDataX}, ${placeBlockWorldDataY}, ${placeBlockWorldDataZ}`);

                  if (this.worldManager.setBlock(placeBlockWorldDataX, placeBlockWorldDataY, placeBlockWorldDataZ, this.selectedBlockToPlaceId)) {
                     this.playBlockSound(this.selectedBlockToPlaceId); // Simplified call
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
                 // console.log("Cannot place block: No target hit or out of bounds/not empty/invalid block.");
              }
        }
    }

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
         const particleLifetime = 0.5;

         const particleColor = this.blockParticleColors[blockId] || this.blockParticleColors[null];


         for (let i = 0; i < numberOfParticles; i++) {
             const particleMaterial = new THREE.MeshBasicMaterial({ color: particleColor });

             const particleMesh = new THREE.Mesh(this.particleGeometry, particleMaterial);

             particleMesh.position.copy(position);
             particleMesh.position.x += (Math.random() - 0.5) * 0.5;
             particleMesh.position.y += (Math.random() - 0.5) * 0.5;
             particleMesh.position.z += (Math.random() - 0.5) * 0.5;

             const velocity = new THREE.Vector3(
                 (Math.random() - 0.5) * 2,
                 Math.random() * 1.5,
                 (Math.random() - 0.5) * 2
             ).normalize().multiplyScalar(particleSpeed);

             particleMesh.userData.velocity = velocity;
             particleMesh.userData.lifetime = particleLifetime;
             particleMesh.userData.startTime = performance.now();

             this.scene.add(particleMesh);
             this.activeParticles.push(particleMesh);
         }
    }


    updateParticles(deltaTime) {
        const particlesToRemove = [];
        const currentTime = performance.now();

        for (let i = 0; i < this.activeParticles.length; i++) {
            const particle = this.activeParticles[i];
            const velocity = particle.userData.velocity;

            velocity.y -= this.gravity * deltaTime;

            particle.position.x += velocity.x * deltaTime;
            particle.position.y += velocity.y * deltaTime;
            particle.position.z += velocity.z * deltaTime;

            const timeElapsed = (currentTime - particle.userData.startTime) / 1000;
            if (timeElapsed >= particle.userData.lifetime) {
                particlesToRemove.push(i);
            }
        }

        for (let i = particlesToRemove.length - 1; i >= 0; i--) {
            const index = particlesToRemove[i];
            const particle = this.activeParticles[index];

            this.scene.remove(particle);
            if (particle.geometry && particle.geometry.dispose) {
                particle.geometry.dispose();
            }
            if (particle.material && particle.material.dispose) {
                particle.material.dispose();
            }

            this.activeParticles.splice(index, 1);
        }
    }

    // --- Sound Effects ---

    // Play a block sound based on block ID
    // It will use the soundCategory defined for the block in block.data
    playBlockSound(blockId) {
        // Add a small delay before attempting to play the sound
        setTimeout(() => {
            const blockDefinition = this.blockDataMap.get(blockId);

            // Check if the block definition exists and has a sound category defined
            if (!blockDefinition || !blockDefinition.soundCategory) {
                // console.log(`No sound category defined for block ID ${blockId}. Skipping sound playback.`);
                return; // No sound defined or no category specified for this block
            }

            const soundCategoryName = blockDefinition.soundCategory;
            const soundCategory = this.soundCategories[soundCategoryName];

            if (!soundCategory || !soundCategory.baseName || !soundCategory.variations || soundCategory.variations.length === 0) {
                 console.warn(`Sound category '${soundCategoryName}' not defined or incomplete for block ID ${blockId}. Skipping sound playback.`);
                 return; // Sound category definition is missing or invalid
            }

            // Pick a random variation from the category
            const randomIndex = Math.floor(Math.random() * soundCategory.variations.length);
            const selectedVariation = soundCategory.variations[randomIndex];

            // Construct the full sound file name using the DOT format: baseName.variation.wav
            const soundFileName = `${soundCategory.baseName}.${selectedVariation}.wav`; // Use DOT
            const fullPath = `${this.soundBasePath}${soundFileName}`;

            console.log(`Attempting to play sound with delay: ${fullPath} for block ID ${blockId}.`);


            const audio = new Audio(fullPath);
            audio.volume = 0.5; // Adjust volume
            audio.play().then(() => {
                 console.log(`Sound playback started: ${fullPath}`);
            }).catch(error => {
                console.error(`Error playing sound ${fullPath}:`, error);
            });

             audio.onended = () => {
                 // console.log(`Sound finished: ${fullPath}`);
                 audio.remove();
             };
             audio.onerror = (e) => {
                  console.error(`Audio element error for ${fullPath}:`, e);
                  audio.remove();
             };
        }, 10); // 10 milliseconds delay (0.01 seconds)
    }


    update(deltaTime) {
        this.velocity.set(0, 0, 0);

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


        this.updateChunks();

        this.updateParticles(deltaTime);

        this.updateCamera();
    }

    updateCamera() {
        this.camera.position.copy(this.position);
        this.camera.rotation.copy(this.rotation);
    }

    getChunkCoords(position) {
         const worldDataX = position.x + this.worldManager.worldWidth / 2;
         const worldDataY = position.y;
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
        const chunkStartX = chunkCoords.x * this.chunkSizeX;
        const chunkStartY = chunkCoords.y * this.chunkSizeY;
        const chunkStartZ = chunkCoords.z * this.chunkSizeZ;

        const centerX = chunkStartX + this.chunkSizeX / 2;
        const centerY = chunkStartY + this.chunkSizeY / 2;
        const centerZ = chunkStartZ + this.chunkSizeZ / 2;

         const physicalCenterX = centerX - this.worldManager.worldWidth / 2;
         const physicalCenterY = centerY;
         const physicalCenterZ = centerZ - this.worldManager.worldDepth / 2;

        return new THREE.Vector3(physicalCenterX, physicalCenterY, physicalCenterZ);
    }


    updateChunks() {
        const playerChunk = this.getChunkCoords(this.position);

        if (playerChunk.x !== this.currentChunk.x ||
            playerChunk.y !== this.currentChunk.y ||
            playerChunk.z !== this.currentChunk.z ||
            this.currentChunk.x === null) {

            this.currentChunk = playerChunk;
            console.log(`Player moved to chunk: ${this.getChunkKey(this.currentChunk)}`);

            const chunksToKeep = new Set();

            const minChunkX = this.currentChunk.x - this.renderDistanceInChunks;
            const maxChunkX = this.currentChunk.x + this.renderDistanceInChunks;
             const minChunkY = Math.max(0, this.currentChunk.y - this.renderDistanceInChunks);
             const maxChunkY = Math.min(Math.floor((this.worldManager.worldHeight - 1) / this.chunkSizeY), this.currentChunk.y + this.renderDistanceInChunks);

            const minChunkZ = this.currentChunk.z - this.renderDistanceInChunks;
            const maxChunkZ = this.currentChunk.z + this.renderDistanceInChunks;


            for (let cx = minChunkX; cx <= maxChunkX; cx++) {
                for (let cy = minChunkY; cy <= maxChunkY; cy++) {
                    for (let cz = minChunkZ; cz <= maxChunkZ; cz++) {
                        const chunkCoords = { x: cx, y: cy, z: cz };
                        const chunkKey = this.getChunkKey(chunkCoords);

                        const chunkCenter = this.getChunkCenterPosition(chunkCoords);
                         const distanceToChunkCenter = this.position.distanceTo(chunkCenter);

                        if (distanceToChunkCenter <= this.renderDistance /* + buffer */) {
                             chunksToKeep.add(chunkKey);

                            if (!this.loadedChunks.has(chunkKey)) {
                                const chunkWorldDataStartX = chunkCoords.x * this.chunkSizeX;
                                const chunkWorldDataStartY = chunkCoords.y * this.chunkSizeY;
                                const chunkWorldDataStartZ = chunkCoords.z * this.chunkSizeZ;

                                 if (chunkWorldDataStartX < this.worldManager.worldWidth && chunkWorldDataStartY < this.worldManager.worldHeight && chunkWorldDataStartZ < this.worldManager.worldDepth) {
                                    console.log(`Loading chunk: ${chunkKey}`);
                                    const chunkMesh = this.worldManager.buildChunkMesh(chunkCoords);
                                    if (chunkMesh) {
                                         this.loadedChunks.set(chunkKey, chunkMesh);
                                    }
                                }
                            }
                        }
                    }
                }
            }

            const chunksToUnload = [];
            this.loadedChunks.forEach((chunkMesh, chunkKey) => {
                if (!chunksToKeep.has(chunkKey)) {
                    chunksToUnload.push(chunkKey);
                }
            });

            chunksToUnload.forEach(chunkKey => {
                 console.log(`Unloading chunk: ${chunkKey}`);
                 const chunkMesh = this.loadedChunks.get(chunkKey);
                 this.worldManager.disposeChunkMesh(chunkMesh);
                 this.loadedChunks.delete(chunkKey);
            });
        }
    }
}