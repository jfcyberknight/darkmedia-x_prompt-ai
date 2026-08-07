<?php

namespace Tests\Feature;

use App\Models\Category;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class ImportPromptsCommandTest extends TestCase
{
    use RefreshDatabase;

    public function test_imports_prompts_categories_and_versions_from_json_file(): void
    {
        Storage::fake('local');

        $category = Category::create(['name' => 'Code', 'color' => '#10b981']);
        $promptId = '11111111-1111-1111-1111-111111111111';
        $versionId = '22222222-2222-2222-2222-222222222222';

        $json = json_encode([
            'categories' => [
                ['name' => 'Code', 'color' => '#000000'],
                ['name' => 'Nouvelle', 'color' => '#ff0000'],
            ],
            'prompts' => [
                [
                    'id' => $promptId,
                    'title' => 'Mon prompt',
                    'content' => 'Contenu',
                    'description' => 'Description',
                    'category_name' => 'code',
                    'tags' => ['php'],
                    'model' => 'gpt-4',
                    'source' => 'Supabase',
                    'is_favorite' => true,
                    'usage_count' => 5,
                    'created_at' => '2024-01-01 00:00:00',
                    'updated_at' => '2024-01-01 00:00:00',
                ],
            ],
            'prompt_versions' => [
                [
                    'id' => $versionId,
                    'prompt_id' => $promptId,
                    'title' => 'V1',
                    'content' => 'Contenu V1',
                    'version' => 1,
                    'created_at' => '2024-01-01 00:00:00',
                ],
            ],
        ]);

        $path = Storage::disk('local')->path('import.json');
        file_put_contents($path, $json);

        $this->artisan('prompts:import', ['file' => $path])
            ->assertSuccessful();

        $this->assertDatabaseHas('categories', ['name' => 'Nouvelle', 'color' => '#ff0000']);
        // La catégorie existante Code garde sa couleur originale.
        $this->assertDatabaseHas('categories', ['name' => 'Code', 'color' => '#10b981']);
        $this->assertDatabaseHas('prompts', [
            'id' => $promptId,
            'title' => 'Mon prompt',
            'category_id' => $category->id,
            'is_favorite' => true,
            'usage_count' => 5,
        ]);
        $this->assertDatabaseHas('prompt_versions', ['id' => $versionId, 'prompt_id' => $promptId, 'version' => 1]);
    }

    public function test_fresh_option_clears_existing_prompts(): void
    {
        Storage::fake('local');

        $oldPromptId = '00000000-0000-0000-0000-000000000000';
        \App\Models\Prompt::create(['id' => $oldPromptId, 'title' => 'Ancien', 'content' => 'Ancien']);

        $path = Storage::disk('local')->path('import.json');
        file_put_contents($path, json_encode([
            'categories' => [],
            'prompts' => [
                ['id' => '11111111-1111-1111-1111-111111111111', 'title' => 'Nouveau', 'content' => 'Nouveau'],
            ],
            'prompt_versions' => [],
        ]));

        $this->artisan('prompts:import', ['file' => $path, '--fresh' => true])
            ->assertSuccessful();

        $this->assertDatabaseMissing('prompts', ['title' => 'Ancien']);
        $this->assertDatabaseCount('prompts', 1);
    }

    public function test_missing_file_returns_failure(): void
    {
        $this->artisan('prompts:import', ['file' => '/tmp/fichier-inexistant.json'])
            ->assertFailed()
            ->expectsOutputToContain('Fichier introuvable');
    }

    public function test_invalid_json_returns_failure(): void
    {
        Storage::fake('local');

        $path = Storage::disk('local')->path('import.json');
        file_put_contents($path, 'pas du json');

        $this->artisan('prompts:import', ['file' => $path])
            ->assertFailed()
            ->expectsOutputToContain('JSON invalide');
    }

    public function test_ignores_version_with_unknown_parent_prompt(): void
    {
        Storage::fake('local');

        $path = Storage::disk('local')->path('import.json');
        file_put_contents($path, json_encode([
            'categories' => [],
            'prompts' => [
                ['id' => '11111111-1111-1111-1111-111111111111', 'title' => 'Nouveau', 'content' => 'Nouveau'],
            ],
            'prompt_versions' => [
                ['id' => '22222222-2222-2222-2222-222222222222', 'prompt_id' => '99999999-9999-9999-9999-999999999999', 'title' => 'V1', 'content' => 'C1', 'version' => 1],
            ],
        ]));

        $this->artisan('prompts:import', ['file' => $path])
            ->assertSuccessful();

        $this->assertDatabaseCount('prompt_versions', 0);
    }
}
