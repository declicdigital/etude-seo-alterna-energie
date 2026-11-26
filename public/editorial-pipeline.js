(function (root) {
  const isPro = (article, space) => !space && article.audience === 'Professionnel';
  const isRewrite = (article, space) => space === 'strategie' && article.type === 'Réécriture';
  const PLANETE_STEPS = ['redaction', 'integration'];
  // « Autre » : étiquette pour un rédacteur hors liste. Elle ne désigne personne de précis,
  // donc aucune adresse mail ne lui est liée et aucun rappel ne part vers elle.
  const OTHER_ASSIGNEE = 'Autre';
  function withOther(options) {
    const list = (Array.isArray(options) ? options : []).filter(o => typeof o === 'string' && o.trim());
    return list.includes(OTHER_ASSIGNEE) ? list : [...list, OTHER_ASSIGNEE];
  }
  // Parlons Planète: Rédaction (Aurorae) then Intégration (Matthieu), nothing in between.
  function normalizePlanete(config) {
    const red = config.find(c => c.key === 'redaction') || { key:'redaction', label:'Rédaction', assignee:'', skippable:false };
    const int = config.find(c => c.key === 'integration') || { key:'integration', label:'Intégration', skippable:false };
    return [
      { ...red, options: withOther(Array.isArray(red.options) && red.options.length ? red.options : ['Aurorae']) },
      { ...int, assignee:'Matthieu', options:[], emails:{ Matthieu:'matthieu.roux@alterna-energie.fr', ...(int.emails || {}) } },
    ];
  }
  function normalizeConfig(config, space) {
    if(space === 'planete') return normalizePlanete(config);
    const result = config.filter(c => !['validation', 'image', 'relecture'].includes(c.key)).map(c => ({ ...c }));
    const index = result.findIndex(c => c.key === 'integration');
    const legacy = config.find(c => c.key === 'validation');
    const image = config.find(c => c.key === 'image');
    const review = config.find(c => c.key === 'relecture');
    result.splice(index < 0 ? result.length : index, 0,
      { ...image, key:'image', label:'Image', assignee:'Matthieu', options:[], skippable:false, emails:{ Matthieu:'matthieu.roux@alterna-energie.fr' } },
      { ...(review || legacy), key:'relecture', label:'Relecture', assignee:'Service Communication', options:[], skippable:false, emails:{ 'Service Communication':'fannie.laurendin@soregies.fr, coraline.prono@soregies.fr' } });
    return result.map(c => c.key === 'redaction' ? { ...c, options: withOther(c.options) } : c);
  }
  function configFor(article, config, space) {
    const pro = isPro(article, space);
    if(space === 'planete') return normalizeConfig(config, space);
    return normalizeConfig(config, space).filter(c => (pro || c.key !== 'expert') && (!isRewrite(article, space) || !['image', 'relecture'].includes(c.key))).map(c => ({
      ...c,
      label: pro && c.key === 'redaction' ? 'Édition' : c.label
    }));
  }
  function sync(article, config, space) {
    const existing = Object.fromEntries((article.steps || []).map(s => [s.key, s]));
    const published = !!article.blogRowId || existing.integration?.status === 'done';
    const legacy = existing.validation || (!existing.image && !article.reviewSteps?.image && !article.legacyReviewStep ? existing.relecture : undefined);
    if(legacy){
      article.legacyReviewStep = article.legacyReviewStep || JSON.parse(JSON.stringify(legacy));
      const pro = isPro(article, space);
      existing.image = existing.image || (pro ? { ...legacy, key:'image' } : {
        key:'image', status:legacy.status === 'done' || published ? 'skipped' : 'pending', date:'',
        attachments:(legacy.attachments || []).filter(a => a.type === 'image')
      });
      existing.relecture = pro ? { key:'relecture', status:published ? 'skipped' : 'pending', date:'', attachments:[] }
        : { ...legacy, key:'relecture', attachments:(legacy.attachments || []).filter(a => a.type !== 'image') };
    }
    if(existing.expert) article.expertStep = existing.expert;
    for(const key of ['validation', 'image', 'relecture']){
      if(existing[key]) article.reviewSteps = { ...article.reviewSteps, [key]: existing[key] };
    }
    article.steps = configFor(article, config, space).map(c => {
      const saved = existing[c.key] || (c.key === 'expert' ? article.expertStep : article.reviewSteps?.[c.key]);
      const step = saved || { key: c.key, status: c.key === 'expert' && published ? 'skipped' : 'pending', assignee: c.assignee || '', date: '', attachments: [] };
      if(!step.attachments) step.attachments = [];
      if(c.key === 'expert' && !(step.assignee || '').trim()) step.assignee = c.assignee || '';
      if(c.key === 'image' || (space === 'planete' && c.key === 'integration')) step.assignee = 'Matthieu';
      if(c.key === 'relecture') step.assignee = 'Service Communication';
      return step;
    });
    // Images dropped on the former « validation » step belong to the Image step: never lose them.
    const imageStep = article.steps.find(s => s.key === 'image');
    if(imageStep){
      const have = new Set(article.steps.flatMap(s => (s.attachments || []).map(a => a.id)));
      const archived = [article.reviewSteps?.validation, article.legacyReviewStep]
        .flatMap(s => (s && Array.isArray(s.attachments) ? s.attachments : []))
        .filter(a => a && a.type === 'image' && !have.has(a.id) && (have.add(a.id), true));
      if(archived.length) imageStep.attachments = [...imageStep.attachments, ...archived];
    }
  }
  function nextNotification(article, key, space) {
    if(space === 'planete') return key === 'redaction' ? { kind:'integration', next:'integration', who:'Matthieu (intégration)' } : null;
    if(isRewrite(article, space)){
      if(key === 'redaction') return { kind:'integration', next:'integration', who:'Marick (intégration)' };
      if(['image', 'validation', 'relecture'].includes(key)) return null;
    }
    if(key === 'redaction' && isPro(article, space)) return null;
    if(key === 'redaction' || key === 'expert') return { kind:'image', next:'image', who:'Matthieu' };
    if(key === 'image') return { kind:'relecture', next:'relecture', who:'Fannie et Coraline' };
    if(key === 'relecture') return { kind:'integration', next:'integration', who:'Marick (intégration)' };
    if(key === 'integration') return { kind:'published', who:'Matthieu (article publié)' };
    return null;
  }
  function completeStep(step) {
    if(!step || !/^\d{4}-\d{2}-\d{2}$/.test(step.date || '')) return false;
    step.status = 'done';
    return true;
  }
  /* Ajoute n jours ouvrés (lundi–vendredi) à une date AAAA-MM-JJ. */
  function addBusinessDays(iso, n) {
    if(!/^\d{4}-\d{2}-\d{2}$/.test(iso || '')) return '';
    const d = new Date(iso + 'T00:00:00Z');
    let left = n;
    while(left > 0){
      d.setUTCDate(d.getUTCDate() + 1);
      const day = d.getUTCDay();
      if(day !== 0 && day !== 6) left--;
    }
    return d.toISOString().slice(0, 10);
  }
  /* Deadlines automatiques : Relecture 3 jours ouvrés après la validation de l'Image,
     Intégration 5 jours ouvrés après la validation de la Relecture. Une deadline déjà posée
     (par Geoffrey) est conservée. Renvoie true si une deadline a été ajoutée. */
  const AUTO_DEADLINES = { image: { next: 'relecture', days: 3 }, relecture: { next: 'integration', days: 5 } };
  function applyAutoDeadline(article, validatedKey, space) {
    const rule = AUTO_DEADLINES[validatedKey];
    if(!rule || !article || !Array.isArray(article.steps)) return false;
    if(validatedKey === 'relecture' && (!space || (space === 'strategie' && article.dest === 'Blog'))) return false;
    const done = article.steps.find(s => s.key === validatedKey);
    const next = article.steps.find(s => s.key === rule.next);
    if(!done || done.status !== 'done' || !next || next.status !== 'pending' || next.deadline) return false;
    const deadline = addBusinessDays(done.date, rule.days);
    if(!deadline) return false;
    next.deadline = deadline;
    return true;
  }
  // French metropolitan public holidays, using the same Easter calculation as business-days.ts.
  function proPublicationDay(monday) {
    const d = new Date(monday + 'T00:00:00Z');
    const year = d.getUTCFullYear();
    const a = year % 19, b = Math.floor(year / 100), c = year % 100;
    const h = (19 * a + b - Math.floor(b / 4) - Math.floor((b - Math.floor((b + 8) / 25) + 1) / 3) + 15) % 30;
    const l = (32 + 2 * (b % 4) + 2 * Math.floor(c / 4) - h - c % 4) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const easter = new Date(Date.UTC(year, Math.floor((h + l - 7 * m + 114) / 31) - 1, (h + l - 7 * m + 114) % 31 + 1));
    const iso = date => date.toISOString().slice(0, 10);
    const holidays = new Set(['01-01','05-01','05-08','07-14','08-15','11-01','11-11','12-25'].map(x => year + '-' + x));
    for(const days of [1,39,50]) holidays.add(iso(new Date(easter.getTime() + days * 86400000)));
    while([0,6].includes(d.getUTCDay()) || holidays.has(iso(d))) d.setUTCDate(d.getUTCDate() + 1);
    return iso(d);
  }
  const validIso = value => /^\d{4}-\d{2}-\d{2}$/.test(value || '') && !Number.isNaN(Date.parse(value));
  function mondayOf(iso, upcoming) {
    const d = new Date(iso + 'T00:00:00Z');
    const offset = (d.getUTCDay() + 6) % 7;
    d.setUTCDate(d.getUTCDate() + (upcoming && offset ? 7 - offset : -offset));
    return d.toISOString().slice(0, 10);
  }
  function nextSlot(monday, weeks) {
    return new Date(Date.parse(monday) + weeks * 7 * 86400000).toISOString().slice(0, 10);
  }
  // Independent audience queues; holiday shifts never drift the next calendar slot.
  function scheduleIntegration(articles, space, today) {
    if((space && space !== 'strategie') || !validIso(today)) return [];
    const changed = [];
    const integration = a => a.steps.find(s => s.key === 'integration');
    const audiences = ['Professionnel', 'Particulier'];
    for(const audience of audiences) {
      const weeks = audience === 'Professionnel' ? 2 : 1;
      const group = articles.filter(a => {
        const origin = a._scheduleSpace ?? space;
        return (!origin || (origin === 'strategie' && a.dest === 'Blog')) && (origin === 'strategie' ? audience === 'Particulier' : a.audience === audience) && Array.isArray(a.steps);
      });
      const queue = group.filter(a => integration(a)?.status === 'pending' && !a.blogRowId)
        .sort((a,b) => (integration(a).deadline || '9999').localeCompare(integration(b).deadline || '9999') || (a.createdAt || '').localeCompare(b.createdAt || '') || a.id.localeCompare(b.id));
      if(!queue.length) continue;
      const lastPublished = group.filter(a => integration(a)?.status === 'done' && validIso(integration(a).date))
        .map(a => integration(a).date).sort().pop();
      const first = integration(queue[0]).deadline;
      let monday = mondayOf(validIso(first) ? first : today, !validIso(first));
      if(lastPublished) {
        const next = nextSlot(mondayOf(lastPublished, false), weeks);
        monday = next;
      }
      for(const article of queue) {
        const step = integration(article), deadline = proPublicationDay(monday);
        if(step.deadline !== deadline) { step.deadline = deadline; changed.push(article); }
        monday = nextSlot(monday, weeks);
      }
    }
    return changed;
  }
  // Kept for existing consumers; schedules both Blog audiences.
  const scheduleProIntegration = scheduleIntegration;
  root.EditorialPipeline = { PLANETE_STEPS, OTHER_ASSIGNEE, withOther, isPro, isRewrite, normalizeConfig, configFor, sync, nextNotification, completeStep, addBusinessDays, applyAutoDeadline, scheduleIntegration, scheduleProIntegration, proPublicationDay };
})(globalThis);