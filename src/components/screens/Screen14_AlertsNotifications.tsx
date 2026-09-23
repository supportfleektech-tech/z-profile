import React, { useState, useMemo } from 'react';
import {
  Bell,
  CheckCircle2,
  AlertTriangle,
  CreditCard,
  RefreshCw,
  Info,
  Check,
  CheckCheck,
} from 'lucide-react';
import { useAppData } from '../../context/AppDataContext';
import { NotificationItem } from '../../types';

/**
 * Alerts & Notifications.
 *
 * Reads `visibleNotifications`, NOT the raw `notifications` list: the context scopes
 * alerts to the signed-in account (plus org-wide broadcasts), so a User-tier analyst
 * never sees another analyst's billing or security alerts. Tab counts are derived from
 * the same scoped list so they can never disagree with the header badge.
 */
export const Screen14_AlertsNotifications: React.FC = () => {
  const { visibleNotifications, markNotificationRead, markAllNotificationsRead, unreadCount } = useAppData();
  const [activeTab, setActiveTab] = useState<'All' | 'Security' | 'System' | 'Billing' | 'Reports'>('All');
  const [hideRead, setHideRead] = useState(false);

  const filteredItems = useMemo(
    () =>
      visibleNotifications.filter((n) => {
        if (activeTab !== 'All' && n.category !== activeTab) return false;
        if (hideRead && n.read) return false;
        return true;
      }),
    [visibleNotifications, activeTab, hideRead]
  );

  const getNotificationIcon = (n: NotificationItem) => {
    if (n.type === 'danger') {
      return (
        <div className="w-8 h-8 rounded-full bg-rose-950/80 border border-rose-500/50 flex items-center justify-center text-rose-400 shrink-0">
          <AlertTriangle size={14} />
        </div>
      );
    }
    if (n.category === 'Billing') {
      return (
        <div className="w-8 h-8 rounded-full bg-blue-950/80 border border-blue-500/50 flex items-center justify-center text-blue-400 shrink-0">
          <CreditCard size={14} />
        </div>
      );
    }
    if (n.title.toLowerCase().includes('sync')) {
      return (
        <div className="w-8 h-8 rounded-full bg-cyan-950/80 border border-cyan-500/50 flex items-center justify-center text-cyan-400 shrink-0">
          <RefreshCw size={14} />
        </div>
      );
    }
    if (n.type === 'warning') {
      return (
        <div className="w-8 h-8 rounded-full bg-amber-950/80 border border-amber-500/50 flex items-center justify-center text-amber-400 shrink-0">
          <Info size={14} />
        </div>
      );
    }
    return (
      <div className="w-8 h-8 rounded-full bg-emerald-950/80 border border-emerald-500/50 flex items-center justify-center text-emerald-400 shrink-0">
        <CheckCircle2 size={14} />
      </div>
    );
  };

  return (
    <div className="w-full h-full min-h-[420px] bg-[#071120] text-slate-100 rounded-xl overflow-hidden border border-sky-900/40 flex flex-col text-xs">
      <div className="px-3 sm:px-4 py-2.5 bg-[#091629] border-b border-sky-900/40 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Bell size={15} className="text-cyan-400" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[14px] h-[14px] px-0.5 rounded-full bg-rose-500 text-white text-[8px] font-bold flex items-center justify-center">
                {unreadCount}
              </span>
            )}
          </div>
          <h2 className="text-xs sm:text-sm font-bold text-white">Notifications</h2>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={() => setHideRead((v) => !v)}
            className={`text-[10px] font-medium flex items-center gap-1 transition-colors ${
              hideRead ? 'text-cyan-300' : 'text-slate-500 hover:text-slate-300'
            }`}
            title="Show only unread alerts"
          >
            <Check size={12} /> Unread only
          </button>
          <button
            onClick={markAllNotificationsRead}
            disabled={unreadCount === 0}
            className="text-[10px] text-cyan-400 hover:text-cyan-300 font-medium flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <CheckCheck size={12} /> <span className="hidden sm:inline">Mark all read</span>
          </button>
        </div>
      </div>

      <div className="px-3 sm:px-4 py-1.5 bg-[#081527] border-b border-sky-900/40 flex items-center gap-2 overflow-x-auto">
        {(['All', 'Security', 'System', 'Billing', 'Reports'] as const).map((tab) => {
          const count =
            tab === 'All'
              ? visibleNotifications.filter((n) => !n.read).length
              : visibleNotifications.filter((n) => n.category === tab && !n.read).length;
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-2.5 py-1 rounded-md text-[10px] font-medium transition-all whitespace-nowrap flex items-center gap-1 ${
                activeTab === tab ? 'bg-sky-600 text-white font-semibold' : 'text-slate-400 hover:text-slate-200 hover:bg-sky-950/40'
              }`}
            >
              {tab}
              {count > 0 && (
                <span className={`min-w-[14px] h-[14px] px-0.5 rounded-full text-[8px] font-bold flex items-center justify-center ${
                  activeTab === tab ? 'bg-white/20 text-white' : 'bg-rose-500/80 text-white'
                }`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="flex-1 p-3 space-y-2 overflow-y-auto">
        {filteredItems.length === 0 && (
          <div className="py-12 text-center text-slate-500">
            <Bell size={28} className="mx-auto mb-2 opacity-40" />
            <p className="text-sm">
              {hideRead && visibleNotifications.some((n) => n.read)
                ? 'No unread alerts here'
                : 'No notifications in this category'}
            </p>
            {hideRead && (
              <button onClick={() => setHideRead(false)} className="mt-2 text-[10px] text-cyan-400 hover:text-cyan-300">
                Show read alerts
              </button>
            )}
          </div>
        )}
        {filteredItems.map((notif) => (
          <button
            key={notif.id}
            onClick={() => markNotificationRead(notif.id)}
            className={`w-full p-3 rounded-xl border transition-all flex items-start gap-3 text-left ${
              notif.read
                ? 'bg-[#091629]/40 border-sky-950 text-slate-400'
                : 'bg-[#091629] border-sky-900/60 shadow-[0_2px_8px_rgba(0,0,0,0.3)] hover:border-cyan-500/30'
            }`}
          >
            {getNotificationIcon(notif)}
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline justify-between gap-2">
                <h4 className={`text-xs sm:text-sm font-semibold truncate ${notif.read ? 'text-slate-400' : 'text-white'}`}>
                  {notif.title}
                </h4>
                <span className="text-[9px] text-slate-500 font-mono shrink-0">{notif.time}</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-2">{notif.description}</p>
              <div className="mt-1.5 flex items-center gap-2">
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-sky-950/80 text-slate-400 border border-sky-900/50">
                  {notif.category}
                </span>
                {!notif.read && (
                  <span className="text-[9px] text-cyan-400 flex items-center gap-0.5">
                    <Check size={10} /> Tap to mark read
                  </span>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};
export default Screen14_AlertsNotifications;
