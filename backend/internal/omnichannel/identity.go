package omnichannel

import (
	"context"
	"fmt"
	"sync"

	"github.com/jackc/pgx/v5/pgxpool"
)

// RbxClientSimple estrutura simplificada para indexação em memória
type RbxClientSimple struct {
	ID                string
	Name              string
	NormalizedName    string
	Phone             string
	NormalizedPhone   string
	Candidate9thPhone string
}

// MatchResolution resultado da correspondência de identidade
type MatchResolution struct {
	ConversationID      string
	Status              string // 'confirmed', 'name_suggested', 'ambiguous', 'unmatched'
	Method              *string
	Confidence          float64
	RbxClientID         *string
	SuggestedClientName string
	Reason              string
}

// IdentityMatcher motor de indexação e resolução de identidade
type IdentityMatcher struct {
	mu             sync.RWMutex
	phoneIndex     map[string][]RbxClientSimple
	exactNameIndex map[string][]RbxClientSimple
	knownMappings  map[string]string // phoneHMAC -> rbxClientID
	loaded         bool
}

// NewIdentityMatcher cria um novo resolvedor de identidade
func NewIdentityMatcher() *IdentityMatcher {
	return &IdentityMatcher{
		phoneIndex:     make(map[string][]RbxClientSimple),
		exactNameIndex: make(map[string][]RbxClientSimple),
		knownMappings:  make(map[string]string),
	}
}

// LoadIndexes carrega clientes do banco de dados PostgreSQL e indexa por telefone e nome
func (m *IdentityMatcher) LoadIndexes(ctx context.Context, db *pgxpool.Pool) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.phoneIndex = make(map[string][]RbxClientSimple)
	m.exactNameIndex = make(map[string][]RbxClientSimple)
	m.knownMappings = make(map[string]string)

	if db == nil {
		return nil
	}

	// 1. Carrega mapeamentos manuais conhecidos
	knownRows, err := db.Query(ctx, "SELECT phone_hmac, rbx_client_id FROM omnichannel_known_mappings")
	if err == nil {
		defer knownRows.Close()
		for knownRows.Next() {
			var hmac, cid string
			if err := knownRows.Scan(&hmac, &cid); err == nil && hmac != "" && cid != "" {
				m.knownMappings[hmac] = cid
			}
		}
	}

	// 2. Carrega clientes locais da tabela clientes
	rows, err := db.Query(ctx, "SELECT codigo_rbx, COALESCE(nome, '') FROM clientes")
	if err != nil {
		return fmt.Errorf("erro ao ler clientes para indexação: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var code, name string
		if err := rows.Scan(&code, &name); err == nil && code != "" {
			nameNorm := NormalizeName(name)
			c := RbxClientSimple{
				ID:             code,
				Name:           name,
				NormalizedName: nameNorm,
			}
			if nameNorm != "" {
				m.exactNameIndex[nameNorm] = append(m.exactNameIndex[nameNorm], c)
			}
		}
	}

	m.loaded = true
	return nil
}

// IndexClient adiciona um cliente ao índice (por exemplo, após consulta RBX)
func (m *IdentityMatcher) IndexClient(id, name, phone string) {
	m.mu.Lock()
	defer m.mu.Unlock()

	phoneNorm, cand9th := NormalizePhone(phone)
	nameNorm := NormalizeName(name)

	c := RbxClientSimple{
		ID:                id,
		Name:              name,
		NormalizedName:    nameNorm,
		Phone:             phone,
		NormalizedPhone:   phoneNorm,
		Candidate9thPhone: cand9th,
	}

	if phoneNorm != "" {
		m.phoneIndex[phoneNorm] = append(m.phoneIndex[phoneNorm], c)
	}
	if cand9th != "" && cand9th != phoneNorm {
		m.phoneIndex[cand9th] = append(m.phoneIndex[cand9th], c)
	}
	if nameNorm != "" {
		m.exactNameIndex[nameNorm] = append(m.exactNameIndex[nameNorm], c)
	}
}

// MatchContact resolve a identidade do cliente a partir do telefone e nome
func (m *IdentityMatcher) MatchContact(phoneHMAC, phoneNorm, phoneCand9th, nameNorm string) MatchResolution {
	m.mu.RLock()
	defer m.mu.RUnlock()

	// 1. Checa mapeamentos manuais conhecidos
	if cid, ok := m.knownMappings[phoneHMAC]; ok && cid != "" {
		method := "manual"
		return MatchResolution{
			Status:      "confirmed",
			Method:      &method,
			Confidence:  1.0,
			RbxClientID: &cid,
			Reason:      "Correspondência prévia aprovada manualmente.",
		}
	}

	// 2. Busca exata por telefone
	var phoneMatches []RbxClientSimple
	if phoneNorm != "" {
		if list, ok := m.phoneIndex[phoneNorm]; ok {
			phoneMatches = append(phoneMatches, list...)
		}
	}
	if len(phoneMatches) == 0 && phoneCand9th != "" {
		if list, ok := m.phoneIndex[phoneCand9th]; ok {
			phoneMatches = append(phoneMatches, list...)
		}
	}

	// Remove duplicatas de ID na lista de matches de telefone
	uniquePhoneMap := make(map[string]RbxClientSimple)
	for _, c := range phoneMatches {
		uniquePhoneMap[c.ID] = c
	}

	if len(uniquePhoneMap) == 1 {
		var single RbxClientSimple
		for _, c := range uniquePhoneMap {
			single = c
		}
		method := "phone"
		return MatchResolution{
			Status:              "confirmed",
			Method:              &method,
			Confidence:          1.0,
			RbxClientID:         &single.ID,
			SuggestedClientName: single.Name,
			Reason:              "Telefone coincidente de forma única no cadastro.",
		}
	} else if len(uniquePhoneMap) > 1 {
		method := "phone"
		return MatchResolution{
			Status:     "ambiguous",
			Method:     &method,
			Confidence: 0.5,
			Reason:     fmt.Sprintf("Telefone vinculado a %d cadastros distintos no RBX.", len(uniquePhoneMap)),
		}
	}

	// 3. Busca por Nome Normalizado
	if nameNorm != "" {
		if list, ok := m.exactNameIndex[nameNorm]; ok && len(list) > 0 {
			if len(list) == 1 {
				method := "name"
				return MatchResolution{
					Status:              "name_suggested",
					Method:              &method,
					Confidence:          0.90,
					RbxClientID:         &list[0].ID,
					SuggestedClientName: list[0].Name,
					Reason:              "Nome idêntico encontrado no cadastro; aguardando confirmação.",
				}
			}
			method := "name"
			return MatchResolution{
				Status:     "ambiguous",
				Method:     &method,
				Confidence: 0.5,
				Reason:     fmt.Sprintf("Nome homônimo compartilhado por %d clientes.", len(list)),
			}
		}
	}

	// 4. Sem correspondência
	return MatchResolution{
		Status:     "unmatched",
		Confidence: 0.0,
		Reason:     "Nenhum cliente RBX coincidente por telefone ou nome.",
	}
}
