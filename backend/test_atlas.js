import mongoose from 'mongoose';

const uri = 'mongodb+srv://pshreyambbk_db_user:I6CdO91uCVymkEI0@cluster0.a290umo.mongodb.net/offerflow?appName=Cluster0';

async function test() {
  console.log('Testing connection to Atlas...');
  try {
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000
    });
    console.log('SUCCESS: Connected to MongoDB Atlas!');
    console.log('Host:', conn.connection.host);
    await mongoose.disconnect();
  } catch (error) {
    console.error('ERROR: Failed to connect to MongoDB Atlas!');
    console.error(error.message);
  }
}

test();
