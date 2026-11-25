# 观影手记

本项目按 [MIT 许可证](LICENSE) 开源。

以文字和电影海报记录每一次观影。支持按时间浏览、搜索和筛选回忆，记录同行者、观看方式、地点与感想。电影搜索、简介和海报来自 [TMDB](https://www.themoviedb.org/)；搜不到时可以手动填写片名。

## 在 Vercel 部署

将此仓库导入 Vercel，使用 `Other` 框架预设；静态文件位于 `public/`，电影搜索接口位于 `api/`。在 Vercel 项目的 Environment Variables 中设置 `TMDB_READ_ACCESS_TOKEN`，值使用 TMDB 的 API Read Access Token。令牌只在服务端使用，不要放入 `public/` 或提交到 Git。部署后检查 `/api/movies/search?q=星际穿越` 与页面的电影搜索。

未配置 Supabase 时，记录保存在当前浏览器。在 Supabase 独立项目执行 supabase/migrations/001_watch_entries.sql，关闭公开注册，并为自己创建已确认的邮箱账号。在 Vercel 中成对设置 SUPABASE_URL 和 SUPABASE_PUBLISHABLE_KEY（sb_publishable_ 前缀），再重新部署。使用邮箱和密码登录；换设备后使用同一账号。通过“我的 → 导入本机旧手记”可合并同域名的旧记录，保留本地原件。数据库的行级权限按用户隔离记录。

运行 `npm test` 检查电影接口的输入验证、错误处理和简介回退。

电影资料与海报来自 TMDB。本产品使用 TMDB API，但未获 TMDB 认可或认证。
