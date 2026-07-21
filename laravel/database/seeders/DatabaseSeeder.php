<?php

namespace Database\Seeders;

use App\Models\Category;
use App\Models\Prompt;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Reprend les données initiales du schéma Supabase d'origine :
     * catégories par défaut + prompts d'exemple. Idempotent (upsert par
     * clé naturelle) pour pouvoir être rejoué au démarrage du conteneur.
     */
    public function run(): void
    {
        $categories = [
            ['name' => 'Général',        'color' => '#6366f1'],
            ['name' => 'Documentation',  'color' => '#0ea5e9'],
            ['name' => 'Code',           'color' => '#10b981'],
            ['name' => 'Analyse',        'color' => '#f59e0b'],
            ['name' => 'Créatif',        'color' => '#ec4899'],
            ['name' => 'Automatisation', 'color' => '#8b5cf6'],
            ['name' => 'Débogage',       'color' => '#ef4444'],
            ['name' => 'Formation',      'color' => '#14b8a6'],
        ];

        foreach ($categories as $category) {
            Category::firstOrCreate(['name' => $category['name']], $category);
        }

        if (Prompt::query()->exists()) {
            return;
        }

        Prompt::create([
            'title' => 'Rédiger un README complet',
            'content' => "Tu es un expert en documentation technique. Génère un README.md complet pour le projet suivant : [description du projet].\n\nLe README doit inclure :\n- Badge de version, licence et CI\n- Description claire du projet\n- Prérequis et installation\n- Guide d'utilisation avec exemples\n- Structure du projet\n- Contribution et licence\n\nUtilise des emojis pour les sections, un ton professionnel mais accessible.",
            'description' => 'Prompt pour générer des README professionnels complets',
            'tags' => ['documentation', 'readme', 'github'],
            'model' => 'claude-3',
            'source' => 'darkmedia-x_prompt-ai',
            'category_id' => Category::where('name', 'Documentation')->value('id'),
        ]);

        Prompt::create([
            'title' => 'Analyste de code — revue de PR',
            'content' => "Tu es un ingénieur senior spécialisé en revue de code. Analyse le diff suivant et fournis :\n\n1. **Bugs potentiels** : liste avec sévérité (critique / majeur / mineur)\n2. **Problèmes de sécurité** : OWASP top 10, injections, exposition de données\n3. **Performance** : goulots d'étranglement, optimisations possibles\n4. **Lisibilité** : nommage, complexité, duplication\n5. **Tests manquants** : cas limites non couverts\n\nDiff :\n```\n[COLLER LE DIFF ICI]\n```",
            'description' => 'Revue approfondie de pull requests avec catégorisation des problèmes',
            'tags' => ['code', 'review', 'securite', 'pr'],
            'model' => 'gpt-4',
            'category_id' => Category::where('name', 'Code')->value('id'),
        ]);

        Prompt::create([
            'title' => 'Débogage pas à pas',
            'content' => "Tu es un expert en débogage. Aide-moi à résoudre cette erreur.\n\n**Erreur :**\n```\n[MESSAGE D'ERREUR]\n```\n\n**Contexte :**\n- Langage/Framework : [ex: Python 3.11 / FastAPI]\n- Environnement : [local / Docker / CI]\n- Derniers changements : [description]\n\nProcède ainsi :\n1. Identifie la cause racine probable\n2. Explique pourquoi cette erreur se produit\n3. Propose 2-3 solutions avec avantages/inconvénients\n4. Donne la solution recommandée avec code corrigé",
            'description' => 'Débogage structuré avec analyse de la cause racine',
            'tags' => ['debug', 'erreur', 'code'],
            'category_id' => Category::where('name', 'Débogage')->value('id'),
        ]);
    }
}
