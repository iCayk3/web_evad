# Estágio 1: Build do Frontend React + Vite
FROM node:22-alpine AS builder

WORKDIR /app

# Instala dependências
COPY package.json package-lock.json ./
RUN npm ci

# Copia código-fonte
COPY . .

# Argumento opcional para API URL (vazio por padrão para usar proxy reverso do Nginx)
ARG VITE_API_URL=""
ENV VITE_API_URL=$VITE_API_URL

# Compila arquivos de produção
RUN npm run build

# Estágio 2: Nginx Web Server
FROM nginx:1.27-alpine

# Remove configuração padrão
RUN rm -f /etc/nginx/conf.d/default.conf

# Copia configuração customizada de proxy e cache
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copia build estático do React
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
