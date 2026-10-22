import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';

const scope: any = {};
runInNewContext(readFileSync('public/editorial-pipeline.js', 'utf8'), scope);
const pipeline = scope.EditorialPipeline;
const config = [
  {key:'redaction', label:'Rédaction'}, {key:'expert', label:'Relecture de l’expert métier'},
  {key:'validation', label:'Relecture + Image'}, {key:'integration', label:'Intégration'}
];
describe('PAC rewrites', () => {
  const pacConfig = [{key:'brief',label:'Brief'}, ...config];
  it('removes review and image from Réécriture, keeping brief, edition and integration', () => {
    const article: any = {type:'Réécriture',audience:'Particulier',steps:[]};
    pipeline.sync(article,pacConfig,'strategie');
    expect(article.steps.map((s: any) => s.key)).toEqual(['brief','redaction','integration']);
    expect(pipeline.nextNotification(article,'redaction','strategie')).toMatchObject({kind:'integration',next:'integration'});
    expect(pipeline.nextNotification(article,'validation','strategie')).toBeNull();
  });
  it('keeps review and image for Création', () => {
    const article: any = {type:'Création',audience:'Particulier',steps:[]};
    pipeline.sync(article,pacConfig,'strategie');
    expect(article.steps.map((s: any) => s.key)).toEqual(['brief','redaction','validation','integration']);
    expect(pipeline.nextNotification(article,'redaction','strategie')).toMatchObject({kind:'relecture',next:'validation'});
  });
  it('preserves saved review attachments and published history when changing type', () => {
    const review = {key:'validation',status:'done',attachments:[{id:'original'}]};
    const article: any = {type:'Réécriture',blogRowId:42,steps:[review,{key:'integration',status:'done'}]};
    pipeline.sync(article,pacConfig,'strategie');
    expect(article.steps.find((s: any) => s.key === 'validation')).toBeUndefined();
    expect(article.steps.find((s: any) => s.key === 'integration')?.status).toBe('done');
    article.type = 'Création'; pipeline.sync(article,pacConfig,'strategie');
    expect(article.steps.find((s: any) => s.key === 'validation')).toEqual(review);
    expect(article.blogRowId).toBe(42);
  });
});
describe('Blog Pro expert review', () => {
  it('puts expert review after edition and before image for Pro only', () => {
    const pro: any = {audience:'Professionnel', steps:[]};
    pipeline.sync(pro, config, '');
    expect(pro.steps.map((s: any) => s.key)).toEqual(['redaction','expert','validation','integration']);
    expect(pipeline.configFor(pro, config, '').map((s: any) => s.label)).toEqual(['Édition','Relecture de l’expert métier','Image','Intégration']);
  });
  it('leaves Particulier and PAC without expert review', () => {
    for(const [audience,space] of [['Particulier',''],['Professionnel','strategie']]) {
      const article: any = {audience,steps:[]}; pipeline.sync(article,config,space);
      expect(article.steps.map((s: any) => s.key)).toEqual(['redaction','validation','integration']);
    }
  });
  it('preserves published articles and existing image attachments', () => {
    const article: any = {audience:'Professionnel',blogRowId:42,steps:[{key:'validation',status:'done',attachments:[{id:'original'}]}]};
    pipeline.sync(article,config,'');
    expect(article.steps.find((s: any) => s.key === 'expert')?.status).toBe('skipped');
    expect(article.steps.find((s: any) => s.key === 'validation')?.attachments).toEqual([{id:'original'}]);
  });
  it('does not request images before expert review completes', () => {
    expect(pipeline.nextNotification({audience:'Professionnel'},'redaction','')).toBeNull();
    expect(pipeline.nextNotification({audience:'Professionnel'},'expert','')).toMatchObject({kind:'relecture',next:'validation'});
  });
  it('applies Clément as the default expert to an existing unassigned step', () => {
    const article: any = {audience:'Professionnel', steps:[{key:'expert',status:'pending',assignee:''}]};
    const defaults = config.map(c => c.key === 'expert' ? {...c,assignee:'Clément'} : c);
    pipeline.sync(article,defaults,'');
    expect(article.steps.find((s: any) => s.key === 'expert')?.assignee).toBe('Clément');
  });
  it('preserves an individually assigned expert instead of replacing it with Clément', () => {
    const article: any = {audience:'Professionnel', steps:[{key:'expert',status:'pending',assignee:'Autre expert'}]};
    const defaults = config.map(c => c.key === 'expert' ? {...c,assignee:'Clément'} : c);
    pipeline.sync(article,defaults,'');
    expect(article.steps.find((s: any) => s.key === 'expert')?.assignee).toBe('Autre expert');
  });
});