document.addEventListener('DOMContentLoaded', function () {
    // DOM elements
    const fileUpload = document.getElementById('fileUpload');
    const gridSize = document.getElementById('gridSize');
    const brightness = document.getElementById('brightness');
    const contrast = document.getElementById('contrast');
    const gamma = document.getElementById('gamma');
    const smoothing = document.getElementById('smoothing');
    const ditherType = document.getElementById('ditherType');
    const resetButton = document.getElementById('resetButton');
    const saveButton = document.getElementById('saveButton');

    const gridSizeVal = document.getElementById('gridSizeVal');
    const brightnessVal = document.getElementById('brightnessVal');
    const contrastVal = document.getElementById('contrastVal');
    const gammaVal = document.getElementById('gammaVal');
    const smoothingVal = document.getElementById('smoothingVal');

    const halftoneCanvas = document.getElementById('halftoneCanvas');

    const modeSelect = document.getElementById('mode');
    const colorSampleSelect = document.getElementById('colorSampling');

    // Global variables for preview
    let imageElement = null;
    let videoElement = null;
    let isVideo = false;
    let animationFrameId;

    // Default parameter values
    const defaults = {
        gridSize: 20,
        brightness: 20,
        contrast: 0,
        gamma: 1.0,
        smoothing: 0,
        ditherType: "None"
    };


    // Debounce helper to limit update frequency.
    function debounce(func, wait) {
        let timeout;
        return function (...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    }

    function updateAndProcess() {
        gridSizeVal.textContent = gridSize.value;
        brightnessVal.textContent = brightness.value;
        contrastVal.textContent = contrast.value;
        gammaVal.textContent = gamma.value;
        smoothingVal.textContent = smoothing.value;
        if (imageElement || videoElement) {
            processFrame();
        }
    }

    const debouncedUpdate = debounce(updateAndProcess, 150);

    // Attach listeners to controls.
    gridSize.addEventListener('input', debouncedUpdate);
    brightness.addEventListener('input', debouncedUpdate);
    contrast.addEventListener('input', debouncedUpdate);
    gamma.addEventListener('input', debouncedUpdate);
    smoothing.addEventListener('input', debouncedUpdate);
    ditherType.addEventListener('change', debouncedUpdate);
    fileUpload.addEventListener('change', handleFileUpload);

    colorSampleSelect.addEventListener('change', debouncedUpdate); // Changed from runColorSampling to debouncedUpdate
    document.getElementById('grayscale').addEventListener('change', debouncedUpdate);
    modeSelect.addEventListener('change', debouncedUpdate);

    function handleFileUpload(e) {
        console.log(e)
        const file = e.target.files[0];
        if (!file) return;
        const fileURL = URL.createObjectURL(file);
        if (file.type.startsWith('video/')) {
            isVideo = true;
            if (videoElement) {
                videoElement.src = fileURL;
            } else {
                videoElement = document.createElement('video');
                videoElement.crossOrigin = "anonymous";
                videoElement.src = fileURL;
                videoElement.autoplay = true;
                videoElement.loop = true;
                videoElement.muted = true;
                videoElement.playsInline = true;
                videoElement.setAttribute("webkit-playsinline", "true");
                videoElement.addEventListener('loadeddata', () => {
                    setupCanvasDimensions(videoElement.videoWidth, videoElement.videoHeight);
                    videoElement.play();
                    processVideoFrame();
                });
                videoElement.addEventListener('error', (e) => {
                    console.error("Error loading video:", e);
                });
            }
        } else if (file.type.startsWith('image/')) {
            isVideo = false;
            if (videoElement) {
                cancelAnimationFrame(animationFrameId);
                videoElement.pause();
            }
            imageElement = new Image();
            imageElement.src = fileURL;
            imageElement.addEventListener('load', () => {
                setupCanvasDimensions(imageElement.width, imageElement.height);
                processFrame();
            });
        }
    }

    function setupCanvasDimensions(width, height) {
        const maxWidth = window.innerWidth * 0.8;
        const maxHeight = window.innerHeight * 0.8;
        let newWidth = width, newHeight = height;
        if (width > maxWidth || height > maxHeight) {
            const ratio = Math.min(maxWidth / width, maxHeight / height);
            newWidth = width * ratio;
            newHeight = height * ratio;
        }
        halftoneCanvas.width = newWidth;
        halftoneCanvas.height = newHeight;
    }

    function processFrame() {
        if (!imageElement && !videoElement) return;
        generateHalftone(halftoneCanvas, 1);
    }

    function processVideoFrame() {
        if (!isVideo) return;
        processFrame();
        animationFrameId = requestAnimationFrame(processVideoFrame);
    }

    // Generate halftone: compute grayscale per grid cell by iterating over full‑resolution data.
    function generateHalftone(targetCanvas, scaleFactor) {
        const previewWidth = halftoneCanvas.width;
        const previewHeight = halftoneCanvas.height;
        const targetWidth = previewWidth * scaleFactor;
        const targetHeight = previewHeight * scaleFactor;

        targetCanvas.width = targetWidth;
        targetCanvas.height = targetHeight;

        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = targetWidth;
        tempCanvas.height = targetHeight;
        const tempCtx = tempCanvas.getContext('2d');

        if (isVideo) {
            tempCtx.drawImage(videoElement, 0, 0, targetWidth, targetHeight);
        } else {
            tempCtx.drawImage(imageElement, 0, 0, targetWidth, targetHeight);
        }

        const imgData = tempCtx.getImageData(0, 0, targetWidth, targetHeight);
        const data = imgData.data;

        const mode = modeSelect.value;
        const colorSampling = colorSampleSelect.value;
        const isGrayscale = document.getElementById('grayscale').checked;
        const brightnessAdj = parseInt(brightness.value, 10);
        const contrastAdj = parseInt(contrast.value, 10);
        const gammaValNum = parseFloat(gamma.value);
        const contrastFactor = (259 * (contrastAdj + 255)) / (255 * (259 - contrastAdj));

        const adjustedData = new Float32Array(targetWidth * targetHeight * 3);
        for (let i = 0; i < data.length; i += 4) {
            let r = data[i], g = data[i + 1], b = data[i + 2];
            r = contrastFactor * (r - 128) + 128 + brightnessAdj;
            g = contrastFactor * (g - 128) + 128 + brightnessAdj;
            b = contrastFactor * (b - 128) + 128 + brightnessAdj;
            r = Math.max(0, Math.min(255, r));
            g = Math.max(0, Math.min(255, g));
            b = Math.max(0, Math.min(255, b));
            r = 255 * Math.pow(r / 255, 1 / gammaValNum);
            g = 255 * Math.pow(g / 255, 1 / gammaValNum);
            b = 255 * Math.pow(b / 255, 1 / gammaValNum);
            const pixelIndex = (i / 4) * 3;
            adjustedData[pixelIndex] = r;
            adjustedData[pixelIndex + 1] = g;
            adjustedData[pixelIndex + 2] = b;
        }

        const grid = parseInt(gridSize.value, 10) * scaleFactor;
        const numCols = Math.ceil(targetWidth / grid);
        const numRows = Math.ceil(targetHeight / grid);
        let cellValues;
        const numChannels = mode === "Pointilism" ? 1 : 3;

        if (mode === "Pointilism") {
            const grayData = new Float32Array(targetWidth * targetHeight);
            for (let i = 0; i < targetWidth * targetHeight; i++) {
                const r = adjustedData[i * 3];
                const g = adjustedData[i * 3 + 1];
                const b = adjustedData[i * 3 + 2];
                grayData[i] = 0.299 * r + 0.587 * g + 0.114 * b;
            }
            cellValues = new Float32Array(numRows * numCols);
            for (let row = 0; row < numRows; row++) {
                for (let col = 0; col < numCols; col++) {
                    let sum = 0, count = 0;
                    const startY = row * grid;
                    const startX = col * grid;
                    const endY = Math.min(startY + grid, targetHeight);
                    const endX = Math.min(startX + grid, targetWidth);
                    for (let y = startY; y < endY; y++) {
                        for (let x = startX; x < endX; x++) {
                            sum += grayData[y * targetWidth + x];
                            count++;
                        }
                    }
                    cellValues[row * numCols + col] = sum / count;
                }
            }
        } else { // "Pixelate"
            cellValues = new Float32Array(numRows * numCols * 3);
            for (let row = 0; row < numRows; row++) {
                for (let col = 0; col < numCols; col++) {
                    const cellIndex = (row * numCols + col) * 3;
                    const startY = row * grid;
                    const startX = col * grid;
                    const endY = Math.min(startY + grid, targetHeight);
                    const endX = Math.min(startX + grid, targetWidth);

                    if (colorSampling === "Average") {
                        let sumR = 0, sumG = 0, sumB = 0, count = 0;
                        for (let y = startY; y < endY; y++) {
                            for (let x = startX; x < endX; x++) {
                                const pixelIndex = (y * targetWidth + x) * 3;
                                sumR += adjustedData[pixelIndex];
                                sumG += adjustedData[pixelIndex + 1];
                                sumB += adjustedData[pixelIndex + 2];
                                count++;
                            }
                        }
                        cellValues[cellIndex] = sumR / count;
                        cellValues[cellIndex + 1] = sumG / count;
                        cellValues[cellIndex + 2] = sumB / count;
                    } else if (colorSampling === "Median") {
                        let rValues = [], gValues = [], bValues = [];
                        for (let y = startY; y < endY; y++) {
                            for (let x = startX; x < endX; x++) {
                                const pixelIndex = (y * targetWidth + x) * 3;
                                rValues.push(adjustedData[pixelIndex]);
                                gValues.push(adjustedData[pixelIndex + 1]);
                                bValues.push(adjustedData[pixelIndex + 2]);
                            }
                        }
                        rValues.sort((a, b) => a - b);
                        gValues.sort((a, b) => a - b);
                        bValues.sort((a, b) => a - b);
                        const mid = Math.floor(rValues.length / 2);
                        cellValues[cellIndex] = rValues.length % 2 === 0 ? (rValues[mid - 1] + rValues[mid]) / 2 : rValues[mid];
                        cellValues[cellIndex + 1] = gValues.length % 2 === 0 ? (gValues[mid - 1] + gValues[mid]) / 2 : gValues[mid];
                        cellValues[cellIndex + 2] = bValues.length % 2 === 0 ? (bValues[mid - 1] + bValues[mid]) / 2 : bValues[mid];
                    } else if (colorSampling === "Dominant") {
                        let colorMap = new Map();
                        for (let y = startY; y < endY; y++) {
                            for (let x = startX; x < endX; x++) {
                                const pixelIndex = (y * targetWidth + x) * 3;
                                const r = Math.round(adjustedData[pixelIndex]);
                                const g = Math.round(adjustedData[pixelIndex + 1]);
                                const b = Math.round(adjustedData[pixelIndex + 2]);
                                const key = `${r},${g},${b}`;
                                colorMap.set(key, (colorMap.get(key) || 0) + 1);
                            }
                        }
                        let maxCount = 0, dominantColor = [0, 0, 0];
                        for (let [color, count] of colorMap) {
                            if (count > maxCount) {
                                maxCount = count;
                                dominantColor = color.split(',').map(Number);
                            }
                        }
                        cellValues[cellIndex] = dominantColor[0];
                        cellValues[cellIndex + 1] = dominantColor[1];
                        cellValues[cellIndex + 2] = dominantColor[2];
                    }
                }
            }
        }

        const smoothingStrength = parseFloat(smoothing.value);
        if (smoothingStrength > 0) {
            cellValues = applyBoxBlur(cellValues, numRows, numCols, numChannels, smoothingStrength);
        }

        const selectedDither = ditherType.value;
        if (selectedDither === "FloydSteinberg") {
            applyFloydSteinbergDithering(cellValues, numRows, numCols, numChannels);
        } else if (selectedDither === "Ordered") {
            applyOrderedDithering(cellValues, numRows, numCols, numChannels);
        } else if (selectedDither === "Noise") {
            applyNoiseDithering(cellValues, numRows, numCols, numChannels);
        } else if (selectedDither === "Atkinson") {
            applyAtkinsonDithering(cellValues, numRows, numCols, numChannels);
        } else if (selectedDither === "Burkes") {
            applyBurkesDithering(cellValues, numRows, numCols, numChannels);
        }

        const ctx = targetCanvas.getContext('2d');
        if (mode === "Pointilism") {
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, targetWidth, targetHeight);
            for (let row = 0; row < numRows; row++) {
                for (let col = 0; col < numCols; col++) {
                    const brightnessValue = cellValues[row * numCols + col];
                    const norm = brightnessValue / 255;
                    const maxRadius = grid / 2;
                    const radius = maxRadius * (1 - norm);
                    if (radius > 0.5) {
                        ctx.beginPath();
                        const centerX = col * grid + grid / 2;
                        const centerY = row * grid + grid / 2;
                        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
                        ctx.fillStyle = 'black';
                        ctx.fill();
                    }
                }
            }
        } else { // "Pixelate"
            for (let row = 0; row < numRows; row++) {
                for (let col = 0; col < numCols; col++) {
                    const cellIndex = (row * numCols + col) * 3;
                    let r = Math.round(cellValues[cellIndex]);
                    let g = Math.round(cellValues[cellIndex + 1]);
                    let b = Math.round(cellValues[cellIndex + 2]);
                    if (isGrayscale && mode === "Pixelate") {
                        const gray = 0.299 * r + 0.587 * g + 0.114 * b;
                        r = g = b = Math.round(gray);
                    }
                    ctx.fillStyle = `rgb(${r},${g},${b})`;
                    const x = col * grid;
                    const y = row * grid;
                    const width = Math.min(grid, targetWidth - x);
                    const height = Math.min(grid, targetHeight - y);
                    ctx.fillRect(x, y, width, height);
                }
            }
        }
    }

    // 3× Box Blur for smoothing grid cell values.
    function applyBoxBlur(cellValues, numRows, numCols, numChannels, strength) {
        const totalLength = numRows * numCols * numChannels;
        let result = new Float32Array(cellValues);
        const passes = Math.floor(strength);
        for (let p = 0; p < passes; p++) {
            let temp = new Float32Array(totalLength);
            for (let channel = 0; channel < numChannels; channel++) {
                for (let row = 0; row < numRows; row++) {
                    for (let col = 0; col < numCols; col++) {
                        let sum = 0, count = 0;
                        for (let dy = -1; dy <= 1; dy++) {
                            for (let dx = -1; dx <= 1; dx++) {
                                const r = row + dy, c = col + dx;
                                if (r >= 0 && r < numRows && c >= 0 && c < numCols) {
                                    const index = (r * numCols + c) * numChannels + channel;
                                    sum += result[index];
                                    count++;
                                }
                            }
                        }
                        const index = (row * numCols + col) * numChannels + channel;
                        temp[index] = sum / count;
                    }
                }
            }
            result = temp;
        }
        const frac = strength - Math.floor(strength);
        if (frac > 0) {
            for (let i = 0; i < totalLength; i++) {
                result[i] = cellValues[i] * (1 - frac) + result[i] * frac;
            }
        }
        return result;
    }

    function applyFloydSteinbergDithering(cellValues, numRows, numCols, numChannels) {
        const threshold = 128;
        for (let channel = 0; channel < numChannels; channel++) {
            for (let row = 0; row < numRows; row++) {
                for (let col = 0; col < numCols; col++) {
                    const index = (row * numCols + col) * numChannels + channel;
                    const oldVal = cellValues[index];
                    const newVal = oldVal < threshold ? 0 : 255;
                    const error = oldVal - newVal;
                    cellValues[index] = newVal;
                    if (col + 1 < numCols) {
                        const rightIndex = (row * numCols + (col + 1)) * numChannels + channel;
                        cellValues[rightIndex] += error * (7 / 16);
                    }
                    if (row + 1 < numRows) {
                        if (col - 1 >= 0) {
                            const bottomLeftIndex = ((row + 1) * numCols + (col - 1)) * numChannels + channel;
                            cellValues[bottomLeftIndex] += error * (3 / 16);
                        }
                        const bottomIndex = ((row + 1) * numCols + col) * numChannels + channel;
                        cellValues[bottomIndex] += error * (5 / 16);
                        if (col + 1 < numCols) {
                            const bottomRightIndex = ((row + 1) * numCols + (col + 1)) * numChannels + channel;
                            cellValues[bottomRightIndex] += error * (1 / 16);
                        }
                    }
                }
            }
        }
    }

    function applyOrderedDithering(cellValues, numRows, numCols, numChannels) {
        const bayerMatrix = [[0, 2], [3, 1]];
        const matrixSize = 2;
        for (let channel = 0; channel < numChannels; channel++) {
            for (let row = 0; row < numRows; row++) {
                for (let col = 0; col < numCols; col++) {
                    const index = (row * numCols + col) * numChannels + channel;
                    const threshold = ((bayerMatrix[row % matrixSize][col % matrixSize] + 0.5) *
                        (255 / (matrixSize * matrixSize)));
                    cellValues[index] = cellValues[index] < threshold ? 0 : 255;
                }
            }
        }
    }

    function applyNoiseDithering(cellValues, numRows, numCols, numChannels) {
        const threshold = 128;
        for (let channel = 0; channel < numChannels; channel++) {
            for (let row = 0; row < numRows; row++) {
                for (let col = 0; col < numCols; col++) {
                    const index = (row * numCols + col) * numChannels + channel;
                    const noise = (Math.random() - 0.5) * 50;
                    const adjustedVal = cellValues[index] + noise;
                    cellValues[index] = adjustedVal < threshold ? 0 : 255;
                }
            }
        }
    }

    resetButton.addEventListener('click', () => {
        gridSize.value = defaults.gridSize;
        brightness.value = defaults.brightness;
        contrast.value = defaults.contrast;
        gamma.value = defaults.gamma;
        smoothing.value = defaults.smoothing;
        ditherType.value = defaults.ditherType;
        updateAndProcess();
    });

    saveButton.addEventListener('click', () => {
        if (!imageElement && !videoElement) return;
        const exportCanvas = document.createElement('canvas');
        generateHalftone(exportCanvas, 2);
        const dataURL = exportCanvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.href = dataURL;
        link.download = 'halftone.png';
        link.click();
    });

    setupCanvasDimensions(800, 600);
    const ctx = halftoneCanvas.getContext('2d');
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, halftoneCanvas.width, halftoneCanvas.height);

    // Automatically load the default video.
    (function loadDefaultVideo() {
        const videoURL = "https://i.imgur.com/5PrJCc2.mp4";
        isVideo = true;
        videoElement = document.createElement('video');
        videoElement.crossOrigin = "anonymous";
        videoElement.playsInline = true;
        videoElement.setAttribute("webkit-playsinline", "true");
        videoElement.src = videoURL;
        videoElement.autoplay = true;
        videoElement.loop = true;
        videoElement.muted = true;
        videoElement.addEventListener('loadeddata', () => {
            setupCanvasDimensions(videoElement.videoWidth, videoElement.videoHeight);
            videoElement.play();
            processVideoFrame();
        });
        videoElement.addEventListener('error', (e) => {
            console.error("Error loading default video:", e);
        });
    })();
}, false);