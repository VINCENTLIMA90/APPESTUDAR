# Entrega 0.4.0 — acesso, IA, conta e apresentação

## Resultado e validação

- Subscrição desbloqueia todas as ferramentas do módulo. Quatro aulas, avaliação completa e uma tentativa de simulado por módulo são gratuitas com conta. A API aplica os bloqueios.
- IA exclusivamente no servidor com consentimento, saldo e quotas por ciclo; ausência de configuração apresentada como indisponibilidade temporária.
- Sessões limitadas, recuperação de palavra-passe, verificação de email, preços e consentimento de checkout implementados.
- Visitantes sem barra lateral; sete línguas e RTL; MP3 preparados com transcrição de recurso; três páginas legais provisórias.
- `npm test`: **44 testes aprovados**, incluindo preservação de dados numa base antiga após dois arranques.
- `npm run test:e2e`: **17 testes aprovados**, incluindo compilação de produção, 375 px, contraste e árabe.
- Todas as entradas dos ficheiros i18n complementares têm sete traduções. Inspeção visual da apresentação móvel PT-PT e árabe efetuada.
- Gerador de voz validado apenas com `--dry-run`: plano de 16 ficheiros, sem gerar MP3 nem contactar o serviço.
- Não houve chamadas reais a IA, email, voz ou pagamentos nos testes. O banco de perguntas CCSE e o alojamento não foram alterados.

## Alterações por ficheiro

| Ficheiro | Alteração |
| --- | --- |
| [BILLING.md](BILLING.md) | Modelo de acesso integral, quotas, email verificado, consentimento e preços com IVA. |
| [CONTENT.md](CONTENT.md) | Limitações pedagógicas, áudio MP3 e regras de acesso atualizadas. |
| [DEPLOY.md](DEPLOY.md) | Atualização do serviço existente e requisitos de armazenamento permanente antes de cobrar. |
| [README.md](README.md) | Execução, testes, acesso gratuito/pago, IA, conta, áudio e dependências externas. |
| [ENVIRONMENT.md](ENVIRONMENT.md) | Todas as variáveis de configuração, omissões, segredos e destinos de rede. |
| [package.json](package.json) | Versão 0.4.0. |
| [package-lock.json](package-lock.json) | Versão do pacote sincronizada, sem novas dependências. |
| [server/access.js](server/access.js) | Direitos por módulo, tentativa gratuita única, reservas e quotas de IA por ciclo. |
| [server/accounts.js](server/accounts.js) | Sessões limitadas, tokens por hash, recuperação/verificação e email Resend/Postmark. |
| [server/ai.js](server/ai.js) | Configuração de modelos no servidor; removidos os modelos predefinidos. |
| [server/app.js](server/app.js) | Integração de conta/acesso, bloqueios 402, consentimento e correções com contagem atómica. |
| [server/billing.js](server/billing.js) | Migração de período, IVA incluído, verificação de email e registo do consentimento. |
| [server/content.js](server/content.js) | Texto da aula auditiva DELE alinhado com os MP3 e transcrição de recurso. |
| [server/curriculum.js](server/curriculum.js) | Descrição de áudio DELE atualizada. |
| [server/expanded-curriculum.js](server/expanded-curriculum.js) | Descrições de duas atividades auditivas DELE atualizadas. |
| [server/index.js](server/index.js) | Trust proxy 1 e serviço estático dos MP3, com 404 para ficheiros em falta. |
| [server/learning.js](server/learning.js) | Plano e revisão limitados aos módulos ativos. |
| [server/tutor.js](server/tutor.js) | Conversas por módulo, IA do servidor, consentimento e consumo atómico de quota. |
| [scripts/generate-audio.js](scripts/generate-audio.js) | Gerador Azure Speech com vozes de Espanha/América Latina e modo --dry-run. |
| [public/audio/.gitkeep](public/audio/.gitkeep) | Diretório reservado aos MP3; nenhum áudio real gerado nesta entrega. |
| [src/Access.jsx](src/Access.jsx) | Componentes de cadeado, ligação aos planos, saldo de IA e renovação. |
| [src/AudioPractice.jsx](src/AudioPractice.jsx) | Leitor MP3 com transcrição se o ficheiro faltar. |
| [src/Legal.jsx](src/Legal.jsx) | Três páginas legais provisórias, ligações e confirmação de tokens de conta. |
| [src/App.jsx](src/App.jsx) | Cabeçalho para visitantes, acessos, recuperação, páginas legais e aviso de sessão substituída. |
| [src/Learning.jsx](src/Learning.jsx) | Plano e contagem do exame respeitam os direitos atuais. |
| [src/Plans.jsx](src/Plans.jsx) | Benefícios, IVA, cancelamento, poupança e caixa obrigatória antes do checkout. |
| [src/Quiz.jsx](src/Quiz.jsx) | MP3 em exercícios, tempo desde o início no servidor e continuação da avaliação gratuita. |
| [src/Settings.jsx](src/Settings.jsx) | Removida a configuração de chaves; saldo de IA e verificação de email. |
| [src/SkillPractice.jsx](src/SkillPractice.jsx) | Acesso pago/avaliação gratuita, consentimento por envio, saldo e correções incluídas. |
| [src/Tutor.jsx](src/Tutor.jsx) | Removidas credenciais pessoais; consentimento por envio, saldo e serviço indisponível. |
| [src/Welcome.jsx](src/Welcome.jsx) | Benefícios e preços alinhados com os planos atuais. |
| [src/api.js](src/api.js) | Propaga informação dos erros e notifica substituição de sessão. |
| [src/components.jsx](src/components.jsx) | Rótulo de acesso bloqueado consistente. |
| [src/i18n-commerce.js](src/i18n-commerce.js) | Textos comerciais sem referência à configuração de chaves pessoais. |
| [src/i18n-next.js](src/i18n-next.js) | Novos textos de acesso, quotas, emails, conta, áudio e páginas legais nas sete línguas. |
| [src/i18n.js](src/i18n.js) | Textos de IA/consentimento atualizados e antigas opções de chaves removidas. |
| [src/pages.jsx](src/pages.jsx) | Cadeados visíveis, tentativa única, avaliação e atividades com MP3. |
| [src/styles.css](src/styles.css) | Cabeçalho visitante, responsividade, cadeados, saldo, áudio, consentimento e páginas legais. |
| [tests/helpers.js](tests/helpers.js) | Direitos e fornecedores fictícios usados apenas nos testes, sem endpoint de ativação. |
| [tests/commercial.test.js](tests/commercial.test.js) | Novos testes de planos, quotas, sessões, email, tokens e migrações de dados antigos. |
| [tests/commercial.spec.js](tests/commercial.spec.js) | Novos testes de visitante móvel/RTL, bloqueios, planos e substituição de sessão. |
| [tests/ai.test.js](tests/ai.test.js) | Protocolos dos três fornecedores com modelos fictícios explicitamente configurados. |
| [tests/api.test.js](tests/api.test.js) | Testes adaptados aos direitos de acesso e consentimento. |
| [tests/billing.test.js](tests/billing.test.js) | Fixtures de preço com IVA, email verificado e consentimento no checkout. |
| [tests/browser.spec.js](tests/browser.spec.js) | Percursos com direitos de teste e IA incluída sem introdução de credenciais. |
| [tests/learning.test.js](tests/learning.test.js) | Plano, revisão e tutor com direitos e IA de teste no servidor. |
| [tests/ux.spec.js](tests/ux.spec.js) | Mantidos os testes de contraste, línguas, totais, 375 px e data do exame com acesso válido. |
| [ALTERACOES.md](ALTERACOES.md) | Relatório desta entrega, ficheiro a ficheiro, verificações e pendências. |

## Variáveis de ambiente

A lista completa, com descrição e omissão, está em [ENVIRONMENT.md](ENVIRONMENT.md). Novas configurações:

- `AI_PROVIDER`, `AI_API_KEY`, `AI_MODEL`, `AI_TRANSCRIBE_MODEL`: fornecedor, segredo, modelo de correção/tutor e modelo de transcrição.
- `AI_CCSE_CORRECTIONS_LIMIT` / `AI_CCSE_TUTOR_LIMIT`: 0 / 50 por ciclo.
- `AI_DELE_CORRECTIONS_LIMIT` / `AI_DELE_TUTOR_LIMIT`: 30 / 300 por ciclo.
- `AI_BOTH_CORRECTIONS_LIMIT` / `AI_BOTH_TUTOR_LIMIT`: 30 / 300 por ciclo.
- `MAX_SESSIONS_PER_USER`: sessões simultâneas, 1 por omissão.
- `EMAIL_PROVIDER`, `EMAIL_API_KEY`, `EMAIL_FROM`: serviço Resend/Postmark, segredo e remetente autorizado. Usam também a variável existente `APP_URL`.
- `TTS_PROVIDER`, `TTS_API_KEY`, `TTS_REGION`, `TTS_VOICES`: serviço Azure, segredo, região e lista de vozes; utilizadas pelo script de geração.

Nenhum segredo pertence ao navegador ou a variáveis `VITE_`. Não foram configuradas chaves reais nesta entrega.

## O que depende do responsável pela aplicação

1. **Publicação no Render:** se o auto-deploy não publicar, abrir `rumbo-demo → Manual Deploy → Deploy latest commit`. Confirmar estado Live e versão 0.4.0 em `/api/health`. A consulta ao serviço público foi bloqueada pelo proxy deste ambiente (CONNECT 403), pelo que não foi possível confirmar o deploy externo.
2. **Armazenamento:** escolher e configurar posteriormente disco persistente pago no Render, cópias de segurança e recuperação **antes de ativar pagamentos**. `render.yaml`, `DATA_DIR` e `DATA_PERSISTENT` ficaram como estavam. A demonstração continua sujeita a perda de dados em reinícios/publicações.
3. **Stripe:** criar conta e preços mensais com IVA incluído, configurar webhook e validar em modo de teste antes da ativação. Cobrança real permanece desativada.
4. **Email:** criar conta Resend/Postmark, validar remetente/domínio e configurar variáveis. Sem serviço, a produção não envia mensagens nem escreve links de recuperação/verificação nos logs.
5. **IA:** escolher fornecedor/modelos, configurar a chave no servidor e validar qualidade, disponibilidade e custos reais.
6. **Áudio:** configurar Azure Speech, gerar/rever os 16 MP3 e incluí-los na publicação. Até lá, os exercícios mostram a transcrição quando o MP3 falta.
7. **Jurista:** rever e finalizar termos, privacidade, cancelamento/desistência e consentimento de acesso imediato. Os textos estão marcados para revisão. A utilização do banco oficial CCSE continua pendente de decisão jurídica.

O código por email para novo dispositivo não foi implementado, conforme pedido. Foram preparados o campo de dispositivo e tokens com finalidade para essa evolução.
