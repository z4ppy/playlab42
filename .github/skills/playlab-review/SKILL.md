---
name: playlab-review
description: >-
  Revoir un diff Playlab42 avant contribution : correction, conception,
  tests, erreurs, sécurité des frontières, accessibilité et compatibilité.
  Utiliser pour une revue de code ou de bonnes pratiques logicielles,
  pas pour implémenter un module, publier ou certifier un audit de sécurité.
---

# Revoir une contribution

Lire [AGENTS.md](../../../AGENTS.md), le
[guide qualité](../../../docs/guides/software-quality.md) et la
[procédure de revue](references/review.md). Utiliser les specs applicables,
le change et ses scénarios comme critères ; ne pas inventer une architecture.

1. Déterminer la base et le diff réel, y compris les fichiers non suivis.
   Préserver les modifications existantes. Une revue seule ne modifie pas le code.
2. Suivre les contrats, appels et frontières touchés ; comparer les comportements
   avant/après. Chercher les erreurs et régressions probables, pas des préférences de style.
3. Examiner conception, état, déterminisme, types, erreurs, tests et risques
   selon le guide commun. Utiliser la matrice release pour les contrôles adaptés.
4. Exécuter uniquement les validations autorisées dans Docker. Si elles sont
   interdites ou impossibles, les marquer non exécutées et remettre les commandes.
5. Présenter les constats localisés, impact, confiance et preuve disponible.
   Séparer défaut confirmé, risque à vérifier et recommandation non bloquante.
   Sans constat confirmé, expliquer le périmètre et les limites, pas « aucun défaut ».

Sur la chaîne d'outillage, revoir aussi références immuables, checksum avant
exécution, vrais codes de sortie et compatibilités de peers. Une suppression
de diagnostic doit avoir une portée précise et une justification vérifiable ;
suivre les champs et dates du guide qualité, sans exception générale.

Ne pas corriger, installer, commiter, pousser, merger, publier ou archiver sans
demande distincte. Ne pas certifier la sécurité à partir de lint/npm audit.
Pour un audit approfondi, annoncer le périmètre spécifique nécessaire.
