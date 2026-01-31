/**
 * Soccer Runner - Style jak na obrazku
 * Niebieski tor, pomarańczowe pachołki, góry w tle
 */

class SoccerGame {
    constructor(container, options = {}) {
        this.container = container;
        this.onScore = options.onScore || null;
        this.onGameOver = options.onGameOver || null;
        this.onSpeedChange = options.onSpeedChange || null;

        this.isRunning = false;
        this.isPaused = false;
        this.score = 0;

        // Speed
        this.baseSpeed = 20;
        this.currentSpeed = this.baseSpeed;
        this.maxSpeed = 50;

        // Player
        this.playerX = 0;
        this.targetPlayerX = 0;
        this.playerLerpSpeed = 12;
        this.trackWidth = 4;

        // Three.js
        this.scene = null;
        this.camera = null;
        this.renderer = null;

        // Objects
        this.ball = null;
        this.obstacles = [];
        this.trackStripes = [];
        this.passedObstacles = new Set();

        // Timing
        this.clock = new THREE.Clock();
        this.lastSpawnZ = 0;
        this.spawnInterval = 8;
    }

    init() {
        this.createScene();
        this.createLights();
        this.createEnvironment();
        this.createTrack();
        this.createBall();

        window.addEventListener('resize', () => this.onResize());
        this.renderer.render(this.scene, this.camera);
    }

    createScene() {
        this.scene = new THREE.Scene();

        // Gradient sky (dark blue at top)
        this.scene.background = new THREE.Color(0x1a3a5c);
        this.scene.fog = new THREE.Fog(0x8fc5e8, 50, 150);

        // Camera - NISKO i BLISKO jak na obrazku
        this.camera = new THREE.PerspectiveCamera(
            75,  // Duży FOV = mocna perspektywa
            this.container.clientWidth / this.container.clientHeight,
            0.1,
            200
        );
        this.camera.position.set(0, 1.8, 5);
        this.camera.lookAt(0, 0.5, -20);

        // Renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        this.container.appendChild(this.renderer.domElement);
    }

    createLights() {
        // Ambient - jasne
        const ambient = new THREE.AmbientLight(0xffffff, 0.7);
        this.scene.add(ambient);

        // Sun
        const sun = new THREE.DirectionalLight(0xffffff, 0.8);
        sun.position.set(10, 30, 20);
        sun.castShadow = true;
        sun.shadow.mapSize.width = 2048;
        sun.shadow.mapSize.height = 2048;
        sun.shadow.camera.near = 1;
        sun.shadow.camera.far = 100;
        sun.shadow.camera.left = -30;
        sun.shadow.camera.right = 30;
        sun.shadow.camera.top = 30;
        sun.shadow.camera.bottom = -30;
        this.scene.add(sun);

        // Hemisphere light for sky color
        const hemi = new THREE.HemisphereLight(0x87ceeb, 0xe0f4ff, 0.4);
        this.scene.add(hemi);
    }

    createEnvironment() {
        // Ground - jasnoniebieski/biały śnieg
        const groundGeo = new THREE.PlaneGeometry(300, 300);
        const groundMat = new THREE.MeshLambertMaterial({ color: 0xe8f4fc });
        const ground = new THREE.Mesh(groundGeo, groundMat);
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = -0.01;
        ground.receiveShadow = true;
        this.scene.add(ground);

        // Mountains in background
        this.createMountains();
    }

    createMountains() {
        const mountainMaterial = new THREE.MeshLambertMaterial({ color: 0x2d4a6a });
        const snowMaterial = new THREE.MeshLambertMaterial({ color: 0xffffff });

        const mountainPositions = [
            { x: -40, z: -80, scale: 1.5 },
            { x: -20, z: -90, scale: 1.2 },
            { x: 0, z: -100, scale: 1.8 },
            { x: 25, z: -85, scale: 1.4 },
            { x: 50, z: -95, scale: 1.6 },
            { x: -60, z: -95, scale: 1.3 },
            { x: 70, z: -90, scale: 1.1 },
        ];

        mountainPositions.forEach(pos => {
            // Mountain body
            const height = 20 * pos.scale;
            const radius = 12 * pos.scale;
            const mountainGeo = new THREE.ConeGeometry(radius, height, 6);
            const mountain = new THREE.Mesh(mountainGeo, mountainMaterial);
            mountain.position.set(pos.x, height / 2 - 2, pos.z);
            this.scene.add(mountain);

            // Snow cap
            const snowGeo = new THREE.ConeGeometry(radius * 0.4, height * 0.3, 6);
            const snow = new THREE.Mesh(snowGeo, snowMaterial);
            snow.position.set(pos.x, height - height * 0.15 - 2, pos.z);
            this.scene.add(snow);
        });
    }

    createTrack() {
        // Main track - light blue
        const trackLength = 200;
        const trackGeo = new THREE.PlaneGeometry(this.trackWidth, trackLength);
        const trackMat = new THREE.MeshLambertMaterial({ color: 0x7dd3fc });
        this.track = new THREE.Mesh(trackGeo, trackMat);
        this.track.rotation.x = -Math.PI / 2;
        this.track.position.set(0, 0.01, -trackLength / 2 + 10);
        this.track.receiveShadow = true;
        this.scene.add(this.track);

        // Dark blue edges
        const edgeMat = new THREE.MeshLambertMaterial({ color: 0x0369a1 });
        for (let side of [-1, 1]) {
            const edgeGeo = new THREE.PlaneGeometry(0.15, trackLength);
            const edge = new THREE.Mesh(edgeGeo, edgeMat);
            edge.rotation.x = -Math.PI / 2;
            edge.position.set(side * this.trackWidth / 2, 0.02, -trackLength / 2 + 10);
            this.scene.add(edge);
        }

        // White stripes across track
        this.createTrackStripes(trackLength);
    }

    createTrackStripes(trackLength) {
        const stripeMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
        const stripeWidth = this.trackWidth - 0.3;
        const stripeDepth = 1.5;
        const stripeGeo = new THREE.PlaneGeometry(stripeWidth, stripeDepth);

        for (let z = 5; z > -trackLength + 10; z -= 4) {
            const stripe = new THREE.Mesh(stripeGeo, stripeMat);
            stripe.rotation.x = -Math.PI / 2;
            stripe.position.set(0, 0.02, z);
            stripe.receiveShadow = true;
            this.scene.add(stripe);
            this.trackStripes.push(stripe);
        }
    }

    createBall() {
        this.ball = new THREE.Group();

        // Main ball - white/cream
        const ballGeo = new THREE.SphereGeometry(0.4, 32, 32);
        const ballMat = new THREE.MeshPhongMaterial({
            color: 0xfff8e7,
            shininess: 80
        });
        const ballMesh = new THREE.Mesh(ballGeo, ballMat);
        ballMesh.castShadow = true;
        this.ball.add(ballMesh);

        // Brown/black pentagons
        const pentagonMat = new THREE.MeshBasicMaterial({ color: 0x4a3728 });

        const pentPositions = [
            { theta: 0, phi: 0 },
            { theta: Math.PI, phi: 0 },
            { theta: Math.PI / 2, phi: 0 },
            { theta: -Math.PI / 2, phi: 0 },
            { theta: 0, phi: Math.PI / 2 },
            { theta: 0, phi: -Math.PI / 2 },
        ];

        pentPositions.forEach(pos => {
            const pentGeo = new THREE.CircleGeometry(0.12, 5);
            const pentagon = new THREE.Mesh(pentGeo, pentagonMat);

            const r = 0.41;
            pentagon.position.x = r * Math.cos(pos.theta) * Math.cos(pos.phi);
            pentagon.position.y = r * Math.sin(pos.phi);
            pentagon.position.z = r * Math.sin(pos.theta) * Math.cos(pos.phi);

            pentagon.lookAt(0, 0, 0);
            this.ball.add(pentagon);
        });

        this.ball.position.set(0, 0.4, 0);
        this.scene.add(this.ball);
    }

    createObstacle(z) {
        // 3 lanes
        const lanes = [-1.2, 0, 1.2];
        const numObs = Math.random() > 0.5 ? 2 : 1;
        const usedLanes = [];

        for (let i = 0; i < numObs; i++) {
            let lane;
            do {
                lane = lanes[Math.floor(Math.random() * lanes.length)];
            } while (usedLanes.includes(lane));
            usedLanes.push(lane);

            // Orange traffic cone
            const cone = new THREE.Group();

            // Base (orange square)
            const baseGeo = new THREE.BoxGeometry(0.5, 0.08, 0.5);
            const baseMat = new THREE.MeshPhongMaterial({ color: 0xff6600 });
            const base = new THREE.Mesh(baseGeo, baseMat);
            base.position.y = 0.04;
            base.castShadow = true;
            cone.add(base);

            // Cone body (orange)
            const coneGeo = new THREE.ConeGeometry(0.22, 0.7, 8);
            const coneMat = new THREE.MeshPhongMaterial({ color: 0xff6600 });
            const coneMesh = new THREE.Mesh(coneGeo, coneMat);
            coneMesh.position.y = 0.43;
            coneMesh.castShadow = true;
            cone.add(coneMesh);

            // White stripes on cone
            const stripe1Geo = new THREE.CylinderGeometry(0.18, 0.2, 0.12, 8);
            const stripeMat = new THREE.MeshPhongMaterial({ color: 0xffffff });
            const stripe1 = new THREE.Mesh(stripe1Geo, stripeMat);
            stripe1.position.y = 0.35;
            cone.add(stripe1);

            const stripe2Geo = new THREE.CylinderGeometry(0.12, 0.14, 0.1, 8);
            const stripe2 = new THREE.Mesh(stripe2Geo, stripeMat);
            stripe2.position.y = 0.55;
            cone.add(stripe2);

            cone.position.set(lane, 0, z);
            cone.userData = { radius: 0.35 };

            this.scene.add(cone);
            this.obstacles.push(cone);
        }
    }

    spawnObstacles() {
        const spawnZ = this.ball.position.z - 40;
        if (spawnZ < this.lastSpawnZ - this.spawnInterval) {
            this.createObstacle(spawnZ);
            this.lastSpawnZ = spawnZ;
        }
    }

    updatePlayerPosition(normalizedX) {
        const halfTrack = (this.trackWidth / 2) - 0.5;
        this.targetPlayerX = (normalizedX - 0.5) * 2 * halfTrack;
        this.targetPlayerX = Math.max(-halfTrack, Math.min(halfTrack, this.targetPlayerX));
    }

    checkCollision() {
        const ballX = this.ball.position.x;
        const ballZ = this.ball.position.z;
        const ballRadius = 0.4;

        for (const obstacle of this.obstacles) {
            const dx = ballX - obstacle.position.x;
            const dz = ballZ - obstacle.position.z;
            const dist = Math.sqrt(dx * dx + dz * dz);

            if (dist < ballRadius + obstacle.userData.radius) {
                return true;
            }

            if (obstacle.position.z > ballZ + 1 && !this.passedObstacles.has(obstacle)) {
                this.passedObstacles.add(obstacle);
                this.score += 1;
                if (this.onScore) this.onScore(this.score);
            }
        }
        return false;
    }

    cleanupObstacles() {
        this.obstacles = this.obstacles.filter(obs => {
            if (obs.position.z > this.ball.position.z + 10) {
                this.scene.remove(obs);
                this.passedObstacles.delete(obs);
                return false;
            }
            return true;
        });
    }

    start() {
        this.isRunning = true;
        this.isPaused = false;
        this.score = 0;
        this.currentSpeed = this.baseSpeed;
        this.playerX = 0;
        this.targetPlayerX = 0;
        this.lastSpawnZ = 0;
        this.passedObstacles.clear();

        this.obstacles.forEach(obs => this.scene.remove(obs));
        this.obstacles = [];

        this.ball.position.set(0, 0.4, 0);

        this.clock.start();
        this.animate();
    }

    pause() {
        this.isPaused = true;
        this.clock.stop();
    }

    resume() {
        this.isPaused = false;
        this.clock.start();
        this.animate();
    }

    stop() {
        this.isRunning = false;
        this.isPaused = false;
        this.clock.stop();
    }

    gameOver() {
        this.isRunning = false;
        if (this.onGameOver) {
            this.onGameOver(this.score);
        }
    }

    animate() {
        if (!this.isRunning || this.isPaused) return;
        requestAnimationFrame(() => this.animate());

        const dt = Math.min(this.clock.getDelta(), 0.1);

        // Smooth X movement
        this.playerX += (this.targetPlayerX - this.playerX) * this.playerLerpSpeed * dt;
        this.ball.position.x = this.playerX;

        // Move forward (negative Z)
        this.ball.position.z -= this.currentSpeed * dt;

        // Rotate ball
        this.ball.rotation.x -= this.currentSpeed * dt * 0.7;
        this.ball.rotation.z -= (this.targetPlayerX - this.playerX) * dt * 2;

        // Camera follows - NISKO za piłką
        this.camera.position.z = this.ball.position.z + 5;
        this.camera.position.x = this.playerX * 0.3;
        this.camera.position.y = 1.8;
        this.camera.lookAt(
            this.ball.position.x * 0.5,
            0.5,
            this.ball.position.z - 15
        );

        // Track follows
        this.track.position.z = this.ball.position.z - 90;

        // Move stripes
        this.trackStripes.forEach(stripe => {
            if (stripe.position.z > this.ball.position.z + 5) {
                stripe.position.z -= 200;
            }
        });

        // Spawn & collision
        this.spawnObstacles();
        if (this.checkCollision()) {
            this.gameOver();
            return;
        }
        this.cleanupObstacles();

        // Speed up gradually
        this.currentSpeed = Math.min(this.currentSpeed + dt * 0.5, this.maxSpeed);
        if (this.onSpeedChange) {
            this.onSpeedChange(this.currentSpeed / this.baseSpeed);
        }

        this.renderer.render(this.scene, this.camera);
    }

    onResize() {
        const w = this.container.clientWidth || window.innerWidth;
        const h = this.container.clientHeight || window.innerHeight;
        if (w === 0 || h === 0) return;

        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(w, h);
        this.renderer.render(this.scene, this.camera);
    }

    getScore() { return this.score; }
    getSpeedMultiplier() { return this.currentSpeed / this.baseSpeed; }

    dispose() {
        this.stop();
        if (this.renderer) {
            this.renderer.dispose();
            this.container.removeChild(this.renderer.domElement);
        }
    }
}

window.SoccerGame = SoccerGame;
