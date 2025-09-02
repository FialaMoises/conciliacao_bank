# Frontend - Sistema de Conciliação Bancária

## 📋 Descrição
Interface web moderna e responsiva para upload e visualização de resultados de conciliação bancária.

## 🚀 Funcionalidades

### Upload de Arquivos
- ✅ Drag & Drop intuitivo
- ✅ Validação de formato (OFX, CSV, TXT, XLS)
- ✅ Validação de tamanho (máx. 16MB)
- ✅ Preview de informações do arquivo

### Processamento
- ✅ Barra de progresso em tempo real
- ✅ Indicadores visuais de status
- ✅ Tratamento de erros robusto

### Visualização de Resultados
- ✅ Dashboard com métricas resumidas
- ✅ Tabelas organizadas por categoria
- ✅ Sistema de abas para navegação
- ✅ Badges coloridos para identificação
- ✅ Suporte a grupos de transações

### Recursos Extras
- ✅ Download de relatórios em JSON
- ✅ Modal de configurações da API
- ✅ Sistema de ajuda integrado
- ✅ Design responsivo para mobile
- ✅ Verificação automática de status da API

## 🛠️ Tecnologias Utilizadas

- **HTML5** - Estrutura semântica
- **CSS3** - Styling moderno com variáveis CSS
- **JavaScript ES6+** - Lógica de interação
- **Font Awesome** - Ícones vetoriais
- **Fetch API** - Comunicação com backend

## 📁 Estrutura de Arquivos

```
frontend/
├── index.html          # Página principal
├── style.css           # Estilos CSS
├── script.js           # Lógica JavaScript
└── README.md           # Esta documentação
```

## 🔧 Como Usar

### 1. Preparar o Backend
Certifique-se de que a API está rodando:
```bash
cd src
python api.py
```
A API deve estar disponível em `http://localhost:5000`

### 2. Abrir o Frontend
Simplesmente abra o arquivo `index.html` em um navegador moderno, ou use um servidor local:

#### Opção 1: Servidor Python
```bash
cd frontend
python -m http.server 8000
```
Acesse: `http://localhost:8000`

#### Opção 2: Servidor Node.js
```bash
cd frontend
npx serve .
```

#### Opção 3: Live Server (VS Code)
Use a extensão "Live Server" do VS Code para servir os arquivos.

### 3. Usar a Interface

1. **Upload**: Arraste um arquivo OFX/CSV/TXT/XLS ou clique para selecionar
2. **Validação**: O sistema valida formato e tamanho automaticamente
3. **Processamento**: Clique em "Iniciar Conciliação" e acompanhe o progresso
4. **Resultados**: Visualize os dados nas abas organizadas
5. **Download**: Baixe o relatório completo em JSON

## 📊 Interface de Usuário

### Header
- Logo e título da aplicação
- Indicador de status da API (Online/Offline)

### Seção de Upload
- Área de drag & drop responsiva
- Informações do arquivo selecionado
- Botões de ação (Upload/Limpar)

### Seção de Progresso
- Barra de progresso animada
- Texto descritivo do estágio atual
- Spinner de loading

### Seção de Resultados
- **Cards de Resumo**: Métricas principais com ícones coloridos
- **Tabela de Conciliadas**: Transações encontradas no sistema
- **Tabela de Não Conciliadas (Extrato)**: Transações sem correspondência
- **Tabela de Não Conciliadas (Sistema)**: Documentos não utilizados

### Footer
- Informações de versão
- Links para configurações e ajuda

## 🎨 Design System

### Cores
- **Primária**: `#2563eb` (Azul)
- **Sucesso**: `#10b981` (Verde)
- **Aviso**: `#f59e0b` (Amarelo)
- **Erro**: `#ef4444` (Vermelho)
- **Info**: `#3b82f6` (Azul claro)

### Tipografia
- **Fonte**: Inter, system fonts
- **Tamanhos**: Escala harmônica de 0.75rem a 2rem

### Espaçamento
- **Grid**: Sistema baseado em 0.25rem (4px)
- **Containers**: Max-width 1200px centralizados

### Componentes
- **Botões**: Estados hover e disabled
- **Cards**: Sombras sutis e bordas arredondadas
- **Tabelas**: Zebra striping e hover effects
- **Modais**: Overlay com blur de fundo

## 📱 Responsividade

O design é totalmente responsivo com breakpoints:

- **Desktop**: > 768px (layout completo)
- **Tablet**: 768px - 480px (adaptações)
- **Mobile**: < 480px (layout simplificado)

### Adaptações Mobile
- Header empilhado verticalmente
- Cards de resumo em coluna única
- Tabelas com scroll horizontal
- Abas com wrap automático

## 🔧 Configurações

### API Base URL
Altere no arquivo `script.js`:
```javascript
const API_BASE_URL = 'http://localhost:5000';
```

### Tamanhos e Limites
```javascript
// Tamanho máximo de arquivo (16MB)
const maxSize = 16 * 1024 * 1024;

// Formatos aceitos
const allowedTypes = ['.ofx', '.csv', '.txt', '.xls'];
```

## 🐛 Tratamento de Erros

### Tipos de Erro Tratados
- ❌ API offline ou inacessível
- ❌ Formato de arquivo inválido
- ❌ Arquivo muito grande
- ❌ Erro no processamento
- ❌ Resposta inválida da API

### Feedback Visual
- Mensagens de erro contextualizadas
- Indicadores de status coloridos
- Overlay de loading durante processamento
- Animações suaves de transição

## 🚀 Deploy em Produção

### Opção 1: Servidor Web Estático
1. Faça upload dos arquivos para qualquer servidor web
2. Configure CORS na API para permitir o domínio
3. Atualize `API_BASE_URL` para o endereço da API

### Opção 2: CDN
1. Use serviços como Netlify, Vercel ou GitHub Pages
2. Configure variáveis de ambiente para API URL
3. Configure redirecionamentos se necessário

### Opção 3: Container Docker
```dockerfile
FROM nginx:alpine
COPY frontend/ /usr/share/nginx/html/
EXPOSE 80
```

## 🔒 Segurança

### Validações Client-Side
- Verificação de tipo MIME
- Validação de tamanho de arquivo
- Sanitização de nomes de arquivo

### Comunicação com API
- Headers apropriados para uploads
- Tratamento de timeouts
- Validação de respostas JSON

## 📈 Performance

### Otimizações
- CSS minificado para produção
- Lazy loading de componentes
- Debounce em eventos de input
- Cache de configurações da API

### Métricas
- Tempo de carregamento inicial < 2s
- Responsividade de interações < 100ms
- Upload progressivo com feedback

## 🛡️ Compatibilidade

### Navegadores Suportados
- ✅ Chrome 60+
- ✅ Firefox 55+
- ✅ Safari 12+
- ✅ Edge 79+

### APIs Utilizadas
- Fetch API (nativa)
- FormData API (uploads)
- File API (drag & drop)
- CSS Grid & Flexbox

## 📝 Changelog

### v1.0.0
- ✅ Interface inicial completa
- ✅ Upload por drag & drop
- ✅ Visualização de resultados
- ✅ Design responsivo
- ✅ Sistema de modais
- ✅ Download de relatórios
