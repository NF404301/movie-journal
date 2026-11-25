import { createClient } from '@supabase/supabase-js';

const cloud = createClient(SUPABASE_PROJECT_URL, SUPABASE_PUBLIC_KEY);
const table = () => cloud.from('watch_entries');
let archiveRevision = null;
let userId;
const gate = document.getElementById('login');
const message = document.getElementById('login-message');

async function reloadEntries() {
  const {data: saved,error: readError} = await cloud.from('journal_archives').select('archive,revision').maybeSingle();
  if (readError) throw readError;
  if (saved) {
    archiveRevision = saved.revision;
    catalog=readCatalog(saved.archive);
    return JournalArchive.unpack(saved.archive);
  }
  catalog=readCatalog();
  const rows = [];
  for (let start = 0; ; start += 500) {
    const { data, error } = await table().select('id,record,revision')
      .order('id').range(start, start + 499);
    if (error) throw error;
    rows.push(...data);
    if (data.length < 500) break;
  }
  return rows.map(row => row.record);
}
window.journalCloud = {
  async write(rows,nextCatalog=catalog) {
    const archive = {...JournalArchive.pack(rows),...nextCatalog};
    const revision = crypto.randomUUID();
    const table = cloud.from('journal_archives');
    const operation = archiveRevision
      ? table.update({archive,revision}).eq('owner_id',userId).eq('revision',archiveRevision)
      : table.insert({owner_id:userId, archive, revision});
    const {data,error} = await operation.select('revision').maybeSingle();
    if (error || !data) throw Error('同步失败或其他设备已更新，请复制草稿并刷新后重试。');
    archiveRevision = revision;
  }
};

async function enter() {
  const { data, error } = await cloud.auth.getSession();
  if (error || !data.session) return;
  userId = data.session.user.id;
  try {
    records = await reloadEntries();
    render();
    document.querySelector('main').inert = false;
    document.querySelector('nav').inert = false;
    gate.close();
    document.getElementById('account-status').textContent = data.session.user.email;
    document.getElementById('import-local').hidden = !legacyEntries.length;
  } catch {
    message.textContent = '无法读取云端手记，请检查网络后刷新。';
  }
}

const legacyEntries = [...records];
const legacyCatalog=catalog;
catalog=readCatalog();
records = [];
render();
document.getElementById('cloud-account').hidden = false;
document.getElementById('local-notice').hidden = true;
document.getElementById('storage-caption').textContent = '私人观影日记 · 云端保存';
gate.addEventListener('cancel', event => event.preventDefault());
gate.showModal();
gate.querySelector('form').onsubmit = async event => {
  event.preventDefault();
  const { email, password } = event.currentTarget.elements;
  const { error } = await cloud.auth.signInWithPassword({ email: email.value.trim(), password: password.value });
  password.value = '';
  if (error) message.textContent = '登录失败，请检查邮箱、密码和网络。';
  else await enter();
};
cloud.auth.onAuthStateChange((event, session) => {
  if (userId && (event === 'SIGNED_OUT' || (session && session.user.id !== userId))) location.reload();
});
document.getElementById('logout').onclick = async () => {
  const { error } = await cloud.auth.signOut({ scope: 'local' });
  if (error) toast('退出失败，请重试');
};
document.getElementById('import-local').onclick = async event => {
  const button = event.currentTarget;
  if (!confirm('把本浏览器的 ' + legacyEntries.length + ' 条手记导入当前账号？已有记录将跳过。')) return;
  button.disabled = true;
  try {
    const known = new Set(records.map(r => r.id));
    const next = [...records, ...legacyEntries.filter(r => !known.has(r.id))];
    const combined=mergeCatalog(legacyCatalog);
    await window.journalCloud.write(next,combined);
    catalog=combined;
    records = next;
    render();
    button.hidden = true;
    document.getElementById('settings').close();
    toast('导入完成，本地原件已保留');
  } catch { toast('导入未完成，可以再次导入'); }
  finally { button.disabled = false; }
};
enter();
