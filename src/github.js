const API_BASE = 'https://api.github.com';
const CFG_KEY = 'rt:config';

function b64encode(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function b64decode(b64) {
  const binary = atob(b64.replace(/\n/g, ''));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

export class ConflictError extends Error {
  constructor() {
    super('SHA conflict, refresh and retry');
    this.name = 'ConflictError';
  }
}

export class GitHub {
  constructor({ token, owner, repo }) {
    this.token = token;
    this.owner = owner;
    this.repo = repo;
  }

  async _req(path, options = {}) {
    return fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...options.headers,
      },
    });
  }

  async testAuth() {
    const res = await this._req(`/repos/${this.owner}/${this.repo}`);
    if (res.status === 404) throw new Error('Repo not found or token lacks access');
    if (res.status === 401) throw new Error('Token invalid');
    if (!res.ok) throw new Error(`Auth check failed: ${res.status}`);
    return true;
  }

  async fetchFile(path) {
    const res = await this._req(`/repos/${this.owner}/${this.repo}/contents/${path}`);
    if (res.status === 404) return { content: null, sha: null };
    if (!res.ok) throw new Error(`Fetch ${path}: ${res.status}`);
    const data = await res.json();
    try {
      return { content: JSON.parse(b64decode(data.content)), sha: data.sha };
    } catch {
      return { content: null, sha: data.sha };
    }
  }

  async saveFile(path, content, sha = null) {
    const body = {
      message: `update ${path}`,
      content: b64encode(JSON.stringify(content, null, 2)),
      ...(sha ? { sha } : {}),
    };
    const res = await this._req(`/repos/${this.owner}/${this.repo}/contents/${path}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
    if (res.status === 409 || res.status === 422) throw new ConflictError();
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Save ${path} (${res.status}): ${err}`);
    }
    const data = await res.json();
    return data.content.sha;
  }
}

export function loadConfig() {
  try {
    return JSON.parse(localStorage.getItem(CFG_KEY)) || null;
  } catch {
    return null;
  }
}

export function saveConfig(cfg) {
  localStorage.setItem(CFG_KEY, JSON.stringify(cfg));
}

export function clearConfig() {
  localStorage.removeItem(CFG_KEY);
}
