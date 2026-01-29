// ==========================================
// ENRICHMENT HANDLER - DATASTONE API
// ==========================================
// Integração com DataStone para enriquecimento de dados (Telefones, Emails)

const DATASTONE_API_URL = 'https://ijmgvsztgljribnogtsx.supabase.co/functions/v1/enrich-data'; // Edge Function Production
// const API_KEY = '...'; // Key is now handled by the proxy for security

window.Enrichment = {

    // Função Principal: Enriquecer Unidade
    async enrichUnit(inscricao) {
        // Encontrar unidade localmente (ou buscar no DB se necessário)
        let unit = window.allLotes
            ? window.allLotes.flatMap(l => l.unidades || []).find(u => u.inscricao === inscricao)
            : null;

        if (!unit) {
            // Tenta buscar no banco se não estiver em memória
            const { data, error } = await window.supabaseApp
                .from('unidades')
                .select('*')
                .eq('inscricao', inscricao)
                .single();
            if (error || !data) {
                window.Toast.error('Unidade não encontrada.');
                return;
            }
            unit = data;
        }

        const doc = unit.cpf_cnpj ? unit.cpf_cnpj.replace(/\D/g, '') : null;

        if (!doc) {
            window.Toast.warning('Unidade sem CPF/CNPJ para consulta.');
            return;
        }

        // CONFIRM DIALOG WITH BALANCES
        window.Loading.show('Verificando Créditos...', 'Consultando saldo...');
        try {
            const balanceMsg = await this.getBalancesString();
            window.Loading.hide();

            const confirmMsg = `CONFIRMAÇÃO DE CONSULTA\n\nEssa ação descontará créditos da sua conta DataStone.\n\n${balanceMsg}\n\nDeseja realizar a consulta agora?`;

            if (!confirm(confirmMsg)) {
                return;
            }
        } catch (e) {
            window.Loading.hide();
            console.error("Erro ao verificar saldo:", e);
            if (!confirm('Erro ao verificar saldo. Deseja tentar a consulta mesmo assim?')) return;
        }

        window.Loading.show('Consultando DataStone...', ' Buscando contatos atualizados...');

        try {
            let result = null;
            if (doc.length === 11) {
                result = await this.searchPerson(doc, unit.nome_proprietario);
            } else if (doc.length === 14) {
                result = await this.searchCompany(doc);
            } else {
                throw new Error('Documento inválido (nem CPF nem CNPJ).');
            }

            if (result) {
                await this.saveEnrichment(unit, result);
            } else {
                window.Toast.info('Nenhum dado encontrado na base externa.');
            }

        } catch (e) {
            console.error('Enrichment Error:', e);
            window.Toast.error('Erro na consulta: ' + e.message);
        } finally {
            window.Loading.hide();
        }
    },

    // Função: Enriquecer via CPF/CNPJ direto (Para Tooltip Proprietário)
    async enrichPerson(cpf_cnpj) {
        const doc = cpf_cnpj ? cpf_cnpj.replace(/\D/g, '') : null;
        if (!doc) {
            window.Toast.warning('Documento inválido para consulta.');
            return;
        }

        // CONFIRM DIALOG WITH BALANCES
        window.Loading.show('Verificando Créditos...', 'Consultando saldo...');
        try {
            const balanceMsg = await this.getBalancesString();
            window.Loading.hide();

            const confirmMsg = `CONFIRMAÇÃO DE CONSULTA (Proprietário)\n\nEssa ação descontará créditos da sua conta DataStone.\n\n${balanceMsg}\n\nDeseja realizar a consulta agora?`;

            if (!confirm(confirmMsg)) {
                return;
            }
        } catch (e) {
            window.Loading.hide();
            console.error("Erro ao verificar saldo:", e);
            if (!confirm('Erro ao verificar saldo. Deseja tentar a consulta mesmo assim?')) return;
        }

        window.Loading.show('Consultando DataStone...', 'Buscando dados do proprietário...');

        try {
            let result = null;
            if (doc.length === 11) {
                result = await this.searchPerson(doc);
            } else if (doc.length === 14) {
                result = await this.searchCompany(doc);
            } else {
                throw new Error('Documento inválido.');
            }

            if (result) {
                // Para salvar, precisamos de "alguma" unidade vinculada para o fluxo legado
                // ou simplesmente chamamos o upsert no proprietário direto.
                // Vou adaptar o saveEnrichment para ser mais flexível ou chamar o upsert aqui.

                // Mínimo necessário para o upsert:
                const cpfLimpo = doc;
                const tipo = cpfLimpo.length === 11 ? 'PF' : 'PJ';

                const { data: proprietario, error: propError } = await window.supabaseApp
                    .from('proprietarios')
                    .upsert({
                        cpf_cnpj: cpfLimpo,
                        nome_completo: result.name || result.company_name,
                        tipo: tipo,
                        dados_enrichment: result,
                        rg: result.rg,
                        data_nascimento: result.birthday,
                        idade: result.age,
                        genero: result.gender,
                        nome_mae: result.mother_name,
                        situacao_cadastral: result.registry_situation,
                        pep: result.pep || false,
                        aposentado: result.retired || false,
                        possivelmente_falecido: result.possibly_dead || false,
                        bolsa_familia: result.bolsa_familia || false,
                        ocupacao: result.cbo_description,
                        renda_estimada: result.estimated_income,
                        data_enriquecimento: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    }, { onConflict: 'cpf_cnpj' })
                    .select()
                    .single();

                if (propError) throw propError;

                // --- SYNC BACK TO UNITS (Data Consistency) ---
                // Extrair e formatar telefones para a coluna legado 'contato_proprietario'
                let syncPhones = [];
                if (result.mobile_phones) {
                    result.mobile_phones.forEach(p => {
                        const ddd = String(p.ddd).padStart(2, '0');
                        syncPhones.push(`(${ddd}) ${p.number.substring(0, 5)}-${p.number.substring(5)}`);
                    });
                }
                if (result.land_lines) {
                    result.land_lines.forEach(p => {
                        const ddd = String(p.ddd).padStart(2, '0');
                        syncPhones.push(`(${ddd}) ${p.number.substring(0, 4)}-${p.number.substring(4)}`);
                    });
                }
                const uniqueSyncPhones = [...new Set(syncPhones)];

                // Atualizar todas as unidades vinculadas a este CPF
                await window.supabaseApp
                    .from('unidades')
                    .update({
                        contato_proprietario: uniqueSyncPhones,
                        last_enrichment_at: new Date().toISOString(),
                        proprietario_id: proprietario.id
                    })
                    .eq('cpf_cnpj', cpfLimpo);

                window.Toast.success('Dados atualizados com sucesso!');

                // Refresh ProprietarioTooltip se estiver aberto
                if (window.ProprietarioTooltip && window.currentTooltip) {
                    window.ProprietarioTooltip.show(proprietario.id);
                }
            } else {
                window.Toast.info('Nenhum dado encontrado na base externa.');
            }
        } catch (e) {
            console.error('Enrichment Person Error:', e);
            window.Toast.error('Erro na consulta: ' + e.message);
        } finally {
            window.Loading.hide();
        }
    },

    // Buscar Pessoa Física
    async searchPerson(cpf, name) {
        // Endpoint mock/doc sugeria search?name=... mas para CPF direto geralmente é /persons/{cpf} ou query
        // Analisando padrão REST DataStone (com base em pesquisa comum): 
        // GET /persons?tax_id=... ou GET /persons/{cpf}
        // O usuário passou Java com query params: map... .GET... url + query.
        // Vamos tentar buscar por CPF primeiro, que é mais preciso.

        // A Edge Function espera o parâmetro 'document' e converte internamente
        const url = `${DATASTONE_API_URL}/persons?document=${cpf}`;

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        // Tenta fallback se der 404 ou erro na rota de search
        if (!response.ok) {
            console.warn('Search failed, trying direct endpoint...');
            // Fallback logic could go here
            throw new Error(`API Error: ${response.status}`);
        }

        const data = await response.json();
        // A API retorna lista ou objeto? Exemplo Java mostrava lista `[ ... ]`.
        if (Array.isArray(data) && data.length > 0) return data[0];
        if (!Array.isArray(data) && data.nme) return data; // Se retornar objeto direto

        return null;
    },

    // Buscar Pessoa Jurídica
    async searchCompany(cnpj) {
        // A Edge Function espera o parâmetro 'document' e converte internamente
        const url = `${DATASTONE_API_URL}/companies?document=${cnpj}`;

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) throw new Error(`API Error: ${response.status}`);

        const data = await response.json();
        if (Array.isArray(data) && data.length > 0) return data[0];
        return data;
    },

    // Salvar no Banco
    async saveEnrichment(unit, data) {
        // Extrair telefones (estrutura real da DataStone)
        let newPhones = [];

        // Celulares - formato: { ddd: 13, number: "991248146", priority: 1, whatsapp_datetime: "..." }
        if (data.mobile_phones && Array.isArray(data.mobile_phones)) {
            data.mobile_phones.forEach(p => {
                if (p.ddd && p.number) {
                    // Garantir que DDD tenha sempre 2 dígitos (ex: 01, 13)
                    const ddd = String(p.ddd).padStart(2, '0');
                    // Formatar como (13) 99124-8146
                    const formatted = `(${ddd}) ${p.number.substring(0, 5)}-${p.number.substring(5)}`;
                    newPhones.push(formatted);
                }
            });
        }

        // Fixos - formato: { ddd: 13, number: "30248944", priority: 1 }
        if (data.land_lines && Array.isArray(data.land_lines)) {
            data.land_lines.forEach(p => {
                if (p.ddd && p.number) {
                    // Garantir que DDD tenha sempre 2 dígitos (ex: 01, 13)
                    const ddd = String(p.ddd).padStart(2, '0');
                    // Formatar como (13) 3024-8944
                    const formatted = `(${ddd}) ${p.number.substring(0, 4)}-${p.number.substring(4)}`;
                    newPhones.push(formatted);
                }
            });
        }

        // Emails - formato: { email: "...", priority: 1 }
        let newEmails = [];
        if (data.emails && Array.isArray(data.emails)) {
            data.emails.forEach(e => {
                if (e.email) {
                    newEmails.push(e.email);
                }
            });
        }

        // Remover duplicatas
        const uniquePhones = [...new Set(newPhones)];
        const uniqueEmails = [...new Set(newEmails)];

        // Mesclar com contatos existentes
        const currentContacts = Array.isArray(unit.contato_proprietario)
            ? unit.contato_proprietario
            : (unit.contato_proprietario ? [unit.contato_proprietario] : []);

        const allContacts = [...new Set([...currentContacts, ...uniquePhones])];

        // Preparar dados adicionais para salvar (opcional - informações extras úteis)
        const enrichmentSummary = {
            phones: uniquePhones,
            emails: uniqueEmails,
            name: data.name || null,
            age: data.age || null,
            birthday: data.birthday || null,
            gender: data.gender || null,
            occupation: data.cbo_description || null,
            estimated_income: data.estimated_income || null,
            employer: data.employer && data.employer[0] ? data.employer[0].company_name : null,
            addresses: data.addresses || [],
            enriched_at: new Date().toISOString()
        };

        // Atualizar DB
        const { error } = await window.supabaseApp
            .from('unidades')
            .update({
                contato_proprietario: allContacts,
                dados_enrichment: data, // SALVAR DADOS COMPLETOS (não summary)
                last_enrichment_at: new Date().toISOString()
            })
            .eq('inscricao', unit.inscricao);

        if (error) throw error;

        // ============================================
        // NOVO: Atualizar/Criar Proprietário Unificado
        // ============================================
        if (unit.cpf_cnpj) {
            const cpfLimpo = unit.cpf_cnpj.replace(/\D/g, '');
            const tipo = cpfLimpo.length === 11 ? 'PF' : 'PJ';

            try {
                // UPSERT em proprietarios
                const { data: proprietario, error: propError } = await window.supabaseApp
                    .from('proprietarios')
                    .upsert({
                        cpf_cnpj: cpfLimpo,
                        nome_completo: data.name || unit.nome_proprietario,
                        tipo: tipo,
                        dados_enrichment: data, // DADOS COMPLETOS
                        rg: data.rg,
                        data_nascimento: data.birthday,
                        idade: data.age,
                        genero: data.gender,
                        nome_mae: data.mother_name,
                        situacao_cadastral: data.registry_situation,
                        pep: data.pep || false,
                        aposentado: data.retired || false,
                        possivelmente_falecido: data.possibly_dead || false,
                        bolsa_familia: data.bolsa_familia || false,
                        ocupacao: data.cbo_description,
                        renda_estimada: data.estimated_income,
                        data_enriquecimento: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    }, { onConflict: 'cpf_cnpj' })
                    .select()
                    .single();

                // Se criou/atualizou proprietário, atualizar unidade com proprietario_id
                if (!propError && proprietario) {
                    await window.supabaseApp
                        .from('unidades')
                        .update({ proprietario_id: proprietario.id })
                        .eq('cpf_cnpj', cpfLimpo);

                    console.log(`✅ Proprietário ${proprietario.id} vinculado`);
                }
            } catch (propErr) {
                console.warn('Erro ao atualizar proprietário (não crítico):', propErr);
                // Não bloqueia o fluxo se falhar
            }
        }

        // Atualizar memória local (Refletir no tooltip instantaneamente)
        unit.contato_proprietario = allContacts;
        unit.dados_enrichment = data; // DADOS COMPLETOS

        window.Toast.success(`✅ ${uniquePhones.length} telefones e ${uniqueEmails.length} e-mails encontrados!`);

        // Re-render tooltip se estiver aberto
        if (window.currentTooltip) {
            if (window.currentLoteForUnit && unit.inscricao) {
                // We are likely in unit view
                window.showUnitTooltip(unit, window.currentLoteForUnit, 0, 0);
            } else {
                // Fallback to lot view refresh
                window.closeLotTooltip();
                const lote = window.allLotes.find(l => l.inscricao === unit.lote_inscricao);
                setTimeout(() => window.showLotTooltip(lote, 0, 0), 100);
            }
        }
    },

    // ========================================
    // API STATUS CHECK (Sidebar)
    // ========================================
    async checkApiStatus() {
        const statusContainer = document.getElementById('api-status-list');
        if (!statusContainer) return;

        statusContainer.innerHTML = '<div style="color: #666; font-size: 11px; font-style: italic;">Verificando...</div>';

        try {
            // Chama a Edge Function com action=check_status
            const response = await fetch(`${DATASTONE_API_URL}?action=check_status`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            });

            if (!response.ok) throw new Error(`Erro API: ${response.status}`);

            const data = await response.json();
            statusContainer.innerHTML = '';

            if (data.keys && Array.isArray(data.keys)) {
                data.keys.forEach(k => {
                    const color = k.valid && k.balance > 0 ? '#22c55e' : (k.valid ? '#f59e0b' : '#ef4444');
                    const icon = k.valid ? 'fa-coins' : 'fa-times-circle';

                    // Nomes amigáveis baseados no índice (conforme combinado)
                    let name = `Chave #${k.index + 1}`;
                    if (k.index === 0) name = 'Bruno';
                    else if (k.index === 1) name = 'Luis';
                    else if (k.index === 2) name = 'Reinaldo';

                    const div = document.createElement('div');
                    div.style.marginBottom = '6px';
                    div.style.fontSize = '11px';
                    div.style.display = 'flex';
                    div.style.alignItems = 'center';
                    div.style.justifyContent = 'space-between';
                    div.innerHTML = `
                        <span style="display: flex; align-items: center; gap: 6px;">
                            <i class="fas ${icon}" style="color: ${color};"></i> 
                            ${name} <span style="opacity: 0.5; font-size: 9px;">(${k.key})</span>
                        </span>
                        <span style="font-weight: 600; color: ${color}; font-size: 10px;">${k.message}</span>
                    `;
                    statusContainer.appendChild(div);
                });
            } else {
                statusContainer.innerText = 'Resposta inesperada.';
            }

        } catch (e) {
            console.error(e);
            statusContainer.innerHTML = `<div style="color: red; font-size: 11px;">Erro: ${e.message}</div>`;
        }
    },

    // Helper: Get formatted balance string for confirmation
    async getBalancesString() {
        try {
            const response = await fetch(`${DATASTONE_API_URL}?action=check_status`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            });

            if (!response.ok) return 'Não foi possível obter o saldo atual.';

            const data = await response.json();
            if (data.keys && Array.isArray(data.keys)) {
                let msg = '💰 SALDO ATUAL:\n';
                data.keys.forEach(k => {
                    let name = `Chave #${k.index + 1}`;
                    if (k.index === 0) name = 'Bruno';
                    else if (k.index === 1) name = 'Luis';
                    else if (k.index === 2) name = 'Reinaldo';

                    msg += `- ${name}: ${k.message}\n`;
                });
                return msg;
            }
            return 'Saldo indisponível.';
        } catch (e) {
            console.error(e);
            return 'Erro ao verificar saldo.';
        }
    },

    // ========================================
    // CNPJ PUBLICO & PARTNERS
    // ========================================

    // Busca dados públicos de CNPJ (Gratuito - receita)
    async fetchPublicCNPJ(cnpj) {
        const cleanCNPJ = cnpj.replace(/\D/g, '');
        if (cleanCNPJ.length !== 14) throw new Error('CNPJ inválido');

        // Usando proxy ou chamada direta se CORS permitir (publica.cnpj.ws tem CORS aberto geralmente)
        // Rate limit: 3 req/min
        const url = `https://publica.cnpj.ws/cnpj/${cleanCNPJ}`;

        try {
            const response = await fetch(url);

            if (response.status === 429) {
                throw new Error('Muitas requisições (Limite: 3/min). Aguarde um pouco.');
            }
            if (!response.status === 200) {
                throw new Error(`Erro API: ${response.status}`);
            }

            const data = await response.json();
            return data;

        } catch (e) {
            console.error('Erro fetching public CNPJ:', e);
            throw e;
        }
    },

    // Processa sócios retornados da API Pública
    // Cria/Atualiza perfis para eles e cria vínculo
    async processPartners(pjProprietarioId, socios) {
        if (!socios || socios.length === 0) return;

        let processedCount = 0;

        for (const socio of socios) {
            // Tenta identificar se o sócio já existe
            // A API Publica retorna cpf_cnpj_socio mascarado (***123456**) ou completo?
            // Geralmente mascarado. Mas retorna NOME.

            const nomeSocio = socio.nome;
            const papel = socio.qualificacao_socio ? socio.qualificacao_socio.descricao : 'Sócio';

            // Se nome for muito curto, ignora
            if (!nomeSocio || nomeSocio.length < 3) continue;

            // 1. Tentar achar proprietário existente pelo NOME (já que CPF vem mascarado)
            // Usar FTS ou ILIQUE na coluna nome_busca
            let existingId = null;

            const { data: existing } = await window.supabaseApp
                .from('proprietarios')
                .select('id, nome_completo')
                .ilike('nome_completo', nomeSocio)
                .limit(1);

            if (existing && existing.length > 0) {
                existingId = existing[0].id;
                console.log(`Sócio encontrado existente: ${existingId} - ${nomeSocio}`);
            } else {
                // 2. Se não existe, CRIAR um "Skel" de proprietário (PF)
                // Marcado como 'Rascunho' ou apenas com nome
                const { data: newProp, error: createError } = await window.supabaseApp
                    .from('proprietarios')
                    .insert({
                        nome_completo: nomeSocio,
                        tipo: 'PF', // Assumimos PF, mas pode ser PJ
                        cpf_cnpj: `S_PJ_${pjProprietarioId}_${Math.floor(Math.random() * 10000)}`, // CPF temporário único
                        dados_enrichment: {
                            origem: 'socio_public_api',
                            raw_socio_data: socio,
                            masked_cpf: socio.cpf_cnpj_socio
                        }
                    })
                    .select()
                    .single();

                if (!createError && newProp) {
                    existingId = newProp.id;
                    console.log(`Novo perfil de sócio criado: ${existingId}`);
                } else {
                    console.warn("Erro criando sócio:", createError);
                }
            }

            // 3. Criar Vínculo na tabela proprietario_relacionamentos
            if (existingId) {
                // Upsert no relacionamento
                const { error: relError } = await window.supabaseApp
                    .from('proprietario_relacionamentos')
                    .upsert({
                        proprietario_origem_id: pjProprietarioId,
                        proprietario_destino_id: existingId,
                        tipo_vinculo: papel,
                        metadata: { data_entrada: socio.data_entrada }
                    }, { onConflict: 'proprietario_origem_id,proprietario_destino_id,tipo_vinculo' });

                if (!relError) processedCount++;
            }
        }

        return processedCount;
    },

    // Buscar Pessoa Física via Nome (Fallback para sócios com CPF mascarado)
    async searchPersonByName(name, state = 'SP') {
        // Ajuste conforme API DataStone (ex: /persons?name=...)
        // Nota: Busca por nome consome créditos e pode trazer homônimos.

        const url = `${DATASTONE_API_URL}/persons?name=${encodeURIComponent(name)}&state=${state}`;

        const response = await fetch(url, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });

        if (!response.ok) throw new Error(`API Error: ${response.status}`);

        const data = await response.json();
        // Pode retornar lista
        if (Array.isArray(data) && data.length > 0) return data;
        return [];
    },

    initSidebarStatus() {
        // Change target to main sidebar to place it after results (at the bottom)
        const sidebarContent = document.getElementById('sidebar');
        if (!sidebarContent) return;

        // Check if already exists
        if (document.getElementById('datastone-status-panel')) return;

        const panel = document.createElement('div');
        panel.id = 'datastone-status-panel';
        panel.style.margin = '15px 0';
        panel.style.padding = '15px';
        panel.style.borderTop = '1px solid rgba(0,0,0,0.1)';
        panel.style.background = 'rgba(255,255,255,0.5)';
        panel.style.borderRadius = '8px';

        panel.innerHTML = `
            <div style="font-size: 11px; font-weight: 700; color: #64748b; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 0.5px; display: flex; justify-content: space-between; align-items: center;">
                STATUS API DATASTONE
                <button onclick="window.Enrichment.checkApiStatus()" style="background: none; border: none; color: #3b82f6; cursor: pointer; font-size: 11px;" title="Atualizar Agora">
                    <i class="fas fa-sync-alt"></i>
                </button>
            </div>
            <div id="api-status-list">
                <button onclick="window.Enrichment.checkApiStatus()" style="width: 100%; padding: 8px; background: white; border: 1px solid #cbd5e1; color: #3b82f6; border-radius: 6px; cursor: pointer; font-size: 11px; font-weight: 600; display: flex; align-items: center; justify-content: center; gap: 6px; transition: all 0.2s;">
                    <i class="fas fa-search-dollar"></i> Verificar Status das Chaves
                </button>
            </div>
        `;

        // Insert before stats panel if exists, or append to end
        const statsPanel = sidebarContent.querySelector('.stats-panel');
        if (statsPanel) {
            sidebarContent.insertBefore(panel, statsPanel);
        } else {
            sidebarContent.appendChild(panel);
        }
    }
};

// Auto-init sidebar UI when module loads (or wait for DOMContentLoaded)
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => window.Enrichment.initSidebarStatus(), 2000); // Small delay to ensure sidebar exists
});
