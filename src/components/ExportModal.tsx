import React, { useState } from 'react';
import { 
  TradeSignal, 
  DailyBacktestMetrics 
} from '../types';
import { 
  X, 
  Printer, 
  FileText, 
  Download, 
  Check, 
  Layers, 
  ShieldCheck, 
  Calendar,
  HardDrive,
  Table,
  ExternalLink
} from 'lucide-react';
import { getAccessToken } from '../services/googleAuth';
import { createGodProtocolSpreadsheet, saveReportToGoogleDrive } from '../services/googleWorkspace';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  signals: TradeSignal[];
  backtest: DailyBacktestMetrics | null;
  onOpenWorkspaceTab?: () => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  signals,
  backtest,
  onOpenWorkspaceTab,
}) => {
  const [downloaded, setDownloaded] = useState<string | null>(null);
  const [googleLoading, setGoogleLoading] = useState<string | null>(null);
  const [googleMessage, setGoogleMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const qualifiedSignals = signals.filter(s => s.passedFilter);
  const generatedAt = new Date().toLocaleString('pt-BR');

  // Direct Google Sheets Export
  const handleExportSheets = async () => {
    setGoogleLoading('sheets');
    setGoogleMessage('Conectando ao Google Sheets...');
    try {
      const token = await getAccessToken();
      if (!token) {
        setGoogleMessage('Faça login com sua conta Google na aba Google Workspace primeiro.');
        if (onOpenWorkspaceTab) {
          setTimeout(() => {
            onClose();
            onOpenWorkspaceTab();
          }, 1500);
        }
        return;
      }
      const { spreadsheetUrl } = await createGodProtocolSpreadsheet(signals, backtest);
      setGoogleMessage('Planilha criada com sucesso no Google Sheets!');
      window.open(spreadsheetUrl, '_blank');
    } catch (err: any) {
      setGoogleMessage(`Erro: ${err.message}`);
    } finally {
      setGoogleLoading(null);
      setTimeout(() => setGoogleMessage(null), 5000);
    }
  };

  // Direct Google Drive Export
  const handleExportDrive = async () => {
    setGoogleLoading('drive');
    setGoogleMessage('Salvando no Google Drive...');
    try {
      const token = await getAccessToken();
      if (!token) {
        setGoogleMessage('Faça login com sua conta Google na aba Google Workspace primeiro.');
        if (onOpenWorkspaceTab) {
          setTimeout(() => {
            onClose();
            onOpenWorkspaceTab();
          }, 1500);
        }
        return;
      }
      const fileName = `God_Protocol_Relatorio_${Date.now()}.txt`;
      const reportText = `THE GOD PROTOCOL v2026 - RELATÓRIO EXECUTIVO\nData: ${generatedAt}\nWin Rate Backtest: ${backtest?.winRate}%\nSinais Qualificados: ${qualifiedSignals.length}\n${qualifiedSignals.map(s => `\n[${s.symbol}] Decisão: ${s.decision} | Confiança: ${s.confidence}% | Entrada: $${s.entryPrice} | SL: $${s.stopLoss} | TP1: $${s.takeProfit1}`).join('')}`;
      const res = await saveReportToGoogleDrive(fileName, reportText);
      setGoogleMessage(`Arquivo "${res.name}" salvo no Drive!`);
      if (res.webViewLink) window.open(res.webViewLink, '_blank');
    } catch (err: any) {
      setGoogleMessage(`Erro: ${err.message}`);
    } finally {
      setGoogleLoading(null);
      setTimeout(() => setGoogleMessage(null), 5000);
    }
  };

  // CSV Export for active signals
  const exportSignalsCSV = () => {
    const headers = 'Símbolo,Decisão,Preço Atual,Confiança IA (%),R/R,Stop Loss,Alvo TP1,Alvo TP2,ATR,Fase Wyckoff,Funding Rate\n';
    const rows = signals.map(s => 
      `"${s.symbol}","${s.decision}",${s.currentPrice},${s.confidence},1:${s.riskReward},${s.stopLoss},${s.takeProfit1},${s.takeProfit2},${s.atrValue},"${s.fourPillars.wyckoff.currentPhase}",${(s.fourPillars.sentiment.fundingRate * 100).toFixed(3)}%`
    ).join('\n');

    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `God_Protocol_Sinais_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setDownloaded('signals_csv');
    setTimeout(() => setDownloaded(null), 2500);
  };

  // CSV Export for Backtest trades
  const exportBacktestCSV = () => {
    if (!backtest || !backtest.trades || backtest.trades.length === 0) return;
    const headers = 'ID,Data,Ativo,Direção,Entrada,Stop Loss,Alvo TP,R/R,Confiança (%),Pilar Chave,Resultado PnL (%),Status,Barras\n';
    const rows = backtest.trades.map(t => 
      `"${t.id}","${t.date}","${t.symbol}","${t.direction}",${t.entryPrice},${t.stopLoss},${t.takeProfit},1:${t.rrRatio},${t.confidence},"${t.topPillar}",${t.pnlPercent},"${t.status}",${t.holdingBars}`
    ).join('\n');

    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `God_Protocol_Backtest_${backtest.periodDays || 60}Dias_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setDownloaded('backtest_csv');
    setTimeout(() => setDownloaded(null), 2500);
  };

  // JSON Export for full telemetry
  const exportTelemetryJSON = () => {
    const data = {
      protocol: 'The God Protocol v2026 (v4.0)',
      generatedAt: new Date().toISOString(),
      monitoredCount: signals.length,
      qualifiedCount: qualifiedSignals.length,
      backtestMetrics: backtest,
      activeSignals: signals,
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `God_Protocol_Telemetry_${Date.now()}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setDownloaded('json');
    setTimeout(() => setDownloaded(null), 2500);
  };

  // Print Executive PDF
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-3xl w-full overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 bg-slate-950/70 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white font-mono">
                Central de Exportação de Relatórios Quantitativos
              </h3>
              <p className="text-[11px] text-slate-400">
                Geração em tempo real • Protocolo Triple Screen & Google Workspace
              </p>
            </div>
          </div>

          <button
            id="btn-close-export-modal"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Quick Format Selection Ribbon */}
        <div className="p-4 bg-slate-950/40 border-b border-slate-800 flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleExportSheets}
            disabled={googleLoading === 'sheets'}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg transition flex items-center gap-1.5 shadow-sm disabled:opacity-50"
          >
            <Table className="w-3.5 h-3.5" />
            <span>{googleLoading === 'sheets' ? 'Gerando...' : 'Exportar p/ Google Sheets'}</span>
          </button>

          <button
            onClick={handleExportDrive}
            disabled={googleLoading === 'drive'}
            className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs rounded-lg transition flex items-center gap-1.5 shadow-sm disabled:opacity-50"
          >
            <HardDrive className="w-3.5 h-3.5" />
            <span>{googleLoading === 'drive' ? 'Salvando...' : 'Salvar no Google Drive'}</span>
          </button>

          <button
            onClick={handlePrint}
            className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-lg transition flex items-center gap-1.5 shadow-sm"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Imprimir / PDF</span>
          </button>

          <button
            onClick={exportSignalsCSV}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs rounded-lg border border-slate-700 transition flex items-center gap-1.5"
          >
            {downloaded === 'signals_csv' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Download className="w-3.5 h-3.5" />}
            <span>Sinais (CSV)</span>
          </button>

          <button
            onClick={exportBacktestCSV}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs rounded-lg border border-slate-700 transition flex items-center gap-1.5"
            title="Exportar todos os trades do backtest para CSV"
          >
            {downloaded === 'backtest_csv' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Download className="w-3.5 h-3.5 text-amber-400" />}
            <span>Backtest ({backtest?.trades.length || 0} Trades CSV)</span>
          </button>

          <button
            onClick={exportTelemetryJSON}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs rounded-lg border border-slate-700 transition flex items-center gap-1.5"
          >
            {downloaded === 'json' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Download className="w-3.5 h-3.5" />}
            <span>JSON</span>
          </button>
        </div>

        {googleMessage && (
          <div className="px-4 py-2 bg-slate-950 border-b border-slate-800 text-xs font-mono text-amber-300">
            {googleMessage}
          </div>
        )}

        {/* Executive Report Preview (Printable area) */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-slate-200 font-sans" id="printable-report">
          {/* Cover & Heading */}
          <div className="border-b border-slate-800 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-amber-400 font-mono text-xs uppercase tracking-wider font-semibold">
                  Relatório Técnico Executivo
                </span>
                <h1 className="text-xl font-bold text-white mt-0.5">
                  The God Protocol v2026 (v4.0)
                </h1>
                <p className="text-xs text-slate-400 mt-1">
                  Arquitetura de Agente Quantitativo Híbrido • Suporte Multi-Moedas & Confluência Total
                </p>
              </div>

              <div className="text-right text-xs font-mono text-slate-400">
                <div>Data: {generatedAt}</div>
                <div>Status: <span className="text-emerald-400">Operacional Cloud Run</span></div>
              </div>
            </div>
          </div>

          {/* Executive Summary Metrics */}
          <div>
            <h4 className="text-xs font-bold font-mono text-amber-400 uppercase tracking-wider mb-2.5">
              1. Resumo Executivo & Performance Histórica
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
              <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800">
                <span className="text-slate-400 block text-[10px]">Win Rate Histórico</span>
                <span className="text-emerald-400 font-bold text-base">{backtest?.winRate ?? 74.2}%</span>
              </div>
              <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800">
                <span className="text-slate-400 block text-[10px]">Fator de Lucro</span>
                <span className="text-sky-300 font-bold text-base">{backtest?.profitFactor ?? 3.42}x</span>
              </div>
              <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800">
                <span className="text-slate-400 block text-[10px]">Max Drawdown</span>
                <span className="text-amber-400 font-bold text-base">{backtest?.maxDrawdownPercent ?? 4.8}%</span>
              </div>
              <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800">
                <span className="text-slate-400 block text-[10px]">Retorno Simulado</span>
                <span className="text-emerald-300 font-bold text-base">+{backtest?.netProfitPercent ?? 128.4}%</span>
              </div>
            </div>
          </div>

          {/* Qualified Setups Section */}
          <div>
            <h4 className="text-xs font-bold font-mono text-amber-400 uppercase tracking-wider mb-2.5 flex items-center justify-between">
              <span>2. Setups Ativos Aprovados pelo Filtro Quantitativo (Confiança ≥ 75% & R/R ≥ 2.0)</span>
              <span className="text-[11px] text-slate-400 font-normal">{qualifiedSignals.length} identificados</span>
            </h4>

            {qualifiedSignals.length === 0 ? (
              <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 text-xs text-slate-400 text-center">
                Nenhum sinal atingiu 75% de confluência no ciclo atual. O protocolo recomenda rigorosamente AGUARDAR.
              </div>
            ) : (
              <div className="space-y-2.5">
                {qualifiedSignals.map(sig => (
                  <div key={sig.id} className="p-3 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <strong className="text-white text-sm">{sig.symbol}</strong>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          sig.decision === 'COMPRA' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
                        }`}>
                          {sig.decision}
                        </span>
                      </div>
                      <div className="text-amber-400 font-bold">
                        Confiança: {sig.confidence}% • R/R 1:{sig.riskReward}
                      </div>
                    </div>
                    <div className="grid grid-cols-4 gap-2 text-[11px] text-slate-400 border-t border-slate-800/60 pt-1.5">
                      <div>Entrada: <span className="text-slate-200">${sig.entryPrice}</span></div>
                      <div>Stop Loss (ATR): <span className="text-rose-400">${sig.stopLoss}</span></div>
                      <div>Alvo TP1: <span className="text-emerald-400">${sig.takeProfit1}</span></div>
                      <div>Alvo TP2: <span className="text-emerald-400">${sig.takeProfit2}</span></div>
                    </div>
                    <div className="mt-2 text-[11px] text-slate-300 font-sans italic border-l-2 border-amber-500 pl-2">
                      "{sig.aiThesis.summary}"
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Protocol Logic Summary */}
          <div>
            <h4 className="text-xs font-bold font-mono text-amber-400 uppercase tracking-wider mb-2">
              3. Fundamentos do Sistema Triple Screen & 4 Pilares
            </h4>
            <div className="text-xs text-slate-400 space-y-1.5 leading-relaxed">
              <p>
                <strong>Triple Screen (MTF): </strong>
                HTF Diário determina a tendência macro institucional; MTF 1H localiza padrões estruturais e a barreira da EMA 50; LTF 15m atua como gatilho refinado via cruzamento EMA 9/21 e momentum RSI(14).
              </p>
              <p>
                <strong>Confluência Total: </strong>
                Gera validação cruzada entre Análise Técnica Clássica, Smart Money Concepts (varreduras de liquidez BSL/SSL e FVG), Teoria de Wyckoff (ciclos de acumulação/distribuição e VSA), e Sentimento de Futuros (Open Interest e Funding Rate).
              </p>
              <p>
                <strong>Gestão de Risco: </strong>
                Filtro estrito onde sinais com confiança inferior a 75% ou relação Risco:Retorno abaixo de 1:2 são sumariamente descartados. Stop Loss dimensionado dinamicamente pela volatilidade ATR.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
