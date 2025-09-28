// static/script.js
const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const statusText = document.getElementById('status');
const startButton = document.getElementById('startButton');
const stopButton = document.getElementById('stopButton');
const ctx = canvas.getContext('2d');

// --- Configuration ---
// How many times per second we should send a frame to the server for prediction.
const PREDICTION_FPS = 2; // e.g., 2 times per second. Adjust as needed.

// --- State Management ---
let stream = null;
let isDetecting = false;
let latestPredictions = [];
let predictionIntervalId = null;

// --- Event Listeners ---
startButton.addEventListener('click', startDetection);
stopButton.addEventListener('click', stopDetection);

/**
 * Starts the webcam and both the rendering and prediction loops.
 */
async function startDetection() {
    isDetecting = true;
    startButton.disabled = true;
    stopButton.disabled = false;
    statusText.textContent = "Initializing Webcam...";

    try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
        video.srcObject = stream;
        video.addEventListener('loadedmetadata', () => {
            video.play();
            statusText.textContent = "Webcam active. Detecting...";
            // Start the two loops
            requestAnimationFrame(renderLoop); // Starts the rendering loop
            predictionIntervalId = setInterval(predictionLoop, 1000 / PREDICTION_FPS); // Starts the prediction loop
        });
    } catch (err) {
        console.error("Error accessing webcam: ", err);
        statusText.innerHTML = `<strong>Error:</strong> Could not access webcam. Please check permissions.`;
        stopDetection(); // Reset the state if webcam fails
    }
}

/**
 * Stops the webcam and clears the loops.
 */
function stopDetection() {
    isDetecting = false;
    startButton.disabled = false;
    stopButton.disabled = true;
    statusText.textContent = 'Click "Start Detection" to begin.';

    // Stop the prediction interval
    clearInterval(predictionIntervalId);

    // Stop the webcam stream tracks
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
    }
    video.srcObject = null;
    
    // Clear the canvas
    latestPredictions = [];
    ctx.clearRect(0, 0, canvas.width, canvas.height);
}

/**
 * The rendering loop - runs as fast as the browser allows.
 */
function renderLoop() {
    if (!isDetecting) return;

    // Draw the current video frame
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    // Draw the latest predictions on top of the video
    drawPredictions(latestPredictions);
    
    // Continue the loop
    requestAnimationFrame(renderLoop);
}

/**
 * The prediction loop - runs at a fixed interval (PREDICTION_FPS).
 */
async function predictionLoop() {
    if (!isDetecting) return;
    
    // Create a temporary canvas to get frame data without blocking the main canvas
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = video.videoWidth;
    tempCanvas.height = video.videoHeight;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.drawImage(video, 0, 0, tempCanvas.width, tempCanvas.height);
    const imageData = tempCanvas.toDataURL('image/jpeg');

    try {
        const response = await fetch('/predict', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image: imageData })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        // Update the global state with the new results
        latestPredictions = await response.json();

    } catch (error) {
        console.error('Error during prediction:', error);
        latestPredictions = []; // Clear boxes on error
    }
}

/**
 * Draws the bounding boxes and labels on the canvas.
 */
function drawPredictions(predictions) {
    predictions.forEach(pred => {
        const [x, y, w, h] = pred.box;
        const label = pred.label;
        const confidence = pred.confidence;

        // Bounding box styling
        ctx.strokeStyle = label === 'Original' ? '#00FF00' : '#FF0000'; // Green for Original, Red for Fake
        ctx.lineWidth = 3;
        ctx.strokeRect(x, y, w, h);

        // Text styling
        const text = `${label}: ${Math.round(confidence * 100)}%`;
        const textBgHeight = 24;
        ctx.fillStyle = ctx.strokeStyle;
        ctx.fillRect(x, y > textBgHeight ? y - textBgHeight : y, ctx.measureText(text).width + 10, textBgHeight);
        
        ctx.fillStyle = '#FFFFFF'; // White text
        ctx.font = '18px Arial';
        ctx.fillText(text, x + 5, y > textBgHeight ? y - 5 : 18);
    });
    
    if (isDetecting) {
       statusText.textContent = predictions.length > 0 ? "Detection active." : "No face detected. Looking...";
    }
}