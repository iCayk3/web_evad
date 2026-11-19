package rbx

import (
	"errors"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

func TestCircuitBreaker_OpenAndReset(t *testing.T) {
	cb := NewCircuitBreaker(3, 100*time.Millisecond)

	// Inicialmente fechado
	if err := cb.AllowRequest(); err != nil {
		t.Fatalf("Esperava circuito fechado, mas retornou erro: %v", err)
	}

	// 2 falhas: ainda fechado
	cb.RecordFailure()
	cb.RecordFailure()
	if err := cb.AllowRequest(); err != nil {
		t.Fatalf("Com 2 falhas deveria continuar fechado, mas retornou: %v", err)
	}

	// 3ª falha: circuito abre
	cb.RecordFailure()
	if err := cb.AllowRequest(); err == nil {
		t.Fatal("Esperava circuito aberto na 3ª falha, mas permitiu requisição!")
	}

	// Espera cooldown expirar
	time.Sleep(120 * time.Millisecond)
	if err := cb.AllowRequest(); err != nil {
		t.Fatalf("Após cooldown esperava circuito fechado, mas retornou: %v", err)
	}
}

func TestEphemeralCache(t *testing.T) {
	cache := NewEphemeralCache()

	cache.Set("teste_key", "meu_valor", 50*time.Millisecond)

	val, ok := cache.Get("teste_key")
	if !ok || val != "meu_valor" {
		t.Fatalf("Esperava encontrar valor no cache, retornou ok=%v val=%v", ok, val)
	}

	// Espera expirar
	time.Sleep(60 * time.Millisecond)
	_, ok = cache.Get("teste_key")
	if ok {
		t.Fatal("Item deveria ter expirado, mas ainda está no cache!")
	}
}

func TestEngineResiliencia_SingleFlight(t *testing.T) {
	engine := &EngineResiliencia{
		Breaker: NewCircuitBreaker(5, 10*time.Second),
		Cache:   NewEphemeralCache(),
	}

	var callCount int32
	var wg sync.WaitGroup

	// Dispara 10 requisições concorrentes idênticas
	for i := 0; i < 10; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			_, _ = engine.ExecuteRequest("chave_concorrente", 1*time.Second, func() (interface{}, error) {
				atomic.AddInt32(&callCount, 1)
				time.Sleep(20 * time.Millisecond)
				return "sucesso", nil
			})
		}()
	}

	wg.Wait()

	// Graças ao SingleFlight, a função interna só deve ter sido executada 1 vez!
	if atomic.LoadInt32(&callCount) != 1 {
		t.Errorf("Esperava exatamente 1 chamada executada via SingleFlight, mas ocorreram %d!", callCount)
	}
}

func TestEngineResiliencia_CircuitBreakerTrips(t *testing.T) {
	engine := &EngineResiliencia{
		Breaker: NewCircuitBreaker(2, 50*time.Millisecond),
		Cache:   NewEphemeralCache(),
	}

	simulatedErr := errors.New("timeout RBX")

	// 1ª falha
	_, _ = engine.ExecuteRequest("k1", 0, func() (interface{}, error) {
		return nil, simulatedErr
	})

	// 2ª falha -> abre
	_, _ = engine.ExecuteRequest("k2", 0, func() (interface{}, error) {
		return nil, simulatedErr
	})

	// 3ª tentativa deve ser bloqueada antes mesmo de executar fn
	executed := false
	_, err := engine.ExecuteRequest("k3", 0, func() (interface{}, error) {
		executed = true
		return "ok", nil
	})

	if executed {
		t.Fatal("A função não deveria ter sido executada com o Circuit Breaker aberto!")
	}
	if err == nil {
		t.Fatal("Esperava erro de Circuit Breaker aberto, mas não retornou erro!")
	}
}
