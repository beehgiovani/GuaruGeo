// ==========================================
// CRM HANDLER - Gerenciamento de Leads
// ==========================================

// Track leads count
window.currentLeadsCount = 0;

// Initialize and load leads count
window.initCRM = async function () {
    await updateLeadsCount();
    await checkNewMatches(); // Notification
};

// Update leads count badge
async function updateLeadsCount() {
    try {
        const { count, error } = await window.supabaseApp
            .from('leads')
            .select('*', { count: 'exact', head: true });

        if (!error) {
            window.currentLeadsCount = count || 0;
            const badge = document.getElementById('leadsCount');
            if (badge) badge.textContent = window.currentLeadsCount;
        }
    } catch (e) {
        console.error('Error updating leads count:', e);
    }
}

// Check for matches and notify
async function checkNewMatches() {
    try {
        // Simple logic: Check how many leads have potential matches.
        // Doing this client-side for all leads might be heavy, so limit to last 20?
        // Or just count total leads with status 'ativo'.
        const { data: leads, error } = await window.supabaseApp
            .from('leads')
            .select('id, zonas_interesse, tipo_imovel, quartos_min, valor_max')
            .eq('status', 'ativo')
            .limit(10); // Check top 10 active leads

        if (error || !leads) return;

        let leadsWithMatches = 0;
        for (const lead of leads) {
            // Simplified query to check existence
            let query = window.supabaseApp.from('unidades').select('inscricao', { count: 'exact', head: true });

            if (lead.zonas_interesse && lead.zonas_interesse.length > 0) {
                query = query.in('lotes.zona', lead.zonas_interesse);
                // Note: Join filter on 'lotes' requires inner join syntax in supabase-js or manual logic.
                // Supabase-js basic filter on foreign table: .not('lotes', 'is', null) + filter.
                // Actually, filtering on foreign tables in supabase-js is tricky:
                // select('*, lotes!inner(zona)') .in('lotes.zona', ...)
                query = window.supabaseApp.from('unidades')
                    .select('calc_id, lotes!inner(zona)', { count: 'exact', head: true })
                    .in('lotes.zona', lead.zonas_interesse);
            }

            if (lead.tipo_imovel) query = query.eq('tipo', lead.tipo_imovel);
            if (lead.quartos_min) query = query.gte('quartos', lead.quartos_min);
            if (lead.valor_max) query = query.lte('valor', lead.valor_max);

            const { count } = await query;
            if (count > 0) leadsWithMatches++;
        }

        if (leadsWithMatches > 0) {
            window.Toast.info(`Há imóveis compatíveis para ${leadsWithMatches} dos seus leads ativos!`, 'CRM MATCH');
        }

    } catch (e) {
        console.log("Match check skipped");
    }
}

// ========================================
// OPEN ADD/EDIT LEAD TOOLTIP
// ========================================
window.openAddLeadTooltip = function (leadId = null) {
    // Hide context menu
    if (window.hideContextMenu) window.hideContextMenu();

    const isEdit = !!leadId;
    const title = isEdit ? '✏️ Editar Cliente' : '👤 Novo Cliente CRM';
    const btnText = isEdit ? 'Atualizar Cliente' : 'Salvar Cliente';
    const btnAction = isEdit ? `window.updateLead('${leadId}')` : 'window.saveLead()';

    const tooltip = document.createElement('div');
    tooltip.className = 'lead-tooltip';
    tooltip.id = 'leadTooltip';

    tooltip.innerHTML = `
        <div class="lead-tooltip-header">
            <h3>${title}</h3>
            <button class="lead-tooltip-close" onclick="window.closeLeadTooltip()">×</button>
        </div>
        <div class="lead-tooltip-body">
            <!-- Dados Pessoais -->
            <div class="lead-form-section">
                <h4>📋 Dados Pessoais</h4>
                <div class="lead-form-row">
                    <div class="lead-form-field">
                        <label>Nome Completo *</label>
                        <input type="text" id="lead-nome" placeholder="João Silva" required>
                    </div>
                    <div class="lead-form-field">
                        <label>Telefone</label>
                        <input type="tel" id="lead-telefone" placeholder="(13) 99999-9999">
                    </div>
                </div>
                <div class="lead-form-row">
                    <div class="lead-form-field">
                        <label>Email</label>
                        <input type="email" id="lead-email" placeholder="joao@email.com">
                    </div>
                    <div class="lead-form-field">
                        <label>CPF/CNPJ</label>
                        <input type="text" id="lead-cpf" placeholder="000.000.000-00">
                    </div>
                </div>
            </div>

            <!-- Critérios de Busca -->
            <div class="lead-form-section">
                <h4>🎯 Critérios de Busca</h4>
                
                <!-- Zonas de Interesse -->
                <div class="lead-form-field">
                    <label>Zonas de Interesse</label>
                    <div class="zone-checkboxes">
                        <div class="zone-checkbox-item">
                            <input type="checkbox" id="zona-1" value="1">
                            <label for="zona-1">Zona 1</label>
                        </div>
                        <div class="zone-checkbox-item">
                            <input type="checkbox" id="zona-2" value="2">
                            <label for="zona-2">Zona 2</label>
                        </div>
                        <div class="zone-checkbox-item">
                            <input type="checkbox" id="zona-3" value="3">
                            <label for="zona-3">Zona 3</label>
                        </div>
                        <div class="zone-checkbox-item">
                            <input type="checkbox" id="zona-4" value="4">
                            <label for="zona-4">Zona 4</label>
                        </div>
                        <div class="zone-checkbox-item">
                            <input type="checkbox" id="zona-5" value="5">
                            <label for="zona-5">Zona 5</label>
                        </div>
                        <div class="zone-checkbox-item">
                            <input type="checkbox" id="zona-6" value="6">
                            <label for="zona-6">Zona 6</label>
                        </div>
                    </div>
                </div>

                <div class="lead-form-row">
                    <div class="lead-form-field">
                        <label>Tipo de Imóvel</label>
                        <select id="lead-tipo">
                            <option value="">Qualquer</option>
                            <option value="Apartamento">Apartamento</option>
                            <option value="Casa">Casa</option>
                            <option value="Terreno">Terreno</option>
                            <option value="Loja">Loja</option>
                        </select>
                    </div>
                    <div class="lead-form-field">
                        <label>Status</label>
                        <select id="lead-status">
                            <option value="ativo">Ativo</option>
                            <option value="inativo">Inativo</option>
                        </select>
                    </div>
                </div>

                <div class="lead-form-row">
                    <div class="lead-form-field">
                        <label>Quartos (Mínimo)</label>
                        <input type="number" id="lead-quartos-min" placeholder="2" min="0">
                    </div>
                    <div class="lead-form-field">
                        <label>Quartos (Máximo)</label>
                        <input type="number" id="lead-quartos-max" placeholder="4" min="0">
                    </div>
                </div>

                <div class="lead-form-row">
                    <div class="lead-form-field">
                        <label>Metragem Mínima (m²)</label>
                        <input type="number" id="lead-metragem-min" placeholder="50" step="0.01">
                    </div>
                    <div class="lead-form-field">
                        <label>Metragem Máxima (m²)</label>
                        <input type="number" id="lead-metragem-max" placeholder="200" step="0.01">
                    </div>
                </div>

                <div class="lead-form-row">
                    <div class="lead-form-field">
                        <label>Valor Mínimo (R$)</label>
                        <input type="number" id="lead-valor-min" placeholder="300000" step="1000">
                    </div>
                    <div class="lead-form-field">
                        <label>Valor Máximo (R$)</label>
                        <input type="number" id="lead-valor-max" placeholder="500000" step="1000">
                    </div>
                </div>
            </div>

            <!-- Observações -->
            <div class="lead-form-section">
                <h4>📝 Observações</h4>
                <div class="lead-form-row full">
                    <div class="lead-form-field">
                        <textarea id="lead-obs" placeholder="Notas adicionais sobre o cliente..."></textarea>
                    </div>
                </div>
            </div>
        </div>
        <div class="lead-tooltip-actions">
            <button class="lead-tooltip-btn secondary" onclick="window.closeLeadTooltip()">Cancelar</button>
            <button class="lead-tooltip-btn primary" onclick="${btnAction}">${btnText}</button>
        </div>
    `;

    document.body.appendChild(tooltip);

    // Initial Mask Setup
    const cpfInput = document.getElementById('lead-cpf');
    if (cpfInput) {
        cpfInput.addEventListener('input', (e) => {
            e.target.value = window.formatDocument(e.target.value, true);
        });
    }

    // Add backdrop
    const backdrop = document.createElement('div');
    backdrop.className = 'sidebar-backdrop active';
    backdrop.style.zIndex = '9999';
    backdrop.onclick = window.closeLeadTooltip;
    document.body.appendChild(backdrop);
    tooltip.backdrop = backdrop;

    // IF EDIT, FETCH AND FILL
    if (isEdit) {
        window.loadLeadData(leadId);
    }
};

window.loadLeadData = async function (leadId) {
    window.Loading.show('Carregando dados...');
    try {
        const { data: lead, error } = await window.supabaseApp
            .from('leads')
            .select('*')
            .eq('id', leadId)
            .single();

        if (error) throw error;

        // Fill fields
        if (lead.nome) document.getElementById('lead-nome').value = lead.nome;
        if (lead.telefone) document.getElementById('lead-telefone').value = lead.telefone;
        if (lead.email) document.getElementById('lead-email').value = lead.email;
        if (lead.cpf_cnpj) document.getElementById('lead-cpf').value = window.formatDocument(lead.cpf_cnpj, true);

        if (lead.tipo_imovel) document.getElementById('lead-tipo').value = lead.tipo_imovel;
        if (lead.status) document.getElementById('lead-status').value = lead.status;

        if (lead.quartos_min) document.getElementById('lead-quartos-min').value = lead.quartos_min;
        if (lead.quartos_max) document.getElementById('lead-quartos-max').value = lead.quartos_max;

        if (lead.metragem_min) document.getElementById('lead-metragem-min').value = lead.metragem_min;
        if (lead.metragem_max) document.getElementById('lead-metragem-max').value = lead.metragem_max;

        if (lead.valor_min) document.getElementById('lead-valor-min').value = lead.valor_min;
        if (lead.valor_max) document.getElementById('lead-valor-max').value = lead.valor_max;

        if (lead.observacoes) document.getElementById('lead-obs').value = lead.observacoes;

        // Zones
        if (lead.zonas_interesse) {
            lead.zonas_interesse.forEach(zona => {
                const cb = document.getElementById(`zona-${zona}`);
                if (cb) cb.checked = true;
            });
        }

    } catch (e) {
        console.error(e);
        window.Toast.error('Erro ao carregar lead');
        window.closeLeadTooltip();
    } finally {
        window.Loading.hide();
    }
};

// ========================================
// CLOSE LEAD TOOLTIP
// ========================================
window.closeLeadTooltip = function () {
    const tooltip = document.getElementById('leadTooltip');
    if (tooltip) {
        if (tooltip.backdrop) tooltip.backdrop.remove();
        tooltip.remove();
    }
};

// ========================================
// HELPER: GET FORM DATA
// ========================================
function getLeadFormData() {
    const nome = document.getElementById('lead-nome')?.value;
    const telefone = document.getElementById('lead-telefone')?.value;
    const email = document.getElementById('lead-email')?.value;
    const cpf_cnpj_raw = document.getElementById('lead-cpf')?.value;
    const cpf_cnpj = cpf_cnpj_raw ? cpf_cnpj_raw.replace(/\D/g, '') : null; // Clean for DB

    // Validation
    if (!nome) { window.Toast.warning('Nome é obrigatório'); return null; }

    // CPF Validation
    if (cpf_cnpj && cpf_cnpj.length > 0) {
        let valid = false;
        if (cpf_cnpj.length <= 11) valid = window.validateCPF(cpf_cnpj);
        else valid = window.validateCNPJ(cpf_cnpj);

        if (!valid) {
            window.Toast.error('CPF/CNPJ inválido!');
            return null;
        }
    }

    const tipo_imovel = document.getElementById('lead-tipo')?.value;
    const status = document.getElementById('lead-status')?.value;
    const quartos_min = parseInt(document.getElementById('lead-quartos-min')?.value) || null;
    const quartos_max = parseInt(document.getElementById('lead-quartos-max')?.value) || null;
    const metragem_min = parseFloat(document.getElementById('lead-metragem-min')?.value) || null;
    const metragem_max = parseFloat(document.getElementById('lead-metragem-max')?.value) || null;
    const valor_min = parseFloat(document.getElementById('lead-valor-min')?.value) || null;
    const valor_max = parseFloat(document.getElementById('lead-valor-max')?.value) || null;
    const observacoes = document.getElementById('lead-obs')?.value;

    const zonas_interesse = [];
    for (let i = 1; i <= 6; i++) {
        const checkbox = document.getElementById(`zona-${i}`);
        if (checkbox && checkbox.checked) zonas_interesse.push(i.toString());
    }

    return {
        nome, telefone, email, cpf_cnpj, zonas_interesse, tipo_imovel,
        quartos_min, quartos_max, metragem_min, metragem_max,
        valor_min, valor_max, observacoes, status,
        contato: telefone || email
    };
}

// ========================================
// SAVE LEAD (CREATE)
// ========================================
window.saveLead = async function () {
    const leadData = getLeadFormData();
    if (!leadData) return;

    window.Loading.show('Salvando cliente...');
    try {
        const { error } = await window.supabaseApp.from('leads').insert(leadData);
        if (error) throw error;

        window.Toast.success('Cliente cadastrado com sucesso!');
        window.closeLeadTooltip();
        await updateLeadsCount();
        if (document.getElementById('leadsPanel')) window.showLeadsPanel(); // Refresh list if open
    } catch (e) {
        console.error('Error saving lead:', e);
        window.Toast.error('Erro ao salvar: ' + e.message);
    } finally {
        window.Loading.hide();
    }
};

// ========================================
// UPDATE LEAD
// ========================================
window.updateLead = async function (leadId) {
    const leadData = getLeadFormData();
    if (!leadData) return;

    window.Loading.show('Atualizando cliente...');
    try {
        const { error } = await window.supabaseApp
            .from('leads')
            .update(leadData)
            .eq('id', leadId);

        if (error) throw error;

        window.Toast.success('Cliente atualizado!');
        window.closeLeadTooltip();
        if (document.getElementById('leadsPanel')) window.showLeadsPanel(); // Refresh list
    } catch (e) {
        console.error('Error updating lead:', e);
        window.Toast.error('Erro ao atualizar: ' + e.message);
    } finally {
        window.Loading.hide();
    }
};

// ========================================
// SHOW LEADS PANEL
// ========================================
window.showLeadsPanel = async function () {
    window.Loading.show('Carregando clientes...');

    try {
        const { data: leads, error } = await window.supabaseApp
            .from('leads')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        renderLeadsPanel(leads || []);
    } catch (e) {
        console.error('Error loading leads:', e);
        window.Toast.error('Erro ao carregar clientes');
    } finally {
        window.Loading.hide();
    }
};

function renderLeadsPanel(leads) {
    const existing = document.getElementById('leadsPanel');
    if (existing) existing.remove();

    const panel = document.createElement('div');
    panel.className = 'leads-panel';
    panel.id = 'leadsPanel';

    panel.innerHTML = `
        <div class="leads-panel-header">
            <h3>👥 Clientes CRM (${leads.length})</h3>
            <button class="lead-tooltip-close" onclick="window.closeLeadsPanel()">×</button>
        </div>
        <div class="leads-panel-search">
            <input type="text" id="leadsSearchInput" placeholder="🔍 Buscar por nome, telefone...">
        </div>
        <div class="leads-panel-body" id="leadsPanelBody">
            ${leads.length === 0 ?
            '<div style="padding: 40px; text-align: center; color: #999;">Nenhum cliente cadastrado ainda.</div>' :
            leads.map(lead => createLeadCard(lead)).join('')
        }
        </div>
    `;

    document.body.appendChild(panel);

    const backdrop = document.createElement('div');
    backdrop.className = 'sidebar-backdrop active';
    backdrop.style.zIndex = '9999';
    backdrop.onclick = window.closeLeadsPanel;
    document.body.appendChild(backdrop);
    panel.backdrop = backdrop;

    const searchInput = document.getElementById('leadsSearchInput');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase();
            const filtered = leads.filter(lead =>
                lead.nome.toLowerCase().includes(query) ||
                (lead.telefone && lead.telefone.includes(query)) ||
                (lead.email && lead.email.toLowerCase().includes(query))
            );
            document.getElementById('leadsPanelBody').innerHTML =
                filtered.map(lead => createLeadCard(lead)).join('');
        });
    }
}

function createLeadCard(lead) {
    const zonas = lead.zonas_interesse && lead.zonas_interesse.length > 0
        ? `Zonas ${lead.zonas_interesse.join(', ')}`
        : 'Qualquer zona';

    const quartos = lead.quartos_min || lead.quartos_max
        ? `${lead.quartos_min || 0}-${lead.quartos_max || '∞'} quartos`
        : '';

    const valor = lead.valor_min || lead.valor_max
        ? `R$ ${(lead.valor_min || 0).toLocaleString('pt-BR')} - ${(lead.valor_max || 999999999).toLocaleString('pt-BR')}`
        : '';

    return `
        <div class="lead-card">
            <div class="lead-card-header">
                <h4 class="lead-card-name">👤 ${lead.nome}</h4>
                ${lead.status === 'inativo' ? '<span class="status-inactive">Inativo</span>' : ''}
            </div>
            ${lead.telefone ? `<div class="lead-card-contact">📞 ${lead.telefone}</div>` : ''}
            ${lead.email ? `<div class="lead-card-contact">📧 ${lead.email}</div>` : ''}
            <div class="lead-card-criteria">
                🎯 ${zonas}
                ${lead.tipo_imovel ? ` • ${lead.tipo_imovel}` : ''}
                ${quartos ? ` • ${quartos}` : ''}
                ${valor ? `<br>💰 ${valor}` : ''}
            </div>
            <div class="lead-card-actions">
                <button class="lead-card-btn edit" onclick="window.editLead('${lead.id}')">✏️ Editar</button>
                <button class="lead-card-btn matches" onclick="window.findMatches('${lead.id}')">🔍 Matches</button>
                <button class="lead-card-btn" style="background: #6366f1; color: white; border: none;" onclick="window.generateFollowup('${lead.id}')">🚀 Follow-up IA</button>
                <button class="lead-card-btn delete" onclick="window.deleteLead('${lead.id}')">🗑️</button>
            </div>
        </div>
    `;
}

// ========================================
// CLOSE LEADS PANEL
// ========================================
window.closeLeadsPanel = function () {
    const panel = document.getElementById('leadsPanel');
    if (panel) {
        if (panel.backdrop) panel.backdrop.remove();
        panel.remove();
    }
};

// ========================================
// FIND MATCHES FOR LEAD
// ========================================
window.findMatches = async function (leadId) {
    window.Loading.show('Procurando imóveis compatíveis...');

    try {
        const { data: lead, error: leadError } = await window.supabaseApp
            .from('leads')
            .select('*')
            .eq('id', leadId)
            .single();

        if (leadError) throw leadError;

        let query = window.supabaseApp
            .from('unidades')
            .select('*, lotes(*)');

        if (lead.zonas_interesse && lead.zonas_interesse.length > 0) {
            query = window.supabaseApp.from('unidades').select('*, lotes!inner(*)').in('lotes.zona', lead.zonas_interesse);
        } else {
            // Re-select if zone filter wasn't used to get lotes join usually
            query = window.supabaseApp.from('unidades').select('*, lotes(*)');
        }

        if (lead.tipo_imovel) query = query.eq('tipo', lead.tipo_imovel);
        if (lead.quartos_min) query = query.gte('quartos', lead.quartos_min);
        if (lead.quartos_max) query = query.lte('quartos', lead.quartos_max);
        if (lead.metragem_min) query = query.gte('metragem', lead.metragem_min);
        if (lead.metragem_max) query = query.lte('metragem', lead.metragem_max);
        if (lead.valor_min) query = query.gte('valor', lead.valor_min);
        if (lead.valor_max) query = query.lte('valor', lead.valor_max);

        const { data: matches, error } = await query;

        if (error) throw error;

        if (!matches || matches.length === 0) {
            window.Toast.info('Nenhum imóvel compatível encontrado');
            return;
        }

        window.closeLeadsPanel();

        const results = matches.map(unit => ({
            type: 'unit',
            lote_inscricao: unit.lote_inscricao,
            label: unit.inscricao,
            sub: unit.endereco_completo || '',
            inscricao: unit.inscricao,
            isUnit: true
        }));

        if (window.displaySearchResults) {
            window.displaySearchResults(results);
        }

        window.Toast.success(`${matches.length} imóvel(is) compatível(is) encontrado(s)!`);
    } catch (e) {
        console.error('Error finding matches:', e);
        window.Toast.error('Erro ao buscar matches: ' + e.message);
    } finally {
        window.Loading.hide();
    }
};

// ========================================
// DELETE LEAD
// ========================================
window.deleteLead = async function (leadId) {
    if (!confirm('Tem certeza que deseja excluir este cliente?')) return;

    window.Loading.show('Excluindo...');
    try {
        const { error } = await window.supabaseApp
            .from('leads')
            .delete()
            .eq('id', leadId);

        if (error) throw error;

        window.Toast.success('Cliente excluído com sucesso!');
        await updateLeadsCount();
        window.closeLeadsPanel();
        window.showLeadsPanel();
    } catch (e) {
        console.error('Error deleting lead:', e);
        window.Toast.error('Erro ao excluir cliente');
    } finally {
        window.Loading.hide();
    }
};

// ========================================
// EDIT LEAD TRIGGER
// ========================================
window.editLead = function (leadId) {
    window.closeLeadsPanel();
    window.openAddLeadTooltip(leadId); // Reuse the add modal logic
};

// ========================================
// AI INTEGRATION: SAVE LEAD FROM FAROL
// ========================================
window.saveLeadFromAI = async function (leadData) {
    console.log("🤖 Farol tentando salvar lead:", leadData);

    // Normalize data (Ensuring at least name and some contact)
    if (!leadData.nome) return { success: false, message: "Nome não identificado" };

    const finalData = {
        nome: leadData.nome,
        telefone: leadData.telefone || null,
        email: leadData.email || null,
        contato: leadData.telefone || leadData.email || "Lead via Chat",
        tipo_imovel: leadData.tipo_imovel || null,
        zonas_interesse: leadData.zonas_interesse || [],
        valor_max: leadData.valor_max || null,
        observacoes: leadData.observacoes || "Lead capturado automaticamente pelo Farol IA via Chat.",
        status: 'ativo',
        created_at: new Date().toISOString()
    };

    try {
        const { error } = await window.supabaseApp.from('leads').insert(finalData);
        if (error) throw error;

        await updateLeadsCount();
        window.Toast.success(`Novo lead capturado: ${finalData.nome}!`, 'Farol CRM');
        return { success: true };
    } catch (e) {
        console.error("Erro Farol Lead Save:", e);
        return { success: false, error: e.message };
    }
};

window.generateFollowup = async function (leadId) {
    window.Loading.show(`🚀 Preparando Follow-up...`, `O Farol está analisando o melhor roteiro...`);

    try {
        const { data: lead } = await window.supabaseApp.from('leads').select('*').eq('id', leadId).single();
        if (!lead) return;

        const prompt = `Como seu Farol (Assistente de Relacionamento da Omega Imóveis), crie um roteiro de "Follow-up" persuasivo para este cliente:
        - Nome: ${lead.nome}
        - Interesse: ${lead.tipo_imovel || 'Imóvel'} em ${lead.zonas_interesse?.[0] || 'Guarujá'}
        - Status Atual: ${lead.status || 'Morno'}
        - Últimas Notas: ${lead.observacoes || 'Sem notas recentes'}
        
        Sua tarefa:
        1. Crie uma mensagem curta de WhatsApp para "reaquecer" o contato.
        2. Dê uma sugestão técnica de "Próximo Passo" para o corretor (ex: agendar visita, enviar planilha de custos).
        
        Mantenha o tom profissional e focado em avançar no funil de vendas.`;

        if (!window.Farol) {
            window.Toast.error("IA do Farol não inicializada.");
            return;
        }

        const result = await window.Farol.ask(prompt);

        const followupModal = document.createElement('div');
        followupModal.className = 'custom-modal-overlay active';
        followupModal.style.zIndex = '10001';
        followupModal.innerHTML = `
            <div class="custom-modal" style="max-width: 450px;">
                <div class="custom-modal-header" style="background: #6366f1; color: white;">
                    <div class="custom-modal-title">🚀 Farol CRM: Estratégia de Follow-up</div>
                    <button class="custom-modal-close" onclick="this.closest('.custom-modal-overlay').remove()">&times;</button>
                </div>
                <div class="custom-modal-body" style="padding: 25px; line-height: 1.6; font-size: 14px; color: #334155;">
                    <div style="background: #eef2ff; border-left: 5px solid #6366f1; padding: 15px; border-radius: 8px;">
                        ${result.replace(/\n/g, '<br>')}
                    </div>
                </div>
                <div class="modal-actions" style="padding: 20px; border-top: 1px solid #eee; display: flex; justify-content: center; gap: 10px;">
                    <button class="btn-ghost" onclick="this.closest('.custom-modal-overlay').remove()">Recuar</button>
                    <button class="btn-primary-rich" style="background: #6366f1;" onclick="window.copyToClipboard('${result.replace(/'/g, "\\\\'").replace(/\n/g, ' ')}')">📋 Copiar Roteiro</button>
                </div>
            </div>
        `;
        document.body.appendChild(followupModal);

    } catch (e) {
        console.error(e);
        window.Toast.error("Erro ao gerar follow-up.");
    } finally {
        window.Loading.hide();
    }
};

console.log("✅ CRM Handler module loaded");
