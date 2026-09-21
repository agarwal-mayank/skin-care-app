# PRD: Personalized Ayurvedic Skin Quiz

## Problem Statement

New visitors who arrive at the Ayurvedic site via ads/social have no way to get a skincare recommendation tailored to them. Today they either browse a catalog of generic products and guess, or leave without buying. Generic "one-size-fits-all" skincare products ignore that everyone's skin is different — shaped by individual constitution, diet, and background — and at best are ineffective for a given person, at worst can actively harm their skin. The site currently has no transactional capability at all (informational only), so there is also no mechanism today to convert quiz-driven interest into an actual sale.

## Evidence

- **The live site (added 2026-09-19):** [savyasachiayurveda.com](https://savyasachiayurveda.com/) — Dr. Maitri Nagar, a BAMS-certified Ayurvedic doctor in Singapore, 17+ years clinical practice. It was built on **Bolt.new**, and the founder plans to integrate this quiz app into the site through that same platform (not a from-scratch rebuild). This changes a premise the architecture doc made: it assumed the live site's code was "not accessible from this environment," which is true for *this* agent session, but the founder *can* edit the real site directly via Bolt.new — worth revisiting how integration actually happens (see Open Questions).
- **Brand/visual alignment (observed, not decided):** the site's aesthetic is soft, muted, spa-like — cream/pale-gold/peach palette, elegant serif headlines, calm nature/chakra imagery. It already uses dosha language explicitly (a blog post titled "Understanding Your Dosha: A Beginner's Guide" covers Vata/Pitta/Kapha), and frames the practice around five dimensions — Physical, Physiological, Spiritual, Emotional, Intellectual. This is genuinely supportive evidence for the dosha-based quiz thesis: the audience is already primed for this framing, it's not a novel concept being introduced cold.
- **The site is service-based, not product-based (important, not yet reconciled with the PRD):** every CTA on the homepage is "Book a Discovery Call," "Book a Consultation," or "Request a Consultation" — there is no product catalog, cart, or existing checkout of any kind. The actual offerings are 1:1 consultations, a 12-Week Transformation Program, yoga/breathwork/meditation, and group wellness programs. Nothing on the live site today is a shippable physical "skincare package." This is a real gap between the site as it exists and this PRD's MVP (a priced package + Stripe checkout) — flagged as an open question below rather than resolved here.
- **A quiz CTA already exists, but isn't built yet:** the homepage has a "Take the Appetite vs Hunger Quiz" button. Clicking it just anchors to `#quiz` on the same page — there's no actual quiz behind it yet. It confirms quizzes are already part of the founder's planned lead-gen strategy (consistent with this PRD), but it isn't a working precedent to build from.
- **The site's messaging targets women specifically** ("For women navigating energy crashes, digestion shifts, hormonal changes...") — in tension with the PRD's MVP, which asks gender first and implies serving both. Worth reconciling (see Open Questions).
- **Assumption — validate via live traffic:** No existing analytics, customer feedback, or tracked behavior on how visitors currently decide what to buy. The "browse and guess" framing is the founder's belief, not measured yet.
- **Domain grounding (external research, not project-specific evidence):** Ayurveda's dosha framework (Vata / Pitta / Kapha) is a widely used, publicly documented basis for individualized skin-typing — e.g. [SADHEV's dosha skin guide](https://sadhev.com/blogs/journal/dosha-skin-type-guide-vata-pitta-kapha), [an overview of Ayurvedic skin-type approach](https://medium.com/@weststatus/an-authentic-way-to-understand-ayurvedic-skin-type-approach-85afb73e4122), and existing dosha quizzes such as [Amrtasiddhi's](https://www.amrtasiddhi.com/ayurveda-quiz/). This confirms the *framework* is real and established; it does not confirm that *this specific audience* wants a quiz-driven purchase experience.
- **Market pattern (assumption, not direct evidence):** Personalization-quiz-to-purchase funnels are a proven pattern in DTC beauty generally (e.g. Function of Beauty, Prose), but no data yet on whether it transfers to this Ayurvedic audience.
- **Founder's thesis (stated, not yet tested):** "People are different — different skin, different issues, different diets, different backgrounds. Generic products that ignore that aren't effective, and can even damage your skin." This is the core differentiation bet the hypothesis below is built to test.

## Thesis (why build it)

The site currently has zero transactional capability — this quiz is deliberately the *first* transactional feature, chosen because it doubles as both a conversion mechanism and a way to prove out a bigger vision: a full e-commerce funnel built around individualized Ayurvedic recommendations rather than a generic catalog.

The differentiation isn't "we also have a quiz" — plenty of skincare brands do. It's that most skin quizzes (and most products) reduce people to shallow categories like "oily/dry/combination." An Ayurvedic dosha-based quiz can account for the person more holistically. Whether visitors actually perceive and value that difference enough to hand over their email and attempt a purchase — rather than treating it as just another quiz — is exactly what's unproven and worth testing now, before investing further in the full funnel (subscriptions, broader catalog, etc.).

## Hypothesis

> We believe a personalized Ayurvedic skin quiz (gender + skin questions → skin type → custom package shown with a price → email capture → Stripe checkout) will cause visitors arriving via ads/social to complete it and attempt to buy the recommended package — proving people want individualized Ayurvedic skincare over generic products — resulting in a validated, repeatable acquisition channel for the future e-commerce funnel.
>
> **We'll know we're RIGHT if:** 100+ completed quizzes with captured emails within the first 4–6 weeks of running ads, with a meaningful share of those clicking through to Stripe checkout.
>
> **We'll know we're WRONG if:** there's high mid-quiz drop-off — people start the quiz but abandon before finishing (signals the flow is too long, asks for too much too soon, or feels irrelevant).

## Target User & JTBD

**Primary user:** A new visitor with no prior purchase history, arriving at a dedicated quiz landing page from an ad or social campaign built specifically to promote the quiz.

**Job to be done:** "When I see an ad promising skincare made for *my* skin, I want to quickly find out what my Ayurvedic skin type is and what's actually right for me, so I can stop guessing with generic products that might not work (or might hurt my skin)."

**Non-users (open):** Not yet defined. Candidates raised but not confirmed: people with diagnosed dermatological conditions (this is a wellness/personalization quiz, not a medical diagnostic) and existing customers with an established routine. Flagged as an open question below rather than decided.

## MVP

The thinnest end-to-end slice that can prove or disprove the hypothesis:

1. Dedicated landing page (linked from ads/social)
2. Quiz: gender first, then skin-related questions (question content itself is an open item — see below)
3. Skin type derived from answers (Ayurvedic dosha-based)
4. A custom skincare package shown to the user, with a price
5. Email capture
6. Stripe checkout for the shown package
7. Responses (quiz answers, derived skin type, email) stored in a database

**Build-sequencing note (not a scope cut):** the founder wants the quiz flow and UX (question sequence, ease of answering, feel of the interaction) fine-tuned and validated *first*, with checkout logic wired up and polished second. The MVP still includes checkout end-to-end per the hypothesis above — this is a preference about build order, to be carried into the architecture/implementation planning stage, not a reduction of what ships.

**Door check:** Stripe/payment integration is closer to a one-way door (real money, compliance, harder to unwind once customers have transacted) — worth a short technical spike before committing to a specific integration approach. The quiz/UX portion is a two-way door (fully reversible, cheap to iterate) — just build and iterate on it directly.

## Success Metrics

| Metric | Target | How measured |
|---|---|---|
| Quiz completions with email captured | 100+ | Count of completed quiz sessions with a valid email, within 4–6 weeks of ad launch |
| Mid-quiz drop-off rate | Low enough to not be the dominant pattern (specific threshold TBD — no baseline yet) | Share of started sessions that don't reach the final question |
| Checkout click-through | A "meaningful share" of completions (specific % TBD — no baseline yet) | Completions that click through to Stripe checkout |
| Completed purchases | TBD — no baseline yet | Successful Stripe payments |

## Non-goals

- No admin/back-office UI for managing quiz questions, viewing responses, or editing packages in v1 — managed directly via database/code.
- No order fulfillment/shipping workflow — what happens operationally after a successful payment (packing, shipping) is out of scope for this app.
- No subscriptions or recurring billing in v1 — this PRD covers a one-time quiz-to-purchase flow only, even though subscriptions are part of the longer-term vision.
- No user accounts/login system.
- No marketing automation (drip email sequences, retargeting) beyond the initial package email.

## Open Questions

- [ ] **What does "custom skincare package" actually mean, given the live site sells services (consultations, programs), not products?** Is there a real physical product line planned that isn't on the site yet, or should the quiz's "package" actually be a personalized service recommendation (e.g., pointing to the 12-Week Program or a 1:1 consultation)? This decides what Stripe is actually charging for — a one-time product price, or a service/session booking — and should be settled before the architecture's Stripe/fulfillment decisions are treated as final.
- [ ] **How does integration via Bolt.new actually work?** The site is built and maintained on Bolt.new, and the founder plans to integrate this app through that platform rather than editing inaccessible code directly. Worth revisiting the architecture doc's "standalone app, linked via URL" call now that this is known — Bolt.new may support embedding or a more direct integration path.
- [ ] Should this quiz target women specifically, matching the rest of the site's positioning, or genuinely serve all genders as originally scoped (gender-first question)?
- [ ] What are the actual quiz questions and dosha-scoring logic? Founder plans to provide a more detailed framework later — the domain research above (Vata/Pitta/Kapha characteristics) is a starting point only, not final content.
- [ ] What are the actual skincare packages/products mapped to each skin type, and their pricing?
- [ ] What specific conversion benchmarks (drop-off %, checkout click-through %) count as "meaningful" — no baseline exists yet; needs a first ad run to establish one.
- [ ] Who is explicitly excluded from this quiz (non-users) — not yet decided.
- [ ] Which ad/social channels will drive traffic to the landing page, and does that affect how the landing page should be framed?
- [ ] How should the site route existing/returning visitors (not the v1 focus, but they'll likely encounter the link too)?
