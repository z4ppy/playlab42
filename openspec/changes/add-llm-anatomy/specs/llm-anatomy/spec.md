## ADDED Requirements

### Requirement: Complete native course
The system SHALL publish twenty-two French learning steps, a glossary and sources
as a standard static Playlab42 epic.

#### Scenario: Independent reading
- **WHEN** a visitor opens any step directly
- **THEN** its question, explanation, limitations and takeaway remain readable
- **AND** the step identifies its place in the course

#### Scenario: Explanation before experimentation
- **WHEN** a visitor opens a learning step
- **THEN** its explanation and reading diagrams precede the experiment in document and visual order
- **AND** links provide direct access to understanding, experimentation and the formative question
- **AND** prerequisite scores and probabilities precede the logit lens in the course

#### Scenario: Read Luciole's implementation
- **WHEN** a visitor expands a code explanation
- **THEN** the excerpt is generated from the actual source file and connected to the concept being taught
- **AND** a local readable page exposes the complete inference, numerical, decoding and training sources with repository paths
- **AND** explanations, diagrams and code remain readable without JavaScript

#### Scenario: Progressive terminology
- **WHEN** a visitor encounters vectors, attention heads or logits
- **THEN** prerequisite steps introduce the concepts with small explicit calculations
- **AND** each step offers contextual glossary tooltips and definitions readable without JavaScript
- **AND** Luciole has an early model card distinguishing its authored corpus, numerically trained weights and limited synthetic generalization evaluation

### Requirement: Honest local inference
The laboratory SHALL run an actual trained miniature causal Transformer locally
and SHALL identify its corpus, architecture and limitations.

#### Scenario: Inspect generation
- **WHEN** the visitor submits a supported prompt and advances one token
- **THEN** actual tokens, attention and next-token probabilities are displayed
- **AND** no external inference service is contacted

#### Scenario: Invalid input or unavailable weights
- **WHEN** input is unsupported or model resources cannot load
- **THEN** an actionable error is displayed without fabricated predictions

#### Scenario: End of sequence
- **WHEN** the model selects the end-of-sequence token
- **THEN** the interface explains that generation has ended and retains the calculation that selected it
- **AND** the primary action starts a new generation from the prompt with current decoding settings and seed 42

### Requirement: Accessible reproducible experiments
Experiments SHALL offer labelled keyboard-operable controls, deterministic reset,
light and dark themes and explicit distinction between measured and illustrative data.

#### Scenario: Sampling
- **WHEN** the same logits, settings and seed are used
- **THEN** the same sample sequence is produced
- **AND** retained probabilities sum to one

#### Scenario: Controlled decoding lesson
- **WHEN** a visitor opens the sampling step
- **THEN** five explicitly fictitious choices offer plausible, dominant and equal initial distributions without loading model weights
- **AND** initial and final probabilities remain visible, including excluded candidates at zero
- **AND** temperature, top-k, min-p and top-p are applied in the displayed order, with deterministic tie handling
- **AND** single and cumulative draws are reproducible, and changing a setting resets counts and the seed

#### Scenario: Distinguish model probabilities from the choice rule
- **WHEN** a visitor uses zero temperature in a real Luciole generation
- **THEN** the interface distinguishes the forced choice from the original softmax probabilities
- **AND** those original probabilities remain inspectable from the same forward pass

#### Scenario: Small display
- **WHEN** a step opens at a width of 390 pixels
- **THEN** the document has no horizontal overflow
- **AND** wide matrices remain accessible in labelled scroll regions

#### Scenario: Native viewer presentation
- **WHEN** the epic is displayed inside the parcours viewer
- **THEN** its title remains compact and its numbered atomic motif is preserved
- **AND** colors use the shared Playlab42 theme
- **AND** the epic header and top step navigation do not duplicate the viewer controls

### Requirement: Real tokenizer comparison
The tokenization experiment SHALL compare the same text with Luciole's lexical tokenizer and pinned GPT-2 BPE,
BERT WordPiece and T5 Unigram tokenizers, using locally hosted definitions.

#### Scenario: Inspect segmentation
- **WHEN** a visitor loads the comparison and edits the input
- **THEN** each tokenizer displays its pieces, IDs and token count without automatically added special tokens
- **AND** normalization, unknown tokens and internal space markers are explained
- **AND** no text or tokenizer request is sent to an external service

#### Scenario: Unavailable definition
- **WHEN** a tokenizer definition cannot load
- **THEN** its error is visible and retryable without fabricating a result

### Requirement: Three-dimensional embedding inspection
The embedding experiment SHALL display three selectable distinct coordinates
of actual Luciole embeddings with keyboard-operable rotation and zoom.

#### Scenario: Compare tokens in a projection
- **WHEN** a visitor changes axes or orientation
- **THEN** the selected tokens remain identifiable
- **AND** the cosine similarity computed in all model dimensions is unchanged
- **AND** the interface states that closeness in the projection does not prove similarity in the complete space

### Requirement: Recorded pretraining and held-out evaluation
Luciole SHALL remain a small pretrained local model, with no browser training.
Its model card SHALL expose recorded training and validation curves, checkpoint
predictions and final measurements on explicitly held-out combinations.

#### Scenario: Replay learning
- **WHEN** a visitor selects a recorded checkpoint
- **THEN** its losses and example predictions are displayed as recorded observations
- **AND** the interface states that no weights are modified or selected for subsequent inference
- **AND** all model-based experiments use the final published weights

#### Scenario: Measure limited generalization
- **WHEN** the published model is evaluated on agreement and contextual retrieval
- **THEN** reserved combination groups are absent from gradient updates
- **AND** validation is monitored separately and test is evaluated only after the fixed training run
- **AND** scores, sample counts, baselines and failures are exposed without claiming general language understanding

### Requirement: Small multilingual corpus and explicit tokenizer
The published Luciole corpus SHALL include a small openly licensed natural
language sample containing French, with source IDs, licence and provenance.
The model card and tokenization step SHALL explain the exact tokenizer used.

#### Scenario: Inspect Luciole's tokenizer
- **WHEN** a visitor enters French, English or Spanish text in the tokenizer inspector
- **THEN** NFC, lowercasing, lexical pieces and real vocabulary IDs are inspectable
- **AND** unknown pieces and excessive context are explicitly refused for inference
- **AND** BOS, EOS and non-reversible spacing/case handling are explained
- **AND** the vocabulary is built only from the training split

### Requirement: Genuine Transformer Explainer finale
The final learning step SHALL link to an actual locally adapted version of
Transformer Explainer, with French interface and Playlab42 presentation.
GPT-2 SHALL remain separate from Luciole and load only on explicit request.
The laboratory SHALL open only in a new tab, never in an embedded course iframe.

#### Scenario: Enter the finale
- **WHEN** the visitor opens the final step without launching GPT-2
- **THEN** no remote model or runtime download occurs
- **AND** the heavier loading requirements and independent model are explained

#### Scenario: Explore GPT-2
- **WHEN** the visitor explicitly launches the model and resources load successfully
- **THEN** the original project's adapted visualization displays actual local GPT-2 computations
- **AND** attribution, licence and source revision remain available
- **AND** the interface does not claim that French translation changes the model's training

#### Scenario: Focus on the visualization
- **WHEN** a visitor hides the information banner after GPT-2 is ready
- **THEN** the visualization uses the available viewport height without reloading the model or resetting the prompt
- **AND** an accessible control restores the banner and credits
- **AND** a native fullscreen control is available when supported, with synchronized exit state

### Requirement: Same-origin GPT-2 distribution
The published course SHALL contain the verified GPT-2 weights on its own origin.
Preparation SHALL be explicit before building; weights SHALL remain outside Git.

#### Scenario: Build a complete course
- **WHEN** CI builds the public course
- **THEN** it prepares all 63 pinned fragments and the local descriptor
- **AND** packaging fails if a fragment is absent, corrupt or differs from the upstream manifest
- **AND** artifact verification enforces the same requirement

#### Scenario: Generate without external transport
- **WHEN** a visitor consents to loading GPT-2 on HTTPS or localhost
- **THEN** the weights are fetched from the course origin and verified before real inference
- **AND** a browser test on the built site verifies a real first continuation without external requests
- **AND** an insecure remote HTTP origin remains explicitly unsupported for WebCrypto

### Requirement: Transparent model and tokenizer selection
Each experiment SHALL identify whether it uses actual model traces, a
conceptual example or an estimate. Tokenization choices SHALL include
Luciole, GPT-2, BERT and T5. Luciole SHALL serve the local generation experiments;
GPT-2 SHALL be available through the dedicated finale's new-tab link only.
All other generation experiments SHALL use Luciole without a model selector or GPT-2 laboratory link.

#### Scenario: Luciole-only view
- **WHEN** an experiment cannot display the GPT-2 visualization
- **THEN** it identifies Luciole directly without a model selector or GPT-2 mentions
- **AND** an old GPT-2 preference does not hide the working Luciole visualization
- **AND** GPT-2 remains available where its actual laboratory or tokenization is displayed

#### Scenario: Heavy model lifecycle
- **WHEN** a visitor opens a slide or changes a selection
- **THEN** no GPT-2 weights load without explicit consent
- **AND** the interface does not silently multiply heavy inference sessions
- **AND** saved preferences contain no prompts

#### Scenario: Continue learning after using GPT-2
- **WHEN** a visitor chooses GPT-2 in the dedicated finale and moves to the attention chapter
- **THEN** the attention chapter opens its own default Luciole experience
- **AND** the already opened GPT-2 tab preserves its own session independently of course navigation
- **AND** an old model preference does not change the finale's new-tab link

#### Scenario: Authenticated preview
- **WHEN** the same-origin preview requires its session cookie to serve the weight fragments
- **THEN** requests preserve that cookie without sending credentials to an external origin
- **AND** a browser regression verifies real generation with cookie-protected fragments
- **AND** loading failures identify their stage rather than reporting every fetch failure as CORS

### Requirement: Novice-first attention and cache explanations
The first step SHALL define MLP. Q/K/V SHALL be introduced before their use
in positional examples, with an inspectable progression from projections
through masked scores and softmax to the weighted sum of values.

#### Scenario: Understand attention
- **WHEN** a visitor follows the attention example
- **THEN** invented numbers are distinguished from actual Luciole traces
- **AND** the causal mask forbids future positions rather than zeroing their values
- **AND** the explanation distinguishes attention across positions from the position-wise MLP

#### Scenario: Understand cached decoding
- **WHEN** a visitor explores the cache
- **THEN** prefill and successive decoding steps show reuse of past K/V per layer
- **AND** the cache is not described as attention weights, learned knowledge or training
- **AND** Luciole's uncached inference is not presented as a measured cached implementation
