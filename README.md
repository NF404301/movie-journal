# 观影手记

本项目按 [MIT 许可证](LICENSE) 开源。

以文字和电影海报记录每一次观影。支持按时间浏览、搜索和筛选回忆，记录同行者、观看方式、地点与感想。电影搜索、简介和海报来自 [TMDB](https://www.themoviedb.org/)；搜不到时可以手动填写片名。

## 在 Vercel 部署

将此仓库导入 Vercel，使用 `Other` 框架预设；静态文件位于 `public/`，电影搜索接口位于 `api/`。在 Vercel 项目的 Environment Variables 中设置 `TMDB_READ_ACCESS_TOKEN`，值使用 TMDB 的 API Read Access Token。令牌只在服务端使用，不要放入 `public/` 或提交到 Git。部署后检查 `/api/movies/search?q=星际穿越` 与页面的电影搜索。

这是个人日记。观影记录目前保存在访问者当前浏览器的 `localStorage` 中，不支持跨设备同步。部署到新域名不会自动迁移旧域名的记录；请先在旧网站的“我的”中导出 JSON 备份。若要限制谁能访问页面，需要在 Vercel 配置部署保护；若要账号和云端同步，需要另加认证与数据库。

运行 `npm test` 检查电影接口的输入验证、错误处理和简介回退。

电影资料与海报来自 TMDB。本产品使用 TMDB API，但未获 TMDB 认可或认证。

