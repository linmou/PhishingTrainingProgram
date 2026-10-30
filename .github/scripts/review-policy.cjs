'use strict';
// This code must be loaded from the protected base branch, never from a PR.
const BOT = 'chatgpt-codex-connector[bot]';
const control = p => /(^|\/)(AGENTS|REVIEW|CLAUDE)\.md$/i.test(p) ||
  p === '.github/PULL_REQUEST_TEMPLATE.md' || p === 'skills-lock.json' ||
  p.startsWith('.github/workflows/') || p.startsWith('.github/scripts/review-policy') ||
  p.startsWith('.agents/skills/') || p.startsWith('.claude/');
function scope(body) {
  const m = String(body||'').match(/<!--\s*ptp-routine-authorization:v1\s+paths=([^\n>]+?)\s*-->/);
  if (!m) return [];
  const a = m[1].split(',').map(x=>x.trim());
  return a.every(x=>x && !x.startsWith('/') && !x.includes('..') && !x.includes('*') && !x.includes('\\')) ? a : [];
}
const within = (file, p) => p.some(s=>s.endsWith('/') ? file.startsWith(s) : file===s);
function reviewReceipt(comments, sha) {
  const bot = comments.filter(c=>c.user?.login===BOT).sort((a,b)=>String(b.updated_at).localeCompare(String(a.updated_at)));
  for (const c of bot) {
    const m = String(c.body||'').match(/<!--\s*codex-review-state:v1\s+(\{[^\n]*\})\s*-->/);
    if (!m) continue;
    try {
      const s = JSON.parse(m[1]);
      if (s.code_review?.commit_sha===sha && s.code_review?.status==='completed' &&
          typeof s.code_review?.has_unresolved_findings==='boolean' &&
          (!s.security_review || s.security_review.commit_sha===sha && s.security_review.status==='completed')) {
        return {complete:true,unresolved:s.code_review.has_unresolved_findings || Boolean(s.security_review?.has_unresolved_findings)};
      }
    } catch {}
  }
  return {complete:false,unresolved:false};
}
function assess({pr,files,receipt,approvals,routine}) {
  const reasons=[];
  if (pr.draft) reasons.push('Draft PR');
  if (!receipt.complete) reasons.push('Missing current-head Codex review');
  const acceptance = approvals.some(a=>new RegExp('PTP-ACCEPT-FINDINGS:\\s*'+pr.head.sha+'\\s*\\nReason:\\s*.{20,}','i').test(a.body||''));
  if (receipt.unresolved && !acceptance) reasons.push('Unresolved Codex findings need fix or trusted current-head acceptance');
  const human = files.some(control) || /\*\*Risk assessment:\*\*[^\n]*human decision required/i.test(pr.body||'') || !routine;
  if (human && !approvals.length) reasons.push('Independent trusted current-head human approval required');
  return {ok:reasons.length===0,reasons,human};
}
async function trusted(github,owner,repo,login) {
  if (!login || login.endsWith('[bot]')) return false;
  if (login.toLowerCase()===owner.toLowerCase()) return true;
  try {
    const {data}=await github.rest.repos.getCollaboratorPermissionLevel({owner,repo,username:login});
    return ['admin','maintain'].includes(data.permission);
  } catch { return false; }
}
async function evaluate(github,owner,repo,number) {
  const {data:pr}=await github.rest.pulls.get({owner,repo,pull_number:number});
  if (pr.state!=='open' || pr.base.ref!=='no_sign_up') return;
  const changed=await github.paginate(github.rest.pulls.listFiles,{owner,repo,pull_number:number,per_page:100});
  const files=changed.flatMap(f=>[f.filename,...(f.previous_filename?[f.previous_filename]:[])]);
  const [comments,reviews]=await Promise.all([
    github.paginate(github.rest.issues.listComments,{owner,repo,issue_number:number,per_page:100}),
    github.paginate(github.rest.pulls.listReviews,{owner,repo,pull_number:number,per_page:100})
  ]);
  const latest=new Map();
  for(const r of reviews) if(r.user?.login && !['COMMENTED','PENDING'].includes(r.state)) latest.set(r.user.login,r);
  const approvals=[];
  for(const r of latest.values()) if(r.state==='APPROVED' && r.commit_id===pr.head.sha &&
    r.user.login!==pr.user.login && await trusted(github,owner,repo,r.user.login)) approvals.push(r);
  let routine=false;
  const ref=String(pr.body||'').match(/^\s*-\s*\*\*Issue \/ requirement:\*\*[^\n]*?#(\d+)\b/im);
  if(ref && !files.some(control)) {
    try {
      const {data:issue}=await github.rest.issues.get({owner,repo,issue_number:Number(ref[1])});
      const approvedScope=scope(issue.body);
      routine=!issue.pull_request && await trusted(github,owner,repo,issue.user?.login) &&
        approvedScope.length>0 && files.every(f=>within(f,approvedScope));
    } catch {}
  }
  const result=assess({pr,files,receipt:reviewReceipt(comments,pr.head.sha),approvals,routine});
  await publish(github,owner,repo,pr.head.sha,pr.base.sha,number,result);
  return result;
}
async function publish(github,owner,repo,head,base,number,result) {
  await github.rest.checks.create({owner,repo,name:'review-policy',head_sha:head,status:'completed',
    conclusion:result.ok?'success':'action_required',external_id:'pr:'+number+':base:'+base,
    output:{title:result.ok?'Review policy satisfied':'Review policy blocked',
      summary:(result.reasons.length?result.reasons.map(s=>'- '+s).join('\n'):'Current-head review and authorization verified')+
       '\n\nExisting CI checks and live staging acceptance remain independent gates.'}});
}
async function run({github,context,core}) {
  const {owner,repo}=context.repo;
  const refresh=context.eventName==='push' || context.eventName==='workflow_dispatch' && !context.payload.inputs?.pr_number;
  const prs=refresh?await github.paginate(github.rest.pulls.list,{owner,repo,state:'open',base:'no_sign_up',per_page:100}):[];
  const number=Number(context.payload.inputs?.pr_number || context.payload.pull_request?.number ||
    (context.payload.issue?.pull_request ? context.payload.issue.number : 0));
  if (!refresh && Number.isSafeInteger(number) && number>0) prs.push({number});
  for(const pr of prs) {
    try {await evaluate(github,owner,repo,pr.number);}
    catch(error) {
      core.error('PR #'+pr.number+': '+error.message);
      const head=pr.head?.sha || context.payload.pull_request?.head?.sha;
      if(head) try {
        await publish(github,owner,repo,head,context.sha,pr.number,{ok:false,reasons:['Policy evaluator failed closed: '+error.message]});
      }catch(e){core.error('Cannot publish failing check: '+e.message);}
      core.setFailed('Review policy evaluation failed for PR #'+pr.number);
    }
  }
}
module.exports={control,scope,within,reviewReceipt,assess,run};
