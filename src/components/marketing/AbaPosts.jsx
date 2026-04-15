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
import { Plus, Pencil, Trash2, Upload, Paperclip, X, Search, ImageIcon, Image } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const STATUS_POSTS = ['Rascunho', 'Agendado', 'Publicado', 'Arquivado'];
const REDES = ['Instagram', 'Facebook', 'LinkedIn', 'TikTok', 'YouTube', 'WhatsApp', 'Todas'];
const TIPOS_CONTEUDO = ['Carrossel', 'Reels', 'Stories', 'Feed', 'Vídeo', 'Artigo'];
const statusPostColors = { Rascunho: 'bg-slate-100 text-slate-600', Agendado: 'bg-blue-100 text-blue-700', Publicado: 'bg-green-100 text-green-700', Arquivado: 'bg-amber-100 text-amber-700' };

const EMPTY = { titulo: '', legenda: '', midia: [], rede_social: 'Instagram', tipo_conteudo: 'Feed', tags: [], campanha: '', data_publicacao: '', status: 'Rascunho', observacoes: '' };

async function uploadMultipleFiles(files) {
  const urls = [];
  for (const file of files) { const { file_url } = await base44.integrations.Core.UploadFile({ file }); urls.push(file_url); }
  return urls;
}

export default function AbaPosts() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterRede, setFilterRede] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [uploading, setUploading] = useState(false);

  const { data: posts = [] } = useQuery({ queryKey: ['posts-marketing'], queryFn: () => base44.entities.PostMarketing.list('-created_date') });
  const createM = useMutation({ mutationFn: (d) => base44.entities.PostMarketing.create(d), onSuccess: () => { queryClient.invalidateQueries(['posts-marketing']); closeForm(); } });
  const updateM = useMutation({ mutationFn: ({ id, data }) => base44.entities.PostMarketing.update(id, data), onSuccess: () => { queryClient.invalidateQueries(['posts-marketing']); closeForm(); } });
  const deleteM = useMutation({ mutationFn: (id) => base44.entities.PostMarketing.delete(id), onSuccess: () => queryClient.invalidateQueries(['posts-marketing']) });

  const closeForm = () => { setShowForm(false); setEditing(null); setForm(EMPTY); };
  const openEdit = (item) => { setEditing(item); setForm({ titulo: item.titulo || '', legenda: item.legenda || '', midia: item.midia || [], rede_social: item.rede_social || 'Instagram', tipo_conteudo: item.tipo_conteudo || 'Feed', tags: item.tags || [], campanha: item.campanha || '', data_publicacao: item.data_publicacao || '', status: item.status || 'Rascunho', observacoes: item.observacoes || '' }); setShowForm(true); };
  const save = () => { if (!form.titulo.trim()) return; editing ? updateM.mutate({ id: editing.id, data: form }) : createM.mutate(form); };

  const handleUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploading(true);
    const urls = await uploadMultipleFiles(files);
    setForm(p => ({ ...p, midia: [...(p.midia || []), ...urls] }));
    setUploading(false);
    e.target.value = '';
  };

  const filtered = posts.filter(p => {
    const q = search.toLowerCase();
    const matchSearch = !q || p.titulo?.toLowerCase().includes(q) || p.legenda?.toLowerCase().includes(q);
    const matchStatus = filterStatus === 'all' || p.status === filterStatus;
    const matchRede = filterRede === 'all' || p.rede_social === filterRede;
    return matchSearch && matchStatus && matchRede;
  });

  const stats = STATUS_POSTS.map(s => ({ label: s, count: posts.filter(p => p.status === s).length }));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {stats.map(s => (
          <div key={s.label} className={`rounded-xl p-3 text-center cursor-pointer border transition-all ${filterStatus === s.label ? 'ring-2 ring-rose-400' : ''} ${statusPostColors[s.label] || ''}`} onClick={() => setFilterStatus(filterStatus === s.label ? 'all' : s.label)}>
            <p className="text-2xl font-bold">{s.count}</p>
            <p className="text-xs mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex flex-wrap gap-2 flex-1">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input placeholder="Buscar posts..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-36"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent><SelectItem value="all">Todos</SelectItem>{STATUS_POSTS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={filterRede} onValueChange={setFilterRede}>
            <SelectTrigger className="w-36"><SelectValue placeholder="Rede" /></SelectTrigger>
            <SelectContent><SelectItem value="all">Todas as redes</SelectItem>{REDES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <Button size="sm" className="bg-rose-600 hover:bg-rose-700 text-white" onClick={() => { setEditing(null); setShowForm(true); }}>
          <Plus className="h-3.5 w-3.5 mr-1" />Novo Post
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <AnimatePresence>
          {filtered.map((post, i) => (
            <motion.div key={post.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ delay: i * 0.04 }} className="rounded-xl border border-border bg-card p-4 hover:shadow-sm transition-shadow">
              {post.midia?.[0] && post.midia[0].match(/\.(jpg|jpeg|png|gif|webp)/i) ? (
                <img src={post.midia[0]} alt="mídia" className="w-full h-36 object-cover rounded-lg mb-3" />
              ) : post.midia?.[0] ? (
                <div className="w-full h-20 bg-slate-100 rounded-lg mb-3 flex items-center justify-center"><ImageIcon className="h-8 w-8 text-slate-300" /></div>
              ) : null}
              <div className="flex items-start justify-between gap-2 mb-2">
                <p className="font-semibold text-foreground text-sm line-clamp-2 flex-1">{post.titulo}</p>
                <div className="flex gap-1 flex-shrink-0">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(post)}><Pencil className="h-3.5 w-3.5" /></Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => deleteM.mutate(post.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              </div>
              <div className="flex flex-wrap gap-1 mb-2">
                <Badge className={`text-xs ${statusPostColors[post.status] || ''}`}>{post.status}</Badge>
                {post.rede_social && <Badge variant="outline" className="text-xs">{post.rede_social}</Badge>}
                {post.tipo_conteudo && <Badge variant="outline" className="text-xs">{post.tipo_conteudo}</Badge>}
              </div>
              {post.legenda && <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{post.legenda}</p>}
              {post.data_publicacao && <p className="text-xs text-slate-400">📅 {post.data_publicacao}</p>}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      {filtered.length === 0 && <div className="flex flex-col items-center justify-center py-16 text-slate-400"><Image className="h-12 w-12 mb-3 opacity-20" /><p className="text-sm">Nenhum post encontrado</p></div>}

      <Dialog open={showForm} onOpenChange={o => !o && closeForm()}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? 'Editar Post' : 'Novo Post'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Título *</Label><Input value={form.titulo} onChange={e => setForm(p => ({ ...p, titulo: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Rede Social</Label><Select value={form.rede_social} onValueChange={v => setForm(p => ({ ...p, rede_social: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{REDES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent></Select></div>
              <div><Label>Tipo de Conteúdo</Label><Select value={form.tipo_conteudo} onValueChange={v => setForm(p => ({ ...p, tipo_conteudo: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{TIPOS_CONTEUDO.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select></div>
              <div><Label>Status</Label><Select value={form.status} onValueChange={v => setForm(p => ({ ...p, status: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{STATUS_POSTS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></div>
              <div><Label>Data de Publicação</Label><Input type="date" value={form.data_publicacao} onChange={e => setForm(p => ({ ...p, data_publicacao: e.target.value }))} /></div>
              <div className="col-span-2"><Label>Campanha</Label><Input value={form.campanha} onChange={e => setForm(p => ({ ...p, campanha: e.target.value }))} placeholder="Ex: BPC Dezembro" /></div>
            </div>
            <div><Label>Legenda</Label><Textarea value={form.legenda} onChange={e => setForm(p => ({ ...p, legenda: e.target.value }))} rows={4} /></div>
            <div><Label>Tags (separadas por vírgula)</Label><Input value={(form.tags || []).join(', ')} onChange={e => setForm(p => ({ ...p, tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean) }))} /></div>
            <div>
              <Label>Imagens / Vídeos</Label>
              <label className="mt-1 flex items-center gap-2 cursor-pointer border border-dashed border-slate-300 rounded-lg p-3 hover:border-rose-300 hover:bg-rose-50">
                <Upload className="h-4 w-4 text-slate-400" />
                <span className="text-sm text-slate-500">{uploading ? 'Enviando...' : 'Selecionar arquivos'}</span>
                <input type="file" multiple className="hidden" onChange={handleUpload} disabled={uploading} accept="image/*,video/*" />
              </label>
              {form.midia?.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {form.midia.map((url, i) => (
                    <div key={i} className="flex items-center gap-1 border border-slate-200 rounded px-2 py-1 bg-slate-50 text-xs">
                      <Paperclip className="h-3 w-3 text-slate-400" />
                      <a href={url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">Mídia {i + 1}</a>
                      <button onClick={() => setForm(p => ({ ...p, midia: p.midia.filter((_, idx) => idx !== i) }))} className="text-red-400"><X className="h-3 w-3" /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={closeForm}>Cancelar</Button>
              <Button className="bg-rose-600 hover:bg-rose-700 text-white" onClick={save}>{editing ? 'Atualizar' : 'Criar'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}