// ==UserScript==
// @name         YouTube + Twitch Timestamp Notes
// @namespace    yt-notes
// @version      1.1.0
// @match        https://www.youtube.com/watch*
// @match        https://www.twitch.tv/videos/*
// @match        https://www.twitch.tv/*
// @grant        GM_getValue
// @grant        GM_setValue
// ==/UserScript==

(function () {
    'use strict';

    let startTime = null;
    let mode = 'capture';
    let currentNotesCollapsed = false;

    const currentNoteRows = new Map();
    let lastRenderedVid = null;
    let lastRenderedNoteCount = 0;

    // ---------------- SITE DETECTION ----------------
    // Returns fresh site info on every call — safe for SPA navigation.
    function getSite() {
        const host = location.hostname;

        if (host.includes('youtube.com')) {
            return {
                type: 'youtube',
                getVideo: () => document.querySelector('video'),
                getVideoId: () => new URL(location.href).searchParams.get('v'),
                getTitle: () => document.title,
                getCurrentTime: () => document.querySelector('video')?.currentTime ?? 0,
            };
        }

        if (host.includes('twitch.tv')) {
            const vodMatch = location.pathname.match(/\/videos\/(\d+)/);
            const vodId = vodMatch ? vodMatch[1] : null;
            const channel = location.pathname.split('/').filter(Boolean)[0] || null;

            return {
                type: 'twitch',
                getVideo: () => document.querySelector('video'),
                getVideoId: () => vodId ? `vod:${vodId}` : (channel ? `live:${channel}` : null),
                getTitle: () => document.title,
                getCurrentTime: () => document.querySelector('video')?.currentTime ?? 0,
            };
        }

        return null;
    }

    // Convenience wrappers — always use fresh getSite()
    function getVideo() {
        return getSite()?.getVideo();
    }
    function getVideoId() {
        return getSite()?.getVideoId();
    }
    function getCurrentTime() {
        return getSite()?.getCurrentTime() ?? 0;
    }

    // ---------------- NAVIGATION ----------------
    // Routes by the note's vid prefix, NOT by current site.
    // This fixes cross-site "go" (e.g. clicking a Twitch note while on YouTube).
    function goToNote(note, vid) {
        const currentVid = getVideoId();

        // Same video — just seek
        if (currentVid === vid) {
            const v = getVideo();
            if (v) v.currentTime = note.start;

            return;
        }

        // YouTube video id: plain string with no prefix
        if (!vid.startsWith('vod:') && !vid.startsWith('live:')) {
            window.open(
                `https://www.youtube.com/watch?v=${vid}&t=${Math.floor(note.start)}s`,
                '_blank'
            );

            return;
        }

        // Twitch VOD
        if (vid.startsWith('vod:')) {
            const id = vid.replace('vod:', '');
            const sec = Math.floor(note.start);
            const h = Math.floor(sec / 3600);
            const m = Math.floor((sec % 3600) / 60);
            const s = sec % 60;
            const ts = `${h}h${String(m).padStart(2, '0')}m${String(s).padStart(2, '0')}s`;
            window.open(`https://www.twitch.tv/videos/${id}?t=${ts}`, '_blank');

            return;
        }

        // Twitch live — can't seek, just open the channel
        if (vid.startsWith('live:')) {
            window.open(`https://www.twitch.tv/${vid.replace('live:', '')}`, '_blank');
        }
    }

    // ---------------- STORAGE ----------------
    function getNotes() {
        return GM_getValue('ytNotes', {});
    }

    function saveNotes(d) { GM_setValue('ytNotes', d); }

    // ---------------- HELPERS ----------------
    function formatTime(sec) {
        sec = Math.floor(sec);
        const h = Math.floor(sec / 3600);
        const m = Math.floor((sec % 3600) / 60);
        const s = sec % 60;

        return [h, m, s].map(v => String(v).padStart(2, '0')).join(':');
    }

    function generateId() {
        // Combines timestamp + random suffix to avoid same-millisecond collisions
        return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    }

    // ---------------- FEEDBACK ----------------
    function tip(msg) {
        const d = document.createElement('div');
        d.textContent = msg;
        d.style.cssText = `
            position:absolute;
            top:-24px;
            left:0;
            width:100%;
            background:#ff0;
            color:#000;
            text-align:center;
            padding:2px;
            border-radius:4px;
        `;
        panel.appendChild(d);
        setTimeout(() => d.remove(), 1200);
    }

    // ---------------- SAVE NOTE ----------------
    function saveNote(end, text, tags) {
        const vid = getVideoId();
        const site = getSite();

        if (!vid) {
            tip('Not a video page');

            return;
        }

        const data = getNotes(); // always fresh

        if (!data[vid]) {
            data[vid] = {
                site: site?.type || 'unknown',
                title: site?.getTitle() || document.title, // read dynamically
                url: location.href,
                created: new Date().toISOString(),
                notes: []
            };
        }

        data[vid].notes.push({
            id: generateId(),  // collision-safe ID
            site: site?.type,
            start: startTime,
            end,
            text,
            tags,
            created: new Date().toISOString()
        });

        saveNotes(data);
        startTime = null;
        renderCurrentVideoNotes();
    }

    // ---------------- UI CONSTRUCTION ----------------
    function makeLink(text) {
        const el = document.createElement('span');
        el.textContent = text;
        el.style.cssText = `
            color:#6cf;
            cursor:pointer;
            text-decoration:underline;
            margin-right:10px;
            user-select:none;
        `;

        return el;
    }

    const UI_FONT_SIZE = '14px';
    function applyUIFont(el) {
        el.style.fontSize = UI_FONT_SIZE;
    }

    const panel = document.createElement('div');
    panel.style.cssText = `
        position:fixed;
        top:80px;
        right:20px;
        width:380px;
        background:#1e1e1e;
        color:white;
        z-index:999999;
        padding:10px;
        border-radius:8px;
        font-family:sans-serif;
        display:none;
    `;

    const header = document.createElement('div');
    header.textContent = 'Video Notes';
    header.style.cssText = 'font-weight:bold;cursor:move;margin-bottom:6px;';

    const startBtn = makeLink('start');
    const saveBtn = makeLink('save');
    const toggleMode = makeLink('view');
    const exportAllBtn = makeLink('export all');
    const importAllBtn = makeLink('import');
    const clearAllBtn = makeLink('clear all');

    const ta = document.createElement('textarea');
    ta.style.cssText = 'width:100%;height:50px;margin-top:6px;box-sizing:border-box;';

    const tagInput = document.createElement('input');
    tagInput.placeholder = 'tags (comma separated)';
    tagInput.style.cssText = 'width:100%;margin-top:6px;box-sizing:border-box;';

    const search = document.createElement('input');
    search.placeholder = 'search...';
    search.style.cssText = 'width:100%;margin-top:6px;box-sizing:border-box;';

    const list = document.createElement('div');
    list.style.cssText = 'max-height:320px;overflow-y:auto;margin-top:6px;';

    const currentNotes = document.createElement('div');
    currentNotes.style.cssText = `
        margin-top:10px;
        max-height:220px;
        overflow-y:auto;
        border-top:1px solid #333;
        padding-top:6px;
        font-size:12px;
    `;

    // Hidden file input for import — never shown directly, triggered by importAllBtn
    const importFileInput = document.createElement('input');
    importFileInput.type = 'file';
    importFileInput.accept = '.json';
    importFileInput.style.display = 'none';

    applyUIFont(header);
    applyUIFont(startBtn);
    applyUIFont(saveBtn);
    applyUIFont(toggleMode);
    applyUIFont(exportAllBtn);
    applyUIFont(clearAllBtn);
    applyUIFont(importAllBtn);
    applyUIFont(ta);
    applyUIFont(tagInput);
    applyUIFont(search);
    applyUIFont(list);
    applyUIFont(currentNotes);
    panel.appendChild(header);
    panel.appendChild(toggleMode);
    panel.appendChild(exportAllBtn);
    panel.appendChild(importAllBtn);
    panel.appendChild(importFileInput);
    panel.appendChild(clearAllBtn);
    panel.appendChild(startBtn);
    panel.appendChild(saveBtn);
    panel.appendChild(ta);
    panel.appendChild(tagInput);
    panel.appendChild(search);
    panel.appendChild(list);
    panel.appendChild(currentNotes);
    document.body.appendChild(panel);

    // Floating toggle button
    const btn = document.createElement('button');
    btn.textContent = '☰';
    btn.style.cssText = `
        position:fixed;
        top:80px;
        right:20px;
        z-index:1000000;
        background:#f33;
        color:white;
        padding:6px;
        border-radius:4px;
        border:none;
        cursor:pointer;
    `;
    document.body.appendChild(btn);

    btn.onclick = () => {
        panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
        if (panel.style.display === 'block') render();
    };

    // ---------------- DRAG ----------------
    let drag = false, ox = 0, oy = 0;

    header.onmousedown = (e) => {
        drag = true;
        ox = e.clientX - panel.offsetLeft;
        oy = e.clientY - panel.offsetTop;
    };
    document.addEventListener('mousemove', (e) => {
        if (!drag) return;

        panel.style.left = (e.clientX - ox) + 'px';
        panel.style.top = (e.clientY - oy) + 'px';
        panel.style.right = 'auto';
    });
    document.addEventListener('mouseup', () => { drag = false; });

    // ---------------- URL CHANGE DETECTION ----------------
    let lastUrl = location.href;

    const observePageChanges = () => {
        const observer = new MutationObserver(() => {
            if (location.href === lastUrl) return;

            lastUrl = location.href;

            // Reset capture state on navigation
            startTime = null;

            // Force full re-render of current-video pane
            lastRenderedVid = null;
            currentNoteRows.clear();
            currentNotes.textContent = '';

            setTimeout(() => {
                if (panel.style.display !== 'none') render();
            }, 500);
        });
        observer.observe(document.body, { childList: true, subtree: true });
    };
    observePageChanges();

    // Lightweight polling: only re-render if note count changed
    setInterval(() => {
        if (panel.style.display === 'none' || mode !== 'capture') return;

        const vid = getVideoId();
        if (!vid) return;

        const data = getNotes();
        const noteCount = data[vid]?.notes?.length ?? 0;

        if (noteCount !== lastRenderedNoteCount || vid !== lastRenderedVid) {
            lastRenderedNoteCount = noteCount;
            renderCurrentVideoNotes();
        }
    }, 1000);

    // ---------------- RENDER (view mode) ----------------
    function render() {
        const isCapture = mode === 'capture';

        currentNotes.style.display = isCapture ? 'block' : 'none';
        startBtn.style.display = isCapture ? 'inline' : 'none';
        saveBtn.style.display = isCapture ? 'inline' : 'none';
        ta.style.display = isCapture ? 'block' : 'none';
        tagInput.style.display = isCapture ? 'block' : 'none';

        exportAllBtn.style.display = !isCapture ? 'inline' : 'none';
        importAllBtn.style.display = !isCapture ? 'inline' : 'none';
        clearAllBtn.style.display = !isCapture ? 'inline' : 'none';
        search.style.display = !isCapture ? 'block' : 'none';
        list.style.display = !isCapture ? 'block' : 'none';

        if (isCapture) {
            renderCurrentVideoNotes();

            return;
        }

        renderViewMode();
    }

    function renderViewMode() {
        while (list.firstChild) list.removeChild(list.firstChild);

        const data = getNotes();
        const q = search.value.toLowerCase();

        Object.entries(data).forEach(([vid, v]) => {
            const group = document.createElement('div');
            group.style.cssText = 'border:1px solid #333;margin-bottom:8px;padding:4px;';

            const titleBar = document.createElement('div');
            titleBar.textContent = v.title;
            titleBar.style.cssText = 'font-weight:bold;cursor:pointer;background:#333;padding:3px;';

            // Per-video clear
            const clearVid = document.createElement('span');
            clearVid.textContent = ' clear';
            clearVid.style.cssText = 'color:#f88;cursor:pointer;margin-left:6px;';
            clearVid.onclick = (e) => {
                e.stopPropagation();
                if (!confirm('Delete all notes for this video?')) return;
                const d = getNotes(); // fresh read
                delete d[vid];
                saveNotes(d);
                renderViewMode();
            };

            // Per-video export
            const exportVid = document.createElement('span');
            exportVid.textContent = ' export';
            exportVid.style.cssText = 'color:#0af;cursor:pointer;margin-left:6px;';
            exportVid.onclick = (e) => {
                e.stopPropagation();
                const blob = new Blob([JSON.stringify(v, null, 2)], { type: 'application/json' });
                const a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = `yt-notes-${vid.replace(/[^a-z0-9]/gi, '_')}.json`;
                a.click();
                URL.revokeObjectURL(a.href);
            };

            titleBar.appendChild(clearVid);
            titleBar.appendChild(exportVid);

            let collapsed = false;
            const box = document.createElement('div');

            titleBar.onclick = () => {
                collapsed = !collapsed;
                box.style.display = collapsed ? 'none' : 'block';
            };

            (v.notes || []).forEach((n, i) => {
                const match =
                    (n.text || '').toLowerCase().includes(q) ||
                    (n.tags || []).join(',').toLowerCase().includes(q);
                if (!match) return;

                const row = document.createElement('div');
                row.style.cssText = 'margin:6px 0;padding:4px;border-bottom:1px solid #222;';

                const top = document.createElement('div');
                const time = document.createElement('span');
                time.textContent = `${formatTime(n.start)} → ${formatTime(n.end)} `;

                const go = document.createElement('span');
                go.textContent = 'go';
                go.style.cssText = 'color:#0af;cursor:pointer;margin-left:6px;';
                go.onclick = () => goToNote(n, vid);

                const edit = document.createElement('span');
                edit.textContent = ' edit';
                edit.style.cssText = 'color:#ff0;cursor:pointer;margin-left:6px;';
                edit.onclick = () => {
                    const nt = prompt('Edit text', n.text);
                    if (nt === null) return;

                    const tg = prompt('Tags', (n.tags || []).join(','));

                    // Always read fresh before writing
                    const d = getNotes();
                    const note = d[vid]?.notes?.[i];
                    if (!note) return;

                    note.text = nt;
                    note.tags = tg ? tg.split(',').map(t => t.trim()).filter(Boolean) : [];
                    saveNotes(d);
                    renderViewMode();
                };

                const del = document.createElement('span');
                del.textContent = ' del';
                del.style.cssText = 'color:#f55;cursor:pointer;margin-left:6px;';
                del.onclick = () => {
                    if (!confirm('Delete this note?')) return;

                    const d = getNotes(); // fresh read
                    d[vid]?.notes?.splice(i, 1);
                    saveNotes(d);
                    renderViewMode();
                };

                top.appendChild(time);
                top.appendChild(go);
                top.appendChild(edit);
                top.appendChild(del);

                const textEl = document.createElement('div');
                textEl.textContent = n.text;
                textEl.style.cssText = 'color:#ccc;margin-top:2px;';

                row.appendChild(top);
                row.appendChild(textEl);
                box.appendChild(row);
            });

            group.appendChild(titleBar);
            group.appendChild(box);
            list.appendChild(group);
        });
    }

    // ---------------- RENDER (current video notes) ----------------
    function renderCurrentVideoNotes() {
        const vid = getVideoId();

        // If no video, wipe and bail
        if (!vid) {
            currentNotes.textContent = '';
            currentNoteRows.clear();
            lastRenderedVid = null;

            return;
        }

        const data = getNotes();
        const videoData = data[vid];
        const notes = videoData?.notes ?? [];

        // Video changed — full reset
        if (lastRenderedVid !== vid) {
            currentNotes.textContent = '';
            currentNoteRows.clear();
            lastRenderedVid = null;
        }

        // Ensure header exists
        if (!currentNotes.querySelector('.cn-header')) {
            const hdr = document.createElement('div');
            hdr.className = 'cn-header';
            hdr.style.cssText = 'font-weight:bold;margin-bottom:6px;cursor:pointer;';
            hdr.onclick = () => {
                currentNotesCollapsed = !currentNotesCollapsed;
                renderCurrentVideoNotes();
            };
            currentNotes.appendChild(hdr);
        }

        const hdr = currentNotes.querySelector('.cn-header');
        hdr.textContent = currentNotesCollapsed
            ? '▶ Current Video Notes'
            : '▼ Current Video Notes';

        // After we know the header is safe, set lastRenderedVid
        lastRenderedVid = vid;

        if (currentNotesCollapsed) {
            // Hide all note rows but keep header
            for (const row of currentNoteRows.values()) row.style.display = 'none';

            return;
        }

        const now = getCurrentTime();
        const validIds = new Set();

        for (const n of notes) {
            // Use n.id (new field) with n.created as fallback for old notes
            const id = n.id ?? n.created;
            validIds.add(id);

            let row = currentNoteRows.get(id);

            if (!row) {
                row = document.createElement('div');
                row.style.cssText =
                    'margin-bottom:8px;padding-bottom:4px;border-bottom:1px solid #222;';

                const top = document.createElement('div');
                const timeEl = document.createElement('span');
                timeEl.className = 'time';

                const go = document.createElement('span');
                go.textContent = ' go';
                go.style.cssText = 'color:#0af;cursor:pointer;margin-left:6px;';
                go.onclick = (e) => {
                    e.stopPropagation();
                    goToNote(n, vid);
                };

                const edit = document.createElement('span');
                edit.textContent = ' edit';
                edit.style.cssText = 'color:#ff0;cursor:pointer;margin-left:6px;';
                edit.onclick = (e) => {
                    e.stopPropagation();
                    const nt = prompt('Edit text', n.text);
                    if (nt === null) return;

                    const tg = prompt('Tags', (n.tags || []).join(','));
                    const d = getNotes(); // fresh read
                    const note = d[vid]?.notes?.find(x => (x.id ?? x.created) === id);
                    if (!note) return;

                    note.text = nt;
                    note.tags = tg ? tg.split(',').map(t => t.trim()).filter(Boolean) : [];
                    saveNotes(d);
                    renderCurrentVideoNotes();
                };

                const del = document.createElement('span');
                del.textContent = ' del';
                del.style.cssText = 'color:#f55;cursor:pointer;margin-left:6px;';
                del.onclick = (e) => {
                    e.stopPropagation();
                    if (!confirm('Delete this note? This cannot be undone.')) return;

                    const d = getNotes(); // fresh read
                    const arr = d[vid]?.notes;
                    if (arr) {
                        const idx = arr.findIndex(x => (x.id ?? x.created) === id);
                        if (idx !== -1) arr.splice(idx, 1);
                    }
                    saveNotes(d);

                    row.remove();
                    currentNoteRows.delete(id);
                    renderCurrentVideoNotes();
                };

                const textEl = document.createElement('div');
                textEl.className = 'text';
                textEl.style.cssText = 'color:#ccc;margin-top:2px;';

                top.appendChild(timeEl);
                top.appendChild(go);
                top.appendChild(edit);
                top.appendChild(del);
                row.appendChild(top);
                row.appendChild(textEl);

                currentNotes.appendChild(row);
                currentNoteRows.set(id, row);
            }

            row.style.display = '';

            // Update mutable fields
            row.querySelector('.time').textContent = `${formatTime(n.start)} → ${formatTime(n.end)} `;
            row.querySelector('.text').textContent = n.text || '';
            row.style.background = (now >= n.start && now <= n.end) ? '#2a3a2a' : '';
        }

        // Remove rows for deleted notes
        for (const [id, row] of currentNoteRows.entries()) {
            if (!validIds.has(id)) {
                row.remove();
                currentNoteRows.delete(id);
            }
        }

        // If no notes left, clean up header too
        if (notes.length === 0) {
            currentNotes.textContent = '';
            currentNoteRows.clear();
        }
    }

    // ---------------- EVENTS ----------------
    startBtn.onclick = () => {
        const v = getVideo();
        if (!v || v.readyState < 2) {
            tip('Video not ready');

            return;
        }

        startTime = getCurrentTime();
        tip(`Start: ${formatTime(startTime)}`);
    };

    saveBtn.onclick = () => {
        if (startTime === null) {
            tip('Press Start first');

            return;
        }

        const end = getCurrentTime();
        saveNote(
            end,
            ta.value,
            (tagInput.value || '').split(',').map(t => t.trim()).filter(Boolean)
        );

        tip('Note saved');
        ta.value = '';
        tagInput.value = '';
    };

    toggleMode.onclick = () => {
        mode = mode === 'capture' ? 'view' : 'capture';
        // Clear startTime when leaving capture mode to prevent stale captures
        if (mode !== 'capture') startTime = null;
        toggleMode.textContent = mode === 'capture' ? 'view' : 'capture';
        render();
    };

    exportAllBtn.onclick = () => {
        const blob = new Blob([JSON.stringify(getNotes(), null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `yt-notes-all.json`;
        a.click();
        URL.revokeObjectURL(a.href);
    };

    clearAllBtn.onclick = () => {
        if (!confirm('Delete ALL notes from ALL videos? This cannot be undone.')) return;

        saveNotes({});
        render();
        tip('All notes cleared');
    };

    importAllBtn.onclick = () => importFileInput.click();

    importFileInput.onchange = () => {
        const file = importFileInput.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            let imported;
            try {
                imported = JSON.parse(e.target.result);
            } catch {
                tip('Invalid JSON file');

                return;
            }

            if (typeof imported !== 'object' || Array.isArray(imported)) {
                tip('Unrecognised format');

                return;
            }

            const existing = getNotes();
            let added = 0, merged = 0;

            for (const [vid, vidData] of Object.entries(imported)) {
                if (!vidData?.notes) continue;

                if (!existing[vid]) {
                    // Brand new video — import everything
                    existing[vid] = vidData;
                    added++;
                } else {
                    // Video already exists — merge notes by ID, skip duplicates
                    const existingIds = new Set(
                        existing[vid].notes.map(n => n.id ?? n.created)
                    );
                    for (const n of vidData.notes) {
                        const nId = n.id ?? n.created;
                        if (!existingIds.has(nId)) {
                            existing[vid].notes.push(n);
                            merged++;
                        }
                    }
                }
            }

            saveNotes(existing);
            render();
            tip(`Imported: ${added} new video(s), ${merged} merged note(s)`);

            // Reset so the same file can be imported again if needed
            importFileInput.value = '';
        };

        reader.readAsText(file);
    };

    // ---------------- KEYBOARD SHORTCUTS ----------------
    // Ctrl+Shift+N — start timestamp (Ctrl+N is reserved by browsers)
    // Ctrl+Shift+S — save note
    // Shortcuts only fire when the panel is open and in capture mode,
    // and only when focus is NOT inside another input/textarea on the page.
    document.addEventListener('keydown', (e) => {
        // Allow normal typing inside the note textarea and tag input
        const inOurInputs = (e.target === ta || e.target === tagInput);

        if (e.ctrlKey && e.shiftKey && e.key === 'N') {
            e.preventDefault();
            if (panel.style.display === 'none') {
                panel.style.display = 'block';
                render();
            }
            if (mode !== 'capture') {
                mode = 'capture';
                toggleMode.textContent = 'view';
                render();
            }
            startBtn.onclick();
            ta.focus();

            return;
        }

        if (e.ctrlKey && e.shiftKey && e.key === 'S') {
            // Allow Ctrl+Shift+S only from inside our panel or when nothing else is focused
            if (document.activeElement && !panel.contains(document.activeElement)
                && document.activeElement !== document.body) return;

            e.preventDefault();
            saveBtn.onclick();
        }
    });

    search.oninput = () => renderViewMode();

    // Init
    render();

})();