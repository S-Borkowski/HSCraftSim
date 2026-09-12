/** Edition differences are applied to files, without hiding links in the browser. */
export function readEdition(html) {
  const edition=html.match(/<body\b[^>]*\bdata-edition="(community|website)"/)?.[1];
  if(!edition)throw new Error('The source HTML must declare community or website edition.');
  return edition;
}

export function editionHtml(html,edition) {
  if(!['community','website'].includes(edition))throw new Error('Unknown edition.');
  if(readEdition(html)!=='community')throw new Error('Generate editions from the Community source checkout.');
  if((html.match(/<a\b[^>]*\bdata-community-link\b/g)||[]).length!==2)throw new Error('Expected the About and footer community links.');
  if(edition==='community')return html;
  const website=html.replace('data-edition="community"','data-edition="website"')
    .replace(/<a\b[^>]*\bdata-community-link\b[^>]*>[\s\S]*?<\/a>/g,'')
    .replace(/<p\b[^>]*\bdata-community-note\b[^>]*>[\s\S]*?<\/p>/g,'');
  if(/discord\.gg|Discord|host-name|host-card/i.test(website))throw new Error('Unexpected community or host content remains in Website HTML.');
  return website;
}
