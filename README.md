# Rumbo

Webapp de preparação para os exames CCSE e DELE A2, com uma interface adaptada a computador e telemóvel. Esta é uma primeira versão funcional para uso pessoal; não é um produto do Instituto Cervantes.

## Executar

Requer Node.js 24 ou superior e npm. Não requer uma base de dados externa nem credenciais para os fluxos de estudo.

```sh
cd /workspace/APPESTUDAR
npm ci --no-audit --no-fund
npm run dev
```

O Vite usa a porta 5173 e encaminha `/api` para o servidor na porta 3001. A app tem de ser aberta por um endereço HTTPS, ou localhost para desenvolvimento, para gravar áudio. O ambiente de onboarding não suporta links de pré-visualização locais; estas portas servem para execução e validação internas.

Para servir a compilação, com interface e API no mesmo processo:

```sh
npm run build
npm start
```

`PORT` e `HOST` configuram a escuta do servidor (por omissão, 3001 e 0.0.0.0). `DATA_DIR` permite escolher um diretório persistente para a base de dados; por omissão, é `.data/` no repositório. Nunca publicar esta pasta nem copiá-la para um repositório Git.

## O que está implementado

- Dois módulos: CCSE e DELE A2, com oito aulas e 67 perguntas originais de prática em espanhol.
- Interface em PT-PT, PT-BR, inglês, francês, árabe (RTL), alemão e espanhol. Os conteúdos pedagógicos estão em espanhol, a língua dos exames; as explicações de correção da IA seguem o idioma da conta.
- Registo e início de sessão com palavras-passe protegidas por scrypt, cookies HttpOnly e sessões no servidor. Não há contas ou palavras-passe predefinidas.
- Progresso por utilizador, aulas concluídas, resultados, dias de atividade, histórico e revisão dos erros até serem respondidos corretamente.
- Avaliação inicial em três etapas: 12 perguntas objetivas (leitura, áudio e conhecimentos cívicos), escrita e expressão oral. Não atribui um nível MCER certificado nem uma classificação oficial DELE.
- Prática CCSE e simulado de 25 perguntas em 45 minutos com exercícios próprios, distribuídos por cinco tarefas (10 + 3 + 2 + 3 + 7), incluindo três perguntas de verdadeiro/falso. Não inclui o banco oficial completo.
- Prática DELE reduzida de leitura e áudio, além de escrita e oralidade em separado. O teste reduzido de 16 perguntas/35 minutos **não reproduz o exame oficial completo**.
- Áudio de compreensão gerado pela síntese de voz do navegador, com transcrição acessível. Depende de uma voz espanhola disponível no dispositivo; se a síntese não funcionar, aparece a transcrição. Não se trata dos áudios oficiais.
- Gravação de resposta oral até dois minutos, reprodução, armazenamento e consulta posterior. Microfone real depende do dispositivo e da autorização do utilizador.
- Respostas modelo e grelhas de autoavaliação, separadas dos resultados objetivos e dos comentários da IA.
- Exportação dos dados e eliminação de conta, resultados e gravações.

## Correção por IA: API pessoal

Nas Definições, o utilizador escolhe OpenAI, Claude ou Gemini e introduz a sua própria chave de API. A subscrição do ChatGPT, Claude ou Gemini não equivale a acesso à API; esta versão não implementa login OAuth com esses serviços. A chave permanece apenas na memória do cliente durante a sessão, passa pelo servidor para a chamada e não é gravada em SQLite, localStorage, cookies ou logs.

A correção é sempre solicitada explicitamente, com consentimento para enviar a resposta/gravação ao fornecedor e consumir créditos da API. A resposta do fornecedor fica guardada no histórico. Os modelos configurados são `gpt-4.1-mini`, `claude-sonnet-4-6` e `gemini-2.5-flash`; o acesso depende da conta de cada fornecedor.

- OpenAI: escrita; transcrição da gravação com `gpt-4o-mini-transcribe`, seguida de comentários sobre o texto. Não avalia a pronúncia a partir da transcrição.
- Claude: escrita e comentários sobre uma transcrição introduzida pelo utilizador. Não aceita o ficheiro áudio neste fluxo.
- Gemini: escrita ou gravação enviada como áudio. Comentários orientativos, sem pontuação normalizada de pronúncia.

Os testes da integração usam respostas simuladas e verificam os protocolos dos três fornecedores. Não foi executada uma correção real com uma chave paga; a qualidade e o acesso aos modelos ainda precisam dessa validação.

## Materiais oficiais e atualização

Fontes usadas:

- [CCSE: preparar a prova](https://examenes.cervantes.es/es/ccse/preparar-prueba)
- [CCSE: informação](https://examenes.cervantes.es/es/ccse/que-es)
- [CCSE: estrutura da prova](https://examenes.cervantes.es/es/ccse/como)
- [DELE: preparar a prova](https://examenes.cervantes.es/es/dele/preparar-prueba)
- [DELE A2: estrutura e documentos](https://examenes.cervantes.es/es/dele/examenes/a2)

O servidor consulta as três fontes de materiais ao arrancar e a cada 24 horas enquanto está ativo. Extrai links de documentos do domínio oficial, filtra os materiais DELE para A2, guarda a última consulta bem-sucedida e atualiza automaticamente a lista de downloads. Uma alteração nos links sinaliza revisão necessária. Falhas ficam visíveis, preservando os últimos dados válidos. A verificação manual tem um intervalo mínimo de uma hora para evitar consultas excessivas.

Esta monitorização não constitui uma atualização automática do banco de perguntas nem valida que um PDF novo se aplica a determinada data de exame. Uma alteração no conteúdo de um PDF que mantenha o mesmo link também não é detetada. Antes de comercializar, a incorporação de materiais oficiais e a revisão das edições terão de ser tratadas como um fluxo editorial, com as respetivas condições de utilização. A app não redistribui PDFs nem questões oficiais; apresenta links e exercícios próprios.

Na configuração atual foi possível consultar as páginas oficiais DELE e a informação geral CCSE. A página CCSE de preparação devolveu uma resposta interrompida; a sua edição atual não foi confirmada. O estado na aplicação reflete a verificação real do servidor, sem marcar a fonte como atualizada quando falha.

O DELE A2 oficial, conforme a página consultada, tem leitura (60 min, 25 itens), compreensão auditiva (40 min, 25 itens), escrita (45 min, 2 tarefas) e oral (12 min, mais 12 min de preparação, 3 tarefas). A prática própria é intencionalmente reduzida e está identificada na interface.

## Testar

```sh
npm test
npm run test:e2e
```

Os testes de API verificam autenticação, isolamento entre utilizadores, correção no servidor, revisão de erros, gravações, feedback, exportação e eliminação. Os testes de fontes usam respostas controladas para verificar alterações e falhas. Os testes de navegador verificam registo, progresso após reload, avaliação inicial, escrita, gravação com microfone simulado, sete idiomas e layout móvel RTL.

O Playwright utiliza `/usr/bin/chromium` se existir; `CHROMIUM_PATH` permite outra instalação. Caso contrário, requer uma instalação de Chromium compatível com o Playwright. Os testes usam a porta 4173 e uma base SQLite separada em `/tmp/rumbo-e2e`, sem alterar os dados da aplicação. Os testes do microfone usam um dispositivo simulado e não comprovam a qualidade de gravação no telemóvel do utilizador.

## Dados e publicação futura

SQLite guarda as contas, sessões, respostas e gravações. Deve existir um volume persistente com cópias de segurança para manter os dados entre substituições do servidor. A sincronização entre dispositivos funciona quando ambos acedem à mesma instância da webapp.

Para uma distribuição pública será necessário disponibilizar um domínio com HTTPS, executar com `NODE_ENV=production` (cookies Secure) atrás de um proxy que preserve o host e implementar recuperação/verificação de email e faturação. Esta versão não envia emails, não cobra subscrições e não foi publicada num serviço externo.

Destinos de rede necessários: `registry.npmjs.org` para instalar, `examenes.cervantes.es` para fontes, `api.openai.com`, `api.anthropic.com` e `generativelanguage.googleapis.com` para IA. As fontes tipográficas são servidas localmente. As chaves pessoais são configuradas na aplicação, nunca no código nem no chat.
