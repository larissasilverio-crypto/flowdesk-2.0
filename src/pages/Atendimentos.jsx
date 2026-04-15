import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { motion, AnimatePresence } from 'framer-motion';
import { format, parseISO, differenceInDays, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Plus,
  Search,
  Briefcase,
  Calendar,
  MoreVertical,
  Edit,
  Trash2,
  ArrowRight,
  CheckCircle2,
  Link as LinkIcon,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '../utils';
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
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

const statusColors = {
  'Em triagem': 'bg-purple-100 text-purple-700 border-purple-200',
  'Em análise da Dra.': 'bg-amber-100 text-amber-700 border-amber-200',
  'Criar tarefa': 'bg-blue-100 text-blue-700 border-blue-200',
  'Encerrado': 'bg-slate-100 text-slate-700 border-slate-200',
  'Sem direito/interesse': 'bg-red-100 text-red-700 border-red-200',
};

const statusBadgeColors = {
  'Em aberto': 'bg-blue-100 text-blue-700 border-blue-200',
  'Concluído': 'bg-green-100 text-green-700 border-green-200',
  'Convertido em tarefa': 'bg-indigo-100 text-indigo-700 border-indigo-200',
};

function toISODateOnly(d) {
  return d.toISOString().split('T')[0];
}

function prioridadeFromPotencial(potencial) {
  if (potencial === 'Alto') return 'Alta';
  if (potencial === 'Médio') return 'Média';
  return 'Baixa';
}

function dueDaysFromPotencial(potencial) {
  if (potencial === 'Alto') return 3;
  if (potencial === 'Médio') return 7;
  return 14;
}

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function buildClienteQualificacao(cliente) {
  if (!cliente) return '';
  const parts = [
    cliente.cpf ? `CPF: ${cliente.cpf}` : '',
    cliente.rg ? `RG: ${cliente.rg}` : '',
    cliente.telefone ? `Telefone: ${cliente.telefone}` : '',
    cliente.email ? `E-mail: ${cliente.email}` : '',
    cliente.cidade || cliente.estado
      ? `Cidade/UF: ${[cliente.cidade, cliente.estado].filter(Boolean).join(' / ')}`
      : '',
  ].filter(Boolean);

  return parts.join(' | ');
}

export default function Atendimentos() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const clienteInputRef = useRef(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);

  const [formErrors, setFormErrors] = useState({});
  const [isConvertDialogOpen, setIsConvertDialogOpen] = useState(false);
  const [convertAtendimento, setConvertAtendimento] = useState(null);
  const [convertResponsavelId, setConvertResponsavelId] = useState('');
  const [convertDataVencimento, setConvertDataVencimento] = useState('');
  const [convertDescricao, setConvertDescricao] = useState('');

  const [clienteSearch, setClienteSearch] = useState('');
  const [selectedCliente, setSelectedCliente] = useState(null);
  const [showClienteSuggestions, setShowClienteSuggestions] = useState(false);

  const [formData, setFormData] = useState({
    numero_caso: '',
    cliente: '',
    qualificacao: '',
    assunto: '',
    tipo_demanda: 'Outro',
    descricao_demanda: '',
    potencial: 'Médio',
    status_detalhado: 'Em triagem',
    tipo_atendimento: 'Presencial',
    data_chegada: '',
    data_atendimento: '',
    observacoes: '',
    motivo_encerramento: '',
    ordem_prioridade: '',
    responsavel_id: '',
  });

  const { data: atendimentos = [], isLoading } = useQuery({
    queryKey: ['atendimentos'],
    queryFn: () => base44.entities.Atendimento.list('-created_date'),
  });

  const { data: pessoas = [] } = useQuery({
    queryKey: ['pessoas'],
    queryFn: () => base44.entities.Pessoa.list(),
  });

  const { data: clientes = [] } = useQuery({
    queryKey: ['clientes-autocomplete'],
    queryFn: () => base44.entities.Cliente.list('-created_date', 500),
  });

  const getPessoaNome = (id) => {
    const pessoa = pessoas.find((p) => p.id === id);
    return pessoa?.nome || '-';
  };

  const getDefaultDueDate = (atendimento) => {
    const hoje = new Date();
    const vencimento = addDays(hoje, dueDaysFromPotencial(atendimento?.potencial || 'Médio'));
    return toISODateOnly(vencimento);
  };

  const filteredClientesSuggestions = useMemo(() => {
    const q = normalizeText(clienteSearch);
    if (!q) return clientes.slice(0, 8);

    return clientes
      .filter((cliente) => {
        return [
          cliente.nome_completo,
          cliente.cpf,
          cliente.telefone,
          cliente.email,
          cliente.cidade,
        ].some((field) => normalizeText(field).includes(q));
      })
      .slice(0, 8);
  }, [clientes, clienteSearch]);

  const syncSelectedClienteFromNome = (nome) => {
    const nomeNorm = normalizeText(nome);
    if (!nomeNorm) {
      setSelectedCliente(null);
      return;
    }

    const match = clientes.find((c) => normalizeText(c.nome_completo) === nomeNorm);
    setSelectedCliente(match || null);
  };

  useEffect(() => {
    if (!isDialogOpen) return;
    syncSelectedClienteFromNome(formData.cliente);
  }, [clientes, isDialogOpen]);

  useEffect(() => {
    const onClickOutside = (event) => {
      if (!clienteInputRef.current) return;
      if (!clienteInputRef.current.contains(event.target)) {
        setShowClienteSuggestions(false);
      }
    };

    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const selectCliente = (cliente) => {
    const qualificacaoAuto = buildClienteQualificacao(cliente);

    setSelectedCliente(cliente);
    setClienteSearch(cliente.nome_completo || '');
    setFormData((prev) => ({
      ...prev,
      cliente: cliente.nome_completo || '',
      qualificacao: qualificacaoAuto || prev.qualificacao || '',
    }));
    setShowClienteSuggestions(false);
  };

  const openConvertDialog = (atendimento) => {
    setConvertAtendimento(atendimento);
    setConvertResponsavelId(atendimento?.responsavel_id || '');
    setConvertDataVencimento(getDefaultDueDate(atendimento));
    setConvertDescricao(atendimento?.assunto || '');
    setIsConvertDialogOpen(true);
  };

  const closeConvertDialog = () => {
    setIsConvertDialogOpen(false);
    setConvertAtendimento(null);
    setConvertResponsavelId('');
    setConvertDataVencimento('');
    setConvertDescricao('');
  };

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const atendimento = await base44.entities.Atendimento.create(data);
      await base44.entities.Auditoria.create({
        modulo: 'Atendimento',
        tipo_acao: 'Criação',
        registro_id: atendimento.id,
        registro_nome: atendimento.cliente,
        observacao_sistema: `Atendimento criado: ${atendimento.cliente}`,
      });
      return atendimento;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['atendimentos'] });
      closeDialog();
    },
  });

  const createTaskFromAtendimento = async (atendimento, overrides = {}) => {
    if (!atendimento) throw new Error('Atendimento inválido.');
    if (atendimento.tarefa_criada_id) {
      throw new Error('Este atendimento já foi convertido em tarefa anteriormente.');
    }

    const hoje = new Date();

    const responsavelFinal = overrides.responsavel_id ?? atendimento.responsavel_id ?? '';
    const dataVencimentoFinal =
      overrides.data_vencimento ??
      toISODateOnly(addDays(hoje, dueDaysFromPotencial(atendimento.potencial)));

    if (!responsavelFinal) {
      throw new Error('Selecione o responsável para criar a tarefa.');
    }
    if (!dataVencimentoFinal) {
      throw new Error('Selecione a data de vencimento para criar a tarefa.');
    }

    const payload = {
      titulo: atendimento.cliente || 'Sem título',
      descricao: overrides.descricao ?? atendimento.assunto ?? '',
      responsavel_id: responsavelFinal,
      data_inicio: toISODateOnly(hoje),
      data_vencimento: dataVencimentoFinal,
      prioridade: prioridadeFromPotencial(atendimento.potencial),
      status: 'Pendente',
      origem: 'Atendimento',
      atendimento_id: atendimento.id,
      observacoes: atendimento.observacoes || '',
      anexos: [],
      retorno_executivo: '',
    };

    const novaTarefa = await base44.entities.Tarefa.create(payload);

    const user = await base44.auth.me();

    await base44.entities.Atendimento.update(atendimento.id, {
      tarefa_criada_id: novaTarefa.id,
      status: 'Convertido em tarefa',
      data_conversao_tarefa: new Date().toISOString(),
      usuario_conversao_id: user.id,
    });

    return novaTarefa;
  };

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      const atendimento = await base44.entities.Atendimento.update(id, data);
      await base44.entities.Auditoria.create({
        modulo: 'Atendimento',
        tipo_acao: 'Edição',
        registro_id: atendimento.id,
        registro_nome: atendimento.cliente,
        observacao_sistema: `Atendimento atualizado: ${atendimento.cliente}`,
      });
      return atendimento;
    },
    onSuccess: async (atendimentoAtualizado) => {
      queryClient.invalidateQueries({ queryKey: ['atendimentos'] });

      if (
        atendimentoAtualizado.status_detalhado === 'Encerrado' ||
        atendimentoAtualizado.status_detalhado === 'Sem direito/interesse'
      ) {
        await base44.entities.Atendimento.update(atendimentoAtualizado.id, {
          ...atendimentoAtualizado,
          status: 'Concluído',
        });
        queryClient.invalidateQueries({ queryKey: ['atendimentos'] });
        closeDialog();
        return;
      }

      if (atendimentoAtualizado.status_detalhado === 'Criar tarefa') {
        closeDialog();
        openConvertDialog(atendimentoAtualizado);
        return;
      }

      closeDialog();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Atendimento.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['atendimentos'] });
    },
  });

  const concluirMutation = useMutation({
    mutationFn: async (atendimento) => {
      await base44.entities.Atendimento.update(atendimento.id, { status: 'Concluído' });
      await base44.entities.Auditoria.create({
        modulo: 'Atendimento',
        tipo_acao: 'Alteração de Status',
        registro_id: atendimento.id,
        registro_nome: atendimento.cliente,
        observacao_sistema: `Atendimento concluído manualmente: ${atendimento.cliente}`,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['atendimentos'] });
    },
  });

  const converterEmTarefaMutation = useMutation({
    mutationFn: async ({ atendimento, responsavel_id, data_vencimento, descricao }) => {
      const novaTarefa = await createTaskFromAtendimento(atendimento, {
        responsavel_id,
        data_vencimento,
        descricao,
      });
      return novaTarefa;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['atendimentos'] });
      await queryClient.invalidateQueries({ queryKey: ['tarefas'] });
      closeConvertDialog();
      alert('✅ Tarefa criada com sucesso!');
      navigate(createPageUrl('Tarefas'));
    },
    onError: (error) => {
      alert('Erro: ' + (error?.message || 'Falha ao converter em tarefa.'));
    },
  });

  const validateForm = () => {
    const errors = {};
    if (!formData.cliente?.trim()) errors.cliente = true;
    if (!formData.qualificacao?.trim()) errors.qualificacao = true;
    if (!formData.assunto?.trim()) errors.assunto = true;
    if (!formData.data_chegada) errors.data_chegada = true;
    if (!formData.data_atendimento) errors.data_atendimento = true;
    if (!formData.observacoes?.trim()) errors.observacoes = true;
    if (!formData.responsavel_id) errors.responsavel_id = true;
    return errors;
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setFormErrors({});
    setEditingItem(null);
    setSelectedCliente(null);
    setClienteSearch('');
    setShowClienteSuggestions(false);
    setFormData({
      numero_caso: '',
      cliente: '',
      qualificacao: '',
      assunto: '',
      tipo_demanda: 'Outro',
      descricao_demanda: '',
      potencial: 'Médio',
      status_detalhado: 'Em triagem',
      tipo_atendimento: 'Presencial',
      data_chegada: '',
      data_atendimento: '',
      observacoes: '',
      motivo_encerramento: '',
      ordem_prioridade: '',
      responsavel_id: '',
    });
  };

  const openEditDialog = (item) => {
    setEditingItem(item);
    setFormData({
      numero_caso: item.numero_caso || '',
      cliente: item.cliente || '',
      qualificacao: item.qualificacao || '',
      assunto: item.assunto || '',
      tipo_demanda: item.tipo_demanda || 'Outro',
      descricao_demanda: item.descricao_demanda || '',
      potencial: item.potencial || 'Médio',
      status_detalhado: item.status_detalhado || 'Em triagem',
      tipo_atendimento: item.tipo_atendimento || 'Presencial',
      data_chegada: item.data_chegada ? item.data_chegada.split('T')[0] : '',
      data_atendimento: item.data_atendimento ? item.data_atendimento.split('T')[0] : '',
      observacoes: item.observacoes || '',
      motivo_encerramento: item.motivo_encerramento || '',
      ordem_prioridade: item.ordem_prioridade || '',
      responsavel_id: item.responsavel_id || '',
    });

    setClienteSearch(item.cliente || '');
    syncSelectedClienteFromNome(item.cliente || '');
    setShowClienteSuggestions(false);
    setIsDialogOpen(true);
  };

  const openCreateDialog = () => {
    closeDialog();
    setIsDialogOpen(true);
  };

  const getDisplayTipoDemanda = (atendimento) => {
    if (atendimento?.tipo_demanda === 'Outro' && atendimento?.descricao_demanda) {
      return atendimento.descricao_demanda;
    }
    return atendimento?.tipo_demanda || '';
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    const errors = validateForm();
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }
    setFormErrors({});

    if (formData.tipo_demanda === 'Outro' && !formData.descricao_demanda?.trim()) {
      alert('Por favor, preencha a Descrição da Demanda quando o tipo for "Outro".');
      return;
    }

    if (editingItem) {
      updateMutation.mutate({ id: editingItem.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const filteredAtendimentos = useMemo(() => {
    return atendimentos
      .filter((a) => {
        const matchesSearch =
          a.numero_caso?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          a.cliente?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          a.assunto?.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesStatus = statusFilter === 'all' || a.status_detalhado === statusFilter;
        return matchesSearch && matchesStatus;
      })
      .sort((a, b) => {
        if (a.ordem_prioridade && b.ordem_prioridade) {
          return a.ordem_prioridade - b.ordem_prioridade;
        }
        if (a.ordem_prioridade) return -1;
        if (b.ordem_prioridade) return 1;
        return 0;
      });
  }, [atendimentos, searchTerm, statusFilter]);

  const emAberto = filteredAtendimentos.filter(
    (a) => a.status !== 'Concluído' && a.status !== 'Convertido em tarefa'
  );

  const concluidos = filteredAtendimentos.filter(
    (a) => a.status === 'Concluído' || a.status === 'Convertido em tarefa'
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="mx-auto max-w-7xl space-y-6">
          <Skeleton className="h-10 w-48" />
          <div className="grid gap-4">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-2xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground md:text-3xl">Atendimentos</h1>
            <p className="text-muted-foreground">Gerencie seus casos jurídicos</p>
          </div>
          <Button
            onClick={openCreateDialog}
            className="bg-gradient-to-r from-stone-700 to-stone-800 hover:from-stone-800 hover:to-stone-900"
          >
            <Plus className="mr-2 h-4 w-4" />
            Novo Atendimento
          </Button>
        </div>

        <div className="flex flex-col gap-4 md:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Buscar por número, cliente ou descrição..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full md:w-48">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Status</SelectItem>
              <SelectItem value="Em triagem">Em triagem</SelectItem>
              <SelectItem value="Em análise da Dra.">Em análise da Dra.</SelectItem>
              <SelectItem value="Criar tarefa">Criar tarefa</SelectItem>
              <SelectItem value="Encerrado">Encerrado</SelectItem>
              <SelectItem value="Sem direito/interesse">Sem direito/interesse</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Tabs defaultValue="abertos" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="abertos">Em Aberto ({emAberto.length})</TabsTrigger>
            <TabsTrigger value="concluidos">Concluídos ({concluidos.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="abertos">
            <div className="space-y-3">
              <AnimatePresence>
                {emAberto.map((atendimento, index) => {
                  const diasRestantes = atendimento.prazo_final
                    ? differenceInDays(parseISO(atendimento.prazo_final), new Date())
                    : null;

                  return (
                    <motion.div
                      key={atendimento.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      transition={{ delay: index * 0.05 }}
                      className="rounded-2xl border border-slate-200 bg-white p-4 transition-shadow hover:shadow-lg md:p-6"
                    >
                      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                        <div className="flex-1 space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-sm text-slate-500">{atendimento.numero_caso}</span>

                            {atendimento.status && (
                              <Badge className={`${statusBadgeColors[atendimento.status]} border font-semibold`}>
                                {atendimento.status}
                              </Badge>
                            )}

                            <Badge className={`${statusColors[atendimento.status_detalhado]} border`}>
                              {atendimento.status_detalhado}
                            </Badge>

                            {diasRestantes !== null && diasRestantes <= 7 && diasRestantes >= 0 && (
                              <Badge className="border border-amber-200 bg-amber-100 text-amber-700">
                                {diasRestantes}d restantes
                              </Badge>
                            )}

                            {diasRestantes !== null && diasRestantes < 0 && (
                              <Badge className="border border-red-200 bg-red-100 text-red-700">
                                {Math.abs(diasRestantes)}d atrasado
                              </Badge>
                            )}
                          </div>

                          <h3 className="text-lg font-semibold text-foreground">{atendimento.cliente}</h3>

                          {atendimento.assunto && (
                            <p className="line-clamp-2 text-muted-foreground">{atendimento.assunto}</p>
                          )}

                          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                            {atendimento.data_atendimento && (
                              <span className="flex items-center gap-1">
                                <Calendar className="h-4 w-4" />
                                {format(parseISO(atendimento.data_atendimento), 'dd/MM/yyyy', { locale: ptBR })}
                              </span>
                            )}

                            {atendimento.tipo_demanda && (
                              <Badge variant="outline" className="text-xs">
                                {getDisplayTipoDemanda(atendimento)}
                              </Badge>
                            )}

                            {atendimento.potencial && (
                              <Badge
                                variant="outline"
                                className={`text-xs ${
                                  atendimento.potencial === 'Alto'
                                    ? 'border-green-500 text-green-700'
                                    : atendimento.potencial === 'Médio'
                                    ? 'border-amber-500 text-amber-700'
                                    : 'border-slate-500 text-slate-700'
                                }`}
                              >
                                Potencial {atendimento.potencial}
                              </Badge>
                            )}

                            {atendimento.responsavel_id ? (
                              <Badge variant="outline" className="text-xs">
                                Resp: {getPessoaNome(atendimento.responsavel_id)}
                              </Badge>
                            ) : null}
                          </div>
                        </div>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>

                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEditDialog(atendimento)}>
                              <Edit className="mr-2 h-4 w-4" />
                              Editar
                            </DropdownMenuItem>

                            {!atendimento.tarefa_criada_id && atendimento.status !== 'Convertido em tarefa' && (
                              <DropdownMenuItem
                                onClick={() => openConvertDialog(atendimento)}
                                className="text-blue-600"
                              >
                                <ArrowRight className="mr-2 h-4 w-4" />
                                Converter em Tarefa
                              </DropdownMenuItem>
                            )}

                            {atendimento.status !== 'Concluído' && (
                              <DropdownMenuItem
                                onClick={() => concluirMutation.mutate(atendimento)}
                                className="text-green-600"
                              >
                                <CheckCircle2 className="mr-2 h-4 w-4" />
                                Concluir
                              </DropdownMenuItem>
                            )}

                            <DropdownMenuItem
                              onClick={() => deleteMutation.mutate(atendimento.id)}
                              className="text-red-600"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>

              {emAberto.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Briefcase className="mb-4 h-12 w-12" />
                  <p>Nenhum atendimento em aberto</p>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="concluidos">
            <div className="space-y-3">
              <AnimatePresence>
                {concluidos.map((atendimento, index) => {
                  return (
                    <motion.div
                      key={atendimento.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      transition={{ delay: index * 0.05 }}
                      className="rounded-2xl border border-border bg-card p-4 transition-shadow hover:shadow-lg md:p-6"
                    >
                      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                        <div className="flex-1 space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-sm text-muted-foreground">{atendimento.numero_caso}</span>

                            {atendimento.status && (
                              <Badge className={`${statusBadgeColors[atendimento.status]} border font-semibold`}>
                                {atendimento.status}
                              </Badge>
                            )}

                            <Badge className={`${statusColors[atendimento.status_detalhado]} border`}>
                              {atendimento.status_detalhado}
                            </Badge>
                          </div>

                          <h3 className="text-lg font-semibold text-foreground">{atendimento.cliente}</h3>

                          {atendimento.assunto && (
                            <p className="line-clamp-2 text-muted-foreground">{atendimento.assunto}</p>
                          )}

                          {atendimento.tipo_demanda && (
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant="outline" className="text-xs">
                                {getDisplayTipoDemanda(atendimento)}
                              </Badge>
                            </div>
                          )}
                        </div>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>

                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEditDialog(atendimento)}>
                              <Edit className="mr-2 h-4 w-4" />
                              Editar
                            </DropdownMenuItem>

                            <DropdownMenuItem
                              onClick={() => deleteMutation.mutate(atendimento.id)}
                              className="text-red-600"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>

              {concluidos.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Briefcase className="mb-4 h-12 w-12" />
                  <p>Nenhum atendimento concluído</p>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingItem ? 'Editar Atendimento' : 'Novo Atendimento'}</DialogTitle>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Ordem de Prioridade</Label>
                <Input
                  type="number"
                  value={formData.ordem_prioridade}
                  onChange={(e) => setFormData({ ...formData, ordem_prioridade: e.target.value })}
                  placeholder="Ex: 1 (mais prioritário)"
                />
              </div>

              {Object.keys(formErrors).length > 0 && (
                <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                  Preencha todos os campos obrigatórios antes de salvar o atendimento.
                </div>
              )}

              <div className="space-y-2" ref={clienteInputRef}>
                <Label>Cliente *</Label>
                <div className="relative">
                  <Input
                    value={clienteSearch}
                    onChange={(e) => {
                      const value = e.target.value;
                      setClienteSearch(value);
                      setFormData((prev) => ({ ...prev, cliente: value }));
                      setSelectedCliente(null);
                      setShowClienteSuggestions(true);
                    }}
                    onFocus={() => setShowClienteSuggestions(true)}
                    placeholder="Digite nome, CPF, telefone ou e-mail do cliente"
                    className={formErrors.cliente ? 'border-red-500' : ''}
                  />

                  {showClienteSuggestions && filteredClientesSuggestions.length > 0 && (
                    <div className="absolute z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-border bg-popover shadow-lg">
                      {filteredClientesSuggestions.map((cliente) => (
                        <button
                          key={cliente.id}
                          type="button"
                          onClick={() => selectCliente(cliente)}
                          className="flex w-full flex-col items-start gap-1 border-b border-border px-3 py-3 text-left hover:bg-muted/50 last:border-b-0"
                        >
                          <span className="font-medium text-foreground">{cliente.nome_completo || 'Sem nome'}</span>
                          <span className="text-xs text-muted-foreground">
                            {[cliente.cpf, cliente.telefone, cliente.email].filter(Boolean).join(' • ') || 'Sem dados adicionais'}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {selectedCliente ? (
                    <>
                      <Badge variant="outline" className="border-green-200 text-green-700">
                        Cliente vinculado: {selectedCliente.nome_completo}
                      </Badge>

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/ClienteDetalhe?id=${selectedCliente.id}`)}
                      >
                        <LinkIcon className="mr-2 h-3.5 w-3.5" />
                        Abrir perfil
                      </Button>

                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedCliente(null);
                          setClienteSearch(formData.cliente || '');
                          setShowClienteSuggestions(true);
                        }}
                      >
                        Alterar
                      </Button>
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Você pode selecionar um cliente existente ou digitar normalmente.
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Qualificação (CPF, RG, etc) <span className="text-red-500">*</span></Label>
                <Input
                  value={formData.qualificacao}
                  className={formErrors.qualificacao ? 'border-red-500' : ''}
                  onChange={(e) => setFormData({ ...formData, qualificacao: e.target.value })}
                  placeholder="Ex: CPF 123.456.789-00"
                />
              </div>

              <div className="space-y-2">
                <Label>Assunto <span className="text-red-500">*</span></Label>
                <Textarea
                  value={formData.assunto}
                  className={formErrors.assunto ? 'border-red-500' : ''}
                  onChange={(e) => setFormData({ ...formData, assunto: e.target.value })}
                  placeholder="Descreva o assunto do atendimento..."
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Tipo de Demanda</Label>
                  <Select
                    value={formData.tipo_demanda}
                    onValueChange={(value) =>
                      setFormData({
                        ...formData,
                        tipo_demanda: value,
                        descricao_demanda: value !== 'Outro' ? '' : formData.descricao_demanda,
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Processo Judicial">Processo Judicial</SelectItem>
                      <SelectItem value="Pedido Administrativo">Pedido Administrativo</SelectItem>
                      <SelectItem value="Colher Documentos">Colher Documentos</SelectItem>
                      <SelectItem value="Acompanhamento">Acompanhamento</SelectItem>
                      <SelectItem value="Outro">Outro</SelectItem>
                    </SelectContent>
                  </Select>

                  {formData.tipo_demanda === 'Outro' && (
                    <div className="mt-2 space-y-1">
                      <Label>
                        Descrição da Demanda <span className="text-red-500">*</span>
                      </Label>
                      <Textarea
                        value={formData.descricao_demanda}
                        onChange={(e) => setFormData({ ...formData, descricao_demanda: e.target.value })}
                        placeholder="Descreva o tipo de demanda específico..."
                        rows={2}
                      />
                      {formData.descricao_demanda?.trim() && (
                        <p className="text-xs text-slate-500">
                          Exibição:{' '}
                          <span className="font-semibold text-slate-700">
                            {formData.descricao_demanda.trim()}
                          </span>
                        </p>
                      )}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Potencial do Caso</Label>
                  <Select
                    value={formData.potencial}
                    onValueChange={(value) => setFormData({ ...formData, potencial: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Alto">Alto</SelectItem>
                      <SelectItem value="Médio">Médio</SelectItem>
                      <SelectItem value="Baixo">Baixo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Tipo de Atendimento</Label>
                  <Select
                    value={formData.tipo_atendimento}
                    onValueChange={(value) => setFormData({ ...formData, tipo_atendimento: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Presencial">Presencial</SelectItem>
                      <SelectItem value="Online">Online</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select
                    value={formData.status_detalhado}
                    onValueChange={(value) => setFormData({ ...formData, status_detalhado: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Em triagem">Em triagem</SelectItem>
                      <SelectItem value="Em análise da Dra.">Em análise da Dra.</SelectItem>
                      <SelectItem value="Criar tarefa">Criar tarefa</SelectItem>
                      <SelectItem value="Encerrado">Encerrado</SelectItem>
                      <SelectItem value="Sem direito/interesse">Sem direito/interesse</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Data de Chegada <span className="text-red-500">*</span></Label>
                  <Input
                    type="date"
                    value={formData.data_chegada}
                    className={formErrors.data_chegada ? 'border-red-500' : ''}
                    onChange={(e) => setFormData({ ...formData, data_chegada: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Data de Atendimento <span className="text-red-500">*</span></Label>
                  <Input
                    type="date"
                    value={formData.data_atendimento}
                    className={formErrors.data_atendimento ? 'border-red-500' : ''}
                    onChange={(e) => setFormData({ ...formData, data_atendimento: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Observações <span className="text-red-500">*</span></Label>
                <Textarea
                  value={formData.observacoes}
                  className={formErrors.observacoes ? 'border-red-500' : ''}
                  onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                  placeholder="Observações adicionais..."
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label>Responsável pelo Atendimento <span className="text-red-500">*</span></Label>
                <Select
                  value={formData.responsavel_id}
                  onValueChange={(value) => setFormData({ ...formData, responsavel_id: value })}
                >
                  <SelectTrigger className={formErrors.responsavel_id ? 'border-red-500' : ''}>
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

              {(formData.status_detalhado === 'Encerrado' ||
                formData.status_detalhado === 'Sem direito/interesse') && (
                <div className="space-y-2">
                  <Label>Motivo do Encerramento</Label>
                  <Textarea
                    value={formData.motivo_encerramento}
                    onChange={(e) => setFormData({ ...formData, motivo_encerramento: e.target.value })}
                    placeholder="Descreva o motivo do encerramento..."
                    rows={2}
                  />
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="outline" onClick={closeDialog}>
                  Cancelar
                </Button>
                <Button type="submit" className="bg-slate-900 hover:bg-slate-800">
                  {editingItem ? 'Salvar' : 'Criar'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={isConvertDialogOpen} onOpenChange={setIsConvertDialogOpen}>
          <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Converter em Tarefa</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              {convertAtendimento && (
                <div className="rounded-xl border border-border bg-muted/40 p-3">
                  <p className="text-sm text-foreground">
                    <span className="font-semibold">Cliente:</span> {convertAtendimento.cliente}
                  </p>
                  {convertAtendimento.numero_caso ? (
                    <p className="text-xs text-muted-foreground">
                      <span className="font-semibold">Caso:</span> {convertAtendimento.numero_caso}
                    </p>
                  ) : null}
                </div>
              )}

              <div className="space-y-2">
                <Label>Responsável pela Execução *</Label>
                <Select value={convertResponsavelId} onValueChange={setConvertResponsavelId}>
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
                  value={convertDataVencimento}
                  onChange={(e) => setConvertDataVencimento(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Descricao</Label>
                <Textarea
                  value={convertDescricao}
                  onChange={(e) => setConvertDescricao(e.target.value)}
                  placeholder="Descreva a tarefa..."
                  rows={4}
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="outline" onClick={closeConvertDialog}>
                  Cancelar
                </Button>

                <Button
                  type="button"
                  className="bg-slate-900 hover:bg-slate-800"
                  disabled={converterEmTarefaMutation.isPending}
                  onClick={() => {
                    if (!convertAtendimento) return;

                    if (!convertResponsavelId || !convertDataVencimento) {
                      alert('Responsavel e Data de Vencimento sao obrigatorios.');
                      return;
                    }

                    converterEmTarefaMutation.mutate({
                      atendimento: convertAtendimento,
                      responsavel_id: convertResponsavelId,
                      data_vencimento: convertDataVencimento,
                      descricao: convertDescricao,
                    });
                  }}
                >
                  {converterEmTarefaMutation.isPending ? 'Criando...' : 'Criar Tarefa'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}