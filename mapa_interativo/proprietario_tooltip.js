// ==========================================
// PROPRIETARIO TOOLTIP - PROPRIETARIO_TOOLTIP.JS
// ==========================================
// Tooltip 360° do proprietário com TODAS as propriedades

window.ProprietarioTooltip = {

    /**
     * Exibir tooltip completo do proprietário
     * @param {number} proprietarioId - ID do proprietário
     */
    async show(proprietarioId, x = 0, y = 0) {
        window.Loading.show('Carregando...', 'Buscando dados do proprietário');

        try {
            // 1. Buscar dados do proprietário
            const { data: prop, error: propError } = await window.supabaseApp
                .from('proprietarios')
                .select('*')
                .eq('id', proprietarioId)
                .single();

            if (propError || !prop) {
                console.error("Erro prop:", propError);
                window.Toast.error('Proprietário não encontrado');
                return;
            }

            // 2. Buscar unidades deste proprietário (Query separada para evitar erro 400 de relacionamento)
            const { data: unidades, error: unitError } = await window.supabaseApp
                .from('unidades')
                .select(`
                    inscricao,
                    lote_inscricao,
                    tipo,
                    complemento,
                    metragem,
                    valor_venal,
                    status_venda,
                    lotes (
                        inscricao,
                        building_name,
                        bairro,
                        zona,
                        setor
                    )
                `)
                .eq('proprietario_id', proprietarioId);

            if (unitError) console.warn("Erro buscando unidades:", unitError);

            // Juntar
            prop.unidades = unidades || [];

            // The original `if (error || !prop)` check used a variable `error` that is no longer defined.
            // The `propError` check above already handles the case where `prop` is not found.
            // So, this redundant check can be simplified or removed.
            // Keeping it as `if (!prop)` for safety, though `propError || !prop` already covers it.
            if (!prop) {
                window.Toast.error('Proprietário não encontrado');
                return;
            }

            this.render(prop, x, y);

        } catch (e) {
            console.error('Erro ao carregar proprietário:', e);
            window.Toast.error('Erro ao carregar dados');
        } finally {
            window.Loading.hide();
        }
    },

    /**
     *Renderizar tooltip
     */
    render(prop, x, y) {
        if (window.currentTooltip) this.close();

        const tooltip = document.createElement('div');
        tooltip.className = 'proprietario-tooltip';
        tooltip.style.cssText = `
            position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
            width: 90%; max-width: 900px; height: 80vh; background: white;
            border-radius: 16px; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.3);
            z-index: 9999; overflow: hidden; display: flex; flex-direction: column;
        `;

        let html = this.renderHeader(prop);

        // TABS
        html += `
            <div class="tooltip-tabs" style="padding: 0 24px; background: #f8fafc; border-bottom: 1px solid #e2e8f0; display: flex; gap: 8px;">
                <div class="tooltip-tab active" onclick="window.switchTooltipTab(this, 'prop-tab-geral')" style="padding: 12px 16px; font-size: 13px; font-weight: 700; color: #764ba2; cursor: pointer; border-bottom: 3px solid #764ba2;">📋 Geral</div>
                <div class="tooltip-tab" onclick="window.switchTooltipTab(this, 'prop-tab-imoveis')" style="padding: 12px 16px; font-size: 13px; font-weight: 700; color: #64748b; cursor: pointer;">🏠 Imóveis (${prop.unidades.length})</div>
                <div class="tooltip-tab" onclick="window.switchTooltipTab(this, 'prop-tab-juridico')" style="padding: 12px 16px; font-size: 13px; font-weight: 700; color: #64748b; cursor: pointer;">📂 Jurídico</div>
            </div>
        `;

        html += '<div class="proprietario-body" style="padding: 24px; flex: 1; overflow-y: auto;">';

        // ABA: GERAL
        html += '<div id="prop-tab-geral" class="tab-content-pane active">';
        html += this.renderContatos(prop.dados_enrichment || {});
        html += this.renderEnderecos(prop.dados_enrichment || {});
        html += this.renderDadosAdicionais(prop);
        html += '</div>';

        // ABA: IMÓVEIS
        html += '<div id="prop-tab-imoveis" class="tab-content-pane" style="display:none;">';
        html += this.renderPropriedades(prop.unidades || []);
        html += '</div>';

        // ABA: JURÍDICO
        html += '<div id="prop-tab-juridico" class="tab-content-pane" style="display:none;">';
        html += this.renderEmpresas(prop.dados_enrichment || {});
        html += this.renderFamilia(prop.dados_enrichment || {});
        html += '</div>';

        html += '</div>';

        tooltip.innerHTML = html;
        document.body.appendChild(tooltip);
        window.currentTooltip = tooltip;

        const backdrop = document.createElement('div');
        backdrop.className = 'sidebar-backdrop active';
        backdrop.style.zIndex = '9998';
        backdrop.onclick = () => this.close();
        document.body.appendChild(backdrop);
        tooltip.backdrop = backdrop;

        this.setupHandlers(tooltip, prop);
    },

    renderHeader(prop) {
        const tipoPessoa = prop.tipo === 'PF' ? 'Pessoa Física' : 'Pessoa Jurídica';
        const icone = prop.tipo === 'PF' ? 'fa-user' : 'fa-building';

        return `
            <div class="proprietario-header" style="
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 24px;
                position: relative;
            ">
                <button onclick="window.ProprietarioTooltip.close()" style="
                    position: absolute;
                    top: 20px;
                    right: 20px;
                    background: rgba(255,255,255,0.2);
                    border: none;
                    color: white;
                    width: 32px;
                    height: 32px;
                    border-radius: 50%;
                    cursor: pointer;
                    font-size: 18px;
                ">×</button>
                
                <div style="display: flex; align-items: center; gap: 16px; margin-bottom: 12px;">
                    <i class="fas ${icone}" style="font-size: 32px;"></i>
                    <div style="flex: 1;">
                        <div style="font-size: 24px; font-weight: 800;">${prop.nome_completo}</div>
                        <div style="font-size: 13px; opacity: 0.9; margin-top: 4px; display: flex; align-items: center; justify-content: space-between; gap: 10px;">
                            <span>
                                ${tipoPessoa} • CPF/CNPJ: 
                                <span class="doc-value">${window.formatDocument(prop.cpf_cnpj, false)}</span>
                                <i class="fas fa-eye" style="cursor: pointer; margin-left: 6px; opacity: 0.8;" 
                                   onclick="window.toggleCpfVisibility(this, '${prop.cpf_cnpj}')" title="Mostrar/Ocultar"></i>
                            </span>
                            
                            <button onclick="window.Enrichment.enrichPerson('${prop.cpf_cnpj}')" style="
                                background: rgba(255,255,255,0.2);
                                border: 1px solid rgba(255,255,255,0.3);
                                color: white;
                                border-radius: 6px;
                                padding: 4px 10px;
                                cursor: pointer;
                                font-size: 11px;
                                font-weight: 700;
                                display: flex;
                                align-items: center;
                                gap: 6px;
                                transition: all 0.2s;
                            " onmouseover="this.style.background='rgba(255,255,255,0.3)'" 
                               onmouseout="this.style.background='rgba(255,255,255,0.2)'">
                                <i class="fas fa-search-plus"></i> Consultar Dados
                            </button>
                        </div>
                    </div>
                </div>
                
                <div style="display: flex; gap: 16px; font-size: 13px;">
                    ${prop.idade ? `<span>🎂 ${prop.idade} anos</span>` : ''}
                    ${prop.ocupacao ? `<span>💼 ${prop.ocupacao}</span>` : ''}
                    ${prop.renda_estimada ? `<span>💰 ${prop.renda_estimada}</span>` : ''}
                </div>
            </div>
        `;
    },

    renderPropriedades(unidades) {
        if (!unidades || unidades.length === 0) {
            return '';
        }

        let html = `
            <div class="section" style="margin-bottom: 24px;">
                <h3 style="
                    font-size: 16px;
                    font-weight: 700;
                    color: #1e293b;
                    margin-bottom: 16px;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    border-bottom: 2px solid #e2e8f0;
                    padding-bottom: 8px;
                ">
                    <i class="fas fa-home" style="color: #667eea;"></i>
                    Propriedades (${unidades.length})
                </h3>
                <div style="display: grid; gap: 12px;">
        `;

        unidades.forEach(u => {
            const lote = u.lotes || {};
            const statusColor = {
                'Disponível': '#10b981',
                'Vendido': '#ef4444',
                'Reservado': '#f59e0b',
                'Captar': '#3b82f6'
            }[u.status_venda] || '#94a3b8';

            html += `
                <div class="prop-item" data-inscricao="${u.inscricao}" style="
                    background: white;
                    border: 1px solid #e2e8f0;
                    border-left: 4px solid ${statusColor};
                    border-radius: 8px;
                    padding: 16px;
                    cursor: pointer;
                    transition: all 0.2s;
                " onmouseover="this.style.boxShadow='0 4px 6px -1px rgba(0,0,0,0.1)'" 
                   onmouseout="this.style.boxShadow='none'">
                    <div style="display: flex; justify-content: space-between; align-items: start;">
                        <div style="flex: 1;">
                            <div style="font-weight: 700; color: #1e293b; font-size: 15px; margin-bottom: 4px;">
                                ${lote.building_name || lote.endereco || 'Imóvel'}
                            </div>
                            <div style="font-size: 12px; color: #64748b; margin-bottom: 8px;">
                                ${u.tipo || 'Residencial'} ${u.complemento || ''}${u.metragem ? ` • ${u.metragem}m²` : ''}
                            </div>
                            <div style="font-size: 11px; color: #94a3b8;">
                                📍 ${lote.bairro || '-'} • Zona ${lote.zona || '-'}
                            </div>
                        </div>
                        <div style="text-align: right;">
                            <div style="font-size: 10px; color: ${statusColor}; font-weight: 600; margin-bottom: 4px;">
                                ${u.status_venda || 'N/A'}
                            </div>
                            ${u.valor_venal ? `<div style="font-size: 12px; color: #334155; font-weight: 600;">R$ ${(u.valor_venal).toLocaleString('pt-BR')}</div>` : ''}
                        </div>
                    </div>
                    <div style="margin-top: 8px; font-size: 10px; color: #94a3b8; font-family: monospace;">
                        ${u.inscricao}
                    </div>
                </div>
            `;
        });

        html += '</div></div>';
        return html;
    },

    renderContatos(dados) {
        const moveis = dados.mobile_phones || [];
        const fixos = dados.land_lines || [];
        const emails = dados.emails || [];

        if (moveis.length === 0 && fixos.length === 0 && emails.length === 0) {
            return '';
        }

        let html = `<div class="section" style="margin-bottom: 24px;">
            <h3 style="font-size: 16px; font-weight: 700; color: #1e293b; margin-bottom: 16px; display: flex; align-items: center; gap: 8px; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px;">
                <i class="fas fa-phone" style="color: #667eea;"></i>
                Contatos
            </h3>`;

        // Telefones Móveis
        if (moveis.length > 0) {
            html += '<div style="margin-bottom: 12px;"><strong style="font-size: 13px; color: #64748b;">📱 Celulares:</strong><div style="margin-top: 8px; display: grid; gap: 6px;">';
            moveis.forEach(p => {
                const ddd = String(p.ddd).padStart(2, '0');
                const num = p.number;
                const formatted = `(${ddd}) ${num.substring(0, 5)}-${num.substring(5)}`;
                const hasWhatsApp = p.whatsapp_datetime ? '💬 WhatsApp' : '';
                html += `<div style="font-size: 13px; padding: 6px 12px; background: #f8fafc; border-radius: 6px; display: flex; justify-content: space-between;">
                    <span>${formatted}</span>
                    <span style="color: #10b981; font-size: 11px; font-weight: 600;">${hasWhatsApp}</span>
                </div>`;
            });
            html += '</div></div>';
        }

        // Telefones Fixos
        if (fixos.length > 0) {
            html += '<div style="margin-bottom: 12px;"><strong style="font-size: 13px; color: #64748b;">☎️ Fixos:</strong><div style="margin-top: 8px; display: grid; gap: 6px;">';
            fixos.forEach(p => {
                const ddd = String(p.ddd).padStart(2, '0');
                const num = p.number;
                const formatted = `(${ddd}) ${num.substring(0, 4)}-${num.substring(4)}`;
                html += `<div style="font-size: 13px; padding: 6px 12px; background: #f8fafc; border-radius: 6px;">${formatted}</div>`;
            });
            html += '</div></div>';
        }

        // Emails
        if (emails.length > 0) {
            html += '<div><strong style="font-size: 13px; color: #64748b;">📧 Emails:</strong><div style="margin-top: 8px; display: grid; gap: 6px;">';
            emails.forEach(e => {
                html += `<div style="font-size: 12px; padding: 6px 12px; background: #f8fafc; border-radius: 6px;">${e.email}</div>`;
            });
            html += '</div></div>';
        }

        html += '</div>';
        return html;
    },

    renderEnderecos(dados) {
        const enderecos = dados.addresses || [];
        if (enderecos.length === 0) return '';

        let html = `<div class="section" style="margin-bottom: 24px;">
            <h3 style="font-size: 16px; font-weight: 700; color: #1e293b; margin-bottom: 16px; display: flex; align-items: center; gap: 8px; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px;">
                <i class="fas fa-map-marker-alt" style="color: #667eea;"></i>
                Endereços (${enderecos.length})
            </h3>
            <div style="display: grid; gap: 12px;">`;

        enderecos.forEach((end, i) => {
            html += `<div style="padding: 12px; background: #f8fafc; border-radius: 8px; border-left: 3px solid #667eea;">
                <div style="font-size: 13px; font-weight: 600; color: #334155; margin-bottom: 4px;">
                    ${end.type || 'Rua'} ${end.street}, ${end.number}${end.complement ? ` ${end.complement}` : ''}
                </div>
                <div style="font-size: 12px; color: #64748b;">
                    ${end.neighborhood} - ${end.city}/${end.district}
                </div>
                ${end.postal_code ? `<div style="font-size: 11px; color: #94a3b8; margin-top: 4px;">CEP: ${end.postal_code}</div>` : ''}
            </div>`;
        });

        html += '</div></div>';
        return html;
    },

    renderEmpresas(dados) {
        const empresas = dados.related_companies || [];
        if (empresas.length === 0) return '';

        let html = `<div class="section" style="margin-bottom: 24px;">
            <h3 style="font-size: 16px; font-weight: 700; color: #1e293b; margin-bottom: 16px; display: flex; align-items: center; gap: 8px; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px;">
                <i class="fas fa-briefcase" style="color: #667eea;"></i>
                Empresas Relacionadas (${empresas.length})
            </h3>
            <div style="display: grid; gap: 10px;">`;

        empresas.forEach(emp => {
            const ativa = emp.registry_situation === 'ATIVA';
            const statusColor = ativa ? '#10b981' : '#94a3b8';

            html += `<div style="padding: 12px; background: white; border: 1px solid #e2e8f0; border-radius: 8px;">
                <div style="display: flex; justify-content: space-between; align-items: start;">
                    <div style="flex: 1;">
                        <div style="font-size: 13px; font-weight: 700; color: #1e293b;">${emp.company_name}</div>
                        <div style="font-size: 11px; color: #64748b; margin-top: 2px;">${emp.description || '-'}</div>
                    </div>
                    <div style="text-align: right;">
                        ${emp.ownership ? `<div style="font-size: 13px; font-weight: 700; color: #667eea;">${emp.ownership}%</div>` : ''}
                        <div style="font-size: 10px; color: ${statusColor}; font-weight: 600; margin-top: 2px;">${emp.registry_situation || 'N/A'}</div>
                    </div>
                </div>
            </div>`;
        });

        html += '</div></div>';
        return html;
    },

    renderFamilia(dados) {
        const familia = dados.family_persons || [];
        if (familia.length === 0) return '';

        let html = `<div class="section" style="margin-bottom: 24px;">
            <h3 style="font-size: 16px; font-weight: 700; color: #1e293b; margin-bottom: 16px; display: flex; align-items: center; gap: 8px; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px;">
                <i class="fas fa-users" style="color: #667eea;"></i>
                Família (${familia.length})
            </h3>
            <div style="display: grid; gap: 8px;">`;

        familia.forEach(f => {
            html += `<div style="padding: 10px; background: #f8fafc; border-radius: 6px; display: flex; justify-content: space-between;">
                <span style="font-size: 13px; font-weight: 600; color: #334155;">${f.name}</span>
                <span style="font-size: 11px; color: #64748b;">${f.description || 'Familiar'}</span>
            </div>`;
        });

        html += '</div></div>';
        return html;
    },

    renderDadosAdicionais(prop) {
        let html = `<div class="section" style="background: #f8fafc; padding: 16px; border-radius: 8px; border: 1px dashed #cbd5e1;">
            <h4 style="font-size: 13px; font-weight: 700; color: #64748b; margin-bottom: 12px; text-transform: uppercase;">ℹ️ Dados Adicionais</h4>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 12px;">`;

        if (prop.rg) html += `<div><strong>RG:</strong> ${prop.rg}</div>`;
        if (prop.data_nascimento) html += `<div><strong>Nascimento:</strong> ${new Date(prop.data_nascimento).toLocaleDateString('pt-BR')}</div>`;
        if (prop.genero) html += `<div><strong>Gênero:</strong> ${prop.genero === 'M' ? 'Masculino' : 'Feminino'}</div>`;
        if (prop.nome_mae) html += `<div><strong>Mãe:</strong> ${prop.nome_mae}</div>`;
        if (prop.situacao_cadastral) html += `<div><strong>Situação:</strong> ${prop.situacao_cadastral}</div>`;
        if (prop.data_enriquecimento) html += `<div><strong>Última consulta:</strong> ${new Date(prop.data_enriquecimento).toLocaleDateString('pt-BR')}</div>`;

        html += '</div></div>';
        return html;
    },

    setupHandlers(tooltip, prop) {
        // Click nas propriedades para navegar
        tooltip.querySelectorAll('.prop-item').forEach(item => {
            item.addEventListener('click', async () => {
                const inscricao = item.dataset.inscricao;
                this.close();

                // Navegar para o lote usando o motor central (Hierárquico: Zona -> Setor -> Lote)
                const unidade = (prop.unidades || []).find(u => u.inscricao === inscricao);
                if (unidade && unidade.lote_inscricao) {
                    window.navigateToInscricao(unidade.lote_inscricao, unidade.inscricao);
                }
            });
        });
    },

    close() {
        if (window.currentTooltip) {
            if (window.currentTooltip.backdrop) {
                window.currentTooltip.backdrop.remove();
            }
            window.currentTooltip.remove();
            window.currentTooltip = null;
        }
    }
};

console.log("✅ Proprietario Tooltip module loaded");
