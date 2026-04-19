# Mercado Pago MCP Server

**Mercado Pago MCP Server** implementa o padrão aberto [Model Context Protocol (MCP)](https://modelcontextprotocol.io) para facilitar o acesso às APIs e ferramentas do Mercado Pago para agentes de IA ou LLMs em ambientes de desenvolvimento compatíveis.

Este servidor atua como um intermediário, traduzindo os recursos do ecossistema do Mercado Pago em _tools_, ou funções executáveis que aplicações de inteligência artificial podem acionar para realizar ações, estendendo as capacidades tradicionais das APIs do Mercado Pago para fluxos automatizados ou assistidos por IA.

Desta forma, o Mercado Pago MCP Server permite simplificar o processo de integração, utilizar a documentação disponível para realizar implementações ou melhorias de código, e otimizar seu funcionamento através de interações em linguagem natural e sem necessidade de implementações manuais.

Explore nossa documentação para saber como realizar a conexão, quais são as _tools_ que o MCP Server do Mercado Pago tem disponíveis, e como utilizá-las para potencializar suas integrações em nossos casos de uso.

## Requisitos prévios

Antes de começar a utilizar o servidor, confirme se está com todo o ambiente preparado:

| Requisito | Descrição |
|-|-|
| **Cliente** | A conexão ao Mercado Pago MCP Server é remota, portanto você precisa escolher um cliente a partir do qual interagir com o assistente. A solução está disponível para os principais agentes de IA: Cursor (versão 1 ou superior), VS Code, Windsurf, Cline, Claude Desktop ou Code, e ChatGPT. Em todos os casos, certifique-se de ter a versão mais recente disponível. |
| **Credenciais** | As credenciais são chaves de acesso únicas com as quais identificamos uma integração em sua conta e serão necessárias para realizar a conexão com alguns clientes. Consulte a [documentação](/developers/pt/docs/credentials) para saber mais. |