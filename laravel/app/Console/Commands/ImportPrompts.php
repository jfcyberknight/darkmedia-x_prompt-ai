<?php

namespace App\Console\Commands;

use App\Models\Category;
use App\Models\Prompt;
use App\Models\PromptVersion;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Importe des prompts, catégories et versions depuis un export JSON (typiquement
 * l'ancienne base Supabase). Les UUID d'origine sont préservés → l'import est
 * idempotent (rejouable sans créer de doublon). Les catégories sont remappées
 * par NOM sur celles déjà présentes dans l'app (le seeder en crée 8) ; une
 * catégorie inconnue est créée à la volée.
 *
 * Format JSON attendu :
 * {
 *   "categories": [ { "name": "...", "color": "#..." } ],
 *   "prompts": [ {
 *     "id": "uuid", "title": "...", "content": "...", "description": "...",
 *     "category_name": "...", "tags": ["..."], "model": "...", "source": "...",
 *     "is_favorite": false, "usage_count": 0,
 *     "created_at": "...", "updated_at": "..."
 *   } ],
 *   "prompt_versions": [ {
 *     "id": "uuid", "prompt_id": "uuid", "title": "...", "content": "...",
 *     "version": 1, "created_at": "..."
 *   } ]
 * }
 */
class ImportPrompts extends Command
{
    protected $signature = 'prompts:import
        {file : Chemin du fichier JSON à importer (ou "-" pour lire l\'entrée standard)}
        {--fresh : Vide prompts et prompt_versions avant l\'import (repartir des seules données importées)}';

    protected $description = 'Importe des prompts/catégories/versions depuis un export JSON (ex : ancienne base Supabase)';

    public function handle(): int
    {
        $file = $this->argument('file');

        // "-" → lecture depuis STDIN, pour un import en flux :
        //   docker exec -i prompt-ai php artisan prompts:import - --fresh < export.json
        if ($file === '-') {
            $raw = (string) file_get_contents('php://stdin');
        } elseif (is_file($file)) {
            $raw = (string) file_get_contents($file);
        } else {
            $this->error("Fichier introuvable : {$file}");

            return self::FAILURE;
        }

        $data = json_decode($raw, true);
        if (! is_array($data)) {
            $this->error('JSON invalide.');

            return self::FAILURE;
        }

        $categories = $data['categories'] ?? [];
        $prompts = $data['prompts'] ?? [];
        $versions = $data['prompt_versions'] ?? [];

        if ($this->option('fresh')) {
            $this->warn('Option --fresh : suppression des prompts et versions existants.');
            PromptVersion::query()->delete();
            Prompt::query()->delete();
        }

        DB::transaction(function () use ($categories, $prompts, $versions) {
            // 1) Catégories : upsert par nom (conserve les ids existants de l'app).
            foreach ($categories as $c) {
                $name = $c['name'] ?? null;
                if (! $name) {
                    continue;
                }
                Category::firstOrCreate(
                    ['name' => $name],
                    ['color' => $c['color'] ?? '#6366f1']
                );
            }

            // Table de correspondance nom (minuscule) → id de catégorie.
            $catByName = Category::all()->keyBy(fn ($c) => mb_strtolower($c->name));

            // 2) Prompts : insert direct (bypass événements → pas de version parasite),
            //    UUID et timestamps d'origine préservés.
            $now = now();
            foreach ($prompts as $p) {
                $categoryId = null;
                $catName = $p['category_name'] ?? null;
                if ($catName && $catByName->has(mb_strtolower($catName))) {
                    $categoryId = $catByName->get(mb_strtolower($catName))->id;
                }

                $tags = $p['tags'] ?? [];
                if (is_string($tags)) {
                    $tags = json_decode($tags, true) ?: [];
                }

                DB::table('prompts')->updateOrInsert(
                    ['id' => $p['id'] ?? (string) Str::uuid()],
                    [
                        'title' => $p['title'] ?? '(sans titre)',
                        'content' => $p['content'] ?? '',
                        'description' => $p['description'] ?? null,
                        'category_id' => $categoryId,
                        'tags' => json_encode(array_values($tags), JSON_UNESCAPED_UNICODE),
                        'model' => $p['model'] ?? null,
                        'source' => $p['source'] ?? null,
                        'is_favorite' => ! empty($p['is_favorite']),
                        'usage_count' => (int) ($p['usage_count'] ?? 0),
                        'created_at' => $p['created_at'] ?? $now,
                        'updated_at' => $p['updated_at'] ?? $now,
                    ]
                );
            }

            // 3) Versions : insert direct par id.
            $promptIds = DB::table('prompts')->pluck('id')->flip();
            foreach ($versions as $v) {
                // On ignore une version dont le prompt parent n'a pas été importé
                // (contrainte de clé étrangère).
                if (! isset($v['prompt_id']) || ! $promptIds->has($v['prompt_id'])) {
                    continue;
                }
                DB::table('prompt_versions')->updateOrInsert(
                    ['id' => $v['id'] ?? (string) Str::uuid()],
                    [
                        'prompt_id' => $v['prompt_id'],
                        'title' => $v['title'] ?? '',
                        'content' => $v['content'] ?? '',
                        'version' => (int) ($v['version'] ?? 1),
                        'created_at' => $v['created_at'] ?? $now,
                        'updated_at' => $v['created_at'] ?? $now,
                    ]
                );
            }
        });

        $this->info(sprintf(
            'Import terminé : %d prompt(s), %d catégorie(s), %d version(s) en base.',
            Prompt::count(),
            Category::count(),
            PromptVersion::count()
        ));

        return self::SUCCESS;
    }
}
