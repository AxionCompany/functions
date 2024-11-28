import { MongoClient, MongoNetworkError } from "npm:mongodb@6.7.0";
const clients = {};

export default async ({ config }) => {
  if (!clients[config.url]) {
    const client = new MongoClient(config.url, {
      connectTimeoutMS: 30000,
      socketTimeoutMS: 45000,
      retryWrites: true,
      useNewUrlParser: true,
      useUnifiedTopology: true,
      maxPoolSize: 50,
      serverSelectionTimeoutMS: 30000,
    });

    // Function to handle connection with retry logic
    const connectWithRetry = async (retries = 5) => {
      console.log('Creating new connection');
      try {
        await client.connect();
        console.log("Connected successfully to MongoDB server");
        
        // Add connection monitoring
        client.on('close', () => {
          console.log('MongoDB connection closed');
          delete clients[config.url];
        });
        
      } catch (error) {
        if (error instanceof MongoNetworkError && retries > 0) {
          console.error(`Failed to connect to MongoDB server, retrying... (${retries} attempts left)`, error);
          await new Promise(resolve => setTimeout(resolve, 5000));
          return connectWithRetry(retries - 1);
        } else {
          console.error("Failed to connect to MongoDB server after all retries", error);
          throw error;
        }
      }
    };

    await connectWithRetry();
    clients[config.url] = client;
  }

  const db = clients[config.url].db(config.dbName);
  return (collection) => db.collection(collection);
};