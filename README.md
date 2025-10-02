# Conciliação Bancária - Frontend com Streaming

Frontend Node.js com WebSocket para exibição em tempo real da conciliação bancária.

## 📁 Estrutura

```
conciliacao_bank/
├── package.json          # Dependências Node.js
├── server.js            # Servidor Express + WebSocket
├── public/              # Arquivos estáticos
│   └── index.html       # Interface do usuário
└── .gitignore
```

## 🚀 Como funciona

1. **Frontend (este app)**: Servidor Node.js que:
   - Serve a interface HTML
   - Recebe updates do backend Python via HTTP POST
   - Distribui updates para os clientes via WebSocket

2. **Backend Python**: Envia atualizações de progresso para este servidor

## 📦 Deploy no Render

### Passo 1: Preparar o repositório

```bash
cd conciliacao_bank
npm install
git init
git add .
git commit -m "Initial commit"
```

### Passo 2: Criar repositório no GitHub

Crie um repositório no GitHub e faça push:

```bash
git remote add origin https://github.com/seu-usuario/conciliacao-bank-frontend.git
git branch -M main
git push -u origin main
```

### Passo 3: Deploy no Render

1. Acesse [Render.com](https://render.com) e faça login
2. Clique em **"New +"** → **"Web Service"**
3. Conecte seu repositório GitHub
4. Configure:
   - **Name**: `conciliacao-bank-frontend`
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: `Free`

5. Clique em **"Create Web Service"**

### Passo 4: Configurar variáveis de ambiente (opcional)

Se quiser configurar a porta manualmente:
- Adicione variável `PORT` (Render já configura automaticamente)

### Passo 5: Obter a URL do frontend

Após o deploy, você receberá uma URL tipo:
```
https://conciliacao-bank-frontend.onrender.com
```

### Passo 6: Configurar backend Python no Azure

No backend Python (Azure), configure a URL para enviar updates após deploy do frontend:

```python
FRONTEND_WEBSOCKET_URL = "https://seu-frontend.onrender.com/api/progress-update"
```

**Backend Python atual**: `https://holdprintwebbankreconciliation-test.azurewebsites.net`

## 🔧 Configuração local

### Instalar dependências
```bash
npm install
```

### Rodar localmente
```bash
npm start
```

O servidor estará disponível em `http://localhost:3000`

### Configurar para desenvolvimento local

No arquivo `public/index.html`, ajuste as URLs:

```javascript
const WEBSOCKET_URL = 'http://localhost:3000';
const API_BASE_URL = 'http://localhost:5000'; // Backend Python local
```

## 📡 API Endpoints

### POST /api/progress-update
Recebe updates do backend Python e distribui via WebSocket

**Body:**
```json
{
  "current": 1,
  "total": 100,
  "category": "matched",
  "value": "1000.00",
  "document": "Doc 123"
}
```

### POST /api/reset
Reseta o estado e notifica clientes conectados

### GET /api/status
Retorna status do servidor e clientes conectados

## 🔗 Integração com Backend Python

O backend Python deve fazer POST para este servidor:

```python
import requests

def send_progress_update(data):
    url = "https://seu-frontend.onrender.com/api/progress-update"  # Substituir após deploy
    requests.post(url, json=data)
```

## 📝 Notas importantes

- O Render pode colocar apps gratuitos em "sleep" após inatividade
- O primeiro request após sleep pode demorar ~30 segundos
- Para apps em produção, considere plano pago
- WebSocket funciona automaticamente no Render
