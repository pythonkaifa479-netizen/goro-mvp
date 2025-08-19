import { useEffect, useMemo, useState } from 'react';

type Candidate = { mnemonic: string; scene: string };
type HistoryItem = { word: string; mnemonic: string; scene: string; imageUrl: string; created_at: string; favorite?: boolean };

const HISTORY_KEY = 'gw_history_v1';
const LIMIT_KEY = 'gw_limit_v1';

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

export default function Home() {
  const [word, setWord] = useState('');
  const [loadingText, setLoadingText] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [limit, setLimit] = useState({ date: todayKey(), count: 0 });
  const remaining = useMemo(() => Math.max(0, 5 - limit.count), [limit]);

  useEffect(() => {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (raw) {
      try { setHistory(JSON.parse(raw)); } catch {}
    }
    const rawL = localStorage.getItem(LIMIT_KEY);
    const today = todayKey();
    if (rawL) {
      try { 
        const parsed = JSON.parse(rawL);
        if (parsed.date !== today) setLimit({ date: today, count: 0 });
        else setLimit(parsed);
      } catch { setLimit({ date: today, count: 0 }); }
    } else setLimit({ date: today, count: 0 });
  }, []);

  useEffect(() => {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0,50)));
  }, [history]);
  useEffect(() => {
    localStorage.setItem(LIMIT_KEY, JSON.stringify(limit));
  }, [limit]);

  async function genMnemonic() {
    if (!word.trim()) return;
    if (remaining <= 0) {
      alert('本日の無料枠が終了しました。プランのご案内ページへ移動します。');
      window.open('https://example.com/plan', '_blank');
      return;
    }
    setLoadingText('語呂を生成中…');
    setImageUrl(null);
    setCandidates([]);
    setSelected(null);
    try {
      const resp = await fetch('/api/generate-mnemonic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ word: word.trim() })
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.error?.message || '生成に失敗しました');
      setCandidates(data.candidates || []);
      setLimit(l => ({ date: l.date, count: l.count + 1 }));
    } catch (e: any) {
      alert(e?.message || '生成に失敗しました');
    } finally {
      setLoadingText(null);
    }
  }

  async function genImage(idx: number) {
    setSelected(idx);
    setLoadingText('画像を生成中…');
    setImageUrl(null);
    const c = candidates[idx];
    try {
      const resp = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mnemonic: c.mnemonic, scene: c.scene })
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.error?.message || '画像生成に失敗しました');
      setImageUrl(data.imageUrl);
      const item: HistoryItem = {
        word: word.trim(),
        mnemonic: c.mnemonic,
        scene: c.scene,
        imageUrl: data.imageUrl,
        created_at: new Date().toISOString()
      };
      setHistory(h => [item, ...h].slice(0,50));
    } catch (e: any) {
      alert(e?.message || '画像生成に失敗しました');
    } finally {
      setLoadingText(null);
    }
  }

  function clearHistory() {
    if (confirm('履歴をすべて削除しますか？')) setHistory([]);
  }

  return (
    <div className="container">
      <div className="card">
        <h1>AIゴロ帳（MVP）</h1>
        <p className="muted">英単語を入力すると、<b>語呂3案</b>と<b>記憶用イメージ</b>を生成します。無料枠は1日5回まで。</p>
        <div className="row" style={{marginBottom:12}}>
          <input 
            type="text" 
            placeholder="例: abandon, obvious, fragile ..." 
            value={word} 
            onChange={e => setWord(e.target.value)} 
            onKeyDown={(e) => { if (e.key==='Enter') genMnemonic(); }}
          />
          <button className="btn" onClick={genMnemonic} disabled={!word || !!loadingText}>生成</button>
        </div>
        <div className="row" style={{justifyContent:'space-between', marginBottom:12}}>
          <span className="counter">本日の残り回数：{remaining}/5</span>
          <span className="chip">MVP / Beta</span>
        </div>

        {loadingText && <div className="result"><span>{loadingText}</span></div>}

        {candidates.length > 0 && (
          <div style={{marginTop:12}}>
            <h3>語呂候補</h3>
            <div className="grid">
              {candidates.map((c, i) => (
                <div key={i} className="result">
                  <div className="mnemonic">{c.mnemonic}</div>
                  <div className="scene">情景：{c.scene}</div>
                  <div style={{marginTop:10}}>
                    <button className="btn secondary" onClick={() => genImage(i)} disabled={loadingText!==null}>この案で画像生成</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {imageUrl && (
          <div style={{marginTop:16}}>
            <h3>生成した画像</h3>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageUrl} alt="mnemonic" className="image" />
          </div>
        )}

        <div className="history">
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
            <h3>履歴</h3>
            <button className="btn secondary" onClick={clearHistory}>履歴をクリア</button>
          </div>
          <div className="grid">
            {history.map((h, i) => (
              <div key={i} className="result">
                <div className="chip">{new Date(h.created_at).toLocaleString()}</div>
                <div style={{marginTop:6, fontSize:13, color:'#a5b1c2'}}>単語: <b>{h.word}</b></div>
                <div className="mnemonic" style={{marginTop:6}}>{h.mnemonic}</div>
                <div className="scene">情景：{h.scene}</div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={h.imageUrl} alt="img" className="image" style={{marginTop:8}} />
              </div>
            ))}
          </div>
        </div>

        <div className="footer">
          不適切表現・権利侵害となる生成は避けてください。画像は学習用途での利用を想定しています。
        </div>
      </div>
    </div>
  );
}
