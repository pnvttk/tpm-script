// ==UserScript==
// @name         toggle related
// @namespace    http://tampermonkey.net/
// @version      2025-04-13
// @description  Add toggle related video when small width
// @author       You
// @match        https://www.youtube.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=youtube.com
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    // Function to handle width-based logic
    function currentWidth(w) {
        if (w <= 900) {
            toggleButton();
        } else {
            removeButton();
        }
    }

    // Add the toggle button
    function toggleButton() {
        if (document.getElementById('rl-button')) {
            return;
        }

        const button = document.createElement('button');
        button.id = 'rl-button';
        button.innerText = 'Toggle Related';
        button.style.zIndex = 1000; // Make sure it's on top
        button.style.position = 'relative'; // Adjust styling as needed

        button.addEventListener('click', function () {
            const related = document.getElementById('related');
            if (related) {
                related.classList.toggle('hidden');
            }
        });

        const related = document.getElementById('related');
        if (related) {
            related.parentNode.insertBefore(button, related);
        }
    }

    // Remove the button if necessary
    function removeButton() {
        const button = document.getElementById('rl-button');
        if (button) {
            button.remove();
        }
    }

    // Debounced resize function
    let resizeTimeout;
    function onResize() {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            currentWidth(window.innerWidth);
        }, 200); // Adjust delay (200ms) as necessary
    }

    // Run once after idle
    currentWidth(window.innerWidth);

    // Re-run on resize with debounce
    window.addEventListener('resize', onResize);

    // Observe DOM changes to re-add button if needed
    const observer = new MutationObserver(() => {
        currentWidth(window.innerWidth);
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

})();