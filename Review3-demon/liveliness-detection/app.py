# app.py
import tensorflow as tf
import numpy as np
import cv2
import base64
from flask import Flask, request, jsonify, render_template

# --- Initialize Flask App ---
app = Flask(__name__)

# --- Load Models ---
# Load the pre-trained Keras model for liveness detection
try:
    model = tf.keras.models.load_model('model.h5')
except Exception as e:
    print(f"Error loading Keras model: {e}")
    # Handle error appropriately
    
# Load the pre-trained Haar Cascade model for face detection from OpenCV
face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')

# --- Helper Functions ---
def preprocess_image(image_data):
    """Decodes a base64 image string and prepares it for the model."""
    # Remove the base64 header
    encoded_data = image_data.split(',')[1]
    # Decode the base64 string
    nparr = np.frombuffer(base64.b64decode(encoded_data), np.uint8)
    # Convert to an OpenCV image
    frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    return frame

# --- Flask Routes ---
@app.route('/')
def index():
    """Renders the main HTML page."""
    return render_template('index.html')

@app.route('/predict', methods=['POST'])
def predict():
    """Receives an image frame, detects faces, predicts liveness, and returns results."""
    data = request.get_json()
    if 'image' not in data:
        return jsonify({'error': 'No image data found'}), 400

    frame = preprocess_image(data['image'])
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    
    # Detect faces in the frame
    faces = face_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(30, 30))
    
    predictions = []
    
    for (x, y, w, h) in faces:
        # Crop the face from the frame
        face_crop = frame[y:y+h, x:x+w]
        
        # Preprocess the face for the liveness model (resize and rescale)
        face_resized = cv2.resize(face_crop, (150, 150))
        face_rescaled = face_resized.astype("float") / 255.0
        face_reshaped = np.expand_dims(face_rescaled, axis=0)
        
        # Get the prediction from the model
        # The output is a probability. close to 1.0 means 'Spoof', close to 0.0 means 'Live'
        prediction_score = model.predict(face_reshaped)[0][0]
        
        # Determine the label based on the alphabetical order of classes ('Live'=0, 'Spoof'=1)
        if prediction_score > 0.5:
            label = "Fake"
            # We show confidence in being FAKE
            confidence = prediction_score 
        else:
            label = "Original"
            # We show confidence in being ORIGINAL
            confidence = 1 - prediction_score

        predictions.append({
            'box': [int(x), int(y), int(w), int(h)],
            'label': label,
            'confidence': float(confidence)
        })
        
    return jsonify(predictions)

# --- Run the App ---
if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0')