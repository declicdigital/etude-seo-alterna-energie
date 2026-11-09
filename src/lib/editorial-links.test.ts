import { describe, expect, test } from 'vitest';
import { editorialLink, notificationLink } from './editorial-links';
import { fichePath, resolvePath, sheetPath, sheetFromPath, slugify } from './slugs';
describe('canonical destinations', () => {
  test('all default rubriques and sous-rubriques round trip', () => {
    for (const sheet of ['__home', '__guide', 'SUIVI EDITORIAL', 'SUIVI STRATEGIE', 'SUIVI PLANETE', 'BLOG - ARTICLES::Particulier', 'BLOG - ARTICLES::Professionnel', 'STRATEGIE - ARTICLES', 'PLANETE - ARTICLES', 'SUIVI FAQ', 'FAQ - DEMANDES::Particulier', 'FAQ - DEMANDES::Professionnel', 'BENCHMARK', 'ORGANISATION', 'NEWSLETTER INTERNE', 'NEWSLETTER B2C', 'NEWSLETTER SME', 'NEWSLETTER GRANDS COMPTES']) {
      expect(sheetFromPath(sheetPath(sheet))).toBe(sheet);
    }
    expect(sheetPath('BLOG - ARTICLES::Particulier')).toBe('blog/particulier');
    expect(sheetPath('SUIVI STRATEGIE')).toBe('strategie-pac/suivi-editorial');
  });
  test('each fiche has a readable title and unique stable id', () => {
    expect(fichePath('SUIVI EDITORIAL', 'articles', 'a1', 'Électricité : Guide pratique')).toBe('blog/suivi-editorial/articles/electricite-guide-pratique--a1');
    expect(slugify('Électricité : Guide pratique')).toBe('electricite-guide-pratique');
    expect(resolvePath('blog/suivi-editorial/articles/electricite-guide-pratique--a1')).toEqual({ sheet:'SUIVI EDITORIAL', hash:'#article-a1' });
    expect(fichePath('SUIVI EDITORIAL', 'articles', 'a2', 'Électricité : Guide pratique')).not.toBe(fichePath('SUIVI EDITORIAL', 'articles', 'a1', 'Électricité : Guide pratique'));
  });
  test('image mail opens Geoffrey’s exact area', () => {
    const url = new URL(notificationLink('image', 'a1', undefined, undefined, 'Mon article'));
    expect(url.pathname).toBe('/blog/suivi-editorial/articles/mon-article--a1');
    expect(resolvePath(url.pathname, url.searchParams)?.hash).toBe('#article-a1?step=image&focus=images');
  });
  test('review mail opens the review step', () => {
    const url = new URL(notificationLink('relecture', 'a1'));
    expect(resolvePath(url.pathname, url.searchParams)?.hash).toBe('#article-a1?step=relecture');
  });
  test('integration mail opens Marick’s step', () => {
    const url = new URL(notificationLink('integration', 'a1'));
    expect(resolvePath(url.pathname, url.searchParams)?.hash).toBe('#article-a1?step=integration');
  });
  test('todo reminder targets its own row in PAC', () => {
    const url = new URL(editorialLink('t2', undefined, undefined, true, 'strategie', 'Pompe à chaleur'));
    expect(url.pathname).toBe('/strategie-pac/suivi-editorial/a-rediger/pompe-a-chaleur--t2');
    expect(resolvePath(url.pathname, url.searchParams)?.hash).toBe('#todo-t2');
  });
  test('FAQ and Organisation fiche ids resolve', () => {
    expect(resolvePath(fichePath('SUIVI FAQ', 'demandes', 'f1', 'Question'))?.hash).toBe('#faq-f1');
    expect(resolvePath(fichePath('ORGANISATION', 'fiches', 'c1', 'Campagne'))?.hash).toBe('#card-c1');
    expect(resolvePath('/not-a-rubrique')).toBeNull();
  });
});