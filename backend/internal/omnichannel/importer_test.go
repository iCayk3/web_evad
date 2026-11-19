package omnichannel

import (
	"os"
	"path/filepath"
	"testing"
)

func TestPreviewFile_UserExample(t *testing.T) {
	csvData := `ID,INICIADO POR,PROTOCOLO,STATUS,CANAL,CLIENTE,FONE,ATENDENTE / ENCERROU,DEPARTAMENTO,ATRIBUIÇÕES,TMA,TME,TMR (1ª resposta),TMR (média),DATA INICIO,DATA ENCERRAMENTO,CLASSIFICAÇÃO,DESCRICAO,TIPO DE ENCERRAMENTO,MENSAGENS RECEBIDAS,MENSAGENS ENVIADAS,MENSAGENS INTERNAS,PESQUISA DE SATISFAÇÃO
40437879,Cliente,2026103040437879 ,FINALIZADO,Sol Provedor,Leidiane Santa Brigida Pinheiro,+55(91)8523-9430,AUTOMAÇÃO,,SEM ATRIBUIÇÕES,00:04:17,--,--,--,30/10/2026 14:10:46,30/10/2026 14:15:03,,,Automação,5,10,,Não enviada
40437848,Cliente,2026103040437848 ,FINALIZADO,Sol Provedor,Adriel Andrade Da Silva,+55(91)8171-7002,Yarlei Dias Farias,Financeiro,Yarlei Dias Farias,00:11:31,00:00:08,00:00:08,00:01:40,30/10/2026 14:09:54,30/10/2026 14:21:25,INFORMAÇÃO,ok,Encerramento manual,10,21,,Expirada
`
	tmpDir := t.TempDir()
	filePath := filepath.Join(tmpDir, "sample_test.csv")
	if err := os.WriteFile(filePath, []byte(csvData), 0644); err != nil {
		t.Fatalf("Failed to write temp csv: %v", err)
	}

	preview, err := PreviewFile(filePath, 50)
	if err != nil {
		t.Fatalf("PreviewFile returned error: %v", err)
	}

	if preview.TotalRowsEstimated != 2 {
		t.Errorf("Expected 2 rows estimated, got %d", preview.TotalRowsEstimated)
	}
	if preview.DetectedColumnsCount != 23 {
		t.Errorf("Expected 23 detected columns, got %d", preview.DetectedColumnsCount)
	}
	if len(preview.UnmappedHeaders) != 0 {
		t.Errorf("Expected 0 unmapped headers, got %d: %v", len(preview.UnmappedHeaders), preview.UnmappedHeaders)
	}
	if len(preview.PreviewRows) != 2 {
		t.Fatalf("Expected 2 preview rows, got %d", len(preview.PreviewRows))
	}

	row1 := preview.PreviewRows[0]
	if row1.ConversationID != "40437879" {
		t.Errorf("Row 1: expected convID 40437879, got %s", row1.ConversationID)
	}
	if row1.CanonicalData["protocol_number"] != "2026103040437879" {
		t.Errorf("Row 1: expected protocol_number 2026103040437879, got %v", row1.CanonicalData["protocol_number"])
	}
	if row1.CanonicalData["is_automation"] != true {
		t.Errorf("Row 1: expected is_automation=true, got %v", row1.CanonicalData["is_automation"])
	}
	if row1.CanonicalData["department"] != "Automação" {
		t.Errorf("Row 1: expected department 'Automação', got %v", row1.CanonicalData["department"])
	}

	row2 := preview.PreviewRows[1]
	if row2.ConversationID != "40437848" {
		t.Errorf("Row 2: expected convID 40437848, got %s", row2.ConversationID)
	}
	if row2.CanonicalData["protocol_number"] != "2026103040437848" {
		t.Errorf("Row 2: expected protocol_number 2026103040437848, got %v", row2.CanonicalData["protocol_number"])
	}
	if row2.CanonicalData["customer_name"] != "Adriel Andrade Da Silva" {
		t.Errorf("Row 2: expected name 'Adriel Andrade Da Silva', got %v", row2.CanonicalData["customer_name"])
	}
	if row2.CanonicalData["closed_by"] != "Yarlei Dias Farias" {
		t.Errorf("Row 2: expected closed_by 'Yarlei Dias Farias', got %v", row2.CanonicalData["closed_by"])
	}
	if row2.CanonicalData["department"] != "Financeiro" {
		t.Errorf("Row 2: expected department 'Financeiro', got %v", row2.CanonicalData["department"])
	}
	if row2.CanonicalData["classification"] != "INFORMAÇÃO" {
		t.Errorf("Row 2: expected classification 'INFORMAÇÃO', got %v", row2.CanonicalData["classification"])
	}
}
