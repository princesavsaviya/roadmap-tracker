import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Check, Plus, Trash2, Clock, Target, Briefcase, Code, GitBranch,
  Calendar, Activity, ChevronLeft, ChevronRight, Circle, CheckCircle2,
  Flame, Zap, Settings, Loader2, AlertTriangle, CloudOff, Cloud, RefreshCw, LogOut
} from 'lucide-react';
import { GitHub, ConflictError, loadConfig, saveConfig, clearConfig } from './github.js';
import { TRACKS, SCHEDULES, DAY_LABELS, STATUS_OPTIONS, getDayType, getWeekStart, fmtDate } from './schedule.js';
import SetupModal from './SetupModal.jsx';

const FILE_PATHS = {
  logs: 'data/logs.json',
  apps: 'data/apps.json',
  dsa:  'data/dsa.json',
  os:   'data/os.json',
};

const DEFAULTS = { logs: {}, apps: [], dsa: [], os: [] };

export default function App() {
  const [config, setConfig] = useState(loadConfig());
  const [showSetup, setShowSetup] = useState(!loadConfig());
  const [showSettings, setShowSettings] = useState(false);

  const ghRef = useRef(null);
  useEffect(() => {
    ghRef.current = config ? new GitHub(config) : null;
  }, [config]);

  const [data, setData] = useState({
    logs: { content: DEFAULTS.logs, sha: null, loaded: false },
    apps: { content: DEFAULTS.apps, sha: null, loaded: false },
    dsa:  { content: DEFAULTS.dsa,  sha: null, loaded: false },
    os:   { content: DEFAULTS.os,   sha: null, loaded: false },
  });
  const dataRef = useRef(data);
  useEffect(() => { dataRef.current = data; }, [data]);

  const [loading, setLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState('idle');
  const [syncError, setSyncError] = useState('');

  const timersRef = useRef({});

  const loadAll = useCallback(async () => {
    if (!ghRef.current) return;
    setLoading(true);
    setSyncError('');
    try {
      const [logs, apps, dsa, os] = await Promise.all([
        ghRef.current.fetchFile(FILE_PATHS.logs),
        ghRef.current.fetchFile(FILE_PATHS.apps),
        ghRef.current.fetchFile(FILE_PATHS.dsa),
        ghRef.current.fetchFile(FILE_PATHS.os),
      ]);
      setData({
        logs: { content: logs.content ?? DEFAULTS.logs, sha: logs.sha, loaded: true },
        apps: { content: apps.content ?? DEFAULTS.apps, sha: apps.sha, loaded: true },
        dsa:  { content: dsa.content  ?? DEFAULTS.dsa,  sha: dsa.sha,  loaded: true },
        os:   { content: os.content   ?? DEFAULTS.os,   sha: os.sha,   loaded: true },
      });
    } catch (e) {
      setSyncError(e.message);
      setSyncStatus('error');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (config && !showSetup) loadAll();
  }, [config, showSetup, loadAll]);

  const doSave = useCallback(async (key) => {
    if (!ghRef.current) return;
    const { content, sha } = dataRef.current[key];
    setSyncStatus('syncing');
    setSyncError('');
    try {
      const newSha = await ghRef.current.saveFile(FILE_PATHS[key], content, sha);
      setData((prev) => ({ ...prev, [key]: { ...prev[key], sha: newSha } }));
      setSyncStatus('saved');
      setTimeout(() => setSyncStatus((s) => (s === 'saved' ? 'idle' : s)), 1500);
    } catch (e) {
      if (e instanceof ConflictError) {
        setSyncStatus('conflict');
        setSyncError('Conflict detected. Reloading from GitHub.');
        await loadAll();
      } else {
        setSyncStatus('error');
        setSyncError(e.message);
      }
    }
  }, [loadAll]);

  const scheduleSave = useCallback((key) => {
    if (timersRef.current[key]) clearTimeout(timersRef.current[key]);
    timersRef.current[key] = setTimeout(() => doSave(key), 800);
  }, [doSave]);

  const update = useCallback((key, updater) => {
    setData((prev) => {
      const newContent = updater(prev[key].content);
      return { ...prev, [key]: { ...prev[key], content: newContent } };
    });
    scheduleSave(key);
  }, [scheduleSave]);

  const [tab, setTab] = useState('today');
  const [today, setToday] = useState(new Date());
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

  const dateKey = fmtDate(today);
  const dayType = getDayType(today);
  const schedule = SCHEDULES[dayType];
  const log = data.logs.content[dateKey] || { completed: [], notes: '' };

  const toggleBlock = (blockId) => {
    update('logs', (logs) => {
      const cur = logs[dateKey] || { completed: [], notes: '' };
      const completed = cur.completed.includes(blockId)
        ? cur.completed.filter((x) => x !== blockId)
        : [...cur.completed, blockId];
      return { ...logs, [dateKey]: { ...cur, completed } };
    });
  };

  const updateNotes = (notes) => {
    update('logs', (logs) => {
      const cur = logs[dateKey] || { completed: [], notes: '' };
      return { ...logs, [dateKey]: { ...cur, notes } };
    });
  };

  const addApp = (entry) => update('apps', (apps) => [{ ...entry, id: Date.now(), date: fmtDate(new Date()) }, ...apps]);
  const updateAppStatus = (id, status) => update('apps', (apps) => apps.map((a) => (a.id === id ? { ...a, status } : a)));
  const deleteApp = (id) => update('apps', (apps) => apps.filter((a) => a.id !== id));

  const addDsa = (entry) => update('dsa', (dsa) => [{ ...entry, id: Date.now(), date: fmtDate(new Date()) }, ...dsa]);
  const deleteDsa = (id) => update('dsa', (dsa) => dsa.filter((x) => x.id !== id));

  const addOs = (entry) => update('os', (os) => [{ ...entry, id: Date.now(), date: fmtDate(new Date()) }, ...os]);
  const deleteOs = (id) => update('os', (os) => os.filter((x) => x.id !== id));

  const trackHoursThisWeek = useMemo(() => {
    const totals = Object.fromEntries(Object.keys(TRACKS).map((k) => [k, 0]));
    const ws = getWeekStart(today);
    for (let i = 0; i < 7; i++) {
      const d = new Date(ws);
      d.setDate(d.getDate() + i);
      const k = fmtDate(d);
      const entry = data.logs.content[k];
      if (!entry) continue;
      const sched = SCHEDULES[getDayType(d)];
      entry.completed?.forEach((bid) => {
        const block = sched.find((b) => b.id === bid);
        if (block?.track) totals[block.track] += block.hrs;
      });
    }
    return totals;
  }, [data.logs.content, today]);

  const todayTotalsPlanned = useMemo(() => {
    const totals = {};
    schedule.forEach((b) => { if (b.track) totals[b.track] = (totals[b.track] || 0) + b.hrs; });
    return totals;
  }, [schedule]);

  const todayCompleted = useMemo(() => {
    let done = 0, total = 0;
    schedule.forEach((b) => {
      if (b.track) {
        total += b.hrs;
        if (log.completed.includes(b.id)) done += b.hrs;
      }
    });
    return { done, total };
  }, [schedule, log.completed]);

  const isCurrentBlock = (timeStr) => {
    if (fmtDate(today) !== fmtDate(now)) return false;
    const [start, end] = timeStr.split('-');
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    const cur = now.getHours() * 60 + now.getMinutes();
    return cur >= sh * 60 + sm && cur < eh * 60 + em;
  };

  const streak = useMemo(() => {
    let count = 0;
    const d = new Date(); d.setHours(0, 0, 0, 0);
    const checkDate = (dt) => {
      const entry = data.logs.content[fmtDate(dt)];
      return entry && entry.completed?.length > 0;
    };
    if (!checkDate(d)) {
      d.setDate(d.getDate() - 1);
    }
    while (checkDate(d)) {
      count++;
      d.setDate(d.getDate() - 1);
    }
    return count;
  }, [data.logs.content]);

  const handleSetupComplete = (cfg) => {
    setConfig(cfg);
    setShowSetup(false);
  };

  const handleLogout = () => {
    clearConfig();
    setConfig(null);
    setShowSetup(true);
    setShowSettings(false);
    setData({
      logs: { content: DEFAULTS.logs, sha: null, loaded: false },
      apps: { content: DEFAULTS.apps, sha: null, loaded: false },
      dsa:  { content: DEFAULTS.dsa,  sha: null, loaded: false },
      os:   { content: DEFAULTS.os,   sha: null, loaded: false },
    });
  };

  if (showSetup) {
    return <SetupModal onComplete={handleSetupComplete} initial={config} />;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-zinc-500 font-mono text-sm">
        <Loader2 size={16} className="animate-spin mr-2" />
        loading from github...
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <Header
          today={today} now={now} streak={streak}
          done={todayCompleted.done} total={todayCompleted.total}
          syncStatus={syncStatus} syncError={syncError}
          onSettings={() => setShowSettings(true)}
          onRefresh={loadAll}
        />
        <Nav tab={tab} setTab={setTab} />
        <div className="mt-6">
          {tab === 'today' && (
            <TodayView
              today={today} setToday={setToday} dayType={dayType}
              schedule={schedule} log={log} toggleBlock={toggleBlock}
              updateNotes={updateNotes} isCurrentBlock={isCurrentBlock}
              todayTotalsPlanned={todayTotalsPlanned}
            />
          )}
          {tab === 'week' && (
            <WeekView today={today} setToday={setToday} logs={data.logs.content} trackHours={trackHoursThisWeek} />
          )}
          {tab === 'apps' && (
            <AppsView apps={data.apps.content} addApp={addApp} updateAppStatus={updateAppStatus} deleteApp={deleteApp} />
          )}
          {tab === 'dsa' && (
            <DsaView dsa={data.dsa.content} addDsa={addDsa} deleteDsa={deleteDsa} />
          )}
          {tab === 'os' && (
            <OsView os={data.os.content} addOs={addOs} deleteOs={deleteOs} />
          )}
        </div>
      </div>

      {showSettings && (
        <SettingsModal
          onClose={() => setShowSettings(false)}
          onLogout={handleLogout}
          onReconfigure={() => { setShowSettings(false); setShowSetup(true); }}
          config={config}
        />
      )}
    </div>
  );
}

function Header({ today, now, streak, done, total, syncStatus, syncError, onSettings, onRefresh }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between mb-6 sm:mb-8 pb-5 sm:pb-6 border-b border-zinc-800 gap-4">
      <div>
        <div className="flex items-center gap-3 mb-2">
          <div className="text-xs tracking-[0.2em] text-zinc-500">ROADMAP // TRACKER</div>
          <SyncIndicator status={syncStatus} error={syncError} />
        </div>
        <div className="text-2xl sm:text-3xl font-bold tracking-tight">
          {today.toLocaleDateString('en-US', { weekday: 'long' })}
          <span className="text-zinc-500 font-mono ml-2 sm:ml-3 text-xl sm:text-2xl">{fmtDate(today)}</span>
        </div>
      </div>
      <div className="flex items-center gap-4 sm:gap-6">
        <Stat icon={<Flame size={14} />} label="STREAK" value={`${streak}d`} />
        <Stat icon={<Target size={14} />} label="TODAY" value={`${done.toFixed(1)}/${total.toFixed(1)}h`} sub={`${pct}%`} />
        <Stat icon={<Clock size={14} />} label="TIME" value={now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })} />
        <div className="flex items-center gap-1 ml-1">
          <button onClick={onRefresh} className="text-zinc-600 hover:text-zinc-200 p-1.5" title="Refresh from GitHub">
            <RefreshCw size={14} />
          </button>
          <button onClick={onSettings} className="text-zinc-600 hover:text-zinc-200 p-1.5" title="Settings">
            <Settings size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

function SyncIndicator({ status, error }) {
  if (status === 'syncing') return <span className="text-amber-400 flex items-center gap-1 text-xs"><Loader2 size={10} className="animate-spin" />syncing</span>;
  if (status === 'saved')   return <span className="text-emerald-400 flex items-center gap-1 text-xs"><Cloud size={10} />saved</span>;
  if (status === 'error')   return <span className="text-red-400 flex items-center gap-1 text-xs" title={error}><AlertTriangle size={10} />error</span>;
  if (status === 'conflict')return <span className="text-orange-400 flex items-center gap-1 text-xs"><AlertTriangle size={10} />conflict</span>;
  return <span className="text-zinc-600 flex items-center gap-1 text-xs"><Cloud size={10} />synced</span>;
}

function Stat({ icon, label, value, sub }) {
  return (
    <div className="text-right">
      <div className="flex items-center gap-1.5 justify-end text-zinc-500 text-[10px] tracking-[0.2em] mb-1">
        {icon}<span>{label}</span>
      </div>
      <div className="font-mono text-base sm:text-lg tabular-nums">
        {value}
        {sub && <span className="text-zinc-500 text-xs ml-2">{sub}</span>}
      </div>
    </div>
  );
}

function Nav({ tab, setTab }) {
  const tabs = [
    { id: 'today', label: 'Today', icon: <Calendar size={14} /> },
    { id: 'week',  label: 'Week',  icon: <Activity size={14} /> },
    { id: 'apps',  label: 'Apps',  icon: <Briefcase size={14} /> },
    { id: 'dsa',   label: 'DSA',   icon: <Code size={14} /> },
    { id: 'os',    label: 'OSS',   icon: <GitBranch size={14} /> },
  ];
  return (
    <div className="flex gap-1 border-b border-zinc-800 overflow-x-auto">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => setTab(t.id)}
          className={`px-3 sm:px-4 py-2.5 text-sm flex items-center gap-2 border-b-2 -mb-px transition-colors flex-shrink-0 ${
            tab === t.id ? 'border-zinc-100 text-zinc-100' : 'border-transparent text-zinc-500 hover:text-zinc-300'
          }`}
        >
          {t.icon}{t.label}
        </button>
      ))}
    </div>
  );
}

function TodayView({ today, setToday, dayType, schedule, log, toggleBlock, updateNotes, isCurrentBlock, todayTotalsPlanned }) {
  const dayTypeLabels = { workday: 'WORK DAY', deepday: 'DEEP DAY', saturday: 'SATURDAY (PT)', sunday: 'SUNDAY' };
  const shiftDay = (n) => { const d = new Date(today); d.setDate(d.getDate() + n); setToday(d); };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <button onClick={() => shiftDay(-1)} className="text-zinc-500 hover:text-zinc-100 p-1"><ChevronLeft size={16} /></button>
            <span className="text-xs tracking-[0.2em] text-zinc-500">{dayTypeLabels[dayType]}</span>
            <button onClick={() => shiftDay(1)} className="text-zinc-500 hover:text-zinc-100 p-1"><ChevronRight size={16} /></button>
            {fmtDate(today) !== fmtDate(new Date()) && (
              <button onClick={() => setToday(new Date())} className="text-xs text-emerald-400 hover:text-emerald-300 ml-2">jump to today</button>
            )}
          </div>
        </div>
        <div className="space-y-1.5">
          {schedule.map((block) => {
            const checked = log.completed.includes(block.id);
            const current = isCurrentBlock(block.time);
            const track = block.track ? TRACKS[block.track] : null;
            return (
              <button
                key={block.id}
                onClick={() => toggleBlock(block.id)}
                className={`w-full text-left flex items-center gap-3 px-3 sm:px-4 py-3 rounded border transition-all ${
                  current
                    ? 'bg-zinc-900 border-zinc-700 ring-1 ring-zinc-700'
                    : checked
                      ? 'bg-zinc-900/50 border-zinc-800/50'
                      : 'bg-zinc-900/30 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900/50'
                }`}
              >
                {checked ? <CheckCircle2 size={18} className="text-emerald-400 flex-shrink-0" /> : <Circle size={18} className="text-zinc-600 flex-shrink-0" />}
                <div className="font-mono text-[11px] sm:text-xs text-zinc-500 tabular-nums w-24 sm:w-28 flex-shrink-0">{block.time}</div>
                <div className="flex-1 flex items-center gap-2 min-w-0">
                  <div className={`truncate ${checked ? 'text-zinc-500 line-through' : 'text-zinc-100'}`}>{block.name}</div>
                  {current && (
                    <span className="text-[10px] tracking-widest text-emerald-400 flex items-center gap-1 flex-shrink-0">
                      <Zap size={10} /> NOW
                    </span>
                  )}
                </div>
                {track && (
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`w-1.5 h-1.5 rounded-full ${track.dot}`}></span>
                    <span className={`text-[11px] ${track.color} font-mono hidden sm:inline w-16 text-right`}>{track.label}</span>
                    <span className="text-xs text-zinc-500 font-mono tabular-nums w-10 sm:w-12 text-right">{block.hrs}h</span>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-6">
        <div>
          <div className="text-xs tracking-[0.2em] text-zinc-500 mb-3">PLANNED TODAY</div>
          <div className="space-y-2">
            {Object.entries(todayTotalsPlanned).map(([k, hrs]) => {
              const t = TRACKS[k];
              return (
                <div key={k} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className={`w-1.5 h-1.5 rounded-full ${t.dot}`}></span>
                    <span className={t.color}>{t.label}</span>
                  </div>
                  <span className="font-mono text-zinc-400 tabular-nums">{hrs}h</span>
                </div>
              );
            })}
          </div>
        </div>

        <div>
          <div className="text-xs tracking-[0.2em] text-zinc-500 mb-3">NOTES</div>
          <textarea
            value={log.notes}
            onChange={(e) => updateNotes(e.target.value)}
            placeholder="What went well? What got skipped? Why?"
            className="w-full h-40 bg-zinc-900/50 border border-zinc-800 rounded px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-700 resize-none font-mono"
          />
        </div>
      </div>
    </div>
  );
}

function WeekView({ today, setToday, logs, trackHours }) {
  const shiftWeek = (n) => { const d = new Date(today); d.setDate(d.getDate() + n * 7); setToday(d); };
  const ws = getWeekStart(today);
  const we = new Date(ws); we.setDate(we.getDate() + 6);
  const weekRange = `${ws.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${we.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;

  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(ws); d.setDate(d.getDate() + i); days.push(d);
  }

  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="text-xs tracking-[0.2em] text-zinc-500">WEEK OF</div>
          <div className="flex items-center gap-3">
            <button onClick={() => shiftWeek(-1)} className="text-zinc-500 hover:text-zinc-100 p-1"><ChevronLeft size={16} /></button>
            <div className="font-mono text-zinc-400 text-sm">{weekRange}</div>
            <button onClick={() => shiftWeek(1)} className="text-zinc-500 hover:text-zinc-100 p-1"><ChevronRight size={16} /></button>
          </div>
        </div>
        <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
          {days.map((d) => {
            const k = fmtDate(d);
            const entry = logs[k];
            const sched = SCHEDULES[getDayType(d)];
            const trackBlocks = sched.filter((b) => b.track);
            const completed = entry?.completed?.filter((id) => trackBlocks.some((b) => b.id === id)).length || 0;
            const totalTrack = trackBlocks.length;
            const isToday = fmtDate(d) === fmtDate(new Date());
            const isPast = d < new Date(new Date().setHours(0, 0, 0, 0));
            const pct = totalTrack > 0 ? completed / totalTrack : 0;
            const barClass = pct === 1 ? 'bg-emerald-500' :
                             pct > 0.5 ? 'bg-amber-500' :
                             isPast && pct < 0.5 ? 'bg-red-500/60' : 'bg-zinc-700';
            return (
              <button
                key={k}
                onClick={() => setToday(d)}
                className={`p-2 sm:p-3 rounded border text-left ${isToday ? 'border-zinc-700 bg-zinc-900/60' : 'border-zinc-800 bg-zinc-900/30 hover:border-zinc-700'}`}
              >
                <div className={`text-[10px] tracking-[0.2em] mb-1 ${isToday ? 'text-emerald-400' : 'text-zinc-500'}`}>{DAY_LABELS[d.getDay()]}</div>
                <div className="font-mono text-xs text-zinc-500 mb-3 tabular-nums">{d.getDate()}</div>
                <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
                  <div className={`h-full ${barClass}`} style={{ width: `${pct * 100}%` }}></div>
                </div>
                <div className="mt-2 font-mono text-[10px] text-zinc-500 tabular-nums">{completed}/{totalTrack}</div>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <div className="text-xs tracking-[0.2em] text-zinc-500 mb-4">TRACK PROGRESS</div>
        <div className="space-y-3">
          {Object.entries(TRACKS).map(([key, t]) => {
            const actual = trackHours[key] || 0;
            const pct = Math.min(100, (actual / t.target) * 100);
            const statusColor = pct >= 100 ? 'text-emerald-400' : pct >= 60 ? 'text-amber-400' : 'text-red-400';
            return (
              <div key={key}>
                <div className="flex items-center justify-between mb-1.5 text-sm">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${t.dot}`}></span>
                    <span className={t.color}>{t.label}</span>
                  </div>
                  <div className="font-mono text-xs tabular-nums">
                    <span className={statusColor}>{actual.toFixed(2)}</span>
                    <span className="text-zinc-600 mx-1">/</span>
                    <span className="text-zinc-400">{t.target}h</span>
                  </div>
                </div>
                <div className="h-1.5 bg-zinc-900 rounded-full overflow-hidden">
                  <div className={`h-full ${t.bar}`} style={{ width: `${pct}%` }}></div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function AppsView({ apps, addApp, updateAppStatus, deleteApp }) {
  const [company, setCompany] = useState('');
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('Applied');

  const submit = () => {
    if (!company.trim() || !role.trim()) return;
    addApp({ company: company.trim(), role: role.trim(), status });
    setCompany(''); setRole(''); setStatus('Applied');
  };

  const weekStart = getWeekStart(new Date());
  const thisWeek = apps.filter((a) => new Date(a.date) >= weekStart).length;
  const stats = STATUS_OPTIONS.reduce((acc, s) => { acc[s] = apps.filter((a) => a.status === s).length; return acc; }, {});

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="THIS WEEK" value={thisWeek} accent="text-emerald-400" />
        <StatCard label="TOTAL" value={apps.length} />
        <StatCard label="ACTIVE" value={(stats['Applied']||0) + (stats['OA']||0) + (stats['Phone Screen']||0) + (stats['Onsite']||0)} accent="text-amber-400" />
        <StatCard label="OFFERS" value={stats['Offer']||0} accent="text-cyan-400" />
      </div>

      <div className="bg-zinc-900/50 border border-zinc-800 rounded p-4">
        <div className="text-xs tracking-[0.2em] text-zinc-500 mb-3">LOG NEW APPLICATION</div>
        <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
          <input value={company} onChange={(e) => setCompany(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} placeholder="Company" className="md:col-span-4 bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm focus:outline-none focus:border-zinc-700" />
          <input value={role} onChange={(e) => setRole(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} placeholder="Role" className="md:col-span-4 bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm focus:outline-none focus:border-zinc-700" />
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="md:col-span-3 bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm focus:outline-none focus:border-zinc-700">
            {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <button onClick={submit} className="md:col-span-1 bg-zinc-100 text-zinc-900 rounded px-3 py-2 text-sm font-medium hover:bg-white flex items-center justify-center"><Plus size={16} /></button>
        </div>
      </div>

      <div>
        <div className="text-xs tracking-[0.2em] text-zinc-500 mb-3">RECENT ({apps.length})</div>
        <div className="space-y-1">
          {apps.length === 0 && <div className="text-zinc-600 text-sm py-8 text-center">no applications logged yet</div>}
          {apps.map((a) => (
            <div key={a.id} className="flex items-center gap-3 px-3 py-2.5 bg-zinc-900/30 border border-zinc-800 rounded hover:border-zinc-700 group">
              <div className="font-mono text-xs text-zinc-500 tabular-nums w-24 flex-shrink-0">{a.date}</div>
              <div className="flex-1 min-w-0">
                <div className="text-zinc-100 text-sm truncate">{a.company}</div>
                <div className="text-zinc-500 text-xs truncate">{a.role}</div>
              </div>
              <select value={a.status} onChange={(e) => updateAppStatus(a.id, e.target.value)} className={`bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-xs focus:outline-none ${statusColor(a.status)}`}>
                {STATUS_OPTIONS.map((s) => <option key={s} value={s} className="text-zinc-100">{s}</option>)}
              </select>
              <button onClick={() => deleteApp(a.id)} className="text-zinc-700 hover:text-red-400 opacity-0 group-hover:opacity-100 transition"><Trash2 size={14} /></button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function statusColor(s) {
  if (s === 'Offer') return 'text-cyan-400';
  if (s === 'Onsite' || s === 'Phone Screen' || s === 'OA') return 'text-amber-400';
  if (s === 'Rejected' || s === 'Ghosted') return 'text-zinc-500';
  return 'text-emerald-400';
}

function DsaView({ dsa, addDsa, deleteDsa }) {
  const [name, setName] = useState('');
  const [difficulty, setDifficulty] = useState('Medium');
  const [link, setLink] = useState('');

  const submit = () => {
    if (!name.trim()) return;
    addDsa({ name: name.trim(), difficulty, link: link.trim() });
    setName(''); setLink('');
  };

  const weekStart = getWeekStart(new Date());
  const thisWeek = dsa.filter((d) => new Date(d.date) >= weekStart);
  const counts = {
    Easy: thisWeek.filter((d) => d.difficulty === 'Easy').length,
    Medium: thisWeek.filter((d) => d.difficulty === 'Medium').length,
    Hard: thisWeek.filter((d) => d.difficulty === 'Hard').length,
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="EASY (WK)" value={counts.Easy} accent="text-emerald-400" sub="/ 21" />
        <StatCard label="MEDIUM (WK)" value={counts.Medium} accent="text-amber-400" sub="/ 21" />
        <StatCard label="HARD (WK)" value={counts.Hard} accent="text-red-400" sub="/ 21" />
      </div>

      <div className="bg-zinc-900/50 border border-zinc-800 rounded p-4">
        <div className="text-xs tracking-[0.2em] text-zinc-500 mb-3">LOG PROBLEM</div>
        <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
          <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)} className={`md:col-span-2 bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm focus:outline-none ${difficulty === 'Easy' ? 'text-emerald-400' : difficulty === 'Medium' ? 'text-amber-400' : 'text-red-400'}`}>
            <option className="text-zinc-100">Easy</option>
            <option className="text-zinc-100">Medium</option>
            <option className="text-zinc-100">Hard</option>
          </select>
          <input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} placeholder="Problem name" className="md:col-span-5 bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm focus:outline-none focus:border-zinc-700" />
          <input value={link} onChange={(e) => setLink(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} placeholder="Link (optional)" className="md:col-span-4 bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm focus:outline-none focus:border-zinc-700" />
          <button onClick={submit} className="md:col-span-1 bg-zinc-100 text-zinc-900 rounded px-3 py-2 text-sm font-medium hover:bg-white flex items-center justify-center"><Plus size={16} /></button>
        </div>
      </div>

      <div>
        <div className="text-xs tracking-[0.2em] text-zinc-500 mb-3">RECENT ({dsa.length})</div>
        <div className="space-y-1">
          {dsa.length === 0 && <div className="text-zinc-600 text-sm py-8 text-center">no problems logged yet</div>}
          {dsa.map((d) => (
            <div key={d.id} className="flex items-center gap-3 px-3 py-2.5 bg-zinc-900/30 border border-zinc-800 rounded hover:border-zinc-700 group">
              <div className="font-mono text-xs text-zinc-500 tabular-nums w-24 flex-shrink-0">{d.date}</div>
              <div className={`text-xs font-mono w-16 ${d.difficulty === 'Easy' ? 'text-emerald-400' : d.difficulty === 'Medium' ? 'text-amber-400' : 'text-red-400'}`}>{d.difficulty.toUpperCase()}</div>
              <div className="flex-1 min-w-0">
                {d.link ? (
                  <a href={d.link} target="_blank" rel="noopener noreferrer" className="text-zinc-100 text-sm hover:text-emerald-400 truncate block">{d.name}</a>
                ) : (
                  <div className="text-zinc-100 text-sm truncate">{d.name}</div>
                )}
              </div>
              <button onClick={() => deleteDsa(d.id)} className="text-zinc-700 hover:text-red-400 opacity-0 group-hover:opacity-100 transition"><Trash2 size={14} /></button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function OsView({ os, addOs, deleteOs }) {
  const [project, setProject] = useState('');
  const [type, setType] = useState('PR');
  const [link, setLink] = useState('');

  const submit = () => {
    if (!project.trim()) return;
    addOs({ project: project.trim(), type, link: link.trim() });
    setProject(''); setLink('');
  };

  const weekStart = getWeekStart(new Date());
  const thisWeek = os.filter((o) => new Date(o.date) >= weekStart).length;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="THIS WEEK" value={thisWeek} accent="text-emerald-400" />
        <StatCard label="TOTAL" value={os.length} />
        <StatCard label="PRs" value={os.filter((o) => o.type === 'PR').length} accent="text-cyan-400" />
      </div>

      <div className="bg-zinc-900/50 border border-zinc-800 rounded p-4">
        <div className="text-xs tracking-[0.2em] text-zinc-500 mb-3">LOG CONTRIBUTION</div>
        <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
          <select value={type} onChange={(e) => setType(e.target.value)} className="md:col-span-2 bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm focus:outline-none focus:border-zinc-700">
            <option>PR</option>
            <option>Issue</option>
            <option>Review</option>
            <option>Discussion</option>
          </select>
          <input value={project} onChange={(e) => setProject(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} placeholder="Project (e.g., 'llamaindex')" className="md:col-span-4 bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm focus:outline-none focus:border-zinc-700" />
          <input value={link} onChange={(e) => setLink(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} placeholder="Link" className="md:col-span-5 bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm focus:outline-none focus:border-zinc-700" />
          <button onClick={submit} className="md:col-span-1 bg-zinc-100 text-zinc-900 rounded px-3 py-2 text-sm font-medium hover:bg-white flex items-center justify-center"><Plus size={16} /></button>
        </div>
      </div>

      <div>
        <div className="text-xs tracking-[0.2em] text-zinc-500 mb-3">RECENT ({os.length})</div>
        <div className="space-y-1">
          {os.length === 0 && <div className="text-zinc-600 text-sm py-8 text-center">no contributions logged yet</div>}
          {os.map((o) => (
            <div key={o.id} className="flex items-center gap-3 px-3 py-2.5 bg-zinc-900/30 border border-zinc-800 rounded hover:border-zinc-700 group">
              <div className="font-mono text-xs text-zinc-500 tabular-nums w-24 flex-shrink-0">{o.date}</div>
              <div className="text-xs font-mono text-orange-400 w-20">{o.type.toUpperCase()}</div>
              <div className="flex-1 min-w-0">
                {o.link ? (
                  <a href={o.link} target="_blank" rel="noopener noreferrer" className="text-zinc-100 text-sm hover:text-orange-400 truncate block">{o.project}</a>
                ) : (
                  <div className="text-zinc-100 text-sm truncate">{o.project}</div>
                )}
              </div>
              <button onClick={() => deleteOs(o.id)} className="text-zinc-700 hover:text-red-400 opacity-0 group-hover:opacity-100 transition"><Trash2 size={14} /></button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, accent = 'text-zinc-100', sub }) {
  return (
    <div className="bg-zinc-900/30 border border-zinc-800 rounded px-4 py-3">
      <div className="text-[10px] tracking-[0.2em] text-zinc-500 mb-1">{label}</div>
      <div className="font-mono tabular-nums">
        <span className={`text-2xl font-semibold ${accent}`}>{value}</span>
        {sub && <span className="text-zinc-600 text-sm ml-1">{sub}</span>}
      </div>
    </div>
  );
}

function SettingsModal({ onClose, onLogout, onReconfigure, config }) {
  return (
    <div className="fixed inset-0 bg-zinc-950/90 backdrop-blur z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold mb-4">Settings</h2>
        <div className="space-y-3 mb-6 text-sm">
          <div className="flex justify-between"><span className="text-zinc-500">Owner</span><span className="font-mono">{config?.owner}</span></div>
          <div className="flex justify-between"><span className="text-zinc-500">Repo</span><span className="font-mono">{config?.repo}</span></div>
          <div className="flex justify-between"><span className="text-zinc-500">Token</span><span className="font-mono">****{config?.token?.slice(-4)}</span></div>
        </div>
        <div className="space-y-2">
          <button onClick={onReconfigure} className="w-full bg-zinc-800 hover:bg-zinc-700 rounded px-4 py-2 text-sm flex items-center justify-center gap-2">
            <Settings size={14} /> Reconfigure
          </button>
          <button onClick={onLogout} className="w-full bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded px-4 py-2 text-sm flex items-center justify-center gap-2">
            <LogOut size={14} /> Sign out (clear local token)
          </button>
          <button onClick={onClose} className="w-full text-zinc-500 hover:text-zinc-100 px-4 py-2 text-sm">Close</button>
        </div>
      </div>
    </div>
  );
}
