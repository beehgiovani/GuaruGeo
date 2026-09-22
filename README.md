# GuaruGeo

Protótipo web de geoprocessamento e apoio à gestão imobiliária no Guarujá. O repositório reúne mapa cadastral, busca, cadastro de lotes e unidades, integrações com Supabase e empacotamento para desktop e Android via Electron e Capacitor.

## Situação do projeto

Este é um projeto anterior e mais amplo que o [Guarujá Interativo](https://github.com/beehgiovani/GuarujaInterativo), hoje usado como referência principal no portfólio. O código permanece público como registro técnico, mas integrações externas e fluxos dependentes de credenciais precisam ser configurados e testados antes de qualquer uso real.

Não há garantia de cobertura integral dos imóveis, atualização cadastral em tempo real ou disponibilidade das APIs de terceiros.

## O que o código demonstra

- visualização de dados geográficos com Leaflet;
- busca e organização de lotes e unidades;
- persistência e funções de backend com Supabase;
- empacotamento web para Electron e Android com Capacitor;
- experimentos de CRM, documentos e notificações.

## Tecnologias encontradas

- JavaScript, HTML e CSS;
- Leaflet e RBush;
- Supabase;
- Node.js;
- Electron;
- Capacitor Android;
- Firebase Hosting.

## Execução local

```bash
npm install
npm start
```

As variáveis e chaves de serviços externos devem ser fornecidas localmente. Não versione credenciais.

## Limites e uso responsável

Os dados cadastrais e pessoais usados por este tipo de sistema exigem finalidade legítima, controle de acesso e observância à LGPD e aos termos das fontes. Informações obtidas de serviços públicos ou terceiros devem ser conferidas na origem antes de orientar uma decisão.
