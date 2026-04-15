import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FileText, Download, Play, Pencil, Trash2, Tag, File } from 'lucide-react';

const categoriaColors = {
  'Previdenciário': 'bg-blue-100 text-blue-700 border-blue-200',
  'Trabalhista': 'bg-orange-100 text-orange-700 border-orange-200',
  'Bancário': 'bg-purple-100 text-purple-700 border-purple-200',
  'Cível': 'bg-green-100 text-green-700 border-green-200',
  'Administrativo': 'bg-slate-100 text-slate-700 border-slate-200',
  'Kit Judicial': 'bg-rose-100 text-rose-700 border-rose-200',
  'Outro': 'bg-gray-100 text-gray-700 border-gray-200',
};

const tipoIcon = {
  'docx': '📄',
  'doc': '📄',
  'pdf': '📕',
  'outro': '📎',
};

export default function ModeloCard({ modelo, isAdmin, onUsar, onEditar, onExcluir }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-2xl flex-shrink-0">{tipoIcon[modelo.tipo_arquivo] || '📄'}</span>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-slate-800 text-sm leading-snug truncate">{modelo.nome}</h3>
            <p className="text-xs text-slate-500 mt-0.5">v{modelo.versao || '1.0'}</p>
          </div>
        </div>
        <Badge className={`${categoriaColors[modelo.categoria] || categoriaColors['Outro']} border text-xs flex-shrink-0`}>
          {modelo.categoria}
        </Badge>
      </div>

      {modelo.descricao && (
        <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">{modelo.descricao}</p>
      )}

      {modelo.tags && modelo.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {modelo.tags.slice(0, 4).map((tag) => (
            <span key={tag} className="inline-flex items-center gap-0.5 text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full">
              <Tag className="h-2.5 w-2.5" />
              {tag}
            </span>
          ))}
          {modelo.tags.length > 4 && (
            <span className="text-[10px] text-slate-400">+{modelo.tags.length - 4}</span>
          )}
        </div>
      )}

      <div className="flex items-center justify-between pt-2 border-t border-slate-100">
        <div className="flex items-center gap-1 text-xs text-slate-400">
          <File className="h-3 w-3" />
          {modelo.nome_arquivo || 'arquivo.docx'}
        </div>
        <Badge variant="outline" className={`text-[10px] ${modelo.status === 'ativo' ? 'border-green-200 text-green-700' : 'border-slate-200 text-slate-400'}`}>
          {modelo.status}
        </Badge>
      </div>

      <div className="flex gap-2 pt-1">
        <Button
          size="sm"
          className="flex-1 h-8 text-xs bg-rose-600 hover:bg-rose-700 text-white"
          onClick={() => onUsar(modelo)}
          disabled={modelo.status !== 'ativo'}
        >
          <Play className="mr-1 h-3 w-3" />
          Usar Modelo
        </Button>

        <a href={modelo.arquivo_url} target="_blank" rel="noopener noreferrer">
          <Button size="icon" variant="outline" className="h-8 w-8 border-slate-200">
            <Download className="h-3.5 w-3.5 text-slate-500" />
          </Button>
        </a>

        {isAdmin && (
          <>
            <Button size="icon" variant="outline" className="h-8 w-8 border-slate-200" onClick={() => onEditar(modelo)}>
              <Pencil className="h-3.5 w-3.5 text-slate-500" />
            </Button>
            <Button size="icon" variant="outline" className="h-8 w-8 border-red-100" onClick={() => onExcluir(modelo)}>
              <Trash2 className="h-3.5 w-3.5 text-red-400" />
            </Button>
          </>
        )}
      </div>
    </div>
  );
}