/**
 * Central de configuração da URL Base da API do EVAD.
 * Se VITE_API_URL estiver vazia ou não informada, utiliza caminhos relativos (/api),
 * garantindo compatibilidade automática com Docker (Nginx Reverse Proxy) e Vite Dev Proxy.
 */
export const API_BASE = import.meta.env.VITE_API_URL ?? '';
