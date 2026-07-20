document.addEventListener('DOMContentLoaded', () => {

    const revealEls = document.querySelectorAll('.reveal');
    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            entry.target.classList.toggle('in-view', entry.isIntersecting);
        });
    }, { threshold: 0.2, rootMargin: '0px 0px -8% 0px' });
    revealEls.forEach((el) => observer.observe(el));

    const nav = document.querySelector('.site-nav');
    if (nav) {
        const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 40);
        onScroll();
        window.addEventListener('scroll', onScroll, { passive: true });
    }

    const toggle = document.querySelector('.nav-toggle');
    const links = document.querySelector('.nav-links');
    if (toggle && links) {
        toggle.addEventListener('click', () => {
            toggle.classList.toggle('open');
            links.classList.toggle('open');
        });
        links.querySelectorAll('a').forEach((a) => {
            a.addEventListener('click', () => {
                toggle.classList.remove('open');
                links.classList.remove('open');
            });
        });
    }

    /* calculadora de calorias */
    const calcForm = document.getElementById('calc-form');
    if (calcForm) {
        const genderBtns = calcForm.querySelectorAll('.calc-toggle button');
        let gender = 'f';

        genderBtns.forEach((btn) => {
            btn.addEventListener('click', () => {
                genderBtns.forEach((b) => b.classList.remove('active'));
                btn.classList.add('active');
                gender = btn.dataset.gender;
                runCalc();
            });
        });

        const weight = document.getElementById('calc-weight');
        const height = document.getElementById('calc-height');
        const age = document.getElementById('calc-age');
        const activity = document.getElementById('calc-activity');

        const resultValue = document.getElementById('calc-result-value');
        const bmr = document.getElementById('calc-bmr');
        const proteinEl = document.getElementById('calc-protein');
        const carbEl = document.getElementById('calc-carb');
        const fatEl = document.getElementById('calc-fat');

        function runCalc() {
            const w = parseFloat(weight.value);
            const h = parseFloat(height.value);
            const a = parseFloat(age.value);
            const factor = parseFloat(activity.value);

            if (!w || !h || !a) {
                resultValue.textContent = '--';
                bmr.textContent = '--';
                proteinEl.textContent = carbEl.textContent = fatEl.textContent = '--';
                return;
            }

            const base = gender === 'f'
                ? (10 * w) + (6.25 * h) - (5 * a) - 161
                : (10 * w) + (6.25 * h) - (5 * a) + 5;

            const total = Math.round(base * factor);

            resultValue.textContent = total.toLocaleString('pt-BR');
            bmr.textContent = Math.round(base).toLocaleString('pt-BR') + ' kcal';

            const proteinG = Math.round((total * 0.3) / 4);
            const carbG = Math.round((total * 0.4) / 4);
            const fatG = Math.round((total * 0.3) / 9);

            proteinEl.textContent = proteinG + ' g';
            carbEl.textContent = carbG + ' g';
            fatEl.textContent = fatG + ' g';
        }

        [weight, height, age, activity].forEach((el) => {
            el.addEventListener('input', runCalc);
            el.addEventListener('change', runCalc);
        });

        runCalc();
    }

    const testiWrap = document.querySelector('.testi-wrap');
    if (testiWrap) {
        const slides = testiWrap.querySelectorAll('.testi-slide');
        const dots = testiWrap.querySelectorAll('.testi-dots button');
        let current = 0;
        let timer;

        function show(i) {
            slides.forEach((s, idx) => s.classList.toggle('active', idx === i));
            dots.forEach((d, idx) => d.classList.toggle('active', idx === i));
            current = i;
        }

        function next() {
            show((current + 1) % slides.length);
        }

        function startAuto() {
            timer = setInterval(next, 6000);
        }

        function resetAuto() {
            clearInterval(timer);
            startAuto();
        }

        dots.forEach((dot, idx) => {
            dot.addEventListener('click', () => {
                show(idx);
                resetAuto();
            });
        });

        show(0);
        startAuto();
    }
});