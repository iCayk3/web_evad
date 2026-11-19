package omnichannel

import (
	"bufio"
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/csv"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/xuri/excelize/v2"
)

// PreviewValidation validação de uma linha de pré-visualização
type PreviewValidation struct {
	IsValid      bool              `json:"isValid"`
	Errors       []ValidationError `json:"errors"`
	QualityFlags []string          `json:"qualityFlags"`
}

type ValidationError struct {
	Field   string `json:"field"`
	Code    string `json:"code"`
	Message string `json:"message"`
}

// PreviewRow linha de amostragem na pré-visualização
type PreviewRow struct {
	RowNumber       int                    `json:"rowNumber"`
	RawValues       map[string]string      `json:"rawValues"`
	CanonicalData   map[string]interface{} `json:"canonicalData"`
	Validation      PreviewValidation      `json:"validation"`
	ConversationID  string                 `json:"conversationId"`
	PhoneMasked     string                 `json:"phoneMasked"`
	NameMasked      string                 `json:"nameMasked"`
	Department      string                 `json:"department"`
	Channel         string                 `json:"channel"`
	Valid           bool                   `json:"valid"`
	ValidationError string                 `json:"validationError,omitempty"`
}

// PreviewResult resultado de pré-visualização do upload
type PreviewResult struct {
	FileHash             string                 `json:"fileHash"`
	TotalRowsEstimated   int                    `json:"totalRowsEstimated"`
	DetectedColumnsCount int                    `json:"detectedColumnsCount"`
	DetectedColumns      map[int]CanonicalField `json:"detectedColumns"`
	UnmappedHeaders      []string               `json:"unmappedHeaders"`
	PreviewRows          []PreviewRow           `json:"previewRows"`
}

func (p PreviewResult) MarshalJSON() ([]byte, error) {
	type Alias PreviewResult
	return json.Marshal(&struct {
		Alias
		FileHashSnake             string                 `json:"file_hash"`
		TotalRowsEstimatedSnake   int                    `json:"total_rows_estimated"`
		DetectedColumnsCountSnake int                    `json:"detected_columns_count"`
		DetectedColumnsSnake      map[int]CanonicalField `json:"detected_columns"`
		UnmappedHeadersSnake      []string               `json:"unmapped_headers"`
		PreviewRowsSnake          []PreviewRow           `json:"preview_rows"`
	}{
		Alias:                     Alias(p),
		FileHashSnake:             p.FileHash,
		TotalRowsEstimatedSnake:   p.TotalRowsEstimated,
		DetectedColumnsCountSnake: p.DetectedColumnsCount,
		DetectedColumnsSnake:      p.DetectedColumns,
		UnmappedHeadersSnake:      p.UnmappedHeaders,
		PreviewRowsSnake:          p.PreviewRows,
	})
}

// ComputeFileHash calcula o hash SHA-256 de um arquivo
func ComputeFileHash(filePath string) (string, error) {
	f, err := os.Open(filePath)
	if err != nil {
		return "", err
	}
	defer f.Close()

	h := sha256.New()
	if _, err := io.Copy(h, f); err != nil {
		return "", err
	}
	return hex.EncodeToString(h.Sum(nil)), nil
}

// spreadsheetRowIterator interface para streaming de linhas de planilhas gigantes
type spreadsheetRowIterator interface {
	Next() bool
	Row() []string
	Err() error
	Close() error
}

type csvRowIterator struct {
	file   *os.File
	reader *csv.Reader
	curr   []string
	err    error
}

func (c *csvRowIterator) Next() bool {
	row, err := c.reader.Read()
	if err != nil {
		if err != io.EOF {
			c.err = err
		}
		return false
	}
	c.curr = row
	return true
}

func (c *csvRowIterator) Row() []string { return c.curr }
func (c *csvRowIterator) Err() error    { return c.err }
func (c *csvRowIterator) Close() error  { return c.file.Close() }

type xlsxRowIterator struct {
	file *excelize.File
	iter *excelize.Rows
	curr []string
	err  error
}

func (x *xlsxRowIterator) Next() bool {
	if !x.iter.Next() {
		return false
	}
	cols, err := x.iter.Columns()
	if err != nil {
		x.err = err
		return false
	}
	x.curr = cols
	return true
}

func (x *xlsxRowIterator) Row() []string { return x.curr }
func (x *xlsxRowIterator) Err() error    { return x.err }
func (x *xlsxRowIterator) Close() error {
	_ = x.iter.Close()
	return x.file.Close()
}

// openSpreadsheetStream abre a planilha como fluxo iterável sem carregar todas as linhas na memória
func openSpreadsheetStream(filePath string) ([]string, spreadsheetRowIterator, int, error) {
	if strings.HasSuffix(strings.ToLower(filePath), ".csv") {
		f, err := os.Open(filePath)
		if err != nil {
			return nil, nil, 0, fmt.Errorf("erro ao abrir arquivo CSV: %w", err)
		}

		// Detecta delimitador a partir dos primeiros 4KB
		headerBuf := make([]byte, 4096)
		n, _ := f.Read(headerBuf)
		if n == 0 {
			f.Close()
			return nil, nil, 0, fmt.Errorf("o arquivo CSV está vazio")
		}
		headerSample := string(headerBuf[:n])
		headerSample = strings.TrimPrefix(headerSample, "\ufeff")
		headerSample = strings.TrimPrefix(headerSample, "\xef\xbb\xbf")

		delimiter := ','
		firstLine := headerSample
		if idx := strings.IndexAny(firstLine, "\r\n"); idx != -1 {
			firstLine = firstLine[:idx]
		}
		if strings.Count(firstLine, ";") > strings.Count(firstLine, ",") {
			delimiter = ';'
		}

		// Retorna ao início do arquivo
		_, _ = f.Seek(0, io.SeekStart)
		bomReader := bufio.NewReader(f)
		r1, _, _ := bomReader.ReadRune()
		if r1 != '\ufeff' {
			_ = bomReader.UnreadRune()
		}

		csvReader := csv.NewReader(bomReader)
		csvReader.Comma = delimiter
		csvReader.LazyQuotes = true
		csvReader.TrimLeadingSpace = true

		headers, err := csvReader.Read()
		if err != nil {
			f.Close()
			return nil, nil, 0, fmt.Errorf("erro ao ler cabeçalho do CSV: %w", err)
		}

		return headers, &csvRowIterator{file: f, reader: csvReader}, 0, nil
	}

	// XLSX
	xl, err := excelize.OpenFile(filePath)
	if err != nil {
		return nil, nil, 0, fmt.Errorf("erro ao abrir planilha Excel: %w", err)
	}

	sheets := xl.GetSheetList()
	if len(sheets) == 0 {
		xl.Close()
		return nil, nil, 0, fmt.Errorf("planilha não contém abas válidas")
	}
	sheet := sheets[0]

	// Extrai estimativa de linhas a partir da dimensão da aba
	totalRowsEst := 0
	dim, _ := xl.GetSheetDimension(sheet)
	if dim != "" && strings.Contains(dim, ":") {
		parts := strings.Split(dim, ":")
		if len(parts) == 2 {
			var digits []rune
			for _, r := range parts[1] {
				if r >= '0' && r <= '9' {
					digits = append(digits, r)
				}
			}
			if len(digits) > 0 {
				if rowNum, err := strconv.Atoi(string(digits)); err == nil && rowNum > 1 {
					totalRowsEst = rowNum - 1
				}
			}
		}
	}

	rowsIter, err := xl.Rows(sheet)
	if err != nil {
		xl.Close()
		return nil, nil, 0, fmt.Errorf("erro ao iterar linhas da planilha: %w", err)
	}

	if !rowsIter.Next() {
		_ = rowsIter.Close()
		xl.Close()
		return nil, nil, 0, fmt.Errorf("a planilha está vazia")
	}

	headers, err := rowsIter.Columns()
	if err != nil {
		_ = rowsIter.Close()
		xl.Close()
		return nil, nil, 0, fmt.Errorf("erro ao ler cabeçalho da planilha: %w", err)
	}

	return headers, &xlsxRowIterator{file: xl, iter: rowsIter}, totalRowsEst, nil
}

// readSpreadsheetRows lê todas as linhas (mantido para compatibilidade de testes)
func readSpreadsheetRows(filePath string) ([]string, [][]string, error) {
	headers, stream, _, err := openSpreadsheetStream(filePath)
	if err != nil {
		return nil, nil, err
	}
	defer stream.Close()

	var rows [][]string
	for stream.Next() {
		rows = append(rows, stream.Row())
	}
	if err := stream.Err(); err != nil {
		return nil, nil, err
	}
	return headers, rows, nil
}

// previewSpreadsheetRows extrai até maxRows de amostragem e a contagem total estimada sem travar em planilhas gigantes
func previewSpreadsheetRows(filePath string, maxRows int) ([]string, [][]string, int, error) {
	if strings.HasSuffix(strings.ToLower(filePath), ".csv") {
		headers, stream, _, err := openSpreadsheetStream(filePath)
		if err != nil {
			return nil, nil, 0, err
		}

		var sampleRows [][]string
		for len(sampleRows) < maxRows && stream.Next() {
			sampleRows = append(sampleRows, stream.Row())
		}

		// Contagem rápida das linhas restantes do CSV via buffer de stream
		csvIter, ok := stream.(*csvRowIterator)
		totalCount := len(sampleRows)
		if ok {
			buf := make([]byte, 64*1024)
			for {
				nb, rErr := csvIter.file.Read(buf)
				if nb > 0 {
					totalCount += bytes.Count(buf[:nb], []byte{'\n'})
				}
				if rErr != nil {
					break
				}
			}
		}
		stream.Close()
		if totalCount < len(sampleRows) {
			totalCount = len(sampleRows)
		}
		return headers, sampleRows, totalCount, nil
	}

	// XLSX
	headers, stream, totalRowsEst, err := openSpreadsheetStream(filePath)
	if err != nil {
		return nil, nil, 0, err
	}
	defer stream.Close()

	var sampleRows [][]string
	rowCount := 0
	for stream.Next() {
		rowCount++
		if len(sampleRows) < maxRows {
			sampleRows = append(sampleRows, stream.Row())
		} else if totalRowsEst > 0 {
			// Já temos a dimensão precisa da planilha, podemos parar de iterar
			break
		}
	}

	if totalRowsEst == 0 {
		totalRowsEst = rowCount
	}

	return headers, sampleRows, totalRowsEst, nil
}

// PreviewFile extrai metadados e as primeiras linhas de uma planilha (.xlsx ou .csv) de forma ultra-rápida
func PreviewFile(filePath string, maxRows int) (*PreviewResult, error) {
	fileHash, err := ComputeFileHash(filePath)
	if err != nil {
		return nil, fmt.Errorf("erro ao calcular hash do arquivo: %w", err)
	}

	if maxRows <= 0 {
		maxRows = 50
	}

	headers, sampleRows, totalEstimated, err := previewSpreadsheetRows(filePath, maxRows)
	if err != nil {
		return nil, err
	}

	detection := DetectColumnMapping(headers)
	previewRows := make([]PreviewRow, 0, len(sampleRows))

	for i, row := range sampleRows {
		rawMap := make(map[string]string)
		for colIdx, val := range row {
			if colIdx < len(headers) {
				rawMap[headers[colIdx]] = val
			}
		}

		getVal := func(field CanonicalField) string {
			if idx, ok := detection.FieldIndices[field]; ok && idx < len(row) {
				return strings.TrimSpace(row[idx])
			}
			return ""
		}

		convID := getVal(FieldConversationID)
		protoNum := getVal(FieldProtocolNumber)
		if convID == "" {
			convID = protoNum
		}
		if protoNum == "" {
			protoNum = convID
		}

		phone := getVal(FieldPhoneNumber)
		name := getVal(FieldCustomerName)
		closedBy := getVal(FieldClosedBy)
		dep := getVal(FieldDepartment)
		chanVal := getVal(FieldChannel)
		startedAt := getVal(FieldStartedAt)
		endedAt := getVal(FieldEndedAt)
		status := getVal(FieldStatus)
		tma := getVal(FieldAverageHandleTime)
		tme := getVal(FieldAverageWaitTime)
		tmr1 := getVal(FieldFirstResponseTime)
		tmrAvg := getVal(FieldAvgResponseTime)
		closure := getVal(FieldClosureType)
		class := getVal(FieldClassification)
		desc := getVal(FieldDescription)
		assign := getVal(FieldAssignments)
		msgRecv := getVal(FieldMessagesReceived)
		msgSent := getVal(FieldMessagesSent)
		satisfaction := getVal(FieldSatisfactionSurvey)

		isAuto := strings.Contains(strings.ToLower(dep), "auto") ||
			strings.Contains(strings.ToLower(chanVal), "bot") ||
			strings.Contains(strings.ToLower(closedBy), "auto") ||
			strings.Contains(strings.ToLower(closure), "auto") ||
			strings.Contains(strings.ToLower(assign), "sem atribui")

		if dep == "" {
			if isAuto {
				dep = "Automação"
			} else {
				dep = "Sem Departamento"
			}
		}

		valid := convID != ""
		valErr := ""
		valErrors := []ValidationError{}
		if !valid {
			valErr = "Identificador de conversa ausente"
			valErrors = append(valErrors, ValidationError{
				Field:   "conversation_id",
				Code:    "REQUIRED_FIELD_MISSING",
				Message: valErr,
			})
		}

		canonicalData := map[string]interface{}{
			"conversation_id":   convID,
			"protocol_number":   protoNum,
			"phone_number":      phone,
			"customer_name":     name,
			"closed_by":         closedBy,
			"department":        dep,
			"channel":           chanVal,
			"started_at":        startedAt,
			"ended_at":          endedAt,
			"status":            status,
			"tma":               tma,
			"tme":               tme,
			"tmr_first":         tmr1,
			"tmr_avg":           tmrAvg,
			"closure_type":      closure,
			"classification":    class,
			"description":       desc,
			"messages_received": msgRecv,
			"messages_sent":     msgSent,
			"satisfaction":      satisfaction,
			"is_automation":     isAuto,
		}

		previewRows = append(previewRows, PreviewRow{
			RowNumber:     i + 2,
			RawValues:     rawMap,
			CanonicalData: canonicalData,
			Validation: PreviewValidation{
				IsValid:      valid,
				Errors:       valErrors,
				QualityFlags: []string{},
			},
			ConversationID:  convID,
			PhoneMasked:     MaskPhone(phone),
			NameMasked:      MaskName(name),
			Department:      dep,
			Channel:         chanVal,
			Valid:           valid,
			ValidationError: valErr,
		})
	}

	return &PreviewResult{
		FileHash:             fileHash,
		TotalRowsEstimated:   totalEstimated,
		DetectedColumnsCount: len(detection.Mapping),
		DetectedColumns:      detection.Mapping,
		UnmappedHeaders:      detection.UnmappedHeaders,
		PreviewRows:          previewRows,
	}, nil
}

// ProcessBatchImport executa a importação completa da planilha para o PostgreSQL de forma otimizada com streaming e batches
func ProcessBatchImport(
	ctx context.Context,
	db *pgxpool.Pool,
	matcher *IdentityMatcher,
	filePath, fileName string,
	fileSize int64,
	userID string,
) (*BatchSummary, error) {
	batchID := "batch_" + uuid.New().String()
	return ProcessBatchImportWithID(ctx, db, matcher, batchID, filePath, fileName, fileSize, userID)
}

// ProcessBatchImportWithID executa a importação associando diretamente ao batchID pré-criado
func ProcessBatchImportWithID(
	ctx context.Context,
	db *pgxpool.Pool,
	matcher *IdentityMatcher,
	batchID, filePath, fileName string,
	fileSize int64,
	userID string,
) (*BatchSummary, error) {
	fileHash, err := ComputeFileHash(filePath)
	if err != nil {
		return nil, fmt.Errorf("falha ao computar hash do arquivo: %w", err)
	}

	// 1. Verifica duplicidade do arquivo
	var existingID, existingStatus string
	err = db.QueryRow(ctx, "SELECT id, status FROM omnichannel_import_batches WHERE file_hash = $1 AND id != $2 AND status = 'completed'", fileHash, batchID).Scan(&existingID, &existingStatus)
	if err == nil && existingStatus == "completed" {
		return nil, fmt.Errorf("este arquivo já foi importado com sucesso anteriormente (Lote %s)", existingID)
	}

	now := time.Now()

	// Insere ou atualiza o registro inicial do lote como 'processing'
	_, err = db.Exec(ctx, `
		INSERT INTO omnichannel_import_batches (
			id, file_hash, file_name, file_size, total_rows, accepted_rows, rejected_rows, duplicate_rows,
			status, imported_by, created_at
		) VALUES ($1, $2, $3, $4, 0, 0, 0, 0, 'processing', $5, $6)
		ON CONFLICT (id) DO UPDATE SET
			file_hash = EXCLUDED.file_hash,
			file_name = EXCLUDED.file_name,
			file_size = EXCLUDED.file_size,
			status = 'processing'
	`, batchID, fileHash, fileName, fileSize, userID, now)
	if err != nil {
		return nil, fmt.Errorf("erro ao registrar lote: %w", err)
	}

	// 2. Abre fluxo da planilha
	headers, stream, totalRowsEst, err := openSpreadsheetStream(filePath)
	if err != nil {
		failBatch(ctx, db, batchID, err.Error())
		return nil, err
	}
	defer stream.Close()

	detection := DetectColumnMapping(headers)
	getVal := func(row []string, field CanonicalField) string {
		if idx, ok := detection.FieldIndices[field]; ok && idx < len(row) {
			return strings.TrimSpace(row[idx])
		}
		return ""
	}

	totalRows := 0
	acceptedRows := 0
	rejectedRows := 0
	duplicateRows := 0

	matchConfirmed := 0
	matchNameSuggested := 0
	matchAmbiguous := 0
	matchUnmatched := 0

	var minDate, maxDate *time.Time
	seenConversations := make(map[string]bool)

	// Garante que os índices estejam carregados
	if !matcher.loaded {
		_ = matcher.LoadIndexes(ctx, db)
	}

	// Batching para inserção em massa de alto desempenho
	batch := &pgx.Batch{}
	batchItemsCount := 0

	flushBatch := func() error {
		if batchItemsCount == 0 {
			return nil
		}
		br := db.SendBatch(ctx, batch)
		for i := 0; i < batch.Len(); i++ {
			if _, err := br.Exec(); err != nil {
				// Continua processando os demais itens
			}
		}
		_ = br.Close()
		batch = &pgx.Batch{}
		batchItemsCount = 0

		// Atualiza progresso no banco para feedback em tempo real no frontend
		_, _ = db.Exec(ctx, `
			UPDATE omnichannel_import_batches SET
				total_rows = $1, accepted_rows = $2, rejected_rows = $3, duplicate_rows = $4,
				match_confirmed = $5, match_name_suggested = $6, match_ambiguous = $7, match_unmatched = $8
			WHERE id = $9
		`, totalRows, acceptedRows, rejectedRows, duplicateRows, matchConfirmed, matchNameSuggested, matchAmbiguous, matchUnmatched, batchID)

		return nil
	}

	// Processa as linhas em fluxo contínuo
	for stream.Next() {
		row := stream.Row()
		totalRows++
		rowNumber := totalRows + 1

		convID := getVal(row, FieldConversationID)
		protoNum := getVal(row, FieldProtocolNumber)
		if convID == "" {
			convID = protoNum
		}
		if protoNum == "" {
			protoNum = convID
		}

		if convID == "" {
			rejectedRows++
			logImportError(ctx, db, batchID, rowNumber, "conversation_id", "REQUIRED_FIELD_MISSING", "ID de conversa ou protocolo obrigatório", "")
			continue
		}

		if seenConversations[convID] {
			duplicateRows++
			continue
		}
		seenConversations[convID] = true

		rawPhone := getVal(row, FieldPhoneNumber)
		rawName := getVal(row, FieldCustomerName)
		startedAtStr := getVal(row, FieldStartedAt)
		endedAtStr := getVal(row, FieldEndedAt)
		status := getVal(row, FieldStatus)
		channel := getVal(row, FieldChannel)
		department := getVal(row, FieldDepartment)
		classificationStr := getVal(row, FieldClassification)
		description := getVal(row, FieldDescription)
		closureType := getVal(row, FieldClosureType)
		satisfaction := getVal(row, FieldSatisfactionSurvey)
		initiatedBy := getVal(row, FieldInitiatedBy)
		closedBy := getVal(row, FieldClosedBy)
		assignmentsStr := getVal(row, FieldAssignments)
		msgRecv := parseNumber(getVal(row, FieldMessagesReceived))
		msgSent := parseNumber(getVal(row, FieldMessagesSent))
		msgInternal := parseNumber(getVal(row, FieldMessagesInternal))

		// Parse de Datas
		startedAt, okS := parseAnyDate(startedAtStr)
		if !okS {
			startedAt = time.Now()
		} else {
			if minDate == nil || startedAt.Before(*minDate) {
				t := startedAt
				minDate = &t
			}
			if maxDate == nil || startedAt.After(*maxDate) {
				t := startedAt
				maxDate = &t
			}
		}
		var endedAt *time.Time
		if endedAtStr != "" {
			if e, ok := parseAnyDate(endedAtStr); ok {
				endedAt = &e
				if maxDate == nil || e.After(*maxDate) {
					t := e
					maxDate = &t
				}
			}
		}

		// Normalização e Criptografia
		phoneNorm, phoneCand9th := NormalizePhone(rawPhone)
		phoneHMAC := GeneratePhoneHmac(phoneNorm, "")
		nameNorm := NormalizeName(rawName)
		nameHMAC := GenerateNameHmac(nameNorm, "")
		phoneMasked := MaskPhone(rawPhone)
		nameMasked := MaskName(rawName)

		// Resolução de Identidade
		match := matcher.MatchContact(phoneHMAC, phoneNorm, phoneCand9th, nameNorm)
		switch match.Status {
		case "confirmed":
			matchConfirmed++
		case "name_suggested":
			matchNameSuggested++
		case "ambiguous":
			matchAmbiguous++
		default:
			matchUnmatched++
		}

		// Formata Classificações
		var classList []string
		if classificationStr != "" {
			for _, p := range strings.Split(classificationStr, ",") {
				if trimmed := strings.TrimSpace(p); trimmed != "" {
					classList = append(classList, trimmed)
				}
			}
		}
		classJson, _ := json.Marshal(classList)

		// Trata Automação e Departamento
		isAuto := strings.Contains(strings.ToLower(department), "auto") ||
			strings.Contains(strings.ToLower(channel), "bot") ||
			strings.Contains(strings.ToLower(closedBy), "auto") ||
			strings.Contains(strings.ToLower(closureType), "auto") ||
			strings.Contains(strings.ToLower(assignmentsStr), "sem atribui")

		if department == "" {
			if isAuto {
				department = "Automação"
			} else {
				department = "Sem Departamento"
			}
		}

		// Tempos em Segundos
		tma := parseDurationSeconds(getVal(row, FieldAverageHandleTime))
		tme := parseDurationSeconds(getVal(row, FieldAverageWaitTime))
		tmr1 := parseDurationSeconds(getVal(row, FieldFirstResponseTime))
		tmrAvg := parseDurationSeconds(getVal(row, FieldAvgResponseTime))

		factID := "fact_" + uuid.New().String()

		batch.Queue(`
			INSERT INTO omnichannel_contact_facts (
				id, batch_id, conversation_id, protocol_number, phone_hmac, phone_masked, name_hmac, name_normalized, name_masked,
				rbx_client_id, match_status, match_method, match_confidence, started_at, ended_at, status, channel,
				department, is_automation, closure_type, classification, description,
				messages_received, messages_sent, messages_internal,
				handle_time_seconds, wait_time_seconds, first_response_seconds, avg_response_seconds,
				satisfaction_status, initiated_by
			) VALUES (
				$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31
			)
		`,
			factID, batchID, convID, protoNum, phoneHMAC, phoneMasked, nameHMAC, nameNorm, nameMasked,
			match.RbxClientID, match.Status, match.Method, match.Confidence, startedAt, endedAt, status, channel,
			department, isAuto, closureType, string(classJson), description,
			msgRecv, msgSent, msgInternal,
			tma, tme, tmr1, tmrAvg, satisfaction, initiatedBy,
		)

		// Queue Atribuições / Atendentes no mesmo batch
		queueAssignments(batch, factID, assignmentsStr, closedBy, isAuto)

		acceptedRows++
		batchItemsCount++

		// Descarrega no banco a cada 500 atendimentos para fluidez e baixo consumo de RAM
		if batchItemsCount >= 500 {
			_ = flushBatch()
		}
	}

	// Executa os itens remanescentes
	_ = flushBatch()

	if err := stream.Err(); err != nil {
		failBatch(ctx, db, batchID, fmt.Sprintf("Erro ao ler fluxo da planilha: %v", err))
		return nil, err
	}

	completedAt := time.Now()
	var periodStart, periodEnd *string
	if minDate != nil {
		s := minDate.Format("2006-01-02 15:04:05")
		periodStart = &s
	}
	if maxDate != nil {
		s := maxDate.Format("2006-01-02 15:04:05")
		periodEnd = &s
	}

	_, _ = db.Exec(ctx, `
		UPDATE omnichannel_import_batches SET
			total_rows = $1, accepted_rows = $2, rejected_rows = $3, duplicate_rows = $4,
			match_confirmed = $5, match_name_suggested = $6, match_ambiguous = $7, match_unmatched = $8,
			detected_period_start = $9, detected_period_end = $10,
			status = 'completed', completed_at = $11
		WHERE id = $12
	`, totalRows, acceptedRows, rejectedRows, duplicateRows, matchConfirmed, matchNameSuggested, matchAmbiguous, matchUnmatched, periodStart, periodEnd, completedAt, batchID)

	_ = totalRowsEst // usado se necessário

	return &BatchSummary{
		ID:                  batchID,
		FileHash:            fileHash,
		FileName:            fileName,
		FileSize:            fileSize,
		TotalRows:           totalRows,
		AcceptedRows:        acceptedRows,
		RejectedRows:        rejectedRows,
		DuplicateRows:       duplicateRows,
		MatchConfirmed:      matchConfirmed,
		MatchNameSuggested:  matchNameSuggested,
		MatchAmbiguous:      matchAmbiguous,
		MatchUnmatched:      matchUnmatched,
		DetectedPeriodStart: periodStart,
		DetectedPeriodEnd:   periodEnd,
		Status:              "completed",
		ImportedBy:          userID,
		CreatedAt:           now,
		CompletedAt:         &completedAt,
	}, nil
}

func failBatch(ctx context.Context, db *pgxpool.Pool, batchID, errMsg string) {
	_, _ = db.Exec(ctx, "UPDATE omnichannel_import_batches SET status = 'failed', error_message = $1 WHERE id = $2", errMsg, batchID)
}

func logImportError(ctx context.Context, db *pgxpool.Pool, batchID string, rowNum int, field, errCode, errMsg, rawVal string) {
	errID := "err_" + uuid.New().String()
	_, _ = db.Exec(ctx, `
		INSERT INTO omnichannel_import_errors (id, batch_id, row_number, field_name, error_code, error_message, raw_value)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
	`, errID, batchID, rowNum, field, errCode, errMsg, rawVal)
}

func queueAssignments(batch *pgx.Batch, factID, assignmentsStr, closedBy string, isAuto bool) {
	var agents []string
	if assignmentsStr != "" && !strings.Contains(strings.ToLower(assignmentsStr), "sem atribui") {
		for _, part := range strings.Split(assignmentsStr, "->") {
			if a := strings.TrimSpace(part); a != "" {
				agents = append(agents, a)
			}
		}
	}
	if len(agents) == 0 && closedBy != "" && !strings.EqualFold(closedBy, "sem atribuições") {
		agents = append(agents, strings.TrimSpace(closedBy))
	}
	if len(agents) == 0 && isAuto {
		agents = append(agents, "AUTOMAÇÃO")
	}

	for idx, a := range agents {
		isCloser := (closedBy != "" && strings.EqualFold(a, strings.TrimSpace(closedBy))) || (idx == len(agents)-1)
		h := sha256.Sum256([]byte(strings.ToLower(a)))
		agentHash := hex.EncodeToString(h[:])
		assignID := "assign_" + uuid.New().String()
		batch.Queue(`
			INSERT INTO omnichannel_contact_assignments (id, fact_id, agent_name_hash, agent_display, position, is_closer)
			VALUES ($1, $2, $3, $4, $5, $6)
		`, assignID, factID, agentHash, a, idx+1, isCloser)
	}
}

func insertAssignments(ctx context.Context, db *pgxpool.Pool, factID, assignmentsStr, closedBy string, isAuto bool) {
	batch := &pgx.Batch{}
	queueAssignments(batch, factID, assignmentsStr, closedBy, isAuto)
	if batch.Len() > 0 {
		br := db.SendBatch(ctx, batch)
		_ = br.Close()
	}
}

func parseNumber(s string) int {
	s = strings.TrimSpace(s)
	if s == "" || s == "-" || s == "--" || s == "—" {
		return 0
	}
	n, _ := strconv.Atoi(s)
	return n
}

func parseDurationSeconds(s string) int {
	s = strings.TrimSpace(s)
	if s == "" || s == "-" || s == "--" || s == "—" {
		return 0
	}
	// Se for número puro em segundos
	if n, err := strconv.Atoi(s); err == nil {
		return n
	}
	// Formato HH:MM:SS ou MM:SS
	parts := strings.Split(s, ":")
	if len(parts) == 3 {
		h, _ := strconv.Atoi(parts[0])
		m, _ := strconv.Atoi(parts[1])
		sec, _ := strconv.Atoi(parts[2])
		return h*3600 + m*60 + sec
	} else if len(parts) == 2 {
		m, _ := strconv.Atoi(parts[0])
		sec, _ := strconv.Atoi(parts[1])
		return m*60 + sec
	}
	return 0
}

func parseAnyDate(s string) (time.Time, bool) {
	s = strings.TrimSpace(s)
	if s == "" {
		return time.Time{}, false
	}
	formats := []string{
		"2006-01-02 15:04:05",
		"2006-01-02T15:04:05",
		"02/01/2006 15:04:05",
		"02/01/2006 15:04",
		"2006-01-02",
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
