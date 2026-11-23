import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';
import { isBusinessDay } from './business-days';

const scope: any = {};
runInNewContext(readFileSync('public/editorial-pipeline.js', 'utf8'), scope);
const pipeline = scope.EditorialPipeline;
describe('Blog integration cadence', () => {
  const article = (id: string, deadline?: string, audience = 'Professionnel') => ({id, audience, createdAt:id, steps:[{key:'integration', status:'pending', deadline}]});
  it('spaces Pro deadlines by two weeks and preserves published dates', () => {
    const rows: any[] = [article('a','2026-11-23'),article('b','2026-11-23'),article('c'),article('part','2026-11-24','Particulier'),{id:'old', audience:'Professionnel',steps:[{key:'integration',status:'done',date:'2026-11-16',deadline:'2026-11-12'}]}];
    pipeline.scheduleProIntegration(rows,'','2026-11-17');
    expect(rows.map(a => a.steps[0].deadline)).toEqual(['2026-11-30','2026-12-14','2026-12-28','2026-11-23','2026-11-12']);
    expect(rows[4].steps[0].date).toBe('2026-11-16');
    expect(pipeline.scheduleProIntegration(rows,'','2026-11-18')).toEqual([]);
  });
  it('spaces Particulier by exactly seven days independently of Pro', () => {
    const rows = [article('a','2026-11-23','Particulier'),article('b','2026-11-23','Particulier'),article('c',undefined,'Particulier'),article('pro','2026-11-23')];
    pipeline.scheduleIntegration(rows,'','2026-11-17');
    expect(rows.map(a => a.steps[0].deadline)).toEqual(['2026-11-23','2026-11-30','2026-12-07','2026-11-23']);
    expect(pipeline.scheduleIntegration(rows,'','2026-11-18')).toEqual([]);
  });
  it('shares PAC Blog and Particulier slots, excluding editorial content', () => {
    const rows: any[] = [article('part','2026-11-16','Particulier'),{...article('pac','2026-11-16','Particulier'),dest:'Blog',_scheduleSpace:'strategie'},{...article('edito','2026-11-16'),dest:'Éditorial',_scheduleSpace:'strategie'},{id:'old',audience:'Particulier',steps:[{key:'integration',status:'done',date:'2026-11-16'}]}];
    pipeline.scheduleIntegration(rows,'','2026-11-17');
    expect(rows.map(a => a.steps[0].deadline)).toEqual(['2026-11-30','2026-11-23','2026-11-16',undefined]);
    expect(pipeline.scheduleIntegration(rows,'','2026-11-18')).toEqual([]);
  });
  it('keeps PAC Editorial outside the Blog cadence and retains its review deadline rule', () => {
    const editorial: any = {id:'edito',dest:'Éditorial',audience:'Particulier',steps:[{key:'relecture',status:'done',date:'2026-11-17'},{key:'integration',status:'pending'}]};
    expect(pipeline.scheduleIntegration([editorial],'strategie','2026-11-17')).toEqual([]);
    expect(pipeline.applyAutoDeadline(editorial,'relecture','strategie')).toBe(true);
    expect(editorial.steps[1].deadline).toBe('2026-11-24');
  });
  it('moves Easter Monday to Tuesday, then resumes two calendar weeks later', () => {
    const rows = [article('a','2027-03-29'), article('b')];
    pipeline.scheduleProIntegration(rows,'','2027-03-22');
    expect(rows.map(a => a.steps[0].deadline)).toEqual(['2027-03-30','2027-04-12']);
    expect(pipeline.scheduleProIntegration(rows,'','2027-03-23')).toEqual([]);
  });
  it('moves Whit Monday and fixed holidays to the next working day', () => {
    expect(pipeline.proPublicationDay('2027-05-17')).toBe('2027-05-18');
    expect(pipeline.proPublicationDay('2028-05-01')).toBe('2028-05-02');
    expect(pipeline.proPublicationDay('2028-12-25')).toBe('2028-12-26');
    for(let year=2026; year<=2030; year++) for(let month=1; month<=12; month++) {
      const day = `${year}-${String(month).padStart(2,'0')}-01`;
      expect(isBusinessDay(pipeline.proPublicationDay(day))).toBe(true);
    }
  });
  it('assigns the next available Monday after an already published Pro article', () => {
    const rows: any[] = [article('next'),{id:'old',audience:'Professionnel',steps:[{key:'integration',status:'done',date:'2026-11-16'}]}];
    pipeline.scheduleProIntegration(rows,'','2026-11-17');
    expect(rows[0].steps[0].deadline).toBe('2026-11-30');
    expect(pipeline.scheduleIntegration([article('planete')],'planete','2026-11-17')).toEqual([]);
  });
  it('does not replace a Blog calendar slot with the five-day review deadline', () => {
    const pro: any = {audience:'Professionnel',steps:[{key:'relecture',status:'done',date:'2026-11-17'},{key:'integration',status:'pending'}]};
    expect(pipeline.applyAutoDeadline(pro,'relecture','')).toBe(false);
    expect(pro.steps[1].deadline).toBeUndefined();
  });
});
describe('Actual completion dates', () => {
  it('keeps the brief on October 14 and writing on October 21', () => {
    const brief = { key:'brief', status:'pending', date:'2026-10-14' };
    const writing = { key:'redaction', status:'pending', date:'2026-10-21' };
    expect(pipeline.completeStep(brief)).toBe(true);
    expect(pipeline.completeStep(writing)).toBe(true);
    expect(brief.date).toBe('2026-10-14');
    expect(writing.date).toBe('2026-10-21');
  });
  it('preserves each Blog step date on validation and revalidation', () => {
    const writing = {key:'redaction',status:'pending',date:'2026-10-19'};
    const review = {key:'validation',status:'pending',date:'2026-10-22'};
    pipeline.completeStep(writing); pipeline.completeStep(review);
    writing.status = 'pending'; pipeline.completeStep(writing);
    expect(writing.date).toBe('2026-10-19');
    expect(review.date).toBe('2026-10-22');
  });
  it('does not invent a completion date for an undated step', () => {
    const step = {key:'validation',status:'pending',date:''};
    expect(pipeline.completeStep(step)).toBe(false);
    expect(step.status).toBe('pending');
    expect(step.date).toBe('');
  });
});
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
    expect(article.steps.map((s: any) => s.key)).toEqual(['brief','redaction','image','relecture','integration']);
    expect(pipeline.nextNotification(article,'redaction','strategie')).toMatchObject({kind:'image',next:'image'});
  });
  it('preserves saved review attachments and published history when changing type', () => {
    const review = {key:'validation',status:'done',date:'2026-10-22',attachments:[{id:'original'}]};
    const article: any = {type:'Réécriture',blogRowId:42,steps:[review,{key:'integration',status:'done'}]};
    pipeline.sync(article,pacConfig,'strategie');
    expect(article.steps.find((s: any) => s.key === 'validation')).toBeUndefined();
    expect(article.steps.find((s: any) => s.key === 'integration')?.status).toBe('done');
    article.type = 'Création'; pipeline.sync(article,pacConfig,'strategie');
    expect(article.steps.find((s: any) => s.key === 'relecture')?.date).toBe(review.date);
    expect(article.blogRowId).toBe(42);
  });
});
describe('Blog Pro expert review', () => {
  it('puts expert review after edition and before image for Pro only', () => {
    const pro: any = {audience:'Professionnel', steps:[]};
    pipeline.sync(pro, config, '');
    expect(pro.steps.map((s: any) => s.key)).toEqual(['redaction','expert','image','relecture','integration']);
    expect(pipeline.configFor(pro, config, '').map((s: any) => s.label)).toEqual(['Édition','Relecture de l’expert métier','Image','Relecture','Intégration']);
  });
  it('leaves Particulier and PAC without expert review', () => {
    for(const [audience,space] of [['Particulier',''],['Professionnel','strategie']]) {
      const article: any = {audience,steps:[]}; pipeline.sync(article,config,space);
      expect(article.steps.map((s: any) => s.key)).toEqual(['redaction','image','relecture','integration']);
    }
  });
  it('preserves published articles and existing image attachments', () => {
    const article: any = {audience:'Professionnel',blogRowId:42,steps:[{key:'validation',status:'done',attachments:[{id:'original'}]}]};
    pipeline.sync(article,config,'');
    expect(article.steps.find((s: any) => s.key === 'expert')?.status).toBe('skipped');
    expect(article.steps.find((s: any) => s.key === 'image')?.attachments).toEqual([{id:'original'}]);
  });
  it('does not request images before expert review completes', () => {
    expect(pipeline.nextNotification({audience:'Professionnel'},'redaction','')).toBeNull();
    expect(pipeline.nextNotification({audience:'Professionnel'},'expert','')).toMatchObject({kind:'image',next:'image'});
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
describe('Separate Image and Relecture', () => {
  it('routes writing to Geoffrey image, then Communication review, then Marick', () => {
    for(const space of ['', 'strategie']) {
      const article = {audience:'Particulier',type:'Création'};
      expect(pipeline.nextNotification(article,'redaction',space)).toMatchObject({kind:'image',next:'image',who:'Geoffrey'});
      expect(pipeline.nextNotification(article,'image',space)).toMatchObject({kind:'relecture',next:'relecture'});
      expect(pipeline.nextNotification(article,'relecture',space)).toMatchObject({kind:'integration',next:'integration'});
    }
  });
  it('preserves the combined historical completion date without inventing an image date', () => {
    const article: any = {audience:'Particulier',steps:[{key:'validation',status:'done',date:'2026-10-22',attachments:[{id:'photo',type:'image'}]}]};
    pipeline.sync(article,config,'');
    expect(article.steps.find((s: any) => s.key === 'relecture').date).toBe('2026-10-22');
    expect(article.steps.find((s: any) => s.key === 'image').date).toBe('');
    expect(article.steps.find((s: any) => s.key === 'image').attachments).toEqual([{id:'photo',type:'image'}]);
    const before = JSON.stringify(article); pipeline.sync(article,config,'');
    expect(JSON.stringify(article)).toBe(before);
  });
  it('does not mark the new Pro Communication review completed for an unpublished article', () => {
    const article: any = {audience:'Professionnel',steps:[{key:'validation',status:'done',date:'2026-10-22',attachments:[]}]};
    pipeline.sync(article,config,'');
    expect(article.steps.find((s: any) => s.key === 'image').date).toBe('2026-10-22');
    expect(article.steps.find((s: any) => s.key === 'relecture').status).toBe('pending');
  });
  it('brings back the images left on the former validation step', () => {
    const config = [{key:'redaction'},{key:'image'},{key:'relecture'},{key:'integration'}];
    const img = (id: string) => ({id, type:'image', name:id + '.png', value:'data:image/png;base64,AA'});
    const article: any = {
      audience:'Particulier',
      steps:[{key:'redaction',status:'done',date:'2026-10-19',attachments:[]},{key:'image',status:'skipped',date:'',attachments:[]},{key:'relecture',status:'pending',date:'',attachments:[]},{key:'integration',status:'done',date:'2026-10-26',attachments:[]}],
      reviewSteps:{validation:{key:'validation',status:'done',date:'2026-10-23',attachments:[img('a'), img('b'), {id:'n', type:'note', value:'ok'}]}},
      legacyReviewStep:{key:'validation',attachments:[img('b')]},
    };
    pipeline.sync(article, config, '');
    pipeline.sync(article, config, '');
    const image = article.steps.find((s: any) => s.key === 'image');
    expect(image.attachments.map((a: any) => a.id)).toEqual(['a', 'b']);
    expect(image.status).toBe('skipped');
  });
  it('sets the automatic deadlines after Image and Relecture, in business days', () => {
    expect(pipeline.addBusinessDays('2026-11-06', 3)).toBe('2026-11-11'); // vendredi + 3 → mercredi
    expect(pipeline.addBusinessDays('2026-11-09', 5)).toBe('2026-11-16'); // lundi + 5 → lundi
    const article: any = { steps: [
      { key: 'redaction', status: 'done', date: '2026-11-02' },
      { key: 'image', status: 'done', date: '2026-11-06' },
      { key: 'relecture', status: 'pending', date: '' },
      { key: 'integration', status: 'pending', date: '' },
    ] };
    expect(pipeline.applyAutoDeadline(article, 'image')).toBe(true);
    expect(article.steps[2].deadline).toBe('2026-11-11');
    article.steps[2].status = 'done'; article.steps[2].date = '2026-11-09';
    expect(pipeline.applyAutoDeadline(article, 'relecture', 'other')).toBe(true);
    expect(article.steps[3].deadline).toBe('2026-11-16');
    // A deadline already set (by Geoffrey) is kept.
    article.steps[3].deadline = '2026-11-20';
    expect(pipeline.applyAutoDeadline(article, 'relecture', 'other')).toBe(false);
    expect(article.steps[3].deadline).toBe('2026-11-20');
    expect(pipeline.applyAutoDeadline(article, 'redaction')).toBe(false);
  });
});
describe('« Autre » among the rédacteurs', () => {
  it('is offered for the Rédaction step of every space', () => {
    for(const space of ['', 'strategie', 'planete']){
      const cfg: any = pipeline.normalizeConfig([{ key:'redaction', label:'Rédaction', assignee:'', options:['Aurorae','Marina'] }], space);
      expect(cfg.find((c: any) => c.key === 'redaction').options).toContain('Autre');
    }
    expect((pipeline.normalizeConfig([{ key:'redaction', label:'Rédaction' }], 'strategie') as any[]).find((c: any) => c.key === 'redaction').options).toEqual(['Autre']);
  });
  it('is listed only once when it is already configured', () => {
    const cfg: any = pipeline.normalizeConfig([{ key:'redaction', label:'Rédaction', options:['Aurorae','Autre'] }], '');
    expect(cfg.find((c: any) => c.key === 'redaction').options).toEqual(['Aurorae', 'Autre']);
  });
  it('keeps an article assigned to « Autre » instead of replacing it with the default', () => {
    const article: any = { audience:'Particulier', steps:[{ key:'redaction', status:'pending', assignee:'Autre' }] };
    pipeline.sync(article, [{ key:'redaction', label:'Rédaction', assignee:'Aurorae', options:['Aurorae','Marina'] }], '');
    expect(article.steps.find((s: any) => s.key === 'redaction').assignee).toBe('Autre');
  });
});
