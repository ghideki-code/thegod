import React from 'react';
import { 
  SystemNotification 
} from '../types';
import { 
  X, 
  Bell, 
  Check, 
  Trash2, 
  AlertTriangle, 
  Zap, 
  ArrowRight,
  Clock,
  Sliders
} from 'lucide-react';
import { formatBrasiliaTime } from '../utils/timeFormat';

interface NotificationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: SystemNotification[];
  onMarkAllRead: () => void;
  onClearAll: () => void;
  onSelectSymbol?: (symbol: string) => void;
  onOpenSoundSettings?: () => void;
}

export const NotificationDrawer: React.FC<NotificationDrawerProps> = ({
  isOpen,
  onClose,
  notifications,
  onMarkAllRead,
  onClearAll,
  onSelectSymbol,
  onOpenSoundSettings,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div 
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
      />

      {/* Slide-over panel */}
      <div className="fixed inset-y-0 right-0 max-w-full flex pl-0 sm:pl-10">
        <div className="w-full sm:w-screen max-w-full sm:max-w-md bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col">
          {/* Header */}
          <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/80">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <Bell className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white font-mono flex items-center gap-1.5">
                  <span>Avisos Críticos do Sistema</span>
                </h3>
                <div className="flex items-center gap-1.5 text-[11px] text-amber-400/90 font-mono">
                  <Clock className="w-3 h-3 text-amber-400" />
                  <span>Horário de Brasília (BRT / UTC-3)</span>
                </div>
              </div>
            </div>

            <button
              id="btn-close-notification-drawer"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Action Bar */}
          <div className="px-4 py-2 bg-slate-950/40 border-b border-slate-800/80 flex items-center justify-between text-xs">
            <div className="text-[11px] text-slate-400">
              <span className="text-white font-bold">{notifications.filter(n => !n.read).length}</span> pendentes
            </div>

            <div className="flex items-center gap-3">
              {onOpenSoundSettings && (
                <button
                  id="btn-drawer-sound-settings"
                  onClick={onOpenSoundSettings}
                  className="text-slate-400 hover:text-amber-400 transition flex items-center gap-1 text-[11px]"
                  title="Personalizar tons para cada tipo de sinal"
                >
                  <Sliders className="w-3.5 h-3.5 text-amber-400" />
                  <span>Sons</span>
                </button>
              )}

              <button
                id="btn-mark-all-read"
                onClick={onMarkAllRead}
                className="text-slate-400 hover:text-emerald-400 transition flex items-center gap-1 text-[11px]"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Marcar lidas</span>
              </button>

              <button
                id="btn-clear-notifications"
                onClick={onClearAll}
                className="text-slate-400 hover:text-rose-400 transition flex items-center gap-1 text-[11px]"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Limpar</span>
              </button>
            </div>
          </div>

          {/* Notifications List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {notifications.length === 0 ? (
              <div className="h-48 flex flex-col items-center justify-center text-center text-slate-500 text-xs">
                <Bell className="w-8 h-8 text-slate-600 mb-2 opacity-50" />
                <span>Nenhum aviso no momento.</span>
                <span className="text-[10px] text-slate-600 mt-1">O bot emite alertas automáticos em Horário de Brasília para setups qualificados (≥75%) e anomalias nas 100 maiores criptos.</span>
              </div>
            ) : (
              notifications.map((notif) => {
                const isCritical = notif.severity === 'high';
                const isFunding = notif.type === 'FUNDING_ALERT';
                // Always display Brasília Time
                const formattedTime = formatBrasiliaTime(notif.timestamp || Date.now(), true);

                return (
                  <div
                    key={notif.id}
                    className={`p-3.5 rounded-xl border transition relative ${
                      isCritical
                        ? 'bg-slate-950 border-amber-500/40 shadow-sm'
                        : isFunding
                        ? 'bg-slate-950 border-sky-500/30'
                        : 'bg-slate-950/70 border-slate-800'
                    }`}
                  >
                    {!notif.read && (
                      <span className="absolute top-3 right-3 w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                    )}

                    <div className="flex items-start gap-2.5">
                      <div className={`mt-0.5 p-1.5 rounded-lg shrink-0 ${
                        isCritical
                          ? 'bg-amber-500/20 text-amber-400'
                          : isFunding
                          ? 'bg-sky-500/20 text-sky-400'
                          : 'bg-slate-800 text-slate-400'
                      }`}>
                        {isCritical ? <Zap className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                      </div>

                      <div className="flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <h4 className="text-xs font-bold text-white font-mono flex items-center gap-1.5">
                            {notif.title}
                          </h4>
                          <span className="text-[10px] font-mono text-amber-400/90 bg-amber-400/10 px-1.5 py-0.5 rounded border border-amber-400/20 whitespace-nowrap">
                            {formattedTime} (BRT)
                          </span>
                        </div>

                        <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
                          {notif.message}
                        </p>

                        {notif.symbol && onSelectSymbol && (
                          <button
                            onClick={() => {
                              onSelectSymbol(notif.symbol!);
                              onClose();
                            }}
                            className="mt-2.5 text-[11px] font-mono font-semibold text-amber-400 hover:text-amber-300 transition flex items-center gap-1"
                          >
                            <span>Examinar {notif.symbol} no Triple Screen</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer note */}
          <div className="p-3 bg-slate-950 border-t border-slate-800 text-[10px] font-mono text-slate-400 text-center flex items-center justify-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            <span>Todos os horários sincronizados em Horário de Brasília (BRT / UTC-3)</span>
          </div>
        </div>
      </div>
    </div>
  );
};
