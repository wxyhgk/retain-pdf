019d0a01-3a67-7980-9114-62aa8477bee0

# 保留排版翻译 by wxyhgk

这是项目总导航。  
如果你第一次看这个仓库，建议按下面顺序阅读。

## 文档入口

- [当前 API 文档](doc/API.md)
- [普通用户说明](docs/README.user.md)
- [项目说明](docs/README.project.md)
- [技术栈说明](docs/README.tech-stack.md)
- [快速使用说明](docs/README.quickstart.md)
- [输出结构说明](docs/README.output.md)

## 代码与子模块说明

- [后端脚本说明](backend/scripts/README.md)
- [旧 FastAPI 包装层](backend/Fast_API/README.md)
- [前端说明](frontend/README.md)

## 当前目录结构

- `frontend/`
  浏览器前端、桌面壳、预览实验页面。
- `backend/`
  Rust API、Python 脚本、嵌入式 Python、旧 FastAPI 包装层、历史工作区。
- `docker/`
  Dockerfile、发布脚本、交付用 compose 配置。
- `data/`
  本地运行输出、任务目录、历史样本数据。

## 项目一句话简介

这是一个面向科研论文和技术文档的 PDF 保留排版翻译项目。  
它支持从 OCR JSON 或原始 PDF 出发，经过翻译与排版重建，输出尽量保留原文结构的中文 PDF。
