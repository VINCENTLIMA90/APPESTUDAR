# Banco próprio: edição e revisão

`questions.csv` é o mestre editável em Excel ou Google Sheets: **UTF-8 com BOM, separador ponto e vírgula**. O código do banco não contém os enunciados. O ficheiro contém 298 factos e 448 variantes: 103 aprovadas migradas, 300 variantes CCSE novas e 45 questões DELE novas, estas 345 em rascunho.

Nenhuma pergunta nova foi obtida, adaptada ou reformulada a partir do manual CCSE. As perguntas são redação própria a partir de factos públicos. Ter um URL factual não significa revisão concluída: os rascunhos aguardam revisão editorial e factual, incluindo confirmação das fontes atuais. A rede deste ambiente bloqueou o acesso externo ao BOE e às páginas Cervantes durante a implementação.

## Colunas

| Coluna | Finalidade |
| --- | --- |
| `fact_id` | Identificador estável do facto, partilhado pelas variantes |
| `question_id` | Identificador único e estável da variante |
| `module` | `ccse` ou `dele` |
| `category` | CCSE: `government`, `rights`, `geography`, `culture`, `society`; DELE: `reading`, `listening`, `writing`, `speaking` |
| `lesson_id` | Aula principal: por exemplo `c1` ou `d17` |
| `variant_type` | `exame`, `invertida`, `verdadeiro_falso` ou `outra` |
| `prompt` | Enunciado original em espanhol |
| `option_1`, `option_2`, `option_3` | Opções; a terceira fica vazia em V/F |
| `correct` | Número da opção certa, começando em 1 |
| `explanation` | Explicação factual em espanhol |
| `source` | URL HTTPS da fonte factual; pode ter indicação de artigo/contexto depois de um espaço |
| `status` | `rascunho`, `aprovada` ou `retirada` |
| `reviewed_at` | Data ISO `AAAA-MM-DD`; obrigatória para aprovação, vazia antes de rever |
| `edition` | Ano de referência, atualmente `2026` |
| `audio` | Transcrição original opcional, mantida nas 12 perguntas auditivas legadas |
| `lesson_ids` | Ligações adicionais a aulas/unidades relacionadas, separadas por vírgulas; a aula principal também é incluída |

Cada facto tem de uma a três variantes e pelo menos uma `exame`. Não repetir o mesmo tipo dentro do facto. O módulo e a categoria devem ser iguais nas variantes do mesmo facto. A importação verifica que as aulas existem no módulo correspondente.

**Formato da prova:** `exame` usa três opções, exceto `ccse/rights`, que usa duas para conservar as três questões V/F da tarefa 2. Isso também preserva as sete perguntas V/F já existentes, migradas como `exame`. Nos 30 novos factos dessa categoria, a segunda variante é uma pergunta de três opções, classificada `invertida`. Nos restantes novos factos CCSE, há uma `exame` de três opções e uma `verdadeiro_falso`.

Não mudar IDs de conteúdo já usado. Em particular, não mover um `question_id` existente para outro `fact_id`: a importação recusa essa mudança para proteger a revisão e o histórico. Para retirar, preferir `status=retirada`. Uma linha omitida de uma importação fica retirada na base, conservando os dados para o histórico. Corrigir o enunciado ou a explicação de um mesmo facto é possível; as tentativas já iniciadas conservam a sua apresentação e correção originais.

## Fluxo editorial

1. Rever facto, fonte, formulação, alternativas e explicação. Não consultar nem adaptar questões do manual CCSE para produzir variantes.
2. Confirmar as ligações de cada facto às aulas/unidades em `lesson_id` e `lesson_ids`. As ligações legadas foram iniciadas por tema de currículo e são editáveis; o teste seleciona apenas IDs explicitamente ligados.
3. Preencher `reviewed_at` e alterar para `aprovada` apenas as variantes revistas. Um facto com uma só variante aprovada ainda não pode satisfazer a regra de domínio por duas variantes.
4. Guardar CSV UTF-8 com separador `;`; usar datas ISO e evitar que o editor altere os identificadores ou as datas automaticamente.
5. Validar e rever os erros por linha antes de importar/publicar.

```sh
node scripts/import-questions.js --check
node scripts/export-drafts.js content/questions.csv /tmp/rumbo-rascunhos.csv
DATA_DIR=/caminho/da/base node scripts/import-questions.js content/questions.csv
```

A validação não abre a base nem importa dados. Uma importação válida usa uma transação: ou entram todas as linhas, ou nenhuma. O servidor usa o banco da base; apenas aprovadas podem iniciar testes/revisões. No arranque valida/sincroniza o mestre quando o hash mudou. Fazer a cópia de segurança habitual antes de atualizar a base usada pela aplicação. Não importar a exportação parcial de rascunhos como se fosse o mestre: as linhas omitidas seriam retiradas.

## Distribuição dos rascunhos

| Módulo / categoria | Factos novos | Variantes em rascunho |
| --- | ---: | ---: |
| CCSE — Governo e instituições | 30 | 60 |
| CCSE — Direitos e deveres | 30 | 60 |
| CCSE — Geografia | 30 | 60 |
| CCSE — Cultura | 30 | 60 |
| CCSE — Sociedade e vida quotidiana | 30 | 60 |
| **Subtotal CCSE** | **150** | **300** |
| DELE — Escrita (`d5`, `d17`–`d20`) | 25 | 25 |
| DELE — Oralidade (`d21`–`d24`) | 20 | 20 |
| **Total de rascunhos novos** | **195** | **345** |

Os 45 rascunhos DELE adicionais dão cinco questões a cada uma das nove aulas que não tinham cobertura no banco aprovado. Até serem aprovados, essas aulas mostram o aviso de conteúdo insuficiente ao tentar iniciar o teste do tema. Não se substituem as perguntas da aula por conteúdo de outra aula para preencher a contagem. As restantes aulas têm entre cinco e oito perguntas selecionadas por tentativa a partir das ligações aprovadas.

## Histórico e evidência

As 103 perguntas migradas preservam os IDs originais; cada uma é um facto legado com uma `exame`. O progresso objetivo anterior alimenta a evidência por facto. Os estados e logs de revisão antigos são conservados e uma agenda por facto é criada sem voltar a executar a migração.

O domínio exige respostas objetivas certas em pelo menos duas variantes e em dois dias diferentes de Madrid. Revelar um cartão e escolher «Lembrei-me» agenda revisão, mas não cria um acerto objetivo. Na revisão escolhe-se outra variante aprovada que difira da última falhada, se existir. Rascunhos e retiradas nunca são escolhidos para novas apresentações.

O manual oficial é apenas um complemento externo: URL/ano editáveis em `src/config/exam-requirements.js`, sem extração, resumo, reprodução ou iframe. A conclusão do passo é guardada separadamente das 48 aulas.
