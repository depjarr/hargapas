import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { supabase } from '../lib/supabase'
import { must, useData } from '../lib/data'
import { useToast } from '../lib/toast'
import { buildContext } from '../lib/aiContext'
import { fnErrorMessage } from '../lib/fn'
import type { ChatMsg } from '../lib/types'
import Icon from '../components/Icon'
import Markdown from '../components/Markdown'
import { useConfirm } from '../lib/confirm'

const SUGGEST = [
  'Apakah harga produkku terlalu mahal?',
  'Produk mana yang untungnya paling kecil?',
  'Kalau mau untung Rp2.000 per produk, harganya berapa?',
  'Kalau aku kasih diskon 15%, masih untung?',
]
const time = (s: string) => new Date(s).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
const day = (s: string) => {
  const d = new Date(s), t = new Date()
  if (d.toDateString() === t.toDateString()) return time(s)
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
}

export default function Consultant() {
  const d = useData()
  const toast = useToast()
  const confirmDlg = useConfirm()
  const [sel, setSel] = useState('')
  const [msgs, setMsgs] = useState<ChatMsg[]>([])
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [list, setList] = useState(false)          // daftar percakapan (HP)
  const [copied, setCopied] = useState('')
  const box = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLTextAreaElement>(null)
  const justCreated = useRef('')

  useEffect(() => { if (!sel && d.chats[0]) setSel(d.chats[0].id) }, [d.chats, sel])

  useEffect(() => {
    if (!sel) { setMsgs([]); return }
    if (justCreated.current === sel) { justCreated.current = ''; return }
    let live = true
    supabase.from('chat_messages').select('*').eq('chat_id', sel).order('created_at').then(({ data }) => { if (live) setMsgs((data ?? []) as ChatMsg[]) })
    return () => { live = false }
  }, [sel])

  useEffect(() => { box.current?.scrollTo({ top: box.current.scrollHeight, behavior: 'smooth' }) }, [msgs, busy, err])

  // kolom ketik ikut membesar sampai 5 baris
  useEffect(() => {
    const el = input.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 140) + 'px'
  }, [text])

  const cur = d.chats.find(c => c.id === sel)

  function pick(id: string) { setSel(id); setErr(''); setList(false) }

  async function newChat(): Promise<string | null> {
    const r = await supabase.from('chats').insert({ title: 'Percakapan baru' }).select('id').single()
    if (r.error) { toast(r.error.message, true); return null }
    justCreated.current = r.data.id
    await d.refreshChats()
    setSel(r.data.id); setMsgs([]); setErr(''); setList(false)
    setTimeout(() => input.current?.focus(), 50)
    return r.data.id as string
  }

  async function removeChat(id: string) {
    const t = d.chats.find(c => c.id === id)?.title
    if (!(await confirmDlg({ title: 'Hapus percakapan?', message: `"${t ?? 'Percakapan ini'}" dan semua pesannya akan dihapus permanen.`, confirmLabel: 'Hapus', danger: true }))) return
    const r = await supabase.from('chats').delete().eq('id', id)
    if (r.error) return toast(r.error.message, true)
    if (id === sel) { setSel(''); setMsgs([]) }
    await d.refreshChats()
    toast('Percakapan dihapus')
  }

  /** Minta jawaban AI untuk riwayat yang sudah tersimpan. */
  async function ask(history: ChatMsg[], cid: string) {
    setBusy(true); setErr('')
    try {
      const { data, error } = await supabase.functions.invoke('ai-consultant', {
        body: { messages: history.map(m => ({ role: m.role, content: m.content })), context: buildContext(d.products, d.groups) },
      })
      if (error) throw new Error(await fnErrorMessage(error, 'Gagal menghubungi konsultan AI.'))
      const am = await supabase.from('chat_messages').insert({ chat_id: cid, role: 'assistant', content: data.reply }).select('*').single()
      must(am)
      setMsgs([...history, am.data as ChatMsg])
    } catch (e) { setErr(e instanceof Error ? e.message : 'Terjadi kesalahan.') }
    setBusy(false)
  }

  async function send(raw = text) {
    const t = raw.trim()
    if (!t || busy) return
    setText(''); setErr(''); setBusy(true)
    try {
      let cid = sel
      if (!cid) { const n = await newChat(); if (!n) { setBusy(false); return }; cid = n }
      const um = await supabase.from('chat_messages').insert({ chat_id: cid, role: 'user', content: t }).select('*').single()
      must(um)
      const history = [...msgs, um.data as ChatMsg]
      setMsgs(history)
      if (history.length === 1) { await supabase.from('chats').update({ title: t.slice(0, 40) }).eq('id', cid); d.refreshChats() }
      await ask(history, cid)
    } catch (e) { setErr(e instanceof Error ? e.message : 'Terjadi kesalahan.'); setBusy(false) }
  }

  const lastIsUser = msgs.length > 0 && msgs[msgs.length - 1].role === 'user'
  function onKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send() }
  }
  async function copy(m: ChatMsg) {
    try { await navigator.clipboard.writeText(m.content); setCopied(m.id); setTimeout(() => setCopied(''), 1500) } catch { /* abaikan */ }
  }

  const Threads = (
    <>
      <button type="button" className="btn block" onClick={newChat}><Icon n="plus" />Percakapan baru</button>
      <div className="threads">
        {d.chats.map(c => (
          <div key={c.id} className={`thread${c.id === sel ? ' on' : ''}`}>
            <button type="button" className="tmain" onClick={() => pick(c.id)}>
              <span className="ttitle">{c.title}</span>
              <small>{day(c.created_at)}</small>
            </button>
            <button type="button" className="tdel" aria-label={`Hapus percakapan ${c.title}`} onClick={() => removeChat(c.id)}><Icon n="trash" /></button>
          </div>
        ))}
        {!d.chats.length && <p className="mu" style={{ padding: '8px 4px', fontSize: 14 }}>Belum ada percakapan.</p>}
      </div>
    </>
  )

  return (
    <div className="chatapp">
      <aside className="chatside">{Threads}</aside>

      <section className="chatmain">
        <header className="chathead">
          <button type="button" className="iconbtn hide-wide" onClick={() => setList(true)} aria-label="Daftar percakapan"><Icon n="layers" /></button>
          <span className="aiav"><Icon n="spark" /></span>
          <span className="who">
            <b>Konsultan HargaPas</b>
            <small>{busy ? 'sedang mengetik…' : cur ? cur.title : 'Membaca data produkmu'}</small>
          </span>
          <button type="button" className="iconbtn hide-wide" onClick={newChat} aria-label="Percakapan baru"><Icon n="edit" /></button>
        </header>

        <div className="chatlog" ref={box} aria-live="polite">
          {msgs.length === 0 && !busy ? (
            <div className="hello">
              <span className="aiav lg"><Icon n="spark" /></span>
              <h2>Halo! Mau tanya soal harga?</h2>
              <p className="mu">Aku bisa membaca data produkmu dan menghitung simulasi harga, diskon, atau target untung.</p>
              <div className="suggest">
                {SUGGEST.map(s => <button type="button" key={s} onClick={() => send(s)}>{s}</button>)}
              </div>
            </div>
          ) : msgs.map((m, i) => {
            const mine = m.role === 'user'
            const first = i === 0 || msgs[i - 1].role !== m.role
            return (
              <div key={m.id} className={`mrow ${mine ? 'me' : 'ai'}${first ? ' first' : ''}`}>
                {!mine && (first ? <span className="aiav sm"><Icon n="spark" /></span> : <span className="avgap" />)}
                <div className="bubble">
                  {mine ? <span className="plain">{m.content}</span> : <Markdown text={m.content} />}
                  <span className="meta">
                    {time(m.created_at)}
                    {!mine && <button type="button" onClick={() => copy(m)} aria-label="Salin jawaban"><Icon n={copied === m.id ? 'check' : 'copy'} /></button>}
                  </span>
                </div>
              </div>
            )
          })}
          {busy && (
            <div className="mrow ai first">
              <span className="aiav sm"><Icon n="spark" /></span>
              <div className="bubble typing" aria-label="AI sedang mengetik"><i /><i /><i /></div>
            </div>
          )}
          {err && !busy && (
            <div className="chaterr" role="alert">
              <span>{err}</span>
              {lastIsUser && sel && <button type="button" className="btn sm" onClick={() => ask(msgs, sel)}>Coba lagi</button>}
            </div>
          )}
        </div>

        <form className="composer2" onSubmit={e => { e.preventDefault(); send() }}>
          <textarea ref={input} rows={1} aria-label="Pesan" placeholder="Tanya soal harga…" value={text} maxLength={1000}
            onChange={e => setText(e.target.value)} onKeyDown={onKey} />
          <button className="send" disabled={busy || !text.trim()} aria-label="Kirim"><Icon n="send" /></button>
        </form>
      </section>

      {list && (
        <>
          <div className="scrim" onClick={() => setList(false)} />
          <div className="asheet chatsheet" role="dialog" aria-label="Daftar percakapan">
            <div className="group" style={{ padding: 12 }}>{Threads}</div>
            <button className="cancel" onClick={() => setList(false)}>Tutup</button>
          </div>
        </>
      )}
    </div>
  )
}
