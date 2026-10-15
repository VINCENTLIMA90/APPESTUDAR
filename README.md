# Rumbo

Webapp React + Vite + Express + SQLite para preparar CCSE e DELE A2. Interface em PT-PT, PT-BR, EN, FR, AR (RTL), DE e ES. Conteúdo pedagógico em espanhol. Demonstração: https://rumbo-demo.onrender.com/. Aplicação independente do Instituto Cervantes.

## Executar e testar

Requer Node.js 24.19+ e npm.

```sh
npm ci --no-audit --no-fund
npm run dev
```

Vite usa 5173 e a API 3001. Para servir a compilação:

```sh
npm run build
npm start
```

O ambiente de onboarding não oferece pré-visualizações públicas de localhost; as portas locais servem para validação interna. Microfone requer HTTPS ou um contexto local seguro.

```sh
npm test
npm run test:e2e
```

Playwright usa `/usr/bin/chromium` ou `CHROMIUM_PATH`, porta 4173 e dados isolados em `/tmp/rumbo-e2e`. Os testes de IA, email e Stripe usam fornecedores simulados. As permissões de microfone usam um dispositivo simulado. Não houve compras reais nem chamadas pagas a IA ou voz.

## Acesso e módulos

O catálogo tem 48 aulas próprias, 24 de cada módulo, e 103 perguntas próprias de prática. Não inclui o banco oficial CCSE completo nem copia/adapta questões do manual oficial. A incorporação desse banco aguarda decisão jurídica.

| Recurso | Conta gratuita | Subscrição ativa |
| --- | --- | --- |
| Aulas | c1, c2, d1, d2 | Todas do módulo adquirido |
| Avaliação inicial | Completa: perguntas, escrita e oralidade | Completa |
| Simulados | 1 CCSE completo e 1 DELE reduzido por conta | Ilimitados no módulo adquirido |
| Prática, revisão, plano | Bloqueados | Incluídos no módulo adquirido |
| Percurso completo DELE | Bloqueado | DELE A2 ou conjunto |
| Tutor e correção IA | Bloqueados | Conforme quotas abaixo |

A tentativa gratuita é consumida ao **iniciar** o simulado, mesmo que seja abandonado. Iniciar sessão ou voltar a publicar não deve repor esse direito: exige conservar a base de dados. A API devolve 402 para recursos sem acesso e 401 quando falta sessão. O catálogo público entrega apenas metadados; as quatro aulas gratuitas também requerem conta.

Preços mensais com IVA incluído: CCSE 15 €, DELE A2 15 €, ambos 20 €. Pagamentos continuam desativados até configurar Stripe, email verificado, termos revistos e armazenamento permanente. Consultar [BILLING.md](BILLING.md) e [DEPLOY.md](DEPLOY.md).

## IA incluída

A IA usa exclusivamente configuração do servidor: `AI_PROVIDER`, `AI_API_KEY`, `AI_MODEL` e `AI_TRANSCRIBE_MODEL`. Não há escolha de fornecedor/modelo nem introdução de chaves na interface. Os modelos não têm nomes fixos no código. Sem configuração, a interface apresenta disponibilidade temporariamente suspensa e não consome quotas.

| Plano | Correções de escrita/oral por ciclo | Mensagens de tutor por ciclo |
| --- | ---: | ---: |
| Gratuito | 0 | 0 |
| CCSE | 0 | 50 |
| DELE A2 | 30 | 300 |
| Conjunto | 30 | 300 |

As quotas são configuráveis e contadas no servidor por utilizador/ciclo da subscrição Stripe. Pedidos em curso reservam quota, sucessos são contados e falhas libertam a reserva. Reservas interrompidas expiram após dez minutos. Consultar uma correção já guardada não gasta outra correção. A interface mostra o saldo e a data de renovação. Cada envio de texto/gravação exige consentimento explícito.

Fornecedores suportados: OpenAI, Anthropic e Gemini. OpenAI transcreve oralidade com `AI_TRANSCRIBE_MODEL`; Gemini aceita áudio; Anthropic requer resposta escrita/transcrição. A correção é orientativa e não certifica nível nem nota oficial de pronúncia. O tutor respeita o módulo subscrito. Consulte todas as variáveis em [ENVIRONMENT.md](ENVIRONMENT.md).

## Conta e email

Palavras-passe protegidas por scrypt e sessões HttpOnly/SameSite. `MAX_SESSIONS_PER_USER=1` por omissão: um novo início de sessão termina a sessão ativa mais antiga e o dispositivo anterior recebe a mensagem correspondente. O esquema inclui `device_id` e um mecanismo de tokens com finalidade; não implementa códigos por email em dispositivo novo.

Recuperação e verificação de email usam tokens aleatórios, guardados só por hash, de uso único e com validade de 60 minutos. A recuperação responde sempre da mesma forma, exista ou não a conta. Alterar a palavra-passe invalida todas as sessões. O email tem de estar verificado para iniciar uma subscrição.

Configurar Resend ou Postmark através de `EMAIL_PROVIDER`, `EMAIL_API_KEY`, `EMAIL_FROM` e a URL canónica `APP_URL`. Em desenvolvimento (`NODE_ENV=development`), sem serviço, o link aparece apenas nos logs locais. **Nunca é registado em produção**. Sem serviço em produção, o registo continua possível, mas verificação e recuperação dependem da configuração do email.

## Áudio pré-gerado

Os exercícios auditivos usam MP3 estáticos de `/audio/<id>.mp3`. Se faltar um ficheiro, mostram a transcrição; não recorrem à síntese de voz do navegador. O modelo oficial DELE mantém os áudios naturais ligados ao Instituto Cervantes. A leitura opcional de mensagens dinâmicas do tutor continua identificada como voz sintética e é distinta dos exercícios auditivos.

O script `scripts/generate-audio.js` suporta vozes neurais Azure Speech, alternando as vozes configuradas de Espanha e América Latina. Não foi executado com chaves reais. Foi validado um plano de **16 ficheiros** em modo seco:

```sh
TTS_VOICES='[{"locale":"es-ES","name":"es-ES-ElviraNeural"},{"locale":"es-MX","name":"es-MX-DaliaNeural"}]' node --use-env-proxy scripts/generate-audio.js --dry-run
```

Para gerar efetivamente, configurar as variáveis TTS de [ENVIRONMENT.md](ENVIRONMENT.md) e executar:

```sh
node --use-env-proxy scripts/generate-audio.js
npm run build
```

Os MP3 são escritos em `public/audio/`, copiados pelo Vite e servidos como estáticos. Incluir os artefactos gerados na publicação escolhida. Não colocar a chave de voz no repositório.

## Estudo, fontes e limites

Plano de estudo com frequência, objetivo e data escolhida; janela de preparação heurística, sem garantia de aprovação. Revisão espaçada, 30 cartões de vocabulário, histórico, gravações e exportação. Percurso completo DELE guiado por documentos oficiais com temporizadores e correção objetiva datada. Os ficheiros oficiais não são redistribuídos.

O monitor verifica links oficiais e as claves do modelo no arranque e diariamente. Alterações sinalizam revisão; falhas de rede não são interpretadas como uma edição nova. A monitorização não atualiza automaticamente o banco de perguntas. [CONTENT.md](CONTENT.md) documenta as fontes e limitações.

SQLite guarda os dados em `DATA_DIR`; as migrações são aditivas. Não substituir dados reais por fixtures de testes. O Render gratuito mantém dados temporários: não foi contratado nem alterado alojamento. Antes de ativar pagamentos é obrigatório armazenamento permanente, cópias de segurança e teste de recuperação.

## Textos legais

Termos, privacidade e cancelamento/desistência existem como estrutura, claramente marcados **[A REVER POR JURISTA]**, com ligações no rodapé e no registo. O checkout exige no servidor a aceitação dos termos e o pedido de início imediato do acesso digital; regista a versão provisória e a data. A validação jurídica e fiscal continua pendente, incluindo a redação final sobre desistência.
