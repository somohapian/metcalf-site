"""Build the public, print-friendly STACK guide from editable content.

Run `python3 scripts/build_field_guide.py` to update the public HTML.
Run `python3 scripts/build_field_guide_pdfs.py` to export all three PDFs.
HTML generation uses only Python's standard library. PDF export requires
reportlab, lxml and pypdf; it does not require a browser.
No network assets are used in the standalone print input.
"""
from pathlib import Path
import re
import sys
import argparse

ROOT = Path(__file__).resolve().parents[1]
PAGES = [
('start', 'A practical guide to hiring', 'The STACK Method', '''
<p class="lede">Find the right people. Keep the process moving. Make decisions from evidence. Help the hire work out.</p>
<p>STACK is our five-part hiring method. Hiring gets easier to manage when each part has a clear next step. Use this guide to prepare for a search, compare notes with your team, and follow through after someone starts.</p>
<nav aria-label="Guide contents"><h2>Five parts of the work</h2><ol class="contents">
<li><a href="#source">Source</a><span>Find people who can do the work.</span></li>
<li><a href="#tempo">Tempo</a><span>Give every next step an owner and a date.</span></li>
<li><a href="#assess">Assess</a><span>Connect experience to the job in front of you.</span></li>
<li><a href="#close">Close</a><span>Understand the move before making the offer.</span></li>
<li><a href="#keep">Keep</a><span>Stay connected, make work better, follow through.</span></li>
</ol><h2>Print a working sheet</h2><p><a href="#interview-worksheet">Interview worksheet</a> · <a href="#candidate-tracker">Candidate follow-up tracker</a><br><a href="#check-in">Regular check-in worksheet</a> · <a href="#concern">Concern and follow-through worksheet</a></p></nav>
<div class="note"><h2>Use it yourself or with your team</h2><p>These are working prompts, not a formula that guarantees a hire. Choose questions and checks that fit the actual job. Keep factual notes and distinguish what you know from what you still need to check.</p></div>
<p class="small">Prepared by Metcalf Search. Updated November 15, 2026.<br>Full guides: <a href="https://metcalfsearch.com/stack-method">metcalfsearch.com/stack-method</a></p>
'''),
('source', '01 / Source', 'Find people who can do the work.', '''
<p class="lede">Start with the work you need done. Then choose where to look.</p>
<h2>Define the opening</h2><p>Write down the important outcomes, the skills needed on day one, and what someone can learn. Be clear about pay, schedule, location and the daily work. Separate a real requirement from a preference.</p>
<h2>Use more than one route</h2><ul>
<li>Post a clear description where people with relevant experience are likely to look.</li>
<li>Contact people whose work suggests a possible fit. Explain why you reached out and give them an easy way to decline.</li>
<li>Ask employees and trusted contacts for referrals. Describe the work, not just the title.</li>
<li>Give interested people a useful careers page with the opening, practical details and a clear way to apply.</li>
</ul>
<h2>Review what each channel produces</h2><p>Count relevant conversations and candidates who meet the agreed criteria. A large application count alone does not tell you whether the channel is working. Adjust the message or channel when the evidence calls for it.</p>
<div class="note"><h2>Before you spend more</h2><p>If applicants keep missing the same requirement, check whether the posting makes that requirement clear. If suitable people decline, ask what made the role unattractive. The problem may be the offer, not the advertising.</p></div>
<h2>Decide before launch</h2><p>What must this person accomplish? What will you teach? Which channels will you try first? Who will review the results, and when?</p>
<p class="guide-link">Read the full guide: <a href="https://metcalfsearch.com/source">metcalfsearch.com/source</a></p>
'''),
('tempo', '02 / Tempo', 'Keep the next step clear.', '''
<p class="lede">Candidates should know what happens next. Your team should know who owns it.</p>
<h2>Set the process before interviews begin</h2><p>Agree on the interview stages, decision-makers, checks and offer approvals. Reserve time for feedback. Keep the process proportionate to the role.</p>
<h2>Keep one useful record</h2><ul>
<li>Candidate and role.</li><li>Current stage and the latest conversation.</li><li>Next action, owner and promised date.</li><li>Questions still open and the information needed to answer them.</li>
</ul>
<h2>Use a dependable rhythm</h2><p>Acknowledge suitable applicants promptly. Collect interview feedback within twenty-four hours when possible. Tell the candidate when they should hear from you, even if the next update is that a decision needs more time.</p>
<p>Send a written offer after the necessary checks and approvals are complete. Speed should remove waiting and repeated work, not skip a useful check.</p>
<div class="note"><h2>When a step stalls</h2><p>Name the missing decision or information. Give it an owner and a realistic date. Update the candidate before the promised response date passes.</p></div>
<h2>A useful weekly review</h2><p>Which candidates are waiting? What did we promise? Which role has no next action? Which approval could delay an offer?</p>
<p><a href="#candidate-tracker">Use the blank candidate follow-up tracker</a>.</p>
<p class="guide-link">Read the full guide: <a href="https://metcalfsearch.com/tempo">metcalfsearch.com/tempo</a></p>
'''),
('assess', '03 / Assess', 'Ask for evidence. Then test the transfer.', '''
<p class="lede">A familiar job title is a starting point. Find out what the person can do in your job.</p>
<h2>Use the Behavioral Bridge</h2><p>Connect a real past example to the work in your role.</p><ol>
<li><strong>Start with a specific past example.</strong> What happened, what did the candidate do, and what was the result?</li>
<li><strong>Identify the skill.</strong> How did they set priorities, make a decision or solve the problem?</li>
<li><strong>Apply it to your job.</strong> Describe a concrete task they would face and ask how they would use that approach.</li>
<li><strong>Ask what must change.</strong> What is different here? What would they need to learn or get help with?</li>
</ol>
<div class="note"><h2>Illustrative example</h2><p>A dispatcher candidate has managed retail schedules. Ask about a day when someone called out. Then ask how they would handle a missing technician, a full schedule and an urgent service call. Explore travel time, required skills and what information they would need.</p></div>
<h2>Keep separate questions separate</h2><p>Can they do the work? Do they want it? Will the working environment suit them? How do they take responsibility when things go wrong? For accountability, ask what they could influence, what they did and what happened.</p>
<h2>Record evidence against agreed criteria</h2><p>Use consistent core questions and role-related rating criteria. Add a short relevant work sample or references where useful. Record gaps and follow-up questions before discussing the candidate with others. A total score, personality label, or whether a candidate says I or we should not decide the hire.</p>
<p><a href="#interview-worksheet">Use the blank interview worksheet</a> or <a href="https://apply.ms/help/samples/scorecard/">view and print an example scorecard</a>.</p>
<p class="guide-link">Read the full guide: <a href="https://metcalfsearch.com/assess">metcalfsearch.com/assess</a></p>
'''),
('close', '04 / Close', 'Understand the move before the offer.', '''
<p class="lede">A good offer answers the candidate's real questions about the work and the change.</p>
<h2>Ask what would make the move worthwhile</h2><p>Discuss pay, schedule, responsibilities, manager support, location and the opportunity to learn. Ask which details matter most. Do not assume a higher salary resolves every concern.</p>
<h2>Confirm the details</h2><ul>
<li>Role, reporting relationship and work location.</li><li>Pay, incentives and any conditions that affect them.</li><li>Schedule, travel and other practical expectations.</li><li>Benefits details and when eligibility begins.</li><li>Start date, required checks and who will answer questions.</li>
</ul>
<h2>Talk through hesitation</h2><p>Ask what is still unresolved and what other options the candidate is considering. Discuss how they would think about a counteroffer before one arrives. Give them room to make a considered decision.</p>
<div class="note"><h2>Illustrative example</h2><p>A candidate wants a more dependable schedule. Confirm the actual hours and how last-minute changes are handled before sending an offer. A vague promise now can become a problem after they start.</p></div>
<h2>Stay connected after acceptance</h2><p>Confirm the first-day plan and a contact for questions. Prepare the manager, tools, access and introductions. Check in during the notice period without pressuring the person to ignore their current obligations.</p>
<p class="guide-link">Read the full guide: <a href="https://metcalfsearch.com/close">metcalfsearch.com/close</a></p>
'''),
('keep', '05 / Keep', 'Help the work and the relationship last.', '''
<p class="lede">Keep asks two questions regularly: is the work going well, and is this still a job the person wants to keep?</p>
<h2>Stay connected</h2><p>Keep a dependable time to talk. Recognize a specific contribution, ask what is working, and make room for what the employee wants to discuss. Review anything left open from last time.</p>
<p>Support new hires through the first ninety days, then continue regular conversations. Give annual milestones room for progress and growth. Do not save every concern for those dates.</p>
<h2>Make work better</h2><p>Turn what you hear into a practical change: clearer priorities, the right tool, time to practice or a new responsibility. Explain when a request cannot be met. The manager owns expectations and support. The employee owns the agreed work, questions and next steps.</p>
<h2>Follow through</h2><p>Record the promise, its owner and a review date. Return to it next time. If something is delayed, agree on what happens next.</p>
<div class="note"><h2>Check the effect, not just the action</h2><p>Finishing training does not establish that the work is going better. Ask what changed, what each person has observed and what remains unresolved before closing an issue.</p></div>
<h2>When a concern needs a closer look</h2><p>Describe the expected work and specific observations. Separate firsthand facts from reports and assumptions. Hear both perspectives and check expectations, resources, training and support before deciding what needs to change.</p>
<p><a href="#check-in">Use the regular check-in sheet</a> or <a href="#concern">use the concern and follow-through sheet</a>. Both work without hiring software.</p>
<p class="guide-link">Read the full guide: <a href="https://metcalfsearch.com/keep">metcalfsearch.com/keep</a></p>
'''),
('check-in', 'Keep / Working sheet', 'A regular check-in', '''
<p class="lede">Use for a new hire or an established employee. Hear both perspectives.</p>
<div class="fields"><div>Employee / role<span></span></div><div>Manager / date<span></span></div></div>
<h2>What is going well?</h2><p class="prompt">Name a contribution worth recognizing. Ask how the person feels about the work.</p><div class="write lines-2" aria-label="Space for notes"></div>
<h2>What would make the job better?</h2><p class="prompt">Consider priorities, tools, support, learning and responsibilities. Record both perspectives.</p><div class="write lines-2" aria-label="Space for notes"></div>
<h2>What remains open from last time?</h2><p class="prompt">What changed after the last action? What still needs attention?</p><div class="write lines-2" aria-label="Space for notes"></div>
<h2>Agree on the next step</h2><table><caption>Commitments to review together</caption><thead><tr><th>Action or promise</th><th>Owner</th><th>Review date</th></tr></thead><tbody><tr><td>&nbsp;</td><td></td><td></td></tr><tr><td>&nbsp;</td><td></td><td></td></tr></tbody></table>
<p class="prompt">Next conversation: <span class="worksheet-blank" aria-hidden="true">____________________</span></p><p class="small">Need a deeper conversation? Use the <a href="#concern">concern and follow-through worksheet</a>. Keep notes factual and share them only with people who need them.</p>
'''),
('concern', 'Keep / Working sheet', 'Understand a concern. Check the change.', '''
<div class="fields"><div>Employee / role<span></span></div><div>Manager / date<span></span></div></div>
<h2>What was expected, and what happened?</h2><p class="prompt">Record specific observations. Label secondhand reports and assumptions separately.</p><div class="write lines-2" aria-label="Space for notes"></div>
<h2>What does each person say?</h2><p class="prompt">Hear the employee and manager. What still needs to be checked?</p><div class="write lines-2" aria-label="Space for notes"></div>
<h2>What could be getting in the way?</h2><p class="prompt">Check clarity, priorities, tools, training, resources and manager support.</p><div class="write lines-2" aria-label="Space for notes"></div>
<h2>What will change, and how will we review it?</h2><table><caption>Actions and evidence of improvement</caption><thead><tr><th>Action / owner</th><th>Review date</th><th>What improvement will we look for?</th></tr></thead><tbody><tr><td>&nbsp;</td><td></td><td></td></tr><tr><td>&nbsp;</td><td></td><td></td></tr></tbody></table>
<h2>At the review</h2><p class="prompt">What actually changed? What remains unresolved? Agree on any further action.</p><div class="write lines-2" aria-label="Space for notes"></div>
<p class="small">An action can be complete while the concern remains open. Record the effect before closing it.</p>
''')]


PAGES.extend([
('interview-worksheet', 'Assess / Working sheet 1 of 2', 'Connect experience to this job.', '''
<p class="lede">Prepare one real task and the same core questions for each candidate.</p>
<p class="small"><a href="/interview-worksheet.pdf">Download this two-page interview worksheet</a></p>
<div class="fields"><div>Candidate / role<span></span></div><div>Interviewer / date<span></span></div></div>
<h2>Prepare the task and essential requirements</h2><p class="prompt">What must they do on day one? What can be taught? Describe an actual task in this job.</p><div class="write lines-3" aria-label="Space for notes"></div>
<h2>1. Start with a specific example</h2><p class="prompt">Tell me about a time you faced similar work. What was the situation and the goal?</p><div class="write lines-2" aria-label="Space for notes"></div>
<h2>2. Understand their action and result</h2><p class="prompt">What did you personally do? Why? What happened, and how did you know? What skill did you use?</p><div class="write lines-3" aria-label="Space for notes"></div>
<h2>3. Apply it to our task</h2><p class="prompt">Here is the task we prepared. How would you approach it? What would you do first, and why?</p><div class="write lines-3" aria-label="Space for notes"></div>
<h2>4. Ask what changes</h2><p class="prompt">What is different here? What would you adapt, learn, or ask for help with?</p><div class="write lines-2" aria-label="Space for notes"></div>
<p class="small">Continue with <a href="#interview-evidence">criteria, evidence and open questions</a>. Keep notes about the work, using specific facts and examples.</p>
'''),
('interview-evidence', 'Assess / Working sheet 2 of 2', 'Compare evidence with the criteria.', '''
<div class="fields"><div>Candidate / role<span></span></div><div>Interviewer / date<span></span></div></div>
<p class="prompt">Agree on role-related criteria before interviewing. Use the same core questions and criteria for each candidate. Define any rating scale before using it.</p>
<h2>Check four separate areas</h2><ul>
<li><strong>Can:</strong> Can they do the essential work? What evidence shows it?</li>
<li><strong>Will:</strong> Do they want the actual work, schedule and responsibilities?</li>
<li><strong>Fit:</strong> Do the working conditions and support match what they need?</li>
<li><strong>Accountability:</strong> What could they influence, what did they do, and what did they learn?</li>
</ul>
<p class="small">Fit means the working environment, not similarity to the interviewer. A personality label, total score, or whether a candidate says I or we should not decide the hire.</p>
<table class="evidence-table"><caption>Record evidence before discussing an overall decision</caption><thead><tr><th>Agreed criterion / area</th><th>Specific evidence</th><th>Unknown / how to check</th></tr></thead><tbody><tr><td>&nbsp;</td><td></td><td></td></tr><tr><td>&nbsp;</td><td></td><td></td></tr><tr><td>&nbsp;</td><td></td><td></td></tr><tr><td>&nbsp;</td><td></td><td></td></tr></tbody></table>
<h2>What still needs to be checked?</h2><p class="prompt">Name a useful follow-up question, relevant work sample or reference check. Who owns it, and by when?</p><div class="write lines-3" aria-label="Space for notes"></div>
<h2>What did the candidate ask or need clarified?</h2><div class="write lines-2" aria-label="Space for notes"></div>
<p class="small">Record only necessary, job-related information. Share notes only with people involved in the decision. Return to the <a href="#interview-worksheet">interview prompts</a>.</p>
'''),
('candidate-tracker', 'Tempo / Working sheet', 'Keep the next promise visible.', '''
<p class="lede">Use one sheet per candidate. Review open actions before the next update is due.</p>
<p class="small"><a href="/candidate-tracker.pdf">Download this one-page candidate follow-up tracker</a></p>
<div class="fields"><div>Candidate / role<span></span></div><div>Current stage / record owner<span></span></div></div>
<div class="fields"><div>Last conversation / date<span></span></div><div>Next candidate update due<span></span></div></div>
<h2>What did we promise?</h2><p class="prompt">Write the next action, who owns it, and a realistic due date. Record what the candidate was told and when. Update them even if a decision needs more time.</p>
<table class="tracker-table"><caption>Actions and candidate updates</caption><thead><tr><th>Next action</th><th>Owner</th><th>Due date</th><th>Update sent / date / outcome</th></tr></thead><tbody><tr><td>&nbsp;</td><td></td><td></td><td></td></tr><tr><td>&nbsp;</td><td></td><td></td><td></td></tr><tr><td>&nbsp;</td><td></td><td></td><td></td></tr><tr><td>&nbsp;</td><td></td><td></td><td></td></tr><tr><td>&nbsp;</td><td></td><td></td><td></td></tr></tbody></table>
<h2>What is still open or waiting?</h2><p class="prompt">Name the missing information or decision. Add its next action and owner above.</p><div class="write lines-2" aria-label="Space for notes"></div>
<h2>Factual notes from the latest conversation</h2><div class="write lines-2" aria-label="Space for notes"></div>
<p class="small">Keep only information needed to manage this hiring process. Avoid unnecessary personal details. Share the sheet only with people who need it, and follow your record-retention practice.</p>
''')])

CSS = '''
@page{size:letter;margin:0}
*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:#e8ece9;color:#26382e;font:16px/1.55 Arial,sans-serif}
a{color:#294f43;text-decoration:underline;text-underline-offset:3px}a:focus-visible{outline:3px solid #26382e;outline-offset:4px}
.skip{display:block;max-width:8.5in;margin:12px auto}.page{background:#fff;width:8.5in;min-height:11in;margin:24px auto;padding:.55in .65in .65in;position:relative;box-shadow:0 2px 14px #26382e18}
.brand{display:flex;justify-content:space-between;border-bottom:1px solid #a3b2a8;padding-bottom:12px;font-size:11px;letter-spacing:1.5px;text-transform:uppercase}
.eyebrow{font-size:11px;letter-spacing:1.6px;text-transform:uppercase;font-weight:bold;color:#4b6556;margin:26px 0 12px}
h1,h2{font-family:Georgia,serif;font-weight:normal}h1{font-size:37px;line-height:1.12;letter-spacing:-.7px;margin:0 0 18px}h2{font-size:20px;line-height:1.25;margin:20px 0 8px}p{margin:0 0 11px}.lede{font:20px/1.4 Georgia,serif;color:#42594b;margin-bottom:22px}
ul,ol{padding-left:23px;margin:8px 0 17px}li{padding-left:3px;margin:6px 0}.note{border-left:3px solid #839b89;background:#f2f5f2;padding:2px 15px 3px;margin:19px 0}.note h2{margin-top:13px}.note p{font-size:14px}.small,.guide-link{font-size:12px;line-height:1.5}.guide-link{margin-top:22px}.contents{list-style:none;padding:0}.contents li{display:flex;gap:18px;border-bottom:1px solid #d5ddd6;padding:10px 0;margin:0}.contents a{width:90px;font:22px Georgia,serif}.contents span{font-size:14px;align-self:center}
.footer{position:absolute;bottom:.29in;left:.65in;right:.65in;border-top:1px solid #d5ddd6;padding-top:9px;display:flex;justify-content:space-between;gap:12px;font-size:10px;line-height:1.4}.footer a{color:inherit}.fields{display:flex;gap:25px;margin:20px 0}.fields>div{width:50%;font-size:12px}.fields span{display:block;border-bottom:1px solid #89998e;height:25px}.prompt{font-size:13px;line-height:1.4;margin-bottom:3px}.write{background:repeating-linear-gradient(to bottom,transparent 0,transparent 23px,#c2cec5 23px,#c2cec5 24px);margin-bottom:8px}.lines-2{height:48px}.lines-3{height:72px}.evidence-table td,.tracker-table td{height:55px}.evidence-table th:first-child{width:30%}.tracker-table th:first-child{width:32%}.tracker-table th:nth-child(2),.tracker-table th:nth-child(3){width:15%}table{border-collapse:collapse;width:100%;font-size:12px;margin:10px 0 14px}caption{text-align:left;font-size:12px;margin-bottom:6px}th,td{text-align:left;border:1px solid #a4b4a9;padding:9px}th{background:#f2f5f2;font-weight:bold}td{height:35px}th:first-child{width:48%}
@media(max-width:850px){.page{width:auto;min-height:0;margin:12px;padding:28px 24px}.footer{position:static;margin-top:35px;flex-wrap:wrap}h1{font-size:32px}.skip{margin:12px}.contents li{display:block}.contents span{display:block;margin-top:6px}.fields{flex-wrap:wrap}.fields>div{width:100%}}
@media print{html{scroll-behavior:auto}body{background:#fff;font-size:10.7pt;line-height:1.47}.skip{display:none}.page{width:8.5in;height:11in;min-height:0;margin:0;box-shadow:none;break-after:page;overflow:visible}.page:last-child{break-after:auto}h1{font-size:28pt}h2{font-size:15pt}.lede{font-size:15pt}.note p{font-size:10pt}.eyebrow{margin-top:22px}a{color:inherit}.footer{position:absolute}*{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
'''

def build(print_output=None, print_only=False):
    sections=[]
    for number,(ident,eyebrow,title,body) in enumerate(PAGES,1):
        heading='h1' if number==1 else 'h2'
        if number>1:
            body=body.replace('<h2>','<h3>').replace('</h2>','</h3>')
        sections.append(f'''<section class="page" id="{ident}" aria-labelledby="{ident}-title"><div class="brand"><span>Metcalf Search</span><span>The STACK Method</span></div><p class="eyebrow">{eyebrow}</p><{heading} class="chapter-title" id="{ident}-title">{title}</{heading}>{body}<footer class="footer"><span><a href="mailto:info@metcalfsearch.com">info@metcalfsearch.com</a> · <a href="tel:+16144346646">614.434.6646</a></span><span>STACK field guide · {number} / {len(PAGES)}</span></footer></section>''')
    css=CSS+'''@media print{#interview-worksheet,#interview-evidence,#candidate-tracker{font-size:10pt;line-height:1.4}#interview-worksheet h3,#interview-evidence h3,#candidate-tracker h3{font-size:13pt;margin:9pt 0 4pt}#interview-worksheet .chapter-title,#interview-evidence .chapter-title,#candidate-tracker .chapter-title{font-size:24pt}#interview-worksheet .fields,#interview-evidence .fields,#candidate-tracker .fields{margin:9pt 0}#interview-worksheet .write,#interview-evidence .write,#candidate-tracker .write{background:repeating-linear-gradient(to bottom,transparent 0,transparent 16.5pt,#c2cec5 16.5pt,#c2cec5 17pt)}#interview-worksheet .lines-2,#interview-evidence .lines-2,#candidate-tracker .lines-2{height:34pt}#interview-worksheet .lines-3,#interview-evidence .lines-3{height:51pt}.evidence-table td{height:38pt}.tracker-table td{height:36pt}}h3{font:normal 20px/1.25 Georgia,serif;margin:20px 0 8px}.chapter-title{font:normal 37px/1.12 Georgia,serif;letter-spacing:-.7px;margin:0 0 18px}@media print{.page{height:10.99in;break-inside:avoid}.chapter-title{font-size:28pt}h3{font-size:15pt}#start .contents li{padding:7px 0}#start h2{margin-top:15px}}'''
    html='''<!doctype html><html lang="en-US"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>The STACK Method field guide | Metcalf Search</title><meta name="description" content="A practical, printable guide to finding candidates, interviewing, offers and employee retention, with interview, candidate follow-up and Keep worksheets."><link rel="canonical" href="https://metcalfsearch.com/stack-field-guide"><style>'''+CSS+'''</style></head><body><a class="skip" href="#start">Skip to the field guide</a><main>'''+''.join(sections)+'''</main></body></html>'''
    html=html.replace('<style>'+CSS,'<style>'+css)
    if print_output:
        Path(print_output).write_text(html)
    if print_only:
        return
    shell=(ROOT/'stack-method.html').read_text()
    head=shell.split('</head>')[0]
    head=re.sub(r'<title>.*?</title>','<title>The STACK Method field guide | Metcalf Search</title>',head)
    head=re.sub(r'<meta (?:name|property)="(?:description|og:description|twitter:description)"[^>]*>', '',head)
    head=re.sub(r'<meta property="og:url"[^>]*>', '',head)
    head=re.sub(r'<meta (?:name|property)="(?:og:title|twitter:title)"[^>]*>', '',head)
    head=re.sub(r'<link rel="canonical"[^>]*>', '<link rel="canonical" href="https://metcalfsearch.com/stack-field-guide">',head)
    head=re.sub(r'<script type="application/ld\+json">.*?</script>','',head,flags=re.S)
    before=shell.split('<body>',1)[1].split('<main',1)[0]
    after=shell.split('</main>',1)[1]
    def scoped(styles):
        result=''
        while styles.strip():
            opening=styles.index('{'); selector=styles[:opening].strip(); depth=1; end=opening+1
            while depth:
                if styles[end]=='{':depth+=1
                elif styles[end]=='}':depth-=1
                end+=1
            body=styles[opening+1:end-1]
            if selector.startswith('@media'):
                result+=selector+'{'+scoped(body)+'}'
            elif selector.startswith('@'):
                result+=selector+'{'+body+'}'
            else:
                selectors=[]
                for s in selector.split(','):
                    s=s.strip()
                    selectors.append('.field-guide' if s in ('body','html') else '.field-guide '+s)
                result+=','.join(selectors)+'{'+body+'}'
            styles=styles[end:]
        return result
    public=head+'''<meta name="description" content="A practical, printable guide to finding candidates, interviewing, offers and employee retention, with interview, candidate follow-up and Keep worksheets."><style>'''+scoped(css)+'''.field-guide .brand{height:auto;display:flex}.field-guide p,.field-guide li{font-family:Arial,sans-serif}.field-guide .page{color:#26382e}.field-guide .chapter-title{max-width:none}.field-guide .footer{background:#fff}.field-guide h2,.field-guide h3{color:#26382e}.field-guide .download{max-width:8.5in;margin:20px auto;padding:0 24px}@media print{body>nav,body>.skip-link,body>footer,.field-guide .download{display:none!important}.field-guide{background:white}.field-guide .page{margin:0}.field-guide .footer{display:flex}} </style></head><body>'''+before+'''<main id="main-content" tabindex="-1" class="field-guide"><p class="download"><a href="/stack-field-guide.pdf">Download the printable PDF</a> · <a href="/stack-method">Browse the full hiring guides</a></p>'''+''.join(sections)+'''</main>'''+after
    public=public.replace('</style></head>', '.field-guide .page{color-scheme:light;--ink:#26382e;--ink-soft:#42594b;--ink-faint:#4b6556;--paper:#fff;--paper-warm:#f2f5f2}.field-guide .page p{color:#26382e}.field-guide .page .lede{color:#42594b}.field-guide .page .eyebrow{color:#4b6556}</style></head>')
    public=re.sub(r'(/assets/theme\.css)\?v=[^"]+', r'\1?v=20261116-worksheets', public)
    (ROOT/'stack-field-guide.html').write_text(public)
    print(ROOT/'stack-field-guide.html')

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--finalize-pdf',action='store_true')
    parser.add_argument('--print-output',type=Path)
    parser.add_argument('--print-only',action='store_true')
    args=parser.parse_args()
    if args.print_only and not args.print_output:
        parser.error('--print-only requires --print-output')
    if args.finalize_pdf:
        from pypdf import PdfReader, PdfWriter
        path=ROOT/'stack-field-guide.pdf'
        reader=PdfReader(path)
        writer=PdfWriter()
        writer.clone_document_from_reader(reader)
        writer.add_metadata({'/Title':'The STACK Method field guide','/Author':'Metcalf Search','/Subject':'Practical hiring and employee retention guide with Keep worksheets'})
        with path.open('wb') as stream:
            writer.write(stream)
    else:
        build(args.print_output,args.print_only)
