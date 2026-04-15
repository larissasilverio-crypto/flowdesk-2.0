import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Pencil, Trash2, Search, Instagram } from 'lucide-react';

const NIVEIS = ['Frio', 'Morno', 'Quente'];
const TIPOS_INTERACAO = ['Respondeu story', 'Comentou', 'DM', 'Curtiu', 'Seguiu', 'Outro'];
const nivelColors = { Frio: 'bg-blue-100 text-blue-700', Morno: 'bg-amber-100 text-amber-700', Quente: 'bg-red-100 text-red-700' };
const EMPTY = { nome_contato: '', instagram: '', nivel_relacionamento: 'Frio', ultima_interacao: '', tipo_interacao: 'Outro', proximo_passo: '', observacoes: '' };

export default function AbaSocialSelling() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [filterNivel, setFilterNivel] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);

  const { data: contatos = [] } = useQuery({ queryKey: ['social-selling'], queryFn: () => base44.entities.SocialSelling.list('-created_date', 500) });
  const createM = useMutation({ mutationFn: (d) => base44.entities.SocialSelling.create(d), onSuccess: () => { queryClient.invalidateQueries(['social-selling']); closeForm(); } });
  const updateM = useMutation({ mutationFn: ({ id, data }) => base44.entities.SocialSelling.update(id, data), onSuccess: () => { queryClient.invalidateQueries(['social-selling']); closeForm(); } });
  const deleteM = useMutation({ mutationFn: (id) => base44.entities.SocialSelling.delete(id), onSuccess: () => queryClient.invalidateQueries(['social-selling']) });

  const closeForm = () => { setShowForm(false); setEditing(null); setForm(EMPTY); };
  const openEdit = (item) => { setEditing(item); setForm({ nome_contato: item.nome_contato || '', instagram: item.instagram || '', nivel_relacionamento: item.nivel_relacionamento || 'Frio', ultima_interacao: item.ultima_interacao || '', tipo_interacao: item.tipo_interacao || 'Outro', proximo_passo: item.proximo_passo || '', observacoes: item.observacoes || '' }); setShowForm(true); };
  const save = () => { if (!form.nome_contato.trim()) return; editing ? updateM.mutate({ id: editing.id, data: form }) : createM.mutate(form); };

  const filtered = contatos.filter(c => {
    const matchSearch = !search || c.nome_contato?.toLowerCase().includes(search.toLowerCase()) || c.instagram?.toLowerCase().includes(search.toLowerCase());
    const matchNivel = filterNivel === 'all' || c.nivel_relacionamento === filterNivel;
    return matchSearch && matchNivel;
  });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        {NIVEIS.map(n => (
          <div key={n} className={`rounded-lg p-3 text-center border cursor-pointer transition-all ${filterNivel === n ? 'ring-2 ring-rose-400' : ''} ${nivelColors[n] || ''}`} onClick={() => setFilterNivel(filterNivel === n ? 'all' : n)}>
            <p className="text-2xl font-bold">{contatos.filter(c => c.nivel_relacionamento === n).length}</p>
            <p className="text-xs">{n}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input placeholder="Buscar contato ou @..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Button size="sm" className="bg-rose-600 hover:bg-rose-700 text-white" onClick={() => { setEditing(null); setShowForm(true); }}>
          <Plus className="h-3.5 w-3.5 mr-1" />Novo Contato
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {filtered.map(c => (
          <div key={c.id} className="rounded-xl border border-border bg-card p-4 hover:shadow-sm transition-shadow">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div>
                <p className="font-semibold text-foreground text-sm">{c.nome_contato}</p>
                {c.instagram && <p className="text-xs text-slate-500 flex items-center gap-1"><Instagram className="h-3 w-3" />{c.instagram}</p>}
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(c)}><Pencil className="h-3.5 w-3.5" /></Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400" onClick={() => deleteM.mutate(c.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
              </div>
            </div>
            <div className="flex flex-wrap gap-1 mb-2">
              <Badge className={`text-xs ${nivelColors[c.nivel_relacionamento] || ''}`}>{c.nivel_relacionamento}</Badge>
              {c.tipo_interacao && <Badge variant="outline" className="text-xs">{c.tipo_interacao}</Badge>}
            </div>
            {c.ultima_interacao && <p className="text-xs text-slate-500">Última: {c.ultima_interacao}</p>}
            {c.proximo_passo && <p className="text-xs text-slate-600 mt-1 italic">→ {c.proximo_passo}</p>}
          </div>
        ))}
        {filtered.length === 0 && <div className="col-span-3 text-center text-slate-400 py-8 text-sm">Nenhum contato cadastrado</div>}
      </div>

      <Dialog open={showForm} onOpenChange={o => !o && closeForm()}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? 'Editar Contato' : 'Novo Contato Social Selling'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Nome *</Label><Input value={form.nome_contato} onChange={e => setForm(p => ({ ...p, nome_contato: e.target.value }))} /></div>
              <div><Label>@ Instagram</Label><Input value={form.instagram} onChange={e => setForm(p => ({ ...p, instagram: e.target.value }))} placeholder="@usuario" /></div>
              <div><Label>Nível de Relacionamento</Label>
                <Select value={form.nivel_relacionamento} onValueChange={v => setForm(p => ({ ...p, nivel_relacionamento: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{NIVEIS.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Tipo de Interação</Label>
                <Select value={form.tipo_interacao} onValueChange={v => setForm(p => ({ ...p, tipo_interacao: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{TIPOS_INTERACAO.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Última Interação</Label><Input type="date" value={form.ultima_interacao} onChange={e => setForm(p => ({ ...p, ultima_interacao: e.target.value }))} /></div>
            </div>
            <div><Label>Próximo Passo</Label><Input value={form.proximo_passo} onChange={e => setForm(p => ({ ...p, proximo_passo: e.target.value }))} /></div>
            <div><Label>Observações</Label><Textarea value={form.observacoes} onChange={e => setForm(p => ({ ...p, observacoes: e.target.value }))} rows={3} /></div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={closeForm}>Cancelar</Button>
              <Button className="bg-rose-600 hover:bg-rose-700 text-white" onClick={save}>{editing ? 'Atualizar' : 'Criar'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}