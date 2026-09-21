import React, { useState, useMemo } from 'react';
import { Plus, Search, Briefcase, X } from 'lucide-react';
import { useAppData } from '../../context/AppDataContext';
import { CaseItem } from '../../types';

interface Screen6CasesProps {
  onSelectCase?: (c: CaseItem) => void;
}

export const Screen6_Cases: React.FC<Screen6CasesProps> = ({ onSelectCase }) => {
  const { cases, addCase, updateCaseStatus } = useAppData();
  const [filterTab, setFilterTab] = useState<'All Cases' | 'Open' | 'In Progress' | 'Closed'>('All Cases');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState('All Types');
  const [selectedStatus, setSelectedStatus] = useState('All Status');
  const [showNewModal, setShowNewModal] = useState(false);
  const [newSubject, setNewSubject] = useState('');
  const [newType, setNewType] = useState('Identity Verification');
  const [newPriority, setNewPriority] = useState<'High' | 'Medium' | 'Low'>('Medium');

  const filteredCases = useMemo(() => {
    return cases.filter((c) => {
      if (filterTab === 'Open' && c.status !== 'Open') return false;
      if (filterTab === 'In Progress' && c.status !== 'In Progress') return false;
      if (filterTab === 'Closed' && c.status !== 'Closed' && c.status !== 'Completed') return false;
      if (selectedType !== 'All Types' && c.type !== selectedType) return false;
      if (selectedStatus !== 'All Status' && c.status !== selectedStatus) return false;
      if (
        searchQuery &&
        !c.subject.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !c.caseId.toLowerCase().includes(searchQuery.toLowerCase())
      ) {
        return false;
      }
      return true;
    });
  }, [cases, filterTab, selectedType, selectedStatus, searchQuery]);

  const handleCreateCase = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubject.trim()) return;
    const created = addCase({
      subject: newSubject.trim(),
      type: newType,
      priority: newPriority,
      status: 'Open',
    });
    setNewSubject('');
    setShowNewModal(false);
    onSelectCase?.(created);
  };

  const cycleStatus = (c: CaseItem, e: React.MouseEvent) => {
    e.stopPropagation();
    const order: CaseItem['status'][] = ['Open', 'In Progress', 'Completed', 'Closed'];
    const next = order[(order.indexOf(c.status) + 1) % order.length];
    updateCaseStatus(c.id, next);
  };

  return (
    <div className="w-full h-full min-h-[420px] bg-[#071120] text-slate-100 rounded-xl overflow-hidden border border-sky-900/40 flex flex-col text-xs relative">
      <div className="px-3 sm:px-4 py-2.5 bg-[#091629] border-b border-sky-900/40 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Briefcase size={15} className="text-cyan-400" />
          <h2 className="text-xs sm:text-sm font-bold text-white">Cases</h2>
          <span className="text-[10px] text-slate-400 font-mono">({cases.length})</span>
        </div>
        <button
          onClick={() => setShowNewModal(true)}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-semibold text-[10px] shadow-[0_0_10px_rgba(2,132,199,0.4)] transition-all active:scale-95"
        >
          <Plus size={12} />
          <span>New Case</span>
        </button>
      </div>

      <div className="px-3 sm:px-4 py-1.5 bg-[#081527] border-b border-sky-900/40 flex items-center gap-2 overflow-x-auto">
        {(['All Cases', 'Open', 'In Progress', 'Closed'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setFilterTab(tab)}
            className={`px-2.5 py-1 rounded-md text-[10px] font-medium transition-all whitespace-nowrap ${
              filterTab === tab
                ? 'bg-sky-600 text-white font-semibold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-sky-950/40'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="p-2 sm:px-3 sm:py-2 bg-[#06101c] border-b border-sky-900/40 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[140px]">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search cases…"
            className="w-full bg-[#091629] border border-sky-900/60 rounded-lg py-1.5 pl-7 pr-2 text-[11px] text-white focus:outline-none focus:border-cyan-400"
          />
        </div>
        <select
          value={selectedType}
          onChange={(e) => setSelectedType(e.target.value)}
          className="bg-[#091629] border border-sky-900/60 rounded-lg py-1.5 px-2 text-[10px] text-slate-300 focus:outline-none"
        >
          <option value="All Types">All Types</option>
          <option value="Full Background">Full Background</option>
          <option value="Identity Verification">Identity Verification</option>
          <option value="M-PESA KYC">M-PESA KYC</option>
          <option value="CRB Check">CRB Check</option>
          <option value="Employer Verification">Employer Verification</option>
        </select>
        <select
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
          className="bg-[#091629] border border-sky-900/60 rounded-lg py-1.5 px-2 text-[10px] text-slate-300 focus:outline-none"
        >
          <option value="All Status">All Status</option>
          <option value="Open">Open</option>
          <option value="In Progress">In Progress</option>
          <option value="Completed">Completed</option>
          <option value="Closed">Closed</option>
        </select>
      </div>

      <div className="flex-1 overflow-x-auto overflow-y-auto">
        {/* Mobile cards */}
        <div className="sm:hidden p-2 space-y-2">
          {filteredCases.length === 0 && (
            <p className="text-center text-slate-500 py-8 text-xs">No cases match your filters</p>
          )}
          {filteredCases.map((c) => (
            <button
              key={c.id}
              onClick={() => onSelectCase?.(c)}
              className="w-full text-left p-3 rounded-xl bg-[#091629] border border-sky-900/50 hover:border-cyan-500/40 transition-colors"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-cyan-400 font-mono text-[11px] font-semibold">{c.caseId}</span>
                <span
                  onClick={(e) => cycleStatus(c, e)}
                  className={`px-2 py-0.5 rounded text-[9px] font-semibold ${
                    c.status === 'In Progress'
                      ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
                      : c.status === 'Open'
                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                      : c.status === 'Completed'
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'bg-slate-700/30 text-slate-400 border border-slate-700/50'
                  }`}
                >
                  {c.status}
                </span>
              </div>
              <div className="mt-1.5 text-sm font-semibold text-white">{c.subject}</div>
              <div className="mt-1 flex items-center justify-between text-[10px] text-slate-400">
                <span>{c.type}</span>
                <span className="flex items-center gap-1">
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      c.priority === 'High' ? 'bg-rose-500' : c.priority === 'Medium' ? 'bg-amber-400' : 'bg-emerald-400'
                    }`}
                  />
                  {c.priority} · {c.updated}
                </span>
              </div>
            </button>
          ))}
        </div>

        {/* Desktop table */}
        <table className="hidden sm:table w-full text-left border-collapse text-[11px]">
          <thead>
            <tr className="border-b border-sky-900/40 bg-[#091629]/80 text-[10px] text-slate-400 uppercase tracking-wider font-semibold sticky top-0">
              <th className="py-2.5 px-3">Case ID</th>
              <th className="py-2.5 px-3">Subject</th>
              <th className="py-2.5 px-3">Type</th>
              <th className="py-2.5 px-3">Priority</th>
              <th className="py-2.5 px-3">Status</th>
              <th className="py-2.5 px-3 text-right">Updated</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-sky-950/60">
            {filteredCases.length === 0 && (
              <tr>
                <td colSpan={6} className="py-10 text-center text-slate-500">
                  No cases match your filters
                </td>
              </tr>
            )}
            {filteredCases.map((c) => (
              <tr
                key={c.id}
                onClick={() => onSelectCase?.(c)}
                className="hover:bg-sky-950/40 transition-colors cursor-pointer group"
              >
                <td className="py-2.5 px-3 text-cyan-400 font-medium font-mono group-hover:underline">{c.caseId}</td>
                <td className="py-2.5 px-3 font-semibold text-white">{c.subject}</td>
                <td className="py-2.5 px-3 text-slate-300">{c.type}</td>
                <td className="py-2.5 px-3">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        c.priority === 'High' ? 'bg-rose-500' : c.priority === 'Medium' ? 'bg-amber-400' : 'bg-emerald-400'
                      }`}
                    />
                    <span className="text-[10px] text-slate-300">{c.priority}</span>
                  </div>
                </td>
                <td className="py-2.5 px-3">
                  <button
                    onClick={(e) => cycleStatus(c, e)}
                    title="Click to advance status"
                    className={`inline-block px-2 py-0.5 rounded text-[9px] font-semibold hover:opacity-80 ${
                      c.status === 'In Progress'
                        ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
                        : c.status === 'Open'
                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        : c.status === 'Completed'
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : 'bg-slate-700/30 text-slate-400 border border-slate-700/50'
                    }`}
                  >
                    {c.status}
                  </button>
                </td>
                <td className="py-2.5 px-3 text-right text-[10px] text-slate-400 font-mono">{c.updated}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showNewModal && (
        <div className="absolute inset-0 bg-black/75 backdrop-blur-sm z-30 flex items-center justify-center p-4 animate-fade-in">
          <form
            onSubmit={handleCreateCase}
            className="bg-[#091629] border border-sky-800 p-5 rounded-2xl max-w-md w-full space-y-3.5 shadow-2xl animate-scale-in"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white">Create New Investigation Case</h3>
              <button type="button" onClick={() => setShowNewModal(false)} className="p-1 text-slate-400 hover:text-white">
                <X size={16} />
              </button>
            </div>
            <div>
              <label className="block text-[10px] text-slate-300 mb-1">Subject Full Name</label>
              <input
                type="text"
                value={newSubject}
                onChange={(e) => setNewSubject(e.target.value)}
                placeholder="e.g. Samuel Kipchoge"
                className="w-full bg-[#050b14] border border-sky-900 rounded-lg py-2 px-3 text-sm text-white focus:outline-none focus:border-cyan-400"
                required
                autoFocus
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] text-slate-300 mb-1">Type</label>
                <select
                  value={newType}
                  onChange={(e) => setNewType(e.target.value)}
                  className="w-full bg-[#050b14] border border-sky-900 rounded-lg py-2 px-2 text-xs text-white"
                >
                  <option value="Full Background">Full Background</option>
                  <option value="Identity Verification">Identity Verification</option>
                  <option value="M-PESA KYC">M-PESA KYC</option>
                  <option value="CRB Check">CRB Check</option>
                  <option value="Employer Verification">Employer Verification</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] text-slate-300 mb-1">Priority</label>
                <select
                  value={newPriority}
                  onChange={(e) => setNewPriority(e.target.value as 'High' | 'Medium' | 'Low')}
                  className="w-full bg-[#050b14] border border-sky-900 rounded-lg py-2 px-2 text-xs text-white"
                >
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setShowNewModal(false)} className="px-3 py-1.5 text-slate-400 hover:text-white text-xs">
                Cancel
              </button>
              <button type="submit" className="px-4 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-semibold">
                Create Case
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
