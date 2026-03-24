// ─── SUPABASE ───
const SUPABASE_URL = 'https://qbwbhnzsliqijyltpcki.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_4bzt7LbS8By2fiWM5nB7dA_7vfFdMvn';

// Inizializza subito — supabase-js è caricato prima di app.js
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
function initSupabaseClient() { return true; }

let currentUser = null;
let userProfile = null;

// Inizializza sessione Supabase
async function initSupabase() {
  if (!supabaseClient) initSupabaseClient();
  if (!supabaseClient) return false;

  // Prima prova getSession (veloce, usa localStorage/cookie)
  const { data: { session: existingSession } } = await supabaseClient.auth.getSession();
  console.log('getSession result:', existingSession?.user?.email, 'profile after load:', userProfile?.stile_attaccamento);
  if (existingSession) {
    currentUser = existingSession.user;
    await loadProfile();
    console.log('After loadProfile:', userProfile?.stile_attaccamento);
    return true;
  }

  // Se non trova nulla, aspetta onAuthStateChange con timeout
  return new Promise((resolve) => {
    let resolved = false;
    const { data: { subscription } } = supabaseClient.auth.onAuthStateChange(async (event, session) => {
      if (resolved) return;
      resolved = true;
      subscription.unsubscribe();
      if (session) {
        currentUser = session.user;
        await loadProfile();
        resolve(true);
      } else {
        resolve(false);
      }
    });
    setTimeout(() => {
      if (!resolved) { resolved = true; resolve(false); }
    }, 3000);
  });
}

// Carica profilo utente
async function loadProfile() {
  if (!currentUser) return;
  const { data, error } = await supabaseClient
    .from('profiles')
    .select('*')
    .eq('id', currentUser.id)
    .single();
  console.log('loadProfile data:', data, 'error:', error);
  if (data) {
    userProfile = data;
    if (data.stile_attaccamento) userStyle = data.stile_attaccamento;
    if (data.nome) {
      const userNameEl = document.getElementById('userName');
      const userAvatarEl = document.getElementById('userAvatar');
      if (userNameEl) userNameEl.textContent = data.nome;
      if (userAvatarEl) userAvatarEl.textContent = data.nome.charAt(0).toUpperCase();
    }
  }
}

// Salva profilo
async function saveProfile(updates) {
  if (!currentUser) return;
  await supabaseClient.from('profiles').update(updates).eq('id', currentUser.id);
}

// Carica conversazioni dal cloud
async function loadConversationsFromCloud() {
  if (!currentUser) return;
  const { data } = await supabaseClient
    .from('conversazioni')
    .select('*')
    .eq('user_id', currentUser.id)
    .order('ts', { ascending: true });
  if (data && data.length > 0) {
    conversationHistory = data.map(m => ({
      role: m.role,
      content: m.content,
      ts: new Date(m.ts).getTime()
    }));
    restoreMessages();
  }
}

// Salva messaggio nel cloud
async function saveMessageToCloud(role, content, ts) {
  if (!currentUser) return;
  await supabaseClient.from('conversazioni').insert({
    user_id: currentUser.id,
    role,
    content,
    ts: new Date(ts).toISOString()
  });
}

// Segna esercizio come completato
async function markExerciseComplete(exerciseId) {
  if (!currentUser) return;
  const { data: existing } = await supabaseClient
    .from('esercizi_completati')
    .select('id')
    .eq('user_id', currentUser.id)
    .eq('esercizio_id', exerciseId)
    .single();
  if (!existing) {
    await supabaseClient.from('esercizi_completati').insert({
      user_id: currentUser.id,
      esercizio_id: exerciseId
    });
  }
}

// Carica esercizi completati
async function loadCompletedExercises() {
  if (!currentUser) return [];
  const { data } = await supabaseClient
    .from('esercizi_completati')
    .select('esercizio_id')
    .eq('user_id', currentUser.id);
  return data ? data.map(d => d.esercizio_id) : [];
}

// ─── CONSTANTS ───
const FREE_DAILY_LIMIT = 3;
const TRIAL_DAYS = 7;

const STYLES_DATA = {
  ansioso:{ emoji:'🌊', title:'Stile Ansioso', color:'#E8A87C', tagClass:'tag-ansioso', description:'Chi ha uno stile ansioso tende a preoccuparsi molto delle relazioni, cercando rassicurazioni continue. C\'è spesso una paura profonda dell\'abbandono e una sensazione che gli altri non ricambino l\'amore con la stessa intensità.', traits:['Ipervigilanza ai segnali emotivi del partner','Bisogno frequente di conferme','Difficoltà a stare con l\'incertezza','Sensibilità elevata al distacco'], tools:['Esercizio di ancoraggio emotivo','Lettera al tuo sé interiore','Diario delle rassicurazioni','Meditazione sull\'accettazione'] },
  evitante:{ emoji:'🏔️', title:'Stile Evitante', color:'#7CB9E8', tagClass:'tag-evitante', description:'Lo stile evitante si manifesta con una tendenza all\'autosufficienza emotiva e una certa difficoltà nell\'intimità. La vicinanza emotiva può sembrare soffocante, e spesso ci si è abituati a fare affidamento solo su se stessi.', traits:['Tendenza all\'autosufficienza emotiva','Disagio con la vicinanza intensa','Difficoltà ad esprimere i bisogni','Valorizzazione forte dell\'indipendenza'], tools:['Esercizio di apertura graduale','Mappa dei bisogni emotivi','Pratica della vulnerabilità','Journaling sull\'intimità'] },
  disorganizzato:{ emoji:'🌪️', title:'Stile Disorganizzato', color:'#B87CE8', tagClass:'tag-disorganizzato', description:'Lo stile disorganizzato è spesso legato a esperienze precoci di dolore nelle relazioni di cura. Chi lo sperimenta desidera la vicinanza ma la teme allo stesso tempo, generando un ciclo di avvicinamento e allontanamento.', traits:['Conflitto interno tra desiderio e paura','Reazioni intense e difficili da controllare','Difficoltà a fidarsi','Pattern relazionali contraddittori'], tools:['Esercizio di regolazione del sistema nervoso','Pratica dell\'autocompassione','Lavoro con le parti interiori','Ancoraggio sensoriale'] },
  sicuro:{ emoji:'⚓', title:'Stile Sicuro', color:'#7CE8A8', tagClass:'tag-sicuro', description:'Lo stile sicuro rappresenta una base sana per le relazioni. Chi lo possiede sa chiedere vicinanza senza temere l\'abbandono, ed è capace di stare da solo senza sentirsi perso. È un obiettivo evolutivo possibile per tutti.', traits:['Comfort con intimità e indipendenza','Comunicazione emotiva chiara','Fiducia nelle relazioni','Buona gestione del conflitto'], tools:['Rafforzamento della base sicura','Pratiche di connessione autentica','Esercizi di gratitudine relazionale','Meditazione della presenza'] },
  misto:{ emoji:'🌿', title:'Stile Misto', color:'#C4897A', tagClass:'tag-misto', description:'Hai caratteristiche di più stili — questo è normale e molto comune. Il tuo profilo emotivo è sfumato e dipende spesso dal contesto. Clara può aiutarti a esplorare quali pattern emergono in situazioni diverse.', traits:['Flessibilità emotiva situazionale','Mix di bisogni di vicinanza e autonomia','Pattern diversi in contesti diversi','Ricchezza e complessità interiore'], tools:['Mappatura dei pattern per contesto','Esplorazione delle parti interiori','Esercizi di consapevolezza emotiva','Dialogo con Clara per esplorare'] }
};

const BOOKS_BY_STYLE = {
  ansioso:[{emoji:'📖',title:'Attached',author:'Levine & Heller',why:'Capire il tuo stile ansioso e come cambiarlo'},{emoji:'📒',title:'L\'Intelligenza Emotiva',author:'Daniel Goleman',why:'Riconoscere e gestire le emozioni intense'}],
  evitante:[{emoji:'📘',title:'Hold Me Tight',author:'Sue Johnson',why:'Imparare ad aprirsi senza perdersi'},{emoji:'📙',title:'Wired for Love',author:'Stan Tatkin',why:'Capire l\'intimità senza sentirsi soffocare'}],
  disorganizzato:[{emoji:'📗',title:'Il Corpo Accusa il Colpo',author:'Bessel van der Kolk',why:'Lavorare con il trauma nelle relazioni'},{emoji:'📕',title:'Polyvagal Theory',author:'Stephen Porges',why:'Regolazione del sistema nervoso e sicurezza'}],
  sicuro:[{emoji:'📖',title:'Attached',author:'Levine & Heller',why:'Approfondire e mantenere una base sicura'},{emoji:'📙',title:'Wired for Love',author:'Stan Tatkin',why:'Coltivare connessioni profonde e durature'}],
  misto:[{emoji:'📖',title:'Attached',author:'Levine & Heller',why:'Il punto di partenza per capire tutti gli stili'},{emoji:'📘',title:'Hold Me Tight',author:'Sue Johnson',why:'Per esplorare la vicinanza emotiva in modo sicuro'}]
};

// ─── STATE ───
let obStep = 0;
const obAnswers = {};
let conversationHistory = [];
let userStyle = null;
let isStreaming = false;

// ─── LOCALSTORAGE ───
function saveState() {
  localStorage.setItem('clara_state', JSON.stringify({ conversationHistory, userStyle, onboardingDone: true, trialStart: getTrialStart() }));
  // Sincronizza stile con Supabase
  if (userStyle && currentUser) {
    saveProfile({ stile_attaccamento: userStyle });
  }
}

function loadState() {
  try { const r = localStorage.getItem('clara_state'); return r ? JSON.parse(r) : null; } catch { return null; }
}

function getTrialStart() {
  const s = loadState();
  return s && s.trialStart ? s.trialStart : null;
}

function isInTrial() {
  const ts = getTrialStart();
  if (!ts) return false;
  return (Date.now() - ts) / (1000*60*60*24) < TRIAL_DAYS;
}

function isSubscribed() {
  return localStorage.getItem('clara_subscribed') === 'true';
}

function getMsgLog() {
  try {
    const key = currentUser ? 'clara_msglog_' + currentUser.id : 'clara_msglog';
    const r = localStorage.getItem(key);
    return r ? JSON.parse(r) : {date:'',count:0};
  } catch { return {date:'',count:0}; }
}

function getTodayStr() { return new Date().toISOString().split('T')[0]; }

function getMsgsToday() {
  const log = getMsgLog();
  return log.date === getTodayStr() ? log.count : 0;
}

function incrementMsgCount() {
  const today = getTodayStr();
  const log = getMsgLog();
  const count = log.date === today ? log.count + 1 : 1;
  const key = currentUser ? 'clara_msglog_' + currentUser.id : 'clara_msglog';
  localStorage.setItem(key, JSON.stringify({date:today,count}));
}

function canSendMessage() {
  if (isSubscribed() || isInTrial()) return true;
  return getMsgsToday() < FREE_DAILY_LIMIT;
}

function updateCounter() {
  const counter = document.getElementById('msgCounter');
  if (!counter) return;
  if (isSubscribed()) { counter.style.display='none'; return; }
  if (isInTrial()) {
    const daysLeft = Math.max(0, TRIAL_DAYS - Math.floor((Date.now() - getTrialStart()) / (1000*60*60*24)));
    counter.textContent = `Trial: ${daysLeft}g rimasti`;
    counter.className = 'msg-counter';
    return;
  }
  const rem = Math.max(0, FREE_DAILY_LIMIT - getMsgsToday());
  counter.textContent = `${rem} messaggi oggi`;
  counter.className = rem <= 1 ? 'msg-counter warning' : 'msg-counter';
  if (rem === 0) {
    document.getElementById('limitBanner').classList.add('visible');
    document.getElementById('inputWrapper').style.display = 'none';
  } else {
    document.getElementById('limitBanner').classList.remove('visible');
    document.getElementById('inputWrapper').style.display = 'block';
  }
}

function hideBanner() { document.getElementById('limitBanner').classList.remove('visible'); }
function showUpgrade() { showView('piani'); }

// ─── ONBOARDING ───
const OB_Q = 8;

function renderProgress() {
  const p = document.getElementById('obProgress');
  p.innerHTML = '';
  for (let i=0;i<OB_Q;i++) {
    const d = document.createElement('div');
    d.className = 'ob-dot' + (i < obStep ? ' done' : '');
    p.appendChild(d);
  }
}

function selectOption(el) {
  const step = el.dataset.step;
  document.querySelectorAll(`[data-step="${step}"]`).forEach(o => o.classList.remove('selected'));
  el.classList.add('selected');
  obAnswers[step] = el.dataset.val;
  const nb = document.getElementById(`next-${step}`);
  if (nb) nb.disabled = false;
}

function obNext() {
  document.getElementById(`ob-step-${obStep}`).classList.remove('active');
  obStep++;
  if (obStep <= OB_Q) {
    document.getElementById(`ob-step-${obStep}`).classList.add('active');
    renderProgress();
  } else {
    document.getElementById('ob-step-result').classList.add('active');
    renderProgress();
    computeResult();
  }
}

function obBack() {
  document.getElementById(`ob-step-${obStep}`).classList.remove('active');
  obStep--;
  document.getElementById(`ob-step-${obStep}`).classList.add('active');
  renderProgress();
}

function computeResult() {
  // Domande 1-7 hanno opzioni A/B/C/D mappate sugli stili
  // A = ansioso, B = evitante, C = disorganizzato, D = sicuro
  const counts = {A:0,B:0,C:0,D:0};
  ['1','2','3','4','5','6','7'].forEach(s => { if(obAnswers[s]) counts[obAnswers[s]]++; });
  const max = Math.max(...Object.values(counts));
  const winners = Object.keys(counts).filter(k => counts[k]===max);
  // Se due stili sono a pari merito con 3+ voti ciascuno → misto
  // Se uno stile domina → quello
  const map = {A:'ansioso',B:'evitante',C:'disorganizzato',D:'sicuro'};
  if (winners.length > 1 && max >= 3) {
    userStyle = 'misto';
  } else if (winners.length > 1) {
    // pari merito su pochi voti: prendi il primo per ordine priorità A>C>B>D
    const priority = ['A','C','B','D'];
    userStyle = map[priority.find(p => winners.includes(p))];
  } else {
    userStyle = map[winners[0]];
  }

  const trialStart = (loadState()&&loadState().trialStart) || Date.now();
  localStorage.setItem('clara_state', JSON.stringify({conversationHistory:[],userStyle,onboardingDone:true,trialStart}));

  const data = STYLES_DATA[userStyle];
  const books = BOOKS_BY_STYLE[userStyle];
  const colorMap = {ansioso:'rgba(232,168,124,0.15)',evitante:'rgba(124,185,232,0.15)',disorganizzato:'rgba(184,124,232,0.15)',sicuro:'rgba(124,232,168,0.15)',misto:'rgba(196,137,122,0.15)'};
  const textMap = {ansioso:'#B8733A',evitante:'#3A7AB8',disorganizzato:'#7A3AB8',sicuro:'#3AB870',misto:'#8B4F3A'};

  document.getElementById('ob-result-content').innerHTML = `
    <div class="ob-result-badge" style="background:${colorMap[userStyle]};color:${textMap[userStyle]}">${data.emoji} ${data.title}</div>
    <div class="ob-result-title">Il tuo profilo emotivo<br>è emerso.</div>
    <div class="ob-result-desc">${data.description}</div>
    <div class="ob-books">
      <div class="ob-books-label">✦ I libri più utili per te</div>
      ${books.map(b=>`<div class="ob-book-item"><span class="ob-book-emoji">${b.emoji}</span><div class="ob-book-info"><h4>${b.title} — <span style="font-weight:300;font-style:italic">${b.author}</span></h4><p>${b.why}</p></div></div>`).join('')}
    </div>
    <button class="ob-cta" onclick="startApp()">Inizia con Clara →</button>
    <div class="ob-trial-note">7 giorni gratuiti · Nessuna carta richiesta</div>
  `;
}

function startApp() {
  document.getElementById('onboarding').classList.add('hidden');
  updateSidebarUser();
  // Salva stile su Supabase
  if (currentUser) saveProfile({ stile_attaccamento: userStyle, trial_start: new Date().toISOString() });
  const data = STYLES_DATA[userStyle];
  const welcome = `Ho letto il tuo profilo. ${data.emoji}\n\nIl tuo stile emergente è quello ${data.title.toLowerCase()} — e capisco quanto possa essere faticoso portare certi pattern nelle relazioni.\n\nSono qui per te. Puoi iniziare raccontandomi qualcosa che senti in questo momento, oppure chiedermi di guidarti in un esercizio. ✦`;
  appendMessage('clara', welcome);
  conversationHistory.push({role:'assistant',content:welcome,ts:Date.now()});
  saveState();
  updateCounter();
}

function updateSidebarUser() {
  if (!userStyle) return;
  const data = STYLES_DATA[userStyle];
  document.getElementById('userStatus').textContent = `${data.emoji} ${data.title}`;
}


// ─── ESERCIZI ───
const EXERCISES = {
  radicaCorpo: {
    title: 'La radice del corpo',
    style: 'ansioso',
    color: '#E8A87C',
    steps: [
      { type:'intro', text:"Questo esercizio ti aiuta a uscire dall'ansia relazionale tornando nel tuo corpo. Non richiede nulla di speciale — solo un posto tranquillo dove sederti per qualche minuto." },
      { type:'action', text:"Siediti con i piedi ben appoggiati sul pavimento. Senti il contatto dei piedi con il suolo — la sua solidità, la sua temperatura. Chiudi gli occhi se ti senti a tuo agio." },
      { type:'action', text:"Porta l'attenzione al respiro. Non cambiarlo — osservalo solo. Nota come l'addome si muove quando inspiri. Fai tre respiri lenti e profondi." },
      { type:'question', q:"In questo momento, su una scala da 1 a 10, quanto senti l'ansia nel corpo? Dove la senti fisicamente?", placeholder:"Es: 7, la sento come un nodo allo stomaco..." },
      { type:'action', text:"Porta le mani sulle cosce e premi leggermente. Senti la pressione — sei qui, sei reale, sei al sicuro in questo momento. Questo momento esiste, indipendentemente da ciò che temi." },
      { type:'question', q:"Cosa noti adesso nel corpo rispetto a prima? Anche piccoli cambiamenti contano.", placeholder:"Es: il respiro è un po' più lento..." },
      { type:'complete', msg:"Hai appena fatto qualcosa di importante — sei tornata nel tuo corpo invece di restare nella mente ansiosa. Con la pratica, questo diventa uno strumento sempre disponibile.", cta:"Parla con Clara di com'è andata" }
    ]
  },
  letteraPaura: {
    title: 'Lettera alla tua paura',
    style: 'ansioso',
    color: '#E8A87C',
    steps: [
      { type:'intro', text:"Scrivere alla nostra paura — invece di subirla — cambia il rapporto che abbiamo con lei. Non la elimina, ma la rende meno soverchiante. Prenditi il tempo che ti serve." },
      { type:'question', q:'Inizia così: "Cara paura di essere lasciata..." e continua scrivendo tutto quello che vuoi dirle. Non filtrare nulla.', placeholder:"Cara paura di essere lasciata..." },
      { type:'question', q:"Ora scrivi da dove pensi che venga questa paura. Quando è nata? Cosa la alimenta?", placeholder:"Penso che tu sia nata quando..." },
      { type:'question', q:"Cosa ti ha protetto finora questa paura? C'è qualcosa di utile che ha fatto per te, anche se in modo goffo?", placeholder:"In un certo senso mi hai protetta da..." },
      { type:'question', q:"Cosa vorresti dirle adesso? Cosa ha bisogno di sentirsi dire questa parte di te?", placeholder:"Quello che voglio dirti è..." },
      { type:'complete', msg:"Hai appena guardato in faccia qualcosa che di solito ti travolge. Questa lettera è tua — rileggila quando l'ansia si fa intensa.", cta:"Condividi con Clara quello che hai scoperto" }
    ]
  },
  termometro: {
    title: "Il termometro dell'ansia",
    style: 'ansioso',
    color: '#E8A87C',
    steps: [
      { type:'intro', text:"L'ansia relazionale spesso ci travolge perché non la riconosciamo finché non è già al massimo. Questo esercizio ti aiuta a identificarla prima, quando è ancora gestibile." },
      { type:'question', q:"Pensa a una situazione recente in cui hai sentito ansia in una relazione. Descrivila brevemente.", placeholder:"Es: il partner non ha risposto per ore..." },
      { type:'question', q:"Ripercorri quella situazione. Qual era il primo segnale fisico che l'ansia stava arrivando? (battito, respiro, tensione...)", placeholder:"Il primo segnale era..." },
      { type:'question', q:"Com'era l'intensità all'inizio su una scala da 1 a 10? E al picco? Cosa l'ha fatta salire?", placeholder:"Iniziava a 3, poi è salita a 8 quando..." },
      { type:'action', text:"Ora immagina di riconoscere quel primo segnale la prossima volta. Potresti fermarti lì — prima che l'ansia salga. Il segnale precoce è il tuo alleato." },
      { type:'question', q:"Qual è UNA cosa concreta che potresti fare quando senti quel primo segnale, la prossima volta?", placeholder:"Potrei..." },
      { type:'complete', msg:"Hai appena costruito un piano di intervento precoce. Più lo pratichi, più diventa automatico riconoscere l'ansia prima che ti sommerga.", cta:"Approfondisci con Clara" }
    ]
  },
  bisogno: {
    title: 'Un bisogno alla volta',
    style: 'evitante',
    color: '#7CB9E8',
    steps: [
      { type:'intro', text:"Per chi ha uno stile evitante, nominare i propri bisogni può sembrare strano o persino pericoloso. Questo esercizio è privato — non devi condividere nulla con nessuno se non vuoi." },
      { type:'action', text:"Prenditi un momento di silenzio. Respira. Chiedi a te stessa, senza fretta: 'Cosa ho bisogno in questo momento nelle mie relazioni?' Non giudicare la risposta." },
      { type:'question', q:"Completa questa frase senza pensarci troppo: 'In questo momento, quello di cui avrei più bisogno da chi amo è...'", placeholder:"...anche se fatico ad ammetterlo" },
      { type:'question', q:"Come ti fa sentire aver scritto quella cosa? C'è qualcosa che si attiva — sollievo, imbarazzo, paura?", placeholder:"Mi fa sentire..." },
      { type:'action', text:"Nominare un bisogno non significa doverlo chiedere. Non significa diventare dipendente. Significa semplicemente che esiste — e che tu lo sai." },
      { type:'question', q:"Questo bisogno che hai nominato — c'è qualcuno nella tua vita con cui ti sentiresti al sicuro a condividerlo, anche solo in parte?", placeholder:"Forse con..." },
      { type:'complete', msg:"Hai fatto qualcosa di importante: hai guardato dentro invece di allontanarti. Questo è il primo passo per ridurre la distanza — non con gli altri, ma con te stessa.", cta:"Parla con Clara di questo bisogno" }
    ]
  },
  muro: {
    title: 'Dove sento il muro',
    style: 'evitante',
    color: '#7CB9E8',
    steps: [
      { type:'intro', text:"Il distacco emotivo non è solo nella mente — si manifesta anche nel corpo. Questo esercizio ti aiuta a riconoscere dove e come si attiva fisicamente il tuo bisogno di distanza." },
      { type:'action', text:"Siediti in modo comodo e chiudi gli occhi. Pensa a una persona con cui hai una relazione significativa. Immagina che si stia avvicinando emotivamente a te — che voglia parlarti di qualcosa di intimo." },
      { type:'question', q:"Cosa succede nel tuo corpo mentre immagini questa scena? Dove senti la resistenza o il disagio?", placeholder:"Sento una tensione in..." },
      { type:'question', q:"Qual è il primo impulso che noti? (chiudersi, cambiare argomento, diventare razionale, fare dell'umorismo...)", placeholder:"Il mio primo impulso è..." },
      { type:'action', text:"Quel disagio che senti non è un difetto — è una difesa che si è formata per proteggerti. Era utile. Ma forse oggi puoi permetterti di restare un momento di più, prima di attivare la distanza." },
      { type:'question', q:"Se quella difesa potesse parlare, cosa direbbe? Da cosa ti sta proteggendo?", placeholder:"Questa difesa mi sta proteggendo da..." },
      { type:'complete', msg:"Hai appena conosciuto meglio una parte di te. Il muro non è il nemico — ma sapere dove sta è il primo passo per scegliere quando aprire uno spiraglio.", cta:"Esplora questo con Clara" }
    ]
  },
  vulnerabilita: {
    title: 'La vulnerabilità minima',
    style: 'evitante',
    color: '#7CB9E8',
    steps: [
      { type:'intro', text:"Non si tratta di diventare improvvisamente aperti — si tratta di fare un passo microscopico verso la connessione. Qualcosa di reale, ma piccolo e sicuro." },
      { type:'question', q:"Pensa a qualcuno di cui ti fidi, anche solo un po'. Chi è?", placeholder:"Una persona di cui mi fido è..." },
      { type:'question', q:"C'è qualcosa che hai vissuto di recente — un'emozione, una difficoltà, una gioia — che non hai condiviso con nessuno?", placeholder:"Una cosa che non ho condiviso è..." },
      { type:'action', text:"Non ti sto chiedendo di condividerla adesso. Ti sto chiedendo di immaginare cosa succederebbe se lo facessi — con quella persona sicura." },
      { type:'question', q:"Cosa temi che succederebbe se condividessi quella cosa? Qual è il rischio che immagini?", placeholder:"Temo che..." },
      { type:'question', q:"Quanto è probabile, realisticamente, che quel rischio si avveri? E se succedesse, potresti gestirlo?", placeholder:"In realtà la probabilità è..." },
      { type:'complete', msg:"Hai appena sfidato una delle credenze centrali dello stile evitante: che aprirsi sia pericoloso. Il passo successivo è tuo — nessuna fretta.", cta:"Condividi con Clara come ti senti" }
    ]
  },
  ancora: {
    title: "L'ancora di sicurezza",
    style: 'disorganizzato',
    color: '#B87CE8',
    steps: [
      { type:'intro', text:"Quando il sistema nervoso si attiva intensamente, la mente non riesce a ragionare. Prima di tutto bisogna regolare il corpo. Questo esercizio si basa sulla teoria polivagale di Porges." },
      { type:'action', text:"STOP. Ovunque tu sia, smetti quello che stai facendo. Poggia entrambi i piedi sul pavimento. Senti la solidità sotto di te. Sei qui. Sei fisica. Esisti in questo spazio." },
      { type:'action', text:"Fai questo: inspira contando fino a 4. Trattieni 1 secondo. Espira contando fino a 6. Ripeti 4 volte. L'espirazione più lunga attiva il nervo vago e calma il sistema nervoso." },
      { type:'question', q:"Dopo i 4 respiri, nota: l'intensità dell'attivazione è cambiata? Anche solo di poco?", placeholder:"Sento che..." },
      { type:'action', text:"Ora orienta gli occhi nella stanza, lentamente. Identifica 3 oggetti che vedi. Nominarli mentalmente dice al tuo sistema nervoso: sei al sicuro, non c'è pericolo reale ora." },
      { type:'question', q:"Come stai adesso rispetto a quando hai iniziato? Descrivi quello che senti nel corpo.", placeholder:"Adesso nel corpo sento..." },
      { type:'complete', msg:"Hai appena usato uno strumento potente che puoi portare ovunque. Più lo pratichi nei momenti di calma, più sarà disponibile quando ne hai davvero bisogno.", cta:"Parla con Clara di cosa ha scatenato l'attivazione" }
    ]
  },
  parteFuga: {
    title: 'La parte che vuole scappare',
    style: 'disorganizzato',
    color: '#B87CE8',
    steps: [
      { type:'intro', text:"Nello stile disorganizzato spesso c'è una parte di noi che vuole scappare quando le cose si fanno intense. Non è un difetto — è una difesa che si è formata per sopravvivere. Oggi la incontriamo." },
      { type:'question', q:"Pensa all'ultima volta che hai avuto un impulso forte di allontanarti da qualcuno di importante. Cosa stava succedendo?", placeholder:"Stava succedendo che..." },
      { type:'action', text:"Immagina quella parte di te che voleva scappare come una figura separata — potrebbe avere una forma, un'età, un'espressione. Non giudicarla. È parte di te." },
      { type:'question', q:"Se quella parte potesse parlare, cosa direbbe? Cosa vuole proteggere?", placeholder:"Quella parte direbbe..." },
      { type:'question', q:"Da cosa ha imparato a scappare? Quando è nata questa strategia nella tua vita?", placeholder:"Penso che abbia imparato a scappare quando..." },
      { type:'action', text:"Quella parte non è il nemico. Ha fatto del suo meglio con quello che aveva. Puoi ringraziarla per la protezione — e dirle che oggi hai altre risorse." },
      { type:'question', q:"Cosa vorresti dire a questa parte di te adesso?", placeholder:"Voglio dirti che..." },
      { type:'complete', msg:"Hai appena fatto un lavoro profondo. Incontrare le nostre parti più difensive con compassione invece che con vergogna è una delle cose più curative che esistano.", cta:"Continua questa esplorazione con Clara" }
    ]
  },
  colpaTua: {
    title: 'Non è colpa tua',
    style: 'disorganizzato',
    color: '#B87CE8',
    steps: [
      { type:'intro', text:"Molte persone con stile disorganizzato portano una vergogna profonda per i loro pattern — come se fossero rotte o troppo. Questo esercizio lavora su quella vergogna." },
      { type:'question', q:"C'è qualcosa del tuo modo di stare nelle relazioni di cui ti vergogni o che giudichi duramente in te stessa?", placeholder:"Una cosa di cui mi vergogno è..." },
      { type:'action', text:"Leggi quello che hai scritto. Ora immagina che una tua amica cara ti stesse descrivendo esattamente la stessa cosa di sé stessa. Cosa proveresti per lei? Cosa le diresti?" },
      { type:'question', q:"Cosa diresti a quella amica?", placeholder:"Le direi..." },
      { type:'action', text:"Quello che hai scritto per lei — puoi dirlo a te stessa? I nostri pattern relazionali non sono scelte. Si sono formati in risposta a quello che abbiamo vissuto." },
      { type:'question', q:"Riesci a scrivere una frase di compassione verso te stessa, rispetto a quello che hai scritto prima?", placeholder:"A me stessa voglio dire..." },
      { type:'complete', msg:"L'autocompassione non è debolezza — è il terreno su cui cresce il cambiamento reale. Quello che hai scritto oggi è un seme.", cta:"Condividi con Clara quello che hai scoperto" }
    ]
  },
  paradosso: {
    title: 'Il paradosso del desiderio',
    style: 'disorganizzato',
    color: '#B87CE8',
    steps: [
      { type:'intro', text:"Lo stile disorganizzato vive in una tensione paradossale: vuole profondamente la vicinanza, ma la vicinanza attiva la paura. Questo esercizio non risolve il paradosso — ti aiuta a starci dentro senza esserne distrutta." },
      { type:'question', q:"Descrivi il paradosso come lo senti tu: cosa vuoi nelle relazioni? E cosa ti spaventa di quello che vuoi?", placeholder:"Voglio... ma ho paura di..." },
      { type:'action', text:"Quel conflitto che senti non è segno che qualcosa non va. È la traccia di esperienze precoci in cui la vicinanza era anche fonte di dolore. Il tuo sistema nervoso ha imparato a temere quello che desidera." },
      { type:'question', q:"Quando senti più forte il desiderio di vicinanza? E quando si attiva di più la paura?", placeholder:"Il desiderio è più forte quando... La paura si attiva quando..." },
      { type:'action', text:"Prova questo: respira e permetti a entrambe le sensazioni di esistere allo stesso tempo. Il desiderio E la paura. Non devi scegliere tra loro. Non devi risolvere nulla adesso." },
      { type:'question', q:"Cosa noti quando permetti a entrambe di esistere senza combatterle?", placeholder:"Noto che..." },
      { type:'complete', msg:"Stare con la tensione del paradosso — senza fuggire né congelare — è una delle forme più profonde di guarigione per lo stile disorganizzato. Hai appena praticato esattamente questo.", cta:"Esplora il paradosso con Clara" }
    ]
  },
  baseSicura: {
    title: 'La base sicura',
    style: 'sicuro',
    color: '#7CE8A8',
    steps: [
      { type:'intro', text:"La base sicura non è uno stato passivo — va coltivata e rafforzata. Questo esercizio ti aiuta a riconoscere e consolidare quello che già hai, e a capire come essere base sicura anche per gli altri." },
      { type:'question', q:"Pensa a qualcuno nella tua vita che ti ha dato una sensazione di base sicura — passato o presente. Chi è? Come ti faceva sentire?", placeholder:"Questa persona è..." },
      { type:'question', q:"Quali qualità specifiche di quella relazione ti davano sicurezza? (es: disponibilità, coerenza, accettazione...)", placeholder:"Mi dava sicurezza perché..." },
      { type:'action', text:"Quelle qualità che hai descritto — le riconosci anche in te, nel modo in cui stai con le persone care? Spesso siamo base sicura per gli altri prima ancora di rendercene conto." },
      { type:'question', q:"In quale relazione della tua vita senti di essere una base sicura per l'altra persona?", placeholder:"Penso di essere base sicura per..." },
      { type:'question', q:"C'è qualcosa che vorresti rafforzare nel modo in cui coltivi le tue relazioni più importanti?", placeholder:"Vorrei rafforzare..." },
      { type:'complete', msg:"Riconoscere e coltivare la base sicura è un atto attivo di cura — verso te stessa e verso chi ami. Continua così.", cta:"Parla con Clara delle tue relazioni" }
    ]
  },
  relazioniNutrono: {
    title: 'Le relazioni che nutrono',
    style: 'sicuro',
    color: '#7CE8A8',
    steps: [
      { type:'intro', text:"Non tutte le relazioni ci nutrono allo stesso modo. Questo esercizio ti aiuta a fare chiarezza su quali connessioni rafforzano la tua base sicura e quali invece la erodono." },
      { type:'question', q:"Pensa alle 3-4 relazioni più presenti nella tua vita adesso. Elencale brevemente.", placeholder:"Le relazioni più presenti sono..." },
      { type:'question', q:"Per ognuna: dopo aver passato del tempo con questa persona, come mi sento di solito? Con più energia o con meno?", placeholder:"Con X mi sento... Con Y mi sento..." },
      { type:'action', text:"Le relazioni non sono tutte uguali — alcune ci ricaricano, altre ci svuotano. Né le une né le altre sono necessariamente sbagliate, ma è importante saperlo." },
      { type:'question', q:"C'è una relazione che vorresti coltivare di più? E una in cui vorresti stabilire confini più chiari?", placeholder:"Vorrei coltivare di più... Vorrei stabilire confini con..." },
      { type:'question', q:"Qual è un piccolo passo concreto che potresti fare questa settimana per nutrire la relazione più importante per te?", placeholder:"Questa settimana potrei..." },
      { type:'complete', msg:"Hai appena fatto una mappa emotiva delle tue relazioni. Usarla per fare scelte consapevoli è uno dei segni più belli di uno stile sicuro in azione.", cta:"Condividi con Clara le tue riflessioni" }
    ]
  },
  tempesta: {
    title: 'Quando la tempesta arriva',
    style: 'sicuro',
    color: '#7CE8A8',
    steps: [
      { type:'intro', text:"Avere uno stile sicuro non significa non essere mai toccata dai conflitti — significa avere risorse per attraversarli senza perdersi. Questo esercizio lavora su quei momenti di tempesta." },
      { type:'question', q:"Pensa a un conflitto recente con qualcuno importante. Cosa è successo? Come ti sei sentita?", placeholder:"È successo che..." },
      { type:'question', q:"Durante quel conflitto, c'è stato un momento in cui hai sentito di perdere la tua stabilità — diventare reattiva, chiuderti, o fare qualcosa che non ti rispecchiava?", placeholder:"Ho sentito di perdermi quando..." },
      { type:'action', text:"Riconoscere quel momento è fondamentale. Non per giudicarti — ma per capire qual è il tuo segnale personale che indica: sto uscendo dalla mia base sicura." },
      { type:'question', q:"Qual è il segnale — fisico, emotivo o comportamentale — che indica che stai perdendo la stabilità in un conflitto?", placeholder:"Il mio segnale è..." },
      { type:'question', q:"Cosa ti aiuta a ritrovare la stabilità durante un conflitto intenso? Cosa ha funzionato in passato?", placeholder:"Mi aiuta..." },
      { type:'complete', msg:"Conoscere il tuo segnale e le tue risorse di ritorno è il cuore della resilienza relazionale. Non si tratta di non essere colpita — si tratta di sapere come tornare a casa.", cta:"Approfondisci con Clara" }
    ]
  }
};

let currentExercise = null;
let currentStep = 0;
const exAnswers = {};

function openExercise(id) {
  currentExercise = id;
  currentStep = 0;
  exAnswers[id] = {};
  document.getElementById('exModalOverlay').classList.add('open');
  renderExStep();
}

function closeExercise() {
  document.getElementById('exModalOverlay').classList.remove('open');
  currentExercise = null;
}

function closeExerciseOnOverlay(e) {
  if (e.target === document.getElementById('exModalOverlay')) closeExercise();
}

function renderExStep() {
  const ex = EXERCISES[currentExercise];
  const step = ex.steps[currentStep];
  const total = ex.steps.length;
  const pct = Math.round((currentStep / (total - 1)) * 100);

  document.getElementById('exProgressFill').style.width = pct + '%';

  const styleColors = { ansioso:'#E8A87C', evitante:'#7CB9E8', disorganizzato:'#B87CE8', sicuro:'#7CE8A8' };
  const color = styleColors[ex.style] || '#C4897A';

  let html = '';

  if (step.type === 'intro') {
    html = `
      <div style="margin-top:24px">
        <div style="font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:${color};margin-bottom:8px">Esercizio</div>
        <h2 style="font-family:'Cormorant Garamond',serif;font-size:26px;font-weight:400;color:var(--charcoal);margin-bottom:16px">${ex.title}</h2>
        <p style="font-size:15px;line-height:1.8;color:var(--warm-gray)">${step.text}</p>
      </div>
      <div class="ex-nav">
        <button class="ex-btn-back" onclick="closeExercise()">Annulla</button>
        <button class="ex-btn-next" onclick="exNext()">Inizia →</button>
      </div>`;
  } else if (step.type === 'action') {
    html = `
      <div style="margin-top:24px">
        <div style="font-size:11px;letter-spacing:0.1em;text-transform:uppercase;color:var(--warm-gray);opacity:0.6;margin-bottom:12px">Passo ${currentStep} di ${total - 2}</div>
        <div style="background:rgba(${ex.style==='ansioso'?'232,168,124':ex.style==='evitante'?'124,185,232':ex.style==='disorganizzato'?'184,124,232':'124,232,168'},0.1);border-left:3px solid ${color};border-radius:0 12px 12px 0;padding:18px 20px;margin:16px 0">
          <p style="font-size:15px;line-height:1.8;color:var(--charcoal)">${step.text}</p>
        </div>
      </div>
      <div class="ex-nav">
        <button class="ex-btn-back" onclick="exBack()">← Indietro</button>
        <button class="ex-btn-next" onclick="exNext()">Fatto →</button>
      </div>`;
  } else if (step.type === 'question') {
    const savedVal = exAnswers[currentExercise][currentStep] || '';
    html = `
      <div style="margin-top:24px">
        <div style="font-size:11px;letter-spacing:0.1em;text-transform:uppercase;color:var(--warm-gray);opacity:0.6;margin-bottom:12px">Passo ${currentStep} di ${total - 2}</div>
        <p style="font-family:'Cormorant Garamond',serif;font-size:20px;font-weight:400;color:var(--charcoal);line-height:1.5;margin-bottom:16px">${step.q}</p>
        <textarea class="ex-textarea" id="exAnswer" placeholder="${step.placeholder}" oninput="saveExAnswer()">${savedVal}</textarea>
      </div>
      <div class="ex-nav">
        <button class="ex-btn-back" onclick="exBack()">← Indietro</button>
        <button class="ex-btn-next" onclick="exNext()">Avanti →</button>
      </div>`;
  } else if (step.type === 'complete') {
    html = `
      <div class="ex-complete" style="margin-top:24px">
        <div class="ex-complete-icon">✦</div>
        <h3>Esercizio completato</h3>
        <p>${step.msg}</p>
        <div>
          <button class="ex-chat-btn" onclick="exOpenChat(currentStep)">${step.cta}</button>
          <button class="ex-close-btn" onclick="closeExercise()">Chiudi</button>
        </div>
      </div>`;
  }

  document.getElementById('exModalBody').innerHTML = html;
}

function saveExAnswer() {
  const el = document.getElementById('exAnswer');
  if (el) exAnswers[currentExercise][currentStep] = el.value;
}

function exNext() {
  saveExAnswer();
  const ex = EXERCISES[currentExercise];
  if (currentStep < ex.steps.length - 1) {
    currentStep++;
    renderExStep();
  }
}

function exBack() {
  if (currentStep > 0) {
    currentStep--;
    renderExStep();
  }
}

function exOpenChat(stepIdx) {
  const ex = EXERCISES[currentExercise];
  const cta = ex.steps[stepIdx] ? ex.steps[stepIdx].cta : 'Parla con Clara di com\'è andata';
  const answers = exAnswers[currentExercise] || {};

  // Costruisci messaggio contestuale con le risposte dell'esercizio
  const answerLines = Object.entries(answers)
    .filter(([,v]) => v && v.trim())
    .map(([stepIdx, val]) => {
      const step = ex.steps[parseInt(stepIdx)];
      return step && step.q ? `— ${step.q}\n  "${val.trim()}"` : null;
    })
    .filter(Boolean);

  let fullMsg = `Ho appena completato l'esercizio "${ex.title}"`;
  if (answerLines.length > 0) {
    fullMsg += ` e voglio condividere quello che è emerso:\n\n${answerLines.join('\n\n')}`;
  }
  fullMsg += `\n\n${cta}`;

  closeExercise();

  // Piccolo timeout per permettere al DOM di aggiornarsi
  setTimeout(() => {
    showView('chat');
    const input = document.getElementById('messageInput');
    input.value = fullMsg;
    autoResize(input);
    input.focus();
    // Scroll in fondo alla chat
    const area = document.getElementById('messagesArea');
    if (area) area.scrollTop = area.scrollHeight;
  }, 100);
}

// ─── WAITLIST / PIANI ───
function openWaitlist(piano, prezzo) {
  document.getElementById('waitlistTitle').textContent = 'Clara ' + piano + ' — ' + prezzo;
  document.getElementById('waitlistDesc').textContent = 'I pagamenti saranno disponibili a breve. Lascia la tua email e ti avviseremo appena puoi attivare il piano — con uno sconto di benvenuto del 20%.';
  document.getElementById('waitlistMsg').style.display = 'none';
  document.getElementById('waitlistName').value = '';
  document.getElementById('waitlistEmail').value = '';
  document.getElementById('waitlistOverlay').classList.add('open');
}

function closeWaitlist() {
  document.getElementById('waitlistOverlay').classList.remove('open');
}

function closeWaitlistOnOverlay(e) {
  if (e.target === document.getElementById('waitlistOverlay')) closeWaitlist();
}

function submitWaitlist() {
  const name = document.getElementById('waitlistName').value.trim();
  const email = document.getElementById('waitlistEmail').value.trim();
  const msg = document.getElementById('waitlistMsg');

  if (!name || !email) {
    msg.style.display = 'block';
    msg.style.background = 'rgba(226,75,74,0.08)';
    msg.style.borderColor = 'rgba(226,75,74,0.2)';
    msg.style.color = '#A32D2D';
    msg.textContent = 'Inserisci nome ed email per continuare.';
    return;
  }
  if (!email.includes('@')) {
    msg.style.display = 'block';
    msg.style.background = 'rgba(226,75,74,0.08)';
    msg.style.borderColor = 'rgba(226,75,74,0.2)';
    msg.style.color = '#A32D2D';
    msg.textContent = 'Inserisci un indirizzo email valido.';
    return;
  }

  // Salva in localStorage (in produzione si manderebbe a un backend)
  const waitlist = JSON.parse(localStorage.getItem('clara_waitlist') || '[]');
  waitlist.push({ name, email, piano: document.getElementById('waitlistTitle').textContent, date: new Date().toISOString() });
  localStorage.setItem('clara_waitlist', JSON.stringify(waitlist));

  msg.style.display = 'block';
  msg.style.background = 'rgba(124,232,168,0.15)';
  msg.style.borderColor = 'rgba(124,232,168,0.3)';
  msg.style.color = '#085041';
  msg.textContent = 'Perfetto, ' + name + '! Ti avviseremo appena i pagamenti sono attivi. Lo sconto del 20% è riservato.';

  document.querySelector('.waitlist-submit').style.display = 'none';
  document.getElementById('waitlistName').disabled = true;
  document.getElementById('waitlistEmail').disabled = true;

  setTimeout(() => closeWaitlist(), 3000);
}


// ─── AUTH SCREEN ───
function showAuthScreen() {
  const onboarding = document.getElementById('onboarding');
  if (onboarding) onboarding.classList.add('hidden');
  let authEl = document.getElementById('authScreen');
  if (!authEl) {
    authEl = document.createElement('div');
    authEl.id = 'authScreen';
    authEl.style.cssText = 'position:fixed;inset:0;background:var(--cream);z-index:3000;display:flex;align-items:center;justify-content:center;padding:24px;';
    authEl.innerHTML = `
      <div style="background:white;border-radius:28px;padding:48px;max-width:480px;width:100%;box-shadow:0 8px 48px rgba(44,40,37,0.12);border:1px solid var(--light-border);animation:slideUp 0.5s ease">
        <div style="font-family:'Cormorant Garamond',serif;font-size:36px;font-weight:300;color:var(--charcoal);margin-bottom:4px">Clara</div>
        <div style="font-size:11px;color:var(--warm-gray);letter-spacing:0.1em;text-transform:uppercase;margin-bottom:32px">La tua guida emotiva</div>

        <div id="authTabs" style="display:flex;gap:0;margin-bottom:28px;border:1px solid var(--light-border);border-radius:12px;overflow:hidden">
          <button id="tabLogin" onclick="switchAuthTab('login')" style="flex:1;padding:10px;background:var(--charcoal);color:var(--cream);border:none;font-family:'DM Sans',sans-serif;font-size:13px;cursor:pointer;transition:all 0.2s">Accedi</button>
          <button id="tabSignup" onclick="switchAuthTab('signup')" style="flex:1;padding:10px;background:transparent;color:var(--warm-gray);border:none;font-family:'DM Sans',sans-serif;font-size:13px;cursor:pointer;transition:all 0.2s">Registrati</button>
        </div>

        <div id="authFormSignup" style="display:none">
          <input id="authName" type="text" placeholder="Il tuo nome" style="width:100%;padding:14px 16px;border:1.5px solid var(--light-border);border-radius:14px;font-family:'DM Sans',sans-serif;font-size:14px;color:var(--charcoal);background:var(--warm-white);outline:none;margin-bottom:12px;box-sizing:border-box;transition:border-color 0.2s" onfocus="this.style.borderColor='var(--rose)'" onblur="this.style.borderColor='var(--light-border)'"/>
        </div>

        <input id="authEmail" type="email" placeholder="La tua email" style="width:100%;padding:14px 16px;border:1.5px solid var(--light-border);border-radius:14px;font-family:'DM Sans',sans-serif;font-size:14px;color:var(--charcoal);background:var(--warm-white);outline:none;margin-bottom:12px;box-sizing:border-box;transition:border-color 0.2s" onfocus="this.style.borderColor='var(--rose)'" onblur="this.style.borderColor='var(--light-border)'" onkeydown="if(event.key==='Enter')submitAuth()"/>
        <div style="position:relative;margin-bottom:12px">
          <input id="authPassword" type="password" placeholder="Password (min. 8 caratteri)" style="width:100%;padding:14px 48px 14px 16px;border:1.5px solid var(--light-border);border-radius:14px;font-family:'DM Sans',sans-serif;font-size:14px;color:var(--charcoal);background:var(--warm-white);outline:none;box-sizing:border-box;transition:border-color 0.2s" onfocus="this.style.borderColor='var(--rose)'" onblur="this.style.borderColor='var(--light-border)'" onkeydown="if(event.key==='Enter')submitAuth()"/>
          <button type="button" onclick="togglePwd()" style="position:absolute;right:14px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;padding:4px;color:var(--warm-gray);display:flex;align-items:center" title="Mostra/nascondi password">
            <svg id="pwdEyeIcon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="12" r="3" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
        </div>

        <div id="authError" style="display:none;font-size:12px;color:var(--deep-rose);margin-bottom:12px;padding:10px 14px;background:rgba(160,101,90,0.08);border-radius:10px"></div>

        <button onclick="submitAuth()" style="width:100%;padding:16px;background:var(--charcoal);color:var(--cream);border:none;border-radius:14px;font-family:'DM Sans',sans-serif;font-size:15px;cursor:pointer;transition:all 0.2s;margin-bottom:12px" onmouseover="this.style.background='var(--deep-rose)'" onmouseout="this.style.background='var(--charcoal)'" id="authSubmitBtn">Accedi →</button>

        <div id="authNote" style="text-align:center;font-size:11px;color:var(--warm-gray);opacity:0.7">7 giorni gratuiti · Nessuna carta richiesta</div>
      </div>`;
    document.body.appendChild(authEl);
  }
  authEl.style.display = 'flex';
}

let authMode = 'login';

function togglePwd() {
  const input = document.getElementById('authPassword');
  const icon = document.getElementById('pwdEyeIcon');
  if (!input) return;
  if (input.type === 'password') {
    input.type = 'text';
    icon.innerHTML = '<path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/><line x1="1" y1="1" x2="23" y2="23" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>';
  } else {
    input.type = 'password';
    icon.innerHTML = '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke-linecap="round" stroke-linejoin="round" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="12" cy="12" r="3" stroke-linecap="round" stroke-linejoin="round" fill="none" stroke="currentColor" stroke-width="1.5"/>';
  }
}

function switchAuthTab(mode) {
  authMode = mode;
  const isSignup = mode === 'signup';
  document.getElementById('authFormSignup').style.display = isSignup ? 'block' : 'none';
  document.getElementById('tabLogin').style.background = isSignup ? 'transparent' : 'var(--charcoal)';
  document.getElementById('tabLogin').style.color = isSignup ? 'var(--warm-gray)' : 'var(--cream)';
  document.getElementById('tabSignup').style.background = isSignup ? 'var(--charcoal)' : 'transparent';
  document.getElementById('tabSignup').style.color = isSignup ? 'var(--cream)' : 'var(--warm-gray)';
  document.getElementById('authSubmitBtn').textContent = isSignup ? 'Crea il tuo account →' : 'Accedi →';
  document.getElementById('authNote').textContent = isSignup ? '7 giorni gratuiti · Nessuna carta richiesta' : 'Bentornata — Clara ti ha aspettata.';
  document.getElementById('authError').style.display = 'none';
}

async function submitAuth() {
  const email = document.getElementById('authEmail').value.trim();
  const password = document.getElementById('authPassword').value.trim();
  const errorEl = document.getElementById('authError');
  const btn = document.getElementById('authSubmitBtn');

  if (!email || !password) {
    errorEl.textContent = 'Inserisci email e password.';
    errorEl.style.display = 'block';
    return;
  }

  btn.textContent = 'Un momento...';
  btn.disabled = true;
  errorEl.style.display = 'none';

  if (authMode === 'signup') {
    const nome = document.getElementById('authName')?.value.trim() || '';
    if (!nome) {
      errorEl.textContent = 'Inserisci il tuo nome.';
      errorEl.style.display = 'block';
      btn.textContent = 'Crea il tuo account →';
      btn.disabled = false;
      return;
    }
    const { error } = await supabaseClient.auth.signUp({ email, password });
    if (error) {
      errorEl.textContent = error.message === 'User already registered' ? 'Email già registrata. Prova ad accedere.' : error.message;
      errorEl.style.display = 'block';
      btn.textContent = 'Crea il tuo account →';
      btn.disabled = false;
      return;
    }
    // Salva nome nel profilo
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session) {
      currentUser = session.user;
      await supabaseClient.from('profiles').update({ nome }).eq('id', currentUser.id);
      await loadProfile();
    }
  } else {
    const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) {
      errorEl.textContent = 'Email o password non corretti.';
      errorEl.style.display = 'block';
      btn.textContent = 'Accedi →';
      btn.disabled = false;
      return;
    }
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session) {
      currentUser = session.user;
      await loadProfile();
    }
  }

  // Login/signup riuscito
  document.getElementById('authScreen').style.display = 'none';

  // Controlla se questo utente ha già fatto il test su Supabase
  const isNewUser = authMode === 'signup';
  const state = loadState();
  const profileHasStyle = userProfile && userProfile.stile_attaccamento;

  if (isNewUser || !profileHasStyle) {
    // Nuovo utente o utente senza stile — mostra il test
    // Pulisci localStorage per evitare contaminazione da altri account
    localStorage.removeItem('clara_state');
    localStorage.removeItem('clara_msglog');
    conversationHistory = [];
    document.getElementById('onboarding').classList.remove('hidden');
    document.getElementById('messagesArea').innerHTML = `
      <div class="message clara">
        <div class="message-avatar">C</div>
        <div>
          <div class="message-bubble">Ciao, sono Clara. Sono qui per te — senza giudizi, senza fretta.<br><br>Puoi raccontarmi come ti senti in questo momento, oppure dirmi cosa ti ha portato qui. Siamo al sicuro. ✦</div>
          <div class="message-time">Ora</div>
        </div>
      </div>`;
    renderProgress();
    updateCounter();
    return;
  }

  // Utente esistente con stile già salvato su Supabase — vai alla chat
  document.getElementById('onboarding').classList.add('hidden');
  userStyle = userProfile.stile_attaccamento;
  updateSidebarUser();
  await loadConversationsFromCloud();
  const state2 = loadState();
  if (conversationHistory.length === 0 && state2?.conversationHistory?.length > 0) {
    conversationHistory = state2.conversationHistory;
    restoreMessages();
  }
  updateCounter();
}

// ─── RESET ONBOARDING ───
function resetOnboarding() {
  if (!confirm('Vuoi rifare il test? La conversazione attuale verrà mantenuta, ma il tuo profilo verrà ricalcolato.')) return;
  // Resetta solo l'onboarding, mantieni la chiave API e i messaggi
  const state = loadState() || {};
  state.onboardingDone = false;
  state.userStyle = null;
  localStorage.setItem('clara_state', JSON.stringify(state));
  // Resetta variabili in memoria
  userStyle = null;
  obStep = 0;
  // Riporta tutti gli step allo stato iniziale
  document.querySelectorAll('.ob-step').forEach(s => s.classList.remove('active'));
  document.getElementById('ob-step-0').classList.add('active');
  document.querySelectorAll('.ob-option').forEach(o => o.classList.remove('selected'));
  document.querySelectorAll('[id^="next-"]').forEach(b => b.disabled = true);
  document.getElementById('ob-result-content').innerHTML = '';
  renderProgress();
  document.getElementById('onboarding').classList.remove('hidden');
  closeSidebar();
}

function hideLoading() {
  const el = document.getElementById('loadingOverlay');
  if (el) el.style.display = 'none';
}

// ─── INIT ───
async function init() {
  // Registra service worker PWA
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }

  // Controlla se c'è una sessione Supabase attiva
  const hasSession = await initSupabase();

  if (hasSession) {
    hideLoading();
    // Utente loggato — nascondi auth screen
    const authEl = document.getElementById('authScreen');
    if (authEl) authEl.style.display = 'none';

    // Controlla il profilo Supabase per sapere se ha già fatto il test
    const profileDone = userProfile && userProfile.stile_attaccamento;
    const state = loadState();
    const localDone = state && state.onboardingDone;

    if (profileDone || localDone) {
      // Utente ha già fatto il test — vai alla chat
      document.getElementById('onboarding').classList.add('hidden');
      if (profileDone) userStyle = userProfile.stile_attaccamento;
      else if (localDone) userStyle = state.userStyle || userStyle;
      await loadConversationsFromCloud();
      if (conversationHistory.length === 0 && state?.conversationHistory?.length > 0) {
        conversationHistory = state.conversationHistory;
        restoreMessages();
      }
      updateSidebarUser();
    }
    // Se non ha fatto il test, mostra l'onboarding
    const onbEl2 = document.getElementById('onboarding');
    if (onbEl2) { onbEl2.style.display = 'flex'; onbEl2.classList.remove('hidden'); }
  } else {
    hideLoading();
    // Nessuna sessione — mostra schermata auth
    showAuthScreen();
  }

  renderProgress();
  updateCounter();
}

function restoreMessages() {
  const area = document.getElementById('messagesArea');
  area.innerHTML = '';
  conversationHistory.forEach(msg => appendMessage(msg.role === 'user' ? 'user' : 'clara', msg.content, msg.ts));
}

// ─── MOBILE SIDEBAR ───
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('hamburger').classList.toggle('open');
  document.getElementById('sidebarOverlay').classList.toggle('visible');
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('hamburger').classList.remove('open');
  document.getElementById('sidebarOverlay').classList.remove('visible');
}

// ─── NAVIGATION ───
function showView(name) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('view-'+name).classList.add('active');
  const ni = document.querySelectorAll('.nav-item');
  if(name==='chat') ni[0].classList.add('active');
  if(name==='specchio') ni[1].classList.add('active');
  if(name==='progressi') ni[2].classList.add('active');
  if(name==='esercizi') ni[3].classList.add('active');
  if(name==='libri') ni[4].classList.add('active');
  if(name==='piani') ni[5].classList.add('active');
  closeSidebar();
}

function showStyle(s) {
  const data = STYLES_DATA[s];
  document.getElementById('stileTitle').textContent = data.title;
  document.getElementById('stileSubtitle').textContent = 'Caratteristiche, pattern emotivi ed esercizi dedicati per lo stile '+data.title.toLowerCase()+'.';

  // Esercizi per questo stile
  const styleExercises = Object.entries(EXERCISES).filter(([,ex]) => ex.style === s);

  // Badge "il tuo stile" se corrisponde al profilo
  const isMyStyle = userStyle === s;
  const myStyleBadge = isMyStyle
    ? `<div style="display:inline-flex;align-items:center;gap:6px;background:rgba(${s==='ansioso'?'232,168,124':s==='evitante'?'124,185,232':s==='disorganizzato'?'184,124,232':'124,232,168'},0.15);color:${data.color};border-radius:20px;padding:5px 14px;font-size:12px;font-weight:500;margin-bottom:16px">✦ Il tuo profilo attuale</div>`
    : `<button onclick="setMyStyle('${s}')" style="display:inline-flex;align-items:center;gap:6px;background:transparent;border:1px solid var(--light-border);color:var(--warm-gray);border-radius:20px;padding:5px 14px;font-size:12px;cursor:pointer;margin-bottom:16px;transition:all 0.2s;font-family:'DM Sans',sans-serif" onmouseover="this.style.borderColor='${data.color}';this.style.color='${data.color}'" onmouseout="this.style.borderColor='var(--light-border)';this.style.color='var(--warm-gray)'">Questo è il mio stile</button>`;

  document.getElementById('stileContent').innerHTML = `
    <div class="reflection-card" style="border-top:3px solid ${data.color}">
      <div style="font-size:40px;margin-bottom:12px">${data.emoji}</div>
      ${myStyleBadge}
      <div class="card-label">Panoramica</div>
      <h3>${data.title}</h3>
      <p>${data.description}</p>
    </div>

    <div class="reflection-card">
      <div class="card-label">Come si manifesta</div>
      <h3>Caratteristiche principali</h3>
      ${data.traits.map(t=>`<p style="margin-bottom:10px;padding-left:16px;border-left:2px solid ${data.color};margin-left:0;border-radius:0">${t}</p>`).join('')}
    </div>

    <div class="reflection-card">
      <div class="card-label">Esercizi guidati</div>
      <h3>Pratiche per questo stile</h3>
      <p style="margin-bottom:16px">Clicca su un esercizio per iniziare — puoi farlo adesso, richiede pochi minuti.</p>
      <div style="display:flex;flex-direction:column;gap:10px">
        ${styleExercises.map(([id, ex]) => `
          <div onclick="openExercise('${id}')" style="display:flex;align-items:center;justify-content:space-between;background:var(--cream);border-radius:14px;padding:14px 18px;cursor:pointer;transition:all 0.2s;border:1px solid transparent" onmouseover="this.style.background='white';this.style.borderColor='${data.color}40';this.style.transform='translateX(4px)'" onmouseout="this.style.background='var(--cream)';this.style.borderColor='transparent';this.style.transform='none'">
            <div>
              <div style="font-size:14px;font-weight:500;color:var(--charcoal);margin-bottom:3px">${ex.title}</div>
              <div style="font-size:12px;color:var(--warm-gray)">${ex.steps.length - 2} passi · ${ex.steps.filter(st=>st.type==='question').length} domande</div>
            </div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${data.color}" stroke-width="2"><path d="M9 18l6-6-6-6" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </div>`).join('')}
      </div>
    </div>

    <div class="reflection-card" style="background:linear-gradient(135deg,var(--cream),white)">
      <div class="card-label">Parla con Clara</div>
      <h3>Esplora il tuo stile in chat</h3>
      <p>Vuoi che Clara ti guidi in modo personalizzato? Puoi raccontarle una situazione concreta e lavorarci insieme.</p>
      <button onclick="startStyleChat('${s}')" style="margin-top:16px;padding:12px 20px;background:var(--charcoal);color:var(--cream);border:none;border-radius:10px;font-family:'DM Sans',sans-serif;font-size:13px;cursor:pointer;transition:background 0.2s" onmouseover="this.style.background='${data.color}'" onmouseout="this.style.background='var(--charcoal)'">Parla con Clara di questo →</button>
    </div>`;

  showView('stili');
}

function setMyStyle(s) {
  userStyle = s;
  saveState();
  updateSidebarUser();
  showStyle(s);
}

function startStyleChat(s) {
  showView('chat');
  const inp = document.getElementById('messageInput');
  inp.value = `Voglio esplorare lo stile ${STYLES_DATA[s].title.toLowerCase()} con te.`;
  inp.focus();
}

// ─── CHAT UTILS ───
function autoResize(el) { el.style.height='auto'; el.style.height=Math.min(el.scrollHeight,120)+'px'; }
function handleKey(e) { if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendMessage();} }
function getDateTime(ts) {
  const d = ts ? new Date(ts) : new Date();
  const now = new Date();
  const today = now.toDateString();
  const yesterday = new Date(now - 86400000).toDateString();
  const time = d.toLocaleTimeString('it-IT', {hour:'2-digit', minute:'2-digit'});
  if (d.toDateString() === today) return time;
  if (d.toDateString() === yesterday) return 'Ieri ' + time;
  return d.toLocaleDateString('it-IT', {day:'numeric', month:'short'}) + ' ' + time;
}
function getTime() { return getDateTime(); }

function appendMessage(role, text, ts) {
  const area = document.getElementById('messagesArea');
  const div = document.createElement('div');
  div.className = `message ${role}`;
  const init = role==='clara' ? 'C' : 'T';
  // Rimuovi eventuali tag timestamp dal testo visualizzato
  const cleanText = text.replace(/^\[[\w\s,àèéìòù]+alle \d{2}:\d{2}\]\s*/i, '').trim();
  div.innerHTML = `<div class="message-avatar">${init}</div><div><div class="message-bubble">${cleanText.replace(/\n/g,'<br>')}</div><div class="message-time">${getDateTime(ts)}</div></div>`;
  area.appendChild(div);
  area.scrollTop = area.scrollHeight;
  return div;
}

function showTyping() {
  const area = document.getElementById('messagesArea');
  const div = document.createElement('div');
  div.className = 'typing-indicator'; div.id = 'typingIndicator';
  div.innerHTML = `<div class="message-avatar" style="width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,var(--blush),var(--rose));display:flex;align-items:center;justify-content:center;font-family:'Cormorant Garamond',serif;font-size:14px;color:white;flex-shrink:0;margin-top:2px">C</div><div class="typing-bubble"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div>`;
  area.appendChild(div);
  area.scrollTop = area.scrollHeight;
}

function removeTyping() { const t=document.getElementById('typingIndicator'); if(t) t.remove(); }

// ─── SEND WITH STREAMING ───
async function sendMessage() {
  if (isStreaming) return;
  if (!canSendMessage()) { updateCounter(); return; }
  const input = document.getElementById('messageInput');
  const text = input.value.trim();
  if (!text) return;

  const sendBtn = document.getElementById('sendBtn');
  sendBtn.disabled = true;
  isStreaming = true;
  input.value = ''; input.style.height = 'auto';

  appendMessage('user', text);
  const userTs = Date.now();
  conversationHistory.push({role:'user',content:text,ts:userTs});
  saveMessageToCloud('user', text, userTs);
  incrementMsgCount();
  updateCounter();
  showTyping();

  const lastUserMsg = conversationHistory.length > 0 ? conversationHistory[conversationHistory.length-1] : null;
  const comesFromExercise = lastUserMsg && lastUserMsg.role === 'user' && lastUserMsg.content && lastUserMsg.content.includes('Ho appena completato l\'esercizio');

  // Costruisci storico con timestamp per Clara
  const historyWithTime = conversationHistory.map(msg => {
    if (!msg.ts) return { role: msg.role, content: msg.content };
    const d = new Date(msg.ts);
    const label = d.toLocaleDateString('it-IT', {weekday:'long', day:'numeric', month:'long'}) + ' alle ' + d.toLocaleTimeString('it-IT', {hour:'2-digit', minute:'2-digit'});
    return { role: msg.role, content: `[${label}] ${msg.content}` };
  });

  const systemPrompt = `Sei Clara, una compagna empatica ed esperta in psicologia dell'attaccamento.${userStyle ? ` L'utente ha uno stile di attaccamento prevalentemente ${userStyle}.` : ''}
Il tuo ruolo è quello di un'amica esperta — non una terapeuta clinica, ma qualcuno di caldo, preparato e presente.
TONO: Parla in italiano, con calore autentico. Empatica ma mai invadente. Fai domande aperte. Prima accogli, poi esplori. Concisa (max 4-5 righe) salvo richiesta diversa.
CONOSCENZE: Stili di attaccamento (Bowlby, Ainsworth), regolazione emotiva, mindfulness, autocompassione.
LIMITI: Non sei sostituta di un professionista. In caso di crisi, suggerisci aiuto professionale.
TEMPO: Ogni messaggio include data e ora. Usale per capire quanto tempo è passato tra i messaggi — se sono passati giorni, Clara deve essere consapevole del salto temporale e non trattare messaggi vecchi come se fossero recenti.${comesFromExercise ? `
CONTESTO IMPORTANTE: L'utente ha appena terminato un esercizio guidato e sta condividendo quello che è emerso. Accogli prima di tutto — non analizzare subito. Rispecchia quello che ha scritto in modo personale e concreto, riferendoti alle sue risposte specifiche. È un momento delicato e prezioso: trattalo con cura.` : ''}
Rispondi sempre in italiano.`;

  try {
    const response = await fetch('https://super-truth-5867.danielbrunellivr.workers.dev/', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({
        apiKey: getApiKey(),
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        system: systemPrompt,
        messages: historyWithTime
      })
    });

    if (!response.ok) throw new Error('API error');

    const data = await response.json();
    removeTyping();

    const reply = data.content?.[0]?.text || 'Mi dispiace, non sono riuscita a rispondere. Puoi riprovare?';
    appendMessage('clara', reply);
    const claraTs = Date.now();
    conversationHistory.push({role:'assistant',content:reply,ts:claraTs});
    saveMessageToCloud('assistant', reply, claraTs);
    saveState();

  } catch(err) {
    removeTyping();
    appendMessage('clara', 'Scusa, ho avuto un momento di difficoltà tecnica. Riprova tra poco — sono qui. 💙');
  }

  isStreaming = false;
  sendBtn.disabled = false;
  input.focus();
}

// ─── SPECCHIO INTERIORE ───
async function generateProgressi() {
  const btn = document.getElementById('progressiBtn');
  const area = document.getElementById('progressiArea');

  if (conversationHistory.length < 4) {
    area.innerHTML = `<div class="reflection-card">
      <div class="card-label">Percorso ancora breve</div>
      <h3>Parliamo ancora un po'</h3>
      <p>Per raccontare il tuo percorso, Clara ha bisogno di conoscerti un po' meglio. Scrivi qualche messaggio in più — poi torna qui.</p>
    </div>`;
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Clara sta leggendo il tuo percorso...';
  area.innerHTML = '';

  const historyText = conversationHistory.map(msg => {
    const d = msg.ts ? new Date(msg.ts).toLocaleDateString('it-IT', {weekday:'long', day:'numeric', month:'long'}) + ' alle ' + new Date(msg.ts).toLocaleTimeString('it-IT', {hour:'2-digit', minute:'2-digit'}) : 'data non disponibile';
    const role = msg.role === 'user' ? 'Utente' : 'Clara';
    return `[${d}] ${role}: ${msg.content}`;
  }).join('\n\n');

  try {
    const resp = await fetch('https://super-truth-5867.danielbrunellivr.workers.dev/', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        apiKey: getApiKey(),
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1200,
        system: `Sei Clara, esperta in psicologia dell'attaccamento. Hai avuto una serie di conversazioni con questa persona nel tempo. Analizza l'intera storia e restituisci ESCLUSIVAMENTE un oggetto JSON valido, senza testo prima o dopo, senza backtick, senza markdown.
Il JSON deve avere esattamente questi campi:
{
  "parola_percorso": "una frase breve poetica (max 6 parole) che cattura dove si trova ora la persona nel suo cammino",
  "narrativa": "Una lettera in prima persona di 4-6 frasi, scritta da Clara all'utente. Tono caldo, intimo, come una lettera tra amiche. Parla di come stai evolvendo, cosa stai imparando, dove senti che stai andando. Usa 'tu' e sii specifica su quello che hai letto nelle conversazioni.",
  "temi": ["tema 1 ricorrente in 1 frase", "tema 2 ricorrente in 1 frase", "tema 3 ricorrente in 1 frase"],
  "incoraggiamento": "Una cosa concreta e specifica che Clara ha notato — un cambiamento reale, anche piccolo. Inizia con 'Ho notato che...' e sii precisa, non generica.",
  "evoluzione_stile": "Una frase onesta su come lo stile di attaccamento sembra stia evolvendo. IMPORTANTE: basati su quello che emerge REALMENTE dalle conversazioni, non sul profilo iniziale. Se le conversazioni mostrano pattern ansiosi ma il profilo dice sicuro, dillo esplicitamente e con cura."
}`,
        messages: [{role: 'user', content: `Ecco la nostra storia di conversazioni:\n\n${historyText}\n\nRaccontami il mio percorso.`}]
      })
    });

    const data = await resp.json();
    let prog;
    try {
      prog = JSON.parse((data.content?.[0]?.text || '{}').replace(/```json|```/g, '').trim());
    } catch { prog = null; }

    if (prog) {
      area.innerHTML = `
        <div class="prog-parola" style="animation:fadeInUp 0.4s ease">
          <div class="prog-parola-label">La parola del tuo percorso</div>
          <div class="prog-parola-testo">"${prog.parola_percorso}"</div>
        </div>

        <div class="prog-narrativa" style="animation:fadeInUp 0.5s ease">
          <div class="prog-narrativa-label">Una lettera da Clara</div>
          <div class="prog-narrativa-testo">${prog.narrativa.replace(/\n/g, '<br><br>')}</div>
          <div class="prog-firma">— Clara</div>
        </div>

        <div class="prog-temi" style="animation:fadeInUp 0.6s ease">
          <div class="card-label" style="font-size:10px;letter-spacing:0.15em;text-transform:uppercase;color:var(--rose);margin-bottom:16px">Temi ricorrenti nel tuo percorso</div>
          ${prog.temi.map(t => `
            <div class="prog-tema-item">
              <div class="prog-tema-dot"></div>
              <div class="prog-tema-testo">${t}</div>
            </div>`).join('')}
        </div>

        <div class="prog-incoraggiamento" style="animation:fadeInUp 0.7s ease">
          <div class="card-label" style="font-size:10px;letter-spacing:0.15em;text-transform:uppercase;color:var(--deep-sage);margin-bottom:12px">Quello che ho notato</div>
          <p style="font-size:14px;line-height:1.7;color:var(--charcoal)">${prog.incoraggiamento}</p>
          ${prog.evoluzione_stile ? `<p style="font-size:13px;color:var(--warm-gray);margin-top:12px;padding-top:12px;border-top:1px solid var(--light-border)">${prog.evoluzione_stile}</p>` : ''}
        </div>
      `;
    } else {
      area.innerHTML = `<div class="reflection-card"><p>Clara ha avuto difficoltà a elaborare il percorso. Riprova tra poco.</p></div>`;
    }
  } catch {
    area.innerHTML = `<div class="reflection-card"><p>Errore nella connessione. Riprova tra poco.</p></div>`;
  }

  btn.disabled = false;
  btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" stroke-linecap="round" stroke-linejoin="round"/></svg> Aggiorna il percorso`;
}

async function generateReflection() {
  const btn = document.getElementById('analyzeBtn');
  const area = document.getElementById('reflectionArea');

  if (conversationHistory.length === 0) {
    area.innerHTML = `<div class="reflection-card"><div class="card-label">Nessuna conversazione</div><h3>Inizia a parlare con Clara</h3><p>Per generare il tuo specchio interiore, Clara ha bisogno di conoscerti un po'. Vai nella sezione "Parla con Clara" e condividi come ti senti.</p></div>`;
    return;
  }

  btn.disabled = true; btn.textContent = 'Clara sta riflettendo...';
  area.innerHTML = '';

  try {
    const resp = await fetch('https://super-truth-5867.danielbrunellivr.workers.dev/', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({
        apiKey: getApiKey(),
        model:'claude-sonnet-4-20250514', max_tokens:1500,
        system:`Sei Clara, esperta in psicologia dell'attaccamento. Analizza la conversazione e restituisci ESCLUSIVAMENTE un oggetto JSON valido, senza testo prima o dopo, senza backtick, senza markdown. Sii concisa in ogni campo — max 2 frasi per campo.
Il JSON deve avere esattamente questi campi:
{
  "tema_principale": "max 5 parole",
  "stile_emergente": "uno tra: ansioso, evitante, disorganizzato, sicuro, misto",
  "pattern_emotivo": "max 2 frasi su cosa emerge",
  "punto_forza": "una qualità concreta, max 1 frase",
  "area_crescita": "una area specifica, max 1 frase",
  "messaggio_clara": "messaggio caldo, max 2 frasi"
}
IMPORTANTE: stile_emergente deve riflettere quello che emerge REALMENTE dalla conversazione, non il profilo iniziale.`,
        messages:[...conversationHistory.map(m=>({role:m.role,content:m.content})),{role:'user',content:'Analizza la nostra conversazione e restituisci il JSON della riflessione.'}]
      })
    });
    const data = await resp.json();
    console.log('Specchio full API response:', JSON.stringify(data).slice(0, 500));
    const rawText = data.content?.[0]?.text || '';
    console.log('Specchio raw response:', rawText);
    let ref = null;
    try {
      // Prova a estrarre il JSON anche se c'è testo prima/dopo
      let cleaned = rawText.replace(/```json|```/g,'').trim();
      // Se c'è testo prima del { cerca il primo {
      const firstBrace = cleaned.indexOf('{');
      const lastBrace = cleaned.lastIndexOf('}');
      if (firstBrace > 0) cleaned = cleaned.slice(firstBrace, lastBrace + 1);
      const parsed = JSON.parse(cleaned);
      // Valida campi — accetta anche stringhe vuote ma non undefined
      if (parsed && typeof parsed === 'object' &&
          'tema_principale' in parsed && 'stile_emergente' in parsed &&
          'pattern_emotivo' in parsed && 'punto_forza' in parsed &&
          'area_crescita' in parsed && 'messaggio_clara' in parsed) {
        ref = parsed;
      } else {
        console.log('Campi mancanti nel JSON:', Object.keys(parsed));
      }
    } catch(e) {
      console.log('JSON parse error:', e.message);
      ref = null;
    }

    if (ref) {
      const validStyles = ['ansioso','evitante','disorganizzato','sicuro','misto'];
      const stileKey = validStyles.includes(ref.stile_emergente) ? ref.stile_emergente : 'misto';
      const sd = STYLES_DATA[stileKey];

      // Mostra avviso se stile emergente è diverso dal profilo iniziale
      const stileDiverso = userStyle && stileKey !== userStyle && userStyle !== 'misto';
      const avvisoStile = stileDiverso ? `
        <div class="reflection-card" style="border-left:3px solid var(--rose);border-radius:0 20px 20px 0;background:rgba(196,137,122,0.06)">
          <div class="card-label">Una cosa importante da notare</div>
          <h3>Il tuo profilo sta raccontando qualcosa di diverso</h3>
          <p>Il tuo test iniziale ha indicato uno stile <strong>${STYLES_DATA[userStyle]?.title || userStyle}</strong>, ma quello che emerge dalle nostre conversazioni sembra avvicinarsi di più allo stile <strong>${sd.title}</strong>. Questo è normale — il test è un punto di partenza, non una verità definitiva. Potresti voler <a href="#" onclick="showView('piani');return false;" style="color:var(--rose)">esplorare questo con Clara</a> o <a href="#" onclick="resetOnboarding();return false;" style="color:var(--rose)">rifare il test</a> con più consapevolezza.</p>
        </div>` : '';

      area.innerHTML = `
        ${avvisoStile}
        <div class="reflection-card" style="border-top:3px solid ${sd.color}">
          <div class="card-label">Tema emerso dalla conversazione</div>
          <h3>${ref.tema_principale}</h3><p>${ref.pattern_emotivo}</p>
          <span class="style-tag ${sd.tagClass}">${sd.title}</span>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">
          <div class="reflection-card"><div class="card-label">Il tuo punto di forza</div><h3>✦ Cosa emerge di bello</h3><p>${ref.punto_forza}</p></div>
          <div class="reflection-card"><div class="card-label">Area di crescita</div><h3>🌱 Dove puoi evolvere</h3><p>${ref.area_crescita}</p></div>
        </div>
        <div class="reflection-card" style="background:linear-gradient(135deg,var(--cream),white);border-left:3px solid var(--rose)">
          <div class="card-label">Un messaggio da Clara</div>
          <p style="font-family:'Cormorant Garamond',serif;font-size:17px;font-style:italic;line-height:1.7;color:var(--charcoal)">"${ref.messaggio_clara}"</p>
          <p style="margin-top:10px;font-size:12px;color:var(--rose)">— Clara</p>
        </div>`;
    } else {
      area.innerHTML = `<div class="reflection-card"><p>Clara ha avuto difficoltà a elaborare. Riprova tra poco.</p></div>`;
    }
  } catch {
    area.innerHTML = `<div class="reflection-card"><p>Errore nella connessione. Riprova tra poco.</p></div>`;
  }

  btn.disabled = false;
  btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" stroke-linecap="round"/></svg> Aggiorna la riflessione`;
}

// ─── API KEY ───
function getApiKey() {
  return 'proxy'; // La chiave reale è nel Worker Cloudflare
}

// ─── START ───
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}