import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import Footer from './Footer';

test('footer links the approved ICP filing to MIIT', () => {
    const html = renderToStaticMarkup(React.createElement(Footer));

    assert.match(html, /粤ICP备2026121558号-1/);
    assert.match(html, /href="https:\/\/beian\.miit\.gov\.cn\/"/);
    assert.match(html, /target="_blank"/);
    assert.match(html, /rel="noopener noreferrer"/);
});
