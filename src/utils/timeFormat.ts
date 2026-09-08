/**
 * Utility functions for formatting timestamps in Horário de Brasília (BRT / UTC-3).
 */

export function formatBrasiliaTime(timestamp: number | Date = Date.now(), includeSeconds = true): string {
  const date = typeof timestamp === 'number' ? new Date(timestamp) : timestamp;
  try {
    return date.toLocaleTimeString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      hour: '2-digit',
      minute: '2-digit',
      ...(includeSeconds ? { second: '2-digit' } : {}),
    });
  } catch (e) {
    // Fallback in case Intl timezone is unavailable
    const d = new Date(date.getTime() - 3 * 3600 * 1000);
    const h = String(d.getUTCHours()).padStart(2, '0');
    const m = String(d.getUTCMinutes()).padStart(2, '0');
    const s = String(d.getUTCSeconds()).padStart(2, '0');
    return includeSeconds ? `${h}:${m}:${s}` : `${h}:${m}`;
  }
}

export function formatBrasiliaDate(timestamp: number | Date = Date.now()): string {
  const date = typeof timestamp === 'number' ? new Date(timestamp) : timestamp;
  try {
    return date.toLocaleDateString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch (e) {
    const d = new Date(date.getTime() - 3 * 3600 * 1000);
    const day = String(d.getUTCDate()).padStart(2, '0');
    const month = String(d.getUTCMonth() + 1).padStart(2, '0');
    const year = d.getUTCFullYear();
    return `${day}/${month}/${year}`;
  }
}

export function formatBrasiliaDateTime(timestamp: number | Date = Date.now()): string {
  return `${formatBrasiliaDate(timestamp)} ${formatBrasiliaTime(timestamp, true)}`;
}

export function formatMarketCap(mcap?: number): string {
  if (!mcap || mcap <= 0) return '—';
  if (mcap >= 1e12) return `$${(mcap / 1e12).toFixed(2)}T`;
  if (mcap >= 1e9) return `$${(mcap / 1e9).toFixed(2)}B`;
  if (mcap >= 1e6) return `$${(mcap / 1e6).toFixed(1)}M`;
  return `$${mcap.toLocaleString()}`;
}
