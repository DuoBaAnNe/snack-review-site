import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { NewsItem } from '@/types';
import NewsList from './NewsList';

function item(id: number): NewsItem {
    return {
        id,
        title: `News ${id}`,
        content: `Content ${id}`,
        source_url: '',
        created_at: '2026-08-27T00:00:00.000Z',
    };
}

function articleClassFor(html: string, title: string): string {
    const titlePosition = html.indexOf(title);
    const articleStart = html.lastIndexOf('<article class="', titlePosition);
    const classStart = articleStart + '<article class="'.length;
    return html.slice(classStart, html.indexOf('"', classStart));
}

test('mobile news defaults to ten cards while desktop keeps eighteen', () => {
    const html = renderToStaticMarkup(createElement(NewsList, {
        news: Array.from({ length: 19 }, (_, index) => item(index + 1)),
    }));

    assert.equal(articleClassFor(html, 'News 10').split(' ').includes('hidden'), false);
    assert.equal(articleClassFor(html, 'News 11').includes('hidden md:flex'), true);
    assert.equal(articleClassFor(html, 'News 18').includes('hidden md:flex'), true);
    assert.equal(html.includes('News 19'), false);
    assert.equal(html.includes('查看更多资讯（共 19 条）'), true);
});
