document.addEventListener('change',e=>{
  const v=e.target.value;
  switch(e.target.id){
    case 'report-year': studioYear=v;break;
    case 'entity-type': entityType=v;entityId='';break;
    case 'entity-id': entityId=v;break;
    case 'link-event': eventId=v;break;
    case 'collection-id': collectionId=v;break;
    case 'cal-month': if(!/^\d{4}-\d{2}$/.test(v))return;studioMonth=v;dayFilter='';break;
    case 'add-work': memoryChoices();return;
    case 'share-titles': $('#png-result').replaceChildren();return;
    default:return;
  }
  renderStudio();
});
document.addEventListener('click',async e=>{
  const b=e.target.closest('button');if(!b)return;
  if(b.id==='open-studio'){renderStudio();$('#studio').showModal();return;}
  if(!b.closest('#studio'))return;
  if(b.dataset.tab){studioTab=b.dataset.tab;renderStudio();return;}
  if(b.dataset.day){dayFilter=b.dataset.day;renderStudio();return;}
  if(b.dataset.city){cityFilter=b.dataset.city;renderStudio();return;}
  if(b.id==='preview-png'){shareImage();return;}
  const val=id=>$('#'+id).value.trim();
  if(b.id==='save-links'){
    const id=val('link-event'),mode=$('#link-mode')?.value,ids=[...document.querySelectorAll('[name=link-person]:checked')].map(x=>x.value);
    if(mode==='与人同行' && !ids.length){toast('请选择同行人');return;}
    const fields=entityType==='places'?{place_id:val('link-place')||null}:{companion_mode:mode,person_ids:mode==='与人同行'?ids:[]};
    await studioSave(records.map(r=>r.id===id?{...r,...fields}:r),catalog);return;
  }
  const next=structuredClone(catalog),list=next[entityType];
  if(b.id==='save-entity'){
    const name=val('entity-name');if(!name){toast('请填写名称');return;}
    if(list.some(x=>x.name===name&&x.id!==entityId)&&!confirm('已有同名档案，仍单独保存？'))return;
    let item=list.find(x=>x.id===entityId);if(!item){item={id:crypto.randomUUID()};list.push(item);}
    item.name=name;if(entityType==='places')Object.assign(item,{city:val('place-city'),region:val('place-region'),country:val('place-country'),type:val('place-type')});
    entityId=item.id;await studioSave(records,next);return;
  }
  if(['remove-entity','merge-entity'].includes(b.id)){
    const from=entityId,to=b.id==='merge-entity'?val('merge-target'):null;
    if(!from || from===to||!confirm('将更新 '+records.filter(r=>linked(r,from)).length+' 场观影的关联，并移除这份档案。原文和观影记录将保留。继续？'))return;
    const rows=records.map(r=>{
      if(!linked(r,from))return r;
      if(entityType==='places')return {...r,place_id:to};
      const ids=[...new Set(personLinks(r).map(id=>id===from?to:id).filter(Boolean))];
      return {...r,person_ids:ids,companion_mode:ids.length?'与人同行':'待整理'};
    });
    next[entityType]=list.filter(x=>x.id!==from);entityId=to||'';await studioSave(rows,next);return;
  }
  let collection=next.collections.find(c=>c.id===collectionId);
  if(b.id==='save-collection'){
    const name=val('collection-name');if(!name){toast('请填写片单名称');return;}
    if(!collection){collection={id:crypto.randomUUID(),items:[]};next.collections.push(collection);}
    Object.assign(collection,{name,description:val('collection-desc')});collectionId=collection.id;
  }else if(!collection)return;
  else if(b.id==='remove-collection'){if(!confirm('删除此电影集？观影记录将保留。'))return;next.collections=next.collections.filter(c=>c.id!==collectionId);collectionId='';}
  else if(b.id==='insert-work'){
    const id=val('add-work'),event=val('add-memory'),rows=activeEvents().filter(r=>JournalArchive.movieId(r)===id);
    if(!rows.length||collection.items.some(i=>i.movie===id)||(event&&!rows.some(r=>r.id===event)))return;
    collection.items.push({movie:id,title:rows[0].title,event:event||null,reason:val('collection-reason')});
  }else if(b.dataset.itemAction){
    const i=Number(b.dataset.item),item=collection.items[i];if(!item)return;
    if(b.dataset.itemAction==='前移' && i>0)[collection.items[i-1],collection.items[i]]=[item,collection.items[i-1]];
    if(b.dataset.itemAction==='设为封面')collection.cover=item.movie;
    if(b.dataset.itemAction==='移出'){collection.items.splice(i,1);if(collection.cover===item.movie)collection.cover=null;}
  }else return;
  await studioSave(records,next);
});
