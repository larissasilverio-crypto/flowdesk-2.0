import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Pencil, Trash2, User, Scale, Phone, Mail, MapPin, Briefcase, FolderOpen, ExternalLink, Calendar } from 'lucide-react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import DocumentosSection from '@/components/DocumentosSection';
import FichaCliente from '@/components/FichaCliente';

const TIPOS = ['Previdenciário', 'Trabalhista', 'Bancário', 'Cível', 'Criminal', 'Tributário', 'Administrativo', 'Outro'];
const STATUS_P = ['Em andamento', 'Concluído', 'Suspenso', 'Arquivado', 'Aguardando'];
const FASES = ['Inicial', 'Instrução', 'Sentença', 'Recurso', 'Execução', 'Trânsito em julgado', 'Encerrado'];

const STATUS_COLORS = {
  'Em andamento': 'bg-blue-100 text-blue-700 border-blue-200',
  'Concluído': 'bg-green-100 text-green-700 border-green-200',
  'Suspenso': 'bg-yellow-100 text-yellow-700 border-yellow-200',
  'Arquivado': 'bg-slate-100 text-slate-600 border-slate-200',
  'Aguardando': 'bg-orange-100 text-orange-700 border-orange-200',
};

const EMPTY_PROC = {
  numero_processo: '',
  tipo_processo: '',
  status: 'Em andamento',
  data_inicio: '',
  data_fim: '',
  orgao: '',
  descricao: '',
  valor_causa: '',
  fase_processo: '',
  id_externo: '',
};

export default function ClienteDetalhe() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useCurrentUser();

  const params = new URLSearchParams(window.location.search);
  const clienteId = params.get('id');

  const [procDialog, setProcDialog] = useState(false);
  const [editingProc, setEditingProc] = useState(null);
  const [procForm, setProcForm] = useState(EMPTY_PROC);
  const [numError, setNumError] = useState('');

  const { data: cliente, isLoading: loadingCliente } = useQuery({
    queryKey: ['cliente', clienteId],
    queryFn: () => base44.entities.Cliente.filter({ id: clienteId }),
    enabled: !!clienteId,
    select: (data) => data[0],
  });

  const { data: processos = [], isLoading: loadingProc } = useQuery({
    queryKey: ['processos-cliente', clienteId],
    queryFn: () => base44.entities.Processo.filter({ cliente_id: clienteId }),
    enabled: !!clienteId,
  });

  const { data: todosProcessos = [] } = useQuery({
    queryKey: ['processos-all-detalhe'],
    queryFn: () => base44.entities.Processo.list('-created_date', 500),
  });

  const createProcMutation = useMutation({
    mutationFn: (data) => base44.entities.Processo.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['processos-cliente', clienteId] });
      queryClient.invalidateQueries({ queryKey: ['processos-all-detalhe'] });
      closeProcDialog();
    },
  });

  const updateProcMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Processo.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['processos-cliente', clienteId] });
      closeProcDialog();
    },
  });

  const deleteProcMutation = useMutation({
    mutationFn: (id) => base44.entities.Processo.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['processos-cliente', clienteId] }),
  });

  const openProcCreate = () => {
    setEditingProc(null);
    setProcForm(EMPTY_PROC);
    setNumError('');
    setProcDialog(true);
  };

  const openProcEdit = (p) => {
    setEditingProc(p);
    setProcForm({
      numero_processo: p.numero_processo || '',
      tipo_processo: p.tipo_processo || '',
      status: p.status || 'Em andamento',
      data_inicio: p.data_inicio || '',
      data_fim: p.data_fim || '',
      orgao: p.orgao || '',
      descricao: p.descricao || '',
      valor_causa: p.valor_causa || '',
      fase_processo: p.fase_processo || '',
      id_externo: p.id_externo || '',
    });
    setNumError('');
    setProcDialog(true);
  };

  const closeProcDialog = () => {
    setProcDialog(false);
    setEditingProc(null);
    setProcForm(EMPTY_PROC);
    setNumError('');
  };

  const handleProcSubmit = (e) => {
    e.preventDefault();
    const duplicado = todosProcessos.find(
      (p) => p.numero_processo === procForm.numero_processo && p.id !== editingProc?.id
    );
    if (duplicado) { setNumError('Já existe um processo com este número.'); return; }
    setNumError('');

    const userEmail = user?.email || 'sistema';
    if (editingProc) {
      updateProcMutation.mutate({
        id: editingProc.id,
        data: { ...procForm, valor_causa: procForm.valor_causa ? Number(procForm.valor_causa) : undefined, atualizado_por: userEmail },
      });
    } else {
      createProcMutation.mutate({
        ...procForm,
        cliente_id: clienteId,
        valor_causa: procForm.valor_causa ? Number(procForm.valor_causa) : undefined,
        criado_por: userEmail,
        atualizado_por: userEmail,
      });
    }
  };

  if (loadingCliente) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-rose-200 border-t-rose-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (!cliente) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Cliente não encontrado.</p>
          <Link to="/Clientes"><Button variant="outline">Voltar</Button></Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Voltar */}
        <Link to="/Clientes">
          <Button variant="ghost" className="text-muted-foreground hover:text-foreground -ml-2">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar para Clientes
          </Button>
        </Link>

        {/* Cabeçalho simples */}
        <div className="rounded-2xl border border-border bg-card shadow-sm p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 rounded-full bg-rose-100 flex items-center justify-center">
                <User className="h-7 w-7 text-rose-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">{cliente.nome_completo}</h1>
                <p className="text-sm text-muted-foreground font-mono">CPF: {cliente.cpf}</p>
              </div>
            </div>
            <Link to={`/Clientes`}><Button variant="outline" size="sm"><Pencil className="mr-1 h-3 w-3" />Editar</Button></Link>
          </div>
        </div>

        {/* Abas: Processos, Documentos e Ficha */}
        <Tabs defaultValue="processos" className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
          <TabsList className="w-full rounded-none border-b border-border bg-muted/40 h-12 justify-start px-4 gap-1">
            <TabsTrigger value="processos" className="flex items-center gap-1.5 data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg">
              <Scale className="h-4 w-4" />Processos ({processos.length})
            </TabsTrigger>
            <TabsTrigger value="ficha" className="flex items-center gap-1.5 data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg">
              <User className="h-4 w-4" />Ficha do Cliente
            </TabsTrigger>
            <TabsTrigger value="documentos" className="flex items-center gap-1.5 data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg">
              <FolderOpen className="h-4 w-4" />Anexos
            </TabsTrigger>
          </TabsList>

          <TabsContent value="processos" className="p-6 mt-0">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-semibold text-foreground">Processos vinculados</h2>
                <p className="text-xs text-muted-foreground">{processos.length} processo(s)</p>
              </div>
              <div className="flex gap-2">
                <Link to="/Processos">
                  <Button size="sm" variant="outline" className="text-xs">
                    <ExternalLink className="h-3 w-3 mr-1" />Ver todos
                  </Button>
                </Link>
                <Button size="sm" onClick={openProcCreate} className="bg-rose-600 hover:bg-rose-700 text-white">
                  <Plus className="mr-1 h-3 w-3" />Novo Processo
                </Button>
              </div>
            </div>
            {loadingProc ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Carregando...</p>
            ) : processos.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">Nenhum processo vinculado.</p>
            ) : (
              <div className="space-y-3">
                {processos.map((p) => (
                  <div key={p.id} className="rounded-xl border border-border bg-card p-4 hover:border-rose-200 hover:shadow-sm transition-all">
                    <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <p className="font-mono text-sm font-semibold text-foreground">{p.numero_processo}</p>
                          <Badge className={`border text-xs ${STATUS_COLORS[p.status] || ''}`}>{p.status}</Badge>
                        </div>
                        <div className="flex flex-wrap gap-1 mb-2">
                          {p.tipo_processo && <Badge variant="outline" className="text-xs">{p.tipo_processo}</Badge>}
                          {p.fase_processo && <Badge variant="outline" className="text-xs text-slate-500">{p.fase_processo}</Badge>}
                        </div>
                        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                          {p.orgao && <span>Órgão: {p.orgao}</span>}
                          {p.data_inicio && <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />Início: {p.data_inicio}</span>}
                          {p.valor_causa && <span>Valor: R$ {Number(p.valor_causa).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>}
                          {p.criado_por && <span>Criado por: {p.criado_por}</span>}
                        </div>
                        {p.descricao && <p className="text-xs text-muted-foreground mt-1 italic line-clamp-2">{p.descricao}</p>}
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        <Button size="icon" variant="ghost" onClick={() => openProcEdit(p)} title="Editar"><Pencil className="h-4 w-4 text-slate-400" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => deleteProcMutation.mutate(p.id)} title="Excluir"><Trash2 className="h-4 w-4 text-red-400" /></Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="ficha" className="p-6 mt-0">
            <FichaCliente cliente={cliente} />
          </TabsContent>

          <TabsContent value="documentos" className="p-6 mt-0">
            <DocumentosSection clienteId={clienteId} userEmail={user?.email} />
          </TabsContent>
        </Tabs>
      </div>

      {/* Dialog processo */}
      <Dialog open={procDialog} onOpenChange={setProcDialog}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingProc ? 'Editar Processo' : 'Novo Processo'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleProcSubmit} className="space-y-4 pt-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Número do Processo *</Label>
                <Input required value={procForm.numero_processo} onChange={(e) => { setProcForm({ ...procForm, numero_processo: e.target.value }); setNumError(''); }} />
                {numError && <p className="text-xs text-red-500">{numError}</p>}
              </div>
              <div className="space-y-1">
                <Label>Tipo *</Label>
                <Select value={procForm.tipo_processo} onValueChange={(v) => setProcForm({ ...procForm, tipo_processo: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>{TIPOS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Status</Label>
                <Select value={procForm.status} onValueChange={(v) => setProcForm({ ...procForm, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUS_P.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Fase</Label>
                <Select value={procForm.fase_processo} onValueChange={(v) => setProcForm({ ...procForm, fase_processo: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>{FASES.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Órgão</Label>
                <Input value={procForm.orgao} onChange={(e) => setProcForm({ ...procForm, orgao: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Valor da Causa (R$)</Label>
                <Input type="number" min="0" step="0.01" value={procForm.valor_causa} onChange={(e) => setProcForm({ ...procForm, valor_causa: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Data de Início *</Label>
                <Input required type="date" value={procForm.data_inicio} onChange={(e) => setProcForm({ ...procForm, data_inicio: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Data de Fim</Label>
                <Input type="date" value={procForm.data_fim} onChange={(e) => setProcForm({ ...procForm, data_fim: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>ID Externo</Label>
                <Input value={procForm.id_externo} onChange={(e) => setProcForm({ ...procForm, id_externo: e.target.value })} placeholder="ID do sistema antigo" />
              </div>
              <div className="md:col-span-2 space-y-1">
                <Label>Descrição</Label>
                <Textarea rows={3} value={procForm.descricao} onChange={(e) => setProcForm({ ...procForm, descricao: e.target.value })} />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={closeProcDialog}>Cancelar</Button>
              <Button type="submit" className="bg-rose-600 hover:bg-rose-700 text-white" disabled={createProcMutation.isPending || updateProcMutation.isPending}>
                {editingProc ? 'Salvar' : 'Cadastrar'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}