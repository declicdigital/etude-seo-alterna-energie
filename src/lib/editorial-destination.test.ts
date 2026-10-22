import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

test('a mail opens only its article and scrolls to the requested area', () => {
  const html = readFileSync(new URL('../../public/suivi-editorial.html', import.meta.url), 'utf8');
  const start = html.indexOf('function openArticleFromHash(){');
  const end = html.indexOf("window.addEventListener('hashchange'", start);
  const articles = ['one', 'two'].map(id => ({ id, steps: [{ key: 'validation' }, { key: 'integration' }] }));
  for (const [step, focus, expected] of [['validation', 'images', '.attach-image-label'], ['integration', '', '.step-panel']]) {
    let selected = '';
    let scrolled = false;
    const area = { scrollIntoView: () => { scrolled = true; }, classList: { add() {}, remove() {} } };
    const context = {
      location: { hash: `#article-one?step=${step}&focus=${focus}` },
      URLSearchParams, articles, expanded: { two: true } as Record<string, boolean>, TODO_ARTICLE_ID: '__todo__', openPanels: {} as Record<string, string>,
      getArticle: (id: string) => articles.find(a => a.id === id), saveExpanded() {}, renderArticles() {},
      document: { querySelectorAll: () => [{ dataset: { articleId: 'one' }, querySelector: (selector: string) => { selected = selector; return area; } }] },
      setTimeout() {},
    };
    runInNewContext(html.slice(start, end) + '\nopenArticleFromHash();', context);
    assert.equal(context.expanded.two, undefined);
    assert.equal(context.expanded.one, true);
    assert.equal(context.openPanels.one, step);
    assert.equal(selected, expected);
    assert.equal(scrolled, true);
  }
});