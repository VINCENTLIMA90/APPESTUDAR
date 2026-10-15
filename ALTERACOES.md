# Entrega 0.5.0 — oferta, factos, email e Google

## Resultado

Oferta grátis completa na apresentação, FAQ, planos e bloqueios; recomendação local por nacionalidade com destaque do plano; banco mestre editável fora do código; testes de tema com feedback imediato; opções baralhadas e correção guardadas no servidor; revisão por facto e domínio por variantes/dias diferentes; manual externo com conclusão; consentimentos separados; reenvio/estado de email; Google OAuth/OIDC no servidor.

Preços, quotas de IA, regras Stripe além do consentimento, DATA_DIR, DATA_PERSISTENT e plano de alojamento foram mantidos.

## Verificações

- **66 testes da API aprovados**, sem testes ignorados: importação real pelo CLI e rejeição de CSV inválido sem mudar a base, visibilidade por estado, simulador só exame mesmo com alternativas aprovadas, temas, domínio e migração do histórico, email, consentimentos e Google simulado.
- **23 testes Playwright aprovados**, sem testes ignorados: compilação de produção, três respostas sobre nacionalidade, sete línguas/RTL, 375 px/contraste, localStorage indisponível, tema com feedback, duas caixas, reenvio com contagem, manual e opção Google.
- Inspeção visual da página de apresentação; todas as entradas i18n complementares têm sete traduções.
- Exportação real dos rascunhos validada. As fontes oficiais e o Render devolveram bloqueio do proxy (CONNECT 403); não foi possível confirmar o PDF nem a publicação pública.
- Google, email, IA e Stripe foram simulados nos testes; não foram usadas credenciais reais nem efetuadas cobranças/envios reais. O manual CCSE não foi descarregado ou extraído.

## Conteúdo criado

As 103 perguntas existentes mantêm os IDs, o texto e o estado aprovado. Cada uma é um facto com variante exame. As sete V/F são classificadas em direitos/deveres para preservar a tarefa 2.

| Categoria nova | Factos | Variantes | Estado |
| --- | ---: | ---: | --- |
| CCSE — Governo e instituições | 30 | 60 | rascunho |
| CCSE — Direitos e deveres | 30 | 60 | rascunho |
| CCSE — Geografia | 30 | 60 | rascunho |
| CCSE — Cultura | 30 | 60 | rascunho |
| CCSE — Sociedade e vida quotidiana | 30 | 60 | rascunho |
| **Subtotal CCSE solicitado** | **150** | **300** | **rascunho** |
| DELE — Escrita, cobertura adicional de aulas | 25 | 25 | rascunho |
| DELE — Oralidade, cobertura adicional de aulas | 20 | 20 | rascunho |
| **Total novo** | **195** | **345** | **rascunho** |

O mestre tem **298 factos e 448 variantes**, das quais só **103 estão aprovadas**. Direitos/deveres usa `exame` V/F e uma `invertida` de três opções para conservar o formato da tarefa 2. As outras categorias CCSE usam `exame` de três opções e V/F. Esta é a exceção ao formato de três opções necessária para manter a estrutura anterior do simulador.

## Alterações por ficheiro

| Ficheiro | Alteração |
| --- | --- |
| [ALTERACOES.md](ALTERACOES.md) | Relatório desta entrega, alterações por ficheiro, números e pendências. |
| [BILLING.md](BILLING.md) | Oferta completa, email para tentativas grátis e registo independente dos dois consentimentos; preços/regras Stripe preservados. |
| [CONTENT.md](CONTENT.md) | Proveniência, rascunhos, variantes, limites editoriais e manual apenas externo. |
| [DEPLOY.md](DEPLOY.md) | Versão 0.5.0, validação do CSV, migrações, Google/email e publicação no serviço existente. |
| [ENVIRONMENT.md](ENVIRONMENT.md) | GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET, redirecionamento e domínios necessários. |
| [README.md](README.md) | Oferta, fluxo editorial, testes do tema, domínio de factos, email e configuração Google Cloud. |
| [package.json](package.json) | Versão 0.5.0, mantendo dependências e comandos existentes. |
| [package-lock.json](package-lock.json) | Versão sincronizada, sem novos pacotes. |
| [content/questions.csv](content/questions.csv) | Mestre UTF-8/semicolon: 103 aprovadas migradas, 150 factos CCSE/300 variantes e 45 questões DELE em rascunho. |
| [content/README.md](content/README.md) | Guia de edição/aprovação, colunas, exceção V/F, contagens por categoria e compatibilidade do histórico. |
| [scripts/import-questions.js](scripts/import-questions.js) | Validação com erros por linha e importação atómica para DATA_DIR, incluindo --check sem escrita. |
| [scripts/export-drafts.js](scripts/export-drafts.js) | Exportação dos rascunhos para revisão; protege o ficheiro de entrada de sobrescrita direta. |
| [server/question-bank.js](server/question-bank.js) | Parser/validador CSV, estados editoriais, importação/sincronização e estabilidade dos IDs. |
| [server/facts.js](server/facts.js) | Evidência por facto, seleção de variante diferente, domínio e migração dos agendamentos antigos. |
| [server/quizzes.js](server/quizzes.js) | Apresentações baralhadas guardadas no servidor, teste do tema, simulador só exame e bloqueio por email. |
| [server/google.js](server/google.js) | OAuth/OIDC servidor com PKCE, state, nonce, assinatura/audiência, ligação por email e sessões. |
| [server/accounts.js](server/accounts.js) | Estado/falhas de email sem links/tokens, espera de reenvio, objetivo inicial e integração com Google. |
| [server/app.js](server/app.js) | Banco e rotas novos, metadados de email, progresso/export por facto e versão de saúde 0.5.0. |
| [server/billing.js](server/billing.js) | Duas aceitações persistidas com tipo, versão e data; mantém os registos anteriores. |
| [server/content.js](server/content.js) | As perguntas passam a ser lidas do CSV; preserva aulas e tarefas. |
| [server/curriculum.js](server/curriculum.js) | Retirada a definição em código das perguntas migradas; restantes aulas/tarefas preservadas. |
| [server/learning.js](server/learning.js) | Revisão por facto, cinco categorias CCSE, objetivo inicial e conclusão do passo do manual. |
| [src/Access.jsx](src/Access.jsx) | Ecrãs bloqueados comunicam toda a oferta grátis. |
| [src/App.jsx](src/App.jsx) | Opções de autenticação, Google, objetivo inicial, recuperação com reenvio e aviso de verificação. |
| [src/EmailNotice.jsx](src/EmailNotice.jsx) | Avisos de envio/falha, verificação e contagem de 60 segundos para reenviar. |
| [src/StudyJourney.jsx](src/StudyJourney.jsx) | Passo externo do manual e mapa de factos dominados por categoria. |
| [src/config/exam-requirements.js](src/config/exam-requirements.js) | Lista única de países, resposta local protegida por try/catch e URL/ano do manual. |
| [src/Welcome.jsx](src/Welcome.jsx) | Quatro pontos grátis com ícones, três respostas sobre nacionalidade e destaque do plano recomendado. |
| [src/Plans.jsx](src/Plans.jsx) | Duas caixas independentes, ligações legais e aviso de email; valores e quotas inalterados. |
| [src/Settings.jsx](src/Settings.jsx) | Componente de verificação com estado do envio e reenvio. |
| [src/Quiz.jsx](src/Quiz.jsx) | Feedback por resposta no tema e ligações factuais após a correção. |
| [src/Learning.jsx](src/Learning.jsx) | Mapa de factos, fontes na revisão e passo do manual no plano CCSE. |
| [src/pages.jsx](src/pages.jsx) | Teste do tema no fim da aula substitui as antigas perguntas inline; passo do manual no percurso CCSE. |
| [src/i18n-commerce.js](src/i18n-commerce.js) | Oferta completa em sete línguas. |
| [src/i18n-next.js](src/i18n-next.js) | Textos novos nas sete línguas: recomendação, factos, Google, email, manual e consentimentos. |
| [src/styles.css](src/styles.css) | Lista grátis, recomendação, email, duas caixas, feedback, manual e mapa; mantém o estilo e RTL. |
| [tests/facts.test.js](tests/facts.test.js) | CSV e CLI válidos/inválidos, estados, snapshots, variantes, domínio, migração, email e objetivo inicial. |
| [tests/google.test.js](tests/google.test.js) | Fluxo simulado assinado, PKCE, ligação existente, conta nova, sessões e rejeições de tokens/state. |
| [tests/journey.spec.js](tests/journey.spec.js) | Recomendação nas três respostas, sete línguas, armazenamento indisponível, tema, reenvio, consentimentos, manual e Google. |
| [tests/api.test.js](tests/api.test.js) | Correção por conteúdo da opção para suportar baralhamento sem presumir índices fixos. |
| [tests/billing.test.js](tests/billing.test.js) | Recusa de consentimento parcial e prova de duas versões/datas guardadas. |
| [tests/browser.spec.js](tests/browser.spec.js) | Nova categoria de direitos/deveres e percurso da aula com teste de tema. |
| [tests/commercial.spec.js](tests/commercial.spec.js) | Verifica as duas caixas independentes do checkout. |
| [tests/commercial.test.js](tests/commercial.test.js) | Oferta grátis passa a testar verificação de email antes da única tentativa. |

## Novas variáveis

| Variável | Descrição |
| --- | --- |
| `GOOGLE_CLIENT_ID` | Identificador do cliente OAuth **Web application** criado na Google Cloud |
| `GOOGLE_CLIENT_SECRET` | Segredo desse cliente, apenas no servidor |

Usam a variável existente `APP_URL`; URI de redirecionamento exata: `APP_URL` + `/api/auth/google/callback`. Os passos estão no README. Sem configuração completa, o botão não aparece. Não são necessárias credenciais reais para os testes. `EMAIL_PROVIDER`, `EMAIL_API_KEY`, `EMAIL_FROM` e restantes variáveis anteriores mantêm a finalidade; não houve alteração de valores neste ambiente ou no Render.

## Pendências e decisões editoriais

1. **Rever/aprovar os rascunhos:** confirmar fontes, factos, alternativas e ligações a aulas; preencher reviewed_at. Nada novo é publicado automaticamente. Nove aulas DELE (`d5`, `d17`–`d24`) ainda não têm cinco questões aprovadas: mostram o aviso de conteúdo insuficiente, até aprovar as 45 perguntas adicionais já preparadas. Portanto, a cobertura ativa de testes em todas as 48 aulas depende dessa aprovação editorial.
2. **Domínio dos factos legados:** cada um dos 103 tem uma variante aprovada, como solicitado. Repetir a mesma não dá domínio; será preciso criar/aprovar uma segunda variante desse mesmo facto. A revisão troca de variante apenas quando outra aprovada existe.
3. **Google:** criar cliente, configurar as duas variáveis e APP_URL no Render, testar o login real. A recomendação guarda só a resposta no navegador; o registo recebe apenas a preferência de objetivo, sem nacionalidade. Confirmar requisitos/dispensas individuais nas fontes oficiais.
4. **Email:** configurar/testar Resend ou Postmark e remetente. A verificação é necessária para os simulados grátis. Sem serviço, a produção guarda a falha sem links/tokens e oferece reenvio; a avaliação e as quatro aulas continuam acessíveis.
5. **Jurista:** rever os dois textos de consentimento e a privacidade incluindo Google. Ambos continuam provisórios e marcados para revisão. Os antigos consentimentos únicos não foram transformados retroativamente em duas aceitações.
6. **Ligações oficiais:** confirmar o URL configurado do PDF 2026 no Instituto Cervantes e a atualidade das fontes factuais; a rede bloqueou a verificação. O manual é apenas uma ligação externa, sem incorporação ou resumo.
7. **Publicação:** o código é enviado à main; no Render confirmar o novo commit Live ou usar `rumbo-demo → Manual Deploy → Deploy latest commit`. `/api/health` deve indicar 0.5.0. A consulta pública foi bloqueada pelo proxy, pelo que não há confirmação externa do deploy. O alojamento gratuito continua temporário; antes de pagamentos reais mantém-se o requisito de armazenamento persistente pago, sem contratação nesta entrega.
