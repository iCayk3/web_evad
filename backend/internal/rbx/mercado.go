package rbx

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"
)

// MercadoDto representa o retorno oficial de um registro de ConsultaMercados do RBXSoft
type MercadoDto struct {
	Codigo         int    `json:"codigo"`
	Tipo           string `json:"tipo"`
	CpfCnpj        string `json:"cpfCnpj"`
	Nome           string `json:"nome"`
	Endereco       string `json:"endereco"`
	Numero         string `json:"numero"`
	Complemento    string `json:"complemento"`
	Bairro         string `json:"bairro"`
	Cidade         string `json:"cidade"`
	UF             string `json:"uf"`
	CEP            string `json:"cep"`
	TelComercial   string `json:"telComercial"`
	TelResidencial string `json:"telResidencial"`
	TelCelular     string `json:"telCelular"`
	Inclusao       string `json:"inclusao"` // Data de inclusão do lead (YYYY-MM-DD ou YYYY-MM-DD HH:MM:SS)
	Usuario        string `json:"usuario"`  // Vendedor/Operador que cadastrou o lead
	Observacoes    string `json:"observacoes"`
	Grupo          string `json:"grupo"`
	MapsMarkLat    string `json:"mapsMarkLat"`
	MapsMarkLng    string `json:"mapsMarkLng"`
}

// ConsultarMercadosComFiltro consulta a carteira de leads/mercados no RBXSoft via ConsultaMercados
func (c *Client) ConsultarMercadosComFiltro(ctx context.Context, filtro string) ([]MercadoDto, error) {
	if strings.TrimSpace(filtro) == "" {
		filtro = "Codigo > 0"
	}
	cacheKey := fmt.Sprintf("rbx_mercados:%s", filtro)
	ttl := 10 * time.Second

	val, err := DefaultEngine.ExecuteRequest(cacheKey, ttl, func() (interface{}, error) {
		targetURL := c.EndpointURLForV1()
		token := strings.TrimSpace(c.config.Token)
		if targetURL == "" || token == "" {
			return nil, fmt.Errorf("integração RBX não configurada")
		}

		payload := map[string]interface{}{
			"ConsultaMercados": map[string]interface{}{
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
			Status interface{}              `json:"status"`
			Result []map[string]interface{} `json:"result"`
		}
		if err := json.NewDecoder(resp.Body).Decode(&parsed); err != nil {
			return nil, err
		}

		var list []MercadoDto
		for _, raw := range parsed.Result {
			list = append(list, toMercadoDto(raw))
		}
		return list, nil
	})

	if err != nil {
		return nil, err
	}
	return val.([]MercadoDto), nil
}

func toMercadoDto(raw map[string]interface{}) MercadoDto {
	getStr := func(keys ...string) string {
		for _, k := range keys {
			if v, ok := raw[k]; ok && v != nil {
				s := strings.TrimSpace(fmt.Sprintf("%v", v))
				if s != "<nil>" && s != "null" {
					return s
				}
			}
		}
		return ""
	}

	getInt := func(keys ...string) int {
		s := getStr(keys...)
		if s == "" {
			return 0
		}
		n, _ := strconv.Atoi(s)
		return n
	}

	return MercadoDto{
		Codigo:         getInt("Codigo", "codigo", "id_mercado", "id"),
		Tipo:           getStr("Tipo", "tipo"),
		CpfCnpj:        getStr("CNPJ_CNPF", "CpfCnpj", "cpf_cnpj"),
		Nome:           getStr("Nome", "nome"),
		Endereco:       getStr("Endereco", "endereco", "logradouro"),
		Numero:         getStr("Numero", "numero"),
		Complemento:    getStr("Complemento", "complemento"),
		Bairro:         getStr("Bairro", "bairro"),
		Cidade:         getStr("Cidade", "cidade"),
		UF:             getStr("UF", "Uf", "uf"),
		CEP:            getStr("CEP", "Cep", "cep"),
		TelComercial:   getStr("TelComercial", "tel_comercial"),
		TelResidencial: getStr("TelResidencial", "tel_residencial"),
		TelCelular:     getStr("TelCelular", "tel_celular", "Celular", "celular", "Telefone", "telefone"),
		Inclusao:       getStr("Inclusao", "inclusao", "data_inclusao", "data_cadastro"),
		Usuario:        getStr("usuario", "Usuario", "user"),
		Observacoes:    getStr("Observacoes", "observacoes"),
		Grupo:          getStr("Grupo", "grupo"),
		MapsMarkLat:    getStr("MapsMarkLat", "maps_mark_lat"),
		MapsMarkLng:    getStr("MapsMarkLng", "maps_mark_lng"),
	}
}
