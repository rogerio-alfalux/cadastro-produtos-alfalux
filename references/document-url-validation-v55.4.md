# Validação de URLs de documentos — v55.4

- Produto: `LDE-6450.140.18B` — `LUNA G LED 17W RE`.
- Causa identificada: o upload armazenava no JSON a chave solicitada antes do hash, mas o arquivo real era gravado com o hash acrescentado por `storagePut`; a API assinava a chave inexistente.
- Datasheet legado: GET direto carregou o PDF correto `Ficha de Produto Luna LED 17W G RE r02.pdf`, sem `AccessDenied`.
- Fotometria legada: GET direto iniciou o download do arquivo `1787765142237-q02ulxew8i_1bc5c1cf.ies`, sem `AccessDenied`.
- Teste de terminal anterior à validação visual: Datasheet HTTP 200, `application/pdf`, 409949 bytes, magic `%PDF-1.7`; Fotometria HTTP 200, 46336 bytes, magic `IESNA:LM-63-1995`.
- Desenho Técnico de validação: upload retornou chave e URL com o mesmo hash; GET direto retornou HTTP 200, `application/pdf`, 409949 bytes, magic `%PDF-1.7`, sem `AccessDenied`.
- O contrato da API mantém `documentos`, `datasheetUrl`, `fotometriaIesUrl` e `desenhoTecnicoUrl`, e os aliases são iguais às URLs dos respectivos objetos.
