# Bot Telegram - Consulta de Acessos (Portão/Gabinete)

Bot para Telegram, construído com [Telegraf](https://telegraf.js.org/), que permite consultar e atualizar informações de acesso (portão e gabinetes) de sites de telecomunicações cadastrados em um banco de dados MySQL.

## 📋 Funcionalidades

- Consulta de UF e site cadastrados no banco de dados
- Visualização dos dados de acesso ao portão e gabinetes de um site
- Confirmação de dados existentes
- Atualização de acesso ao portão
- Atualização de acesso a gabinetes existentes
- Cadastro de novos gabinetes

## 🔧 Pré-requisitos

- [Node.js](https://nodejs.org/) v16 ou superior
- Banco de dados MySQL acessível (rede interna ou VPN, se aplicável)
- Um bot criado no Telegram via [@BotFather](https://t.me/BotFather)

## 📦 Instalação

```bash
npm init -y
npm install telegraf mysql2 dotenv
```

## ⚙️ Configuração

Crie um arquivo `.env` na raiz do projeto com as seguintes variáveis:

```env
BOT_TOKEN=seu_token_do_botfather
DB_HOST=ip_do_banco
DB_USER=usuario_do_banco
DB_PASSWORD=senha_do_banco
DB_NAME=nome_do_banco
```

> ⚠️ **Nunca** commite o arquivo `.env` no repositório. Adicione-o ao `.gitignore`.

## 🗄️ Estrutura esperada do banco de dados

O bot espera as seguintes tabelas:

**`acessos`**
| Coluna | Tipo | Descrição |
|---|---|---|
| id | INT | Chave primária |
| uf | VARCHAR | Sigla da UF |
| site | VARCHAR | Sigla do site |
| acesso_portao | VARCHAR | Informações de acesso ao portão |
| tecnico | VARCHAR | Nome do técnico que atualizou/confirmou |
| ultima_atualizacao | DATETIME | Data/hora da última atualização |

**`acessos_gabinete`**
| Coluna | Tipo | Descrição |
|---|---|---|
| id | INT | Chave primária |
| site_id | INT | Referência ao `id` de `acessos` |
| acesso_gabinete | VARCHAR | Informações de acesso ao gabinete |

## ▶️ Executando o bot

```bash
node bot.js
```

Se tudo estiver correto, o terminal exibirá:

```
✅ Bot rodando
```

### Rodando em produção (PM2)

Para manter o bot ativo continuamente, mesmo após fechar o terminal:

```bash
npm install -g pm2
pm2 start bot.js --name bot-acessos
pm2 save
```

## 💬 Fluxo de uso

1. `/start` — inicia a conversa
2. Informar a **UF**
3. Informar a **sigla do site**
4. Escolher uma ação:
   - `1` Confirmar dados
   - `2` Atualizar (Portão / Gabinete / Ambos)
   - `3` Cadastrar novo gabinete
5. Seguir as instruções específicas de cada fluxo
6. Ao final, escolher se deseja fazer uma nova busca (`S`/`N`)
