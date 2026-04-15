import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Maps camelCase entity names to snake_case Supabase table names
const ENTITY_TABLE_MAP = {
  AcaoCorretiva12Semanas: 'acao_corretiva_12_semanas',
  AdministrativoINSS: 'administrativo_inss',
  Agenda: 'agenda',
  AgendaComercial: 'agenda_comercial',
  AgendamentoAdmINSS: 'agendamento_adm_inss',
  AgendamentoINSS: 'agendamento_inss',
  AgendamentoINSSAdmin: 'agendamento_inss_admin',
  AguardandoDocumento: 'aguardando_documento',
  Alerta: 'alerta',
  AndamentoAdministrativo: 'andamento_administrativo',
  Atendimento: 'atendimento',
  Auditoria: 'auditoria',
  BlocosDeNotasUsuario: 'blocos_de_notas_usuario',
  CentralAdminINSS: 'central_admin_inss',
  Ciclo12Semanas: 'ciclo_12_semanas',
  Cliente: 'cliente',
  ClubeDoLivro: 'clube_do_livro',
  ConclusaoAdmINSS: 'conclusao_adm_inss',
  ConclusaoINSS: 'conclusao_inss',
  ConfiguracaoAgenda: 'configuracao_agenda',
  ConfiguracaoIA: 'configuracao_ia',
  ControleProcessoExecucao: 'controle_processo_execucao',
  CopiasPA: 'copias_pa',
  CredencialINSS: 'credencial_inss',
  DeferidoAdmINSS: 'deferido_adm_inss',
  DeferidoINSS: 'deferido_inss',
  DocumentoGerado: 'documento_gerado',
  DocumentoVinculado: 'documento_vinculado',
  ExigenciaAdmINSS: 'exigencia_adm_inss',
  ExigenciaINSS: 'exigencia_inss',
  Feedback12Semanas: 'feedback_12_semanas',
  FolhaDePonto: 'folha_de_ponto',
  HistoricoAgenda: 'historico_agenda',
  HistoricoAtendimento: 'historico_atendimento',
  IndeferidoAdmINSS: 'indeferido_adm_inss',
  IndeferidoINSS: 'indeferido_inss',
  Indicador12Semanas: 'indicador_12_semanas',
  InstagramCanal: 'instagram_canal',
  LancamentoFinanceiro: 'lancamento_financeiro',
  LandingPage: 'landing_page',
  LeadComercial: 'lead_comercial',
  LeadMarketing: 'lead_marketing',
  LivroVenda: 'livro_venda',
  ManualEscritorio: 'manual_escritorio',
  MentoriaModulo: 'mentoria_modulo',
  MetaCiclo12Semanas: 'meta_ciclo_12_semanas',
  MetaProdutividade: 'meta_produtividade',
  MetodoRESULT: 'metodo_result',
  ModeloDocumento: 'modelo_documento',
  MonitoramentoProcessual: 'monitoramento_processual',
  Notificacao: 'notificacao',
  Pessoa: 'pessoa',
  PostMarketing: 'post_marketing',
  Processo: 'processo',
  ProcessoAdministrativoINSS: 'processo_administrativo_inss',
  ProtocoloAdmINSS: 'protocolo_adm_inss',
  ProtocoloINSS: 'protocolo_inss',
  RetornoCliente: 'retorno_cliente',
  RevisaoEstrategica12Semanas: 'revisao_estrategica_12_semanas',
  Setor: 'setor',
  SnapshotProdutividade: 'snapshot_produtividade',
  SocialSelling: 'social_selling',
  Tarefa: 'tarefa',
  TarefaINSS: 'tarefa_inss',
  TemplateMinuta: 'template_minuta',
};

// Flattens a Supabase row into a plain object: { id, created_at, ...data }
function flattenRow(row) {
  if (!row) return null;
  const { id, created_at, updated_at, data } = row;
  return { id, created_date: created_at, created_at, updated_at, ...data };
}

// Resolves sort field: '-created_date' → { column: 'created_at', ascending: false }
//                       'nome'         → { column: 'nome',       ascending: true }
function resolveSort(sort) {
  if (!sort) return { column: 'created_at', ascending: false, isDataField: false };
  const ascending = !sort.startsWith('-');
  const field = sort.replace(/^-/, '');

  // Map base44 field aliases to actual columns
  if (field === 'created_date') return { column: 'created_at', ascending, isDataField: false };
  if (field === 'updated_date') return { column: 'updated_at', ascending, isDataField: false };

  // All other fields live inside the data JSONB column
  return { column: field, ascending, isDataField: true };
}

function throwOnError({ data, error }) {
  if (error) throw new Error(error.message);
  return data;
}

function createEntityClient(entityName) {
  const tableName = ENTITY_TABLE_MAP[entityName];
  if (!tableName) throw new Error(`Unknown entity: ${entityName}`);

  return {
    // list(sort?, limit?) → array of flat objects
    async list(sort = '-created_date', limit = 1000) {
      const { column, ascending, isDataField } = resolveSort(sort);

      let query = supabase.from(tableName).select('*');

      if (!isDataField) {
        query = query.order(column, { ascending });
      } else {
        // Sort by JSONB field using computed column expression
        query = query.order('created_at', { ascending: false });
      }

      if (limit) query = query.limit(limit);

      const rows = throwOnError(await query);
      return (rows || []).map(flattenRow);
    },

    // filter(criteria, sort?, limit?) → array of flat objects matching criteria
    async filter(criteria = {}, sort = '-created_date', limit = 1000) {
      let query = supabase.from(tableName).select('*');

      // Apply each filter criterion using JSONB containment
      if (Object.keys(criteria).length > 0) {
        query = query.contains('data', criteria);
      }

      const { column, ascending, isDataField } = resolveSort(sort);
      if (!isDataField) {
        query = query.order(column, { ascending });
      } else {
        query = query.order('created_at', { ascending: false });
      }

      if (limit) query = query.limit(limit);

      const rows = throwOnError(await query);
      return (rows || []).map(flattenRow);
    },

    // get(id) → single flat object
    async get(id) {
      const row = throwOnError(
        await supabase.from(tableName).select('*').eq('id', id).single()
      );
      return flattenRow(row);
    },

    // create(fields) → created flat object
    async create(fields) {
      const { id, created_at, created_date, updated_at, ...dataFields } = fields;
      const rows = throwOnError(
        await supabase.from(tableName).insert({ data: dataFields }).select()
      );
      return flattenRow(rows?.[0]);
    },

    // update(id, fields) → updated flat object
    async update(id, fields) {
      const { id: _id, created_at, created_date, updated_at, ...dataFields } = fields;
      const rows = throwOnError(
        await supabase
          .from(tableName)
          .update({ data: dataFields, updated_at: new Date().toISOString() })
          .eq('id', id)
          .select()
      );
      return flattenRow(rows?.[0]);
    },

    // delete(id) → void
    async delete(id) {
      throwOnError(await supabase.from(tableName).delete().eq('id', id));
    },
  };
}

// Build the entities proxy: base44.entities.Cliente → createEntityClient('Cliente')
const entitiesProxy = new Proxy(
  {},
  {
    get(_, entityName) {
      return createEntityClient(entityName);
    },
  }
);

// Stub auth: app runs without authentication (requiresAuth: false)
const authStub = {
  async me() {
    return { id: 'local-user', name: 'Usuário', email: 'user@flowdesk.local' };
  },
  logout() {
    // no-op: no auth session to clear
  },
  redirectToLogin() {
    // no-op: no external auth provider
  },
};

export const base44 = {
  entities: entitiesProxy,
  auth: authStub,
};
