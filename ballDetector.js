/**
 * Ball Detector - Fast Color Tracking for Orange Ball
 * K11 Studio - Soccer Runner
 * Optimized for low latency gameplay
 */

class BallDetector {
    constructor(options = {}) {
        this.isReady = false;
        this.isProcessing = false;

        // Smoothing for ball position (lower = more responsive)
        this.smoothingFactor = options.smoothingFactor || 0.4;
        this.lastPosition = null;

        // Orange ball HSV range (wider for distance detection)
        this.orangeHue = { min: 3, max: 30 };
        this.orangeSat = { min: 70, max: 255 };
        this.orangeVal = { min: 60, max: 255 };

        // Minimum pixels to count as detection (lowered for distance)
        this.minPixels = options.minPixels || 25;

        // Performance tracking
        this.lastInferenceTime = 0;
        this.fps = 0;

        // Internal canvas for processing
        this.processCanvas = null;
        this.processCtx = null;
        this.processWidth = 160;  // Low res for speed
        this.processHeight = 120;

        // Callback
        this.onBallUpdate = options.onBallUpdate || null;
    }

    /**
     * Initialize the detector (instant - no model loading needed)
     */
    async initialize(onProgress = null) {
        if (onProgress) onProgress('Inicjalizacja color tracking...', 50);

        // Create processing canvas
        this.processCanvas = document.createElement('canvas');
        this.processCanvas.width = this.processWidth;
        this.processCanvas.height = this.processHeight;
        this.processCtx = this.processCanvas.getContext('2d', { willReadFrequently: true });

        if (onProgress) onProgress('Gotowe!', 100);

        this.isReady = true;
        console.log('BallDetector initialized - Fast Color Tracking mode');

        return true;
    }

    /**
     * Convert RGB to HSV
     */
    rgbToHsv(r, g, b) {
        r /= 255; g /= 255; b /= 255;
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const d = max - min;

        let h = 0;
        if (d !== 0) {
            if (max === r) h = ((g - b) / d + 6) % 6;
            else if (max === g) h = (b - r) / d + 2;
            else h = (r - g) / d + 4;
            h *= 60;
        }

        const s = max === 0 ? 0 : (d / max) * 255;
        const v = max * 255;

        return { h, s, v };
    }

    /**
     * Check if pixel is orange
     */
    isOrangePixel(r, g, b) {
        const hsv = this.rgbToHsv(r, g, b);

        // Orange detection - wider range for better detection
        const hueOk = (hsv.h >= this.orangeHue.min && hsv.h <= this.orangeHue.max) ||
                      (hsv.h >= 350); // Wrap for red-orange
        const satOk = hsv.s >= this.orangeSat.min;
        const valOk = hsv.v >= this.orangeVal.min;

        return hueOk && satOk && valOk;
    }

    /**
     * Main detection method - Fast Color Tracking
     */
    async detect(video) {
        if (!this.isReady || this.isProcessing) {
            return this.lastPosition || { detected: false };
        }

        this.isProcessing = true;
        const startTime = performance.now();

        try {
            // Draw video to low-res canvas
            this.processCtx.drawImage(video, 0, 0, this.processWidth, this.processHeight);
            const imageData = this.processCtx.getImageData(0, 0, this.processWidth, this.processHeight);
            const pixels = imageData.data;

            let sumX = 0;
            let sumY = 0;
            let count = 0;
            let minX = this.processWidth, maxX = 0;
            let minY = this.processHeight, maxY = 0;

            // Scan for orange pixels
            for (let y = 0; y < this.processHeight; y++) {
                for (let x = 0; x < this.processWidth; x++) {
                    const i = (y * this.processWidth + x) * 4;
                    const r = pixels[i];
                    const g = pixels[i + 1];
                    const b = pixels[i + 2];

                    if (this.isOrangePixel(r, g, b)) {
                        sumX += x;
                        sumY += y;
                        count++;
                        minX = Math.min(minX, x);
                        maxX = Math.max(maxX, x);
                        minY = Math.min(minY, y);
                        maxY = Math.max(maxY, y);
                    }
                }
            }

            let result;

            if (count >= this.minPixels) {
                const centerX = sumX / count / this.processWidth;
                const centerY = sumY / count / this.processHeight;

                // Scale box back to video dimensions
                const scaleX = video.videoWidth / this.processWidth;
                const scaleY = video.videoHeight / this.processHeight;

                result = {
                    detected: true,
                    x: centerX,
                    y: centerY,
                    width: (maxX - minX) / this.processWidth,
                    height: (maxY - minY) / this.processHeight,
                    confidence: Math.min(count / 2000, 1),
                    box: {
                        x1: minX * scaleX,
                        y1: minY * scaleY,
                        x2: maxX * scaleX,
                        y2: maxY * scaleY
                    }
                };
            } else {
                result = { detected: false };
            }

            // Apply smoothing
            if (result.detected && this.lastPosition && this.lastPosition.detected) {
                result.x = this.lastPosition.x + (result.x - this.lastPosition.x) * this.smoothingFactor;
                result.y = this.lastPosition.y + (result.y - this.lastPosition.y) * this.smoothingFactor;
            }

            this.lastPosition = result;

            // Calculate FPS
            this.lastInferenceTime = performance.now() - startTime;
            this.fps = 1000 / this.lastInferenceTime;

            // Call callback
            if (this.onBallUpdate && result.detected) {
                this.onBallUpdate(result.x, result.y, result.confidence);
            }

            return result;

        } catch (error) {
            console.error('Detection error:', error);
            return this.lastPosition || { detected: false };
        } finally {
            this.isProcessing = false;
        }
    }

    /**
     * Draw debug visualization
     */
    drawDebug(ctx, result, width, height) {
        ctx.clearRect(0, 0, width, height);

        if (result.detected) {
            const box = result.box;

            // Draw bounding box
            ctx.strokeStyle = '#4ade80';
            ctx.lineWidth = 3;
            ctx.strokeRect(box.x1, box.y1, box.x2 - box.x1, box.y2 - box.y1);

            // Draw center point
            const cx = (box.x1 + box.x2) / 2;
            const cy = (box.y1 + box.y2) / 2;

            ctx.fillStyle = '#4ade80';
            ctx.beginPath();
            ctx.arc(cx, cy, 8, 0, Math.PI * 2);
            ctx.fill();

            // Draw confidence
            ctx.fillStyle = '#4ade80';
            ctx.font = 'bold 14px Arial';
            ctx.fillText(`Ball: ${(result.confidence * 100).toFixed(0)}%`, box.x1, box.y1 - 5);

            // Draw position indicator line
            ctx.strokeStyle = 'rgba(74, 222, 128, 0.5)';
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);
            ctx.beginPath();
            ctx.moveTo(cx, 0);
            ctx.lineTo(cx, height);
            ctx.stroke();
            ctx.setLineDash([]);
        }

        // Draw FPS
        ctx.fillStyle = '#fff';
        ctx.font = '12px Arial';
        ctx.fillText(`FPS: ${this.fps.toFixed(1)}`, 10, 20);
    }

    /**
     * Get current ball position (normalized 0-1)
     */
    getPosition() {
        return this.lastPosition;
    }

    /**
     * Set confidence threshold
     */
    setConfidenceThreshold(threshold) {
        this.confidenceThreshold = threshold;
    }

    /**
     * Set smoothing factor
     */
    setSmoothingFactor(factor) {
        this.smoothingFactor = Math.max(0.1, Math.min(1.0, factor));
    }
}

// Export for use in other modules
window.BallDetector = BallDetector;
