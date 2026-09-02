# Validação visual — Redefinição de senha v64

- A rota `/redefinir-senha` sem token apresenta estado seguro de link indisponível, com orientação de retorno ao login.
- Um token temporário válido exibiu corretamente os campos de nova senha e confirmação, requisitos de senha e aviso de expiração/uso único.
- O token usado exclusivamente nesta verificação foi invalidado logo após a captura; nenhuma senha ou sessão de usuário foi alterada.
