/**
 * GEMINI CHAT HANDLER - GeoMap AI Assistant
 */

class GeminiChatHandler {
    constructor() {

        this.apiKey = "AIzaSyCMDj4RXAJheWLJX61Vbt6WG_M6eQ_nPrE";

        // Model Registry based on User's Dashboard (Valid IDs)
        this.models = {
            'smart': 'gemini-2.5-flash',      // Using 2.5 as top tier (most stable)
            'balanced': 'gemini-2.5-flash',   // Standard
            'fast': 'gemini-2.5-flash-lite'   // Correct Fallback (Lite version)
        };

        // Default Model
        this.currentModel = this.models.balanced;
        this.apiUrl = (model) => `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.apiKey}`;

        // Inject Custom Styles for AI Results
        if (!document.getElementById('ai-chat-styles')) {
            const style = document.createElement('style');
            style.id = 'ai-chat-styles';
            style.innerHTML = `
                .ai-message-content {
                    font-family: 'Inter', sans-serif;
                    line-height: 1.6;
                    color: #334155;
                }
                .ai-message-content h3 { font-size: 14px; font-weight: 700; color: #1e293b; margin-top: 15px; margin-bottom: 8px; }
                .ai-message-content ul { padding-left: 20px; list-style-type: disc; margin-bottom: 10px; }
                .ai-message-content li { margin-bottom: 4px; }
                .ai-message-content strong { color: #0f172a; font-weight: 600; }
                .ai-message-content img { max-width: 100%; border-radius: 6px; margin: 10px 0; border: 1px solid #e2e8f0; }
                
                /* Scrollbar for chat */
                #farol-messages::-webkit-scrollbar { width: 6px; }
                #farol-messages::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 3px; }
                #farol-messages::-webkit-scrollbar-track { background: transparent; }
            `;
            document.head.appendChild(style);
        }

        this.container = null;
        this.trigger = null;
        this.messagesDiv = null;
        this.input = null;
        this.typingIndicator = null;

        this.history = []; // Histórico para contexto (opcional, cuidado com tokens)

        this.systemPrompt = `Você é o "Farol", o Assistente de Inteligência Estratégica da Omega Imóveis no sistema Guarugeo. 
ESTA É UMA FERRAMENTA INTERNA PARA CORRETORES E GESTORES. Você NUNCA fala com o cliente final.

Sua missão é ser o motor de produtividade da Omega Imóveis:
1. ANÁLISE TÉCNICA E GAP: Detecte oportunidades no mercado e sugira abordagens.
2. MARKETING INSTANTÂNEO: Crie anúncios magnéticos e roteiros de vendas.
3. SEGURANÇA TOTAL: Redija contratos e realize due diligence preventivo.
4. ORÁCULO DE DADOS (IMPORTANTE): Você tem acesso total ao banco de dados.
   - Se o usuário perguntar por "proprietário", "matrícula", "endereço" ou "inscrição" e você NÃO tiver esse dado no contexto, USE O COMANDO DE BUSCA.
   - FORMATO DO COMANDO: [DB_SEARCH: tipo=VALOR_TIPO, query=VALOR_BUSCA]
   - Tipos suportados: 'matricula', 'proprietario', 'endereco', 'inscricao'.
   - Ex: [DB_SEARCH: tipo=matricula, query=12345] ou [DB_SEARCH: tipo=proprietario, query=Joao Silva]
   - NÃO responda "não sei" sem antes tentar buscar.

    VISUALIZATION & IMAGES (MANDATORY):
    - ALWAYS search for images of the building or location using Google Search.
    - If you find images, EMBED them using Markdown: ![Description](URL).
    - If you find a Street View or Map link, include it.
    - Make the response visually rich.

AUTONOMIA E PRECISÃO PROFISSIONAL:
Você atua em um ambiente LEGAL e COMERCIAL de alto nível.
Se faltarem dados (ex: nº de quartos, vagas), use sua inteligência para INFERIR com base no padrão do edifício ou bairro, mas faça isso com AUTORIDADE E LÓGICA TÉCNICA.
NUNCA use termos como "eu acho" ou "estimativa grosseira".
Use formulações como: "Considerando o padrão construtivo deste edifício..." ou "Conforme tipologia padrão da região...".
Seja CIRÚRGICO. O assunto é sério (Contratos e Vendas). Erros minam a confiança.

SUA CAPACIDADE DE ATUALIZAÇÃO:
Se durante a conversa você identificar dados que precisam ser corrigidos ou atualizados (como metragem, valor venal ou nome), use a tag: [UPDATE_DATA:Campo=Valor]. 
Exemplo: "Notei que a metragem desta unidade é 85m². [UPDATE_DATA:Metragem=85]"
Isso gerará um botão de confirmação para o corretor.`;

        this.init();
    }

    init() {
        this.createElements();
        this.bindEvents();
        console.log("🤖 Farol AI Initialized");
    }

    createElements() {
        // Floating Chat Button
        this.trigger = document.createElement('div');
        this.trigger.id = 'farol-trigger';
        this.trigger.innerHTML = '<i class="fas fa-robot"></i>';
        this.trigger.style.cssText = `
            position: fixed; bottom: 20px; right: 20px; width: 60px; height: 60px;
            background: #0f172a; color: white; border-radius: 50%;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2); cursor: pointer;
            display: flex; align-items: center; justify-content: center;
            font-size: 24px; z-index: 9999; transition: transform 0.2s;
        `;
        document.body.appendChild(this.trigger);

        // Chat Container
        this.container = document.createElement('div');
        this.container.id = 'farol-chat';
        this.container.style.cssText = `
            position: fixed; bottom: 90px; right: 20px; width: 350px; height: 500px;
            background: white; border-radius: 12px; box-shadow: 0 5px 20px rgba(0,0,0,0.2);
            z-index: 9999; display: none; flex-direction: column; overflow: hidden;
            font-family: 'Inter', sans-serif; border: 1px solid #e2e8f0;
        `;

        this.container.innerHTML = `
            <div style="background: #0f172a; color: white; padding: 15px; display: flex; align-items: center; justify-content: space-between;">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <i class="fas fa-robot"></i>
                    <div>
                        <div style="font-weight: 700; font-size: 14px;">Farol AI</div>
                        <div style="font-size: 10px; opacity: 0.8; display: flex; align-items: center; gap: 4px;">
                            <span style="width: 6px; height: 6px; background: #22c55e; border-radius: 50%;"></span> Online
                        </div>
                    </div>
                </div>
                <button id="farol-close" style="background: none; border: none; color: white; cursor: pointer; font-size: 16px;">&times;</button>
            </div>
            
            <div id="farol-messages" style="flex: 1; padding: 15px; overflow-y: auto; background: #f8fafc; display: flex; flex-direction: column; gap: 10px;">
                <div style="background: #e0f2fe; padding: 10px; border-radius: 8px; border-bottom-left-radius: 0; font-size: 13px; color: #334155; align-self: flex-start; max-width: 85%;">
                    Olá! Sou o Farol, seu assistente estratégico. Como posso ajudar com os imóveis hoje? 🤖
                </div>
            </div>

            <div style="background: white; padding: 10px; border-top: 1px solid #e2e8f0; display: flex; gap: 8px;">
                <input type="text" id="farol-input" placeholder="Pergunte sobre um imóvel..." style="flex: 1; padding: 8px 12px; border: 1px solid #cbd5e1; border-radius: 20px; outline: none; font-size: 13px;">
                <button id="farol-send" style="background: #0f172a; color: white; border: none; width: 36px; height: 36px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center;">
                    <i class="fas fa-paper-plane" style="font-size: 14px;"></i>
                </button>
            </div>
        `;

        document.body.appendChild(this.container);

        // Cache refs
        this.messagesDiv = this.container.querySelector('#farol-messages');
        this.input = this.container.querySelector('#farol-input');

        // Typing Indicator
        this.typingIndicator = document.createElement('div');
        this.typingIndicator.style.cssText = 'padding: 10px; font-size: 12px; color: #64748b; font-style: italic; display: none;';
        this.typingIndicator.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Farol digitando...';
        this.messagesDiv.appendChild(this.typingIndicator);
    }

    bindEvents() {
        this.trigger.onclick = () => this.toggleChat();
        this.container.querySelector('#farol-close').onclick = () => this.toggleChat();

        const sendBtn = this.container.querySelector('#farol-send');
        sendBtn.onclick = () => this.sendMessage();

        this.input.onkeypress = (e) => {
            if (e.key === 'Enter') this.sendMessage();
        };

        // Auto-focus input on open
        this.trigger.addEventListener('click', () => {
            if (this.container.style.display !== 'none') {
                setTimeout(() => this.input.focus(), 100);
            }
        });
    }

    toggleChat() {
        const isHidden = this.container.style.display === 'none';
        this.container.style.display = isHidden ? 'flex' : 'none';
        if (isHidden) {
            this.trigger.style.transform = 'scale(0)';
        } else {
            this.trigger.style.transform = 'scale(1)';
        }
    }

    addMessage(text, sender) {
        const div = document.createElement('div');
        const isBot = sender === 'bot' || sender === 'bot-system';

        div.style.cssText = `
            max-width: 85%; padding: 10px; border-radius: 8px; font-size: 13px; line-height: 1.5;
            ${isBot ?
                'background: #fff; border: 1px solid #e2e8f0; border-bottom-left-radius: 0; align-self: flex-start; color: #334155;' :
                'background: #0f172a; color: white; border-bottom-right-radius: 0; align-self: flex-end;'}
        `;

        if (sender === 'bot-system') {
            div.style.background = '#f0fdf4';
            div.style.border = '1px solid #bbf7d0';
            div.style.color = '#166534';
            div.style.fontStyle = 'italic';
            div.innerHTML = `<i class="fas fa-cog fa-spin"></i> ${text}`;
        } else if (isBot) {
            // Use global parser for markdown support
            const parsed = window.parseMarkdown ? window.parseMarkdown(text) : text.replace(/\n/g, '<br>');
            div.innerHTML = `<div class="ai-message-content">${parsed}</div>`;
        } else {
            div.textContent = text;
        }

        this.messagesDiv.insertBefore(div, this.typingIndicator);
        this.messagesDiv.scrollTop = this.messagesDiv.scrollHeight;
    }

    showTyping(show) {
        this.typingIndicator.style.display = show ? 'block' : 'none';
        this.messagesDiv.scrollTop = this.messagesDiv.scrollHeight;
    }

    processLeadData(text) {
        return text; // Placeholder: In future, extract JSON leads here
    }

    async sendMessage() {
        const text = this.input.value.trim();
        if (!text) return;

        this.addMessage(text, 'user');
        this.input.value = '';

        this.showTyping(true);

        try {
            // 'ask' agora lida internamente com o loop de [DB_SEARCH]
            const response = await this.ask(text);

            // Lógica de Extração de Lead
            const cleanResponse = this.processLeadData(response);
            this.addMessage(cleanResponse, 'bot');
        } catch (error) {
            console.error("Erro Chat IA:", error);
            this.addMessage("Desculpe, tive um problema na conexão. Pode tentar novamente?", 'bot');
        } finally {
            this.showTyping(false);
        }
    }

    async handleDbSearch(commandText) {
        const match = commandText.match(/\[DB_SEARCH:\s*tipo=(.*?),\s*query=(.*?)\]/);
        if (!match) return { error: "Comando inválido." };

        const type = match[1].trim();
        const query = match[2].trim();

        console.log(`🔎 Farol DB Search: ${type} = ${query}`);

        try {
            let data, error;

            if (type === 'matricula') {
                ({ data, error } = await window.supabaseApp
                    .from('unidades')
                    .select('inscricao, matricula, nome_proprietario, endereco_proprietario, area_util, valor_venal, status_venda')
                    .eq('matricula', query)
                    .limit(5));
            }
            else if (type === 'proprietario') {
                ({ data, error } = await window.supabaseApp
                    .from('unidades')
                    .select('inscricao, nome_proprietario, matricula, endereco_proprietario')
                    .ilike('nome_proprietario', `%${query}%`)
                    .limit(5));
            }
            else if (type === 'endereco') {
                ({ data, error } = await window.supabaseApp
                    .from('lotes')
                    .select('*, unidades(matricula, nome_proprietario, inscricao)')
                    .ilike('endereco', `%${query}%`)
                    .limit(3));
            }
            else if (type === 'inscricao') {
                ({ data, error } = await window.supabaseApp
                    .from('unidades')
                    .select('*')
                    .eq('inscricao', query)
                    .limit(1));
            }

            if (error) throw error;

            if (!data || data.length === 0) return { found: false, message: "Nenhum registro encontrado." };
            return { found: true, results: data };

        } catch (e) {
            console.error("DB Search Error:", e);
            return { error: "Erro técnico ao consultar banco: " + e.message };
        }
    }

    async ask(userText, modelType = 'balanced') {
        const selectedModel = this.models[modelType] || this.models.balanced;
        console.log(`🧠 Using AI Model: ${selectedModel} for intent: ${modelType}`);

        // 1. Primeira Chamada (Raw)
        let response = await this._callGeminiApi(userText, selectedModel);

        // 2. Loop de Verificação de Comandos (DB Search)
        // Permitimos até 2 iterações para evitar loops infinitos
        let iterations = 0;
        while (response.includes('[DB_SEARCH:') && iterations < 2) {
            iterations++;
            console.log(`🔄 Ciclo AI DB_SEARCH #${iterations}`);

            const dbResult = await this.handleDbSearch(response);

            // Re-submete para a IA com os dados
            const nextPrompt = `[SISTEMA_DADOS_RETORNO]\n${JSON.stringify(dbResult)}\n[/SISTEMA_DADOS_RETORNO]\n\nCom base nesses dados (ou se não achou nada), responda à pergunta original do usuário/intuito inicial.`;
            response = await this._callGeminiApi(nextPrompt, selectedModel); // Keep same model for continuity
        }

        return response;
    }

    async _callGeminiApi(inputText, modelName) {
        // Obter contexto da unidade se o tooltip estiver aberto
        let context = "";
        if (window.currentTooltip && window.currentLoteForUnit) {
            const lote = window.currentLoteForUnit;
            const unit = lote.unidades ? lote.unidades[0] : {};

            // 1. Converter GPS (UTM -> Lat/Lon)
            let gpsContext = "";
            if (lote.minx && lote.miny && window.utmToLatLon) {
                const centerX = (lote.minx + lote.maxx) / 2;
                const centerY = (lote.miny + lote.maxy) / 2;
                const latLon = window.utmToLatLon(centerX, centerY);
                if (latLon) {
                    gpsContext = `
                     [DADOS_GEOGRAFICOS_PRECISOS]
                     - Latitude: ${latLon.lat}
                     - Longitude: ${latLon.lng}
                     - Link Maps Visual: https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${latLon.lat},${latLon.lng}
                     - Google Search Maps Link: https://www.google.com/maps/search/?api=1&query=${latLon.lat},${latLon.lng}
                     [/DADOS_GEOGRAFICOS_PRECISOS]`;
                }
            }

            context = `
            [CONTEXTO_ATUAL]
            - Unidade: ${unit.inscricao || 'N/A'}
            - Edifício: ${lote.building_name || 'Desconhecido'}
            - Endereço: ${lote.endereco || 'N/A'}, ${lote.bairro || 'Guarujá'}
            ${gpsContext}
            [/CONTEXTO_ATUAL]
            
            INSTRUÇÃO DE IMAGEM: Se você encontrar imagens públicas relevantes deste edifício ou localização na internet, INCLUA os links ou incorpore a imagem markdown se possível.
            `;
        }

        try {
            const payload = {
                contents: [{
                    parts: [{ text: `${this.systemPrompt}\n\n${context}\n\nINPUT: ${inputText}` }]
                }],
                // Enable Google Search Grounding for all calls
                tools: [{ google_search: {} }]
            };

            const url = this.apiUrl(modelName);

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s Timeout

            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`API Error: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();

            if (data.candidates && data.candidates[0].content && data.candidates[0].content.parts) {
                return data.candidates[0].content.parts[0].text;
            } else {
                throw new Error("Resposta inválida da API (vazia)");
            }

        } catch (e) {
            console.warn(`⚠️ Error with ${modelName}: ${e.message}`);

            // Cascading Fallback Strategy
            let nextModel = null;

            if (modelName === this.models.smart) nextModel = this.models.balanced;
            else if (modelName === this.models.balanced) nextModel = this.models.fast;

            if (nextModel) {
                console.log(`🔄 Falling back to ${nextModel}...`);
                return this._callGeminiApi(inputText, nextModel);
            }

            // If we reached here, even the fallback failed
            throw e;
        }
    }
}

// Inicializa quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => {
    window.Farol = new GeminiChatHandler();
});
