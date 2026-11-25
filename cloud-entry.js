import { createClient } from '@supabase/supabase-js';

const cloud = createClient(SUPABASE_PROJECT_URL, SUPABASE_PUBLIC_KEY);
const table = () => cloud.from('watch_entries');
const revisions = new Map();
let userId;
const gate = document.getElementById('login');
const message = document.getElementById('login-message');

async function reloadEntries() {
  const rows = [];
  for (let start = 0; ; start += 500) {
    const { data, error } = await table().select('id,record,revision')
      .order('id').range(start, start + 499);
    if (error) throw error;
    rows.push(...data);
    if (data.length < 500) break;
  }
  revisions.clear();
  rows.forEach(row => revisions.set(row.id, row.revision));
  return rows.map(row => row.record);
}

window.journalCloud = {
  async save(record, previousId) {
    const revision = crypto.randomUUID();
    const operation = previousId
      ? table().update({ record, revision }).eq('id', previousId).eq('revision', revisions.get(previousId))
      : table().insert({ id: record.id, record, revision });
    const { data, error } = await operation.select('id').maybeSingle();
    if (error || !data) throw new Error('保存失败，请备份正在编辑的文字并刷新后重试。');
    revisions.set(record.id, revision);
  },
  async remove(id) {
    const { data, error } = await table().delete().eq('id', id)
      .eq('revision', revisions.get(id)).select('id').maybeSingle();
    if (error || !data) throw new Error('删除失败，请刷新后重试。');
    revisions.delete(id);
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
    for (let i = 0; i < legacyEntries.length; i += 100) {
      const batch = legacyEntries.slice(i, i + 100).map(record => ({ owner_id: userId, id: record.id, record }));
      const { error } = await table().upsert(batch, { onConflict: 'owner_id,id', ignoreDuplicates: true });
      if (error) throw error;
    }
    records = await reloadEntries();
    render();
    button.hidden = true;
    document.getElementById('settings').close();
    toast('导入完成，本地原件已保留');
  } catch { toast('导入未完成，可以再次导入'); }
  finally { button.disabled = false; }
};
enter();
