import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
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
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Link } from 'react-router-dom';
import { Plus, Search, Pencil, Trash2, Eye, Users, FileText } from 'lucide-react';

const EMPTY_FORM = {
    nome_completo: '',
    cpf: '',
    rg: '',
    data_nascimento: '',
    telefone: '',
    email: '',
    endereco_completo: '',
    cidade: '',
    estado: '',
    cep: '',
    profissao: '',
    renda_mensal: '',
    observacoes: '',
    id_externo: '',
    atendimento_questionario_json: '',
    atendimento_resumo: '',
};

const EMPTY_ATENDIMENTO_FORM = {
    nome_completo: '',
    qualificacao_nacionalidade: '',
    qualificacao_estado_civil: '',
    qualificacao_profissao: '',
    qualificacao_rg: '',
    qualificacao_cpf: '',
    qualificacao_email: '',
    qualificacao_telefone: '',
    qualificacao_endereco: '',
    qualificacao_numero: '',
    qualificacao_bairro: '',
    qualificacao_cidade: '',
    qualificacao_estado: '',
    senha_meu_inss: '',
    aniversario: '',
    atendente: '',
    como_ficou_sabendo: [],

    pedido_administrativo_feito: '',
    pedido_administrativo_resultado: '',
    pedido_administrativo_data: '',
    pedido_administrativo_motivo_indeferimento: '',
    tem_copia_processo_administrativo: '',
    possui_cnis_impresso: '',

    objetivo_principal_categoria: '',
    objetivo_principal_tipos: [],
    objetivo_principal_outro: '',

    cumulado_com: [],
    cumulado_com_outro: '',

    tipo_acao: '',
    tipo_acao_tipos: [],
    tipo_acao_outro: '',
    tipo_acao_cumulado: [],
    tipo_acao_cumulado_outro: '',

    acao_trabalhista_tipos: [],
    acao_trabalhista_outro: '',

    acao_civel_tipos: [],
    acao_civel_outro: '',

    numero_ctps: '',
    serie_ctps: '',
    perdeu_ctps: '',
    periodo_acao_trabalhista: '',
    qual_periodo_acao_trabalhista: '',

    contribuiu_como: [],
    numero_carnes: '',
    perdeu_carne: '',
    cnpj_empresa: '',
    periodo_comprovado_ou_contribuido: '',
    descrever_periodo_comprovado: '',

    periodo_para_reconhecer_averbar: '',
    tipos_periodo_averbar: [],
    descrever_periodo_averbar: '',

    trabalhou_servico_publico: '',
    tem_ctc: '',
    vai_providenciar_ctc: '',
    local_periodo_servico_publico: '',

    prestou_servico_militar: '',
    comprovante_servico_militar: '',

    trabalhou_atividade_especial: '',
    tem_formularios_especial: '',
    quais_possui_especial: '',
    quais_providenciar_especial: '',

    tem_problema_saude: '',
    quando_iniciou_problema_saude: '',
    documentos_medicos: '',
    quais_documentos_medicos: '',
    documentos_medicos_providenciar: '',

    documentos_digitalizados: '',
    documentacao_completa: '',
    retorno: '',
    retorno_data: '',

    diagnostico: '',
    tipo_de_acao_livre: '',
    fatos: '',
};

const JSZIP_CDN = 'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js';

function loadJSZip() {
    if (window.JSZip) return Promise.resolve(window.JSZip);
    return new Promise((resolve, reject) => {
        const existing = document.querySelector(`script[src="${JSZIP_CDN}"]`);
        if (existing) {
            existing.addEventListener('load', () => resolve(window.JSZip));
            existing.addEventListener('error', () => reject(new Error('Failed to load JSZip')));
            if (window.JSZip) resolve(window.JSZip);
            return;
        }
        const s = document.createElement('script');
        s.src = JSZIP_CDN;
        s.async = true;
        s.onload = () => resolve(window.JSZip);
        s.onerror = () => reject(new Error('Failed to load JSZip'));
        document.head.appendChild(s);
    });
}

function fillSdtXml(xmlText, fields) {
    const originalHeader = (xmlText.match(/^<\?xml[^>]*\?>\s*/) || [''])[0];
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlText, 'application/xml');
    if (doc.getElementsByTagName('parsererror')?.length) return xmlText;
    const sdts = Array.from(doc.getElementsByTagName('w:sdt'));
    for (const sdt of sdts) {
        const pr = sdt.getElementsByTagName('w:sdtPr')[0];
        if (!pr) continue;
        const tagNode = pr.getElementsByTagName('w:tag')[0];
        const aliasNode = pr.getElementsByTagName('w:alias')[0];
        const tagVal = tagNode?.getAttribute('w:val') || aliasNode?.getAttribute('w:val') || '';
        if (!tagVal) continue;
        const normalizedKey = tagVal === 'CIdade' ? 'Cidade' : tagVal;
        if (!(normalizedKey in fields)) continue;
        const value = String(fields[normalizedKey] ?? '');
        const content = sdt.getElementsByTagName('w:sdtContent')[0];
        if (!content) continue;
        const textNodes = Array.from(content.getElementsByTagName('w:t'));
        if (!textNodes.length) continue;
        textNodes[0].textContent = value;
        for (let i = 1; i < textNodes.length; i++) textNodes[i].textContent = '';
    }
    const serializer = new XMLSerializer();
    let out = serializer.serializeToString(doc);
    out = out.replace(/^<\?xml[^>]*\?>\s*/, '');
    return originalHeader ? originalHeader + out : out;
}

async function generateDocxFromTemplateUrl({ templateUrl, outputFileName, fields }) {
    const JSZip = await loadJSZip();
    const resp = await fetch(templateUrl);
    if (!resp.ok) throw new Error(`Failed to fetch template (${resp.status})`);
    const ab = await resp.arrayBuffer();
    const zip = await JSZip.loadAsync(ab);
    const xmlFiles = Object.keys(zip.files).filter(
        (p) => p === 'word/document.xml' || /^word\/header\d+\.xml$/.test(p) || /^word\/footer\d+\.xml$/.test(p)
    );
    for (const path of xmlFiles) {
        const f = zip.file(path);
        if (!f) continue;
        const xmlText = await f.async('string');
        zip.file(path, fillSdtXml(xmlText, fields));
    }
    const outBlob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(outBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = outputFileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
}

function normalizeDateToBR(input) {
    const s = String(input || '').trim();
    if (!s) return '';
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) return s;
    const m1 = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m1) return `${m1[3]}/${m1[2]}/${m1[1]}`;
    const m2 = s.match(/^(\d{4})\/(\d{2})\/(\d{2})$/);
    if (m2) return `${m2[3]}/${m2[2]}/${m2[1]}`;
    if (s.includes('T')) {
        try {
            const d = new Date(s);
            if (!Number.isNaN(d.getTime())) {
                return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
            }
        } catch { }
    }
    return s;
}

const COMO_FICOU_SABENDO_OPCOES = ['Já é Cliente', 'Indicação de outro cliente', 'Redes Sociais/Internet', 'Outro'];
const OBJETIVO_TIPOS = ['Concessão', 'Revisão', 'Restabelecimento', 'Retificação/Inclusão', 'Idade', 'Tempo', 'Especial', 'Salário Maternidade', 'Invalidez', 'Deficiente', 'Pensão por Morte', 'Rural', 'Urbano', 'LOAS'];
const CUMULADO_COM_OPCOES = ['Inclusão/Retificação de salário de contribuição', 'Reconhecimento de tempo especial', 'Reconhecimento de tempo rural', 'Inclusão/Retificação de vínculo', 'Inclusão de vínculo', 'Pagamento de período como autônomo/facultativo', 'Reconhecimento de união estável', 'Tutela antecipada'];
const ACAO_TRABALHISTA_TIPOS = ['Reconhecimento de vínculo', 'Verbas rescisórias', 'Rescisão indireta', 'Falta depósito FGTS', 'Insalubridade', 'Horas extras', 'Danos morais'];
const ACAO_CIVEL_TIPOS = ['Cobrança', 'Rescisão contratual', 'Danos morais'];
const CONTRIBUIU_COMO_OPCOES = ['Facultativo', 'Empresário', 'Autônomo'];

function CheckboxGroup({ options, values, onChange }) {
    const safeValues = Array.isArray(values) ? values : [];
    const toggle = (option) => {
        if (safeValues.includes(option)) onChange(safeValues.filter((i) => i !== option));
        else onChange([...safeValues, option]);
    };
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {options.map((option) => (
                <label key={option} className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-foreground cursor-pointer">
                    <input type="checkbox" checked={safeValues.includes(option)} onChange={() => toggle(option)} className="h-4 w-4" />
                    <span>{option}</span>
                </label>
            ))}
        </div>
    );
}

function RadioGroup({ name, options, value, onChange }) {
    return (
        <div className="flex flex-wrap gap-3">
            {options.map((option) => (
                <label key={option} className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                    <input type="radio" name={name} checked={value === option} onChange={() => onChange(option)} />
                    <span>{option}</span>
                </label>
            ))}
        </div>
    );
}

function SectionCard({ title, children }) {
    return (
        <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-4">
            <h3 className="text-sm font-semibold text-foreground">{title}</h3>
            {children}
        </div>
    );
}

function parseSavedAtendimento(jsonString) {
    if (!jsonString) return { ...EMPTY_ATENDIMENTO_FORM };
    try {
        const parsed = typeof jsonString === 'string' ? JSON.parse(jsonString) : jsonString;
        return {
            ...EMPTY_ATENDIMENTO_FORM,
            ...parsed,
            como_ficou_sabendo: Array.isArray(parsed.como_ficou_sabendo) ? parsed.como_ficou_sabendo : [],
            objetivo_principal_tipos: Array.isArray(parsed.objetivo_principal_tipos) ? parsed.objetivo_principal_tipos : [],
            cumulado_com: Array.isArray(parsed.cumulado_com) ? parsed.cumulado_com : [],
            tipo_acao_tipos: Array.isArray(parsed.tipo_acao_tipos) ? parsed.tipo_acao_tipos : [],
            tipo_acao_cumulado: Array.isArray(parsed.tipo_acao_cumulado) ? parsed.tipo_acao_cumulado : [],
            acao_trabalhista_tipos: Array.isArray(parsed.acao_trabalhista_tipos) ? parsed.acao_trabalhista_tipos : [],
            acao_civel_tipos: Array.isArray(parsed.acao_civel_tipos) ? parsed.acao_civel_tipos : [],
            contribuiu_como: Array.isArray(parsed.contribuiu_como) ? parsed.contribuiu_como : [],
            tipos_periodo_averbar: Array.isArray(parsed.tipos_periodo_averbar) ? parsed.tipos_periodo_averbar : [],
        };
    } catch {
        return { ...EMPTY_ATENDIMENTO_FORM };
    }
}

function line(label, value) { return `${label}: ${value || '—'}`; }
function list(arr) { return Array.isArray(arr) && arr.length ? arr.join(', ') : '—'; }

function normalizeAtendimentoForSave(form, atendimentoForm) {
    return {
        ...EMPTY_ATENDIMENTO_FORM,
        ...atendimentoForm,
        nome_completo: form.nome_completo || atendimentoForm.nome_completo || '',
        qualificacao_cpf: atendimentoForm.qualificacao_cpf || form.cpf || '',
        qualificacao_rg: atendimentoForm.qualificacao_rg || form.rg || '',
        qualificacao_telefone: atendimentoForm.qualificacao_telefone || form.telefone || '',
        qualificacao_email: atendimentoForm.qualificacao_email || form.email || '',
        qualificacao_endereco: atendimentoForm.qualificacao_endereco || form.endereco_completo || '',
        qualificacao_cidade: atendimentoForm.qualificacao_cidade || form.cidade || '',
        qualificacao_estado: atendimentoForm.qualificacao_estado || form.estado || '',
        como_ficou_sabendo: Array.isArray(atendimentoForm.como_ficou_sabendo) ? atendimentoForm.como_ficou_sabendo : [],
        objetivo_principal_tipos: Array.isArray(atendimentoForm.objetivo_principal_tipos) ? atendimentoForm.objetivo_principal_tipos : [],
        cumulado_com: Array.isArray(atendimentoForm.cumulado_com) ? atendimentoForm.cumulado_com : [],
        tipo_acao_tipos: Array.isArray(atendimentoForm.tipo_acao_tipos) ? atendimentoForm.tipo_acao_tipos : [],
        tipo_acao_cumulado: Array.isArray(atendimentoForm.tipo_acao_cumulado) ? atendimentoForm.tipo_acao_cumulado : [],
        acao_trabalhista_tipos: Array.isArray(atendimentoForm.acao_trabalhista_tipos) ? atendimentoForm.acao_trabalhista_tipos : [],
        acao_civel_tipos: Array.isArray(atendimentoForm.acao_civel_tipos) ? atendimentoForm.acao_civel_tipos : [],
        contribuiu_como: Array.isArray(atendimentoForm.contribuiu_como) ? atendimentoForm.contribuiu_como : [],
        tipos_periodo_averbar: Array.isArray(atendimentoForm.tipos_periodo_averbar) ? atendimentoForm.tipos_periodo_averbar : [],
    };
}

function buildAtendimentoResumo(at) {
    return `
========================
FICHA QUESTIONÁRIO – 1º ATENDIMENTO
========================

1. NOME

${line('Nome completo', at.nome_completo || '')}

2. QUALIFICAÇÃO

${line('Nacionalidade', at.qualificacao_nacionalidade)}

${line('Estado civil', at.qualificacao_estado_civil)}

${line('RG', at.qualificacao_rg)}

${line('CPF', at.qualificacao_cpf)}

${line('Endereço', at.qualificacao_endereco)}

${line('Número', at.qualificacao_numero)}

${line('Bairro', at.qualificacao_bairro)}

${line('Cidade', at.qualificacao_cidade)}

${line('Estado', at.qualificacao_estado)}

${line('Telefone', at.qualificacao_telefone)}

${line('E-mail', at.qualificacao_email)}

${line('Senha do Meu INSS', at.senha_meu_inss)}

${line('Aniversário', at.aniversario)}

${line('Atendente', at.atendente)}

${line('Como ficou sabendo do escritório', list(at.como_ficou_sabendo))}

3. PEDIDO ADMINISTRATIVO

${line('Já fez pedido administrativo', at.pedido_administrativo_feito)}

${line('Resultado', at.pedido_administrativo_resultado)}

${line('Data', at.pedido_administrativo_data)}

${line('Motivo do indeferimento', at.pedido_administrativo_motivo_indeferimento)}

${line('Tem cópia do processo administrativo', at.tem_copia_processo_administrativo)}

${line('Possui CNIS impresso', at.possui_cnis_impresso)}

4. OBJETIVO

${line('Categoria principal', at.objetivo_principal_categoria)}

${line('Tipos objetivo principal', list(at.objetivo_principal_tipos))}

${line('Outro objetivo principal', at.objetivo_principal_outro)}

${line('Cumulado com', list(at.cumulado_com))}

${line('Outro cumulado com', at.cumulado_com_outro)}

5. AÇÃO JUDICIAL / TIPO DE AÇÃO

${line('Tipo de ação principal', at.tipo_acao)}

${line('Tipos da ação principal', list(at.tipo_acao_tipos))}

${line('Outro tipo de ação principal', at.tipo_acao_outro)}

${line('Cumulado com (ação principal)', list(at.tipo_acao_cumulado))}

${line('Outro cumulado com (ação principal)', at.tipo_acao_cumulado_outro)}

${line('Ação trabalhista - tipos', list(at.acao_trabalhista_tipos))}

${line('Ação trabalhista - outro', at.acao_trabalhista_outro)}

${line('Ação cível - tipos', list(at.acao_civel_tipos))}

${line('Ação cível - outro', at.acao_civel_outro)}

6. DOCUMENTOS E PERÍODOS

${line('Número da CTPS', at.numero_ctps)}

${line('Série da CTPS', at.serie_ctps)}

${line('Já perdeu alguma CTPS', at.perdeu_ctps)}

${line('Tem período a ser reconhecido com ação trabalhista', at.periodo_acao_trabalhista)}

${line('Qual período da ação trabalhista', at.qual_periodo_acao_trabalhista)}

${line('Já contribuiu como', list(at.contribuiu_como))}

${line('Número de carnês', at.numero_carnes)}

${line('Já perdeu algum carnê', at.perdeu_carne)}

${line('CNPJ da empresa', at.cnpj_empresa)}

${line('Tem período que pode ser comprovado/contribuído', at.periodo_comprovado_ou_contribuido)}

${line('Descrever período comprovado/contribuído', at.descrever_periodo_comprovado)}

${line('Tem período para reconhecer/averbar', at.periodo_para_reconhecer_averbar)}

${line('Tipos do período para averbar', list(at.tipos_periodo_averbar))}

${line('Descrever período para averbar', at.descrever_periodo_averbar)}

7. SERVIÇO PÚBLICO / MILITAR / ATIVIDADE ESPECIAL / SAÚDE

${line('Trabalhou no serviço público', at.trabalhou_servico_publico)}

${line('Tem CTC', at.tem_ctc)}

${line('Vai providenciar CTC', at.vai_providenciar_ctc)}

${line('Local e período do serviço público', at.local_periodo_servico_publico)}

${line('Prestou serviço militar', at.prestou_servico_militar)}

${line('Tem comprovante do serviço militar', at.comprovante_servico_militar)}

${line('Trabalhou em atividade especial', at.trabalhou_atividade_especial)}

${line('Tem formulários da atividade especial', at.tem_formularios_especial)}

${line('Quais possui da atividade especial', at.quais_possui_especial)}

${line('Quais providenciar da atividade especial', at.quais_providenciar_especial)}

${line('Tem problema de saúde', at.tem_problema_saude)}

${line('Quando iniciou o problema de saúde', at.quando_iniciou_problema_saude)}

${line('Tem documentos médicos', at.documentos_medicos)}

${line('Quais documentos médicos possui', at.quais_documentos_medicos)}

${line('Documentos médicos a providenciar', at.documentos_medicos_providenciar)}

8. PARA USO DO ESCRITÓRIO

${line('Documentos digitalizados', at.documentos_digitalizados)}

${line('Documentação completa', at.documentacao_completa)}

${line('Retorno', at.retorno)}

${line('Data do retorno', at.retorno_data)}

9. DIAGNÓSTICO

${at.diagnostico || '—'}

10. TIPO DE AÇÃO

${at.tipo_de_acao_livre || '—'}

11. FATOS

${at.fatos || '—'}
`.trim();
}

export default function Clientes() {
    const queryClient = useQueryClient();
    const [user, setUser] = React.useState(null);

    React.useEffect(() => {
        base44.auth.me().then(setUser).catch(() => { });
    }, []);

    const [search, setSearch] = useState('');
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [form, setForm] = useState(EMPTY_FORM);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [cpfError, setCpfError] = useState('');
    const [savingAtendimento, setSavingAtendimento] = useState(false);

    const [selectedTemplateId, setSelectedTemplateId] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [atendimentoDialogOpen, setAtendimentoDialogOpen] = useState(false);
    const [atendimentoForm, setAtendimentoForm] = useState(EMPTY_ATENDIMENTO_FORM);

    const { data: templatesRaw = [] } = useQuery({
        queryKey: ['template-minuta'],
        queryFn: () => base44.entities.TemplateMinuta.list(),
    });

    const templates = useMemo(() => {
        const onlyActive = (templatesRaw || []).filter((t) => t?.ativo !== false);
        return onlyActive.sort((a, b) => Number(a?.ordem || 0) - Number(b?.ordem || 0));
    }, [templatesRaw]);

    const handleGenerateDocx = async () => {
        const selectedTemplateObj = selectedTemplateId ? templates.find((t) => t.id === selectedTemplateId) : null;
        if (!selectedTemplateObj?.arquivo) { alert('Por favor, selecione uma minuta primeiro.'); return; }
        setIsGenerating(true);
        try {
            const fields = {
                Nome: form.nome_completo || '',
                Nacionalidade: atendimentoForm.qualificacao_nacionalidade || '',
                'Estado civil': atendimentoForm.qualificacao_estado_civil || '',
                RG: form.rg || atendimentoForm.qualificacao_rg || '',
                CPF: form.cpf || atendimentoForm.qualificacao_cpf || '',
                Endereco: atendimentoForm.qualificacao_endereco || form.endereco_completo || '',
                Numero: atendimentoForm.qualificacao_numero || '',
                Bairro: atendimentoForm.qualificacao_bairro || '',
                Cidade: atendimentoForm.qualificacao_cidade || form.cidade || '',
                Cidadedois: atendimentoForm.qualificacao_cidade || form.cidade || '',
                Estado: atendimentoForm.qualificacao_estado || form.estado || '',
                'Na Cidade': 'na cidade de ',
                Data: normalizeDateToBR(new Date().toISOString()),
                Fatos: atendimentoForm.fatos || '',
                Virgula: ', ',
                Tipo: selectedTemplateObj.categoria || '',
            };
            const fileSafeName = String(form.nome_completo || 'Cliente').replace(/[<>:"/\\|?*\x00-\x1F]/g, '').trim();
            const templateSafeName = String(selectedTemplateObj.nome || 'Documento').replace(/[<>:"/\\|?*\x00-\x1F]/g, '').trim();
            await generateDocxFromTemplateUrl({ templateUrl: selectedTemplateObj.arquivo, outputFileName: `${templateSafeName} - ${fileSafeName}.docx`, fields });
            alert('✅ .docx gerado e baixado com sucesso!');
        } catch (err) {
            alert('Erro ao gerar .docx: ' + (err?.message || 'Erro desconhecido'));
        } finally {
            setIsGenerating(false);
        }
    };

    const { data: clientes = [], isLoading } = useQuery({
        queryKey: ['clientes'],
        queryFn: () => base44.entities.Cliente.list('-created_date', 200),
    });

    const { data: processos = [] } = useQuery({
        queryKey: ['processos-all'],
        queryFn: () => base44.entities.Processo.list('-created_date', 500),
    });

    const createMutation = useMutation({
        mutationFn: (data) => base44.entities.Cliente.create(data),
        onSuccess: (newCliente) => {
            queryClient.setQueryData(['clientes'], (old) => old ? [newCliente, ...old] : [newCliente]);
            queryClient.invalidateQueries({ queryKey: ['clientes'] });
            closeDialog();
        },
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }) => base44.entities.Cliente.update(id, data),
        onSuccess: (updatedCliente, variables) => {
            queryClient.setQueryData(['clientes'], (old) => old ? old.map(c => c.id === variables.id ? { ...c, ...updatedCliente, ...variables.data } : c) : []);
            queryClient.invalidateQueries({ queryKey: ['clientes'] });
            closeDialog();
        },
    });

    const deleteMutation = useMutation({
        mutationFn: (id) => base44.entities.Cliente.delete(id),
        onSuccess: (_, deletedId) => {
            queryClient.setQueryData(['clientes'], (old) => old ? old.filter(c => c.id !== deletedId) : []);
            queryClient.invalidateQueries({ queryKey: ['clientes'] });
            setDeleteTarget(null);
        },
    });

    const openCreate = () => {
        setEditingItem(null);
        setForm(EMPTY_FORM);
        setCpfError('');
        setAtendimentoForm(EMPTY_ATENDIMENTO_FORM);
        setDialogOpen(true);
    };

    const extractHiddenJson = (obs) => {
        if (!obs) return { text: '', json: '' };
        const marker = '\n\n<!--HIDDEN_FICHA:';
        const endMarker = '-->';
        const startIdx = obs.indexOf(marker);
        if (startIdx !== -1) {
            const textPart = obs.substring(0, startIdx);
            const jsonPart = obs.substring(startIdx + marker.length, obs.lastIndexOf(endMarker));
            return { text: textPart, json: jsonPart };
        }
        return { text: obs, json: '' };
    };

    const openEdit = (cliente) => {
        setEditingItem(cliente);
        const { text: cleanObs, json: hiddenJson } = extractHiddenJson(cliente.observacoes);
        const nextForm = {
            nome_completo: cliente.nome_completo || '',
            cpf: cliente.cpf || '',
            rg: cliente.rg || '',
            data_nascimento: cliente.data_nascimento || '',
            telefone: cliente.telefone || '',
            email: cliente.email || '',
            endereco_completo: cliente.endereco_completo || '',
            cidade: cliente.cidade || '',
            estado: cliente.estado || '',
            cep: cliente.cep || '',
            profissao: cliente.profissao || '',
            renda_mensal: cliente.renda_mensal || '',
            observacoes: cleanObs,
            id_externo: cliente.id_externo || '',
            atendimento_questionario_json: hiddenJson || cliente.atendimento_questionario_json || '',
            atendimento_resumo: cliente.atendimento_resumo || '',
        };
        setForm(nextForm);
        const atendimentoSalvo = parseSavedAtendimento(nextForm.atendimento_questionario_json);
        setAtendimentoForm(normalizeAtendimentoForSave({
            nome_completo: cliente.nome_completo || '',
            cpf: cliente.cpf || '',
            rg: cliente.rg || '',
            telefone: cliente.telefone || '',
            email: cliente.email || '',
            endereco_completo: cliente.endereco_completo || '',
            cidade: cliente.cidade || '',
            estado: cliente.estado || '',
        }, atendimentoSalvo));
        setCpfError('');
        setDialogOpen(true);
    };

    const closeDialog = () => {
        setDialogOpen(false);
        setEditingItem(null);
        setForm(EMPTY_FORM);
        setCpfError('');
        setAtendimentoDialogOpen(false);
        setAtendimentoForm(EMPTY_ATENDIMENTO_FORM);
        setSavingAtendimento(false);
        setSelectedTemplateId('');
        setIsGenerating(false);
    };

    const openAtendimentoDialog = () => {
        setAtendimentoForm((prev) => normalizeAtendimentoForSave(form, prev));
        setAtendimentoDialogOpen(true);
    };

    const saveAtendimentoData = async () => {
        const payloadObj = normalizeAtendimentoForSave(form, atendimentoForm);
        const resumo = buildAtendimentoResumo(payloadObj);
        const jsonStr = JSON.stringify(payloadObj);
        setAtendimentoForm(payloadObj);
        setForm((prev) => ({ ...prev, atendimento_questionario_json: jsonStr, atendimento_resumo: resumo }));
        if (editingItem?.id) {
            try {
                setSavingAtendimento(true);
                const finalObs = form.observacoes ? `${form.observacoes}\n\n<!--HIDDEN_FICHA:${jsonStr}-->` : `\n\n<!--HIDDEN_FICHA:${jsonStr}-->`;
                await base44.entities.Cliente.update(editingItem.id, {
                    observacoes: finalObs,
                    atendimento_questionario_json: jsonStr,
                    atendimento_resumo: resumo,
                    atualizado_por: user?.email || 'sistema',
                });
                queryClient.invalidateQueries({ queryKey: ['clientes'] });
            } catch (error) {
                alert('Erro ao salvar o atendimento.');
                setSavingAtendimento(false);
                return;
            } finally {
                setSavingAtendimento(false);
            }
        }
        setAtendimentoDialogOpen(false);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        const cpfLimpo = (form.cpf || '').replace(/\D/g, '');
        const duplicado = clientes.find((c) => (c.cpf || '').replace(/\D/g, '') === cpfLimpo && c.id !== editingItem?.id);
        if (duplicado) { setCpfError('Já existe um cliente cadastrado com este CPF.'); return; }
        setCpfError('');
        const userEmail = user?.email || 'sistema';
        const normalizedAtendimento = normalizeAtendimentoForSave(form, atendimentoForm);
        const resumoAtendimento = buildAtendimentoResumo(normalizedAtendimento);
        const jsonStr = JSON.stringify(normalizedAtendimento);
        const finalObs = form.observacoes ? `${form.observacoes}\n\n<!--HIDDEN_FICHA:${jsonStr}-->` : `\n\n<!--HIDDEN_FICHA:${jsonStr}-->`;
        const payload = { ...form, renda_mensal: form.renda_mensal ? Number(form.renda_mensal) : undefined, observacoes: finalObs, atendimento_questionario_json: jsonStr, atendimento_resumo: resumoAtendimento, atualizado_por: userEmail };
        if (editingItem) updateMutation.mutate({ id: editingItem.id, data: payload });
        else createMutation.mutate({ ...payload, criado_por: userEmail });
    };

    const handleDelete = (cliente) => {
        const temProcessos = processos.some((p) => p.cliente_id === cliente.id);
        if (temProcessos) { alert('Não é possível excluir este cliente pois ele possui processos vinculados.'); return; }
        setDeleteTarget(cliente);
    };

    const filtered = useMemo(() => {
        const result = clientes.filter((c) => {
            const q = search.toLowerCase();
            const matchBasic = [c.nome_completo, c.cpf, c.telefone, c.email, c.cidade].some((v) =>
                v && v.toLowerCase().includes(q)
            );
            const matchProcesso = processos.filter(p => p.cliente_id === c.id).some(p =>
                [p.numero_processo, p.tipo, p.vara, p.comarca].some(v => v && v.toLowerCase().includes(q))
            );
            return matchBasic || matchProcesso;
        });
        return result.sort((a, b) =>
            (a.nome_completo || '').localeCompare(b.nome_completo || '', 'pt-BR', { sensitivity: 'base' })
        );
    }, [clientes, search, processos]);

    const countProcessos = (clienteId) => processos.filter((p) => p.cliente_id === clienteId).length;

    return (
        <div className="min-h-screen bg-background p-6">
            <div className="max-w-7xl mx-auto space-y-6">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                            <Users className="h-6 w-6 text-rose-600" />
                            Clientes
                        </h1>
                        <p className="text-sm text-muted-foreground mt-1">{clientes.length} cliente(s) cadastrado(s)</p>
                    </div>
                    <Button onClick={openCreate} className="bg-rose-600 hover:bg-rose-700 text-white">
                        <Plus className="mr-2 h-4 w-4" />
                        Novo Cliente
                    </Button>
                </div>

                <div className="relative max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input placeholder="Buscar por nome, CPF, telefone..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
                </div>

                <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-muted/40">
                                <TableHead>Nome</TableHead>
                                <TableHead>CPF</TableHead>
                                <TableHead>Telefone</TableHead>
                                <TableHead>Cidade/UF</TableHead>
                                <TableHead>Processos</TableHead>
                                <TableHead>Criado por</TableHead>
                                <TableHead className="text-right">Ações</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">Carregando...</TableCell></TableRow>
                            ) : filtered.length === 0 ? (
                                <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">Nenhum cliente encontrado.</TableCell></TableRow>
                            ) : (
                                filtered.map((c) => (
                                    <TableRow key={c.id} className="hover:bg-rose-50/30">
                                        <TableCell className="font-medium text-foreground">{c.nome_completo}</TableCell>
                                        <TableCell className="text-muted-foreground font-mono text-sm">{c.cpf}</TableCell>
                                        <TableCell className="text-muted-foreground">{c.telefone}</TableCell>
                                        <TableCell className="text-muted-foreground">{[c.cidade, c.estado].filter(Boolean).join(' / ') || '—'}</TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className="border-rose-200 text-rose-700">{countProcessos(c.id)} processo(s)</Badge>
                                        </TableCell>
                                        <TableCell className="text-xs text-muted-foreground">{c.criado_por || '—'}</TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-1">
                                                <Link to={`/ClienteDetalhe?id=${c.id}`}>
                                                    <Button size="icon" variant="ghost" title="Ver detalhes"><Eye className="h-4 w-4 text-slate-500" /></Button>
                                                </Link>
                                                <Button size="icon" variant="ghost" onClick={() => openEdit(c)} title="Editar"><Pencil className="h-4 w-4 text-slate-500" /></Button>
                                                <Button size="icon" variant="ghost" onClick={() => handleDelete(c)} title="Excluir"><Trash2 className="h-4 w-4 text-red-400" /></Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{editingItem ? 'Editar Cliente' : 'Novo Cliente'}</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-4 pt-2">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="md:col-span-2 space-y-1">
                                <Label>Nome Completo *</Label>
                                <Input required value={form.nome_completo} onChange={(e) => setForm({ ...form, nome_completo: e.target.value })} />
                            </div>
                            <div className="space-y-1">
                                <Label>CPF *</Label>
                                <Input required value={form.cpf} onChange={(e) => { setForm({ ...form, cpf: e.target.value }); setCpfError(''); }} placeholder="000.000.000-00" />
                                {cpfError && <p className="text-xs text-red-500">{cpfError}</p>}
                            </div>
                            <div className="space-y-1">
                                <Label>RG</Label>
                                <Input value={form.rg} onChange={(e) => setForm({ ...form, rg: e.target.value })} />
                            </div>
                            <div className="space-y-1">
                                <Label>Data de Nascimento</Label>
                                <Input type="date" value={form.data_nascimento} onChange={(e) => setForm({ ...form, data_nascimento: e.target.value })} />
                            </div>
                            <div className="space-y-1">
                                <Label>Telefone *</Label>
                                <Input required value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} placeholder="(00) 00000-0000" />
                            </div>
                            <div className="md:col-span-2 space-y-1">
                                <Label>E-mail</Label>
                                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                            </div>
                            <div className="md:col-span-2 space-y-1">
                                <Label>Endereço Completo</Label>
                                <Input value={form.endereco_completo} onChange={(e) => setForm({ ...form, endereco_completo: e.target.value })} placeholder="Rua, número, bairro..." />
                            </div>
                            <div className="space-y-1">
                                <Label>Cidade</Label>
                                <Input value={form.cidade} onChange={(e) => setForm({ ...form, cidade: e.target.value })} />
                            </div>
                            <div className="space-y-1">
                                <Label>Estado (UF)</Label>
                                <Input value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value })} maxLength={2} placeholder="SP" />
                            </div>
                            <div className="space-y-1">
                                <Label>CEP</Label>
                                <Input value={form.cep} onChange={(e) => setForm({ ...form, cep: e.target.value })} placeholder="00000-000" />
                            </div>
                            <div className="space-y-1">
                                <Label>Profissão</Label>
                                <Input value={form.profissao} onChange={(e) => setForm({ ...form, profissao: e.target.value })} />
                            </div>
                            <div className="space-y-1">
                                <Label>Renda Mensal (R$)</Label>
                                <Input type="number" min="0" step="0.01" value={form.renda_mensal} onChange={(e) => setForm({ ...form, renda_mensal: e.target.value })} />
                            </div>
                            <div className="space-y-1">
                                <Label>ID Externo (migração)</Label>
                                <Input value={form.id_externo} onChange={(e) => setForm({ ...form, id_externo: e.target.value })} placeholder="ID do sistema antigo" />
                            </div>
                            <div className="md:col-span-2 space-y-1">
                                <Label>Observações</Label>
                                <Textarea rows={6} value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} />
                            </div>
                            {!!form.atendimento_resumo && (
                                <div className="md:col-span-2 space-y-2">
                                    <Label>Resumo do Atendimento Salvo</Label>
                                    <div className="rounded-xl border border-border bg-muted/20 p-4">
                                        <pre className="whitespace-pre-wrap break-words text-sm text-muted-foreground font-sans leading-7">{form.atendimento_resumo}</pre>
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="flex justify-end gap-3 pt-6 border-t border-border flex-wrap items-center">
                            <div className="flex items-center gap-2 min-w-[200px]">
                                <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                                    <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Selecione a Minuta..." /></SelectTrigger>
                                    <SelectContent>{templates.map((t) => <SelectItem key={t.id} value={t.id} className="text-xs">{t.nome}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                            <Button type="button" variant="outline" className="h-9 text-xs border-rose-200 text-rose-700 hover:bg-rose-50" onClick={handleGenerateDocx} disabled={isGenerating || !selectedTemplateId}>
                                <FileText className="mr-2 h-3.5 w-3.5" />
                                {isGenerating ? 'Gerando...' : 'Gerar Ação'}
                            </Button>
                            <div className="flex-1" />
                            <Button type="button" variant="outline" className="h-9 text-xs" onClick={closeDialog}>Cancelar</Button>
                            <Button type="button" variant="outline" className="h-9 text-xs" onClick={openAtendimentoDialog}>{!!form.atendimento_resumo ? 'Editar Atendimento' : 'Adicionar Atendimento'}</Button>
                            <Button type="submit" className="h-9 text-xs bg-rose-600 hover:bg-rose-700 text-white" disabled={createMutation.isPending || updateMutation.isPending}>
                                {editingItem ? 'Salvar Alterações' : 'Cadastrar Cliente'}
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>

            <Dialog open={atendimentoDialogOpen} onOpenChange={setAtendimentoDialogOpen}>
                <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Ficha Questionário – 1º Atendimento</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-5 pt-2">
                        <SectionCard title="1. Identificação / Qualificação">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="md:col-span-2 space-y-1"><Label>Nome Completo</Label><Input value={form.nome_completo} onChange={(e) => setForm({ ...form, nome_completo: e.target.value })} /></div>
                                <div className="space-y-1"><Label>Nacionalidade</Label><Input value={atendimentoForm.qualificacao_nacionalidade} onChange={(e) => setAtendimentoForm({ ...atendimentoForm, qualificacao_nacionalidade: e.target.value })} /></div>
                                <div className="space-y-1"><Label>Estado Civil</Label><Input value={atendimentoForm.qualificacao_estado_civil} onChange={(e) => setAtendimentoForm({ ...atendimentoForm, qualificacao_estado_civil: e.target.value })} /></div>
                                <div className="space-y-1"><Label>RG</Label><Input value={atendimentoForm.qualificacao_rg} onChange={(e) => setAtendimentoForm({ ...atendimentoForm, qualificacao_rg: e.target.value })} /></div>
                                <div className="space-y-1"><Label>CPF</Label><Input value={atendimentoForm.qualificacao_cpf} onChange={(e) => setAtendimentoForm({ ...atendimentoForm, qualificacao_cpf: e.target.value })} /></div>
                                <div className="md:col-span-2 space-y-1"><Label>Endereço</Label><Input value={atendimentoForm.qualificacao_endereco} onChange={(e) => setAtendimentoForm({ ...atendimentoForm, qualificacao_endereco: e.target.value })} /></div>
                                <div className="space-y-1"><Label>Número</Label><Input value={atendimentoForm.qualificacao_numero} onChange={(e) => setAtendimentoForm({ ...atendimentoForm, qualificacao_numero: e.target.value })} /></div>
                                <div className="space-y-1"><Label>Bairro</Label><Input value={atendimentoForm.qualificacao_bairro} onChange={(e) => setAtendimentoForm({ ...atendimentoForm, qualificacao_bairro: e.target.value })} /></div>
                                <div className="space-y-1"><Label>Cidade</Label><Input value={atendimentoForm.qualificacao_cidade} onChange={(e) => setAtendimentoForm({ ...atendimentoForm, qualificacao_cidade: e.target.value })} /></div>
                                <div className="space-y-1"><Label>Estado</Label><Input value={atendimentoForm.qualificacao_estado} onChange={(e) => setAtendimentoForm({ ...atendimentoForm, qualificacao_estado: e.target.value })} /></div>
                                <div className="space-y-1"><Label>Telefone</Label><Input value={atendimentoForm.qualificacao_telefone} onChange={(e) => setAtendimentoForm({ ...atendimentoForm, qualificacao_telefone: e.target.value })} /></div>
                                <div className="space-y-1"><Label>E-mail</Label><Input value={atendimentoForm.qualificacao_email} onChange={(e) => setAtendimentoForm({ ...atendimentoForm, qualificacao_email: e.target.value })} /></div>
                                <div className="space-y-1"><Label>Senha do Meu INSS</Label><Input value={atendimentoForm.senha_meu_inss} onChange={(e) => setAtendimentoForm({ ...atendimentoForm, senha_meu_inss: e.target.value })} /></div>
                                <div className="space-y-1"><Label>Aniversário</Label><Input value={atendimentoForm.aniversario} onChange={(e) => setAtendimentoForm({ ...atendimentoForm, aniversario: e.target.value })} /></div>
                                <div className="space-y-1"><Label>Atendente</Label><Input value={atendimentoForm.atendente} onChange={(e) => setAtendimentoForm({ ...atendimentoForm, atendente: e.target.value })} /></div>
                                <div className="md:col-span-2 space-y-2">
                                    <Label>Como ficou sabendo do escritório?</Label>
                                    <CheckboxGroup options={COMO_FICOU_SABENDO_OPCOES} values={atendimentoForm.como_ficou_sabendo} onChange={(values) => setAtendimentoForm({ ...atendimentoForm, como_ficou_sabendo: values })} />
                                </div>
                            </div>
                        </SectionCard>

                        <SectionCard title="2. Pedido Administrativo">
                            <div className="space-y-4">
                                <div className="space-y-2"><Label>Já fez pedido administrativo?</Label><RadioGroup name="pedido_administrativo_feito" options={['Sim', 'Não']} value={atendimentoForm.pedido_administrativo_feito} onChange={(v) => setAtendimentoForm({ ...atendimentoForm, pedido_administrativo_feito: v })} /></div>
                                <div className="space-y-2"><Label>Se sim, foi:</Label><RadioGroup name="pedido_administrativo_resultado" options={['Deferido', 'Indeferido']} value={atendimentoForm.pedido_administrativo_resultado} onChange={(v) => setAtendimentoForm({ ...atendimentoForm, pedido_administrativo_resultado: v })} /></div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-1"><Label>Data do pedido / decisão</Label><Input value={atendimentoForm.pedido_administrativo_data} onChange={(e) => setAtendimentoForm({ ...atendimentoForm, pedido_administrativo_data: e.target.value })} placeholder="dd/mm/aaaa" /></div>
                                    <div className="space-y-2"><Label>Tem cópia do processo administrativo?</Label><RadioGroup name="tem_copia_processo_administrativo" options={['Sim', 'Não']} value={atendimentoForm.tem_copia_processo_administrativo} onChange={(v) => setAtendimentoForm({ ...atendimentoForm, tem_copia_processo_administrativo: v })} /></div>
                                    <div className="md:col-span-2 space-y-1"><Label>No caso de indeferimento, qual o motivo?</Label><Textarea rows={3} value={atendimentoForm.pedido_administrativo_motivo_indeferimento} onChange={(e) => setAtendimentoForm({ ...atendimentoForm, pedido_administrativo_motivo_indeferimento: e.target.value })} /></div>
                                    <div className="space-y-2"><Label>Possui CNIS impresso?</Label><RadioGroup name="possui_cnis_impresso" options={['Sim', 'Não']} value={atendimentoForm.possui_cnis_impresso} onChange={(v) => setAtendimentoForm({ ...atendimentoForm, possui_cnis_impresso: v })} /></div>
                                </div>
                            </div>
                        </SectionCard>

                        <SectionCard title="3. Objetivo">
                            <div className="space-y-4">
                                <div className="space-y-2"><Label>Categoria principal</Label><RadioGroup name="objetivo_principal_categoria" options={['Requerimento Administrativo', 'Ação Judicial Previdenciária', 'Ação Trabalhista', 'Ação Cível']} value={atendimentoForm.objetivo_principal_categoria} onChange={(v) => setAtendimentoForm({ ...atendimentoForm, objetivo_principal_categoria: v })} /></div>
                                <div className="space-y-2"><Label>Tipos</Label><CheckboxGroup options={OBJETIVO_TIPOS} values={atendimentoForm.objetivo_principal_tipos} onChange={(values) => setAtendimentoForm({ ...atendimentoForm, objetivo_principal_tipos: values })} /></div>
                                <div className="space-y-1"><Label>Outro objetivo</Label><Input value={atendimentoForm.objetivo_principal_outro} onChange={(e) => setAtendimentoForm({ ...atendimentoForm, objetivo_principal_outro: e.target.value })} /></div>
                                <div className="space-y-2"><Label>Cumulado com</Label><CheckboxGroup options={CUMULADO_COM_OPCOES} values={atendimentoForm.cumulado_com} onChange={(values) => setAtendimentoForm({ ...atendimentoForm, cumulado_com: values })} /></div>
                                <div className="space-y-1"><Label>Outro cumulado com</Label><Input value={atendimentoForm.cumulado_com_outro} onChange={(e) => setAtendimentoForm({ ...atendimentoForm, cumulado_com_outro: e.target.value })} /></div>
                            </div>
                        </SectionCard>

                        <SectionCard title="4. Ação Judicial / Trabalhista / Cível">
                            <div className="space-y-5">
                                <div className="space-y-2"><Label>Tipo de ação principal</Label><RadioGroup name="tipo_acao" options={['Ação Judicial Previdenciária', 'Ação Trabalhista', 'Ação Cível']} value={atendimentoForm.tipo_acao} onChange={(v) => setAtendimentoForm({ ...atendimentoForm, tipo_acao: v })} /></div>
                                <div className="space-y-2"><Label>Tipos da ação principal</Label><CheckboxGroup options={OBJETIVO_TIPOS} values={atendimentoForm.tipo_acao_tipos} onChange={(values) => setAtendimentoForm({ ...atendimentoForm, tipo_acao_tipos: values })} /></div>
                                <div className="space-y-1"><Label>Outro tipo de ação principal</Label><Input value={atendimentoForm.tipo_acao_outro} onChange={(e) => setAtendimentoForm({ ...atendimentoForm, tipo_acao_outro: e.target.value })} /></div>
                                <div className="space-y-2"><Label>Cumulado com (ação principal)</Label><CheckboxGroup options={CUMULADO_COM_OPCOES} values={atendimentoForm.tipo_acao_cumulado} onChange={(values) => setAtendimentoForm({ ...atendimentoForm, tipo_acao_cumulado: values })} /></div>
                                <div className="space-y-1"><Label>Outro cumulado com</Label><Input value={atendimentoForm.tipo_acao_cumulado_outro} onChange={(e) => setAtendimentoForm({ ...atendimentoForm, tipo_acao_cumulado_outro: e.target.value })} /></div>
                                <div className="space-y-2"><Label>Ação Trabalhista</Label><CheckboxGroup options={ACAO_TRABALHISTA_TIPOS} values={atendimentoForm.acao_trabalhista_tipos} onChange={(values) => setAtendimentoForm({ ...atendimentoForm, acao_trabalhista_tipos: values })} /></div>
                                <div className="space-y-1"><Label>Outro (Ação Trabalhista)</Label><Input value={atendimentoForm.acao_trabalhista_outro} onChange={(e) => setAtendimentoForm({ ...atendimentoForm, acao_trabalhista_outro: e.target.value })} /></div>
                                <div className="space-y-2"><Label>Ação Cível</Label><CheckboxGroup options={ACAO_CIVEL_TIPOS} values={atendimentoForm.acao_civel_tipos} onChange={(values) => setAtendimentoForm({ ...atendimentoForm, acao_civel_tipos: values })} /></div>
                                <div className="space-y-1"><Label>Outro (Ação Cível)</Label><Input value={atendimentoForm.acao_civel_outro} onChange={(e) => setAtendimentoForm({ ...atendimentoForm, acao_civel_outro: e.target.value })} /></div>
                            </div>
                        </SectionCard>

                        <SectionCard title="5. Documentos e Períodos">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1"><Label>Número da CTPS</Label><Input value={atendimentoForm.numero_ctps} onChange={(e) => setAtendimentoForm({ ...atendimentoForm, numero_ctps: e.target.value })} /></div>
                                <div className="space-y-1"><Label>Série da CTPS</Label><Input value={atendimentoForm.serie_ctps} onChange={(e) => setAtendimentoForm({ ...atendimentoForm, serie_ctps: e.target.value })} /></div>
                                <div className="space-y-2"><Label>Já perdeu alguma CTPS?</Label><RadioGroup name="perdeu_ctps" options={['Sim', 'Não']} value={atendimentoForm.perdeu_ctps} onChange={(v) => setAtendimentoForm({ ...atendimentoForm, perdeu_ctps: v })} /></div>
                                <div className="space-y-2"><Label>Tem período a ser reconhecido com ação trabalhista?</Label><RadioGroup name="periodo_acao_trabalhista" options={['Sim', 'Não']} value={atendimentoForm.periodo_acao_trabalhista} onChange={(v) => setAtendimentoForm({ ...atendimentoForm, periodo_acao_trabalhista: v })} /></div>
                                <div className="md:col-span-2 space-y-1"><Label>Qual período?</Label><Input value={atendimentoForm.qual_periodo_acao_trabalhista} onChange={(e) => setAtendimentoForm({ ...atendimentoForm, qual_periodo_acao_trabalhista: e.target.value })} /></div>
                                <div className="md:col-span-2 space-y-2"><Label>Já contribuiu como</Label><CheckboxGroup options={CONTRIBUIU_COMO_OPCOES} values={atendimentoForm.contribuiu_como} onChange={(values) => setAtendimentoForm({ ...atendimentoForm, contribuiu_como: values })} /></div>
                                <div className="space-y-1"><Label>Número de carnês</Label><Input value={atendimentoForm.numero_carnes} onChange={(e) => setAtendimentoForm({ ...atendimentoForm, numero_carnes: e.target.value })} /></div>
                                <div className="space-y-2"><Label>Já perdeu algum carnê?</Label><RadioGroup name="perdeu_carne" options={['Sim', 'Não']} value={atendimentoForm.perdeu_carne} onChange={(v) => setAtendimentoForm({ ...atendimentoForm, perdeu_carne: v })} /></div>
                                <div className="md:col-span-2 space-y-1"><Label>CNPJ da empresa (se teve)</Label><Input value={atendimentoForm.cnpj_empresa} onChange={(e) => setAtendimentoForm({ ...atendimentoForm, cnpj_empresa: e.target.value })} /></div>
                                <div className="space-y-2"><Label>Tem período que pode ser comprovado/contribuído?</Label><RadioGroup name="periodo_comprovado_ou_contribuido" options={['Sim', 'Não']} value={atendimentoForm.periodo_comprovado_ou_contribuido} onChange={(v) => setAtendimentoForm({ ...atendimentoForm, periodo_comprovado_ou_contribuido: v })} /></div>
                                <div className="md:col-span-2 space-y-1"><Label>Descrever período comprovado/contribuído</Label><Textarea rows={3} value={atendimentoForm.descrever_periodo_comprovado} onChange={(e) => setAtendimentoForm({ ...atendimentoForm, descrever_periodo_comprovado: e.target.value })} /></div>
                                <div className="space-y-2"><Label>Tem período para reconhecer/averbar?</Label><RadioGroup name="periodo_para_reconhecer_averbar" options={['Sim', 'Não']} value={atendimentoForm.periodo_para_reconhecer_averbar} onChange={(v) => setAtendimentoForm({ ...atendimentoForm, periodo_para_reconhecer_averbar: v })} /></div>
                                <div className="md:col-span-2 space-y-2"><Label>Tipo do período para averbar</Label><CheckboxGroup options={['Rural', 'Urbano', 'Especial']} values={atendimentoForm.tipos_periodo_averbar} onChange={(values) => setAtendimentoForm({ ...atendimentoForm, tipos_periodo_averbar: values })} /></div>
                                <div className="md:col-span-2 space-y-1"><Label>Descrever período para reconhecer/averbar</Label><Textarea rows={3} value={atendimentoForm.descrever_periodo_averbar} onChange={(e) => setAtendimentoForm({ ...atendimentoForm, descrever_periodo_averbar: e.target.value })} /></div>
                            </div>
                        </SectionCard>

                        <SectionCard title="6. Serviço Público / Militar / Atividade Especial / Saúde">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2"><Label>Trabalhou no serviço público?</Label><RadioGroup name="trabalhou_servico_publico" options={['Sim', 'Não']} value={atendimentoForm.trabalhou_servico_publico} onChange={(v) => setAtendimentoForm({ ...atendimentoForm, trabalhou_servico_publico: v })} /></div>
                                <div className="space-y-2"><Label>Tem CTC?</Label><RadioGroup name="tem_ctc" options={['Sim', 'Não']} value={atendimentoForm.tem_ctc} onChange={(v) => setAtendimentoForm({ ...atendimentoForm, tem_ctc: v })} /></div>
                                <div className="space-y-2"><Label>Vai providenciar CTC?</Label><RadioGroup name="vai_providenciar_ctc" options={['Sim', 'Não']} value={atendimentoForm.vai_providenciar_ctc} onChange={(v) => setAtendimentoForm({ ...atendimentoForm, vai_providenciar_ctc: v })} /></div>
                                <div className="md:col-span-2 space-y-1"><Label>Descrever local e período do serviço público</Label><Textarea rows={3} value={atendimentoForm.local_periodo_servico_publico} onChange={(e) => setAtendimentoForm({ ...atendimentoForm, local_periodo_servico_publico: e.target.value })} /></div>
                                <div className="space-y-2"><Label>Prestou serviço militar?</Label><RadioGroup name="prestou_servico_militar" options={['Sim', 'Não']} value={atendimentoForm.prestou_servico_militar} onChange={(v) => setAtendimentoForm({ ...atendimentoForm, prestou_servico_militar: v })} /></div>
                                <div className="space-y-2"><Label>Tem comprovante do serviço militar?</Label><RadioGroup name="comprovante_servico_militar" options={['Sim', 'Não']} value={atendimentoForm.comprovante_servico_militar} onChange={(v) => setAtendimentoForm({ ...atendimentoForm, comprovante_servico_militar: v })} /></div>
                                <div className="space-y-2"><Label>Trabalhou em atividade especial?</Label><RadioGroup name="trabalhou_atividade_especial" options={['Sim', 'Não']} value={atendimentoForm.trabalhou_atividade_especial} onChange={(v) => setAtendimentoForm({ ...atendimentoForm, trabalhou_atividade_especial: v })} /></div>
                                <div className="space-y-2"><Label>Tem formulários da atividade especial?</Label><RadioGroup name="tem_formularios_especial" options={['Sim', 'Não']} value={atendimentoForm.tem_formularios_especial} onChange={(v) => setAtendimentoForm({ ...atendimentoForm, tem_formularios_especial: v })} /></div>
                                <div className="md:col-span-2 space-y-1"><Label>Quais possui?</Label><Textarea rows={2} value={atendimentoForm.quais_possui_especial} onChange={(e) => setAtendimentoForm({ ...atendimentoForm, quais_possui_especial: e.target.value })} /></div>
                                <div className="md:col-span-2 space-y-1"><Label>Quais providenciar?</Label><Textarea rows={2} value={atendimentoForm.quais_providenciar_especial} onChange={(e) => setAtendimentoForm({ ...atendimentoForm, quais_providenciar_especial: e.target.value })} /></div>
                                <div className="space-y-2"><Label>Tem algum problema de saúde?</Label><RadioGroup name="tem_problema_saude" options={['Sim', 'Não']} value={atendimentoForm.tem_problema_saude} onChange={(v) => setAtendimentoForm({ ...atendimentoForm, tem_problema_saude: v })} /></div>
                                <div className="space-y-1"><Label>Quando iniciou?</Label><Input value={atendimentoForm.quando_iniciou_problema_saude} onChange={(e) => setAtendimentoForm({ ...atendimentoForm, quando_iniciou_problema_saude: e.target.value })} placeholder="dd/mm/aaaa ou descrição" /></div>
                                <div className="space-y-2"><Label>Tem documentos médicos?</Label><RadioGroup name="documentos_medicos" options={['Sim', 'Não']} value={atendimentoForm.documentos_medicos} onChange={(v) => setAtendimentoForm({ ...atendimentoForm, documentos_medicos: v })} /></div>
                                <div className="md:col-span-2 space-y-1"><Label>Quais documentos médicos possui?</Label><Textarea rows={2} value={atendimentoForm.quais_documentos_medicos} onChange={(e) => setAtendimentoForm({ ...atendimentoForm, quais_documentos_medicos: e.target.value })} /></div>
                                <div className="md:col-span-2 space-y-1"><Label>Documentos médicos a providenciar</Label><Textarea rows={2} value={atendimentoForm.documentos_medicos_providenciar} onChange={(e) => setAtendimentoForm({ ...atendimentoForm, documentos_medicos_providenciar: e.target.value })} /></div>
                            </div>
                        </SectionCard>

                        <SectionCard title="7. Para uso do escritório / Diagnóstico / Fatos">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2"><Label>Documentos digitalizados?</Label><RadioGroup name="documentos_digitalizados" options={['Sim', 'Não']} value={atendimentoForm.documentos_digitalizados} onChange={(v) => setAtendimentoForm({ ...atendimentoForm, documentos_digitalizados: v })} /></div>
                                <div className="space-y-2"><Label>Documentação completa?</Label><RadioGroup name="documentacao_completa" options={['Sim', 'Não']} value={atendimentoForm.documentacao_completa} onChange={(v) => setAtendimentoForm({ ...atendimentoForm, documentacao_completa: v })} /></div>
                                <div className="space-y-2"><Label>Retorno?</Label><RadioGroup name="retorno" options={['Sim', 'Não']} value={atendimentoForm.retorno} onChange={(v) => setAtendimentoForm({ ...atendimentoForm, retorno: v })} /></div>
                                <div className="space-y-1"><Label>Data do retorno</Label><Input value={atendimentoForm.retorno_data} onChange={(e) => setAtendimentoForm({ ...atendimentoForm, retorno_data: e.target.value })} placeholder="dd/mm/aaaa" /></div>
                                <div className="md:col-span-2 space-y-1"><Label>Diagnóstico</Label><Textarea rows={5} value={atendimentoForm.diagnostico} onChange={(e) => setAtendimentoForm({ ...atendimentoForm, diagnostico: e.target.value })} /></div>
                                <div className="md:col-span-2 space-y-1"><Label>Tipo de ação</Label><Input value={atendimentoForm.tipo_de_acao_livre} onChange={(e) => setAtendimentoForm({ ...atendimentoForm, tipo_de_acao_livre: e.target.value })} placeholder="Descreva o tipo de ação" /></div>
                                <div className="md:col-span-2 space-y-1"><Label>Fatos</Label><Textarea rows={8} value={atendimentoForm.fatos} onChange={(e) => setAtendimentoForm({ ...atendimentoForm, fatos: e.target.value })} /></div>
                            </div>
                        </SectionCard>

                        {!!form.atendimento_resumo && (
                            <SectionCard title="Pré-visualização do resumo salvo">
                                <div className="rounded-xl border border-border bg-muted/20 p-4">
                                    <pre className="whitespace-pre-wrap break-words text-sm text-muted-foreground font-sans leading-7">{form.atendimento_resumo}</pre>
                                </div>
                            </SectionCard>
                        )}

                        <div className="flex justify-end gap-3 pt-4 border-t border-border flex-wrap items-center">
                            <div className="flex items-center gap-2 min-w-[200px]">
                                <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                                    <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Selecione a Minuta..." /></SelectTrigger>
                                    <SelectContent>{templates.map((t) => <SelectItem key={t.id} value={t.id} className="text-xs">{t.nome}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                            <Button type="button" variant="outline" className="h-9 text-xs border-rose-200 text-rose-700 hover:bg-rose-50" onClick={handleGenerateDocx} disabled={isGenerating || !selectedTemplateId}>
                                <FileText className="mr-2 h-3.5 w-3.5" />
                                {isGenerating ? 'Gerando...' : 'Gerar Ação'}
                            </Button>
                            <div className="flex-1" />
                            <Button type="button" variant="outline" className="h-9 text-xs" onClick={() => setAtendimentoDialogOpen(false)}>Cancelar</Button>
                            <Button type="button" className="h-9 text-xs bg-rose-600 hover:bg-rose-700 text-white" onClick={saveAtendimentoData} disabled={savingAtendimento}>
                                {savingAtendimento ? 'Salvando...' : 'Salvar Atendimento'}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Excluir cliente?</AlertDialogTitle>
                        <AlertDialogDescription>Tem certeza que deseja excluir <strong>{deleteTarget?.nome_completo}</strong>? Esta ação não pode ser desfeita.</AlertDialogDescription>
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