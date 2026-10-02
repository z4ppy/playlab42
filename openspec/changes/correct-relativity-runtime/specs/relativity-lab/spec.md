## ADDED Requirements

### Requirement: Consistent inertial physics
The simulator SHALL use finite subluminal observer velocities, lab-frame
light propagation, proper-time clocks and the general relativistic Doppler
ratio at emission and reception.

#### Scenario: Moving source toward a stationary receiver
- **WHEN** a source moves at +0.6c toward a receiver along the photon direction
- **THEN** the received frequency ratio is 2, not 0.5

#### Scenario: Non-collinear impulse
- **WHEN** a rest-frame transverse impulse is applied to a moving observer
- **THEN** velocity addition boosts the gained rest-frame velocity into the lab
- **AND** rejected zero, non-finite or excessive impulses consume no mass

#### Scenario: Internal photons between inertial mirrors
- **WHEN** H and V clocks move inertially, including transverse and oblique velocities of either sign
- **THEN** each internal photon has lab velocity of magnitude c on both outgoing and returning segments
- **AND** its path is continuous at reflection at centre proper time L(1+β·e), where e is the rest-frame arm axis and c=1
- **AND** H and V retain synchronized phases and ticks with proper period 2L

### Requirement: Deterministic simulated time
The simulator SHALL advance using fixed lab-time steps, preserve every clock
emission, and consume continuous fuel per simulated second only while running.

#### Scenario: Refresh-rate independence
- **WHEN** equal simulated durations are delivered in different frame chunks
- **THEN** observer positions, proper times, ticks and fuel agree

#### Scenario: Pause and reset
- **WHEN** simulation is paused or reset
- **THEN** ongoing thrust stops and panels refresh without advancing time

### Requirement: Honest observer views
The UI SHALL distinguish lab-coordinate visualization from an observer's
received signals and SHALL state the idealized impulse and clock limits.

#### Scenario: Selecting an observer
- **WHEN** a new observer is selected while paused
- **THEN** cockpit data updates without changing lab positions or simultaneity

### Requirement: Local rendering lifecycle
The simulator SHALL load pinned Three and lil-gui modules from the same static
origin, report initialization or WebGL loss errors, and release owned resources.

#### Scenario: No external runtime
- **WHEN** external network requests are blocked after building local vendors
- **THEN** real Three rendering and lil-gui controls initialize successfully

#### Scenario: Interrupted input and disposal
- **WHEN** pointer input is cancelled, focus is lost, or the app is disposed
- **THEN** thrust ends and owned listeners, animations and GPU resources are released
