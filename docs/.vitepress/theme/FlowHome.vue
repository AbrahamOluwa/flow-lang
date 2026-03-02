<script setup>
import { onMounted } from "vue";

onMounted(() => {
    const observer = new IntersectionObserver(
        (entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    entry.target.classList.add("visible");
                    observer.unobserve(entry.target);
                }
            });
        },
        { threshold: 0.1, rootMargin: "0px 0px -40px 0px" },
    );
    document.querySelectorAll(".fade-in").forEach((el) => observer.observe(el));
});
</script>

<template>
    <div class="flow-home">
        <!-- ===== HERO ===== -->
        <section class="fh-hero">
            <div class="fh-container">
                <div class="fh-badge fade-in">
                    <span class="fh-badge-dot"></span>
                    Open source &middot; MIT license
                </div>

                <h1 class="fh-hero-title fade-in">
                    Business rules that
                    <span class="fh-gradient-text">run, not rot</span>
                </h1>

                <p class="fh-hero-sub fade-in">
                    Flow is a language for writing, reviewing, and running
                    business decisions as plain text. One file. Executable.
                    Versioned. Auditable.
                </p>

                <div class="fh-hero-actions fade-in">
                    <a href="/flow-lang/guide/getting-started" class="fh-btn-primary"
                        >Get started &rarr;</a
                    >
                    <a href="/flow-lang/playground/" class="fh-btn-secondary"
                        >Try in Playground</a
                    >
                </div>

                <div class="fh-install fade-in">
                    <div class="fh-install-cmd">
                        <span class="fh-prompt">$</span> npm install -g
                        flow-lang
                    </div>
                </div>
            </div>
        </section>

        <!-- ===== PROBLEM ===== -->
        <section class="fh-section fh-section-alt" id="problem">
            <div class="fh-container">
                <div class="fh-section-label fade-in">The problem</div>
                <h2 class="fh-section-title fade-in">
                    Business logic lives in too many places
                </h2>
                <p class="fh-section-lead fade-in">
                    Documents say one thing. Code does another. The real rules
                    live in someone's head. When that person leaves, the rules
                    leave with them.
                </p>

                <div class="fh-problem-grid">
                    <div class="fh-problem-card fade-in" data-accent="red">
                        <div class="fh-problem-icon">&#x1F4C4;</div>
                        <h3>The document</h3>
                        <p>
                            A Notion doc describes the process. It was accurate
                            six months ago. Nobody has updated it since the last
                            three changes went live.
                        </p>
                    </div>
                    <div class="fh-problem-card fade-in" data-accent="amber">
                        <div class="fh-problem-icon">&#x1F9D1;&#x200D;&#x1F4BB;</div>
                        <h3>The code</h3>
                        <p>
                            An engineer translated the doc into Python. It's
                            been patched twice. The patches aren't in the doc.
                            Only the engineer knows what it actually does.
                        </p>
                    </div>
                    <div class="fh-problem-card fade-in" data-accent="purple">
                        <div class="fh-problem-icon">&#x1F4AC;</div>
                        <h3>The Slack message</h3>
                        <p>
                            The ops lead clarified an edge case in a thread last
                            quarter. It never made it into the doc or the code.
                            It lives in Slack search.
                        </p>
                    </div>
                    <div class="fh-problem-card fade-in" data-accent="red">
                        <div class="fh-problem-icon">&#x1F916;</div>
                        <h3>The AI agent</h3>
                        <p>
                            An AI model scores fraud risk, but the confidence
                            thresholds and escalation rules are buried in the
                            codebase. No one outside engineering knows when
                            transactions get blocked.
                        </p>
                    </div>
                </div>
            </div>
        </section>

        <!-- ===== SOLUTION ===== -->
        <section class="fh-section" id="solution">
            <div class="fh-container">
                <div class="fh-section-label fade-in" style="text-align: center">
                    The solution
                </div>
                <h2
                    class="fh-section-title fade-in"
                    style="text-align: center"
                >
                    The document becomes the execution
                </h2>
                <p class="fh-section-lead fade-in" style="text-align: center; max-width: 640px; margin-left: auto; margin-right: auto">
                    A
                    <code class="fh-inline-code">.flow</code>
                    file is simultaneously a process document anyone can read
                    and an executable program that runs the same way every time.
                </p>

                <div class="fh-code-comparison">
                    <div class="fade-in">
                        <div class="fh-comp-label fh-comp-before">
                            BEFORE &mdash; Logic scattered everywhere
                        </div>
                        <div class="fh-code-panel">
                            <div class="fh-code-header">
                                <span class="fh-dot fh-dot-r"></span>
                                <span class="fh-dot fh-dot-y"></span>
                                <span class="fh-dot fh-dot-g"></span>
                                <span class="fh-code-filename"
                                    >scattered-logic</span
                                >
                            </div>
                            <pre
                                class="fh-code-body"
                                v-pre
                            ><span class="cm"># The Notion doc says:</span>
<span class="str">"Block transactions over $5,000. Flag anything
 the AI scores above 70%."</span>

<span class="cm"># The Python code says:</span>
<span class="kw">if</span> txn[<span class="str">"amount"</span>] &gt; <span class="num">10000</span>:  <span class="cm"># was 5000</span>
    <span class="fn">raise</span> FraudBlock(<span class="str">"high_value"</span>)
<span class="kw">if</span> ai_score &gt; <span class="num">0.75</span>:  <span class="cm"># changed in PR #891</span>
    flag_for_review(txn)

<span class="cm"># The Slack thread says:</span>
<span class="str">"We raised the threshold to 10k last month
 after too many false positives"</span>

<span class="cm"># Nobody knows which rules are live.</span></pre>
                        </div>
                    </div>
                    <div class="fade-in">
                        <div class="fh-comp-label fh-comp-after">
                            AFTER &mdash; One source of truth
                        </div>
                        <div class="fh-code-panel">
                            <div class="fh-code-header">
                                <span class="fh-dot fh-dot-r"></span>
                                <span class="fh-dot fh-dot-y"></span>
                                <span class="fh-dot fh-dot-g"></span>
                                <span class="fh-code-filename"
                                    >transaction-fraud.flow</span
                                >
                            </div>
                            <pre
                                class="fh-code-body"
                                v-pre
                            ><span class="kw">services:</span>
    RiskScorer <span class="kw">is an AI using</span> <span class="str">"anthropic/claude-sonnet"</span>
    FraudOps <span class="kw">is a webhook at</span> <span class="str">"https://hooks.slack.com/..."</span>

<span class="kw">step</span> Decision:
    <span class="kw">ask</span> <span class="svc">RiskScorer</span> <span class="kw">to</span> analyze this transaction
        <span class="kw">save the result as</span> assessment
        <span class="kw">save the confidence as</span> ai-confidence

    <span class="kw">if</span> combined-score <span class="kw">is above</span> <span class="num">75</span>:
        <span class="kw">set</span> decision <span class="kw">to</span> <span class="str">"block"</span>
    <span class="kw">otherwise if</span> combined-score <span class="kw">is above</span> <span class="num">40</span>:
        <span class="kw">set</span> decision <span class="kw">to</span> <span class="str">"review"</span>
        notify fraud team <span class="kw">using</span> <span class="svc">FraudOps</span>

<span class="cm"># This file IS the rule.</span>
<span class="cm"># It runs. It's versioned. It's reviewable.</span></pre>
                        </div>
                    </div>
                </div>
            </div>
        </section>

        <!-- ===== WHAT FLOW GIVES YOU ===== -->
        <section class="fh-section fh-section-alt">
            <div class="fh-container">
                <div class="fh-section-label fade-in">What Flow gives you</div>
                <h2 class="fh-section-title fade-in">Prove how your decisions work</h2>
                <p class="fh-section-lead fade-in">
                    Six properties, each earned by design &mdash; not bolted on
                    after the fact.
                </p>

                <div class="fh-pillars">
                    <div class="fh-pillar fade-in">
                        <div class="fh-pillar-icon fh-pillar-cyan">
                            &#x1F4D6;
                        </div>
                        <h3>Readable by anyone</h3>
                        <p>
                            A compliance officer, an ops lead, or a regulator
                            can read a .flow file and understand exactly what
                            the system does. No engineering degree required.
                        </p>
                    </div>
                    <div class="fh-pillar fade-in">
                        <div class="fh-pillar-icon fh-pillar-green">
                            &#x26A1;
                        </div>
                        <h3>Executable as written</h3>
                        <p>
                            The same file that documents the process runs in
                            production. The specification is the implementation.
                            They can't drift apart.
                        </p>
                    </div>
                    <div class="fh-pillar fade-in">
                        <div class="fh-pillar-icon fh-pillar-amber">
                            &#x1F50D;
                        </div>
                        <h3>Auditable by default</h3>
                        <p>
                            Every execution produces a structured log. Every
                            change lives in Git with full attribution. You
                            don't prepare for audits &mdash; you're always ready.
                        </p>
                    </div>
                    <div class="fh-pillar fade-in">
                        <div class="fh-pillar-icon fh-pillar-purple">
                            &#x1F916;
                        </div>
                        <h3>AI, governed</h3>
                        <p>
                            AI is a named participant with explicit instructions,
                            confidence thresholds, and fallback rules &mdash; all
                            visible in the file. Not a black box.
                        </p>
                    </div>
                    <div class="fh-pillar fade-in">
                        <div class="fh-pillar-icon fh-pillar-red">
                            &#x1F512;
                        </div>
                        <h3>Secure by design</h3>
                        <p>
                            Seven constructs. No imports, no shell commands, no
                            filesystem access. A .flow file can only do what it
                            explicitly declares. The blast radius is contained.
                        </p>
                    </div>
                    <div class="fh-pillar fade-in">
                        <div class="fh-pillar-icon fh-pillar-pink">
                            &#x1F4C1;
                        </div>
                        <h3>You own the file</h3>
                        <p>
                            Plain text in your Git repo. No platform dependency.
                            No vendor lock-in. No subscription required to read
                            your own business logic.
                        </p>
                    </div>
                </div>
            </div>
        </section>

        <!-- ===== TEAMS ===== -->
        <section class="fh-section" id="teams">
            <div class="fh-container">
                <div class="fh-section-label fade-in">How teams use Flow</div>
                <h2 class="fh-section-title fade-in">
                    Each team does what they're best at
                </h2>
                <p class="fh-section-lead fade-in">
                    Flow doesn't replace engineers. It frees them. The ops team
                    owns the logic. Engineers own the infrastructure.
                </p>

                <div class="fh-teams-grid">
                    <div class="fh-team-card fade-in">
                        <div class="fh-team-role fh-role-cyan">Operations</div>
                        <h3>Write and own the rules</h3>
                        <p>
                            Ops teams write and maintain
                            <code class="fh-inline-code">.flow</code>
                            files. When a process changes, they change the file.
                            No Jira ticket. No waiting for a sprint. The people
                            who understand the process own the process.
                        </p>
                    </div>
                    <div class="fh-team-card fade-in">
                        <div class="fh-team-role fh-role-green">
                            Engineering
                        </div>
                        <h3>Build services, review logic</h3>
                        <p>
                            Engineers build the APIs and connectors that Flow
                            calls. They review
                            <code class="fh-inline-code">.flow</code>
                            files in pull requests like any other code. They
                            stop being bottlenecked by business logic changes.
                        </p>
                    </div>
                    <div class="fh-team-card fade-in">
                        <div class="fh-team-role fh-role-amber">Compliance</div>
                        <h3>Read the actual rules</h3>
                        <p>
                            When an auditor asks "how do you make this
                            decision?" &mdash; hand them the
                            <code class="fh-inline-code">.flow</code>
                            file. They can read it. Try handing them 400 lines
                            of Python.
                        </p>
                    </div>
                </div>
            </div>
        </section>

        <!-- ===== COMPARISON TABLE ===== -->
        <section class="fh-section fh-section-alt">
            <div class="fh-container">
                <div class="fh-section-label fade-in" style="color: var(--fh-amber)">How Flow compares</div>
                <h2 class="fh-section-title fade-in">Not another automation tool</h2>
                <p class="fh-section-lead fade-in">
                    Flow doesn't compete with Zapier for simple automations or
                    with Python for general programming. Flow governs the
                    decisions that matter.
                </p>

                <div style="overflow-x: auto" class="fade-in">
                    <table class="fh-comp-table">
                        <thead>
                            <tr>
                                <th>Capability</th>
                                <th class="fh-flow-col">Flow</th>
                                <th>AI Agent Platforms</th>
                                <th>Zapier / n8n</th>
                                <th>Python</th>
                                <th>Documents</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td>Non-engineer can read it</td>
                                <td class="fh-flow-col fh-yes">Yes</td>
                                <td class="fh-partial">Varies</td>
                                <td class="fh-partial">Partially</td>
                                <td class="fh-no">No</td>
                                <td class="fh-yes">Yes</td>
                            </tr>
                            <tr>
                                <td>Actually executes</td>
                                <td class="fh-flow-col fh-yes">Yes</td>
                                <td class="fh-yes">Yes</td>
                                <td class="fh-yes">Yes</td>
                                <td class="fh-yes">Yes</td>
                                <td class="fh-no">No</td>
                            </tr>
                            <tr>
                                <td>Deterministic logic</td>
                                <td class="fh-flow-col fh-yes">Yes</td>
                                <td class="fh-no">No</td>
                                <td class="fh-yes">Yes</td>
                                <td class="fh-yes">Yes</td>
                                <td class="fh-na">N/A</td>
                            </tr>
                            <tr>
                                <td>Meaningful diffs in Git</td>
                                <td class="fh-flow-col fh-yes">Yes</td>
                                <td class="fh-no">No</td>
                                <td class="fh-no">No</td>
                                <td class="fh-yes">Yes</td>
                                <td class="fh-no">No</td>
                            </tr>
                            <tr>
                                <td>AI as governed participant</td>
                                <td class="fh-flow-col fh-yes">Yes</td>
                                <td class="fh-partial">Partial</td>
                                <td class="fh-no">No</td>
                                <td class="fh-partial">Manual</td>
                                <td class="fh-no">No</td>
                            </tr>
                            <tr>
                                <td>Built-in audit trail</td>
                                <td class="fh-flow-col fh-yes">Yes</td>
                                <td class="fh-partial">Varies</td>
                                <td class="fh-partial">Partial</td>
                                <td class="fh-no">Manual</td>
                                <td class="fh-no">No</td>
                            </tr>
                            <tr>
                                <td>No platform dependency</td>
                                <td class="fh-flow-col fh-yes">Yes</td>
                                <td class="fh-no">No</td>
                                <td class="fh-no">No</td>
                                <td class="fh-yes">Yes</td>
                                <td class="fh-yes">Yes</td>
                            </tr>
                            <tr>
                                <td>Blast radius containment</td>
                                <td class="fh-flow-col fh-yes">Yes</td>
                                <td class="fh-no">No</td>
                                <td class="fh-no">No</td>
                                <td class="fh-no">No</td>
                                <td class="fh-na">N/A</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </section>

        <!-- ===== CHANGE MANAGEMENT / DIFF ===== -->
        <section class="fh-section">
            <div class="fh-container">
                <div class="fh-section-label fade-in" style="color: var(--fh-purple)">Change management</div>
                <h2 class="fh-section-title fade-in">One line changed. One line reviewed.</h2>
                <p class="fh-section-lead fade-in">
                    When a policy changes, the diff tells the whole story. No
                    200-line JSON blob. No "what did that node change do?" Just
                    plain text, reviewed in a pull request.
                </p>

                <div class="fh-diff-grid">
                    <div class="fh-diff-panel fh-diff-before fade-in">
                        <div class="fh-diff-header">Before &mdash; Pull Request #47</div>
                        <div class="fh-diff-body" v-pre>
                            <div>step RuleBasedScreening:</div>
                            <div>&nbsp;&nbsp;&nbsp;&nbsp;set rule-score to 0</div>
                            <div>&nbsp;</div>
                            <div class="fh-line-old">&nbsp;&nbsp;&nbsp;&nbsp;if amount is above 5000:</div>
                            <div>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;set rule-score to rule-score plus 40</div>
                            <div>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;log "High-value flag: {amount}"</div>
                        </div>
                    </div>
                    <div class="fh-diff-panel fh-diff-after fade-in">
                        <div class="fh-diff-header">After &mdash; Approved by @fraud-ops-lead</div>
                        <div class="fh-diff-body" v-pre>
                            <div>step RuleBasedScreening:</div>
                            <div>&nbsp;&nbsp;&nbsp;&nbsp;set rule-score to 0</div>
                            <div>&nbsp;</div>
                            <div class="fh-line-new">&nbsp;&nbsp;&nbsp;&nbsp;if amount is above 10000:</div>
                            <div>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;set rule-score to rule-score plus 40</div>
                            <div>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;log "High-value flag: {amount}"</div>
                        </div>
                    </div>
                </div>
            </div>
        </section>

        <!-- ===== INDUSTRIES ===== -->
        <section class="fh-section fh-section-alt">
            <div class="fh-container">
                <div class="fh-section-label fade-in">Built for</div>
                <h2 class="fh-section-title fade-in">Where decisions are consequential</h2>
                <p class="fh-section-lead fade-in">
                    Flow is for organizations where business decisions affect
                    people's money, health, safety, or access &mdash; and where
                    proving how those decisions work isn't optional.
                </p>

                <div class="fh-industry-grid">
                    <div class="fh-industry-card fade-in">
                        <div class="fh-ind-icon">&#x1F3E6;</div>
                        <h4>Financial Services</h4>
                        <p>Lending decisions, KYC, fraud detection, compliance reporting</p>
                    </div>
                    <div class="fh-industry-card fade-in">
                        <div class="fh-ind-icon">&#x1F3E5;</div>
                        <h4>Healthcare</h4>
                        <p>Patient triage, referral routing, treatment authorization</p>
                    </div>
                    <div class="fh-industry-card fade-in">
                        <div class="fh-ind-icon">&#x1F6E1;&#xFE0F;</div>
                        <h4>Insurance</h4>
                        <p>Claims processing, underwriting rules, risk assessment</p>
                    </div>
                    <div class="fh-industry-card fade-in">
                        <div class="fh-ind-icon">&#x1F69A;</div>
                        <h4>Logistics</h4>
                        <p>Delivery routing, exception handling, carrier selection</p>
                    </div>
                    <div class="fh-industry-card fade-in">
                        <div class="fh-ind-icon">&#x2696;&#xFE0F;</div>
                        <h4>Trust &amp; Safety</h4>
                        <p>Content moderation, user risk scoring, escalation policies</p>
                    </div>
                    <div class="fh-industry-card fade-in">
                        <div class="fh-ind-icon">&#x1F6D2;</div>
                        <h4>E-Commerce</h4>
                        <p>Order processing, refund rules, seller verification</p>
                    </div>
                </div>
            </div>
        </section>

        <!-- ===== TERMINAL DEMO ===== -->
        <section class="fh-section fh-section-alt">
            <div class="fh-container fh-container-narrow">
                <div class="fh-section-label fade-in" style="text-align: center">
                    See it run
                </div>
                <h2
                    class="fh-section-title fade-in"
                    style="text-align: center"
                >
                    From file to execution in seconds
                </h2>
                <p class="fh-section-lead fade-in" style="text-align: center; max-width: 500px; margin-left: auto; margin-right: auto">
                    Write a
                    <code class="fh-inline-code">.flow</code>
                    file. Check it. Run it. That's it.
                </p>

                <div class="fh-terminal fade-in">
                    <div class="fh-terminal-header">
                        <span class="fh-dot fh-dot-r"></span>
                        <span class="fh-dot fh-dot-y"></span>
                        <span class="fh-dot fh-dot-g"></span>
                    </div>
                    <div class="fh-terminal-body" v-pre>
                        <div class="fh-term-prompt">
                            <span class="fh-term-dollar">$</span>
                            <span class="fh-term-cmd"
                                >flow check transaction-fraud.flow</span
                            >
                        </div>
                        <div class="fh-term-output">
                            <span class="fh-term-success">&#x2713;</span> No
                            errors found in transaction-fraud.flow
                        </div>
                        <br />
                        <div class="fh-term-prompt">
                            <span class="fh-term-dollar">$</span>
                            <span class="fh-term-cmd"
                                >flow run transaction-fraud.flow --input
                                '{"transaction": ...}'</span
                            >
                        </div>
                        <br />
                        <div class="fh-term-output">
                            <span class="fh-term-step"
                                >&#x25B8; Step: RuleBasedScreening</span
                            >
                        </div>
                        <div class="fh-term-output">
                            &nbsp;&nbsp;&#x21B3; Rule score: 40
                        </div>
                        <br />
                        <div class="fh-term-output">
                            <span class="fh-term-step"
                                >&#x25B8; Step: AIRiskAssessment</span
                            >
                        </div>
                        <div class="fh-term-output">
                            &nbsp;&nbsp;&#x21B3; AI confidence: 0.82
                        </div>
                        <br />
                        <div class="fh-term-output">
                            <span class="fh-term-step"
                                >&#x25B8; Step: DecisionEngine</span
                            >
                        </div>
                        <div class="fh-term-output">
                            &nbsp;&nbsp;&#x21B3; Combined score: 61 &#x2192; review
                        </div>
                        <div class="fh-term-output">
                            &nbsp;&nbsp;&#x21B3; Fraud ops notified
                        </div>
                        <br />
                        <div class="fh-term-output">
                            <span class="fh-term-success"
                                >&#x2713; Workflow completed</span
                            >
                            — decision: review, score: 61
                        </div>
                    </div>
                </div>
            </div>
        </section>

        <!-- ===== CTA ===== -->
        <section class="fh-cta">
            <div class="fh-cta-glow"></div>
            <div class="fh-container" style="position: relative">
                <div class="fh-section-label fade-in" style="text-align: center">
                    Get started
                </div>
                <h2 class="fh-cta-title fade-in">
                    Give your business logic<br />a single source of truth
                </h2>
                <p class="fh-cta-sub fade-in">
                    If it's in Flow, it's a real rule.<br />If it's not, it's
                    just a suggestion.
                </p>

                <div class="fh-cta-actions fade-in">
                    <a
                        href="https://github.com/AbrahamOluwa/flow-lang"
                        class="fh-btn-primary"
                        >Star on GitHub &rarr;</a
                    >
                    <a href="/flow-lang/guide/getting-started" class="fh-btn-secondary"
                        >Read the docs</a
                    >
                </div>

                <div class="fh-install fade-in" style="margin-top: 32px">
                    <div class="fh-install-cmd">
                        <span class="fh-prompt">$</span> npm install -g
                        flow-lang
                    </div>
                </div>
            </div>
        </section>
    </div>
</template>

<style scoped>
/* ===== FOUNDATIONS ===== */
.flow-home {
    --fh-bg: #0a0a0b;
    --fh-bg-alt: #111113;
    --fh-bg-card: #1c1c1f;
    --fh-bg-elevated: #18181b;
    --fh-border: #2a2a2e;
    --fh-border-light: #3a3a3e;
    --fh-text: #f4f4f5;
    --fh-text-secondary: #a1a1aa;
    --fh-text-muted: #71717a;
    --fh-accent: #6366f1;
    --fh-accent-light: #818cf8;
    --fh-accent-glow: rgba(99, 102, 241, 0.15);
    --fh-green: #4ade80;
    --fh-green-dim: rgba(74, 222, 128, 0.15);
    --fh-amber: #fbbf24;
    --fh-amber-dim: rgba(251, 191, 36, 0.12);
    --fh-red: #f87171;
    --fh-red-dim: rgba(248, 113, 113, 0.12);
    --fh-purple: #a78bfa;
    --fh-purple-dim: rgba(167, 139, 250, 0.12);
    --fh-cyan: #22d3ee;
    --fh-cyan-dim: rgba(34, 211, 238, 0.12);

    font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI",
        sans-serif;
    color: var(--fh-text);
    line-height: 1.7;
    background: var(--fh-bg);
}

.fh-container {
    max-width: 1100px;
    margin: 0 auto;
    padding: 0 32px;
}

.fh-container-narrow {
    max-width: 800px;
}

/* ===== FADE-IN ANIMATION ===== */
.fade-in {
    opacity: 0;
    transform: translateY(24px);
    transition: all 0.7s cubic-bezier(0.16, 1, 0.3, 1);
}

.fade-in.visible {
    opacity: 1;
    transform: translateY(0);
}

/* ===== SHARED SECTION STYLES ===== */
.fh-section {
    padding: 100px 0;
}

.fh-section-alt {
    background: var(--fh-bg-alt);
    border-top: 1px solid var(--fh-border);
    border-bottom: 1px solid var(--fh-border);
}

.fh-section-label {
    font-family: "JetBrains Mono", "Fira Code", monospace;
    font-size: 0.78rem;
    text-transform: uppercase;
    letter-spacing: 2px;
    color: var(--fh-accent-light);
    margin-bottom: 16px;
}

.fh-section-title {
    font-size: clamp(1.8rem, 4vw, 2.6rem);
    font-weight: 700;
    line-height: 1.2;
    letter-spacing: -0.5px;
    margin-bottom: 20px;
    color: var(--fh-text);
}

.fh-section-lead {
    font-size: 1.1rem;
    color: var(--fh-text-secondary);
    max-width: 600px;
    margin-bottom: 56px;
    line-height: 1.8;
}

/* ===== BUTTONS ===== */
.fh-btn-primary {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: var(--fh-accent);
    color: #fff;
    padding: 13px 28px;
    border-radius: 8px;
    text-decoration: none;
    font-weight: 600;
    font-size: 0.95rem;
    transition: all 0.2s;
    border: none;
}

.fh-btn-primary:hover {
    box-shadow: 0 0 32px var(--fh-accent-glow);
    transform: translateY(-1px);
    opacity: 0.95;
}

.fh-btn-secondary {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: transparent;
    color: var(--fh-text);
    padding: 13px 28px;
    border-radius: 8px;
    text-decoration: none;
    font-weight: 600;
    font-size: 0.95rem;
    border: 1px solid var(--fh-border-light);
    transition: all 0.2s;
}

.fh-btn-secondary:hover {
    border-color: var(--fh-text-muted);
    background: var(--fh-bg-elevated);
}

.fh-inline-code {
    background: var(--fh-bg-elevated);
    padding: 2px 8px;
    border-radius: 4px;
    font-family: "JetBrains Mono", "Fira Code", monospace;
    font-size: 0.88em;
    border: 1px solid var(--fh-border);
}

/* ===== HERO ===== */
.fh-hero {
    min-height: 90vh;
    display: flex;
    align-items: center;
    padding: 120px 0 80px;
    background: var(--fh-bg);
}

.fh-badge {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: var(--fh-bg-elevated);
    border: 1px solid var(--fh-border);
    padding: 6px 16px;
    border-radius: 100px;
    font-size: 0.82rem;
    color: var(--fh-text-secondary);
    margin-bottom: 32px;
}

.fh-badge-dot {
    width: 6px;
    height: 6px;
    background: var(--fh-green);
    border-radius: 50%;
    animation: fh-pulse 2s ease-in-out infinite;
}

@keyframes fh-pulse {
    0%,
    100% {
        opacity: 1;
    }
    50% {
        opacity: 0.4;
    }
}

.fh-hero-title {
    font-size: clamp(2.6rem, 5.5vw, 4.2rem);
    font-weight: 700;
    line-height: 1.1;
    letter-spacing: -1.5px;
    max-width: 750px;
    margin-bottom: 24px;
    color: var(--fh-text);
}

.fh-gradient-text {
    background: linear-gradient(
        135deg,
        var(--fh-accent-light),
        var(--fh-purple)
    );
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
}

.fh-hero-sub {
    font-size: 1.2rem;
    color: var(--fh-text-secondary);
    max-width: 560px;
    line-height: 1.8;
    margin-bottom: 40px;
}

.fh-hero-actions {
    display: flex;
    gap: 14px;
    flex-wrap: wrap;
    margin-bottom: 0;
}

.fh-install {
    margin-top: 28px;
}

.fh-install-cmd {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    background: var(--fh-bg-alt);
    border: 1px solid var(--fh-border);
    padding: 11px 20px;
    border-radius: 8px;
    font-family: "JetBrains Mono", "Fira Code", monospace;
    font-size: 0.88rem;
    color: var(--fh-text-secondary);
}

.fh-prompt {
    color: var(--fh-accent-light);
}

/* ===== PROBLEM CARDS ===== */
.fh-problem-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
    gap: 16px;
}

.fh-problem-card {
    background: var(--fh-bg-card);
    border: 1px solid var(--fh-border);
    border-radius: 12px;
    padding: 28px 24px;
    transition: all 0.3s;
    position: relative;
    overflow: hidden;
}

.fh-problem-card::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 2px;
}

.fh-problem-card[data-accent="red"]::before {
    background: var(--fh-red);
}
.fh-problem-card[data-accent="amber"]::before {
    background: var(--fh-amber);
}
.fh-problem-card[data-accent="purple"]::before {
    background: var(--fh-purple);
}

.fh-problem-card:hover {
    border-color: var(--fh-border-light);
    transform: translateY(-2px);
}

.fh-problem-icon {
    font-size: 1.5rem;
    margin-bottom: 14px;
}

.fh-problem-card h3 {
    font-size: 1rem;
    font-weight: 600;
    margin-bottom: 8px;
    color: var(--fh-text);
}

.fh-problem-card p {
    font-size: 0.88rem;
    color: var(--fh-text-muted);
    line-height: 1.65;
}

/* ===== CODE COMPARISON ===== */
.fh-code-comparison {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
    margin-top: 8px;
}

.fh-comp-label {
    text-align: center;
    padding: 10px 16px;
    font-weight: 600;
    font-size: 0.82rem;
    letter-spacing: 0.5px;
    border-radius: 12px 12px 0 0;
}

.fh-comp-before {
    color: var(--fh-red);
    background: var(--fh-red-dim);
}

.fh-comp-after {
    color: var(--fh-green);
    background: var(--fh-green-dim);
}

.fh-code-panel {
    background: var(--fh-bg-alt);
    border: 1px solid var(--fh-border);
    border-radius: 0 0 12px 12px;
    overflow: hidden;
}

.fh-code-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 16px;
    border-bottom: 1px solid var(--fh-border);
    background: var(--fh-bg-elevated);
}

.fh-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
}

.fh-dot-r {
    background: #ef4444;
}
.fh-dot-y {
    background: #eab308;
}
.fh-dot-g {
    background: #22c55e;
}

.fh-code-filename {
    font-family: "JetBrains Mono", "Fira Code", monospace;
    font-size: 0.78rem;
    color: var(--fh-text-muted);
    margin-left: 6px;
}

.fh-code-body {
    padding: 20px;
    overflow-x: auto;
    font-family: "JetBrains Mono", "Fira Code", monospace;
    font-size: 0.8rem;
    line-height: 1.85;
    color: var(--fh-text-secondary);
    margin: 0;
    background: transparent;
}

.fh-code-body .kw {
    color: var(--fh-accent-light);
}
.fh-code-body .str {
    color: var(--fh-green);
}
.fh-code-body .cm {
    color: var(--fh-text-muted);
}
.fh-code-body .svc {
    color: var(--fh-purple);
}
.fh-code-body .num {
    color: var(--fh-amber);
}
.fh-code-body .fn {
    color: #f472b6;
}

/* ===== PILLARS ===== */
.fh-pillars {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 16px;
}

.fh-pillar {
    background: var(--fh-bg-card);
    border: 1px solid var(--fh-border);
    border-radius: 12px;
    padding: 28px 20px;
    text-align: center;
    transition: all 0.3s;
}

.fh-pillar:hover {
    border-color: var(--fh-accent);
    box-shadow: 0 0 40px var(--fh-accent-glow);
    transform: translateY(-3px);
}

.fh-pillar-icon {
    width: 48px;
    height: 48px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.3rem;
    margin: 0 auto 16px;
}

.fh-pillar-cyan {
    background: var(--fh-cyan-dim);
}
.fh-pillar-green {
    background: var(--fh-green-dim);
}
.fh-pillar-amber {
    background: var(--fh-amber-dim);
}
.fh-pillar-purple {
    background: var(--fh-purple-dim);
}
.fh-pillar-red {
    background: var(--fh-red-dim);
}
.fh-pillar-pink {
    background: rgba(244, 114, 182, 0.12);
}

.fh-pillar h3 {
    font-size: 0.95rem;
    font-weight: 600;
    margin-bottom: 8px;
    color: var(--fh-text);
}

.fh-pillar p {
    font-size: 0.85rem;
    color: var(--fh-text-muted);
    line-height: 1.6;
}

/* ===== TEAMS ===== */
.fh-teams-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 20px;
}

.fh-team-card {
    background: var(--fh-bg-alt);
    border: 1px solid var(--fh-border);
    border-radius: 12px;
    padding: 32px 24px;
    transition: all 0.3s;
}

.fh-team-card:hover {
    border-color: var(--fh-border-light);
    transform: translateY(-2px);
}

.fh-team-role {
    font-family: "JetBrains Mono", "Fira Code", monospace;
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 1.5px;
    margin-bottom: 14px;
}

.fh-role-cyan {
    color: var(--fh-cyan);
}
.fh-role-green {
    color: var(--fh-green);
}
.fh-role-amber {
    color: var(--fh-amber);
}

.fh-team-card h3 {
    font-size: 1.1rem;
    font-weight: 600;
    margin-bottom: 10px;
    color: var(--fh-text);
}

.fh-team-card p {
    font-size: 0.9rem;
    color: var(--fh-text-muted);
    line-height: 1.7;
}

/* ===== TERMINAL ===== */
.fh-terminal {
    background: #0c0c0e;
    border: 1px solid var(--fh-border);
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.35);
}

.fh-terminal-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 14px 18px;
    background: var(--fh-bg-elevated);
    border-bottom: 1px solid var(--fh-border);
}

.fh-terminal-body {
    padding: 22px;
    font-family: "JetBrains Mono", "Fira Code", monospace;
    font-size: 0.84rem;
    line-height: 2;
}

.fh-term-prompt {
    color: var(--fh-text-muted);
}

.fh-term-dollar {
    color: var(--fh-accent-light);
}

.fh-term-cmd {
    color: var(--fh-text);
}

.fh-term-output {
    color: var(--fh-text-secondary);
}

.fh-term-success {
    color: var(--fh-green);
}

.fh-term-step {
    color: var(--fh-amber);
}

/* ===== COMPARISON TABLE ===== */
.fh-comp-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.88rem;
}

.fh-comp-table th {
    text-align: left;
    padding: 14px 16px;
    font-family: "JetBrains Mono", "Fira Code", monospace;
    font-size: 0.72rem;
    color: var(--fh-text-muted);
    text-transform: uppercase;
    letter-spacing: 1px;
    border-bottom: 1px solid var(--fh-border);
    background: var(--fh-bg-alt);
}

.fh-comp-table th:first-child {
    border-radius: 8px 0 0 0;
}
.fh-comp-table th:last-child {
    border-radius: 0 8px 0 0;
}

.fh-comp-table td {
    padding: 14px 16px;
    border-bottom: 1px solid var(--fh-border);
    color: var(--fh-text-muted);
}

.fh-comp-table td:first-child {
    color: var(--fh-text);
    font-weight: 500;
}

.fh-flow-col {
    background: rgba(99, 102, 241, 0.04);
}

.fh-yes {
    color: var(--fh-green);
    font-weight: 500;
}

.fh-no {
    color: var(--fh-text-muted);
    opacity: 0.5;
}

.fh-partial {
    color: var(--fh-amber);
}

.fh-na {
    color: var(--fh-text-muted);
    opacity: 0.5;
}

/* ===== DIFF / CHANGE MANAGEMENT ===== */
.fh-diff-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
}

.fh-diff-panel {
    background: var(--fh-bg-card);
    border: 1px solid var(--fh-border);
    border-radius: 12px;
    overflow: hidden;
}

.fh-diff-header {
    padding: 14px 20px;
    font-family: "JetBrains Mono", "Fira Code", monospace;
    font-size: 0.8rem;
    border-bottom: 1px solid var(--fh-border);
    display: flex;
    align-items: center;
    gap: 8px;
}

.fh-diff-before .fh-diff-header {
    color: var(--fh-red);
    background: var(--fh-red-dim);
}

.fh-diff-after .fh-diff-header {
    color: var(--fh-green);
    background: var(--fh-green-dim);
}

.fh-diff-body {
    padding: 24px;
    font-family: "JetBrains Mono", "Fira Code", monospace;
    font-size: 0.82rem;
    line-height: 1.9;
    color: var(--fh-text-secondary);
}

.fh-line-old {
    color: var(--fh-red);
    opacity: 0.7;
}

.fh-line-new {
    color: var(--fh-green);
}

/* ===== INDUSTRIES ===== */
.fh-industry-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 20px;
}

.fh-industry-card {
    background: var(--fh-bg-card);
    border: 1px solid var(--fh-border);
    border-radius: 12px;
    padding: 28px;
    text-align: center;
    transition: all 0.3s;
}

.fh-industry-card:hover {
    border-color: var(--fh-accent);
    transform: translateY(-2px);
}

.fh-ind-icon {
    font-size: 1.8rem;
    margin-bottom: 14px;
}

.fh-industry-card h4 {
    font-size: 1rem;
    font-weight: 600;
    margin-bottom: 6px;
    color: var(--fh-text);
}

.fh-industry-card p {
    font-size: 0.82rem;
    color: var(--fh-text-muted);
    line-height: 1.6;
}

/* ===== CTA ===== */
.fh-cta {
    padding: 140px 0;
    text-align: center;
    position: relative;
    overflow: hidden;
    background: var(--fh-bg);
}

.fh-cta-glow {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 500px;
    height: 500px;
    background: radial-gradient(
        circle,
        var(--fh-accent-glow) 0%,
        transparent 70%
    );
    pointer-events: none;
}

.fh-cta-title {
    font-size: clamp(2rem, 4.5vw, 3rem);
    font-weight: 700;
    letter-spacing: -1px;
    margin-bottom: 20px;
    line-height: 1.2;
    color: var(--fh-text);
}

.fh-cta-sub {
    font-size: 1.1rem;
    color: var(--fh-text-secondary);
    max-width: 440px;
    margin: 0 auto 40px;
    line-height: 1.8;
}

.fh-cta-actions {
    display: flex;
    gap: 14px;
    justify-content: center;
    flex-wrap: wrap;
}

/* ===== RESPONSIVE ===== */
@media (max-width: 900px) {
    .fh-code-comparison {
        grid-template-columns: 1fr;
    }
    .fh-pillars {
        grid-template-columns: repeat(2, 1fr);
    }
    .fh-teams-grid {
        grid-template-columns: 1fr;
    }
    .fh-problem-grid {
        grid-template-columns: repeat(2, 1fr);
    }
    .fh-diff-grid {
        grid-template-columns: 1fr;
    }
    .fh-comp-table {
        font-size: 0.78rem;
    }
    .fh-comp-table th,
    .fh-comp-table td {
        padding: 10px 8px;
    }
    .fh-industry-grid {
        grid-template-columns: repeat(2, 1fr);
    }
    .fh-hero {
        padding: 100px 0 60px;
        min-height: auto;
    }
    .fh-section {
        padding: 72px 0;
    }
    .fh-cta {
        padding: 100px 0;
    }
}

@media (max-width: 600px) {
    .fh-pillars {
        grid-template-columns: 1fr;
    }
    .fh-problem-grid {
        grid-template-columns: 1fr;
    }
    .fh-industry-grid {
        grid-template-columns: 1fr;
    }
    .fh-hero-actions {
        flex-direction: column;
        align-items: flex-start;
    }
    .fh-cta-actions {
        flex-direction: column;
        align-items: center;
    }
    .fh-container {
        padding: 0 20px;
    }
}
</style>
