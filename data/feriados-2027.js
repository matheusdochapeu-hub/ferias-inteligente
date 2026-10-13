/* =============================================================================
 * BASE DE DADOS DE FERIADOS / PONTOS FACULTATIVOS / PONTES — ANO 2027
 * -----------------------------------------------------------------------------
 * Como expandir no futuro:
 *  - Para adicionar um novo ano: crie "feriados-2028.js" no mesmo formato e
 *    inclua no index.html. O objeto global CALENDARIOS vai agregando os anos.
 *  - Para adicionar um novo ente (ex.: outro município, governo federal):
 *    acrescente uma nova chave em CALENDARIOS[2027].entes seguindo o modelo.
 *
 * Formato de cada dia:
 *   { data: "AAAA-MM-DD", nome: "...", tipo: "feriado" | "facultativo" | "meio" }
 *     tipo "feriado"     -> dia não trabalhado (feriado cheio)
 *     tipo "facultativo" -> ponto facultativo / ponte (altamente emendável)
 *     tipo "meio"        -> expediente de meio período (emenda parcial)
 *
 * Observação sobre a semana:
 *   - Sábado e domingo são sempre considerados não úteis pelo motor de cálculo.
 * ===========================================================================*/

window.CALENDARIOS = window.CALENDARIOS || {};

window.CALENDARIOS[2027] = {
  ano: 2027,

  /* Datas de referência usadas em avisos da interface. */
  quartaDeCinzas: "2027-02-10",

  /* Feriados NACIONAIS de 2027 (válidos para todos os entes). */
  nacionais: [
    { data: "2027-01-01", nome: "Confraternização Universal", tipo: "feriado" },
    { data: "2027-03-26", nome: "Paixão de Cristo (Sexta-feira Santa)", tipo: "feriado" },
    { data: "2027-04-21", nome: "Tiradentes", tipo: "feriado" },
    { data: "2027-05-01", nome: "Dia do Trabalho", tipo: "feriado" },
    { data: "2027-09-07", nome: "Independência", tipo: "feriado" },
    { data: "2027-10-12", nome: "Nossa Senhora Aparecida", tipo: "feriado" },
    { data: "2027-11-02", nome: "Finados", tipo: "feriado" },
    { data: "2027-11-15", nome: "Proclamação da República", tipo: "feriado" },
    { data: "2027-11-20", nome: "Consciência Negra (feriado nacional)", tipo: "feriado" },
    { data: "2027-12-25", nome: "Natal", tipo: "feriado" }
  ],

  /* Pontos facultativos NACIONAIS típicos (Carnaval e Corpus Christi móveis). */
  nacionaisFacultativos: [
    { data: "2027-02-08", nome: "Carnaval (ponto facultativo)", tipo: "facultativo" },
    { data: "2027-02-09", nome: "Carnaval (ponto facultativo)", tipo: "facultativo" },
    { data: "2027-02-10", nome: "Quarta-feira de Cinzas (meio período)", tipo: "meio" }
  ],

  entes: {
    /* =========================================================================
     * PREFEITURA MUNICIPAL DE RIBEIRÃO PRETO (PMRP) — servidores municipais
     * -------------------------------------------------------------------------
     * ATENÇÃO: o Decreto municipal com o calendário OFICIAL de 2027 (feriados e
     * pontos facultativos) normalmente é publicado no Diário Oficial do
     * Município no fim de outubro. Até lá, os FERIADOS abaixo são os municipais
     * FIXOS por lei + nacionais + estadual. Os PONTOS FACULTATIVOS marcados como
     * "(a confirmar)" devem ser revisados quando o decreto 2027 for publicado.
     * =======================================================================*/
    pmrp: {
      id: "pmrp",
      nome: "Prefeitura Municipal de Ribeirão Preto",
      nomeCurto: "PMRP",
      esfera: "Municipal",
      pagamento: "Salário no 1º dia útil do mês. Recebimento normal antes e depois das férias.",
      // Feriados municipais fixos de Ribeirão Preto (Lei Municipal nº 2.311/1969):
      feriadosLocais: [
        { data: "2027-01-20", nome: "Dia de São Sebastião (padroeiro)", tipo: "feriado" },
        { data: "2027-06-19", nome: "Aniversário de Ribeirão Preto", tipo: "feriado" }
      ],
      // Feriado estadual de São Paulo:
      estaduais: [
        { data: "2027-07-09", nome: "Revolução Constitucionalista (estadual SP)", tipo: "feriado" }
      ],
      // Corpus Christi (móvel) — tradicionalmente feriado em RP:
      facultativosLocais: [
        { data: "2027-05-27", nome: "Corpus Christi", tipo: "feriado" },
        // --- Pontos facultativos PROJETADOS para 2027 ---
        // Baseados no padrão recorrente da PMRP (decretos de 2025 e 2026).
        // ⚠️ PREVISÃO — substituir pelos dados oficiais quando o Decreto
        //    Municipal de 2027 for publicado (previsto p/ fim de out/2026).
        // (Carnaval 08-09/02 e Quarta de Cinzas 10/02 já vêm de "nacionaisFacultativos".)
        { data: "2027-05-28", nome: "Sexta pós-Corpus Christi (ponto facultativo) — previsão", tipo: "facultativo" },
        { data: "2027-10-28", nome: "Dia do Servidor Público (ponto facultativo) — previsão", tipo: "facultativo" },
        { data: "2027-12-24", nome: "Véspera de Natal (ponto facultativo) — previsão", tipo: "facultativo" },
        { data: "2027-12-31", nome: "Véspera de Ano-Novo (ponto facultativo) — previsão", tipo: "facultativo" }
      ],
      _observacao: "Pontos facultativos de 2027 são PREVISÃO (padrão PMRP 2025/2026). Confirmar com o Decreto Municipal (previsto p/ fim de out/2026)."
    },

    /* =========================================================================
     * USP — servidores estaduais, distribuídos por diversos municípios.
     * Fonte: Ofícios GR/CIRC/360 e GR/CIRC/361 (feriados, facultativos e pontes
     * de 2027). Cada cidade tem seus próprios feriados municipais.
     * =======================================================================*/
    usp: {
      id: "usp",
      nome: "Universidade de São Paulo (USP)",
      nomeCurto: "USP",
      esfera: "Estadual",
      pagamento: "Salário no 4º dia útil do mês. Férias são pagas ADIANTADAS, no mês anterior ao gozo.",
      // Feriados ESTADUAIS/base válidos para toda a USP (além dos nacionais):
      estaduais: [
        { data: "2027-05-27", nome: "Corpus Christi", tipo: "feriado" },
        { data: "2027-07-09", nome: "Revolução Constitucionalista (estadual SP)", tipo: "feriado" }
      ],
      // Pontos facultativos / suspensões válidos para toda a USP:
      facultativosGerais: [
        { data: "2027-10-28", nome: "Dia do Servidor Público (ponto facultativo)", tipo: "facultativo" }
      ],
      // ---- Feriados MUNICIPAIS por cidade USP (apenas 2027) ----
      cidades: {
        "Anhembi":              [{ data: "2027-04-15", nome: "Feriado municipal (Anhembi)", tipo: "feriado" },
                                 { data: "2027-09-08", nome: "Feriado municipal (Anhembi)", tipo: "feriado" },
                                 { data: "2027-11-27", nome: "Feriado municipal (Anhembi)", tipo: "feriado" },
                                 { data: "2027-04-16", nome: "Ponte (Anhembi)", tipo: "facultativo" }],
        "Araraquara":           [{ data: "2027-07-11", nome: "Feriado municipal (Araraquara)", tipo: "feriado" },
                                 { data: "2027-08-22", nome: "Feriado municipal (Araraquara)", tipo: "feriado" }],
        "Bauru":                [{ data: "2027-08-01", nome: "Feriado municipal (Bauru)", tipo: "feriado" }],
        "Cananéia":             [{ data: "2027-06-24", nome: "Feriado municipal (Cananéia)", tipo: "feriado" },
                                 { data: "2027-08-13", nome: "Feriado municipal (Cananéia)", tipo: "feriado" },
                                 { data: "2027-08-15", nome: "Feriado municipal (Cananéia)", tipo: "feriado" },
                                 { data: "2027-06-25", nome: "Ponte (Cananéia)", tipo: "facultativo" }],
        "Cássia dos Coqueiros": [{ data: "2027-01-06", nome: "Feriado municipal (Cássia dos Coqueiros)", tipo: "feriado" },
                                 { data: "2027-02-18", nome: "Feriado municipal (Cássia dos Coqueiros)", tipo: "feriado" },
                                 { data: "2027-05-22", nome: "Feriado municipal (Cássia dos Coqueiros)", tipo: "feriado" },
                                 { data: "2027-06-28", nome: "Feriado municipal (Cássia dos Coqueiros)", tipo: "feriado" },
                                 { data: "2027-02-19", nome: "Ponte (Cássia dos Coqueiros)", tipo: "facultativo" }],
        "Cubatão":              [{ data: "2027-04-09", nome: "Feriado municipal (Cubatão)", tipo: "feriado" },
                                 { data: "2027-08-15", nome: "Feriado municipal (Cubatão)", tipo: "feriado" }],
        "Itatinga":             [{ data: "2027-06-24", nome: "Feriado municipal (Itatinga)", tipo: "feriado" },
                                 { data: "2027-07-24", nome: "Feriado municipal (Itatinga)", tipo: "feriado" },
                                 { data: "2027-06-25", nome: "Ponte (Itatinga)", tipo: "facultativo" }],
        "Itu":                  [{ data: "2027-02-02", nome: "Feriado municipal (Itu)", tipo: "feriado" },
                                 { data: "2027-02-01", nome: "Ponte (Itu)", tipo: "facultativo" }],
        "Jaú":                  [{ data: "2027-08-15", nome: "Feriado municipal (Jaú)", tipo: "feriado" }],
        "Lorena":               [{ data: "2027-08-15", nome: "Feriado municipal (Lorena)", tipo: "feriado" },
                                 { data: "2027-11-14", nome: "Feriado municipal (Lorena)", tipo: "feriado" }],
        "Pariquera-Açu":        [{ data: "2027-06-29", nome: "Feriado municipal (Pariquera-Açu)", tipo: "feriado" },
                                 { data: "2027-10-11", nome: "Feriado municipal (Pariquera-Açu)", tipo: "feriado" },
                                 { data: "2027-06-28", nome: "Ponte (Pariquera-Açu)", tipo: "facultativo" }],
        "Piracicaba":           [{ data: "2027-06-13", nome: "Feriado municipal (Piracicaba)", tipo: "feriado" },
                                 { data: "2027-12-08", nome: "Feriado municipal (Piracicaba)", tipo: "feriado" }],
        "Piraju":               [{ data: "2027-01-20", nome: "Feriado municipal (Piraju)", tipo: "feriado" }],
        "Pirassununga":         [{ data: "2027-08-06", nome: "Feriado municipal (Pirassununga)", tipo: "feriado" },
                                 { data: "2027-12-08", nome: "Feriado municipal (Pirassununga)", tipo: "feriado" }],
        "Ribeirão Preto":       [{ data: "2027-01-20", nome: "Dia de São Sebastião (Ribeirão Preto)", tipo: "feriado" },
                                 { data: "2027-06-19", nome: "Aniversário de Ribeirão Preto", tipo: "feriado" }],
        "Salesópolis":          [{ data: "2027-02-28", nome: "Feriado municipal (Salesópolis)", tipo: "feriado" },
                                 { data: "2027-03-19", nome: "Feriado municipal (Salesópolis)", tipo: "feriado" }],
        "Santos":               [{ data: "2027-01-26", nome: "Feriado municipal (Santos)", tipo: "feriado" },
                                 { data: "2027-09-08", nome: "Feriado municipal (Santos)", tipo: "feriado" },
                                 { data: "2027-01-25", nome: "Ponte (Santos)", tipo: "facultativo" }],
        "São Carlos":           [{ data: "2027-08-15", nome: "Feriado municipal (São Carlos)", tipo: "feriado" },
                                 { data: "2027-11-04", nome: "Feriado municipal (São Carlos)", tipo: "feriado" },
                                 { data: "2027-11-03", nome: "Ponte (São Carlos)", tipo: "facultativo" }],
        "São Paulo":            [{ data: "2027-01-25", nome: "Aniversário de São Paulo", tipo: "feriado" }],
        "São Sebastião":        [{ data: "2027-03-16", nome: "Feriado municipal (São Sebastião)", tipo: "feriado" },
                                 { data: "2027-03-15", nome: "Ponte (São Sebastião)", tipo: "facultativo" }],
        "Ubatuba":              [{ data: "2027-09-13", nome: "Feriado municipal (Ubatuba)", tipo: "feriado" },
                                 { data: "2027-10-28", nome: "Feriado municipal (Ubatuba)", tipo: "feriado" }],
        "Valinhos":             [{ data: "2027-01-20", nome: "Feriado municipal (Valinhos)", tipo: "feriado" },
                                 { data: "2027-05-28", nome: "Feriado municipal (Valinhos)", tipo: "feriado" }],
        "Monte Negro/RO":       [{ data: "2027-01-04", nome: "Feriado municipal (Monte Negro/RO)", tipo: "feriado" },
                                 { data: "2027-02-14", nome: "Feriado municipal (Monte Negro/RO)", tipo: "feriado" },
                                 { data: "2027-03-19", nome: "Feriado municipal (Monte Negro/RO)", tipo: "feriado" },
                                 { data: "2027-06-18", nome: "Feriado municipal (Monte Negro/RO)", tipo: "feriado" },
                                 { data: "2027-05-27", nome: "Corpus Christi (Monte Negro/RO)", tipo: "feriado" }]
      }
    }
  }
};
