package rbx

import (
	"bytes"
	"context"
	"crypto/tls"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"
)

// RbxStatusDefinition define os metadados de cada situação de contrato no RBX
type RbxStatusDefinition struct {
	Code        string `json:"code"`
	Name        string `json:"name"`
	Description string `json:"description"`
	Category    string `json:"category"` // 'returned', 'blocked', 'churned', 'suspended', 'other'
	Color       string `json:"color"`    // Classe visual para frontend
}

// RbxStatusCatalog retorna o catálogo completo e oficial de situações de contrato do RBX ISP
func RbxStatusCatalog() []RbxStatusDefinition {
	return []RbxStatusDefinition{
		{
			Code:        "A",
			Name:        "Ativo",
			Description: "Contrato regular e ativo. Cliente navegando normalmente. Representa que a fatura foi quitada e o cliente retornou à base.",
			Category:    "returned",
			Color:       "emerald",
		},
		{
			Code:        "B",
			Name:        "Bloqueado",
			Description: "Bloqueio financeiro total por inadimplência. O cliente continua bloqueado aguardando regularização.",
			Category:    "blocked",
			Color:       "slate",
		},
		{
			Code:        "C",
			Name:        "Cancelado",
			Description: "Contrato encerrado definitivamente (churn). O provedor registrou rescisão formal do contrato.",
			Category:    "churned",
			Color:       "rose",
		},
		{
			Code:        "S",
			Name:        "Suspenso",
			Description: "Contrato com suspensão temporária (a pedido do assinante, viagem/férias, ou determinação administrativa/judicial).",
			Category:    "suspended",
			Color:       "amber",
		},
		{
			Code:        "D",
			Name:        "Desbloqueio Temporário",
			Description: "Desbloqueio de confiança / promessa de pagamento (liberação provisória por 48h a 72h). Em vias de regularização.",
			Category:    "returned",
			Color:       "blue",
		},
		{
			Code:        "P",
			Name:        "Bloqueio Parcial / Redução",
			Description: "Redução de velocidade ou aviso prévio em tela antes do corte total de conexão por inadimplência.",
			Category:    "blocked",
			Color:       "slate",
		},
		{
			Code:        "E",
			Name:        "Aguardando Instalação",
			Description: "Contrato recém cadastrado na base aguardando visita do técnico para ativação física.",
			Category:    "other",
			Color:       "cyan",
		},
		{
			Code:        "I",
			Name:        "Em Instalação",
			Description: "Contrato com ordem de serviço aberta em execução de instalação e implantação de rede.",
			Category:    "other",
			Color:       "cyan",
		},
		{
			Code:        "T",
			Name:        "Transferido",
			Description: "Contrato transferido (mudança de titularidade para outro CPF/CNPJ ou alteração de ponto de endereço).",
			Category:    "other",
			Color:       "indigo",
		},
		{
			Code:        "N",
			Name:        "Inativo / Desativado",
			Description: "Contrato desativado no sistema sem rescisão formal ou histórico encerrado.",
			Category:    "churned",
			Color:       "rose",
		},
	}
}

// NormalizeRbxStatus mapeia o código bruto ou descrição do RBX para metadados padronizados
func NormalizeRbxStatus(codeRaw string, descRaw string) (code string, name string, category string) {
	c := strings.ToUpper(strings.TrimSpace(codeRaw))
	d := strings.TrimSpace(descRaw)

	catalog := RbxStatusCatalog()
	for _, item := range catalog {
		if item.Code == c {
			if d != "" {
				return item.Code, d, item.Category
			}
			return item.Code, item.Name, item.Category
		}
	}

	// Caso venha apenas descrição ou formato textual
	dLower := strings.ToLower(d)
	if strings.Contains(dLower, "desbloq") || strings.Contains(dLower, "confian") || strings.Contains(dLower, "promess") {
		return "D", "Desbloqueio Temporário", "returned"
	} else if strings.Contains(dLower, "ativ") {
		return "A", "Ativo", "returned"
	} else if strings.Contains(dLower, "cancel") || strings.Contains(dLower, "rescis") {
		return "C", "Cancelado", "churned"
	} else if strings.Contains(dLower, "bloq") {
		return "B", "Bloqueado", "blocked"
	} else if strings.Contains(dLower, "suspens") {
		return "S", "Suspenso", "suspended"
	} else if strings.Contains(dLower, "aguard") {
		return "E", "Aguardando Instalação", "other"
	} else if strings.Contains(dLower, "instal") {
		return "I", "Em Instalação", "other"
	} else if strings.Contains(dLower, "transf") {
		return "T", "Transferido", "other"
	}

	if c == "" {
		c = "?"
	}
	if d == "" {
		d = c
	}
	return c, d, "other"
}

type Config struct {
	URL           string     `json:"url"`
	Token         string     `json:"token"`
	TokenMasked   string     `json:"tokenMasked"`
	HasToken      bool       `json:"hasToken"`
	Version       string     `json:"version"` // 'v2' or 'v1'
	AutoSync      bool       `json:"autoSync"`
	LastSyncAt    *time.Time `json:"lastSyncAt"`
	StatusConexao string     `json:"statusConexao"` // 'conectado', 'erro', 'desconectado'
	UltimoErro    string     `json:"ultimoErro"`
}

type Client struct {
	httpClient *http.Client
	config     Config
}

func NewClient(cfg Config) *Client {
	tr := &http.Transport{
		TLSClientConfig: &tls.Config{
			InsecureSkipVerify: true, // Provedores de internet frequentemente usam certificados locais ou autoassinados
		},
	}

	return &Client{
		httpClient: &http.Client{
			Transport: tr,
			Timeout:   45 * time.Second,
		},
		config: cfg,
	}
}

// MaskToken mascara o token para exibição segura (ex: "••••••••4a8b")
func MaskToken(token string) string {
	token = strings.TrimSpace(token)
	if len(token) <= 6 {
		return "••••••••"
	}
	return "••••••••" + token[len(token)-4:]
}

type TestResult struct {
	Success    bool   `json:"success"`
	StatusCode int    `json:"statusCode"`
	Message    string `json:"message"`
	LatencyMs  int64  `json:"latencyMs"`
}

func (c *Client) EndpointURLForV1() string {
	u := strings.TrimSpace(c.config.URL)
	if u == "" {
		return ""
	}
	if !strings.HasPrefix(u, "http://") && !strings.HasPrefix(u, "https://") {
		u = "https://" + u
	}
	u = strings.TrimRight(u, "/")
	if strings.HasSuffix(u, "/routerbox/ws_json/ws_json.php") {
		return strings.TrimSuffix(u, "/routerbox/ws_json/ws_json.php") + "/routerbox/ws/rbx_server_json.php"
	}
	if strings.HasSuffix(u, "/ws_json/ws_json.php") {
		return strings.TrimSuffix(u, "/ws_json/ws_json.php") + "/routerbox/ws/rbx_server_json.php"
	}
	if strings.HasSuffix(u, "/routerbox/ws/rbx_server_json.php") {
		return u
	}
	if !strings.HasSuffix(u, ".php") {
		return u + "/routerbox/ws/rbx_server_json.php"
	}
	return u
}

func (c *Client) EndpointURLForV2() string {
	u := strings.TrimSpace(c.config.URL)
	if u == "" {
		return ""
	}
	if !strings.HasPrefix(u, "http://") && !strings.HasPrefix(u, "https://") {
		u = "https://" + u
	}
	u = strings.TrimRight(u, "/")
	if strings.HasSuffix(u, "/routerbox/ws/rbx_server_json.php") {
		return strings.TrimSuffix(u, "/routerbox/ws/rbx_server_json.php") + "/routerbox/ws_json/ws_json.php"
	}
	if strings.HasSuffix(u, "/routerbox/ws_json/ws_json.php") {
		return u
	}
	if !strings.HasSuffix(u, ".php") {
		return u + "/routerbox/ws_json/ws_json.php"
	}
	return u
}

func (c *Client) NormalizeEndpointURL() string {
	if c.config.Version == "v2" {
		return c.EndpointURLForV2()
	}
	return c.EndpointURLForV1()
}

// TestConnection realiza uma consulta de teste no endpoint RBX
func (c *Client) TestConnection(ctx context.Context) TestResult {
	targetURL := c.EndpointURLForV1()
	if targetURL == "" {
		return TestResult{
			Success: false,
			Message: "A URL do RBX não foi informada.",
		}
	}

	token := strings.TrimSpace(c.config.Token)
	if token == "" {
		return TestResult{
			Success: false,
			Message: "A chave de acesso (token) não foi informada.",
		}
	}

	startTime := time.Now()

	testPayload := map[string]interface{}{
		"ConsultaContratos": map[string]interface{}{
			"Autenticacao": map[string]string{
				"ChaveIntegracao": token,
			},
			"Filtro": "Cliente_Codigo = '1' OR Numero > '0'",
		},
	}
	bodyBytes, _ := json.Marshal(testPayload)

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, targetURL, bytes.NewBuffer(bodyBytes))
	if err != nil {
		return TestResult{
			Success: false,
			Message: fmt.Sprintf("Erro ao preparar requisição: %v", err),
		}
	}

	req.Header.Set("Content-Type", "application/json; charset=utf-8")
	req.Header.Set("Accept", "application/json, */*")

	resp, err := c.httpClient.Do(req)
	latency := time.Since(startTime).Milliseconds()

	if err != nil {
		errStr := err.Error()
		if strings.Contains(errStr, "connection refused") || strings.Contains(errStr, "no such host") {
			return TestResult{
				Success:   false,
				LatencyMs: latency,
				Message:   "Servidor RBX inalcançável. Verifique se o endereço IP/domínio e a porta estão corretos e acessíveis.",
			}
		}
		if strings.Contains(errStr, "timeout") || strings.Contains(errStr, "deadline") {
			return TestResult{
				Success:   false,
				LatencyMs: latency,
				Message:   "Tempo limite esgotado (Timeout) ao tentar conectar no RBX.",
			}
		}
		return TestResult{
			Success:   false,
			LatencyMs: latency,
			Message:   fmt.Sprintf("Erro na conexão: %v", err),
		}
	}
	defer resp.Body.Close()

	bodyResp, _ := io.ReadAll(resp.Body)

	if resp.StatusCode == http.StatusUnauthorized || resp.StatusCode == http.StatusForbidden {
		return TestResult{
			Success:    false,
			StatusCode: resp.StatusCode,
			LatencyMs:  latency,
			Message:    "Autenticação recusada pelo RBX. A chave informada é inválida ou não possui permissão.",
		}
	}

	var rbxResp struct {
		Status           interface{} `json:"status"`
		ErrorCode        interface{} `json:"error_code"`
		ErroCode         interface{} `json:"erro_code"`
		ErrorDescription string      `json:"error_description"`
		ErroDesc         string      `json:"erro_desc"`
		ErroDetail       string      `json:"erro_detail"`
		Result           interface{} `json:"result"`
	}
	if err := json.Unmarshal(bodyResp, &rbxResp); err == nil {
		resStr := fmt.Sprintf("%v", rbxResp.Result)
		errStr := rbxResp.ErrorDescription
		if errStr == "" {
			errStr = rbxResp.ErroDesc
		}
		if rbxResp.ErroDetail != "" {
			if errStr != "" {
				errStr = errStr + " (" + rbxResp.ErroDetail + ")"
			} else {
				errStr = rbxResp.ErroDetail
			}
		}

		errCodeStr := fmt.Sprintf("%v", rbxResp.ErrorCode)
		if errCodeStr == "<nil>" || errCodeStr == "0" || errCodeStr == "" {
			errCodeStr = fmt.Sprintf("%v", rbxResp.ErroCode)
		}

		if errCodeStr == "97" || strings.Contains(strings.ToLower(errStr), "invalida ou inativa") {
			return TestResult{
				Success:    false,
				StatusCode: resp.StatusCode,
				LatencyMs:  latency,
				Message:    "Chave de integração inválida ou inativa no painel do RBX.",
			}
		}

		if strings.Contains(strings.ToLower(resStr), "invalid service") || strings.Contains(strings.ToLower(errStr), "invalid service") || errCodeStr == "98" {
			return TestResult{
				Success:    false,
				StatusCode: resp.StatusCode,
				LatencyMs:  latency,
				Message:    "O RBX retornou 'Invalid service!'. Verifique a URL do servidor ou as permissões da chave.",
			}
		}

		// Se status = 1 ou consulta executada sem registros (erro_code: 1)
		if fmt.Sprintf("%v", rbxResp.Status) == "1" || errCodeStr == "1" || strings.Contains(strings.ToLower(errStr), "nao retornou resultados") {
			return TestResult{
				Success:    true,
				StatusCode: resp.StatusCode,
				LatencyMs:  latency,
				Message:    fmt.Sprintf("Conexão estabelecida com sucesso com o RBX! (Latência: %d ms)", latency),
			}
		}

		if (rbxResp.Status != nil && fmt.Sprintf("%v", rbxResp.Status) == "0") || (errCodeStr != "" && errCodeStr != "<nil>" && errCodeStr != "0") {
			msg := errStr
			if msg == "" {
				msg = resStr
			}
			return TestResult{
				Success:    false,
				StatusCode: resp.StatusCode,
				LatencyMs:  latency,
				Message:    fmt.Sprintf("RBX recusou a requisição: %s", msg),
			}
		}

		if errStr != "" && !strings.Contains(strings.ToLower(errStr), "sucesso") {
			return TestResult{
				Success:    false,
				StatusCode: resp.StatusCode,
				LatencyMs:  latency,
				Message:    fmt.Sprintf("RBX respondeu com aviso/erro: %s", errStr),
			}
		}

		return TestResult{
			Success:    true,
			StatusCode: resp.StatusCode,
			LatencyMs:  latency,
			Message:    fmt.Sprintf("Conexão estabelecida com sucesso com o RBX! (Latência: %d ms)", latency),
		}
	}

	if resp.StatusCode >= 200 && resp.StatusCode < 300 {
		return TestResult{
			Success:    true,
			StatusCode: resp.StatusCode,
			LatencyMs:  latency,
			Message:    fmt.Sprintf("Servidor RBX respondeu com sucesso (HTTP %d - Latência: %d ms)", resp.StatusCode, latency),
		}
	}

	return TestResult{
		Success:    false,
		StatusCode: resp.StatusCode,
		LatencyMs:  latency,
		Message:    fmt.Sprintf("Servidor RBX retornou código HTTP %d", resp.StatusCode),
	}
}

type ContractStatusResult struct {
	ContractCode       string     `json:"contractCode"`
	ClientCode         string     `json:"clientCode"`
	ClientName         string     `json:"clientName"`
	StatusCode         string     `json:"statusCode"` // 'A', 'B', 'C', 'S', 'D', 'E', 'I', 'T', 'P', 'N'
	StatusText         string     `json:"statusText"` // "Ativo", "Bloqueado", "Cancelado", etc.
	Category           string     `json:"category"`   // 'returned', 'blocked', 'churned', 'suspended', 'other'
	Plan               string     `json:"plan"`
	MonthlyFee         float64    `json:"monthlyFee"`
	DueDay             int        `json:"dueDay"`
	City               string     `json:"city"`
	Neighborhood       string     `json:"neighborhood"` // Bairro / Vila do cliente ou instalação
	LastOperationDate  *time.Time `json:"lastOperationDate"`
	CancellationReason string     `json:"cancellationReason"`
	DaysOverdue        int        `json:"daysOverdue"`
}

// ConsultarContratos busca os contratos informados no RBX via método ConsultaContratos
// Documentação: https://developers.rbxsoft.com/index.html#consulta-contratos
func (c *Client) ConsultarContratos(ctx context.Context, contractCodes []string) ([]ContractStatusResult, error) {
	targetURL := c.EndpointURLForV1()
	token := strings.TrimSpace(c.config.Token)

	if targetURL == "" || token == "" {
		return nil, fmt.Errorf("URL do RBX e Chave de Integração são obrigatórias")
	}

	if len(contractCodes) == 0 {
		return nil, nil
	}

	// Limpa e normaliza os números de contrato (remove pontuações de milhar como '.' ou ',')
	cleanCodes := make([]string, 0, len(contractCodes))
	for _, code := range contractCodes {
		clean := strings.TrimSpace(code)
		clean = strings.ReplaceAll(clean, ".", "")
		clean = strings.ReplaceAll(clean, ",", "")
		if clean != "" {
			cleanCodes = append(cleanCodes, fmt.Sprintf("'%s'", clean))
		}
	}

	if len(cleanCodes) == 0 {
		return nil, nil
	}

	// RBX suporta filtro SQL no parâmetro Filtro. O campo oficial é "Numero"
	var filtro string
	if len(cleanCodes) == 1 {
		filtro = fmt.Sprintf("Numero = %s", cleanCodes[0])
	} else {
		filtro = fmt.Sprintf("Numero IN (%s)", strings.Join(cleanCodes, ", "))
	}

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
		return nil, fmt.Errorf("erro ao montar payload: %v", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, targetURL, bytes.NewBuffer(bodyBytes))
	if err != nil {
		return nil, fmt.Errorf("erro ao criar requisição: %v", err)
	}

	// Para Web Services v1.0 do RBX, a autenticação vai exclusivamente no corpo JSON ("ChaveIntegracao")
	req.Header.Set("Content-Type", "application/json; charset=utf-8")
	req.Header.Set("Accept", "application/json, */*")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("erro ao chamar API do RBX: %v", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("erro ao ler resposta do RBX: %v", err)
	}

	if resp.StatusCode != http.StatusOK {
		respStr := string(respBody)
		if strings.Contains(respStr, "Invalid service") || resp.StatusCode == 412 {
			return nil, fmt.Errorf("O RBX recusou a consulta: 'Invalid service!' (código 98). A chave de integração informada não possui permissão para o serviço 'Consulta Contratos' (v1.0). No painel do seu RBX (Empresa > Parâmetros > Web Services), edite a chave e marque a permissão 'Consulta contratos'")
		}
		return nil, fmt.Errorf("RBX retornou HTTP %d: %s", resp.StatusCode, respStr)
	}

	// Estrutura flexível para decodificar contratos do RBX
	type rawContract map[string]interface{}

	type rbxResponse struct {
		Status           interface{}   `json:"status"`
		ErrorCode        interface{}   `json:"error_code"`
		ErroCode         interface{}   `json:"erro_code"`
		ErrorDescription string        `json:"error_description"`
		ErroDesc         string        `json:"erro_desc"`
		Result           []rawContract `json:"result"`
	}

	var parsed rbxResponse
	if err := json.Unmarshal(respBody, &parsed); err != nil {
		var genericResp struct {
			Status interface{} `json:"status"`
			Result interface{} `json:"result"`
		}
		if err2 := json.Unmarshal(respBody, &genericResp); err2 == nil {
			resStr := fmt.Sprintf("%v", genericResp.Result)
			if strings.Contains(resStr, "Invalid service") {
				return nil, fmt.Errorf("O RBX recusou a consulta: 'Invalid service!' (código 98). A chave de integração informada não possui permissão para o serviço 'Consulta Contratos' (v1.0). No painel do seu RBX (Empresa > Parâmetros > Web Services), edite a chave e marque a permissão 'Consulta contratos'")
			}
		}
		return nil, fmt.Errorf("formato de resposta inesperado do RBX: %v", err)
	}

	toStr := func(rc rawContract, keys ...string) string {
		for _, k := range keys {
			if v, ok := rc[k]; ok && v != nil {
				return strings.TrimSpace(fmt.Sprintf("%v", v))
			}
		}
		return ""
	}

	toFloat := func(rc rawContract, keys ...string) float64 {
		s := toStr(rc, keys...)
		if s == "" {
			return 0
		}
		s = strings.ReplaceAll(s, "R$", "")
		s = strings.ReplaceAll(s, " ", "")
		s = strings.ReplaceAll(s, ",", ".")
		f, _ := strconv.ParseFloat(s, 64)
		return f
	}

	toInt := func(rc rawContract, keys ...string) int {
		s := toStr(rc, keys...)
		if s == "" {
			return 0
		}
		i, _ := strconv.Atoi(s)
		return i
	}

	results := make([]ContractStatusResult, 0, len(parsed.Result))

	for _, rc := range parsed.Result {
		contractNum := toStr(rc, "Numero", "codigo_contrato", "Contrato_Numero")
		if contractNum == "" {
			continue
		}

		clientCode := toStr(rc, "Cliente_Codigo", "codigo_cliente")
		clientName := toStr(rc, "Cliente_Nome", "nome_cliente", "nome")
		planDesc := toStr(rc, "Plano_Descricao", "descricao_pacote", "plano")
		statusRaw := toStr(rc, "Situacao_Codigo", "status", "situacao")
		descRaw := toStr(rc, "Situacao_Descricao", "status_descricao")

		code, text, category := NormalizeRbxStatus(statusRaw, descRaw)

		monthlyFee := toFloat(rc, "ValorLiquido", "ValorBruto", "valor", "Plano_Valor")
		dueDay := toInt(rc, "CicloFaturamento_Vencimento", "dia_vencimento")
		daysOverdue := toInt(rc, "Qtde_Dias_Vencido")
		cancellationReason := toStr(rc, "Cancelamento_Motivo", "motivo_cancelamento")

		// Endereço / Cidade e Bairro/Vila
		city := toStr(rc, "EnderecoInstalacao_Cidade", "EnderecoCobranca_Cidade", "cidade")
		neighborhood := toStr(rc, "EnderecoInstalacao_Bairro", "EnderecoCobranca_Bairro", "bairro", "Bairro")

		// Data da última operação
		lastOpStr := toStr(rc, "DataUltimaOperacao", "data_ultima_operacao")
		var lastOpDate *time.Time
		if lastOpStr != "" {
			formats := []string{
				"2006-01-02 15:04:05",
				"2006-01-02",
				"02/01/2006 15:04:05",
				"02/01/2006",
			}
			for _, f := range formats {
				if t, err := time.Parse(f, lastOpStr); err == nil {
					lastOpDate = &t
					break
				}
			}
		}

		results = append(results, ContractStatusResult{
			ContractCode:       contractNum,
			ClientCode:         clientCode,
			ClientName:         clientName,
			StatusCode:         code,
			StatusText:         text,
			Category:           category,
			Plan:               planDesc,
			MonthlyFee:         monthlyFee,
			DueDay:             dueDay,
			City:               city,
			Neighborhood:       neighborhood,
			LastOperationDate:  lastOpDate,
			CancellationReason: cancellationReason,
			DaysOverdue:        daysOverdue,
		})
	}

	return results, nil
}

type OpenInvoiceResult struct {
	ClientCode   string  `json:"clientCode"`
	ContractCode string  `json:"contractCode"`
	DueDate      string  `json:"dueDate"` // YYYY-MM-DD
	Value        float64 `json:"value"`
	Origin       string  `json:"origin"`
}

// ConsultarDocumentosAbertos busca faturas em aberto no RBX via serviço ConsultaDocumentosAbertos
func (c *Client) ConsultarDocumentosAbertos(ctx context.Context, filtro string) ([]OpenInvoiceResult, error) {
	targetURL := c.EndpointURLForV1()
	token := strings.TrimSpace(c.config.Token)

	if targetURL == "" || token == "" {
		return nil, fmt.Errorf("URL do RBX e Chave de Integração são obrigatórias")
	}

	if filtro == "" {
		filtro = "Origem = 'FAT'"
	}

	payload := map[string]interface{}{
		"ConsultaDocumentosAbertos": map[string]interface{}{
			"Autenticacao": map[string]string{
				"ChaveIntegracao": token,
			},
			"Filtro": filtro,
		},
	}

	bodyBytes, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("erro ao montar payload: %v", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, targetURL, bytes.NewBuffer(bodyBytes))
	if err != nil {
		return nil, fmt.Errorf("erro ao criar requisição: %v", err)
	}

	req.Header.Set("Content-Type", "application/json; charset=utf-8")
	req.Header.Set("Accept", "application/json, */*")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("erro ao chamar API do RBX: %v", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("erro ao ler resposta do RBX: %v", err)
	}

	type rawDoc map[string]interface{}
	type rbxResponse struct {
		Status interface{} `json:"status"`
		Result []rawDoc    `json:"result"`
	}

	var parsed rbxResponse
	if err := json.Unmarshal(respBody, &parsed); err != nil {
		return nil, fmt.Errorf("erro ao decodificar documentos abertos: %v", err)
	}

	toStr := func(rd rawDoc, keys ...string) string {
		for _, k := range keys {
			if v, ok := rd[k]; ok && v != nil {
				return strings.TrimSpace(fmt.Sprintf("%v", v))
			}
		}
		return ""
	}

	toFloat := func(rd rawDoc, keys ...string) float64 {
		s := toStr(rd, keys...)
		if s == "" {
			return 0
		}
		s = strings.ReplaceAll(s, "R$", "")
		s = strings.ReplaceAll(s, " ", "")
		s = strings.ReplaceAll(s, ",", ".")
		f, _ := strconv.ParseFloat(s, 64)
		return f
	}

	results := make([]OpenInvoiceResult, 0, len(parsed.Result))
	for _, rd := range parsed.Result {
		dueDate := toStr(rd, "Vencimento", "vencimento")
		clifor := toStr(rd, "CliFor", "clifor", "Cliente_Codigo")
		contratos := toStr(rd, "ContratosVinculados", "contratos_vinculados")
		origem := toStr(rd, "Origem", "origem")
		val := toFloat(rd, "Valor", "valor")

		cliforClean := strings.ReplaceAll(strings.ReplaceAll(clifor, ".", ""), ",", "")

		if contratos != "" {
			parts := strings.Split(contratos, ",")
			for _, part := range parts {
				cleanC := strings.TrimSpace(strings.ReplaceAll(strings.ReplaceAll(part, ".", ""), ",", ""))
				if cleanC != "" {
					results = append(results, OpenInvoiceResult{
						ClientCode:   cliforClean,
						ContractCode: cleanC,
						DueDate:      dueDate,
						Value:        val,
						Origin:       origem,
					})
				}
			}
		} else {
			results = append(results, OpenInvoiceResult{
				ClientCode: cliforClean,
				DueDate:    dueDate,
				Value:      val,
				Origin:     origem,
			})
		}
	}

	return results, nil
}

type ClientAddressResult struct {
	ClientCode   string `json:"clientCode"`
	Name         string `json:"name"`
	City         string `json:"city"`
	Neighborhood string `json:"neighborhood"` // Bairro / Vila
}

// ConsultarClientes consulta a ficha cadastral dos clientes informados para obter Cidade e Bairro/Vila
func (c *Client) ConsultarClientes(ctx context.Context, clientCodes []string) (map[string]ClientAddressResult, error) {
	targetURL := c.EndpointURLForV1()
	token := strings.TrimSpace(c.config.Token)

	if targetURL == "" || token == "" || len(clientCodes) == 0 {
		return nil, nil
	}

	cleanCodesMap := make(map[string]bool)
	cleanCodes := make([]string, 0, len(clientCodes))
	for _, code := range clientCodes {
		clean := strings.TrimSpace(code)
		clean = strings.ReplaceAll(clean, ".", "")
		clean = strings.ReplaceAll(clean, ",", "")
		if clean != "" && !cleanCodesMap[clean] {
			cleanCodesMap[clean] = true
			cleanCodes = append(cleanCodes, clean)
		}
	}

	if len(cleanCodes) == 0 {
		return nil, nil
	}

	resultMap := make(map[string]ClientAddressResult)

	// Processa em lotes de 100 para evitar limites de tamanho de query no RBX
	batchSize := 100
	for i := 0; i < len(cleanCodes); i += batchSize {
		end := i + batchSize
		if end > len(cleanCodes) {
			end = len(cleanCodes)
		}
		batch := cleanCodes[i:end]

		quoted := make([]string, len(batch))
		for j, b := range batch {
			quoted[j] = fmt.Sprintf("'%s'", b)
		}

		filtro := fmt.Sprintf("Codigo IN (%s)", strings.Join(quoted, ", "))

		payload := map[string]interface{}{
			"ConsultaClientes": map[string]interface{}{
				"Autenticacao": map[string]string{
					"ChaveIntegracao": token,
				},
				"Filtro": filtro,
			},
		}

		bodyBytes, err := json.Marshal(payload)
		if err != nil {
			continue
		}

		req, err := http.NewRequestWithContext(ctx, http.MethodPost, targetURL, bytes.NewBuffer(bodyBytes))
		if err != nil {
			continue
		}
		req.Header.Set("Content-Type", "application/json; charset=utf-8")
		req.Header.Set("Accept", "application/json, */*")

		resp, err := c.httpClient.Do(req)
		if err != nil {
			continue
		}

		respBody, err := io.ReadAll(resp.Body)
		resp.Body.Close()
		if err != nil || resp.StatusCode != http.StatusOK {
			continue
		}

		type rawClient map[string]interface{}
		var parsed struct {
			Result []rawClient `json:"result"`
		}
		if err := json.Unmarshal(respBody, &parsed); err != nil {
			continue
		}

		toStr := func(rc rawClient, keys ...string) string {
			for _, k := range keys {
				if v, ok := rc[k]; ok && v != nil {
					return strings.TrimSpace(fmt.Sprintf("%v", v))
				}
			}
			return ""
		}

		for _, rc := range parsed.Result {
			cliCode := toStr(rc, "Codigo", "codigo", "Cliente_Codigo")
			cliCodeClean := strings.ReplaceAll(strings.ReplaceAll(cliCode, ".", ""), ",", "")
			if cliCodeClean == "" {
				continue
			}

			name := toStr(rc, "Nome", "nome", "Cliente_Nome")
			city := toStr(rc, "Cidade", "cidade", "Cobr_Cidade")
			bairro := toStr(rc, "Bairro", "bairro", "Cobr_Bairro", "Distrito", "distrito")

			resultMap[cliCodeClean] = ClientAddressResult{
				ClientCode:   cliCodeClean,
				Name:         name,
				City:         city,
				Neighborhood: bairro,
			}
		}
	}

	return resultMap, nil
}

type AtendimentoRetiradaResult struct {
	Numero               string     `json:"numero"`
	Protocolo            string     `json:"protocolo"`
	CodigoCliente        string     `json:"codigoCliente"`
	AberturaDataHora     *time.Time `json:"aberturaDataHora"`
	EncerramentoDataHora *time.Time `json:"encerramentoDataHora"`
	SituacaoOS           string     `json:"situacaoOS"`
	Topico               string     `json:"topico"`
	Assunto              string     `json:"assunto"`
	Solucao              string     `json:"solucao"`
	Causa                string     `json:"causa"`
	UsuarioAbertura      string     `json:"usuarioAbertura"`
	Tipo                 string     `json:"tipo"`
}

// ConsultarAtendimentosRetirada busca no RBX atendimentos de Retirada de Equipamento
func (c *Client) ConsultarAtendimentosRetirada(ctx context.Context) ([]AtendimentoRetiradaResult, error) {
	targetURL := c.EndpointURLForV1()
	token := strings.TrimSpace(c.config.Token)
	if targetURL == "" || token == "" {
		return nil, fmt.Errorf("integração RBX não configurada")
	}

	payload := map[string]interface{}{
		"ConsultaAtendimentos": map[string]interface{}{
			"Autenticacao": map[string]string{
				"ChaveIntegracao": token,
			},
			"Filtro": "Atendimentos.Topico IN (5, 135, 156, 158, 160) OR Atendimentos.Fluxo IN (10, 26)",
		},
	}

	bodyBytes, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("erro ao montar payload: %v", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, targetURL, bytes.NewBuffer(bodyBytes))
	if err != nil {
		return nil, fmt.Errorf("erro ao criar requisição: %v", err)
	}
	req.Header.Set("Content-Type", "application/json; charset=utf-8")
	req.Header.Set("Accept", "application/json, */*")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("erro ao chamar API do RBX: %v", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("erro ao ler resposta do RBX: %v", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("RBX retornou HTTP %d: %s", resp.StatusCode, string(respBody))
	}

	type rawAtend map[string]interface{}
	var parsed struct {
		Result []rawAtend `json:"result"`
	}
	if err := json.Unmarshal(respBody, &parsed); err != nil {
		return nil, fmt.Errorf("formato inesperado do RBX: %v", err)
	}

	toStr := func(ra rawAtend, keys ...string) string {
		for _, k := range keys {
			if v, ok := ra[k]; ok && v != nil {
				return strings.TrimSpace(fmt.Sprintf("%v", v))
			}
		}
		return ""
	}

	parseDate := func(s string) *time.Time {
		s = strings.TrimSpace(s)
		if s == "" {
			return nil
		}
		formats := []string{
			"2006-01-02 15:04:05",
			"2006-01-02",
			"02/01/2006 15:04:05",
			"02/01/2006",
		}
		for _, f := range formats {
			if t, err := time.Parse(f, s); err == nil {
				return &t
			}
		}
		return nil
	}

	var results []AtendimentoRetiradaResult
	for _, ra := range parsed.Result {
		num := toStr(ra, "Numero")
		if num == "" {
			continue
		}
		cliCode := toStr(ra, "CodigoCliente", "Cliente")
		cliCodeClean := strings.ReplaceAll(strings.ReplaceAll(cliCode, ".", ""), ",", "")

		results = append(results, AtendimentoRetiradaResult{
			Numero:               num,
			Protocolo:            toStr(ra, "Protocolo"),
			CodigoCliente:        cliCodeClean,
			AberturaDataHora:     parseDate(toStr(ra, "Abertura_DataHora")),
			EncerramentoDataHora: parseDate(toStr(ra, "Encerramento_DataHora")),
			SituacaoOS:           toStr(ra, "Situacao_OS"),
			Topico:               toStr(ra, "Topico"),
			Assunto:              toStr(ra, "Assunto"),
			Solucao:              toStr(ra, "Solucao"),
			Causa:                toStr(ra, "Causa"),
			UsuarioAbertura:      toStr(ra, "Abertura_Usuario"),
			Tipo:                 toStr(ra, "Tipo"),
		})
	}

	return results, nil
}
