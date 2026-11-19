package audit

import (
	"testing"
)

func TestSanitizeDetails_PIIRemoved(t *testing.T) {
	input := map[string]interface{}{
		"action":        "export_pdf",
		"password":      "123456",
		"user_cpf":      "123.456.789-00",
		"email":         "teste@provedor.com.br",
		"client_phone":  "91988887777",
		"chave_secreta": "xyz_token",
		"total_count":   150,
		"status":        "success",
	}

	sanitized := SanitizeDetails(input)

	forbidden := []string{"password", "user_cpf", "email", "client_phone", "chave_secreta"}
	for _, f := range forbidden {
		if _, exists := sanitized[f]; exists {
			t.Errorf("Campo sensível '%s' não foi removido da trilha de auditoria!", f)
		}
	}

	allowed := []string{"action", "total_count", "status"}
	for _, a := range allowed {
		if _, exists := sanitized[a]; !exists {
			t.Errorf("Campo legítimo '%s' deveria ter sido mantido!", a)
		}
	}
}
