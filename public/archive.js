/* Shared by the browser and the migration checks. */
const JournalArchive = (() => {
  const fields = ['title','kind','tmdbId','year','poster','overview','overviewLanguage','originalTitle','genres','runtime','aliases'];
  function movieId(row) {
    if (row.tmdbId) return 'tmdb:' + (row.kind || '电影') + ':' + row.tmdbId;
    return row.movie_id && !row.movie_id.startsWith('tmdb:') ? row.movie_id : 'manual:' + row.id;
  }
  function pack(rows) {
    const movies = new Map();
    const ids = new Set();
    const viewings = rows.map(row => {
      if (!row || typeof row.title !== 'string' || !row.title.trim() || typeof row.date !== 'string' || typeof row.id !== 'string' || !row.id || ids.has(row.id)) throw Error('记录缺少有效字段或 ID 重复');
      if (row.deleted_at != null && typeof row.deleted_at !== 'string') throw Error('无效的删除时间');
      if (row.movie_id != null && typeof row.movie_id !== 'string') throw Error('无效的作品引用');
      ids.add(row.id);
      const id = movieId(row);
      const movie = {id};
      const viewing = {...row, movie_id:id};
      for (const k of fields) {
        if (Object.hasOwn(row,k)) movie[k] = row[k];
        delete viewing[k];
      }
      if (!movies.has(id)) movies.set(id,movie);
      else if (JSON.stringify(movies.get(id)) !== JSON.stringify(movie)) viewing.source_metadata = movie;
      return viewing;
    });
    return {schema_version:2, exported_at:new Date().toISOString(), movies:[...movies.values()], viewings};
  }
  function unpack(data) {
    if (data?.schema_version !== 2) {
      if (data?.schema_version != null && data.schema_version !== 1) throw Error('不支持的备份版本');
      const rows = Array.isArray(data) ? data : data?.records;
      if (!Array.isArray(rows)) throw Error('无法识别备份格式');
      const identified = rows.map((row,index) => {
        if (!row || row.id) return row;
        let hash = 2166136261;
        for (const ch of JSON.stringify(row)) hash = Math.imul(hash ^ ch.codePointAt(0),16777619);
        return {...row,id:'legacy:' + index + ':' + (hash >>> 0).toString(16)};
      });
      pack(identified);
      return identified;
    }
    const movies = new Map(data.movies.map(m => [m.id,m]));
    if (movies.size !== data.movies.length) throw Error('作品 ID 重复');
    const rows = data.viewings.map(({source_metadata,...event}) => {
      if (!movies.has(event.movie_id)) throw Error('观影记录缺少关联作品');
      return {...movies.get(event.movie_id), ...source_metadata, ...event};
    });
    pack(rows);
    return rows;
  }
  return {pack,unpack,movieId};
})();
if (typeof module !== 'undefined') module.exports = JournalArchive;
