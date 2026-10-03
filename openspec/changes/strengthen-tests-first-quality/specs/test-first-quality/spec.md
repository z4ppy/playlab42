## ADDED Requirements

### Requirement: Behavior before refactoring
Les contributions SHALL caractériser les contrats observables avant tout
refactoring et conserver les reproductions des défauts corrigés.

#### Scenario: Existing contract is exercised
- **WHEN** un module critique est amélioré
- **THEN** ses scénarios nominaux, limites et erreurs sont exécutés avant modification
- **AND** les tests observent les effets ou invariants, pas uniquement les mocks

### Requirement: Session and persistence isolation
Les tests du portail SHALL vérifier l'isolation des sessions et les refus ou
échecs de réinitialisation sans mutation ou notification de succès trompeuse.

#### Scenario: Stale callback or message
- **WHEN** une session précédente termine après l'ouverture de la suivante
- **THEN** elle ne détruit ni ne pilote la session courante

#### Scenario: Reset refusal or failure
- **WHEN** une réinitialisation est refusée ou une opération de stockage échoue
- **THEN** l'état observé et la notification distinguent refus, erreur et succès

### Requirement: Deterministic engine and simulation scenarios
Les tests SHALL exercer replays JSON et immutabilité des moteurs ciblés,
ainsi que le temps et le cycle des signaux de Simulation.

#### Scenario: Replay after serialization
- **WHEN** un état moteur est sauvegardé puis restauré pendant une séquence légale
- **THEN** les actions suivantes donnent les mêmes actions légales et état final
- **AND** les états et actions d'entrée ne sont pas modifiés

#### Scenario: Signal reception and reset
- **WHEN** la simulation avance, reçoit un signal puis est réinitialisée
- **THEN** la réception est unique et les ressources sont libérées conformément au contrat

### Requirement: Measured coverage ratchet
La CI SHALL publier des rapports de couverture traçables par module et
appliquer les nouveaux seuils seulement après les scénarios et leur mesure.

#### Scenario: Coverage regression
- **WHEN** la mesure d'un module descend sous son seuil versionné
- **THEN** le vrai runner de couverture échoue
- **AND** les seuils antérieurs ne sont pas réduits

#### Scenario: Coverage evidence
- **WHEN** un rapport est publié
- **THEN** il identifie SHA/run, quatre mesures et périmètre instrumenté
- **AND** il ne transforme pas une absence d'instrumentation en absence de tests navigateur

### Requirement: Canonical majority captures
Le moteur de Dames françaises SHALL proposer uniquement les rafles complètes
capturant le plus grand nombre de pièces et appliquer leurs captures légales
plutôt que des métadonnées arbitraires.

#### Scenario: Unequal capture chains
- **WHEN** plusieurs pièces ou trajets permettent des rafles de longueurs différentes
- **THEN** seuls les trajets de longueur maximale sont des actions légales
- **AND** une rafle plus courte est refusée par le moteur

#### Scenario: Equal capture chains
- **WHEN** plusieurs rafles capturent le même nombre maximal de pièces
- **THEN** elles restent toutes légales sans priorité arbitraire dame/pion
- **AND** un trajet légal explicite conserve son identité pendant un replay JSON
