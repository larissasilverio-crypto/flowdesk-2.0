import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  format,
  parseISO,
  addDays,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  isSameDay,
  isBefore,
  startOfDay,
  differenceInHours,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Plus,
  Search,
  Calendar as CalendarIcon,
  Clock,
  MoreVertical,
  Trash2,
  ChevronLeft,
  ChevronRight,
  List,
  Link as LinkIcon,
  Palette,
  RefreshCw,
  ArrowRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';

// Função para detectar cor (tarja selecionada tem prioridade, depois palavras-chave)
const getCorEvento = (evento, configuracoes) => {
  const obsEvento = String(evento?.observacoes || '');

  if (obsEvento.includes('[AGENDAMENTO_PUBLICACAO:AUDIENCIA]')) {
    return 'bg-pink-500 text-white border-pink-600';
  }

  if (obsEvento.includes('[AGENDAMENTO_PUBLICACAO:PERICIA]')) {
    return 'bg-orange-500 text-white border-orange-600';
  }

  if (evento.tarja_id) {
    const tarja = configuracoes.find((c) => c.id === evento.tarja_id);
    if (tarja) {
      return tarja.cor + ' text-white border-2';
    }
  }

  const titulo = evento.titulo;
  if (!titulo) return 'bg-slate-100 text-slate-700';

  const tituloLower = titulo.toLowerCase();

  for (const config of configuracoes.filter((c) => c.ativa)) {
    if (config.palavras_chave && config.palavras_chave.length > 0) {
      const palavrasConfig = config.palavras_chave.map((p) => p.toLowerCase());
      if (palavrasConfig.some((palavra) => tituloLower.includes(palavra))) {
        return config.cor + ' text-white border-2';
      }
    }
  }

  const palavrasVermelhas = [
    'extinto',
    'procedente',
    'improcedente',
    'parcialmente procedente',
    'sentenca',
    'sentença',
    'razoes',
    'razões',
    'contra-razoes',
    'contra-razões',
    'contrarrazoes',
    'contrarrazões',
  ];
  if (palavrasVermelhas.some((palavra) => tituloLower.includes(palavra))) {
    return 'bg-red-500 text-white border-red-600';
  }

  const palavrasLaranja = ['cumprir', 'emenda', 'emendar', 'manifestar'];
  if (palavrasLaranja.some((palavra) => tituloLower.includes(palavra))) {
    return 'bg-orange-500 text-white border-orange-600';
  }

  const palavrasVerde = [
    'execucao',
    'execução',
    'execucao de sentenca',
    'execução de sentença',
    'liquidacao',
    'liquidação',
    'calculo',
    'cálculo',
    'rpv',
    'oficio requisitorio',
    'ofício requisitório',
    'precatorio',
  ];
  if (palavrasVerde.some((palavra) => tituloLower.includes(palavra))) {
    return 'bg-green-600 text-white border-green-700';
  }

  const palavrasAzul = [
    'audiencia',
    'audiência',
    'pericia',
    'perícia',
    'instrucao e julgamento',
    'instrução e julgamento',
    'conciliacao',
    'conciliação',
  ];
  if (palavrasAzul.some((palavra) => tituloLower.includes(palavra))) {
    return 'bg-blue-600 text-white border-blue-700';
  }

  return 'bg-slate-100 text-slate-700';
};

function toISODateOnly(d) {
  return d.toISOString().split('T')[0];
}

const EMPTY_MONITORAMENTO_FORM = {
  numero_processo: '',
  cliente_parte: '',
  responsavel_id: '',
  tribunal_orgao_atual: '1º Grau',
  tipo_controle: 'Apenas acompanhamento',
  o_que_precisa_ser_feito: '',
  proxima_checagem: '',
  observacoes: '',
};

export default function Agenda() {
  const [activePage, setActivePage] = useState('agenda');
  const [publicacaoWebhookUrl, setPublicacaoWebhookUrl] = useState(() => {
    return (
      localStorage.getItem('n8n_publicacao_webhook_url') ||
      'https://marciaribeiro.app.n8n.cloud/webhook/publicacoes'
    );
  });

  const [publicacaoConvertWebhookUrl, setPublicacaoConvertWebhookUrl] = useState(() => {
    return (
      localStorage.getItem('n8n_publicacao_convert_webhook_url') ||
      'https://marciaribeiro.app.n8n.cloud/webhook/publicacoes/convertido'
    );
  });

  const [publicacaoSearch, setPublicacaoSearch] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [viewMode, setViewMode] = useState('mensal');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isConfigDialogOpen, setIsConfigDialogOpen] = useState(false);
  const [densidadeCalendario, setDensidadeCalendario] = useState(() => {
    return localStorage.getItem('agenda_densidade') || 'compacto';
  });
  const [filtros, setFiltros] = useState({
    responsavel: '',
    tipo: '',
    status: '',
    tarja: '',
  });
  const [configFormData, setConfigFormData] = useState({
    nome_tarja: '',
    cor: 'bg-slate-500',
    palavras_chave: [],
    descricao: '',
    ativa: true,
  });
  const [palavraChaveInput, setPalavraChaveInput] = useState('');
  const [formData, setFormData] = useState({
    titulo: '',
    descricao: '',
    data_evento: '',
    hora_inicio: '',
    hora_termino: '',
    tipo_evento: 'Outro',
    status: 'Agendado',
    tarja_id: '',
    responsaveis_ids: [],
    atendimento_id: '',
    tarefa_id: '',
    andamento_administrativo_id: '',
    controle_execucao_id: '',
    observacoes: '',
  });

  // Converter Publicação -> Tarefa
  const [isConvertPubDialogOpen, setIsConvertPubDialogOpen] = useState(false);
  const [convertPublicacao, setConvertPublicacao] = useState(null);
  const [convertPubResponsavelId, setConvertPubResponsavelId] = useState('');
  const [convertPubDataVencimento, setConvertPubDataVencimento] = useState('');
  const [convertPubDescricao, setConvertPubDescricao] = useState('');

  // Converter Publicação -> Controle de Execução
  const [isConvertPubControleDialogOpen, setIsConvertPubControleDialogOpen] = useState(false);
  const [convertPubControlePublicacao, setConvertPubControlePublicacao] = useState(null);
  const [convertPubControleForm, setConvertPubControleForm] = useState({
    titulo: '',
    atendimento_id: '',
    cliente: '',
    descricao: '',
    observacoes: '',
    tipo_movimentacao: '',
    anexos: [],
    status: 'Em aberto',
    responsavel_id: '',
  });

  // Fazer Agendamento
  const [isFazerAgendamentoDialogOpen, setIsFazerAgendamentoDialogOpen] = useState(false);
  const [agendamentoPublicacao, setAgendamentoPublicacao] = useState(null);
  const [agendamentoForm, setAgendamentoForm] = useState({
    tipo_agendamento: 'audiencia',
    titulo: '',
    descricao: '',
    data_evento: '',
    hora_inicio: '',
    hora_termino: '',
    responsavel_id: '',
    observacoes: '',
  });

  // NOVO: Converter Publicação -> Monitoramento Processual
  const [isConvertPubMonitorDialogOpen, setIsConvertPubMonitorDialogOpen] = useState(false);
  const [convertPubMonitorPublicacao, setConvertPubMonitorPublicacao] = useState(null);
  const [convertPubMonitorForm, setConvertPubMonitorForm] = useState(EMPTY_MONITORAMENTO_FORM);

  const queryClient = useQueryClient();

  const { data: eventos = [] } = useQuery({
    queryKey: ['agenda'],
    queryFn: () => base44.entities.Agenda.list('-data_evento'),
  });

  const { data: pessoas = [] } = useQuery({
    queryKey: ['pessoas'],
    queryFn: () => base44.entities.Pessoa.list(),
  });

  const { data: atendimentos = [] } = useQuery({
    queryKey: ['atendimentos'],
    queryFn: () => base44.entities.Atendimento.list(),
  });

  const { data: tarefas = [] } = useQuery({
    queryKey: ['tarefas'],
    queryFn: () => base44.entities.Tarefa.list(),
  });

  const { data: configuracoes = [] } = useQuery({
    queryKey: ['configuracoes-agenda'],
    queryFn: () => base44.entities.ConfiguracaoAgenda.list(),
  });

  const {
    data: publicacoesRaw,
    isLoading: isLoadingPublicacoes,
    refetch: refetchPublicacoes,
    isFetching: isFetchingPublicacoes,
    error: publicacoesError,
  } = useQuery({
    queryKey: ['publicacoes', publicacaoWebhookUrl],
    enabled: activePage === 'publicacao' && !!publicacaoWebhookUrl,
    queryFn: async () => {
      const res = await fetch(publicacaoWebhookUrl, { method: 'GET' });
      if (!res.ok) throw new Error(`Webhook error: ${res.status}`);
      const data = await res.json();
      if (Array.isArray(data)) return data;
      if (Array.isArray(data?.items)) return data.items;
      if (Array.isArray(data?.data)) return data.data;
      return [];
    },
    staleTime: 15000,
  });

  const publicacoes = Array.isArray(publicacoesRaw) ? publicacoesRaw : [];

  const getTagRowClass = (tag) => {
    const t = String(tag || '').toLowerCase().trim();
    if (t === 'urgente') return 'bg-red-50 border-red-200';
    if (t === 'audiencia') return 'bg-blue-50 border-blue-200';
    if (t === 'dinheiro') return 'bg-green-50 border-green-200';
    return 'bg-white border-slate-200';
  };

  const getTagBadgeClass = (tag) => {
    const t = String(tag || '').toLowerCase().trim();
    if (t === 'urgente') return 'bg-red-600 text-white';
    if (t === 'audiencia') return 'bg-blue-600 text-white';
    if (t === 'dinheiro') return 'bg-green-600 text-white';
    return 'bg-slate-200 text-slate-700';
  };

  const filteredPublicacoes = publicacoes.filter((row) => {
    if (!publicacaoSearch) return true;
    const s = publicacaoSearch.toLowerCase();
    return [
      row?.prazo,
      row?.['data da disponibilizacao'],
      row?.parte,
      row?.processo,
      row?.['prazo final'],
      row?.['data final prazos'],
      row?.tag,
      row?.rowNumber,
    ]
      .map((v) => String(v || '').toLowerCase())
      .some((v) => v.includes(s));
  });

  const createConfigMutation = useMutation({
    mutationFn: (data) => base44.entities.ConfiguracaoAgenda.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['configuracoes-agenda'] });
      setIsConfigDialogOpen(false);
      setConfigFormData({
        nome_tarja: '',
        cor: 'bg-slate-500',
        palavras_chave: [],
        descricao: '',
        ativa: true,
      });
      setPalavraChaveInput('');
    },
  });

  const deleteConfigMutation = useMutation({
    mutationFn: (id) => base44.entities.ConfiguracaoAgenda.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['configuracoes-agenda'] });
    },
  });

  const createNotification = useMutation({
    mutationFn: (data) => base44.entities.Notificacao.create(data),
  });

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const user = await base44.auth.me();
      const novoEvento = await base44.entities.Agenda.create(data);

      await base44.entities.HistoricoAgenda.create({
        evento_id: novoEvento.id,
        usuario_id: user.id,
        tipo_acao: 'Criação',
        descricao: `Evento "${novoEvento.titulo}" criado`,
      });

      return novoEvento;
    },
    onSuccess: (novoEvento) => {
      queryClient.invalidateQueries({ queryKey: ['agenda'] });

      if (novoEvento.responsaveis_ids && novoEvento.responsaveis_ids.length > 0) {
        novoEvento.responsaveis_ids.forEach((responsavelId) => {
          createNotification.mutate({
            titulo: '📅 Novo Evento Agendado',
            mensagem: `Você foi designado para: "${novoEvento.titulo}" em ${format(
              parseISO(novoEvento.data_evento),
              'dd/MM/yyyy'
            )} às ${novoEvento.hora_inicio}`,
            tipo: 'info',
            usuario_id: responsavelId,
            lida: false,
          });
        });
      }

      closeDialog();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      const user = await base44.auth.me();
      const eventoAtualizado = await base44.entities.Agenda.update(id, data);

      const alteracoes = [];
      if (editingItem?.titulo !== data.titulo) {
        alteracoes.push({
          evento_id: id,
          usuario_id: user.id,
          tipo_acao: 'Edição',
          campo_alterado: 'titulo',
          valor_anterior: editingItem?.titulo || '',
          valor_novo: data.titulo,
          descricao: 'Título alterado',
        });
      }
      if (
        editingItem &&
        (editingItem.data_evento !== data.data_evento ||
          editingItem.hora_inicio !== data.hora_inicio)
      ) {
        alteracoes.push({
          evento_id: id,
          usuario_id: user.id,
          tipo_acao: 'Reagendamento',
          campo_alterado: 'data_hora',
          valor_anterior: `${editingItem.data_evento} ${editingItem.hora_inicio}`,
          valor_novo: `${data.data_evento} ${data.hora_inicio}`,
          descricao: 'Evento reagendado',
        });
      }
      if (editingItem && editingItem.status !== data.status) {
        alteracoes.push({
          evento_id: id,
          usuario_id: user.id,
          tipo_acao: 'Mudança de Status',
          campo_alterado: 'status',
          valor_anterior: editingItem.status,
          valor_novo: data.status,
          descricao: `Status alterado de ${editingItem.status} para ${data.status}`,
        });
      }

      for (const alteracao of alteracoes) {
        await base44.entities.HistoricoAgenda.create(alteracao);
      }

      return eventoAtualizado;
    },
    onSuccess: (eventoAtualizado, { data: dataAtualizada }) => {
      queryClient.invalidateQueries({ queryKey: ['agenda'] });

      if (
        editingItem &&
        (editingItem.data_evento !== dataAtualizada.data_evento ||
          editingItem.hora_inicio !== dataAtualizada.hora_inicio)
      ) {
        if (dataAtualizada.responsaveis_ids && dataAtualizada.responsaveis_ids.length > 0) {
          dataAtualizada.responsaveis_ids.forEach((responsavelId) => {
            createNotification.mutate({
              titulo: '⚠️ Evento Reagendado',
              mensagem: `O evento "${eventoAtualizado.titulo}" foi alterado para ${format(
                parseISO(eventoAtualizado.data_evento),
                'dd/MM/yyyy'
              )} às ${eventoAtualizado.hora_inicio}`,
              tipo: 'alerta',
              usuario_id: responsavelId,
              lida: false,
            });
          });
        }
      }

      closeDialog();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const user = await base44.auth.me();
      const evento = eventos.find((e) => e.id === id);

      if (evento) {
        await base44.entities.HistoricoAgenda.create({
          evento_id: id,
          usuario_id: user.id,
          tipo_acao: 'Exclusão',
          descricao: `Evento "${evento.titulo}" excluído`,
        });
      }

      return base44.entities.Agenda.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agenda'] });
    },
  });

  const getPessoaNome = (id) => {
    const pessoa = pessoas.find((p) => p.id === id);
    return pessoa?.nome || '-';
  };

  const guessDefaultDueDateForPublicacao = (row) => {
    const raw = row?.['data final prazos'] || row?.['data da disponibilizacao'] || '';
    const s = String(raw || '').trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
      const [dd, mm, yyyy] = s.split('/');
      return `${yyyy}-${mm}-${dd}`;
    }
    return toISODateOnly(addDays(new Date(), 3));
  };

  const buildTituloFromPublicacao = (row) => {
    const proc = String(row?.processo || '').trim();
    const parte = String(row?.parte || '').trim();
    const tag = String(row?.tag || '').trim();
    const prazoFinal = row?.['prazo final'];
    const pf = prazoFinal === 0 || prazoFinal ? ` (prazo ${String(prazoFinal).trim()})` : '';

    const partePrefix = parte ? `${parte} — ` : '';
    const core = proc ? `Proc ${proc}` : 'Publicação';
    const extra = tag ? ` [${tag}]` : '';

    return `${partePrefix}${core}${pf}${extra}`.slice(0, 180);
  };

  const buildDescricaoFromPublicacao = (row) => {
    const lines = [];
    if (row?.prazo) lines.push(String(row.prazo));
    if (row?.processo) lines.push(`Processo: ${row.processo}`);
    if (row?.parte) lines.push(`Parte: ${row.parte}`);
    if (row?.['data da disponibilizacao'])
      lines.push(`Disponibilização: ${row['data da disponibilizacao']}`);
    if (row?.['data final prazos']) lines.push(`Data final: ${row['data final prazos']}`);
    if (row?.['prazo final'] || row?.['prazo final'] === 0)
      lines.push(`Prazo final: ${row['prazo final']}`);
    if (row?.tag) lines.push(`Tag: ${row.tag}`);
    if (row?.rowNumber || row?.rowNumber === 0) lines.push(`rowNumber: ${row.rowNumber}`);
    return lines.join('\n');
  };

  const buildControleDraftFromPublicacao = (row) => {
    const tag = String(row?.tag || '').trim();
    const prazo = String(row?.prazo || '').trim();

    return {
      titulo: buildTituloFromPublicacao(row),
      atendimento_id: '',
      cliente: String(row?.parte || '').trim(),
      descricao: buildDescricaoFromPublicacao(row),
      observacoes: 'Origem: Publicação',
      tipo_movimentacao: tag || prazo || 'Publicação',
      anexos: [],
      status: 'Em aberto',
      responsavel_id: '',
    };
  };

  const buildAgendamentoDraftFromPublicacao = (row) => {
    const guessedDate = guessDefaultDueDateForPublicacao(row);
    const titleBase = buildTituloFromPublicacao(row);

    return {
      tipo_agendamento: 'audiencia',
      titulo: `Audiência — ${titleBase}`.slice(0, 180),
      descricao: buildDescricaoFromPublicacao(row),
      data_evento: guessedDate,
      hora_inicio: '09:00',
      hora_termino: '',
      responsavel_id: '',
      observacoes: 'Origem: Publicação [AGENDAMENTO_PUBLICACAO:AUDIENCIA]',
    };
  };

  // NOVO: draft de Monitoramento Processual
  const buildMonitoramentoDraftFromPublicacao = (row) => {
    return {
      numero_processo: String(row?.processo || '').trim(),
      cliente_parte: String(row?.parte || '').trim(),
      responsavel_id: '',
      tribunal_orgao_atual: '1º Grau',
      tipo_controle: 'Apenas acompanhamento',
      o_que_precisa_ser_feito: 'Analisar publicação e acompanhar próximos andamentos.',
      proxima_checagem: guessDefaultDueDateForPublicacao(row),
      observacoes: `Origem: Publicação\n\n${buildDescricaoFromPublicacao(row)}`,
    };
  };

  const createAgendaEventForTask = async ({ tarefa, responsavelId, dateISO }) => {
    const user = await base44.auth.me();

    const payload = {
      titulo: tarefa?.titulo || 'Tarefa',
      descricao: tarefa?.descricao || '',
      data_evento: dateISO,
      hora_inicio: '09:00',
      hora_termino: '',
      tipo_evento: 'Prazo processual',
      status: 'Agendado',
      tarja_id: '',
      responsaveis_ids: responsavelId ? [responsavelId] : [],
      atendimento_id: '',
      tarefa_id: tarefa?.id || '',
      andamento_administrativo_id: '',
      controle_execucao_id: '',
      observacoes: 'Criado automaticamente a partir de Publicação.',
    };

    const novoEvento = await base44.entities.Agenda.create(payload);

    await base44.entities.HistoricoAgenda.create({
      evento_id: novoEvento.id,
      usuario_id: user.id,
      tipo_acao: 'Criação',
      descricao: `Evento "${novoEvento.titulo}" criado (origem: Publicação)`,
    });

    if (payload.responsaveis_ids && payload.responsaveis_ids.length > 0) {
      payload.responsaveis_ids.forEach((rid) => {
        createNotification.mutate({
          titulo: '📅 Novo Evento (Publicação)',
          mensagem: `Você foi designado para: "${novoEvento.titulo}" em ${format(
            parseISO(novoEvento.data_evento),
            'dd/MM/yyyy'
          )} às ${novoEvento.hora_inicio}`,
          tipo: 'info',
          usuario_id: rid,
          lida: false,
        });
      });
    }

    return novoEvento;
  };

  const openConvertPublicacaoDialog = (row) => {
    setConvertPublicacao(row);
    setConvertPubResponsavelId('');
    setConvertPubDataVencimento(guessDefaultDueDateForPublicacao(row));
    setConvertPubDescricao(buildDescricaoFromPublicacao(row));
    setIsConvertPubDialogOpen(true);
  };

  const closeConvertPublicacaoDialog = () => {
    setIsConvertPubDialogOpen(false);
    setConvertPublicacao(null);
    setConvertPubResponsavelId('');
    setConvertPubDataVencimento('');
    setConvertPubDescricao('');
  };

  const openConvertPublicacaoControleDialog = (row) => {
    setConvertPubControlePublicacao(row);
    setConvertPubControleForm(buildControleDraftFromPublicacao(row));
    setIsConvertPubControleDialogOpen(true);
  };

  const closeConvertPublicacaoControleDialog = () => {
    setIsConvertPubControleDialogOpen(false);
    setConvertPubControlePublicacao(null);
    setConvertPubControleForm({
      titulo: '',
      atendimento_id: '',
      cliente: '',
      descricao: '',
      observacoes: '',
      tipo_movimentacao: '',
      anexos: [],
      status: 'Em aberto',
      responsavel_id: '',
    });
  };

  const openFazerAgendamentoDialog = (row) => {
    setAgendamentoPublicacao(row);
    setAgendamentoForm(buildAgendamentoDraftFromPublicacao(row));
    setIsFazerAgendamentoDialogOpen(true);
  };

  const closeFazerAgendamentoDialog = () => {
    setIsFazerAgendamentoDialogOpen(false);
    setAgendamentoPublicacao(null);
    setAgendamentoForm({
      tipo_agendamento: 'audiencia',
      titulo: '',
      descricao: '',
      data_evento: '',
      hora_inicio: '',
      hora_termino: '',
      responsavel_id: '',
      observacoes: '',
    });
  };

  // NOVO: open/close monitoramento dialog
  const openConvertPublicacaoMonitorDialog = (row) => {
    setConvertPubMonitorPublicacao(row);
    setConvertPubMonitorForm(buildMonitoramentoDraftFromPublicacao(row));
    setIsConvertPubMonitorDialogOpen(true);
  };

  const closeConvertPublicacaoMonitorDialog = () => {
    setIsConvertPubMonitorDialogOpen(false);
    setConvertPubMonitorPublicacao(null);
    setConvertPubMonitorForm(EMPTY_MONITORAMENTO_FORM);
  };

  const markPublicacaoConverted = async (rowNumber) => {
    if (!publicacaoConvertWebhookUrl) throw new Error('Webhook de conversão não configurado.');
    if (!rowNumber && rowNumber !== 0) throw new Error('rowNumber ausente na publicação.');

    const res = await fetch(publicacaoConvertWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rowNumber, convertido: true }),
    });

    if (!res.ok) {
      throw new Error(`Falha ao marcar convertido (HTTP ${res.status})`);
    }

    const data = await res.json();
    if (!data?.ok) throw new Error('n8n não confirmou conversão.');
    return data;
  };

  const concluirPublicacaoMutation = useMutation({
    mutationFn: async (row) => {
      if (!row) throw new Error('Publicação inválida.');
      await markPublicacaoConverted(row.rowNumber);
      return row;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['publicacoes'] });
      refetchPublicacoes();
      alert('✅ Publicação concluída e marcada como convertida!');
    },
    onError: (error) => {
      alert('Erro: ' + (error?.message || 'Falha ao concluir publicação.'));
    },
  });

  const converterPublicacaoEmTarefaMutation = useMutation({
    mutationFn: async ({ row, responsavel_id, data_vencimento, descricao }) => {
      if (!row) throw new Error('Publicação inválida.');
      if (!responsavel_id) throw new Error('Selecione o responsável para criar a tarefa.');
      if (!data_vencimento) throw new Error('Selecione a data de vencimento para criar a tarefa.');

      const rowNumber = row?.rowNumber;
      const hoje = new Date();
      const titulo = buildTituloFromPublicacao(row);

      const payloadTarefa = {
        titulo,
        descricao: descricao ?? buildDescricaoFromPublicacao(row),
        responsavel_id,
        data_inicio: toISODateOnly(hoje),
        data_vencimento,
        status: 'Pendente',
        prioridade: 'Média',
        observacoes: 'Origem: Publicação',
        motivo_atraso: '',
        retorno_executivo: '',
        anexos: [],
        atendimento_id: '',
      };

      const novaTarefa = await base44.entities.Tarefa.create(payloadTarefa);

      await createAgendaEventForTask({
        tarefa: novaTarefa,
        responsavelId: responsavel_id,
        dateISO: data_vencimento,
      });

      await markPublicacaoConverted(rowNumber);

      return novaTarefa;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['tarefas'] });
      await queryClient.invalidateQueries({ queryKey: ['agenda'] });
      await queryClient.invalidateQueries({ queryKey: ['publicacoes'] });
      closeConvertPublicacaoDialog();
      refetchPublicacoes();
      alert('✅ Tarefa criada, evento criado e publicação marcada como convertida!');
    },
    onError: (error) => {
      alert('Erro: ' + (error?.message || 'Falha ao converter em tarefa.'));
    },
  });

  const converterPublicacaoEmControleMutation = useMutation({
    mutationFn: async ({ row, controleData }) => {
      if (!row) throw new Error('Publicação inválida.');
      if (!controleData?.titulo?.trim()) {
        throw new Error('O título é obrigatório para criar o Controle de Execução.');
      }

      const payload = {
        titulo: controleData.titulo.trim(),
        atendimento_id: controleData.atendimento_id || '',
        cliente: controleData.cliente || '',
        descricao: controleData.descricao || '',
        observacoes: controleData.observacoes || '',
        tipo_movimentacao: controleData.tipo_movimentacao || '',
        anexos: Array.isArray(controleData.anexos) ? controleData.anexos : [],
        status: controleData.status || 'Em aberto',
        responsavel_id: controleData.responsavel_id || '',
      };

      const controle = await base44.entities.ControleProcessoExecucao.create(payload);

      await base44.entities.Auditoria.create({
        modulo: 'Processo Judicial',
        tipo_acao: 'Criação',
        registro_id: controle.id,
        registro_nome: controle.titulo,
        observacao_sistema: `Controle de Execução criado via Publicação: ${controle.titulo}`,
      });

      await markPublicacaoConverted(row.rowNumber);

      return controle;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['controle-execucao'] });
      await queryClient.invalidateQueries({ queryKey: ['publicacoes'] });
      closeConvertPublicacaoControleDialog();
      refetchPublicacoes();
      alert('✅ Controle de Execução criado e publicação marcada como convertida!');
    },
    onError: (error) => {
      alert('Erro: ' + (error?.message || 'Falha ao converter para Controle de Execução.'));
    },
  });

  const fazerAgendamentoMutation = useMutation({
    mutationFn: async ({ row, agendamentoData }) => {
      if (!row) throw new Error('Publicação inválida.');
      if (!agendamentoData?.titulo?.trim()) throw new Error('O título é obrigatório.');
      if (!agendamentoData?.data_evento) throw new Error('A data é obrigatória.');
      if (!agendamentoData?.hora_inicio) throw new Error('A hora de início é obrigatória.');
      if (!agendamentoData?.responsavel_id) throw new Error('Selecione o responsável.');

      const tipo = String(agendamentoData.tipo_agendamento || 'audiencia').toLowerCase();
      const tipoLabel = tipo === 'pericia' ? 'Perícia' : 'Audiência';
      const tipoEvento = tipo === 'pericia' ? 'Perícia' : 'Audiência';
      const marker =
        tipo === 'pericia'
          ? '[AGENDAMENTO_PUBLICACAO:PERICIA]'
          : '[AGENDAMENTO_PUBLICACAO:AUDIENCIA]';

      const user = await base44.auth.me();

      const payload = {
        titulo: agendamentoData.titulo.trim(),
        descricao: agendamentoData.descricao || '',
        data_evento: agendamentoData.data_evento,
        hora_inicio: agendamentoData.hora_inicio,
        hora_termino: agendamentoData.hora_termino || '',
        tipo_evento: tipoEvento,
        status: 'Agendado',
        tarja_id: '',
        responsaveis_ids: [agendamentoData.responsavel_id],
        atendimento_id: '',
        tarefa_id: '',
        andamento_administrativo_id: '',
        controle_execucao_id: '',
        observacoes:
          (agendamentoData.observacoes || `Origem: Publicação ${marker}`) +
          (String(agendamentoData.observacoes || '').includes(marker) ? '' : ` ${marker}`),
      };

      const novoEvento = await base44.entities.Agenda.create(payload);

      await base44.entities.HistoricoAgenda.create({
        evento_id: novoEvento.id,
        usuario_id: user.id,
        tipo_acao: 'Criação',
        descricao: `${tipoLabel} "${novoEvento.titulo}" criada a partir de Publicação`,
      });

      createNotification.mutate({
        titulo: tipo === 'pericia' ? '🟧 Perícia Marcada' : '🎀 Audiência Marcada',
        mensagem: `Você foi designado para ${tipo === 'pericia' ? 'a perícia' : 'a audiência'} "${novoEvento.titulo}" em ${format(
          parseISO(novoEvento.data_evento),
          'dd/MM/yyyy'
        )} às ${novoEvento.hora_inicio}`,
        tipo: 'info',
        usuario_id: agendamentoData.responsavel_id,
        lida: false,
      });

      await markPublicacaoConverted(row.rowNumber);

      return novoEvento;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['agenda'] });
      await queryClient.invalidateQueries({ queryKey: ['publicacoes'] });
      await queryClient.invalidateQueries({ queryKey: ['notificacoes'] });
      await queryClient.invalidateQueries({ queryKey: ['notificacoes-nao-lidas'] });
      closeFazerAgendamentoDialog();
      refetchPublicacoes();
      alert('✅ Agendamento criado na Agenda e publicação marcada como convertida!');
    },
    onError: (error) => {
      alert('Erro: ' + (error?.message || 'Falha ao criar agendamento.'));
    },
  });

  // NOVO: mutation para Monitoramento Processual
  const converterPublicacaoEmMonitoramentoMutation = useMutation({
    mutationFn: async ({ row, monitorData }) => {
      if (!row) throw new Error('Publicação inválida.');

      const required = [
        'numero_processo',
        'cliente_parte',
        'responsavel_id',
        'tribunal_orgao_atual',
        'tipo_controle',
        'o_que_precisa_ser_feito',
        'proxima_checagem',
      ];

      for (const field of required) {
        if (!String(monitorData?.[field] || '').trim()) {
          throw new Error('Preencha todos os campos obrigatórios do Monitoramento Processual.');
        }
      }

      const registro = await base44.entities.MonitoramentoProcessual.create({
        numero_processo: monitorData.numero_processo.trim(),
        cliente_parte: monitorData.cliente_parte.trim(),
        responsavel_id: monitorData.responsavel_id,
        tribunal_orgao_atual: monitorData.tribunal_orgao_atual,
        tipo_controle: monitorData.tipo_controle,
        o_que_precisa_ser_feito: monitorData.o_que_precisa_ser_feito.trim(),
        proxima_checagem: monitorData.proxima_checagem,
        observacoes: monitorData.observacoes || '',
        status: 'Em Monitoramento',
      });

      await base44.entities.Auditoria.create({
        modulo: 'Processo Judicial',
        tipo_acao: 'Criação',
        registro_id: registro.id,
        registro_nome: `Proc ${registro.numero_processo}`,
        observacao_sistema: `Monitoramento Processual criado via Publicação: Proc ${registro.numero_processo}`,
      });

      await markPublicacaoConverted(row.rowNumber);

      return registro;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['monitoramento-processual'] });
      await queryClient.invalidateQueries({ queryKey: ['publicacoes'] });
      closeConvertPublicacaoMonitorDialog();
      refetchPublicacoes();
      alert('✅ Monitoramento Processual criado e publicação marcada como convertida!');
    },
    onError: (error) => {
      alert('Erro: ' + (error?.message || 'Falha ao criar Monitoramento Processual.'));
    },
  });

  useEffect(() => {
    if (!eventos || eventos.length === 0) return;

    const agora = new Date();
    const hoje = startOfDay(agora);

    eventos.forEach((evento) => {
      if (evento.status === 'Agendado') {
        const dataEvento = parseISO(evento.data_evento);
        const dataEventoInicio = startOfDay(dataEvento);

        if (isBefore(dataEventoInicio, hoje)) {
          if (evento.responsaveis_ids && evento.responsaveis_ids.length > 0) {
            evento.responsaveis_ids.forEach((responsavelId) => {
              createNotification.mutate({
                titulo: '⚠️ Evento Não Realizado',
                mensagem: `O evento "${evento.titulo}" estava agendado para ${format(
                  dataEventoInicio,
                  'dd/MM/yyyy'
                )} e ainda está com status "Agendado"`,
                tipo: 'alerta',
                usuario_id: responsavelId,
                lida: false,
              });
            });
          }
        } else {
          const [hora, minuto] = String(evento.hora_inicio || '00:00')
            .split(':')
            .map(Number);
          const dataHoraEvento = new Date(dataEvento);
          dataHoraEvento.setHours(hora || 0, minuto || 0, 0, 0);

          const horasAteEvento = differenceInHours(dataHoraEvento, agora);

          if (horasAteEvento >= 0 && horasAteEvento <= 24 && horasAteEvento % 2 === 0) {
            if (evento.responsaveis_ids && evento.responsaveis_ids.length > 0) {
              evento.responsaveis_ids.forEach((responsavelId) => {
                createNotification.mutate({
                  titulo: `⏰ Lembrete: Evento em ${horasAteEvento}h`,
                  mensagem: `"${evento.titulo}" está agendado para ${format(
                    dataEventoInicio,
                    'dd/MM/yyyy'
                  )} às ${evento.hora_inicio}`,
                  tipo: 'prazo_vencendo',
                  usuario_id: responsavelId,
                  lida: false,
                });
              });
            }
          }
        }
      }
    });
  }, [eventos]);

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingItem(null);
    setFormData({
      titulo: '',
      descricao: '',
      data_evento: '',
      hora_inicio: '',
      hora_termino: '',
      tipo_evento: 'Outro',
      status: 'Agendado',
      tarja_id: '',
      responsaveis_ids: [],
      atendimento_id: '',
      tarefa_id: '',
      andamento_administrativo_id: '',
      controle_execucao_id: '',
      observacoes: '',
    });
  };

  const openEditDialog = (item) => {
    setEditingItem(item);
    setFormData({
      titulo: item.titulo || '',
      descricao: item.descricao || '',
      data_evento: item.data_evento || '',
      hora_inicio: item.hora_inicio || '',
      hora_termino: item.hora_termino || '',
      tipo_evento: item.tipo_evento || 'Outro',
      status: item.status || 'Agendado',
      tarja_id: item.tarja_id || '',
      responsaveis_ids: item.responsaveis_ids || [],
      atendimento_id: item.atendimento_id || '',
      tarefa_id: item.tarefa_id || '',
      andamento_administrativo_id: item.andamento_administrativo_id || '',
      controle_execucao_id: item.controle_execucao_id || '',
      observacoes: item.observacoes || '',
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    const novaData = formData.data_evento;
    const novaHoraInicio = formData.hora_inicio;
    const novaHoraFim = formData.hora_termino;

    if (novaData && novaHoraInicio && novaHoraFim && formData.responsaveis_ids.length > 0) {
      const conflitos = eventos.filter((ev) => {
        if (editingItem && ev.id === editingItem.id) return false;
        if (ev.data_evento !== novaData) return false;
        if (!ev.responsaveis_ids || ev.responsaveis_ids.length === 0) return false;

        const responsaveisEmComum = ev.responsaveis_ids.some((r) =>
          formData.responsaveis_ids.includes(r)
        );
        if (!responsaveisEmComum) return false;

        const inicioExistente = ev.hora_inicio;
        const fimExistente = ev.hora_termino;

        return (
          (novaHoraInicio >= inicioExistente && novaHoraInicio < fimExistente) ||
          (novaHoraFim > inicioExistente && novaHoraFim <= fimExistente) ||
          (novaHoraInicio <= inicioExistente && novaHoraFim >= fimExistente)
        );
      });

      if (conflitos.length > 0) {
        const confirmar = window.confirm(
          `⚠️ ATENÇÃO: Há ${conflitos.length} evento(s) no mesmo horário para este(s) responsável(is). Deseja continuar?`
        );
        if (!confirmar) return;
      }
    }

    if (editingItem) {
      updateMutation.mutate({ id: editingItem.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  useEffect(() => {
    localStorage.setItem('agenda_densidade', densidadeCalendario);
  }, [densidadeCalendario]);

  const filteredEventos = eventos
    .filter((e) => {
      const matchesSearch =
        e.titulo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        e.descricao?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesResponsavel =
        !filtros.responsavel ||
        (e.responsaveis_ids && e.responsaveis_ids.includes(filtros.responsavel));

      const matchesTipo = !filtros.tipo || e.tipo_evento === filtros.tipo;
      const matchesStatus = !filtros.status || e.status === filtros.status;
      const matchesTarja = !filtros.tarja || e.tarja_id === filtros.tarja;

      return matchesSearch && matchesResponsavel && matchesTipo && matchesStatus && matchesTarja;
    })
    .sort((a, b) => {
      const dataCompare = a.data_evento.localeCompare(b.data_evento);
      if (dataCompare !== 0) return dataCompare;
      return String(a.hora_inicio || '').localeCompare(String(b.hora_inicio || ''));
    });

  const densidadeConfig = {
    compacto: { minH: 'min-h-16', textSize: 'text-xs', padding: 'p-1.5', iconSize: 'h-2 w-2' },
    medio: { minH: 'min-h-20', textSize: 'text-sm', padding: 'p-2', iconSize: 'h-2.5 w-2.5' },
    expandido: { minH: 'min-h-28', textSize: 'text-base', padding: 'p-3', iconSize: 'h-3 w-3' },
  };
  const densidade = densidadeConfig[densidadeCalendario];

  const renderMonthCalendar = () => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const startDate = startOfWeek(monthStart, { locale: ptBR });
    const endDate = endOfWeek(monthEnd, { locale: ptBR });

    const days = [];
    let day = startDate;

    while (day <= endDate) {
      days.push(day);
      day = addDays(day, 1);
    }

    const weeks = [];
    for (let i = 0; i < days.length; i += 7) {
      weeks.push(days.slice(i, i + 7));
    }

    return (
      <div className="bg-gradient-to-br from-white to-slate-50 rounded-3xl border-2 border-slate-200 overflow-hidden shadow-xl">
        <div className="flex items-center justify-between p-4 bg-gradient-to-r from-stone-700 to-stone-900 text-white">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCurrentDate(addDays(currentDate, -30))}
            className="text-white hover:bg-white/20"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <h3 className="text-lg font-bold capitalize">
            {format(currentDate, 'MMMM yyyy', { locale: ptBR })}
          </h3>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCurrentDate(addDays(currentDate, 30))}
            className="text-white hover:bg-white/20"
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>

        <div className="grid grid-cols-7 bg-gradient-to-r from-slate-100 to-slate-200 border-b-2 border-slate-300">
          {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((dia, idx) => (
            <div
              key={dia}
              className={`p-2 text-center text-xs font-bold uppercase tracking-wider border-r border-slate-300 last:border-r-0 ${
                idx === 0 || idx === 6 ? 'text-red-700' : 'text-slate-700'
              }`}
            >
              {dia}
            </div>
          ))}
        </div>

        {weeks.map((week, weekIdx) => (
          <div key={weekIdx} className="grid grid-cols-7 border-b border-slate-200 last:border-b-0">
            {week.map((dayItem, dayIdx) => {
              const eventosNoDia = filteredEventos.filter((e) =>
                isSameDay(parseISO(e.data_evento), dayItem)
              );
              const isCurrentMonth = dayItem >= monthStart && dayItem <= monthEnd;
              const isToday = isSameDay(dayItem, new Date());
              const isWeekend = dayIdx === 0 || dayIdx === 6;

              return (
                <div
                  key={dayIdx}
                  className={`${densidade.minH} ${densidade.padding} border-r border-slate-200 last:border-r-0 relative transition-all hover:bg-slate-50 ${
                    !isCurrentMonth ? 'bg-slate-100/50' : 'bg-white'
                  } ${
                    isToday
                      ? 'bg-gradient-to-br from-blue-50 to-blue-100 ring-2 ring-blue-500 ring-inset'
                      : ''
                  } ${isWeekend ? 'bg-slate-50/50' : ''}`}
                >
                  {isToday && (
                    <div className="absolute top-2 right-2">
                      <span className="flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
                      </span>
                    </div>
                  )}
                  <div
                    className={`text-sm font-bold mb-1 ${
                      !isCurrentMonth
                        ? 'text-slate-400'
                        : isToday
                        ? 'text-blue-700'
                        : isWeekend
                        ? 'text-red-600'
                        : 'text-slate-800'
                    }`}
                  >
                    {format(dayItem, 'd')}
                  </div>
                  <div className="space-y-1">
                    {eventosNoDia.slice(0, 2).map((evento) => {
                      const corEvento = getCorEvento(evento, configuracoes);
                      const isDestacado = !filtros.tarja || evento.tarja_id === filtros.tarja;
                      return (
                        <div
                          key={evento.id}
                          className={`${densidade.textSize} p-1 rounded-lg ${corEvento} truncate hover:scale-105 transition-all shadow-md font-medium group relative ${
                            !isDestacado ? 'opacity-30 blur-[1px]' : 'ring-2 ring-offset-1'
                          }`}
                        >
                          <div
                            onClick={() => openEditDialog(evento)}
                            onDoubleClick={() => openEditDialog(evento)}
                            className="cursor-pointer"
                          >
                            <div className="flex items-center gap-1">
                              <Clock className={densidade.iconSize} />
                              <span>{evento.hora_inicio}</span>
                            </div>
                            <div className={`truncate ${densidade.textSize}`}>{evento.titulo}</div>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (window.confirm('Deseja realmente excluir este evento?')) {
                                deleteMutation.mutate(evento.id);
                              }
                            }}
                            className="absolute top-0.5 right-0.5 opacity-0 group-hover:opacity-100 transition-opacity bg-red-600 hover:bg-red-700 text-white rounded p-0.5"
                          >
                            <Trash2 className="h-2 w-2" />
                          </button>
                        </div>
                      );
                    })}
                    {eventosNoDia.length > 2 && (
                      <div className="text-xs text-center text-slate-600 font-semibold bg-slate-200 rounded-lg p-1">
                        +{eventosNoDia.length - 2}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    );
  };

  const renderWeekCalendar = () => {
    const weekStart = startOfWeek(currentDate, { locale: ptBR });
    const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

    return (
      <div className="bg-gradient-to-br from-white to-slate-50 rounded-3xl border-2 border-slate-200 overflow-hidden shadow-xl">
        <div className="flex items-center justify-between p-4 bg-gradient-to-r from-stone-700 to-stone-900 text-white">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCurrentDate(addDays(currentDate, -7))}
            className="text-white hover:bg-white/20"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <h3 className="text-base font-bold">
            {format(weekStart, 'd MMM', { locale: ptBR })} -{' '}
            {format(addDays(weekStart, 6), 'd MMM yyyy', { locale: ptBR })}
          </h3>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCurrentDate(addDays(currentDate, 7))}
            className="text-white hover:bg-white/20"
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>

        <div className="grid grid-cols-7">
          {days.map((dayItem, idx) => {
            const eventosNoDia = filteredEventos.filter((e) =>
              isSameDay(parseISO(e.data_evento), dayItem)
            );
            const isToday = isSameDay(dayItem, new Date());
            const isWeekend = idx === 0 || idx === 6;

            return (
              <div key={idx} className="border-r last:border-r-0">
                <div
                  className={`p-2 text-center border-b-2 transition-all ${
                    isToday
                      ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white'
                      : isWeekend
                      ? 'bg-gradient-to-br from-red-50 to-red-100'
                      : 'bg-gradient-to-br from-slate-100 to-slate-200'
                  }`}
                >
                  <div
                    className={`text-xs font-semibold uppercase tracking-wider ${
                      isToday ? 'text-blue-100' : 'text-slate-600'
                    }`}
                  >
                    {format(dayItem, 'EEE', { locale: ptBR })}
                  </div>
                  <div
                    className={`text-lg font-bold ${
                      isToday ? 'text-white' : isWeekend ? 'text-red-700' : 'text-slate-800'
                    }`}
                  >
                    {format(dayItem, 'd')}
                  </div>
                </div>
                <div className={`p-2 space-y-2 min-h-48 ${isWeekend ? 'bg-slate-50/50' : 'bg-white'}`}>
                  {eventosNoDia.map((evento) => {
                    const corEvento = getCorEvento(evento, configuracoes);
                    return (
                      <div
                        key={evento.id}
                        className={`text-xs p-2 rounded-lg ${corEvento} hover:scale-105 transition-all shadow-lg font-medium group relative`}
                      >
                        <div onClick={() => openEditDialog(evento)} className="cursor-pointer">
                          <div className="flex items-center gap-1.5 font-bold mb-1">
                            <Clock className="h-3 w-3" />
                            {evento.hora_inicio}
                            {evento.hora_termino && ` - ${evento.hora_termino}`}
                          </div>
                          <div className="line-clamp-2">{evento.titulo}</div>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (window.confirm('Deseja realmente excluir este evento?')) {
                              deleteMutation.mutate(evento.id);
                            }
                          }}
                          className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity bg-red-600 hover:bg-red-700 text-white rounded p-0.5"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    );
                  })}
                  {eventosNoDia.length === 0 && (
                    <div className="text-center text-slate-400 py-8 text-xs">Sem eventos</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 md:text-3xl">
              {activePage === 'agenda' ? 'Agenda' : 'Publicações'}
            </h1>
            <p className="text-slate-600">
              {activePage === 'agenda'
                ? 'Controle operacional e organização'
                : 'Lista espelhada do Google Sheets (via webhook n8n)'}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => setIsConfigDialogOpen(true)}
              variant="outline"
              className="border-slate-300"
              disabled={activePage !== 'agenda'}
            >
              <Palette className="mr-2 h-4 w-4" />
              Gerenciar Tarjas
            </Button>

            <Button
              onClick={() => setActivePage(activePage === 'publicacao' ? 'agenda' : 'publicacao')}
              variant="outline"
              className="border-slate-300"
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              Publicação
            </Button>

            <Button
              onClick={() => {
                setEditingItem(null);
                setIsDialogOpen(true);
              }}
              className="bg-gradient-to-r from-stone-700 to-stone-800 hover:from-stone-800 hover:to-stone-900"
              disabled={activePage !== 'agenda'}
            >
              <Plus className="mr-2 h-4 w-4" />
              Novo Evento
            </Button>
          </div>
        </div>

        {activePage === 'publicacao' && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  placeholder="Buscar publicações..."
                  value={publicacaoSearch}
                  onChange={(e) => setPublicacaoSearch(e.target.value)}
                  className="pl-10"
                />
              </div>

              <div className="flex flex-wrap gap-2 items-center">
                <Badge className={getTagBadgeClass('normal')}>normal</Badge>
                <Badge className={getTagBadgeClass('urgente')}>urgente</Badge>
                <Badge className={getTagBadgeClass('audiencia')}>audiencia</Badge>
                <Badge className={getTagBadgeClass('dinheiro')}>dinheiro</Badge>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    const next = window.prompt(
                      'Cole a URL do webhook n8n (GET) /publicacoes:',
                      publicacaoWebhookUrl
                    );
                    if (next && next.trim()) {
                      const v = next.trim();
                      localStorage.setItem('n8n_publicacao_webhook_url', v);
                      setPublicacaoWebhookUrl(v);

                      try {
                        const maybe = v.replace(/\/publicacoes\/?$/, '/publicacoes/convertido');
                        localStorage.setItem('n8n_publicacao_convert_webhook_url', maybe);
                        setPublicacaoConvertWebhookUrl(maybe);
                      } catch (e) {}
                    }
                  }}
                >
                  <LinkIcon className="mr-2 h-4 w-4" />
                  Webhook
                </Button>

                <Button onClick={() => refetchPublicacoes()} className="bg-slate-900 hover:bg-slate-800">
                  <RefreshCw className={`mr-2 h-4 w-4 ${isFetchingPublicacoes ? 'animate-spin' : ''}`} />
                  Atualizar
                </Button>
              </div>
            </div>

            {publicacoesError && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
                Erro ao buscar webhook: {String(publicacoesError?.message || publicacoesError)}
              </div>
            )}

            {isLoadingPublicacoes ? (
              <div className="space-y-3">
                <Skeleton className="h-10 w-64" />
                <Skeleton className="h-64 rounded-2xl" />
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                <div className="overflow-auto">
                  <table className="min-w-[1200px] w-full text-sm">
                    <thead className="sticky top-0 bg-slate-50 border-b border-slate-200">
                      <tr className="text-left text-slate-600">
                        <th className="p-3 font-semibold">tag</th>
                        <th className="p-3 font-semibold">prazo</th>
                        <th className="p-3 font-semibold">processo</th>
                        <th className="p-3 font-semibold">parte</th>
                        <th className="p-3 font-semibold">data da disponibilizacao</th>
                        <th className="p-3 font-semibold">prazo final</th>
                        <th className="p-3 font-semibold">data final prazos</th>
                        <th className="p-3 font-semibold text-right">ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPublicacoes.map((row, idx) => {
                        const key = `${row?.rowNumber || idx}-${row?.processo || ''}`;
                        const isAudienciaTag =
                          String(row?.tag || '').toLowerCase().trim() === 'audiencia';

                        return (
                          <tr
                            key={key}
                            className={`border-b last:border-b-0 ${getTagRowClass(row?.tag)} hover:brightness-[0.99] transition`}
                          >
                            <td className="p-3">
                              <Badge className={getTagBadgeClass(row?.tag)}>{row?.tag || 'normal'}</Badge>
                            </td>
                            <td className="p-3 whitespace-pre-wrap">{row?.prazo || ''}</td>
                            <td className="p-3 font-mono">{row?.processo || ''}</td>
                            <td className="p-3 whitespace-pre-wrap">{row?.parte || ''}</td>
                            <td className="p-3">{row?.['data da disponibilizacao'] || ''}</td>
                            <td className="p-3">{row?.['prazo final'] ?? ''}</td>
                            <td className="p-3">{row?.['data final prazos'] || ''}</td>
                            <td className="p-3 text-right">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8">
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem
                                    onClick={() => openConvertPublicacaoDialog(row)}
                                    className="text-blue-600"
                                  >
                                    <ArrowRight className="mr-2 h-4 w-4" />
                                    Converter em Tarefa
                                  </DropdownMenuItem>

                                  <DropdownMenuItem
                                    onClick={() => openConvertPublicacaoControleDialog(row)}
                                    className="text-emerald-700"
                                  >
                                    <ArrowRight className="mr-2 h-4 w-4" />
                                    Converter para Controle de Execução
                                  </DropdownMenuItem>

                                  <DropdownMenuItem
                                    onClick={() => openConvertPublicacaoMonitorDialog(row)}
                                    className="text-violet-700"
                                  >
                                    <ArrowRight className="mr-2 h-4 w-4" />
                                    Monitorar Processo
                                  </DropdownMenuItem>

                                  {isAudienciaTag && (
                                    <DropdownMenuItem
                                      onClick={() => openFazerAgendamentoDialog(row)}
                                      className="text-pink-700"
                                    >
                                      <CalendarIcon className="mr-2 h-4 w-4" />
                                      Fazer Agendamento
                                    </DropdownMenuItem>
                                  )}

                                  <DropdownMenuItem
                                    onClick={() => {
                                      if (!publicacaoConvertWebhookUrl) {
                                        alert('Configure o webhook POST /publicacoes/convertido.');
                                        return;
                                      }
                                      if (window.confirm('Deseja concluir esta publicação?')) {
                                        concluirPublicacaoMutation.mutate(row);
                                      }
                                    }}
                                    className="text-slate-700"
                                  >
                                    Concluir
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </td>
                          </tr>
                        );
                      })}

                      {filteredPublicacoes.length === 0 && (
                        <tr>
                          <td className="p-6 text-center text-slate-400" colSpan={8}>
                            Nenhuma publicação encontrada
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {activePage === 'agenda' && (
          <>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    placeholder="Buscar eventos..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    variant={viewMode === 'lista' ? 'default' : 'outline'}
                    onClick={() => setViewMode('lista')}
                    size="sm"
                  >
                    <List className="h-4 w-4 mr-2" />
                    Lista
                  </Button>
                  <Button
                    variant={viewMode === 'mensal' ? 'default' : 'outline'}
                    onClick={() => setViewMode('mensal')}
                    size="sm"
                  >
                    <CalendarIcon className="h-4 w-4 mr-2" />
                    Mensal
                  </Button>
                  <Button
                    variant={viewMode === 'semanal' ? 'default' : 'outline'}
                    onClick={() => setViewMode('semanal')}
                    size="sm"
                  >
                    <CalendarIcon className="h-4 w-4 mr-2" />
                    Semanal
                  </Button>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-slate-700">Filtros Avançados</h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setFiltros({ responsavel: '', tipo: '', status: '', tarja: '' })}
                    className="text-xs"
                  >
                    Limpar Filtros
                  </Button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  <Select
                    value={filtros.responsavel}
                    onValueChange={(value) => setFiltros({ ...filtros, responsavel: value })}
                  >
                    <SelectTrigger className="text-xs">
                      <SelectValue placeholder="Responsável" />
                    </SelectTrigger>
                    <SelectContent>
                      {pessoas.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select
                    value={filtros.tipo}
                    onValueChange={(value) => setFiltros({ ...filtros, tipo: value })}
                  >
                    <SelectTrigger className="text-xs">
                      <SelectValue placeholder="Tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Atendimento">Atendimento</SelectItem>
                      <SelectItem value="Audiência">Audiência</SelectItem>
                      <SelectItem value="Perícia">Perícia</SelectItem>
                      <SelectItem value="Prazo processual">Prazo processual</SelectItem>
                      <SelectItem value="Reunião interna">Reunião interna</SelectItem>
                      <SelectItem value="Retorno ao cliente">Retorno ao cliente</SelectItem>
                      <SelectItem value="Outro">Outro</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select
                    value={filtros.status}
                    onValueChange={(value) => setFiltros({ ...filtros, status: value })}
                  >
                    <SelectTrigger className="text-xs">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Agendado">Agendado</SelectItem>
                      <SelectItem value="Realizado">Realizado</SelectItem>
                      <SelectItem value="Cancelado">Cancelado</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select
                    value={filtros.tarja}
                    onValueChange={(value) => setFiltros({ ...filtros, tarja: value })}
                  >
                    <SelectTrigger className="text-xs">
                      <SelectValue placeholder="Tarja/Cor" />
                    </SelectTrigger>
                    <SelectContent>
                      {configuracoes.filter((c) => c.ativa).map((config) => (
                        <SelectItem key={config.id} value={config.id}>
                          <div className="flex items-center gap-2">
                            <div className={`w-3 h-3 rounded ${config.cor}`}></div>
                            {config.nome_tarja}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={densidadeCalendario} onValueChange={setDensidadeCalendario}>
                    <SelectTrigger className="text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="compacto">Compacto</SelectItem>
                      <SelectItem value="medio">Médio</SelectItem>
                      <SelectItem value="expandido">Expandido</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {viewMode === 'mensal' && renderMonthCalendar()}
            {viewMode === 'semanal' && renderWeekCalendar()}
          </>
        )}

        <Dialog
          open={isDialogOpen}
          onOpenChange={(open) => {
            if (!open) closeDialog();
            else setIsDialogOpen(true);
          }}
        >
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingItem ? 'Detalhes do Evento' : 'Novo Evento'}</DialogTitle>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Título *</Label>
                <Input
                  value={formData.titulo}
                  onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Descrição</Label>
                <Textarea
                  value={formData.descricao}
                  onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                  rows={4}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Data *</Label>
                  <Input
                    type="date"
                    value={formData.data_evento}
                    onChange={(e) => setFormData({ ...formData, data_evento: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label>Tipo *</Label>
                  <Select
                    value={formData.tipo_evento}
                    onValueChange={(value) => setFormData({ ...formData, tipo_evento: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Atendimento">Atendimento</SelectItem>
                      <SelectItem value="Audiência">Audiência</SelectItem>
                      <SelectItem value="Perícia">Perícia</SelectItem>
                      <SelectItem value="Prazo processual">Prazo processual</SelectItem>
                      <SelectItem value="Reunião interna">Reunião interna</SelectItem>
                      <SelectItem value="Retorno ao cliente">Retorno ao cliente</SelectItem>
                      <SelectItem value="Outro">Outro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Hora de Início *</Label>
                  <Input
                    type="time"
                    value={formData.hora_inicio}
                    onChange={(e) => setFormData({ ...formData, hora_inicio: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label>Hora de Término</Label>
                  <Input
                    type="time"
                    value={formData.hora_termino}
                    onChange={(e) => setFormData({ ...formData, hora_termino: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) => setFormData({ ...formData, status: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Agendado">Agendado</SelectItem>
                    <SelectItem value="Realizado">Realizado</SelectItem>
                    <SelectItem value="Cancelado">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Responsável principal</Label>
                <Select
                  value={formData.responsaveis_ids?.[0] || ''}
                  onValueChange={(value) =>
                    setFormData({
                      ...formData,
                      responsaveis_ids: value ? [value] : [],
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o responsável..." />
                  </SelectTrigger>
                  <SelectContent>
                    {pessoas.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {formData.responsaveis_ids?.length > 0 && (
                  <p className="text-xs text-slate-500">
                    Responsável atual: {getPessoaNome(formData.responsaveis_ids[0])}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Observações</Label>
                <Textarea
                  value={formData.observacoes}
                  onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                  rows={3}
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="outline" onClick={closeDialog}>
                  Fechar
                </Button>
                <Button
                  type="submit"
                  className="bg-slate-900 hover:bg-slate-800"
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  {editingItem
                    ? updateMutation.isPending
                      ? 'Salvando...'
                      : 'Salvar'
                    : createMutation.isPending
                    ? 'Criando...'
                    : 'Criar Evento'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog
          open={isConvertPubDialogOpen}
          onOpenChange={(open) => {
            if (!open) closeConvertPublicacaoDialog();
            else setIsConvertPubDialogOpen(true);
          }}
        >
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Converter Publicação em Tarefa</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              {convertPublicacao && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-sm text-slate-700">
                    <span className="font-semibold">Processo:</span> {convertPublicacao.processo || '-'}
                  </p>
                  <p className="text-xs text-slate-500">
                    <span className="font-semibold">Parte:</span> {convertPublicacao.parte || '-'}
                  </p>
                  <p className="text-xs text-slate-500">
                    <span className="font-semibold">Row:</span> {convertPublicacao.rowNumber ?? '-'}
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <Label>Responsável pela Execução *</Label>
                <Select value={convertPubResponsavelId} onValueChange={setConvertPubResponsavelId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o responsável..." />
                  </SelectTrigger>
                  <SelectContent>
                    {pessoas.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Data de Vencimento *</Label>
                <Input
                  type="date"
                  value={convertPubDataVencimento}
                  onChange={(e) => setConvertPubDataVencimento(e.target.value)}
                />
                <p className="text-xs text-slate-500">
                  Essa data também será usada para criar automaticamente o evento na Agenda.
                </p>
              </div>

              <div className="space-y-2">
                <Label>Descricao</Label>
                <Textarea
                  value={convertPubDescricao}
                  onChange={(e) => setConvertPubDescricao(e.target.value)}
                  placeholder="Descreva a tarefa..."
                  rows={5}
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="outline" onClick={closeConvertPublicacaoDialog}>
                  Cancelar
                </Button>

                <Button
                  type="button"
                  className="bg-slate-900 hover:bg-slate-800"
                  disabled={converterPublicacaoEmTarefaMutation.isPending}
                  onClick={() => {
                    if (!convertPublicacao) return;
                    if (!convertPubResponsavelId || !convertPubDataVencimento) {
                      alert('Responsável e Data de Vencimento são obrigatórios.');
                      return;
                    }
                    if (!publicacaoConvertWebhookUrl) {
                      alert('Configure o webhook POST /publicacoes/convertido.');
                      return;
                    }

                    converterPublicacaoEmTarefaMutation.mutate({
                      row: convertPublicacao,
                      responsavel_id: convertPubResponsavelId,
                      data_vencimento: convertPubDataVencimento,
                      descricao: convertPubDescricao,
                    });
                  }}
                >
                  {converterPublicacaoEmTarefaMutation.isPending ? 'Criando...' : 'Criar Tarefa'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog
          open={isConvertPubControleDialogOpen}
          onOpenChange={(open) => {
            if (!open) closeConvertPublicacaoControleDialog();
            else setIsConvertPubControleDialogOpen(true);
          }}
        >
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Converter para Controle de Execução</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              {convertPubControlePublicacao && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-sm text-slate-700">
                    <span className="font-semibold">Processo:</span>{' '}
                    {convertPubControlePublicacao.processo || '-'}
                  </p>
                  <p className="text-xs text-slate-500">
                    <span className="font-semibold">Parte:</span>{' '}
                    {convertPubControlePublicacao.parte || '-'}
                  </p>
                  <p className="text-xs text-slate-500">
                    <span className="font-semibold">Row:</span>{' '}
                    {convertPubControlePublicacao.rowNumber ?? '-'}
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <Label>Título *</Label>
                <Input
                  value={convertPubControleForm.titulo}
                  onChange={(e) =>
                    setConvertPubControleForm({
                      ...convertPubControleForm,
                      titulo: e.target.value,
                    })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>Cliente</Label>
                <Input
                  value={convertPubControleForm.cliente}
                  onChange={(e) =>
                    setConvertPubControleForm({
                      ...convertPubControleForm,
                      cliente: e.target.value,
                    })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>Descrição</Label>
                <Textarea
                  value={convertPubControleForm.descricao}
                  onChange={(e) =>
                    setConvertPubControleForm({
                      ...convertPubControleForm,
                      descricao: e.target.value,
                    })
                  }
                  rows={4}
                />
              </div>

              <div className="space-y-2">
                <Label>Observações</Label>
                <Textarea
                  value={convertPubControleForm.observacoes}
                  onChange={(e) =>
                    setConvertPubControleForm({
                      ...convertPubControleForm,
                      observacoes: e.target.value,
                    })
                  }
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label>Tipo de Movimentação</Label>
                <Input
                  value={convertPubControleForm.tipo_movimentacao}
                  onChange={(e) =>
                    setConvertPubControleForm({
                      ...convertPubControleForm,
                      tipo_movimentacao: e.target.value,
                    })
                  }
                  placeholder="Ex: Citação, Penhora, Sentença..."
                />
              </div>

              <div className="space-y-2">
                <Label>Responsável</Label>
                <Select
                  value={convertPubControleForm.responsavel_id}
                  onValueChange={(value) =>
                    setConvertPubControleForm({
                      ...convertPubControleForm,
                      responsavel_id: value,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o responsável..." />
                  </SelectTrigger>
                  <SelectContent>
                    {pessoas.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={convertPubControleForm.status}
                  onValueChange={(value) =>
                    setConvertPubControleForm({
                      ...convertPubControleForm,
                      status: value,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Em aberto">Em aberto</SelectItem>
                    <SelectItem value="Gerar tarefa">Gerar tarefa</SelectItem>
                    <SelectItem value="Concluído">Concluído</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="outline" onClick={closeConvertPublicacaoControleDialog}>
                  Cancelar
                </Button>

                <Button
                  type="button"
                  className="bg-emerald-700 hover:bg-emerald-800"
                  disabled={converterPublicacaoEmControleMutation.isPending}
                  onClick={() => {
                    if (!convertPubControlePublicacao) return;
                    if (!convertPubControleForm.titulo?.trim()) {
                      alert('O título é obrigatório.');
                      return;
                    }
                    if (!publicacaoConvertWebhookUrl) {
                      alert('Configure o webhook POST /publicacoes/convertido.');
                      return;
                    }

                    converterPublicacaoEmControleMutation.mutate({
                      row: convertPubControlePublicacao,
                      controleData: convertPubControleForm,
                    });
                  }}
                >
                  {converterPublicacaoEmControleMutation.isPending
                    ? 'Criando...'
                    : 'Criar Controle'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* NOVO Dialog: Converter Publicação em Monitoramento Processual */}
        <Dialog
          open={isConvertPubMonitorDialogOpen}
          onOpenChange={(open) => {
            if (!open) closeConvertPublicacaoMonitorDialog();
            else setIsConvertPubMonitorDialogOpen(true);
          }}
        >
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Monitorar Processo</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              {convertPubMonitorPublicacao && (
                <div className="rounded-xl border border-violet-200 bg-violet-50 p-3">
                  <p className="text-sm text-violet-900">
                    <span className="font-semibold">Processo:</span> {convertPubMonitorPublicacao.processo || '-'}
                  </p>
                  <p className="text-xs text-violet-700">
                    <span className="font-semibold">Parte:</span> {convertPubMonitorPublicacao.parte || '-'}
                  </p>
                  <p className="text-xs text-violet-700">
                    <span className="font-semibold">Row:</span> {convertPubMonitorPublicacao.rowNumber ?? '-'}
                  </p>
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Número do processo *</Label>
                  <Input
                    value={convertPubMonitorForm.numero_processo}
                    onChange={(e) =>
                      setConvertPubMonitorForm({
                        ...convertPubMonitorForm,
                        numero_processo: e.target.value,
                      })
                    }
                    placeholder="Ex: 1000664-12.2022.8.26.0691"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Cliente / Parte *</Label>
                  <Input
                    value={convertPubMonitorForm.cliente_parte}
                    onChange={(e) =>
                      setConvertPubMonitorForm({
                        ...convertPubMonitorForm,
                        cliente_parte: e.target.value,
                      })
                    }
                    placeholder="Nome do cliente ou parte"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Responsável *</Label>
                  <Select
                    value={convertPubMonitorForm.responsavel_id}
                    onValueChange={(value) =>
                      setConvertPubMonitorForm({
                        ...convertPubMonitorForm,
                        responsavel_id: value,
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o responsável..." />
                    </SelectTrigger>
                    <SelectContent>
                      {pessoas.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Tribunal / Órgão atual *</Label>
                  <Select
                    value={convertPubMonitorForm.tribunal_orgao_atual}
                    onValueChange={(value) =>
                      setConvertPubMonitorForm({
                        ...convertPubMonitorForm,
                        tribunal_orgao_atual: value,
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1º Grau">1º Grau</SelectItem>
                      <SelectItem value="2º Grau (TJ/TRF)">2º Grau (TJ/TRF)</SelectItem>
                      <SelectItem value="STJ">STJ</SelectItem>
                      <SelectItem value="STF">STF</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Tipo de controle *</Label>
                <Select
                  value={convertPubMonitorForm.tipo_controle}
                  onValueChange={(value) =>
                    setConvertPubMonitorForm({
                      ...convertPubMonitorForm,
                      tipo_controle: value,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o tipo..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Apenas acompanhamento">Apenas acompanhamento</SelectItem>
                    <SelectItem value="Aguardando decisão">Aguardando decisão</SelectItem>
                    <SelectItem value="Em fase de recurso">Em fase de recurso</SelectItem>
                    <SelectItem value="Recurso interposto">Recurso interposto</SelectItem>
                    <SelectItem value="Aguardando julgamento">Aguardando julgamento</SelectItem>
                    <SelectItem value="Decisão publicada (analisar)">Decisão publicada (analisar)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>O que precisa ser feito *</Label>
                <Input
                  value={convertPubMonitorForm.o_que_precisa_ser_feito}
                  onChange={(e) =>
                    setConvertPubMonitorForm({
                      ...convertPubMonitorForm,
                      o_que_precisa_ser_feito: e.target.value,
                    })
                  }
                  placeholder="Ex: Checar andamento no e-SAJ"
                />
              </div>

              <div className="space-y-2">
                <Label>Próxima checagem *</Label>
                <Input
                  type="date"
                  value={convertPubMonitorForm.proxima_checagem}
                  onChange={(e) =>
                    setConvertPubMonitorForm({
                      ...convertPubMonitorForm,
                      proxima_checagem: e.target.value,
                    })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>Observações</Label>
                <Textarea
                  value={convertPubMonitorForm.observacoes}
                  onChange={(e) =>
                    setConvertPubMonitorForm({
                      ...convertPubMonitorForm,
                      observacoes: e.target.value,
                    })
                  }
                  rows={5}
                  placeholder="Observações adicionais..."
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="outline" onClick={closeConvertPublicacaoMonitorDialog}>
                  Cancelar
                </Button>

                <Button
                  type="button"
                  className="bg-violet-700 hover:bg-violet-800"
                  disabled={converterPublicacaoEmMonitoramentoMutation.isPending}
                  onClick={() => {
                    if (!convertPubMonitorPublicacao) return;
                    if (!publicacaoConvertWebhookUrl) {
                      alert('Configure o webhook POST /publicacoes/convertido.');
                      return;
                    }

                    converterPublicacaoEmMonitoramentoMutation.mutate({
                      row: convertPubMonitorPublicacao,
                      monitorData: convertPubMonitorForm,
                    });
                  }}
                >
                  {converterPublicacaoEmMonitoramentoMutation.isPending
                    ? 'Criando...'
                    : 'Criar Monitoramento'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog
          open={isFazerAgendamentoDialogOpen}
          onOpenChange={(open) => {
            if (!open) closeFazerAgendamentoDialog();
            else setIsFazerAgendamentoDialogOpen(true);
          }}
        >
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Fazer Agendamento</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              {agendamentoPublicacao && (
                <div className="rounded-xl border border-pink-200 bg-pink-50 p-3">
                  <p className="text-sm text-pink-900">
                    <span className="font-semibold">Processo:</span> {agendamentoPublicacao.processo || '-'}
                  </p>
                  <p className="text-xs text-pink-700">
                    <span className="font-semibold">Parte:</span> {agendamentoPublicacao.parte || '-'}
                  </p>
                  <p className="text-xs text-pink-700">
                    <span className="font-semibold">Row:</span> {agendamentoPublicacao.rowNumber ?? '-'}
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <Label>Tipo de Agendamento *</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant={agendamentoForm.tipo_agendamento === 'audiencia' ? 'default' : 'outline'}
                    className={
                      agendamentoForm.tipo_agendamento === 'audiencia'
                        ? 'bg-pink-600 hover:bg-pink-700'
                        : ''
                    }
                    onClick={() =>
                      setAgendamentoForm((prev) => {
                        const currentBase = prev.titulo.includes(' — ')
                          ? prev.titulo.split(' — ').slice(1).join(' — ')
                          : buildTituloFromPublicacao(agendamentoPublicacao || {});
                        return {
                          ...prev,
                          tipo_agendamento: 'audiencia',
                          titulo: `Audiência — ${currentBase}`.slice(0, 180),
                          observacoes:
                            String(prev.observacoes || '')
                              .replace('[AGENDAMENTO_PUBLICACAO:PERICIA]', '')
                              .replace('[AGENDAMENTO_PUBLICACAO:AUDIENCIA]', '')
                              .trim() + ' [AGENDAMENTO_PUBLICACAO:AUDIENCIA]',
                        };
                      })
                    }
                  >
                    Audiência
                  </Button>

                  <Button
                    type="button"
                    variant={agendamentoForm.tipo_agendamento === 'pericia' ? 'default' : 'outline'}
                    className={
                      agendamentoForm.tipo_agendamento === 'pericia'
                        ? 'bg-orange-500 hover:bg-orange-600'
                        : ''
                    }
                    onClick={() =>
                      setAgendamentoForm((prev) => {
                        const currentBase = prev.titulo.includes(' — ')
                          ? prev.titulo.split(' — ').slice(1).join(' — ')
                          : buildTituloFromPublicacao(agendamentoPublicacao || {});
                        return {
                          ...prev,
                          tipo_agendamento: 'pericia',
                          titulo: `Perícia — ${currentBase}`.slice(0, 180),
                          observacoes:
                            String(prev.observacoes || '')
                              .replace('[AGENDAMENTO_PUBLICACAO:PERICIA]', '')
                              .replace('[AGENDAMENTO_PUBLICACAO:AUDIENCIA]', '')
                              .trim() + ' [AGENDAMENTO_PUBLICACAO:PERICIA]',
                        };
                      })
                    }
                  >
                    Perícia
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Título *</Label>
                <Input
                  value={agendamentoForm.titulo}
                  onChange={(e) =>
                    setAgendamentoForm({
                      ...agendamentoForm,
                      titulo: e.target.value,
                    })
                  }
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Data *</Label>
                  <Input
                    type="date"
                    value={agendamentoForm.data_evento}
                    onChange={(e) =>
                      setAgendamentoForm({
                        ...agendamentoForm,
                        data_evento: e.target.value,
                      })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label>Responsável *</Label>
                  <Select
                    value={agendamentoForm.responsavel_id}
                    onValueChange={(value) =>
                      setAgendamentoForm({
                        ...agendamentoForm,
                        responsavel_id: value,
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o responsável..." />
                    </SelectTrigger>
                    <SelectContent>
                      {pessoas.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Hora de Início *</Label>
                  <Input
                    type="time"
                    value={agendamentoForm.hora_inicio}
                    onChange={(e) =>
                      setAgendamentoForm({
                        ...agendamentoForm,
                        hora_inicio: e.target.value,
                      })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label>Hora de Término</Label>
                  <Input
                    type="time"
                    value={agendamentoForm.hora_termino}
                    onChange={(e) =>
                      setAgendamentoForm({
                        ...agendamentoForm,
                        hora_termino: e.target.value,
                      })
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Descrição</Label>
                <Textarea
                  value={agendamentoForm.descricao}
                  onChange={(e) =>
                    setAgendamentoForm({
                      ...agendamentoForm,
                      descricao: e.target.value,
                    })
                  }
                  rows={5}
                />
              </div>

              <div className="space-y-2">
                <Label>Observações</Label>
                <Textarea
                  value={agendamentoForm.observacoes}
                  onChange={(e) =>
                    setAgendamentoForm({
                      ...agendamentoForm,
                      observacoes: e.target.value,
                    })
                  }
                  rows={3}
                />
                <p className="text-xs text-slate-500">
                  Audiências ficam em rosa no calendário. Perícias ficam em laranja.
                </p>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="outline" onClick={closeFazerAgendamentoDialog}>
                  Cancelar
                </Button>

                <Button
                  type="button"
                  className="bg-slate-900 hover:bg-slate-800"
                  disabled={fazerAgendamentoMutation.isPending}
                  onClick={() => {
                    if (!agendamentoPublicacao) return;
                    if (!agendamentoForm.titulo?.trim()) {
                      alert('O título é obrigatório.');
                      return;
                    }
                    if (!agendamentoForm.data_evento) {
                      alert('A data é obrigatória.');
                      return;
                    }
                    if (!agendamentoForm.hora_inicio) {
                      alert('A hora de início é obrigatória.');
                      return;
                    }
                    if (!agendamentoForm.responsavel_id) {
                      alert('Selecione o responsável.');
                      return;
                    }
                    if (!publicacaoConvertWebhookUrl) {
                      alert('Configure o webhook POST /publicacoes/convertido.');
                      return;
                    }

                    fazerAgendamentoMutation.mutate({
                      row: agendamentoPublicacao,
                      agendamentoData: agendamentoForm,
                    });
                  }}
                >
                  {fazerAgendamentoMutation.isPending ? 'Criando...' : 'Criar Agendamento'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}