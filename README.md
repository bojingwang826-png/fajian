<div align="center">

# 法笺

### 法考主观题智能训练与评测平台

把 Word、PDF 法考资料直接整理成题库，通过结构化采分点完成默写、判分、错题归纳与复习排期。

[![Node.js](https://img.shields.io/badge/Node.js-%E2%89%A520-35675a?logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![Zero Dependencies](https://img.shields.io/badge/runtime_dependencies-0-9a6b2f)](package.json)
[![Tests](https://img.shields.io/badge/tests-7%20passed-35675a)](tests/)
[![Live Demo](https://img.shields.io/badge/live_demo-PocketBay-52738a)](https://app-fxl3.pocketbay.app)

[在线体验](https://app-fxl3.pocketbay.app) · [功能介绍](#核心功能) · [快速开始](#快速开始) · [参与贡献](CONTRIBUTING.md)

</div>

---

## 项目介绍

法考主观题资料通常分散在 Word、PDF 和各类讲义中。手动整理题目耗时，普通关键词判分又很难解释“为什么得分”。法笺将资料导入、题目训练、证据化判分和复习安排连接成一条完整流程：

```mermaid
flowchart LR
    A[导入 Word / PDF] --> B[自动拆分题目与答案]
    B --> C[校对采分点]
    C --> D[默写 / 填空 / 模拟考试]
    D --> E[逐采分点判分]
    E --> F[错题本与复习排期]
    F --> D
```

项目可完全本地运行。未配置模型 API 时使用可复现的结构化判分；配置 OpenAI 兼容接口后，会在固定采分点与分值范围内增加语义复核。

## 核心功能

| 模块 | 能力 |
| --- | --- |
| 资料导入 | 支持 DOCX、PDF、图片、TXT、Markdown 和题库 JSON；按标题层级、专题编号或问答标记自动拆题 |
| 导入校对 | 展示解析预览、原文覆盖率、来源页码、重复题和结构异常；支持编辑、拆分、合并和重复题处理 |
| 多种训练 | 默写、填空、弱点速练与限时模拟考试；支持上传 DOCX/TXT/Markdown 作答文件 |
| 分级提示 | 按“段落主题 → 首字提示 → 关键词”逐级提示，避免直接泄露完整答案 |
| 证据化判分 | 逐采分点展示标准表述、考生原文证据、得分、命中状态与置信度 |
| 错题与复习 | 自动记录失分点，并结合成绩、提示次数和连续掌握情况生成复习日期 |
| 学习统计 | 展示得分趋势、各科平均分、重复练习提升和高频失分点 |
| 数据管理 | 支持题库批量操作、备份导入导出、本地文件存储与浏览器存储模式 |

## 产品设计特点

### 1. 判分过程可解释

系统不会只返回一个总分。每个采分点都有固定满分、标准表述和从考生答案中找到的对应证据；存在关键限定词冲突或证据不足时，会降低得分并提示人工复核。

### 2. 本地规则与模型复核分层

- **未配置 API：** 使用本地结构化规则，结果稳定、可复现、无需联网。
- **已配置 API：** 模型负责语义复核，本地规则负责校验证据、限制异常分数并保留完整判分依据。
- **接口失败：** 自动回退到本地判分，不中断作答存档和复习排期。

### 3. 导入结果先校对再入库

Word 和 PDF 的排版差异很大，因此导入流程不会直接写入题库。用户可以先查看识别数量、结构质量、重复题和 PDF 来源页码，再决定跳过、覆盖或保留重复内容。

## 在线演示

访问：[https://app-fxl3.pocketbay.app](https://app-fxl3.pocketbay.app)

演示环境内置 6 道示范题。公开演示数据可能被其他访客修改或重置，请勿录入真实个人信息、未公开资料或生产环境 API Key。需要保存自己的题库时，建议在本地运行。

## 快速开始

### 方式一：直接打开

双击 `public/index.html` 即可使用，无需安装依赖。

- 数据保存在当前浏览器的 `localStorage`。
- 清除浏览器数据或更换浏览器前，请先在“设置”中导出备份。
- 部分 PDF 解析和模型请求可能受到浏览器跨域限制。

### 方式二：Node.js 本地服务

推荐使用 Node.js 20 或更高版本。

```bash
git clone https://github.com/bojingwang826-png/fajian.git
cd fajian
npm start
```

打开 [http://localhost:3737](http://localhost:3737)。Windows 用户也可以直接双击 `启动.bat`。

本地服务模式下：

- 题库保存在 `data/db.json`，更新时自动生成 `data/db.backup.json`。
- 浏览器通过同源 `/api/llm` 请求模型接口，避免常见的 CORS 问题。
- `data/` 已加入 `.gitignore`，不会被提交到 GitHub。

可用环境变量：

| 变量 | 默认值 | 用途 |
| --- | --- | --- |
| `PORT` | `3737` | HTTP 服务端口 |
| `HOST` | `0.0.0.0` | 监听地址 |
| `DATA_DIR` | `./data` | 本地数据目录 |
| `POCKETBAY_DATA_DIR` | — | PocketBay 持久卷目录，优先于 `DATA_DIR` |
| `NO_OPEN_BROWSER` | — | 设为 `1` 时启动后不自动打开浏览器 |

## AI 接口配置

进入“设置 → AI 自动判分与识别”，填写 OpenAI Chat Completions 兼容接口：

1. 选择服务商或填写自定义接口地址；
2. 填写模型名称和 API Key；
3. 保存并点击“测试连接”。

服务端会代转模型请求。API Key 保存在本地 `data/db.json` 中，请勿提交或分享该文件。题目识别和判分会消耗对应服务商的调用额度。

未配置 API 仍可使用题库、练习、结构化判分、错题本、复习计划和统计功能；扫描图片 OCR 和复杂语义复核需要模型能力。

## 支持的导入格式

### 推荐标记格式

```text
【科目】刑法
【题目】正当防卫的成立条件
【标准答案】
一、起因条件：存在现实的不法侵害；
二、时间条件：不法侵害正在进行；
三、对象条件：针对不法侵害人本人。

------------

【科目】民法
【题目】善意取得的构成要件
【标准答案】
一、受让时为善意；
二、以合理价格受让；
三、已经完成登记或交付。
```

同时支持：

- Word 标题样式和“专题 1 ……”结构；
- `问：…… / 答：……` 成对结构；
- 文字型 PDF 的坐标分行与标题恢复；
- 扫描 PDF 和图片的视觉模型 OCR；
- 普通文本兜底导入；
- 结构化题库 JSON。

老版 `.doc` 请先使用 Word 或 WPS 另存为 `.docx`。

## 技术架构

项目保持零运行时依赖，便于理解、迁移和部署。

| 层级 | 实现 |
| --- | --- |
| 前端 | 原生 HTML、CSS、JavaScript，Hash Router |
| 文档解析 | 自研 DOCX XML 解析、PDF.js、可选视觉模型 OCR |
| 判分 | 固定 Rubric、本地文本相似度、冲突词校验、可选 LLM 语义复核 |
| 图表 | Canvas 原生绘制 |
| 服务端 | Node.js 原生 `http` 模块 |
| 数据 | JSON 文件持久化；无服务器时使用 `localStorage` |
| 部署 | PocketBay Node Runtime |

### 项目结构

```text
fajian/
├─ public/
│  ├─ css/style.css          # 视觉系统与响应式布局
│  ├─ js/
│  │  ├─ views/              # 欢迎页、题库、练习、考试等页面
│  │  ├─ documents.js        # PDF 与图片读取
│  │  ├─ docx.js             # Word 文档解析
│  │  ├─ grader.js           # 结构化判分引擎
│  │  ├─ rubric.js           # 采分点生成与质量检查
│  │  ├─ store.js            # 数据访问与学习状态
│  │  └─ llm.js              # 模型接口层
│  └─ index.html
├─ tests/                    # Node.js 自动测试与 DOCX 样本
├─ server.js                 # 静态资源、数据 API、模型转发
├─ seed.js                   # 服务端初始示范题
├─ package.json
└─ README.md
```

## 测试

```bash
npm test
```

当前测试覆盖：

- DOCX 标题样式、继承样式和多题切分；
- PDF 坐标分行、标题恢复和来源页码；
- 多种导入格式与判分回复解析；
- 逐采分点判分、证据校验和冲突词处理；
- Rubric 生成、错题记录和复习排期；
- 本地服务、损坏数据恢复与浏览器存储回退。

## 部署

项目包含标准 `package.json`，可部署到支持 Node.js 的平台：

```bash
npm start
```

运行环境需要注入 `PORT`，并提供可写的数据目录。PocketBay 会自动设置 `POCKETBAY_DATA_DIR=/data` 用于持久化。

部署时请排除：

- `data/` 与数据库备份；
- `.env`、私钥和 API Key；
- `node_modules/`、缓存、日志和本地工具目录。

## 数据安全

- API Key 只用于调用用户配置的模型接口，不会包含在设置页导出的备份中。
- `data/`、`.env*`、证书、私钥和部署包均已加入 `.gitignore`。
- 模型判分仅用于学习辅助，不能替代官方评分、教师判断或法律意见。
- 上传第三方资料前，请确认你拥有必要的使用和处理权限。

安全问题请参考 [SECURITY.md](SECURITY.md)。

## 参与贡献

欢迎提交问题和改进建议。开始开发前请阅读 [CONTRIBUTING.md](CONTRIBUTING.md)。

常见贡献方向：

- 更多 Word/PDF 排版样本与解析规则；
- 更可靠的法律限定词、同义表达和冲突词校验；
- 无障碍、移动端和键盘操作优化；
- 更细致的复习算法与学习统计；
- 不同模型服务商的兼容性改进。

## 许可证

当前仓库暂未附加开源许可证。除 GitHub 服务条款允许的浏览和派生操作外，未经仓库所有者明确许可，不得复制、分发或用于商业用途。如需引用、二次开发或商用，请先联系仓库所有者。

---

<div align="center">

**法笺 · 让每次落笔都有依据**

</div>

