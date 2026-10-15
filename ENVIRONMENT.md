# Variáveis de ambiente

Configurar segredos apenas no servidor/alojamento ou num ficheiro local ignorado pelo Git. Nunca usar variáveis `VITE_` para credenciais. Nenhum dos serviços externos precisa de chaves reais para os testes automatizados.

## Servidor e armazenamento

| Variável | Descrição / omissão |
| --- | --- |
| `NODE_ENV` | `production` no Render; `development` para permitir links de email apenas nos logs locais |
| `PORT`, `HOST` | Porta e interface: 3001, 0.0.0.0 |
| `DATA_DIR` | Diretório SQLite; configuração atual mantida |
| `DATA_PERSISTENT` | Declaração `true` só depois de validar um disco permanente; não cria disco |
| `APP_URL` | URL canónica HTTPS, sem caminho, query ou fragmento; usada em emails e Stripe |
| `MAX_SESSIONS_PER_USER` | Inteiro positivo, 1 por omissão, máximo 20 |

## IA do servidor

| Variável | Descrição / omissão |
| --- | --- |
| `AI_PROVIDER` | `openai`, `anthropic` ou `gemini`; sem valor por omissão |
| `AI_API_KEY` | Chave secreta do fornecedor; nunca é enviada ao navegador |
| `AI_MODEL` | Identificador do modelo de correção/tutor, explicitamente escolhido pelo administrador |
| `AI_TRANSCRIBE_MODEL` | Modelo de transcrição para áudio OpenAI; necessário para essa modalidade |
| `AI_CCSE_CORRECTIONS_LIMIT` | Correções por ciclo: 0 |
| `AI_CCSE_TUTOR_LIMIT` | Mensagens por ciclo: 50 |
| `AI_DELE_CORRECTIONS_LIMIT` | Correções por ciclo: 30 |
| `AI_DELE_TUTOR_LIMIT` | Mensagens por ciclo: 300 |
| `AI_BOTH_CORRECTIONS_LIMIT` | Correções por ciclo: 30 |
| `AI_BOTH_TUTOR_LIMIT` | Mensagens por ciclo: 300 |

As seis quotas aceitam inteiros não negativos. Alterar a oferta requer rever a apresentação comercial. O saldo usa o período atual da subscrição, não o primeiro dia do mês civil. Para subscrições antigas sem início de período, usa-se uma referência mensal anterior ao fim pago até à próxima sincronização do Stripe.

## Email transacional

| Variável | Descrição |
| --- | --- |
| `EMAIL_PROVIDER` | `resend` ou `postmark` |
| `EMAIL_API_KEY` | Chave secreta do serviço |
| `EMAIL_FROM` | Remetente/domínio autorizado no serviço |

`APP_URL` é obrigatória em produção. É necessário criar a conta externa e validar o domínio/remetente. Os tokens são confirmados por POST, após ação da pessoa, para evitar consumo por pré-visualizações automáticas de emails.

## Geração de áudio (script, não execução automática no servidor)

| Variável | Descrição |
| --- | --- |
| `TTS_PROVIDER` | `azure` |
| `TTS_API_KEY` | Chave secreta de Azure Speech |
| `TTS_REGION` | Região do recurso Speech |
| `TTS_VOICES` | Array JSON de objetos `{locale,name}`: pelo menos uma voz neural `es-ES` e uma de América Latina, como `es-MX` |

Exemplo de vozes sem segredos: `[{"locale":"es-ES","name":"es-ES-ElviraNeural"},{"locale":"es-MX","name":"es-MX-DaliaNeural"}]`. `--dry-run` não usa a rede nem gera MP3. A geração real pode ter custos e é uma ação separada, não executada nesta implementação.

## Stripe (existentes)

| Variável | Descrição |
| --- | --- |
| `BILLING_ENABLED` | `true` apenas após validar todos os requisitos |
| `STRIPE_SECRET_KEY` | Chave secreta, primeiro de teste e depois de produção |
| `STRIPE_WEBHOOK_SECRET` | Segredo de assinatura do endpoint e modo correspondentes |
| `STRIPE_PRICE_CCSE` | Preço mensal EUR de 1500 cêntimos, IVA incluído |
| `STRIPE_PRICE_DELE` | Preço mensal EUR de 1500 cêntimos, IVA incluído |
| `STRIPE_PRICE_BOTH` | Preço mensal EUR de 2000 cêntimos, IVA incluído |

Preços com `tax_behavior=inclusive`, quantidade 1. Não misturar preços de teste com chaves de produção. [BILLING.md](BILLING.md) descreve configuração e verificação.

## Rede

Saída do servidor: `examenes.cervantes.es`, `api.stripe.com`, o fornecedor de IA escolhido (`api.openai.com`, `api.anthropic.com` ou `generativelanguage.googleapis.com`) e de email (`api.resend.com` ou `api.postmarkapp.com`). O script de voz usa `<TTS_REGION>.tts.speech.microsoft.com`. Instalação usa `registry.npmjs.org`. As regras de rede do Codex não configuram automaticamente o Render.
