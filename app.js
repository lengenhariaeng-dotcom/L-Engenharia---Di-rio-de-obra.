import { firebaseConfig, cloudinaryConfig, isFirebaseConfigured, isCloudinaryConfigured } from './firebase-config.js';

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const state = { user: null, projects: [], project: null, entries: [], demoClientView: false, pendingPhotos: [], deferredPrompt: null, pendingCreatedProjectId: null };
const DEMO_KEY = 'leng_diario_demo_v1';
const ADMIN_EMAIL = 'lengenharia.eng@gmail.com';
const DEFAULT_CLIENT_PASSWORD = '123456@';
const todayISO = () => new Date().toISOString().slice(0, 10);
const uid = () => crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const fmtDate = (iso) => iso ? new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' }).format(new Date(`${iso}T00:00:00Z`)) : '—';
const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const toast = (msg) => { const t=$('#toast'); t.textContent=msg; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'),2200); };

let firebase = null;
let backend = null;

class DemoBackend {
  constructor(){
    this.store = JSON.parse(localStorage.getItem(DEMO_KEY) || 'null') || {
      projects:[{
        id:'demo-project', ownerUid:'demo-owner', ownerEmail:'engenharia@demo.local', clientEmail:'cliente@demo.local',
        name:'Reforma Residencial — Apartamento', client:'Cliente Exemplo', address:'Osasco/SP', engineer:'Luiz Gustavo Tavares da Costa', crea:'5070215494',
        startDate:todayISO(), status:'Em andamento', conclusion:'', createdAt:Date.now()
      }],
      entries:{'demo-project':[
        {id:'e1',date:todayISO(),services:['Instalação da estrutura do forro','Fechamento do forro de gesso'],notes:'Serviços executados nos ambientes previstos.',progress:30,photos:[],createdAt:Date.now()-1000},
        {id:'e2',date:todayISO(),services:['Passagem da infraestrutura elétrica','Preparação dos pontos de iluminação'],notes:'Infraestrutura principal iniciada.',progress:42,photos:[],createdAt:Date.now()}
      ]}
    };
    this.save();
  }
  save(){ localStorage.setItem(DEMO_KEY, JSON.stringify(this.store)); }
  async login(email){ return {uid:'demo-owner',email:email||'engenharia@demo.local'}; }
  async register(email){ return {uid:'demo-owner',email:email||'engenharia@demo.local'}; }
  async logout(){ return true; }
  async listProjects(){ return this.store.projects; }
  async createProject(data){ const p={...data,id:uid(),ownerUid:'demo-owner',ownerEmail:state.user.email,createdAt:Date.now()}; this.store.projects.push(p); this.store.entries[p.id]=[]; this.save(); return p; }
  async updateProject(id,data){ const i=this.store.projects.findIndex(p=>p.id===id); if(i>=0){this.store.projects[i]={...this.store.projects[i],...data};this.save();return this.store.projects[i];} }
  async deleteProject(id){ this.store.projects=this.store.projects.filter(p=>p.id!==id); delete this.store.entries[id]; this.save(); }
  async listEntries(projectId){ return [...(this.store.entries[projectId]||[])].sort((a,b)=>a.date.localeCompare(b.date)||a.createdAt-b.createdAt); }
  async addEntry(projectId,data,photoFiles){
    const photos=[];
    for(const file of photoFiles){ try{ photos.push(await fileToCompressedDataUrl(file)); }catch{} }
    const e={...data,id:uid(),photos,createdAt:Date.now()}; (this.store.entries[projectId] ||= []).push(e); this.save(); return e;
  }
  async deleteEntry(projectId,entryId){ this.store.entries[projectId]=(this.store.entries[projectId]||[]).filter(e=>e.id!==entryId); this.save(); }
}

class FirebaseBackend {
  constructor(api){ this.api=api; }
  async login(email,password){ const r=await this.api.signInWithEmailAndPassword(this.api.auth,email,password); return r.user; }
  async register(email,password){ const r=await this.api.createUserWithEmailAndPassword(this.api.auth,email,password); return r.user; }
  async logout(){ return this.api.signOut(this.api.auth); }
  async listProjects(){
    const email=(state.user?.email||'').toLowerCase();
    let q;
    if(email===ADMIN_EMAIL){
      q=this.api.query(this.api.collection(this.api.db,'projects'),this.api.where('ownerUid','==',state.user.uid));
    }else{
      q=this.api.query(this.api.collection(this.api.db,'projects'),this.api.where('clientEmail','==',email||'__none__'));
    }
    const snap=await this.api.getDocs(q);
    return snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0));
  }
  async createProject(data){ if((state.user?.email||'').toLowerCase()!==ADMIN_EMAIL) throw new Error('Apenas a L Engenharia pode cadastrar obras.'); const ref=await this.api.addDoc(this.api.collection(this.api.db,'projects'),{...data,ownerUid:state.user.uid,ownerEmail:state.user.email,createdAt:this.api.serverTimestamp()}); return {id:ref.id,...data,ownerUid:state.user.uid,ownerEmail:state.user.email}; }
  async updateProject(id,data){ if((state.user?.email||'').toLowerCase()!==ADMIN_EMAIL) throw new Error('Acesso somente leitura.'); await this.api.updateDoc(this.api.doc(this.api.db,'projects',id),data); return {...state.project,...data}; }
  async deleteProject(id){
    if((state.user?.email||'').toLowerCase()!==ADMIN_EMAIL) throw new Error('Acesso somente leitura.');
    const snaps=await this.api.getDocs(this.api.collection(this.api.db,'projects',id,'entries'));
    await Promise.all(snaps.docs.map(d=>this.api.deleteDoc(d.ref)));
    await this.api.deleteDoc(this.api.doc(this.api.db,'projects',id));
  }
  async listEntries(projectId){ const q=this.api.query(this.api.collection(this.api.db,'projects',projectId,'entries'),this.api.orderBy('date','asc')); const s=await this.api.getDocs(q); return s.docs.map(d=>({id:d.id,...d.data()})); }
  async addEntry(projectId,data,photoFiles){
    if((state.user?.email||'').toLowerCase()!==ADMIN_EMAIL) throw new Error('Acesso somente leitura.');
    if(photoFiles.length && !isCloudinaryConfigured) throw new Error('Cloudinary não configurado para envio de fotos.');
    const photos=[];
    for(let i=0;i<photoFiles.length;i++){
      const compressed=await compressImageFile(photoFiles[i]);
      photos.push(await uploadPhotoToCloudinary(compressed));
    }
    const entryRef=await this.api.addDoc(
      this.api.collection(this.api.db,'projects',projectId,'entries'),
      {...data,photos,createdAt:this.api.serverTimestamp()}
    );
    return {id:entryRef.id,...data,photos};
  }
  async deleteEntry(projectId,entryId){ if((state.user?.email||'').toLowerCase()!==ADMIN_EMAIL) throw new Error('Acesso somente leitura.'); await this.api.deleteDoc(this.api.doc(this.api.db,'projects',projectId,'entries',entryId)); }
}

async function initFirebase(){
  if(!isFirebaseConfigured){ backend=new DemoBackend(); $('#modeBadge').classList.remove('hidden'); $('#demoNotice').classList.remove('hidden'); $('#demoEnterBtn').classList.remove('hidden'); $('#authForm').classList.add('hidden'); return; }
  const [{initializeApp},{getAuth,onAuthStateChanged,signInWithEmailAndPassword,createUserWithEmailAndPassword,sendPasswordResetEmail,signOut},{getFirestore,collection,query,where,getDocs,addDoc,updateDoc,deleteDoc,doc,orderBy,serverTimestamp}] = await Promise.all([
    import('https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js'),
    import('https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js'),
    import('https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js')
  ]);
  const app=initializeApp(firebaseConfig); const auth=getAuth(app); const db=getFirestore(app);
  firebase={auth,db,signInWithEmailAndPassword,createUserWithEmailAndPassword,sendPasswordResetEmail,signOut,collection,query,where,getDocs,addDoc,updateDoc,deleteDoc,doc,orderBy,serverTimestamp};
  backend=new FirebaseBackend(firebase);
  onAuthStateChanged(auth, async (user)=>{ if(user){state.user=user;await openDashboard();}else{state.user=null;showView('authView');$('#logoutBtn').classList.add('hidden');} });
}

function showView(id){ $$('.view').forEach(v=>v.classList.add('hidden')); $('#'+id).classList.remove('hidden'); window.scrollTo({top:0,behavior:'smooth'}); }
function setTab(name){
  $$('.tab-view').forEach(v=>v.classList.add('hidden')); $('#'+name+'Tab').classList.remove('hidden');
  $$('.tab').forEach(b=>b.classList.toggle('active',b.dataset.tab===name));
  if(name==='report') renderReport();
}
function isAdminUser(){ return !isFirebaseConfigured || (state.user?.email||'').toLowerCase()===ADMIN_EMAIL; }
function isOwner(){ return state.project && isAdminUser() && state.project.ownerUid===state.user?.uid && !state.demoClientView; }
function applyRole(){
  const owner=isOwner();
  $$('.admin-only').forEach(el=>el.classList.toggle('hidden',!owner));
  $('#deleteProjectBtn').classList.toggle('hidden',!owner);
  $('#projectRole').textContent=owner?'GESTÃO DA OBRA':'ACOMPANHAMENTO DO CLIENTE — SOMENTE LEITURA';
  $('#backBtn').textContent=owner?'← Obras':'← Minhas obras';
}

async function openDashboard(){
  showView('dashboardView'); $('#logoutBtn').classList.remove('hidden');
  const admin=isAdminUser();
  $('#dashboardEyebrow').textContent=admin?'PAINEL DA EQUIPE':'ÁREA DO CLIENTE';
  $('#dashboardTitle').textContent=admin?'Obras':'Minhas obras';
  $('#dashboardSummary').classList.toggle('hidden',!admin);
  state.projects=await backend.listProjects(); renderProjects();
  $('#welcomeText').textContent=isFirebaseConfigured?(admin?`Olá, ${state.user.email}. Cadastre e atualize suas obras pelo botão +.`:`Olá, ${state.user.email}. Seu acesso é somente para acompanhamento das obras vinculadas a este e-mail.`):'Modo demonstração: os dados ficam apenas neste navegador.';
}
function renderProjects(){
  const list=$('#projectList'); list.innerHTML='';
  const ownedProjects=state.projects.filter(p=>p.ownerUid===state.user.uid);
  const canCreate=isAdminUser();
  $('#newProjectBtn').classList.toggle('hidden',!canCreate);
  $('#projectCount').textContent=state.projects.length;
  $('#activeProjectCount').textContent=state.projects.filter(p=>(p.status||'Em andamento')==='Em andamento').length;
  $('#doneProjectCount').textContent=state.projects.filter(p=>p.status==='Concluída').length;
  $('#emptyProjects').classList.toggle('hidden',state.projects.length>0);
  if(state.projects.length===0 && !canCreate){ $('#emptyProjects').innerHTML='<strong>Nenhuma obra vinculada a este e-mail.</strong><span>Entre em contato com a L Engenharia para solicitar acesso.</span>'; }

  if(canCreate){
    const add=document.createElement('button'); add.type='button'; add.className='project-add-card';
    add.innerHTML=`<span class="project-add-plus">+</span><strong>Adicionar nova obra</strong><span>Crie um novo diário para outro cliente.</span>`;
    add.addEventListener('click',openProjectDialog); list.appendChild(add);
  }

  state.projects.forEach(p=>{
    const owned=isAdminUser() && p.ownerUid===state.user.uid; const progress=p.lastProgress||0;
    const status=p.status||'Em andamento';
    const card=document.createElement('article'); card.className='project-card';
    card.innerHTML=`<div class="project-card-top"><span class="role">${owned?'GESTÃO':'CLIENTE'}</span><span class="project-status">${escapeHtml(status)}</span></div><h3>${escapeHtml(p.name)}</h3><p><strong>Cliente:</strong> ${escapeHtml(p.client||'Não informado')}</p><p>${escapeHtml(p.address||'Local não informado')}</p><div class="card-bottom"><div class="card-progress"><span>Andamento</span><strong>${progress}%</strong></div><div class="progress-track"><span style="width:${Math.max(0,Math.min(100,progress))}%"></span></div><div class="project-card-actions">${owned?'<button class="btn primary quick-entry" type="button">＋ Registrar hoje</button>':''}<button class="btn secondary open-project" type="button">${owned?'Abrir diário':'Acompanhar obra'}</button></div></div>`;
    card.querySelector('.open-project').addEventListener('click',()=>openProject(p.id,'timeline'));
    card.querySelector('.quick-entry')?.addEventListener('click',()=>openProject(p.id,'new-entry'));
    list.appendChild(card);
  });
}
async function openProject(projectId,initialTab='timeline'){
  const p=state.projects.find(x=>x.id===projectId); if(!p)return; state.project={...p}; state.demoClientView=false;
  state.entries=await backend.listEntries(projectId); state.project.lastProgress=state.entries.at(-1)?.progress||0;
  renderProjectHeader(); renderTimeline(); populateSettings(); renderReport(); applyRole(); showView('projectView');
  if(initialTab==='new-entry' && isOwner()){
    resetEntryForm();
    setTab('new-entry');
    setTimeout(()=>$$('.service-row input')[0]?.focus(),120);
  }else{
    setTab('timeline');
  }
  $('#demoClientToggle').classList.toggle('hidden',isFirebaseConfigured || p.ownerUid!==state.user.uid);
}
function renderProjectHeader(){
  $('#projectTitle').textContent=state.project.name; $('#projectMeta').textContent=[state.project.client,state.project.address].filter(Boolean).join(' • ')||'—';
  const prog=state.entries.at(-1)?.progress||0; $('#projectProgress').textContent=prog+'%'; $('#projectProgressBar').style.width=prog+'%';
}
function renderTimeline(){
  const list=$('#timelineList'); list.innerHTML=''; $('#emptyTimeline').classList.toggle('hidden',state.entries.length>0);
  [...state.entries].sort((a,b)=>b.date.localeCompare(a.date)).forEach(e=>{
    const card=document.createElement('article'); card.className='timeline-card';
    card.innerHTML=`<div class="timeline-head"><div><div class="timeline-date">${fmtDate(e.date)}</div><h3>Atualização da obra</h3></div><span class="progress-chip">${e.progress}% da obra</span></div><ol class="service-list">${e.services.map((s,i)=>`<li><b>${i+1}</b><span>${escapeHtml(s)}</span></li>`).join('')}</ol>${e.notes?`<div class="timeline-notes"><strong>Observação:</strong> ${escapeHtml(e.notes)}</div>`:''}${e.photos?.length?`<div class="timeline-photos">${e.photos.map((src,i)=>`<img src="${src}" alt="Foto ${i+1} - ${fmtDate(e.date)}" loading="lazy">`).join('')}</div>`:''}${isOwner()?`<div class="timeline-actions"><button class="btn danger" data-delete-entry="${e.id}" type="button">Excluir atualização</button></div>`:''}`;
    list.appendChild(card);
  });
  $$('[data-delete-entry]').forEach(btn=>btn.addEventListener('click',async()=>{ if(!confirm('Excluir esta atualização?'))return; await backend.deleteEntry(state.project.id,btn.dataset.deleteEntry); state.entries=await backend.listEntries(state.project.id); renderTimeline();renderProjectHeader();renderReport();toast('Atualização excluída.'); }));
}

function addServiceRow(value=''){
  const wrap=document.createElement('div'); wrap.className='service-row';
  wrap.innerHTML=`<span class="service-number"></span><input type="text" maxlength="150" value="${escapeHtml(value)}" placeholder="Ex.: Instalação de forro"><button class="service-remove" type="button" aria-label="Remover serviço">×</button>`;
  wrap.querySelector('.service-remove').addEventListener('click',()=>{ const rows=$$('.service-row'); if(rows.length===1){wrap.querySelector('input').value='';wrap.querySelector('input').focus();return;} wrap.remove();renumberServices(); });
  wrap.querySelector('input').addEventListener('keydown',(e)=>{ if(e.key==='Enter'){ e.preventDefault(); if(e.target.value.trim()){addServiceRow();$$('.service-row input').at(-1).focus();} } });
  $('#serviceRows').appendChild(wrap); renumberServices();
}
function renumberServices(){ $$('.service-row').forEach((r,i)=>r.querySelector('.service-number').textContent=i+1); }
function resetEntryForm(){ $('#entryForm').reset(); $('#entryDate').value=todayISO(); const prog=state.entries.at(-1)?.progress||0; $('#entryProgress').value=prog; $('#entryProgressValue').textContent=prog+'%'; $('#serviceRows').innerHTML=''; addServiceRow(); state.pendingPhotos=[]; renderPhotoPreview(); $('#entryMessage').textContent=''; }

async function imageToCanvas(file,max=1600){
  if(!file?.type?.startsWith('image/')) throw new Error('Arquivo inválido');
  let img;
  if('createImageBitmap' in window) img=await createImageBitmap(file);
  else {
    img=await new Promise((resolve,reject)=>{const el=new Image();const url=URL.createObjectURL(file);el.onload=()=>{URL.revokeObjectURL(url);resolve(el)};el.onerror=reject;el.src=url;});
  }
  const scale=Math.min(1,max/Math.max(img.width,img.height)); const c=document.createElement('canvas');c.width=Math.max(1,Math.round(img.width*scale));c.height=Math.max(1,Math.round(img.height*scale));c.getContext('2d').drawImage(img,0,0,c.width,c.height); if(img.close)img.close(); return c;
}
async function fileToCompressedDataUrl(file){ const c=await imageToCanvas(file,1400); return c.toDataURL('image/jpeg',.76); }
async function compressImageFile(file){
  try{const c=await imageToCanvas(file,1800);return await new Promise((resolve,reject)=>c.toBlob(b=>b?resolve(b):reject(new Error('Falha ao comprimir imagem')),'image/jpeg',.82));}
  catch{return file;}
}
async function uploadPhotoToCloudinary(file){
  const body=new FormData();
  body.append('file',file,'foto-obra.jpg');
  body.append('upload_preset',cloudinaryConfig.uploadPreset);
  const endpoint=`https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudinaryConfig.cloudName)}/image/upload`;
  const response=await fetch(endpoint,{method:'POST',body});
  let payload={};
  try{payload=await response.json();}catch{}
  if(!response.ok || !payload.secure_url){
    throw new Error(payload?.error?.message || 'Não foi possível enviar uma das fotos.');
  }
  return payload.secure_url;
}
function renderPhotoPreview(){
  const box=$('#photoPreview'); box.innerHTML='';
  $('#photoSelectionInfo').textContent=state.pendingPhotos.length?`${state.pendingPhotos.length} foto${state.pendingPhotos.length===1?'':'s'} selecionada${state.pendingPhotos.length===1?'':'s'}. Toque no × para remover.`:'Nenhuma foto selecionada.';
  state.pendingPhotos.forEach((file,index)=>{ const url=URL.createObjectURL(file); const d=document.createElement('div');d.className='photo-thumb';d.innerHTML=`<img src="${url}" alt="Prévia da foto ${index+1}"><button type="button" class="photo-remove" aria-label="Remover foto ${index+1}">×</button><span class="photo-index">${index+1}</span>`;d.querySelector('img').addEventListener('load',()=>URL.revokeObjectURL(url),{once:true});d.querySelector('.photo-remove').addEventListener('click',()=>{state.pendingPhotos.splice(index,1);renderPhotoPreview();});box.appendChild(d); });
}
function previewFiles(files){
  const incoming=[...files].filter(f=>f.type?.startsWith('image/'));
  const available=Math.max(0,20-state.pendingPhotos.length);
  state.pendingPhotos.push(...incoming.slice(0,available));
  if(incoming.length>available) toast('Limite de 20 fotos por atualização.');
  $('#entryPhotos').value=''; renderPhotoPreview();
}

function populateSettings(){ const p=state.project; $('#settingsName').value=p.name||'';$('#settingsClient').value=p.client||'';$('#settingsClientEmail').value=p.clientEmail||'';$('#settingsAddress').value=p.address||'';$('#settingsEngineer').value=p.engineer||'';$('#settingsCrea').value=p.crea||'';$('#settingsStartDate').value=p.startDate||'';$('#settingsStatus').value=p.status||'Em andamento';$('#projectConclusion').value=p.conclusion||''; }
function renderReport(){
  if(!state.project)return; const p=state.project; const ordered=[...state.entries].sort((a,b)=>a.date.localeCompare(b.date)); const progress=ordered.at(-1)?.progress||0; const serviceCount=ordered.reduce((n,e)=>n+e.services.length,0); const photoCount=ordered.reduce((n,e)=>n+(e.photos?.length||0),0); const period=ordered.length?`${fmtDate(ordered[0].date)} a ${fmtDate(ordered.at(-1).date)}`:'—';
  $('#reportProjectName').textContent=p.name||'—';$('#reportClient').textContent=p.client||'—';$('#reportAddress').textContent=p.address||'—';$('#reportPeriod').textContent=period;$('#rProject').textContent=p.name||'—';$('#rClient').textContent=p.client||'—';$('#rAddress').textContent=p.address||'—';$('#rEngineer').textContent=p.engineer||'—';$('#rCrea').textContent=p.crea||'—';$('#rProgress').textContent=progress+'%';$('#rDays').textContent=ordered.length;$('#rServices').textContent=serviceCount;$('#rPhotos').textContent=photoCount;$('#rConclusion').textContent=p.conclusion||'A conclusão da obra será inserida antes da emissão final.';$('#rEngineerSign').textContent=p.engineer||'Responsável técnico';$('#rCreaSign').textContent=p.crea?`CREA: ${p.crea}`:'CREA: —';
  $('#reportEntries').innerHTML=ordered.length?ordered.map((e,idx)=>`<article class="report-entry"><div class="report-entry-head"><h3>3.${idx+1} — ${fmtDate(e.date)}</h3><span>Andamento registrado: ${e.progress}%</span></div><ol>${e.services.map(s=>`<li>${escapeHtml(s)}</li>`).join('')}</ol>${e.notes?`<p><strong>Observação:</strong> ${escapeHtml(e.notes)}</p>`:''}${e.photos?.length?`<div class="report-photo-grid">${e.photos.map((src,i)=>`<div class="report-photo"><img src="${src}" alt="Registro fotográfico ${i+1}"><span>Foto ${i+1}</span></div>`).join('')}</div>`:'<p><em>Sem registro fotográfico nesta data.</em></p>'}</article>`).join(''):'<p>Nenhum registro cadastrado.</p>';
}

function refreshClientPassword(){ $('#projectClientPasswordInput').value=DEFAULT_CLIENT_PASSWORD; }
function openProjectDialog(){ $('#projectForm').reset();$('#projectEngineerInput').value='Luiz Gustavo Tavares da Costa';$('#projectCreaInput').value='5070215494';$('#projectStartInput').value=todayISO();refreshClientPassword();$('#projectMessage').textContent='';$('#projectDialog').showModal(); }
function closeProjectDialog(){ $('#projectDialog').close(); }
function showClientAccessDialog(email,password,projectId){
  state.pendingCreatedProjectId=projectId;
  $('#createdClientEmail').value=email||'';
  $('#createdClientPassword').value=password||'';
  $('#clientAccessMessage').textContent='';
  $('#clientAccessDialog').showModal();
}
async function continueToCreatedProject(){
  const id=state.pendingCreatedProjectId; state.pendingCreatedProjectId=null;
  if($('#clientAccessDialog').open) $('#clientAccessDialog').close();
  if(id) await openProject(id,'new-entry');
}


$('#authTabs').addEventListener('click',(e)=>{ const b=e.target.closest('[data-auth]'); if(!b)return; $$('#authTabs .seg').forEach(x=>x.classList.toggle('active',x===b)); $('#authSubmit').textContent=b.dataset.auth==='login'?'Entrar':'Criar conta'; $('#authPassword').autocomplete=b.dataset.auth==='login'?'current-password':'new-password'; });
$('#authForm').addEventListener('submit',async(e)=>{e.preventDefault();const email=$('#authEmail').value.trim();const password=$('#authPassword').value;$('#authMessage').textContent='';try{state.user=await backend.login(email,password);await openDashboard();}catch(err){$('#authMessage').textContent=humanFirebaseError(err);} });
$('#forgotPasswordBtn')?.addEventListener('click',async()=>{const email=$('#authEmail').value.trim();if(!email){$('#authMessage').textContent='Digite seu e-mail para receber a redefinição de senha.';return;}try{await firebase.sendPasswordResetEmail(firebase.auth,email);$('#authMessage').textContent='Enviamos um link para redefinir sua senha.';}catch(err){$('#authMessage').textContent=humanFirebaseError(err);}});
$('#demoEnterBtn').addEventListener('click',async()=>{state.user=await backend.login('engenharia@demo.local','demo');await openDashboard();});
$('#logoutBtn').addEventListener('click',async()=>{await backend.logout();state.user=null;state.project=null;if(!isFirebaseConfigured)showView('authView');});
$('#newProjectBtn').addEventListener('click',openProjectDialog);$('#closeProjectDialog').addEventListener('click',closeProjectDialog);$('#cancelProjectBtn').addEventListener('click',closeProjectDialog);
$('#generateClientPasswordBtn').addEventListener('click',()=>{refreshClientPassword();toast('Senha padrão aplicada.');});
$('#closeClientAccessDialog').addEventListener('click',continueToCreatedProject);
$('#continueToProjectBtn').addEventListener('click',continueToCreatedProject);
$('#openFirebaseUsersBtn').addEventListener('click',()=>window.open('https://console.firebase.google.com/project/l-engenharia---diario-de-obra/authentication/users','_blank','noopener'));
$('#copyClientAccessBtn').addEventListener('click',async()=>{const email=$('#createdClientEmail').value;const password=$('#createdClientPassword').value;const site=location.origin+location.pathname;const text=`Diário de Obra – L Engenharia\nE-mail: ${email}\nSenha inicial: ${password}\nAcesso: ${site}`;try{await navigator.clipboard.writeText(text);$('#clientAccessMessage').textContent='Acesso copiado. Agora cadastre este usuário no Firebase.';}catch{ $('#clientAccessMessage').textContent='Não foi possível copiar automaticamente. Selecione o e-mail e a senha acima.'; }});
$('#projectForm').addEventListener('submit',async(e)=>{
  e.preventDefault();
  const clientEmail=$('#projectClientEmailInput').value.trim().toLowerCase();
  const initialPassword=$('#projectClientPasswordInput').value.trim()||DEFAULT_CLIENT_PASSWORD;
  const data={name:$('#projectNameInput').value.trim(),client:$('#projectClientInput').value.trim(),clientEmail,address:$('#projectAddressInput').value.trim(),engineer:$('#projectEngineerInput').value.trim(),crea:$('#projectCreaInput').value.trim(),startDate:$('#projectStartInput').value,status:'Em andamento',conclusion:'',lastProgress:0};
  try{
    const p=await backend.createProject(data);state.projects.unshift(p);renderProjects();closeProjectDialog();toast('Obra criada.');
    if(clientEmail) showClientAccessDialog(clientEmail,initialPassword,p.id); else await openProject(p.id,'new-entry');
  }catch(err){$('#projectMessage').textContent=err.message||'Não foi possível criar a obra.';}
});
$('#backBtn').addEventListener('click',openDashboard);$$('.tab').forEach(b=>b.addEventListener('click',()=>setTab(b.dataset.tab)));
$('#timelineAddBtn').addEventListener('click',()=>{ if(!isOwner()) return; resetEntryForm(); setTab('new-entry'); setTimeout(()=>$$('.service-row input')[0]?.focus(),80); });
$('#backToDiaryBtn').addEventListener('click',()=>setTab('timeline'));
$('#addServiceBtn').addEventListener('click',()=>{addServiceRow();$$('.service-row input').at(-1).focus();});
$('#entryProgress').addEventListener('input',(e)=>$('#entryProgressValue').textContent=e.target.value+'%');
$('#entryPhotos').addEventListener('change',(e)=>previewFiles(e.target.files));
$('#entryForm').addEventListener('submit',async(e)=>{e.preventDefault();const services=$$('.service-row input').map(x=>x.value.trim()).filter(Boolean);if(!services.length){$('#entryMessage').textContent='Adicione pelo menos um serviço realizado.';return;}const btn=$('#publishEntryBtn');btn.disabled=true;btn.textContent='Publicando...';try{await backend.addEntry(state.project.id,{date:$('#entryDate').value,services,notes:$('#entryNotes').value.trim(),progress:Number($('#entryProgress').value)},state.pendingPhotos);state.entries=await backend.listEntries(state.project.id);state.project.lastProgress=state.entries.at(-1)?.progress||0;if(isOwner())state.project=await backend.updateProject(state.project.id,{lastProgress:state.project.lastProgress});renderTimeline();renderProjectHeader();renderReport();resetEntryForm();setTab('timeline');toast('Atualização publicada.');}catch(err){$('#entryMessage').textContent=err.message||'Não foi possível publicar.';}finally{btn.disabled=false;btn.textContent='Publicar atualização';}});
$('#settingsForm').addEventListener('submit',async(e)=>{e.preventDefault();const data={name:$('#settingsName').value.trim(),client:$('#settingsClient').value.trim(),clientEmail:$('#settingsClientEmail').value.trim().toLowerCase(),address:$('#settingsAddress').value.trim(),engineer:$('#settingsEngineer').value.trim(),crea:$('#settingsCrea').value.trim(),startDate:$('#settingsStartDate').value,status:$('#settingsStatus').value};try{state.project=await backend.updateProject(state.project.id,data);state.projects=state.projects.map(p=>p.id===state.project.id?state.project:p);renderProjectHeader();renderReport();$('#settingsMessage').textContent='Dados salvos.';toast('Dados da obra atualizados.');}catch(err){$('#settingsMessage').textContent=err.message||'Não foi possível salvar.';}});
$('#saveConclusionBtn').addEventListener('click',async()=>{try{const conclusion=$('#projectConclusion').value.trim();state.project=await backend.updateProject(state.project.id,{conclusion});renderReport();toast('Conclusão salva.');}catch(err){toast('Não foi possível salvar a conclusão.');}});
$('#printReportBtn').addEventListener('click',()=>{renderReport();setTimeout(()=>window.print(),120);});
$('#deleteProjectBtn').addEventListener('click',async()=>{if(!confirm('Excluir esta obra e todos os registros? Esta ação não pode ser desfeita.'))return;await backend.deleteProject(state.project.id);state.project=null;await openDashboard();toast('Obra excluída.');});
$('#demoClientToggle').addEventListener('click',()=>{state.demoClientView=!state.demoClientView;$('#demoClientToggle').textContent=state.demoClientView?'Voltar para gestão':'Ver como cliente';applyRole();renderTimeline();setTab('timeline');});

window.addEventListener('beforeinstallprompt',(e)=>{e.preventDefault();state.deferredPrompt=e;$('#installBtn').classList.remove('hidden');});
$('#installBtn').addEventListener('click',async()=>{if(!state.deferredPrompt)return;state.deferredPrompt.prompt();await state.deferredPrompt.userChoice;state.deferredPrompt=null;$('#installBtn').classList.add('hidden');});
if('serviceWorker' in navigator){window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));}

function humanFirebaseError(err){ const code=err?.code||''; if(code.includes('invalid-credential'))return'E-mail ou senha inválidos.';if(code.includes('email-already-in-use'))return'Este e-mail já possui uma conta.';if(code.includes('weak-password'))return'A senha deve ter pelo menos 6 caracteres.';if(code.includes('invalid-email'))return'Informe um e-mail válido.';if(code.includes('admin-restricted-operation'))return'A criação de contas é controlada pela L Engenharia.';if(code.includes('permission-denied'))return'Seu acesso é somente para visualizar as obras vinculadas ao seu e-mail.';return err?.message||'Não foi possível concluir a operação.'; }

$('#entryDate').value=todayISO(); addServiceRow();
initFirebase().catch(err=>{console.error(err);$('#authMessage').textContent='Falha ao iniciar o aplicativo. Verifique a configuração do Firebase.';});
