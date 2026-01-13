# Diese & Mat

Jeu pédagogique d'apprentissage de la lecture musicale.

## Description

"Diese & Mat" (jeu de mots sur "échec et mat" et les dièses musicaux) est une application d'entraînement à la lecture de partitions. Elle propose différents types d'exercices pour développer vos compétences musicales :

- **Lecture de notes** : Identifier les notes sur une portée
- **Intervalles** : Reconnaître la distance entre deux notes
- **Accords** : Identifier le type d'accord (majeur, mineur, etc.)
- **Rythme** : Taper ou identifier des motifs rythmiques

## Comment jouer

### Lecture de notes

1. Une note s'affiche sur la portée
2. Cliquez sur le bouton correspondant (Do, Ré, Mi...) ou utilisez les touches 1-7
3. Un feedback immédiat vous indique si vous avez juste
4. Votre score et votre série de bonnes réponses sont affichés

### Raccourcis clavier

| Touche | Action |
|--------|--------|
| `1` - `7` | Répondre Do à Si |
| `Espace` | Passer à la question suivante |
| `Échap` | Retour au menu |
| `P` | Rejouer le son |
| `H` | Demander un indice |

## Progression

Le jeu suit votre progression par compétence :

- **Clé de sol** : Lecture des notes en clé de sol
- **Clé de fa** : Lecture des notes en clé de fa
- **Altérations** : Dièses et bémols
- **Intervalles** : Reconnaissance des intervalles
- **Accords** : Identification des accords

Chaque compétence a son propre niveau et taux de réussite.

## Technologies

- **VexFlow** : Rendu de partitions musicales
- **Tone.js** : Synthèse audio temps réel

## Développement

```bash
# Lancer le serveur de dev
make serve

# Ouvrir le jeu
open http://localhost:3000/games/diese-et-mat/

# Lancer les tests
make test
```

## Auteur

Playlab42 - Support de formation dev assistée par IA
