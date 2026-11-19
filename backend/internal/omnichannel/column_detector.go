package omnichannel

import (
	"strings"
	"unicode"

	"golang.org/x/text/runes"
	"golang.org/x/text/transform"
	"golang.org/x/text/unicode/norm"
)

// CanonicalField nomes canônicos de campos das planilhas do ISPCHAT
type CanonicalField string

const (
	FieldConversationID     CanonicalField = "conversation_id"
	FieldInitiatedBy        CanonicalField = "initiated_by"
	FieldProtocolNumber     CanonicalField = "protocol_number"
	FieldStatus             CanonicalField = "status"
	FieldChannel            CanonicalField = "channel"
	FieldCustomerName       CanonicalField = "customer_name"
	FieldPhoneNumber        CanonicalField = "phone_number"
	FieldClosedBy           CanonicalField = "closed_by"
	FieldDepartment         CanonicalField = "department"
	FieldAssignments        CanonicalField = "assignments"
	FieldAverageHandleTime  CanonicalField = "average_handle_time"
	FieldAverageWaitTime    CanonicalField = "average_wait_time"
	FieldFirstResponseTime  CanonicalField = "first_response_time"
	FieldAvgResponseTime    CanonicalField = "avg_response_time"
	FieldStartedAt          CanonicalField = "started_at"
	FieldEndedAt            CanonicalField = "ended_at"
	FieldClassification     CanonicalField = "classification"
	FieldDescription        CanonicalField = "description"
	FieldClosureType        CanonicalField = "closure_type"
	FieldMessagesReceived   CanonicalField = "messages_received"
	FieldMessagesSent       CanonicalField = "messages_sent"
	FieldMessagesInternal   CanonicalField = "messages_internal"
	FieldSatisfactionSurvey CanonicalField = "satisfaction_survey"
)

var CanonicalColumns = map[CanonicalField][]string{
	FieldConversationID:     {"id", "id conversa", "conversa_id", "id_conversa", "protocolo ispchat", "chat id", "chat_id"},
	FieldInitiatedBy:        {"iniciado por", "iniciador", "origem", "iniciado_por"},
	FieldProtocolNumber:     {"protocolo", "protocolo_atendimento", "protocolo de atendimento", "numero protocolo", "num_protocolo"},
	FieldStatus:             {"status", "estado", "situacao", "situação"},
	FieldChannel:            {"canal", "canal_atendimento", "canal de atendimento"},
	FieldCustomerName:       {"cliente", "nome do cliente", "nome_cliente", "nome"},
	FieldPhoneNumber:        {"fone", "telefone", "celular", "whatsapp", "numero", "telefone_cliente", "contato"},
	FieldClosedBy:           {"atendente / encerrou", "atendente/encerrou", "atendente encerrou", "encerrou", "fechado por", "finalizado por", "operador encerrou"},
	FieldDepartment:         {"departamento", "setor", "fila"},
	FieldAssignments:        {"atribuicoes", "atribuições", "atendentes", "historico atendentes", "atribuicao"},
	FieldAverageHandleTime:  {"tma", "tempo medio de atendimento", "tempo_atendimento", "tempo atendimento"},
	FieldAverageWaitTime:    {"tme", "tempo medio de espera", "tempo_espera", "tempo espera"},
	FieldFirstResponseTime:  {"tmr (1ª resposta)", "tmr 1 resposta", "tmr 1a resposta", "tempo primeira resposta", "tmr primeira resposta", "tmr 1ª resposta"},
	FieldAvgResponseTime:    {"tmr (média)", "tmr media", "tmr_medio", "tempo medio resposta", "tmr (media)", "tmr medio"},
	FieldStartedAt:          {"data inicio", "data_inicio", "inicio", "abertura", "data de inicio", "data abertura"},
	FieldEndedAt:            {"data encerramento", "data_encerramento", "fim", "fechamento", "conclusao", "data encerrou", "data conclusao"},
	FieldClassification:     {"classificacao", "classificação", "motivo", "categoria", "tags"},
	FieldDescription:        {"descricao", "descrição", "observacao", "observações", "resumo"},
	FieldClosureType:        {"tipo de encerramento", "tipo_encerramento", "motivo encerramento", "tipo encerramento", "forma encerramento"},
	FieldMessagesReceived:   {"mensagens recebidas", "mensagens_recebidas", "msg recebidas", "msgs recebidas"},
	FieldMessagesSent:       {"mensagens enviadas", "mensagens_enviadas", "msg enviadas", "msgs enviadas"},
	FieldMessagesInternal:   {"mensagens internas", "mensagens_internas", "msg internas", "msgs internas"},
	FieldSatisfactionSurvey: {"pesquisa de satisfacao", "pesquisa de satisfação", "pesquisa_de_satisfacao", "csat", "pesquisa", "avaliacao"},
}

// NormalizeHeader remove acentos, caracteres especiais e BOM para comparação flexível
func NormalizeHeader(header string) string {
	header = strings.TrimPrefix(header, "\ufeff")
	header = strings.TrimPrefix(header, "\xef\xbb\xbf")

	t := transform.Chain(norm.NFD, runes.Remove(runes.In(unicode.Mn)), norm.NFC)
	result, _, _ := transform.String(t, header)
	lower := strings.ToLower(result)

	var sb strings.Builder
	for _, r := range lower {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') {
			sb.WriteRune(r)
		} else {
			sb.WriteRune(' ')
		}
	}
	return strings.Join(strings.Fields(sb.String()), " ")
}

// ColumnDetection resultado do mapeamento automático de colunas
type ColumnDetection struct {
	Mapping         map[int]CanonicalField
	FieldIndices    map[CanonicalField]int
	DetectedCount   int
	UnmappedHeaders []string
}

// DetectColumnMapping analisa cabeçalhos da planilha e associa aos campos canônicos
func DetectColumnMapping(headers []string) ColumnDetection {
	mapping := make(map[int]CanonicalField)
	fieldIndices := make(map[CanonicalField]int)
	var unmapped []string

	for idx, header := range headers {
		normH := NormalizeHeader(header)
		if normH == "" {
			continue
		}

		var matched CanonicalField

		// 1. Pass 1: Tentativa de correspondência EXATA
		for field, variations := range CanonicalColumns {
			for _, v := range variations {
				if normH == NormalizeHeader(v) {
					matched = field
					break
				}
			}
			if matched != "" {
				break
			}
		}

		// 2. Pass 2: Se não houver exata, correspondência por substring / contenção
		if matched == "" {
			for field, variations := range CanonicalColumns {
				for _, v := range variations {
					normV := NormalizeHeader(v)
					// Evita falsos positivos com substrings curtas como "id"
					if len(normV) >= 4 && (strings.Contains(normH, normV) || strings.Contains(normV, normH)) {
						matched = field
						break
					}
				}
				if matched != "" {
					break
				}
			}
		}

		if matched != "" {
			mapping[idx] = matched
			if _, exists := fieldIndices[matched]; !exists {
				fieldIndices[matched] = idx
			}
		} else {
			unmapped = append(unmapped, header)
		}
	}

	return ColumnDetection{
		Mapping:         mapping,
		FieldIndices:    fieldIndices,
		DetectedCount:   len(mapping),
		UnmappedHeaders: unmapped,
	}
}
