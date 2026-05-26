import mongoose from 'mongoose';

let lastConnectionError = null;

const connectDB = async () => {
  try {
    mongoose.set('bufferCommands', false);
    const mongoURI = process.env.MONGO_URI || 'mongodb://localhost:27017/offerflow';
    const conn = await mongoose.connect(mongoURI, {
      serverSelectionTimeoutMS: 5000
    });
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    lastConnectionError = null;
  } catch (error) {
    console.error(`MongoDB Connection Error: ${error.message}`);
    lastConnectionError = error.message;
  }
};

const getConnectionError = () => lastConnectionError;

export { connectDB as default, getConnectionError };
