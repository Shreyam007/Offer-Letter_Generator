import mongoose from 'mongoose';

const connectDB = async () => {
  try {
    mongoose.set('bufferCommands', false);
    const mongoURI = process.env.MONGO_URI || 'mongodb://localhost:27017/offerflow';
    const conn = await mongoose.connect(mongoURI, {
      serverSelectionTimeoutMS: 5000
    });
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`MongoDB Connection Error: ${error.message}`);
    // Do not crash the server, just log so fallback can kick in
  }
};

export default connectDB;
