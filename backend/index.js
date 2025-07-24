require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();

// Middlewares
// Permite requisições de diferentes origens (necessário para frontend/backend em portas diferentes)
// Para produção, restrinja 'origin' ao domínio do seu frontend.
app.use(cors({
  origin: '*', // Permite requisições de qualquer origem - USE APENAS PARA TESTES E DESENVOLVIMENTO
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json()); // Permite que o Express parseie corpos de requisição JSON

// Conexão com PostgreSQL
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

// Rota para salvar respostas da pesquisa
app.post('/api/respostas', async (req, res) => {
  const {
    nome,
    email,
    telefone,
    motivo_contato,
    atendimento, // avaliação geral
    atendimento_caixa,
    entrega,
    comentario_atendimento,
    comentario_caixa,
    comentario_entrega,
    sugestao // sugestão final
  } = req.body;

  const comentarioCompleto = `
Atendimento: ${comentario_atendimento || 'Sem observação'}
Caixa: ${comentario_caixa || 'Sem observação'}
Entrega: ${comentario_entrega || 'Sem observação'}
Sugestão final: ${sugestao || 'Sem sugestão'}
`.trim();

  try {
    const query = `
      INSERT INTO respostas (
        nome, email, telefone, motivo_contato,
        atendimento, atendimento_caixa, entrega,
        comentario_atendimento, comentario_caixa,
        comentario_entrega, sugestao
        -- Não inclua 'data_criacao' aqui, se ela tem DEFAULT CURRENT_TIMESTAMP no BD
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    `;

    await pool.query(query, [
      nome, email, telefone, motivo_contato,
      atendimento, atendimento_caixa, entrega,
      comentario_atendimento, comentario_caixa,
      comentario_entrega, sugestao
    ]);

    res.status(201).send({ message: 'Resposta salva com sucesso' });
  } catch (error) {
    console.error('Erro ao salvar resposta:', error);
    res.status(500).send({ error: 'Erro ao salvar a resposta' });
  }
});

// Rota para listar respostas com filtros (usada pelo dashboard)
app.get('/api/respostas', async (req, res) => {
  // Pega os parâmetros da query string (filtros)
  const { motivo_contato, data_inicio, data_fim, atendimento } = req.query; // Adicionei 'atendimento' para o filtro da avaliação geral

  // Nome da coluna de data no seu banco de dados
  // ESTE NOME DEVE SER EXATAMENTE IGUAL AO DA SUA COLUNA NO BD (confirmado no JSON como 'data_criacao')
  const COLUNA_DATA_DO_BD = 'data_criacao';

  let query = 'SELECT * FROM respostas WHERE 1=1'; // Inicia a query com uma condição sempre verdadeira
  const params = []; // Array para armazenar os parâmetros para evitar SQL Injection

  // 1. Filtro por Motivo de Contato
  if (motivo_contato) {
    params.push(motivo_contato);
    query += ` AND motivo_contato = $${params.length}`; // Adiciona condição AND
  }

  // 2. Filtro por Avaliação Geral (atendimento)
  if (atendimento) {
    params.push(parseInt(atendimento)); // Garante que o valor é um número
    query += ` AND atendimento = $${params.length}`; // Filtra pela coluna de atendimento
  }

  // 3. Filtro por Data de Início
  if (data_inicio) {
    // Adiciona a data de início com a hora 00:00:00 para pegar desde o começo do dia
    // Usa '::timestamp' para garantir que o PostgreSQL interprete a string como um timestamp
    params.push(`${data_inicio} 00:00:00`);
    query += ` AND ${COLUNA_DATA_DO_BD} >= $${params.length}::timestamp`;
  }

  // 4. Filtro por Data de Fim
  if (data_fim) {
    // Adiciona a data de fim com a hora 23:59:59 para pegar até o final do dia
    // Usa '::timestamp' para garantir que o PostgreSQL interprete a string como um timestamp
    params.push(`${data_fim} 23:59:59`);
    query += ` AND ${COLUNA_DATA_DO_BD} <= $${params.length}::timestamp`;
  }

  // 5. Ordenação: sempre ordenar pelos mais recentes
  query += ` ORDER BY ${COLUNA_DATA_DO_BD} DESC`;

  try {
    // LOGS PARA DEPURAR: Verifique o terminal onde seu servidor Node.js está rodando
    console.log('Query SQL gerada:', query);
    console.log('Parâmetros da Query:', params);

    const resultado = await pool.query(query, params);
    res.json(resultado.rows); // Envia os dados filtrados de volta ao frontend
  } catch (erro) {
    console.error('Erro ao buscar respostas:', erro);
    res.status(500).send({ error: 'Erro ao buscar a resposta' });
  }
});

// Iniciar servidor na rede local
app.listen(3000, '192.168.1.210', () => {
  console.log('Servidor acessível na rede local em http://192.168.1.210:3000');
});