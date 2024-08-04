import { MongoClient, MongoNetworkError } from "npm:mongodb@6.7.0";
const clients = {};

export default async ({ config }) => {
  if (!clients[config.url]) {
    const client = new MongoClient(config.url, {
      connectTimeoutMS: 30000,
      socketTimeoutMS: 45000,
      retryWrites: true,
      // minPoolSize: 100,
      // maxPoolSize:200,
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    // Function to handle connection with retry logic
    const connectWithRetry = async () => {
      console.log('creating new connection')
      try {
        await client.connect();
        console.log("Connected successfully to MongoDB server");
      } catch (error) {
        if (error instanceof MongoNetworkError) {
          console.error("Failed to connect to MongoDB server, retrying...", error);
          setTimeout(connectWithRetry, 5000); // Retry after 5 seconds
        } else {
          console.error("An unexpected error occurred", error);
          throw error; // Rethrow if error is not a network error
        }
      }
    };

    await connectWithRetry();
    clients[config.url] = client;
  }

  const db = clients[config.url].db(config.dbName);
  return (collection) => db.collection(collection);
};