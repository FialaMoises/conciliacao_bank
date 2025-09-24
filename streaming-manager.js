/**
 * StreamingManager - Sistema avançado de streaming SSE para Conciliação Bancária
 * Implementa interface moderna com estados visuais e reconexão automática
 */

class StreamingManager {
    constructor(apiUrl, containerId = 'progressSection') {
        this.apiUrl = apiUrl;
        this.container = document.getElementById(containerId);
        this.eventSource = null;
        this.state = 'IDLE';
        this.sessionId = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 3;
        this.reconnectDelay = 2000; // 2 segundos

        // Dados de streaming
        this.streamingData = {
            progress: 0,
            currentStep: '',
            results: {
                conciliated: [],
                suggested: [],
                pending: [],
                no_correlation: [],
                unmatched_mongo: []
            },
            counters: {
                conciliated: 0,
                suggested: 0,
                pending: 0,
                no_correlation: 0,
                unmatched_mongo: 0
            },
            events: []
        };

        this.states = {
            IDLE: 'idle',
            UPLOADING: 'uploading',
            VALIDATING: 'validating',
            STREAMING: 'streaming',
            RESULTS: 'results',
            ERROR: 'error',
            CONNECTION_LOST: 'connection-lost',
            RECONNECTING: 'reconnecting'
        };

        // Event handlers completos para todos os tipos de eventos SSE + novos eventos granulares
        this.eventHandlers = {
            'file_uploaded': this.handleFileUploadedEvent.bind(this),
            'file_validated': this.handleFileValidatedEvent.bind(this),
            'extracting_transactions': this.handleExtractingEvent.bind(this),
            'transactions_extracted': this.handleExtractedEvent.bind(this),
            'file_analysis_complete': this.handleFileAnalysisCompleteEvent.bind(this),
            'loading_mongo_data': this.handleLoadingMongoEvent.bind(this),
            'mongo_data_loaded': this.handleMongoLoadedEvent.bind(this),
            'processing_matches': this.handleProcessingMatchesEvent.bind(this),
            'matches_processed': this.handleMatchesProcessedEvent.bind(this),
            'llm_analysis_complete': this.handleLLMAnalysisEvent.bind(this),
            'reconciliation_complete': this.handleReconciliationCompleteEvent.bind(this),
            'error': this.handleErrorEvent.bind(this),
            // Novos handlers para progresso em tempo real
            'transaction_progress': this.handleTransactionProgressEvent.bind(this),
            'processing_progress': this.handleProcessingProgressEvent.bind(this),
            // Novos handlers granulares para conciliação ao vivo
            'transaction_processing': this.handleTransactionProcessingEvent.bind(this),
            'match_found': this.handleMatchFoundEvent.bind(this),
            'counter_update': this.handleCounterUpdateEvent.bind(this),
            'batch_processed': this.handleBatchProcessedEvent.bind(this),
            // Manter handlers antigos para compatibilidade
            'progress': this.handleProgressEvent.bind(this),
            'complete': this.handleCompleteEvent.bind(this)
        };

        // Controle de throttling para atualizações em tempo real
        this.lastCounterUpdate = 0;
        this.throttleInterval = 100; // Máximo 10 atualizações por segundo
        this.pendingCounterUpdates = {};

        this.init();
    }

    init() {
        console.log('🌊 StreamingManager initialized');
        this.setupEventListeners();
    }

    /**
     * Inicia o streaming com upload direto via SSE endpoint
     */
    async startStreaming(formData) {
        try {
            this.setState(this.states.UPLOADING);
            this.resetStreamingData();

            console.log('🚀 Starting streaming upload...');

            // Fazer upload direto para o endpoint SSE
            const response = await fetch(`${this.apiUrl}/stream/reconcile`, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Erro no upload');
            }

            // Obter session ID do header
            this.sessionId = response.headers.get('X-Session-ID') || 'session_' + Date.now();
            console.log('🆔 Session ID:', this.sessionId);

            this.setState(this.states.STREAMING);

            // Processar response stream diretamente
            await this.processResponseStream(response);

        } catch (error) {
            console.error('❌ Erro durante streaming:', error);
            this.handleError(error.message);
        }
    }

    /**
     * Processa response stream do fetch diretamente
     */
    async processResponseStream(response) {
        if (!response.body) {
            console.error('❌ Response não possui body stream');
            return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let eventCount = 0;
        let lastEventTime = Date.now();

        console.log('🌊 Iniciando processamento de stream...');
        this.updateConnectionStatus('connected');

        // Timer para detectar perda de eventos
        const eventTimeoutCheck = setInterval(() => {
            const now = Date.now();
            if (now - lastEventTime > 30000 && eventCount === 0) { // 30 segundos sem eventos
                console.warn('⚠️ Nenhum evento SSE recebido em 30 segundos');
                console.log('🔍 DEBUG - Status da stream:', {
                    eventCount,
                    lastEventTime: new Date(lastEventTime).toISOString(),
                    bufferLength: buffer.length
                });
            }
        }, 15000);

        try {
            while (true) {
                const { done, value } = await reader.read();

                if (done) {
                    console.log(`✅ Stream concluído - Total de eventos processados: ${eventCount}`);
                    break;
                }

                // Decodificar chunk
                const chunk = decoder.decode(value, { stream: true });
                buffer += chunk;

                console.log(`🔍 DEBUG - Chunk recebido (${chunk.length} chars):`, chunk.substring(0, 200) + (chunk.length > 200 ? '...' : ''));

                // Processar eventos SSE completos
                const events = buffer.split('\n\n');
                buffer = events.pop() || ''; // Manter última linha incompleta no buffer

                for (const eventBlock of events) {
                    if (eventBlock.trim()) {
                        console.log(`🔍 DEBUG - Processando evento #${eventCount + 1}:`, eventBlock.substring(0, 150) + (eventBlock.length > 150 ? '...' : ''));
                        this.parseSSEBlock(eventBlock);
                        eventCount++;
                        lastEventTime = Date.now();
                    }
                }
            }

            // Processar buffer restante se houver
            if (buffer.trim()) {
                console.log('🔍 DEBUG - Processando buffer restante:', buffer);
                this.parseSSEBlock(buffer);
                eventCount++;
            }

        } catch (error) {
            console.error('❌ Erro ao processar stream:', error);
            this.updateConnectionStatus('error');
            throw error;
        } finally {
            clearInterval(eventTimeoutCheck);
            reader.releaseLock();
        }
    }

    /**
     * Parseia um bloco de evento SSE
     */
    parseSSEBlock(eventBlock) {
        try {
            // Extrair linha de dados
            const lines = eventBlock.split('\n');
            const dataLine = lines.find(line => line.startsWith('data: '));

            if (!dataLine) {
                console.log('🔍 Bloco SSE sem dados:', eventBlock);
                return;
            }

            // Extrair JSON
            const jsonData = dataLine.substring(6).trim(); // Remove "data: "
            if (!jsonData) return;

            const eventData = JSON.parse(jsonData);
            console.log('📡 Evento SSE parseado:', eventData);

            // Processar evento
            this.processSSEEvent(eventData);

        } catch (error) {
            console.error('❌ Erro ao parsear bloco SSE:', error, eventBlock);
        }
    }

    /**
     * Processa evento SSE individual
     */
    processSSEEvent(eventData) {
        try {
            console.log('📡 Processando evento SSE:', eventData);

            // Adicionar evento ao log visual
            this.addEventToLog(eventData);

            // Processar evento com handler específico
            const handler = this.eventHandlers[eventData.type];
            if (handler) {
                console.log(`⚙️ Executando handler para: ${eventData.type}`);
                handler(eventData);
            } else {
                console.log(`📡 Evento não mapeado: ${eventData.type}`, eventData);
                // Fallback para handler genérico
                this.handleGenericEvent(eventData);
            }

        } catch (error) {
            console.error('❌ Erro ao processar evento SSE:', error, eventData);
        }
    }

    /**
     * Handler para eventos de progresso
     */
    handleProgressEvent(eventData) {
        const { progress, step, message } = eventData;

        // Atualizar dados de progresso
        this.streamingData.progress = progress || 0;
        this.streamingData.currentStep = step || '';

        // Atualizar UI
        this.updateProgressBar(this.streamingData.progress);
        this.updateStepIndicator(step);
        this.updateProgressMessage(message || step);

        // Atualizar contadores se disponível
        if (eventData.conciliated_count !== undefined) {
            this.updateCounters({
                conciliated: eventData.conciliated_count,
                suggested: eventData.suggested_count || 0,
                pending: eventData.pending_count || 0
            });
        }

        // Log detalhado
        const progressPercent = Math.round(this.streamingData.progress * 100);
        console.log(`📊 Progresso: ${progressPercent}% - ${step}: ${message}`);
    }

    /**
     * Handler para evento de conclusão
     */
    handleCompleteEvent(eventData) {
        console.log('🎉 Streaming concluído!', eventData);

        this.setState(this.states.RESULTS);
        this.updateProgressBar(1.0);
        this.updateProgressMessage('Conciliação concluída com sucesso!');

        // Atualizar contadores finais
        if (eventData.summary) {
            this.updateCounters(eventData.summary);
        }

        // Buscar resultado completo
        if (this.sessionId) {
            setTimeout(() => {
                this.fetchCompleteResults();
            }, 1000);
        }
    }

    /**
     * Handler para eventos de erro
     */
    handleErrorEvent(eventData) {
        console.error('❌ Erro SSE recebido:', eventData);

        this.setState(this.states.ERROR);
        this.showError(eventData.error || 'Erro durante processamento');

        if (eventData.details) {
            console.error('Detalhes do erro:', eventData.details);
        }
    }

    /**
     * Busca resultado completo da sessão
     */
    async fetchCompleteResults() {
        try {
            console.log('🔍 Buscando resultado completo da sessão:', this.sessionId);

            const response = await fetch(`${this.apiUrl}/stream/session/${this.sessionId}/result`);
            const data = await response.json();

            if (data.success && data.result) {
                this.streamingData.results = data.result;
                this.displayResults(data.result);
                console.log('📊 Resultado completo carregado');
            } else {
                console.error('❌ Erro ao obter resultado:', data.error);
            }
        } catch (error) {
            console.error('❌ Erro ao buscar resultado:', error);
        }
    }

    /**
     * Exibe resultados usando função existente
     */
    displayResults(result) {
        console.log('📊 Preparando exibição de resultados:', result);

        // Compatibilidade com sistema existente
        const compatibleResult = {
            ...result,
            summary: {
                conciliated_count: result.conciliated?.length || 0,
                suggested_count: result.suggested?.length || 0,
                pending_count: result.pending?.length || 0,
                no_correlation_count: result.no_correlation?.length || 0,
                unmatched_mongo_count: result.unmatched_mongo?.length || 0
            },
            result: result
        };

        console.log('📊 Resultado compatível preparado:', compatibleResult);

        // Atualizar contadores finais
        this.updateCounters(compatibleResult.summary);

        // Usar função existente se disponível
        if (typeof showResults === 'function') {
            console.log('✅ Chamando showResults existente');

            // Definir currentResults global para compatibilidade
            if (typeof window !== 'undefined') {
                window.currentResults = compatibleResult;
            }

            showResults(compatibleResult);
        } else {
            console.warn('⚠️ Função showResults não encontrada, usando fallback');
            this.fallbackDisplayResults(compatibleResult);
        }
    }

    /**
     * Fallback para exibição de resultados se showResults não existir
     */
    fallbackDisplayResults(result) {
        // Mostrar seção de resultados
        const resultsSection = document.getElementById('resultsSection');
        if (resultsSection) {
            resultsSection.style.display = 'block';
            console.log('✅ Seção de resultados exibida');
        }

        // Esconder progresso
        this.hideProgress();

        // Log dos resultados
        console.log('📊 Resultados da conciliação:', {
            conciliated: result.summary.conciliated_count,
            suggested: result.summary.suggested_count,
            pending: result.summary.pending_count,
            no_correlation: result.summary.no_correlation_count,
            unmatched_mongo: result.summary.unmatched_mongo_count
        });
    }

    /**
     * Gerencia estados visuais
     */
    setState(newState) {
        const oldState = this.state;
        this.state = newState;

        console.log(`🔄 Estado: ${oldState} → ${newState}`);

        this.updateUI();
        this.updateStateIndicators();
    }

    /**
     * Atualiza interface baseado no estado
     */
    updateUI() {
        if (!this.container) return;

        // Atualizar classes CSS
        this.container.className = `progress-section state-${this.state}`;

        switch (this.state) {
            case this.states.IDLE:
                this.hideProgress();
                break;
            case this.states.UPLOADING:
                this.showProgress();
                this.updateProgressMessage('Enviando arquivo...');
                this.updateProgressBar(0.05);
                break;
            case this.states.VALIDATING:
                this.updateProgressMessage('Validando arquivo...');
                this.updateProgressBar(0.1);
                break;
            case this.states.STREAMING:
                this.showProgressInterface();
                break;
            case this.states.RESULTS:
                this.showResultsInterface();
                break;
            case this.states.ERROR:
                this.showErrorInterface();
                break;
            case this.states.CONNECTION_LOST:
                this.showReconnectInterface();
                break;
            case this.states.RECONNECTING:
                this.showReconnectingInterface();
                break;
        }
    }

    /**
     * Mostra interface de progresso
     */
    showProgress() {
        if (this.container) {
            this.container.style.display = 'block';
        }
    }

    /**
     * Esconde interface de progresso
     */
    hideProgress() {
        if (this.container) {
            this.container.style.display = 'none';
        }
    }

    /**
     * Atualiza barra de progresso
     */
    updateProgressBar(progress) {
        // Tentar múltiplos IDs para compatibilidade
        const progressFill = document.getElementById('progressFill') ||
                            document.querySelector('.progress-fill') ||
                            document.querySelector('#progressFill');

        if (progressFill) {
            const percent = Math.round(progress * 100);
            progressFill.style.width = `${percent}%`;

            // Adicionar animação
            progressFill.style.transition = 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1)';

            // Adicionar classe de animação se não existir
            if (!progressFill.classList.contains('streaming-progress')) {
                progressFill.classList.add('streaming-progress');
            }

            console.log(`📊 Progresso atualizado: ${percent}%`);
        } else {
            console.error('❌ Elemento progressFill não encontrado!');
            console.log('🔍 DEBUG - Elementos disponíveis:', {
                getElementById: document.getElementById('progressFill'),
                querySelector1: document.querySelector('.progress-fill'),
                querySelector2: document.querySelector('#progressFill'),
                allProgress: document.querySelectorAll('[id*="progress"]')
            });
        }
    }

    /**
     * Atualiza mensagem de progresso
     */
    updateProgressMessage(message) {
        // Tentar múltiplos seletores para compatibilidade
        const progressText = document.getElementById('progressText') ||
                            document.querySelector('.progress-text') ||
                            document.querySelector('#progressText');

        if (progressText) {
            progressText.textContent = message;
            console.log(`💬 Mensagem: ${message}`);
        } else {
            console.warn('⚠️ Elemento progressText não encontrado');
            // Fallback: mostrar no console
            console.log(`📝 ${message}`);
        }
    }

    /**
     * Atualiza indicador de etapa
     */
    updateStepIndicator(currentStep) {
        // Mapeamento de etapas
        const stepMapping = {
            'file_uploaded': 0,
            'file_validated': 1,
            'extracting_transactions': 2,
            'transactions_extracted': 2,
            'loading_system_data': 3,
            'system_data_loaded': 3,
            'starting_reconciliation': 4,
            'processing_matches': 4,
            'analyzing_duplicates': 5,
            'finalizing_results': 6,
            'results_ready': 7
        };

        const currentIndex = stepMapping[currentStep] || 0;

        // Se tiver interface de steps, atualizar
        const steps = document.querySelectorAll('.step-indicator');
        steps.forEach((step, index) => {
            if (index <= currentIndex) {
                step.classList.add('completed');
                step.classList.remove('active');
            } else if (index === currentIndex + 1) {
                step.classList.add('active');
                step.classList.remove('completed');
            } else {
                step.classList.remove('active', 'completed');
            }
        });
    }

    /**
     * Atualiza contadores dinâmicos
     */
    updateCounters(counters) {
        // Mapeamento correto para os IDs que existem no HTML
        const elementMapping = {
            // Mapear dados do backend para elementos HTML existentes
            'total_transactions': ['extractedCount'],
            'conciliated_count': ['matchesCount'], // Usar matches para conciliadas
            'suggested_count': ['processedCount'], // Usar processed para sugeridas temporariamente
            'pending_count': ['processedCount'], // Mapear para processed também
            'no_correlation_count': ['processedCount'], // Mapear para processed
            'unmatched_mongo_count': ['processedCount'], // Mapear para processed
            'processed_count': ['processedCount'],
            'extracted_count': ['extractedCount'],
            'matches_count': ['matchesCount'],
            'uploaded_count': ['uploadedCount']
        };

        Object.keys(counters).forEach(key => {
            const possibleIds = elementMapping[key] || [`${key}Count`];
            let element = null;

            // Tentar encontrar o elemento com diferentes IDs
            for (const id of possibleIds) {
                element = document.getElementById(id);
                if (element) break;
            }

            if (element) {
                const oldValue = parseInt(element.textContent) || 0;
                const newValue = counters[key] || 0;

                element.textContent = newValue;

                // Adicionar classe de animação
                if (!element.classList.contains('counter-number')) {
                    element.classList.add('counter-number');
                }

                // Animação se valor mudou
                if (newValue !== oldValue) {
                    element.classList.add('updated');
                    setTimeout(() => element.classList.remove('updated'), 600);
                    console.log(`🔢 Contador ${key}: ${oldValue} → ${newValue}`);
                }
            } else {
                console.warn(`⚠️ Contador ${key} não encontrado (IDs tentados: ${possibleIds.join(', ')})`);
            }
        });

        // Atualizar dados internos
        this.streamingData.counters = { ...this.streamingData.counters, ...counters };
    }

    /**
     * Adiciona evento ao log
     */
    addEventToLog(eventData) {
        const logEvent = {
            timestamp: new Date(),
            type: eventData.type,
            message: eventData.message || eventData.step,
            data: eventData
        };

        this.streamingData.events.push(logEvent);

        // Manter apenas últimos 50 eventos
        if (this.streamingData.events.length > 50) {
            this.streamingData.events.shift();
        }
    }

    /**
     * Mostra erro
     */
    showError(message) {
        console.error('❌ Erro:', message);

        const errorSection = document.getElementById('errorSection');
        const errorMessage = document.getElementById('errorMessage');

        if (errorSection && errorMessage) {
            errorMessage.textContent = message;
            errorSection.style.display = 'block';
        }

        this.hideProgress();
    }

    /**
     * Manipula erro geral
     */
    handleError(message) {
        this.setState(this.states.ERROR);
        this.showError(message);
    }

    /**
     * Reset dados de streaming
     */
    resetStreamingData() {
        this.streamingData = {
            progress: 0,
            currentStep: '',
            results: {
                conciliated: [],
                suggested: [],
                pending: [],
                no_correlation: [],
                unmatched_mongo: []
            },
            counters: {
                conciliated: 0,
                suggested: 0,
                pending: 0,
                no_correlation: 0,
                unmatched_mongo: 0
            },
            events: []
        };
    }

    /**
     * Configura event listeners
     */
    setupEventListeners() {
        // Listener para limpeza quando página é fechada
        window.addEventListener('beforeunload', () => {
            this.disconnect();
        });
    }

    /**
     * Desconecta streaming
     */
    disconnect() {
        if (this.eventSource) {
            this.eventSource.close();
            this.eventSource = null;
        }
        this.setState(this.states.IDLE);
        console.log('🔌 Streaming desconectado');
    }

    /**
     * Obtém status atual
     */
    getStatus() {
        return {
            state: this.state,
            sessionId: this.sessionId,
            progress: this.streamingData.progress,
            currentStep: this.streamingData.currentStep,
            counters: this.streamingData.counters,
            eventsCount: this.streamingData.events.length
        };
    }

    /**
     * Interface de progresso melhorada
     */
    showProgressInterface() {
        // Implementação específica se necessário
        // Por enquanto, usar elementos existentes
    }

    /**
     * Interface de resultados
     */
    showResultsInterface() {
        // Mostrar seção de resultados
        const resultsSection = document.getElementById('resultsSection');
        if (resultsSection) {
            resultsSection.style.display = 'block';
        }
        this.hideProgress();
    }

    /**
     * Interface de erro
     */
    showErrorInterface() {
        this.showError('Erro durante processamento');
    }

    /**
     * Interface de reconexão
     */
    showReconnectInterface() {
        this.updateProgressMessage('Conexão perdida. Tentando reconectar...');
    }

    /**
     * Interface de reconectando
     */
    showReconnectingInterface() {
        this.updateProgressMessage(`Reconectando... (tentativa ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    }

    /**
     * Atualiza indicadores de estado
     */
    updateStateIndicators() {
        // Atualizar indicador de API status se existir
        const apiStatus = document.getElementById('apiStatus');
        if (apiStatus) {
            const icon = apiStatus.querySelector('i');
            const text = apiStatus.querySelector('span');

            if (this.state === this.states.STREAMING) {
                if (icon) icon.className = 'fas fa-circle streaming';
                if (text) text.textContent = 'Processando...';
            } else if (this.state === this.states.CONNECTION_LOST) {
                if (icon) icon.className = 'fas fa-circle offline';
                if (text) text.textContent = 'Desconectado';
            } else {
                if (icon) icon.className = 'fas fa-circle online';
                if (text) text.textContent = 'Online';
            }
        }
    }

    // ============================================================================
    // NOVOS EVENT HANDLERS ESPECÍFICOS PARA TODOS OS 11 TIPOS DE EVENTOS SSE
    // ============================================================================

    /**
     * Handler: file_uploaded - Arquivo foi enviado com sucesso
     */
    handleFileUploadedEvent(eventData) {
        console.log('📤 Arquivo enviado:', eventData);
        this.updateProgressBar(0.1);
        this.updateProgressMessage('Arquivo enviado com sucesso');
        this.updateStepIndicator(0); // Upload step
        this.updateCounter('uploadedCount', 1);
    }

    /**
     * Handler: file_validated - Arquivo foi validado
     */
    handleFileValidatedEvent(eventData) {
        console.log('✅ Arquivo validado:', eventData);
        this.updateProgressBar(0.15);
        this.updateProgressMessage('Arquivo validado');
        this.updateStepIndicator(1); // Análise step

        if (eventData.file_format) {
            console.log(`📄 Formato detectado: ${eventData.file_format}`);
        }
    }

    /**
     * Handler: extracting_transactions - Iniciando extração de transações
     */
    handleExtractingEvent(eventData) {
        console.log('🔍 Extraindo transações:', eventData);
        this.updateProgressBar(0.25);
        this.updateProgressMessage('Extraindo transações do arquivo...');
        this.updateStepIndicator(2); // Extração step
    }

    /**
     * Handler: transactions_extracted - Transações extraídas
     */
    handleExtractedEvent(eventData) {
        console.log('🔥 === HANDLER: transactions_extracted ===');
        console.log('📋 Dados recebidos:', eventData);
        console.log('🔍 DEBUG - Dados completos do evento:', JSON.stringify(eventData, null, 2));

        this.updateProgressBar(0.35);

        // Múltiplas tentativas para encontrar o count com debugging detalhado
        const possibleCounts = {
            transaction_count: eventData.transaction_count,
            count: eventData.count,
            total_transactions: eventData.total_transactions,
            extracted_count: eventData.extracted_count,
            data_count: eventData.data && eventData.data.count,
        };

        console.log('🔍 DEBUG - Possíveis valores de count:', possibleCounts);

        const count = eventData.transaction_count ||
                     eventData.count ||
                     eventData.total_transactions ||
                     eventData.extracted_count ||
                     (eventData.data && eventData.data.count) ||
                     0;

        console.log(`🔢 Count final detectado: ${count} (tipo: ${typeof count})`);

        this.updateProgressMessage(`${count} transações extraídas`);

        // SEMPRE tentar atualizar o contador, mesmo se count for 0
        console.log(`📊 === FORÇANDO ATUALIZAÇÃO DE EXTRACTEDCOUNT ===`);
        console.log(`📊 Valor a ser definido: ${count}`);

        // Verificar se elemento existe ANTES de atualizar
        const element = document.getElementById('extractedCount');
        console.log(`📊 Elemento extractedCount encontrado:`, element ? `SIM (valor atual: "${element.textContent}")` : 'NÃO');

        this.updateCounter('extractedCount', count);

        // Verificar se a atualização funcionou
        setTimeout(() => {
            const elementAfter = document.getElementById('extractedCount');
            if (elementAfter) {
                const newValue = elementAfter.textContent;
                console.log(`📊 VERIFICAÇÃO: extractedCount após atualização = "${newValue}"`);
                if (String(newValue) !== String(count)) {
                    console.error(`❌ ERRO: Contador não foi atualizado corretamente! Esperado: ${count}, Atual: ${newValue}`);
                } else {
                    console.log(`✅ SUCESSO: Contador atualizado corretamente para ${count}`);
                }
            }
        }, 100);

        // Fallback: se count for 0 mas temos dados, tentar extrair de outras formas
        if (count === 0 && eventData) {
            console.log('⚠️ Count é 0, tentando alternativas...');

            // Verificar se há array de transações
            if (eventData.transactions && Array.isArray(eventData.transactions)) {
                const arrayCount = eventData.transactions.length;
                console.log(`📈 Encontrado array com ${arrayCount} transações`);
                this.updateCounter('extractedCount', arrayCount);
            }

            // Verificar se há mensagem com número
            const messageMatch = (eventData.message || '').match(/(\d+)/);
            if (messageMatch) {
                const numberFromMessage = parseInt(messageMatch[1]);
                console.log(`🔍 Número encontrado na mensagem: ${numberFromMessage}`);
                this.updateCounter('extractedCount', numberFromMessage);
            }
        }

        // Se temos dados detalhados, começar a popular a análise do arquivo
        if (eventData.file_format || eventData.bank_detected) {
            this.showFileAnalysis();

            // Atualizar informações básicas do arquivo
            if (eventData.file_format) {
                this.updateAnalysisValue('fileFormat', eventData.file_format);
            }
            if (eventData.bank_detected) {
                this.updateAnalysisValue('bankDetected', eventData.bank_detected);
            }
            if (eventData.file_size_mb) {
                this.updateAnalysisValue('fileSize', `${eventData.file_size_mb} MB`);
            }
            if (eventData.date_range) {
                this.updateAnalysisValue('dateRange', eventData.date_range);
            }

            // Atualizar estatísticas financeiras
            if (eventData.expenses_count !== undefined) {
                this.updateFinancialData({
                    expenses_count: eventData.expenses_count,
                    incomes_count: eventData.incomes_count,
                    total_amount: eventData.total_amount
                });
            }
        }
    }

    /**
     * Handler: file_analysis_complete - Análise do arquivo concluída
     */
    handleFileAnalysisCompleteEvent(eventData) {
        console.log('📊 Análise do arquivo concluída:', eventData);
        this.updateProgressBar(0.35);
        this.updateProgressMessage('Análise do arquivo concluída');

        // Mostrar seção de análise se ainda não estiver visível
        this.showFileAnalysis();

        // Processar estatísticas completas se disponíveis
        if (eventData.statistics) {
            const stats = eventData.statistics;

            // Atualizar informações básicas
            this.updateAnalysisValue('fileFormat', stats.format || 'Não identificado');
            this.updateAnalysisValue('bankDetected', stats.bank_detected || 'Não identificado');
            this.updateAnalysisValue('dateRange', stats.date_range || 'Não disponível');
            this.updateAnalysisValue('fileSize', `${stats.size_mb || 0} MB`);

            // Atualizar dados financeiros completos
            this.updateFinancialData({
                expenses_count: stats.expenses_count || 0,
                incomes_count: stats.incomes_count || 0,
                expenses_amount: stats.total_expenses || 0,
                incomes_amount: stats.total_incomes || 0,
                total_amount: stats.total_amount || 0
            });

            console.log('✅ Estatísticas do arquivo atualizadas:', stats);
        }
    }

    /**
     * Handler: loading_mongo_data - Carregando dados do MongoDB
     */
    handleLoadingMongoEvent(eventData) {
        console.log('🗄️ Carregando MongoDB:', eventData);
        this.updateProgressBar(0.45);
        this.updateProgressMessage('Carregando dados do sistema...');
        this.updateStepIndicator(3); // MongoDB step
    }

    /**
     * Handler: mongo_data_loaded - Dados do MongoDB carregados
     */
    handleMongoLoadedEvent(eventData) {
        console.log('📊 Dados MongoDB carregados:', eventData);
        this.updateProgressBar(0.55);
        this.updateProgressMessage(`${eventData.count || 0} documentos carregados`);

        if (eventData.count) {
            console.log(`📈 ${eventData.count} documentos do sistema carregados`);
        }
    }

    /**
     * Handler: processing_matches - Processando correspondências
     */
    handleProcessingMatchesEvent(eventData) {
        console.log('🔄 Processando matches:', eventData);
        this.updateProgressBar(0.65);

        // Atualizar contador processado se disponível
        if (eventData.current_transaction && eventData.total_transactions) {
            this.updateCounter('processedCount', eventData.current_transaction);
            this.updateProgressMessage(`Processando transação ${eventData.current_transaction}/${eventData.total_transactions}...`);
        } else if (eventData.processed_count !== undefined) {
            this.updateCounter('processedCount', eventData.processed_count);
            this.updateProgressMessage(`${eventData.processed_count} transações processadas...`);
        } else {
            this.updateProgressMessage('Processando correspondências...');
        }

        this.updateStepIndicator(4); // Processamento step
    }

    /**
     * Handler: matches_processed - Correspondências processadas
     */
    handleMatchesProcessedEvent(eventData) {
        console.log('✨ Matches processados:', eventData);
        this.updateProgressBar(0.75);

        // Atualizar múltiplos contadores se disponível
        const counters = {};

        if (eventData.matches_count !== undefined) {
            counters.matchesCount = eventData.matches_count;
        }

        if (eventData.processed_count !== undefined) {
            counters.processedCount = eventData.processed_count;
        }

        if (eventData.total_processed !== undefined) {
            counters.processedCount = eventData.total_processed;
        }

        // Atualizar contadores se houver dados
        if (Object.keys(counters).length > 0) {
            Object.entries(counters).forEach(([id, value]) => {
                this.updateCounter(id, value);
            });
        }

        // Mensagem personalizada baseada nos dados disponíveis
        if (eventData.processed_count && eventData.total_transactions) {
            this.updateProgressMessage(`${eventData.processed_count}/${eventData.total_transactions} transações processadas`);
        } else if (eventData.matches_count) {
            this.updateProgressMessage(`${eventData.matches_count} correspondências identificadas`);
        } else {
            this.updateProgressMessage('Correspondências identificadas');
        }
    }

    /**
     * Handler: llm_analysis_complete - Análise LLM concluída
     */
    handleLLMAnalysisEvent(eventData) {
        console.log('🧠 Análise LLM concluída:', eventData);
        this.updateProgressBar(0.85);
        this.updateProgressMessage('Análise inteligente concluída');
        this.updateStepIndicator(5); // LLM step
    }

    /**
     * Handler: reconciliation_complete - Conciliação concluída
     */
    handleReconciliationCompleteEvent(eventData) {
        console.log('🎉 Conciliação concluída:', eventData);
        this.updateProgressBar(1.0);
        this.updateProgressMessage('Conciliação concluída com sucesso!');
        this.updateStepIndicator(7); // Resultados step

        // Atualizar contadores finais
        if (eventData.summary) {
            this.updateFinalCounters(eventData.summary);
        }

        // Mudar para estado de resultados
        this.setState(this.states.RESULTS);

        // Buscar e exibir resultados
        setTimeout(() => {
            if (eventData.result) {
                this.displayResults(eventData.result);
            } else {
                this.fetchCompleteResults();
            }
        }, 500);
    }

    /**
     * Handler genérico para eventos não mapeados
     */
    handleGenericEvent(eventData) {
        console.log('🔄 Evento genérico:', eventData);

        // Tentar extrair progresso genérico
        if (eventData.progress !== undefined) {
            this.updateProgressBar(eventData.progress);
        }

        // Tentar extrair mensagem genérica
        if (eventData.message || eventData.step) {
            this.updateProgressMessage(eventData.message || eventData.step);
        }
    }

    /**
     * Atualiza contador individual com animação
     */
    updateCounter(counterId, value) {
        console.log(`🔍 [DEBUG] Tentando atualizar contador ${counterId} para ${value}`);
        console.log(`🔍 [DEBUG] Tipo do valor: ${typeof value}`);

        const counter = document.getElementById(counterId);
        console.log(`🔍 [DEBUG] Elemento encontrado:`, counter ? `Sim (${counter.tagName})` : 'Não');

        if (counter) {
            const oldValue = parseInt(counter.textContent) || 0;
            const newValue = parseInt(value) || 0;

            console.log(`🔍 [DEBUG] Valores: oldValue=${oldValue}, newValue=${newValue}`);

            if (newValue !== oldValue) {
                counter.textContent = newValue;
                counter.classList.add('counter-updated');
                setTimeout(() => counter.classList.remove('counter-updated'), 600);
                console.log(`✅ [DEBUG] Contador ${counterId}: ${oldValue} → ${newValue} ✨`);

                // Verificar se a atualização realmente aconteceu
                setTimeout(() => {
                    const checkValue = parseInt(counter.textContent) || 0;
                    if (checkValue === newValue) {
                        console.log(`✅ [DEBUG] Confirmado: ${counterId} = ${checkValue}`);
                    } else {
                        console.error(`❌ [DEBUG] ERRO: ${counterId} deveria ser ${newValue} mas é ${checkValue}`);
                    }
                }, 100);

            } else {
                console.log(`ℹ️ [DEBUG] Contador ${counterId} já tem valor ${newValue}, sem alteração`);
            }
        } else {
            console.error(`❌ [DEBUG] Contador ${counterId} não encontrado!`);
            console.log('🔍 [DEBUG] Contadores disponíveis:',
                Array.from(document.querySelectorAll('[id*="Count"]')).map(el => `${el.id} (${el.textContent})`)
            );

            // Tentar encontrar elementos similares
            const similar = document.querySelectorAll(`[id*="${counterId.replace('Count', '')}"]`);
            if (similar.length > 0) {
                console.log('🔍 [DEBUG] Elementos similares encontrados:',
                    Array.from(similar).map(el => `${el.id} (${el.tagName})`)
                );
            }
        }
    }

    /**
     * Atualiza contadores finais
     */
    updateFinalCounters(summary) {
        console.log('📊 Atualizando contadores finais:', summary);

        // Usar IDs corretos que existem no HTML
        const counterMapping = {
            extractedCount: summary.total_transactions || summary.extracted_count || 0,
            processedCount: summary.total_transactions || summary.processed_count || 0,
            matchesCount: summary.conciliated_count || summary.matches_count || 0,
            uploadedCount: 1 // Sempre 1 arquivo processado
        };

        console.log('🔍 DEBUG - Mapeamento final dos contadores:', counterMapping);

        Object.entries(counterMapping).forEach(([id, value]) => {
            console.log(`🎯 Atualizando contador final: ${id} = ${value}`);
            this.updateCounter(id, value);
        });
    }

    /**
     * Atualiza status de conexão
     */
    updateConnectionStatus(status) {
        const statusDot = document.getElementById('statusDot');
        const statusText = document.getElementById('statusText');

        if (statusDot && statusText) {
            statusDot.className = `status-dot ${status}`;

            const statusMessages = {
                connected: 'Conectado',
                connecting: 'Conectando...',
                error: 'Erro de Conexão',
                reconnecting: 'Reconectando...'
            };

            statusText.textContent = statusMessages[status] || 'Desconhecido';
            console.log(`🔗 Status de conexão: ${status}`);
        }
    }

    /**
     * Tentativa de reconexão
     */
    attemptReconnection() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error('❌ Máximo de tentativas de reconexão atingido');
            this.setState(this.states.ERROR);
            this.updateConnectionStatus('error');
            return;
        }

        this.reconnectAttempts++;
        this.setState(this.states.RECONNECTING);
        this.updateConnectionStatus('reconnecting');

        const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1); // Exponential backoff

        console.log(`🔄 Tentativa de reconexão ${this.reconnectAttempts}/${this.maxReconnectAttempts} em ${delay}ms`);

        setTimeout(() => {
            this.cleanup();
            // Tentar reconectar (implementação futura)
        }, delay);
    }

    /**
     * Handler: transaction_progress - Progresso individual de transação
     */
    handleTransactionProgressEvent(eventData) {
        console.log('🔄 Progresso de transação:', eventData);

        // Atualizar contador processado
        if (eventData.current !== undefined) {
            this.updateCounter('processedCount', eventData.current);
        }

        // Mensagem de progresso detalhada
        if (eventData.current && eventData.total) {
            this.updateProgressMessage(`Processando transação ${eventData.current}/${eventData.total}`);

            // Calcular progresso baseado na transação atual
            const progressPercent = (eventData.current / eventData.total) * 0.15 + 0.65; // Entre 65% e 80%
            this.updateProgressBar(progressPercent);
        }

        // Atualizar outros contadores se disponível
        if (eventData.matches_found !== undefined) {
            this.updateCounter('matchesCount', eventData.matches_found);
        }
    }

    /**
     * Handler: processing_progress - Progresso geral de processamento
     */
    handleProcessingProgressEvent(eventData) {
        console.log('📊 Progresso de processamento:', eventData);

        // Atualizar múltiplos contadores
        const counters = {};

        if (eventData.processed_count !== undefined) {
            counters.processedCount = eventData.processed_count;
        }

        if (eventData.matches_count !== undefined) {
            counters.matchesCount = eventData.matches_count;
        }

        // Aplicar atualizações
        if (Object.keys(counters).length > 0) {
            Object.entries(counters).forEach(([id, value]) => {
                this.updateCounter(id, value);
            });
        }

        // Atualizar progresso geral se disponível
        if (eventData.progress_percent !== undefined) {
            this.updateProgressBar(eventData.progress_percent / 100);
        }

        // Mensagem personalizada
        if (eventData.message) {
            this.updateProgressMessage(eventData.message);
        }
    }

    /**
     * Cleanup da conexão SSE
     */
    cleanup() {
        if (this.eventSource) {
            this.eventSource.close();
            this.eventSource = null;
            console.log('🧹 Conexão SSE limpa');
        }
    }

    /**
     * Reset dos dados de streaming
     */
    resetStreamingData() {
        this.streamingData = {
            progress: 0,
            currentStep: '',
            results: {
                conciliated: [],
                suggested: [],
                pending: [],
                no_correlation: [],
                unmatched_mongo: []
            },
            counters: {
                conciliated: 0,
                suggested: 0,
                pending: 0,
                no_correlation: 0,
                unmatched_mongo: 0
            },
            events: []
        };
        console.log('🔄 Dados de streaming resetados');
    }

    /**
     * Mostra a seção de análise do arquivo
     */
    showFileAnalysis() {
        const fileAnalysis = document.getElementById('fileAnalysis');
        if (fileAnalysis && fileAnalysis.style.display === 'none') {
            fileAnalysis.style.display = 'block';
            setTimeout(() => {
                fileAnalysis.classList.add('visible');
            }, 100);
            console.log('📊 Seção de análise do arquivo exibida');
        }
    }

    /**
     * Atualiza um valor de análise com animação
     */
    updateAnalysisValue(fieldId, value) {
        const element = document.getElementById(fieldId);
        if (element) {
            const oldValue = element.textContent;
            if (value !== oldValue && value !== '--') {
                element.textContent = value;
                element.classList.add('updated');
                element.closest('.analysis-item')?.classList.add('updated');

                setTimeout(() => {
                    element.classList.remove('updated');
                    element.closest('.analysis-item')?.classList.remove('updated');
                }, 1000);

                console.log(`📊 Análise atualizada ${fieldId}: ${oldValue} → ${value}`);
            }
        }
    }

    /**
     * Atualiza dados financeiros com formatação e animações
     */
    updateFinancialData(data) {
        console.log('💰 Atualizando dados financeiros:', data);

        // Atualizar contadores e valores de despesas
        if (data.expenses_count !== undefined) {
            this.updateFinancialElement('expensesCount', data.expenses_count);
        }
        if (data.expenses_amount !== undefined) {
            this.updateFinancialElement('expensesAmount', this.formatCurrency(data.expenses_amount));
        }

        // Atualizar contadores e valores de receitas
        if (data.incomes_count !== undefined) {
            this.updateFinancialElement('incomesCount', data.incomes_count);
        }
        if (data.incomes_amount !== undefined) {
            this.updateFinancialElement('incomesAmount', this.formatCurrency(data.incomes_amount));
        }

        // Atualizar total movimentado
        if (data.total_amount !== undefined) {
            this.updateFinancialElement('totalAmount', this.formatCurrency(data.total_amount));
        }
    }

    /**
     * Atualiza elemento financeiro individual com animação
     */
    updateFinancialElement(elementId, value) {
        const element = document.getElementById(elementId);
        if (element) {
            const oldValue = element.textContent;
            if (String(value) !== oldValue) {
                element.textContent = value;
                element.classList.add('updated');
                element.closest('.financial-item')?.classList.add('updated');

                setTimeout(() => {
                    element.classList.remove('updated');
                    element.closest('.financial-item')?.classList.remove('updated');
                }, 1000);

                console.log(`💰 Financeiro atualizado ${elementId}: ${oldValue} → ${value}`);
            }
        }
    }

    /**
     * Formatar valor como moeda brasileira
     */
    formatCurrency(value) {
        if (!value || isNaN(value)) return 'R$ 0,00';

        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(value);
    }

    /**
     * Debug detalhado do sistema
     */
    enableDebugMode() {
        console.log('🔍 STREAMING DEBUG MODE ATIVADO');
        console.log('📊 Estado atual:', this.getStatus());

        // Override dos métodos para adicionar logs detalhados
        const originalProcessSSEEvent = this.processSSEEvent.bind(this);
        this.processSSEEvent = (eventData) => {
            console.log('🔍 DEBUG - Evento recebido:', {
                type: eventData.type,
                timestamp: eventData.timestamp,
                data: eventData,
                handler: this.eventHandlers[eventData.type] ? 'Encontrado' : 'NÃO ENCONTRADO'
            });
            return originalProcessSSEEvent(eventData);
        };

        // Override updateProgressBar para debug
        const originalUpdateProgressBar = this.updateProgressBar.bind(this);
        this.updateProgressBar = (progress) => {
            console.log(`🔍 DEBUG - Progress: ${Math.round(progress * 100)}%`);
            return originalUpdateProgressBar(progress);
        };

        // Override updateCounter para debug
        const originalUpdateCounter = this.updateCounter.bind(this);
        this.updateCounter = (counterId, value) => {
            console.log(`🔍 DEBUG - Counter ${counterId}: ${value}`);
            return originalUpdateCounter(counterId, value);
        };

        console.log('✅ Debug mode configurado');
    }

    /**
     * Log detalhado do estado interno
     */
    logInternalState() {
        console.log('📊 === ESTADO INTERNO DO STREAMING MANAGER ===');
        console.log('🔄 Estado:', this.state);
        console.log('🆔 Session ID:', this.sessionId);
        console.log('📈 Progresso:', Math.round(this.streamingData.progress * 100) + '%');
        console.log('🎯 Step atual:', this.streamingData.currentStep);
        console.log('📊 Contadores:', this.streamingData.counters);
        console.log('📋 Eventos registrados:', this.streamingData.events.length);
        console.log('🔗 EventSource:', this.eventSource ? 'Ativo' : 'Inativo');
        console.log('📱 Container:', this.container ? 'Encontrado' : 'NÃO ENCONTRADO');

        // Log dos handlers disponíveis
        console.log('⚙️ Event Handlers:', Object.keys(this.eventHandlers));

        console.log('📊 === FIM DO ESTADO INTERNO ===');
    }

    /**
     * Função de teste para verificar conectividade SSE
     */
    async testSSEConnection() {
        console.log('🧪 === TESTE DE CONECTIVIDADE SSE ===');

        try {
            // Teste 1: Health check da API
            console.log('1️⃣ Testando health check da API...');
            const healthResponse = await fetch(`${this.apiUrl}/health`);
            console.log('Health response:', healthResponse.status, healthResponse.statusText);

            // Teste 2: Verificar se endpoint de stream existe
            console.log('2️⃣ Testando endpoint de stream...');
            const streamTestResponse = await fetch(`${this.apiUrl}/stream/test`, { method: 'HEAD' });
            console.log('Stream endpoint test:', streamTestResponse.status);

            // Teste 3: Verificar elementos DOM
            console.log('3️⃣ Verificando elementos DOM...');
            const elements = {
                progressSection: document.getElementById('progressSection'),
                extractedCount: document.getElementById('extractedCount'),
                processedCount: document.getElementById('processedCount'),
                matchesCount: document.getElementById('matchesCount')
            };

            Object.entries(elements).forEach(([name, element]) => {
                console.log(`   ${name}: ${element ? `✅ Encontrado (valor: "${element.textContent}")` : '❌ NÃO ENCONTRADO'}`);
            });

            console.log('✅ Teste de conectividade concluído');
            return true;

        } catch (error) {
            console.error('❌ Erro no teste de conectividade:', error);
            return false;
        }
    }

    /**
     * Simular evento para teste
     */
    simulateTestEvent(eventType = 'transactions_extracted', data = {}) {
        console.log(`🎭 Simulando evento: ${eventType}`);

        const testEvent = {
            type: eventType,
            transaction_count: data.count || 197,
            message: data.message || 'Evento de teste',
            timestamp: new Date().toISOString(),
            ...data
        };

        console.log('📡 Evento de teste:', testEvent);
        this.processSSEEvent(testEvent);
    }

    // ============================================================================
    // NOVOS EVENT HANDLERS GRANULARES PARA CONCILIAÇÃO AO VIVO
    // ============================================================================

    /**
     * Handler: transaction_processing - Processando transação individual
     */
    handleTransactionProcessingEvent(eventData) {
        console.log('⚡ Processando transação individual:', eventData);

        const { current, total, transaction_id, progress_percent } = eventData;

        // Atualizar mensagem com progresso específico
        if (current && total) {
            this.updateProgressMessage(`Processando transação ${current} de ${total}`);

            // Atualizar contador processado em tempo real
            this.updateCounterWithThrottle('processedCount', current);

            // Atualizar progresso baseado na transação atual
            if (progress_percent !== undefined) {
                this.updateProgressBar(progress_percent / 100);
            }
        }

        // Log detalhado
        console.log(`📊 Transação ${current}/${total} sendo processada (ID: ${transaction_id})`);
    }

    /**
     * Handler: match_found - Match encontrado em tempo real
     */
    handleMatchFoundEvent(eventData) {
        console.log('🎯 Match encontrado:', eventData);

        const { transaction_id, match_type, current_matches, total_matches } = eventData;

        // Atualizar contador de matches em tempo real
        if (current_matches !== undefined) {
            this.updateCounterWithThrottle('matchesCount', current_matches);
        }

        // Mostrar feedback visual do match
        this.showMatchFeedback(match_type, transaction_id);

        console.log(`✅ Match ${match_type} encontrado! Total: ${current_matches}`);
    }

    /**
     * Handler: counter_update - Atualização específica de contador
     */
    handleCounterUpdateEvent(eventData) {
        console.log('📊 Atualizações de contadores:', eventData);

        const { counters } = eventData;

        if (counters) {
            Object.entries(counters).forEach(([counterType, value]) => {
                // Mapear tipos de contador para IDs corretos
                const counterMap = {
                    'processed': 'processedCount',
                    'extracted': 'extractedCount',
                    'matches': 'matchesCount',
                    'uploaded': 'uploadedCount'
                };

                const counterId = counterMap[counterType] || `${counterType}Count`;
                this.updateCounterWithThrottle(counterId, value);
            });
        }
    }

    /**
     * Handler: batch_processed - Lote de transações processado
     */
    handleBatchProcessedEvent(eventData) {
        console.log('📦 Lote processado:', eventData);

        const { batch_size, total_processed, remaining } = eventData;

        // Atualizar contador geral
        if (total_processed !== undefined) {
            this.updateCounterWithThrottle('processedCount', total_processed);
        }

        // Mensagem informativa
        if (remaining !== undefined) {
            this.updateProgressMessage(`${total_processed} processadas, ${remaining} restantes`);
        }

        console.log(`📊 Lote de ${batch_size} transações processado. Total: ${total_processed}`);
    }

    /**
     * Atualizar contador com throttling para performance
     */
    updateCounterWithThrottle(counterId, value) {
        const now = Date.now();

        // Armazenar última atualização pendente
        this.pendingCounterUpdates[counterId] = value;

        // Verificar se pode atualizar (throttling)
        if (now - this.lastCounterUpdate >= this.throttleInterval) {
            this.flushPendingCounterUpdates();
            this.lastCounterUpdate = now;
        } else {
            // Agendar atualização se não há uma pendente
            if (!this.throttleTimeout) {
                this.throttleTimeout = setTimeout(() => {
                    this.flushPendingCounterUpdates();
                    this.throttleTimeout = null;
                }, this.throttleInterval);
            }
        }
    }

    /**
     * Processar todas as atualizações pendentes de contadores
     */
    flushPendingCounterUpdates() {
        Object.entries(this.pendingCounterUpdates).forEach(([counterId, value]) => {
            this.updateCounterAnimated(counterId, value);
        });

        // Limpar atualizações pendentes
        this.pendingCounterUpdates = {};
    }

    /**
     * Atualizar contador com animação suave
     */
    updateCounterAnimated(counterId, targetValue) {
        const element = document.getElementById(counterId);
        if (!element) {
            console.warn(`⚠️ Contador ${counterId} não encontrado para animação`);
            return;
        }

        const currentValue = parseInt(element.textContent) || 0;
        const difference = targetValue - currentValue;

        // Se diferença é pequena, animar incrementalmente
        if (difference > 0 && difference <= 10) {
            this.animateCounterIncrement(element, currentValue, targetValue, 100);
        } else {
            // Atualização direta para diferenças grandes
            element.textContent = targetValue;
            this.addCounterAnimation(element);
        }

        console.log(`📊 Contador ${counterId}: ${currentValue} → ${targetValue}`);
    }

    /**
     * Animar incremento suave de contador
     */
    animateCounterIncrement(element, startValue, endValue, duration) {
        const difference = endValue - startValue;
        const increment = difference / (duration / 16); // ~60fps
        let currentValue = startValue;

        const animate = () => {
            currentValue += increment;

            if (currentValue >= endValue) {
                element.textContent = endValue;
                this.addCounterAnimation(element);
            } else {
                element.textContent = Math.floor(currentValue);
                requestAnimationFrame(animate);
            }
        };

        requestAnimationFrame(animate);
    }

    /**
     * Adicionar animação visual ao contador
     */
    addCounterAnimation(element) {
        element.classList.add('counter-updated', 'counter-pulse');

        setTimeout(() => {
            element.classList.remove('counter-updated', 'counter-pulse');
        }, 600);
    }

    /**
     * Mostrar feedback visual de match encontrado
     */
    showMatchFeedback(matchType, transactionId) {
        // Criar elemento de feedback temporário
        const feedback = document.createElement('div');
        feedback.className = `match-feedback match-${matchType}`;
        feedback.innerHTML = `
            <i class="fas fa-check-circle"></i>
            <span>Match ${matchType}!</span>
        `;

        // Adicionar ao container de progresso
        const progressSection = document.getElementById('progressSection');
        if (progressSection) {
            progressSection.appendChild(feedback);

            // Remover após animação
            setTimeout(() => {
                feedback.remove();
            }, 2000);
        }

        console.log(`🎯 Feedback visual para match ${matchType} (TX: ${transactionId})`);
    }
}

// Export para uso global
window.StreamingManager = StreamingManager;