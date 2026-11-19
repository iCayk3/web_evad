package rbx

import (
	"fmt"
	"math"
	"regexp"
	"strings"
)

// OsFinalizedFlow representa um ciclo/fluxo operacional finalizado dentro do atendimento
type OsFinalizedFlow struct {
	Index             int    `json:"index"`
	TopicRaw          string `json:"topicRaw"`
	TopicPrefix       string `json:"topicPrefix"`
	TopicName         string `json:"topicName"`
	CauseRaw          string `json:"causeRaw"`
	CausePrefix       string `json:"causePrefix"`
	CauseName         string `json:"causeName"`
	DurationRaw       string `json:"durationRaw,omitempty"`
	OpenedAt          string `json:"openedAt"`
	ClosedAt          string `json:"closedAt"`
	DurationMinutes   int    `json:"durationMinutes"`
	DurationFormatted string `json:"durationFormatted"`
	User              string `json:"user"`
	Sector            string `json:"sector"`
	ActionNote        string `json:"actionNote,omitempty"`
	FlowType          string `json:"flowType"` // 'Solução Remota', 'Presencial / Campo', 'Triagem / Roteamento', 'Comercial / Apoio', 'Supervisão / Feedback', 'Outro'
	Locality          string `json:"locality,omitempty"`
}

var (
	// Identifica o início de cada cabeçalho de fluxo finalizado
	reFlowHeader = regexp.MustCompile(`(?i)/#\s*###\s*Fluxo finalizado:[^#\r\n]*#?\s*###?/`)

	reTopic       = regexp.MustCompile(`(?i)/#\s*Tópico\s*:\s*(.*?)\s*#/`)
	reCause       = regexp.MustCompile(`(?i)/#\s*Causa\s*:\s*(.*?)\s*#/`)
	reDuration    = regexp.MustCompile(`(?i)/#\s*Duração\s*:\s*(.*?)\s*#/`)
	reOpenedAt    = regexp.MustCompile(`(?i)/#\s*Data/Hora Abertura\s*:\s*([0-9/:\s]+)\s*#/`)
	reClosedAt    = regexp.MustCompile(`(?i)/#\s*Data/Hora Encerramento\s*:\s*([0-9/:\s]+)\s*#/`)
	reUser        = regexp.MustCompile(`(?i)/#\s*Usuário\s*:\s*(.*?)\s*#/`)
	reSector      = regexp.MustCompile(`(?i)/#\s*Setor/Grupo\s*:\s*(.*?)\s*#/`)
	reParenthesis = regexp.MustCompile(`^\s*\((.*?)\)\s*(.*)$`)
)

// ParseParenthesis extrai o prefixo entre parênteses e o nome restante
func ParseParenthesis(val string) (prefix, name string) {
	val = strings.TrimSpace(val)
	if match := reParenthesis.FindStringSubmatch(val); len(match) == 3 {
		prefix = strings.TrimSpace(match[1])
		name = strings.TrimSpace(match[2])
		if name == "" {
			name = prefix
		}
		return prefix, name
	}
	return "", val
}

// ExtractLocality tenta identificar localidades comuns a partir do tópico e causa
func ExtractLocality(topic, cause string) string {
	combined := strings.ToUpper(fmt.Sprintf("%s %s", topic, cause))

	if strings.Contains(combined, "PIRABAS") || strings.Contains(combined, "SJP") || strings.Contains(combined, "SÃO JOSÉ") {
		return "São José dos Pinhais (SJP)"
	}
	if strings.Contains(combined, "QUATIPURU") || strings.Contains(combined, "QT") {
		return "Quatipuru (QT)"
	}
	if strings.Contains(combined, "BOA VISTA") || strings.Contains(combined, "BV") {
		return "Boa Vista (BV)"
	}
	if strings.Contains(combined, "MAGALHÃES BARATA") || strings.Contains(combined, "MGB") {
		return "Magalhães Barata (MGB)"
	}
	if strings.Contains(combined, "PRIMAVERA") || strings.Contains(combined, "PMV") {
		return "Primavera (PMV)"
	}
	if strings.Contains(combined, "MARACANÃ") || strings.Contains(combined, "MARACANA") {
		return "Maracanã"
	}
	if strings.Contains(combined, "MARAPANIM") {
		return "Marapanim"
	}
	if strings.Contains(combined, "SANTA MARIA") {
		return "Santa Maria"
	}
	if strings.Contains(combined, "SALINÓPOLIS") || strings.Contains(combined, "SALINAS") {
		return "Salinópolis"
	}
	return ""
}

// ClassifyFlowType infere se a etapa foi remota, presencial/campo, comercial, feedback, etc.
func ClassifyFlowType(topic, cause, sector, user string) string {
	combined := strings.ToUpper(fmt.Sprintf("%s %s %s %s", topic, cause, sector, user))

	if strings.Contains(combined, "FEEDBACK") || strings.Contains(combined, "SUPERVISÃO") || strings.Contains(combined, "SUPERVISAO") {
		return "Supervisão / Feedback"
	}
	if strings.Contains(combined, "SOLUÇÃO REMOTA") || strings.Contains(combined, "SOLUCAO REMOTA") ||
		strings.Contains(combined, "REMOTAMENTE") || strings.Contains(combined, "CONFIGURAÇÃO REMOTA") ||
		strings.Contains(combined, "TROCA DE SENHA") {
		return "Solução Remota"
	}
	if strings.Contains(combined, "LOCALIDADE") && (strings.Contains(combined, "SERVIÇOS") || strings.Contains(combined, "SERVICOS")) {
		return "Triagem / Roteamento"
	}
	if strings.Contains(combined, "TÉCNICO") || strings.Contains(combined, "TECNICO") ||
		strings.Contains(combined, "REPARO") || strings.Contains(combined, "FUSÃO") ||
		strings.Contains(combined, "FUSAO") || strings.Contains(combined, "DROP") ||
		strings.Contains(combined, "CONECTOR") || strings.Contains(combined, "CTO") ||
		strings.Contains(combined, "ROMPIMENTO") || strings.Contains(combined, "EQUIPAMENTO UTILIZADO") ||
		strings.Contains(combined, "GOL.") || strings.Contains(combined, "GOL0") {
		return "Presencial / Campo"
	}
	if strings.Contains(combined, "COMERCIAL") || strings.Contains(combined, "ESTOQUE") ||
		strings.Contains(combined, "MATERIAL") || strings.Contains(combined, "VENDAS") ||
		strings.Contains(combined, "REVERSÃO") {
		return "Comercial / Apoio"
	}
	return "Outro"
}

// FormatFlowDuration formata a duração entre abertura e encerramento
func FormatFlowDuration(openStr, closeStr string) (int, string) {
	oDate, okO := parseDateTime(openStr)
	cDate, okC := parseDateTime(closeStr)
	if !okO || !okC || cDate.Before(oDate) {
		return 0, "-"
	}

	diff := cDate.Sub(oDate)
	totalMins := int(math.Round(diff.Minutes()))
	if totalMins < 1 {
		secs := int(diff.Seconds())
		if secs < 0 {
			secs = 0
		}
		return 1, fmt.Sprintf("%ds", secs)
	}

	hours := totalMins / 60
	mins := totalMins % 60

	if hours == 0 {
		return totalMins, fmt.Sprintf("%dm", mins)
	}
	if hours < 24 {
		if mins == 0 {
			return totalMins, fmt.Sprintf("%dh", hours)
		}
		return totalMins, fmt.Sprintf("%dh %dm", hours, mins)
	}

	days := hours / 24
	remHours := hours % 24
	if remHours == 0 {
		return totalMins, fmt.Sprintf("%dd", days)
	}
	return totalMins, fmt.Sprintf("%dd %dh", days, remHours)
}

// ParseFinalizedFlows varre texto em busca de todos os blocos estruturados de fluxo finalizado
func ParseFinalizedFlows(text string) []OsFinalizedFlow {
	text = SanitizeRbxText(text)
	if !strings.Contains(text, "Fluxo finalizado") {
		return nil
	}

	indices := reFlowHeader.FindAllStringIndex(text, -1)
	if len(indices) == 0 {
		return nil
	}

	var flows []OsFinalizedFlow
	for i, loc := range indices {
		start := loc[0]
		var end int
		if i+1 < len(indices) {
			end = indices[i+1][0]
		} else {
			end = len(text)
			// Trunca em blocos seguintes se houver
			for _, stopTag := range []string{"/# ### AUTENTICAÇÕES", "/# ### CONTRATOS", "/# ### EQUIPAMENTOS", "/# PROTOCOLO:"} {
				if tagIdx := strings.Index(text[start:], stopTag); tagIdx != -1 {
					candidateEnd := start + tagIdx
					if candidateEnd < end {
						end = candidateEnd
					}
				}
			}
		}

		block := text[start:end]

		var topicRaw, causeRaw, durationRaw, openedAt, closedAt, user, sector string

		if m := reTopic.FindStringSubmatch(block); len(m) > 1 {
			topicRaw = strings.TrimSpace(m[1])
		}
		if m := reCause.FindStringSubmatch(block); len(m) > 1 {
			causeRaw = strings.TrimSpace(m[1])
		}
		if m := reDuration.FindStringSubmatch(block); len(m) > 1 {
			durationRaw = strings.TrimSpace(m[1])
		}
		if m := reOpenedAt.FindStringSubmatch(block); len(m) > 1 {
			openedAt = strings.TrimSpace(m[1])
		}
		if m := reClosedAt.FindStringSubmatch(block); len(m) > 1 {
			closedAt = strings.TrimSpace(m[1])
		}
		if m := reUser.FindStringSubmatch(block); len(m) > 1 {
			user = strings.TrimSpace(m[1])
		}
		if m := reSector.FindStringSubmatch(block); len(m) > 1 {
			sector = strings.TrimSpace(m[1])
		}

		// Se não encontrou dados vitais, pula
		if topicRaw == "" && causeRaw == "" && user == "" {
			continue
		}

		topicPrefix, topicName := ParseParenthesis(topicRaw)
		causePrefix, causeName := ParseParenthesis(causeRaw)
		locality := ExtractLocality(topicRaw, causeRaw)
		flowType := ClassifyFlowType(topicRaw, causeRaw, sector, user)
		durationMins, durationFormatted := FormatFlowDuration(openedAt, closedAt)
		if durationRaw != "" && durationFormatted == "-" {
			durationFormatted = durationRaw
		}

		// Extrai notas após Setor/Grupo
		actionNote := ""
		if sectorIdx := strings.Index(block, "Setor/Grupo:"); sectorIdx != -1 {
			afterSector := block[sectorIdx:]
			if closeTagIdx := strings.Index(afterSector, "#/"); closeTagIdx != -1 {
				note := strings.TrimSpace(afterSector[closeTagIdx+2:])
				noteLines := []string{}
				for _, line := range strings.Split(note, "\n") {
					line = strings.TrimSpace(line)
					if line != "" && !strings.HasPrefix(line, "/#") {
						noteLines = append(noteLines, line)
					}
				}
				if len(noteLines) > 0 {
					actionNote = strings.Join(noteLines, "\n")
				}
			}
		}

		flows = append(flows, OsFinalizedFlow{
			Index:             i + 1,
			TopicRaw:          topicRaw,
			TopicPrefix:       topicPrefix,
			TopicName:         topicName,
			CauseRaw:          causeRaw,
			CausePrefix:       causePrefix,
			CauseName:         causeName,
			DurationRaw:       durationRaw,
			OpenedAt:          openedAt,
			ClosedAt:          closedAt,
			DurationMinutes:   durationMins,
			DurationFormatted: durationFormatted,
			User:              user,
			Sector:            sector,
			ActionNote:        actionNote,
			FlowType:          flowType,
			Locality:          locality,
		})
	}

	return flows
}

// IsAdministrativeTopic verifica se o tópico é apenas wrapper administrativo, etapa de triagem ou conferência interna
func IsAdministrativeTopic(s string) bool {
	s = strings.ToUpper(strings.TrimSpace(s))
	if s == "" {
		return true
	}
	adminWords := []string{
		"SUPERVIS", "FEEDBACK", "CONFERIR MATERIAL", "SEPARAR MATERIAL",
		"LOCALIDADE", "SELECIONAR LOCALIDADE", "GERAL",
	}
	for _, w := range adminWords {
		if strings.Contains(s, w) {
			return true
		}
	}
	if s == "SERVIÇOS" || s == "SERVICOS" {
		return true
	}
	return false
}

// IsAdministrativeCause verifica se a causa é apenas wrapper de supervisão, feedback ou roteamento por localidade
func IsAdministrativeCause(s string) bool {
	s = strings.ToUpper(strings.TrimSpace(s))
	if s == "" {
		return true
	}
	adminWords := []string{
		"SUPERVIS", "FEEDBACK", "EQUIPAMENTO UTILIZADO", "EQUIPAMENTO SEPARADO",
		"EQUIPAMENTO CONFERIDO", "ATENDIMENTO SEM TAXA",
	}
	for _, w := range adminWords {
		if strings.Contains(s, w) {
			return true
		}
	}
	// Tags de localidade/roteamento usadas como causas intermediárias
	localityTags := []string{
		"MATRIZ", "FILIAIS", "SJP", "QT", "BV", "MGB", "PMV",
		"PIRABAS", "QUATIPURU", "BOA VISTA", "MAGALHÃES", "MAGALHAES",
		"PRIMAVERA", "MARACANÃ", "MARACANA",
	}
	for _, loc := range localityTags {
		if strings.Contains(s, loc) && len(s) <= 40 && (strings.Contains(s, "MATRIZ") || strings.Contains(s, "FILIAIS") || strings.Contains(s, loc)) {
			return true
		}
	}
	return false
}

// NormalizeTopicName padroniza e categoriza de forma inteligível a demanda técnica
func NormalizeTopicName(s string) string {
	s = strings.TrimSpace(s)
	if s == "" {
		return "Outros / Operacional"
	}
	u := strings.ToUpper(s)
	if strings.Contains(u, "TROCA DE SENHA") || strings.Contains(u, "ALTERAR SENHA") {
		return "Troca de Senha"
	}
	if strings.Contains(u, "SEM INTERNET") || strings.Contains(u, "SEM CONEX") || strings.Contains(u, "QUEDA") {
		return "Sem Internet / Conexão"
	}
	if strings.Contains(u, "LENTID") {
		return "Lentidão na Navegação"
	}
	if strings.Contains(u, "ROMPIMENTO") || strings.Contains(u, "RAMAL") || strings.Contains(u, "FIBRA") || strings.Contains(u, "INFR") {
		return "Rompimento de Fibra / Ramal"
	}
	if strings.Contains(u, "RETIRADA") {
		return "Retirada de Equipamento"
	}
	if strings.Contains(u, "INSTALA") {
		return "Instalação / Mudança de Ponto"
	}
	if strings.Contains(u, "DESCONEX") && strings.Contains(u, "CTO") {
		return "Desconexão de CTO"
	}
	if strings.Contains(u, "REVERS") {
		return "Reversão de Cancelamento"
	}
	if strings.Contains(u, "TROCA DE EQUIPAMENTO") || strings.Contains(u, "TROCA -") {
		return "Troca de Equipamento"
	}
	if strings.Contains(u, "SERVIÇO SOLICITADO") || strings.Contains(u, "SERVICO SOLICITADO") {
		return "Serviço Solicitado pelo Cliente"
	}
	if strings.Contains(u, "TITULAR") {
		return "Alteração de Titularidade"
	}
	_, name := ParseParenthesis(s)
	if name != "" {
		return name
	}
	return s
}

// NormalizeCauseName padroniza e consolida o motivo técnico / solução apurada em campo
func NormalizeCauseName(s string) string {
	s = strings.TrimSpace(s)
	if s == "" {
		return "Em apuração"
	}
	u := strings.ToUpper(s)
	if strings.Contains(u, "COM USO DE MATERIAL") {
		return "Reparo com uso de material"
	}
	if strings.Contains(u, "SEM USO DE MATERIAL") {
		return "Reparo sem uso de material"
	}
	if strings.Contains(u, "TROCA DE SENHA") {
		return "Troca de Senha Realizada"
	}
	if strings.Contains(u, "SOLU") && strings.Contains(u, "REMOT") {
		return "Solução Remota Realizada"
	}
	if (strings.Contains(u, "DESCONECT") || strings.Contains(u, "DESCONEX")) && strings.Contains(u, "CTO") {
		return "Desconectado da CTO"
	}
	if strings.Contains(u, "RETIRADO") || (strings.Contains(u, "EQUIPAMENTO") && (strings.Contains(u, "RECEBIDO") || strings.Contains(u, "RECOLHIDO") || strings.Contains(u, "RETIRAD"))) {
		return "Equipamento Retirado / Desconexão CTO"
	}
	if strings.Contains(u, "INSTALADO") || strings.Contains(u, "INSTALAÇÃO") || strings.Contains(u, "INSTALACAO") {
		return "Instalação Concluída"
	}
	_, name := ParseParenthesis(s)
	if name != "" {
		return name
	}
	return s
}

// ResolveRealTopicAndCause extrai a demanda técnica real e causa/resolução raiz a partir dos fluxos finalizados e do histórico
func ResolveRealTopicAndCause(t TicketDto) (string, string) {
	topic := ""
	cause := ""

	// 1. Procura tópico técnico nos fluxos finalizados (primeiro fluxo técnico)
	for _, f := range t.FinalizedFlows {
		if !IsAdministrativeTopic(f.TopicRaw) {
			topic = NormalizeTopicName(f.TopicRaw)
			break
		}
	}

	// Se não encontrou tópico nos fluxos, checa o campo de nível superior
	if topic == "" {
		if !IsAdministrativeTopic(t.TopicName) {
			topic = NormalizeTopicName(t.TopicName)
		} else {
			// Inspeciona descrição, solução e ocorrências
			combined := strings.ToUpper(fmt.Sprintf("%s %s", t.Description, t.Solution))
			if strings.Contains(combined, "TROCA DE SENHA") || strings.Contains(combined, "ALTERAR SENHA") || strings.Contains(combined, "SENHA") {
				topic = "Troca de Senha"
			} else if strings.Contains(combined, "LENTID") {
				topic = "Lentidão na Navegação"
			} else if strings.Contains(combined, "SEM INTERNET") || strings.Contains(combined, "SEM CONEX") || strings.Contains(combined, "QUEDA") {
				topic = "Sem Internet / Conexão"
			} else if strings.Contains(combined, "ROMPIMENTO") || strings.Contains(combined, "FIBRA") || strings.Contains(combined, "RAMAL") || strings.Contains(combined, "INFR") {
				topic = "Rompimento de Fibra / Ramal"
			} else if strings.Contains(combined, "INSTALA") {
				topic = "Instalação / Mudança de Ponto"
			} else if strings.Contains(combined, "RETIRADA") {
				topic = "Retirada de Equipamento"
			} else if strings.Contains(combined, "TITULAR") {
				topic = "Alteração de Titularidade"
			} else if strings.Contains(combined, "TROCA") && strings.Contains(combined, "EQUIPAMENTO") {
				topic = "Troca de Equipamento"
			} else if strings.Contains(combined, "SERVIÇO SOLICITADO") || strings.Contains(combined, "SERVICO SOLICITADO") {
				topic = "Serviço Solicitado pelo Cliente"
			} else if t.TopicName != "" && !IsAdministrativeTopic(t.TopicName) {
				topic = NormalizeTopicName(t.TopicName)
			} else {
				topic = "Outras Demandas Técnicas"
			}
		}
	}

	// 2. Procura causa raiz técnica nos fluxos finalizados
	for _, f := range t.FinalizedFlows {
		if !IsAdministrativeCause(f.CauseRaw) {
			cause = NormalizeCauseName(f.CauseRaw)
			break
		}
	}

	// Se não encontrou causa nos fluxos, checa o campo de nível superior
	if cause == "" {
		if !IsAdministrativeCause(t.CauseName) && !strings.Contains(strings.ToUpper(t.CauseName), "EM APURA") {
			cause = NormalizeCauseName(t.CauseName)
		} else {
			hasRemote := false
			for _, f := range t.FinalizedFlows {
				if f.FlowType == "Solução Remota" || (strings.Contains(strings.ToUpper(f.CauseRaw), "SOLU") && strings.Contains(strings.ToUpper(f.CauseRaw), "REMOT")) {
					hasRemote = true
					break
				}
			}

			combined := strings.ToUpper(fmt.Sprintf("%s %s", t.Description, t.Solution))
			if topic == "Troca de Senha" {
				cause = "Troca de Senha Realizada"
			} else if hasRemote || t.HasRemoteSolution {
				cause = "Solução Remota Realizada"
			} else if strings.Contains(combined, "SEM USO DE MATERIAL") {
				cause = "Reparo sem uso de material"
			} else if strings.Contains(combined, "COM USO DE MATERIAL") {
				cause = "Reparo com uso de material"
			} else if strings.Contains(combined, "DESCONECT") && strings.Contains(combined, "CTO") {
				cause = "Desconectado da CTO"
			} else if t.HasFieldWork {
				cause = "Reparo Técnico em Campo"
			} else if t.Status == "Concluído" {
				cause = "Concluído Operacionalmente"
			} else {
				cause = "Em apuração"
			}
		}
	}

	return topic, cause
}

// EnrichTicketWithFlows aplica a extração completa de fluxos a um TicketDto
func EnrichTicketWithFlows(t *TicketDto) {
	if t.RawTopicName == "" {
		t.RawTopicName = t.TopicName
	}
	if t.RawCauseName == "" {
		t.RawCauseName = t.CauseName
	}

	combined := fmt.Sprintf("%s\n%s", t.Description, t.Solution)
	flows := ParseFinalizedFlows(combined)
	if flows == nil {
		flows = []OsFinalizedFlow{}
	}

	// Se não encontrou na descrição, verifica nas ocorrências
	if len(flows) == 0 && len(t.Ocorrencias) > 0 {
		for _, occ := range t.Ocorrencias {
			if strings.Contains(occ.Texto, "Fluxo finalizado") {
				subFlows := ParseFinalizedFlows(occ.Texto)
				flows = append(flows, subFlows...)
			}
		}
	}

	t.FinalizedFlows = flows
	t.FlowCount = len(flows)

	if len(flows) > 0 {
		last := flows[len(flows)-1]
		t.LastFlow = &last

		hasRemote := false
		hasField := false
		primaryLocality := ""

		for _, f := range flows {
			if f.FlowType == "Solução Remota" {
				hasRemote = true
			}
			if f.FlowType == "Presencial / Campo" {
				hasField = true
			}
			if primaryLocality == "" && f.Locality != "" {
				primaryLocality = f.Locality
			}
		}

		t.HasRemoteSolution = hasRemote
		t.HasFieldWork = hasField
		t.PrimaryLocality = primaryLocality

		// Categoria de fluxo resumida para filtros
		if hasRemote && !hasField {
			t.FlowCategory = "Solução Remota"
		} else if hasField {
			t.FlowCategory = "Presencial / Campo"
		} else if last.FlowType != "" {
			t.FlowCategory = last.FlowType
		} else {
			t.FlowCategory = "Outro"
		}
	} else {
		// Fallback se não tiver blocos de fluxo finalizado
		t.HasRemoteSolution = strings.Contains(strings.ToUpper(t.CauseName), "REMOT") || strings.Contains(strings.ToUpper(t.TopicName), "REMOT")
		t.HasFieldWork = strings.Contains(strings.ToUpper(t.CauseName), "REPARO") || strings.Contains(strings.ToUpper(t.TopicName), "INSTALAÇÃO")
		t.PrimaryLocality = ExtractLocality(t.TopicName, t.CauseName)
		if t.HasRemoteSolution {
			t.FlowCategory = "Solução Remota"
		} else if t.HasFieldWork {
			t.FlowCategory = "Presencial / Campo"
		} else {
			t.FlowCategory = "Outro"
		}
	}

	realTopic, realCause := ResolveRealTopicAndCause(*t)
	t.RealTopic = realTopic
	t.RealCause = realCause

	// Substitui rótulos puramente administrativos por demandas e causas técnicas normalizadas
	if realTopic != "" {
		t.TopicName = realTopic
	}
	if realCause != "" && (IsAdministrativeCause(t.CauseName) || t.CauseName == "" || (t.Status == "Concluído" && strings.Contains(strings.ToUpper(t.CauseName), "EM APURA")) || realCause != "Em apuração") {
		t.CauseName = realCause
	}
}
