package crm

import (
	"bytes"
	"context"
	"encoding/csv"
	"fmt"
	"math"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"evad-backend/internal/audit"
	"evad-backend/internal/rbx"
)

var (
	reIsencaoAdesao = regexp.MustCompile(`(?i)ades[aã]o\s*[-_–—:\s]?\s*(in?senta|zero|gr[aá]tis|0)|in?sen[cç][aã]o\s*(de\s*)?ades[aã]o|sem\s+ades[aã]o`)
)

// IsClosedSaleContract determina se um contrato comercial representa uma nova venda fechada.
// Contempla:
// 1. Contratos com taxa de adesão lançada/paga (> 0);
// 2. Contratos com rastreabilidade explícita a lead/prospect do CRM (OriginProspectId > 0);
// 3. Planos com isenção explícita de adesão (ex: "SUPER 250 MEGAS-ADESÃO INSENTA", isenção, adesão zero/grátis),
//    garantindo que promoções com taxa 0,00 não sejam omitidas.
func IsClosedSaleContract(c SalesContractDto) bool {
	if c.SalesChannel == "Instalação RBX" || c.StatusDescription == "Instalação Concluída" {
		return true
	}
	if c.AdhesionValue > 0 {
		return true
	}
	if c.OriginProspectId > 0 {
		return true
	}

	plan := strings.TrimSpace(strings.ToLower(c.PlanDescription))
	if plan == "" {
		return false
	}

	if reIsencaoAdesao.MatchString(plan) {
		return true
	}

	if strings.Contains(plan, "adesão insenta") ||
		strings.Contains(plan, "adesao insenta") ||
		strings.Contains(plan, "adesão isenta") ||
		strings.Contains(plan, "adesao isenta") ||
		strings.Contains(plan, "adesão zero") ||
		strings.Contains(plan, "adesao zero") ||
		strings.Contains(plan, "adesão grátis") ||
		strings.Contains(plan, "adesao gratis") ||
		strings.Contains(plan, "sem adesão") ||
		strings.Contains(plan, "sem adesao") {
		return true
	}

	return false
}

// IsFibraOpticaGpon valida se a tecnologia do contrato é elegível para análise comercial.
// Aceita "Fibra Óptica GPON", tecnologia "C" (padrão de conexão cabo óptico no RBX) e vazios.
func IsFibraOpticaGpon(tech string) bool {
	if tech == "" {
		return true
	}
	norm := strings.ToLower(strings.TrimSpace(tech))
	norm = strings.ReplaceAll(norm, "ó", "o")
	norm = strings.ReplaceAll(norm, "ptico", "ptico")
	norm = strings.ReplaceAll(norm, "  ", " ")

	return norm == "fibra optica gpon" || norm == "fibra óptica gpon" || norm == "c" || norm == ""
}

// ParseDateSafe converte com segurança datas nos formatos comuns (BR e ISO)
func ParseDateSafe(dateInput string) (*time.Time, bool) {
	str := strings.TrimSpace(dateInput)
	if str == "" || str == "NULL" || str == "-" {
		return nil, false
	}

	formats := []string{
		"2006-01-02 15:04:05",
		"2006-01-02T15:04:05Z07:00",
		"2006-01-02T15:04:05",
		"2006-01-02",
		"02/01/2006 15:04:05",
		"02/01/2006 15:04",
		"02/01/2006",
		"02-01-2006 15:04:05",
		"02-01-2006",
	}

	for _, f := range formats {
		if t, err := time.ParseInLocation(f, str, time.Local); err == nil {
			return &t, true
		}
	}

	return nil, false
}

// isLeadInDateRange verifica com segurança se a data de inclusão do lead está dentro do intervalo
func isLeadInDateRange(createdAt string, startDate, endDate time.Time) bool {
	s := strings.TrimSpace(createdAt)
	if s == "" || s == "NULL" || s == "-" {
		return false
	}
	leadDay := s
	if len(leadDay) >= 10 {
		leadDay = leadDay[:10]
	}
	startDay := startDate.Format("2006-01-02")
	endDay := endDate.Format("2006-01-02")

	if len(leadDay) == 10 && leadDay >= startDay && leadDay <= endDay {
		return true
	}

	if t, ok := ParseDateSafe(s); ok {
		tDay := t.Format("2006-01-02")
		return tDay >= startDay && tDay <= endDay
	}
	return false
}

// MercadoToLeadDto converte o MercadoDto oficial do RBXSoft para o modelo LeadDto do EVAD CRM
func MercadoToLeadDto(m rbx.MercadoDto) LeadDto {
	phone := strings.TrimSpace(m.TelCelular)
	if phone == "" {
		phone = strings.TrimSpace(m.TelComercial)
	}
	if phone == "" {
		phone = strings.TrimSpace(m.TelResidencial)
	}

	owner := strings.TrimSpace(m.Usuario)
	if owner == "" {
		owner = "Não atribuído"
	}

	group := strings.TrimSpace(m.Grupo)
	if group == "" {
		group = "Comercial PME"
	}

	inclusao := strings.TrimSpace(m.Inclusao)

	return LeadDto{
		ID:                  m.Codigo,
		Code:                strconv.Itoa(m.Codigo),
		Name:                m.Nome,
		PersonType:          m.Tipo,
		CpfCnpj:             m.CpfCnpj,
		Phone:               phone,
		City:                m.Cidade,
		State:               m.UF,
		Neighborhood:        m.Bairro,
		Address:             m.Endereco,
		AddressNumber:       m.Numero,
		Complement:          m.Complemento,
		ZipCode:             m.CEP,
		CreatedAt:           inclusao,
		CreatedByUser:       owner,
		Status:              "Ativo",
		Group:               group,
		Stage:               LeadStageNew,
		Source:              "Prospecção RBX",
		Owner:               owner,
		StageUpdatedAt:      inclusao,
		ContactsCount:       0,
		OpenActivitiesCount: 0,
	}
}

func fetchLeads(ctx context.Context, client *rbx.Client) []LeadDto {
	if client != nil {
		mercados, err := client.ConsultarMercadosComFiltro(ctx, "Codigo > 0")
		if err == nil && len(mercados) > 0 {
			var leads []LeadDto
			for _, m := range mercados {
				leads = append(leads, MercadoToLeadDto(m))
			}
			return leads
		}
	}
	return MockMarkets
}

func fetchContractsFromDB(ctx context.Context, dbPool *pgxpool.Pool) ([]SalesContractDto, error) {
	if dbPool == nil {
		crmDataMu.RLock()
		defer crmDataMu.RUnlock()
		res := make([]SalesContractDto, len(MockContracts))
		copy(res, MockContracts)
		return res, nil
	}

	var results []SalesContractDto

	// 1. Instalações RBX (rbx_atendimentos_instalacoes)
	instQuery := `
		SELECT a.numero, COALESCE(NULLIF(a.contrato, ''), a.numero), COALESCE(a.codigo_cliente, ''),
		       COALESCE(NULLIF(a.nome_cliente, ''), c.nome, 'Cliente'),
		       COALESCE(to_char(a.data_abertura, 'YYYY-MM-DD'), ''),
		       COALESCE(
		           NULLIF(a.vendedor, ''),
		           NULLIF(c.vendedor, ''),
		           NULLIF(c.usuario_inclusao, ''),
		           NULLIF(CASE WHEN a.usuario_abertura = 'routerbox' THEN '' ELSE a.usuario_abertura END, ''),
		           NULLIF(a.usuario_abertura, ''),
		           'Não atribuído'
		       ),
		       COALESCE(NULLIF(a.cidade, ''), c.cidade, 'Salinópolis'),
		       COALESCE(NULLIF(c.plano, ''), 'SUPER 250 MEGAS'),
		       COALESCE(c.valor_mensalidade, 0.00)
		FROM rbx_atendimentos_instalacoes a
		LEFT JOIN LATERAL (
			SELECT c.nome, c.cidade, c.bairro, c.plano, c.valor_mensalidade, c.usuario_inclusao, c.vendedor
			FROM clientes c
			WHERE REPLACE(REPLACE(a.codigo_cliente, '.', ''), ',', '') = REPLACE(REPLACE(c.codigo_rbx, '.', ''), ',', '')
			ORDER BY c.criado_em DESC
			LIMIT 1
		) c ON true
		WHERE a.solucao NOT ILIKE '%gerad%incorret%'
		  AND a.solucao NOT ILIKE '%gerad%errad%'
		  AND a.solucao NOT ILIKE '%gerad%indevid%'
		  AND a.solucao NOT ILIKE '%aberto incorretamente%'
		  AND a.solucao NOT ILIKE '%aberta incorretamente%'
		  AND a.solucao NOT ILIKE '%abertura errada%'
		  AND a.solucao NOT ILIKE '%abertura incorreta%'
		  AND a.solucao NOT ILIKE '%fluxo incorreto%'
		  AND a.solucao NOT ILIKE '%n%o era instala%'
		  AND a.solucao NOT ILIKE '%como lentid%'
		  AND a.solucao NOT ILIKE '%como reparo%'
		  AND a.solucao NOT ILIKE '%como suporte%'
		  AND a.solucao NOT ILIKE '%nao teve viabilida%'
		  AND a.solucao NOT ILIKE '%não teve viabilida%'
		  AND a.solucao NOT ILIKE '%sem viabilidade%'
		  AND a.solucao NOT ILIKE '%cto muito longe%'
		  AND a.solucao NOT ILIKE '%cto longe%'
		  AND a.solucao NOT ILIKE '%inviabilidade técnica%'
		  AND a.solucao NOT ILIKE '%inviabilidade tecnica%'
		  AND a.solucao NOT ILIKE '%não foi possível instalar%'
		  AND a.solucao NOT ILIKE '%nao foi possivel instalar%'
		  AND a.solucao NOT ILIKE '%não foi instalad%'
		  AND a.solucao NOT ILIKE '%nao foi instalad%'
		  AND a.solucao NOT ILIKE '%não instalad%'
		  AND a.solucao NOT ILIKE '%nao instalad%'
		ORDER BY a.data_abertura DESC NULLS LAST
	`

	rows, err := dbPool.Query(ctx, instQuery)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var osNum, ctrNum, clientCode, clientName, dateStr, seller, city, plan string
			var fee float64

			if scanErr := rows.Scan(&osNum, &ctrNum, &clientCode, &clientName, &dateStr, &seller, &city, &plan, &fee); scanErr == nil {
				cleanCode := strings.ReplaceAll(strings.ReplaceAll(clientCode, ".", ""), ",", "")
				cID, _ := strconv.Atoi(cleanCode)

				if fee <= 0 {
					pUp := strings.ToUpper(plan)
					if strings.Contains(pUp, "250") {
						fee = 74.99
					} else if strings.Contains(pUp, "500") {
						fee = 109.99
					} else if strings.Contains(pUp, "600") {
						fee = 129.99
					} else if strings.Contains(pUp, "1 GIGA") || strings.Contains(pUp, "1000") {
						fee = 199.90
					} else {
						fee = 89.90
					}
				}

				results = append(results, SalesContractDto{
					Number:            ctrNum,
					ClientID:          cID,
					ClientName:        clientName,
					PlanDescription:   plan,
					StatusCode:        "A",
					StatusDescription: "Instalação Concluída",
					MonthlyValue:      fee,
					GrossValue:        fee,
					AdhesionValue:     0.0,
					SignDate:          dateStr,
					StartDate:         dateStr,
					LastOperationDate: dateStr,
					Seller:            seller,
					City:              city,
					State:             "PA",
					Group:             "Fibra Residencial",
					Technology:        "Fibra Óptica GPON",
					SalesChannel:      "Instalação RBX",
				})
			}
		}
	}

	// 2. Cancelamentos RBX (rbx_contratos_cancelados)
	cancQuery := `
		SELECT numero_contrato, COALESCE(codigo_cliente, ''), COALESCE(nome_cliente, 'Cliente'),
		       COALESCE(to_char(data_cancelamento, 'YYYY-MM-DD'), ''),
		       COALESCE(motivo_cancelamento, 'Não informado'),
		       COALESCE(plano, 'SUPER 250 MEGAS'), COALESCE(valor_mensalidade, 0.00),
		       COALESCE(cidade, 'Salinópolis')
		FROM rbx_contratos_cancelados
		WHERE motivo_cancelamento NOT ILIKE '%MUD%TITULARIDADE%'
		  AND motivo_cancelamento NOT ILIKE '%AJUSTE T%CNICO%'
		  AND motivo_cancelamento NOT ILIKE '%CONTRATO TEMPOR%RIO%'
		  AND motivo_cancelamento NOT ILIKE '%PEDIDO INSTALA%O CANCELADO%'
		  AND motivo_cancelamento NOT ILIKE '%ERRO%GERA%O%CONTRATO%'
		  AND motivo_cancelamento NOT ILIKE '%CANCELAMENTO%MIGRA%'
		  AND motivo_cancelamento NOT ILIKE '%N%O PAGOU A TAXA%'
		  AND motivo_cancelamento NOT ILIKE '%NAO PAGOU A TAXA%'
		  AND motivo_cancelamento NOT ILIKE '%INVIA%'
		  AND NOT (
		  	plano ~* '(^|[^a-zA-Z0-9])TV([^a-zA-Z0-9]|$)'
		  	OR plano ILIKE '%+ TV%'
		  	OR plano ILIKE '%+TV%'
		  	OR plano ILIKE '%TELEVIS%'
		  	OR plano ILIKE '%IPTV%'
		  )
		ORDER BY data_cancelamento DESC NULLS LAST
	`

	cRows, cErr := dbPool.Query(ctx, cancQuery)
	if cErr == nil {
		defer cRows.Close()
		for cRows.Next() {
			var ctrNum, clientCode, clientName, dateStr, reason, plan, city string
			var fee float64

			if scanErr := cRows.Scan(&ctrNum, &clientCode, &clientName, &dateStr, &reason, &plan, &fee, &city); scanErr == nil {
				cleanCode := strings.ReplaceAll(strings.ReplaceAll(clientCode, ".", ""), ",", "")
				cID, _ := strconv.Atoi(cleanCode)
				if fee <= 0 {
					fee = 89.90
				}

				results = append(results, SalesContractDto{
					Number:            ctrNum,
					ClientID:          cID,
					ClientName:        clientName,
					PlanDescription:   plan,
					StatusCode:        "C",
					StatusDescription: "Cancelado",
					MonthlyValue:      fee,
					GrossValue:        fee,
					SignDate:          dateStr,
					StartDate:         dateStr,
					LastOperationDate: dateStr,
					Seller:            "Operacional",
					City:              city,
					State:             "PA",
					Group:             "Fibra Residencial",
					Technology:        "Fibra Óptica GPON",
					CancelReason:      reason,
					SalesChannel:      "Cancelamento RBX",
				})
			}
		}
	}

	// Inclui contratos gerados via CreateAssistedContract
	crmDataMu.RLock()
	for _, mc := range MockContracts {
		if strings.HasPrefix(mc.Number, "CTR-") {
			results = append(results, mc)
		}
	}
	crmDataMu.RUnlock()

	return results, nil
}

// FormatLocalDate formata YYYY-MM-DD
func FormatLocalDate(t time.Time) string {
	return t.Format("2006-01-02")
}

// ResolveDateRange resolve o intervalo com base no filtro
func ResolveDateRange(f CommercialFilter) (startDate, endDate time.Time, periodType, label string) {
	now := time.Now()
	p := strings.ToLower(strings.TrimSpace(f.Period))
	if p == "" {
		if f.StartDate != "" && f.EndDate != "" {
			p = "custom"
		} else {
			p = "30d"
		}
	}
	periodType = p

	switch periodType {
	case "today":
		startDate = time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
		endDate = time.Date(now.Year(), now.Month(), now.Day(), 23, 59, 59, 999999999, now.Location())
		label = "Hoje"

	case "7d":
		s := now.AddDate(0, 0, -6)
		startDate = time.Date(s.Year(), s.Month(), s.Day(), 0, 0, 0, 0, now.Location())
		endDate = time.Date(now.Year(), now.Month(), now.Day(), 23, 59, 59, 999999999, now.Location())
		label = "Últimos 7 Dias"

	case "30d":
		s := now.AddDate(0, 0, -29)
		startDate = time.Date(s.Year(), s.Month(), s.Day(), 0, 0, 0, 0, now.Location())
		endDate = time.Date(now.Year(), now.Month(), now.Day(), 23, 59, 59, 999999999, now.Location())
		label = "Últimos 30 Dias"

	case "month":
		curY, curM, _ := now.Date()
		startDate = time.Date(curY, curM, 1, 0, 0, 0, 0, now.Location())
		// Último dia do mês
		nextM := time.Date(curY, curM+1, 1, 0, 0, 0, 0, now.Location())
		endDate = nextM.Add(-time.Nanosecond)
		label = "Mês Atual"

	case "year":
		curY := now.Year()
		startDate = time.Date(curY, 1, 1, 0, 0, 0, 0, now.Location())
		endDate = time.Date(curY, 12, 31, 23, 59, 59, 999999999, now.Location())
		label = "Ano Corrente"

	case "custom":
		if s, ok := ParseDateSafe(f.StartDate); ok {
			startDate = time.Date(s.Year(), s.Month(), s.Day(), 0, 0, 0, 0, now.Location())
		} else {
			startDate = now.AddDate(0, 0, -30)
		}
		if e, ok := ParseDateSafe(f.EndDate); ok {
			endDate = time.Date(e.Year(), e.Month(), e.Day(), 23, 59, 59, 999999999, now.Location())
		} else {
			endDate = now
		}
		label = fmt.Sprintf("Personalizado (%s a %s)", startDate.Format("02/01/2006"), endDate.Format("02/01/2006"))

	default:
		s := now.AddDate(0, 0, -29)
		startDate = time.Date(s.Year(), s.Month(), s.Day(), 0, 0, 0, 0, now.Location())
		endDate = time.Date(now.Year(), now.Month(), now.Day(), 23, 59, 59, 999999999, now.Location())
		periodType = "30d"
		label = "Últimos 30 Dias"
	}

	return
}

func resolveSellerType(seller string, userStatusMap map[string]string) SellerType {
	s := strings.ToLower(strings.TrimSpace(seller))
	if s == "" || s == "não atribuído" || s == "nao atribuido" || s == "sem vendedor" || s == "-" || strings.Contains(s, "não atribu") || strings.Contains(s, "nao atribu") {
		return SellerTypeUnassigned
	}
	if sit, ok := userStatusMap[s]; ok {
		if strings.ToUpper(sit) == "A" {
			return SellerTypeActive
		}
		return SellerTypeInactive
	}
	return SellerTypeThirdParty
}

// ---------------------------------------------------------------------
// 1. Carteira de Leads
// ---------------------------------------------------------------------

// GetLeads lista e pagina leads aplicando filtros defensivos
func GetLeads(ctx context.Context, f GetLeadsFilter, clients ...*rbx.Client) (*GetLeadsResult, error) {
	crmDataMu.RLock()
	defer crmDataMu.RUnlock()

	var client *rbx.Client
	if len(clients) > 0 {
		client = clients[0]
	}
	sourceLeads := fetchLeads(ctx, client)

	filtered := make([]LeadDto, 0)
	now := time.Now()

	for _, lead := range sourceLeads {
		// Enriquecimento de aging e próximo contato
		if lead.NextActionAt != nil && *lead.NextActionAt != "" {
			if t, ok := ParseDateSafe(*lead.NextActionAt); ok {
				lead.IsNextActionOverdue = t.Before(now)
			}
		} else {
			lead.IsNextActionOverdue = false
		}

		// Filtro por etapa
		if f.Stage != "" && f.Stage != "all" && string(lead.Stage) != f.Stage {
			continue
		}

		// Filtro por responsável
		if f.Owner != "" && f.Owner != "all" {
			if !strings.Contains(strings.ToLower(lead.Owner), strings.ToLower(f.Owner)) {
				continue
			}
		}

		// Filtro por origem
		if f.Source != "" && f.Source != "all" {
			if !strings.Contains(strings.ToLower(lead.Source), strings.ToLower(f.Source)) {
				continue
			}
		}

		// Filtro próximos contatos vencidos
		if f.OverdueOnly && !lead.IsNextActionOverdue {
			continue
		}

		// Filtro sem próximo contato
		if f.NoNextContactOnly {
			if lead.NextActionAt != nil && *lead.NextActionAt != "" {
				continue
			}
			if lead.Stage == LeadStageWon || lead.Stage == LeadStageLost {
				continue
			}
		}

		// Busca textual
		if f.Search != "" {
			term := strings.ToLower(strings.TrimSpace(f.Search))
			if !strings.Contains(strings.ToLower(lead.Name), term) &&
				!strings.Contains(strings.ToLower(lead.City), term) &&
				!strings.Contains(lead.Code, term) &&
				!strings.Contains(lead.Phone, term) {
				continue
			}
		}

		// Filtro de período de entrada (inclusão)
		if f.Period != "" || (f.StartDate != "" && f.EndDate != "") {
			cFilter := CommercialFilter{
				Period:    f.Period,
				StartDate: f.StartDate,
				EndDate:   f.EndDate,
			}
			start, end, _, _ := ResolveDateRange(cFilter)
			if !isLeadInDateRange(lead.CreatedAt, start, end) {
				continue
			}
		}

		filtered = append(filtered, lead)
	}

	// Ordenação: Leads com ações vencidas primeiro, depois por data de atualização mais recente
	sort.Slice(filtered, func(i, j int) bool {
		a := filtered[i]
		b := filtered[j]
		if a.IsNextActionOverdue && !b.IsNextActionOverdue {
			return true
		}
		if !a.IsNextActionOverdue && b.IsNextActionOverdue {
			return false
		}
		tA, _ := ParseDateSafe(a.StageUpdatedAt)
		tB, _ := ParseDateSafe(b.StageUpdatedAt)
		if tA != nil && tB != nil {
			return tA.After(*tB)
		}
		return a.ID > b.ID
	})

	total := len(filtered)
	page := f.Page
	if page < 1 {
		page = 1
	}
	limit := f.Limit
	if limit < 1 || limit > 100 {
		limit = 25
	}
	totalPages := int(math.Ceil(float64(total) / float64(limit)))
	if totalPages < 1 {
		totalPages = 1
	}

	startIdx := (page - 1) * limit
	if startIdx > total {
		startIdx = total
	}
	endIdx := startIdx + limit
	if endIdx > total {
		endIdx = total
	}

	paged := filtered[startIdx:endIdx]
	if paged == nil {
		paged = make([]LeadDto, 0)
	}

	return &GetLeadsResult{
		Leads:      paged,
		Total:      total,
		Page:       page,
		TotalPages: totalPages,
	}, nil
}

// GetLeadById retorna os detalhes de um lead por ID
func GetLeadById(ctx context.Context, id int, clients ...*rbx.Client) (*LeadDetailResult, error) {
	crmDataMu.RLock()
	defer crmDataMu.RUnlock()

	var client *rbx.Client
	if len(clients) > 0 {
		client = clients[0]
	}
	sourceLeads := fetchLeads(ctx, client)

	for _, lead := range sourceLeads {
		if lead.ID == id {
			contacts := make([]LeadContactDto, 0)
			for _, c := range MockContacts {
				if c.LeadID == id {
					contacts = append(contacts, c)
				}
			}

			acts := make([]CommercialActivityDto, 0)
			for _, a := range MockCommercialActivities {
				if a.ClientType == "M" && a.TargetID == id {
					acts = append(acts, a)
				}
			}

			lead.ContactsCount = len(contacts)
			lead.OpenActivitiesCount = 0
			for _, a := range acts {
				if a.Status != "Concluído" && a.Status != "Cancelado" {
					lead.OpenActivitiesCount++
				}
			}

			return &LeadDetailResult{
				Lead:       lead,
				Contacts:   contacts,
				Activities: acts,
			}, nil
		}
	}

	return nil, nil
}

// CreateLead cadastra um novo lead e registra trilha de auditoria LGPD
func CreateLead(ctx context.Context, input CreateLeadInput, user UserContext) (*LeadDto, error) {
	crmDataMu.Lock()
	defer crmDataMu.Unlock()

	newID := 800 + len(MockMarkets) + 1
	nowStr := time.Now().Format("2006-01-02 15:04:05")

	stage := input.Stage
	if stage == "" {
		stage = LeadStageNew
	}
	source := input.Source
	if source == "" {
		source = "Direto / Prospecção"
	}
	owner := input.Owner
	if owner == "" {
		owner = user.Username
	}

	lead := LeadDto{
		ID:             newID,
		Code:           strconv.Itoa(newID),
		Name:           input.Name,
		PersonType:     input.PersonType,
		CpfCnpj:        input.CpfCnpj,
		Email:          input.Email,
		Phone:          input.Phone,
		City:           input.City,
		State:          input.State,
		Neighborhood:   input.Neighborhood,
		Address:        input.Address,
		AddressNumber:  input.AddressNumber,
		Complement:     input.Complement,
		ZipCode:        input.ZipCode,
		CreatedAt:      nowStr,
		CreatedByUser:  user.Username,
		Status:         "Ativo",
		Group:          "Comercial PME",
		Stage:          stage,
		Source:         source,
		Owner:          owner,
		NextActionAt:   input.NextActionAt,
		StageUpdatedAt: nowStr,
		EstimatedValue: input.EstimatedValue,
	}

	if input.NextActionAt != nil && *input.NextActionAt != "" {
		if t, ok := ParseDateSafe(*input.NextActionAt); ok {
			lead.IsNextActionOverdue = t.Before(time.Now())
		}
	}

	MockMarkets = append([]LeadDto{lead}, MockMarkets...)

	if input.ContactName != "" {
		cID := len(MockContacts) + 1
		MockContacts = append(MockContacts, LeadContactDto{
			ID:       cID,
			LeadID:   newID,
			Name:     input.ContactName,
			Phone:    input.ContactPhone,
			Email:    input.ContactEmail,
			Role:     input.ContactRole,
			Type:     "Principal",
			IsActive: true,
		})
		lead.ContactsCount = 1
	}

	// Auditoria LGPD-compliant (sem dados pessoais no log)
	audit.Log(audit.Entry{
		Username: user.Username,
		UserRole: user.Role,
		Action:   "sales:lead_create",
		Module:   "sales",
		RecordID: strconv.Itoa(newID),
		Details: map[string]interface{}{
			"stage":  stage,
			"source": source,
			"owner":  owner,
		},
	})

	return &lead, nil
}

// UpdateLead atualiza informações e etapa de lead com auditoria da transição
func UpdateLead(ctx context.Context, id int, input UpdateLeadInput, user UserContext) (*LeadDto, error) {
	crmDataMu.Lock()
	defer crmDataMu.Unlock()

	for idx, lead := range MockMarkets {
		if lead.ID == id {
			oldStage := lead.Stage

			if input.Name != "" {
				lead.Name = input.Name
			}
			if input.Phone != "" {
				lead.Phone = input.Phone
			}
			if input.Email != "" {
				lead.Email = input.Email
			}
			if input.City != "" {
				lead.City = input.City
			}
			if input.Stage != "" {
				lead.Stage = input.Stage
				lead.StageUpdatedAt = time.Now().Format("2006-01-02 15:04:05")
			}
			if input.Owner != "" {
				lead.Owner = input.Owner
			}
			if input.NextActionAt != nil {
				lead.NextActionAt = input.NextActionAt
				if *input.NextActionAt != "" {
					if t, ok := ParseDateSafe(*input.NextActionAt); ok {
						lead.IsNextActionOverdue = t.Before(time.Now())
					}
				} else {
					lead.IsNextActionOverdue = false
				}
			}
			if input.LossReason != "" {
				lead.LossReason = input.LossReason
			}
			if input.EstimatedValue > 0 {
				lead.EstimatedValue = input.EstimatedValue
			}

			MockMarkets[idx] = lead

			action := "sales:lead_edit"
			if input.Stage != "" && input.Stage != oldStage {
				action = "sales:lead_stage_transition"
			}

			audit.Log(audit.Entry{
				Username: user.Username,
				UserRole: user.Role,
				Action:   action,
				Module:   "sales",
				RecordID: strconv.Itoa(id),
				Details: map[string]interface{}{
					"previousStage": oldStage,
					"newStage":      lead.Stage,
					"owner":         lead.Owner,
					"hasLossReason": lead.LossReason != "",
				},
			})

			return &lead, nil
		}
	}

	return nil, fmt.Errorf("lead não encontrado")
}

// GetCommercialTopics retorna os tópicos comerciais disponíveis
func GetCommercialTopics(ctx context.Context) ([]CommercialTopicDto, error) {
	crmDataMu.RLock()
	defer crmDataMu.RUnlock()

	res := make([]CommercialTopicDto, len(MockCommercialTopics))
	copy(res, MockCommercialTopics)
	return res, nil
}

// CreateLeadActivity abre atendimento comercial no RBX
func CreateLeadActivity(ctx context.Context, leadId int, input CreateCommercialActivityInput, user UserContext) (*CommercialActivityDto, error) {
	crmDataMu.Lock()
	defer crmDataMu.Unlock()

	var leadName string
	for _, m := range MockMarkets {
		if m.ID == leadId {
			leadName = m.Name
			break
		}
	}

	actID := 9100 + len(MockCommercialActivities) + 1
	proto := fmt.Sprintf("%s-%04d", time.Now().Format("20060102"), actID)
	nowStr := time.Now().Format("2006-01-02 15:04:05")

	resp := input.Responsible
	if resp == "" {
		resp = user.Username
	}

	topicName := "Atendimento Comercial"
	for _, t := range MockCommercialTopics {
		if t.ID == input.TopicID {
			topicName = t.Name
			break
		}
	}

	act := CommercialActivityDto{
		ID:          actID,
		Protocol:    proto,
		ClientType:  "M",
		TargetID:    leadId,
		TargetName:  leadName,
		TopicID:     input.TopicID,
		TopicName:   topicName,
		Responsible: resp,
		Status:      "Aberto",
		CreatedAt:   nowStr,
		Description: input.Description,
		Occurrences: []CommercialOccurrenceDto{
			{
				ID:        1,
				CreatedAt: nowStr,
				Author:    user.Username,
				Text:      "Abertura de atendimento comercial: " + input.Description,
			},
		},
	}

	MockCommercialActivities = append([]CommercialActivityDto{act}, MockCommercialActivities...)

	audit.Log(audit.Entry{
		Username: user.Username,
		UserRole: user.Role,
		Action:   "sales:activity_create",
		Module:   "sales",
		RecordID: strconv.Itoa(actID),
		Details: map[string]interface{}{
			"leadId":  leadId,
			"topicId": input.TopicID,
		},
	})

	return &act, nil
}

// AddActivityOccurrence adiciona histórico ao chamado comercial
func AddActivityOccurrence(ctx context.Context, ticketId int, text string, user UserContext) error {
	crmDataMu.Lock()
	defer crmDataMu.Unlock()

	for idx, a := range MockCommercialActivities {
		if a.ID == ticketId {
			occID := len(a.Occurrences) + 1
			a.Occurrences = append(a.Occurrences, CommercialOccurrenceDto{
				ID:        occID,
				CreatedAt: time.Now().Format("2006-01-02 15:04:05"),
				Author:    user.Username,
				Text:      text,
			})
			MockCommercialActivities[idx] = a

			audit.Log(audit.Entry{
				Username: user.Username,
				UserRole: user.Role,
				Action:   "sales:occurrence_create",
				Module:   "sales",
				RecordID: strconv.Itoa(ticketId),
				Details:  map[string]interface{}{"occurrenceId": occID},
			})
			return nil
		}
	}
	return fmt.Errorf("atendimento comercial não encontrado")
}

// FinishActivity encerra atendimento comercial
func FinishActivity(ctx context.Context, ticketId int, user UserContext) error {
	crmDataMu.Lock()
	defer crmDataMu.Unlock()

	for idx, a := range MockCommercialActivities {
		if a.ID == ticketId {
			a.Status = "Concluído"
			nowStr := time.Now().Format("2006-01-02 15:04:05")
			a.ClosedAt = &nowStr
			MockCommercialActivities[idx] = a

			audit.Log(audit.Entry{
				Username: user.Username,
				UserRole: user.Role,
				Action:   "sales:activity_finish",
				Module:   "sales",
				RecordID: strconv.Itoa(ticketId),
			})
			return nil
		}
	}
	return fmt.Errorf("atendimento comercial não encontrado")
}

// CreateAssistedContract vincula CRM_ORIGIN_PROSPECT_ID e move lead para won
func CreateAssistedContract(ctx context.Context, input CreateAssistedContractInput, user UserContext) (*AssistedContractResult, error) {
	if input.OriginProspectId <= 0 {
		return nil, fmt.Errorf("o ID do prospect de origem é obrigatório para registrar a conversão de venda")
	}

	crmDataMu.Lock()
	defer crmDataMu.Unlock()

	ctrNum := strings.TrimSpace(input.ContractNumber)
	if ctrNum == "" {
		ctrNum = fmt.Sprintf("CTR-%d", 88100+len(MockContracts)+1)
	}

	today := time.Now().Format("2006-01-02")
	seller := input.SellerName
	if seller == "" {
		seller = user.Username
	}

	newContract := SalesContractDto{
		Number:            ctrNum,
		ClientID:          input.CustomerId,
		ClientName:        input.CustomerName,
		PlanCode:          input.PlanCode,
		PlanDescription:   input.PlanDescription,
		StatusCode:        "A",
		StatusDescription: "Ativo",
		MonthlyValue:      input.MonthlyValue,
		GrossValue:        input.GrossValue,
		AdhesionValue:     input.AdhesionValue,
		SignDate:          today,
		StartDate:         today,
		Seller:            seller,
		City:              input.City,
		State:             input.State,
		Group:             input.Group,
		Technology:        input.Technology,
		OriginProspectId:  input.OriginProspectId,
		SalesChannel:      input.SalesChannel,
	}
	if newContract.GrossValue <= 0 {
		newContract.GrossValue = input.MonthlyValue
	}
	if newContract.City == "" {
		newContract.City = "São Paulo"
	}
	if newContract.State == "" {
		newContract.State = "SP"
	}
	if newContract.Group == "" {
		newContract.Group = "Residencial"
	}
	if newContract.Technology == "" {
		newContract.Technology = "Fibra Óptica GPON"
	}

	MockContracts = append([]SalesContractDto{newContract}, MockContracts...)

	// Marca o lead como WON
	for idx, m := range MockMarkets {
		if m.ID == input.OriginProspectId {
			m.Stage = LeadStageWon
			m.ConvertedContractID = ctrNum
			m.StageUpdatedAt = time.Now().Format("2006-01-02 15:04:05")
			MockMarkets[idx] = m
			break
		}
	}

	audit.Log(audit.Entry{
		Username: user.Username,
		UserRole: user.Role,
		Action:   "sales:contract_create",
		Module:   "sales",
		RecordID: ctrNum,
		Details: map[string]interface{}{
			"originProspectId": input.OriginProspectId,
			"seller":           seller,
			"planCode":         input.PlanCode,
		},
	})

	return &AssistedContractResult{
		ContractNumber:   ctrNum,
		OriginProspectId: input.OriginProspectId,
	}, nil
}

// ---------------------------------------------------------------------
// 2. Painel Comercial (Insights & Rankings)
// ---------------------------------------------------------------------

// GetCommercialDashboard computa os 8 cards, série diária, mensal, rankings e funil
func GetCommercialDashboard(ctx context.Context, f CommercialFilter, args ...any) (*CommercialDashboardDto, error) {
	crmDataMu.RLock()
	defer crmDataMu.RUnlock()

	var client *rbx.Client
	var dbPool *pgxpool.Pool
	for _, arg := range args {
		switch v := arg.(type) {
		case *rbx.Client:
			client = v
		case *pgxpool.Pool:
			dbPool = v
		}
	}

	startDate, endDate, periodType, label := ResolveDateRange(f)

	// Mapa de status de usuários
	userStatusMap := make(map[string]string)
	for _, u := range MockUsers {
		userStatusMap[strings.ToLower(u.Username)] = u.Status
		userStatusMap[strings.ToLower(u.Name)] = u.Status
	}

	// Carrega contratos da base RBX (ou fallback se sem banco)
	rawContracts, _ := fetchContractsFromDB(ctx, dbPool)

	// Filtra contratos válidos de GPON
	var rawAllContracts []SalesContractDto
	for _, c := range rawContracts {
		if IsFibraOpticaGpon(c.Technology) {
			rawAllContracts = append(rawAllContracts, c)
		}
	}

	// Mapeamento global de classificação de vendedores
	sellersClassification := make(map[string]SellerType)
	sellerStatsMap := make(map[string]*struct{ count int; value float64 })

	for _, c := range rawAllContracts {
		s := strings.TrimSpace(c.Seller)
		if s == "" {
			s = "Não atribuído"
		}
		if _, ok := sellerStatsMap[s]; !ok {
			sellerStatsMap[s] = &struct{ count int; value float64 }{count: 0, value: 0}
		}
		sellerStatsMap[s].count++
		sellerStatsMap[s].value += c.MonthlyValue

		if _, ok := sellersClassification[s]; !ok {
			sellersClassification[s] = resolveSellerType(s, userStatusMap)
		}
	}

	var allAvailableSellers []struct {
		Name       string     `json:"name"`
		Count      int        `json:"count"`
		Value      float64    `json:"value"`
		SellerType SellerType `json:"sellerType"`
	}
	for name, stat := range sellerStatsMap {
		allAvailableSellers = append(allAvailableSellers, struct {
			Name       string     `json:"name"`
			Count      int        `json:"count"`
			Value      float64    `json:"value"`
			SellerType SellerType `json:"sellerType"`
		}{
			Name:       name,
			Count:      stat.count,
			Value:      stat.value,
			SellerType: sellersClassification[name],
		})
	}
	sort.Slice(allAvailableSellers, func(i, j int) bool {
		return allAvailableSellers[i].Count > allAvailableSellers[j].Count
	})

	allContracts := make([]SalesContractDto, len(rawAllContracts))
	copy(allContracts, rawAllContracts)

	cancellationContracts := make([]SalesContractDto, len(rawAllContracts))
	copy(cancellationContracts, rawAllContracts)

	sourceLeads := fetchLeads(ctx, client)
	allLeads := make([]LeadDto, len(sourceLeads))
	copy(allLeads, sourceLeads)

	// Filtros de colaboradores
	if f.HideInactiveSellers {
		filteredC := allContracts[:0]
		for _, c := range allContracts {
			if resolveSellerType(c.Seller, userStatusMap) != SellerTypeInactive {
				filteredC = append(filteredC, c)
			}
		}
		allContracts = filteredC

		filteredL := allLeads[:0]
		for _, l := range allLeads {
			if resolveSellerType(l.Owner, userStatusMap) != SellerTypeInactive {
				filteredL = append(filteredL, l)
			}
		}
		allLeads = filteredL
	}

	if f.HideThirdPartySellers {
		filteredC := allContracts[:0]
		for _, c := range allContracts {
			if resolveSellerType(c.Seller, userStatusMap) != SellerTypeThirdParty {
				filteredC = append(filteredC, c)
			}
		}
		allContracts = filteredC

		filteredL := allLeads[:0]
		for _, l := range allLeads {
			if resolveSellerType(l.Owner, userStatusMap) != SellerTypeThirdParty {
				filteredL = append(filteredL, l)
			}
		}
		allLeads = filteredL
	}

	if f.HideUnassignedSellers {
		filteredC := allContracts[:0]
		for _, c := range allContracts {
			if resolveSellerType(c.Seller, userStatusMap) != SellerTypeUnassigned {
				filteredC = append(filteredC, c)
			}
		}
		allContracts = filteredC

		filteredL := allLeads[:0]
		for _, l := range allLeads {
			if resolveSellerType(l.Owner, userStatusMap) != SellerTypeUnassigned {
				filteredL = append(filteredL, l)
			}
		}
		allLeads = filteredL
	}

	// Filtros de vendedores específicos
	var targetSellers []string
	if len(f.Sellers) > 0 {
		for _, s := range f.Sellers {
			for _, part := range strings.Split(s, ",") {
				p := strings.ToLower(strings.TrimSpace(part))
				if p != "" && p != "all" {
					targetSellers = append(targetSellers, p)
				}
			}
		}
	} else if f.Seller != "" && f.Seller != "all" {
		for _, part := range strings.Split(f.Seller, ",") {
			p := strings.ToLower(strings.TrimSpace(part))
			if p != "" && p != "all" {
				targetSellers = append(targetSellers, p)
			}
		}
	}
	if len(targetSellers) > 0 {
		filteredC := allContracts[:0]
		for _, c := range allContracts {
			s := strings.ToLower(c.Seller)
			matched := false
			for _, ts := range targetSellers {
				if s == ts {
					matched = true
					break
				}
			}
			if matched {
				filteredC = append(filteredC, c)
			}
		}
		allContracts = filteredC

		filteredL := allLeads[:0]
		for _, l := range allLeads {
			o := strings.ToLower(l.Owner)
			matched := false
			for _, ts := range targetSellers {
				if o == ts {
					matched = true
					break
				}
			}
			if matched {
				filteredL = append(filteredL, l)
			}
		}
		allLeads = filteredL
	}

	// Filtro de Cidade
	if f.City != "" && f.City != "all" {
		targetCity := strings.ToLower(f.City)
		filteredC := allContracts[:0]
		for _, c := range allContracts {
			if strings.ToLower(c.City) == targetCity {
				filteredC = append(filteredC, c)
			}
		}
		allContracts = filteredC

		filteredCanc := cancellationContracts[:0]
		for _, c := range cancellationContracts {
			if strings.ToLower(c.City) == targetCity {
				filteredCanc = append(filteredCanc, c)
			}
		}
		cancellationContracts = filteredCanc
	}

	// Filtro de Região
	if f.Region != "" && f.Region != "all" {
		targetReg := strings.ToLower(f.Region)
		filteredC := allContracts[:0]
		for _, c := range allContracts {
			if strings.ToLower(c.Group) == targetReg || strings.ToLower(c.City) == targetReg {
				filteredC = append(filteredC, c)
			}
		}
		allContracts = filteredC

		filteredCanc := cancellationContracts[:0]
		for _, c := range cancellationContracts {
			if strings.ToLower(c.Group) == targetReg || strings.ToLower(c.City) == targetReg {
				filteredCanc = append(filteredCanc, c)
			}
		}
		cancellationContracts = filteredCanc
	}

	// Filtro de Grupo de Clientes
	if f.Group != "" && f.Group != "all" {
		targetG := strings.ToLower(f.Group)
		filteredC := allContracts[:0]
		for _, c := range allContracts {
			if strings.ToLower(c.Group) == targetG {
				filteredC = append(filteredC, c)
			}
		}
		allContracts = filteredC

		filteredCanc := cancellationContracts[:0]
		for _, c := range cancellationContracts {
			if strings.ToLower(c.Group) == targetG {
				filteredCanc = append(filteredCanc, c)
			}
		}
		cancellationContracts = filteredCanc

		filteredL := allLeads[:0]
		for _, l := range allLeads {
			if l.Group == "" || strings.ToLower(l.Group) == targetG {
				filteredL = append(filteredL, l)
			}
		}
		allLeads = filteredL
	}

	// 1. Novos Leads no Período (baseado na data oficial de cadastro/inclusão do lead 'Inclusao')
	var periodLeads []LeadDto
	if periodType == "year" {
		now := time.Now()
		mStart := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())
		mEnd := time.Date(now.Year(), now.Month()+1, 0, 23, 59, 59, 999999999, now.Location())
		for _, l := range allLeads {
			if isLeadInDateRange(l.CreatedAt, mStart, mEnd) {
				periodLeads = append(periodLeads, l)
			}
		}
	} else {
		for _, l := range allLeads {
			if isLeadInDateRange(l.CreatedAt, startDate, endDate) {
				periodLeads = append(periodLeads, l)
			}
		}
	}
	newLeadsCount := len(periodLeads)

	// Cálculo da variação percentual de Novos Leads frente ao período anterior
	var prevStartDate, prevEndDate time.Time
	switch periodType {
	case "today":
		prevStartDate = startDate.AddDate(0, 0, -1)
		prevEndDate = endDate.AddDate(0, 0, -1)
	case "7d":
		prevStartDate = startDate.AddDate(0, 0, -7)
		prevEndDate = startDate.Add(-time.Nanosecond)
	case "30d":
		prevStartDate = startDate.AddDate(0, 0, -30)
		prevEndDate = startDate.Add(-time.Nanosecond)
	case "month":
		prevStartDate = startDate.AddDate(0, -1, 0)
		prevEndDate = startDate.Add(-time.Nanosecond)
	case "year":
		prevStartDate = startDate.AddDate(-1, 0, 0)
		prevEndDate = startDate.Add(-time.Nanosecond)
	default:
		dur := endDate.Sub(startDate)
		prevEndDate = startDate.Add(-time.Nanosecond)
		prevStartDate = prevEndDate.Add(-dur)
	}

	prevLeadsCount := 0
	for _, l := range allLeads {
		if isLeadInDateRange(l.CreatedAt, prevStartDate, prevEndDate) {
			prevLeadsCount++
		}
	}

	newLeadsDiffPercent := 0.0
	if prevLeadsCount > 0 {
		newLeadsDiffPercent = math.Round(((float64(newLeadsCount)-float64(prevLeadsCount))/float64(prevLeadsCount)*100)*10) / 10
	} else if newLeadsCount > 0 {
		newLeadsDiffPercent = 100.0
	}

	// 2. Leads por Etapa (Snapshot Atual)
	leadsByStage := map[LeadStage]int{
		LeadStageNew:         0,
		LeadStageQualified:   0,
		LeadStageProposal:    0,
		LeadStageNegotiation: 0,
		LeadStageWon:         0,
		LeadStageLost:        0,
	}
	for _, l := range allLeads {
		leadsByStage[l.Stage]++
	}

	// 3. Leads sem próximo contato
	nowTime := time.Now()
	leadsWithoutNextContactCount := 0
	for _, l := range allLeads {
		if l.Stage == LeadStageWon || l.Stage == LeadStageLost {
			continue
		}
		if l.NextActionAt == nil || *l.NextActionAt == "" {
			leadsWithoutNextContactCount++
		} else if t, ok := ParseDateSafe(*l.NextActionAt); ok && t.Before(nowTime) {
			leadsWithoutNextContactCount++
		}
	}

	// 4. Atividades comerciais abertas
	openActivitiesCount := 0
	for _, a := range MockCommercialActivities {
		if a.Status != "Concluído" && a.Status != "Cancelado" {
			openActivitiesCount++
		}
	}

	// 5. Contratos Confirmados no Período (Assinatura, A ou E, receita mensal > 0)
	var rawPeriodContracts []SalesContractDto
	for _, c := range allContracts {
		if c.StatusCode != "A" && c.StatusCode != "E" {
			continue
		}
		if c.SignDate == "" || c.MonthlyValue <= 0 {
			continue
		}
		if t, ok := ParseDateSafe(c.SignDate); ok {
			if !t.Before(startDate) && !t.After(endDate) {
				rawPeriodContracts = append(rawPeriodContracts, c)
			}
		}
	}

	// Mapeamento de planos e grupos disponíveis no período
	allPlansMap := make(map[string]*struct{ count int; value float64 })
	allGroupsSet := make(map[string]bool)
	for _, c := range rawPeriodContracts {
		pName := c.PlanDescription
		if pName == "" {
			pName = "Plano Padrão"
		}
		if _, ok := allPlansMap[pName]; !ok {
			allPlansMap[pName] = &struct{ count int; value float64 }{count: 0, value: 0}
		}
		allPlansMap[pName].count++
		allPlansMap[pName].value += c.MonthlyValue

		if c.Group != "" {
			allGroupsSet[c.Group] = true
		}
	}

	var allAvailablePlans []struct {
		Name  string  `json:"name"`
		Count int     `json:"count"`
		Value float64 `json:"value"`
	}
	for name, stat := range allPlansMap {
		allAvailablePlans = append(allAvailablePlans, struct {
			Name  string  `json:"name"`
			Count int     `json:"count"`
			Value float64 `json:"value"`
		}{Name: name, Count: stat.count, Value: stat.value})
	}
	sort.Slice(allAvailablePlans, func(i, j int) bool {
		return allAvailablePlans[i].Count > allAvailablePlans[j].Count
	})

	var allAvailableGroups []string
	for g := range allGroupsSet {
		allAvailableGroups = append(allAvailableGroups, g)
	}
	sort.Strings(allAvailableGroups)

	// Filtragem de planos
	var confirmedContracts []SalesContractDto
	for _, c := range rawPeriodContracts {
		pName := strings.ToLower(c.PlanDescription)
		if len(f.ExcludePlans) > 0 {
			excluded := false
			for _, ep := range f.ExcludePlans {
				for _, part := range strings.Split(ep, ",") {
					if strings.ToLower(strings.TrimSpace(part)) == pName {
						excluded = true
						break
					}
				}
			}
			if excluded {
				continue
			}
		}
		if len(f.Plans) > 0 {
			allowed := false
			for _, ap := range f.Plans {
				for _, part := range strings.Split(ap, ",") {
					if strings.ToLower(strings.TrimSpace(part)) == pName {
						allowed = true
						break
					}
				}
			}
			if !allowed {
				continue
			}
		}
		confirmedContracts = append(confirmedContracts, c)
	}
	confirmedContractsCount := len(confirmedContracts)

	// 5.1 Vendas Fechadas (Novas vendas elegíveis)
	var closedSalesContracts []SalesContractDto
	for _, c := range confirmedContracts {
		if IsClosedSaleContract(c) {
			closedSalesContracts = append(closedSalesContracts, c)
		}
	}
	closedSalesCount := len(closedSalesContracts)

	// Comparativo com período anterior
	prevConfirmedContractsCount := 0
	prevClosedSalesCount := 0
	for _, c := range allContracts {
		if c.StatusCode != "A" && c.StatusCode != "E" {
			continue
		}
		if c.SignDate == "" || c.MonthlyValue <= 0 {
			continue
		}
		if t, ok := ParseDateSafe(c.SignDate); ok {
			if !t.Before(prevStartDate) && !t.After(prevEndDate) {
				prevConfirmedContractsCount++
				if IsClosedSaleContract(c) {
					prevClosedSalesCount++
				}
			}
		}
	}

	closedSalesDiffPercent := 0.0
	if prevClosedSalesCount > 0 {
		closedSalesDiffPercent = math.Round(((float64(closedSalesCount)-float64(prevClosedSalesCount))/float64(prevClosedSalesCount)*100)*10) / 10
	} else if closedSalesCount > 0 {
		closedSalesDiffPercent = 100.0
	}

	confirmedContractsDiffPercent := 0.0
	if prevConfirmedContractsCount > 0 {
		confirmedContractsDiffPercent = math.Round(((float64(confirmedContractsCount)-float64(prevConfirmedContractsCount))/float64(prevConfirmedContractsCount)*100)*10) / 10
	} else if confirmedContractsCount > 0 {
		confirmedContractsDiffPercent = 100.0
	}

	// 6. Ticket Médio Mensal e Adesão Média
	baseForTickets := closedSalesContracts
	if len(baseForTickets) == 0 {
		baseForTickets = confirmedContracts
	}

	totalMonthlyValue := 0.0
	totalAdhesionValue := 0.0
	countMonthly := 0
	countAdhesion := 0
	for _, c := range baseForTickets {
		if c.MonthlyValue > 0 {
			totalMonthlyValue += c.MonthlyValue
			countMonthly++
		}
		if c.AdhesionValue > 0 {
			totalAdhesionValue += c.AdhesionValue
			countAdhesion++
		}
	}

	averageTicketMonthly := 0.0
	if countMonthly > 0 {
		averageTicketMonthly = math.Round((totalMonthlyValue/float64(countMonthly))*100) / 100
	}
	averageAdhesionValue := 0.0
	if countAdhesion > 0 {
		averageAdhesionValue = math.Round((totalAdhesionValue/float64(countAdhesion))*100) / 100
	}

	// 7. Cancelamentos no Período (C, mensalidade > 0, LastOperationDate/StartDate no período)
	allReasonsMap := make(map[string]int)
	var periodCancellations []SalesContractDto
	for _, c := range cancellationContracts {
		if c.StatusCode != "C" || c.MonthlyValue <= 0 {
			continue
		}
		opDate := c.LastOperationDate
		if opDate == "" {
			opDate = c.StartDate
		}
		if opDate == "" {
			continue
		}

		if t, ok := ParseDateSafe(opDate); ok {
			if !t.Before(startDate) && !t.After(endDate) {
				reason := c.CancelReason
				if reason == "" {
					reason = "Não informado"
				}
				allReasonsMap[reason]++

				if len(f.ExcludeReasons) > 0 {
					excluded := false
					for _, er := range f.ExcludeReasons {
						for _, part := range strings.Split(er, ",") {
							if strings.EqualFold(strings.TrimSpace(part), reason) {
								excluded = true
								break
							}
						}
					}
					if excluded {
						continue
					}
				}

				if len(f.Reasons) > 0 {
					allowed := false
					for _, ar := range f.Reasons {
						for _, part := range strings.Split(ar, ",") {
							if strings.EqualFold(strings.TrimSpace(part), reason) {
								allowed = true
								break
							}
						}
					}
					if !allowed {
						continue
					}
				}

				periodCancellations = append(periodCancellations, c)
			}
		}
	}

	var allAvailableReasons []struct {
		Reason string `json:"reason"`
		Count  int    `json:"count"`
	}
	for r, cnt := range allReasonsMap {
		allAvailableReasons = append(allAvailableReasons, struct {
			Reason string `json:"reason"`
			Count  int    `json:"count"`
		}{Reason: r, Count: cnt})
	}
	sort.Slice(allAvailableReasons, func(i, j int) bool {
		return allAvailableReasons[i].Count > allAvailableReasons[j].Count
	})

	cancellationsCount := len(periodCancellations)
	netAdditions := closedSalesCount - cancellationsCount
	churnRatioPercent := 0.0
	if closedSalesCount > 0 {
		churnRatioPercent = math.Round((float64(cancellationsCount)/float64(closedSalesCount))*1000) / 10
	}

	// 8. Conversão Rastreável
	traceableConversionsCount := 0
	for _, c := range confirmedContracts {
		if c.OriginProspectId > 0 {
			traceableConversionsCount++
		}
	}
	conversionRatePercent := 0.0
	if newLeadsCount > 0 {
		conversionRatePercent = math.Round((float64(traceableConversionsCount)/float64(newLeadsCount))*1000) / 10
	}

	// Série Temporal Diária Contínua
	dateMap := make(map[string]*SalesTimeSeriesPoint)
	curD := time.Date(startDate.Year(), startDate.Month(), startDate.Day(), 0, 0, 0, 0, time.UTC)
	stopD := time.Date(endDate.Year(), endDate.Month(), endDate.Day(), 0, 0, 0, 0, time.UTC)

	for !curD.After(stopD) {
		dayStr := curD.Format("2006-01-02")
		dateMap[dayStr] = &SalesTimeSeriesPoint{Date: dayStr}
		curD = curD.AddDate(0, 0, 1)
	}

	for _, l := range periodLeads {
		day := strings.TrimSpace(l.CreatedAt)
		if len(day) >= 10 {
			day = day[:10]
		}
		if pt, ok := dateMap[day]; ok {
			pt.Leads++
		} else if t, ok := ParseDateSafe(l.CreatedAt); ok {
			d := t.Format("2006-01-02")
			if pt, ok := dateMap[d]; ok {
				pt.Leads++
			}
		}
	}
	for _, c := range confirmedContracts {
		if t, ok := ParseDateSafe(c.SignDate); ok {
			day := t.Format("2006-01-02")
			if pt, ok := dateMap[day]; ok {
				pt.Contracts++
				if IsClosedSaleContract(c) {
					pt.Sales++
				}
			}
		}
	}
	for _, c := range periodCancellations {
		opDate := c.LastOperationDate
		if opDate == "" {
			opDate = c.StartDate
		}
		if t, ok := ParseDateSafe(opDate); ok {
			day := t.Format("2006-01-02")
			if pt, ok := dateMap[day]; ok {
				pt.Cancellations++
			}
		}
	}

	var timeSeries []SalesTimeSeriesPoint
	curD = time.Date(startDate.Year(), startDate.Month(), startDate.Day(), 0, 0, 0, 0, time.UTC)
	for !curD.After(stopD) {
		dayStr := curD.Format("2006-01-02")
		if pt, ok := dateMap[dayStr]; ok {
			timeSeries = append(timeSeries, *pt)
		}
		curD = curD.AddDate(0, 0, 1)
	}

	// 12 Meses para o filtro 'year'
	var monthlySeries []SalesMonthlyPoint
	monthNamesShort := []string{"Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"}
	monthNamesFull := []string{"Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"}

	if periodType == "year" {
		curYear := startDate.Year()
		for mIdx := 0; mIdx < 12; mIdx++ {
			mStart := time.Date(curYear, time.Month(mIdx+1), 1, 0, 0, 0, 0, time.UTC)
			mEnd := time.Date(curYear, time.Month(mIdx+2), 0, 23, 59, 59, 999999999, time.UTC)
			mStr := fmt.Sprintf("%d-%02d", curYear, mIdx+1)

			mLeads := 0
			for _, l := range allLeads {
				if isLeadInDateRange(l.CreatedAt, mStart, mEnd) {
					mLeads++
				}
			}

			mContracts := 0
			mSales := 0
			mRevenue := 0.0
			mGroupMap := make(map[string]*struct{ count int; val float64 })
			mRegMap := make(map[string]*struct{ count int; val float64 })
			mSellerMap := make(map[string]*struct{ count int; val float64 })
			mPlanMap := make(map[string]*struct{ count int; val float64 })

			for _, c := range allContracts {
				if c.StatusCode != "A" && c.StatusCode != "E" {
					continue
				}
				if t, ok := ParseDateSafe(c.SignDate); ok && !t.Before(mStart) && !t.After(mEnd) {
					mContracts++
					if IsClosedSaleContract(c) {
						mSales++
						mRevenue += c.MonthlyValue

						g := c.Group
						if g == "" {
							g = "Outros"
						}
						if _, ok := mGroupMap[g]; !ok {
							mGroupMap[g] = &struct{ count int; val float64 }{}
						}
						mGroupMap[g].count++
						mGroupMap[g].val += c.MonthlyValue

						reg := c.City
						if reg == "" {
							reg = "Outros"
						}
						if _, ok := mRegMap[reg]; !ok {
							mRegMap[reg] = &struct{ count int; val float64 }{}
						}
						mRegMap[reg].count++
						mRegMap[reg].val += c.MonthlyValue

						s := c.Seller
						if s == "" {
							s = "Não atribuído"
						}
						if _, ok := mSellerMap[s]; !ok {
							mSellerMap[s] = &struct{ count int; val float64 }{}
						}
						mSellerMap[s].count++
						mSellerMap[s].val += c.MonthlyValue

						p := c.PlanDescription
						if p == "" {
							p = "Plano Padrão"
						}
						if _, ok := mPlanMap[p]; !ok {
							mPlanMap[p] = &struct{ count int; val float64 }{}
						}
						mPlanMap[p].count++
						mPlanMap[p].val += c.MonthlyValue
					}
				}
			}

			mCanc := 0
			mCancVal := 0.0
			for _, c := range cancellationContracts {
				if c.StatusCode != "C" {
					continue
				}
				opDate := c.LastOperationDate
				if opDate == "" {
					opDate = c.StartDate
				}
				if t, ok := ParseDateSafe(opDate); ok && !t.Before(mStart) && !t.After(mEnd) {
					mCanc++
					mCancVal += c.MonthlyValue
				}
			}

			mNet := mSales - mCanc
			mAvg := 0.0
			if mSales > 0 {
				mAvg = math.Round((mRevenue/float64(mSales))*100) / 100
			}
			mChurn := 0.0
			if mSales > 0 {
				mChurn = math.Round((float64(mCanc)/float64(mSales))*1000) / 10
			}

			// Sublistas de share
			var grpShares []MonthlyGroupShare
			for g, s := range mGroupMap {
				sh := 0.0
				if mSales > 0 {
					sh = math.Round((float64(s.count)/float64(mSales))*1000) / 10
				}
				grpShares = append(grpShares, MonthlyGroupShare{
					Group:        g,
					Count:        s.count,
					Value:        s.val,
					SharePercent: sh,
				})
			}
			var regShares []MonthlyRegionShare
			for r, s := range mRegMap {
				regShares = append(regShares, MonthlyRegionShare{
					Region: r,
					Count:  s.count,
					Value:  s.val,
				})
			}
			var topS []MonthlyRankingItem
			for name, s := range mSellerMap {
				sh := 0.0
				if mSales > 0 {
					sh = math.Round((float64(s.count)/float64(mSales))*1000) / 10
				}
				topS = append(topS, MonthlyRankingItem{
					Name:         name,
					Count:        s.count,
					Value:        s.val,
					SharePercent: sh,
				})
			}
			var topP []MonthlyRankingItem
			for name, s := range mPlanMap {
				sh := 0.0
				if mSales > 0 {
					sh = math.Round((float64(s.count)/float64(mSales))*1000) / 10
				}
				topP = append(topP, MonthlyRankingItem{
					Name:         name,
					Count:        s.count,
					Value:        s.val,
					SharePercent: sh,
				})
			}

			// MoM Comparison
			var mom *MomComparison
			if mIdx > 0 && len(monthlySeries) == mIdx {
				prev := monthlySeries[mIdx-1]
				var sDiff, rDiff, cDiff *float64
				if prev.Sales > 0 {
					d := math.Round(((float64(mSales-prev.Sales))/float64(prev.Sales))*1000) / 10
					sDiff = &d
				}
				if prev.Revenue > 0 {
					d := math.Round(((mRevenue-prev.Revenue)/prev.Revenue)*1000) / 10
					rDiff = &d
				}
				if prev.Cancellations > 0 {
					d := math.Round(((float64(mCanc-prev.Cancellations))/float64(prev.Cancellations))*1000) / 10
					cDiff = &d
				}
				netD := mNet - prev.NetAdditions
				mom = &MomComparison{
					SalesDiffPercent:         sDiff,
					RevenueDiffPercent:       rDiff,
					CancellationsDiffPercent: cDiff,
					NetDiff:                  &netD,
				}
			} else {
				mom = &MomComparison{}
			}

			monthlySeries = append(monthlySeries, SalesMonthlyPoint{
				Month:              mStr,
				Label:              monthNamesShort[mIdx],
				FullLabel:          fmt.Sprintf("%s / %d", monthNamesFull[mIdx], curYear),
				MonthIndex:         mIdx,
				Year:               curYear,
				Leads:              mLeads,
				Sales:              mSales,
				Contracts:          mContracts,
				Cancellations:      mCanc,
				NetAdditions:       mNet,
				Revenue:            mRevenue,
				AvgTicket:          mAvg,
				CancellationsValue: mCancVal,
				ChurnRatioPercent:  mChurn,
				SalesByGroup:       grpShares,
				SalesByRegion:      regShares,
				TopSellers:         topS,
				TopPlans:           topP,
				MomComparison:      mom,
			})
		}
	}

	// Rankings Gerais do Período
	planRankingMap := make(map[string]*struct{ count int; val float64 })
	sellerRankingMap := make(map[string]*struct{ count int; val float64 })
	groupRankingMap := make(map[string]*struct{ count int; val float64 })
	regionRankingMap := make(map[string]*struct{ count int; val float64 })
	cityRankingMap := make(map[string]*struct{ count int; val float64 })
	techRankingMap := make(map[string]*struct{ count int; val float64 })

	for _, c := range closedSalesContracts {
		p := c.PlanDescription
		if p == "" {
			p = "Plano Padrão"
		}
		if _, ok := planRankingMap[p]; !ok {
			planRankingMap[p] = &struct{ count int; val float64 }{}
		}
		planRankingMap[p].count++
		planRankingMap[p].val += c.MonthlyValue

		s := c.Seller
		if s == "" {
			s = "Não atribuído"
		}
		if _, ok := sellerRankingMap[s]; !ok {
			sellerRankingMap[s] = &struct{ count int; val float64 }{}
		}
		sellerRankingMap[s].count++
		sellerRankingMap[s].val += c.MonthlyValue

		g := c.Group
		if g == "" {
			g = "Outros"
		}
		if _, ok := groupRankingMap[g]; !ok {
			groupRankingMap[g] = &struct{ count int; val float64 }{}
		}
		groupRankingMap[g].count++
		groupRankingMap[g].val += c.MonthlyValue

		r := c.City
		if r == "" {
			r = "Outros"
		}
		if _, ok := regionRankingMap[r]; !ok {
			regionRankingMap[r] = &struct{ count int; val float64 }{}
		}
		regionRankingMap[r].count++
		regionRankingMap[r].val += c.MonthlyValue

		if _, ok := cityRankingMap[r]; !ok {
			cityRankingMap[r] = &struct{ count int; val float64 }{}
		}
		cityRankingMap[r].count++
		cityRankingMap[r].val += c.MonthlyValue

		t := c.Technology
		if t == "" {
			t = "Fibra Óptica GPON"
		}
		if _, ok := techRankingMap[t]; !ok {
			techRankingMap[t] = &struct{ count int; val float64 }{}
		}
		techRankingMap[t].count++
		techRankingMap[t].val += c.MonthlyValue
	}

	var topPlans []SalesRankingItem
	for name, s := range planRankingMap {
		avg := 0.0
		if s.count > 0 {
			avg = s.val / float64(s.count)
		}
		sh := 0.0
		if closedSalesCount > 0 {
			sh = (float64(s.count) / float64(closedSalesCount)) * 100
		}
		topPlans = append(topPlans, SalesRankingItem{
			Name:          name,
			Count:         s.count,
			Value:         s.val,
			TicketAverage: math.Round(avg*100) / 100,
			SharePercent:  math.Round(sh*10) / 10,
		})
	}
	sort.Slice(topPlans, func(i, j int) bool {
		return topPlans[i].Count > topPlans[j].Count
	})

	var topSellers []SalesRankingItem
	for name, s := range sellerRankingMap {
		avg := 0.0
		if s.count > 0 {
			avg = s.val / float64(s.count)
		}
		sh := 0.0
		if closedSalesCount > 0 {
			sh = (float64(s.count) / float64(closedSalesCount)) * 100
		}
		topSellers = append(topSellers, SalesRankingItem{
			Name:          name,
			Count:         s.count,
			Value:         s.val,
			TicketAverage: math.Round(avg*100) / 100,
			SharePercent:  math.Round(sh*10) / 10,
			SellerType:    sellersClassification[name],
		})
	}
	sort.Slice(topSellers, func(i, j int) bool {
		return topSellers[i].Count > topSellers[j].Count
	})

	// Funil
	funnelStages := []struct {
		Stage LeadStage `json:"stage"`
		Label string    `json:"label"`
		Count int       `json:"count"`
	}{
		{Stage: LeadStageNew, Label: "Novos", Count: leadsByStage[LeadStageNew]},
		{Stage: LeadStageQualified, Label: "Qualificados", Count: leadsByStage[LeadStageQualified]},
		{Stage: LeadStageProposal, Label: "Propostas", Count: leadsByStage[LeadStageProposal]},
		{Stage: LeadStageNegotiation, Label: "Negociação", Count: leadsByStage[LeadStageNegotiation]},
		{Stage: LeadStageWon, Label: "Ganhos", Count: leadsByStage[LeadStageWon]},
		{Stage: LeadStageLost, Label: "Perdidos", Count: leadsByStage[LeadStageLost]},
	}

	// Cruzamentos
	var salesByGroup []struct {
		Group         string  `json:"group"`
		Count         int     `json:"count"`
		Value         float64 `json:"value"`
		TicketAverage float64 `json:"ticketAverage"`
		SharePercent  float64 `json:"sharePercent"`
	}
	for g, s := range groupRankingMap {
		avg := 0.0
		if s.count > 0 {
			avg = s.val / float64(s.count)
		}
		sh := 0.0
		if closedSalesCount > 0 {
			sh = (float64(s.count) / float64(closedSalesCount)) * 100
		}
		salesByGroup = append(salesByGroup, struct {
			Group         string  `json:"group"`
			Count         int     `json:"count"`
			Value         float64 `json:"value"`
			TicketAverage float64 `json:"ticketAverage"`
			SharePercent  float64 `json:"sharePercent"`
		}{
			Group:         g,
			Count:         s.count,
			Value:         s.val,
			TicketAverage: math.Round(avg*100) / 100,
			SharePercent:  math.Round(sh*10) / 10,
		})
	}
	sort.Slice(salesByGroup, func(i, j int) bool {
		return salesByGroup[i].Count > salesByGroup[j].Count
	})

	var salesByRegion []struct {
		Region string  `json:"region"`
		Count  int     `json:"count"`
		Value  float64 `json:"value"`
	}
	for r, s := range regionRankingMap {
		salesByRegion = append(salesByRegion, struct {
			Region string  `json:"region"`
			Count  int     `json:"count"`
			Value  float64 `json:"value"`
		}{Region: r, Count: s.count, Value: s.val})
	}

	var salesByCity []struct {
		City  string  `json:"city"`
		Count int     `json:"count"`
		Value float64 `json:"value"`
	}
	for r, s := range cityRankingMap {
		salesByCity = append(salesByCity, struct {
			City  string  `json:"city"`
			Count int     `json:"count"`
			Value float64 `json:"value"`
		}{City: r, Count: s.count, Value: s.val})
	}

	var salesByTech []struct {
		Technology string  `json:"technology"`
		Count      int     `json:"count"`
		Value      float64 `json:"value"`
	}
	for t, s := range techRankingMap {
		salesByTech = append(salesByTech, struct {
			Technology string  `json:"technology"`
			Count      int     `json:"count"`
			Value      float64 `json:"value"`
		}{Technology: t, Count: s.count, Value: s.val})
	}

	// Cancelamentos por motivo e por cidade
	cancReasonMap := make(map[string]int)
	cancCityMap := make(map[string]*struct{ state string; count int; loss float64 })

	for _, c := range periodCancellations {
		r := c.CancelReason
		if r == "" {
			r = "Não informado"
		}
		cancReasonMap[r]++

		city := c.City
		if city == "" {
			city = "Não informada"
		}
		if _, ok := cancCityMap[city]; !ok {
			cancCityMap[city] = &struct{ state string; count int; loss float64 }{state: c.State, count: 0, loss: 0}
		}
		cancCityMap[city].count++
		cancCityMap[city].loss += c.MonthlyValue
	}

	var cancellationsByReason []struct {
		Reason string `json:"reason"`
		Count  int    `json:"count"`
	}
	for r, cnt := range cancReasonMap {
		cancellationsByReason = append(cancellationsByReason, struct {
			Reason string `json:"reason"`
			Count  int    `json:"count"`
		}{Reason: r, Count: cnt})
	}
	sort.Slice(cancellationsByReason, func(i, j int) bool {
		return cancellationsByReason[i].Count > cancellationsByReason[j].Count
	})

	var cancellationsByCity []CancellationByCity
	for city, s := range cancCityMap {
		pct := 0.0
		if cancellationsCount > 0 {
			pct = (float64(s.count) / float64(cancellationsCount)) * 100
		}
		cancellationsByCity = append(cancellationsByCity, CancellationByCity{
			City:        city,
			State:       s.state,
			Count:       s.count,
			Percentage:  math.Round(pct*10) / 10,
			MonthlyLoss: s.loss,
		})
	}
	sort.Slice(cancellationsByCity, func(i, j int) bool {
		return cancellationsByCity[i].Count > cancellationsByCity[j].Count
	})

	if timeSeries == nil {
		timeSeries = []SalesTimeSeriesPoint{}
	}
	if monthlySeries == nil {
		monthlySeries = []SalesMonthlyPoint{}
	}
	if topPlans == nil {
		topPlans = []SalesRankingItem{}
	}
	if topSellers == nil {
		topSellers = []SalesRankingItem{}
	}
	if salesByGroup == nil {
		salesByGroup = []struct {
			Group         string  `json:"group"`
			Count         int     `json:"count"`
			Value         float64 `json:"value"`
			TicketAverage float64 `json:"ticketAverage"`
			SharePercent  float64 `json:"sharePercent"`
		}{}
	}
	if salesByRegion == nil {
		salesByRegion = []struct {
			Region string  `json:"region"`
			Count  int     `json:"count"`
			Value  float64 `json:"value"`
		}{}
	}
	if salesByCity == nil {
		salesByCity = []struct {
			City  string  `json:"city"`
			Count int     `json:"count"`
			Value float64 `json:"value"`
		}{}
	}
	if salesByTech == nil {
		salesByTech = []struct {
			Technology string  `json:"technology"`
			Count      int     `json:"count"`
			Value      float64 `json:"value"`
		}{}
	}
	if cancellationsByReason == nil {
		cancellationsByReason = []struct {
			Reason string `json:"reason"`
			Count  int    `json:"count"`
		}{}
	}
	if cancellationsByCity == nil {
		cancellationsByCity = []CancellationByCity{}
	}
	if allAvailablePlans == nil {
		allAvailablePlans = []struct {
			Name  string  `json:"name"`
			Count int     `json:"count"`
			Value float64 `json:"value"`
		}{}
	}
	if allAvailableReasons == nil {
		allAvailableReasons = []struct {
			Reason string `json:"reason"`
			Count  int    `json:"count"`
		}{}
	}
	if allAvailableGroups == nil {
		allAvailableGroups = []string{}
	}
	if allAvailableSellers == nil {
		allAvailableSellers = []struct {
			Name       string     `json:"name"`
			Count      int        `json:"count"`
			Value      float64    `json:"value"`
			SellerType SellerType `json:"sellerType"`
		}{}
	}

	dashboard := &CommercialDashboardDto{
		Period: struct {
			Start string `json:"start"`
			End   string `json:"end"`
			Label string `json:"label"`
			Type  string `json:"type,omitempty"`
		}{
			Start: FormatLocalDate(startDate),
			End:   FormatLocalDate(endDate),
			Label: label,
			Type:  periodType,
		},
		LastUpdatedAt: time.Now().Format("2006-01-02 15:04:05"),
		Kpis: SalesKpiSummary{
			NewLeadsCount:                 newLeadsCount,
			NewLeadsDiffPercent:           newLeadsDiffPercent,
			LeadsByStage:                  leadsByStage,
			LeadsWithoutNextContactCount:  leadsWithoutNextContactCount,
			OpenActivitiesCount:           openActivitiesCount,
			ClosedSalesCount:              closedSalesCount,
			ClosedSalesDiffPercent:        closedSalesDiffPercent,
			ConfirmedContractsCount:       confirmedContractsCount,
			ConfirmedContractsDiffPercent: confirmedContractsDiffPercent,
			TotalMonthlyValue:             totalMonthlyValue,
			AverageTicketMonthly:          averageTicketMonthly,
			AverageAdhesionValue:          averageAdhesionValue,
			CancellationsCount:            cancellationsCount,
			NetAdditions:                  netAdditions,
			ChurnRatioPercent:             churnRatioPercent,
			TraceableConversionsCount:     traceableConversionsCount,
			ConversionRatePercent:         conversionRatePercent,
			CoveragePercent:               94.5,
		},
		TimeSeries:             timeSeries,
		MonthlySeries:          monthlySeries,
		Funnel:                 funnelStages,
		TopPlans:               topPlans,
		TopSellers:             topSellers,
		SellersClassification: sellersClassification,
		SalesByGroup:           salesByGroup,
		SalesByRegion:          salesByRegion,
		SalesByCity:            salesByCity,
		SalesByTechnology:      salesByTech,
		CancellationsByReason:  cancellationsByReason,
		CancellationsByCity:    cancellationsByCity,
		AllAvailablePlans:      allAvailablePlans,
		AllAvailableReasons:    allAvailableReasons,
		AllAvailableGroups:     allAvailableGroups,
		AllAvailableSellers:    allAvailableSellers,
	}

	return dashboard, nil
}

// ---------------------------------------------------------------------
// 3. Drill-down Analítico & Exportação CSV
// ---------------------------------------------------------------------

// GetAnalyticsDrilldown detalha os registros que compõem cada KPI comercial
func GetAnalyticsDrilldown(ctx context.Context, metricId string, f CommercialFilter, args ...any) (*DrilldownResponse, error) {
	crmDataMu.RLock()
	defer crmDataMu.RUnlock()

	var client *rbx.Client
	var dbPool *pgxpool.Pool
	for _, arg := range args {
		switch v := arg.(type) {
		case *rbx.Client:
			client = v
		case *pgxpool.Pool:
			dbPool = v
		}
	}
	sourceLeads := fetchLeads(ctx, client)
	contracts, _ := fetchContractsFromDB(ctx, dbPool)

	startDate, endDate, _, _ := ResolveDateRange(f)
	records := make([]DrilldownRecord, 0)

	switch metricId {
	case "vendas_fechadas":
		for _, c := range contracts {
			if c.StatusCode != "A" && c.StatusCode != "E" {
				continue
			}
			if !IsClosedSaleContract(c) {
				continue
			}
			if t, ok := ParseDateSafe(c.SignDate); ok && !t.Before(startDate) && !t.After(endDate) {
				seller := c.Seller
				if seller == "" {
					seller = "Não atribuído"
				}
				details := fmt.Sprintf("Plano: %s | Cidade: %s | Adesão: R$ %.2f", c.PlanDescription, c.City, c.AdhesionValue)
				records = append(records, DrilldownRecord{
					ID:              c.Number,
					Name:            c.ClientName,
					Detail:          details,
					Details:         details,
					Seller:          seller,
					Responsible:     seller,
					Date:            c.SignDate,
					Value:           c.MonthlyValue,
					MonthlyValue:    c.MonthlyValue,
					AdhesionValue:   c.AdhesionValue,
					PlanDescription: c.PlanDescription,
					City:            c.City,
					Technology:      c.Technology,
				})
			}
		}

	case "contratos_confirmados":
		for _, c := range contracts {
			if c.StatusCode != "A" && c.StatusCode != "E" {
				continue
			}
			if t, ok := ParseDateSafe(c.SignDate); ok && !t.Before(startDate) && !t.After(endDate) {
				seller := c.Seller
				if seller == "" {
					seller = "Não atribuído"
				}
				details := fmt.Sprintf("Plano: %s | Cidade: %s", c.PlanDescription, c.City)
				records = append(records, DrilldownRecord{
					ID:              c.Number,
					Name:            c.ClientName,
					Detail:          details,
					Details:         details,
					Seller:          seller,
					Responsible:     seller,
					Date:            c.SignDate,
					Value:           c.MonthlyValue,
					MonthlyValue:    c.MonthlyValue,
					PlanDescription: c.PlanDescription,
					City:            c.City,
					Technology:      c.Technology,
				})
			}
		}

	case "novos_leads", "novos_leads_periodo":
		for _, l := range sourceLeads {
			if isLeadInDateRange(l.CreatedAt, startDate, endDate) {
				details := fmt.Sprintf("Origem: %s | Cidade: %s | Bairro: %s", l.Source, l.City, l.Neighborhood)
				records = append(records, DrilldownRecord{
					ID:              strconv.Itoa(l.ID),
					Name:            l.Name,
					Detail:          details,
					Details:         details,
					Seller:          l.Owner,
					Responsible:     l.Owner,
					Date:            l.CreatedAt,
					Value:           l.EstimatedValue,
					MonthlyValue:    l.EstimatedValue,
					PlanDescription: l.Group,
					City:            l.City,
				})
			}
		}

	case "cancelamentos", "cancelamentos_periodo":
		for _, c := range contracts {
			if c.StatusCode != "C" {
				continue
			}
			opDate := c.LastOperationDate
			if opDate == "" {
				opDate = c.StartDate
			}
			if t, ok := ParseDateSafe(opDate); ok && !t.Before(startDate) && !t.After(endDate) {
				seller := c.Seller
				if seller == "" {
					seller = "Operacional"
				}
				details := fmt.Sprintf("Motivo: %s | Plano: %s | Cidade: %s", c.CancelReason, c.PlanDescription, c.City)
				records = append(records, DrilldownRecord{
					ID:              c.Number,
					Name:            c.ClientName,
					Detail:          details,
					Details:         details,
					Seller:          seller,
					Responsible:     seller,
					Date:            opDate,
					Value:           c.MonthlyValue,
					MonthlyValue:    c.MonthlyValue,
					PlanDescription: c.PlanDescription,
					City:            c.City,
					Technology:      c.Technology,
				})
			}
		}

	case "conversao_rastreavel":
		for _, c := range contracts {
			if c.StatusCode != "A" && c.StatusCode != "E" {
				continue
			}
			if c.OriginProspectId <= 0 {
				continue
			}
			if t, ok := ParseDateSafe(c.SignDate); ok && !t.Before(startDate) && !t.After(endDate) {
				seller := c.Seller
				if seller == "" {
					seller = "Não atribuído"
				}
				details := fmt.Sprintf("Lead Origem: #%d | Plano: %s | Cidade: %s", c.OriginProspectId, c.PlanDescription, c.City)
				records = append(records, DrilldownRecord{
					ID:              c.Number,
					Name:            c.ClientName,
					Detail:          details,
					Details:         details,
					Seller:          seller,
					Responsible:     seller,
					Date:            c.SignDate,
					Value:           c.MonthlyValue,
					MonthlyValue:    c.MonthlyValue,
					PlanDescription: c.PlanDescription,
					City:            c.City,
					Technology:      c.Technology,
				})
			}
		}

	default:
		return nil, fmt.Errorf("métrica '%s' não reconhecida", metricId)
	}

	return &DrilldownResponse{
		MetricID: metricId,
		Total:    len(records),
		Records:  records,
	}, nil
}

// ExportAnalyticsCsv gera arquivo CSV formatado com auditoria
func ExportAnalyticsCsv(ctx context.Context, metricId string, f CommercialFilter, user UserContext, args ...any) ([]byte, error) {
	drill, err := GetAnalyticsDrilldown(ctx, metricId, f, args...)
	if err != nil {
		return nil, err
	}

	var buf bytes.Buffer
	// BOM UTF-8 para Excel
	buf.WriteString("\xEF\xBB\xBF")

	writer := csv.NewWriter(&buf)
	writer.Comma = ','

	// Cabeçalho canônico
	_ = writer.Write([]string{"ID/Numero", "Nome", "Detalhes", "Responsavel/Vendedor", "Data", "Valor (R$)"})

	for _, r := range drill.Records {
		valStr := fmt.Sprintf("%.2f", r.Value)
		_ = writer.Write([]string{r.ID, r.Name, r.Details, r.Responsible, r.Date, valStr})
	}
	writer.Flush()

	audit.Log(audit.Entry{
		Username: user.Username,
		UserRole: user.Role,
		Action:   "sales:export",
		Module:   "sales",
		RecordID: metricId,
		Details:  map[string]interface{}{"totalExported": drill.Total},
	})

	return buf.Bytes(), nil
}

// GetContractDetails obtém ficha detalhada do contrato no RBXSoft
func GetContractDetails(ctx context.Context, number string, args ...any) (*SalesContractDto, error) {
	crmDataMu.RLock()
	defer crmDataMu.RUnlock()

	var dbPool *pgxpool.Pool
	for _, arg := range args {
		if p, ok := arg.(*pgxpool.Pool); ok {
			dbPool = p
			break
		}
	}
	contracts, _ := fetchContractsFromDB(ctx, dbPool)

	numClean := strings.TrimSpace(number)
	for _, c := range contracts {
		if strings.EqualFold(c.Number, numClean) {
			return &c, nil
		}
	}
	return nil, nil
}
