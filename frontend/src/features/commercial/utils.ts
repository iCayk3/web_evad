/**
 * Utilitários de formatação para o módulo CRM Comercial
 */

/**
 * Converte data de AAAA-MM-DD (ou string ISO) para DD-MM-AAAA.
 * Se contiver horário (ex: 2026-08-30T14:30), retorna 'DD-MM-AAAA HH:mm'.
 */
export function formatDateBR(dateStr?: string | null): string {
  if (!dateStr) return '';
  const clean = String(dateStr).trim();
  if (!clean) return '';

  // Caso ISO com horário (ex: 2026-08-30T14:30:00 ou 2026-08-30 14:30)
  if (clean.includes('T') || (clean.includes(':') && clean.includes('-'))) {
    const parts = clean.replace('T', ' ').split(' ');
    const dPart = parts[0];
    const tPart = parts[1] || '';
    const [y, m, d] = dPart.split('-');
    if (y && m && d && y.length === 4) {
      const timeClean = tPart ? tPart.slice(0, 5) : '';
      return timeClean ? `${d}-${m}-${y} ${timeClean}` : `${d}-${m}-${y}`;
    }
  }

  // Caso AAAA-MM-DD simples
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
    const [y, m, d] = clean.split('-');
    return `${d}-${m}-${y}`;
  }

  // Caso já esteja em DD/MM/AAAA ou DD-MM-AAAA
  if (/^\d{2}[-/]\d{2}[-/]\d{4}/.test(clean)) {
    return clean.replace(/\//g, '-');
  }

  // Tentar conversão via objeto Date caso seja outro formato ISO válido
  try {
    const dt = new Date(clean);
    if (!isNaN(dt.getTime())) {
      const d = String(dt.getDate()).padStart(2, '0');
      const m = String(dt.getMonth() + 1).padStart(2, '0');
      const y = dt.getFullYear();
      return `${d}-${m}-${y}`;
    }
  } catch {
    // Retorna string original caso não consiga fazer o parse
  }

  return clean;
}
