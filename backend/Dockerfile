# Estágio 1: Build da aplicação Go
FROM golang:alpine AS builder

WORKDIR /app

# Instala certificados SSL e ferramentas de build
RUN apk add --no-cache git ca-certificates tzdata

# Baixa dependências
COPY go.mod go.sum ./
RUN go mod download

# Copia código-fonte
COPY . .

# Compilação estática do binário em Linux
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /app/evad-server ./cmd/server

# Estágio 2: Container final enxuto e seguro
FROM alpine:3.20

WORKDIR /app

# Certificados raiz para conexões HTTPS (API RBX) e Timezone de São Paulo
RUN apk add --no-cache ca-certificates tzdata
ENV TZ=America/Sao_Paulo

# Copia binário compilado
COPY --from=builder /app/evad-server /app/evad-server

# Expõe a porta interna da API
EXPOSE 8081

# Healthcheck interno
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8081/api/health || exit 1

CMD ["/app/evad-server"]
