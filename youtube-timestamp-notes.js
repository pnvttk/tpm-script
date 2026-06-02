// ==UserScript==
// @name         YouTube Timestamp Notes v0.8.5
// @namespace    yt-notes
// @version      0.8.5
// @match        https://www.youtube.com/*
// @grant        GM_getValue
// @grant        GM_setValue
// ==/UserScript==

(function () {
    'use strict';

    let startTime = null;
    let mode = 'capture';

    // ---------------- STORAGE ----------------
    function getNotes() {
        return GM_getValue('ytNotes', {});
    }
    function saveNotes(d) {
        GM_setValue('ytNotes', d);
    }

    // ---------------- HELPERS ----------------
    function getVideo() {
        return document.querySelector('video');
    }

    function getVideoId() {
        return new URL(location.href).searchParams.get('v');
    }

    function formatTime(sec) {
        sec = Math.floor(sec);
        const h = Math.floor(sec / 3600);
        const m = Math.floor((sec % 3600) / 60);
        const s = sec % 60;

        return [h, m, s].map(v => String(v).padStart(2, '0')).join(':');
    }

    // ---------------- NAVIGATION ----------------
    function goToNote(n, vid) {
        const current = getVideoId();

        if (vid === current) {
            const v = getVideo();
            if (v) {
                v.currentTime = n.start;
            }
        } else {
            const url = `https://www.youtube.com/watch?v=${vid}&t=${Math.floor(n.start)}s`;

            window.open(url, '_blank');
        }
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
        font-size:11px;
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
        const data = getNotes();

        if (!data[vid]) {
            data[vid] = {
                title: document.title,
                url: location.href,
                notes: []
            };
        }

        data[vid].notes.push({
            start: startTime,
            end,
            text,
            tags,
            created: new Date().toISOString()
        });

        saveNotes(data);
        startTime = null;
        render();
    }

    // ---------------- UI ----------------
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
    header.textContent = 'YT Notes';
    header.style.cssText = 'font-weight:bold;cursor:move;margin-bottom:6px;';

    const toggleMode = document.createElement('button');
    toggleMode.textContent = 'Switch View';

    // capture mode
    const startBtn = document.createElement('button');
    startBtn.textContent = 'Start';

    const saveBtn = document.createElement('button');
    saveBtn.textContent = 'Save';

    const ta = document.createElement('textarea');
    ta.style.cssText = 'width:100%;height:50px;margin-top:6px;';

    const tag = document.createElement('input');
    tag.placeholder = 'tags (comma separated)';
    tag.style.cssText = 'width:100%;margin-top:6px;';

    // view mode
    const exportAllBtn = document.createElement('button');
    exportAllBtn.textContent = 'Export All';

    const clearAllBtn = document.createElement('button');
    clearAllBtn.textContent = 'Clear All';

    const search = document.createElement('input');
    search.placeholder = 'search...';
    search.style.cssText = 'width:100%;margin-top:6px;';

    const list = document.createElement('div');
    list.style.cssText = 'max-height:320px;overflow-y:auto;margin-top:6px;font-size:12px;';

    // ---------------- LAYOUT ----------------
    panel.appendChild(header);
    panel.appendChild(toggleMode);

    panel.appendChild(exportAllBtn);
    panel.appendChild(clearAllBtn);
    panel.appendChild(startBtn);
    panel.appendChild(saveBtn);
    panel.appendChild(ta);
    panel.appendChild(tag);
    panel.appendChild(search);
    panel.appendChild(list);

    document.body.appendChild(panel);

    // floating toggle button
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
`;
    document.body.appendChild(btn);

    btn.onclick = () => {
        panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
        render();
    };

    // ---------------- DRAG ----------------
    let drag = 0, ox = 0, oy = 0;
    header.onmousedown = e => {
        drag = 1;
        ox = e.clientX - panel.offsetLeft;
        oy = e.clientY - panel.offsetTop;
    };
    document.onmousemove = e => {
        if (!drag) return;
        panel.style.left = (e.clientX - ox) + 'px';
        panel.style.top = (e.clientY - oy) + 'px';
        panel.style.right = 'auto';
    };
    document.onmouseup = () => drag = 0;

    // ---------------- RENDER ----------------
    function render() {

        const isCapture = mode === 'capture';

        startBtn.style.display = isCapture ? 'inline' : 'none';
        saveBtn.style.display = isCapture ? 'inline' : 'none';
        ta.style.display = isCapture ? 'block' : 'none';
        tag.style.display = isCapture ? 'block' : 'none';

        exportAllBtn.style.display = !isCapture ? 'inline' : 'none';
        clearAllBtn.style.display = !isCapture ? 'inline' : 'none';
        search.style.display = !isCapture ? 'block' : 'none';
        list.style.display = !isCapture ? 'block' : 'none';

        if (isCapture) return;

        while (list.firstChild) list.removeChild(list.firstChild);

        const data = getNotes();
        const q = search.value.toLowerCase();

        Object.entries(data).forEach(([vid, v]) => {

            const group = document.createElement('div');
            group.style.cssText = 'border:1px solid #333;margin-bottom:8px;padding:4px;';

            const title = document.createElement('div');
            title.textContent = v.title;
            title.style.cssText = 'font-weight:bold;cursor:pointer;background:#333;padding:3px;';

            // clear per video
            const clear = document.createElement('span');
            clear.textContent = ' clear';
            clear.style.cssText = 'color:#f88;cursor:pointer;text-decoration:underline;margin-left:6px;';
            clear.onclick = (e) => {
                e.stopPropagation();
                if (confirm('Delete all notes for this video?')) {
                    delete data[vid];
                    saveNotes(data);
                    render();
                }
            };

            // export per video
            const exportVid = document.createElement('span');
            exportVid.textContent = ' export';
            exportVid.style.cssText = 'color:#0af;cursor:pointer;text-decoration:underline;margin-left:6px;';
            exportVid.onclick = (e) => {
                e.stopPropagation();
                const blob = new Blob([JSON.stringify(v, null, 2)], { type: 'application/json' });
                const a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = `yt-notes-${vid}.json`;
                a.click();
            };

            title.appendChild(clear);
            title.appendChild(exportVid);

            let collapsed = false;
            const box = document.createElement('div');

            title.onclick = () => {
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

                // top line
                const top = document.createElement('div');

                const time = document.createElement('span');
                time.textContent = `${formatTime(n.start)} → ${formatTime(n.end)} `;
                time.style.textDecoration = 'underline';

                const go = document.createElement('span');
                go.textContent = 'go';
                go.style.cssText = 'color:#0af;cursor:pointer;text-decoration:underline;margin-left:6px;';
                go.onclick = () => goToNote(n, vid);

                const edit = document.createElement('span');
                edit.textContent = ' edit';
                edit.style.cssText = 'color:#ff0;cursor:pointer;text-decoration:underline;margin-left:6px;';
                edit.onclick = () => {
                    const nt = prompt('edit text', n.text);
                    if (nt === null) return;

                    const tg = prompt('tags', (n.tags || []).join(','));

                    n.text = nt;
                    n.tags = tg ? tg.split(',').map(t => t.trim()) : [];

                    saveNotes(data);
                    render();
                };

                const del = document.createElement('span');
                del.textContent = ' del';
                del.style.cssText = 'color:#f55;cursor:pointer;text-decoration:underline;margin-left:6px;';
                del.onclick = () => {
                    if (confirm('delete?')) {
                        v.notes.splice(i, 1);
                        saveNotes(data);
                        render();
                    }
                };

                top.appendChild(time);
                top.appendChild(go);
                top.appendChild(edit);
                top.appendChild(del);

                // second line
                const text = document.createElement('div');
                text.textContent = n.text;
                text.style.cssText = 'margin-left:6px;color:#ccc;margin-top:2px;';

                row.appendChild(top);
                row.appendChild(text);
                box.appendChild(row);

            });

            group.appendChild(title);
            group.appendChild(box);
            list.appendChild(group);

        });
    }

    // ---------------- EVENTS ----------------
    startBtn.onclick = () => {
        startTime = getVideo().currentTime;
        tip('Start saved');
    };

    saveBtn.onclick = () => {
        const end = getVideo().currentTime;
        saveNote(end, ta.value, (tag.value || '').split(','));
        tip('Note saved');
        ta.value = '';
        tag.value = '';
    };

    toggleMode.onclick = () => {
        mode = mode === 'capture' ? 'view' : 'capture';
        render();
    };

    exportAllBtn.onclick = () => {
        const blob = new Blob([JSON.stringify(getNotes(), null, 2)], { type: 'application/json' });
        const a = document.createElement('a');

        a.href = URL.createObjectURL(blob);
        a.download = 'yt-notes-all.json';
        a.click();
    };

    clearAllBtn.onclick = () => {
        if (confirm('Delete ALL notes from ALL videos? This cannot be undone.')) {
            saveNotes({});
            render();
            tip('All notes cleared');
        }
    };

    // init
    render();

})();