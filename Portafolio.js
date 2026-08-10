const links = document.querySelectorAll('.nav a');
const sections = document.querySelectorAll('main section');
const menuToggle = document.getElementById('menuToggle');
const nav = document.getElementById('nav');
const glow = document.querySelector('.cursor-glow');
const revealItems = document.querySelectorAll('.reveal');
const hero3d = document.querySelector('.hero-3d');
const canvas = document.getElementById('bg-canvas');
const ctx = canvas?.getContext('2d');
const cpuFill = document.querySelector('.cpu-fill');
const netFill = document.querySelector('.net-fill');
const cpuValue = document.querySelector('.cpu-value');
const latencyValue = document.querySelector('.latency-value');
const netValue = document.querySelector('.net-value');
const projectItems = document.querySelectorAll('.project-item');
const terminalForm = document.getElementById('terminalForm');
const terminalInput = document.getElementById('terminalInput');
const terminalOutput = document.getElementById('terminalOutput');
const contactForm = document.getElementById('contactForm');
const contactStatus = document.getElementById('formStatus');
const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
const COMPACT_MODE_KEY = 'hudCompactMode';
const modalBackdrop = document.getElementById('projectModal');
const modalTitle = document.getElementById('modalTitle');
const modalBody = document.getElementById('modalBody');
const modalClose = document.getElementById('modalClose');
const modalActions = document.getElementById('modalActions');

let fpsEstimate = 60;
let lastFrameTime = performance.now();
let commandHistory = [];
let historyIndex = -1;
let batteryManager;

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            links.forEach(link => {
                const target = link.getAttribute('href')?.replace('#', '');
                link.classList.toggle('active', target === entry.target.id);
            });
        }
    });
}, { threshold: 0.25 });

revealItems.forEach(item => observer.observe(item));

window.addEventListener('scroll', () => {
    nav?.classList.toggle('scrolled', window.scrollY > 30);
});

menuToggle?.addEventListener('click', () => {
    const isOpen = nav?.classList.toggle('open');
    if (menuToggle) {
        menuToggle.setAttribute('aria-expanded', String(isOpen));
    }
});

links.forEach(link => {
    link.addEventListener('click', () => {
        nav?.classList.remove('open');
        if (menuToggle) {
            menuToggle.setAttribute('aria-expanded', 'false');
        }
    });
});

window.addEventListener('mousemove', (e) => {
    glow && (glow.style.left = `${e.clientX}px`, glow.style.top = `${e.clientY}px`);

    if (hero3d) {
        const rect = hero3d.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width - 0.5;
        const y = (e.clientY - rect.top) / rect.height - 0.5;
        hero3d.style.transform = `rotateY(${x * 12}deg) rotateX(${y * -12}deg)`;
    }
});

window.addEventListener('mouseleave', () => {
    glow && (glow.style.opacity = '0');
});

window.addEventListener('mouseenter', () => {
    glow && (glow.style.opacity = '0.9');
});

if (canvas && ctx) {
    const particles = Array.from({ length: 90 }, () => ({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        vx: (Math.random() - 0.5) * 0.8,
        vy: (Math.random() - 0.5) * 0.8,
        size: Math.random() * 2 + 1,
        hue: Math.random() > 0.5 ? 185 : 320
    }));

    const resize = () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    };

    const draw = (timestamp = performance.now()) => {
        const delta = timestamp - lastFrameTime;
        if (delta > 0) {
            const currentFps = 1000 / delta;
            fpsEstimate = (fpsEstimate * 0.9) + (currentFps * 0.1);
            lastFrameTime = timestamp;
        }

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        particles.forEach(p => {
            p.x += p.vx;
            p.y += p.vy;
            if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
            if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
            ctx.beginPath();
            ctx.fillStyle = `hsla(${p.hue}, 90%, 70%, 0.9)`;
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
        });
        requestAnimationFrame(draw);
    };

    resize();
    draw();
    window.addEventListener('resize', resize);
}

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const setCompactMode = (enabled, reason = 'manual') => {
    document.body.classList.toggle('compact-mode', enabled);
    localStorage.setItem(COMPACT_MODE_KEY, enabled ? 'compact' : 'standard');
    document.body.dataset.compactReason = reason;
};

const shouldUseCompactMode = async () => {
    const savedMode = localStorage.getItem(COMPACT_MODE_KEY);
    const isSlowConnection = Boolean(
        connection?.saveData
        || connection?.effectiveType === 'slow-2g'
        || connection?.effectiveType === '2g'
        || connection?.effectiveType === '3g'
    );

    let lowBattery = false;
    if ('getBattery' in navigator) {
        try {
            batteryManager = batteryManager || await navigator.getBattery();
            lowBattery = batteryManager.level <= 0.2 && !batteryManager.charging;
        } catch {
            lowBattery = false;
        }
    }

    if (lowBattery || isSlowConnection) {
        setCompactMode(true, lowBattery ? 'battery' : 'network');
        return;
    }

    setCompactMode(savedMode === 'compact', 'saved');
};

const bindCompactModeSignals = async () => {
    await shouldUseCompactMode();

    connection?.addEventListener?.('change', () => {
        shouldUseCompactMode();
        updateHudStats();
    });

    if ('getBattery' in navigator) {
        try {
            batteryManager = batteryManager || await navigator.getBattery();
            batteryManager.addEventListener('chargingchange', shouldUseCompactMode);
            batteryManager.addEventListener('levelchange', shouldUseCompactMode);
        } catch {
            return;
        }
    }
};

const getCpuEstimate = () => {
    const cores = navigator.hardwareConcurrency || 4;
    const corePenalty = (8 - Math.min(cores, 8)) * 2.1;
    const fpsPenalty = clamp(66 - fpsEstimate, 0, 40);
    const memoryBias = navigator.deviceMemory ? clamp(6 - navigator.deviceMemory, 0, 4) * 1.2 : 1.4;
    return clamp(Math.round(34 + corePenalty + fpsPenalty + memoryBias), 18, 96);
};

const pingCurrentOrigin = async () => {
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 2500);
        const start = performance.now();
        await fetch(window.location.href, {
            method: 'HEAD',
            cache: 'no-store',
            signal: controller.signal
        });
        clearTimeout(timeout);
        return Math.round(performance.now() - start);
    } catch {
        return null;
    }
};

const getNetworkEstimate = async () => {
    const effectiveType = connection?.effectiveType || 'online';
    const downlink = Number.isFinite(connection?.downlink) ? connection.downlink : null;
    const qualityFromType = {
        'slow-2g': 18,
        '2g': 32,
        '3g': 58,
        '4g': 86
    };
    const quality = downlink
        ? clamp(Math.round((downlink / 20) * 100), 20, 99)
        : (qualityFromType[effectiveType] || 78);

    const apiRtt = Number.isFinite(connection?.rtt) ? connection.rtt : null;
    const pingRtt = await pingCurrentOrigin();
    const latency = pingRtt ?? apiRtt ?? 24;

    const label = downlink
        ? `${downlink.toFixed(1)} Mb/s ${effectiveType.toUpperCase()}`
        : effectiveType.toUpperCase();

    return {
        quality,
        latency: clamp(latency, 8, 400),
        label
    };
};

const updateHudStats = async () => {
    const cpu = getCpuEstimate();
    const network = await getNetworkEstimate();
    const net = network.quality;
    const latency = network.latency;

    if (cpuFill) {
        cpuFill.style.width = `${cpu}%`;
        cpuFill.setAttribute('data-value', String(cpu));
    }
    if (netFill) {
        netFill.style.width = `${net}%`;
        netFill.setAttribute('data-value', String(net));
    }
    if (cpuValue) {
        cpuValue.textContent = `${cpu}%`;
    }
    if (latencyValue) {
        latencyValue.textContent = `${latency} ms`;
    }
    if (netValue) {
        netValue.textContent = network.label;
    }
};

updateHudStats();
setInterval(() => {
    updateHudStats();
}, 5000);

bindCompactModeSignals();

const appendLine = (text, className = '') => {
    if (!terminalOutput) return;
    const line = document.createElement('p');
    if (className) line.classList.add(className);
    line.innerHTML = text;
    terminalOutput.appendChild(line);
    terminalOutput.scrollTop = terminalOutput.scrollHeight;
};

const setContactStatus = (message, type = 'success') => {
    if (!contactStatus) return;
    const mappedType = type === 'error' ? 'error' : type === 'pending' ? 'loading' : 'success';
    setStatusMessage(message, mappedType);
};

const focusProjectCard = (card) => {
    projectItems.forEach(item => item.classList.remove('focused'));
    card.classList.add('focused');
    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
};

const openProjectResource = (card, resource = 'demo') => {
    const resourceKey = resource === 'github' ? 'github' : 'demo';
    const url = card.dataset[resourceKey];

    focusProjectCard(card);

    if (!url) {
        appendLine(`El recurso <strong>${resourceKey}</strong> no esta configurado para <strong>${card.id}</strong>.`, 'error');
        return;
    }

    window.open(url, '_blank', 'noopener,noreferrer');
    appendLine(`Abriendo <strong>${resourceKey}</strong> de <strong>${card.id}</strong>...`, 'ok');
};

const setStatusMessage = (message, kind = 'info') => {
    if (!contactStatus) return;
    contactStatus.textContent = message;
    contactStatus.className = `form-status ${kind === 'error' ? 'is-error' : kind === 'success' ? 'is-success' : 'is-loading'}`;
};

const openProjectModal = (card) => {
    if (!modalBackdrop || !modalTitle || !modalBody || !modalActions) return;

    const title = card.querySelector('h3')?.textContent || 'Proyecto';
    const summary = card.querySelector('p')?.textContent || 'Proyecto destacado';
    const demoUrl = card.dataset.demo;
    const githubUrl = card.dataset.github;

    modalTitle.textContent = title;
    modalBody.innerHTML = `
        <p>${summary}</p>
        <p class="state-pill is-info">Listo para revisar en modo vista previa.</p>
    `;
    modalActions.innerHTML = `
        <a class="btn btn-sm btn-demo" href="${demoUrl}" target="_blank" rel="noopener noreferrer">Abrir demo</a>
        <a class="btn btn-sm btn-github" href="${githubUrl}" target="_blank" rel="noopener noreferrer">Ver GitHub</a>
    `;
    modalBackdrop.classList.add('is-open');
    modalBackdrop.setAttribute('aria-hidden', 'false');
};

const closeModal = () => {
    if (!modalBackdrop) return;
    modalBackdrop.classList.remove('is-open');
    modalBackdrop.setAttribute('aria-hidden', 'true');
};

projectItems.forEach((item) => {
    item.addEventListener('click', (event) => {
        if (event.target.closest('a')) return;
        openProjectModal(item);
    });
});

modalClose?.addEventListener('click', closeModal);
modalBackdrop?.addEventListener('click', (event) => {
    if (event.target === modalBackdrop) closeModal();
});
window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeModal();
});

/* Ejecuta un comando ingresado en la terminal simulada */
const runCommand = (command) => {
    const cmd = command.trim().toLowerCase();
    appendLine(`<span class="prompt">root@pedro:~$</span> ${command}`);

    if (!cmd) {
        appendLine('Comando vacio. Usa <strong>help</strong>.', 'warn');
        return;
    }

    if (cmd === 'help') {
        appendLine('Comandos: <strong>help</strong>, <strong>about</strong>, <strong>skills</strong>, <strong>status</strong>, <strong>projects</strong>, <strong>open proyecto-01 demo</strong>, <strong>open proyecto-01 github</strong>, <strong>contact</strong>, <strong>date</strong>, <strong>clear</strong>.', 'ok');
        return;
    }

    if (cmd === 'about') {
        appendLine('Pedro Perez // Frontend Developer orientado a interfaces creativas, rendimiento y UX tecnica.', 'ok');
        return;
    }

    if (cmd === 'skills') {
        appendLine('Stack: HTML5, CSS3, JavaScript, Bootstrap, Responsive Design, Git.', 'ok');
        return;
    }

    if (cmd === 'status') {
        const cpu = cpuValue?.textContent ?? '74%';
        const latency = latencyValue?.textContent ?? '14 ms';
        const network = netValue?.textContent ?? 'ONLINE';
        const compact = document.body.classList.contains('compact-mode') ? 'ACTIVO' : 'OFF';
        appendLine(`Estado actual => CPU: <strong>${cpu}</strong> | LAT: <strong>${latency}</strong> | RED: <strong>${network}</strong> | COMPACT: <strong>${compact}</strong>`, 'ok');
        return;
    }

    if (cmd === 'projects') {
        appendLine('Proyectos activos: <strong>proyecto-01</strong>, <strong>proyecto-02</strong>, <strong>proyecto-03</strong>, <strong>proyecto-04</strong>, <strong>proyecto-05</strong>, <strong>proyecto-06</strong>.', 'ok');
        appendLine('Tip: usa <strong>open proyecto-01 demo</strong> o <strong>open proyecto-01 github</strong>.', 'warn');
        return;
    }

    if (cmd.startsWith('open ')) {
        const [, projectId = '', resource = 'demo'] = cmd.split(/\s+/);
        const card = document.getElementById(projectId);

        if (!card) {
            appendLine(`No existe el objetivo <strong>${projectId}</strong>.`, 'error');
            return;
        }

        if (resource !== 'demo' && resource !== 'github') {
            appendLine('Usa <strong>demo</strong> o <strong>github</strong> como recurso para open.', 'warn');
            return;
        }

        openProjectResource(card, resource);
        return;
    }

    if (cmd === 'contact') {
        appendLine('Canal de contacto: <strong>pedro@example.com</strong>', 'ok');
        return;
    }

    if (cmd === 'date') {
        appendLine(`Fecha sistema: <strong>${new Date().toLocaleString('es-MX')}</strong>`, 'ok');
        return;
    }

    if (cmd === 'clear') {
        if (terminalOutput) {
            terminalOutput.innerHTML = '';
            appendLine('<span class="prompt">root@pedro:~$</span> clear');
            appendLine('Consola limpiada.', 'ok');
        }
        return;
    }

    appendLine(`Comando no reconocido: <strong>${cmd}</strong>. Usa <strong>help</strong>.`, 'error');
};

/* Maneja el envío del formulario de la terminal simulada */
terminalForm?.addEventListener('submit', (event) => {
    event.preventDefault();
    const command = terminalInput?.value ?? '';
    const trimmed = command.trim();
    if (trimmed) {
        commandHistory.push(trimmed);
        historyIndex = commandHistory.length;
    }
    runCommand(command);
    if (terminalInput) {
        terminalInput.value = '';
        terminalInput.focus();
    }
});

/* Maneja la navegación por el historial de comandos con las flechas arriba y abajo */
terminalInput?.addEventListener('keydown', (event) => {
    if (!commandHistory.length) return;

    if (event.key === 'ArrowUp') {
        event.preventDefault();
        historyIndex = Math.max(0, historyIndex - 1);
        terminalInput.value = commandHistory[historyIndex] || '';
    }

    if (event.key === 'ArrowDown') {
        event.preventDefault();
        historyIndex = Math.min(commandHistory.length, historyIndex + 1);
        terminalInput.value = historyIndex >= commandHistory.length ? '' : (commandHistory[historyIndex] || '');
    }
});

/* Maneja el envío del formulario de contacto */
contactForm?.addEventListener('submit', (event) => {
    event.preventDefault();

    const data = new FormData(contactForm);
    const name = String(data.get('name') || '').trim();
    const email = String(data.get('email') || '').trim();
    const message = String(data.get('message') || '').trim();

    if (!name || !email || !message) {
        setContactStatus('Completa nombre, correo y mensaje para enviar la señal.', 'error');
        return;
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(email)) {
        setContactStatus('El correo no parece válido. Revisa el formato.', 'error');
        return;
    }

    setContactStatus('Preparando el canal de contacto...', 'pending');

    const subject = encodeURIComponent(`Nueva propuesta de ${name} | ${data.get('project') || 'Proyecto sin definir'}`);
    const body = encodeURIComponent(`Nombre: ${name}\nCorreo: ${email}\nProyecto: ${data.get('project') || 'Sin especificar'}\nPrioridad: ${data.get('priority') || 'Media'}\n\nMensaje:\n${message}`);
    const mailtoLink = `mailto:pedro@example.com?subject=${subject}&body=${body}`;

    const launchLink = document.createElement('a');
    launchLink.href = mailtoLink;
    launchLink.style.display = 'none';
    document.body.appendChild(launchLink);
    launchLink.click();
    launchLink.remove();

    contactForm.reset();
    localStorage.setItem('pedro-contact-form', JSON.stringify({ name, email, message }));
    setContactStatus('Señal enviada. Revisa tu cliente de correo para concluir el envío.', 'success');
});