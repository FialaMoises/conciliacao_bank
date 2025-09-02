// billing-rules.js - Gerenciamento de Prompts de Conciliação

// Estado global
let currentPrompts = [];
let editingPromptId = null;

// Inicialização
document.addEventListener('DOMContentLoaded', function() {
    console.log('📋 Billing Rules JS carregado');
    loadPromptsFromLocal();
});

// Função para alternar entre seções principais
window.switchMainSection = function(section) {
    console.log('🔄 Alternando para seção:', section);
    
    // Esconder todas as seções
    document.querySelectorAll('.main-section').forEach(sec => {
        sec.style.display = 'none';
    });
    
    // Remover classe active de todas as abas
    document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Mostrar seção selecionada
    const sectionElement = document.getElementById(`${section}-section`);
    if (sectionElement) {
        sectionElement.style.display = 'block';
    }
    
    // Marcar aba como ativa
    document.querySelector(`[data-section="${section}"]`)?.classList.add('active');
    
    // Carregar dados específicos da seção
    if (section === 'reconciliation-rules') {
        loadPromptsFromLocal();
    }
};

// Função para mostrar modal de criar/editar prompt
window.showCreatePromptModal = function(promptId = null) {
    console.log('📝 Abrindo modal de prompt:', promptId ? 'Editar' : 'Novo');
    
    const modal = document.getElementById('promptModal');
    const form = document.getElementById('promptForm');
    const title = document.getElementById('promptModalTitle');
    
    if (!modal || !form) {
        console.error('Modal ou formulário não encontrado');
        return;
    }
    
    // Limpar formulário
    form.reset();
    editingPromptId = promptId;
    
    if (promptId) {
        // Modo edição
        const prompt = currentPrompts.find(p => p.id === promptId);
        if (prompt) {
            title.innerHTML = '<i class="fas fa-edit"></i> Editar Prompt';
            document.getElementById('promptName').value = prompt.name;
            document.getElementById('promptType').value = prompt.type;
            document.getElementById('promptPriority').value = prompt.priority;
            document.getElementById('promptActive').value = prompt.active.toString();
            document.getElementById('promptContent').value = prompt.content;
            document.getElementById('promptContext').value = prompt.context || '';
        }
    } else {
        // Modo criação
        title.innerHTML = '<i class="fas fa-plus-circle"></i> Novo Prompt de Conciliação';
        // Definir valores padrão
        document.getElementById('promptPriority').value = 1;
        document.getElementById('promptActive').value = 'true';
        
        // Exemplo de prompt inteligente
        document.getElementById('promptContent').value = `Tudo no mês de julho deve ser sugerido para revisão manual.

Explicação: Devido ao período de fechamento fiscal, todas as transações de julho precisam passar por uma análise mais cuidadosa antes da conciliação automática.`;
    }
    
    modal.style.display = 'flex';
};

// Função para fechar modal
window.closePromptModal = function() {
    const modal = document.getElementById('promptModal');
    if (modal) {
        modal.style.display = 'none';
        editingPromptId = null;
    }
};

// Função para salvar prompt
window.savePrompt = async function() {
    console.log('💾 Salvando prompt...');
    
    const formData = {
        name: document.getElementById('promptName').value.trim(),
        type: document.getElementById('promptType').value,
        priority: parseInt(document.getElementById('promptPriority').value) || 1,
        active: document.getElementById('promptActive').value === 'true',
        content: document.getElementById('promptContent').value.trim(),
        context: document.getElementById('promptContext').value.trim(),
        // Campos removidos: agora tudo via interpretação LLM inteligente
        start_date: null,
        end_date: null,
        force_status: null
    };
    
    // Validação
    if (!formData.name) {
        showNotification('Nome do prompt é obrigatório', 'error');
        return;
    }
    
    if (!formData.content) {
        showNotification('Conteúdo do prompt é obrigatório', 'error');
        return;
    }
    
    try {
        // Se estamos editando, incluir o ID
        if (editingPromptId) {
            formData.id = editingPromptId;
        }
        
        // Salvar no backend
        const response = await fetch('http://localhost:5000/api/prompts', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });
        
        const result = await response.json();
        
        if (result.success) {
            showNotification(result.message, 'success');
            
            // Fechar modal e recarregar lista
            closePromptModal();
            await loadPromptsFromBackend();
        } else {
            showNotification('Erro ao salvar prompt: ' + result.error, 'error');
        }
        
    } catch (error) {
        console.error('❌ Erro ao salvar prompt:', error);
        
        // Fallback para localStorage se o backend não estiver disponível
        try {
            await savePromptToLocalStorage(formData);
            showNotification(`Prompt "${formData.name}" salvo localmente (backend indisponível)`, 'warning');
            closePromptModal();
            loadPromptsFromLocal();
        } catch (localError) {
            showNotification('Erro ao salvar prompt: ' + error.message, 'error');
        }
    }
};

// Função principal para carregar prompts (tenta backend primeiro)
window.loadPromptsFromLocal = async function() {
    console.log('📂 Carregando prompts...');
    
    try {
        // Tentar carregar do backend primeiro
        await loadPromptsFromBackend();
    } catch (error) {
        console.log('⚠️ Backend indisponível, carregando do localStorage');
        loadPromptsFromLocalStorage();
    }
};

// Função para carregar prompts do backend
async function loadPromptsFromBackend() {
    console.log('🌐 Carregando prompts do backend...');
    
    try {
        const response = await fetch('http://localhost:5000/api/prompts');
        const result = await response.json();
        
        if (result.success) {
            currentPrompts = result.prompts || [];
            console.log(`✅ ${currentPrompts.length} prompts carregados do backend`);
            
            // Sincronizar com localStorage para backup
            localStorage.setItem('reconciliationPrompts', JSON.stringify(currentPrompts));
            
            // Atualizar interface
            updatePromptStats(currentPrompts);
            updatePromptsTable(currentPrompts);
            
            return currentPrompts;
        } else {
            throw new Error(result.error);
        }
    } catch (error) {
        console.error('❌ Erro ao carregar do backend:', error);
        throw error;
    }
}

// Função para carregar prompts do localStorage (fallback)
function loadPromptsFromLocalStorage() {
    console.log('💾 Carregando prompts do localStorage...');
    
    try {
        const prompts = JSON.parse(localStorage.getItem('reconciliationPrompts') || '[]');
        currentPrompts = prompts;
        
        console.log(`✅ ${prompts.length} prompts carregados do localStorage`);
        
        // Atualizar contadores
        updatePromptStats(prompts);
        
        // Atualizar tabela
        updatePromptsTable(prompts);
        
        return prompts;
    } catch (error) {
        console.error('Erro ao carregar prompts do localStorage:', error);
        return [];
    }
}

// Função para salvar no localStorage como fallback
async function savePromptToLocalStorage(formData) {
    let prompts = JSON.parse(localStorage.getItem('reconciliationPrompts') || '[]');
    
    if (editingPromptId) {
        // Atualizar prompt existente
        const index = prompts.findIndex(p => p.id === editingPromptId);
        if (index !== -1) {
            prompts[index] = {
                ...prompts[index],
                ...formData,
                updated_at: new Date().toISOString()
            };
        }
    } else {
        // Criar novo prompt
        const newPrompt = {
            ...formData,
            id: 'prompt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
        prompts.push(newPrompt);
    }
    
    localStorage.setItem('reconciliationPrompts', JSON.stringify(prompts));
}

// Função para atualizar estatísticas
function updatePromptStats(prompts) {
    const totalCount = prompts.length;
    const activeCount = prompts.filter(p => p.active).length;
    const inactiveCount = totalCount - activeCount;
    
    const totalEl = document.getElementById('totalRulesCount');
    const activeEl = document.getElementById('activeRulesCount');
    const inactiveEl = document.getElementById('inactiveRulesCount');
    
    if (totalEl) totalEl.textContent = totalCount;
    if (activeEl) activeEl.textContent = activeCount;
    if (inactiveEl) inactiveEl.textContent = inactiveCount;
}

// Função para atualizar tabela de prompts
function updatePromptsTable(prompts) {
    const tableBody = document.getElementById('promptsTableBody');
    const emptyState = document.getElementById('promptsEmptyState');
    
    if (!tableBody) return;
    
    if (prompts.length === 0) {
        tableBody.innerHTML = '';
        if (emptyState) emptyState.style.display = 'block';
    } else {
        if (emptyState) emptyState.style.display = 'none';
        tableBody.innerHTML = prompts.map(prompt => createPromptRow(prompt)).join('');
    }
}

// Função para criar linha da tabela
function createPromptRow(prompt) {
    const createdDate = new Date(prompt.created_at).toLocaleDateString('pt-BR');
    const typeLabels = {
        'billing': 'Cobrança',
        'matching': 'Correspondência',
        'validation': 'Validação',
        'general': 'Geral'
    };
    
    const typeColors = {
        'billing': '#ef4444',
        'matching': '#3b82f6',
        'validation': '#10b981',
        'general': '#6b7280'
    };
    
    return `
        <tr data-prompt-id="${prompt.id}">
            <td>
                <strong>${prompt.name}</strong>
                <br><small class="text-muted">Criado: ${createdDate}</small>
            </td>
            <td>
                <span class="type-badge" style="background: ${typeColors[prompt.type]}20; color: ${typeColors[prompt.type]};">
                    ${typeLabels[prompt.type] || prompt.type}
                </span>
            </td>
            <td class="prompt-content" title="${escapeHtml(prompt.content)}">
                ${prompt.content.substring(0, 100)}${prompt.content.length > 100 ? '...' : ''}
            </td>
            <td>${prompt.context || '<span class="text-muted">Sem contexto</span>'}</td>
            <td><span class="priority-badge">${prompt.priority}</span></td>
            <td>
                ${prompt.active 
                    ? '<span class="status-badge active">Ativo</span>' 
                    : '<span class="status-badge inactive">Inativo</span>'}
            </td>
            <td>
                <div class="action-buttons">
                    <button class="btn-action edit" onclick="editPrompt('${prompt.id}')" title="Editar">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-action toggle" onclick="togglePromptStatus('${prompt.id}')" title="${prompt.active ? 'Desativar' : 'Ativar'}">
                        <i class="fas fa-${prompt.active ? 'pause' : 'play'}"></i>
                    </button>
                    <button class="btn-action delete" onclick="deletePrompt('${prompt.id}')" title="Excluir">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        </tr>
    `;
}

// Função para editar prompt
window.editPrompt = function(promptId) {
    showCreatePromptModal(promptId);
};

// Função para alternar status do prompt
window.togglePromptStatus = function(promptId) {
    try {
        let prompts = JSON.parse(localStorage.getItem('reconciliationPrompts') || '[]');
        const prompt = prompts.find(p => p.id === promptId);
        
        if (prompt) {
            prompt.active = !prompt.active;
            prompt.updated_at = new Date().toISOString();
            
            localStorage.setItem('reconciliationPrompts', JSON.stringify(prompts));
            showNotification(
                `Prompt "${prompt.name}" ${prompt.active ? 'ativado' : 'desativado'} com sucesso!`,
                'success'
            );
            loadPromptsFromLocal();
            syncPromptsWithBackend(prompts);
        }
    } catch (error) {
        console.error('Erro ao alternar status:', error);
        showNotification('Erro ao alternar status do prompt', 'error');
    }
};

// Função para excluir prompt
window.deletePrompt = function(promptId) {
    const prompt = currentPrompts.find(p => p.id === promptId);
    if (!prompt) return;
    
    if (confirm(`Tem certeza que deseja excluir o prompt "${prompt.name}"?`)) {
        try {
            let prompts = JSON.parse(localStorage.getItem('reconciliationPrompts') || '[]');
            prompts = prompts.filter(p => p.id !== promptId);
            
            localStorage.setItem('reconciliationPrompts', JSON.stringify(prompts));
            showNotification(`Prompt "${prompt.name}" excluído com sucesso!`, 'success');
            loadPromptsFromLocal();
            syncPromptsWithBackend(prompts);
        } catch (error) {
            console.error('Erro ao excluir prompt:', error);
            showNotification('Erro ao excluir prompt', 'error');
        }
    }
};

// Função para filtrar prompts
window.filterPrompts = function() {
    const searchTerm = document.getElementById('searchPromptInput')?.value.toLowerCase() || '';
    
    const filtered = currentPrompts.filter(p => 
        p.name.toLowerCase().includes(searchTerm) ||
        p.content.toLowerCase().includes(searchTerm) ||
        (p.context && p.context.toLowerCase().includes(searchTerm))
    );
    
    updatePromptsTable(filtered);
};

// Função para filtrar por status
window.filterPromptsByStatus = function(status) {
    // Atualizar botões de filtro
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');
    
    let filtered = currentPrompts;
    
    if (status === 'active') {
        filtered = currentPrompts.filter(p => p.active);
    } else if (status === 'inactive') {
        filtered = currentPrompts.filter(p => !p.active);
    }
    
    updatePromptsTable(filtered);
};

// Função para sincronizar com backend
async function syncPromptsWithBackend(prompts) {
    try {
        const response = await fetch('http://localhost:5000/api/prompts/sync', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ prompts })
        });
        
        if (response.ok) {
            console.log('✅ Prompts sincronizados com o backend');
        }
    } catch (error) {
        console.log('⚠️ Backend não disponível, usando apenas armazenamento local');
    }
}

// Função para mostrar notificação
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    
    const icons = {
        success: 'fa-check-circle',
        error: 'fa-exclamation-circle',
        warning: 'fa-exclamation-triangle',
        info: 'fa-info-circle'
    };
    
    const colors = {
        success: '#10b981',
        error: '#ef4444',
        warning: '#f59e0b',
        info: '#3b82f6'
    };
    
    notification.innerHTML = `
        <i class="fas ${icons[type]}"></i>
        <span>${message}</span>
    `;
    
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${colors[type]};
        color: white;
        padding: 15px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        display: flex;
        align-items: center;
        gap: 10px;
        z-index: 10000;
        animation: slideIn 0.3s ease;
        max-width: 400px;
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Função para escapar HTML
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

// Função para exportar prompts
window.exportPrompts = function() {
    const prompts = JSON.parse(localStorage.getItem('reconciliationPrompts') || '[]');
    const dataStr = JSON.stringify(prompts, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `prompts_conciliacao_${new Date().toISOString().split('T')[0]}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
    
    showNotification('Prompts exportados com sucesso!', 'success');
};

// Função para importar prompts
window.importPrompts = function(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const importedPrompts = JSON.parse(e.target.result);
            
            if (!Array.isArray(importedPrompts)) {
                throw new Error('Arquivo inválido: esperado um array de prompts');
            }
            
            const currentPrompts = JSON.parse(localStorage.getItem('reconciliationPrompts') || '[]');
            const mergedPrompts = [...currentPrompts, ...importedPrompts];
            
            localStorage.setItem('reconciliationPrompts', JSON.stringify(mergedPrompts));
            loadPromptsFromLocal();
            showNotification(`${importedPrompts.length} prompts importados com sucesso!`, 'success');
            
        } catch (error) {
            console.error('Erro ao importar prompts:', error);
            showNotification('Erro ao importar prompts: ' + error.message, 'error');
        }
    };
    
    reader.readAsText(file);
    event.target.value = ''; // Limpar input para permitir reimportação
};

// Adicionar estilos de animação se não existirem
if (!document.getElementById('billing-rules-styles')) {
    const style = document.createElement('style');
    style.id = 'billing-rules-styles';
    style.innerHTML = `
        @keyframes slideIn {
            from {
                transform: translateX(100%);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
        
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
        
        .text-muted {
            color: #6b7280;
            font-style: italic;
        }
        
        .type-badge {
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: 600;
            text-transform: uppercase;
        }
        
        .priority-badge {
            background: #f3f4f6;
            color: #374151;
            padding: 2px 8px;
            border-radius: 4px;
            font-weight: 600;
        }
        
        .status-badge {
            padding: 4px 12px;
            border-radius: 12px;
            font-size: 12px;
            font-weight: 600;
        }
        
        .status-badge.active {
            background: #10b98120;
            color: #10b981;
        }
        
        .status-badge.inactive {
            background: #ef444420;
            color: #ef4444;
        }
        
        .prompt-content {
            max-width: 300px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        
        .action-buttons {
            display: flex;
            gap: 8px;
        }
        
        .btn-action {
            background: transparent;
            border: 1px solid #e5e7eb;
            border-radius: 4px;
            padding: 6px 10px;
            cursor: pointer;
            transition: all 0.2s;
        }
        
        .btn-action:hover {
            background: #f3f4f6;
        }
        
        .btn-action.edit {
            color: #3b82f6;
        }
        
        .btn-action.toggle {
            color: #f59e0b;
        }
        
        .btn-action.delete {
            color: #ef4444;
        }
    `;
    document.head.appendChild(style);
}

console.log('✅ Billing Rules JS carregado completamente');