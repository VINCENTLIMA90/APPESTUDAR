# Subscrições mensais

## Oferta preparada

| Plano | Preço mensal | Aulas incluídas |
| --- | ---: | --- |
| CCSE | 15 € | 24 de CCSE |
| DELE A2 | 15 € | 24 de DELE A2 |
| CCSE + DELE A2 | 20 € | 48, dos dois módulos |

As aulas `c1`, `c2`, `d1` e `d2` são gratuitas. Não é necessário cartão para as ler. Guardar conclusões requer conta. As restantes aulas só são entregues pela API quando a conta tem acesso válido ao respetivo módulo. O catálogo público contém apenas metadados; não inclui texto, atividades ou respostas das aulas. Os testes, a avaliação inicial e as restantes ferramentas de prática existentes mantêm o seu acesso atual. Os créditos da API de IA são pagos separadamente ao fornecedor do utilizador.

## Estado atual

A integração está implementada e testada com respostas simuladas. **Não existe uma conta Stripe ligada, nem preços criados num fornecedor, nem cobranças reais ativadas.** A página apresenta os preços e «Disponível em breve». Os quatro conteúdos gratuitos funcionam sem Stripe.

O serviço gratuito atual do Render usa `/tmp/rumbo-demo-data`. As subscrições não podem depender desse armazenamento: um reinício pode eliminar a ligação entre o pagamento e a conta. Não foi alterado nem contratado um plano pago de alojamento. É necessário escolher e validar armazenamento permanente e cópias de segurança antes de ativar pagamentos. `DATA_PERSISTENT=true` é uma declaração de configuração, não cria armazenamento.

## Preparação no Stripe

1. Criar a conta Stripe e começar no **modo de teste**. Concluir os dados da empresa e a ativação comercial antes de usar pagamentos reais.
2. Criar três produtos com um preço fixo recorrente mensal em EUR: 1500 cêntimos para CCSE, 1500 para DELE A2 e 2000 para ambos, quantidade 1. Guardar os três identificadores `price_…`. Não configurar uma taxa de adesão nem um período experimental: a oferta gratuita são as duas aulas de cada módulo.
3. Ativar o Customer Portal para consultar faturas, atualizar o meio de pagamento e cancelar no fim do período pago. Para esta primeira ativação, manter desativada a mudança de produto no Portal; os fluxos de upgrade, prorrateio e cobrança de diferenças precisam de validação específica antes de serem disponibilizados.
4. Criar um endpoint de webhook HTTPS `https://<domínio-da-app>/api/billing/webhook`, com `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated` e `customer.subscription.deleted`.
5. Rever a apresentação fiscal, faturação, termos e política de cancelamento na conta comercial. Os valores da tabela são os valores fixos verificados pelo servidor; esta implementação não calcula impostos adicionais, descontos nem taxas de adesão. Não ativar opções no Stripe que alterem esses montantes sem adaptar e testar a integração.

## Variáveis do servidor

Configurar estas variáveis no **serviço da aplicação no Render**, sem as colocar no Git ou no chat. A configuração do ambiente Codex é independente da configuração do Render. Os testes locais não precisam de credenciais.

| Nome | Valor ou finalidade |
| --- | --- |
| `APP_URL` | URL HTTPS pública, por exemplo `https://rumbo-demo.onrender.com` |
| `DATA_DIR` | Caminho no volume permanente escolhido |
| `DATA_PERSISTENT` | `true` apenas após validar a persistência real e cópias de segurança |
| `STRIPE_SECRET_KEY` | Chave secreta do modo de teste, depois a chave de produção |
| `STRIPE_WEBHOOK_SECRET` | Segredo de assinatura do webhook desse modo e endpoint |
| `STRIPE_PRICE_CCSE` | Identificador do preço mensal CCSE de 15 € |
| `STRIPE_PRICE_DELE` | Identificador do preço mensal DELE A2 de 15 € |
| `STRIPE_PRICE_BOTH` | Identificador do preço mensal conjunto de 20 € |
| `BILLING_ENABLED` | `true` para disponibilizar o Checkout, depois de todas as outras condições |

Não usar variáveis `VITE_` para segredos: seriam incluídas no navegador. A saída do servidor precisa de acesso HTTPS a `api.stripe.com`. O utilizador é encaminhado para `checkout.stripe.com` e `billing.stripe.com`; os dados do cartão são introduzidos nessas páginas.

## Verificações antes da ativação real

No modo de teste, verificar cada plano: conta nova → Checkout → confirmação do webhook → acesso às aulas corretas → renovação → cancelamento no fim do período → expiração. Confirmar que um utilizador CCSE não recebe aulas DELE. Testar também falha de pagamento, recarregar durante o Checkout, trocar de plano antes de pagar e repetição de notificações. Não deduzir sucesso pelo endereço `?billing=success`; esse endereço não concede direitos.

Reiniciar e voltar a publicar o serviço de teste, confirmando que conta, ligação Stripe e direitos são preservados. Testar a recuperação de uma cópia de segurança. Depois configurar os produtos, preços, chaves e webhook no modo real, sem misturar identificadores de teste e produção. Fazer uma verificação real controlada com acesso à conta Stripe e verificar a faturação.

## Comportamento da integração

- O servidor escolhe os preços fixos; ignora montantes e URLs enviados pelo navegador. Confere moeda, periodicidade e valor no fornecedor antes do Checkout.
- Mantém um Checkout pendente por conta. Repete o mesmo link para o mesmo plano e expira o anterior se o plano mudar. Impede uma nova compra quando o fornecedor já tem uma subscrição em curso.
- Confere a assinatura HMAC do corpo original do webhook, aceita uma margem de cinco minutos, regista eventos processados e consulta o estado atual da subscrição no Stripe. Falhas devolvem erro para permitir nova tentativa do fornecedor.
- O acesso depende do plano, do estado e do fim do período pago guardados no servidor. Cancelar a renovação mantém o acesso até esse fim. Um estado de pagamento em atraso, cancelamento imediato ou expiração retira o acesso pago. Uma mudança de preço ou quantidade incompatível não concede acesso.
- Eliminar uma conta tenta primeiro cancelar subscrições e expirar o Checkout pendente no fornecedor. Se a confirmação falhar, mantém a conta e apresenta uma mensagem para evitar cobranças sem acesso à gestão. Os registos financeiros do fornecedor seguem as regras de retenção desse fornecedor; não se apagam automaticamente com o histórico de estudo.
- Mantém um único processo/instância com SQLite no mesmo volume. Escalar para várias instâncias exige outro desenho de persistência e de coordenação.

A suite automatizada cobre estas regras com um fornecedor simulado. Não foi executada uma compra, renovação nem cancelamento real no Stripe.
