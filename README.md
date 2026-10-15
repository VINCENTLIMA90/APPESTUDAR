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

O catálogo tem 48 aulas próprias, 24 de cada módulo. O banco CSV tem 298 factos e 448 variantes: 103 perguntas aprovadas migradas, 150 novos factos CCSE com duas variantes cada e 45 perguntas DELE para completar nove temas, todas as novas em rascunho. Não inclui o banco oficial CCSE completo nem copia/adapta questões do manual oficial. A incorporação desse banco aguarda decisão jurídica.

| Recurso | Conta gratuita | Subscrição ativa |
| --- | --- | --- |
| Aulas | c1, c2, d1, d2 | Todas do módulo adquirido |
| Avaliação inicial | Completa: perguntas, escrita e oralidade | Completa |
| Simulados | 1 CCSE completo e 1 DELE reduzido por conta, com email verificado | Ilimitados no módulo adquirido |
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

Recuperação e verificação de email usam tokens aleatórios, guardados só por hash, de uso único e com validade de 60 minutos. A recuperação responde sempre da mesma forma, exista ou não a conta. Alterar a palavra-passe invalida todas as sessões. O email tem de estar verificado para iniciar uma subscrição ou usar um simulado gratuito. A avaliação e as aulas gratuitas continuam acessíveis antes da verificação. O reenvio tem espera de 60 segundos, aplicada no servidor e na interface. A recuperação mantém a mesma resposta para contas existentes e inexistentes. Falhas de envio ficam em email_deliveries, sem tokens nem links, e aparecem na app para a verificação.

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

Termos, privacidade e cancelamento/desistência existem como estrutura, claramente marcados **[A REVER POR JURISTA]**, com ligações no rodapé e no registo. O checkout exige duas aceitações independentes no servidor: termos/privacidade e pedido de início imediato, com reconhecimento dos efeitos na desistência. Cada uma é guardada com tipo, versão provisória e data em checkout_consent_acceptances. Os antigos registos únicos são preservados, sem fabricar aceitações independentes retroativas. A validação jurídica e fiscal continua pendente, incluindo a redação final sobre desistência.

## Oferta e recomendação

A apresentação comunica a avaliação inicial, um simulado CCSE completo, um teste DELE A2 e duas aulas por módulo, sem cartão. O bloco sobre nacionalidade guarda a resposta apenas no navegador, com proteção quando localStorage está indisponível. A lista de países está em `src/config/exam-requirements.js`. Usam-se nomes dos países de Intl.DisplayNames nas sete línguas. O registo recebe apenas `initialGoal` (preferência do plano), sem nacionalidade nem resposta ao questionário. A escolha «Sim» começa com objetivo CCSE; não altera objetivos já guardados de uma conta existente.

Confirmar sempre requisitos e eventuais dispensas nas fontes oficiais. A recomendação é inicial e não substitui a análise do processo individual.

## Banco editável e percurso por factos

O mestre é [content/questions.csv](content/questions.csv), CSV UTF-8 com BOM, separador `;`, respostas corretas numeradas de 1 a 3. Pode ser editado em Excel/Sheets. O [guia de edição](content/README.md) explica colunas, variantes e aprovação. O código deixou de conter as 103 perguntas do banco. As atividades exemplificativas das aulas e os documentos DELE externos são componentes pedagógicos distintos.

```sh
node scripts/import-questions.js --check
node scripts/import-questions.js content/questions.csv
node scripts/export-drafts.js content/questions.csv /tmp/rumbo-rascunhos.csv
```

Sem erros, a importação carrega todas as linhas em SQLite numa transação; apenas `aprovada` é servida. Em caso de erros, lista as linhas e não importa nada. O servidor sincroniza o mestre validado no arranque. A importação manual usa `DATA_DIR`; não a apontar a uma base de produção sem a cópia de segurança e a revisão editorial habituais. A API consulta o banco atual; as perguntas/opções dos testes iniciados ficam congeladas no servidor para preservar a correção de cada tentativa.

No fim da aula, o teste do tema seleciona 5–8 perguntas ligadas por `lesson_id`/`lesson_ids`, mistura tipos quando existem aprovados e dá explicação após cada resposta. As opções são baralhadas no servidor. O simulador CCSE usa apenas `exame`, 25 perguntas e 45 minutos, sem ajudas durante a prova: 10 de governo, 3 V/F de direitos/deveres, 2 de geografia, 3 de cultura e 7 de sociedade. **Exceção de formato:** a variante `exame` de direitos/deveres usa duas opções para manter a tarefa V/F; as outras usam três. Os 30 novos factos dessa categoria têm `exame` V/F e uma variante `invertida` de três opções.

Erros e revisões são agrupados por facto. Quando existe outra variante aprovada, a revisão escolhe uma diferente da última falhada. Um facto é dominado com dois acertos em variantes diferentes em dias diferentes de Madrid. Autoavaliações de cartões não contam como prova de acerto. Os estados/logs antigos são conservados; cria-se uma agenda por facto e recupera-se evidência dos resultados anteriores, sem apagar o progresso. O export inclui também tentativas por facto e passos de aprendizagem.

Os 103 factos legados têm uma única variante aprovada; por isso não passam a «dominados» por repetição da mesma pergunta. Será necessário aprovar outra variante para esse facto. As nove aulas DELE `d5`, `d17`–`d24` mostram o aviso de banco insuficiente até serem revistas/aprovadas as suas 45 novas perguntas. A restrição evita publicar rascunhos ou avaliar conteúdo de outra aula apenas para preencher cinco perguntas.

O passo de leitura do manual do ano abre um PDF gratuito no site do Instituto Cervantes, em nova janela, e permite marcar a conclusão na conta. Não descarrega, extrai, resume, incorpora nem enquadra o manual. O URL/ano estão no ficheiro de configuração; a rede deste ambiente bloqueou a confirmação externa do endereço 2026, pelo que deve ser confirmado antes da publicação comercial.

## Início de sessão com Google

O fluxo é OAuth 2.0/OpenID Connect authorization code com PKCE S256 no servidor. Confere state, vínculo ao navegador, nonce, assinatura RS256 com chaves públicas Google, emissor, validade e audiência do id_token. Só aceita `email_verified=true`. Liga o email existente sem duplicar a conta e conserva a palavra-passe/objetivo anteriores. Uma conta nova fica verificada, recebe uma palavra-passe aleatória desconhecida e pode definir uma pela recuperação por email. Aplica o mesmo limite de sessões. Não se guardam access tokens, refresh tokens ou id_tokens.

Para configurar:

1. Criar/selecionar um projeto na Google Cloud Console e configurar o ecrã de consentimento OAuth, contactos, domínios e utilizadores de teste quando aplicável.
2. Criar um cliente OAuth do tipo **Web application** para `openid email profile`.
3. Registar exatamente a URI de redirecionamento: `APP_URL` + `/api/auth/google/callback` (por exemplo `https://rumbo-demo.onrender.com/api/auth/google/callback`). `APP_URL` deve ser uma origem HTTPS, sem caminho.
4. Guardar `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET` nas variáveis do servidor Render, junto de `APP_URL`. Não usar VITE_ nem colocar o segredo no Git/chat.
5. Reiniciar/publicar e validar com uma conta de teste. Sem a configuração completa, o botão não aparece. Os testes automatizados simulam a troca de código e assinam tokens fictícios; não usaram contas ou segredos reais do Google.

A política de privacidade provisória menciona Google e aguarda revisão jurídica. Configurar email continua necessário para recuperar ou definir uma palavra-passe, mesmo em contas Google.
