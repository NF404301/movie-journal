const localPhotos = !document.documentElement.hasAttribute('data-cloud') && !!window.indexedDB;
let photoDatabase, showingEvent, photoVersion=0;
function photoStore(){
  if(!photoDatabase)photoDatabase=new Promise((resolve,reject)=>{
    const req=indexedDB.open('movie-journal-photos',1);
    req.onupgradeneeded=()=>req.result.createObjectStore('events');
    req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
  }).catch(e=>{photoDatabase=null;throw e;});
  return photoDatabase;
}
async function photosFor(id){
  const db=await photoStore();
  return new Promise((resolve,reject)=>{
    const req=db.transaction('events').objectStore('events').get(id);
    req.onsuccess=()=>resolve(req.result||[]);req.onerror=()=>reject(req.error);
  });
}
async function changePhotos(id,fn){
  const db=await photoStore();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction('events','readwrite'), store=tx.objectStore('events'),req=store.get(id);
    let failure;
    req.onsuccess=()=>{try{const rows=fn(req.result||[]);if(rows.length)store.put(rows,id);else store.delete(id);}catch(e){failure=e;tx.abort();}};
    tx.oncomplete=resolve;tx.onabort=()=>reject(failure||tx.error);
  });
}
async function removeEventPhotos(id){if(localPhotos)await changePhotos(id,()=>[]);}
async function compressPhoto(file){
  if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw Error('请选择 JPEG、PNG 或 WebP 图片');
  if(file.size>15*1024*1024)throw Error('单张图片上限 15 MB');
  const image=await createImageBitmap(file);
  try{
    const scale=Math.min(1,2048/Math.max(image.width,image.height));
    const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.width*scale));canvas.height=Math.max(1,Math.round(image.height*scale));
    const ctx=canvas.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,0,0,canvas.width,canvas.height);
    return await new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(Error('图片压缩失败')),'image/jpeg',0.88));
  }finally{image.close();}
}
async function renderAttachments(id){
  showingEvent=id;
  const version=++photoVersion;
  if(!localPhotos)return;
  let panel=$('#event-photos');
  if(!panel){panel=document.createElement('section');panel.id='event-photos';$('#detail-content .detail-actions').before(panel);}
  try{
    const rows=await photosFor(id);
    if(version!==photoVersion || !panel.isConnected)return;
    panel.innerHTML='<h3>照片与票根</h3><small>保存在当前浏览器，完整备份包含图片。</small><label>添加附件<input type="file" multiple accept="image/jpeg,image/png,image/webp"></label><div class="photo-grid"></div><p role="status"></p>';
    const grid=panel.querySelector('.photo-grid'),status=panel.querySelector('[role=status]');
    async function mutate(fn){try{await changePhotos(id,fn);if(showingEvent===id)await renderAttachments(id);}catch(e){status.textContent=e.message;}}
    for(const [index,row] of rows.entries()){
      const figure=document.createElement('figure'),img=document.createElement('img'),url=URL.createObjectURL(row.blob);
      img.onload=img.onerror=()=>URL.revokeObjectURL(url);img.src=url;img.alt=row.caption||row.kind;figure.append(img);
      const kind=document.createElement('select');kind.ariaLabel='附件类别';for(const name of ['照片','票根'])kind.add(new Option(name,name));kind.value=row.kind;
      const caption=document.createElement('input');caption.ariaLabel='附件说明';caption.placeholder='写个说明';caption.maxLength=250;caption.value=row.caption;
      const update=()=>mutate(list=>list.map(p=>p.id===row.id?{...p,kind:kind.value,caption:caption.value}:p));
      figure.append(kind,caption);
      for(const [label,action] of [['保存说明',update],['前移',()=>mutate(list=>{const i=list.findIndex(p=>p.id===row.id);if(i>0)[list[i-1],list[i]]=[list[i],list[i-1]];return list;})],['移除',()=>{if(confirm('移除这张附件？'))mutate(list=>list.filter(p=>p.id!==row.id));}]]){
        const b=document.createElement('button');b.textContent=label;b.disabled=label==='前移' && index===0;b.onclick=action;figure.append(b);
      }
      grid.append(figure);
    }
    panel.querySelector('[type=file]').onchange=async e=>{
      const input=e.target;input.disabled=true;const errors=[];
      for(const file of input.files){try{
        const blob=await compressPhoto(file);
        await changePhotos(id,list=>{if(list.length>=9)throw Error('每场最多 9 张');return [...list,{id:crypto.randomUUID(),kind:'照片',caption:'',blob}];});
      }catch(err){errors.push(file.name+'：'+err.message);}}
      if(showingEvent===id){await renderAttachments(id);const message=$('#event-photos [role=status]');if(message)message.textContent=errors.join('；');}
    };
  }catch{panel.textContent='暂时无法读取本机附件，请检查浏览器存储权限。';}
}
async function archivePhotos(archive){
  if(!localPhotos)return;
  archive.attachments=[];
  for(const v of archive.viewings){
    for(const {blob,...meta} of await photosFor(v.id)){
      const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(blob);});
      archive.attachments.push({...meta,viewing_id:v.id,data});
    }
  }
}
async function restorePhotos(archive,rows){
  if(!archive.attachments?.length)return;
  if(!localPhotos)throw Error('此设备未启用本机附件存储');
  const fresh=new Set(rows.map(r=>r.id)), groups=new Map();
  const valid=new Set(archive.viewings.map(v=>v.id));
  for(const photo of archive.attachments){
    if(!valid.has(photo.viewing_id))throw Error('附件引用无效');
    if(!fresh.has(photo.viewing_id))continue;
    if(typeof photo.data!=='string'||!photo.data.startsWith('data:image/jpeg;base64,')||photo.data.length>22000000)throw Error('附件格式错误');
    const bytes=Uint8Array.from(atob(photo.data.slice(23)),c=>c.charCodeAt(0));
    const blob=new Blob([bytes],{type:'image/jpeg'});
    const list=groups.get(photo.viewing_id)||[];if(list.length>=9)throw Error('每场最多 9 张');
    list.push({id:crypto.randomUUID(),kind:photo.kind==='票根'?'票根':'照片',caption:String(photo.caption||'').slice(0,250),blob});groups.set(photo.viewing_id,list);
  }
  for(const [id,list] of groups)await changePhotos(id,existing=>existing.length?existing:list);
}
