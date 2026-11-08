import { useCallback, useEffect, useRef, useState } from 'react';
import {recordChanged} from '../phase6/cloud-sync';
import type { ChangeEvent } from 'react';
import { AudioLines, Bookmark, BookOpen, CheckCircle2, ChevronLeft, ChevronRight, FileAudio2, FileText, Headphones, Link2, Pause, Play, Plus, RefreshCw, ShieldCheck, Trash2, UploadCloud, Volume2, Youtube } from 'lucide-react';
import { addBookmark, emptyMediaState, isSafeExternalUrl, MEDIA_STORAGE_KEY, normalizedProgress, parseYouTubeEmbed, readMediaState, stableTextId, upsertProgress } from './media-core';
import type { MediaKind, MediaState } from './media-core';
import './media-studio.css';

interface Source { id: string; name: string; kind: string; url: string; source: string; status: string; length: string }
interface MediaStudioProps { sources: Source[]; notify: (message: string) => void }
type MediaTab = 'video' | 'pdf' | 'audio' | 'text';
type PDFDoc = Awaited<ReturnType<(typeof import('pdfjs-dist'))['getDocument']>['promise']>;
const SAMPLE = 'Learning improves through short, consistent sessions. Listen carefully, pause when something matters, and make one actionable note. Practise the skill in real life and check progress against evidence. If your schedule changes, adjust the next study session instead of sacrificing rest.';
const fmt = (value: number) => Number.isFinite(value) ? `${Math.floor(value / 60)}:${String(Math.floor(value % 60)).padStart(2, '0')}` : '0:00';
const percent = (value: number) => `${Math.max(0, Math.min(100, value))}%`;

export default function MediaStudio({ sources, notify }: MediaStudioProps) {
  const [tab, setTab] = useState<MediaTab>('video');
  const [state, setState] = useState<MediaState>(() => { try { return readMediaState(localStorage.getItem(MEDIA_STORAGE_KEY)); } catch { return emptyMediaState(); } });
  useEffect(() => { try { localStorage.setItem(MEDIA_STORAGE_KEY, JSON.stringify(state));recordChanged(MEDIA_STORAGE_KEY); } catch { /* private storage mode */ } }, [state]);
  useEffect(()=>{const hydrate=()=>{try{setState(readMediaState(localStorage.getItem(MEDIA_STORAGE_KEY)))}catch{/* ignore */}};window.addEventListener('los:cloud-hydrate',hydrate);return()=>window.removeEventListener('los:cloud-hydrate',hydrate)},[]);
  useEffect(() => {
    const onStorage = (event: StorageEvent) => { if (event.key === MEDIA_STORAGE_KEY) setState(readMediaState(event.newValue)); };
    window.addEventListener('storage', onStorage); return () => window.removeEventListener('storage', onStorage);
  }, []);
  const persistProgress = useCallback((id: string, kind: MediaKind, position: number, total: number, completed = false) => {
    if (!id) return;
    setState(previous => upsertProgress(previous, normalizedProgress({ mediaId: id, kind, position, total, completed })));
  }, []);


  // YouTube embeds expose no trustworthy playback position to this Pages-only UI.
  const videos = sources.filter(source => ['video', 'playlist'].includes(source.kind));
  const [customUrl, setCustomUrl] = useState('');
  const [selectedVideo, setSelectedVideo] = useState(() => videos.find(v => parseYouTubeEmbed(v.url))?.url ?? '');
  const [videoMinute, setVideoMinute] = useState(0);
  const [bookmarkTitle, setBookmarkTitle] = useState('');
  const embedded = parseYouTubeEmbed(selectedVideo);
  const videoId = embedded ? `youtube:${embedded.type}:${embedded.id}` : '';
  const videoProgress = videoId ? state.progress[videoId] : null;

  // PDF bytes remain only in memory; page position and bookmarks persist.
  const [pdfDoc, setPdfDoc] = useState<PDFDoc | null>(null);
  const [pdfName, setPdfName] = useState('');
  const [pdfId, setPdfId] = useState('');
  const [pdfPage, setPdfPage] = useState(1);
  const [pdfText, setPdfText] = useState('');
  const [pdfError, setPdfError] = useState('');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const loadPdf = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0]; if (!file) return;
    if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') { setPdfError('Choose a PDF file.'); return; }
    if (file.size > 20_000_000) { setPdfError('PDF limit is 20 MB. Split larger documents.'); return; }
    setPdfError('');
    try {
      const [{ getDocument, GlobalWorkerOptions }, { default: workerUrl }] = await Promise.all([import('pdfjs-dist'), import('pdfjs-dist/build/pdf.worker.min.mjs?url')]);
      GlobalWorkerOptions.workerSrc = workerUrl;
      const document = await getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
      if (document.numPages > 120) { await document.destroy(); throw new Error('PDF limit is 120 pages. Split larger documents.'); }
      const id = `pdf:${file.name}:${file.size}:${file.lastModified}`;
      const remembered = state.progress[id]?.position ?? 1;
      await pdfDoc?.destroy();
      setPdfDoc(document); setPdfId(id); setPdfName(file.name); setPdfPage(Math.min(document.numPages, Math.max(1, Math.floor(remembered))));
      notify('PDF opened locally; the document was not uploaded.');
    } catch (error) { setPdfError(error instanceof Error ? error.message : 'Cannot open this PDF.'); }
  };
  useEffect(() => {
    if (!pdfDoc) return;
    let cancelled = false;
    let renderTask: ReturnType<Awaited<ReturnType<PDFDoc['getPage']>>['render']> | undefined;
    const render = async () => {
      try {
        const pdfPageDocument = await pdfDoc.getPage(pdfPage);
        if (cancelled) return;
        const original = pdfPageDocument.getViewport({ scale: 1 });
        const viewport = pdfPageDocument.getViewport({ scale: Math.min(1.6, 780 / original.width) });
        const canvas = canvasRef.current;
        if (!canvas) return;
        canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
        const context = canvas.getContext('2d'); if (!context) return;
        renderTask = pdfPageDocument.render({ canvasContext: context, canvas, viewport });
        await renderTask.promise;
        const content = await pdfPageDocument.getTextContent();
        if (!cancelled) setPdfText(content.items.map(item => ('str' in item ? String(item.str) : '')).join(' ').trim());
      } catch (error) { if (!cancelled) setPdfError(error instanceof Error ? error.message : 'Unable to render this page.'); }
    };
    void render();
    return () => { cancelled = true; renderTask?.cancel(); };
  }, [pdfDoc, pdfPage]);
  useEffect(() => () => { if (pdfDoc) void pdfDoc.destroy(); }, [pdfDoc]);
  const goPage = (newPage: number) => {
    if (!pdfDoc) return;
    const page = Math.min(pdfDoc.numPages, Math.max(1, newPage));
    setPdfText(''); setPdfPage(page); persistProgress(pdfId, 'pdf', page, pdfDoc.numPages);
  };

  // Local audio player uses browser-native play/pause/seek and stores periodic playback positions.
  const audioRef = useRef<HTMLAudioElement>(null);
  const audioUrlRef = useRef<string | null>(null);
  const lastAudioSave = useRef(0);
  const [audioUrl, setAudioUrl] = useState('');
  const [audioName, setAudioName] = useState('');
  const [audioId, setAudioId] = useState('');
  const [audioRate, setAudioRate] = useState(1);
  const [audioDuration, setAudioDuration] = useState(0);
  const [audioCurrent, setAudioCurrent] = useState(0);
  const [audioError, setAudioError] = useState('');
  useEffect(() => () => { if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current); }, []);
  const loadAudio = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0]; if (!file) return;
    if (!file.type.startsWith('audio/') && !/\.(mp3|m4a|wav|ogg|webm)$/i.test(file.name)) { setAudioError('Choose an audio file.'); return; }
    if (file.size > 80_000_000) { setAudioError('Audio limit is 80 MB.'); return; }
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    const url = URL.createObjectURL(file); audioUrlRef.current = url;
    setAudioUrl(url); setAudioName(file.name); setAudioId(`audio:${file.name}:${file.size}:${file.lastModified}`);
    setAudioError(''); setAudioCurrent(0); setAudioDuration(0); lastAudioSave.current = 0;
    notify('Audio loaded locally. The file is not stored or uploaded.');
  };
  const saveAudioProgress = (force = false) => {
    const player = audioRef.current; if (!player || !audioId || !Number.isFinite(player.duration)) return;
    if (!force && Math.abs(player.currentTime - lastAudioSave.current) < 3) return;
    lastAudioSave.current = player.currentTime;
    setAudioCurrent(player.currentTime); persistProgress(audioId, 'audio', player.currentTime, player.duration);
  };

  // TTS speaks only text supplied or typed by the learner; third-party URL text is never scraped.
  const [spokenText, setSpokenText] = useState(SAMPLE);
  const [ttsRate, setTtsRate] = useState(1);
  const [speaking, setSpeaking] = useState(false);
  const [paused, setPaused] = useState(false);
  const [ttsCursor, setTtsCursor] = useState(0);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceURI, setVoiceURI] = useState('');
  const ttsId = stableTextId(spokenText);
  const ttsProgress = state.progress[ttsId];
  useEffect(() => {
    if (!('speechSynthesis' in window)) return;
    const reload = () => setVoices(window.speechSynthesis.getVoices());
    reload(); window.speechSynthesis.addEventListener('voiceschanged', reload);
    return () => { window.speechSynthesis.removeEventListener('voiceschanged', reload); window.speechSynthesis.cancel(); };
  }, []);
  const stopSpeech = () => {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    setSpeaking(false); setPaused(false);
  };
  const playSpeech = (text = spokenText, mediaId = ttsId) => {
    if (!('speechSynthesis' in window)) { notify('Speech synthesis is unavailable in this browser.'); return; }
    if (!text.trim()) { notify('Add text before listening.'); return; }
    stopSpeech(); const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = ttsRate; utterance.lang = 'en-US';
    const chosen = voices.find(voice => voice.voiceURI === voiceURI); if (chosen) utterance.voice = chosen;
    utterance.onboundary = event => {
      if (typeof event.charIndex === 'number') {
        setTtsCursor(event.charIndex);
        persistProgress(mediaId, 'text', event.charIndex, text.length);
      }
    };
    utterance.onend = () => { setSpeaking(false); setPaused(false); persistProgress(mediaId, 'text', text.length, text.length, true); };
    utterance.onerror = () => { setSpeaking(false); setPaused(false); };
    window.speechSynthesis.speak(utterance); setSpeaking(true);
  };
  const pauseSpeech = () => {
    if (!('speechSynthesis' in window) || !speaking) return;
    if (paused) window.speechSynthesis.resume(); else window.speechSynthesis.pause();
    setPaused(!paused);
  };

  const [markNote, setMarkNote] = useState('');
  const activeId = tab === 'video' ? videoId : tab === 'pdf' ? pdfId : tab === 'audio' ? audioId : ttsId;
  const activePosition = tab === 'video' ? videoMinute * 60 : tab === 'pdf' ? pdfPage : tab === 'audio' ? (audioRef.current?.currentTime ?? audioCurrent) : ttsCursor;
  const activeProgress = state.progress[activeId];
  const marks = state.bookmarks.filter(mark => mark.mediaId === activeId);
  const resumeAt = (position: number) => {
    if (tab === 'pdf') goPage(Math.floor(position));
    if (tab === 'audio' && audioRef.current) { audioRef.current.currentTime = position; setAudioCurrent(position); }
    if (tab === 'video') setVideoMinute(Math.floor(position / 60));
    if (tab === 'text') { setTtsCursor(Math.floor(position)); notify('Bookmark selected. Browser text-to-speech resumes from the beginning.'); }
  };

  return <div className="page-content media3">
    <div className="media3-title"><span className="media3-eyebrow">PHASE 3 · MULTIMEDIA LEARNING</span><h1>Learning media studio</h1><p>Watch, read and listen in one place. Save your position and revisit important moments. No content is uploaded to Learning OS in this preview.</p></div>
    <div className="media3-notice"><ShieldCheck size={17}/><span><strong>Browser-local sync:</strong> progress and bookmarks sync across tabs on this device, not across devices. Media file bytes are temporary; reopen local files after refresh.</span></div>
    <div className="media3-tabs" role="tablist" aria-label="Media type">
      {([{ key:'video',name:'YouTube',icon:<Youtube size={18}/> },{ key:'pdf',name:'PDF reader',icon:<FileText size={18}/> },{ key:'audio',name:'Audio lessons',icon:<Headphones size={18}/> },{ key:'text',name:'Read aloud',icon:<Volume2 size={18}/> }] as const).map(t => <button role="tab" aria-selected={tab===t.key} className={tab===t.key?'active':''} key={t.key} onClick={() => {stopSpeech();setTab(t.key);}}>{t.icon}{t.name}</button>)}
    </div>
    <div className="media3-layout"><section className="media3-main">
      {tab === 'video' && <div className="media3-card"><div className="media3-card-head"><h2>Watch a lesson</h2><span>Video · playlist · manual checkpoint</span></div>
        <label className="media3-field">Choose saved YouTube source<select aria-label="Choose YouTube source" value={selectedVideo} onChange={e=>{setSelectedVideo(e.target.value);setVideoMinute(0);}}><option value="">Choose a source...</option>{videos.map(s=><option key={s.id} value={s.url}>{s.name}</option>)}</select></label>
        <div className="media3-add"><input aria-label="YouTube video or playlist URL" type="url" placeholder="Paste a YouTube video or playlist URL" value={customUrl} onChange={e=>setCustomUrl(e.target.value)}/><button className="media3-button" onClick={()=>{if(parseYouTubeEmbed(customUrl)){setSelectedVideo(customUrl);setCustomUrl('');setVideoMinute(0);} else notify('Use a direct YouTube video or playlist link (channel pages cannot be embedded).');}}>Load link</button></div>
        {embedded ? <div className="media3-embed"><iframe key={embedded.embedUrl} title="YouTube learning video" src={embedded.embedUrl} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen loading="lazy"/></div> : <div className="media3-empty"><Youtube size={31}/><p>Select an embeddable YouTube video or playlist. Channel pages cannot be played in this embedded viewer.</p></div>}
        <div className="media3-controls"><label>Bookmark at minute<input aria-label="YouTube bookmark minute" type="number" min="0" max="3000" value={videoMinute} onChange={e=>setVideoMinute(Math.max(0,Number(e.target.value)||0))}/></label><button className="media3-button secondary" disabled={!videoId} onClick={()=>{persistProgress(videoId,'video',1,1,true);notify('You marked this source complete. Video playback was not auto-tracked.');}}><CheckCircle2 size={16}/> {videoProgress?.completed?'Watched (manual)':'Mark watched'}</button>{isSafeExternalUrl(selectedVideo)&&<a className="media3-link" href={selectedVideo} target="_blank" rel="noreferrer noopener"><Link2 size={15}/> Open original</a>}</div>
        <p className="media3-disclosure">YouTube embeds do not provide verified watch-time to this static app. Use the minute field for manual bookmarks and mark completion yourself. Linked videos are not transcribed or analyzed automatically.</p>
      </div>}
      {tab === 'pdf' && <div className="media3-card"><div className="media3-card-head"><h2>Local PDF reader</h2><span>Canvas rendering · page bookmarks · text-to-speech</span></div>
        <label className="media3-upload"><UploadCloud size={26}/><strong>Open a PDF from your device</strong><span>20 MB / 120 pages maximum · files stay in memory</span><input aria-label="Choose PDF file" type="file" accept="application/pdf,.pdf" onChange={event=>{void loadPdf(event);}}/></label>
        {pdfError&&<p className="media3-error" role="alert">{pdfError}</p>}
        {pdfDoc?<><p className="media3-file-title"><FileText size={17}/> {pdfName}</p><div className="media3-pdf-controls"><button aria-label="Previous PDF page" className="media3-icon" disabled={pdfPage===1} onClick={()=>goPage(pdfPage-1)}><ChevronLeft size={19}/></button><span>Page {pdfPage} of {pdfDoc.numPages}</span><button aria-label="Next PDF page" className="media3-icon" disabled={pdfPage===pdfDoc.numPages} onClick={()=>goPage(pdfPage+1)}><ChevronRight size={19}/></button><button className="media3-button secondary" onClick={()=>{if(pdfText){playSpeech(pdfText,`${pdfId}:page:${pdfPage}`);}else notify('This page has no extractable text; scanned PDFs may need OCR.');}}><Volume2 size={16}/> Read page aloud</button></div><div className="media3-pdf"><canvas ref={canvasRef} aria-label={`Rendered PDF page ${pdfPage}`}/></div><p className="media3-disclosure">Extracted text is used only for spoken playback. Scanned image-only PDFs may not contain selectable text.</p></>:<div className="media3-empty"><BookOpen size={28}/><p>Open a PDF to view its pages and save reading checkpoints.</p></div>}
      </div>}
      {tab === 'audio' && <div className="media3-card"><div className="media3-card-head"><h2>Audio lessons</h2><span>Native playback · seek · automatic progress</span></div>
        <label className="media3-upload"><FileAudio2 size={26}/><strong>Open an audio lesson</strong><span>MP3, M4A, WAV, OGG or WebM · 80 MB limit</span><input aria-label="Choose audio file" type="file" accept="audio/*,.mp3,.m4a,.wav,.ogg,.webm" onChange={loadAudio}/></label>
        {audioError&&<p className="media3-error" role="alert">{audioError}</p>}
        {audioUrl?<><div className="media3-audio-hero"><div className="media3-audio-icon"><AudioLines size={34}/></div><h3>{audioName}</h3><p>{fmt(audioCurrent)} / {fmt(audioDuration)}</p><audio key={audioUrl} ref={audioRef} controls preload="metadata" src={audioUrl} aria-label="Audio lesson player" onLoadedMetadata={()=>{const player=audioRef.current;if(!player)return;setAudioDuration(player.duration);player.playbackRate=audioRate;const saved=state.progress[audioId]?.position??0;if(saved>0&&saved<player.duration){player.currentTime=saved;setAudioCurrent(saved);}}} onTimeUpdate={()=>saveAudioProgress()} onPause={()=>saveAudioProgress(true)} onEnded={()=>{const d=audioRef.current?.duration??0;persistProgress(audioId,'audio',d,d,true);notify('Audio lesson completed.');}}/></div>
          <div className="media3-controls"><label>Playback speed<select aria-label="Audio speed" value={audioRate} onChange={e=>{const speed=Number(e.target.value);setAudioRate(speed);if(audioRef.current)audioRef.current.playbackRate=speed;}}>{[0.75,1,1.25,1.5,1.75,2].map(n=><option key={n} value={n}>{n}×</option>)}</select></label><button className="media3-button secondary" onClick={()=>{const player=audioRef.current;if(player){persistProgress(audioId,'audio',player.duration,player.duration,true);notify('Audio marked complete.');}}}>Mark complete</button></div>
        </>:<div className="media3-empty"><Headphones size={28}/><p>Choose a local recording or audiobook chapter. Playback position is saved, not the file itself.</p></div>}
      </div>}
      {tab === 'text' && <div className="media3-card"><div className="media3-card-head"><h2>Read aloud</h2><span>Browser speech synthesis · original text or your notes</span></div>
        <label className="media3-field">Text for narration<textarea aria-label="Text for narration" rows={9} value={spokenText} maxLength={25000} onChange={e=>{stopSpeech();setSpokenText(e.target.value);setTtsCursor(0);}} placeholder="Paste a lesson or your notes to listen to..."/></label>
        <div className="media3-controls"><label>Voice<select aria-label="Narration voice" value={voiceURI} onChange={e=>setVoiceURI(e.target.value)}><option value="">Browser default</option>{voices.map(voice=><option key={voice.voiceURI} value={voice.voiceURI}>{voice.name} ({voice.lang})</option>)}</select></label><label>Speed<select aria-label="Narration speed" value={ttsRate} onChange={e=>setTtsRate(Number(e.target.value))}>{[0.75,1,1.25,1.5,1.75,2].map(n=><option key={n} value={n}>{n}×</option>)}</select></label></div>
        <div className="media3-controls"><button className="media3-button" onClick={()=>playSpeech()}><Play size={16}/> Start narration</button><button className="media3-button secondary" disabled={!speaking} onClick={pauseSpeech}>{paused?<Play size={16}/>:<Pause size={16}/>} {paused?'Resume':'Pause'}</button><button className="media3-button secondary" disabled={!speaking} onClick={stopSpeech}>Stop</button></div>
        <p className="media3-disclosure">Voice availability and word-boundary progress depend on your browser. Text-to-speech starts from the beginning if restarted. This is not a downloadable audiobook.</p>
      </div>}
    </section>
    <aside className="media3-aside"><div className="media3-card"><div className="media3-card-head"><h2>Learning position</h2><span>Saved locally for the active source</span></div>
      {activeId ? <><div className="media3-meter" role="progressbar" aria-label="Media progress" aria-valuenow={activeProgress?.percent??0} aria-valuemin={0} aria-valuemax={100}><span style={{width:percent(activeProgress?.percent??0)}}/></div><p className="media3-meter-caption"><strong>{activeProgress?.percent??0}%</strong> {activeProgress?.completed?'Completed': 'Last recorded position'}</p><button className="media3-button secondary" onClick={()=>{setState(current=>({ ...current,progress:{...current.progress,[activeId]:normalizedProgress({mediaId:activeId,kind:tab,position:0,total:tab==='pdf'?(pdfDoc?.numPages??0):tab==='audio'?audioDuration:tab==='text'?spokenText.length:1})}}));notify('Progress reset for this source.');}}><RefreshCw size={15}/> Reset progress</button></> : <p className="media3-small">Open a source to see its progress.</p>}
    </div><div className="media3-card"><div className="media3-card-head"><h2><Bookmark size={17}/> Bookmarks</h2><span>{marks.length} saved for this source</span></div>
      <label className="media3-field">Bookmark title<input aria-label="Bookmark title" value={bookmarkTitle} maxLength={120} onChange={e=>setBookmarkTitle(e.target.value)} placeholder="e.g. Important technique"/></label>
      <label className="media3-field">Optional note<input aria-label="Bookmark note" value={markNote} maxLength={500} onChange={e=>setMarkNote(e.target.value)} placeholder="Why revisit this?"/></label>
      <button className="media3-button" disabled={!activeId} onClick={()=>{if(!bookmarkTitle.trim())return notify('Enter a bookmark title.');setState(current=>addBookmark(current,{mediaId:activeId,kind:tab,position:activePosition,title:bookmarkTitle,note:markNote}));setBookmarkTitle('');setMarkNote('');notify('Bookmark saved.');}}><Plus size={16}/> Save bookmark</button>
      <div className="media3-marks">{marks.length?marks.map(mark=><div key={mark.id} className="media3-mark"><div><strong>{mark.title}</strong><span>{mark.kind==='pdf'?`Page ${mark.position}`:mark.kind==='video'||mark.kind==='audio'?fmt(mark.position):`Character ${mark.position}`}</span>{mark.note&&<small>{mark.note}</small>}</div><button aria-label={`Jump to ${mark.title}`} title="Resume position" onClick={()=>resumeAt(mark.position)}><Play size={15}/></button><button aria-label={`Delete ${mark.title}`} title="Delete bookmark" onClick={()=>setState(current=>({...current,bookmarks:current.bookmarks.filter(item=>item.id!==mark.id)}))}><Trash2 size={15}/></button></div>):<p className="media3-small">No bookmarks yet. Save a position while learning.</p>}</div>
    </div><div className="media3-card media3-tips"><ShieldCheck size={21}/><strong>Knowledge is different from completion.</strong><p>Media progress tells you what you watched or read—not what you've mastered. Use assessments and practice evidence to verify learning.</p></div></aside></div>
  </div>;
}
