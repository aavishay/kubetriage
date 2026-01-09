package cache

import (
	"context"
	"log"
	"time"

	"github.com/redis/go-redis/v9"
)

var RDB *redis.Client

func InitRedis(addr string) {
	if addr == "" {
		addr = "localhost:6379" // Default to local for dev
		log.Println("ℹ️ Redis: No REDIS_ADDR set, using default: localhost:6379")
	}

	RDB = redis.NewClient(&redis.Options{
		Addr: addr,
	})

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := RDB.Ping(ctx).Err(); err != nil {
		log.Printf("⚠️ Redis Warning: Failed to connect to Redis at %s: %v", addr, err)
		return // Don't crash, just no cache
	}

	log.Println("✅ Connected to Redis")
}

func Set(ctx context.Context, key string, value interface{}, ttl time.Duration) error {
	if RDB == nil {
		return nil
	}
	return RDB.Set(ctx, key, value, ttl).Err()
}

func Get(ctx context.Context, key string) (string, error) {
	if RDB == nil {
		return "", redis.Nil
	}
	return RDB.Get(ctx, key).Result()
}
