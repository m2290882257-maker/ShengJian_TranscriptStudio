const $=id=>document.getElementById(id);
let config, file, original='', history=[], working=false, chatting=false, objectUrl, activeJob=null;
let timingJob=null, originalTimingJob=null, timingFile=null;
function formatTime(seconds){const n=Math.max(0,Math.round(seconds));return [Math.floor(n/3600),Math.floor(n/60)%60,n%60].map(v=>String(v).padStart(2,'0')).join(':');}
function renderTiming(job){
  timingJob=job;$('timingPanel').hidden=!job?.segments?.length;if($('timingPanel').hidden)return;
  const segments=job.segments, processed=segments.filter(s=>['done','empty'].includes(s.status));
  const covered=processed.reduce((n,s)=>n+s.end-s.start,0), empty=segments.filter(s=>s.status==='empty').length;
  $('timingSummary').textContent=`录音总时长 ${formatTime(job.duration)} · 已处理 ${job.completed}/${job.total} 段 · 处理覆盖 ${job.duration?Math.min(100,Math.round(covered/job.duration*100)):0}%${empty?' · 空结果 '+empty+' 段':''}`;
  const labels={done:'已返回文字',empty:'空结果 · 需复核',processing:'转写中',failed:'失败',pending:'未处理'};
  $('timingSegments').replaceChildren();
  for(const segment of segments){
    const button=node('button',`${formatTime(segment.start)} – ${formatTime(segment.end)} · ${labels[segment.status]}`,'timing-segment '+segment.status);button.type='button';
    button.title='定位到本段录音起点';button.disabled=timingFile!==file||!objectUrl;
    button.onclick=()=>{if(!Number.isFinite($('player').duration)){toast('浏览器尚不能定位这份音频，请等待加载或用外部播放器对照时间。');return;}$('player').currentTime=segment.start;toast('已定位到 '+formatTime(segment.start)+'，点击播放器播放。');};
    $('timingSegments').append(button);
  }
  $('timingNote').textContent=(job.audioCoverageComplete?'音频切段已覆盖开头至结尾。':'注意：音频切段存在覆盖差异，需核对原录音。')+' 时间范围约为音频分段边界，不是逐句对齐；编辑文字不改变此任务统计。';
}
const providerSettings={};
// Prices are transcribed from the user's screenshots, not a live price feed.
const modelCatalog={
  siliconflow:{
    asr:[{id:'XingChenAGI/XingChenASR-V3.2-Ultra',description:'截图价格：¥ 0.000000 / 千字符（UTF-8）',price:{kind:'free',input:'0.000000',metric:'输入 UTF-8 字节',unit:'人民币 / 千字符（UTF-8）'}}],
    chat:[
      {id:'XingChenAGI/Xing4.0-29B',description:'截图价格：输入 / 输出免费',price:{kind:'free',input:'0.000000',output:'0.000000'}},
      {id:'deepseek-ai/DeepSeek-V4.1-Flash',description:'截图价格：按时段计费',price:{kind:'tiered',rows:[
        {time:'02:00–08:00',cached:'0.000020',input:'0.001000',output:'0.004000'},
        {time:'00:00–02:00 / 08:00–24:00',cached:'0.000040',input:'0.002000',output:'0.008000'}
      ]}}
    ]
  },
  openai:{asr:[{id:'gpt-transcribe'},{id:'gpt-4o-transcribe'},{id:'gpt-4o-mini-transcribe'}],chat:[{id:'gpt-4.1-mini'}]}
};
let storedModels={};
try{const saved=JSON.parse(localStorage.getItem('transcript-models-v1')||'{}');if(saved && typeof saved==='object' && !Array.isArray(saved))storedModels=saved;}catch{}
const modelPickers={};
function modelState(provider){
  let saved=storedModels[provider];
  if(!saved||typeof saved!=='object'||Array.isArray(saved))saved=storedModels[provider]={};
  return saved;
}
function persistModels(){try{localStorage.setItem('transcript-models-v1',JSON.stringify(storedModels));}catch{}}
function modelList(kind){
  const provider=$('provider').value, saved=modelState(provider), defaults=modelCatalog[provider]?.[kind]||[];
  const custom=Array.isArray(saved[kind+'Custom'])?saved[kind+'Custom'].filter(id=>typeof id==='string'&&id.length<=180):[];
  return [...defaults,...custom.filter(id=>!defaults.some(m=>m.id===id)).map(id=>({id,description:'自定义模型 · 价格待补充'}))];
}
function node(tag,text,className){const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(className)el.className=className;return el;}
function renderModelDetails(kind){
  const id=modelPickers[kind].selected, model=modelList(kind).find(m=>m.id===id), panel=$(kind+'Details');
  panel.replaceChildren();
  const top=node('div',undefined,'price-heading');top.append(node('span',kind==='asr'?'语音识别 · 价格详情':'聊天 · 价格详情'),node('span',model?.price?.kind==='free'?'免费':'CNY',model?.price?.kind==='free'?'price-badge free':'price-badge'));
  panel.append(top,node('div',id,'price-model-name'));
  if(!model?.price){panel.append(node('p','价格待补充','price-unknown'),node('p',kind==='asr'?'未提供该语音模型的单价与计费单位，不计作免费。':'该模型尚未录入价格，不计作免费。','hint'));return;}
  const price=model.price;
  panel.append(node('p',price.unit||'人民币 / 1K tokens（1,000 tokens）','price-unit'));
  if(price.kind==='free'){
    const rates=node('div',undefined,'free-rates');
    const entries=price.metric?[[price.metric,price.input]]:[['输入',price.input],['输出',price.output]];
    if(price.metric)rates.classList.add('single-rate');
    for(const [label,value] of entries){const rate=node('div');rate.append(node('span',label),node('strong','¥ '+value));rates.append(rate);}panel.append(rates);
  }else{
    const table=node('table',undefined,'price-table'), head=node('thead'), hr=node('tr');
    for(const title of ['时段','缓存命中','输入','输出'])hr.append(node('th',title));head.append(hr);table.append(head);const body=node('tbody');
    for(const row of price.rows){const tr=node('tr');for(const value of [row.time,row.cached,row.input,row.output])tr.append(node('td',value));body.append(tr);}table.append(body);
    const wrap=node('div',undefined,'price-table-scroll');wrap.append(table);panel.append(wrap,node('p','时段按截图标注，截图未注明时区。','hint'));
  }
  panel.append(node('p','来源：你提供的价格截图 · 录入于 2026-10-19','price-caption'));
}
function createModelPicker(kind){
  const input=$(kind+'Model'), options=$(kind+'Options'), toggle=$(kind+'Toggle'), field=$(kind+'Field');
  const picker={selected:'',results:[],active:-1,open:false};modelPickers[kind]=picker;
  function close(){options.hidden=true;picker.open=false;input.setAttribute('aria-expanded','false');toggle.setAttribute('aria-expanded','false');input.removeAttribute('aria-activedescendant');}
  function choose(id){
    id=id.trim();if(!id){input.value=picker.selected;close();return;}
    if(id.length>180||/[^\x21-\x7e]/.test(id)){toast('模型名称请使用不含空格的英文 API 标识，长度不超过 180 字符。');input.value=picker.selected;close();return;}
    id=modelList(kind).find(m=>m.id.toLowerCase()===id.toLowerCase())?.id||id;
    const saved=modelState($('provider').value);
    if(!modelList(kind).some(m=>m.id===id))saved[kind+'Custom']=[...(Array.isArray(saved[kind+'Custom'])?saved[kind+'Custom']:[]),id];
    saved[kind]=id;persistModels();picker.selected=id;input.value=id;input.title=id;renderModelDetails(kind);close();
  }
  function highlight(index){picker.active=index;[...options.children].forEach((el,i)=>{el.classList.toggle('highlight',i===index);});if(index>=0){input.setAttribute('aria-activedescendant',kind+'Option'+index);options.children[index]?.scrollIntoView({block:'nearest'});}else input.removeAttribute('aria-activedescendant');}
  function open(filter=''){
    Object.entries(modelPickers).forEach(([other,p])=>{if(other!==kind)p.close();});
    const query=filter.trim().toLowerCase();picker.results=modelList(kind).filter(m=>m.id.toLowerCase().includes(query));
    if(query&&!picker.results.length)picker.results.push({id:filter.trim(),description:'按 Enter 或点击，使用并加入列表',custom:true});
    options.replaceChildren();
    picker.results.forEach((model,index)=>{
      const item=node('div',undefined,'model-option');item.id=kind+'Option'+index;item.setAttribute('role','option');item.setAttribute('aria-selected',String(model.id===picker.selected));
      item.append(node('span',model.custom?'＋ '+model.id:model.id),node('small',model.description||'价格待补充'));
      item.onpointerdown=e=>e.preventDefault();item.onclick=()=>{choose(model.id);input.focus();close();};options.append(item);
    });
    options.hidden=false;picker.open=true;picker.active=-1;input.setAttribute('aria-expanded','true');toggle.setAttribute('aria-expanded','true');input.removeAttribute('aria-activedescendant');
  }
  picker.close=close;picker.choose=choose;
  picker.load=id=>{picker.selected=id;input.value=id;input.title=id;close();renderModelDetails(kind);};
  input.onfocus=()=>open();input.oninput=()=>open(input.value);
  input.onkeydown=e=>{
    if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();if(!picker.open)open();const n=picker.results.length;if(n)highlight((picker.active+(e.key==='ArrowDown'?1:picker.active===-1?0:-1)+n)%n);}
    else if(e.key==='Enter'){e.preventDefault();choose(picker.open?(picker.results[Math.max(0,picker.active)]?.id||input.value):input.value);}
    else if(e.key==='Escape'){e.preventDefault();input.value=picker.selected;close();}
    else if(e.key==='Tab'){input.value=picker.selected;close();}
  };
  input.onblur=()=>{if(!field.contains(document.activeElement)){input.value=picker.selected;close();}};
  toggle.onpointerdown=e=>e.preventDefault();toggle.onclick=()=>{if(picker.open)close();else{input.focus();open();}};
  document.addEventListener('pointerdown',e=>{if(!field.contains(e.target))close();});
}
function toast(text){$('toast').textContent=text;$('toast').hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('toast').hidden=true,3500);}
function status(text,error=false){$('status').textContent=text;$('status').classList.toggle('error',error);}
function headers(){return {'x-app-token':config.token,'x-provider':$('provider').value,'x-api-key':$('key').value.trim()};}
async function request(url, options={}) {
  const res=await fetch(url,{...options,headers:{...headers(),...options.headers}});
  if(!res.ok){const data=await res.json().catch(()=>({}));throw new Error(data.error||`请求失败 (${res.status})`);}
  return res;
}
function updateText(){const text=$('transcript').value;$('wordCount').textContent=`${text.length.toLocaleString()} 字`;$('downloadMd').disabled=$('downloadDocx').disabled=!text.trim();$('restore').disabled=!original||working;renderMarkdown(text);}
function renderMarkdown(text){
  // DOM text nodes deliberately avoid interpreting model output as HTML.
  $('preview').replaceChildren();
  for(const line of text.split('\n')){
    const heading=/^(#{1,3})\s+(.+)$/.exec(line), list=/^[-*]\s+(.+)$/.exec(line);
    const el=document.createElement(heading?`h${heading[1].length}`:list?'li':'p');
    el.textContent=heading?heading[2]:list?list[1]:line||'\u00a0';$('preview').append(el);
  }
}
function selectFile(next){
  if(working) return toast('请等待当前转写完成。');
  if(!next)return;if(next.size>1024**3)return toast('文件超过 1 GB，请先压缩。');
  if(!/\.(mp3|mp4|m4a|wav|webm|ogg|flac|aac|mpeg|mpga|mov|mkv|wma|amr|opus)$/i.test(next.name))return toast('请选择支持的音视频格式。');
  file=next;$('fileInfo').hidden=false;$('fileName').textContent=file.name;$('fileSize').textContent=(file.size/1024**2).toFixed(1)+' MB';$('transcribe').disabled=false;
  renderTiming(null);
  if(objectUrl)URL.revokeObjectURL(objectUrl);objectUrl=URL.createObjectURL(file);$('player').src=objectUrl;$('player').hidden=false;status('文件已就绪。浏览器无法播放的格式仍可尝试转写。');
}
function wait(ms){return new Promise(resolve=>setTimeout(resolve,ms));}
function setWorking(value){working=value;$('chunkSeconds').disabled=value;$('transcribe').disabled=value||!file;$('file').disabled=value;$('restore').disabled=value||!original;$('textFile').disabled=value;$('importButton').disabled=value;$('transcript').readOnly=value;}
async function pollJob(id){
  let failures=0;
  for(;;){
    let job;
    try{job=await(await request('/api/jobs/'+id)).json();failures=0;}
    catch(e){if(++failures<5){status('连接暂时中断，正在重试…');await wait(3000);continue;}throw new Error('无法读取任务状态。保留页面后点击“重新连接任务”，不会重复调用转写 API。');}
    status(job.message,job.status==='error');$('progress').value=job.progress;
    renderTiming(job);
    if(job.text){$('transcript').value=job.text;updateText();}
    if(job.status==='done'||job.status==='error'){
      activeJob=null;original=job.text;originalTimingJob=job;
      if(job.status==='error'&&job.text)status(job.message+' 已保留前 '+job.completed+' 段文字，可先下载。',true);
      return;
    }
    await wait(1400);
  }
}
async function startTranscription(){
  if(working)return;
  if(!activeJob && !file)return;
  if(!activeJob && $('transcript').value.trim() && !confirm('开始新转写将替换当前预览文字。请确认已下载需要保留的内容。'))return;
  setWorking(true);$('progress').hidden=false;
  try{
    if(!activeJob){
      status('正在上传到本地服务…');
      const result=await(await request('/api/transcribe',{method:'POST',headers:{'x-filename':encodeURIComponent(file.name),'x-model':modelPickers.asr.selected,'x-chunk-seconds':$('chunkSeconds').value,'Content-Type':'application/octet-stream'},body:file})).json();
      activeJob=result.id;$('transcript').value='';original='';originalTimingJob=null;timingFile=file;renderTiming(null);updateText();
    }
    await pollJob(activeJob);
  }catch(e){status(e.message,true);}
  finally{setWorking(false);$('transcribe').textContent=activeJob?'重新连接任务':'开始转写 ↗';}
}
function addBubble(role,text,canApply=false){
  $('messages').querySelector('.chat-welcome')?.remove();const bubble=document.createElement('div');bubble.className='bubble '+role;
  const label=document.createElement('span');label.className='speaker';label.textContent=role==='user'?'YOU':'ASSISTANT';bubble.append(label,document.createTextNode(text));
  if(canApply){const b=document.createElement('button');b.type='button';b.className='secondary';b.textContent='采用为预览文字';b.onclick=()=>{if(working)return toast('请等待转写完成。');if($('transcript').value.trim()&&!confirm('将用此回复替换预览文字。原始转写可通过“恢复原文”找回。'))return;$('transcript').value=text;renderTiming(null);updateText();toast('已更新预览，可下载。');};bubble.append(b);}
  $('messages').append(bubble);$('messages').scrollTop=$('messages').scrollHeight;return bubble;
}
async function chat(event){
  event?.preventDefault();const message=$('message').value.trim();if(!message||chatting)return;
  if(history.length>=38)return toast('聊天记录较长，请先清空聊天。');
  chatting=true;$('sendChat').disabled=true;$('clearChat').disabled=true;
  addBubble('user',message);const pending=addBubble('assistant','正在思考…');
  try{
    const messages=[...history,{role:'user',content:message}];
    const {text}=await(await request('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:modelPickers.chat.selected,transcript:$('transcript').value,messages})})).json();
    history=[...messages,{role:'assistant',content:text}];pending.remove();addBubble('assistant',text,true);$('message').value='';
  }catch(e){pending.textContent=e.message+' 输入内容已保留，可重新发送。';}
  finally{chatting=false;$('sendChat').disabled=false;$('clearChat').disabled=false;}
}
async function download(format){
  $('downloadMd').disabled=$('downloadDocx').disabled=true;
  try{
    const saved=await(await request('/api/export',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:$('transcript').value,format,filename:file?.name||'转写文稿',saveOnly:true})})).json();
    $('exportStatus').textContent='已保存：'+saved.path;$('exportStatus').classList.remove('error');toast('已保存到 download：'+saved.filename);
  }catch(e){$('exportStatus').textContent='保存失败：'+e.message;$('exportStatus').classList.add('error');toast(e.message);}
  finally{updateText();}
}
function saveProvider(provider){providerSettings[provider]={key:$('key').value,asr:modelPickers.asr.selected,chat:modelPickers.chat.selected};}
function loadProvider(){
  const provider=$('provider').value, defaults=config.providers[provider], saved=providerSettings[provider], stored=modelState(provider);
  $('key').value=saved?.key||'';
  for(const kind of ['asr','chat']){
    const id=saved?.[kind]|| (typeof stored[kind]==='string'?stored[kind]:'') || modelCatalog[provider]?.[kind]?.[0]?.id || defaults[kind];
    modelPickers[kind].load(id);
  }
  $('providerHint').textContent=provider==='siliconflow'?'已预置你指定的 XingChen 语音模型与两个聊天模型。模型价格见下方详情。':'需要独立的 OpenAI API Key 与可用区域，不能填写 ChatGPT 登录信息。';
}
async function init(){
  config=await(await fetch('/api/config')).json();createModelPicker('asr');createModelPicker('chat');loadProvider();let previous=$('provider').value;
  $('provider').onchange=()=>{saveProvider(previous);loadProvider();previous=$('provider').value;};
  $('file').onchange=e=>selectFile(e.target.files[0]);$('dropzone').onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();$('file').click();}};
  for(const event of ['dragenter','dragover'])$('dropzone').addEventListener(event,e=>{e.preventDefault();$('dropzone').classList.add('drag');});
  $('dropzone').ondragleave=()=>$('dropzone').classList.remove('drag');$('dropzone').ondrop=e=>{e.preventDefault();$('dropzone').classList.remove('drag');selectFile(e.dataTransfer.files[0]);};
  $('transcribe').onclick=startTranscription;$('transcript').oninput=updateText;$('downloadMd').onclick=()=>download('md');$('downloadDocx').onclick=()=>download('docx');
  $('restore').onclick=()=>{if(!confirm('恢复原始转写将替换当前编辑内容，是否继续？'))return;$('transcript').value=original;renderTiming(originalTimingJob);updateText();};
  $('copy').onclick=async()=>{try{await navigator.clipboard.writeText($('transcript').value);toast('已复制。');}catch{toast('复制失败，请选择文字后手动复制。');}};
  $('importButton').onclick=()=>$('textFile').click();$('textFile').onchange=async e=>{const f=e.target.files[0];if(!f)return;if(f.size>1024*1024)return toast('文字文件请控制在 1 MB 内。');if($('transcript').value.trim()&&!confirm('导入文字将替换当前预览，是否继续？'))return;$('transcript').value=await f.text();original=$('transcript').value;originalTimingJob=null;renderTiming(null);updateText();};
  $('editTab').onclick=()=>{$('transcript').hidden=false;$('preview').hidden=true;$('editTab').classList.add('active');$('previewTab').classList.remove('active');};
  $('previewTab').onclick=()=>{$('transcript').hidden=true;$('preview').hidden=false;$('previewTab').classList.add('active');$('editTab').classList.remove('active');renderMarkdown($('transcript').value);};
  $('chatForm').onsubmit=chat;$('message').onkeydown=e=>{if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)){e.preventDefault();chat();}};
  $('clearChat').onclick=()=>{history=[];$('messages').replaceChildren();toast('聊天已清空。');};
  document.querySelectorAll('[data-prompt]').forEach(b=>b.onclick=()=>{$('message').value=b.dataset.prompt;$('message').focus();});
  window.addEventListener('beforeunload',e=>{if(working||$('transcript').value.trim()){e.preventDefault();e.returnValue='';}});
}
init().catch(()=>status('本地服务连接失败，请通过 start-app.cmd 启动后重试。',true));
