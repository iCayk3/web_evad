package rbx

import (
	"fmt"
	"regexp"
	"strconv"
	"strings"
)

// FilterSecurityError indica que um parâmetro de filtro violou as regras de segurança estritas contra SQL Injection.
type FilterSecurityError struct {
	Message string
}

func (e *FilterSecurityError) Error() string {
	return fmt.Sprintf("[Security Alert - Filtro RBXSoft] %s", e.Message)
}

// TicketFilters representa os filtros tipados e validados para Atendimentos do RBX
type TicketFilters struct {
	Period *struct {
		Start string `json:"start"` // YYYY-MM-DD ou YYYY-MM-DD HH:mm:ss
		End   string `json:"end"`
		Field string `json:"field,omitempty"` // 'data_cadastro' ou 'data_conclusao'
	} `json:"period,omitempty"`
	Statuses      []string `json:"statuses,omitempty"`
	TechnicianIDs []int    `json:"technicianIds,omitempty"`
	TopicIDs      []int    `json:"topicIds,omitempty"`
	CauseIDs      []int    `json:"causeIds,omitempty"`
	FlowIDs       []int    `json:"flowIds,omitempty"`
	SlaGroupIDs   []int    `json:"slaGroupIds,omitempty"`
	ClientID      *int     `json:"clientId,omitempty"`
}

// ClientFilters representa os filtros tipados e validados para Clientes do RBX
type ClientFilters struct {
	Status   string   `json:"status,omitempty"`
	Statuses []string `json:"statuses,omitempty"`
	ClientID *int     `json:"clientId,omitempty"`
	Search   string   `json:"search,omitempty"`
}

var (
	// Padrões perigosos estritamente bloqueados em qualquer entrada de texto
	dangerousPatterns = []*regexp.Regexp{
		regexp.MustCompile(`;`),
		regexp.MustCompile(`--`),
		regexp.MustCompile(`/\*`),
		regexp.MustCompile(`\*/`),
		regexp.MustCompile(`(?i)\bunion\b`),
		regexp.MustCompile(`(?i)\bdrop\b`),
		regexp.MustCompile(`(?i)\bdelete\b`),
		regexp.MustCompile(`(?i)\bupdate\b`),
		regexp.MustCompile(`(?i)\binsert\b`),
		regexp.MustCompile(`(?i)\bselect\b`),
		regexp.MustCompile(`(?i)\bexec\b`),
		regexp.MustCompile(`(?i)\bexecute\b`),
		regexp.MustCompile(`(?i)\bor\s+1\s*=\s*1\b`),
		regexp.MustCompile(`(?i)\bor\s+true\b`),
		regexp.MustCompile(`(?i)'\s*or\s*'`),
	}

	// Allowlist de situações permitidas para atendimentos e contratos
	allowedStatuses = map[string]bool{
		"Aberto":       true,
		"Em Andamento": true,
		"Pendente":     true,
		"Concluído":    true,
		"Cancelado":    true,
		"Agendado":     true,
		"Ativo":        true,
		"Bloqueado":    true,
		"Inativo":      true,
		"Suspenso":     true,
	}

	dateRegex = regexp.MustCompile(`^(\d{4}-\d{2}-\d{2})(?:[ T](\d{2}:\d{2}:\d{2}))?$`)
	searchRegex = regexp.MustCompile(`^[a-zA-Z0-9À-ÿ\s.\-_]+$`)
)

// FilterBuilder constrói cláusulas SQL WHERE seguras e parametrizadas para a API do RBXSoft
type FilterBuilder struct{}

// SanitizeString valida a string contra padrões perigosos e escapa aspas simples duplicando-as
func (b *FilterBuilder) SanitizeString(input string, maxLen int) (string, error) {
	if len(input) > maxLen {
		return "", &FilterSecurityError{
			Message: fmt.Sprintf("String excede o tamanho máximo permitido de %d caracteres", maxLen),
		}
	}

	for _, p := range dangerousPatterns {
		if p.MatchString(input) {
			return "", &FilterSecurityError{
				Message: fmt.Sprintf("Padrão malicioso detectado na entrada: %s", p.String()),
			}
		}
	}

	// Escapa aspas simples com padrão SQL seguro
	return strings.ReplaceAll(input, "'", "''"), nil
}

// SanitizeInt valida inteiros estritamente não negativos
func (b *FilterBuilder) SanitizeInt(input int) (int, error) {
	if input < 0 {
		return 0, &FilterSecurityError{
			Message: fmt.Sprintf("Valor numérico inválido ou negativo: %d", input),
		}
	}
	return input, nil
}

// SanitizeDate valida e padroniza formato de data YYYY-MM-DD HH:mm:ss
func (b *FilterBuilder) SanitizeDate(input string) (string, error) {
	trimmed := strings.TrimSpace(input)
	matches := dateRegex.FindStringSubmatch(trimmed)
	if len(matches) < 2 {
		return "", &FilterSecurityError{
			Message: fmt.Sprintf("Formato de data inválido: %s. Esperado YYYY-MM-DD ou YYYY-MM-DD HH:mm:ss", input),
		}
	}

	ymd := matches[1]
	hms := "00:00:00"
	if len(matches) > 2 && matches[2] != "" {
		hms = matches[2]
	}

	return fmt.Sprintf("%s %s", ymd, hms), nil
}

// BuildTicketFilter constrói cláusula WHERE segura para ConsultaAtendimentos
func (b *FilterBuilder) BuildTicketFilter(f TicketFilters) (string, error) {
	var clauses []string

	// 1. Período
	if f.Period != nil {
		field := "data_cadastro"
		if f.Period.Field == "data_conclusao" {
			field = "data_conclusao"
		}

		start, err := b.SanitizeDate(f.Period.Start)
		if err != nil {
			return "", err
		}
		end, err := b.SanitizeDate(f.Period.End)
		if err != nil {
			return "", err
		}

		clauses = append(clauses, fmt.Sprintf("%s >= '%s' AND %s <= '%s'", field, start, field, end))
	}

	// 2. Situação / Statuses
	if len(f.Statuses) > 0 {
		var valid []string
		for _, s := range f.Statuses {
			clean := strings.TrimSpace(s)
			if !allowedStatuses[clean] {
				return "", &FilterSecurityError{
					Message: fmt.Sprintf("Status não permitido: %s", clean),
				}
			}
			valid = append(valid, fmt.Sprintf("'%s'", clean))
		}
		clauses = append(clauses, fmt.Sprintf("situacao IN (%s)", strings.Join(valid, ", ")))
	}

	// 3. IDs de Técnicos
	if len(f.TechnicianIDs) > 0 {
		var ids []string
		for _, id := range f.TechnicianIDs {
			validID, err := b.SanitizeInt(id)
			if err != nil {
				return "", err
			}
			ids = append(ids, strconv.Itoa(validID))
		}
		clauses = append(clauses, fmt.Sprintf("id_tecnico IN (%s)", strings.Join(ids, ", ")))
	}

	// 4. IDs de Tópicos
	if len(f.TopicIDs) > 0 {
		var ids []string
		for _, id := range f.TopicIDs {
			validID, err := b.SanitizeInt(id)
			if err != nil {
				return "", err
			}
			ids = append(ids, strconv.Itoa(validID))
		}
		clauses = append(clauses, fmt.Sprintf("id_topico IN (%s)", strings.Join(ids, ", ")))
	}

	// 5. IDs de Causas
	if len(f.CauseIDs) > 0 {
		var ids []string
		for _, id := range f.CauseIDs {
			validID, err := b.SanitizeInt(id)
			if err != nil {
				return "", err
			}
			ids = append(ids, strconv.Itoa(validID))
		}
		clauses = append(clauses, fmt.Sprintf("id_causa IN (%s)", strings.Join(ids, ", ")))
	}

	// 6. IDs de Fluxos
	if len(f.FlowIDs) > 0 {
		var ids []string
		for _, id := range f.FlowIDs {
			validID, err := b.SanitizeInt(id)
			if err != nil {
				return "", err
			}
			ids = append(ids, strconv.Itoa(validID))
		}
		clauses = append(clauses, fmt.Sprintf("id_fluxo IN (%s)", strings.Join(ids, ", ")))
	}

	// 7. IDs de Grupos SLA
	if len(f.SlaGroupIDs) > 0 {
		var ids []string
		for _, id := range f.SlaGroupIDs {
			validID, err := b.SanitizeInt(id)
			if err != nil {
				return "", err
			}
			ids = append(ids, strconv.Itoa(validID))
		}
		clauses = append(clauses, fmt.Sprintf("id_grupo_sla IN (%s)", strings.Join(ids, ", ")))
	}

	// 8. ID de Cliente
	if f.ClientID != nil {
		cid, err := b.SanitizeInt(*f.ClientID)
		if err != nil {
			return "", err
		}
		clauses = append(clauses, fmt.Sprintf("id_cliente = %d", cid))
	}

	return strings.Join(clauses, " AND "), nil
}

// BuildClientFilter constrói cláusula WHERE segura para ConsultaClientes
func (b *FilterBuilder) BuildClientFilter(f ClientFilters) (string, error) {
	var clauses []string

	if f.ClientID != nil {
		cid, err := b.SanitizeInt(*f.ClientID)
		if err != nil {
			return "", err
		}
		clauses = append(clauses, fmt.Sprintf("id_cliente = %d", cid))
	}

	if f.Status != "" {
		clean := strings.TrimSpace(f.Status)
		if !allowedStatuses[clean] {
			return "", &FilterSecurityError{
				Message: fmt.Sprintf("Situação de cliente não permitida: %s", clean),
			}
		}
		clauses = append(clauses, fmt.Sprintf("situacao = '%s'", clean))
	}

	if len(f.Statuses) > 0 {
		var valid []string
		for _, s := range f.Statuses {
			clean := strings.TrimSpace(s)
			if !allowedStatuses[clean] {
				return "", &FilterSecurityError{
					Message: fmt.Sprintf("Situação de cliente não permitida: %s", clean),
				}
			}
			valid = append(valid, fmt.Sprintf("'%s'", clean))
		}
		clauses = append(clauses, fmt.Sprintf("situacao IN (%s)", strings.Join(valid, ", ")))
	}

	if f.Search != "" {
		cleanSearch, err := b.SanitizeString(strings.TrimSpace(f.Search), 40)
		if err != nil {
			return "", err
		}
		if !searchRegex.MatchString(cleanSearch) {
			return "", &FilterSecurityError{
				Message: "Termo de busca contém caracteres especiais não permitidos",
			}
		}
		clauses = append(clauses, fmt.Sprintf("(nome LIKE '%%%s%%' OR cpf_cnpj LIKE '%%%s%%')", cleanSearch, cleanSearch))
	}

	return strings.Join(clauses, " AND "), nil
}

// DefaultFilterBuilder instância global reutilizável
var DefaultFilterBuilder = &FilterBuilder{}
