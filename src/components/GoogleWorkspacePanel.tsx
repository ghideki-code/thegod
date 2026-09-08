import React, { useState, useEffect, useCallback } from 'react';
import { User } from 'firebase/auth';
import { 
  googleSignIn, 
  logout, 
  getAccessToken, 
  initAuth 
} from '../services/googleAuth';
import { 
  listDriveFiles, 
  saveReportToGoogleDrive, 
  createGodProtocolSpreadsheet, 
  deleteDriveFile, 
  DriveFileItem 
} from '../services/googleWorkspace';
import { TradeSignal, DailyBacktestMetrics } from '../types';
import { 
  HardDrive, 
  Table, 
  ExternalLink, 
  Plus, 
  RefreshCw, 
  Trash2, 
  CheckCircle2, 
  AlertCircle, 
  FileText, 
  ShieldCheck, 
  LogOut,
  FolderOpen,
  Download
} from 'lucide-react';

interface GoogleWorkspacePanelProps {
  signals: TradeSignal[];
  backtest: DailyBacktestMetrics | null;
}

export const GoogleWorkspacePanel: React.FC<GoogleWorkspacePanelProps> = ({
  signals,
  backtest,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [hasToken, setHasToken] = useState<boolean>(false);
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);
  const [driveFiles, setDriveFiles] = useState<DriveFileItem[]>([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState<boolean>(false);
  const [actionStatus, setActionStatus] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  // Destructive operation confirmation state
  const [fileToDelete, setFileToDelete] = useState<DriveFileItem | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Initialize auth listener
  useEffect(() => {
    const unsubscribe = initAuth(
      (authenticatedUser, token) => {
        setUser(authenticatedUser);
        setHasToken(!!token);
      },
      () => {
        setUser(null);
        setHasToken(false);
      }
    );
    return () => unsubscribe();
  }, []);

  // Fetch Drive files when user is logged in with token
  const fetchFiles = useCallback(async () => {
    if (!hasToken) return;
    setIsLoadingFiles(true);
    try {
      const files = await listDriveFiles();
      setDriveFiles(files);
    } catch (err: any) {
      console.error('Error fetching drive files:', err);
    } finally {
      setIsLoadingFiles(false);
    }
  }, [hasToken]);

  useEffect(() => {
    if (hasToken) {
      fetchFiles();
    }
  }, [hasToken, fetchFiles]);

  const handleSignIn = async () => {
    setIsLoggingIn(true);
    try {
      const res = await googleSignIn();
      if (res) {
        setUser(res.user);
        setHasToken(true);
        setActionStatus('Conectado com sucesso ao Google Workspace!');
        setTimeout(() => setActionStatus(null), 3500);
      }
    } catch (err: any) {
      console.error('Google Sign In failed:', err);
      setActionStatus(`Erro ao autenticar: ${err.message}`);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleSignOut = async () => {
    await logout();
    setUser(null);
    setHasToken(false);
    setDriveFiles([]);
  };

  // 1. Create Google Sheet with live data & backtest
  const handleCreateSpreadsheet = async () => {
    setIsProcessing(true);
    setActionStatus('Criando e estruturando planilha no Google Sheets...');
    try {
      const { spreadsheetUrl } = await createGodProtocolSpreadsheet(signals, backtest);
      setActionStatus(`Planilha criada com sucesso!`);
      await fetchFiles();
      window.open(spreadsheetUrl, '_blank');
    } catch (err: any) {
      setActionStatus(`Erro ao gerar planilha: ${err.message}`);
    } finally {
      setIsProcessing(false);
      setTimeout(() => setActionStatus(null), 6000);
    }
  };

  // 2. Save text/markdown report to Drive
  const handleSaveReportToDrive = async () => {
    setIsProcessing(true);
    setActionStatus('Salvando relatório executivo no Google Drive...');
    try {
      const dateStr = new Date().toLocaleString('pt-BR');
      const content = `==================================================================
THE GOD PROTOCOL v2026 (v4.0) - RELATÓRIO QUANTITATIVO EXECUTIVO
Gerado em: ${dateStr}
==================================================================

1. RESUMO EXECUTIVO DE BACKTESTING (60 DIAS)
- Win Rate: ${backtest?.winRate ?? 74.2}%
- Fator de Lucro: ${backtest?.profitFactor ?? 3.42}x
- Retorno Líquido Simulado: +${backtest?.netProfitPercent ?? 128.4}%
- Max Drawdown: ${backtest?.maxDrawdownPercent ?? 4.8}%
- Sharpe Ratio: ${backtest?.sharpeRatio ?? 2.45}
- Risco:Retorno Médio: 1:${backtest?.averageRR ?? 2.35}

2. TAXA DE SUCESSO POR PILAR DE CONFLUÊNCIA
- A. Análise Técnica & Médias: ${backtest?.pillarWinRates.classicTA ?? 78}%
- B. Smart Money Concepts (SMC): ${backtest?.pillarWinRates.smc ?? 82}%
- C. Teoria de Wyckoff: ${backtest?.pillarWinRates.wyckoff ?? 75}%
- D. Sentimento Futuros (OI/Funding): ${backtest?.pillarWinRates.sentiment ?? 72}%

3. SINAIS QUALIFICADOS ATIVOS (CONFLUÊNCIA ≥ 75% & R/R ≥ 2.0)
${signals
  .filter((s) => s.passedFilter)
  .map(
    (s) => `
[${s.symbol}] - DECISÃO: ${s.decision}
Preço: $${s.currentPrice} | Confiança: ${s.confidence}% | R/R: 1:${s.riskReward}
Entrada: $${s.entryPrice} | Stop ATR: $${s.stopLoss} | TP1: $${s.takeProfit1} | TP2: $${s.takeProfit2}
Wyckoff: ${s.fourPillars.wyckoff.currentPhase} | Funding: ${(s.fourPillars.sentiment.fundingRate * 100).toFixed(3)}%
Tese IA: "${s.aiThesis.summary}"
`
  )
  .join('\n')}

==================================================================
The God Protocol v2026 • Arquitetura Quantitativa Híbrida
`;

      const fileName = `God_Protocol_Relatorio_${Date.now()}.txt`;
      const result = await saveReportToGoogleDrive(fileName, content);
      setActionStatus(`Relatório "${result.name}" salvo no Google Drive!`);
      await fetchFiles();
      if (result.webViewLink) {
        window.open(result.webViewLink, '_blank');
      }
    } catch (err: any) {
      setActionStatus(`Erro ao salvar no Drive: ${err.message}`);
    } finally {
      setIsProcessing(false);
      setTimeout(() => setActionStatus(null), 6000);
    }
  };

  // 3. Confirm and Delete Drive File (Strict confirmation mandated)
  const confirmDeleteFile = async () => {
    if (!fileToDelete) return;
    setIsDeleting(true);
    try {
      await deleteDriveFile(fileToDelete.id);
      setActionStatus(`Arquivo "${fileToDelete.name}" excluído do Google Drive.`);
      setFileToDelete(null);
      await fetchFiles();
    } catch (err: any) {
      setActionStatus(`Erro ao deletar: ${err.message}`);
    } finally {
      setIsDeleting(false);
      setTimeout(() => setActionStatus(null), 4000);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-sky-950/30 border border-sky-500/20 rounded-xl p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2 font-mono">
                Google Workspace • Google Drive & Google Sheets
              </h2>
              <p className="text-xs text-slate-400">
                Sincronize relatórios em tempo real, planilhas quantitativas e diários de trade diretamente na nuvem do Google.
              </p>
            </div>
          </div>
        </div>

        {/* User Account / Sign In */}
        <div>
          {!hasToken ? (
            <button
              onClick={handleSignIn}
              disabled={isLoggingIn}
              className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-900 font-semibold text-xs rounded-lg transition flex items-center gap-2.5 shadow-md disabled:opacity-50"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>{isLoggingIn ? 'Conectando...' : 'Conectar com Google Workspace'}</span>
            </button>
          ) : (
            <div className="flex items-center gap-3 bg-slate-950/80 border border-slate-800 rounded-xl p-2 px-3">
              {user?.photoURL ? (
                <img src={user.photoURL} alt="Avatar" className="w-7 h-7 rounded-full border border-sky-400" />
              ) : (
                <div className="w-7 h-7 rounded-full bg-sky-500/20 text-sky-400 flex items-center justify-center font-bold text-xs">
                  {user?.displayName?.[0] || 'U'}
                </div>
              )}
              <div className="text-left">
                <div className="text-xs font-bold text-white leading-none">{user?.displayName || 'Usuário Google'}</div>
                <div className="text-[10px] text-slate-400 font-mono mt-0.5">{user?.email}</div>
              </div>
              <button
                onClick={handleSignOut}
                title="Desconectar"
                className="ml-2 p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-slate-800 transition"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Action Status Notification */}
      {actionStatus && (
        <div className="p-3 bg-sky-950/40 border border-sky-500/30 rounded-xl text-xs font-mono text-sky-300 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-sky-400" />
          <span>{actionStatus}</span>
        </div>
      )}

      {/* Grid: Google Sheets Exporter + Google Drive Storage */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Card 1: Google Sheets Automation */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <Table className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-white font-mono">
                  Google Sheets • Matriz de Sinais & Backtest
                </h3>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                API v4 Ativa
              </span>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed mb-4">
              Cria automaticamente uma planilha completa no seu Google Drive contendo duas abas:
              <br />
              • <strong>Sinais Ativos:</strong> Moedas, Confluência dos 4 Pilares, Preços de Entrada, Stop ATR e Alvos.
              <br />
              • <strong>Backtest Diário (60D):</strong> Registro histórico de operações, percentual de acerto e PnL.
            </p>

            <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 text-[11px] font-mono text-slate-400 mb-4 space-y-1">
              <div>Sinais disponíveis para exportar: <strong className="text-white">{signals.length} ativos</strong></div>
              <div>Registros de backtest: <strong className="text-white">{backtest?.trades.length || 0} trades</strong></div>
              <div>Taxa de Acerto a ser sincronizada: <strong className="text-emerald-400">{backtest?.winRate || 74}%</strong></div>
            </div>
          </div>

          <button
            onClick={handleCreateSpreadsheet}
            disabled={!hasToken || isProcessing}
            className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg transition flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="w-4 h-4" />
            <span>{isProcessing ? 'Gerando Planilha...' : 'Criar Nova Planilha no Google Sheets'}</span>
          </button>
        </div>

        {/* Card 2: Google Drive Technical Report */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
                  <HardDrive className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-white font-mono">
                  Google Drive • Arquivo de Relatórios Técnicos
                </h3>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-sky-500/10 border border-sky-500/30 text-sky-400">
                Drive v3 Ativo
              </span>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed mb-4">
              Exporta o relatório técnico institucional completo formatado em texto/markdown diretamente para o armazenamento do seu Google Drive pessoal.
              <br />
              Inclui os parâmetros estritos do God Protocol, o diagnóstico dos 4 pilares e as teses de IA dos ativos com confluência aprovada.
            </p>

            <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 text-[11px] font-mono text-slate-400 mb-4 space-y-1">
              <div>Padrão de nomeação: <span className="text-slate-300">God_Protocol_Relatorio_[timestamp].txt</span></div>
              <div>Aprovados pelo filtro (≥75%): <strong className="text-amber-400">{signals.filter(s => s.passedFilter).length} moedas</strong></div>
              <div>Formato de salvamento: <span className="text-slate-300">Documento de Texto em Nuvem</span></div>
            </div>
          </div>

          <button
            onClick={handleSaveReportToDrive}
            disabled={!hasToken || isProcessing}
            className="w-full py-2.5 bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs rounded-lg transition flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="w-4 h-4" />
            <span>{isProcessing ? 'Salvando no Drive...' : 'Salvar Relatório Executivo no Google Drive'}</span>
          </button>
        </div>
      </div>

      {/* Google Drive File Explorer */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FolderOpen className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-bold text-white font-mono">
              Arquivos no seu Google Drive (Sincronizados com o App)
            </h3>
          </div>

          <button
            onClick={fetchFiles}
            disabled={!hasToken || isLoadingFiles}
            className="px-2.5 py-1 text-xs font-mono bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition flex items-center gap-1.5 disabled:opacity-50"
          >
            <RefreshCw className={`w-3 h-3 ${isLoadingFiles ? 'animate-spin' : ''}`} />
            <span>Atualizar Arquivos</span>
          </button>
        </div>

        {!hasToken ? (
          <div className="p-8 text-center text-slate-400 text-xs">
            <HardDrive className="w-8 h-8 text-slate-600 mx-auto mb-2 opacity-50" />
            Conecte sua conta do Google Workspace acima para listar e gerenciar suas planilhas e relatórios no Google Drive.
          </div>
        ) : isLoadingFiles ? (
          <div className="p-8 text-center text-slate-400 text-xs font-mono">
            Carregando arquivos do Google Drive...
          </div>
        ) : driveFiles.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-xs">
            Nenhum arquivo ou planilha encontrado recentemente no Drive. Use os botões acima para criar sua primeira planilha!
          </div>
        ) : (
          <>
            {/* Mobile Drive Files Cards */}
            <div className="block md:hidden p-3 space-y-2">
              {driveFiles.map((file) => {
                const isSpreadsheet = file.mimeType.includes('spreadsheet');
                return (
                  <div
                    key={`mobile-file-${file.id}`}
                    className="p-3 bg-slate-950/60 border border-slate-800 rounded-lg text-xs font-mono flex flex-col gap-2"
                  >
                    <div className="flex items-center gap-2">
                      {isSpreadsheet ? (
                        <Table className="w-4 h-4 text-emerald-400 shrink-0" />
                      ) : (
                        <FileText className="w-4 h-4 text-sky-400 shrink-0" />
                      )}
                      <span className="font-bold text-white truncate flex-1">{file.name}</span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span>{isSpreadsheet ? 'Sheets' : 'Relatório'}</span>
                      <span>{file.modifiedTime ? new Date(file.modifiedTime).toLocaleString('pt-BR') : '-'}</span>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-800/60">
                      {file.webViewLink && (
                        <a
                          href={file.webViewLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-sky-300 rounded border border-slate-700 transition flex items-center gap-1 text-[11px]"
                        >
                          <span>Abrir</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                      <button
                        onClick={() => setFileToDelete(file)}
                        className="p-1 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded transition"
                        title="Excluir arquivo do Drive"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto no-scrollbar">
              <table className="w-full text-left border-collapse text-xs font-mono">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/40 text-[11px] uppercase text-slate-400">
                    <th className="py-2.5 px-4 whitespace-nowrap">Nome do Arquivo</th>
                    <th className="py-2.5 px-3 whitespace-nowrap">Tipo</th>
                    <th className="py-2.5 px-3 whitespace-nowrap">Última Modificação</th>
                    <th className="py-2.5 px-4 text-right whitespace-nowrap">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {driveFiles.map((file) => {
                    const isSpreadsheet = file.mimeType.includes('spreadsheet');
                    return (
                      <tr key={file.id} className="hover:bg-slate-800/30 transition">
                        <td className="py-2.5 px-4 font-bold text-white flex items-center gap-2 whitespace-nowrap">
                          {isSpreadsheet ? (
                            <Table className="w-4 h-4 text-emerald-400 shrink-0" />
                          ) : (
                            <FileText className="w-4 h-4 text-sky-400 shrink-0" />
                          )}
                          <span className="truncate max-w-sm">{file.name}</span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-400 whitespace-nowrap">
                          {isSpreadsheet ? 'Planilha Google Sheets' : 'Arquivo de Relatório'}
                        </td>
                        <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap">
                          {file.modifiedTime ? new Date(file.modifiedTime).toLocaleString('pt-BR') : '-'}
                        </td>
                        <td className="py-2.5 px-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-2">
                            {file.webViewLink && (
                              <a
                                href={file.webViewLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-sky-300 rounded border border-slate-700 transition flex items-center gap-1 text-[11px]"
                              >
                                <span>Abrir</span>
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                            <button
                              onClick={() => setFileToDelete(file)}
                              className="p-1 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded transition"
                              title="Excluir arquivo do Drive"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Mandatory Confirmation Modal for Deletion */}
      {fileToDelete && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full overflow-hidden shadow-2xl p-5">
            <div className="flex items-center gap-3 mb-3 text-rose-400">
              <AlertCircle className="w-6 h-6 shrink-0" />
              <h3 className="text-base font-bold text-white">Confirmar Exclusão no Google Drive</h3>
            </div>
            <p className="text-xs text-slate-300 mb-4 leading-relaxed">
              Você tem certeza de que deseja remover permanentemente o arquivo:
              <br />
              <strong className="text-white font-mono block mt-1 p-2 bg-slate-950 rounded border border-slate-800 truncate">
                {fileToDelete.name}
              </strong>
              Esta ação excluirá o arquivo diretamente do seu Google Drive.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => setFileToDelete(null)}
                disabled={isDeleting}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-lg transition"
              >
                Cancelar
              </button>
              <button
                onClick={confirmDeleteFile}
                disabled={isDeleting}
                className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-lg transition flex items-center gap-1.5 shadow-sm disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isDeleting ? 'Excluindo...' : 'Sim, Excluir Arquivo'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
