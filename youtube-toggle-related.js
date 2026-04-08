// ==UserScript==
// @name         toggle related
// @namespace    http://tampermonkey.net/
// @version      2026-04-08
// @description  Add toggle related video when small width
// @match        https://www.youtube.com/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

    let resizeTimeout;

    function getRelatedElement() {
        return document.querySelector('#related');
    }

    function currentWidth() {
        const w = window.innerWidth;

        if (w <= 900) {
            addButton();
        } else {
            removeButton();
            showRelated(); // restore visibility when wide
        }
    }

    function addButton() {
        if (document.getElementById('rl-button')) return;

        const related = getRelatedElement();
        if (!related) return;

        const button = document.createElement('button');
        button.id = 'rl-button';
        button.innerText = 'Toggle Related';

        Object.assign(button.style, {
            zIndex: 9999,
            position: 'relative',
            margin: '10px 0',
            padding: '8px',
            cursor: 'pointer'
        });

        button.addEventListener('click', () => {
            related.classList.toggle('tm-hidden');
        });

        related.parentNode.insertBefore(button, related);
    }

    function removeButton() {
        const btn = document.getElementById('rl-button');
        if (btn) btn.remove();
    }

    function showRelated() {
        const related = getRelatedElement();
        if (related) {
            related.classList.remove('tm-hidden');
        }
    }

    function injectStyle() {
        if (document.getElementById('tm-style')) return;

        const style = document.createElement('style');
        style.id = 'tm-style';
        style.textContent = `
            .tm-hidden {
                display: none !important;
            }
        `;
        document.head.appendChild(style);
    }

    function onResize() {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(currentWidth, 200);
    }

    function init() {
        injectStyle();
        currentWidth();
    }

    // Observe YouTube SPA changes
    const observer = new MutationObserver(() => {
        currentWidth();
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

    // Run
    window.addEventListener('resize', onResize);
    window.addEventListener('yt-navigate-finish', init); // important for YouTube navigation

    init();

})();