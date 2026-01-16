document.addEventListener('DOMContentLoaded', () => {
    console.log("Neo Player : Démarrage PLATINUM (Final Cover Fix)...");
    const get = (id) => document.getElementById(id);

    // --- 1. UI MAPPING ---
    const ui = {
        video: get('video-player'),
        mainDock: get('main-dock'),
        mediaContainer: document.querySelector('.media-container'),
        
        navHome: get('nav-home'), navExplorer: get('nav-explorer'), navRadio: get('nav-radio'), navSettings: get('nav-settings'),
        viewPlayer: get('view-player'), viewExplorer: get('view-explorer'), viewRadio: get('view-radio'), viewSettings: get('view-settings'),
        
        playBtn: get('play-pause-btn'), prevBtn: get('prev-btn'), nextBtn: get('next-btn'),
        fullBtn: get('fullscreen-btn'), miniBtn: get('mini-player-btn'), 
        shuffleBtn: get('shuffle-btn'), loopBtn: get('loop-btn'), speedBtn: get('speed-btn'), muteBtn: get('mute-btn'),
        slider: get('seek-slider'), volSlider: get('volume-slider'),
        
        playlist: get('playlist-list'), clearBtn: get('clear-playlist-btn'),
        trackTitle: get('track-title'), timeDisplay: get('track-time-display'), currentTime: get('current-time'), totalTime: get('total-time'),
        placeholder: get('placeholder'), coverDisplay: get('cover-display'), visualizerCanvas: get('audio-visualizer'),
        dockCover: document.querySelector('.mini-cover'), // <--- Cible la petite pochette du dock
        
        openBtn: get('open-file-btn'),
        explorerList: get('explorer-list'), explorerPath: get('explorer-path'), explorerUp: get('explorer-up-btn'), explorerSearch: get('explorer-search'), 
        playFolderBtn: get('play-folder-btn'), drivesList: get('drives-list'), refreshDrivesBtn: get('refresh-drives-btn'),
        
        radioGrid: get('radio-grid'),
        min: get('min-btn'), max: get('max-btn'), close: get('close-btn'),
        themePresets: document.querySelectorAll('.theme-preset'), toastContainer: get('toast-container'),
        vizSelect: get('viz-select'), setAutoplay: get('set-autoplay'), setRemember: get('set-remember-folder'),
        audioSelect: get('audio-output-select'),
        
        shortcutsList: get('shortcuts-list'), checkUpdateBtn: get('check-update-btn'), updateStatus: get('update-status'),
        contextMenu: get('context-menu')
    };

    // --- 2. CONFIG & VARIABLES ---
    let playlist = [], currentIndex = 0;
    let isShuffle = false, isLoop = false, isRadioMode = false;
    let speedIndex = 0; const speeds = [1.0, 1.25, 1.5, 2.0, 0.5];
    let currentExplorerPath = "";
    const VIDEO_EXTS = ['.mp4', '.mkv', '.webm', '.avi', '.mov'];
    let currentCoverImage = null; // Mémoire de la pochette actuelle

    const defaultShortcuts = {
        'play': { label: 'Lecture / Pause', key: ' ', code: 'Space' },
        'next': { label: 'Suivant', key: 'ArrowRight', code: 'ArrowRight' },
        'prev': { label: 'Précédent', key: 'ArrowLeft', code: 'ArrowLeft' },
        'vol_up': { label: 'Volume +', key: 'ArrowUp', code: 'ArrowUp' },
        'vol_down': { label: 'Volume -', key: 'ArrowDown', code: 'ArrowDown' },
        'mute': { label: 'Muet', key: 'm', code: 'KeyM' },
        'fullscreen': { label: 'Plein Écran', key: 'f', code: 'KeyF' },
        'shuffle': { label: 'Aléatoire', key: 's', code: 'KeyS' },
        'loop': { label: 'Répéter', key: 'l', code: 'KeyL' }
    };

    let config = { 
        themeName: 'neon-blue', 
        vizStyle: 'none', 
        autoplay: true, 
        rememberFolder: false, 
        lastFolder: "", 
        volume: 100, 
        audioDeviceId: 'default',
        shortcuts: JSON.parse(JSON.stringify(defaultShortcuts))
    };

    let audioCtx, analyser, dataArray, bufferLength, canvasCtx, animationId, sourceNode, nebulaRotation = 0;

    const radios = [
        { name: "France Inter", url: "https://icecast.radiofrance.fr/franceinter-midfi.mp3", icon: "FI" },
        { name: "RTL", url: "http://icecast.rtl.fr/rtl-1-44-128?listen=webCwsBCggNCQgLDQUGBAcGBg", icon: "RTL" },
        { name: "Skyrock", url: "http://icecast.skyrock.net/s/natio_mp3_128k", icon: "SKY" },
        { name: "NRJ", url: "https://scdn.nrjaudio.fm/audio1/fr/30001/mp3_128.mp3?orig=web", icon: "NRJ" },
        { name: "Fun Radio", url: "http://icecast.funradio.fr/fun-1-44-128?listen=webCwsBCggNCQgLDQUGBAcGBg", icon: "FUN" },
        { name: "Europe 1", url: "http://ais-live.cloud-services.paris:8000/europe1.mp3", icon: "E1" },
        { name: "FIP", url: "https://icecast.radiofrance.fr/fip-midfi.mp3", icon: "FIP" },
        { name: "Nostalgie", url: "https://scdn.nrjaudio.fm/audio1/fr/30601/mp3_128.mp3?orig=web", icon: "NOS" }
    ];

    const themesData = {
        'neon-blue': { color: '#00e5ff', bg: 'linear-gradient(135deg, #000428, #004e92)' },
        'cyber-punk': { color: '#ff0055', bg: 'linear-gradient(135deg, #2b1055, #7597de)' },
        'matrix': { color: '#00ff88', bg: 'linear-gradient(135deg, #000000, #0f9b0f)' },
        'sunset': { color: '#ffae00', bg: 'linear-gradient(135deg, #8E0E00, #1F1C18)' },
        'deep-space': { color: '#a600ff', bg: 'linear-gradient(135deg, #0f0c29, #302b63, #24243e)' },
        'custom': { color: '#ffffff', bg: 'default' }
    };

    // --- 3. DÉMARRAGE ---
    function loadConfig() {
        try {
            const saved = localStorage.getItem('neo-config');
            if (saved) {
                const parsed = JSON.parse(saved);
                config = { ...config, ...parsed };
                if (!config.shortcuts || !config.shortcuts.play) {
                    config.shortcuts = JSON.parse(JSON.stringify(defaultShortcuts));
                    saveConfig();
                }
            }
        } catch (e) { localStorage.removeItem('neo-config'); }

        applyThemePreset(config.themeName);
        if(config.themeName === 'custom' && config.bgImage) document.body.style.backgroundImage = `url('${config.bgImage}')`;

        if(ui.setAutoplay) ui.setAutoplay.checked = config.autoplay;
        if(ui.setRemember) ui.setRemember.checked = config.rememberFolder;
        
        if(ui.vizSelect) {
            ui.vizSelect.value = config.vizStyle;
            ui.vizSelect.onchange = () => {
                config.vizStyle = ui.vizSelect.value;
                saveConfig();
                // Si une pochette est déjà chargée en mémoire, on l'utilise
                if (!ui.video.paused) { 
                    handleVisualizerVisibility(ui.video.src, currentCoverImage); 
                    drawVisualizer(); 
                } else if (ui.video.src) {
                    handleVisualizerVisibility(ui.video.src, currentCoverImage);
                }
            };
        }
        
        if(ui.video) ui.video.volume = config.volume / 100;
        if(ui.volSlider) { 
            ui.volSlider.value = config.volume; updateSliderStyle(ui.volSlider); 
            ui.volSlider.oninput = () => { if(ui.video) ui.video.volume = ui.volSlider.value / 100; updateSliderStyle(ui.volSlider); config.volume = ui.volSlider.value; saveConfig(); };
        }
        
        loadAudioDevices(); renderRadioGrid(); renderShortcutsUI(); setupGlobalShortcuts(); initContextMenu();
        
        if(config.rememberFolder && config.lastFolder) loadExplorer(config.lastFolder); else loadExplorer('');
        switchTab('home'); 
    }
    function saveConfig() { localStorage.setItem('neo-config', JSON.stringify(config)); }

    // --- 4. NAVIGATION ---
    function switchTab(tab) {
        [ui.navHome, ui.navExplorer, ui.navRadio, ui.navSettings].forEach(b => b?.classList.remove('active'));
        [ui.viewPlayer, ui.viewExplorer, ui.viewRadio, ui.viewSettings].forEach(v => v?.classList.remove('active'));
        if (ui.mainDock) { ui.mainDock.classList.remove('dock-hidden'); ui.mainDock.classList.remove('dock-player-mode'); }
        if(tab === 'home') { if(ui.navHome) ui.navHome.classList.add('active'); if(ui.viewPlayer) ui.viewPlayer.classList.add('active'); if(ui.mainDock) ui.mainDock.classList.add('dock-player-mode'); }
        else if(tab === 'explorer') { if(ui.navExplorer) ui.navExplorer.classList.add('active'); if(ui.viewExplorer) ui.viewExplorer.classList.add('active'); if(ui.explorerList.innerHTML === '') loadExplorer(''); checkDrives(); if(ui.mainDock) ui.mainDock.classList.add('dock-hidden'); }
        else if(tab === 'radio') { if(ui.navRadio) ui.navRadio.classList.add('active'); if(ui.viewRadio) ui.viewRadio.classList.add('active'); }
        else if(tab === 'settings') { if(ui.navSettings) ui.navSettings.classList.add('active'); if(ui.viewSettings) ui.viewSettings.classList.add('active'); }
    }
    
    if(ui.navHome) ui.navHome.onclick = () => switchTab('home');
    if(ui.navExplorer) ui.navExplorer.onclick = () => switchTab('explorer');
    if(ui.navRadio) ui.navRadio.onclick = () => switchTab('radio');
    if(ui.navSettings) ui.navSettings.onclick = () => switchTab('settings');

    // --- 5. LECTURE & AUDIO ---
    function safePlay() {
        var playPromise = ui.video.play();
        if (playPromise !== undefined) {
            playPromise.then(_ => { if(config.vizStyle !== 'none' && !ui.video.paused) drawVisualizer(); }).catch(error => { console.log("Lecture interrompue"); });
        }
    }
    function togglePlay() { 
        if(isRadioMode) { resetPlayer(); } 
        else { if(ui.video.paused) { safePlay(); ui.playBtn.innerHTML = '<i class="ms-Icon ms-Icon--Pause"></i>'; } else { ui.video.pause(); ui.playBtn.innerHTML = '<i class="ms-Icon ms-Icon--Play"></i>'; } } 
    }
    if(ui.playBtn) ui.playBtn.onclick = togglePlay;

    // --- 6. VISUALIZER & POCHETTE UNIFIÉE ---
    function initAudio() {
        if(!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            analyser = audioCtx.createAnalyser();
            sourceNode = audioCtx.createMediaElementSource(ui.video);
            sourceNode.connect(analyser);
            analyser.connect(audioCtx.destination);
            analyser.fftSize = 256; 
            bufferLength = analyser.frequencyBinCount;
            dataArray = new Uint8Array(bufferLength);
            canvasCtx = ui.visualizerCanvas.getContext('2d');
            resizeCanvas(); window.addEventListener('resize', resizeCanvas);
        }
    }
    function resizeCanvas() { if (ui.visualizerCanvas.parentElement) { ui.visualizerCanvas.width = ui.visualizerCanvas.parentElement.offsetWidth; ui.visualizerCanvas.height = ui.visualizerCanvas.parentElement.offsetHeight; } }
    function drawVisualizer() {
        if(animationId) cancelAnimationFrame(animationId);
        if(ui.video.paused || config.vizStyle === 'none' || ui.visualizerCanvas.classList.contains('hidden')) return;
        animationId = requestAnimationFrame(drawVisualizer);
        const w = ui.visualizerCanvas.width, h = ui.visualizerCanvas.height;
        const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent');
        canvasCtx.clearRect(0, 0, w, h);
        analyser.getByteFrequencyData(dataArray);

        if(config.vizStyle === 'bars') {
            const barWidth = (w / bufferLength) * 2.5; let x = 0;
            for(let i = 0; i < bufferLength; i++) { const H = (dataArray[i] / 255) * h; canvasCtx.fillStyle = accent; canvasCtx.fillRect(x, h - H, barWidth, H); x += barWidth + 1; }
        } else if(config.vizStyle === 'spectrum') {
            canvasCtx.lineWidth = 3; canvasCtx.strokeStyle = accent; canvasCtx.beginPath();
            const sliceWidth = w * 1.0 / bufferLength; let x = 0;
            for(let i = 0; i < bufferLength; i++) { const v = dataArray[i] / 128.0; const y = v * h / 2; if(i === 0) canvasCtx.moveTo(x, y); else canvasCtx.lineTo(x, y); x += sliceWidth; }
            canvasCtx.lineTo(w, h/2); canvasCtx.stroke();
        } else if(config.vizStyle === 'nebula') {
            const cx = w / 2, cy = h / 2, radius = Math.min(w, h) / 3;
            nebulaRotation += 0.005; canvasCtx.save(); canvasCtx.translate(cx, cy); canvasCtx.rotate(nebulaRotation);
            for (let i = 0; i < bufferLength; i++) {
                const value = dataArray[i]; const barHeight = (value / 255) * 100;
                canvasCtx.rotate((Math.PI * 2) / bufferLength);
                canvasCtx.fillStyle = accent; canvasCtx.beginPath(); canvasCtx.arc(0, radius + barHeight, 2, 0, Math.PI * 2); canvasCtx.fill();
                canvasCtx.fillStyle = 'rgba(255,255,255,0.3)'; canvasCtx.beginPath(); canvasCtx.arc(0, radius - (barHeight * 0.5), 1, 0, Math.PI * 2); canvasCtx.fill();
            } canvasCtx.restore();
        }
    }
    
    // GESTION INTELLIGENTE VISUALIZER VS POCHETTE
    async function handleVisualizerVisibility(path, forcedCover = null) {
        const isVideo = VIDEO_EXTS.some(ext => path.toLowerCase().endsWith(ext));
        
        if (isVideo) {
            ui.visualizerCanvas.classList.add('hidden');
            ui.coverDisplay.classList.add('hidden');
        } else {
            if (config.vizStyle === 'none') {
                // Mode Pochette
                ui.visualizerCanvas.classList.add('hidden');
                ui.coverDisplay.classList.remove('hidden');
                
                const art = ui.coverDisplay.querySelector('.cover-art');
                
                // Si on a déjà la pochette en mémoire (via loadMedia), on l'utilise
                if (forcedCover) {
                    art.innerHTML = `<img src="${forcedCover}">`;
                } else if (currentCoverImage) {
                    art.innerHTML = `<img src="${currentCoverImage}">`;
                } else {
                    // Sinon on essaye de la chercher (fallback)
                    if (window.neoAPI && window.neoAPI.getMetadata) {
                        try {
                            const meta = await window.neoAPI.getMetadata(path);
                            if(meta && meta.cover) {
                                art.innerHTML = `<img src="${meta.cover}">`;
                                currentCoverImage = meta.cover; // Mise en cache
                            } else {
                                art.innerHTML = `<i class="ms-Icon ms-Icon--MusicInCollection"></i>`;
                            }
                        } catch(e) { art.innerHTML = `<i class="ms-Icon ms-Icon--MusicInCollection"></i>`; }
                    }
                }
            } else {
                // Mode Visualizer
                ui.coverDisplay.classList.add('hidden');
                ui.visualizerCanvas.classList.remove('hidden');
                if(!ui.video.paused) drawVisualizer();
            }
        }
    }

    // --- 7. CHARGEMENT FICHIER (AVEC FETCH POCHETTE) ---
    if(ui.openBtn) ui.openBtn.onclick = async () => { const path = await window.neoAPI.openFile(); if (path) { playlist.push({ path: path, name: path.split('\\').pop() }); updatePlaylistUI(); currentIndex = playlist.length - 1; loadMedia(path); } };
    
    async function loadMedia(path) {
        if(!path) return;
        isRadioMode = false;
        currentCoverImage = null; // Reset mémoire pochette

        ui.timeDisplay.innerHTML = `<span id="current-time">0:00</span> / <span id="total-time">0:00</span>`;
        ui.currentTime = document.getElementById('current-time'); ui.totalTime = document.getElementById('total-time');
        ui.slider.disabled = false; ui.slider.style.opacity = '1';
        let cleanPath = path.replace(/\\/g, '/'); if (!cleanPath.startsWith('file://')) cleanPath = 'file:///' + encodeURI(cleanPath);
        ui.video.crossOrigin = "anonymous"; ui.video.src = cleanPath;
        if(!audioCtx) initAudio();
        ui.video.style.display = 'block'; ui.placeholder.style.display = 'none';

        // 1. RECUPERATION DE LA METADONNEE (POCHETTE) UNE SEULE FOIS
        let coverFound = null;
        if (window.neoAPI && window.neoAPI.getMetadata) {
            try {
                const meta = await window.neoAPI.getMetadata(path);
                if (meta && meta.cover) {
                    coverFound = meta.cover;
                    currentCoverImage = meta.cover; // Sauvegarde globale
                }
            } catch (e) { console.log("Pas de metadata"); }
        }

        // 2. MISE A JOUR DU DOCK (PETIT CARRE)
        if (ui.dockCover) {
            if (coverFound) {
                ui.dockCover.innerHTML = `<img src="${coverFound}">`;
            } else {
                ui.dockCover.innerHTML = `<i class="ms-Icon ms-Icon--MusicInCollection"></i>`;
            }
        }

        // 3. MISE A JOUR DU MAIN DISPLAY (VISUALIZER OU POCHETTE)
        await handleVisualizerVisibility(path, coverFound);
        
        if(config.autoplay) { safePlay(); ui.playBtn.innerHTML = '<i class="ms-Icon ms-Icon--Pause"></i>'; }
        ui.trackTitle.innerText = path.split('\\').pop(); updatePlaylistUI(); switchTab('home');
    }

    function resetPlayer() {
        if (animationId) cancelAnimationFrame(animationId);
        if (ui.video) { ui.video.pause(); ui.video.removeAttribute('src'); ui.video.load(); ui.video.style.display = 'none'; }
        isRadioMode = false;
        currentCoverImage = null; // Clean
        
        if (ui.placeholder) ui.placeholder.style.display = 'flex'; ui.trackTitle.innerText = "Prêt à lire";
        if (ui.timeDisplay) { ui.timeDisplay.innerHTML = `<span id="current-time">0:00</span> / <span id="total-time">0:00</span>`; ui.currentTime = document.getElementById('current-time'); ui.totalTime = document.getElementById('total-time'); }
        if (ui.slider) { ui.slider.value = 0; updateSliderStyle(ui.slider); }
        if (ui.playBtn) ui.playBtn.innerHTML = '<i class="ms-Icon ms-Icon--Play"></i>';
        if (ui.coverDisplay) ui.coverDisplay.classList.add('hidden');
        if (ui.visualizerCanvas) ui.visualizerCanvas.classList.add('hidden');
        if (ui.dockCover) ui.dockCover.innerHTML = `<i class="ms-Icon ms-Icon--MusicInCollection"></i>`; // Reset Dock Icon
        
        document.querySelectorAll('.radio-card').forEach(c => c.classList.remove('playing'));
    }

    // --- 8. MENU CONTEXTUEL ---
    function initContextMenu() {
        if (!ui.contextMenu) return;
        document.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            const options = [ { label: 'Pochette', val: 'none' }, { type: 'divider' }, { label: 'Spectre', val: 'spectrum' }, { label: 'Barres', val: 'bars' }, { label: 'Nébuleuse', val: 'nebula' } ];
            ui.contextMenu.innerHTML = '';
            options.forEach(opt => {
                if (opt.type === 'divider') { const div = document.createElement('div'); div.className = 'ctx-divider'; ui.contextMenu.appendChild(div); } 
                else {
                    const item = document.createElement('div'); item.className = 'ctx-item'; item.textContent = opt.label;
                    if (config.vizStyle === opt.val) item.classList.add('active-item');
                    item.onclick = () => {
                        config.vizStyle = opt.val; saveConfig();
                        if (ui.vizSelect) ui.vizSelect.value = opt.val;
                        if (!ui.video.paused && ui.video.src) { handleVisualizerVisibility(ui.video.src, currentCoverImage); drawVisualizer(); } 
                        else if (ui.video.src) { handleVisualizerVisibility(ui.video.src, currentCoverImage); }
                        ui.contextMenu.style.display = 'none';
                    };
                    ui.contextMenu.appendChild(item);
                }
            });
            let x = e.pageX; let y = e.pageY;
            if (x + 180 > window.innerWidth) x = window.innerWidth - 180; if (y + 200 > window.innerHeight) y = window.innerHeight - 200;
            ui.contextMenu.style.left = `${x}px`; ui.contextMenu.style.top = `${y}px`; ui.contextMenu.style.display = 'block';
        });
        document.addEventListener('click', () => { ui.contextMenu.style.display = 'none'; });
    }

    // --- 9. EXPLORER, CONTROLS, SHORTCUTS (Included) ---
    function playNext() { if (playlist.length === 0) return; if (isShuffle) { let newIndex = Math.floor(Math.random() * playlist.length); if (playlist.length > 1 && newIndex === currentIndex) newIndex = (newIndex + 1) % playlist.length; currentIndex = newIndex; } else { if (currentIndex < playlist.length - 1) currentIndex++; else { if (isLoop) currentIndex = 0; else return; } } loadMedia(playlist[currentIndex].path); }
    function playPrev() { if (playlist.length === 0) return; if (ui.video.currentTime > 3) { ui.video.currentTime = 0; return; } if (currentIndex > 0) currentIndex--; else currentIndex = playlist.length - 1; loadMedia(playlist[currentIndex].path); }
    if (ui.nextBtn) ui.nextBtn.onclick = () => playNext(); if (ui.prevBtn) ui.prevBtn.onclick = () => playPrev();
    if (ui.shuffleBtn) ui.shuffleBtn.onclick = () => { isShuffle = !isShuffle; ui.shuffleBtn.classList.toggle('active', isShuffle); showToast(isShuffle ? "Aléatoire : ON" : "Aléatoire : OFF"); };
    if (ui.loopBtn) ui.loopBtn.onclick = () => { isLoop = !isLoop; ui.loopBtn.classList.toggle('active', isLoop); showToast(isLoop ? "Boucle : ON" : "Boucle : OFF"); };
    if (ui.speedBtn) { ui.speedBtn.onclick = () => { speedIndex = (speedIndex + 1) % speeds.length; const newSpeed = speeds[speedIndex]; if (ui.video) ui.video.playbackRate = newSpeed; ui.speedBtn.innerText = newSpeed + "x"; showToast(`Vitesse : ${newSpeed}x`); }; }
    if (ui.fullBtn) { ui.fullBtn.onclick = () => { if (!ui.mediaContainer) return; if (!document.fullscreenElement) { ui.mediaContainer.requestFullscreen().catch(err => console.error(err)); ui.fullBtn.innerHTML = '<i class="ms-Icon ms-Icon--BackToWindow"></i>'; } else { document.exitFullscreen(); ui.fullBtn.innerHTML = '<i class="ms-Icon ms-Icon--FullScreen"></i>'; } }; }
    document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement) { ui.fullBtn.innerHTML = '<i class="ms-Icon ms-Icon--FullScreen"></i>'; if (typeof resizeCanvas === 'function') resizeCanvas(); } else { if (typeof resizeCanvas === 'function') resizeCanvas(); } });
    function updateSliderStyle(s) { if (!s || !s.max) return; const val = s.value ? parseFloat(s.value) : 0; const min = s.min ? parseFloat(s.min) : 0; const max = s.max ? parseFloat(s.max) : 100; const percentage = ((val - min) * 100) / (max - min); s.style.backgroundSize = `${percentage}% 100%`; }
    if(ui.video) { ui.video.ontimeupdate = () => { if(!isRadioMode) { if(!ui.slider.matches(':active')) { ui.slider.value = ui.video.currentTime; updateSliderStyle(ui.slider); } ui.currentTime.textContent = formatTime(ui.video.currentTime); } }; ui.video.onloadedmetadata = () => { if(!isRadioMode && ui.video.duration) { ui.slider.max = ui.video.duration; ui.totalTime.textContent = formatTime(ui.video.duration); updateSliderStyle(ui.slider); } }; ui.video.onended = () => { if (!isRadioMode) { if (!isLoop && !isShuffle && currentIndex === playlist.length - 1) { ui.playBtn.innerHTML = '<i class="ms-Icon ms-Icon--Play"></i>'; return; } playNext(); } }; }
    if(ui.slider) { ui.slider.oninput = () => { ui.video.currentTime = ui.slider.value; updateSliderStyle(ui.slider); }; }
    if(ui.muteBtn) { ui.muteBtn.onclick = () => { if(ui.video.muted) { ui.video.muted = false; ui.muteBtn.innerHTML = '<i class="ms-Icon ms-Icon--Volume3"></i>'; ui.muteBtn.classList.remove('active'); } else { ui.video.muted = true; ui.muteBtn.innerHTML = '<i class="ms-Icon ms-Icon--Volume0"></i>'; ui.muteBtn.classList.add('active'); } }; }
    const seekContainer = document.querySelector('.seek-integrated'); const timeTooltip = document.getElementById('time-tooltip'); if(seekContainer && timeTooltip) { seekContainer.addEventListener('mousemove', (e) => { const rect = seekContainer.getBoundingClientRect(); const percent = (e.clientX - rect.left) / rect.width; const timeAtCursor = percent * ui.video.duration; const tooltipPos = Math.max(0, Math.min(rect.width, (e.clientX - rect.left))); timeTooltip.style.left = `${tooltipPos}px`; if(!isNaN(timeAtCursor)) timeTooltip.innerText = formatTime(timeAtCursor); }); }
    async function loadExplorer(path) { if(!window.neoAPI) return; if(!path) path = await window.neoAPI.getHomePath(); if(ui.explorerSearch) ui.explorerSearch.value = ""; currentExplorerPath = path; if(config.rememberFolder) { config.lastFolder = path; saveConfig(); } ui.explorerPath.textContent = path; const res = await window.neoAPI.readDir(path); if(res && res.success) { ui.explorerList.innerHTML = ''; const sortedFiles = res.files.sort((a, b) => { if (a.isDirectory === b.isDirectory) return a.name.localeCompare(b.name); return a.isDirectory ? -1 : 1; }); sortedFiles.forEach(f => { const el = document.createElement('div'); el.dataset.name = f.name.toLowerCase(); if (f.isDirectory) { el.className = 'explorer-item is-folder'; el.innerHTML = `<i class="ms-Icon ms-Icon--FabricFolderFill"></i><span>${f.name}</span>`; el.onclick = () => loadExplorer(f.path); } else { el.className = 'explorer-item is-file'; el.innerHTML = `<i class="ms-Icon ms-Icon--MusicInCollection"></i><span>${f.name}</span>`; el.onclick = () => { playlist.push({path: f.path, name: f.name}); updatePlaylistUI(); if (playlist.length === 1) { currentIndex = 0; loadMedia(f.path); } showToast(`Ajouté : ${f.name}`); }; } ui.explorerList.appendChild(el); }); } }
    if (ui.explorerSearch) { ui.explorerSearch.addEventListener('input', (e) => { const filter = e.target.value.toLowerCase(); const items = ui.explorerList.getElementsByClassName('explorer-item'); Array.from(items).forEach(item => { const name = item.querySelector('span').textContent.toLowerCase(); if (name.includes(filter)) item.style.display = 'flex'; else item.style.display = 'none'; }); }); }
    ui.playFolderBtn.onclick = async () => { const res = await window.neoAPI.getFolderFiles(currentExplorerPath); if(res.success && res.files.length) { playlist = playlist.concat(res.files); updatePlaylistUI(); if(playlist.length === res.files.length) { currentIndex=0; loadMedia(playlist[0].path); } showToast(`${res.files.length} ajoutés`); } };
    ui.explorerUp.onclick = () => loadExplorer(); async function checkDrives() { const drives = await window.neoAPI.getDrives(); ui.drivesList.innerHTML = ''; drives.forEach(d => { if(!d.isSystem) { const el = document.createElement('div'); el.className = 'drive-capsule'; el.innerHTML = `<i class="ms-Icon ms-Icon--HardDrive"></i><span>${d.label}</span>`; el.onclick = () => loadExplorer(d.mount + '/'); ui.drivesList.appendChild(el); } }); } ui.refreshDrivesBtn.onclick = checkDrives;
    function updatePlaylistUI() { if (!ui.playlist) return; ui.playlist.innerHTML = ''; playlist.forEach((track, index) => { const li = document.createElement('li'); li.className = 'playlist-item'; if (index === currentIndex) li.classList.add('active'); const nameSpan = document.createElement('span'); nameSpan.textContent = track.name; nameSpan.onclick = () => { currentIndex = index; loadMedia(track.path); }; const removeBtn = document.createElement('button'); removeBtn.className = 'icon-btn'; removeBtn.innerHTML = '<i class="ms-Icon ms-Icon--Cancel"></i>'; removeBtn.onclick = (e) => { e.stopPropagation(); playlist.splice(index, 1); if (playlist.length === 0) { resetPlayer(); } else { if (index < currentIndex) currentIndex--; } updatePlaylistUI(); }; li.appendChild(nameSpan); li.appendChild(removeBtn); ui.playlist.appendChild(li); }); }
    if(ui.clearBtn) ui.clearBtn.onclick = () => { playlist = []; updatePlaylistUI(); resetPlayer(); showToast("Playlist vidée"); };
    function renderShortcutsUI() { if (!ui.shortcutsList) return; ui.shortcutsList.innerHTML = ''; if(!config.shortcuts) return; for (const [action, data] of Object.entries(config.shortcuts)) { const row = document.createElement('div'); row.className = 'shortcut-row'; const label = document.createElement('span'); label.className = 'shortcut-label'; label.textContent = data.label; const btn = document.createElement('button'); btn.className = 'key-btn'; btn.textContent = formatKeyName(data.key); btn.onclick = () => startRecordingKey(action, btn); row.appendChild(label); row.appendChild(btn); ui.shortcutsList.appendChild(row); } }
    function formatKeyName(key) { if(key === ' ') return 'SPACE'; if(key.startsWith('Arrow')) return key.replace('Arrow', 'FLÈCHE '); if(key.startsWith('Key')) return key.replace('Key', ''); return key.toUpperCase(); }
    function startRecordingKey(action, btnElement) { btnElement.textContent = '...'; btnElement.classList.add('recording'); const handler = (e) => { e.preventDefault(); e.stopPropagation(); if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) return; config.shortcuts[action].key = e.key; config.shortcuts[action].code = e.code; saveConfig(); btnElement.classList.remove('recording'); btnElement.textContent = formatKeyName(e.key); showToast(`Raccourci modifié`); document.removeEventListener('keydown', handler, true); }; document.addEventListener('keydown', handler, true); }
    function setupGlobalShortcuts() { document.addEventListener('keydown', (e) => { if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return; const s = config.shortcuts; if(!s) return; const code = e.code; if (s.play && code === s.play.code) { e.preventDefault(); togglePlay(); } if (s.next && code === s.next.code) { e.preventDefault(); ui.nextBtn.click(); } if (s.prev && code === s.prev.code) { e.preventDefault(); ui.prevBtn.click(); } if (s.vol_up && code === s.vol_up.code) { e.preventDefault(); ui.volSlider.value = Math.min(100, parseInt(ui.volSlider.value) + 5); updateSliderStyle(ui.volSlider); if(ui.video) ui.video.volume = ui.volSlider.value / 100; } if (s.vol_down && code === s.vol_down.code) { e.preventDefault(); ui.volSlider.value = Math.max(0, parseInt(ui.volSlider.value) - 5); updateSliderStyle(ui.volSlider); if(ui.video) ui.video.volume = ui.volSlider.value / 100; } if (s.mute && code === s.mute.code) { e.preventDefault(); ui.muteBtn.click(); } if (s.fullscreen && code === s.fullscreen.code) { e.preventDefault(); ui.fullBtn.click(); } if (s.shuffle && code === s.shuffle.code) { e.preventDefault(); ui.shuffleBtn.click(); } if (s.loop && code === s.loop.code) { e.preventDefault(); ui.loopBtn.click(); } }); }
    if (ui.checkUpdateBtn) { ui.checkUpdateBtn.onclick = () => { ui.updateStatus.innerHTML = '<span style="color:#aaa;">Recherche...</span>'; ui.checkUpdateBtn.disabled = true; ui.checkUpdateBtn.style.opacity = '0.5'; setTimeout(() => { const isUpdate = Math.random() > 0.8; if (isUpdate) { ui.updateStatus.innerHTML = '<span style="color:var(--accent);">v1.1.0 disponible !</span>'; showToast("Mise à jour disponible"); } else { ui.updateStatus.innerHTML = '<span style="color:#4caf50;">À jour.</span>'; showToast("Aucune mise à jour"); } ui.checkUpdateBtn.disabled = false; ui.checkUpdateBtn.style.opacity = '1'; }, 2000); }; }
    function applyThemePreset(name) { if (!themesData[name]) return; const theme = themesData[name]; document.documentElement.style.setProperty('--accent', theme.color); document.documentElement.style.setProperty('--accent-glow', theme.color + "66"); if(name !== 'custom') { document.body.style.backgroundImage = theme.bg; document.body.style.backgroundSize = "cover"; } ui.themePresets.forEach(p => p.classList.remove('active')); const activeEl = document.querySelector(`.theme-preset[data-theme="${name}"]`); if(activeEl) activeEl.classList.add('active'); if(ui.slider) updateSliderStyle(ui.slider); if(ui.volSlider) updateSliderStyle(ui.volSlider); config.themeName = name; saveConfig(); }
    ui.themePresets.forEach(preset => { preset.onclick = async () => { const name = preset.dataset.theme; if(name === 'custom' && window.neoAPI) { const path = await window.neoAPI.selectBackground(); if(path) { config.bgImage = `file://${path.replace(/\\/g, "/")}`; document.body.style.backgroundImage = `url('${config.bgImage}')`; applyThemePreset('custom'); } } else { config.bgImage = 'default'; applyThemePreset(name); } }; });
    if(ui.min) ui.min.onclick = () => window.neoAPI.minimize(); if(ui.max) ui.max.onclick = () => window.neoAPI.maximize(); if(ui.close) ui.close.onclick = () => window.neoAPI.close();
    function showToast(msg) { const t = document.createElement('div'); t.className = 'toast'; t.innerText = msg; ui.toastContainer.appendChild(t); setTimeout(() => t.remove(), 3000); }
    function formatTime(s) { if(!s || isNaN(s)) return "0:00"; const m=Math.floor(s/60), sc=Math.floor(s%60); return `${m}:${sc<10?'0'+sc:sc}`; }
    function updateClock() { const now=new Date(); document.getElementById('sys-time').innerText = now.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}); } setInterval(updateClock, 1000); updateClock();
    function initBattery() { const batEl = document.getElementById('battery-level'); const batIcon = document.getElementById('battery-icon'); if (navigator.getBattery) { navigator.getBattery().then(battery => { function update() { const level = battery.level; const pct = Math.round(level * 100); if (batEl) batEl.innerText = pct + "%"; if (batIcon) { const color = (pct < 20 && !battery.charging) ? '#ff4757' : 'currentColor'; const fillWidth = level * 14; const chargingIcon = battery.charging ? `<path d="M8 0a.5.5 0 0 1 .5.5V3h2a.5.5 0 0 1 .4.8l-4 5a.5.5 0 0 1-.9-.4V6H4a.5.5 0 0 1-.4-.8l4-5A.5.5 0 0 1 8 0z" transform="translate(4, 3)" fill="${color}"/>` : ''; batIcon.innerHTML = `<svg width="24" height="12" viewBox="0 0 24 12" fill="none" xmlns="http://www.w3.org/2000/svg" style="display:block;"><rect x="1" y="1" width="18" height="10" rx="2" stroke="${color}" stroke-width="1.5"/><path d="M22 4h-1v4h1a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1z" fill="${color}"/><rect x="3" y="3" width="${fillWidth}" height="6" rx="1" fill="${color}"/>${chargingIcon}</svg>`; } } update(); battery.addEventListener('levelchange', update); battery.addEventListener('chargingchange', update); }); } else { if (batEl) batEl.innerText = "100%"; if (batIcon) batIcon.innerHTML = `<svg width="24" height="12" viewBox="0 0 24 12"><rect x="1" y="1" width="18" height="10" rx="2" stroke="currentColor" stroke-width="1.5"/><rect x="3" y="3" width="14" height="6" rx="1" fill="currentColor"/><path d="M22 4h-1v4h1a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1z" fill="currentColor"/></svg>`; } } initBattery();
    async function loadAudioDevices() { if (!ui.audioSelect) return; ui.audioSelect.innerHTML = '<option value="default">Défaut</option>'; try { const devices = await navigator.mediaDevices.enumerateDevices(); const audioOutputs = devices.filter(device => device.kind === 'audiooutput'); audioOutputs.forEach(device => { if (device.deviceId !== 'default') { const option = document.createElement('option'); option.value = device.deviceId; option.text = device.label || `Haut-parleur`; ui.audioSelect.appendChild(option); } }); ui.audioSelect.value = config.audioDeviceId; changeAudioOutput(config.audioDeviceId); } catch (err) { } }
    async function changeAudioOutput(deviceId) { if (!ui.video) return; try { await ui.video.setSinkId(deviceId); } catch (e) {} }
    if(ui.audioSelect) { ui.audioSelect.onchange = () => { config.audioDeviceId = ui.audioSelect.value; saveConfig(); changeAudioOutput(ui.audioSelect.value); showToast("Sortie audio modifiée"); }; }
    function renderRadioGrid() { if(!ui.radioGrid) return; ui.radioGrid.innerHTML = ''; radios.forEach(radio => { const card = document.createElement('div'); card.className = 'radio-card'; card.innerHTML = `<div class="radio-icon-circle">${radio.icon}</div><div class="radio-name">${radio.name}</div>`; card.onclick = () => playRadio(radio); ui.radioGrid.appendChild(card); }); }
    function playRadio(radio) { playlist = []; updatePlaylistUI(); isRadioMode = true; ui.video.crossOrigin = "anonymous"; ui.video.src = radio.url; if(!audioCtx) initAudio(); if(audioCtx && audioCtx.state === 'suspended') audioCtx.resume(); safePlay(); ui.video.style.display = 'block'; ui.placeholder.style.display = 'none'; ui.trackTitle.innerText = radio.name; ui.timeDisplay.innerHTML = `<span class="live-badge"><div class="live-dot"></div> DIRECT</span>`; ui.slider.disabled = true; ui.playBtn.innerHTML = '<i class="ms-Icon ms-Icon--Stop"></i>'; switchTab('home'); showToast(`Radio : ${radio.name}`); }

    loadConfig();
});