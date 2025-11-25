"""
Health Risk Prediction Model
Predicts health risk score based on wearable device metrics

Features:
- heart_rate_mean, heart_rate_std, heart_rate_max, heart_rate_min
- steps_mean, steps_std, steps_total
- sleep_hours_mean, sleep_hours_std
- calories_mean, calories_std
- age, gender (categorical)
- days_with_data
- trend_heart_rate, trend_steps, trend_sleep

Target:
- risk_score (0-1): 0 = low risk, 1 = high risk
"""

import numpy as np
import pandas as pd
import tensorflow as tf
from tensorflow import keras
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler, LabelEncoder
import joblib
import json
from datetime import datetime, timedelta

# Set random seeds for reproducibility
np.random.seed(42)
tf.random.set_seed(42)

# ============================================================================
# STEP 1: Generate Synthetic Training Data
# ============================================================================

def generate_synthetic_data(n_samples=10000):
    """
    Generate synthetic health data for training.
    Replace this with your real data from Firebase/CSV.
    """
    print(f"Generating {n_samples} synthetic samples...")
    
    data = []
    for i in range(n_samples):
        # Simulate healthy vs unhealthy patterns
        is_high_risk = np.random.random() > 0.7  # 30% high risk
        
        if is_high_risk:
            # Unhealthy patterns
            heart_rate_mean = np.random.normal(85, 10)  # Higher resting HR
            heart_rate_std = np.random.normal(20, 5)
            heart_rate_max = np.random.normal(140, 15)
            heart_rate_min = np.random.normal(65, 8)
            
            steps_mean = np.random.normal(4000, 1500)  # Low activity
            steps_std = np.random.normal(2000, 500)
            steps_total = steps_mean * 30
            
            sleep_hours_mean = np.random.normal(5.5, 1)  # Poor sleep
            sleep_hours_std = np.random.normal(1.5, 0.5)
            
            calories_mean = np.random.normal(2800, 400)  # Higher calories
            calories_std = np.random.normal(500, 100)
            
            risk_score = np.random.beta(7, 3)  # Skewed toward high risk
        else:
            # Healthy patterns
            heart_rate_mean = np.random.normal(68, 8)  # Normal resting HR
            heart_rate_std = np.random.normal(12, 3)
            heart_rate_max = np.random.normal(110, 12)
            heart_rate_min = np.random.normal(58, 6)
            
            steps_mean = np.random.normal(8500, 2000)  # Good activity
            steps_std = np.random.normal(2500, 500)
            steps_total = steps_mean * 30
            
            sleep_hours_mean = np.random.normal(7.5, 0.8)  # Good sleep
            sleep_hours_std = np.random.normal(0.8, 0.2)
            
            calories_mean = np.random.normal(2200, 300)
            calories_std = np.random.normal(300, 80)
            
            risk_score = np.random.beta(2, 8)  # Skewed toward low risk
        
        # Demographics
        age = np.random.randint(20, 80)
        gender = np.random.choice(['male', 'female'])
        
        # Data availability
        days_with_data = np.random.randint(25, 31)
        
        # Trends (negative = improving, positive = worsening)
        trend_heart_rate = np.random.normal(0, 2)
        trend_steps = np.random.normal(0, 300)
        trend_sleep = np.random.normal(0, 0.3)
        
        data.append({
            'heart_rate_mean': heart_rate_mean,
            'heart_rate_std': heart_rate_std,
            'heart_rate_max': heart_rate_max,
            'heart_rate_min': heart_rate_min,
            'steps_mean': steps_mean,
            'steps_std': steps_std,
            'steps_total': steps_total,
            'sleep_hours_mean': sleep_hours_mean,
            'sleep_hours_std': sleep_hours_std,
            'calories_mean': calories_mean,
            'calories_std': calories_std,
            'age': age,
            'gender': gender,
            'days_with_data': days_with_data,
            'trend_heart_rate': trend_heart_rate,
            'trend_steps': trend_steps,
            'trend_sleep': trend_sleep,
            'risk_score': np.clip(risk_score, 0, 1)
        })
    
    df = pd.DataFrame(data)
    print(f"Data shape: {df.shape}")
    print(f"\nSample data:\n{df.head()}")
    print(f"\nRisk score distribution:\n{df['risk_score'].describe()}")
    
    return df

# ============================================================================
# STEP 2: Data Preprocessing
# ============================================================================

def preprocess_data(df):
    """
    Preprocess data: encode categoricals, normalize features
    """
    print("\nPreprocessing data...")
    
    # Encode gender
    label_encoder = LabelEncoder()
    df['gender_encoded'] = label_encoder.fit_transform(df['gender'])
    
    # Feature columns
    feature_cols = [
        'heart_rate_mean', 'heart_rate_std', 'heart_rate_max', 'heart_rate_min',
        'steps_mean', 'steps_std', 'steps_total',
        'sleep_hours_mean', 'sleep_hours_std',
        'calories_mean', 'calories_std',
        'age', 'gender_encoded', 'days_with_data',
        'trend_heart_rate', 'trend_steps', 'trend_sleep'
    ]
    
    X = df[feature_cols].values
    y = df['risk_score'].values
    
    # Split data
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42
    )
    
    # Normalize features
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)
    
    print(f"Training samples: {len(X_train)}")
    print(f"Test samples: {len(X_test)}")
    print(f"Feature shape: {X_train_scaled.shape}")
    
    return X_train_scaled, X_test_scaled, y_train, y_test, scaler, label_encoder, feature_cols

# ============================================================================
# STEP 3: Build Model Architecture
# ============================================================================

def build_model(input_dim):
    """
    Build deep neural network for health risk prediction
    """
    print(f"\nBuilding model with input dimension: {input_dim}")
    
    model = keras.Sequential([
        # Input layer
        keras.layers.Input(shape=(input_dim,)),
        
        # Hidden layers with dropout for regularization
        keras.layers.Dense(128, activation='relu', name='hidden1'),
        keras.layers.BatchNormalization(),
        keras.layers.Dropout(0.3),
        
        keras.layers.Dense(64, activation='relu', name='hidden2'),
        keras.layers.BatchNormalization(),
        keras.layers.Dropout(0.2),
        
        keras.layers.Dense(32, activation='relu', name='hidden3'),
        keras.layers.Dropout(0.2),
        
        keras.layers.Dense(16, activation='relu', name='hidden4'),
        
        # Output layer (sigmoid for 0-1 probability)
        keras.layers.Dense(1, activation='sigmoid', name='output')
    ])
    
    # Compile model
    model.compile(
        optimizer=keras.optimizers.Adam(learning_rate=0.001),
        loss='mse',  # Mean squared error for regression
        metrics=[
            'mae',  # Mean absolute error
            keras.metrics.RootMeanSquaredError(name='rmse')
        ]
    )
    
    print("\nModel architecture:")
    model.summary()
    
    return model

# ============================================================================
# STEP 4: Train Model
# ============================================================================

def train_model(model, X_train, y_train, X_test, y_test):
    """
    Train model with callbacks
    """
    print("\nTraining model...")
    
    # Callbacks
    early_stopping = keras.callbacks.EarlyStopping(
        monitor='val_loss',
        patience=15,
        restore_best_weights=True,
        verbose=1
    )
    
    model_checkpoint = keras.callbacks.ModelCheckpoint(
        'best_model.keras',
        monitor='val_loss',
        save_best_only=True,
        verbose=1
    )
    
    reduce_lr = keras.callbacks.ReduceLROnPlateau(
        monitor='val_loss',
        factor=0.5,
        patience=5,
        min_lr=0.00001,
        verbose=1
    )
    
    # Train
    history = model.fit(
        X_train, y_train,
        validation_data=(X_test, y_test),
        epochs=100,
        batch_size=32,
        callbacks=[early_stopping, model_checkpoint, reduce_lr],
        verbose=1
    )
    
    # Evaluate
    print("\nFinal evaluation on test set:")
    test_loss, test_mae, test_rmse = model.evaluate(X_test, y_test, verbose=0)
    print(f"Test Loss: {test_loss:.4f}")
    print(f"Test MAE: {test_mae:.4f}")
    print(f"Test RMSE: {test_rmse:.4f}")
    
    return history

# ============================================================================
# STEP 5: Save Model and Preprocessing Objects
# ============================================================================

def save_model_artifacts(model, scaler, label_encoder, feature_cols):
    """
    Save trained model and preprocessing objects
    """
    print("\nSaving model artifacts...")
    
    # Save model in Keras format
    model.save('health_risk_model.keras')
    print("✓ Model saved to 'health_risk_model.keras'")
    
    # Save scaler
    joblib.dump(scaler, 'scaler.pkl')
    print("✓ Scaler saved to 'scaler.pkl'")
    
    # Save label encoder
    joblib.dump(label_encoder, 'label_encoder.pkl')
    print("✓ Label encoder saved to 'label_encoder.pkl'")
    
    # Save feature columns metadata
    metadata = {
        'feature_columns': feature_cols,
        'n_features': len(feature_cols),
        'model_version': '1.0.0',
        'trained_date': datetime.now().isoformat()
    }
    
    with open('model_metadata.json', 'w') as f:
        json.dump(metadata, f, indent=2)
    print("✓ Metadata saved to 'model_metadata.json'")

# ============================================================================
# STEP 6: Inference Example
# ============================================================================

def predict_single_sample(model, scaler, sample_data):
    """
    Example of making a prediction on a single sample
    
    Args:
        model: Trained Keras model
        scaler: Fitted StandardScaler
        sample_data: Dictionary with feature values
    
    Returns:
        Risk score (0-1)
    """
    # Convert sample to array
    features = np.array([[
        sample_data['heart_rate_mean'],
        sample_data['heart_rate_std'],
        sample_data['heart_rate_max'],
        sample_data['heart_rate_min'],
        sample_data['steps_mean'],
        sample_data['steps_std'],
        sample_data['steps_total'],
        sample_data['sleep_hours_mean'],
        sample_data['sleep_hours_std'],
        sample_data['calories_mean'],
        sample_data['calories_std'],
        sample_data['age'],
        sample_data['gender_encoded'],  # 0 for female, 1 for male
        sample_data['days_with_data'],
        sample_data['trend_heart_rate'],
        sample_data['trend_steps'],
        sample_data['trend_sleep']
    ]])
    
    # Scale features
    features_scaled = scaler.transform(features)
    
    # Predict
    risk_score = model.predict(features_scaled, verbose=0)[0][0]
    
    return float(risk_score)

# ============================================================================
# MAIN EXECUTION
# ============================================================================

if __name__ == '__main__':
    print("=" * 80)
    print("HEALTH RISK PREDICTION MODEL - TRAINING")
    print("=" * 80)
    
    # Step 1: Generate/Load data
    df = generate_synthetic_data(n_samples=10000)
    
    # Step 2: Preprocess
    X_train, X_test, y_train, y_test, scaler, label_encoder, feature_cols = preprocess_data(df)
    
    # Step 3: Build model
    model = build_model(input_dim=X_train.shape[1])
    
    # Step 4: Train
    history = train_model(model, X_train, y_train, X_test, y_test)
    
    # Step 5: Save
    save_model_artifacts(model, scaler, label_encoder, feature_cols)
    
    # Step 6: Test inference
    print("\n" + "=" * 80)
    print("TESTING INFERENCE")
    print("=" * 80)
    
    # Example healthy patient
    healthy_sample = {
        'heart_rate_mean': 68,
        'heart_rate_std': 12,
        'heart_rate_max': 110,
        'heart_rate_min': 58,
        'steps_mean': 8500,
        'steps_std': 2500,
        'steps_total': 255000,
        'sleep_hours_mean': 7.5,
        'sleep_hours_std': 0.8,
        'calories_mean': 2200,
        'calories_std': 300,
        'age': 35,
        'gender_encoded': 1,  # male
        'days_with_data': 30,
        'trend_heart_rate': -0.5,  # improving
        'trend_steps': 100,  # improving
        'trend_sleep': 0.1  # stable
    }
    
    risk_healthy = predict_single_sample(model, scaler, healthy_sample)
    print(f"\nHealthy patient risk score: {risk_healthy:.3f} ({risk_healthy*100:.1f}%)")
    
    # Example unhealthy patient
    unhealthy_sample = {
        'heart_rate_mean': 85,
        'heart_rate_std': 20,
        'heart_rate_max': 140,
        'heart_rate_min': 65,
        'steps_mean': 3000,
        'steps_std': 1500,
        'steps_total': 90000,
        'sleep_hours_mean': 5.5,
        'sleep_hours_std': 1.5,
        'calories_mean': 2800,
        'calories_std': 500,
        'age': 55,
        'gender_encoded': 0,  # female
        'days_with_data': 28,
        'trend_heart_rate': 1.5,  # worsening
        'trend_steps': -200,  # worsening
        'trend_sleep': -0.3  # worsening
    }
    
    risk_unhealthy = predict_single_sample(model, scaler, unhealthy_sample)
    print(f"Unhealthy patient risk score: {risk_unhealthy:.3f} ({risk_unhealthy*100:.1f}%)")
    
    print("\n" + "=" * 80)
    print("TRAINING COMPLETE!")
    print("=" * 80)
    print("\nFiles created:")
    print("  - health_risk_model.keras (Keras format)")
    print("  - scaler.pkl (StandardScaler)")
    print("  - label_encoder.pkl (LabelEncoder)")
    print("  - model_metadata.json (Metadata)")
    print("\nNext steps:")
    print("  1. Copy model files to Firebase Functions folder")
    print("  2. Deploy Cloud Functions (see firebase-functions code)")
    print("  3. Test prediction endpoint from Next.js")
