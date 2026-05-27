# LLM-Project

AI-powered form builder using a React frontend, an Express backend, and a local Qwen model through Ollama.

## Folder structure

```text
/
├── frontend/
│   ├── index.html
│   ├── package.json
│   ├── postcss.config.js
│   ├── tailwind.config.js
│   ├── vite.config.js
│   └── src/
│       ├── main.jsx
│       ├── App.jsx
│       ├── components/
│       │   ├── PromptPanel.jsx
│       │   ├── CodeEditor.jsx
│       │   ├── LivePreview.jsx
│       │   └── Toolbar.jsx
│       ├── services/
│       │   └── formApi.js
│       └── utils/
│           ├── extractCode.js
│           └── projectExporter.js
├── backend/
│   ├── package.json
│   ├── server.js
│   ├── prompts.js
│   └── ollamaClient.js
├── pipeline.md
├── pipeline_modified_local_qwen.md
├── requirement.txt
└── README.md
```

## Local setup

Install and start the local model:

```bash
ollama pull qwen2.5-coder:14b
ollama serve
```

Run the backend:

```bash
cd backend
npm install
npm run dev
```

Run the frontend:

```bash
cd frontend
npm install
npm run dev
```
