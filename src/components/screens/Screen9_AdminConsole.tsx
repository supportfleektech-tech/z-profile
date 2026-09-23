import React, { useState, useMemo } from 'react';
import { Shield, Plus, Search, Edit2, Trash2, X, Power } from 'lucide-react';
import { useAppData } from '../../context/AppDataContext';
import { UserItem } from '../../types';

export const Screen9_AdminConsole: React.FC = () => {
  const { users, addUser, removeUser, toggleUserStatus } = useAppData();
  const [activeTab, setActiveTab] = useState<'Users' | 'Providers' | 'Pricing' | 'System Settings'>('Users');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<UserItem['role']>('Analyst');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const filteredUsers = useMemo(
    () =>
      users.filter(
        (u) =>
          u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
          u.role.toLowerCase().includes(searchQuery.toLowerCase())
      ),
    [users, searchQuery]
  );

  const handleAddUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newEmail.trim()) return;
    addUser({ name: newName.trim(), email: newEmail.trim(), role: newRole, status: 'Active' });
    setNewName('');
    setNewEmail('');
    setShowAddModal(false);
  };

  return (
    <div className="w-full h-full min-h-[420px] bg-[#071120] text-slate-100 rounded-xl overflow-hidden border border-sky-900/40 flex flex-col text-xs relative">
      <div className="px-3 sm:px-4 py-2.5 bg-[#091629] border-b border-sky-900/40 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield size={15} className="text-cyan-400" />
          <h2 className="text-xs sm:text-sm font-bold text-white">Admin Console</h2>
        </div>
        <span className="text-[10px] text-slate-400 font-mono">{users.length} team members</span>
      </div>

      <div className="px-3 sm:px-4 py-1.5 bg-[#081527] border-b border-sky-900/40 flex items-center gap-2 overflow-x-auto">
        {(['Users', 'Providers', 'Pricing', 'System Settings'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-2.5 py-1 rounded-md text-[10px] font-medium transition-all whitespace-nowrap ${
              activeTab === tab ? 'bg-sky-600 text-white font-semibold' : 'text-slate-400 hover:text-slate-200 hover:bg-sky-950/40'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'Users' && (
        <>
          <div className="p-2 sm:px-3 sm:py-2 bg-[#06101c] border-b border-sky-900/40 flex items-center justify-between gap-2 flex-wrap">
            <div className="relative flex-1 max-w-xs min-w-[140px]">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search users…"
                className="w-full bg-[#091629] border border-sky-900/60 rounded-lg py-1.5 pl-7 pr-2 text-[11px] text-white focus:outline-none focus:border-cyan-400"
              />
            </div>
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-semibold text-[10px] shadow-[0_0_10px_rgba(2,132,199,0.4)] transition-all active:scale-95"
            >
              <Plus size={12} />
              <span>Add User</span>
            </button>
          </div>

          <div className="flex-1 overflow-x-auto overflow-y-auto">
            <div className="sm:hidden p-2 space-y-2">
              {filteredUsers.map((u) => (
                <div key={u.id} className="p-3 rounded-xl bg-[#091629] border border-sky-900/50">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-semibold text-white text-sm">{u.name}</div>
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5">{u.email}</div>
                    </div>
                    <span className={`text-[9px] font-semibold flex items-center gap-1 ${u.status === 'Active' ? 'text-emerald-400' : 'text-slate-500'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${u.status === 'Active' ? 'bg-emerald-400' : 'bg-slate-500'}`} />
                      {u.status}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-sky-950/80 text-sky-300 border border-sky-800/60">
                      {u.role}
                    </span>
                    <div className="flex gap-2">
                      <button onClick={() => toggleUserStatus(u.id)} className="p-1.5 text-slate-400 hover:text-cyan-400" title="Toggle status">
                        <Power size={13} />
                      </button>
                      <button onClick={() => setConfirmDelete(u.id)} className="p-1.5 text-slate-400 hover:text-rose-400" title="Remove">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <table className="hidden sm:table w-full text-left border-collapse text-[11px]">
              <thead>
                <tr className="border-b border-sky-900/40 bg-[#091629]/80 text-[10px] text-slate-400 uppercase tracking-wider font-semibold sticky top-0">
                  <th className="py-2.5 px-3">Name</th>
                  <th className="py-2.5 px-3">Email</th>
                  <th className="py-2.5 px-3">Role</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sky-950/60">
                {filteredUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-sky-950/40 transition-colors">
                    <td className="py-2.5 px-3 font-semibold text-white whitespace-nowrap">{u.name}</td>
                    <td className="py-2.5 px-3 text-slate-300 font-mono text-[10px] whitespace-nowrap">{u.email}</td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-sky-950/80 text-sky-300 border border-sky-800/60">
                        {u.role}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <button
                        onClick={() => toggleUserStatus(u.id)}
                        className={`flex items-center gap-1 text-[10px] font-semibold ${
                          u.status === 'Active' ? 'text-emerald-400' : 'text-slate-500'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${u.status === 'Active' ? 'bg-emerald-400' : 'bg-slate-500'}`} />
                        {u.status}
                      </button>
                    </td>
                    <td className="py-2.5 px-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2 text-slate-400">
                        <button className="hover:text-cyan-400 transition-colors p-1" title="Edit">
                          <Edit2 size={12} />
                        </button>
                        <button
                          onClick={() => setConfirmDelete(u.id)}
                          className="hover:text-rose-400 transition-colors p-1"
                          title="Revoke access"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {activeTab !== 'Users' && (
        <div className="flex-1 flex items-center justify-center p-8 text-center">
          <div>
            <p className="text-sm text-slate-300 font-medium">{activeTab}</p>
            <p className="text-xs text-slate-500 mt-1 max-w-xs">
              Manage {activeTab.toLowerCase()} from the dedicated module pages for full controls.
            </p>
          </div>
        </div>
      )}

      {showAddModal && (
        <div className="absolute inset-0 bg-black/75 backdrop-blur-sm z-30 flex items-center justify-center p-4 animate-fade-in">
          <form onSubmit={handleAddUser} className="bg-[#091629] border border-sky-800 p-5 rounded-2xl max-w-md w-full space-y-3.5 shadow-2xl animate-scale-in">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white">Add New Team Member</h3>
              <button type="button" onClick={() => setShowAddModal(false)} className="p-1 text-slate-400 hover:text-white">
                <X size={16} />
              </button>
            </div>
            <div>
              <label className="block text-[10px] text-slate-300 mb-1">Full Name</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Dennis Mutua"
                className="w-full bg-[#050b14] border border-sky-900 rounded-lg py-2 px-3 text-sm text-white focus:outline-none focus:border-cyan-400"
                required
                autoFocus
              />
            </div>
            <div>
              <label className="block text-[10px] text-slate-300 mb-1">Official Email</label>
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="dennis@iprs.co.ke"
                className="w-full bg-[#050b14] border border-sky-900 rounded-lg py-2 px-3 text-sm text-white focus:outline-none focus:border-cyan-400"
                required
              />
            </div>
            <div>
              <label className="block text-[10px] text-slate-300 mb-1">Role Permission</label>
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as UserItem['role'])}
                className="w-full bg-[#050b14] border border-sky-900 rounded-lg py-2 px-3 text-sm text-white"
              >
                <option value="Analyst">Analyst</option>
                <option value="Officer">Officer</option>
                <option value="Viewer">Viewer</option>
                <option value="Billing">Billing</option>
                <option value="Super Admin">Super Admin</option>
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setShowAddModal(false)} className="px-3 py-1.5 text-slate-400 hover:text-white text-xs">
                Cancel
              </button>
              <button type="submit" className="px-4 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-semibold">
                Add User
              </button>
            </div>
          </form>
        </div>
      )}

      {confirmDelete && (
        <div className="absolute inset-0 bg-black/75 backdrop-blur-sm z-30 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-[#091629] border border-rose-500/40 p-5 rounded-2xl max-w-sm w-full space-y-3 shadow-2xl animate-scale-in">
            <h3 className="text-sm font-bold text-white">Revoke Access?</h3>
            <p className="text-xs text-slate-400">
              This removes the user from the organization. They will lose platform access immediately.
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmDelete(null)} className="px-3 py-1.5 text-slate-400 hover:text-white text-xs">
                Cancel
              </button>
              <button
                onClick={() => {
                  removeUser(confirmDelete);
                  setConfirmDelete(null);
                }}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-semibold"
              >
                Revoke Access
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default Screen9_AdminConsole;
