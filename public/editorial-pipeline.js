(function (root) {
  const isPro = (article, space) => !space && article.audience === 'Professionnel';
  const isRewrite = (article, space) => space === 'strategie' && article.type === 'Réécriture';
  function normalizeConfig(config) {
    const result = config.filter(c => !['validation', 'image', 'relecture'].includes(c.key)).map(c => ({ ...c }));
    const index = result.findIndex(c => c.key === 'integration');
    const legacy = config.find(c => c.key === 'validation');
    const image = config.find(c => c.key === 'image');
    const review = config.find(c => c.key === 'relecture');
    result.splice(index < 0 ? result.length : index, 0,
      { ...image, key:'image', label:'Image', assignee:'Geoffrey', options:[], skippable:false, emails:{ Geoffrey:'geoffrey.delabarre@alterna-energie.fr' } },
      { ...(review || legacy), key:'relecture', label:'Relecture', assignee:'Service Communication', options:[], skippable:false, emails:{ 'Service Communication':'fannie.laurendin@soregies.fr, coraline.prono@soregies.fr' } });
    return result;
  }
  function configFor(article, config, space) {
    const pro = isPro(article, space);
    return normalizeConfig(config).filter(c => (pro || c.key !== 'expert') && (!isRewrite(article, space) || !['image', 'relecture'].includes(c.key))).map(c => ({
      ...c,
      label: pro && c.key === 'redaction' ? 'Édition' : c.label
    }));
  }
  function sync(article, config, space) {
    const existing = Object.fromEntries((article.steps || []).map(s => [s.key, s]));
    const published = !!article.blogRowId || existing.integration?.status === 'done';
    const legacy = existing.validation || (!existing.image ? existing.relecture : undefined);
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
      if(c.key === 'image') step.assignee = 'Geoffrey';
      if(c.key === 'relecture') step.assignee = 'Service Communication';
      return step;
    });
  }
  function nextNotification(article, key, space) {
    if(isRewrite(article, space)){
      if(key === 'redaction') return { kind:'integration', next:'integration', who:'Marick (intégration)' };
      if(['image', 'validation', 'relecture'].includes(key)) return null;
    }
    if(key === 'redaction' && isPro(article, space)) return null;
    if(key === 'redaction' || key === 'expert') return { kind:'image', next:'image', who:'Geoffrey' };
    if(key === 'image') return { kind:'relecture', next:'relecture', who:'Fannie et Coraline' };
    if(key === 'relecture') return { kind:'integration', next:'integration', who:'Marick (intégration)' };
    if(key === 'integration') return { kind:'published', who:'Geoffrey (article publié)' };
    return null;
  }
  function completeStep(step) {
    if(!step || !/^\d{4}-\d{2}-\d{2}$/.test(step.date || '')) return false;
    step.status = 'done';
    return true;
  }
  root.EditorialPipeline = { isPro, isRewrite, normalizeConfig, configFor, sync, nextNotification, completeStep };
})(globalThis);