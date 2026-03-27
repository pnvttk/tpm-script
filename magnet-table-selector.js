// ==UserScript==
// @name         Magnet Table Selector (Readable + Counter + Invert)
// @namespace    http://tampermonkey.net/
// @version      1.4
// @description  Select/export magnet links + draggable panel + toggle + selected count (X / total) + invert selection
// @match        *://*/*
// @grant        GM_setClipboard
// ==/UserScript==

(function () {
    'use strict';

    function makeDraggable(panelElement) {
        const savedPosRaw = localStorage.getItem('magnetPanelPos');
        if (savedPosRaw) {
            const savedPos = JSON.parse(savedPosRaw);
            panelElement.style.left = savedPos.left;
            panelElement.style.top = savedPos.top;
            panelElement.style.right = 'auto';
        }

        panelElement.style.cursor = 'grab';

        function onMouseMove(event) {
            if (!panelElement.isDragging) {
                return;
            }

            panelElement.style.left = (event.clientX - panelElement.offsetX) + 'px';
            panelElement.style.top = (event.clientY - panelElement.offsetY) + 'px';
            panelElement.style.right = 'auto';
        }

        function onMouseUp() {
            if (!panelElement.isDragging) {
                return;
            }

            panelElement.isDragging = false;
            panelElement.style.cursor = 'grab';

            const pos = {
                left: panelElement.style.left,
                top: panelElement.style.top
            };

            localStorage.setItem('magnetPanelPos', JSON.stringify(pos));
        }

        panelElement.addEventListener('mousedown', function (event) {
            panelElement.isDragging = true;
            panelElement.offsetX = event.clientX - panelElement.offsetLeft;
            panelElement.offsetY = event.clientY - panelElement.offsetTop;
            panelElement.style.cursor = 'grabbing';
        });

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    }

    function init() {
        const rowsWithMagnets = Array.from(document.querySelectorAll('tr'))
            .map(row => {
                const magnetLink = row.querySelector('a[href^="magnet:?"]');
                if (!magnetLink) {
                    return null;
                }

                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.className = 'magnet-checkbox';

                const firstCell = row.querySelector('td, th');
                if (firstCell) {
                    firstCell.prepend(checkbox);
                }

                return { row, magnetLink, checkbox };
            })
            .filter(Boolean);

        if (rowsWithMagnets.length === 0) return;

        // CREATE PANEL
        const panel = document.createElement('div');
        panel.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            background: #222;
            color: #fff;
            padding: 10px;
            z-index: 9999;
            border-radius: 8px;
            font-size: 13px;
            min-width: 180px;
        `;

        makeDraggable(panel);

        // SELECT ALL
        const selectAllCheckbox = document.createElement('input');
        selectAllCheckbox.type = 'checkbox';
        const selectAllLabel = document.createTextNode(' Select All');

        panel.appendChild(selectAllCheckbox);
        panel.appendChild(selectAllLabel);
        panel.appendChild(document.createElement('br'));
        panel.appendChild(document.createElement('br'));

        // SELECTED COUNT 
        const selectedCounter = document.createElement('div');
        selectedCounter.style.margin = '5px 0';
        panel.appendChild(selectedCounter);

        function updateSelectedCounter() {
            const selectedCount = rowsWithMagnets.filter(item => item.checkbox.checked).length;
            const totalCount = rowsWithMagnets.length;
            selectedCounter.innerText = `Selected: ${selectedCount} / ${totalCount}`;
        }

        rowsWithMagnets.forEach(item => {
            item.checkbox.addEventListener('change', updateSelectedCounter);
        });

        selectAllCheckbox.addEventListener('change', () => {
            const isChecked = selectAllCheckbox.checked;
            rowsWithMagnets.forEach(item => {
                item.checkbox.checked = isChecked;
            });

            updateSelectedCounter();
        });

        updateSelectedCounter();

        // COPY BUTTON 
        const copyButton = document.createElement('button');
        copyButton.innerText = 'Copy Selected';
        copyButton.addEventListener('click', () => {
            const selectedLinks = rowsWithMagnets
                .filter(item => item.checkbox.checked)
                .map(item => item.magnetLink.href);

            if (selectedLinks.length > 0) {
                GM_setClipboard(selectedLinks.join('\n'));
                alert('Copied!');
            } else {
                alert('No selection');
            }
        });

        panel.appendChild(copyButton);

        // DOWNLOAD BUTTON 
        const downloadButton = document.createElement('button');
        downloadButton.innerText = 'Download .txt';
        downloadButton.style.marginLeft = '5px';
        downloadButton.addEventListener('click', () => {
            const selectedLinks = rowsWithMagnets
                .filter(item => item.checkbox.checked)
                .map(item => item.magnetLink.href);

            if (selectedLinks.length === 0) {
                alert('No selection');

                return;
            }

            const blob = new Blob([selectedLinks.join('\n')], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');

            a.href = url;
            a.download = 'magnets.txt';
            a.click();
            URL.revokeObjectURL(url);
        });

        panel.appendChild(downloadButton);

        // INVERT SELECTION BUTTON 
        const invertButton = document.createElement('button');
        invertButton.innerText = 'Invert Selection';
        invertButton.style.marginLeft = '5px';
        invertButton.addEventListener('click', () => {
            rowsWithMagnets.forEach(item => {
                item.checkbox.checked = !item.checkbox.checked;
            });

            updateSelectedCounter();
        });

        panel.appendChild(invertButton);

        document.body.appendChild(panel);

        // TOGGLE BUTTON 
        const toggleButton = document.createElement('button');
        toggleButton.innerText = '☰';
        toggleButton.title = 'Toggle panel';
        toggleButton.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            z-index: 10000;
            padding: 5px 8px;
            cursor: pointer;
        `;

        const isPanelHidden = localStorage.getItem('magnetPanelHidden') === 'true';
        panel.style.display = isPanelHidden ? 'none' : 'block';

        toggleButton.addEventListener('click', () => {
            const currentlyHidden = panel.style.display === 'none';
            panel.style.display = currentlyHidden ? 'block' : 'none';
            
            localStorage.setItem('magnetPanelHidden', !currentlyHidden);
        });

        document.body.appendChild(toggleButton);
    }

    window.addEventListener('load', init);
})();