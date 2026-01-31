/**
 * Main Application - Soccer Runner
 * K11 Studio
 */

class SoccerRunnerApp {
    constructor() {
        // DOM Elements
        this.loadingScreen = document.getElementById('loading-screen');
        this.loadingStatus = document.getElementById('loading-status');
        this.loadingProgress = document.getElementById('loading-progress');

        this.menuScreen = document.getElementById('menu-screen');
        this.gameScreen = document.getElementById('game-screen');
        this.pauseScreen = document.getElementById('pause-screen');
        this.gameoverScreen = document.getElementById('gameover-screen');

        this.cameraPreview = document.getElementById('camera-preview');
        this.debugCanvas = document.getElementById('debug-canvas');
        this.miniDebugCanvas = document.getElementById('mini-debug-canvas');

        this.startButton = document.getElementById('start-button');
        this.pauseButton = document.getElementById('pause-button');
        this.resumeButton = document.getElementById('resume-button');
        this.quitButton = document.getElementById('quit-button');
        this.retryButton = document.getElementById('retry-button');
        this.menuButton = document.getElementById('menu-button');

        this.scoreDisplay = document.getElementById('score');
        this.speedDisplay = document.getElementById('speed');
        this.highScoreDisplay = document.getElementById('high-score');
        this.finalScoreDisplay = document.getElementById('final-score');
        this.newRecordElement = document.getElementById('new-record');
        this.ballStatus = document.getElementById('ball-status');
        this.cameraError = document.getElementById('camera-error');

        this.gameContainer = document.getElementById('game-container');

        // Components
        this.ballDetector = null;
        this.game = null;
        this.audioManager = null;

        // State
        this.stream = null;
        this.isDetecting = false;
        this.highScore = parseInt(localStorage.getItem('soccerRunnerHighScore')) || 0;

        // Debug contexts
        this.debugCtx = null;
        this.miniDebugCtx = null;

        // Bind methods
        this.detectLoop = this.detectLoop.bind(this);
    }

    /**
     * Initialize the application
     */
    async init() {
        this.updateLoadingStatus('Inicjalizacja aplikacji...', 5);

        // Display high score
        this.highScoreDisplay.textContent = this.highScore;

        // Setup event listeners
        this.setupEventListeners();

        // Initialize audio
        this.updateLoadingStatus('Przygotowywanie audio...', 10);
        this.initAudio();

        // Initialize ball detector
        this.updateLoadingStatus('Ładowanie modelu YOLO...', 20);
        await this.initBallDetector();

        // Initialize game
        this.updateLoadingStatus('Tworzenie świata gry...', 80);
        this.initGame();

        // Setup debug canvases
        this.setupDebugCanvases();

        // Hide loading, show menu
        this.updateLoadingStatus('Gotowe!', 100);
        await this.delay(500);

        this.loadingScreen.classList.add('hidden');
        this.menuScreen.classList.remove('hidden');

        // Update button text
        this.startButton.textContent = 'Uruchom kamerę';
        this.startButton.disabled = false;
    }

    /**
     * Update loading status
     */
    updateLoadingStatus(message, progress) {
        this.loadingStatus.textContent = message;
        this.loadingProgress.style.width = `${progress}%`;
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Start button - first starts camera, then starts game
        this.startButton.addEventListener('click', () => this.handleStartClick());

        // Pause/Resume
        this.pauseButton.addEventListener('click', () => this.pauseGame());
        this.resumeButton.addEventListener('click', () => this.resumeGame());

        // Quit
        this.quitButton.addEventListener('click', () => this.quitToMenu());

        // Game over
        this.retryButton.addEventListener('click', () => this.startGame());
        this.menuButton.addEventListener('click', () => this.quitToMenu());

        // Keyboard controls
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                if (this.game && this.game.isRunning && !this.game.isPaused) {
                    this.pauseGame();
                } else if (this.game && this.game.isPaused) {
                    this.resumeGame();
                }
            }
            if (e.key === ' ' && !this.gameScreen.classList.contains('hidden')) {
                e.preventDefault();
                if (this.game && !this.game.isRunning) {
                    this.startGame();
                }
            }
        });
    }

    /**
     * Initialize audio manager
     */
    initAudio() {
        this.audioManager = {
            initialized: false,

            async init() {
                if (this.initialized) return;
                await Tone.start();
                this.initialized = true;
            },

            playCollect() {
                if (!this.initialized) return;
                const synth = new Tone.Synth().toDestination();
                synth.triggerAttackRelease('C5', '16n');
                setTimeout(() => synth.dispose(), 500);
            },

            playCollision() {
                if (!this.initialized) return;
                const noise = new Tone.NoiseSynth({
                    noise: { type: 'white' },
                    envelope: { attack: 0.005, decay: 0.1, sustain: 0 }
                }).toDestination();
                noise.triggerAttackRelease('8n');
                setTimeout(() => noise.dispose(), 500);
            },

            playGameOver() {
                if (!this.initialized) return;
                const synth = new Tone.Synth().toDestination();
                synth.triggerAttackRelease('A3', '4n');
                setTimeout(() => {
                    synth.triggerAttackRelease('F3', '4n');
                }, 200);
                setTimeout(() => {
                    synth.triggerAttackRelease('D3', '2n');
                }, 400);
                setTimeout(() => synth.dispose(), 1500);
            },

            playNewRecord() {
                if (!this.initialized) return;
                const synth = new Tone.PolySynth().toDestination();
                synth.triggerAttackRelease(['C5', 'E5', 'G5'], '8n');
                setTimeout(() => {
                    synth.triggerAttackRelease(['D5', 'F5', 'A5'], '8n');
                }, 150);
                setTimeout(() => {
                    synth.triggerAttackRelease(['E5', 'G5', 'B5'], '4n');
                }, 300);
                setTimeout(() => synth.dispose(), 1500);
            }
        };
    }

    /**
     * Initialize ball detector
     */
    async initBallDetector() {
        this.ballDetector = new BallDetector({
            confidenceThreshold: 0.35,
            smoothingFactor: 0.4,
            useFallback: true,
            onBallUpdate: (x, y, confidence) => {
                // Update game player position (mirror X because camera is mirrored)
                if (this.game && this.game.isRunning) {
                    this.game.updatePlayerPosition(1 - x);
                }
            }
        });

        try {
            await this.ballDetector.initialize((status, progress) => {
                this.updateLoadingStatus(status, 20 + progress * 0.5);
            });
        } catch (error) {
            console.error('Failed to initialize ball detector:', error);
            // Continue anyway - will use fallback
        }
    }

    /**
     * Initialize game
     */
    initGame() {
        console.log('[Main] initGame() called');
        console.log('[Main] gameContainer:', this.gameContainer);
        console.log('[Main] gameContainer visible:', !this.gameScreen.classList.contains('hidden'));
        console.log('[Main] gameContainer dimensions:', this.gameContainer.clientWidth, 'x', this.gameContainer.clientHeight);

        this.game = new SoccerGame(this.gameContainer, {
            onScore: (score) => {
                this.scoreDisplay.textContent = score;
            },
            onSpeedChange: (multiplier) => {
                this.speedDisplay.textContent = `${multiplier.toFixed(1)}x`;
            },
            onGameOver: (finalScore) => {
                this.handleGameOver(finalScore);
            },
            onBonusCollected: (bonus) => {
                if (bonus.bonusType === 'coin') {
                    this.audioManager.playCollect();
                }
            }
        });

        this.game.init();
        console.log('[Main] Game initialized');
    }

    /**
     * Setup debug canvases
     */
    setupDebugCanvases() {
        this.debugCtx = this.debugCanvas.getContext('2d');
        this.miniDebugCtx = this.miniDebugCanvas.getContext('2d');
    }

    /**
     * Handle start button click
     */
    async handleStartClick() {
        if (!this.stream) {
            // First click - start camera
            await this.startCamera();
        } else {
            // Second click - start game
            this.startGame();
        }
    }

    /**
     * Start camera
     */
    async startCamera() {
        this.startButton.disabled = true;
        this.startButton.textContent = 'Uruchamianie kamery...';
        this.cameraError.classList.add('hidden');

        try {
            this.stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 640 },
                    height: { ideal: 480 },
                    facingMode: 'user'
                }
            });

            this.cameraPreview.srcObject = this.stream;
            await this.cameraPreview.play();

            // Wait for video to be ready
            await new Promise(resolve => {
                if (this.cameraPreview.readyState >= 2) {
                    resolve();
                } else {
                    this.cameraPreview.onloadeddata = resolve;
                }
            });

            // Setup debug canvas size
            this.debugCanvas.width = this.cameraPreview.videoWidth;
            this.debugCanvas.height = this.cameraPreview.videoHeight;
            this.miniDebugCanvas.width = 180;
            this.miniDebugCanvas.height = 135;

            // Start detection
            this.isDetecting = true;
            this.detectLoop();

            // Update button for game start
            this.startButton.textContent = 'Rozpocznij grę';
            this.startButton.disabled = false;

        } catch (error) {
            console.error('Camera error:', error);
            this.cameraError.textContent = `Błąd kamery: ${error.message}`;
            this.cameraError.classList.remove('hidden');
            this.startButton.textContent = 'Spróbuj ponownie';
            this.startButton.disabled = false;
        }
    }

    /**
     * Detection loop
     */
    async detectLoop() {
        if (!this.isDetecting) return;

        if (this.cameraPreview.readyState >= 2) {
            const result = await this.ballDetector.detect(this.cameraPreview);

            // Update debug visualization
            this.ballDetector.drawDebug(
                this.debugCtx,
                result,
                this.debugCanvas.width,
                this.debugCanvas.height
            );

            // Update mini debug in game
            if (!this.gameScreen.classList.contains('hidden')) {
                // Draw scaled version to mini canvas
                this.miniDebugCtx.clearRect(0, 0, 180, 135);
                this.miniDebugCtx.drawImage(this.cameraPreview, 0, 0, 180, 135);

                if (result.detected) {
                    const scaleX = 180 / this.cameraPreview.videoWidth;
                    const scaleY = 135 / this.cameraPreview.videoHeight;

                    this.miniDebugCtx.strokeStyle = '#4ade80';
                    this.miniDebugCtx.lineWidth = 2;

                    const box = result.box;
                    this.miniDebugCtx.strokeRect(
                        box.x1 * scaleX,
                        box.y1 * scaleY,
                        (box.x2 - box.x1) * scaleX,
                        (box.y2 - box.y1) * scaleY
                    );
                }
            }

            // Update ball status indicator
            if (result.detected) {
                this.ballStatus.textContent = `Wykryto (${(result.confidence * 100).toFixed(0)}%)`;
                this.ballStatus.classList.add('detected');
            } else {
                this.ballStatus.textContent = 'Nie wykryto';
                this.ballStatus.classList.remove('detected');
            }
        }

        // Continue detection loop
        requestAnimationFrame(() => this.detectLoop());
    }

    /**
     * Start game
     */
    async startGame() {
        console.log('[Main] startGame() called');

        // Initialize audio on first interaction
        await this.audioManager.init();

        // Reset displays
        this.scoreDisplay.textContent = '0';
        this.speedDisplay.textContent = '1.0x';

        // Show game screen
        this.menuScreen.classList.add('hidden');
        this.gameoverScreen.classList.add('hidden');
        this.pauseScreen.classList.add('hidden');
        this.gameScreen.classList.remove('hidden');
        console.log('[Main] Game screen shown');

        // IMPORTANT: Wait for DOM to update, then resize renderer
        // (container has 0 dimensions when hidden)
        console.log('[Main] Waiting for DOM update...');
        await new Promise(resolve => requestAnimationFrame(resolve));
        console.log('[Main] DOM updated, container size:', this.gameContainer.clientWidth, 'x', this.gameContainer.clientHeight);

        this.game.onResize();

        // Start the game
        console.log('[Main] Calling game.start()');
        this.game.start();
    }

    /**
     * Pause game
     */
    pauseGame() {
        if (this.game && this.game.isRunning) {
            this.game.pause();
            this.pauseScreen.classList.remove('hidden');
        }
    }

    /**
     * Resume game
     */
    resumeGame() {
        if (this.game && this.game.isPaused) {
            this.pauseScreen.classList.add('hidden');
            this.game.resume();
        }
    }

    /**
     * Handle game over
     */
    handleGameOver(finalScore) {
        this.audioManager.playCollision();

        setTimeout(() => {
            this.finalScoreDisplay.textContent = finalScore;

            // Check for new record
            const isNewRecord = finalScore > this.highScore;
            if (isNewRecord) {
                this.highScore = finalScore;
                localStorage.setItem('soccerRunnerHighScore', this.highScore);
                this.highScoreDisplay.textContent = this.highScore;
                this.newRecordElement.classList.remove('hidden');
                this.audioManager.playNewRecord();
            } else {
                this.newRecordElement.classList.add('hidden');
                this.audioManager.playGameOver();
            }

            // Show game over screen
            this.gameoverScreen.classList.remove('hidden');
        }, 500);
    }

    /**
     * Quit to menu
     */
    quitToMenu() {
        this.game.stop();
        this.gameScreen.classList.add('hidden');
        this.pauseScreen.classList.add('hidden');
        this.gameoverScreen.classList.add('hidden');
        this.menuScreen.classList.remove('hidden');
    }

    /**
     * Utility: delay
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    const app = new SoccerRunnerApp();
    app.init().catch(error => {
        console.error('Failed to initialize app:', error);
        document.getElementById('loading-status').textContent = `Błąd: ${error.message}`;
    });
});
