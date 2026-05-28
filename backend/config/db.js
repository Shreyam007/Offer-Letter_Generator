// backend/config/db.js
import mongoose from 'mongoose';

let lastConnectionError = null;
export const dbReady = { value: false }; // flag indicating DB connection status

/**
 * Returns a promise that resolves when the DB is ready or rejects after timeoutMs.
 * Used by route handlers to fallback to in‑memory data while the connection is pending.
 */
export const waitForDb = (timeoutMs = 5000) => new Promise((resolve, reject) => {
  if (dbReady.value) return resolve();
  const start = Date.now();
  const interval = setInterval(() => {
    if (dbReady.value) {
      clearInterval(interval);
      return resolve();
    }
    if (Date.now() - start > timeoutMs) {
      clearInterval(interval);
      return reject(new Error('DB connection timeout'));
    }
  }, 100);
});

export const connectDB = async () => {
  try {
    mongoose.set('bufferCommands', false);
    const mongoURI = process.env.MONGO_URI || 'mongodb://localhost:27017/offerflow';
    await mongoose.connect(mongoURI, { serverSelectionTimeoutMS: 5000 });
    console.log(`MongoDB Connected: ${mongoose.connection.host}`);
    lastConnectionError = null;
    dbReady.value = true; // mark ready
  } catch (error) {
    console.error(`MongoDB Connection Error: ${error.message}`);
    lastConnectionError = error.message;
    dbReady.value = false;
  }
};

export const getConnectionError = () => lastConnectionError;

export { connectDB as default, getConnectionError };
