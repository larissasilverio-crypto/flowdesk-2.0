import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Brain, Edit, Trash2, MoreVertical, Upload, FileText, X, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

export default function ConfiguracoesIA() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [formData, setFormData] = useState({
    nome: '',
    instrucoes: '',
    base_conhecimento: [],
    linguagem_permitida: '',
    restricoes: '',
    padrao_resposta: '',
    versao: '1.0',
    ativa: true,
    categoria: 'Geral',
  });

  const queryClient = useQueryClient();

  const { data: configs = [], isLoading } = useQuery({
    queryKey: ['configs-ia'],
    queryFn: () => base44.entities.ConfiguracaoIA.list(),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.ConfiguracaoIA.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['configs-ia'] });
      closeDialog();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.ConfiguracaoIA.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['configs-ia'] });
      closeDialog();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.ConfiguracaoIA.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['configs-ia'] });
    },
  });

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files);
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
    
    setFormData({
      ...formData,
      base_conhecimento: [...(formData.base_conhecimento || []), ...uploadedUrls]
    });
    setUploadingFiles(false);
  };

  const removeDocumento = (url) => {
    setFormData({
      ...formData,
      base_conhecimento: formData.base_conhecimento.filter(d => d !== url)
    });
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingItem(null);
    setFormData({
      nome: '',
      instrucoes: '',
      base_conhecimento: [],
      linguagem_permitida: '',
      restricoes: '',
      padrao_resposta: '',
      versao: '1.0',
      ativa: true,
      categoria: 'Geral',
    });
  };

  const openEditDialog = (item) => {
    setEditingItem(item);
    setFormData(item);
    setIsDialogOpen(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editingItem) {
      updateMutation.mutate({ id: editingItem.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 p-4 md:p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 md:text-3xl flex items-center gap-2">
              <Brain className="h-8 w-8 text-indigo-600" />
              Configurações da IA
            </h1>
            <p className="text-slate-500 flex items-center gap-2">
              <Lock className="h-4 w-4" />
              Área estratégica - Acesso restrito
            </p>
          </div>
          <Button 
            onClick={() => setIsDialogOpen(true)}
            className="bg-gradient-to-r from-indigo-600 to-purple-600"
          >
            <Plus className="mr-2 h-4 w-4" />
            Nova Configuração
          </Button>
        </div>

        <div className="space-y-4">
          <AnimatePresence>
            {configs.map((config, index) => (
              <motion.div
                key={config.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ delay: index * 0.05 }}
                className="rounded-2xl border-2 border-slate-200 bg-white p-6"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-slate-800">{config.nome}</h3>
                      {config.ativa && <Badge className="bg-emerald-100 text-emerald-700">Ativa</Badge>}
                      <Badge className="bg-purple-100 text-purple-700">{config.categoria}</Badge>
                      <Badge variant="outline">v{config.versao}</Badge>
                    </div>
                    <p className="text-sm text-slate-600 mb-3">{config.instrucoes}</p>
                    {config.base_conhecimento && config.base_conhecimento.length > 0 && (
                      <div className="flex items-center gap-1 text-xs text-slate-500">
                        <FileText className="h-3 w-3" />
                        <span>{config.base_conhecimento.length} documento(s) de treinamento</span>
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
                      <DropdownMenuItem onClick={() => openEditDialog(config)}>
                        <Edit className="mr-2 h-4 w-4" />
                        Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => deleteMutation.mutate(config.id)} className="text-red-600">
                        <Trash2 className="mr-2 h-4 w-4" />
                        Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingItem ? 'Editar Configuração' : 'Nova Configuração'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label>Nome da Configuração *</Label>
                <Input
                  value={formData.nome}
                  onChange={(e) => setFormData({...formData, nome: e.target.value})}
                  required
                />
              </div>
              <div>
                <Label>Instruções Gerais da IA *</Label>
                <Textarea
                  value={formData.instrucoes}
                  onChange={(e) => setFormData({...formData, instrucoes: e.target.value})}
                  rows={5}
                  placeholder="Defina como a IA deve se comportar, qual o tom de voz, objetivos..."
                  required
                />
              </div>
              <div>
                <Label>Documentos de Treinamento</Label>
                <div className="flex flex-col gap-2">
                  <Input
                    type="file"
                    multiple
                    accept=".pdf,.doc,.docx,.txt"
                    onChange={handleFileUpload}
                    disabled={uploadingFiles}
                  />
                  {formData.base_conhecimento && formData.base_conhecimento.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {formData.base_conhecimento.map((url, idx) => (
                        <Badge key={idx} variant="outline" className="pr-1">
                          <FileText className="h-3 w-3 mr-1" />
                          Doc {idx + 1}
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-4 w-4 ml-1"
                            onClick={() => removeDocumento(url)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div>
                <Label>Linguagem Permitida</Label>
                <Textarea
                  value={formData.linguagem_permitida}
                  onChange={(e) => setFormData({...formData, linguagem_permitida: e.target.value})}
                  rows={3}
                  placeholder="Ex: Tom formal, linguagem acessível, evitar jargões..."
                />
              </div>
              <div>
                <Label>Restrições (O que NÃO pode fazer/falar)</Label>
                <Textarea
                  value={formData.restricoes}
                  onChange={(e) => setFormData({...formData, restricoes: e.target.value})}
                  rows={3}
                  placeholder="Ex: Não dar conselhos médicos, não fazer promessas..."
                />
              </div>
              <div>
                <Label>Padrão de Resposta</Label>
                <Textarea
                  value={formData.padrao_resposta}
                  onChange={(e) => setFormData({...formData, padrao_resposta: e.target.value})}
                  rows={3}
                  placeholder="Ex: Sempre cumprimentar, pedir mais informações..."
                />
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <Label>Categoria</Label>
                  <Select value={formData.categoria} onValueChange={(value) => setFormData({...formData, categoria: value})}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Atendimento">Atendimento</SelectItem>
                      <SelectItem value="Captação">Captação</SelectItem>
                      <SelectItem value="Conteúdo">Conteúdo</SelectItem>
                      <SelectItem value="Geral">Geral</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Versão</Label>
                  <Input
                    value={formData.versao}
                    onChange={(e) => setFormData({...formData, versao: e.target.value})}
                    placeholder="1.0"
                  />
                </div>
                <div className="flex items-center gap-2 pt-8">
                  <Switch
                    checked={formData.ativa}
                    onCheckedChange={(checked) => setFormData({...formData, ativa: checked})}
                  />
                  <Label>Ativa</Label>
                </div>
              </div>
              <div className="flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={closeDialog}>Cancelar</Button>
                <Button type="submit" className="bg-indigo-600">
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