# Conteúdo, versões e limites das avaliações

## Atualização de 15 de outubro de 2026

- 16 aulas próprias (oito CCSE, oito DELE A2), com fontes de referência e data de revisão na interface. 103 perguntas próprias de prática, com explicações e revisão dos erros. Não são o banco oficial CCSE completo.
- 30 cartões de vocabulário com definição e exemplo em espanhol. A classificação de dificuldade agenda a próxima revisão; não é uma nota de exame.
- Tarefas alternativas de escrita e oralidade, respostas modelo e autoavaliação.
- Percurso DELE com 25 itens de leitura (60 min), 25 de audição (40 min), duas tarefas escritas (45 min), preparação oral (12 min) e três tarefas orais (12 min). A oralidade requer um interlocutor para ensaiar uma interação real; uma gravação individual não substitui um examinador.

## Materiais consultados

As páginas oficiais [DELE A2](https://examenes.cervantes.es/es/dele/examenes/a2) e [Preparar a prova](https://examenes.cervantes.es/es/dele/preparar-prueba) apresentam as tarefas de leitura e audição de fevereiro de 2020 e os documentos orais de 2022 aqui ligados. O percurso é guiado: os documentos, fotografias e áudios são abertos diretamente no Instituto Cervantes; a app regista respostas e resultados. Os ficheiros PDF e MP3 oficiais não são redistribuídos no repositório.

As duas claves de respostas foram descarregadas e consultadas em 15/10/2026. As respostas de cada uma das 25 posições foram conferidas. Os SHA-256 dos ficheiros consultados constam de `server/exam.js`. O servidor verifica novamente estes ficheiros no arranque e na verificação diária das fontes. Se uma clave mudar, suspende a correção desse modelo até revisão. Uma falha de rede não é tratada como mudança de conteúdo; o estado de verificação fica visível e mantém-se a referência datada. O utilizador pode consultar as claves nas fontes oficiais.

Os tempos, quantidades e extensões da escrita (60–70 palavras na tarefa 1 e 70–80 na tarefa 2) foram conferidos na guia oficial A2. A prática rápida de 16 perguntas continua disponível em separado e usa voz sintética identificada; o percurso completo usa os quatro áudios naturais do modelo oficial.

Para o CCSE, foram consultadas as páginas oficiais de informação e estrutura. A página de preparação refere o manual 2026 e os áudios 2026, mas a resposta de rede dessa página permaneceu interrompida e o manual integral não foi obtido. Não se declara o banco completo CCSE importado nem a edição do manual validada integralmente. Os exercícios próprios evitam questões sobre titulares de cargos ou outros dados que não tenham sido confirmados. O simulado mantém 25 perguntas em cinco tarefas (10 + 3 + 2 + 3 + 7), incluindo três itens de verdadeiro/falso.

## Plano sugerido

O plano usa o desempenho inicial, até 50 respostas objetivas recentes por módulo, os critérios de autoavaliação de escrita/oralidade e a frequência semanal escolhida. A estimativa é uma heurística de organização de estudo, não um modelo validado de previsão de aprovação nem uma classificação MCER. A interface distingue a previsão provisória quando falta avaliação e remete para os calendários oficiais; não inventa convocatórias nem reserva exames.

Na versão `heuristic-v1`, a carga de referência é de 6–24 horas para CCSE e de 12–76 horas para DELE, variando com as evidências disponíveis. A janela divide as horas pela disponibilidade semanal e acrescenta uma margem de 35%. As horas são uma hipótese ajustável para organizar a prática, não uma promessa de que esse tempo basta. O plano recalcula a partir do momento da consulta, porque não existe medição validada de horas efetivamente estudadas. No mapa de competências, escrita e oralidade apresentam evidência qualitativa e não uma percentagem de proficiência inventada.

## Tutor e IA

O tutor oferece conversa, explicação de erros e exercícios dirigidos. Usa erros recentes e os últimos comentários de escrita/oralidade como contexto. Mantém as conversas na conta, recebe a chave de API apenas na chamada e exige consentimento explícito antes de consumir créditos. As correções de respostas podem incluir exercícios sobre erros encontrados.

Os testes de IA e tutor usam fornecedores simulados. Não comprovam qualidade pedagógica, disponibilidade dos modelos ou custos de uma chamada real. A correção real continua dependente da chave pessoal, do saldo e do acesso aos modelos do fornecedor.

## Dados

As alterações ao esquema SQLite são aditivas e preservam contas e histórico existentes na mesma base de dados. O alojamento gratuito no Render continua com disco temporário, conforme solicitado. Uma nova publicação ou reinício pode perder os dados no serviço externo. Não foi contratado nem configurado armazenamento permanente.
