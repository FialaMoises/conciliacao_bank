// Configurações da API
const API_BASE_URL = 'http://localhost:5000'; // Para testes locais (sem HTTPS)

// Estado da aplicação
let currentFile = null;
let currentResults = null;
let streamingManager = null;

// Flag para controlar modo de streaming vs modo antigo
let isStreamingMode = false;

// Elementos DOM - serão inicializados após o DOM carregar
let elements = {};

// Inicialização
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 DOM carregado, inicializando...');
    initializeElements();
    initializeApp();
    setupEventListeners();
    checkApiStatus();

    // Inicializar seções e carregar regras se necessário
    initializeSections();

    // Inicializar StreamingManager
    initializeStreamingManager();
});

// Inicializar elementos DOM
function initializeElements() {
    console.log('📋 Inicializando elementos DOM...');
    
    elements = {
        apiStatus: document.getElementById('apiStatus'),
        dropZone: document.getElementById('dropZone'),
        fileInput: document.getElementById('fileInput'),
        fileInfo: document.getElementById('fileInfo'),
        fileName: document.getElementById('fileName'),
        fileSize: document.getElementById('fileSize'),
        removeFile: document.getElementById('removeFile'),
        uploadBtn: document.getElementById('uploadBtn'),
        structureBtn: document.getElementById('structureBtn'),
        clearBtn: document.getElementById('clearBtn'),
        fileStructureFields: document.getElementById('fileStructureFields'),
        progressSection: document.getElementById('progressSection'),
        progressFill: document.getElementById('progressFill'),
        progressText: document.getElementById('progressText'),
        resultsSection: document.getElementById('resultsSection'),
        errorSection: document.getElementById('errorSection'),
        errorMessage: document.getElementById('errorMessage'),
        loadingOverlay: document.getElementById('loadingOverlay'),
        modal: document.getElementById('modal'),
        modalTitle: document.getElementById('modalTitle'),
        modalBody: document.getElementById('modalBody')
    };
    
    // Verificar elementos críticos
    const criticalElements = ['dropZone', 'fileInput', 'uploadBtn'];
    for (const elem of criticalElements) {
        if (!elements[elem]) {
            console.error(`❌ Elemento crítico não encontrado: ${elem}`);
        } else {
            console.log(`✅ Elemento ${elem} encontrado`);
        }
    }
}

// Função para alternar entre as seções principais
window.switchMainSection = function(section) {
    console.log('🔄 Alternando para seção:', section);
    
    // Esconder todas as seções
    const sections = document.querySelectorAll('.main-section');
    sections.forEach(s => {
        s.style.display = 'none';
        s.classList.remove('active');
    });
    
    // Remover classe active de todas as tabs
    const tabs = document.querySelectorAll('.nav-tab');
    tabs.forEach(t => t.classList.remove('active'));
    
    // Mostrar seção selecionada
    const targetSection = document.getElementById(section + '-section');
    if (targetSection) {
        targetSection.style.display = 'block';
        targetSection.classList.add('active');
    }
    
    // Marcar tab como ativa
    const activeTab = document.querySelector(`.nav-tab[data-section="${section}"]`);
    if (activeTab) {
        activeTab.classList.add('active');
    }
    
    // Executar ações específicas por seção
    if (section === 'reconciliation-rules') {
        // Regras de conciliação são carregadas via iframe
        console.log('🤖 Carregando regras de conciliação...');
    }
};

// Inicializar aplicação
function initializeApp() {
    console.log('🚀 Iniciando aplicação de conciliação bancária');
    console.log('Configurações:', {
        API_BASE_URL: API_BASE_URL,
        userAgent: navigator.userAgent,
        timestamp: new Date().toISOString()
    });

    resetForm();

    // Ativar modo debug do StreamingManager se disponível
    if (window.streamingManager && typeof window.streamingManager.enableDebugMode === 'function') {
        console.log('🔍 Ativando modo debug do StreamingManager...');
        window.streamingManager.enableDebugMode();
    }

    // Adicionar informações de debug no console
    console.log('Debug: Para testar a API manualmente, use:');
    console.log(`fetch('${API_BASE_URL}/health').then(r => r.json()).then(console.log)`);
    console.log('Debug: Para testar contadores manualmente, use: testCounters()');
}

// Configurar event listeners
function setupEventListeners() {
    console.log('🎧 Configurando event listeners...');
    
    try {
        // Drag and drop
        if (elements.dropZone) {
            elements.dropZone.addEventListener('dragover', handleDragOver);
            elements.dropZone.addEventListener('dragleave', handleDragLeave);
            elements.dropZone.addEventListener('drop', handleDrop);
            elements.dropZone.addEventListener('click', () => {
                console.log('🖱️ Dropzone clicada - abrindo seletor de arquivo');
                if (elements.fileInput) {
                    elements.fileInput.click();
                } else {
                    console.error('❌ fileInput não encontrado!');
                }
            });
            console.log('✅ Eventos de drag/drop configurados');
        } else {
            console.error('❌ dropZone não encontrado!');
        }

        // File input
        if (elements.fileInput) {
            elements.fileInput.addEventListener('change', handleFileSelect);
            console.log('✅ Evento de seleção de arquivo configurado');
        } else {
            console.error('❌ fileInput não encontrado!');
        }

        // Buttons
        if (elements.removeFile) {
            elements.removeFile.addEventListener('click', removeFile);
        }
        if (elements.uploadBtn) {
            elements.uploadBtn.addEventListener('click', () => {
                console.log('🚀 Botão de upload clicado - usando StreamingManager');
                uploadWithStreamingManager();
            });
            console.log('✅ Evento de upload StreamingManager configurado');
        } else {
            console.error('❌ uploadBtn não encontrado!');
        }
        if (elements.structureBtn) {
            elements.structureBtn.addEventListener('click', () => {
                console.log('🏗️ Botão de estruturação clicado');
                structureFile();
            });
            console.log('✅ Evento de estruturação configurado');
        } else {
            console.error('❌ structureBtn não encontrado!');
        }
        if (elements.clearBtn) {
            elements.clearBtn.addEventListener('click', resetForm);
        }
        
        const downloadBtn = document.getElementById('downloadBtn');
        if (downloadBtn) {
            downloadBtn.addEventListener('click', downloadReport);
        }
        
        const newAnalysisBtn = document.getElementById('newAnalysisBtn');
        if (newAnalysisBtn) {
            newAnalysisBtn.addEventListener('click', resetForm);
        }
        
        // Event listeners para campos OFX removidos - não há mais campos para validar

    } catch (error) {
        console.error('❌ Erro ao configurar event listeners:', error);
    }
    
    // Tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => switchTab(e.target.dataset.tab));
    });

    // Modal
    window.addEventListener('click', (e) => {
        if (e.target === elements.modal) closeModal();
    });
}

// Verificar status da API
async function checkApiStatus() {
    console.log('Verificando status da API...');
    
    try {
        const response = await fetch(`${API_BASE_URL}/health`, {
            method: 'GET',
            headers: {
                'Accept': 'application/json'
            }
        });
        
        console.log('Resposta do health check:', {
            status: response.status,
            statusText: response.statusText,
            ok: response.ok
        });
        
        if (response.ok) {
            const data = await response.json();
            console.log('API está online:', data);
            updateApiStatus(true);
        } else {
            console.warn('API respondeu com erro:', response.status, response.statusText);
            updateApiStatus(false, `API respondeu com erro (${response.status})`);
        }
    } catch (error) {
        console.error('Erro ao verificar API:', error);
        updateApiStatus(false, 'Não foi possível conectar com a API');
    }
}

// Atualizar status da API
function updateApiStatus(isOnline, message = '') {
    const statusEl = elements.apiStatus;
    const icon = statusEl.querySelector('i');
    const text = statusEl.querySelector('span');

    if (isOnline) {
        statusEl.className = 'status-indicator online';
        icon.className = 'fas fa-circle';
        text.textContent = 'API Online';
    } else {
        statusEl.className = 'status-indicator offline';
        icon.className = 'fas fa-circle';
        text.textContent = message || 'API Offline';
    }
}

// Manipuladores de drag and drop
function handleDragOver(e) {
    e.preventDefault();
    elements.dropZone.classList.add('drag-over');
}

function handleDragLeave(e) {
    e.preventDefault();
    elements.dropZone.classList.remove('drag-over');
}

function handleDrop(e) {
    e.preventDefault();
    elements.dropZone.classList.remove('drag-over');
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        handleFileSelection(files[0]);
    }
}

// Manipulador de seleção de arquivo
function handleFileSelect(e) {
    console.log('📁 Evento de seleção de arquivo disparado');
    console.log('📋 Target:', e.target);
    console.log('📋 Files:', e.target.files);
    
    const files = e.target.files;
    if (files.length > 0) {
        console.log('✅ Arquivo selecionado:', {
            name: files[0].name,
            size: files[0].size,
            type: files[0].type,
            lastModified: files[0].lastModified
        });
        handleFileSelection(files[0]);
    } else {
        console.log('⚠️ Nenhum arquivo selecionado');
    }
}

// Processar arquivo selecionado
async function handleFileSelection(file) {
    console.log('🔍 Processando arquivo:', file.name);
    
    try {
        // Validar tipo de arquivo - incluindo .xlsx
        const allowedTypes = ['.ofx', '.csv', '.txt', '.xls', '.xlsx'];
        const fileExtension = '.' + file.name.split('.').pop().toLowerCase();
        
        console.log('Extensão detectada:', fileExtension);
        
        if (!allowedTypes.includes(fileExtension)) {
            showError('Formato de arquivo não suportado. Use apenas arquivos OFX, CSV, TXT, XLS ou XLSX.');
            return;
        }

        // Validar tamanho do arquivo (16MB)
        const maxSize = 16 * 1024 * 1024;
        if (file.size > maxSize) {
            showError('Arquivo muito grande. O tamanho máximo é 16MB.');
            return;
        }

        console.log('✅ Arquivo válido, preparando para upload');
        currentFile = file;
        displayFileInfo(file);
        
        // Verificar se é arquivo suportado para estruturação
        const supportedFiles = ['.ofx', '.csv', '.txt', '.xls', '.xlsx'];
        const isStructurableFile = supportedFiles.includes(fileExtension);
        
        if (isStructurableFile) {
            console.log(`📋 Arquivo ${fileExtension.toUpperCase()} detectado - mostrando campos de estruturação`);
            
            // Atualizar informações visuais baseado no tipo
            updateFileTypeDisplay(fileExtension);
            
            // Detectar dados bancários do arquivo com tratamento de erro
            try {
                console.log('🔍 Iniciando detecção de informações bancárias...');
                await detectBankInfo(file, fileExtension);
                console.log('✅ Detecção bancária concluída');
            } catch (bankInfoError) {
                console.error('⚠️ Erro na detecção bancária:', bankInfoError);
                // Continua mesmo se detecção falhar
                document.getElementById('bankNameDisplay').textContent = 'Erro na detecção';
            }
            
            elements.fileStructureFields.style.display = 'block';
            elements.structureBtn.style.display = 'inline-flex';
            
            // Habilitar botão de estruturação automaticamente
            elements.structureBtn.disabled = false;
        } else {
            // Esconder campos para arquivos não suportados
            elements.fileStructureFields.style.display = 'none';
            elements.structureBtn.style.display = 'none';
        }
        
    } catch (error) {
        console.error('❌ Erro ao processar arquivo:', error);
        showError(`Erro ao processar arquivo: ${error.message}`);
        return;
    }
    
    // Verificar se o botão existe antes de habilitar
    if (elements.uploadBtn) {
        elements.uploadBtn.disabled = false;
        console.log('🔓 Botão de upload habilitado');
    } else {
        console.error('❌ Botão de upload não encontrado!');
    }
}

// Exibir informações do arquivo
function displayFileInfo(file) {
    elements.fileName.textContent = file.name;
    elements.fileSize.textContent = formatFileSize(file.size);
    elements.fileInfo.style.display = 'block';
    elements.dropZone.style.display = 'none';
}

// Remover arquivo
function removeFile() {
    currentFile = null;
    elements.fileInfo.style.display = 'none';
    elements.dropZone.style.display = 'block';
    elements.uploadBtn.disabled = true;
    elements.fileInput.value = '';
    
    // Limpar informações bancárias
    document.getElementById('bankNameDisplay').textContent = 'Detectando...';
    document.getElementById('accountInfoDisplay').style.display = 'none';
    elements.fileStructureFields.style.display = 'none';
}

// Detectar informações bancárias do arquivo
async function detectBankInfo(file, fileExtension) {
    console.log('🔍 Detectando informações bancárias...', {
        fileName: file.name,
        fileSize: file.size,
        fileType: fileExtension
    });
    
    // Resetar display
    document.getElementById('bankNameDisplay').textContent = 'Detectando...';
    document.getElementById('accountInfoDisplay').style.display = 'none';
    
    try {
        if (fileExtension === '.ofx') {
            console.log('🏦 Iniciando análise OFX...');
            await detectBankInfoFromOFX(file);
            console.log('✅ Análise OFX concluída');
        } else if (fileExtension === '.csv') {
            console.log('🏦 Iniciando análise CSV...');
            await detectBankInfoFromCSV(file);
            console.log('✅ Análise CSV concluída');
        } else if (fileExtension === '.xls' || fileExtension === '.xlsx') {
            console.log('🏦 Iniciando análise Excel via API...');
            await detectBankInfoFromAPI(file);
            console.log('✅ Análise Excel concluída');
        } else {
            console.log('🏦 Detectando pelo nome do arquivo...');
            // Para outros formatos, detectar pelo nome do arquivo
            detectBankInfoFromFileName(file.name);
            console.log('✅ Análise por nome concluída');
        }
    } catch (error) {
        console.error('❌ Erro ao detectar informações bancárias:', error);
        document.getElementById('bankNameDisplay').textContent = 'Erro na detecção';
        // Re-propagar o erro para tratamento na função pai
        throw error;
    }
}

// Detectar banco a partir de arquivo OFX
async function detectBankInfoFromOFX(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = function(e) {
            const content = e.target.result;
            
            // Procurar por BANKID no conteúdo
            const bankIdMatch = content.match(/<BANKID>(\d+)/);
            const acctIdMatch = content.match(/<ACCTID>([^<]+)/);
            
            if (bankIdMatch) {
                const bankId = bankIdMatch[1];
                const bankNames = {
                    '0001': 'Banco do Brasil',
                    '0341': 'Banco do Brasil',
                    '0033': 'Banco Santander', 
                    '0104': 'Caixa Econômica Federal',
                    '0237': 'Banco Bradesco',
                    '0260': 'Nubank'
                };
                
                const bankName = bankNames[bankId] || `Banco ${bankId}`;
                document.getElementById('bankNameDisplay').textContent = `${bankName} (${bankId})`;
                
                if (acctIdMatch) {
                    const accountId = acctIdMatch[1];
                    document.getElementById('accountDetailsDisplay').textContent = accountId;
                    document.getElementById('accountInfoDisplay').style.display = 'block';
                }
            } else {
                document.getElementById('bankNameDisplay').textContent = 'OFX - Banco não identificado';
            }
            resolve();
        };
        reader.readAsText(file);
    });
}

// Detectar banco a partir de arquivo CSV (Nubank)
async function detectBankInfoFromCSV(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = function(e) {
            const content = e.target.result;
            const lines = content.split('\n');
            
            // Verificar se é Nubank pelas descrições
            let isNubank = false;
            for (let i = 1; i < Math.min(lines.length, 5); i++) {
                if (lines[i].includes('NU PAGAMENTOS') || lines[i].includes('Nubank')) {
                    isNubank = true;
                    break;
                }
            }
            
            if (isNubank || file.name.startsWith('NU_')) {
                document.getElementById('bankNameDisplay').textContent = 'Nubank (0260)';
                
                // Extrair conta do nome do arquivo
                if (file.name.startsWith('NU_')) {
                    const accountMatch = file.name.match(/NU_(\d+)_/);
                    if (accountMatch) {
                        document.getElementById('accountDetailsDisplay').textContent = `Ag: 1 / Conta: ${accountMatch[1]}`;
                        document.getElementById('accountInfoDisplay').style.display = 'block';
                    }
                }
            } else {
                document.getElementById('bankNameDisplay').textContent = 'CSV - Banco não identificado';
            }
            resolve();
        };
        reader.readAsText(file);
    });
}

// Detectar banco via API (para arquivos XLS/XLSX)
async function detectBankInfoFromAPI(file) {
    try {
        console.log('🔍 Detectando informações bancárias via API...');
        
        const formData = new FormData();
        formData.append('file', file);
        
        const response = await fetch(`${API_BASE_URL}/file/extract-bank-info`, {
            method: 'POST',
            body: formData,
            signal: AbortSignal.timeout(30000) // 30 segundos timeout
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const result = await response.json();
        
        if (result.success && result.bank_info) {
            const bankInfo = result.bank_info;
            
            // Atualizar nome do banco
            if (bankInfo.bank_name) {
                const displayText = bankInfo.bank_id 
                    ? `${bankInfo.bank_name} (${bankInfo.bank_id})`
                    : bankInfo.bank_name;
                document.getElementById('bankNameDisplay').textContent = displayText;
            } else {
                document.getElementById('bankNameDisplay').textContent = 'XLS - Banco não identificado';
            }
            
            // Atualizar informações de conta se disponível
            if (bankInfo.agency || bankInfo.account_id) {
                let accountDetails = '';
                if (bankInfo.agency && bankInfo.account_id) {
                    accountDetails = `Ag: ${bankInfo.agency} / Conta: ${bankInfo.account_id}`;
                } else if (bankInfo.account_id) {
                    accountDetails = `Conta: ${bankInfo.account_id}`;
                } else if (bankInfo.agency) {
                    accountDetails = `Ag: ${bankInfo.agency}`;
                }
                
                if (accountDetails) {
                    document.getElementById('accountDetailsDisplay').textContent = accountDetails;
                    document.getElementById('accountInfoDisplay').style.display = 'block';
                }
            }
            
            console.log('✅ Dados bancários detectados via API:', bankInfo);
            
        } else {
            console.warn('⚠️ API não retornou dados bancários válidos');
            document.getElementById('bankNameDisplay').textContent = 'XLS - Dados não detectados';
        }
        
    } catch (error) {
        console.error('❌ Erro ao detectar via API:', error);
        
        // Fallback para detecção por nome do arquivo
        console.log('🔄 Tentando fallback por nome do arquivo...');
        detectBankInfoFromFileName(file.name);
    }
}

// Detectar banco pelo nome do arquivo
function detectBankInfoFromFileName(fileName) {
    const name = fileName.toLowerCase();
    
    if (name.includes('nu_') || name.includes('nubank')) {
        document.getElementById('bankNameDisplay').textContent = 'Nubank (0260)';
        const accountMatch = fileName.match(/NU_(\d+)_/i);
        if (accountMatch) {
            document.getElementById('accountDetailsDisplay').textContent = `Ag: 1 / Conta: ${accountMatch[1]}`;
            document.getElementById('accountInfoDisplay').style.display = 'block';
        }
    } else if (name.includes('bb') || name.includes('brasil')) {
        document.getElementById('bankNameDisplay').textContent = 'Banco do Brasil (0001/0341)';
    } else if (name.includes('santander')) {
        document.getElementById('bankNameDisplay').textContent = 'Banco Santander (0033)';
    } else if (name.includes('bradesco')) {
        document.getElementById('bankNameDisplay').textContent = 'Banco Bradesco (0237)';
    } else if (name.includes('caixa')) {
        document.getElementById('bankNameDisplay').textContent = 'Caixa Econômica Federal (0104)';
    } else {
        document.getElementById('bankNameDisplay').textContent = 'Banco não identificado';
    }
}

// Variáveis para controle de streaming
let currentEventSource = null;
let streamingSessionId = null;

// Upload com Streaming SSE
async function uploadFileWithStreaming() {
    if (!currentFile) {
        showError('Nenhum arquivo selecionado.');
        return;
    }

    console.log('🌊 Iniciando upload com streaming...', {
        fileName: currentFile.name,
        fileSize: currentFile.size,
        fileType: currentFile.type,
        apiUrl: `${API_BASE_URL}/stream/reconcile`,
        timestamp: new Date().toISOString()
    });

    showProgress();

    try {
        // Fechar stream anterior se existir
        if (currentEventSource) {
            currentEventSource.close();
            currentEventSource = null;
        }

        const formData = new FormData();
        formData.append('file', currentFile);

        updateProgress(5, 'Conectando ao servidor...');

        // Iniciar requisição SSE
        const response = await fetch(`${API_BASE_URL}/stream/reconcile`, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            // Se não for SSE, processar como erro JSON
            const errorData = await response.json();
            throw new Error(errorData.error || 'Erro no servidor');
        }

        // Obter session ID dos headers
        streamingSessionId = response.headers.get('X-Session-ID');
        console.log('🆔 Session ID recebido:', streamingSessionId);

        // Processar stream
        await processSSEStream(response);

    } catch (error) {
        console.error('❌ Erro durante upload com streaming:', error);
        hideProgress();
        showError(`Erro: ${error.message}`);
    }
}

// Processar Stream SSE
async function processSSEStream(response) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    updateProgress(10, 'Streaming iniciado...');

    try {
        while (true) {
            const { done, value } = await reader.read();

            if (done) {
                console.log('✅ Stream concluído');
                break;
            }

            // Decodificar chunk
            buffer += decoder.decode(value, { stream: true });

            // Processar eventos completos
            const lines = buffer.split('\n\n');
            buffer = lines.pop() || ''; // Manter última linha incompleta no buffer

            for (const eventBlock of lines) {
                if (eventBlock.trim()) {
                    await processSSEEvent(eventBlock);
                }
            }
        }
    } catch (error) {
        console.error('❌ Erro ao processar stream:', error);
        throw error;
    } finally {
        reader.releaseLock();
    }
}

// Processar evento SSE individual
async function processSSEEvent(eventBlock) {
    try {
        // Extrair dados do evento SSE
        const dataLine = eventBlock.split('\n').find(line => line.startsWith('data: '));
        if (!dataLine) return;

        const jsonData = dataLine.substring(6); // Remove "data: "
        const eventData = JSON.parse(jsonData);

        console.log('📡 Evento SSE recebido:', eventData);

        switch (eventData.type) {
            case 'progress':
                await handleProgressEvent(eventData);
                break;
            case 'complete':
                await handleCompleteEvent(eventData);
                break;
            case 'error':
                await handleErrorEvent(eventData);
                break;
            default:
                console.log('📡 Evento desconhecido:', eventData.type);
        }

    } catch (error) {
        console.error('❌ Erro ao processar evento SSE:', error);
    }
}

// Handler para eventos de progresso
async function handleProgressEvent(eventData) {
    const { progress, message, step } = eventData;

    // Converter progresso para porcentagem
    const progressPercent = Math.round(progress * 100);

    updateProgress(progressPercent, message);

    console.log(`📊 Progresso: ${progressPercent}% - ${step}: ${message}`);

    // Adicionar informações específicas por etapa
    if (eventData.transaction_count) {
        updateProgress(progressPercent, `${message} (${eventData.transaction_count} transações)`);
    }

    if (eventData.conciliated_count !== undefined) {
        updateProgress(progressPercent, `${message} (${eventData.conciliated_count} conciliadas)`);
    }
}

// Handler para evento de conclusão
async function handleCompleteEvent(eventData) {
    console.log('🎉 Conciliação concluída!', eventData);

    updateProgress(100, 'Conciliação concluída com sucesso!');

    // Aguardar um pouco e então buscar o resultado completo
    setTimeout(async () => {
        await fetchStreamResult(eventData.session_id);
    }, 1000);
}

// Handler para eventos de erro
async function handleErrorEvent(eventData) {
    console.error('❌ Erro SSE recebido:', eventData);

    hideProgress();
    showError(`Erro durante processamento: ${eventData.error}`);

    if (eventData.details) {
        console.error('Detalhes do erro:', eventData.details);
    }
}

// Buscar resultado completo da sessão
async function fetchStreamResult(sessionId) {
    try {
        console.log('🔍 Buscando resultado da sessão:', sessionId);

        const response = await fetch(`${API_BASE_URL}/stream/session/${sessionId}/result`);
        const data = await response.json();

        if (data.success && data.result) {
            // Processar resultado como no método original
            processReconciliationResult(data.result);
        } else {
            console.error('❌ Erro ao obter resultado:', data.error);
            showError('Erro ao obter resultado da conciliação');
        }
    } catch (error) {
        console.error('❌ Erro ao buscar resultado:', error);
        showError('Erro ao obter resultado da conciliação');
    }
}

// Processar resultado da conciliação (método comum)
function processReconciliationResult(result) {
    hideProgress();

    console.log('📊 Processando resultado da conciliação:', result);

    // Criar estrutura compatível com showResults existente
    const compatibleResult = {
        ...result,
        summary: {
            conciliated_count: result.conciliated?.length || 0,
            suggested_count: result.suggested?.length || 0,
            pending_count: result.pending?.length || 0,
            no_correlation_count: result.no_correlation?.length || 0,
            unmatched_mongo_count: result.unmatched_mongo?.length || 0
        },
        result: result // Para compatibilidade com código existente
    };

    console.log('📊 Resumo da conciliação:', compatibleResult.summary);

    // Exibir resultados usando a função existente
    showResults(compatibleResult);

    console.log('✅ Processamento concluído com sucesso!');
}

// Upload do arquivo (método original mantido para compatibilidade)
async function uploadFile() {
    if (!currentFile) {
        showError('Nenhum arquivo selecionado.');
        return;
    }

    console.log('🚀 Iniciando upload...', {
        fileName: currentFile.name,
        fileSize: currentFile.size,
        fileType: currentFile.type,
        apiUrl: `${API_BASE_URL}/reconcile`,
        timestamp: new Date().toISOString()
    });

    showProgress();
    
    try {
        const formData = new FormData();
        formData.append('file', currentFile);

        updateProgress(10, 'Enviando arquivo...');

        console.log('Fazendo requisição para:', `${API_BASE_URL}/reconcile`);

        const response = await fetch(`${API_BASE_URL}/reconcile`, {
            method: 'POST',
            body: formData,
            headers: {
                // Não definir Content-Type para FormData - deixar o browser definir
            }
        });

        console.log('Resposta recebida:', {
            status: response.status,
            statusText: response.statusText,
            ok: response.ok
        });

        updateProgress(50, 'Processando conciliação...');

        const responseText = await response.text();
        console.log('Texto da resposta:', responseText);

        let result;
        try {
            result = JSON.parse(responseText);
        } catch (parseError) {
            console.error('Erro ao fazer parse do JSON:', parseError);
            throw new Error(`Resposta inválida do servidor: ${responseText.substring(0, 100)}...`);
        }

        updateProgress(90, 'Finalizando...');

        if (response.ok && result.success) {
            updateProgress(100, 'Concluído!');
            console.log('Processamento concluído com sucesso:', result);
            setTimeout(() => {
                hideProgress();
                showResults(result);
            }, 1000);
        } else {
            const errorMsg = result.error || `Erro HTTP ${response.status}: ${response.statusText}`;
            console.error('Erro na resposta:', errorMsg);
            throw new Error(errorMsg);
        }

    } catch (error) {
        console.error('Erro no upload:', error);
        console.error('Detalhes do erro:', {
            name: error.name,
            message: error.message,
            stack: error.stack
        });
        
        hideProgress();
        
        // Verificar tipos específicos de erro
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
            showError(`❌ Erro de conexão: Não foi possível conectar com a API em ${API_BASE_URL}. 
                      <br><br>🔧 <strong>Possíveis soluções:</strong>
                      <br>• Verifique se o backend está rodando
                      <br>• Verifique se a porta 5000 está liberada
                      <br>• Tente recarregar a página`);
        } else if (error.message.includes('429')) {
            showError(`⏱️ Muitas tentativas: O sistema está limitando uploads temporariamente.
                      <br><br>🔧 <strong>Solução:</strong>
                      <br>• Aguarde alguns minutos e tente novamente`);
        } else if (error.message.includes('400')) {
            showError(`📋 Arquivo inválido: O arquivo não passou na validação.
                      <br><br>🔧 <strong>Verifique:</strong>
                      <br>• Se o formato é suportado (OFX, CSV, TXT, XLS, XLSX)
                      <br>• Se o arquivo não está corrompido
                      <br>• Se o arquivo contém dados válidos`);
        } else {
            showError(`❌ Erro no upload: ${error.message}
                      <br><br>🔧 <strong>Dica:</strong> Verifique o console do navegador (F12) para mais detalhes`);
        }
    }
}

// Mostrar seção de progresso
function showProgress() {
    elements.progressSection.style.display = 'block';
    elements.resultsSection.style.display = 'none';
    elements.errorSection.style.display = 'none';

    // Só resetar progresso se não estiver em modo streaming
    if (!isStreamingMode) {
        updateProgress(0, 'Iniciando...');
    }
}

// Atualizar progresso
function updateProgress(percentage, text) {
    elements.progressFill.style.width = `${percentage}%`;
    elements.progressText.textContent = text;
}

// Esconder seção de progresso
function hideProgress() {
    elements.progressSection.style.display = 'none';
}

// Atualizar informações visuais baseado no tipo de arquivo
function updateFileTypeDisplay(fileExtension) {
    const fileTypeDisplay = document.getElementById('fileTypeDisplay');
    const processingTypeText = document.getElementById('processingTypeText');
    
    const fileTypeLabels = {
        '.ofx': 'OFX',
        '.csv': 'CSV', 
        '.txt': 'TXT',
        '.xls': 'Excel XLS',
        '.xlsx': 'Excel XLSX'
    };
    
    const processingTypes = {
        '.ofx': 'Parser OFX → Estruturação MongoDB',
        '.csv': 'Parser CSV → Estruturação MongoDB', 
        '.txt': 'Parser TXT → Estruturação MongoDB',
        '.xls': 'Parser Excel → Estruturação MongoDB',
        '.xlsx': 'Parser Excel → Estruturação MongoDB'
    };
    
    if (fileTypeDisplay) {
        fileTypeDisplay.textContent = fileTypeLabels[fileExtension] || fileExtension.toUpperCase();
    }
    
    if (processingTypeText) {
        processingTypeText.textContent = processingTypes[fileExtension] || 'Processamento automático';
    }
}

// Estruturar qualquer arquivo suportado e salvar no MongoDB
async function structureFile() {
    if (!currentFile) {
        showError('Nenhum arquivo selecionado.');
        return;
    }

    const fileExtension = '.' + currentFile.name.split('.').pop().toLowerCase();
    const supportedFiles = ['.ofx', '.csv', '.txt', '.xls', '.xlsx'];
    
    if (!supportedFiles.includes(fileExtension)) {
        showError(`Tipo de arquivo não suportado: ${fileExtension}. Suportados: ${supportedFiles.join(', ')}`);
        return;
    }

    console.log(`🏗️ Iniciando estruturação ${fileExtension.toUpperCase()} com dados fixos Nubank...`, {
        fileName: currentFile.name,
        bankId: 'Nubank (0260)',
        fileType: fileExtension,
        note: 'Usando Factory Pattern para detectar tipo automaticamente'
    });

    showProgress();
    
    try {
        const formData = new FormData();
        formData.append('file', currentFile);
        
        // Dados fixos do Nubank - serão usados pelo Factory
        const requestData = {
            bank_id: '0260',
            bank_account_id: '65b7dc370e6dc686d4478ea1', 
            user_id: '65b7dc370e6dc686d4478ea2'
        };
        
        console.log('📤 Enviando para estruturação via Factory Pattern:', requestData);
        
        const response = await fetch(`${API_BASE_URL}/file/structure`, {
            method: 'POST',
            body: formData,
            // Note: Não enviamos JSON junto com FormData, o backend usará valores padrão
            signal: AbortSignal.timeout(120000) // 2 minutos timeout
        });

        const result = await response.json();
        console.log('📥 Resposta da estruturação:', result);

        if (response.ok && result.success) {
            console.log('✅ Estruturação realizada com sucesso!');
            hideProgress();
            showStructureSuccess(result);
        } else {
            console.error('❌ Erro na estruturação:', result.error || 'Erro desconhecido');
            hideProgress();
            showError(result.error || result.message || 'Erro na estruturação do arquivo');
        }

    } catch (error) {
        console.error('❌ Erro na comunicação:', error);
        hideProgress();
        
        if (error.name === 'AbortError') {
            showError('Timeout: Estruturação demorou mais que 2 minutos. Tente novamente.');
        } else if (error.message.includes('Failed to fetch')) {
            showError('Erro de conexão. Verifique se a API está rodando.');
        } else {
            showError(`Erro na estruturação: ${error.message}`);
        }
    }
}

// Mostrar resultados da estruturação de arquivos
function showStructureSuccess(result) {
    console.log('📊 Exibindo resultados da estruturação:', result);
    
    // Esconder outros elementos
    elements.progressSection.style.display = 'none';
    elements.errorSection.style.display = 'none';
    
    // Determinar o tipo de arquivo processado
    const fileType = result.factory_info ? result.factory_info.file_type : 'Arquivo';
    
    // Mostrar modal com resultados
    showModal(`🏗️ ${fileType} Estruturado com Sucesso`, `
        <div class="file-structure-results">
            <div class="result-summary">
                <h4>✅ Dados estruturados e salvos no MongoDB via Factory Pattern</h4>
                <p><strong>Tipo de Arquivo:</strong> <span class="file-type-badge">${fileType}</span></p>
                <p><strong>Service Usado:</strong> <code>${result.factory_info ? result.factory_info.service_used : 'N/A'}</code></p>
                <p><strong>Collection:</strong> ${result.collection || 'BankReconciliation'}</p>
                <p><strong>Document ID:</strong> <code>${result.document_id}</code></p>
                <p><strong>Liquidation ID:</strong> <code>${result.liquidation_id}</code></p>
                ${result.local_backup ? `<p><strong>📁 Backup Local:</strong> <code>${result.local_backup}</code></p>` : ''}
            </div>
            
            <div class="result-details">
                <h4>📋 Resumo dos Dados</h4>
                <div class="detail-grid">
                    <div class="detail-item">
                        <strong>ID Empresa:</strong> ${result.summary.idEmpresa || 'N/A'}
                    </div>
                    <div class="detail-item">
                        <strong>User ID:</strong> ${result.summary.userId || 'N/A'}
                    </div>
                    <div class="detail-item">
                        <strong>Banco Configurado:</strong> Nubank (0260)
                    </div>
                    <div class="detail-item">
                        <strong>Account ID:</strong> ${result.summary.bankAccountId || 'N/A'}
                    </div>
                    <div class="detail-item">
                        <strong>Período:</strong> ${result.summary.periodo || 'N/A'}
                    </div>
                    <div class="detail-item">
                        <strong>Valor Recebido:</strong> R$ ${(result.summary.valor_recebido_ofx || result.summary.total_credits || 0).toFixed(2)}
                    </div>
                    <div class="detail-item">
                        <strong>Valor Pago:</strong> R$ ${(result.summary.valor_pago_ofx || result.summary.total_debits || 0).toFixed(2)}
                    </div>
                    <div class="detail-item">
                        <strong>Total Transações:</strong> ${result.summary.total_transactions || 0}
                    </div>
                    <div class="detail-item">
                        <strong>Status:</strong> ${result.summary.status || 'Processado'}
                    </div>
                </div>
            </div>
            
            ${result.factory_info ? `
            <div class="factory-info">
                <h4>🏭 Informações do Factory Pattern</h4>
                <div class="factory-details">
                    <p><strong>Extensão Detectada:</strong> ${result.factory_info.detected_extension}</p>
                    <p><strong>Service Carregado:</strong> ${result.factory_info.service_used}</p>
                    <p><strong>Parser Usado:</strong> ${result.factory_info.parser_used || 'Automático'}</p>
                    <p><strong>Tempo de Processamento:</strong> ${result.factory_info.processing_time || 'N/A'}</p>
                </div>
            </div>` : ''}
            
            <div class="action-buttons">
                <button class="btn btn-success" onclick="startStreamingReconciliation(); closeModal();">
                    <i class="fas fa-rocket"></i>
                    Iniciar Conciliação com Streaming
                </button>
                <button class="btn btn-primary" onclick="resetForm(); closeModal();">
                    <i class="fas fa-plus"></i>
                    Estruturar Outro Arquivo
                </button>
                <button class="btn btn-outline" onclick="closeModal();">
                    <i class="fas fa-times"></i>
                    Fechar
                </button>
            </div>
        </div>
        
        <style>
            .file-type-badge {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 2px 8px;
                border-radius: 4px;
                font-weight: bold;
            }
            .factory-info {
                background: #f8f9fa;
                padding: 15px;
                border-radius: 8px;
                margin-top: 15px;
                border-left: 4px solid #667eea;
            }
            .factory-details p {
                margin: 5px 0;
                font-size: 0.9em;
            }
            .action-buttons {
                margin-top: 20px;
                display: flex;
                gap: 10px;
                justify-content: center;
            }
        </style>
    `);
}

// Estruturar OFX e salvar no MongoDB (mantido para compatibilidade)
async function structureOFX() {
    if (!currentFile) {
        showError('Nenhum arquivo OFX selecionado.');
        return;
    }

    if (!currentFile.name.toLowerCase().endsWith('.ofx')) {
        showError('Apenas arquivos OFX são suportados para estruturação.');
        return;
    }

    console.log('🏗️ Iniciando estruturação OFX com dados fixos Nubank...', {
        fileName: currentFile.name,
        bankId: 'Nubank (0260)',
        note: 'Usando configurações fixas'
    });

    showProgress();
    
    try {
        const formData = new FormData();
        formData.append('file', currentFile);
        // Não envia mais bankId e bankAccountId - serão valores fixos no backend

        updateProgress(10, 'Enviando arquivo OFX...');

        console.log('📤 Enviando para:', `${API_BASE_URL}/ofx/structure`);

        const response = await fetch(`${API_BASE_URL}/ofx/structure`, {
            method: 'POST',
            body: formData
        });

        console.log('📥 Resposta recebida:', {
            status: response.status,
            statusText: response.statusText,
            ok: response.ok
        });

        updateProgress(50, 'Estruturando dados...');

        const responseText = await response.text();
        console.log('📄 Texto da resposta:', responseText);

        let result;
        try {
            result = JSON.parse(responseText);
        } catch (parseError) {
            console.error('❌ Erro ao fazer parse do JSON:', parseError);
            throw new Error(`Resposta inválida do servidor: ${responseText.substring(0, 100)}...`);
        }

        updateProgress(90, 'Finalizando...');

        if (!response.ok) {
            throw new Error(result.error || `Erro HTTP ${response.status}: ${response.statusText}`);
        }

        updateProgress(100, 'OFX estruturado com sucesso!');

        setTimeout(() => {
            hideProgress();
            showOFXStructureResults(result);
        }, 1000);

    } catch (error) {
        console.error('❌ Erro na estruturação OFX:', error);
        hideProgress();
        
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
            showError(`Erro de conexão: Não foi possível conectar com a API em ${API_BASE_URL}. Verifique se o backend está rodando.`);
        } else {
            showError(`Erro na estruturação OFX: ${error.message}`);
        }
    }
}

// Mostrar resultados da estruturação OFX
function showOFXStructureResults(result) {
    console.log('📊 Exibindo resultados da estruturação:', result);
    
    // Esconder outros elementos
    elements.progressSection.style.display = 'none';
    elements.errorSection.style.display = 'none';
    
    // Mostrar modal com resultados
    showModal('🏗️ OFX Estruturado com Sucesso', `
        <div class="ofx-structure-results">
            <div class="result-summary">
                <h4>✅ Dados estruturados e salvos no MongoDB</h4>
                <p><strong>Database:</strong> ${result.summary.database}</p>
                <p><strong>Collection:</strong> ${result.summary.collection}</p>
                <p><strong>Document ID:</strong> <code>${result.document_id}</code></p>
                <p><strong>Liquidation ID:</strong> <code>${result.liquidationId}</code></p>
                ${result.local_json_file ? `<p><strong>📁 Arquivo Local:</strong> <code>${result.local_json_file}</code></p>` : ''}
            </div>
            
            <div class="result-details">
                <h4>📋 Resumo dos Dados</h4>
                <div class="detail-grid">
                    <div class="detail-item">
                        <strong>ID Empresa:</strong> ${result.summary.idEmpresa}
                    </div>
                    <div class="detail-item">
                        <strong>User ID:</strong> ${result.summary.userId}
                    </div>
                    <div class="detail-item">
                        <strong>Banco Configurado:</strong> Nubank (0260)
                    </div>
                    <div class="detail-item">
                        <strong>Account ID:</strong> ${result.summary.bankAccountId}
                    </div>
                    <div class="detail-item">
                        <strong>Período:</strong> ${result.summary.periodo}
                    </div>
                    <div class="detail-item">
                        <strong>Valor Recebido:</strong> R$ ${result.summary.valor_recebido_ofx.toFixed(2)}
                    </div>
                    <div class="detail-item">
                        <strong>Valor Pago:</strong> R$ ${result.summary.valor_pago_ofx.toFixed(2)}
                    </div>
                    <div class="detail-item">
                        <strong>Total Transações:</strong> ${result.summary.total_transactions}
                    </div>
                    <div class="detail-item">
                        <strong>Status:</strong> ${result.summary.status}
                    </div>
                    <div class="detail-item">
                        <strong>JSON Estruturado:</strong> ${result.summary.ofx_json_estruturado_size} chars
                    </div>
                    <div class="detail-item">
                        <strong>Seções JSON:</strong> ${result.summary.ofx_json_keys.join(', ')}
                    </div>
                    <div class="detail-item">
                        <strong>Backup Local:</strong> ${result.summary.local_backup}
                    </div>
                </div>
            </div>
            
            <div class="result-actions">
                <button class="btn btn-primary" onclick="closeModal(); resetForm();">
                    <i class="fas fa-plus"></i>
                    Estruturar Novo OFX
                </button>
                <button class="btn btn-outline" onclick="closeModal();">
                    <i class="fas fa-times"></i>
                    Fechar
                </button>
            </div>
        </div>
    `);
}

// Aplicar regras de cobrança nos resultados
function applyBillingRulesToResults(result) {
    // Carregar regras do localStorage
    const rules = JSON.parse(localStorage.getItem('billingRules') || '[]');
    const activeRules = rules.filter(r => r.active).sort((a, b) => a.priority - b.priority);
    
    if (activeRules.length === 0) {
        console.log('⚠️ Nenhuma regra de cobrança ativa encontrada');
        return;
    }
    
    console.log(`✅ ${activeRules.length} regras de cobrança ativas`);
    
    // Aplicar regras nas transações pendentes
    if (result.result.pending && result.result.pending.length > 0) {
        result.result.pending = result.result.pending.map(item => {
            return applyBillingRulesToTransaction(item, activeRules);
        });
    }
    
    // Aplicar regras nas transações sugeridas
    if (result.result.suggested && result.result.suggested.length > 0) {
        result.result.suggested = result.result.suggested.map(item => {
            return applyBillingRulesToTransaction(item, activeRules);
        });
    }
}

// Aplicar regras em uma transação específica
function applyBillingRulesToTransaction(transaction, rules) {
    // Verificar se há documento do MongoDB com data de vencimento
    if (transaction.mongo_document && transaction.mongo_document.data_vencimento) {
        const dueDate = new Date(transaction.mongo_document.data_vencimento);
        const today = new Date();
        const daysLate = Math.floor((today - dueDate) / (1000 * 60 * 60 * 24));
        
        if (daysLate > 0) {
            const value = transaction.mongo_document.valor || transaction.bank_transaction?.valor || 0;
            const entityName = transaction.mongo_document.descricao || transaction.bank_transaction?.descricao || '';
            
            // Encontrar regra aplicável
            const applicableRule = findApplicableRule(value, entityName, rules);
            
            if (applicableRule) {
                // Calcular juros e multas
                const charges = calculateCharges(value, daysLate, applicableRule);
                
                // Adicionar informações de cobrança
                transaction.billing_info = {
                    days_late: daysLate,
                    rule_applied: applicableRule.name,
                    rule_id: applicableRule.id,
                    fine_amount: charges.fine,
                    interest_amount: charges.interest,
                    total_charges: charges.total,
                    original_value: value,
                    final_value: value + charges.total,
                    due_date: dueDate.toLocaleDateString('pt-BR'),
                    calculation_date: today.toLocaleDateString('pt-BR')
                };
                
                console.log(`💰 Cobrança aplicada para "${entityName}":`, {
                    rule: applicableRule.name,
                    daysLate: daysLate,
                    charges: charges.total.toFixed(2)
                });
            }
        }
    }
    
    return transaction;
}

// Encontrar regra aplicável
function findApplicableRule(value, entityName, rules) {
    for (const rule of rules) {
        // Verificar limites de valor
        if (rule.min_value && value < rule.min_value) continue;
        if (rule.max_value && value > rule.max_value) continue;
        
        // Verificar filtro de entidade se existir
        if (rule.entity_filter && rule.entity_filter.length > 0) {
            const matchesFilter = rule.entity_filter.some(filter => 
                entityName.toLowerCase().includes(filter.toLowerCase())
            );
            if (!matchesFilter) continue;
        }
        
        // Regra aplicável encontrada
        return rule;
    }
    return null;
}

// Calcular juros e multas
function calculateCharges(originalValue, daysLate, rule) {
    let fineAmount = 0;
    let interestAmount = 0;
    
    // Calcular multa
    if (rule.fine_enabled && daysLate > rule.fine_grace_days) {
        fineAmount = originalValue * (rule.fine_percentage / 100);
    }
    
    // Calcular juros
    if (rule.interest_enabled && daysLate > rule.interest_grace_days) {
        const effectiveDays = Math.min(daysLate - rule.interest_grace_days, rule.max_days_calculation || 365);
        
        if (rule.interest_type === 'DAILY') {
            const dailyRate = rule.interest_rate / 100;
            if (rule.compound_interest) {
                interestAmount = originalValue * (Math.pow(1 + dailyRate, effectiveDays) - 1);
            } else {
                interestAmount = originalValue * dailyRate * effectiveDays;
            }
        } else if (rule.interest_type === 'MONTHLY') {
            const monthlyRate = rule.interest_rate / 100;
            const months = effectiveDays / 30;
            if (rule.compound_interest) {
                interestAmount = originalValue * (Math.pow(1 + monthlyRate, months) - 1);
            } else {
                interestAmount = originalValue * monthlyRate * months;
            }
        } else if (rule.interest_type === 'YEARLY') {
            const yearlyRate = rule.interest_rate / 100;
            const years = effectiveDays / 365;
            if (rule.compound_interest) {
                interestAmount = originalValue * (Math.pow(1 + yearlyRate, years) - 1);
            } else {
                interestAmount = originalValue * yearlyRate * years;
            }
        }
    }
    
    return {
        fine: fineAmount,
        interest: interestAmount,
        total: fineAmount + interestAmount
    };
}

// Mostrar resultados
function showResults(result) {
    currentResults = result;
    
    // Aplicar regras de cobrança nas transações pendentes e sugeridas
    console.log('📊 Aplicando regras de cobrança nos resultados...');
    applyBillingRulesToResults(result);
    
    // Atualizar contadores com os novos status
    document.getElementById('conciliatedCount').textContent = result.summary.conciliated_count || 0;
    document.getElementById('suggestedCount').textContent = result.summary.suggested_count || 0;
    document.getElementById('pendingCount').textContent = result.summary.pending_count || 0;
    document.getElementById('unmatchedMongoCount').textContent = result.summary.unmatched_mongo_count || 0;
    
    // Atualizar contador de sem correlação (se existir)
    const noCorrelationCount = result.summary.no_correlation_count || 
                              (result.result.no_correlation ? result.result.no_correlation.length : 0);
    const noCorrelationElement = document.getElementById('noCorrelationCount');
    if (noCorrelationElement) {
        noCorrelationElement.textContent = noCorrelationCount;
    }

    // Preencher tabelas com os novos status
    fillConciliatedTable(result.result.conciliated || []);
    fillSuggestedTable(result.result.suggested || []);
    fillPendingTable(result.result.pending || []);
    fillNoCorrelationTable(result.result.no_correlation || []);

    // Mostrar seção de resultados
    elements.resultsSection.style.display = 'block';
    elements.resultsSection.classList.add('fade-in');
    
    // Mostrar botão de limpar
    elements.clearBtn.style.display = 'inline-flex';
}

// Preencher tabela de conciliadas
function fillConciliatedTable(data) {
    const tbody = document.getElementById('conciliatedTable');
    tbody.innerHTML = '';

    data.forEach(item => {
        const row = tbody.insertRow();
        row.classList.add('conciliated-row');
        
        // Verificar se é um grupo ou transação individual
        if (item.type === 'group') {
            // Para grupos, mostrar informações resumidas
            row.innerHTML = `
                <td colspan="10" class="group-row">
                    <div class="group-header">
                        <strong>🔗 Grupo Conciliado: ${item.reason}</strong>
                    </div>
                    <div class="group-details">
                        <div class="group-summary">
                            <span>${item.bank_transactions.length} transação(ões) bancária(s) ↔ ${item.mongo_documents.length} documento(s) do sistema</span>
                        </div>
                        <div class="group-items">
                            <div class="bank-items">
                                <h5>📊 Transações Bancárias:</h5>
                                <ul>
                                    ${item.bank_transactions.map(t => `
                                        <li>
                                            <span class="item-date">${formatDate(t.data || t.date || 'N/A')}</span>
                                            <span class="item-desc" title="${t.descricao || t.description || 'N/A'}">${truncateText(t.descricao || t.description || 'Sem descrição', 30)}</span>
                                            <span class="item-value">${formatCurrency(t.valor || t.value || 0)}</span>
                                        </li>
                                    `).join('')}
                                </ul>
                            </div>
                            <div class="system-items">
                                <h5>💼 Documentos do Sistema:</h5>
                                <ul>
                                    ${item.mongo_documents.map(d => `
                                        <li>
                                            <span class="item-id" title="${d._id || d.id || 'N/A'}">${truncateText(d._id || d.id || 'N/A', 8)}</span>
                                            <span class="item-desc" title="${d.descricao || d.description || 'N/A'}">${truncateText(d.descricao || d.description || 'Sem descrição', 30)}</span>
                                            <span class="item-value">${formatCurrency(d.valor || d.value || 0)}</span>
                                        </li>
                                    `).join('')}
                                </ul>
                            </div>
                        </div>
                    </div>
                </td>
            `;
            row.classList.add('group-row');
        } else {
            // Transação individual - usar dados reais do backend
            const bankData = {
                date: item.date,
                description: item.description,
                value: item.value,
                type: item.type
            };
            
            const systemData = {
                id: item.matched_document_id || 'N/A',
                description: item.system_description || 'N/A',
                value: item.system_value || item.value,
                dueDate: item.system_due_date || item.system_settlement_date || item.date,
                entity: item.system_entity || 'N/A'
            };
            
            // Verificar se há múltiplos documentos relacionados
            const relatedDocs = findRelatedDocuments(item, data);
            const hasMultipleDocs = relatedDocs.length > 1;
            
            row.innerHTML = `
                <td>
                    <input type="checkbox" 
                           class="transaction-checkbox" 
                           data-status="conciliated"
                           data-transaction-id="${item.id || item.transaction_id || ''}"
                           data-tipo="${item.type || 'expense'}"
                           data-valor="${item.value || 0}"
                           data-data="${item.date || ''}"
                           data-description="${item.description || ''}"
                           data-bank-description="${item.description || ''}"
                           data-status-anterior="CONCILIADA"
                           data-referencia-externa="${systemData.id}"
                           data-match-score="${item.match_score || 1.0}"
                           onchange="toggleTransactionSelection(this)">
                </td>
                <td class="bank-data">${formatDate(bankData.date)}</td>
                <td class="bank-data" title="${bankData.description}">${truncateText(bankData.description, 25)}</td>
                <td class="bank-data">${formatCurrency(bankData.value)}</td>
                <td class="bank-data"><span class="type-badge type-${bankData.type}">${bankData.type === 'expense' ? 'Despesa' : 'Receita'}</span></td>
                <td class="system-data"><code title="${systemData.id}">${truncateText(systemData.id, 8)}</code></td>
                <td class="system-data" title="${systemData.description}">${truncateText(systemData.description, 25)}</td>
                <td class="system-data">${formatCurrency(systemData.value)}</td>
                <td class="system-data" title="${systemData.entity}">${formatDate(systemData.dueDate)}</td>
                <td class="match-info">
                    <span class="score-badge ${getCategoryClass(item.match_category || convertScoreToCategory(item.match_score))}" data-match-id="${item.id || 'unknown'}">${item.match_category || convertScoreToCategory(item.match_score)}</span>
                    ${hasMultipleDocs ? createMultipleDocsButton(relatedDocs) : ''}
                </td>
            `;
            
            // Adicionar tooltip ao score badge
            const scoreBadge = row.querySelector('.score-badge');
            if (scoreBadge) {
                addTooltipListeners(scoreBadge, item);
            }
        }
    });
}

// Preencher tabela de não conciliadas (extrato)
function fillUnmatchedExtratoTable(data) {
    const tbody = document.getElementById('unmatchedExtratoTable');
    tbody.innerHTML = '';

    data.forEach(item => {
        const row = tbody.insertRow();
        row.innerHTML = `
            <td>${formatDate(item.date)}</td>
            <td>${item.description}</td>
            <td>${formatCurrency(item.value)}</td>
            <td><span class="type-badge type-${item.type}">${item.type === 'expense' ? 'Despesa' : 'Receita'}</span></td>
            <td>${item.reason}</td>
        `;
    });
}

// Preencher tabela de sugeridas
function fillSuggestedTable(data) {
    const tbody = document.getElementById('suggestedTable');
    tbody.innerHTML = '';

    data.forEach(item => {
        const row = tbody.insertRow();
        row.classList.add('suggested-row');
        
        const systemData = {
            id: item.matched_document_id || 'N/A',
            description: item.system_description || 'N/A',
            value: item.system_value || item.value,
            dueDate: item.system_due_date || item.system_settlement_date || item.date,
            entity: item.system_entity || 'N/A'
        };
        
        row.innerHTML = `
            <td><input type="checkbox" name="suggested-item" value="${item.id}" data-item='${JSON.stringify(item)}'></td>
            <td class="bank-data">${formatDate(item.date)}</td>
            <td class="bank-data" title="${item.description}">${truncateText(item.description, 25)}</td>
            <td class="bank-data">${formatCurrency(item.value)}</td>
            <td class="bank-data"><span class="type-badge type-${item.type}">${item.type === 'expense' ? 'Despesa' : 'Receita'}</span></td>
            <td class="system-data"><code title="${systemData.id}">${truncateText(systemData.id, 8)}</code></td>
            <td class="system-data" title="${systemData.description}">${truncateText(systemData.description, 25)}</td>
            <td class="system-data">${formatCurrency(systemData.value)}</td>
            <td class="system-data">${formatDate(systemData.dueDate)}</td>
            <td class="match-info">
                <span class="score-badge ${getCategoryClass(item.match_category || convertScoreToCategory(item.match_score))}">${item.match_category || convertScoreToCategory(item.match_score)}</span>
            </td>
        `;
    });
}

// Preencher tabela de transações sem correlação no sistema
function fillNoCorrelationTable(data) {
    const tbody = document.getElementById('noCorrelationTable');
    if (!tbody) {
        console.warn('Tabela noCorrelationTable não encontrada');
        return;
    }
    
    tbody.innerHTML = '';

    data.forEach(item => {
        const row = tbody.insertRow();
        row.classList.add('no-correlation-row');
        
        row.innerHTML = `
            <td>${formatDate(item.date)}</td>
            <td title="${item.description}">${truncateText(item.description, 30)}</td>
            <td>${formatCurrency(item.value)}</td>
            <td><span class="type-badge type-${item.type}">${item.type === 'expense' ? 'Despesa' : 'Receita'}</span></td>
            <td><span class="status-badge no-correlation">Sem Documento</span></td>
            <td>${item.reason || 'Nenhum documento correspondente encontrado no sistema'}</td>
            <td>
                <button class="btn-action btn-small" onclick="searchForDocument('${item.id}')" title="Buscar documento">
                    <i class="fas fa-search"></i>
                </button>
                <button class="btn-action btn-small" onclick="createDocument('${item.id}')" title="Criar documento">
                    <i class="fas fa-plus"></i>
                </button>
            </td>
        `;
    });
}

// Preencher tabela de pendentes
function fillPendingTable(data) {
    const tbody = document.getElementById('pendingTable');
    tbody.innerHTML = '';

    data.forEach(item => {
        const row = tbody.insertRow();
        row.classList.add('pending-row');
        
        // Adicionar classe especial se houver cobrança
        if (item.billing_info) {
            row.classList.add('has-billing');
        }
        
        const systemData = {
            id: item.matched_document_id || item.mongo_document?.id || 'N/A',
            description: item.system_description || item.mongo_document?.descricao || 'N/A',
            value: item.system_value || item.value,
            dueDate: item.system_due_date || item.system_settlement_date || item.date,
            entity: item.system_entity || 'N/A'
        };
        
        // Preparar informações de cobrança se existirem
        let billingDisplay = '';
        let valueDisplay = formatCurrency(systemData.value);
        
        if (item.billing_info) {
            const bi = item.billing_info;
            
            // Adicionar badge de cobrança na descrição
            billingDisplay = `
                <div style="margin-top: 4px;">
                    <span style="background: #fee2e2; color: #991b1b; padding: 2px 6px; border-radius: 4px; font-size: 11px;">
                        <i class="fas fa-exclamation-circle"></i> ${bi.days_late} dias vencido
                    </span>
                </div>
            `;
            
            // Mostrar valor original e valor com encargos
            valueDisplay = `
                <div>${formatCurrency(systemData.value)}</div>
                <div style="color: #dc2626; font-size: 11px; margin-top: 2px;">
                    + Multa: ${formatCurrency(bi.fine_amount)}<br>
                    + Juros: ${formatCurrency(bi.interest_amount)}<br>
                    <strong>Total: ${formatCurrency(bi.final_value)}</strong>
                </div>
            `;
        }
        
        row.innerHTML = `
            <td><input type="checkbox" name="pending-item" value="${item.id}" data-item='${JSON.stringify(item)}'></td>
            <td class="bank-data">${formatDate(item.date)}</td>
            <td class="bank-data" title="${item.description}">${truncateText(item.description, 25)}</td>
            <td class="bank-data">${formatCurrency(item.value)}</td>
            <td class="bank-data"><span class="type-badge type-${item.type}">${item.type === 'expense' ? 'Despesa' : 'Receita'}</span></td>
            <td class="system-data"><code title="${systemData.id}">${truncateText(systemData.id, 8)}</code></td>
            <td class="system-data" title="${systemData.description}">
                ${truncateText(systemData.description, 25)}
                ${billingDisplay}
            </td>
            <td class="system-data">${valueDisplay}</td>
            <td class="system-data">${formatDate(systemData.dueDate)}</td>
            <td class="match-info">
                <span class="score-badge ${getCategoryClass(item.match_category || convertScoreToCategory(item.match_score))}">${item.match_category || convertScoreToCategory(item.match_score)}</span>
                ${item.billing_info ? `<br><small style="color: #dc2626;">Regra: ${item.billing_info.rule_applied}</small>` : ''}
            </td>
        `;
    });
}


// Preencher tabela de não conciliadas (MongoDB)
function fillUnmatchedMongoTable(data) {
    const tbody = document.getElementById('unmatchedMongoTable');
    tbody.innerHTML = '';

    data.forEach(item => {
        const row = tbody.insertRow();
        
        // Verificar se são dados ocultos por segurança
        if (item.total_unmatched_documents) {
            row.innerHTML = `
                <td colspan="5" class="security-message">
                    <div class="security-info">
                        <i class="fas fa-shield-alt"></i>
                        <strong>${item.message}</strong>
                        <br><small>${item.note}</small>
                        <br><em>Total de documentos: ${item.total_unmatched_documents}</em>
                    </div>
                </td>
            `;
        } else {
            row.innerHTML = `
                <td><code>${item.document_id}</code></td>
                <td>${item.description}</td>
                <td>${formatCurrency(item.value)}</td>
                <td>${formatDate(item.due_date)}</td>
                <td>${formatDate(item.settlement_date)}</td>
            `;
        }
    });
}

// Alternar entre abas
function switchTab(tabName) {
    // Remover classe active de todas as abas
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

    // Adicionar classe active na aba selecionada
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    document.getElementById(`${tabName}-tab`).classList.add('active');
}

// Baixar relatório
function downloadReport() {
    if (!currentResults) {
        showError('Nenhum resultado disponível para download.');
        return;
    }

    const dataStr = JSON.stringify(currentResults, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    
    const link = document.createElement('a');
    link.href = URL.createObjectURL(dataBlob);
    link.download = `relatorio_conciliacao_${new Date().toISOString().split('T')[0]}.json`;
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Resetar formulário
function resetForm() {
    currentFile = null;
    currentResults = null;
    isStreamingMode = false; // Resetar modo streaming
    
    elements.fileInfo.style.display = 'none';
    elements.dropZone.style.display = 'block';
    elements.uploadBtn.disabled = true;
    elements.structureBtn.disabled = true;
    elements.structureBtn.style.display = 'none';
    elements.fileStructureFields.style.display = 'none';
    elements.clearBtn.style.display = 'none';
    elements.progressSection.style.display = 'none';
    elements.resultsSection.style.display = 'none';
    elements.errorSection.style.display = 'none';
    elements.fileInput.value = '';
    
    // Campos OFX removidos - não há mais campos para limpar
}

// Mostrar erro
function showError(message) {
    elements.errorMessage.textContent = message;
    elements.errorSection.style.display = 'block';
    elements.progressSection.style.display = 'none';
    elements.resultsSection.style.display = 'none';
}

// Mostrar configurações da API
async function showApiConfig() {
    try {
        const response = await fetch(`${API_BASE_URL}/config`);
        const config = await response.json();
        
        elements.modalTitle.textContent = 'Configurações da API';
        elements.modalBody.innerHTML = `
            <div class="config-grid">
                <div class="config-item">
                    <label>Banco de Dados:</label>
                    <span>${config.database}</span>
                </div>
                <div class="config-item">
                    <label>Tolerância de Valor:</label>
                    <span>${config.value_tolerance}</span>
                </div>
                <div class="config-item">
                    <label>Tolerância de Data:</label>
                    <span>${config.date_tolerance}</span>
                </div>
                <div class="config-item">
                    <label>Limite de Descrição:</label>
                    <span>${config.description_threshold}</span>
                </div>
                <div class="config-item">
                    <label>Formatos Aceitos:</label>
                    <span>${config.allowed_extensions.join(', ')}</span>
                </div>
                <div class="config-item">
                    <label>Tamanho Máximo:</label>
                    <span>${config.max_file_size}</span>
                </div>
            </div>
        `;
        
        elements.modal.style.display = 'flex';
    } catch (error) {
        showError('Não foi possível carregar as configurações da API.');
    }
}

// Mostrar ajuda
function showHelp() {
    elements.modalTitle.textContent = 'Ajuda - Como Usar';
    elements.modalBody.innerHTML = `
        <div class="help-content">
            <h4>📁 Formatos Aceitos</h4>
            <ul>
                <li><strong>OFX:</strong> Formato padrão bancário Open Financial Exchange</li>
                <li><strong>CSV:</strong> Planilha com colunas: Data, Descrição, Valor</li>
                <li><strong>TXT:</strong> Arquivo texto com formato: data;descrição;valor</li>
                <li><strong>XLS:</strong> Planilha Excel com dados de transações</li>
            </ul>
            
            <h4>📊 Processo de Conciliação</h4>
            <ol>
                <li>Faça upload do seu extrato bancário</li>
                <li>O sistema analisa automaticamente as transações</li>
                <li>IA compara com documentos no banco de dados</li>
                <li>Receba relatório detalhado de conciliação</li>
            </ol>
            
            <h4>🎯 Critérios de Conciliação</h4>
            <ul>
                <li><strong>Valor:</strong> Diferença máxima de 10%</li>
                <li><strong>Data:</strong> ±1 dia de tolerância</li>
                <li><strong>Descrição:</strong> Análise semântica com IA</li>
            </ul>
            
            <h4>📋 Tipos de Resultado</h4>
            <ul>
                <li><strong>Conciliadas:</strong> Transações encontradas no sistema</li>
                <li><strong>Não Conciliadas (Extrato):</strong> Não encontradas no sistema</li>
                <li><strong>Não Conciliadas (Sistema):</strong> Documentos sem correspondência</li>
            </ul>
        </div>
    `;
    
    elements.modal.style.display = 'flex';
}

// Fechar modal
function closeModal() {
    elements.modal.style.display = 'none';
}

// Funções utilitárias
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatCurrency(value) {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(Math.abs(value));
}

function formatDate(dateStr) {
    if (!dateStr) return '-';
    try {
        const date = new Date(dateStr);
        return date.toLocaleDateString('pt-BR');
    } catch {
        return dateStr;
    }
}

function truncateText(text, maxLength) {
    if (!text) return '-';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
}

function getScoreClass(score) {
    if (score >= 0.8) return 'score-high';
    if (score >= 0.6) return 'score-medium';
    return 'score-low';
}

function convertScoreToCategory(score) {
    if (score >= 0.7) return 'ALTA';
    if (score >= 0.4) return 'MEDIA';
    return 'BAIXA';
}

function getCategoryClass(category) {
    switch(category) {
        case 'ALTA': return 'score-high';
        case 'MEDIA': return 'score-medium';
        case 'BAIXA': return 'score-low';
        default: return 'score-low';
    }
}

// CSS adicional para elementos dinâmicos
const additionalCSS = `
    .config-grid {
        display: grid;
        gap: 1rem;
    }
    
    .config-item {
        display: flex;
        justify-content: space-between;
        padding: 0.75rem;
        background: var(--background);
        border-radius: 0.375rem;
    }
    
    .config-item label {
        font-weight: 600;
        color: var(--text-primary);
    }
    
    .config-item span {
        color: var(--text-secondary);
        font-family: monospace;
    }
    
    .help-content h4 {
        color: var(--primary-color);
        margin: 1.5rem 0 0.5rem 0;
    }
    
    .help-content h4:first-child {
        margin-top: 0;
    }
    
    .help-content ul,
    .help-content ol {
        margin-left: 1.5rem;
        margin-bottom: 1rem;
    }
    
    .help-content li {
        margin-bottom: 0.5rem;
    }
    
    .group-row {
        background: #f8fafc !important;
        border-left: 4px solid var(--primary-color);
    }
    
    .group-header {
        font-size: 0.95rem;
        margin-bottom: 0.25rem;
    }
    
    .group-details {
        font-size: 0.85rem;
        color: var(--text-secondary);
    }
    
    /* Estilos para múltiplos documentos */
    .multiple-docs-container {
        position: relative;
        display: inline-block;
        margin-left: 0.5rem;
    }
    
    .multiple-docs-btn {
        background: var(--info-color);
        color: white;
        border: none;
        border-radius: 50%;
        width: 24px;
        height: 24px;
        font-size: 0.75rem;
        cursor: pointer;
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
    }
    
    .multiple-docs-btn:hover {
        background: var(--primary-color);
        transform: scale(1.1);
    }
    
    .docs-count {
        position: absolute;
        top: -8px;
        right: -8px;
        background: var(--error-color);
        color: white;
        border-radius: 50%;
        width: 16px;
        height: 16px;
        font-size: 0.7rem;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: bold;
    }
    
    .docs-tooltip {
        visibility: hidden;
        opacity: 0;
        position: absolute;
        bottom: 100%;
        right: 0;
        margin-bottom: 8px;
        background: var(--text-primary);
        color: white;
        border-radius: 0.5rem;
        padding: 0;
        box-shadow: var(--shadow-lg);
        z-index: 1000;
        min-width: 350px;
        max-width: 450px;
        transition: all 0.3s ease;
        transform: translateY(10px);
    }
    
    .multiple-docs-container:hover .docs-tooltip {
        visibility: visible;
        opacity: 1;
        transform: translateY(0);
    }
    
    .docs-tooltip-header {
        background: var(--primary-color);
        color: white;
        padding: 0.75rem;
        border-radius: 0.5rem 0.5rem 0 0;
        font-size: 0.9rem;
        border-bottom: 1px solid rgba(255,255,255,0.2);
    }
    
    .docs-tooltip-content {
        padding: 0.75rem;
        max-height: 300px;
        overflow-y: auto;
    }
    
    .tooltip-doc {
        margin-bottom: 0.75rem;
        padding: 0.5rem;
        background: rgba(255,255,255,0.1);
        border-radius: 0.25rem;
    }
    
    .tooltip-doc:last-child {
        margin-bottom: 0;
    }
    
    .tooltip-value {
        color: var(--success-color);
        font-weight: bold;
    }
    
    .tooltip-entity {
        color: var(--text-secondary);
        font-size: 0.85rem;
    }
    
    .tooltip-bank {
        color: var(--info-color);
        font-style: italic;
    }
    
    .tooltip-divider {
        border: none;
        border-top: 1px solid rgba(255,255,255,0.2);
        margin: 0.5rem 0;
    }
    
    /* Seta do tooltip */
    .docs-tooltip::after {
        content: '';
        position: absolute;
        top: 100%;
        right: 20px;
        border: 8px solid transparent;
        border-top-color: var(--text-primary);
    }
`;

// Função para encontrar documentos relacionados
function findRelatedDocuments(currentItem, allItems) {
    const relatedDocs = [];
    
    // Adicionar o documento atual
    relatedDocs.push({
        id: currentItem.matched_document_id,
        description: currentItem.system_description,
        value: currentItem.system_value,
        entity: currentItem.system_entity,
        due_date: currentItem.system_due_date,
        settlement_date: currentItem.system_settlement_date,
        bank_description: currentItem.description,
        bank_value: currentItem.value,
        bank_date: currentItem.date
    });
    
    // Buscar outros documentos com descrição similar (mesmo fornecedor/entidade)
    const currentEntity = (currentItem.system_entity || '').toLowerCase().trim();
    const currentDesc = (currentItem.system_description || '').toLowerCase();
    
    if (currentEntity && currentEntity.length > 3) {
        allItems.forEach(otherItem => {
            if (otherItem.matched_document_id !== currentItem.matched_document_id && otherItem.type !== 'group') {
                const otherEntity = (otherItem.system_entity || '').toLowerCase().trim();
                const otherDesc = (otherItem.system_description || '').toLowerCase();
                
                // Se mesmo fornecedor ou descrição muito similar
                if ((otherEntity && (otherEntity.includes(currentEntity) || currentEntity.includes(otherEntity))) || 
                    (otherDesc && currentDesc && calculateSimilarity(currentDesc, otherDesc) > 0.6)) {
                    
                    relatedDocs.push({
                        id: otherItem.matched_document_id,
                        description: otherItem.system_description,
                        value: otherItem.system_value,
                        entity: otherItem.system_entity,
                        due_date: otherItem.system_due_date,
                        settlement_date: otherItem.system_settlement_date,
                        bank_description: otherItem.description,
                        bank_value: otherItem.value,
                        bank_date: otherItem.date
                    });
                }
            }
        });
    }
    
    return relatedDocs;
}

// Função para calcular similaridade básica entre strings
function calculateSimilarity(str1, str2) {
    if (!str1 || !str2) return 0;
    
    const words1 = str1.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    const words2 = str2.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    
    if (words1.length === 0 || words2.length === 0) return 0;
    
    const commonWords = words1.filter(word => words2.includes(word));
    return commonWords.length / Math.max(words1.length, words2.length);
}

// Criar botão para múltiplos documentos
function createMultipleDocsButton(relatedDocs) {
    const docsHtml = relatedDocs.map(doc => `
        <div class="tooltip-doc">
            <strong>${truncateText(doc.description, 35)}</strong><br>
            <span class="tooltip-value">💰 ${formatCurrency(doc.value)}</span><br>
            <span class="tooltip-entity">🏢 ${doc.entity || 'N/A'}</span>
            ${doc.bank_description ? `<br><span class="tooltip-bank">🏦 ${truncateText(doc.bank_description, 30)} (R$ ${formatCurrency(doc.bank_value)})</span>` : ''}
            ${doc.due_date ? `<br><span class="tooltip-entity">📅 ${formatDate(doc.due_date)}</span>` : ''}
        </div>
    `).join('<hr class="tooltip-divider">');
    
    return `
        <div class="multiple-docs-container">
            <button class="multiple-docs-btn" title="Múltiplos documentos relacionados">
                <i class="fas fa-layer-group"></i>
                <span class="docs-count">${relatedDocs.length}</span>
            </button>
            <div class="docs-tooltip">
                <div class="docs-tooltip-header">
                    <i class="fas fa-file-alt"></i> Documentos Relacionados (${relatedDocs.length})
                </div>
                <div class="docs-tooltip-content">
                    ${docsHtml}
                </div>
            </div>
        </div>
    `;
}

// Adicionar CSS dinâmico
const style = document.createElement('style');
style.textContent = additionalCSS;
document.head.appendChild(style);

// Funções para transações sem correlação
function searchForDocument(transactionId) {
    alert(`Funcionalidade em desenvolvimento:\n\nBuscar documento para transação ID: ${transactionId}\n\nEsta função permitirá buscar manualmente um documento no sistema.`);
}

function createDocument(transactionId) {
    alert(`Funcionalidade em desenvolvimento:\n\nCriar documento para transação ID: ${transactionId}\n\nEsta função permitirá criar um novo documento no sistema baseado na transação bancária.`);
}

// Sistema de Tooltips para Match Details
let currentTooltip = null;

function createMatchTooltip(matchData) {
    const tooltip = document.createElement('div');
    tooltip.className = 'match-tooltip';
    
    // Extrair informações do match
    const scoreBreakdown = extractScoreBreakdown(matchData);
    const matchDetails = extractMatchDetails(matchData);
    
    tooltip.innerHTML = `
        <div class="tooltip-header">
            <i class="fas fa-analytics"></i>
            Detalhes da Conciliação
        </div>
        
        <div class="tooltip-section">
            <h6>Informações Gerais</h6>
            <div class="tooltip-match-item">
                <span class="label">Score Total:</span>
                <span class="value success">${(matchData.match_score * 100).toFixed(1)}%</span>
            </div>
            <div class="tooltip-match-item">
                <span class="label">Tipo de Match:</span>
                <span class="value info">${matchDetails.matchType}</span>
            </div>
            <div class="tooltip-match-item">
                <span class="label">Confiança:</span>
                <span class="value ${getScoreClass(matchData.match_score)}">${getConfidenceLevel(matchData.match_score)}</span>
            </div>
        </div>
        
        <div class="tooltip-section">
            <h6>Critérios de Comparação</h6>
            <div class="tooltip-score-breakdown">
                ${scoreBreakdown.map(item => `
                    <div class="tooltip-score-item">
                        <span class="weight">${item.label}:</span>
                        <span class="score ${item.class}">${item.score}</span>
                    </div>
                `).join('')}
            </div>
        </div>
        
        ${matchDetails.observations ? `
            <div class="tooltip-section">
                <h6>Observações</h6>
                <div style="color: var(--text-secondary); font-size: 0.75rem; line-height: 1.3;">
                    ${matchDetails.observations}
                </div>
            </div>
        ` : ''}
    `;
    
    document.body.appendChild(tooltip);
    return tooltip;
}

function extractScoreBreakdown(matchData) {
    // Simular breakdown baseado no score total
    const totalScore = matchData.match_score;
    
    // Calcular scores individuais baseados em heurísticas
    const valueScore = matchData.value_match_score || (totalScore > 0.8 ? 0.95 : totalScore * 1.1);
    const dateScore = matchData.date_match_score || (totalScore > 0.7 ? 0.85 : totalScore * 0.9);
    const descScore = matchData.description_match_score || totalScore;
    
    return [
        {
            label: 'Valor',
            score: `${(valueScore * 100).toFixed(0)}%`,
            class: getScoreClass(valueScore)
        },
        {
            label: 'Data',
            score: `${(dateScore * 100).toFixed(0)}%`,
            class: getScoreClass(dateScore)
        },
        {
            label: 'Descrição',
            score: `${(descScore * 100).toFixed(0)}%`,
            class: getScoreClass(descScore)
        }
    ];
}

function extractMatchDetails(matchData) {
    const score = matchData.match_score;
    let matchType = 'Direto';
    let observations = '';
    
    // Determinar tipo de match baseado nos dados
    if (matchData.type === 'group') {
        matchType = 'Agrupamento';
        observations = 'Múltiplas transações/documentos relacionados';
    } else if (matchData.system_value !== matchData.value) {
        matchType = 'Parcial/Múltiplo';
        observations = 'Valores diferentes - possível parcelamento ou agrupamento';
    } else if (score < 0.8) {
        matchType = 'Aproximado';
        observations = 'Match baseado em similaridade de critérios';
    }
    
    return {
        matchType,
        observations
    };
}

function getConfidenceLevel(score) {
    if (score >= 0.9) return 'Muito Alta';
    if (score >= 0.8) return 'Alta';
    if (score >= 0.6) return 'Média';
    if (score >= 0.4) return 'Baixa';
    return 'Muito Baixa';
}

function showMatchTooltip(event, matchData) {
    // Remove tooltip anterior se existir
    if (currentTooltip) {
        currentTooltip.remove();
        currentTooltip = null;
    }
    
    // Cria novo tooltip
    currentTooltip = createMatchTooltip(matchData);
    
    // Posiciona o tooltip
    const rect = event.target.getBoundingClientRect();
    const tooltip = currentTooltip;
    
    // Posição inicial
    let top = rect.bottom + window.scrollY + 10;
    let left = rect.left + window.scrollX;
    
    // Ajustar se sair da tela
    const tooltipRect = tooltip.getBoundingClientRect();
    
    // Ajustar horizontalmente
    if (left + 300 > window.innerWidth) {
        left = rect.right + window.scrollX - 300;
    }
    
    // Ajustar verticalmente
    if (top + tooltipRect.height > window.innerHeight + window.scrollY) {
        top = rect.top + window.scrollY - tooltipRect.height - 10;
    }
    
    tooltip.style.top = `${top}px`;
    tooltip.style.left = `${left}px`;
    tooltip.classList.add('show');
}

function hideMatchTooltip() {
    if (currentTooltip) {
        currentTooltip.classList.remove('show');
        setTimeout(() => {
            if (currentTooltip) {
                currentTooltip.remove();
                currentTooltip = null;
            }
        }, 200);
    }
}

// Adicionar event listeners para tooltips quando criar score badges
function addTooltipListeners(scoreBadge, matchData) {
    scoreBadge.addEventListener('mouseenter', (e) => {
        showMatchTooltip(e, matchData);
    });
    
    scoreBadge.addEventListener('mouseleave', () => {
        hideMatchTooltip();
    });
    
    // Também esconder quando sair da área da tabela
    scoreBadge.closest('.results-table').addEventListener('mouseleave', () => {
        hideMatchTooltip();
    });
}

// Função para encontrar documentos relacionados adicionais
function findRelatedDocumentsByEntity(entity, allItems) {
    if (!entity || entity.length < 3) return [];
    
    const relatedItems = [];
    const entityLower = entity.toLowerCase().trim();
    
    allItems.forEach(item => {
        if (item.type !== 'group' && item.system_entity) {
            const itemEntity = (item.system_entity || '').toLowerCase().trim();
            
            if (itemEntity && (itemEntity.includes(entityLower) || entityLower.includes(itemEntity))) {
                relatedItems.push({
                    id: item.matched_document_id,
                    description: item.system_description,
                    value: item.system_value,
                    entity: item.system_entity,
                    due_date: item.system_due_date,
                    settlement_date: item.system_settlement_date,
                    bank_description: item.description,
                    bank_value: item.value,
                    bank_date: item.date
                });
            }
        }
    });
    
    return relatedItems;
}

// Funções auxiliares para modals e configurações
window.showApiConfig = function() {
    alert('Configurações da API\n\nURL atual: ' + API_BASE_URL + '\n\nPara alterar, edite a variável API_BASE_URL no código.');
};

window.showHelp = function() {
    alert('Manual de Ajuda\n\n1. Faça upload de um extrato bancário\n2. Configure regras de cobrança se necessário\n3. A conciliação será feita automaticamente\n4. Revise os resultados nas abas');
};

window.refreshRulesList = function() {
    console.log('🔄 Atualizando lista de regras...');
    if (typeof loadRulesFromLocal === 'function') {
        loadRulesFromLocal();
    }
};

// Função para mostrar calculadora
window.showCalculator = function() {
    alert('Calculadora de Juros e Multas\n\nFuncionalidade em desenvolvimento.\n\nEm breve você poderá testar cálculos de juros e multas.');
};

// Função para formatação de valores monetários com sinal
function formatCurrencyWithSign(value) {
    const formatted = new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(Math.abs(value));
    
    return value >= 0 ? `+${formatted}` : `-${formatted}`;
}

// Função para validar se um elemento existe antes de usar
function safeQuerySelector(selector) {
    const element = document.querySelector(selector);
    if (!element) {
        console.warn(`Elemento não encontrado: ${selector}`);
    }
    return element;
}

// Função para debug - log de informações detalhadas
function debugLog(message, data = null) {
    if (typeof console !== 'undefined' && console.log) {
        console.log(`[DEBUG] ${message}`, data || '');
    }
}

// Funcões para gerenciar status de conciliação
function toggleSelectAll(status) {
    const selectAllCheckbox = document.getElementById(`selectAll${status.charAt(0).toUpperCase() + status.slice(1)}`);
    const itemCheckboxes = document.querySelectorAll(`input[name="${status}-item"]`);
    
    itemCheckboxes.forEach(checkbox => {
        checkbox.checked = selectAllCheckbox.checked;
    });
    
    updateActionButtons(status);
}

function updateActionButtons(status) {
    const checkedItems = document.querySelectorAll(`input[name="${status}-item"]:checked`);
    const approveBtn = document.querySelector(`#${status}-tab .btn-approve`);
    const rejectBtn = document.querySelector(`#${status}-tab .btn-reject`);
    
    if (approveBtn && rejectBtn) {
        approveBtn.disabled = checkedItems.length === 0;
        rejectBtn.disabled = checkedItems.length === 0;
    }
}

async function approveSelectedItems(status) {
    const checkedItems = document.querySelectorAll(`input[name="${status}-item"]:checked`);
    
    if (checkedItems.length === 0) {
        alert('Selecione pelo menos um item para aprovar.');
        return;
    }
    
    const itemIds = Array.from(checkedItems).map(checkbox => checkbox.value);
    
    try {
        showProgress();
        updateProgress(30, 'Aprovando itens selecionados...');
        
        const response = await fetch(`${API_BASE_URL}/reconciliation/approve`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                item_ids: itemIds
            })
        });
        
        const result = await response.json();
        
        if (response.ok && result.success) {
            updateProgress(100, 'Itens aprovados com sucesso!');
            
            // Remover itens aprovados da tabela atual
            checkedItems.forEach(checkbox => {
                const row = checkbox.closest('tr');
                const itemData = JSON.parse(checkbox.dataset.item);
                
                // Adicionar à tabela de conciliados
                const conciliatedTableBody = document.getElementById('conciliatedTable');
                const newRow = conciliatedTableBody.insertRow();
                newRow.innerHTML = createConciliatedRowHTML(itemData);
                
                // Remover da tabela atual
                row.remove();
            });
            
            // Atualizar contadores
            updateCountersAfterApproval(itemIds.length, status);
            
            setTimeout(() => {
                hideProgress();
                alert(`${itemIds.length} item(s) aprovado(s) e movido(s) para Conciliadas!`);
            }, 1000);
            
        } else {
            throw new Error(result.error || 'Erro na aprovação');
        }
        
    } catch (error) {
        hideProgress();
        alert(`Erro ao aprovar itens: ${error.message}`);
        console.error('Erro na aprovação:', error);
    }
}

async function rejectSelectedItems(status) {
    const checkedItems = document.querySelectorAll(`input[name="${status}-item"]:checked`);
    
    if (checkedItems.length === 0) {
        alert('Selecione pelo menos um item para rejeitar.');
        return;
    }
    
    const reason = prompt('Digite o motivo da rejeição (opcional):') || 'Rejeitado pelo usuário';
    const itemIds = Array.from(checkedItems).map(checkbox => checkbox.value);
    
    try {
        showProgress();
        updateProgress(30, 'Rejeitando itens selecionados...');
        
        const response = await fetch(`${API_BASE_URL}/reconciliation/reject`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                item_ids: itemIds,
                reason: reason
            })
        });
        
        const result = await response.json();
        
        if (response.ok && result.success) {
            updateProgress(100, 'Itens rejeitados com sucesso!');
            
            // Remover itens rejeitados da tabela
            checkedItems.forEach(checkbox => {
                const row = checkbox.closest('tr');
                row.remove();
            });
            
            // Atualizar contadores
            updateCountersAfterRejection(itemIds.length, status);
            
            setTimeout(() => {
                hideProgress();
                alert(`${itemIds.length} item(s) rejeitado(s)!`);
            }, 1000);
            
        } else {
            throw new Error(result.error || 'Erro na rejeição');
        }
        
    } catch (error) {
        hideProgress();
        alert(`Erro ao rejeitar itens: ${error.message}`);
        console.error('Erro na rejeição:', error);
    }
}

function createConciliatedRowHTML(itemData) {
    const systemData = {
        id: itemData.matched_document_id || 'N/A',
        description: itemData.system_description || 'N/A',
        value: itemData.system_value || itemData.value,
        dueDate: itemData.system_due_date || itemData.system_settlement_date || itemData.date,
        entity: itemData.system_entity || 'N/A'
    };
    
    return `
        <td>
            <input type="checkbox" 
                   class="transaction-checkbox" 
                   data-status="conciliated"
                   data-transaction-id="${itemData.id || itemData.transaction_id || ''}"
                   data-tipo="${itemData.type || 'expense'}"
                   data-valor="${itemData.value || 0}"
                   data-data="${itemData.date || ''}"
                   data-description="${itemData.description || ''}"
                   data-bank-description="${itemData.description || ''}"
                   data-status-anterior="CONCILIADA"
                   data-referencia-externa="${systemData.id}"
                   data-match-score="${itemData.match_score || 1.0}"
                   onchange="toggleTransactionSelection(this)">
        </td>
        <td class="bank-data">${formatDate(itemData.date)}</td>
        <td class="bank-data" title="${itemData.description}">${truncateText(itemData.description, 25)}</td>
        <td class="bank-data">${formatCurrency(itemData.value)}</td>
        <td class="bank-data"><span class="type-badge type-${itemData.type}">${itemData.type === 'expense' ? 'Despesa' : 'Receita'}</span></td>
        <td class="system-data"><code title="${systemData.id}">${truncateText(systemData.id, 8)}</code></td>
        <td class="system-data" title="${systemData.description}">${truncateText(systemData.description, 25)}</td>
        <td class="system-data">${formatCurrency(systemData.value)}</td>
        <td class="system-data">${formatDate(systemData.dueDate)}</td>
        <td class="match-info">
            <span class="score-badge score-high">CONCILIADA</span>
            <small class="approved-label">✓ Aprovada manualmente</small>
        </td>
    `;
}

function updateCountersAfterApproval(approvedCount, fromStatus) {
    // Aumentar contador de conciliadas
    const conciliatedElement = document.getElementById('conciliatedCount');
    const currentConciliated = parseInt(conciliatedElement.textContent) || 0;
    conciliatedElement.textContent = currentConciliated + approvedCount;
    
    // Diminuir contador do status origem
    if (fromStatus === 'suggested') {
        const suggestedElement = document.getElementById('suggestedCount');
        const currentSuggested = parseInt(suggestedElement.textContent) || 0;
        suggestedElement.textContent = Math.max(0, currentSuggested - approvedCount);
    } else if (fromStatus === 'pending') {
        const pendingElement = document.getElementById('pendingCount');
        const currentPending = parseInt(pendingElement.textContent) || 0;
        pendingElement.textContent = Math.max(0, currentPending - approvedCount);
    }
}

function updateCountersAfterRejection(rejectedCount, fromStatus) {
    // Diminuir contador do status origem
    if (fromStatus === 'suggested') {
        const suggestedElement = document.getElementById('suggestedCount');
        const currentSuggested = parseInt(suggestedElement.textContent) || 0;
        suggestedElement.textContent = Math.max(0, currentSuggested - rejectedCount);
    } else if (fromStatus === 'pending') {
        const pendingElement = document.getElementById('pendingCount');
        const currentPending = parseInt(pendingElement.textContent) || 0;
        pendingElement.textContent = Math.max(0, currentPending - rejectedCount);
    }
}

// Adicionar event listeners para checkboxes quando as tabelas são preenchidas
document.addEventListener('change', function(e) {
    if (e.target.type === 'checkbox' && (e.target.name === 'suggested-item' || e.target.name === 'pending-item')) {
        const status = e.target.name.split('-')[0];
        updateActionButtons(status);
    }
});

// ===== NAVEGAÇÃO ENTRE SEÇÕES =====
window.switchMainSection = function(sectionName) {
    // Remover classe ativa de todas as abas e seções
    document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelectorAll('.main-section').forEach(section => {
        section.classList.remove('active');
        section.style.display = 'none';
    });
    
    // Ativar a aba e seção selecionadas
    const activeTab = document.querySelector(`[data-section="${sectionName}"]`);
    const activeSection = document.getElementById(`${sectionName}-section`);
    
    if (activeTab && activeSection) {
        activeTab.classList.add('active');
        activeSection.classList.add('active');
        activeSection.style.display = 'block';
        
        // Carregamento específico por seção
        if (sectionName === 'billing-rules') {
            console.log('🔄 Ativando seção de billing-rules...');
            // Verificar se o módulo de billing rules existe e inicializar
            if (typeof initializeBillingRules === 'function') {
                console.log('✅ Função initializeBillingRules encontrada, inicializando...');
                initializeBillingRules();
            } else if (typeof loadRules === 'function') {
                console.log('⚠️ Usando fallback loadRules...');
                loadRules();
            } else {
                console.error('❌ Funções de billing rules não encontradas!');
            }
        }
        
        console.log(`Seção ativa: ${sectionName}`);
    } else {
        console.error(`Seção não encontrada: ${sectionName}`);
    }
}

function initializeSections() {
    console.log('Inicializando seções principais...');
    
    // Garantir que a seção de conciliação esteja ativa por padrão
    const reconciliationSection = document.getElementById('reconciliation-section');
    if (reconciliationSection) {
        reconciliationSection.classList.add('active');
        reconciliationSection.style.display = 'block';
    }
    
    // Esconder outras seções
    document.querySelectorAll('.main-section').forEach(section => {
        if (section.id !== 'reconciliation-section') {
            section.style.display = 'none';
        }
    });
    
    // Verificar se elementos das regras de cobrança existem
    const billingRulesSection = document.getElementById('billing-rules-section');
    if (billingRulesSection) {
        console.log('Seção de regras de cobrança encontrada');
        
        // Verificar se o script de billing rules foi carregado
        if (typeof loadRules === 'function') {
            console.log('Módulo de regras de cobrança carregado');
        } else {
            console.warn('Módulo de regras de cobrança não carregado ainda');
        }
    }
    
    console.log('Inicialização de seções concluída');
}

// ===== FUNCIONALIDADES DE LIQUIDAÇÃO =====

// Variáveis globais para liquidação
let selectedTransactions = [];
let currentReconciliationResults = null;

// Função para atualizar o botão de liquidar e interface
function updateLiquidateButton() {
    const liquidateBtn = document.getElementById('liquidateSelectedBtn');
    const selectedCount = document.getElementById('selectedCount');
    const selectedTotalValue = document.getElementById('selectedTotalValue');
    const selectionInfo = document.getElementById('conciliatedSelectionInfo');
    
    // Calcular total de valor selecionado
    const totalValue = selectedTransactions.reduce((sum, trans) => sum + trans.valor, 0);
    
    if (liquidateBtn) {
        if (selectedTransactions.length > 0) {
            liquidateBtn.style.display = 'inline-flex';
            liquidateBtn.disabled = false;
            liquidateBtn.innerHTML = `<i class="fas fa-stamp"></i> Liquidar ${selectedTransactions.length} Selecionados`;
        } else {
            liquidateBtn.style.display = 'none';
            liquidateBtn.disabled = true;
        }
    }
    
    // Atualizar info de seleção
    if (selectionInfo) {
        if (selectedTransactions.length > 0) {
            selectionInfo.style.display = 'flex';
        } else {
            selectionInfo.style.display = 'none';
        }
    }
    
    // Atualizar contadores
    if (selectedCount) {
        selectedCount.textContent = selectedTransactions.length;
    }
    
    if (selectedTotalValue) {
        selectedTotalValue.textContent = formatCurrency(totalValue);
    }
}

// Função para toggle de seleção de todas as transações conciliadas
window.toggleSelectAllConciliated = function() {
    const selectAllCheckbox = document.getElementById('selectAllConciliated');
    const checkboxes = document.querySelectorAll('.transaction-checkbox[data-status="conciliated"]');
    
    checkboxes.forEach(checkbox => {
        checkbox.checked = selectAllCheckbox.checked;
        toggleTransactionSelection(checkbox);
    });
};

// Função para alternar seleção de transação individual
window.toggleTransactionSelection = function(checkbox) {
    const transactionData = {
        id: checkbox.dataset.transactionId,
        tipo: checkbox.dataset.tipo,
        valor: parseFloat(checkbox.dataset.valor) || 0,
        data: checkbox.dataset.data,
        description: checkbox.dataset.description,
        bankDescription: checkbox.dataset.bankDescription,
        statusAnterior: checkbox.dataset.statusAnterior || 'CONCILIADA',
        referenciaExterna: checkbox.dataset.referenciaExterna,
        matchScore: parseFloat(checkbox.dataset.matchScore) || 1.0
    };
    
    const row = checkbox.closest('tr');
    
    if (checkbox.checked) {
        // Adicionar à seleção
        selectedTransactions.push(transactionData);
        row.classList.add('selected');
    } else {
        // Remover da seleção
        selectedTransactions = selectedTransactions.filter(t => t.id !== transactionData.id);
        row.classList.remove('selected');
        
        // Desmarcar "selecionar todas" se necessário
        const selectAllCheckbox = document.getElementById('selectAllConciliated');
        if (selectAllCheckbox) {
            selectAllCheckbox.checked = false;
        }
    }
    
    updateLiquidateButton();
};

// Função para limpar todas as seleções
window.clearAllSelections = function() {
    // Limpar array de transações selecionadas
    selectedTransactions = [];
    
    // Desmarcar todos os checkboxes
    document.querySelectorAll('.transaction-checkbox').forEach(checkbox => {
        checkbox.checked = false;
    });
    
    // Remover classe selected das linhas
    document.querySelectorAll('tr.selected').forEach(row => {
        row.classList.remove('selected');
    });
    
    // Desmarcar "selecionar todas"
    const selectAllCheckbox = document.getElementById('selectAllConciliated');
    if (selectAllCheckbox) {
        selectAllCheckbox.checked = false;
    }
    
    // Atualizar interface
    updateLiquidateButton();
    
    // Animação suave para o info de seleção
    const selectionInfo = document.getElementById('conciliatedSelectionInfo');
    if (selectionInfo) {
        selectionInfo.style.animation = 'fadeOut 0.3s ease';
        setTimeout(() => {
            selectionInfo.style.animation = '';
        }, 300);
    }
};

// Função para abrir modal de liquidação
window.openLiquidationModal = async function() {
    if (selectedTransactions.length === 0) {
        alert('Selecione pelo menos uma transação para liquidar');
        return;
    }
    
    // Calcular totais
    const totalValue = selectedTransactions.reduce((sum, trans) => sum + trans.valor, 0);
    const transactionCount = selectedTransactions.length;
    
    // Preencher modal
    document.getElementById('liquidationTransactionCount').textContent = transactionCount;
    document.getElementById('liquidationTotalValue').textContent = formatCurrency(totalValue);
    
    // Definir período padrão (mês/ano atual)
    const currentDate = new Date();
    const currentPeriod = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
    document.getElementById('liquidationPeriodInput').value = currentPeriod;
    document.getElementById('liquidationPeriod').textContent = formatPeriod(currentPeriod);
    
    // Carregar contas bancárias
    await loadBankAccounts();
    
    // Popular preview das transações
    populateTransactionsPreview();
    
    // Validar formulário inicial
    validateLiquidationForm();
    
    // Mostrar modal
    const modal = document.getElementById('liquidationModal');
    if (modal) {
        modal.style.display = 'flex';
        modal.classList.add('fade-in');
    }
};

// Função para fechar modal de liquidação
window.closeLiquidationModal = function() {
    const modal = document.getElementById('liquidationModal');
    if (modal) {
        modal.style.display = 'none';
    }
};

// Função para carregar contas bancárias
async function loadBankAccounts() {
    const select = document.getElementById('liquidationBankAccount');
    if (!select) return;
    
    try {
        select.innerHTML = '<option value="">Carregando contas bancárias...</option>';
        
        // Tentar buscar contas da API (implementar quando API estiver pronta)
        // const response = await fetch(`${API_BASE_URL}/financial-accounts?type=1`);
        // const accounts = await response.json();
        
        // Por enquanto, usar dados simulados
        const accounts = [
            { id: 'account_1', description: 'Conta Corrente Principal - Banco do Brasil', type: 1, active: true },
            { id: 'account_2', description: 'Conta Corrente Empresarial - Itaú', type: 1, active: true },
            { id: 'account_3', description: 'Conta Digital - Nubank', type: 1, active: true }
        ];
        
        // Filtrar apenas contas bancárias ativas (type = 1)
        const bankAccounts = accounts.filter(acc => acc.type === 1 && acc.active);
        
        select.innerHTML = '<option value="">Selecione uma conta bancária</option>';
        
        bankAccounts.forEach(account => {
            const option = document.createElement('option');
            option.value = account.id;
            option.textContent = account.description;
            select.appendChild(option);
        });
        
        if (bankAccounts.length === 0) {
            select.innerHTML = '<option value="">Nenhuma conta bancária encontrada</option>';
        }
        
    } catch (error) {
        console.error('Erro ao carregar contas bancárias:', error);
        select.innerHTML = '<option value="">Erro ao carregar contas</option>';
    }
}

// Função para validar formulário de liquidação
window.validateLiquidationForm = function() {
    const bankAccount = document.getElementById('liquidationBankAccount').value;
    const period = document.getElementById('liquidationPeriodInput').value;
    const confirmBtn = document.getElementById('confirmLiquidationBtn');
    const bankAccountError = document.getElementById('bankAccountError');
    const periodError = document.getElementById('periodError');
    
    let isValid = true;
    
    // Validar conta bancária
    if (!bankAccount) {
        showFieldError(bankAccountError, 'Selecione uma conta bancária');
        isValid = false;
    } else {
        hideFieldError(bankAccountError);
    }
    
    // Validar período
    if (!period) {
        showFieldError(periodError, 'Selecione o período da conciliação');
        isValid = false;
    } else {
        // Verificar se período não é futuro
        const selectedDate = new Date(period);
        const currentDate = new Date();
        if (selectedDate > currentDate) {
            showFieldError(periodError, 'Período não pode ser futuro');
            isValid = false;
        } else {
            hideFieldError(periodError);
        }
    }
    
    // Habilitar/desabilitar botão
    if (confirmBtn) {
        confirmBtn.disabled = !isValid;
        if (isValid) {
            confirmBtn.classList.remove('btn-disabled');
        } else {
            confirmBtn.classList.add('btn-disabled');
        }
    }
    
    return isValid;
};

function showFieldError(errorElement, message) {
    if (errorElement) {
        errorElement.textContent = message;
        errorElement.style.display = 'block';
        errorElement.parentElement.classList.add('has-error');
    }
}

function hideFieldError(errorElement) {
    if (errorElement) {
        errorElement.style.display = 'none';
        errorElement.parentElement.classList.remove('has-error');
    }
}

// Função para popular preview das transações selecionadas
function populateTransactionsPreview() {
    const container = document.getElementById('selectedTransactionsPreview');
    if (!container) return;
    
    if (selectedTransactions.length === 0) {
        container.innerHTML = '<p class="no-transactions">Nenhuma transação selecionada</p>';
        return;
    }
    
    container.innerHTML = `
        <div class="transactions-preview-list">
            ${selectedTransactions.map((trans, index) => `
                <div class="preview-transaction">
                    <div class="preview-transaction-header">
                        <span class="preview-index">${index + 1}</span>
                        <span class="preview-type ${trans.tipo}">${trans.tipo === 'income' ? 'Receita' : 'Despesa'}</span>
                        <span class="preview-value">${formatCurrency(trans.valor)}</span>
                    </div>
                    <div class="preview-transaction-details">
                        <div class="preview-detail">
                            <i class="fas fa-calendar"></i>
                            <span>${formatDate(trans.data)}</span>
                        </div>
                        <div class="preview-detail">
                            <i class="fas fa-align-left"></i>
                            <span title="${trans.description}">${truncateText(trans.description || 'Sem descrição', 40)}</span>
                        </div>
                    </div>
                </div>
            `).join('')}
        </div>
        <div class="preview-summary">
            <div class="preview-summary-item">
                <strong>Total de transações:</strong> ${selectedTransactions.length}
            </div>
            <div class="preview-summary-item">
                <strong>Valor total:</strong> ${formatCurrency(selectedTransactions.reduce((sum, t) => sum + t.valor, 0))}
            </div>
        </div>
    `;
}

// Função para confirmar liquidação
window.confirmLiquidation = async function() {
    const bankAccountId = document.getElementById('liquidationBankAccount').value;
    const period = document.getElementById('liquidationPeriodInput').value;
    
    // Validações
    if (!bankAccountId) {
        alert('Selecione uma conta bancária');
        return;
    }
    
    if (!period) {
        alert('Informe o período da conciliação');
        return;
    }
    
    if (selectedTransactions.length === 0) {
        alert('Nenhuma transação selecionada');
        return;
    }
    
    // Preparar dados para envio
    const liquidationData = {
        selectedTransactions: selectedTransactions.map(trans => ({
            transactionId: trans.id,
            tipo: trans.tipo,
            valor: trans.valor,
            data: trans.data,
            description: trans.description,
            bankDescription: trans.bankDescription,
            statusAnterior: trans.statusAnterior,
            referenciaExterna: trans.referenciaExterna,
            matchScore: trans.matchScore
        })),
        bankAccountId: bankAccountId,
        period: period
    };
    
    console.log('📤 Enviando dados de liquidação:', liquidationData);
    
    // Mostrar loading
    const confirmBtn = document.getElementById('confirmLiquidationBtn');
    const originalText = confirmBtn.innerHTML;
    confirmBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Liquidando...';
    confirmBtn.disabled = true;
    
    try {
        // Enviar para API
        const response = await fetch(`${API_BASE_URL}/reconciliation/liquidate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(liquidationData)
        });
        
        const result = await response.json();
        
        if (response.ok && result.success) {
            // Sucesso
            console.log('✅ Liquidação realizada com sucesso:', result);
            
            showLiquidationSuccess(result);
            closeLiquidationModal();
            
            // Limpar seleção
            selectedTransactions = [];
            updateLiquidateButton();
            
            // Desmarcar checkboxes
            document.querySelectorAll('.transaction-checkbox').forEach(cb => {
                cb.checked = false;
            });
            document.querySelectorAll('tr.selected').forEach(row => {
                row.classList.remove('selected');
            });
            
        } else {
            // Erro
            console.error('❌ Erro na liquidação:', result);
            alert(`Erro na liquidação: ${result.error || 'Erro desconhecido'}`);
        }
        
    } catch (error) {
        console.error('❌ Erro de conexão:', error);
        alert('Erro de conexão com o servidor. Tente novamente.');
        
    } finally {
        // Restaurar botão
        confirmBtn.innerHTML = originalText;
        confirmBtn.disabled = false;
    }
};

// Função para mostrar notificação de sucesso
function showLiquidationSuccess(result) {
    const notification = document.createElement('div');
    notification.className = 'liquidation-notification';
    notification.innerHTML = `
        <i class="fas fa-check-circle"></i>
        <div>
            <strong>Liquidação Realizada!</strong>
            <p>${result.summary?.totalTransactions || 0} transações liquidadas com sucesso</p>
            <small>ID: ${result.liquidationId}</small>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    // Remover após 5 segundos
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 5000);
}

// Função para formatar moeda
function formatCurrency(value) {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(value);
}

// Função para formatar período
function formatPeriod(period) {
    const [year, month] = period.split('-');
    const monthNames = [
        'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];
    return `${monthNames[parseInt(month) - 1]} ${year}`;
}


// Event listener para o botão de liquidar
document.addEventListener('DOMContentLoaded', function() {
    const liquidateBtn = document.getElementById('liquidateSelectedBtn');
    if (liquidateBtn) {
        liquidateBtn.addEventListener('click', openLiquidationModal);
    }
    
    // Inicializar sistema de liquidação
    initializeLiquidationSystem();
});

// Função para inicializar sistema de liquidação
function initializeLiquidationSystem() {
    // Observar mudanças na tabela de conciliadas
    const conciliatedTable = document.getElementById('conciliatedTable');
    if (conciliatedTable) {
        // Usar MutationObserver para detectar quando tabela é populada
        const observer = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                    // Verificar se foram adicionadas linhas com checkboxes
                    const checkboxes = conciliatedTable.querySelectorAll('.transaction-checkbox');
                    if (checkboxes.length > 0) {
                        updateLiquidateButton();
                    }
                }
            });
        });
        
        observer.observe(conciliatedTable, {
            childList: true,
            subtree: true
        });
    }
}

// Adicionar estilos para animações de slide out
if (!document.getElementById('liquidation-animations')) {
    const style = document.createElement('style');
    style.id = 'liquidation-animations';
    style.innerHTML = `
        @keyframes slideOut {
            from {
                transform: translateX(0);
                opacity: 1;
            }
            to {
                transform: translateX(100%);
                opacity: 0;
            }
        }
    `;
    document.head.appendChild(style);
}

// ==================== STREAMING MANAGER INTEGRATION ====================

/**
 * Inicializa o StreamingManager com teste de conectividade
 */
async function initializeStreamingManager() {
    try {
        console.log('🚀 Inicializando StreamingManager...');

        // Teste 1: Verificar se a classe StreamingManager está disponível
        if (typeof StreamingManager === 'undefined') {
            console.warn('⚠️ StreamingManager classe não encontrada');
            return false;
        }

        // Teste 2: Verificar conectividade com a API
        console.log('🔍 Testando conectividade com a API...');
        try {
            const healthResponse = await fetch(`${API_BASE_URL}/health`, { timeout: 5000 });
            if (!healthResponse.ok) {
                console.warn('⚠️ API não está respondendo adequadamente');
            } else {
                console.log('✅ API está acessível');
            }
        } catch (error) {
            console.warn('⚠️ Não foi possível testar conectividade da API:', error.message);
        }

        // Teste 3: Verificar elementos DOM necessários
        const progressSection = document.getElementById('progressSection');
        const progressFill = document.getElementById('progressFill');
        const extractedCount = document.getElementById('extractedCount');
        const processedCount = document.getElementById('processedCount');

        const missingElements = [];
        if (!progressSection) missingElements.push('progressSection');
        if (!progressFill) missingElements.push('progressFill');
        if (!extractedCount) missingElements.push('extractedCount');
        if (!processedCount) missingElements.push('processedCount');

        if (missingElements.length > 0) {
            console.warn('⚠️ Elementos DOM não encontrados:', missingElements.join(', '));
        } else {
            console.log('✅ Todos os elementos DOM necessários encontrados');
        }

        // Inicializar StreamingManager
        streamingManager = new StreamingManager(API_BASE_URL, 'progressSection');
        console.log('✅ StreamingManager inicializado com sucesso');

        // Ativar debug mode para troubleshooting
        streamingManager.enableDebugMode();
        console.log('🔍 Debug mode ativado no StreamingManager');

        // Teste manual dos contadores
        console.log('🧪 Testando contadores inicialmente...');
        streamingManager.updateCounter('extractedCount', 0);
        streamingManager.updateCounter('processedCount', 0);

        return true;

    } catch (error) {
        console.error('❌ Erro ao inicializar StreamingManager:', error);
        return false;
    }
}

/**
 * Upload usando StreamingManager moderno
 */
async function uploadWithStreamingManager() {
    if (!currentFile) {
        showError('Nenhum arquivo selecionado.');
        return;
    }

    console.log('🌊 Iniciando upload com StreamingManager...', {
        fileName: currentFile.name,
        fileSize: currentFile.size,
        hasStreamingManager: !!streamingManager
    });

    // Forçar reinicialização se StreamingManager não estiver disponível
    if (!streamingManager) {
        console.log('🔄 Tentando reinicializar StreamingManager...');
        const initialized = await initializeStreamingManager();
        if (!initialized) {
            console.warn('⚠️ Fallback para método SSE direto');
            await uploadFileWithStreaming();
            return;
        }
    }

    try {
        const formData = new FormData();
        formData.append('file', currentFile);

        console.log('🚀 Iniciando streaming com StreamingManager');
        await streamingManager.startStreaming(formData);

    } catch (error) {
        console.error('❌ Erro durante upload com StreamingManager:', error);

        // Log do erro para debugging
        console.error('Detalhes do erro:', {
            message: error.message,
            stack: error.stack,
            streamingManagerState: streamingManager ? streamingManager.getStatus() : 'N/A'
        });

        showError(`Erro durante streaming: ${error.message}`);

        // Tentar fallback em caso de erro
        try {
            console.log('🔄 Tentando fallback para método SSE direto...');
            await uploadFileWithStreaming();
        } catch (fallbackError) {
            console.error('❌ Erro também no fallback:', fallbackError);
            showError(`Erro crítico: ${fallbackError.message}`);
        }
    }
}

/**
 * Função de fallback para compatibilidade
 */
function getStreamingStatus() {
    if (streamingManager) {
        return streamingManager.getStatus();
    }
    return {
        state: 'unknown',
        message: 'StreamingManager não disponível'
    };
}

/**
 * Desconectar streaming se necessário
 */
function disconnectStreaming() {
    if (streamingManager) {
        streamingManager.disconnect();
        console.log('🔌 Streaming desconectado');
    }
}

// Função para iniciar conciliação com streaming
function startStreamingReconciliation() {
    console.log('🚀 Iniciando conciliação com streaming...');

    if (!window.streamingManager) {
        console.error('❌ StreamingManager não inicializado');
        showError('StreamingManager não está disponível. Recarregue a página.');
        return;
    }

    if (!currentFile) {
        console.error('❌ Nenhum arquivo selecionado');
        showError('Nenhum arquivo selecionado para conciliação.');
        return;
    }

    try {
        // Ativar modo streaming
        isStreamingMode = true;
        console.log('✅ Modo streaming ativado');

        // Mostrar interface de progresso sem resetar
        showProgress();

        // Iniciar upload e streaming
        window.streamingManager.startStreaming(currentFile);
    } catch (error) {
        console.error('❌ Erro ao iniciar streaming:', error);
        isStreamingMode = false; // Desativar modo streaming em caso de erro
        showError(`Erro ao iniciar streaming: ${error.message}`);
    }
}

// REMOVIDO: Inicialização dupla do StreamingManager
// Agora é inicializado apenas em initializeStreamingManager() para evitar conflitos

// Adicionar listener para limpeza quando página é fechada
window.addEventListener('beforeunload', () => {
    disconnectStreaming();

    // Desconectar StreamingManager se existir
    if (window.streamingManager) {
        window.streamingManager.disconnect();
    }
});

// ==================== FUNÇÕES DE DEBUG ====================

/**
 * Função para testar contadores manualmente
 */
function testCounters() {
    console.log('🧪 === TESTE MANUAL DOS CONTADORES ===');

    // Verificar se os elementos existem
    const counters = ['uploadedCount', 'extractedCount', 'processedCount', 'matchesCount'];

    console.log('📋 Verificando elementos:');
    counters.forEach(counterId => {
        const element = document.getElementById(counterId);
        console.log(`  ${counterId}: ${element ? '✅ Encontrado' : '❌ NÃO encontrado'}`);
        if (element) {
            console.log(`    Valor atual: ${element.textContent}`);
            console.log(`    Tag: ${element.tagName}, Classes: ${element.className}`);
        }
    });

    // Testar atualização manual
    console.log('\n🔧 Testando atualização manual:');

    if (window.streamingManager && typeof window.streamingManager.updateCounter === 'function') {
        console.log('  Testando com StreamingManager...');
        window.streamingManager.updateCounter('extractedCount', 106);
        window.streamingManager.updateCounter('processedCount', 50);
        window.streamingManager.updateCounter('matchesCount', 25);
    } else {
        console.log('  StreamingManager não disponível, testando diretamente...');

        // Teste direto
        const extractedElement = document.getElementById('extractedCount');
        if (extractedElement) {
            extractedElement.textContent = '106';
            console.log('  ✅ extractedCount atualizado para 106');
        }

        const processedElement = document.getElementById('processedCount');
        if (processedElement) {
            processedElement.textContent = '50';
            console.log('  ✅ processedCount atualizado para 50');
        }
    }

    // Verificar resultado final
    setTimeout(() => {
        console.log('\n📊 Resultado do teste:');
        counters.forEach(counterId => {
            const element = document.getElementById(counterId);
            if (element) {
                console.log(`  ${counterId}: ${element.textContent}`);
            }
        });
    }, 500);
}

/**
 * Função para simular evento de transações extraídas
 */
function simulateExtractedEvent() {
    console.log('🎭 Simulando evento transactions_extracted...');

    if (window.streamingManager) {
        const fakeEvent = {
            type: 'transactions_extracted',
            transaction_count: 106,
            count: 106,
            file_format: 'OFX',
            bank_detected: 'TESTE'
        };

        console.log('📡 Enviando evento fake:', fakeEvent);
        window.streamingManager.handleExtractedEvent(fakeEvent);
    } else {
        console.error('❌ StreamingManager não disponível');
    }
}

/**
 * Simular conciliação ao vivo com eventos granulares
 */
function simulateLiveReconciliation() {
    console.log('🎭 === SIMULANDO CONCILIAÇÃO AO VIVO ===');

    if (!window.streamingManager) {
        console.error('❌ StreamingManager não disponível');
        return;
    }

    const totalTransactions = 50;
    let currentTransaction = 0;
    let currentMatches = 0;

    // Simular processamento de cada transação
    const processNext = () => {
        if (currentTransaction >= totalTransactions) {
            console.log('✅ Simulação concluída!');
            return;
        }

        currentTransaction++;

        // Evento de processamento de transação individual
        window.streamingManager.processSSEEvent({
            type: 'transaction_processing',
            current: currentTransaction,
            total: totalTransactions,
            transaction_id: `TX_${currentTransaction}`,
            progress_percent: (currentTransaction / totalTransactions) * 100
        });

        // Simular match encontrado (30% das transações)
        if (Math.random() < 0.3) {
            currentMatches++;
            setTimeout(() => {
                window.streamingManager.processSSEEvent({
                    type: 'match_found',
                    transaction_id: `TX_${currentTransaction}`,
                    match_type: 'conciliated',
                    current_matches: currentMatches
                });
            }, 100);
        }

        // Continuar processamento após delay
        setTimeout(processNext, 150);
    };

    // Iniciar simulação
    processNext();
}

/**
 * Simular lotes de processamento
 */
function simulateBatchProcessing() {
    console.log('🎭 Simulando processamento em lotes...');

    if (!window.streamingManager) {
        console.error('❌ StreamingManager não disponível');
        return;
    }

    const batchSize = 10;
    const totalTransactions = 100;
    let processed = 0;

    const processBatch = () => {
        if (processed >= totalTransactions) {
            console.log('✅ Todos os lotes processados!');
            return;
        }

        processed += batchSize;
        const remaining = totalTransactions - processed;

        window.streamingManager.processSSEEvent({
            type: 'batch_processed',
            batch_size: batchSize,
            total_processed: processed,
            remaining: remaining
        });

        console.log(`📦 Lote processado: ${processed}/${totalTransactions}`);

        // Próximo lote após delay
        if (remaining > 0) {
            setTimeout(processBatch, 300);
        }
    };

    // Iniciar processamento em lotes
    processBatch();
}

/**
 * Testar atualizações de contador granulares
 */
function testGranularCounters() {
    console.log('🧪 Testando contadores granulares...');

    if (!window.streamingManager) {
        console.error('❌ StreamingManager não disponível');
        return;
    }

    // Simular atualizações incrementais
    let count = 0;
    const maxCount = 25;

    const incrementCounter = () => {
        if (count >= maxCount) {
            console.log('✅ Teste de contadores concluído!');
            return;
        }

        count++;

        // Simular evento de atualização de contador
        window.streamingManager.processSSEEvent({
            type: 'counter_update',
            counters: {
                processed: count,
                matches: Math.floor(count * 0.4)
            }
        });

        console.log(`📊 Contadores atualizados: processed=${count}, matches=${Math.floor(count * 0.4)}`);

        // Próximo incremento
        setTimeout(incrementCounter, 200);
    };

    // Iniciar teste
    incrementCounter();
}

/**
 * Função para testar conectividade completa
 */
async function testFullConnectivity() {
    console.log('🧪 === TESTE COMPLETO DE CONECTIVIDADE ===');

    if (window.streamingManager) {
        console.log('1️⃣ Testando StreamingManager...');
        await window.streamingManager.testSSEConnection();

        console.log('\n2️⃣ Testando simulação de eventos...');
        window.streamingManager.simulateTestEvent('transactions_extracted', { count: 197 });

        console.log('\n3️⃣ Status interno...');
        window.streamingManager.logInternalState();
    } else {
        console.error('❌ StreamingManager não está disponível');
    }
}

/**
 * Função para verificar configuração atual
 */
function checkConfiguration() {
    console.log('🔍 === VERIFICAÇÃO DE CONFIGURAÇÃO ===');
    console.log('API Base URL:', API_BASE_URL);
    console.log('StreamingManager disponível:', !!window.streamingManager);
    console.log('Arquivo atual:', currentFile ? currentFile.name : 'Nenhum');
    console.log('Modo streaming:', isStreamingMode);

    // Verificar elementos DOM críticos
    const criticalElements = ['extractedCount', 'processedCount', 'matchesCount', 'progressSection'];
    console.log('\nElementos DOM:');
    criticalElements.forEach(id => {
        const element = document.getElementById(id);
        console.log(`  ${id}: ${element ? `✅ (valor: "${element.textContent}")` : '❌ NÃO ENCONTRADO'}`);
    });
}

/**
 * Função para forçar reinicialização completa
 */
async function forceReinitialize() {
    console.log('🔄 === FORÇANDO REINICIALIZAÇÃO COMPLETA ===');

    // Desconectar StreamingManager existente
    if (window.streamingManager) {
        window.streamingManager.disconnect();
        window.streamingManager = null;
    }

    // Reinicializar
    const success = await initializeStreamingManager();
    if (success) {
        console.log('✅ Reinicialização concluída com sucesso');
        console.log('🧪 Executando teste rápido...');
        await testFullConnectivity();
    } else {
        console.error('❌ Falha na reinicialização');
    }
}

// Expor funções globalmente para teste
window.testCounters = testCounters;
window.simulateExtractedEvent = simulateExtractedEvent;
window.testFullConnectivity = testFullConnectivity;
window.checkConfiguration = checkConfiguration;
window.forceReinitialize = forceReinitialize;

// Expor novas funções de simulação granular
window.simulateLiveReconciliation = simulateLiveReconciliation;
window.simulateBatchProcessing = simulateBatchProcessing;
window.testGranularCounters = testGranularCounters;

// ==================== FIM STREAMING MANAGER ====================
