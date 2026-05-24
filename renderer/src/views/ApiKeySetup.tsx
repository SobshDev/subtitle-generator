import { useState } from 'react';
import { ipc } from '../ipc/client';

type Props = {
  onSaved: () => void;
};

export function ApiKeySetup({ onSaved }: Props): JSX.Element {
  const [key, setKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSave = async () => {
    if (!key.trim()) {
      setError('Enter a key first.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await ipc.setGroqKey({ key: key.trim() });
      onSaved();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex h-full w-full items-center justify-center bg-neutral-950 p-8">
      <div className="w-full max-w-md rounded-lg border border-neutral-800 bg-neutral-900 p-6 shadow-xl">
        <h2 className="mb-1 text-lg font-semibold text-neutral-100">
          Set Groq API key
        </h2>
        <p className="mb-4 text-sm text-neutral-400">
          Required to transcribe audio via Whisper Large v3. Get a free key at
          console.groq.com. Stored in your system keychain.
        </p>
        <input
          type="password"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="gsk_…"
          className="mb-3 w-full rounded bg-neutral-800 px-3 py-2 font-mono text-sm text-neutral-100 outline-none focus:ring-1 focus:ring-sky-500"
        />
        {error && (
          <p className="mb-3 text-xs text-rose-300">{error}</p>
        )}
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="w-full rounded bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save key'}
        </button>
      </div>
    </div>
  );
}
