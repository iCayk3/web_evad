package rbx

import (
	"errors"
	"fmt"
	"sync"
	"time"

	"golang.org/x/sync/singleflight"
)

var (
	// ErrCircuitBreakerOpen disparado quando o limite de falhas foi atingido e o circuito está aberto
	ErrCircuitBreakerOpen = errors.New("o servidor RBXSoft configurado não respondeu adequadamente. O sistema pausou novas tentativas por 30 segundos para evitar travamentos. Por favor, verifique a conectividade com o RBX")
)

// CircuitBreaker protege o provedor e a aplicação contra falhas em cascata e esgotamento de conexões
type CircuitBreaker struct {
	mu                  sync.Mutex
	consecutiveFailures int
	circuitOpenUntil    time.Time
	failureThreshold    int
	cooldown            time.Duration
}

// NewCircuitBreaker cria uma instância de CircuitBreaker com limites padrão
func NewCircuitBreaker(threshold int, cooldown time.Duration) *CircuitBreaker {
	if threshold <= 0 {
		threshold = 5
	}
	if cooldown <= 0 {
		cooldown = 30 * time.Second
	}
	return &CircuitBreaker{
		failureThreshold: threshold,
		cooldown:         cooldown,
	}
}

// AllowRequest verifica se o circuito permite uma nova requisição
func (cb *CircuitBreaker) AllowRequest() error {
	cb.mu.Lock()
	defer cb.mu.Unlock()

	now := time.Now()
	if cb.circuitOpenUntil.After(now) {
		remaining := time.Until(cb.circuitOpenUntil).Round(time.Second)
		return fmt.Errorf("%w (resfriando por mais %v)", ErrCircuitBreakerOpen, remaining)
	}

	return nil
}

// RecordSuccess registra uma chamada bem-sucedida e zera o contador de falhas
func (cb *CircuitBreaker) RecordSuccess() {
	cb.mu.Lock()
	defer cb.mu.Unlock()

	cb.consecutiveFailures = 0
	cb.circuitOpenUntil = time.Time{}
}

// RecordFailure registra uma falha e, se atingir o limiar, abre o circuito
func (cb *CircuitBreaker) RecordFailure() {
	cb.mu.Lock()
	defer cb.mu.Unlock()

	cb.consecutiveFailures++
	if cb.consecutiveFailures >= cb.failureThreshold {
		cb.circuitOpenUntil = time.Now().Add(cb.cooldown)
	}
}

// Reset zera o estado do Circuit Breaker
func (cb *CircuitBreaker) Reset() {
	cb.mu.Lock()
	defer cb.mu.Unlock()

	cb.consecutiveFailures = 0
	cb.circuitOpenUntil = time.Time{}
}

type cacheItem struct {
	data      interface{}
	expiresAt time.Time
}

// EphemeralCache cache em memória com TTL curto para evitar consultas repetitivas ao RBX
type EphemeralCache struct {
	mu    sync.RWMutex
	items map[string]cacheItem
}

// NewEphemeralCache inicializa o cache com limpeza periódica
func NewEphemeralCache() *EphemeralCache {
	c := &EphemeralCache{
		items: make(map[string]cacheItem),
	}
	// Goroutine de limpeza periódica de itens expirados
	go func() {
		ticker := time.NewTicker(2 * time.Minute)
		for range ticker.C {
			c.mu.Lock()
			now := time.Now()
			for k, v := range c.items {
				if v.expiresAt.Before(now) {
					delete(c.items, k)
				}
			}
			c.mu.Unlock()
		}
	}()
	return c
}

// Get recupera um item do cache caso não esteja expirado
func (c *EphemeralCache) Get(key string) (interface{}, bool) {
	c.mu.RLock()
	defer c.mu.RUnlock()

	item, exists := c.items[key]
	if !exists {
		return nil, false
	}

	if time.Now().After(item.expiresAt) {
		return nil, false
	}

	return item.data, true
}

// Set armazena um item com tempo de vida definido
func (c *EphemeralCache) Set(key string, data interface{}, ttl time.Duration) {
	c.mu.Lock()
	defer c.mu.Unlock()

	c.items[key] = cacheItem{
		data:      data,
		expiresAt: time.Now().Add(ttl),
	}
}

// Clear esvazia o cache
func (c *EphemeralCache) Clear() {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.items = make(map[string]cacheItem)
}

// EngineResiliencia agrega CircuitBreaker, SingleFlight e Cache em uma camada única
type EngineResiliencia struct {
	Breaker     *CircuitBreaker
	Cache       *EphemeralCache
	SingleGroup singleflight.Group
}

// DefaultEngine instância global padrão de resiliência RBX
var DefaultEngine = &EngineResiliencia{
	Breaker: NewCircuitBreaker(5, 30*time.Second),
	Cache:   NewEphemeralCache(),
}

// ExecuteRequest executa uma função de consulta ao RBX com proteção de Circuit Breaker, SingleFlight e Cache
func (e *EngineResiliencia) ExecuteRequest(cacheKey string, ttl time.Duration, fn func() (interface{}, error)) (interface{}, error) {
	// 1. Consulta o cache efêmero
	if cacheKey != "" {
		if val, ok := e.Cache.Get(cacheKey); ok {
			return val, nil
		}
	}

	// 2. Consulta o Circuit Breaker
	if err := e.Breaker.AllowRequest(); err != nil {
		return nil, err
	}

	// 3. Executa via SingleFlight (coalesce requisições idênticas simultâneas)
	if cacheKey == "" {
		cacheKey = fmt.Sprintf("req_%d", time.Now().UnixNano())
	}

	res, err, _ := e.SingleGroup.Do(cacheKey, func() (interface{}, error) {
		val, callErr := fn()
		if callErr != nil {
			e.Breaker.RecordFailure()
			return nil, callErr
		}
		e.Breaker.RecordSuccess()
		if ttl > 0 {
			e.Cache.Set(cacheKey, val, ttl)
		}
		return val, nil
	})

	return res, err
}
