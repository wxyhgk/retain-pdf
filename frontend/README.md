# Frontend

当前用户前端主目录，浏览器版、Docker 版、桌面版统一以这里为唯一源码。

当前约定：

- `frontend/` 是前端唯一主源码
- 旧的 `front/` 与 `front_docker/` 已删除
- 本地开发、Docker 构建、桌面打包都直接使用这里

当前页面只暴露两项用户配置：

- `MinerU API key`
- `Model API key`

## 构建

先安装一次前端依赖：

```bash
cd /home/wxyhgk/tmp/Code/frontend
npm install
```

然后生成自托管的 Tailwind CSS：

```bash
npm run build:css
```

构建产物会写回 `frontend/styles.css`。

## 运行

如果你要以浏览器模式本地调试，先启动 Rust API：

```bash
cd /home/wxyhgk/tmp/Code/backend/rust_api
/home/wxyhgk/tmp/Code/backend/rust_api/target/debug/rust_api
```

再启动一个静态文件服务：

```bash
cd /home/wxyhgk/tmp/Code/frontend
python -m http.server 8080
```

打开：

```text
http://127.0.0.1:8080
```

浏览器模式下默认后端地址是：

```text
http://127.0.0.1:41000
```

桌面模式下由 Tauri 注入本地 API 地址，不需要手工填写。
