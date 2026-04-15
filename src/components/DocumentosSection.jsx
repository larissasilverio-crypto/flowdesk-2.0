import React, { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Upload, FileText, Trash2, Pencil, Download, Loader2, FolderOpen, Eye, ExternalLink, X } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const TIPOS = ['Documento pessoal', 'Procuração', 'Comprovante', 'CNIS', 'Laudo', 'Requerimento', 'Petição', 'Sentença', 'Decisão', 'Guia', 'Comprovante de residência', 'Outro'];
const CATEGORIAS = ['Todos', 'Pessoal', 'Médico', 'Administrativo', 'Jurídico', 'Outro'];

const CAT_COLORS = {
  Pessoal: 'bg-blue-100 text-blue-700',
  Médico: 'bg-green-100 text-green-700',
  Administrativo: 'bg-amber-100 text-amber-700',
  Jurídico: 'bg-purple-100 text-purple-700',
  Outro: 'bg-slate-100 text-slate-600',
};

const EMPTY = {
  nome_documento: '',
  tipo_documento: 'Outro',
  categoria_documento: 'Outro',
  descricao_documento: '',
  data_documento: '',
  observacoes: '',
};

function getFileType(url) {
  if (!url) return 'outro';
  const ext = url.split('.').pop().split('?')[0].toLowerCase();
  if (['pdf'].includes(ext)) return 'pdf';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) return 'imagem';
  if (['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'].includes(ext)) return 'office';
  return 'outro';
}

function PreviewModal({ doc, onClose }) {
  if (!doc) return null;
  const tipo = getFileType(doc.arquivo_url);
  const nome = doc.nome_original_arquivo || doc.nome_documento || 'Documento';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-3 border-b border-slate-200 bg-slate-50 flex-shrink-0">
          <FileText className="h-4 w-4 text-rose-500 flex-shrink-0" />
          <span className="text-sm font-semibold text-slate-800 truncate flex-1">{nome}</span>
          <a href={doc.arquivo_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-100 transition-colors flex-shrink-0">
            <ExternalLink className="h-3.5 w-3.5" />Nova aba
          </a>
          <a href={doc.arquivo_url} download className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-100 transition-colors flex-shrink-0">
            <Download className="h-3.5 w-3.5" />Baixar
          </a>
          <button onClick={onClose} className="flex-shrink-0 rounded-lg p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
        {/* Content */}
        <div className="flex-1 min-h-0 overflow-auto bg-slate-100">
          {tipo === 'pdf' && (
            <iframe src={doc.arquivo_url} className="w-full h-full min-h-[70vh]" title={nome} />
          )}
          {tipo === 'imagem' && (
            <div className="flex items-center justify-center p-6 min-h-[60vh]">
              <img src={doc.arquivo_url} alt={nome} className="max-w-full max-h-[75vh] object-contain rounded-xl shadow-lg" />
            </div>
          )}
          {tipo === 'office' && (
            <iframe
              src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(doc.arquivo_url)}`}
              className="w-full min-h-[70vh]"
              title={nome}
            />
          )}
          {tipo === 'outro' && (
            <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4 text-slate-500">
              <FileText className="h-14 w-14 opacity-20" />
              <p className="text-sm">Este formato não pode ser visualizado diretamente.</p>
              <a href={doc.arquivo_url} download className="flex items-center gap-2 rounded-xl bg-rose-600 text-white px-5 py-2.5 text-sm font-medium hover:bg-rose-700 transition-colors">
                <Download className="h-4 w-4" />Baixar arquivo
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function DocumentosSection({ clienteId, processoId, userEmail }) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef(null);
  const [filterCat, setFilterCat] = useState('Todos');
  const [uploading, setUploading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [pendingFiles, setPendingFiles] = useState([]);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [previewDoc, setPreviewDoc] = useState(null);
  const [uploadError, setUploadError] = useState('');

  const queryKey = clienteId
    ? ['docs-cliente', clienteId]
    : ['docs-processo', processoId];

  const { data: docs = [], isLoading } = useQuery({
    queryKey,
    queryFn: () => clienteId
      ? base44.entities.DocumentoVinculado.filter({ cliente_id: clienteId }, '-created_date', 500)
      : base44.entities.DocumentoVinculado.filter({ processo_id: processoId }, '-created_date', 500),
    enabled: !!(clienteId || processoId),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.DocumentoVinculado.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey }); closeDialog(); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.DocumentoVinculado.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey }); closeDialog(); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.DocumentoVinculado.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey }); setDeleteTarget(null); },
  });

  const handleFileSelect = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploadError('');
    if (files.length === 1) {
      setPendingFiles(files);
      setForm({ ...EMPTY, nome_documento: files[0].name.replace(/\.[^/.]+$/, '') });
      setEditingItem(null);
      setDialogOpen(true);
    } else {
      setUploading(true);
      const email = userEmail || 'sistema';
      try {
        for (const file of files) {
          const res = await base44.integrations.Core.UploadFile({ file });
          await base44.entities.DocumentoVinculado.create({
            nome_documento: file.name.replace(/\.[^/.]+$/, ''),
            tipo_documento: 'Outro',
            categoria_documento: 'Outro',
            arquivo_url: res.file_url,
            nome_original_arquivo: file.name,
            ...(clienteId ? { cliente_id: clienteId } : {}),
            ...(processoId ? { processo_id: processoId } : {}),
            criado_por: email,
            atualizado_por: email,
          });
        }
        queryClient.invalidateQueries({ queryKey });
      } catch (err) {
        setUploadError('Erro ao enviar arquivo(s). Tente novamente.');
      } finally {
        setUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    }
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingItem(null);
    setForm(EMPTY);
    setPendingFiles([]);
    setUploadError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const openEdit = (doc) => {
    setEditingItem(doc);
    setPendingFiles([]);
    setForm({
      nome_documento: doc.nome_documento || '',
      tipo_documento: doc.tipo_documento || 'Outro',
      categoria_documento: doc.categoria_documento || 'Outro',
      descricao_documento: doc.descricao_documento || '',
      data_documento: doc.data_documento || '',
      observacoes: doc.observacoes || '',
    });
    setDialogOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setUploading(true);
    setUploadError('');
    const email = userEmail || 'sistema';
    try {
      let arquivo_url = editingItem?.arquivo_url || '';
      let nome_original = editingItem?.nome_original_arquivo || '';

      if (pendingFiles.length > 0) {
        const res = await base44.integrations.Core.UploadFile({ file: pendingFiles[0] });
        arquivo_url = res.file_url;
        nome_original = pendingFiles[0].name;
      }

      const payload = {
        ...form,
        arquivo_url,
        nome_original_arquivo: nome_original,
        ...(clienteId ? { cliente_id: clienteId } : {}),
        ...(processoId ? { processo_id: processoId } : {}),
        atualizado_por: email,
      };

      if (editingItem) {
        updateMutation.mutate({ id: editingItem.id, data: payload });
      } else {
        createMutation.mutate({ ...payload, criado_por: email });
      }
    } catch (err) {
      setUploadError('Erro ao enviar o arquivo. Verifique o arquivo e tente novamente.');
    } finally {
      setUploading(false);
    }
  };

  const filtered = (filterCat === 'Todos' ? docs : docs.filter(d => d.categoria_documento === filterCat))
    .slice()
    .sort((a, b) => (a.nome_documento || '').localeCompare(b.nome_documento || '', 'pt-BR', { sensitivity: 'base' }));

  const getFileExt = (url) => {
    if (!url) return '';
    const parts = url.split('.');
    return parts[parts.length - 1]?.toUpperCase().slice(0, 4) || '';
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <FolderOpen className="h-5 w-5 text-rose-500" />
          <span className="font-semibold text-slate-700 text-sm">{docs.length} documento(s)</span>
        </div>
        <div className="flex gap-2 flex-wrap">
          {/* Filtro de categoria */}
          <div className="flex gap-1 flex-wrap">
            {CATEGORIAS.map(cat => (
              <button
                key={cat}
                onClick={() => setFilterCat(cat)}
                className={`text-xs px-2.5 py-1 rounded-full font-medium transition-all ${filterCat === cat ? 'bg-rose-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              >
                {cat}
              </button>
            ))}
          </div>
          <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileSelect} />
          <Button size="sm" onClick={() => fileInputRef.current?.click()} className="bg-rose-600 hover:bg-rose-700 text-white">
            <Upload className="mr-1.5 h-3.5 w-3.5" />
            Anexar
          </Button>
        </div>
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-rose-400" /></div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 gap-3 text-slate-400 border-2 border-dashed border-slate-200 rounded-xl">
          <FolderOpen className="h-10 w-10 opacity-20" />
          <p className="text-sm">Nenhum documento anexado.</p>
          <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
            <Upload className="mr-1.5 h-3.5 w-3.5" />
            Anexar documento
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {filtered.map(doc => (
            <div key={doc.id} className="rounded-xl border border-slate-200 bg-white p-4 hover:border-rose-200 hover:shadow-sm transition-all flex gap-3">
              {/* File icon */}
              <div className="flex-shrink-0 h-10 w-10 rounded-lg bg-rose-50 border border-rose-100 flex flex-col items-center justify-center">
                <FileText className="h-4 w-4 text-rose-400" />
                <span className="text-[8px] text-rose-400 font-bold leading-none mt-0.5">{getFileExt(doc.arquivo_url)}</span>
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800 truncate">{doc.nome_documento}</p>
                {doc.nome_original_arquivo && doc.nome_original_arquivo !== doc.nome_documento && (
                  <p className="text-xs text-slate-400 truncate">{doc.nome_original_arquivo}</p>
                )}
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  {doc.tipo_documento && (
                    <span className="text-[10px] text-slate-500 border border-slate-200 px-1.5 py-0.5 rounded">{doc.tipo_documento}</span>
                  )}
                  {doc.categoria_documento && (
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${CAT_COLORS[doc.categoria_documento] || 'bg-slate-100 text-slate-500'}`}>
                      {doc.categoria_documento}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-400">
                  {doc.criado_por && <span>Por: {doc.criado_por.split('@')[0]}</span>}
                  {doc.created_date && <span>{format(new Date(doc.created_date), 'dd/MM/yy', { locale: ptBR })}</span>}
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-1 flex-shrink-0">
                {doc.arquivo_url && (
                  <Button size="icon" variant="ghost" className="h-7 w-7" title="Visualizar" onClick={() => setPreviewDoc(doc)}>
                    <Eye className="h-3.5 w-3.5 text-rose-500" />
                  </Button>
                )}
                {doc.arquivo_url && (
                  <a href={doc.arquivo_url} download target="_blank" rel="noopener noreferrer">
                    <Button size="icon" variant="ghost" className="h-7 w-7" title="Baixar">
                      <Download className="h-3.5 w-3.5 text-slate-400" />
                    </Button>
                  </a>
                )}
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(doc)}>
                  <Pencil className="h-3.5 w-3.5 text-slate-400" />
                </Button>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setDeleteTarget(doc)}>
                  <Trash2 className="h-3.5 w-3.5 text-red-400" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Editar Documento' : 'Novo Documento'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            {uploadError && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
                {uploadError}
              </div>
            )}
            {pendingFiles.length > 0 && (
              <div className="rounded-lg bg-rose-50 border border-rose-100 px-3 py-2 text-xs text-rose-700 flex items-center gap-2">
                <FileText className="h-3.5 w-3.5" />
                <span className="font-medium truncate">{pendingFiles[0].name}</span>
                <span className="text-rose-400 ml-auto flex-shrink-0">({(pendingFiles[0].size / 1024).toFixed(0)} KB)</span>
              </div>
            )}
            <div className="space-y-1">
              <Label>Nome do Documento *</Label>
              <Input required value={form.nome_documento} onChange={e => setForm({ ...form, nome_documento: e.target.value })} placeholder="Nome para identificar o documento..." />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Tipo</Label>
                <Select value={form.tipo_documento} onValueChange={v => setForm({ ...form, tipo_documento: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{TIPOS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Categoria</Label>
                <Select value={form.categoria_documento} onValueChange={v => setForm({ ...form, categoria_documento: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CATEGORIAS.filter(c => c !== 'Todos').map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Data do Documento</Label>
              <Input type="date" value={form.data_documento} onChange={e => setForm({ ...form, data_documento: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Descrição</Label>
              <Textarea rows={2} value={form.descricao_documento} onChange={e => setForm({ ...form, descricao_documento: e.target.value })} />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={closeDialog}>Cancelar</Button>
              <Button type="submit" className="bg-rose-600 hover:bg-rose-700 text-white" disabled={uploading || createMutation.isPending || updateMutation.isPending}>
                {uploading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Enviando...</> : editingItem ? 'Salvar' : `Anexar${pendingFiles.length > 0 ? ` (${pendingFiles.length})` : ''}`}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Preview Modal */}
      {previewDoc && <PreviewModal doc={previewDoc} onClose={() => setPreviewDoc(null)} />}

      {/* Confirmar exclusão */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir documento?</AlertDialogTitle>
            <AlertDialogDescription>Tem certeza que deseja excluir <strong>"{deleteTarget?.nome_documento}"</strong>?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => deleteMutation.mutate(deleteTarget.id)}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}