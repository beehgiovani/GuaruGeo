# Guaruja Geo - Email Monitor (Standalone)

Este serviço monitora a caixa de email configurada para baixar automaticamente certidões (PDFs) e salvar no Supabase Storage do projeto Guaruja Geo.

## Pré-requisitos

1. **Node.js**: v18+ instalado.
2. **Conta de Email**: Gmail com "App Password" gerada.
3. **Supabase**: URL e Service Role Key.

## Instalação Local

1. Entre na pasta:
   ```bash
   cd backend_monitor
   ```

2. Instale as dependências:
   ```bash
   npm install
   ```

3. Crie um arquivo `.env` com suas credenciais:
   ```env
   IMAP_USER=seu_email@gmail.com
   IMAP_PASSWORD=sua_senha_de_app
   IMAP_HOST=imap.gmail.com
   SUPABASE_URL=https://seu-projeto.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=sua_chave_service_role
   ```

4. Inicie o monitor:
   ```bash
   npm start
   ```

   O serviço ficará rodando e mostrará logs no console a cada email novo.

## Deploy no Render.com (Recomendado)

O Render é ideal para rodar este tipo de "Background Worker" gratuitamente ou com baixo custo.

1. Crie uma conta no [Render.com](https://render.com).
2. Conecte seu repositório GitHub.
3. Clique em **New +** -> **Background Worker**.
4. Selecione este repositório.
5. Configure:
   - **Runtime**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `node backend_monitor/index.js` (ajuste o caminho se necessário)
6. Na aba **Environment**, adicione as variáveis do `.env` acima.
7. Clique em **Create Background Worker**.

Pronto! O Render manterá o script rodando 24/7.
