package rbx

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"net/http"
	"strconv"
	"strings"
	"time"
)

// SlaStatus estado formal do SLA
type SlaStatus string

const (
	SlaStatusOk            SlaStatus = "OK"
	SlaStatusRisk          SlaStatus = "RISK"
	SlaStatusOverdue       SlaStatus = "OVERDUE"
	SlaStatusNotApplicable SlaStatus = "NOT_APPLICABLE"
)

// OcorrenciaDto registro de ocorrência / timeline de um atendimento no RBX
type OcorrenciaDto struct {
	ID    int    `json:"id"`
	Data  string `json:"data"`
	Autor string `json:"autor"`
	Texto string `json:"texto"`
	Modo  string `json:"modo,omitempty"`
}

// TicketDto representação normalizada e tipada de um Atendimento/OS do RBXSoft
type TicketDto struct {
	ID                  int             `json:"id"`
	Protocol            string          `json:"protocol"`
	ClientID            int             `json:"clientId"`
	ClientName          string          `json:"clientName"`
	TechnicianID        int             `json:"technicianId"`
	TechnicianName      string          `json:"technicianName"`
	TopicID             int             `json:"topicId"`
	TopicName           string          `json:"topicName"`
	CauseID             int             `json:"causeId"`
	CauseName           string          `json:"causeName"`
	FlowID              int             `json:"flowId"`
	FlowName            string          `json:"flowName"`
	SlaGroupID          int             `json:"slaGroupId"`
	SlaGroupName        string          `json:"slaGroupName"`
	SlaHours            int             `json:"slaHours"`
	Status              string          `json:"status"` // 'Aberto', 'Em Andamento', 'Pendente', 'Concluído', 'Cancelado'
	Type                string          `json:"type"`   // 'Técnico', 'Comercial', 'Adm/Fin'
	CreatedAt           string          `json:"createdAt"`
	SlaDueAt            string          `json:"slaDueAt"`
	ConcludedAt         *string         `json:"concludedAt"`
	SlaStatus           SlaStatus       `json:"slaStatus"`
	SlaRemainingMinutes *int            `json:"slaRemainingMinutes"`
	IsOverdue           bool            `json:"isOverdue"`
	IsAtRisk            bool            `json:"isAtRisk"`
	ConcludedWithinSla  *bool           `json:"concludedWithinSla"`
	Description         string            `json:"description"`
	Solution            string            `json:"solution"`
	Ocorrencias         []OcorrenciaDto   `json:"ocorrencias"`
	FinalizedFlows      []OsFinalizedFlow `json:"finalizedFlows"`
	LastFlow            *OsFinalizedFlow  `json:"lastFlow,omitempty"`
	FlowCount           int               `json:"flowCount"`
	HasRemoteSolution   bool              `json:"hasRemoteSolution"`
	HasFieldWork        bool              `json:"hasFieldWork"`
	PrimaryLocality     string            `json:"primaryLocality,omitempty"`
	FlowCategory        string            `json:"flowCategory,omitempty"`
	RawTopicName        string            `json:"rawTopicName,omitempty"`
	RawCauseName        string            `json:"rawCauseName,omitempty"`
	RealTopic           string            `json:"realTopic,omitempty"`
	RealCause           string            `json:"realCause,omitempty"`
}

// SanitizeRbxText normaliza artefatos comuns de acentuação e codificação Latin-1/UTF-8
func SanitizeRbxText(text string) string {
	if text == "" {
		return ""
	}
	replacer := strings.NewReplacer(
		"Ã£", "ã", "Ã¡", "á", "Ã ", "à", "Ã¢", "â",
		"Ã©", "é", "Ãª", "ê", "Ã­", "í", "Ã³", "ó",
		"Ã´", "ô", "Ãµ", "õ", "Ãº", "ú", "Ã§", "ç",
		"Ãƒ", "Ã", "Ã ", "Á", "Ã‰", "É", "Ã“", "Ó",
		"Ãš", "Ú", "Ã‡", "Ç",
	)
	return replacer.Replace(text)
}

func toStr(v interface{}) string {
	if v == nil {
		return ""
	}
	return strings.TrimSpace(fmt.Sprintf("%v", v))
}

func toInt(v interface{}) int {
	if v == nil {
		return 0
	}
	switch val := v.(type) {
	case int:
		return val
	case float64:
		return int(val)
	case string:
		s := strings.TrimSpace(val)
		s = strings.ReplaceAll(s, ".", "")
		s = strings.ReplaceAll(s, ",", "")
		n, _ := strconv.Atoi(s)
		return n
	default:
		s := fmt.Sprintf("%v", v)
		n, _ := strconv.Atoi(s)
		return n
	}
}

func parseDateTime(s string) (time.Time, bool) {
	s = strings.TrimSpace(s)
	if s == "" || strings.HasPrefix(s, "0000") {
		return time.Time{}, false
	}
	formats := []string{
		"2006-01-02 15:04:05",
		"2006-01-02T15:04:05",
		"2006-01-02",
		"02/01/2006 15:04:05",
		"02/01/2006",
		time.RFC3339,
	}
	for _, f := range formats {
		if t, err := time.Parse(f, s); err == nil {
			return t, true
		}
	}
	return time.Time{}, false
}

// ToTicketDto converte um mapa cru do RBXSoft para o DTO oficial normalizado
func ToTicketDto(raw map[string]interface{}) TicketDto {
	now := time.Now()

	createdAtStr := toStr(raw["Abertura_DataHora"])
	if createdAtStr == "" {
		createdAtStr = toStr(raw["data_cadastro"])
	}
	if createdAtStr == "" {
		createdAtStr = now.Format("2006-01-02 15:04:05")
	}

	rawConcluded := toStr(raw["Encerramento_DataHora"])
	if rawConcluded == "" {
		rawConcluded = toStr(raw["data_conclusao"])
	}

	var concludedAt *string
	if rawConcluded != "" && !strings.HasPrefix(rawConcluded, "0000") {
		concludedAt = &rawConcluded
	}

	// Normaliza Status
	status := "Aberto"
	situacaoOS := strings.ToUpper(toStr(raw["Situacao_OS"]))
	situacaoText := toStr(raw["situacao"])

	if situacaoOS == "B" || strings.EqualFold(situacaoText, "Cancelado") {
		status = "Cancelado"
	} else if concludedAt != nil {
		status = "Concluído"
	} else if situacaoOS == "E" || situacaoOS == "A" {
		status = "Em Andamento"
	} else if situacaoOS == "P" {
		status = "Pendente"
	} else if situacaoText != "" {
		status = situacaoText
	}

	// Prazo SLA
	slaDueAt := toStr(raw["data_previsao_sla"])
	if slaDueAt == "" {
		dataAgend := toStr(raw["Data_Agendamento"])
		if dataAgend != "" {
			hora := toStr(raw["Hora_Agendamento"])
			if hora == "" {
				hora = "18:00:00"
			}
			slaDueAt = fmt.Sprintf("%s %s", dataAgend, hora)
		} else {
			if createdDate, ok := parseDateTime(createdAtStr); ok {
				hoursToAdd := 24
				if toStr(raw["Tipo"]) == "T" {
					hoursToAdd = 4
				}
				slaDueAt = createdDate.Add(time.Duration(hoursToAdd) * time.Hour).Format("2006-01-02 15:04:05")
			} else {
				slaDueAt = createdAtStr
			}
		}
	}

	dueDate, hasDueDate := parseDateTime(slaDueAt)
	concludedDate, hasConcludedDate := time.Time{}, false
	if concludedAt != nil {
		concludedDate, hasConcludedDate = parseDateTime(*concludedAt)
	}

	slaStatus := SlaStatusOk
	isOverdue := false
	isAtRisk := false
	var slaRemainingMinutes *int
	var concludedWithinSla *bool

	riskWindowMinutes := 60

	if status == "Cancelado" {
		slaStatus = SlaStatusNotApplicable
	} else if status == "Concluído" {
		if hasConcludedDate && hasDueDate {
			within := !concludedDate.After(dueDate)
			concludedWithinSla = &within
			if within {
				slaStatus = SlaStatusOk
			} else {
				slaStatus = SlaStatusOverdue
				isOverdue = true
			}
		} else {
			within := true
			concludedWithinSla = &within
			slaStatus = SlaStatusOk
		}
	} else {
		if hasDueDate {
			diff := dueDate.Sub(now)
			mins := int(math.Round(diff.Minutes()))
			slaRemainingMinutes = &mins

			if diff < 0 {
				slaStatus = SlaStatusOverdue
				isOverdue = true
			} else if mins <= riskWindowMinutes {
				slaStatus = SlaStatusRisk
				isAtRisk = true
			} else {
				slaStatus = SlaStatusOk
			}
		}
	}

	cliID := toInt(raw["CodigoCliente"])
	if cliID == 0 {
		cliID = toInt(raw["id_cliente"])
	}
	if cliID == 0 {
		cliID = toInt(raw["Cliente_Codigo"])
	}

	cliName := toStr(raw["NomeCliente"])
	if cliName == "" {
		cliName = toStr(raw["nome_cliente"])
	}
	if cliName == "" {
		cliName = toStr(raw["Cliente_Nome"])
	}
	if cliName == "" {
		if cliID > 0 {
			cliName = fmt.Sprintf("Cliente #%d", cliID)
		} else {
			cliName = "Cliente não identificado"
		}
	}

	id := toInt(raw["Numero"])
	if id == 0 {
		id = toInt(raw["id_atendimento"])
	}
	if id == 0 {
		id = toInt(raw["id"])
	}

	protocol := toStr(raw["Protocolo"])
	if protocol == "" {
		protocol = toStr(raw["protocolo"])
	}
	if protocol == "" {
		protocol = fmt.Sprintf("ATD-%d", id)
	}

	techName := toStr(raw["Designacao_Usuario"])
	if techName == "" {
		techName = toStr(raw["nome_tecnico"])
	}
	if techName == "" {
		techName = "Não atribuído"
	}

	topicName := toStr(raw["Topico"])
	if topicName == "" {
		topicName = toStr(raw["nome_topico"])
	}
	if topicName == "" {
		topicName = "Geral"
	}

	causeName := toStr(raw["Causa"])
	if causeName == "" {
		causeName = toStr(raw["nome_causa"])
	}
	if causeName == "" {
		causeName = "Em apuração"
	}

	desc := SanitizeRbxText(toStr(raw["Assunto"]))
	if desc == "" {
		desc = SanitizeRbxText(toStr(raw["descricao"]))
	}
	sol := SanitizeRbxText(toStr(raw["Solucao"]))
	if sol == "" {
		sol = SanitizeRbxText(toStr(raw["solucao"]))
	}

	tipoStr := strings.ToUpper(toStr(raw["Tipo"]))
	ticketType := "Técnico"
	if tipoStr == "C" || strings.Contains(tipoStr, "COMERCIAL") {
		ticketType = "Comercial"
	} else if tipoStr == "A" || strings.Contains(tipoStr, "ADM") || strings.Contains(tipoStr, "FIN") {
		ticketType = "Adm/Fin"
	}

	dto := TicketDto{
		ID:                  id,
		Protocol:            protocol,
		ClientID:            cliID,
		ClientName:          SanitizeRbxText(cliName),
		TechnicianID:        toInt(raw["id_tecnico"]),
		TechnicianName:      SanitizeRbxText(techName),
		TopicID:             toInt(raw["id_topico"]),
		TopicName:           SanitizeRbxText(topicName),
		CauseID:             toInt(raw["id_causa"]),
		CauseName:           SanitizeRbxText(causeName),
		FlowID:              toInt(raw["id_fluxo"]),
		FlowName:            SanitizeRbxText(toStr(raw["nome_fluxo"])),
		SlaGroupID:          toInt(raw["id_grupo_sla"]),
		SlaGroupName:        SanitizeRbxText(toStr(raw["nome_grupo_sla"])),
		SlaHours:            4,
		Status:              status,
		Type:                ticketType,
		CreatedAt:           createdAtStr,
		SlaDueAt:            slaDueAt,
		ConcludedAt:         concludedAt,
		SlaStatus:           slaStatus,
		SlaRemainingMinutes: slaRemainingMinutes,
		IsOverdue:           isOverdue,
		IsAtRisk:            isAtRisk,
		ConcludedWithinSla:  concludedWithinSla,
		Description:         desc,
		Solution:            sol,
		Ocorrencias:         []OcorrenciaDto{},
		FinalizedFlows:      []OsFinalizedFlow{},
	}

	EnrichTicketWithFlows(&dto)
	return dto
}

// ConsultarAtendimentosComFiltro consulta chamados com proteção de resiliência e sanitização
func (c *Client) ConsultarAtendimentosComFiltro(ctx context.Context, filtro string) ([]TicketDto, error) {
	cacheKey := fmt.Sprintf("rbx_tickets:%s", filtro)
	ttl := 5 * time.Second

	val, err := DefaultEngine.ExecuteRequest(cacheKey, ttl, func() (interface{}, error) {
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
				"Filtro": filtro,
			},
		}

		bodyBytes, err := json.Marshal(payload)
		if err != nil {
			return nil, fmt.Errorf("erro ao montar payload: %v", err)
		}

		req, err := http.NewRequestWithContext(ctx, "POST", targetURL, strings.NewReader(string(bodyBytes)))
		if err != nil {
			return nil, err
		}
		req.Header.Set("Content-Type", "application/json; charset=utf-8")

		resp, err := c.httpClient.Do(req)
		if err != nil {
			return nil, err
		}
		defer resp.Body.Close()

		if resp.StatusCode != 200 {
			return nil, fmt.Errorf("RBX retornou HTTP %d", resp.StatusCode)
		}

		var parsed struct {
			Result []map[string]interface{} `json:"result"`
		}
		if err := json.NewDecoder(resp.Body).Decode(&parsed); err != nil {
			return nil, err
		}

		var dtoList []TicketDto
		for _, raw := range parsed.Result {
			dtoList = append(dtoList, ToTicketDto(raw))
		}
		return dtoList, nil
	})

	if err != nil {
		return nil, err
	}
	return val.([]TicketDto), nil
}

// ConsultarOcorrenciasAtendimento busca ocorrências de um chamado
func (c *Client) ConsultarOcorrenciasAtendimento(ctx context.Context, ticketID int) ([]OcorrenciaDto, error) {
	cacheKey := fmt.Sprintf("rbx_occs:%d", ticketID)
	ttl := 30 * time.Second

	val, err := DefaultEngine.ExecuteRequest(cacheKey, ttl, func() (interface{}, error) {
		targetURL := c.EndpointURLForV1()
		token := strings.TrimSpace(c.config.Token)
		if targetURL == "" || token == "" {
			return nil, fmt.Errorf("integração RBX não configurada")
		}

		payload := map[string]interface{}{
			"ConsultaOcorrenciasAtendimentos": map[string]interface{}{
				"Autenticacao": map[string]string{
					"ChaveIntegracao": token,
				},
				"Filtro": fmt.Sprintf("Atendimento = '%d'", ticketID),
			},
		}

		bodyBytes, _ := json.Marshal(payload)
		req, err := http.NewRequestWithContext(ctx, "POST", targetURL, strings.NewReader(string(bodyBytes)))
		if err != nil {
			return nil, err
		}
		req.Header.Set("Content-Type", "application/json; charset=utf-8")

		resp, err := c.httpClient.Do(req)
		if err != nil {
			return nil, err
		}
		defer resp.Body.Close()

		var parsed struct {
			Result []map[string]interface{} `json:"result"`
		}
		_ = json.NewDecoder(resp.Body).Decode(&parsed)

		var occs []OcorrenciaDto
		for idx, raw := range parsed.Result {
			id := toInt(raw["Id"])
			if id == 0 {
				id = toInt(raw["id"])
			}
			if id == 0 {
				id = idx + 1
			}
			txt := SanitizeRbxText(toStr(raw["Descricao"]))
			if txt == "" {
				txt = SanitizeRbxText(toStr(raw["texto"]))
			}
			if txt == "" {
				continue
			}

			occs = append(occs, OcorrenciaDto{
				ID:    id,
				Data:  toStr(raw["Data"]),
				Autor: SanitizeRbxText(toStr(raw["Usuario"])),
				Texto: txt,
				Modo:  toStr(raw["Modo"]),
			})
		}
		return occs, nil
	})

	if err != nil {
		return nil, err
	}
	return val.([]OcorrenciaDto), nil
}

// ConsultarOcorrenciasPeriodo busca ocorrências de atendimentos com filtro flexível
func (c *Client) ConsultarOcorrenciasPeriodo(ctx context.Context, filtro string) (map[int][]OcorrenciaDto, error) {
	cacheKey := fmt.Sprintf("rbx_occs_filter:%s", filtro)
	ttl := 15 * time.Second

	val, err := DefaultEngine.ExecuteRequest(cacheKey, ttl, func() (interface{}, error) {
		targetURL := c.EndpointURLForV1()
		token := strings.TrimSpace(c.config.Token)
		if targetURL == "" || token == "" {
			return nil, fmt.Errorf("integração RBX não configurada")
		}

		payload := map[string]interface{}{
			"ConsultaOcorrenciasAtendimentos": map[string]interface{}{
				"Autenticacao": map[string]string{
					"ChaveIntegracao": token,
				},
				"Filtro": filtro,
			},
		}

		bodyBytes, _ := json.Marshal(payload)
		req, err := http.NewRequestWithContext(ctx, "POST", targetURL, strings.NewReader(string(bodyBytes)))
		if err != nil {
			return nil, err
		}
		req.Header.Set("Content-Type", "application/json; charset=utf-8")

		resp, err := c.httpClient.Do(req)
		if err != nil {
			return nil, err
		}
		defer resp.Body.Close()

		var parsed struct {
			Result []map[string]interface{} `json:"result"`
		}
		_ = json.NewDecoder(resp.Body).Decode(&parsed)

		occsByTicket := make(map[int][]OcorrenciaDto)
		for idx, raw := range parsed.Result {
			ticketNum := toInt(raw["Atendimento_Numero"])
			if ticketNum == 0 {
				ticketNum = toInt(raw["Atendimento"])
			}
			if ticketNum == 0 {
				continue
			}

			id := toInt(raw["Id"])
			if id == 0 {
				id = toInt(raw["id"])
			}
			if id == 0 {
				id = idx + 1
			}
			txt := SanitizeRbxText(toStr(raw["Descricao"]))
			if txt == "" {
				txt = SanitizeRbxText(toStr(raw["texto"]))
			}
			if txt == "" {
				continue
			}

			occsByTicket[ticketNum] = append(occsByTicket[ticketNum], OcorrenciaDto{
				ID:    id,
				Data:  toStr(raw["Data"]),
				Autor: SanitizeRbxText(toStr(raw["Usuario"])),
				Texto: txt,
				Modo:  toStr(raw["Modo"]),
			})
		}
		return occsByTicket, nil
	})

	if err != nil {
		return nil, err
	}
	return val.(map[int][]OcorrenciaDto), nil
}

// ConsultarTopicos consulta lista de tópicos configurados no RBX
func (c *Client) ConsultarTopicos(ctx context.Context) ([]map[string]interface{}, error) {
	return c.execSimpleList(ctx, "ConsultaTopicos", 10*time.Minute)
}

// ConsultarCausas consulta lista de causas configuradas no RBX
func (c *Client) ConsultarCausas(ctx context.Context) ([]map[string]interface{}, error) {
	return c.execSimpleList(ctx, "ConsultaCausas", 10*time.Minute)
}

// ConsultarFluxos consulta lista de fluxos configurados no RBX
func (c *Client) ConsultarFluxos(ctx context.Context) ([]map[string]interface{}, error) {
	return c.execSimpleList(ctx, "ConsultaFluxos", 10*time.Minute)
}

// ConsultarGruposSLA consulta lista de grupos de SLA configurados no RBX
func (c *Client) ConsultarGruposSLA(ctx context.Context) ([]map[string]interface{}, error) {
	return c.execSimpleList(ctx, "ConsultaGruposSLA", 10*time.Minute)
}

// CadastrarAtendimento registra um novo atendimento na API oficial do RBX
func (c *Client) CadastrarAtendimento(ctx context.Context, payload map[string]interface{}) (map[string]interface{}, error) {
	targetURL := c.EndpointURLForV1()
	token := strings.TrimSpace(c.config.Token)
	if targetURL == "" || token == "" {
		return nil, fmt.Errorf("integração RBX não configurada")
	}

	wrapped := map[string]interface{}{
		"AtendimentoCadastro": map[string]interface{}{
			"Autenticacao": map[string]string{
				"ChaveIntegracao": token,
			},
		},
	}
	inner := wrapped["AtendimentoCadastro"].(map[string]interface{})
	for k, v := range payload {
		inner[k] = v
	}

	bodyBytes, err := json.Marshal(wrapped)
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequestWithContext(ctx, "POST", targetURL, strings.NewReader(string(bodyBytes)))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json; charset=utf-8")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var result struct {
		Status     int                    `json:"status"`
		ErrorCode  int                    `json:"erro_code"`
		ErrorDesc  string                 `json:"erro_desc"`
		Result     map[string]interface{} `json:"result"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	if result.Status != 0 && result.ErrorCode != 0 {
		return nil, fmt.Errorf("RBX erro %d: %s", result.ErrorCode, result.ErrorDesc)
	}

	return result.Result, nil
}

func (c *Client) execSimpleList(ctx context.Context, service string, ttl time.Duration) ([]map[string]interface{}, error) {
	cacheKey := fmt.Sprintf("rbx_meta:%s", service)
	val, err := DefaultEngine.ExecuteRequest(cacheKey, ttl, func() (interface{}, error) {
		targetURL := c.EndpointURLForV1()
		token := strings.TrimSpace(c.config.Token)
		if targetURL == "" || token == "" {
			return nil, fmt.Errorf("integração RBX não configurada")
		}

		payload := map[string]interface{}{
			service: map[string]interface{}{
				"Autenticacao": map[string]string{
					"ChaveIntegracao": token,
				},
			},
		}

		bodyBytes, _ := json.Marshal(payload)
		req, err := http.NewRequestWithContext(ctx, "POST", targetURL, strings.NewReader(string(bodyBytes)))
		if err != nil {
			return nil, err
		}
		req.Header.Set("Content-Type", "application/json; charset=utf-8")

		resp, err := c.httpClient.Do(req)
		if err != nil {
			return nil, err
		}
		defer resp.Body.Close()

		var parsed struct {
			Result []map[string]interface{} `json:"result"`
		}
		_ = json.NewDecoder(resp.Body).Decode(&parsed)
		return parsed.Result, nil
	})

	if err != nil {
		return nil, err
	}
	if res, ok := val.([]map[string]interface{}); ok {
		return res, nil
	}
	return nil, nil
}
