package omnichannel

import (
	"testing"
)

func TestDetectColumnMapping_UserExampleHeaders(t *testing.T) {
	headers := []string{
		"ID",
		"INICIADO POR",
		"PROTOCOLO",
		"STATUS",
		"CANAL",
		"CLIENTE",
		"FONE",
		"ATENDENTE / ENCERROU",
		"DEPARTAMENTO",
		"ATRIBUIÇÕES",
		"TMA",
		"TME",
		"TMR (1ª resposta)",
		"TMR (média)",
		"DATA INICIO",
		"DATA ENCERRAMENTO",
		"CLASSIFICAÇÃO",
		"DESCRICAO",
		"TIPO DE ENCERRAMENTO",
		"MENSAGENS RECEBIDAS",
		"MENSAGENS ENVIADAS",
		"MENSAGENS INTERNAS",
		"PESQUISA DE SATISFAÇÃO",
	}

	detection := DetectColumnMapping(headers)

	if len(detection.UnmappedHeaders) > 0 {
		t.Fatalf("Expected 0 unmapped headers, got %d: %v", len(detection.UnmappedHeaders), detection.UnmappedHeaders)
	}

	expected := map[string]CanonicalField{
		"ID":                     FieldConversationID,
		"INICIADO POR":           FieldInitiatedBy,
		"PROTOCOLO":              FieldProtocolNumber,
		"STATUS":                 FieldStatus,
		"CANAL":                  FieldChannel,
		"CLIENTE":                FieldCustomerName,
		"FONE":                   FieldPhoneNumber,
		"ATENDENTE / ENCERROU":   FieldClosedBy,
		"DEPARTAMENTO":           FieldDepartment,
		"ATRIBUIÇÕES":            FieldAssignments,
		"TMA":                    FieldAverageHandleTime,
		"TME":                    FieldAverageWaitTime,
		"TMR (1ª resposta)":      FieldFirstResponseTime,
		"TMR (média)":            FieldAvgResponseTime,
		"DATA INICIO":            FieldStartedAt,
		"DATA ENCERRAMENTO":      FieldEndedAt,
		"CLASSIFICAÇÃO":          FieldClassification,
		"DESCRICAO":              FieldDescription,
		"TIPO DE ENCERRAMENTO":   FieldClosureType,
		"MENSAGENS RECEBIDAS":    FieldMessagesReceived,
		"MENSAGENS ENVIADAS":     FieldMessagesSent,
		"MENSAGENS INTERNAS":     FieldMessagesInternal,
		"PESQUISA DE SATISFAÇÃO": FieldSatisfactionSurvey,
	}

	for idx, h := range headers {
		expField, ok := expected[h]
		if !ok {
			t.Errorf("Unexpected header in test: %s", h)
			continue
		}
		actualField := detection.Mapping[idx]
		if actualField != expField {
			t.Errorf("Header %q (idx %d): expected %s, got %s", h, idx, expField, actualField)
		}
	}
}
