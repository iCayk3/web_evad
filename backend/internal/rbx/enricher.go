package rbx

import (
	"context"
	"fmt"
	"strconv"
	"sync"

	"github.com/jackc/pgx/v5/pgxpool"
)

var clientNamesCache sync.Map

// EnrichTicketsWithClientNames enriquece os tickets com os nomes reais dos clientes
func EnrichTicketsWithClientNames(ctx context.Context, tickets []TicketDto, db *pgxpool.Pool, client *Client) {
	if len(tickets) == 0 {
		return
	}

	missingMap := make(map[int]bool)
	for _, t := range tickets {
		if t.ClientID > 0 {
			if _, ok := clientNamesCache.Load(t.ClientID); !ok {
				missingMap[t.ClientID] = true
			}
		}
	}

	if len(missingMap) > 0 {
		missingIDs := make([]int, 0, len(missingMap))
		for id := range missingMap {
			missingIDs = append(missingIDs, id)
		}

		// 1. Tenta buscar no banco PostgreSQL local
		if db != nil {
			var strCodes []string
			for _, id := range missingIDs {
				strCodes = append(strCodes, strconv.Itoa(id))
			}
			rows, err := db.Query(ctx, "SELECT codigo_rbx, nome FROM clientes WHERE codigo_rbx = ANY($1)", strCodes)
			if err == nil {
				for rows.Next() {
					var codeStr, name string
					if err := rows.Scan(&codeStr, &name); err == nil {
						if cid, err := strconv.Atoi(codeStr); err == nil && name != "" {
							clientNamesCache.Store(cid, SanitizeRbxText(name))
							delete(missingMap, cid)
						}
					}
				}
				rows.Close()
			}
		}

		// 2. Se restar algum e o client RBX estiver disponível, consulta a API do RBX em lotes de 50
		if len(missingMap) > 0 && client != nil {
			var remainingCodes []string
			for id := range missingMap {
				remainingCodes = append(remainingCodes, strconv.Itoa(id))
			}
			for i := 0; i < len(remainingCodes); i += 50 {
				end := i + 50
				if end > len(remainingCodes) {
					end = len(remainingCodes)
				}
				chunk := remainingCodes[i:end]
				addrMap, err := client.ConsultarClientes(ctx, chunk)
				if err == nil && addrMap != nil {
					for codeStr, res := range addrMap {
						if cid, err := strconv.Atoi(codeStr); err == nil && res.Name != "" {
							clientNamesCache.Store(cid, SanitizeRbxText(res.Name))
						}
					}
				}
			}
		}
	}

	// Aplica os nomes resolvidos na lista de tickets
	for i := range tickets {
		if tickets[i].ClientID > 0 {
			if val, ok := clientNamesCache.Load(tickets[i].ClientID); ok {
				tickets[i].ClientName = val.(string)
			} else if tickets[i].ClientName == "" || tickets[i].ClientName == "Cliente não identificado" || tickets[i].ClientName == "Cliente" {
				tickets[i].ClientName = fmt.Sprintf("Cliente #%d", tickets[i].ClientID)
			}
		}
	}
}

// SetCachedClientName define um nome no cache (útil para testes ou pré-carregamento)
func SetCachedClientName(clientID int, name string) {
	clientNamesCache.Store(clientID, name)
}
