let selectedPlaceId = null;
let originalLocation = null;

function viewingLocation(record) {
  const linked = catalog.places.find(place => place.id === record.place_id);
  return {
    name: linked?.name || record.place || '',
    city: linked?.city || record.city || '',
    region: linked?.region || record.region || '',
    country: linked?.country || record.country || ''
  };
}

function locationText(record) {
  const place = viewingLocation(record);
  return [place.city, place.name].filter(Boolean).join(' · ');
}

function locationChoices() {
  const choices = catalog.places.map(place => ({...place, saved: true}));
  const known = new Set(choices.map(place => JSON.stringify([place.name, place.city || ''])));
  for (const record of records.filter(row => !row.deleted_at)) {
    const place = viewingLocation(record);
    const identity = JSON.stringify([place.name, place.city]);
    if (!place.name || known.has(identity)) continue;
    known.add(identity);
    choices.push({...place, type: record.method === '影院' ? '影院' : '其他'});
  }
  return choices;
}

function prepareLocation(record) {
  const form = $('#record-form');
  const place = record ? viewingLocation(record) : {name: '', city: ''};
  selectedPlaceId = record?.place_id || null;
  originalLocation = record ? {...place, record} : null;
  form.elements.place.value = place.name;
  form.elements.city.value = place.city;
  const cities = new Set([
    ...catalog.places.map(p => p.city),
    ...records.filter(r => !r.deleted_at).map(r => r.city),
    '北京', '上海', '广州', '深圳', '杭州', '南京', '苏州', '成都', '重庆',
    '武汉', '西安', '天津', '长沙', '郑州', '合肥', '福州', '厦门',
    '济南', '青岛', '宁波', '无锡', '东莞', '佛山', '昆明', '南宁',
    '贵阳', '南昌', '沈阳', '大连', '哈尔滨', '长春', '石家庄',
    '太原', '海口', '兰州', '乌鲁木齐', '香港', '澳门', '台北', '新加坡'
  ].filter(Boolean));
  $('#city-list').replaceChildren(...[...cities].map(city => new Option(city, city)));
  renderLocationChoices();
}

function renderLocationChoices() {
  const form = $('#record-form');
  const city = form.elements.city.value.trim().toLocaleLowerCase();
  const term = form.elements.place.value.trim().toLocaleLowerCase();
  const matches = locationChoices().filter(place =>
    (!city || (place.city || '').toLocaleLowerCase().includes(city)) &&
    (!term || [place.name, place.city, place.region, place.country].filter(Boolean).join(' ').toLocaleLowerCase().includes(term))
  );
  const container = $('#location-options');
  container.replaceChildren();
  for (const place of matches.slice(0, 8)) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'location-choice';
    button.textContent = [place.name, place.city || '城市未填写', place.region, place.country].filter(Boolean).join(' · ');
    button.onclick = () => {
      selectedPlaceId = place.id || null;
      form.elements.place.value = place.name;
      form.elements.city.value = place.city || '';
      if (place.type === '影院') form.elements.method.value = '影院';
      container.replaceChildren();
      $('#location-status').textContent = '已选择，可继续修改城市或名称。';
    };
    container.append(button);
  }
  $('#location-status').textContent = matches.length
    ? '从已保存地点与历史记录中选择' + (matches.length > 8 ? '，输入更多文字缩小范围。' : '。')
    : '可以直接填写新地点，保存后下次可搜索选择。';
}

function locationChange() {
  selectedPlaceId = null;
  renderLocationChoices();
}

function locationForSave() {
  const form = $('#record-form');
  const name = form.elements.place.value.trim();
  const city = form.elements.city.value.trim();
  const previous = originalLocation;
  // Retain historical free text and association when only another field was edited.
  if (previous && name === previous.name && city === previous.city &&
      selectedPlaceId === (previous.record.place_id || null)) {
    return {fields: {place: previous.record.place, place_id: previous.record.place_id,
      city: previous.record.city, region: previous.record.region, country: previous.record.country}, catalog};
  }
  const selected = catalog.places.find(p => p.id === selectedPlaceId && p.name === name && (p.city || '') === city);
  const fields = {place: name, city, place_id: selected?.id || null,
    region: selected?.region || '', country: selected?.country || ''};
  if (!name || selected) return {fields, catalog};
  // A new name is a separate place until the user chooses or merges an existing one.
  const place = {id: crypto.randomUUID(), name, city, region: '', country: '',
    type: form.elements.method.value === '影院' ? '影院' : '其他'};
  fields.place_id = place.id;
  return {fields, catalog: {...catalog, places: [...catalog.places, place]}};
}
