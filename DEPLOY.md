# Ver a Rumbo online

O ambiente de configuração do Codex executa a aplicação, mas não fornece um endereço público para a abrir no navegador. Publicar este ambiente nas configurações guarda o ambiente de desenvolvimento; não publica a webapp na Internet.

## Demonstração gratuita no Render

O ficheiro `render.yaml` prepara uma webapp Node no plano gratuito, sem chaves de IA predefinidas. Não cria nem cobra um serviço por si só.

1. Colocar os ficheiros deste projeto no repositório GitHub `VINCENTLIMA90/APPESTUDAR`, numa branch com commits.
2. Entrar no Render e ligar a conta GitHub, dando acesso a este repositório.
3. Criar um **Blueprint** a partir do repositório. Rever a configuração `rumbo-demo` e confirmar o plano gratuito antes de criar o serviço.
4. Esperar que o build e o health check terminem. O Render apresenta o endereço público atribuído ao serviço; só esse endereço deve ser partilhado.
5. Abrir a app, criar uma conta de demonstração e concluir uma aula para verificar o funcionamento online. A IA requer um plano válido e as variáveis AI_* no servidor; não há chaves na interface. Sem configuração, fica temporariamente indisponível.

**Dados da demonstração:** o plano gratuito não tem disco persistente. As contas, gravações e o progresso podem perder-se quando o serviço reinicia ou é publicado novamente. O serviço também pode suspender por inatividade e demorar a abrir. Usar dados de demonstração e exportar qualquer progresso que se pretenda conservar.

## Atualizar o serviço existente

Depois do commit estar em `main`, o Render pode publicar automaticamente se o auto-deploy estiver ativo. Caso a app continue igual, abrir o **web service `rumbo-demo` → Manual Deploy → Deploy latest commit**. A sincronização do Blueprint configura recursos; não confirma a compilação/publicação da aplicação.

Confirmar que o deploy do commit pretendido termina em **Live**. A versão desta entrega é `0.5.0`, visível em `/api/health`. Depois atualizar a página. Esta verificação distingue uma publicação antiga de um problema de cache. Exportar previamente qualquer progresso da demonstração que seja necessário conservar.

## Uso pessoal contínuo ou distribuição

Para manter contas e progresso, escolher um alojamento com armazenamento persistente e apontar `DATA_DIR` para esse volume. No Render, um disco persistente requer um plano pago; escolher e confirmar o plano na conta de alojamento. Não existe contratação automática configurada neste projeto.

O servidor necessita de Node.js 24.19 ou posterior, HTTPS na entrada e acesso de saída aos domínios oficiais e fornecedores de IA descritos no README. O proxy deve preservar o host público. `NODE_ENV=production` ativa cookies Secure. O endpoint `/api/health` é usado para confirmar o arranque.

Esta versão inclui recuperação de palavra-passe e verificação de email, dependentes de Resend/Postmark e das variáveis EMAIL_* e APP_URL. Sem configuração, não envia emails em produção nem regista links nos logs. Inclui três planos mensais e integração Stripe preparada, com cobrança desativada por omissão. A ativação depende de uma conta Stripe e armazenamento permanente; consultar [BILLING.md](BILLING.md). Não ativar pagamentos sobre o diretório temporário da demonstração.

## Requisitos antes de cobrar

É **obrigatório um disco persistente, que requer um plano pago do Render**, antes de ativar pagamentos neste alojamento. Manter DATA_DIR e DATA_PERSISTENT atuais até essa decisão: esta implementação não contrata nem altera planos. Validar contas, quotas de IA, tentativas gratuitas, subscrições e cópias de segurança após reinício e nova publicação.

Configurar e testar email, verificar a conta do comprador, configurar preços Stripe com IVA incluído e obter revisão jurídica dos textos e do consentimento de início imediato. Os ficheiros MP3 ainda não foram gerados com um serviço real; o fallback é a transcrição. Consultar [ENVIRONMENT.md](ENVIRONMENT.md) para todas as variáveis. O Express usa trust proxy=1 atrás do proxy do Render; não expor diretamente essa configuração sem rever a topologia de rede.

## Banco CSV e Google nesta versão

O servidor valida e sincroniza `content/questions.csv` no arranque. Validar previamente com `node scripts/import-questions.js --check`; um CSV inválido não deve ser publicado. SQLite recebe tabelas e colunas novas de forma aditiva; contas, resultados e agendamentos antigos são preservados. Manter a instância única e a cópia de segurança já previstas. Não foi alterado DATA_DIR, DATA_PERSISTENT ou o plano de alojamento.

Email transacional é agora necessário para usar as tentativas gratuitas dos simulados. A avaliação e as quatro aulas gratuitas funcionam sem essa verificação. Falhas de envio são guardadas sem token/link e mostradas na conta; pedidos de recuperação continuam a dar resposta indistinguível.

Google é opcional: configurar GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET e APP_URL conforme README, registando a URI `/api/auth/google/callback`. Autorizar saída para `oauth2.googleapis.com` e `www.googleapis.com`; o navegador visita `accounts.google.com`. Sem credenciais, o botão fica oculto. A integração real e a entrega de emails precisam de validação na conta externa; nenhum serviço real foi usado nos testes.

Os 150 factos CCSE e as 45 questões DELE adicionais continuam em rascunho. Não serão publicados pelo deploy. Aprovar conteúdo exige revisão editorial, fonte e reviewed_at no CSV. Os textos de checkout e privacidade continuam pendentes de jurista. Confirmar o endereço do PDF do manual no site oficial; não houve extração do manual.
