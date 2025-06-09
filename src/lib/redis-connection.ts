import IORedis from "ioredis";

class RedisConnection {
  private static instance: IORedis | null = null;

  public static getInstance(): IORedis {
    if ( !RedisConnection.instance ) {
      const redisUrl = process.env.REDIS_URL;

      if ( !redisUrl ) {
        throw new Error( "REDIS_URL environment variable is required" );
      }

      RedisConnection.instance = new IORedis(
        redisUrl,
        {
          maxRetriesPerRequest: null,
          lazyConnect: true,
          // retryDelayOnFailover: 100,
          enableReadyCheck: false,
          family: 4, // Force IPv4
        }
      );

      // Handle connection events
      RedisConnection.instance.on(
        "error",
        ( error ) => {
          console.error(
            "[Redis] Connection error:",
            error
          );
        }
      );

      RedisConnection.instance.on(
        "connect",
        () => {
          console.log( "[Redis] Connected successfully" );
        }
      );

      RedisConnection.instance.on(
        "ready",
        () => {
          console.log( "[Redis] Ready to accept commands" );
        }
      );

      RedisConnection.instance.on(
        "close",
        () => {
          console.log( "[Redis] Connection closed" );
        }
      );
    }

    return RedisConnection.instance;
  }

  public static async disconnect(): Promise<void> {
    if ( RedisConnection.instance ) {
      await RedisConnection.instance.quit();
      RedisConnection.instance = null;
      console.log( "[Redis] Connection closed gracefully" );
    }
  }
}

export default RedisConnection;