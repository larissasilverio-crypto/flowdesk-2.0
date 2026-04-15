import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useCurrentUser, userLabel, historyEntry } from '@/hooks/useCurrentUser';
import { motion, AnimatePresence } from 'framer-motion';
import { format, parseISO, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Plus,
  Search,
  CheckSquare,
  Calendar,
  User,
  MoreVertical,
  Edit,
  Trash2,
  Circle,
  Play,
  AlertTriangle,
  CheckCircle2,
  Paperclip,
  Upload,
  X,
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';

const statusConfig = {
  Pendente: { color: 'bg-amber-100 text-amber-700 border-amber-200', icon: Circle },
  'Em andamento': { color: 'bg-blue-100 text-blue-700 border-blue-200', icon: Play },
  Atrasada: { color: 'bg-red-100 text-red-700 border-red-200', icon: AlertTriangle },
  Concluída: { color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: CheckCircle2 },
};

const prioridadeColors = {
  Baixa: 'bg-slate-100 text-slate-600',
  Média: 'bg-amber-100 text-amber-700',
  Alta: 'bg-red-100 text-red-700',
};

export default function Tarefas() {
  const currentUser = useCurrentUser();
  const [searchTerm, setSearchTerm] = useState('');
  const [prioridadeFilter, setPrioridadeFilter] = useState('all');
  const [responsavelFilter, setResponsavelFilter] = useState('all');
  const [dataInicioFilter, setDataInicioFilter] = useState('');
  const [dataVencimentoFilter, setDataVencimentoFilter] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [uploadingFiles, setUploadingFiles] = useState(false);

  const [formData, setFormData] = useState({
    titulo: '',
    descricao: '',
    atendimento_id: '',
    responsavel_id: '',
    data_inicio: '',
    data_vencimento: '',
    status: 'Pendente',
    prioridade: 'Média',
    observacoes: '',
    motivo_atraso: '',
    retorno_executivo: '',
    anexos: [],
    transferido_para: '',
    mencoes: [],
  });

  const queryClient = useQueryClient();

  const createNotification = useMutation({
    mutationFn: (data) => base44.entities.Notificacao.create(data),
  });

  const { data: tarefas = [], isLoading } = useQuery({
    queryKey: ['tarefas'],
    queryFn: () => base44.entities.Tarefa.list('-created_date'),
  });

  const { data: pessoas = [] } = useQuery({
    queryKey: ['pessoas'],
    queryFn: () => base44.entities.Pessoa.list(),
  });

  const { data: atendimentos = [] } = useQuery({
    queryKey: ['atendimentos'],
    queryFn: () => base44.entities.Atendimento.list(),
  });

  const getPessoaNome = (id) => {
    const pessoa = pessoas.find((p) => p.id === id);
    return pessoa?.nome || '-';
  };

  const notifyDoctorIfLate = (tarefa) => {
    if (!tarefa?.data_vencimento) return;

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const vencimento = new Date(tarefa.data_vencimento);
    vencimento.setHours(0, 0, 0, 0);

    if (vencimento < hoje && tarefa.status !== 'Concluída') {
      createNotification.mutate({
        titulo: '⚠️ Tarefa Atrasada',
        mensagem: `Tarefa atrasada: "${tarefa.titulo}" - Responsável: ${getPessoaNome(
          tarefa.responsavel_id
        )}`,
        tipo: 'tarefa_atrasada',
        usuario_id: 'dra', // será filtrado para o admin
        tarefa_id: tarefa.id,
        lida: false,
      });
    }
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingItem(null);
    setFormData({
      titulo: '',
      descricao: '',
      atendimento_id: '',
      responsavel_id: '',
      data_inicio: '',
      data_vencimento: '',
      status: 'Pendente',
      prioridade: 'Média',
      observacoes: '',
      motivo_atraso: '',
      retorno_executivo: '',
      anexos: [],
      transferido_para: '',
      mencoes: [],
    });
  };

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => {
      const label = userLabel(currentUser);
      const ts = new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
      const existing = tarefas.find((t) => t.id === id);
      const prevHistory = Array.isArray(existing?.historico_autoria) ? existing.historico_autoria : [];

      let actionLabel = 'Atualizado';
      if (data.status === 'Concluída') actionLabel = 'Concluído';
      else if (data.status === 'Atrasada') actionLabel = 'Marcado como Atrasado';
      else if (data.transferido_para && data.transferido_para !== existing?.transferido_para) {
        actionLabel = `Delegado`;
      }

      const enriched = {
        ...data,
        editado_por_email: currentUser?.email || '',
        historico_autoria: [...prevHistory, `[${ts}] ${actionLabel} por ${label}`],
        ...(data.status === 'Concluída' ? { concluido_por_email: currentUser?.email || '' } : {}),
      };
      return base44.entities.Tarefa.update(id, enriched);
    },
    onSuccess: (tarefaAtualizada, { data: dataAtualizada }) => {
      // Validar retorno executivo em conclusão
      if (
        (dataAtualizada.status === 'Concluída' ||
          dataAtualizada.status === 'Não realizada / Impedimento') &&
        !dataAtualizada.retorno_executivo
      ) {
        alert('Retorno Executivo é obrigatório para conclusão da tarefa');
        return;
      }

      queryClient.invalidateQueries({ queryKey: ['tarefas'] });

      // Notificar transferência
      if (
        dataAtualizada.transferido_para &&
        editingItem &&
        editingItem.transferido_para !== dataAtualizada.transferido_para
      ) {
        createNotification.mutate({
          titulo: '🔄 Tarefa Transferida',
          mensagem: `Uma tarefa foi transferida para você: "${tarefaAtualizada.titulo}"`,
          tipo: 'tarefa_criada',
          usuario_id: dataAtualizada.transferido_para,
          tarefa_id: tarefaAtualizada.id,
          lida: false,
        });
      }

      // Notificar menções
      if (dataAtualizada.mencoes && Array.isArray(dataAtualizada.mencoes)) {
        dataAtualizada.mencoes.forEach((usuarioId) => {
          if (!editingItem?.mencoes?.includes(usuarioId)) {
            createNotification.mutate({
              titulo: '💬 Você foi mencionado',
              mensagem: `Você foi mencionado na tarefa: "${tarefaAtualizada.titulo}"`,
              tipo: 'info',
              usuario_id: usuarioId,
              tarefa_id: tarefaAtualizada.id,
              lida: false,
            });
          }
        });
      }

      // Notificar quando tarefa ficar atrasada
      notifyDoctorIfLate(tarefaAtualizada);

      closeDialog();
    },
  });

  // Atualizar automaticamente tarefas atrasadas
  React.useEffect(() => {
    if (!tarefas || tarefas.length === 0) return;

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    tarefas.forEach((tarefa) => {
      if (tarefa.data_vencimento && tarefa.status !== 'Concluída' && tarefa.status !== 'Atrasada') {
        const dataVencimento = new Date(tarefa.data_vencimento);
        dataVencimento.setHours(0, 0, 0, 0);

        if (dataVencimento < hoje) {
          updateMutation.mutate({ id: tarefa.id, data: { ...tarefa, status: 'Atrasada' } });
        }
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tarefas]);

  const createMutation = useMutation({
    mutationFn: (data) => {
      const label = userLabel(currentUser);
      const ts = new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
      return base44.entities.Tarefa.create({
        ...data,
        criado_por_email: currentUser?.email || '',
        editado_por_email: currentUser?.email || '',
        historico_autoria: [`[${ts}] Criado por ${label}`],
      });
    },
    onSuccess: (novaTarefa) => {
      queryClient.invalidateQueries({ queryKey: ['tarefas'] });

      if (novaTarefa.responsavel_id) {
        createNotification.mutate({
          titulo: '📋 Nova Tarefa Atribuída',
          mensagem: `Você recebeu uma nova tarefa: "${novaTarefa.titulo}"`,
          tipo: 'tarefa_criada',
          usuario_id: novaTarefa.responsavel_id,
          tarefa_id: novaTarefa.id,
          lida: false,
        });
      }

      closeDialog();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Tarefa.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tarefas'] });
    },
  });

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setUploadingFiles(true);
    const uploadedUrls = [];

    for (const file of files) {
      try {
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        uploadedUrls.push(file_url);
      } catch (error) {
        console.error('Erro ao fazer upload:', error);
      }
    }

    setFormData((prev) => ({
      ...prev,
      anexos: [...(prev.anexos || []), ...uploadedUrls],
    }));
    setUploadingFiles(false);
  };

  const removeAnexo = (url) => {
    setFormData((prev) => ({
      ...prev,
      anexos: (prev.anexos || []).filter((a) => a !== url),
    }));
  };

  const openEditDialog = (item) => {
    setEditingItem(item);
    setFormData({
      titulo: item.titulo || '',
      descricao: item.descricao || '',
      atendimento_id: item.atendimento_id || '',
      responsavel_id: item.responsavel_id || '',
      data_inicio: item.data_inicio || '',
      data_vencimento: item.data_vencimento || '',
      status: item.status || 'Pendente',
      prioridade: item.prioridade || 'Média',
      observacoes: item.observacoes || '',
      motivo_atraso: item.motivo_atraso || '',
      retorno_executivo: item.retorno_executivo || '',
      anexos: item.anexos || [],
      transferido_para: item.transferido_para || '',
      mencoes: item.mencoes || [],
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    // Validar campos obrigatórios
    if (!formData.responsavel_id || !formData.data_vencimento) {
      alert('Responsável e Data de Vencimento são obrigatórios');
      return;
    }

    // Validar motivo de atraso se status for Atrasada
    if (formData.status === 'Atrasada' && !String(formData.motivo_atraso || '').trim()) {
      alert('Motivo do Atraso é obrigatório para tarefas atrasadas');
      return;
    }

    // Validar retorno executivo se conclusão
    if (
      (formData.status === 'Concluída' || formData.status === 'Não realizada / Impedimento') &&
      !formData.retorno_executivo
    ) {
      alert('Retorno Executivo é obrigatório para conclusão da tarefa');
      return;
    }

    if (editingItem) {
      updateMutation.mutate({ id: editingItem.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const filteredTarefas = (tarefas || []).filter((t) => {
    const matchesSearch =
      (t.titulo || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (t.descricao || '').toLowerCase().includes(searchTerm.toLowerCase());

    const matchesPrioridade = prioridadeFilter === 'all' || t.prioridade === prioridadeFilter;
    const matchesResponsavel =
      responsavelFilter === 'all' || t.responsavel_id === responsavelFilter;

    const matchesDataInicio = !dataInicioFilter || (t.data_inicio && t.data_inicio >= dataInicioFilter);
    const matchesDataVencimento =
      !dataVencimentoFilter || (t.data_vencimento && t.data_vencimento <= dataVencimentoFilter);

    return (
      matchesSearch &&
      matchesPrioridade &&
      matchesResponsavel &&
      matchesDataInicio &&
      matchesDataVencimento
    );
  });

  // Agrupar tarefas por status para layout de colunas
  const tarefasPorStatus = {
    Pendente: filteredTarefas.filter((t) => t.status === 'Pendente'),
    'Em andamento': filteredTarefas.filter((t) => t.status === 'Em andamento'),
    Atrasada: filteredTarefas.filter((t) => t.status === 'Atrasada'),
    Concluída: filteredTarefas.filter((t) => t.status === 'Concluída'),
  };

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
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground md:text-3xl">Tarefas</h1>
            <p className="text-muted-foreground">Gerencie suas atividades</p>
          </div>

          <Button
            onClick={() => setIsDialogOpen(true)}
            className="bg-gradient-to-r from-stone-700 to-stone-800 hover:from-stone-800 hover:to-stone-900"
          >
            <Plus className="mr-2 h-4 w-4" />
            Nova Tarefa
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-4 md:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Buscar tarefas..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            <Select value={prioridadeFilter} onValueChange={setPrioridadeFilter}>
              <SelectTrigger className="w-full md:w-40">
                <SelectValue placeholder="Prioridade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="Baixa">Baixa</SelectItem>
                <SelectItem value="Média">Média</SelectItem>
                <SelectItem value="Alta">Alta</SelectItem>
              </SelectContent>
            </Select>

            <Select value={responsavelFilter} onValueChange={setResponsavelFilter}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder="Responsável" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {pessoas.map((pessoa) => (
                  <SelectItem key={pessoa.id} value={pessoa.id}>
                    {pessoa.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-4 md:flex-row md:items-end">
            <div className="flex-1 space-y-1">
              <Label className="text-xs text-slate-600">Data Início (a partir de)</Label>
              <Input
                type="date"
                value={dataInicioFilter}
                onChange={(e) => setDataInicioFilter(e.target.value)}
                className="w-full"
              />
            </div>

            <div className="flex-1 space-y-1">
              <Label className="text-xs text-slate-600">Data Vencimento (até)</Label>
              <Input
                type="date"
                value={dataVencimentoFilter}
                onChange={(e) => setDataVencimentoFilter(e.target.value)}
                className="w-full"
              />
            </div>

            {(dataInicioFilter || dataVencimentoFilter) && (
              <Button
                variant="outline"
                onClick={() => {
                  setDataInicioFilter('');
                  setDataVencimentoFilter('');
                }}
              >
                Limpar Datas
              </Button>
            )}
          </div>
        </div>

        {/* Kanban Board - Colunas lado a lado */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Object.entries(tarefasPorStatus).map(([status, tarefasDoStatus]) => {
            const StatusIcon = statusConfig[status]?.icon || Circle;

            return (
              <div key={status} className="flex flex-col">
                <div
                  className={`rounded-t-2xl p-4 ${statusConfig[status]?.color} border-2`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <StatusIcon className="h-5 w-5" />
                      <h3 className="font-semibold">{status}</h3>
                    </div>
                    <Badge className="bg-white/50">{tarefasDoStatus.length}</Badge>
                  </div>
                </div>

                <div className="min-h-[200px] space-y-3 rounded-b-2xl bg-muted/30 p-2">
                  <AnimatePresence>
                    {tarefasDoStatus.map((tarefa, index) => {
                      const diasRestantes = tarefa.data_vencimento
                        ? differenceInDays(parseISO(tarefa.data_vencimento), new Date())
                        : null;

                      return (
                        <motion.div
                          key={tarefa.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          transition={{ delay: index * 0.05 }}
                          className="cursor-pointer rounded-xl border border-border bg-card p-4 transition-shadow hover:shadow-lg"
                          onClick={() => openEditDialog(tarefa)}
                        >
                          <div className="space-y-2">
                            <div className="flex items-start justify-between gap-2">
                              <h4 className="line-clamp-2 text-sm font-semibold text-foreground">
                                {tarefa.titulo}
                              </h4>

                              <DropdownMenu>
                                <DropdownMenuTrigger
                                  asChild
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <Button variant="ghost" size="icon" className="h-6 w-6">
                                    <MoreVertical className="h-3 w-3" />
                                  </Button>
                                </DropdownMenuTrigger>

                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openEditDialog(tarefa);
                                    }}
                                  >
                                    <Edit className="mr-2 h-4 w-4" />
                                    Editar
                                  </DropdownMenuItem>

                                  <DropdownMenuItem
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      deleteMutation.mutate(tarefa.id);
                                    }}
                                    className="text-red-600"
                                  >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Excluir
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>

                            {tarefa.descricao && (
                              <p className="line-clamp-2 text-xs text-muted-foreground">
                                {tarefa.descricao}
                              </p>
                            )}

                            <div className="flex flex-wrap gap-1">
                              <Badge className={`${prioridadeColors[tarefa.prioridade]} text-xs`}>
                                {tarefa.prioridade}
                              </Badge>

                              {diasRestantes !== null &&
                                diasRestantes < 0 &&
                                tarefa.status !== 'Concluída' && (
                                  <Badge className="bg-red-100 text-xs text-red-700">
                                    {Math.abs(diasRestantes)}d
                                  </Badge>
                                )}

                              {tarefa.anexos && tarefa.anexos.length > 0 && (
                                <Badge variant="outline" className="text-xs">
                                  <Paperclip className="mr-1 h-3 w-3" />
                                  {tarefa.anexos.length}
                                </Badge>
                              )}
                            </div>

                            <div className="flex items-center justify-between border-t border-border pt-2 text-xs text-muted-foreground">
                              {tarefa.data_vencimento && (
                                <span className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  {format(parseISO(tarefa.data_vencimento), 'dd/MM', {
                                    locale: ptBR,
                                  })}
                                </span>
                              )}

                              {tarefa.responsavel_id && (
                                <span className="flex items-center gap-1 truncate">
                                  <User className="h-3 w-3" />
                                  {getPessoaNome(tarefa.responsavel_id).split(' ')[0]}
                                </span>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>

                  {tarefasDoStatus.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                      <CheckSquare className="mb-2 h-8 w-8" />
                      <p className="text-xs">Nenhuma tarefa</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingItem ? 'Editar Tarefa' : 'Nova Tarefa'}</DialogTitle>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Título</Label>
                <Input
                  value={formData.titulo}
                  onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
                  placeholder="Título da tarefa"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Descrição</Label>
                <Textarea
                  value={formData.descricao}
                  onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                  placeholder="Descreva a tarefa..."
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Data de Início</Label>
                  <Input
                    type="date"
                    value={formData.data_inicio}
                    onChange={(e) => setFormData({ ...formData, data_inicio: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>
                    Data de Vencimento{' '}
                    {editingItem && (
                      <span className="text-xs text-slate-500">(não pode ser alterada)</span>
                    )}
                  </Label>
                  <Input
                    type="date"
                    value={formData.data_vencimento}
                    onChange={(e) =>
                      setFormData({ ...formData, data_vencimento: e.target.value })
                    }
                    disabled={!!editingItem}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
                      <SelectItem value="Pendente">Pendente</SelectItem>
                      <SelectItem value="Em andamento">Em andamento</SelectItem>
                      <SelectItem value="Atrasada">Atrasada</SelectItem>
                      <SelectItem value="Concluída">Concluída</SelectItem>
                      <SelectItem value="Não realizada / Impedimento">
                        Não realizada / Impedimento
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Prioridade</Label>
                  <Select
                    value={formData.prioridade}
                    onValueChange={(value) => setFormData({ ...formData, prioridade: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Baixa">Baixa</SelectItem>
                      <SelectItem value="Média">Média</SelectItem>
                      <SelectItem value="Alta">Alta</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {formData.status === 'Atrasada' && (
                <div className="space-y-2 rounded-lg border border-red-200 bg-red-50 p-3">
                  <Label className="font-bold text-red-700">Motivo do Atraso *</Label>
                  <Textarea
                    value={formData.motivo_atraso}
                    onChange={(e) =>
                      setFormData({ ...formData, motivo_atraso: e.target.value })
                    }
                    placeholder="Explique o motivo do atraso da tarefa..."
                    rows={3}
                    className="border-red-200"
                    required
                  />
                  <p className="text-xs text-red-600">Campo obrigatório para tarefas atrasadas</p>
                </div>
              )}

              <div className="space-y-2">
                <Label>Responsável pela Execução</Label>
                <Select
                  value={formData.responsavel_id}
                  onValueChange={(value) =>
                    setFormData({ ...formData, responsavel_id: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o responsável..." />
                  </SelectTrigger>
                  <SelectContent>
                    {pessoas.map((pessoa) => (
                      <SelectItem key={pessoa.id} value={pessoa.id}>
                        {pessoa.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Atendimento Relacionado</Label>
                <Select
                  value={formData.atendimento_id}
                  onValueChange={(value) =>
                    setFormData({ ...formData, atendimento_id: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um atendimento (opcional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {atendimentos.map((atendimento) => (
                      <SelectItem key={atendimento.id} value={atendimento.id}>
                        {atendimento.cliente}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Anexos (Documentos e Imagens)</Label>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <Input
                      type="file"
                      multiple
                      accept="image/*,application/pdf,.doc,.docx"
                      onChange={handleFileUpload}
                      disabled={uploadingFiles}
                      className="flex-1"
                      id="file-upload"
                    />
                    <label htmlFor="file-upload">
                      <Button type="button" disabled={uploadingFiles} variant="outline" asChild>
                        <span>
                          <Upload className="mr-2 h-4 w-4" />
                          {uploadingFiles ? 'Enviando...' : 'Anexar'}
                        </span>
                      </Button>
                    </label>
                  </div>

                  {formData.anexos && formData.anexos.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {formData.anexos.map((url, idx) => (
                        <Badge key={idx} variant="outline" className="pr-1">
                          <Paperclip className="mr-1 h-3 w-3" />
                          Anexo {idx + 1}
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="ml-1 h-4 w-4"
                            onClick={() => removeAnexo(url)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label>
                  Retorno Executivo{' '}
                  {(formData.status === 'Concluída' ||
                    formData.status === 'Não realizada / Impedimento') && (
                    <span className="text-red-600">*</span>
                  )}
                </Label>
                <Textarea
                  value={formData.retorno_executivo}
                  onChange={(e) =>
                    setFormData({ ...formData, retorno_executivo: e.target.value })
                  }
                  placeholder="Descreva os resultados, ações tomadas e próximos passos..."
                  rows={3}
                />
                <p className="text-xs text-slate-500">
                  Obrigatório para marcar como Concluída ou Não realizada / Impedimento
                </p>
              </div>

              <div className="space-y-2">
                <Label>Observações</Label>
                <Textarea
                  value={formData.observacoes}
                  onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                  placeholder="Observações internas..."
                  rows={2}
                />
              </div>

              {editingItem && Array.isArray(editingItem.historico_autoria) && editingItem.historico_autoria.length > 0 && (
                <div className="rounded-xl border border-border bg-muted/40 p-3 space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Histórico de Autoria</p>
                  <div className="max-h-32 overflow-y-auto space-y-1">
                    {editingItem.historico_autoria.map((entry, i) => (
                      <p key={i} className="text-xs text-muted-foreground border-l-2 border-border pl-2">{entry}</p>
                    ))}
                  </div>
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
      </div>
    </div>
  );
}