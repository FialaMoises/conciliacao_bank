// Gerenciamento de Regras de Conciliação com IA

const API_BASE_URL = 'https://holdprintwebbankreconciliation-test.azurewebsites.net';

// Estado da aplicação
let currentRules = [];
let editingRuleId = null;

// Inicialização
document.addEventListener('DOMContentLoaded', function() {
    console.log('Inicializando sistema de regras de conciliação...');
    loadRules();
    setupEventListeners();
});

// Configurar event listeners
function setupEventListeners() {
    const form = document.getElementById('ruleForm');
    if (form) {
        form.addEventListener('submit', handleRuleSubmit);
    }

    // Fechar modal ao clicar fora
    const modal = document.getElementById('ruleModal');
    if (modal) {
        modal.addEventListener('click', function(e) {
            if (e.target === modal) {
                closeRuleModal();
            }
        });
    }
}

// Carregar regras
async function loadRules() {
    try {
        const response = await fetch(`${API_BASE_URL}/reconciliation-rules`);
        
        if (response.ok) {
            const data = await response.json();
            currentRules = data.rules || [];
            renderRules();
        } else {
            // Se o endpoint não existe ainda, usar dados locais
            loadRulesFromLocal();
        }
    } catch (error) {
        console.error('Erro ao carregar regras:', error);
        // Fallback para localStorage
        loadRulesFromLocal();
    }
}

// Carregar regras do localStorage
function loadRulesFromLocal() {
    const stored = localStorage.getItem('reconciliationRules');
    if (stored) {
        try {
            const data = JSON.parse(stored);
            currentRules = data.rules || [];
        } catch (e) {
            currentRules = [];
        }
    } else {
        // Criar regra padrão inicial
        currentRules = [{
            id: 'rule-001',
            name: 'Conciliação por Data e Valor Exatos',
            description: 'Se a data e o valor são exatamente iguais, a transação deve ser automaticamente conciliada',
            prompt: 'Se existe data e valor combinando exatamente, ir para conciliado',
            priority: 1,
            active: true,
            created_at: new Date().toISOString(),
            created_by: 'user'
        }];
        saveRulesToLocal();
    }
    renderRules();
}

// Salvar regras no localStorage
function saveRulesToLocal() {
    const data = {
        version: '1.0',
        updated_at: new Date().toISOString(),
        rules: currentRules
    };
    localStorage.setItem('reconciliationRules', JSON.stringify(data));
    
    // Também salvar no arquivo via API se disponível
    saveRulesToFile(data);
}

// Salvar regras no arquivo via API
async function saveRulesToFile(data) {
    try {
        await fetch(`${API_BASE_URL}/reconciliation-rules`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
    } catch (error) {
        console.error('Erro ao salvar regras na API:', error);
    }
}

// Renderizar regras na tela
function renderRules() {
    const grid = document.getElementById('rulesGrid');
    const emptyState = document.getElementById('emptyState');
    
    if (!grid || !emptyState) return;
    
    if (currentRules.length === 0) {
        grid.innerHTML = '';
        emptyState.style.display = 'block';
        return;
    }
    
    emptyState.style.display = 'none';
    
    // Ordenar por prioridade
    const sortedRules = [...currentRules].sort((a, b) => a.priority - b.priority);
    
    grid.innerHTML = sortedRules.map(rule => createRuleCard(rule)).join('');
}

// Criar card de regra
function createRuleCard(rule) {
    const priorityClass = rule.priority <= 3 ? 'priority-high' : 
                         rule.priority <= 7 ? 'priority-medium' : 'priority-low';
    
    return `
        <div class="rule-card ${!rule.active ? 'inactive' : ''}" data-rule-id="${rule.id}">
            <div class="rule-header">
                <div class="rule-title">
                    <div class="rule-name">${escapeHtml(rule.name)}</div>
                    <div class="rule-description">${escapeHtml(rule.description || '')}</div>
                </div>
                <div class="rule-actions">
                    <button class="rule-btn toggle" onclick="toggleRule('${rule.id}')" 
                            title="${rule.active ? 'Desativar' : 'Ativar'}">
                        <i class="fas fa-${rule.active ? 'toggle-on' : 'toggle-off'}"></i>
                    </button>
                    <button class="rule-btn edit" onclick="editRule('${rule.id}')" title="Editar">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="rule-btn delete" onclick="deleteRule('${rule.id}')" title="Excluir">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
            
            <div class="rule-prompt">
                <div class="rule-prompt-label">Regra em linguagem natural:</div>
                <div class="rule-prompt-text">${escapeHtml(rule.prompt)}</div>
            </div>
            
            <div class="rule-meta">
                <div class="rule-meta-item">
                    <span class="priority-badge ${priorityClass}">
                        Prioridade ${rule.priority}
                    </span>
                </div>
                <div class="rule-meta-item">
                    <span class="status-badge ${rule.active ? 'status-active' : 'status-inactive'}">
                        ${rule.active ? 'Ativa' : 'Inativa'}
                    </span>
                </div>
                <div class="rule-meta-item">
                    <i class="fas fa-calendar"></i>
                    ${formatDate(rule.created_at)}
                </div>
                <div class="rule-meta-item">
                    <i class="fas fa-user"></i>
                    ${rule.created_by}
                </div>
            </div>
        </div>
    `;
}

// Abrir modal para adicionar regra
function openAddRuleModal() {
    editingRuleId = null;
    document.getElementById('modalTitle').textContent = 'Nova Regra de Conciliação';
    document.getElementById('ruleForm').reset();
    document.getElementById('rulePriority').value = '10';
    document.getElementById('ruleModal').classList.add('active');
}

// Fechar modal
function closeRuleModal() {
    document.getElementById('ruleModal').classList.remove('active');
    editingRuleId = null;
}

// Editar regra
function editRule(ruleId) {
    const rule = currentRules.find(r => r.id === ruleId);
    if (!rule) return;
    
    editingRuleId = ruleId;
    document.getElementById('modalTitle').textContent = 'Editar Regra de Conciliação';
    document.getElementById('ruleName').value = rule.name;
    document.getElementById('ruleDescription').value = rule.description || '';
    document.getElementById('rulePrompt').value = rule.prompt;
    document.getElementById('rulePriority').value = rule.priority;
    
    document.getElementById('ruleModal').classList.add('active');
}

// Deletar regra
function deleteRule(ruleId) {
    if (!confirm('Tem certeza que deseja excluir esta regra?')) {
        return;
    }
    
    currentRules = currentRules.filter(r => r.id !== ruleId);
    saveRulesToLocal();
    renderRules();
    
    showNotification('Regra excluída com sucesso!', 'success');
}

// Alternar status da regra
function toggleRule(ruleId) {
    const rule = currentRules.find(r => r.id === ruleId);
    if (rule) {
        rule.active = !rule.active;
        saveRulesToLocal();
        renderRules();
        
        const status = rule.active ? 'ativada' : 'desativada';
        showNotification(`Regra ${status} com sucesso!`, 'success');
    }
}

// Manipular envio do formulário
function handleRuleSubmit(e) {
    e.preventDefault();
    
    const formData = {
        name: document.getElementById('ruleName').value.trim(),
        description: document.getElementById('ruleDescription').value.trim(),
        prompt: document.getElementById('rulePrompt').value.trim(),
        priority: parseInt(document.getElementById('rulePriority').value) || 10
    };
    
    if (!formData.name || !formData.prompt) {
        showNotification('Por favor, preencha os campos obrigatórios', 'error');
        return;
    }
    
    if (editingRuleId) {
        // Editar regra existente
        const rule = currentRules.find(r => r.id === editingRuleId);
        if (rule) {
            Object.assign(rule, formData);
            rule.updated_at = new Date().toISOString();
        }
    } else {
        // Criar nova regra
        const newRule = {
            id: 'rule-' + Date.now(),
            ...formData,
            active: true,
            created_at: new Date().toISOString(),
            created_by: 'user'
        };
        currentRules.push(newRule);
    }
    
    saveRulesToLocal();
    renderRules();
    closeRuleModal();
    
    const action = editingRuleId ? 'atualizada' : 'criada';
    showNotification(`Regra ${action} com sucesso!`, 'success');
}

// Usar exemplo de regra
function useExample(element) {
    const prompt = element.querySelector('.example-prompt').textContent;
    document.getElementById('rulePrompt').value = prompt;
    
    // Sugerir nome baseado no prompt
    if (prompt.includes('data e valor')) {
        document.getElementById('ruleName').value = 'Conciliação por Data e Valor';
    } else if (prompt.includes('PIX')) {
        document.getElementById('ruleName').value = 'Regra para Transações PIX';
    } else if (prompt.includes('5%')) {
        document.getElementById('ruleName').value = 'Tolerância de 5% no Valor';
    } else if (prompt.includes('R$ 100')) {
        document.getElementById('ruleName').value = 'Regra para Valores Baixos';
    }
}

// Mostrar notificação
function showNotification(message, type = 'info') {
    // Criar elemento de notificação
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
        <span>${message}</span>
    `;
    
    // Adicionar ao body
    document.body.appendChild(notification);
    
    // Adicionar classe para animação
    setTimeout(() => notification.classList.add('show'), 10);
    
    // Remover após 3 segundos
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Funções auxiliares
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return (text || '').replace(/[&<>"']/g, m => map[m]);
}

function formatDate(dateStr) {
    if (!dateStr) return 'N/A';
    try {
        const date = new Date(dateStr);
        return date.toLocaleDateString('pt-BR');
    } catch {
        return dateStr;
    }
}

// CSS para notificações
const notificationStyles = `
    .notification {
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 1rem 1.5rem;
        border-radius: 0.5rem;
        background: white;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        display: flex;
        align-items: center;
        gap: 0.75rem;
        transform: translateX(400px);
        transition: transform 0.3s ease;
        z-index: 2000;
    }
    
    .notification.show {
        transform: translateX(0);
    }
    
    .notification-success {
        border-left: 4px solid var(--success-color);
    }
    
    .notification-success i {
        color: var(--success-color);
    }
    
    .notification-error {
        border-left: 4px solid var(--error-color);
    }
    
    .notification-error i {
        color: var(--error-color);
    }
    
    .notification-info {
        border-left: 4px solid var(--primary-color);
    }
    
    .notification-info i {
        color: var(--primary-color);
    }
`;

// Adicionar estilos de notificação
const styleSheet = document.createElement('style');
styleSheet.textContent = notificationStyles;
document.head.appendChild(styleSheet);