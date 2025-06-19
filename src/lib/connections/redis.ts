import IORedis from "ioredis";

class Redis {
  private static instance: IORedis | null = null;

  public static getInstance(): IORedis {
    if ( !Redis.instance ) {
      const redisUrl = process.env.REDIS_URL;

      if ( !redisUrl ) {
        throw new Error( "REDIS_URL environment variable is required" );
      }

      Redis.instance = new IORedis(
        redisUrl,
        {
          maxRetriesPerRequest: null,
          lazyConnect: true,
          enableReadyCheck: false,
          family: 4, // Force IPv4
        }
      );

      // Handle connection events
      Redis.instance.on(
        "error",
        ( error ) => {
          console.error(
            "[Redis] Connection error:",
            error
          );
        }
      );

      Redis.instance.on(
        "connect",
        () => {
          console.log( "[Redis] Connected successfully" );
        }
      );

      Redis.instance.on(
        "ready",
        () => {
          console.log( "[Redis] Ready to accept commands" );
        }
      );

      Redis.instance.on(
        "close",
        () => {
          console.log( "[Redis] Connection closed" );
        }
      );
    }

    return Redis.instance;
  }

  public static async disconnect(): Promise<void> {
    if ( Redis.instance ) {
      await Redis.instance.quit();
      Redis.instance = null;
      console.log( "[Redis] Connection closed gracefully" );
    }
  }
}

export default Redis;