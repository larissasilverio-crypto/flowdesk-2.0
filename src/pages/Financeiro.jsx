import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, ComposedChart, Area, Line
} from 'recharts';
import {
  Plus, TrendingUp, TrendingDown, DollarSign, CheckCircle,
  Search, Pencil, Trash2, Lock, AlertTriangle, FileText, Calendar
} from 'lucide-react';
import { format, parseISO, differenceInDays } from 'date-fns';

const CATEGORIAS = ['Honorários','Custas Processuais','Despesas Operacionais','Reembolso','Salários','Aluguel','Material','Marketing','Tecnologia','Outro'];
const FORMAS = ['Pix','Transferência','Dinheiro','Cheque','Cartão de Débito','Cartão de Crédito','Boleto'];
const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const SENHA_CORRETA = 'MCR2024';

const emptyForm = {
  tipo: 'Entrada', categoria: 'Honorários', descricao: '', valor: '',
  data: format(new Date(), 'yyyy-MM-dd'), data_vencimento: '',
  status: 'Confirmado', forma_pagamento: 'Pix', observacoes: ''
};

function fmt(v) {
  return (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function diffDias(dataStr) {
  if (!dataStr) return null;
  return differenceInDays(parseISO(dataStr), new Date());
}

function PasswordGate({ onUnlock }) {
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState(false);
  const check = () => {
    if (senha === SENHA_CORRETA) { onUnlock(); }
    else { setErro(true); setSenha(''); }
  };
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-lg p-8 w-full max-w-sm text-center space-y-4">
        <div className="h-14 w-14 bg-rose-100 rounded-full flex items-center justify-center mx-auto">
          <Lock className="h-7 w-7 text-rose-600" />
        </div>
        <h2 className="text-xl font-bold text-slate-800">Módulo Financeiro</h2>
        <p className="text-slate-500 text-sm">Área restrita. Digite a senha para continuar.</p>
        <Input
          type="password"
          placeholder="Senha"
          value={senha}
          onChange={e => { setSenha(e.target.value); setErro(false); }}
          onKeyDown={e => e.key === 'Enter' && check()}
          className={erro ? 'border-red-500' : ''}
        />
        {erro && <p className="text-xs text-red-500">Senha incorreta.</p>}
        <Button onClick={check} className="w-full bg-rose-600 hover:bg-rose-700 text-white">Entrar</Button>
      </div>
    </div>
  );
}

function AlertaBadge({ dataVencimento }) {
  const diff = diffDias(dataVencimento);
  if (diff === null) return null;
  if (diff < 0) return <Badge className="bg-red-100 text-red-700 border-0 text-xs">Vencido {Math.abs(diff)}d atrás</Badge>;
  if (diff <= 7) return <Badge className="bg-orange-100 text-orange-700 border-0 text-xs">Vence em {diff}d</Badge>;
  return null;
}

function ContasList({ items, tipo, onEdit, onDelete }) {
  if (!items.length) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400">
        <DollarSign className="h-10 w-10 mx-auto mb-2 opacity-30" />
        <p>Nenhuma conta {tipo === 'pagar' ? 'a pagar' : 'a receber'}</p>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {items.map(l => {
        const diff = diffDias(l.data_vencimento);
        let alertClass = '';
        if (diff !== null) {
          if (diff < 0) alertClass = 'border-red-300 bg-red-50';
          else if (diff <= 7) alertClass = 'border-orange-300 bg-orange-50';
        }
        return (
          <div key={l.id} className={`bg-white rounded-xl border border-slate-200 p-4 flex items-center justify-between gap-4 ${alertClass}`}>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-medium text-slate-800 text-sm">{l.descricao}</p>
                <AlertaBadge dataVencimento={l.data_vencimento} />
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {l.categoria}
                {l.data_vencimento && ` · Vence: ${format(parseISO(l.data_vencimento), 'dd/MM/yyyy')}`}
              </p>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              <span className={`font-bold text-sm ${tipo === 'pagar' ? 'text-red-600' : 'text-green-600'}`}>{fmt(l.valor)}</span>
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => onEdit(l)}><Pencil className="h-4 w-4" /></Button>
              <Button size="icon" variant="ghost" className="h-8 w-8 text-red-500" onClick={() => onDelete(l.id)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function Financeiro() {
  const [unlocked, setUnlocked] = useState(false);
  const qc = useQueryClient();
  const [filtroMes, setFiltroMes] = useState(new Date().getMonth());
  const [filtroAno, setFiltroAno] = useState(new Date().getFullYear());
  const [busca, setBusca] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);

  const { data: lancamentos = [] } = useQuery({
    queryKey: ['lancamentos'],
    queryFn: () => base44.entities.LancamentoFinanceiro.list('-data', 500),
    enabled: unlocked,
  });

  const saveMutation = useMutation({
    mutationFn: (data) => editingId
      ? base44.entities.LancamentoFinanceiro.update(editingId, data)
      : base44.entities.LancamentoFinanceiro.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['lancamentos'] }); setDialogOpen(false); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.LancamentoFinanceiro.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['lancamentos'] }),
  });

  const conciliarMutation = useMutation({
    mutationFn: ({ id, val }) => base44.entities.LancamentoFinanceiro.update(id, { conciliado: val }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['lancamentos'] }),
  });

  const filtrados = useMemo(() => lancamentos.filter(l => {
    if (!l.data) return false;
    const d = parseISO(l.data);
    const mesMatch = d.getMonth() === filtroMes && d.getFullYear() === filtroAno;
    const buscaMatch = !busca || (l.descricao || '').toLowerCase().includes(busca.toLowerCase()) || (l.categoria || '').toLowerCase().includes(busca.toLowerCase());
    return mesMatch && buscaMatch;
  }), [lancamentos, filtroMes, filtroAno, busca]);

  const totalEntradas = filtrados.filter(l => l.tipo === 'Entrada' && l.status !== 'Cancelado').reduce((s, l) => s + (l.valor || 0), 0);
  const totalSaidas = filtrados.filter(l => l.tipo === 'Saída' && l.status !== 'Cancelado').reduce((s, l) => s + (l.valor || 0), 0);
  const saldo = totalEntradas - totalSaidas;

  const contasPagar = lancamentos.filter(l => l.tipo === 'Saída' && l.status === 'Pendente');
  const contasReceber = lancamentos.filter(l => l.tipo === 'Entrada' && l.status === 'Pendente');

  const vencidosCount = [...contasPagar, ...contasReceber].filter(l => diffDias(l.data_vencimento) !== null && diffDias(l.data_vencimento) < 0).length;
  const vencendoCount = [...contasPagar, ...contasReceber].filter(l => { const d = diffDias(l.data_vencimento); return d !== null && d >= 0 && d <= 7; }).length;

  const chartBarData = useMemo(() => Array.from({ length: 6 }, (_, i) => {
    const d = new Date(filtroAno, filtroMes - 5 + i, 1);
    const m = d.getMonth();
    const y = d.getFullYear();
    const items = lancamentos.filter(l => {
      if (!l.data) return false;
      const ld = parseISO(l.data);
      return ld.getMonth() === m && ld.getFullYear() === y && l.status !== 'Cancelado';
    });
    return {
      mes: MESES[m],
      Entradas: items.filter(l => l.tipo === 'Entrada').reduce((s, l) => s + (l.valor || 0), 0),
      Saídas: items.filter(l => l.tipo === 'Saída').reduce((s, l) => s + (l.valor || 0), 0),
    };
  }), [lancamentos, filtroMes, filtroAno]);

  const chartCategorias = useMemo(() => {
    const map = {};
    filtrados.filter(l => l.status !== 'Cancelado').forEach(l => {
      if (!map[l.categoria]) map[l.categoria] = { name: l.categoria, Entradas: 0, Saídas: 0 };
      if (l.tipo === 'Entrada') map[l.categoria].Entradas += l.valor || 0;
      else map[l.categoria].Saídas += l.valor || 0;
    });
    return Object.values(map);
  }, [filtrados]);

  const chartPrevisao = useMemo(() => {
    const mediaEntradas = chartBarData.reduce((s, d) => s + d.Entradas, 0) / 6;
    const mediaSaidas = chartBarData.reduce((s, d) => s + d.Saídas, 0) / 6;
    let saldoAcum = saldo;
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(filtroAno, filtroMes + 1 + i, 1);
      saldoAcum = saldoAcum + mediaEntradas - mediaSaidas;
      return { mes: MESES[d.getMonth()], Saldo: Math.max(0, saldoAcum), Receita: mediaEntradas, Despesa: mediaSaidas };
    });
  }, [chartBarData, saldo, filtroMes, filtroAno]);

  const dreEntradas = useMemo(() => {
    const map = {};
    filtrados.filter(l => l.tipo === 'Entrada' && l.status !== 'Cancelado').forEach(l => {
      map[l.categoria] = (map[l.categoria] || 0) + (l.valor || 0);
    });
    return map;
  }, [filtrados]);

  const dreSaidas = useMemo(() => {
    const map = {};
    filtrados.filter(l => l.tipo === 'Saída' && l.status !== 'Cancelado').forEach(l => {
      map[l.categoria] = (map[l.categoria] || 0) + (l.valor || 0);
    });
    return map;
  }, [filtrados]);

  const openNew = () => { setForm(emptyForm); setEditingId(null); setDialogOpen(true); };
  const openEdit = (l) => {
    setForm({
      tipo: l.tipo, categoria: l.categoria, descricao: l.descricao || '',
      valor: l.valor || '', data: l.data || '', data_vencimento: l.data_vencimento || '',
      status: l.status, forma_pagamento: l.forma_pagamento || 'Pix', observacoes: l.observacoes || ''
    });
    setEditingId(l.id);
    setDialogOpen(true);
  };

  const handleSave = () => saveMutation.mutate({ ...form, valor: parseFloat(form.valor) || 0 });

  const anos = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i);

  if (!unlocked) return <PasswordGate onUnlock={() => setUnlocked(true)} />;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Financeiro</h1>
          <p className="text-slate-500 text-sm">Controle financeiro do escritório</p>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          {(vencidosCount > 0 || vencendoCount > 0) && (
            <Badge className="bg-red-100 text-red-700 border border-red-200 gap-1 flex items-center">
              <AlertTriangle className="h-3 w-3" />
              {vencidosCount} vencido(s), {vencendoCount} a vencer esta semana
            </Badge>
          )}
          <Button onClick={openNew} className="bg-rose-600 hover:bg-rose-700 text-white">
            <Plus className="mr-2 h-4 w-4" />Novo Lançamento
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 items-center">
        <Select value={String(filtroMes)} onValueChange={v => setFiltroMes(Number(v))}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>{MESES.map((m, i) => <SelectItem key={i} value={String(i)}>{m}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={String(filtroAno)} onValueChange={v => setFiltroAno(Number(v))}>
          <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
          <SelectContent>{anos.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
        </Select>
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <Input className="pl-9" placeholder="Buscar..." value={busca} onChange={e => setBusca(e.target.value)} />
        </div>
      </div>

      {/* Cards resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-4">
          <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
            <TrendingUp className="h-6 w-6 text-green-600" />
          </div>
          <div>
            <p className="text-xs text-slate-500">Entradas</p>
            <p className="text-xl font-bold text-green-600">{fmt(totalEntradas)}</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-4">
          <div className="h-12 w-12 rounded-full bg-red-100 flex items-center justify-center">
            <TrendingDown className="h-6 w-6 text-red-600" />
          </div>
          <div>
            <p className="text-xs text-slate-500">Saídas</p>
            <p className="text-xl font-bold text-red-600">{fmt(totalSaidas)}</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-4">
          <div className={`h-12 w-12 rounded-full flex items-center justify-center ${saldo >= 0 ? 'bg-blue-100' : 'bg-orange-100'}`}>
            <DollarSign className={`h-6 w-6 ${saldo >= 0 ? 'text-blue-600' : 'text-orange-600'}`} />
          </div>
          <div>
            <p className="text-xs text-slate-500">Saldo do Mês</p>
            <p className={`text-xl font-bold ${saldo >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>{fmt(saldo)}</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="lancamentos">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="lancamentos">Lançamentos</TabsTrigger>
          <TabsTrigger value="graficos">Gráficos</TabsTrigger>
          <TabsTrigger value="pagar">
            Contas a Pagar
            {contasPagar.length > 0 && <span className="ml-1 bg-red-500 text-white rounded-full text-xs px-1.5 py-0.5">{contasPagar.length}</span>}
          </TabsTrigger>
          <TabsTrigger value="receber">
            Contas a Receber
            {contasReceber.length > 0 && <span className="ml-1 bg-green-500 text-white rounded-full text-xs px-1.5 py-0.5">{contasReceber.length}</span>}
          </TabsTrigger>
          <TabsTrigger value="dre">DRE</TabsTrigger>
          <TabsTrigger value="previsao">Previsão</TabsTrigger>
        </TabsList>

        {/* Lançamentos */}
        <TabsContent value="lancamentos">
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Data</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Descrição</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Categoria</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Tipo</th>
                    <th className="text-right px-4 py-3 font-medium text-slate-600">Valor</th>
                    <th className="text-center px-4 py-3 font-medium text-slate-600">Status</th>
                    <th className="text-center px-4 py-3 font-medium text-slate-600">Conciliado</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtrados.length === 0 && (
                    <tr>
                      <td colSpan={8} className="text-center py-12 text-slate-400">Nenhum lançamento encontrado</td>
                    </tr>
                  )}
                  {filtrados.map(l => (
                    <tr key={l.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-4 py-3 text-slate-600">{l.data ? format(parseISO(l.data), 'dd/MM/yyyy') : '-'}</td>
                      <td className="px-4 py-3 text-slate-800">{l.descricao}</td>
                      <td className="px-4 py-3 text-slate-500">{l.categoria}</td>
                      <td className="px-4 py-3">
                        <Badge className={l.tipo === 'Entrada' ? 'bg-green-100 text-green-700 border-0' : 'bg-red-100 text-red-700 border-0'}>
                          {l.tipo}
                        </Badge>
                      </td>
                      <td className={`px-4 py-3 text-right font-medium ${l.tipo === 'Entrada' ? 'text-green-600' : 'text-red-600'}`}>
                        {fmt(l.valor || 0)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge variant="outline" className={
                          l.status === 'Confirmado' ? 'border-green-500 text-green-600' :
                          l.status === 'Pendente' ? 'border-yellow-500 text-yellow-600' :
                          'border-slate-400 text-slate-500'
                        }>{l.status}</Badge>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => conciliarMutation.mutate({ id: l.id, val: !l.conciliado })}
                          className={`h-5 w-5 rounded border-2 mx-auto flex items-center justify-center ${l.conciliado ? 'bg-blue-600 border-blue-600' : 'border-slate-300'}`}
                        >
                          {l.conciliado && <CheckCircle className="h-3 w-3 text-white" />}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1 justify-end">
                          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(l)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-red-500" onClick={() => deleteMutation.mutate(l.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* Gráficos */}
        <TabsContent value="graficos" className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <h3 className="text-sm font-semibold text-slate-700 mb-4">Evolução Receita x Despesa (últimos 6 meses)</h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={chartBarData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="mes" />
                <YAxis tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={v => fmt(v)} />
                <Legend />
                <Bar dataKey="Entradas" fill="#22c55e" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Saídas" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <h3 className="text-sm font-semibold text-slate-700 mb-4">
              Distribuição por Categoria — {MESES[filtroMes]}/{filtroAno}
            </h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={chartCategorias} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`} />
                <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 11 }} />
                <Tooltip formatter={v => fmt(v)} />
                <Legend />
                <Bar dataKey="Entradas" fill="#22c55e" radius={[0, 4, 4, 0]} />
                <Bar dataKey="Saídas" fill="#ef4444" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </TabsContent>

        {/* Contas a Pagar */}
        <TabsContent value="pagar" className="space-y-3">
          {contasPagar.filter(l => { const d = diffDias(l.data_vencimento); return d !== null && d < 0; }).length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-600 flex-shrink-0" />
              <p className="text-sm text-red-700 font-medium">
                {contasPagar.filter(l => { const d = diffDias(l.data_vencimento); return d !== null && d < 0; }).length} conta(s) a pagar vencida(s).
              </p>
            </div>
          )}
          <ContasList items={contasPagar} tipo="pagar" onEdit={openEdit} onDelete={id => deleteMutation.mutate(id)} />
        </TabsContent>

        {/* Contas a Receber */}
        <TabsContent value="receber" className="space-y-3">
          {contasReceber.filter(l => { const d = diffDias(l.data_vencimento); return d !== null && d < 0; }).length > 0 && (
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-orange-600 flex-shrink-0" />
              <p className="text-sm text-orange-700 font-medium">
                {contasReceber.filter(l => { const d = diffDias(l.data_vencimento); return d !== null && d < 0; }).length} recebimento(s) em atraso.
              </p>
            </div>
          )}
          <ContasList items={contasReceber} tipo="receber" onEdit={openEdit} onDelete={id => deleteMutation.mutate(id)} />
        </TabsContent>

        {/* DRE */}
        <TabsContent value="dre">
          <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="h-5 w-5 text-rose-600" />
              <h3 className="text-lg font-bold text-slate-800">DRE — {MESES[filtroMes]}/{filtroAno}</h3>
            </div>
            <div>
              <p className="text-sm font-semibold text-green-700 border-b border-green-200 pb-1 mb-2">RECEITAS</p>
              {Object.entries(dreEntradas).map(([cat, val]) => (
                <div key={cat} className="flex justify-between py-1.5 text-sm border-b border-slate-100">
                  <span className="text-slate-600">{cat}</span>
                  <span className="font-medium text-green-600">{fmt(val)}</span>
                </div>
              ))}
              <div className="flex justify-between py-2 text-sm font-bold text-green-700 border-t-2 border-green-300 mt-1">
                <span>Total Receitas</span><span>{fmt(totalEntradas)}</span>
              </div>
            </div>
            <div>
              <p className="text-sm font-semibold text-red-700 border-b border-red-200 pb-1 mb-2">DESPESAS</p>
              {Object.entries(dreSaidas).map(([cat, val]) => (
                <div key={cat} className="flex justify-between py-1.5 text-sm border-b border-slate-100">
                  <span className="text-slate-600">{cat}</span>
                  <span className="font-medium text-red-600">{fmt(val)}</span>
                </div>
              ))}
              <div className="flex justify-between py-2 text-sm font-bold text-red-700 border-t-2 border-red-300 mt-1">
                <span>Total Despesas</span><span>{fmt(totalSaidas)}</span>
              </div>
            </div>
            <div className={`flex justify-between py-3 px-4 rounded-xl text-base font-bold ${saldo >= 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
              <span>RESULTADO LÍQUIDO</span><span>{fmt(saldo)}</span>
            </div>
          </div>
        </TabsContent>

        {/* Previsão */}
        <TabsContent value="previsao">
          <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-rose-600" />
              <h3 className="text-sm font-semibold text-slate-700">Previsão de Fluxo de Caixa — Próximos 6 meses</h3>
            </div>
            <p className="text-xs text-slate-400">Baseado na média mensal histórica dos últimos 6 meses.</p>
            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart data={chartPrevisao}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="mes" />
                <YAxis tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={v => fmt(v)} />
                <Legend />
                <Area type="monotone" dataKey="Saldo" fill="#bfdbfe" stroke="#3b82f6" strokeWidth={2} />
                <Line type="monotone" dataKey="Receita" stroke="#22c55e" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                <Line type="monotone" dataKey="Despesa" stroke="#ef4444" strokeWidth={2} strokeDasharray="5 5" dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
            <div className="grid grid-cols-3 gap-3 mt-2">
              {chartPrevisao.map(d => (
                <div key={d.mes} className="rounded-lg border border-slate-200 p-3 text-center">
                  <p className="text-xs text-slate-500">{d.mes}</p>
                  <p className={`text-sm font-bold ${d.Saldo >= 0 ? 'text-blue-600' : 'text-red-600'}`}>{fmt(d.Saldo)}</p>
                  <p className="text-xs text-slate-400">saldo prev.</p>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Dialog lançamento */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar' : 'Novo'} Lançamento</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Tipo</Label>
                <Select value={form.tipo} onValueChange={v => setForm(f => ({ ...f, tipo: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Entrada">Entrada</SelectItem>
                    <SelectItem value="Saída">Saída</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Data</Label>
                <Input type="date" value={form.data} onChange={e => setForm(f => ({ ...f, data: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label>Descrição</Label>
              <Input value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Valor (R$)</Label>
                <Input type="number" step="0.01" value={form.valor} onChange={e => setForm(f => ({ ...f, valor: e.target.value }))} />
              </div>
              <div>
                <Label>Vencimento</Label>
                <Input type="date" value={form.data_vencimento} onChange={e => setForm(f => ({ ...f, data_vencimento: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Confirmado">Confirmado</SelectItem>
                    <SelectItem value="Pendente">Pendente</SelectItem>
                    <SelectItem value="Cancelado">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Categoria</Label>
                <Select value={form.categoria} onValueChange={v => setForm(f => ({ ...f, categoria: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CATEGORIAS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Forma de Pagamento</Label>
              <Select value={form.forma_pagamento} onValueChange={v => setForm(f => ({ ...f, forma_pagamento: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{FORMAS.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Observações</Label>
              <Textarea rows={2} value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} className="bg-rose-600 hover:bg-rose-700 text-white" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}