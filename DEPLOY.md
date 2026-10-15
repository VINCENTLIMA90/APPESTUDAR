# Ver a Rumbo online

O ambiente de configuração do Codex executa a aplicação, mas não fornece um endereço público para a abrir no navegador. Publicar este ambiente nas configurações guarda o ambiente de desenvolvimento; não publica a webapp na Internet.

## Demonstração gratuita no Render

O ficheiro `render.yaml` prepara uma webapp Node no plano gratuito, sem chaves de IA predefinidas. Não cria nem cobra um serviço por si só.

1. Colocar os ficheiros deste projeto no repositório GitHub `VINCENTLIMA90/APPESTUDAR`, numa branch com commits.
2. Entrar no Render e ligar a conta GitHub, dando acesso a este repositório.
3. Criar um **Blueprint** a partir do repositório. Rever a configuração `rumbo-demo` e confirmar o plano gratuito antes de criar o serviço.
4. Esperar que o build e o health check terminem. O Render apresenta o endereço público atribuído ao serviço; só esse endereço deve ser partilhado.
5. Abrir a app, criar uma conta de demonstração e concluir uma aula para verificar o funcionamento online. Para testar IA, configurar uma chave de API na própria interface.

**Dados da demonstração:** o plano gratuito não tem disco persistente. As contas, gravações e o progresso podem perder-se quando o serviço reinicia ou é publicado novamente. O serviço também pode suspender por inatividade e demorar a abrir. Usar dados de demonstração e exportar qualquer progresso que se pretenda conservar.

## Uso pessoal contínuo ou distribuição

Para manter contas e progresso, escolher um alojamento com armazenamento persistente e apontar `DATA_DIR` para esse volume. No Render, um disco persistente requer um plano pago; escolher e confirmar o plano na conta de alojamento. Não existe contratação automática configurada neste projeto.

O servidor necessita de Node.js 24.19 ou posterior, HTTPS na entrada e acesso de saída aos domínios oficiais e fornecedores de IA descritos no README. O proxy deve preservar o host público. `NODE_ENV=production` ativa cookies Secure. O endpoint `/api/health` é usado para confirmar o arranque.

Esta versão ainda não inclui recuperação de palavra-passe, validação de email nem cobrança de subscrições.
