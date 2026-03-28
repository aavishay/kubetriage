package cache

import (
	"context"
	"fmt"
	"sync"
	"time"
)

type cacheEntry struct {
	value     string
	expiresAt time.Time
}

const (
	TTLWorkloads = 10 * time.Second
	TTLMetrics   = 60 * time.Second
	TTLAnalysis  = 24 * time.Hour
)

var (
	memCache = make(map[string]cacheEntry)
	memMu    sync.RWMutex
)

// InitRedis is now a no-op for backwards compatibility
func InitRedis(addr string) {
	// Redis removed - using in-memory cache
}

// Set stores a value with TTL (ctx is unused but kept for API compatibility)
func Set(ctx context.Context, key string, value interface{}, ttl time.Duration) error {
	var strVal string
	switch v := value.(type) {
	case string:
		strVal = v
	case []byte:
		strVal = string(v)
	default:
		strVal = fmt.Sprintf("%v", v)
	}

	memMu.Lock()
	defer memMu.Unlock()
	memCache[key] = cacheEntry{
		value:     strVal,
		expiresAt: time.Now().Add(ttl),
	}
	return nil
}

// Get retrieves a value by key (ctx is unused but kept for API compatibility)
func Get(ctx context.Context, key string) (string, error) {
	memMu.RLock()
	entry, exists := memCache[key]
	memMu.RUnlock()

	if !exists {
		return "", ErrCacheMiss
	}

	if time.Now().After(entry.expiresAt) {
		memMu.Lock()
		// Double check existence to avoid race conditions
		if currentEntry, stillExists := memCache[key]; stillExists && time.Now().After(currentEntry.expiresAt) {
			delete(memCache, key)
		}
		memMu.Unlock()
		return "", ErrCacheMiss
	}
	return entry.value, nil
}

// ErrCacheMiss is returned when a key is not found or expired
var ErrCacheMiss = &CacheMissError{}

type CacheMissError struct{}

func (e *CacheMissError) Error() string {
	return "cache miss"
}
