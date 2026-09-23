import React, { useState } from 'react';
import { Code2, Copy, Check, Key, ExternalLink, Terminal } from 'lucide-react';
import { useAppData } from '../../context/AppDataContext';

export const Screen12_ApiDocumentation: React.FC = () => {
  const { pushToast } = useAppData();
  const [activeTab, setActiveTab] = useState<'Overview' | 'Authentication' | 'Endpoints' | 'SDKs' | 'Examples'>('Overview');
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);
  const [apiKey, setApiKey] = useState(import.meta.env.VITE_DEMO_API_KEY || '');
  const [keyGenerated, setKeyGenerated] = useState(false);
  const [copiedEndpoint, setCopiedEndpoint] = useState<string | null>(null);

  const baseUrl = 'https://api.iprs.co.ke/v1';

  const copyToClipboard = async (text: string, kind: 'url' | 'token' | 'endpoint') => {
    try {
      await navigator.clipboard?.writeText(text);
    } catch {
      /* fallback ignored in demo */
    }
    if (kind === 'url') {
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 1500);
    } else if (kind === 'token') {
      setCopiedToken(true);
      setTimeout(() => setCopiedToken(false), 1500);
    } else {
      setCopiedEndpoint(text);
      setTimeout(() => setCopiedEndpoint(null), 1500);
    }
    pushToast({ title: 'Copied to clipboard', description: text.slice(0, 48), type: 'success' });
  };

  const handleGenerateKey = () => {
    const newKey = `iprs_live_${Math.random().toString(36).substring(2, 10)}${Math.random().toString(36).substring(2, 10)}`;
    setApiKey(newKey);
    setKeyGenerated(true);
    pushToast({ title: 'API key rotated', description: 'Store securely — shown once in production', type: 'warning' });
    setTimeout(() => setKeyGenerated(false), 2000);
  };

  const endpoints = [
    { method: 'POST', path: '/search/identity', desc: 'Query verified citizen profile' },
    { method: 'GET', path: '/profile/{id}', desc: 'Retrieve full KYC records' },
    { method: 'GET', path: '/reports/{id}', desc: 'Generate signed audit PDF' },
    { method: 'POST', path: '/cases', desc: 'Initialize an investigation case' },
    { method: 'GET', path: '/providers', desc: 'Live registry status & ping' },
    { method: 'GET', path: '/billing/usage', desc: 'Real-time metered API usage' },
  ];

  return (
    <div className="w-full h-full min-h-[420px] bg-[#071120] text-slate-100 rounded-xl overflow-hidden border border-sky-900/40 flex flex-col text-xs">
      <div className="px-3 sm:px-4 py-2.5 bg-[#091629] border-b border-sky-900/40 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Code2 size={15} className="text-cyan-400" />
          <h2 className="text-xs sm:text-sm font-bold text-white">IPRS API Documentation</h2>
        </div>
        <span className="text-[10px] text-cyan-400 font-mono bg-sky-950/60 px-2 py-0.5 rounded border border-sky-900/60">
          v1.4.2 REST
        </span>
      </div>

      <div className="px-3 sm:px-4 py-1.5 bg-[#081527] border-b border-sky-900/40 flex items-center gap-2 overflow-x-auto">
        {(['Overview', 'Authentication', 'Endpoints', 'SDKs', 'Examples'] as const).map((tab) => (
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

      <div className="flex-1 p-3 sm:p-4 grid grid-cols-1 md:grid-cols-12 gap-3 overflow-y-auto">
        <div className="md:col-span-7 space-y-3">
          <div className="bg-[#091629] p-3 sm:p-4 rounded-xl border border-sky-900/40">
            <span className="text-[10px] text-slate-400 block mb-1.5">Base URL</span>
            <div className="flex items-center justify-between gap-2 bg-[#050b14] px-3 py-2.5 rounded-lg border border-sky-900/60 font-mono text-[11px] sm:text-xs text-cyan-300">
              <span className="truncate">{baseUrl}</span>
              <button
                onClick={() => copyToClipboard(baseUrl, 'url')}
                className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-white shrink-0"
              >
                {copiedUrl ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                <span>{copiedUrl ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>

          <div className="bg-[#091629] p-3 sm:p-4 rounded-xl border border-sky-900/40 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold text-white">Authentication</span>
              <span className="text-[10px] text-emerald-400 font-mono">Bearer Token (API Key)</span>
            </div>

            <div className="bg-[#050b14] p-3 rounded-lg border border-sky-900/60 font-mono text-[10px] sm:text-[11px] text-slate-300 overflow-x-auto">
              <div className="text-slate-500">// Header format:</div>
              <div className="text-cyan-300 font-semibold break-all mt-1">
                Authorization: Bearer <span className="text-amber-400">{apiKey}</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <button
                onClick={handleGenerateKey}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-[10px] font-semibold transition-all shadow-[0_0_8px_rgba(2,132,199,0.3)]"
              >
                <Key size={12} />
                <span>{keyGenerated ? 'Key Refreshed!' : 'Generate API Key'}</span>
              </button>
              <button
                onClick={() => copyToClipboard(apiKey, 'token')}
                className="text-[10px] text-slate-400 hover:text-white flex items-center gap-1"
              >
                {copiedToken ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                <span>{copiedToken ? 'Token Copied' : 'Copy Key'}</span>
              </button>
            </div>
          </div>

          {activeTab === 'Examples' && (
            <div className="bg-[#091629] p-3 sm:p-4 rounded-xl border border-sky-900/40 animate-fade-in">
              <h3 className="text-xs font-semibold text-white mb-2">cURL Example</h3>
              <pre className="bg-[#050b14] p-3 rounded-lg border border-sky-900/60 text-[10px] text-slate-300 overflow-x-auto font-mono leading-relaxed">
{`curl -X POST ${baseUrl}/search/identity \\
  -H "Authorization: Bearer ${apiKey}" \\
  -H "Content-Type: application/json" \\
  -d '{"id_number":"23456789"}'`}
              </pre>
              <button
                onClick={() =>
                  copyToClipboard(
                    `curl -X POST ${baseUrl}/search/identity -H "Authorization: Bearer ${apiKey}" -H "Content-Type: application/json" -d '{"id_number":"23456789"}'`,
                    'endpoint'
                  )
                }
                className="mt-2 text-[10px] text-cyan-400 hover:underline flex items-center gap-1"
              >
                <Copy size={11} /> Copy cURL
              </button>
            </div>
          )}

          <div className="text-[10px] text-slate-400 flex items-center gap-1 flex-wrap">
            <span>Full documentation at</span>
            <a
              href="https://docs.iprs.co.ke"
              onClick={(e) => {
                e.preventDefault();
                pushToast({ title: 'docs.iprs.co.ke', description: 'External docs link (demo)', type: 'info' });
              }}
              className="text-cyan-400 hover:underline flex items-center gap-0.5"
            >
              docs.iprs.co.ke <ExternalLink size={10} />
            </a>
          </div>
        </div>

        <div className="md:col-span-5 bg-[#091629] p-3 sm:p-4 rounded-xl border border-sky-900/40 flex flex-col justify-between">
          <div>
            <h3 className="text-xs font-semibold text-white pb-2 border-b border-sky-900/30 flex items-center gap-1.5">
              <Terminal size={12} className="text-cyan-400" />
              <span>Quick Endpoints</span>
            </h3>
            <div className="mt-2 space-y-1.5 font-mono text-[10px]">
              {endpoints.map((ep, idx) => (
                <button
                  key={idx}
                  onClick={() => copyToClipboard(`${ep.method} ${baseUrl}${ep.path}`, 'endpoint')}
                  className="w-full p-2 rounded-lg bg-[#050b14] border border-sky-950 flex items-center justify-between group hover:border-sky-800 transition-colors text-left"
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span
                      className={`px-1.5 py-0.5 rounded text-[8px] font-bold shrink-0 ${
                        ep.method === 'POST'
                          ? 'bg-cyan-950 text-cyan-400 border border-cyan-800'
                          : 'bg-blue-950 text-blue-400 border border-blue-800'
                      }`}
                    >
                      {ep.method}
                    </span>
                    <span className="text-slate-200 truncate">{ep.path}</span>
                  </div>
                  {copiedEndpoint?.includes(ep.path) ? (
                    <Check size={11} className="text-emerald-400 shrink-0" />
                  ) : (
                    <span className="text-[8px] text-slate-500 font-sans hidden sm:inline truncate pl-1 max-w-[100px]">
                      {ep.desc}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
          <div className="pt-3 text-[9px] text-slate-500 font-mono">Rate limit: 120 req/min · 99.99% SLA</div>
        </div>
      </div>
    </div>
  );
};
export default Screen12_ApiDocumentation;
