import React, { useState } from 'react';
import { Key, AlertCircle, CheckCircle2, Loader2, ExternalLink } from 'lucide-react';
import { GitHub, saveConfig } from './github.js';

export default function SetupModal({ onComplete, initial }) {
  const [token, setToken] = useState(initial?.token || '');
  const [owner, setOwner] = useState(initial?.owner || 'princesavsaviya');
  const [repo, setRepo] = useState(initial?.repo || 'roadmap-tracker-data');
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');

  const connect = async () => {
    setStatus('testing');
    setError('');
    try {
      const gh = new GitHub({ token: token.trim(), owner: owner.trim(), repo: repo.trim() });
      await gh.testAuth();
      const cfg = { token: token.trim(), owner: owner.trim(), repo: repo.trim() };
      saveConfig(cfg);
      setStatus('success');
      setTimeout(() => onComplete(cfg), 400);
    } catch (e) {
      setError(e.message);
      setStatus('idle');
    }
  };

  return (
    <div className="fixed inset-0 bg-zinc-950/95 backdrop-blur z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg max-w-lg w-full p-6 my-8">
        <div className="flex items-center gap-2 mb-1">
          <Key size={18} className="text-emerald-400" />
          <h2 className="text-lg font-semibold">Connect to GitHub</h2>
        </div>
        <p className="text-sm text-zinc-500 mb-5">
          Your PAT is stored only in this browser's localStorage. It's sent only to api.github.com.
        </p>

        <details className="mb-5 bg-zinc-950/50 border border-zinc-800 rounded p-3 text-sm">
          <summary className="cursor-pointer text-zinc-400 hover:text-zinc-200">
            How to create the Fine-Grained PAT
          </summary>
          <ol className="mt-3 space-y-1.5 text-zinc-400 list-decimal list-inside pl-1">
            <li>Go to <a className="text-emerald-400 hover:underline inline-flex items-center gap-0.5" href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener noreferrer">github.com/settings/personal-access-tokens/new <ExternalLink size={11} /></a></li>
            <li>Token name: <span className="font-mono text-zinc-300">roadmap-tracker-data-rw</span></li>
            <li>Expiration: 90 days (rotate when it expires)</li>
            <li>Repository access: Only selected repositories → pick your data repo</li>
            <li>Permissions → Repository → <span className="font-mono text-zinc-300">Contents</span>: Read and write</li>
            <li>Generate token, paste below</li>
          </ol>
        </details>

        <div className="space-y-3">
          <Field label="OWNER" value={owner} onChange={setOwner} mono />
          <Field label="DATA REPO" value={repo} onChange={setRepo} mono />
          <Field label="FINE-GRAINED PAT" value={token} onChange={setToken} placeholder="github_pat_..." type="password" mono />
        </div>

        {error && (
          <div className="mt-4 flex items-start gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded p-3">
            <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
            <span className="font-mono text-xs break-all">{error}</span>
          </div>
        )}

        <button
          onClick={connect}
          disabled={!token || !owner || !repo || status === 'testing'}
          className="w-full mt-6 bg-zinc-100 text-zinc-900 rounded px-4 py-2.5 text-sm font-medium hover:bg-white disabled:opacity-40 disabled:hover:bg-zinc-100 flex items-center justify-center gap-2"
        >
          {status === 'testing' && <><Loader2 size={16} className="animate-spin" /> Testing connection...</>}
          {status === 'success' && <><CheckCircle2 size={16} /> Connected</>}
          {status === 'idle' && 'Connect'}
        </button>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = 'text', mono = false }) {
  return (
    <div>
      <label className="text-[10px] tracking-[0.2em] text-zinc-500 block mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm focus:outline-none focus:border-zinc-700 ${mono ? 'font-mono' : ''}`}
      />
    </div>
  );
}
