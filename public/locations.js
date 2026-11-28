let selectedPlaceId = null;
let originalLocation = null;
let cinemaDirectory, directoryRequest, directoryError = false;
let chosenDistrict = '', chosenCity = '';
const cityKey = value => (value || '').trim().replace(/市$/, '').toLocaleLowerCase();

function updateLocationMode() {
  const form = $('#record-form');
  const cinema = form.elements.method.value === '影院';
  (cinema ? $('#cinema-fields') : $('#other-location')).append($('#location-fields'));
  form.elements.place.placeholder = cinema ? '输入影院、商场或区县名称' : '搜索已存地点，或直接填写';
  if (cinema && !cinemaDirectory && !directoryRequest) {
    directoryError = false;
    directoryRequest = fetch('/assets/cinema-directory.json').then(response => {
      if (!response.ok) throw Error();
      return response.json();
    }).then(data => {
      cinemaDirectory = new Map(Object.entries(data).map(([name, rows]) => [cityKey(name), rows]));
      updateCityList();
    }).catch(() => { directoryError = true; }).finally(() => {
      directoryRequest = null;
      renderLocationChoices();
    });
  }
  renderLocationChoices();
}

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
  chosenDistrict = catalog.places.find(p => p.id === selectedPlaceId)?.district || '';
  chosenCity = place.city;
  updateCityList();
  updateLocationMode();
}

function updateCityList() {
  const cities = new Set([
    ...(cinemaDirectory?.keys() || []),
    ...catalog.places.map(p => p.city),
    ...records.filter(r => !r.deleted_at).map(r => r.city),
    '北京', '上海', '广州', '深圳', '杭州', '南京', '苏州', '成都', '重庆',
    '武汉', '西安', '天津', '长沙', '郑州', '合肥', '福州', '厦门',
    '济南', '青岛', '宁波', '无锡', '东莞', '佛山', '昆明', '南宁',
    '贵阳', '南昌', '沈阳', '大连', '哈尔滨', '长春', '石家庄',
    '太原', '海口', '兰州', '乌鲁木齐', '香港', '澳门', '台北', '新加坡'
  ].filter(Boolean));
  $('#city-list').replaceChildren(...[...cities].map(city => new Option(city, city)));
}

function renderLocationChoices() {
  const form = $('#record-form');
  const city = cityKey(form.elements.city.value);
  const cinema = form.elements.method.value === '影院';
  const term = form.elements.place.value.trim().toLocaleLowerCase();
  const matches = locationChoices().filter(place =>
    (!cinema || place.type === '影院') &&
    (!city || cityKey(place.city) === city) &&
    (!term || [place.name, place.city, place.region, place.country].filter(Boolean).join(' ').toLocaleLowerCase().includes(term))
  );
  const container = $('#location-options');
  container.replaceChildren();
  const localCount = matches.length;
  if (cinema && city && cinemaDirectory?.has(city)) {
    const known = new Set(matches.map(p => p.name));
    for (const [name, district] of cinemaDirectory.get(city)) {
      if (!known.has(name) && (name + ' ' + district).toLocaleLowerCase().includes(term))
        matches.push({name, city, district, type:'影院', directory:true});
    }
  }
  for (const place of matches.slice(0, 8)) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'location-choice';
    button.textContent = [place.name, place.city || '城市未填写', place.district, place.region, place.country].filter(Boolean).join(' · ');
    button.onclick = () => {
      selectedPlaceId = place.id || null;
      form.elements.place.value = place.name;
      form.elements.city.value = place.city || '';
      chosenCity = form.elements.city.value;
      chosenDistrict = place.district || '';
      if (place.type === '影院') form.elements.method.value = '影院';
      if (place.type === '影院') updateLocationMode();
      container.replaceChildren();
      $('#location-status').textContent = '已选择，可继续修改城市或名称。';
    };
    container.append(button);
  }
  $('#location-status').textContent = matches.length
    ? (cinema ? '匹配 '+matches.length+' 家影院' : '已保存的地点') + (matches.length > 8 ? '，输入更多文字缩小范围。' : '。')
    : '可以直接填写新地点，保存后下次可搜索选择。';
  if (cinema && !city) $('#location-status').textContent = '先选城市，再按影院名、商场或区县查找。';
  else if (cinema && directoryRequest) $('#location-status').textContent = '正在加载影院目录…';
  else if (cinema && directoryError) $('#location-status').textContent = '影院目录暂时无法加载，可选择历史地点或手填。';
  else if (cinema && matches.length > localCount) $('#location-status').textContent += '目录收录于 2025 年 6 月。';
}

function locationChange(event) {
  const form = $('#record-form');
  if (event?.target === form.elements.city && chosenCity && cityKey(chosenCity) !== cityKey(form.elements.city.value) &&
      (selectedPlaceId || chosenDistrict)) form.elements.place.value = '';
  selectedPlaceId = null;
  chosenDistrict = '';
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
  const exact = catalog.places.filter(p => p.name === name && cityKey(p.city) === cityKey(city) &&
    (!chosenDistrict || !p.district || p.district === chosenDistrict));
  const selected = exact.find(p => p.id === selectedPlaceId) || (exact.length === 1 ? exact[0] : null);
  const fields = {place: name, city, place_id: selected?.id || null,
    region: selected?.region || '', country: selected?.country || ''};
  if (!name || selected) return {fields, catalog};
  // A new name is a separate place until the user chooses or merges an existing one.
  const place = {id: crypto.randomUUID(), name, city, district: chosenDistrict, region: '', country: '',
    type: form.elements.method.value === '影院' ? '影院' : '其他'};
  fields.place_id = place.id;
  return {fields, catalog: {...catalog, places: [...catalog.places, place]}};
}
