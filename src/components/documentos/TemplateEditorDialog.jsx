import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Info } from 'lucide-react';

const CATEGORIAS = ['Previdenciário','Trabalhista','Bancário','Cível','Administrativo','Kit Judicial','Ficha Questionário','Rol de Testemunhas','Simulação','Solicitação de Prontuário','Solicitação de Documentos','Autodeclaração','Outro'];

const VARIAVEIS_SUGERIDAS = ['{{nome_cliente}}','{{cpf_cliente}}','{{data_nascimento}}','{{numero_processo}}','{{advogado_responsavel}}','{{data_hoje}}','{{cidade}}'];

function extrairVariaveis(texto) {
  const matches = texto?.match(/\{\{[^}]+\}\}/g) || [];
  return [...new Set(matches)];
}

export default function TemplateEditorDialog({ open, onClose, onSave, modelo }) {
  const [form, setForm] = useState({ nome: '', categoria: 'Previdenciário', descricao: '', conteudo_template: '' });

  useEffect(() => {
    if (modelo) {
      setForm({ nome: modelo.nome || '', categoria: modelo.categoria || 'Previdenciário', descricao: modelo.descricao || '', conteudo_template: modelo.conteudo_template || '' });
    } else {
      setForm({ nome: '', categoria: 'Previdenciário', descricao: '', conteudo_template: '' });
    }
  }, [modelo, open]);

  const variaveis = extrairVariaveis(form.conteudo_template);

  const inserirVariavel = (v) => {
    setForm(f => ({ ...f, conteudo_template: f.conteudo_template + v }));
  };

  const handleSave = () => {
    if (!form.nome || !form.conteudo_template) return;
    onSave({ ...form, campos_variaveis: variaveis, tipo_arquivo: 'texto' });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{modelo ? 'Editar Template' : 'Criar Template com Variáveis'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Nome do Template *</Label>
              <Input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="Ex: Procuração Previdenciária" />
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
            <Label>Descrição</Label>
            <Input value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} placeholder="Breve descrição do documento" />
          </div>

          <div className="bg-blue-50 rounded-lg p-3 flex gap-2">
            <Info className="h-4 w-4 text-blue-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs text-blue-700 font-medium">Use variáveis com duplas chaves</p>
              <p className="text-xs text-blue-600">Ao gerar o documento, estas variáveis serão substituídas pelos dados do cliente.</p>
              <div className="flex flex-wrap gap-1 mt-2">
                {VARIAVEIS_SUGERIDAS.map(v => (
                  <button key={v} onClick={() => inserirVariavel(v)} className="text-xs bg-white border border-blue-300 text-blue-700 rounded px-2 py-0.5 hover:bg-blue-100">
                    {v}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <Label>Conteúdo do Template *</Label>
            <Textarea
              rows={12}
              value={form.conteudo_template}
              onChange={e => setForm(f => ({ ...f, conteudo_template: e.target.value }))}
              placeholder="Escreva o documento aqui usando {{variáveis}} para os campos dinâmicos..."
              className="font-mono text-sm"
            />
          </div>

          {variaveis.length > 0 && (
            <div>
              <p className="text-xs text-slate-500 mb-1">Variáveis detectadas:</p>
              <div className="flex flex-wrap gap-1">
                {variaveis.map(v => <Badge key={v} variant="outline" className="text-xs">{v}</Badge>)}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} className="bg-rose-600 hover:bg-rose-700 text-white" disabled={!form.nome || !form.conteudo_template}>
            Salvar Template
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}