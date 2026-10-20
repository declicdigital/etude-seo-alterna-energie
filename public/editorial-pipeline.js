(function (root) {
  const isPro = (article, space) => !space && article.audience === 'Professionnel';
  function configFor(article, config, space) {
    const pro = isPro(article, space);
    return config.filter(c => pro || c.key !== 'expert').map(c => ({
      ...c,
      label: pro && c.key === 'redaction' ? 'Édition' : pro && c.key === 'validation' ? 'Image' : c.label
    }));
  }
  function sync(article, config, space) {
    const existing = Object.fromEntries((article.steps || []).map(s => [s.key, s]));
    if(existing.expert) article.expertStep = existing.expert;
    const published = !!article.blogRowId || existing.integration?.status === 'done';
    article.steps = configFor(article, config, space).map(c => {
      const saved = existing[c.key] || (c.key === 'expert' ? article.expertStep : null);
      const step = saved || { key: c.key, status: c.key === 'expert' && published ? 'skipped' : 'pending', assignee: c.assignee || '', date: '', attachments: [] };
      if(!step.attachments) step.attachments = [];
      if(c.key === 'validation') step.assignee = 'Service Communication';
      return step;
    });
  }
  function nextNotification(article, key, space) {
    if(key === 'redaction' && isPro(article, space)) return null;
    if(key === 'redaction' || key === 'expert') return { kind:'relecture', next:'validation', who:'Service Communication' };
    if(key === 'validation' || key === 'relecture') return { kind:'integration', next:'integration', who:'Marick (intégration)' };
    if(key === 'integration') return { kind:'published', who:'Geoffrey (article publié)' };
    return null;
  }
  root.EditorialPipeline = { isPro, configFor, sync, nextNotification };
})(globalThis);