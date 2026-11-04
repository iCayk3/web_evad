package rbx

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

// AutenticacaoResult representa o registro retornado pelo serviço ConsultaAutenticacao do RBX
type AutenticacaoResult struct {
	ID                 string `json:"id"`
	Cliente            string `json:"cliente"`
	Contrato           string `json:"contrato"`
	NAS                string `json:"nas"`
	Porta              string `json:"porta"`
	Usuario            string `json:"usuario"`
	MAC                string `json:"mac"`
	Observacao         string `json:"observacao"`
	EhCentralAssinante bool   `json:"ehCentralAssinante"`
}

// ContratoBaseResult representa dados resumidos de contratos para cruzamento histórico
type ContratoBaseResult struct {
	Numero             string     `json:"numero"`
	ClienteCodigo      string     `json:"clienteCodigo"`
	ClienteNome        string     `json:"clienteNome"`
	ClienteGrupo       string     `json:"clienteGrupo"`
	Assinatura         *time.Time `json:"assinatura"`
	Inicio             *time.Time `json:"inicio"`
	SituacaoCodigo     string     `json:"situacaoCodigo"`
	SituacaoDescricao  string     `json:"situacaoDescricao"`
	DataUltimaOperacao *time.Time `json:"dataUltimaOperacao"`
}

// ContratosHistoricosResult agrupa contratos por número e por cliente
type ContratosHistoricosResult struct {
	PorNumero  map[string]ContratoBaseResult
	PorCliente map[string]ContratoBaseResult
}

// ConsultarAutenticacoes busca a lista completa de autenticações cadastradas no RBX
func (c *Client) ConsultarAutenticacoes(ctx context.Context) ([]AutenticacaoResult, error) {
	targetURL := c.EndpointURLForV1()
	token := strings.TrimSpace(c.config.Token)
	if targetURL == "" || token == "" {
		return nil, fmt.Errorf("URL do RBX e Chave de Integração são obrigatórias")
	}

	payload := map[string]interface{}{
		"ConsultaAutenticacao": map[string]interface{}{
			"Autenticacao": map[string]string{
				"ChaveIntegracao": token,
			},
			"Filtro": "1=1",
		},
	}

	bodyBytes, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("erro ao serializar payload: %v", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, targetURL, bytes.NewBuffer(bodyBytes))
	if err != nil {
		return nil, fmt.Errorf("erro ao criar requisição: %v", err)
	}

	req.Header.Set("Content-Type", "application/json; charset=utf-8")
	req.Header.Set("Accept", "application/json, */*")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("erro ao chamar API RBX: %v", err)
	}
	defer resp.Body.Close()

	respBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("erro ao ler resposta do RBX: %v", err)
	}

	var parsed struct {
		Status   int                      `json:"status"`
		ErroDesc string                   `json:"erro_desc"`
		Result   []map[string]interface{} `json:"result"`
	}

	if err := json.Unmarshal(respBytes, &parsed); err != nil {
		return nil, fmt.Errorf("erro ao decodificar JSON do RBX: %v", err)
	}

	if parsed.Status == 0 && parsed.ErroDesc != "" {
		return nil, fmt.Errorf("RBX retornou erro: %s", parsed.ErroDesc)
	}

	toStr := func(m map[string]interface{}, keys ...string) string {
		for _, k := range keys {
			if v, ok := m[k]; ok && v != nil {
				return strings.TrimSpace(fmt.Sprintf("%v", v))
			}
		}
		return ""
	}

	results := make([]AutenticacaoResult, 0, len(parsed.Result))
	for _, item := range parsed.Result {
		id := toStr(item, "Id", "id")
		if id == "" {
			continue
		}
		nas := toStr(item, "NAS", "nas")
		porta := toStr(item, "Porta", "porta")
		ehCentral := strings.Contains(strings.ToUpper(nas), "CENTRAL") || strings.Contains(strings.ToUpper(porta), "CENTRAL")

		results = append(results, AutenticacaoResult{
			ID:                 id,
			Cliente:            toStr(item, "Cliente", "cliente"),
			Contrato:           toStr(item, "Contrato", "contrato"),
			NAS:                nas,
			Porta:              porta,
			Usuario:            toStr(item, "Usuario", "usuario", "login"),
			MAC:                toStr(item, "MAC", "mac"),
			Observacao:         toStr(item, "Observacao", "observacao"),
			EhCentralAssinante: ehCentral,
		})
	}

	return results, nil
}

// EhGrupoExcluido verifica se a ficha/contrato do cliente faz parte de TESTE, SOL PROVEDOR ou SEM COBRANÇA
func EhGrupoExcluido(grupo string) bool {
	g := strings.ToUpper(strings.TrimSpace(grupo))
	if g == "" {
		return false
	}
	return strings.Contains(g, "TESTE") ||
		strings.Contains(g, "SOL PROVEDOR") ||
		strings.Contains(g, "SEM COBRANCA") ||
		strings.Contains(g, "SEM COBRANÇA")
}

// ConsultarContratosBaseHistorica busca contratos criados até a data informada (YYYY-MM-DD) indexando por número e por cliente
func (c *Client) ConsultarContratosBaseHistorica(ctx context.Context, dataLimite string) (ContratosHistoricosResult, error) {
	targetURL := c.EndpointURLForV1()
	token := strings.TrimSpace(c.config.Token)
	if targetURL == "" || token == "" {
		return ContratosHistoricosResult{}, fmt.Errorf("URL do RBX e Chave de Integração são obrigatórias")
	}

	if dataLimite == "" {
		dataLimite = "2026-01-31"
	}

	filtro := fmt.Sprintf("(Assinatura <= '%s' OR Inicio <= '%s') OR Cliente_Grupo = '(TESTE) TESTE' OR Cliente_Grupo = '(SOL) SOL PROVEDOR' OR Cliente_Grupo = '(SEM COBRANCA) SEM COBRANCA'", dataLimite, dataLimite)
	payload := map[string]interface{}{
		"ConsultaContratos": map[string]interface{}{
			"Autenticacao": map[string]string{
				"ChaveIntegracao": token,
			},
			"Filtro": filtro,
		},
	}

	bodyBytes, err := json.Marshal(payload)
	if err != nil {
		return ContratosHistoricosResult{}, fmt.Errorf("erro ao serializar payload: %v", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, targetURL, bytes.NewBuffer(bodyBytes))
	if err != nil {
		return ContratosHistoricosResult{}, fmt.Errorf("erro ao criar requisição: %v", err)
	}

	req.Header.Set("Content-Type", "application/json; charset=utf-8")
	req.Header.Set("Accept", "application/json, */*")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return ContratosHistoricosResult{}, fmt.Errorf("erro ao chamar API RBX: %v", err)
	}
	defer resp.Body.Close()

	respBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return ContratosHistoricosResult{}, fmt.Errorf("erro ao ler resposta: %v", err)
	}

	var parsed struct {
		Status   int                      `json:"status"`
		ErroDesc string                   `json:"erro_desc"`
		Result   []map[string]interface{} `json:"result"`
	}

	if err := json.Unmarshal(respBytes, &parsed); err != nil {
		return ContratosHistoricosResult{}, fmt.Errorf("erro ao decodificar JSON: %v", err)
	}

	toStr := func(m map[string]interface{}, keys ...string) string {
		for _, k := range keys {
			if v, ok := m[k]; ok && v != nil {
				return strings.TrimSpace(fmt.Sprintf("%v", v))
			}
		}
		return ""
	}

	parseDate := func(s string) *time.Time {
		s = strings.TrimSpace(s)
		if s == "" || s == "0000-00-00" {
			return nil
		}
		formats := []string{"2006-01-02", "2006-01-02 15:04:05", "02/01/2006", "02/01/2006 15:04:05"}
		for _, f := range formats {
			if t, err := time.Parse(f, s); err == nil {
				return &t
			}
		}
		return nil
	}

	porNumero := make(map[string]ContratoBaseResult)
	porCliente := make(map[string]ContratoBaseResult)

	for _, rc := range parsed.Result {
		num := toStr(rc, "Numero", "codigo_contrato")
		if num == "" {
			continue
		}
		cli := toStr(rc, "Cliente_Codigo", "codigo_cliente")
		c := ContratoBaseResult{
			Numero:             num,
			ClienteCodigo:      cli,
			ClienteNome:        toStr(rc, "Cliente_Nome", "nome_cliente"),
			ClienteGrupo:       toStr(rc, "Cliente_Grupo", "grupo", "cliente_grupo"),
			Assinatura:         parseDate(toStr(rc, "Assinatura")),
			Inicio:             parseDate(toStr(rc, "Inicio")),
			SituacaoCodigo:     toStr(rc, "Situacao_Codigo"),
			SituacaoDescricao:  toStr(rc, "Situacao_Descricao"),
			DataUltimaOperacao: parseDate(toStr(rc, "DataUltimaOperacao")),
		}
		porNumero[num] = c
		if cli != "" {
			if existing, ok := porCliente[cli]; !ok {
				porCliente[cli] = c
			} else {
				// Prioriza contrato Ativo > Transferido > mais recente
				if c.SituacaoCodigo == "A" ||
					(existing.SituacaoCodigo != "A" && c.SituacaoCodigo == "T") ||
					(existing.SituacaoCodigo != "A" && existing.SituacaoCodigo != "T" && c.Assinatura != nil && (existing.Assinatura == nil || c.Assinatura.After(*existing.Assinatura))) {
					porCliente[cli] = c
				}
			}
		}
	}

	return ContratosHistoricosResult{
		PorNumero:  porNumero,
		PorCliente: porCliente,
	}, nil
}

// ConsultarContratosAteData mantém compatibilidade retornando o mapa por número
func (c *Client) ConsultarContratosAteData(ctx context.Context, dataLimite string) (map[string]ContratoBaseResult, error) {
	hist, err := c.ConsultarContratosBaseHistorica(ctx, dataLimite)
	if err != nil {
		return nil, err
	}
	return hist.PorNumero, nil
}
