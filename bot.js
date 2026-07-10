require("dotenv").config();

const { Telegraf } = require("telegraf");
const mysql = require("mysql2/promise");

const bot = new Telegraf(process.env.BOT_TOKEN);

const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

const usuarios = {};

// ================= UTILS =================
function normalizarTexto(v) {
  return String(v || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .trim();
}

function limparSessao(id) {
  delete usuarios[id];
}

// ================= DB =================
async function validarUF(uf) {
  const [rows] = await db.execute(
    `SELECT 1 FROM acessos WHERE UPPER(uf)=? LIMIT 1`,
    [normalizarTexto(uf)],
  );
  return rows.length > 0;
}

async function consultarSite(uf, site) {
  const [sites] = await db.execute(
    `SELECT id, site, uf, acesso_portao 
     FROM acessos
     WHERE UPPER(site)=? AND UPPER(uf)=?`,
    [normalizarTexto(site), normalizarTexto(uf)],
  );

  if (!sites.length) return { linha: null };

  const siteData = sites[0];

  const [gabs] = await db.execute(
    `SELECT id, acesso_gabinete 
     FROM acessos_gabinete 
     WHERE site_id = ?`,
    [siteData.id],
  );

  return {
    linha: {
      ...siteData,
      gabinetes: gabs,
    },
  };
}

async function atualizarPortao(id, portao, tecnico) {
  await db.execute(
    `UPDATE acessos 
     SET acesso_portao=?, tecnico=?, ultima_atualizacao=NOW()
     WHERE id=?`,
    [portao, tecnico, id],
  );
}

async function atualizarGabinete(gab_id, novo) {
  await db.execute(
    `UPDATE acessos_gabinete 
     SET acesso_gabinete=? 
     WHERE id=?`,
    [novo, gab_id],
  );
}

async function adicionarGabinete(site_id, gabinete) {
  await db.execute(
    `INSERT INTO acessos_gabinete (site_id, acesso_gabinete)
     VALUES (?, ?)`,
    [site_id, gabinete],
  );
}

async function confirmarSite(id, tecnico) {
  await db.execute(
    `UPDATE acessos 
     SET tecnico=?, ultima_atualizacao=NOW()
     WHERE id=?`,
    [tecnico, id],
  );
}

// ================= BOT =================

bot.start((ctx) => {
  usuarios[ctx.from.id] = { etapa: 1 };
  ctx.reply("Informe a UF:");
});

bot.on("text", async (ctx) => {
  const userId = ctx.from.id;
  const msg = normalizarTexto(ctx.message.text);

  if (!(userId in usuarios)) {
    usuarios[userId] = { etapa: 1 };
    return ctx.reply("Informe a UF:");
  }

  const estado = usuarios[userId];

  try {
    // ===== ETAPA 1: UF =====
    if (estado.etapa === 1) {
      const existe = await validarUF(msg);

      if (!existe) {
        estado.etapa = 98;
        return ctx.reply(
          "❌ UF não encontrada.\nDeseja tentar novamente? (S/N)",
        );
      }

      estado.uf = msg;
      estado.etapa = 2;
      return ctx.reply("Informe a sigla do site:");
    }

    // ===== ETAPA 2: SITE =====
    if (estado.etapa === 2) {
      const { linha } = await consultarSite(estado.uf, msg);

      if (!linha) {
        estado.etapa = 97;
        return ctx.reply(
          "❌ Site não encontrado.\nDeseja tentar novamente? (S/N)",
        );
      }

      estado.id = linha.id;
      estado.dados = linha;
      estado.etapa = 3;

      let listaGab = "Sem gabinetes";
      if (linha.gabinetes.length > 0) {
        listaGab = linha.gabinetes
          .map((g, i) => `${i + 1} - ${g.acesso_gabinete}`)
          .join("\n");
      }

      return ctx.reply(
        `🌎 UF: ${linha.uf}\n` +
          `📡 Site: ${linha.site}\n\n` +
          `🚪 Portão: ${linha.acesso_portao}\n\n` +
          `📦 Gabinetes:\n${listaGab}\n\n` +
          `1 Confirmar\n2 Atualizar\n3 Cadastrar gabinete`,
      );
    }

    // ===== ETAPA 3 =====
    if (estado.etapa === 3) {
      if (msg === "1") {
        await confirmarSite(estado.id, ctx.from.first_name);
        estado.etapa = 99;
        return ctx.reply("✅ Confirmado\nNova busca? (S/N)");
      }

      if (msg === "2") {
        estado.etapa = 4;
        return ctx.reply("A) Portão\nB) Gabinetes\nC) Ambos");
      }

      if (msg === "3") {
        estado.etapa = 7;
        return ctx.reply("Novo gabinete:");
      }
    }

    // ===== ETAPA 4 =====
    if (estado.etapa === 4) {
      estado.tipo = msg;

      if (!["A", "B", "C"].includes(estado.tipo)) {
        return ctx.reply("Escolha A, B ou C");
      }

      if (estado.tipo === "A") {
        estado.etapa = 5;
        return ctx.reply("Novo valor do portão:");
      }

      if (estado.tipo === "B") {
        estado.etapa = 6;

        const lista = estado.dados.gabinetes
          .map((g, i) => `${i + 1} - ${g.acesso_gabinete}`)
          .join("\n");

        return ctx.reply(`Qual gabinete atualizar?\n\n${lista}`);
      }

      if (estado.tipo === "C") {
        estado.etapa = 5;
        return ctx.reply("Novo portão:");
      }
    }

    // ===== ETAPA 5 =====
    if (estado.etapa === 5) {
      if (estado.tipo === "A") {
        await atualizarPortao(estado.id, msg, ctx.from.first_name);
        estado.etapa = 99;
        return ctx.reply("✅ Atualizado\nNova busca? (S/N)");
      }

      if (estado.tipo === "C") {
        estado.portao = msg;
        estado.etapa = 8;

        const lista = estado.dados.gabinetes
          .map((g, i) => `${i + 1} - ${g.acesso_gabinete}`)
          .join("\n");

        return ctx.reply(`Qual gabinete atualizar?\n\n${lista}`);
      }
    }

    // ===== ETAPA 6 =====
    if (estado.etapa === 6) {
      const index = parseInt(msg) - 1;

      if (!estado.dados.gabinetes[index]) {
        return ctx.reply("Escolha inválida");
      }

      estado.gab_id = estado.dados.gabinetes[index].id;
      estado.etapa = 9;

      return ctx.reply("Novo valor do gabinete:");
    }

    // ===== ETAPA 8 =====
    if (estado.etapa === 8) {
      const index = parseInt(msg) - 1;

      if (!estado.dados.gabinetes[index]) {
        return ctx.reply("Escolha inválida");
      }

      estado.gab_id = estado.dados.gabinetes[index].id;
      estado.etapa = 9;

      return ctx.reply("Novo valor do gabinete:");
    }

    // ===== ETAPA 9 =====
    if (estado.etapa === 9) {
      await atualizarGabinete(estado.gab_id, msg);

      if (estado.portao) {
        await atualizarPortao(estado.id, estado.portao, ctx.from.first_name);
      }

      estado.etapa = 99;
      return ctx.reply("✅ Dados atualizados\nNova busca? (S/N)");
    }

    // ===== ETAPA 7 =====
    if (estado.etapa === 7) {
      await adicionarGabinete(estado.id, msg);
      estado.etapa = 99;
      return ctx.reply("✅ Gabinete cadastrado\nNova busca? (S/N)");
    }

    // ===== UF inválida =====
    if (estado.etapa === 98) {
      if (msg === "S") {
        usuarios[userId] = { etapa: 1 };
        return ctx.reply("Informe a UF:");
      }

      if (msg === "N") {
        limparSessao(userId);
        return ctx.reply("✅ Conversa encerrada.");
      }

      return ctx.reply("Responda S ou N");
    }

    // ===== SITE inválido =====
    if (estado.etapa === 97) {
      if (msg === "S") {
        usuarios[userId] = { etapa: 1 };
        return ctx.reply("Informe a UF:");
      }

      if (msg === "N") {
        limparSessao(userId);
        return ctx.reply("✅ Conversa encerrada.");
      }

      return ctx.reply("Responda S ou N");
    }

    // ===== FINAL =====
    if (estado.etapa === 99) {
      if (msg === "S") {
        usuarios[userId] = { etapa: 1 };
        return ctx.reply("Informe a UF:");
      }

      if (msg === "N") {
        limparSessao(userId);
        return ctx.reply("✅ Encerrado");
      }

      return ctx.reply("Responda S ou N");
    }
  } catch (err) {
    console.error(err);
    ctx.reply("❌ Erro");
  }
});

bot.launch();
console.log("✅ Bot rodando");
