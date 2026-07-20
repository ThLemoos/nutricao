import { db, auth } from "./firebase.js";
import { doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { createUserWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const form = document.getElementById('cadastro-form');
const msg = document.getElementById('cadastro-msg');
const senhaGroup = document.getElementById('senha-group');
const senhaInput = document.getElementById('c-senha');
const nomeInput = document.getElementById('c-nome');
const emailInput = document.getElementById('c-email');

const mensagensErro = {
    'auth/email-already-in-use': 'Esse email já tem cadastro. Tenta entrar direto na sua área.',
    'auth/weak-password': 'Senha muito fraca, use pelo menos 6 caracteres.',
    'auth/invalid-email': 'Email inválido.'
};

let viaGoogle = false;

/* cadastro com a conta do Google */
document.getElementById('google-cadastro-btn').addEventListener('click', async () => {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    msg.style.color = 'var(--forest)';
    msg.textContent = '';

    try {
        const cred = await signInWithPopup(auth, provider);
        const user = cred.user;

        const existente = await getDoc(doc(db, 'pacientes', user.uid));
        if (existente.exists()) {
            msg.style.color = 'var(--forest)';
            msg.textContent = 'Você já tem cadastro com essa conta Google! Redirecionando pra sua área...';
            setTimeout(() => { window.location.href = './area-paciente.html'; }, 1800);
            return;
        }

        // deixa preenchido alguns dados com a conta do Google e deixa travados
        nomeInput.value = user.displayName || '';
        emailInput.value = user.email || '';
        nomeInput.disabled = true;
        emailInput.disabled = true;
        senhaGroup.style.display = 'none';
        senhaInput.required = false;
        viaGoogle = true;

        msg.style.color = 'var(--forest)';
        msg.textContent = 'Conta Google conectada! Só falta preencher telefone e objetivo, depois clica em "Enviar cadastro".';
    } catch (err) {
        console.error(err);
        msg.style.color = '#c0392b';
        msg.textContent = 'Não deu pra conectar com o Google agora, tenta de novo.';
    }
});

/* envio do formulário */
form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    msg.style.color = 'var(--forest)';
    msg.textContent = 'Enviando...';

    const email = emailInput.value.trim();
    const senha = senhaInput.value;

    try {
        let uid;
        if (viaGoogle) {
            uid = auth.currentUser.uid;
        } else {
            const cred = await createUserWithEmailAndPassword(auth, email, senha);
            uid = cred.user.uid;
        }

        await setDoc(doc(db, 'pacientes', uid), {
            nome: nomeInput.value.trim(),
            email,
            telefone: document.getElementById('c-telefone').value.trim(),
            objetivo: document.getElementById('c-objetivo').value,
            statusCadastro: 'pendente',
            visto: false,
            criadoEm: serverTimestamp()
        });

        form.reset();
        msg.style.color = 'var(--forest)';
        msg.textContent = 'Cadastro enviado, preparando tudo...';

        setTimeout(() => {
            msg.textContent = '';
            document.getElementById('sucesso-overlay').style.display = 'flex';
        }, 1800);
    } catch (err) {
        console.error(err);
        msg.style.color = '#c0392b';
        msg.textContent = mensagensErro[err.code] || 'Não deu pra enviar agora, tenta de novo em instantes.';
    } finally {
        btn.disabled = false;
    }
});

document.getElementById('overlay-ok-btn').addEventListener('click', () => {
    window.location.href = './area-paciente.html';
});