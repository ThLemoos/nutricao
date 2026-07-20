import { auth, db } from "./firebase.js";
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { collection, query, orderBy, onSnapshot, doc, updateDoc, deleteDoc, getDocs } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const loginView = document.getElementById('login-view');
const painelView = document.getElementById('painel-view');
const lista = document.getElementById('lista');
const emptyMsg = document.getElementById('empty-msg');

document.getElementById('l-btn').addEventListener('click', async () => {
    const email = document.getElementById('l-email').value.trim();
    const senha = document.getElementById('l-senha').value;
    const msg = document.getElementById('l-msg');
    try {
        await signInWithEmailAndPassword(auth, email, senha);
    } catch (err) {
        msg.textContent = 'Email ou senha incorretos.';
    }
});

document.getElementById('logout-btn').addEventListener('click', () => signOut(auth));

const objetivos = { emagrecimento: 'Emagrecimento', reeducacao: 'Reeducação alimentar', esportiva: 'Nutrição esportiva', outro: 'Outro' };
const badges = { pendente: 'badge-pendente', aceito: 'badge-aceito', recusado: 'badge-recusado' };
const rotulos = { pendente: 'aguardando aprovação', aceito: 'aprovado', recusado: 'recusado' };

function escapeHtml(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function gerarId() {
    return 'a_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

const KCAL_POR_G = { proteina: 4, carboidrato: 4, gordura: 9 };

/* sugestões de alimentos comuns */
const ALIMENTOS_PRESET = [
    { nome: 'Arroz branco cozido', quantidade: '4 col. sopa (100g)', kcal: 130 },
    { nome: 'Feijão cozido', quantidade: '1 concha (100g)', kcal: 90 },
    { nome: 'Peito de frango grelhado', quantidade: '100g', kcal: 165 },
    { nome: 'Ovo cozido', quantidade: '1 unidade', kcal: 78 },
    { nome: 'Pão francês', quantidade: '1 unidade (50g)', kcal: 135 },
    { nome: 'Banana', quantidade: '1 unidade média', kcal: 90 },
    { nome: 'Maçã', quantidade: '1 unidade média', kcal: 80 },
    { nome: 'Aveia em flocos', quantidade: '2 col. sopa (20g)', kcal: 75 },
    { nome: 'Leite desnatado', quantidade: '1 copo (200ml)', kcal: 70 },
    { nome: 'Batata doce cozida', quantidade: '100g', kcal: 86 },
    { nome: 'Whey protein', quantidade: '1 scoop (30g)', kcal: 120 },
    { nome: 'Azeite de oliva', quantidade: '1 col. sopa', kcal: 120 },
    { nome: 'Salada verde', quantidade: 'à vontade', kcal: 15 },
    { nome: 'Iogurte natural', quantidade: '1 pote (170g)', kcal: 100 },
    { nome: 'Tapioca', quantidade: '1 unidade média', kcal: 120 },
    { nome: 'Queijo minas', quantidade: '1 fatia (30g)', kcal: 70 },
    { nome: 'Amêndoas', quantidade: '10 unidades', kcal: 70 },
    { nome: 'Carne bovina magra grelhada', quantidade: '100g', kcal: 190 }
];

const NIVEL_ATIVIDADE_LABEL = { sedentario: 'Sedentário', leve: 'Leve (1-3x/semana)', moderado: 'Moderado (3-5x/semana)', intenso: 'Intenso (6-7x/semana)', atleta: 'Atleta' };
const SEXO_LABEL = { feminino: 'Feminino', masculino: 'Masculino' };
const SIM_NAO_LABEL = { sim: 'Sim', nao: 'Não' };
const ALCOOL_LABEL = { nunca: 'Nunca', raramente: 'Raramente', socialmente: 'Socialmente', frequentemente: 'Frequentemente' };
const ATIVIDADE_FATOR = { sedentario: 1.2, leve: 1.375, moderado: 1.55, intenso: 1.725, atleta: 1.9 };

// sugestão de calorias por Mifflin-St Jeor, usando o que o paciente respondeu no formulário
function calcularSugestaoCalorias(a) {
    if (!a || !a.pesoAtual || !a.altura || !a.idade || !a.sexo || !a.nivelAtividade) return null;
    const base = a.sexo === 'feminino'
        ? (10 * a.pesoAtual) + (6.25 * a.altura) - (5 * a.idade) - 161
        : (10 * a.pesoAtual) + (6.25 * a.altura) - (5 * a.idade) + 5;
    const fator = ATIVIDADE_FATOR[a.nivelAtividade] || 1.2;
    return Math.round(base * fator);
}

function anamneseViewHTML(a) {
    if (!a || Object.keys(a).length === 0) {
        return `<div class="anamnese-view"><h4>Formulário do paciente</h4><p class="anamnese-vazio">Ainda não preencheu o formulário.</p></div>`;
    }
    const itens = [
        ['Peso atual', a.pesoAtual ? a.pesoAtual + ' kg' : '--'],
        ['Altura', a.altura ? a.altura + ' cm' : '--'],
        ['Idade', a.idade || '--'],
        ['Sexo', SEXO_LABEL[a.sexo] || '--'],
        ['Atividade', NIVEL_ATIVIDADE_LABEL[a.nivelAtividade] || '--'],
        ['Qual atividade', a.atividadeQual || '--'],
        ['Refeições/dia', a.refeicoesPorDia || '--'],
        ['Água/dia', a.aguaLitros ? a.aguaLitros + ' L' : '--'],
        ['Fuma', SIM_NAO_LABEL[a.fuma] || '--'],
        ['Álcool', ALCOOL_LABEL[a.alcool] || '--'],
        ['Restrição alimentar', a.restricaoAlimentar || '--']
    ];
    const blocos = [
        ['Rotina', a.rotina],
        ['Condições de saúde', a.condicoesSaude],
        ['Medicamentos/suplementos', a.medicamentos],
        ['Alergias', a.alergias],
        ['Não gosta', a.naoGosta],
        ['Gosta', a.gosta],
        ['Observações do paciente', a.observacoes]
    ].filter(([, v]) => v);

    return `
    <div class="anamnese-view">
        <h4>Formulário do paciente</h4>
        <div class="anamnese-grid">
            ${itens.map(([l, v]) => `<div class="anamnese-item"><span>${l}</span><strong>${escapeHtml(String(v))}</strong></div>`).join('')}
        </div>
        ${blocos.map(([l, v]) => `<div class="anamnese-texto-bloco"><span>${l}</span><p>${escapeHtml(v)}</p></div>`).join('')}
        ${a.atualizadoEm?.toDate ? `<p class="anamnese-data">atualizado em ${a.atualizadoEm.toDate().toLocaleDateString('pt-BR')}</p>` : ''}
    </div>`;
}

function migrarCardapioAntigo(texto) {
    if (!texto || !texto.trim()) return [];
    return texto.split(/\n\s*\n/).map((bloco) => {
        const linhas = bloco.split('\n');
        const primeira = linhas[0].trim();
        let nome = 'Refeição', corpo = bloco.trim();
        if (/:$/.test(primeira)) {
            nome = primeira.slice(0, -1);
            corpo = linhas.slice(1).join('\n').trim();
        }
        return { nome, horario: '', alimentos: corpo ? [{ id: gerarId(), nome: corpo, quantidade: '', kcal: null }] : [] };
    }).filter((r) => r.nome || r.alimentos.length);
}

/* calculadora de macros */
function atualizarMacroDisplay(container) {
    const calorias = parseFloat(container.querySelector('.p-calorias').value) || 0;
    ['proteina', 'carboidrato', 'gordura'].forEach((m) => {
        const slider = container.querySelector(`.p-perc[data-macro="${m}"]`);
        const perc = parseInt(slider.value, 10);
        const gramas = Math.round((calorias * (perc / 100)) / KCAL_POR_G[m]);
        container.querySelector(`.macro-perc[data-macro="${m}"]`).textContent = perc + '%';
        container.querySelector(`.macro-gramas[data-macro="${m}"]`).textContent = (calorias ? gramas : '--') + ' g';
        container.querySelector(`.seg-${m}`).style.width = perc + '%';
    });
}

function normalizarSliders(container, macroAlterado) {
    const MIN = 5;
    const macros = ['proteina', 'carboidrato', 'gordura'];
    const sliders = {};
    macros.forEach((m) => { sliders[m] = container.querySelector(`.p-perc[data-macro="${m}"]`); });

    const valorAlterado = Math.max(MIN, Math.min(100 - MIN * 2, parseInt(sliders[macroAlterado].value, 10)));
    sliders[macroAlterado].value = valorAlterado;

    const outros = macros.filter((m) => m !== macroAlterado);
    const restante = 100 - valorAlterado;
    const somaOutrosAtual = outros.reduce((s, m) => s + parseInt(sliders[m].value, 10), 0) || 1;

    let a = Math.round((parseInt(sliders[outros[0]].value, 10) / somaOutrosAtual) * restante);
    a = Math.max(MIN, Math.min(restante - MIN, a));
    const b = restante - a;

    sliders[outros[0]].value = a;
    sliders[outros[1]].value = b;

    atualizarMacroDisplay(container);
}

function redefinirMacros(container) {
    container.querySelector('.p-perc[data-macro="proteina"]').value = 30;
    container.querySelector('.p-perc[data-macro="carboidrato"]').value = 40;
    container.querySelector('.p-perc[data-macro="gordura"]').value = 30;
    atualizarMacroDisplay(container);
}

function calcularPercentuaisIniciais(metas) {
    const cal = metas.calorias || 0;
    if (cal && (metas.proteina || metas.carboidrato || metas.gordura)) {
        const pProt = Math.round(((metas.proteina || 0) * 4 / cal) * 100);
        const pCarb = Math.round(((metas.carboidrato || 0) * 4 / cal) * 100);
        const pGord = Math.max(0, 100 - pProt - pCarb);
        return { proteina: pProt, carboidrato: pCarb, gordura: pGord };
    }
    return { proteina: 30, carboidrato: 40, gordura: 30 };
}

/* editor de refeições / alimentos */
function alimentoEditorRowHTML(a) {
    return `
        <div class="alimento-editor-row" data-alimento-id="${a.id || gerarId()}">
            <input type="text" class="alimento-nome-input" placeholder="Alimento" value="${escapeHtml(a.nome)}">
            <input type="text" class="alimento-qtd-input" placeholder="Qtd (ex: 100g)" value="${escapeHtml(a.quantidade || '')}">
            <input type="number" class="alimento-kcal-input" placeholder="kcal" value="${a.kcal || ''}">
            <button type="button" class="remover-alimento" title="Remover alimento">✕</button>
        </div>`;
}

function refeicaoEditorHTML(r) {
    return `
        <div class="refeicao-editor">
            <div class="refeicao-editor-head">
                <input type="text" class="refeicao-nome" placeholder="Nome da refeição" value="${escapeHtml(r.nome)}">
                <input type="text" class="refeicao-horario" placeholder="Horário (ex: 08:00)" value="${escapeHtml(r.horario || '')}">
                <div class="refeicao-editor-acoes">
                    <button type="button" class="remover-refeicao-editor" title="Remover refeição">✕</button>
                </div>
            </div>
            <div class="alimentos-editor">
                ${(r.alimentos || []).map(alimentoEditorRowHTML).join('')}
            </div>
            <div class="alimento-preset-row">
                <select class="alimento-preset-select">
                    <option value="">+ Adicionar alimento comum...</option>
                    ${ALIMENTOS_PRESET.map((a, i) => `<option value="${i}">${escapeHtml(a.nome)} (${a.kcal} kcal)</option>`).join('')}
                </select>
                <button type="button" class="add-alimento">+ Alimento em branco</button>
            </div>
        </div>`;
}

function anexarListenersRefeicao(re) {
    re.querySelector('.remover-refeicao-editor').addEventListener('click', () => re.remove());

    re.querySelector('.add-alimento').addEventListener('click', () => {
        re.querySelector('.alimentos-editor').insertAdjacentHTML(
            'beforeend',
            alimentoEditorRowHTML({ id: gerarId(), nome: '', quantidade: '', kcal: null })
        );
    });

    re.querySelector('.alimento-preset-select').addEventListener('change', (e) => {
        const idx = e.target.value;
        if (idx === '') return;
        const preset = ALIMENTOS_PRESET[Number(idx)];
        re.querySelector('.alimentos-editor').insertAdjacentHTML(
            'beforeend',
            alimentoEditorRowHTML({ id: gerarId(), nome: preset.nome, quantidade: preset.quantidade, kcal: preset.kcal })
        );
        e.target.value = '';
    });

    re.querySelector('.alimentos-editor').addEventListener('click', (e) => {
        if (e.target.classList.contains('remover-alimento')) {
            e.target.closest('.alimento-editor-row').remove();
        }
    });
}

function compilarRefeicoes(refeicoesContainer) {
    const refeicoes = [];
    refeicoesContainer.querySelectorAll('.refeicao-editor').forEach((re) => {
        const nome = re.querySelector('.refeicao-nome').value.trim();
        const horario = re.querySelector('.refeicao-horario').value.trim();
        const alimentos = [];
        re.querySelectorAll('.alimento-editor-row').forEach((row) => {
            const nomeAl = row.querySelector('.alimento-nome-input').value.trim();
            if (!nomeAl) return;
            alimentos.push({
                id: row.dataset.alimentoId,
                nome: nomeAl,
                quantidade: row.querySelector('.alimento-qtd-input').value.trim(),
                kcal: row.querySelector('.alimento-kcal-input').value ? Number(row.querySelector('.alimento-kcal-input').value) : null
            });
        });
        if (!nome && alimentos.length === 0) return;
        refeicoes.push({ nome: nome || 'Refeição', horario, alimentos });
    });
    return refeicoes;
}

function renderPacientes(snapshot) {
    lista.innerHTML = '';
    emptyMsg.style.display = snapshot.empty ? 'block' : 'none';

    snapshot.forEach((docSnap) => {
        const id = docSnap.id;
        const p = docSnap.data();
        const data = p.criadoEm?.toDate ? p.criadoEm.toDate().toLocaleDateString('pt-BR') : '--';
        const cad = p.statusCadastro || 'pendente';
        const plano = p.plano || {};

        const metas = plano.metas || {
            calorias: plano.calorias || null,
            proteina: plano.proteina || null,
            carboidrato: plano.carboidrato || null,
            gordura: plano.gordura || null
        };
        const refeicoes = plano.refeicoes || migrarCardapioAntigo(plano.cardapio);

        const perc = calcularPercentuaisIniciais(metas);
        const sugestao = calcularSugestaoCalorias(p.anamnese);

        let acoes = '';
        if (cad === 'pendente') {
            acoes = `
                        <button data-id="${id}" class="aceitar">Aceitar</button>
                        <button data-id="${id}" data-nome="${escapeHtml(p.nome || 'esse paciente')}" class="recusar btn-recusar">Recusar</button>
                    `;
        } else if (cad === 'aceito') {
            acoes = `
                        <select data-id="${id}" class="status-select">
                            <option value="em_atendimento" ${p.status === 'em_atendimento' ? 'selected' : ''}>Em atendimento</option>
                            <option value="pausado" ${p.status === 'pausado' ? 'selected' : ''}>Pausado (bloqueia a área do paciente)</option>
                            <option value="inativo" ${p.status === 'inativo' ? 'selected' : ''}>Inativo</option>
                        </select>
                        <button data-id="${id}" class="toggle-plano btn-editar-plano">Editar plano</button>
                    `;
        }

        const badgePausado = (cad === 'aceito' && p.status === 'pausado')
            ? '<span class="badge-pausado">pausado</span>'
            : '';

        const wrap = document.createElement('div');
        wrap.className = 'card-wrap';
        wrap.innerHTML = `
    <div class="paciente-card">
        <div class="paciente-info">
            <h3>${p.nome || 'Sem nome'}
                ${!p.visto ? '<span class="badge-novo">novo</span>' : ''}
                <span class="${badges[cad]}">${rotulos[cad]}</span>
                ${badgePausado}
            </h3>
            <p>${p.email || ''} ${p.telefone ? '· ' + p.telefone : ''}</p>
            <p>${objetivos[p.objetivo] || p.objetivo || ''} · cadastrado em ${data}</p>
        </div>
        <div class="paciente-actions">${acoes}
            <button data-id="${id}" data-nome="${escapeHtml(p.nome || 'esse paciente')}" class="excluir btn-recusar">Excluir</button>
        </div>
    </div>
    <div class="plano-panel" id="plano-${id}" data-id="${id}">
        ${anamneseViewHTML(p.anamnese)}

        <div class="calorias-sugestao-row">
            <div class="calc-field">
                <label>Calorias/dia</label>
                <input type="number" class="p-calorias" value="${metas.calorias || ''}" placeholder="ex: 1800">
            </div>
            <button type="button" class="sugerir-calorias-btn" data-sugestao="${sugestao || ''}" ${sugestao ? '' : 'disabled'}
                title="${sugestao ? 'Calculado com Mifflin-St Jeor a partir do formulário' : 'O paciente ainda não preencheu peso/altura/idade/sexo/atividade no formulário'}">
                ${sugestao ? 'Sugerir ' + sugestao.toLocaleString('pt-BR') + ' kcal' : 'Sugestão indisponível'}
            </button>
        </div>

        <div class="macro-sliders">
            <div class="macro-slider-row">
                <label>Proteína <span class="macro-perc" data-macro="proteina">${perc.proteina}%</span>
                    <span class="macro-gramas" data-macro="proteina">${metas.proteina ? metas.proteina + ' g' : '--'}</span></label>
                <input type="range" class="p-perc" data-macro="proteina" min="0" max="100" value="${perc.proteina}">
            </div>
            <div class="macro-slider-row">
                <label>Carboidrato <span class="macro-perc" data-macro="carboidrato">${perc.carboidrato}%</span>
                    <span class="macro-gramas" data-macro="carboidrato">${metas.carboidrato ? metas.carboidrato + ' g' : '--'}</span></label>
                <input type="range" class="p-perc" data-macro="carboidrato" min="0" max="100" value="${perc.carboidrato}">
            </div>
            <div class="macro-slider-row">
                <label>Gordura <span class="macro-perc" data-macro="gordura">${perc.gordura}%</span>
                    <span class="macro-gramas" data-macro="gordura">${metas.gordura ? metas.gordura + ' g' : '--'}</span></label>
                <input type="range" class="p-perc" data-macro="gordura" min="0" max="100" value="${perc.gordura}">
            </div>
        </div>

        <div class="macro-bar">
            <div class="seg-proteina" style="width:${perc.proteina}%"></div>
            <div class="seg-carboidrato" style="width:${perc.carboidrato}%"></div>
            <div class="seg-gordura" style="width:${perc.gordura}%"></div>
        </div>

        <label style="font-size:.85rem;font-weight:600;color:var(--forest);display:block;margin:1.2rem 0 .6rem;">Refeições e alimentos</label>
        <select class="nova-refeicao-select">
            <option value="">+ Adicionar refeição...</option>
            <option value="Café da manhã">Café da manhã</option>
            <option value="Lanche da manhã">Lanche da manhã</option>
            <option value="Almoço">Almoço</option>
            <option value="Lanche da tarde">Lanche da tarde</option>
            <option value="Jantar">Jantar</option>
            <option value="Ceia">Ceia</option>
            <option value="Pré-treino">Pré-treino</option>
            <option value="Pós-treino">Pós-treino</option>
            <option value="__outra">Outra (nomear depois)</option>
        </select>
        <div class="refeicoes-editor">
            ${refeicoes.map(refeicaoEditorHTML).join('')}
        </div>

        <label style="font-size:.85rem;font-weight:600;color:var(--forest);display:block;margin:1.2rem 0 .4rem;">Observações internas</label>
        <textarea class="p-observacoes">${escapeHtml(plano.observacoes)}</textarea>
        <button class="btn-primary salvar-plano" data-id="${id}" style="cursor:pointer;">Salvar plano</button>
        <span class="salvo-msg" style="font-size:.8rem;margin-left:.8rem;color:var(--leaf);"></span>
    </div>
    `;
        lista.appendChild(wrap);
    });

    lista.querySelectorAll('.plano-panel').forEach((container) => {
        atualizarMacroDisplay(container);

        container.querySelector('.p-calorias').addEventListener('input', () => atualizarMacroDisplay(container));

        container.querySelectorAll('.p-perc').forEach((slider) => {
            slider.addEventListener('input', () => normalizarSliders(container, slider.dataset.macro));
        });

        const sugerirBtn = container.querySelector('.sugerir-calorias-btn');
        if (sugerirBtn && !sugerirBtn.disabled) {
            sugerirBtn.addEventListener('click', () => {
                container.querySelector('.p-calorias').value = sugerirBtn.dataset.sugestao;
                atualizarMacroDisplay(container);
            });
        }

        container.querySelector('.nova-refeicao-select').addEventListener('change', (e) => {
            const val = e.target.value;
            if (!val) return;
            const nome = val === '__outra' ? '' : val;
            const refeicoesEditor = container.querySelector('.refeicoes-editor');
            refeicoesEditor.insertAdjacentHTML('beforeend', refeicaoEditorHTML({ nome, horario: '', alimentos: [] }));
            anexarListenersRefeicao(refeicoesEditor.lastElementChild);
            e.target.value = '';
        });

        container.querySelectorAll('.refeicao-editor').forEach((re) => anexarListenersRefeicao(re));
    });

    lista.querySelectorAll('.status-select').forEach((sel) => {
        sel.addEventListener('change', () => updateDoc(doc(db, 'pacientes', sel.dataset.id), { status: sel.value }));
    });
    lista.querySelectorAll('.aceitar').forEach((btn) => {
        btn.addEventListener('click', () => updateDoc(doc(db, 'pacientes', btn.dataset.id), {
            statusCadastro: 'aceito', status: 'em_atendimento', visto: true
        }));
    });
    lista.querySelectorAll('.recusar').forEach((btn) => {
        btn.addEventListener('click', () => abrirModalRecusar(btn.dataset.id, btn.dataset.nome));
    });
    lista.querySelectorAll('.excluir').forEach((btn) => {
        btn.addEventListener('click', () => abrirModalExcluir(btn.dataset.id, btn.dataset.nome));
    });
    lista.querySelectorAll('.toggle-plano').forEach((btn) => {
        btn.addEventListener('click', () => {
            document.getElementById('plano-' + btn.dataset.id).classList.toggle('open');
        });
    });
    lista.querySelectorAll('.salvar-plano').forEach((btn) => {
        btn.addEventListener('click', async () => {
            const panel = document.getElementById('plano-' + btn.dataset.id);
            const calorias = Number(panel.querySelector('.p-calorias').value) || null;

            const gramasPorMacro = (macro) => {
                const perc = parseInt(panel.querySelector(`.p-perc[data-macro="${macro}"]`).value, 10);
                return calorias ? Math.round((calorias * (perc / 100)) / KCAL_POR_G[macro]) : null;
            };

            const plano = {
                metas: {
                    calorias,
                    proteina: gramasPorMacro('proteina'),
                    carboidrato: gramasPorMacro('carboidrato'),
                    gordura: gramasPorMacro('gordura')
                },
                refeicoes: compilarRefeicoes(panel.querySelector('.refeicoes-editor')),
                observacoes: panel.querySelector('.p-observacoes').value
            };
            await updateDoc(doc(db, 'pacientes', btn.dataset.id), { plano });
            const msg = panel.querySelector('.salvo-msg');
            msg.textContent = 'Plano salvo!';
            setTimeout(() => (msg.textContent = ''), 2500);
        });
    });
}

onAuthStateChanged(auth, (user) => {
    if (user) {
        loginView.style.display = 'none';
        painelView.style.display = 'block';
        const q = query(collection(db, 'pacientes'), orderBy('criadoEm', 'desc'));
        onSnapshot(q, renderPacientes);
    } else {
        loginView.style.display = 'block';
        painelView.style.display = 'none';
    }
});

/* modal de exclusão de paciente */
const excluirOverlay = document.getElementById('excluir-overlay');
const excluirNomeEl = document.getElementById('excluir-nome');
const excluirErroEl = document.getElementById('excluir-erro');
const excluirConfirmarBtn = document.getElementById('excluir-confirmar-btn');
let pacienteParaExcluir = null;

function abrirModalExcluir(id, nome) {
    pacienteParaExcluir = id;
    excluirNomeEl.textContent = nome;
    excluirErroEl.style.display = 'none';
    excluirConfirmarBtn.disabled = false;
    excluirConfirmarBtn.textContent = 'Sim, excluir';
    excluirOverlay.style.display = 'flex';
}

function fecharModalExcluir() {
    excluirOverlay.style.display = 'none';
    pacienteParaExcluir = null;
}

document.getElementById('excluir-cancelar-btn').addEventListener('click', fecharModalExcluir);
excluirOverlay.addEventListener('click', (e) => {
    if (e.target === excluirOverlay) fecharModalExcluir();
});

excluirConfirmarBtn.addEventListener('click', async () => {
    if (!pacienteParaExcluir) return;
    excluirConfirmarBtn.disabled = true;
    excluirConfirmarBtn.textContent = 'Excluindo...';

    try {
        const pesosSnap = await getDocs(collection(db, 'pacientes', pacienteParaExcluir, 'pesos'));
        await Promise.all(pesosSnap.docs.map((d) => deleteDoc(d.ref)));
        await deleteDoc(doc(db, 'pacientes', pacienteParaExcluir));
        fecharModalExcluir();
    } catch (err) {
        console.error(err);
        excluirErroEl.textContent = 'Não deu pra excluir agora, tenta de novo.';
        excluirErroEl.style.display = 'block';
        excluirConfirmarBtn.disabled = false;
        excluirConfirmarBtn.textContent = 'Sim, excluir';
    }
});

/* modal para recusar um paciente */
const recusarOverlay = document.getElementById('recusar-overlay');
const recusarNomeEl = document.getElementById('recusar-nome');
const recusarErroEl = document.getElementById('recusar-erro');
const recusarConfirmarBtn = document.getElementById('recusar-confirmar-btn');
let pacienteParaRecusar = null;

function abrirModalRecusar(id, nome) {
    pacienteParaRecusar = id;
    recusarNomeEl.textContent = nome;
    recusarErroEl.style.display = 'none';
    recusarConfirmarBtn.disabled = false;
    recusarConfirmarBtn.textContent = 'Sim, recusar';
    recusarOverlay.style.display = 'flex';
}

function fecharModalRecusar() {
    recusarOverlay.style.display = 'none';
    pacienteParaRecusar = null;
}

document.getElementById('recusar-cancelar-btn').addEventListener('click', fecharModalRecusar);
recusarOverlay.addEventListener('click', (e) => {
    if (e.target === recusarOverlay) fecharModalRecusar();
});

recusarConfirmarBtn.addEventListener('click', async () => {
    if (!pacienteParaRecusar) return;
    recusarConfirmarBtn.disabled = true;
    recusarConfirmarBtn.textContent = 'Recusando...';

    try {
        await updateDoc(doc(db, 'pacientes', pacienteParaRecusar), { statusCadastro: 'recusado', visto: true });
        fecharModalRecusar();
    } catch (err) {
        console.error(err);
        recusarErroEl.textContent = 'Não deu pra recusar agora, tenta de novo.';
        recusarErroEl.style.display = 'block';
        recusarConfirmarBtn.disabled = false;
        recusarConfirmarBtn.textContent = 'Sim, recusar';
    }
});