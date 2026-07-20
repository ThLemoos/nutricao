import { auth, db } from "./firebase.js";
import { signInWithEmailAndPassword, signOut, onAuthStateChanged, sendPasswordResetEmail, GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, onSnapshot, collection, query, orderBy, addDoc, serverTimestamp, getDoc, setDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const views = {
    login: document.getElementById('login-view'),
    pendente: document.getElementById('pendente-view'),
    recusado: document.getElementById('recusado-view'),
    bloqueado: document.getElementById('bloqueado-view'),
    dashboard: document.getElementById('dashboard-view')
};

function showView(name) {
    Object.entries(views).forEach(([key, el]) => {
        el.style.display = key === name ? 'block' : 'none';
    });
}

/* login */
document.getElementById('p-login-btn').addEventListener('click', async () => {
    const email = document.getElementById('p-email').value.trim();
    const senha = document.getElementById('p-senha').value;
    const msg = document.getElementById('p-login-msg');
    msg.textContent = '';
    try {
        await signInWithEmailAndPassword(auth, email, senha);
    } catch (err) {
        msg.textContent = 'Email ou senha incorretos.';
    }
});

document.getElementById('google-login-btn').addEventListener('click', async () => {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    const msg = document.getElementById('p-login-msg');
    msg.style.color = '#c0392b';
    msg.textContent = '';
    try {
        const cred = await signInWithPopup(auth, provider);
        const existente = await getDoc(doc(db, 'pacientes', cred.user.uid));
        if (!existente.exists()) {
            await signOut(auth);
            msg.textContent = 'Essa conta Google ainda não tem cadastro. Usa o botão "Continuar com Google" na página de cadastro primeiro.';
        }
    } catch (err) {
        console.error(err);
        msg.textContent = 'Não deu pra entrar com o Google agora, tenta de novo.';
    }
});

['pendente-logout', 'recusado-logout', 'bloqueado-logout', 'dash-logout'].forEach((id) => {
    document.getElementById(id).addEventListener('click', () => signOut(auth));
});

/* esqueci minha senha */
const resetBox = document.getElementById('reset-box');
document.getElementById('esqueci-senha-link').addEventListener('click', (e) => {
    e.preventDefault();
    const aberto = resetBox.style.display !== 'none';
    resetBox.style.display = aberto ? 'none' : 'block';
    if (!aberto) {
        document.getElementById('reset-email').value = document.getElementById('p-email').value.trim();
    }
});

const mensagensErroReset = {
    'auth/user-not-found': 'Não existe cadastro com esse email.',
    'auth/invalid-email': 'Esse email não é válido.',
    'auth/too-many-requests': 'Muitas tentativas seguidas. Espera um pouco e tenta de novo.',
    'auth/missing-email': 'Digita o email primeiro.'
};

document.getElementById('reset-btn').addEventListener('click', async () => {
    const email = document.getElementById('reset-email').value.trim();
    const msg = document.getElementById('reset-msg');
    if (!email) {
        msg.style.color = '#c0392b';
        msg.textContent = 'Digita seu email primeiro.';
        return;
    }
    msg.style.color = 'var(--forest)';
    msg.textContent = 'Enviando...';
    try {
        await sendPasswordResetEmail(auth, email);
        msg.style.color = 'var(--forest)';
        msg.textContent = 'Link de recuperação enviado! Confere sua caixa de entrada (e o spam).';
    } catch (err) {
        console.error(err);
        msg.style.color = '#c0392b';
        msg.textContent = mensagensErroReset[err.code] || ('Erro ao enviar: ' + err.code);
    }
});

const objetivos = { emagrecimento: 'Emagrecimento', reeducacao: 'Reeducação alimentar', esportiva: 'Nutrição esportiva', outro: 'Outro' };

let pesoUnsub = null;
let consumoUnsub = null;

let planoAtual = {};
let marcadosAtual = {};

let anamneseCarregada = false;

function todayKey() {
    const d = new Date();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${mm}-${dd}`;
}

function ringSVG(pct) {
    const r = 54;
    const c = 2 * Math.PI * r;
    const clamped = Math.max(0, Math.min(1, pct));
    const offset = c * (1 - clamped);
    return `
    <svg viewBox="0 0 140 140" class="ring-svg">
        <circle cx="70" cy="70" r="${r}" class="ring-bg"></circle>
        <circle cx="70" cy="70" r="${r}" class="ring-fg" style="stroke-dasharray:${c};stroke-dashoffset:${offset}" transform="rotate(-90 70 70)"></circle>
    </svg>`;
}

function renderPlano(p) {
    document.getElementById('pac-nome').textContent = p.nome || '--';
    document.getElementById('pac-email').textContent = p.email || '--';
    document.getElementById('pac-telefone').textContent = p.telefone || '--';
    document.getElementById('pac-objetivo').textContent = objetivos[p.objetivo] || p.objetivo || '--';

    planoAtual = p.plano || {};
    atualizarPainelPlano();

    if (!anamneseCarregada) {
        preencherAnamnese(p.anamnese || {});
        anamneseCarregada = true;
    }
}

function atualizarPainelPlano() {
    const plano = planoAtual || {};
    const metas = plano.metas || {};
    const refeicoes = plano.refeicoes || [];
    const temPlano = refeicoes.length > 0 || !!metas.calorias;

    document.getElementById('sem-plano-msg').style.display = temPlano ? 'none' : 'block';
    document.getElementById('cardapio-section').style.display = refeicoes.length ? 'block' : 'none';

    let consumido = 0;
    refeicoes.forEach((r) => (r.alimentos || []).forEach((a) => {
        if (marcadosAtual[a.id] && a.kcal) consumido += a.kcal;
    }));

    const meta = metas.calorias || 0;
    const pct = meta ? consumido / meta : 0;

    document.getElementById('calorias-ring').innerHTML = `
        <div class="ring-wrap">
            ${ringSVG(pct)}
            <div class="ring-center">
                <strong>${consumido}</strong>
                <span>de ${meta ? meta.toLocaleString('pt-BR') : '--'} kcal</span>
            </div>
        </div>`;

    document.getElementById('pac-proteina').textContent = metas.proteina ? metas.proteina + ' g' : '--';
    document.getElementById('pac-carb').textContent = metas.carboidrato ? metas.carboidrato + ' g' : '--';
    document.getElementById('pac-gordura').textContent = metas.gordura ? metas.gordura + ' g' : '--';

    const obsSection = document.getElementById('observacoes-section');
    if (plano.observacoes) {
        obsSection.style.display = 'block';
        document.getElementById('pac-observacoes').textContent = plano.observacoes;
    } else {
        obsSection.style.display = 'none';
    }

    const cont = document.getElementById('refeicoes-lista');
    cont.innerHTML = refeicoes.map((r) => `
        <div class="refeicao-card">
            <div class="refeicao-card-head">
                <h4>${r.nome}</h4>
                ${r.horario ? `<span class="refeicao-hora">${r.horario}</span>` : ''}
            </div>
            <div class="alimentos-lista">
                ${(r.alimentos || []).map((a) => `
                    <label class="alimento-item ${marcadosAtual[a.id] ? 'feito' : ''}">
                        <input type="checkbox" data-alimento-id="${a.id}" ${marcadosAtual[a.id] ? 'checked' : ''}>
                        <span class="alimento-nome">${a.nome}</span>
                        <span class="alimento-qtd">${a.quantidade || ''}</span>
                        ${a.kcal ? `<span class="alimento-kcal">${a.kcal} kcal</span>` : ''}
                    </label>
                `).join('')}
            </div>
        </div>
    `).join('');
}

document.getElementById('refeicoes-lista').addEventListener('change', async (e) => {
    const cb = e.target;
    if (cb.type !== 'checkbox') return;
    const user = auth.currentUser;
    if (!user) return;

    const alimentoId = cb.dataset.alimentoId;
    marcadosAtual = { ...marcadosAtual, [alimentoId]: cb.checked };
    atualizarPainelPlano();

    try {
        await setDoc(
            doc(db, 'pacientes', user.uid, 'consumo', todayKey()),
            { marcados: { [alimentoId]: cb.checked } },
            { merge: true }
        );
    } catch (err) {
        console.error(err);
        marcadosAtual = { ...marcadosAtual, [alimentoId]: !cb.checked };
        atualizarPainelPlano();
    }
});

function renderPesos(uid, snapshot) {
    const lista = document.getElementById('peso-lista');
    const chart = document.getElementById('peso-chart');
    const vazio = document.getElementById('peso-vazio');

    const registros = [];
    snapshot.forEach((docSnap) => registros.push({ id: docSnap.id, ...docSnap.data() }));

    if (registros.length === 0) {
        vazio.style.display = 'block';
        lista.innerHTML = '';
        chart.innerHTML = '';
        return;
    }
    vazio.style.display = 'none';

    const cronologico = [...registros].reverse();
    const valores = cronologico.map((r) => r.valor);
    const min = Math.min(...valores);
    const max = Math.max(...valores);
    const range = max - min || 1;

    chart.innerHTML = cronologico.slice(-14).map((r) => {
        const altura = 14 + ((r.valor - min) / range) * 66;
        return `<div class="peso-bar" style="height:${altura}%;" title="${r.valor} kg"></div>`;
    }).join('');

    lista.innerHTML = registros.slice(0, 6).map((r) => {
        const data = r.data?.toDate ? r.data.toDate().toLocaleDateString('pt-BR') : '--';
        return `<div class="peso-item"><span>${data}</span><strong>${r.valor} kg</strong></div>`;
    }).join('');
}

document.getElementById('peso-form').addEventListener('submit', async () => {
    const user = auth.currentUser;
    if (!user) return;
    const input = document.getElementById('peso-input');
    const valor = parseFloat(input.value);
    if (!valor) return;

    await addDoc(collection(db, 'pacientes', user.uid, 'pesos'), {
        valor,
        data: serverTimestamp()
    });
    input.value = '';
});

/* formulário do paciente */
function preencherAnamnese(a) {
    document.getElementById('an-peso').value = a.pesoAtual ?? '';
    document.getElementById('an-altura').value = a.altura ?? '';
    document.getElementById('an-idade').value = a.idade ?? '';
    document.getElementById('an-sexo').value = a.sexo ?? '';
    document.getElementById('an-atividade-nivel').value = a.nivelAtividade ?? '';
    document.getElementById('an-atividade-qual').value = a.atividadeQual ?? '';
    document.getElementById('an-rotina').value = a.rotina ?? '';
    document.getElementById('an-refeicoes-dia').value = a.refeicoesPorDia ?? '';
    document.getElementById('an-agua').value = a.aguaLitros ?? '';
    document.getElementById('an-fuma').value = a.fuma ?? '';
    document.getElementById('an-alcool').value = a.alcool ?? '';
    document.getElementById('an-condicoes').value = a.condicoesSaude ?? '';
    document.getElementById('an-medicamentos').value = a.medicamentos ?? '';
    document.getElementById('an-alergias').value = a.alergias ?? '';
    document.getElementById('an-restricao').value = a.restricaoAlimentar ?? '';
    document.getElementById('an-nao-gosta').value = a.naoGosta ?? '';
    document.getElementById('an-gosta').value = a.gosta ?? '';
    document.getElementById('an-observacoes').value = a.observacoes ?? '';
}

document.getElementById('anamnese-form').addEventListener('submit', async () => {
    const user = auth.currentUser;
    if (!user) return;

    const btn = document.querySelector('#anamnese-form button[type="submit"]');
    const msg = document.getElementById('anamnese-msg');
    btn.disabled = true;
    msg.style.color = 'var(--forest)';
    msg.textContent = 'Salvando...';

    const anamnese = {
        pesoAtual: Number(document.getElementById('an-peso').value) || null,
        altura: Number(document.getElementById('an-altura').value) || null,
        idade: Number(document.getElementById('an-idade').value) || null,
        sexo: document.getElementById('an-sexo').value,
        nivelAtividade: document.getElementById('an-atividade-nivel').value,
        atividadeQual: document.getElementById('an-atividade-qual').value.trim(),
        rotina: document.getElementById('an-rotina').value.trim(),
        refeicoesPorDia: Number(document.getElementById('an-refeicoes-dia').value) || null,
        aguaLitros: Number(document.getElementById('an-agua').value) || null,
        fuma: document.getElementById('an-fuma').value,
        alcool: document.getElementById('an-alcool').value,
        condicoesSaude: document.getElementById('an-condicoes').value.trim(),
        medicamentos: document.getElementById('an-medicamentos').value.trim(),
        alergias: document.getElementById('an-alergias').value.trim(),
        restricaoAlimentar: document.getElementById('an-restricao').value.trim(),
        naoGosta: document.getElementById('an-nao-gosta').value.trim(),
        gosta: document.getElementById('an-gosta').value.trim(),
        observacoes: document.getElementById('an-observacoes').value.trim(),
        atualizadoEm: serverTimestamp()
    };

    try {
        await updateDoc(doc(db, 'pacientes', user.uid), { anamnese });
        msg.style.color = 'var(--forest)';
        msg.textContent = 'Respostas salvas! A Alice já pode ver no painel dela. 🍊';
    } catch (err) {
        console.error(err);
        msg.style.color = '#c0392b';
        msg.textContent = 'Não deu pra salvar agora, tenta de novo.';
    } finally {
        btn.disabled = false;
    }
});

let pacienteUnsub = null;

onAuthStateChanged(auth, (user) => {
    if (pacienteUnsub) { pacienteUnsub(); pacienteUnsub = null; }
    if (pesoUnsub) { pesoUnsub(); pesoUnsub = null; }
    if (consumoUnsub) { consumoUnsub(); consumoUnsub = null; }
    anamneseCarregada = false;

    if (!user) {
        showView('login');
        return;
    }

    pacienteUnsub = onSnapshot(doc(db, 'pacientes', user.uid), (snap) => {
        if (!snap.exists()) {
            showView('login');
            return;
        }
        const p = snap.data();
        const status = p.statusCadastro || 'pendente';

        if (status === 'pendente') {
            showView('pendente');
        } else if (status === 'recusado') {
            showView('recusado');
        } else if (p.status === 'pausado' || p.status === 'inativo') {
            showView('bloqueado');
            const emoji = document.getElementById('bloq-emoji');
            const titulo = document.getElementById('bloq-titulo');
            const texto = document.getElementById('bloq-texto');
            if (p.status === 'pausado') {
                emoji.textContent = '⏸️';
                titulo.textContent = 'Acompanhamento pausado';
                texto.textContent = 'A Alice pausou seu acompanhamento por enquanto. Assim que ela retomar, sua área libera automaticamente por aqui.';
            } else {
                emoji.textContent = '🔒';
                titulo.textContent = 'Acompanhamento encerrado';
                texto.textContent = 'Seu acompanhamento com a Alice foi encerrado. Se quiser retomar, fala com ela por aqui.';
            }
        } else {
            showView('dashboard');
            renderPlano(p);
            if (!pesoUnsub) {
                const q = query(collection(db, 'pacientes', user.uid, 'pesos'), orderBy('data', 'desc'));
                pesoUnsub = onSnapshot(q, (snapshot) => renderPesos(user.uid, snapshot));
            }
            if (!consumoUnsub) {
                consumoUnsub = onSnapshot(doc(db, 'pacientes', user.uid, 'consumo', todayKey()), (snap2) => {
                    marcadosAtual = snap2.exists() ? (snap2.data().marcados || {}) : {};
                    atualizarPainelPlano();
                });
            }
        }
    });
});