import { getAccessToken } from './googleAuth';
import { TradeSignal, DailyBacktestMetrics } from '../types';

export interface DriveFileItem {
  id: string;
  name: string;
  mimeType: string;
  webViewLink?: string;
  createdTime?: string;
  modifiedTime?: string;
}

/**
 * List files created or accessible in user's Google Drive
 */
export async function listDriveFiles(query = "trashed = false"): Promise<DriveFileItem[]> {
  const token = await getAccessToken();
  if (!token) throw new Error('Não autenticado com Google Workspace.');

  const encodedQuery = encodeURIComponent(query);
  const url = `https://www.googleapis.com/drive/v3/files?q=${encodedQuery}&fields=files(id,name,mimeType,webViewLink,createdTime,modifiedTime)&orderBy=modifiedTime desc&pageSize=25`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `Erro ao listar arquivos do Drive (${res.status})`);
  }

  const data = await res.json();
  return data.files || [];
}

/**
 * Upload a text or markdown report file directly into Google Drive
 */
export async function saveReportToGoogleDrive(
  fileName: string,
  content: string,
  mimeType = 'text/plain'
): Promise<DriveFileItem> {
  const token = await getAccessToken();
  if (!token) throw new Error('Não autenticado com Google Workspace.');

  const metadata = {
    name: fileName,
    mimeType: mimeType,
    description: 'Relatório Técnico gerado pelo The God Protocol v2026',
  };

  const boundary = '-------314159265358979323846';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const multipartRequestBody =
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    `Content-Type: ${mimeType}; charset=UTF-8\r\n\r\n` +
    content +
    closeDelimiter;

  const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,webViewLink', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body: multipartRequestBody,
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `Erro ao salvar arquivo no Drive (${res.status})`);
  }

  return await res.json();
}

/**
 * Delete a file from Google Drive with required safety check
 */
export async function deleteDriveFile(fileId: string): Promise<void> {
  const token = await getAccessToken();
  if (!token) throw new Error('Não autenticado com Google Workspace.');

  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `Erro ao deletar arquivo no Drive (${res.status})`);
  }
}

/**
 * Create a rich Google Sheets spreadsheet with live signals and backtest history
 */
export async function createGodProtocolSpreadsheet(
  signals: TradeSignal[],
  backtest: DailyBacktestMetrics | null
): Promise<{ spreadsheetId: string; spreadsheetUrl: string }> {
  const token = await getAccessToken();
  if (!token) throw new Error('Não autenticado com Google Workspace.');

  const dateStr = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-');
  const title = `The God Protocol v2026 - Matriz de Sinais & Backtest (${dateStr})`;

  // 1. Create Spreadsheet
  const createPayload = {
    properties: {
      title,
    },
    sheets: [
      {
        properties: {
          title: 'Sinais Ativos',
          gridProperties: {
            frozenRowCount: 1,
          },
        },
      },
      {
        properties: {
          title: 'Backtest Diário (60D)',
          gridProperties: {
            frozenRowCount: 1,
          },
        },
      },
    ],
  };

  const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(createPayload),
  });

  if (!createRes.ok) {
    const errorData = await createRes.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `Erro ao criar planilha no Google Sheets (${createRes.status})`);
  }

  const createdSheet = await createRes.json();
  const spreadsheetId = createdSheet.spreadsheetId;
  const spreadsheetUrl = createdSheet.spreadsheetUrl;

  // 2. Populate 'Sinais Ativos'
  const signalHeaders = [
    'Símbolo',
    'Nome',
    'Decisão',
    'Preço Atual (USDT)',
    'Variação 24h (%)',
    'Confiança IA (%)',
    'R/R Proporção',
    'Preço Entrada',
    'Stop Loss (ATR Dinâmico)',
    'Alvo TP1 (1:2)',
    'Alvo TP2 (1:3)',
    'ATR (Volatilidade)',
    'Fase Wyckoff',
    'Funding Rate (%)',
    'Status Confluência',
    'Tese Institucional IA',
  ];

  const signalRows = signals.map((s) => [
    s.symbol,
    s.name,
    s.decision,
    s.currentPrice,
    `${s.change24h}%`,
    `${s.confidence}%`,
    `1:${s.riskReward}`,
    s.entryPrice,
    s.stopLoss,
    s.takeProfit1,
    s.takeProfit2,
    s.atrValue,
    s.fourPillars.wyckoff.currentPhase,
    `${(((s.fourPillars?.sentiment?.fundingRate ?? 0.0001) * 100)).toFixed(3)}%`,
    s.passedFilter ? 'CONFLUÊNCIA APROVADA' : 'AGUARDANDO CONFLUÊNCIA',
    s.aiThesis.summary,
  ]);

  await appendSheetValues(spreadsheetId, 'Sinais Ativos!A1', [signalHeaders, ...signalRows], token);

  // 3. Populate 'Backtest Diário (60D)'
  if (backtest && backtest.trades && backtest.trades.length > 0) {
    const backtestHeaders = [
      'Data Operação',
      'Ativo',
      'Direção',
      'Preço Entrada',
      'Stop Loss',
      'Take Profit',
      'Preço Saída',
      'Risco:Retorno',
      'Confiança IA (%)',
      'Pilar Predominante',
      'Resultado PnL (%)',
      'Status Operação',
    ];

    const backtestRows = backtest.trades.map((t) => [
      t.date,
      t.symbol,
      t.direction,
      t.entryPrice,
      t.stopLoss,
      t.takeProfit,
      t.exitPrice,
      `1:${t.rrRatio}`,
      `${t.confidence}%`,
      t.topPillar,
      `${t.pnlPercent}%`,
      t.status,
    ]);

    await appendSheetValues(spreadsheetId, 'Backtest Diário (60D)!A1', [backtestHeaders, ...backtestRows], token);
  }

  return { spreadsheetId, spreadsheetUrl };
}

/**
 * Append or write rows to a sheet range
 */
async function appendSheetValues(
  spreadsheetId: string,
  range: string,
  values: any[][],
  token: string
): Promise<void> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(
    range
  )}:append?valueInputOption=USER_ENTERED`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ values }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    console.warn('Erro ao popular range no Google Sheets:', err);
  }
}
